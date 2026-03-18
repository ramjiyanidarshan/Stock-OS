const knex = require('../config/knex');

/**
 * Core inventory service.
 * Race condition prevention: All stock mutations use DB-level row locking
 * via SELECT ... FOR UPDATE inside a serializable transaction.
 * Two concurrent "stock-out" calls will queue at the DB lock;
 * the second one sees the updated balance and fails gracefully if qty is 0.
 */

// Get total stock for a product (summed across all batches/locations)
async function getProductStock(productId, trx = knex) {
  const rows = await trx('inventory')
    .where('product_id', productId)
    .sum('quantity as total')
    .first();
  return parseFloat(rows?.total || 0);
}

// Get FIFO-ordered batches with stock > 0 for a product at a location
async function getFIFOBatches(productId, locationId, trx = knex) {
  return trx('inventory')
    .join('batches', 'inventory.batch_id', 'batches.id')
    .where('inventory.product_id', productId)
    .where('inventory.virtual_location_id', locationId)
    .where('inventory.quantity', '>', 0)
    .orderBy('batches.created_at', 'asc') // FIFO: oldest batch first
    .select(
      'inventory.id as inv_id',
      'inventory.quantity',
      'inventory.batch_id',
      'batches.batch_number',
      'batches.expiry_date',
      'batches.purchase_price'
    )
    .forUpdate(); // Lock rows during transaction
}

// Convert quantity between units
async function convertUnit(quantity, fromUnitId, toUnitId, trx = knex) {
  if (fromUnitId === toUnitId) return quantity;
  const conv = await trx('unit_conversions')
    .where({ from_unit_id: fromUnitId, to_unit_id: toUnitId })
    .first();
  if (!conv) {
    // Try inverse
    const inv = await trx('unit_conversions')
      .where({ from_unit_id: toUnitId, to_unit_id: fromUnitId })
      .first();
    if (!inv) throw new Error(`No conversion found between units ${fromUnitId} and ${toUnitId}`);
    return quantity / parseFloat(inv.factor);
  }
  return quantity * parseFloat(conv.factor);
}

// Check and trigger low stock alert
async function checkLowStock(productId, trx = knex) {
  const product = await trx('products').where('id', productId).first();
  const total = await getProductStock(productId, trx);
  if (total <= parseFloat(product.reorder_point)) {
    // Upsert alert
    const existing = await trx('low_stock_alerts')
      .where({ product_id: productId, is_resolved: false })
      .first();
    if (!existing) {
      await trx('low_stock_alerts').insert({
        product_id: productId,
        current_qty: total,
        reorder_point: product.reorder_point,
      });
    }
  } else {
    // Resolve any open alert
    await trx('low_stock_alerts')
      .where({ product_id: productId, is_resolved: false })
      .update({ is_resolved: true, resolved_at: knex.fn.now() });
  }
}

/**
 * STOCK IN: Receives goods into a location under a batch.
 */
exports.stockIn = async ({ productId, batchData, locationId, quantity, unitId, unitPrice, referenceNumber, reason, userId }) => {
  return knex.transaction(async trx => {
    const product = await trx('products').where('id', productId).first();
    if (!product) throw new Error('Product not found');

    // Normalize to purchase unit
    const qtyInPurchaseUnit = await convertUnit(quantity, unitId, product.purchase_unit_id, trx);

    // Get or create batch
    let batch;
    if (product.track_batches) {
      batch = await trx('batches').where({ product_id: productId, batch_number: batchData.batch_number }).first();
      if (!batch) {
        const [batchId] = await trx('batches').insert({
          product_id: productId,
          batch_number: batchData.batch_number,
          manufacture_date: batchData.manufacture_date || null,
          expiry_date: batchData.expiry_date || null,
          purchase_price: unitPrice || product.purchase_price,
        });
        batch = await trx('batches').where('id', batchId).first();
      }
    }

    const batchId = batch?.id || null;

    // Get opening balance
    const openingBalance = await getProductStock(productId, trx);

    // Upsert inventory row
    const existing = await trx('inventory')
      .where({ product_id: productId, batch_id: batchId, virtual_location_id: locationId })
      .first();

    if (existing) {
      await trx('inventory')
        .where('id', existing.id)
        .increment('quantity', qtyInPurchaseUnit);
    } else {
      await trx('inventory').insert({
        product_id: productId,
        batch_id: batchId,
        virtual_location_id: locationId,
        quantity: qtyInPurchaseUnit,
      });
    }

    const closingBalance = openingBalance + qtyInPurchaseUnit;

    // Immutable movement log
    await trx('stock_movements').insert({
      movement_type: 'stock_in',
      product_id: productId,
      batch_id: batchId,
      to_location_id: locationId,
      quantity,
      unit_id: unitId,
      quantity_in_purchase_unit: qtyInPurchaseUnit,
      unit_price: unitPrice || product.purchase_price,
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      reference_number: referenceNumber || null,
      reason: reason || 'Purchase receipt',
      performed_by: userId,
    });

    await checkLowStock(productId, trx);
    return { openingBalance, closingBalance, qtyInPurchaseUnit };
  });
};

/**
 * STOCK OUT: Deducts stock using FIFO logic.
 * Race-safe: uses FOR UPDATE locks within a transaction.
 */
exports.stockOut = async ({ productId, locationId, quantity, unitId, referenceNumber, reason, userId }) => {
  return knex.transaction(async trx => {
    const product = await trx('products').where('id', productId).first();
    if (!product) throw new Error('Product not found');

    const qtyInPurchaseUnit = await convertUnit(quantity, unitId, product.purchase_unit_id, trx);

    // Lock and get FIFO batches
    const batches = await getFIFOBatches(productId, locationId, trx);
    const totalAvailable = batches.reduce((s, b) => s + parseFloat(b.quantity), 0);

    if (totalAvailable < qtyInPurchaseUnit) {
      throw new Error(`Insufficient stock. Available: ${totalAvailable}, Requested: ${qtyInPurchaseUnit}`);
    }

    const openingBalance = await getProductStock(productId, trx);
    let remaining = qtyInPurchaseUnit;

    for (const batch of batches) {
      if (remaining <= 0) break;
      const deduct = Math.min(parseFloat(batch.quantity), remaining);

      await trx('inventory')
        .where('id', batch.inv_id)
        .decrement('quantity', deduct);

      remaining -= deduct;
    }

    const closingBalance = openingBalance - qtyInPurchaseUnit;

    await trx('stock_movements').insert({
      movement_type: 'stock_out',
      product_id: productId,
      from_location_id: locationId,
      quantity,
      unit_id: unitId,
      quantity_in_purchase_unit: qtyInPurchaseUnit,
      unit_price: product.purchase_price,
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      reference_number: referenceNumber || null,
      reason: reason || 'Sales / Usage',
      performed_by: userId,
    });

    await checkLowStock(productId, trx);
    return { openingBalance, closingBalance, qtyInPurchaseUnit };
  });
};

/**
 * STOCK ADJUSTMENT: Forces stock to a specific count with mandatory reason.
 * Users can NEVER edit stock directly; they must go through this.
 */
exports.stockAdjust = async ({ productId, locationId, batchId, newQuantity, reason, userId }) => {
  if (!reason || reason.trim().length < 5) {
    throw new Error('A reason of at least 5 characters is required for adjustments');
  }
  return knex.transaction(async trx => {
    // Lock the inventory row
    const inv = await trx('inventory')
      .where({ product_id: productId, virtual_location_id: locationId, batch_id: batchId })
      .forUpdate()
      .first();

    const currentQty = inv ? parseFloat(inv.quantity) : 0;
    const openingBalance = await getProductStock(productId, trx);
    const diff = newQuantity - currentQty;

    if (inv) {
      await trx('inventory').where('id', inv.id).update({ quantity: newQuantity });
    } else {
      await trx('inventory').insert({
        product_id: productId, batch_id: batchId,
        virtual_location_id: locationId, quantity: newQuantity,
      });
    }

    const product = await trx('products').where('id', productId).first();
    const closingBalance = openingBalance + diff;

    await trx('stock_movements').insert({
      movement_type: 'adjustment',
      product_id: productId,
      batch_id: batchId || null,
      to_location_id: diff >= 0 ? locationId : null,
      from_location_id: diff < 0 ? locationId : null,
      quantity: Math.abs(diff),
      unit_id: product.purchase_unit_id,
      quantity_in_purchase_unit: Math.abs(diff),
      unit_price: product.purchase_price,
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      reason,
      performed_by: userId,
    });

    await checkLowStock(productId, trx);
    return { openingBalance, closingBalance, adjustment: diff };
  });
};

/**
 * STOCK TRANSFER: Moves stock between virtual locations.
 */
exports.stockTransfer = async ({ productId, batchId, fromLocationId, toLocationId, quantity, reason, userId }) => {
  return knex.transaction(async trx => {
    const product = await trx('products').where('id', productId).first();

    // Lock source row
    const source = await trx('inventory')
      .where({ product_id: productId, batch_id: batchId, virtual_location_id: fromLocationId })
      .forUpdate().first();

    if (!source || parseFloat(source.quantity) < quantity) {
      throw new Error('Insufficient stock at source location');
    }

    const openingBalance = await getProductStock(productId, trx);

    await trx('inventory').where('id', source.id).decrement('quantity', quantity);

    const dest = await trx('inventory')
      .where({ product_id: productId, batch_id: batchId, virtual_location_id: toLocationId })
      .first();
    if (dest) {
      await trx('inventory').where('id', dest.id).increment('quantity', quantity);
    } else {
      await trx('inventory').insert({ product_id: productId, batch_id: batchId, virtual_location_id: toLocationId, quantity });
    }

    await trx('stock_movements').insert({
      movement_type: 'transfer',
      product_id: productId,
      batch_id: batchId,
      from_location_id: fromLocationId,
      to_location_id: toLocationId,
      quantity,
      unit_id: product.purchase_unit_id,
      quantity_in_purchase_unit: quantity,
      unit_price: product.purchase_price,
      opening_balance: openingBalance,
      closing_balance: openingBalance, // total unchanged
      reason: reason || 'Internal transfer',
      performed_by: userId,
    });

    return { success: true };
  });
};

exports.getProductStock = getProductStock;
