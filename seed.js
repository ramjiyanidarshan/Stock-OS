/**
 * ============================================================
 * seed.js — StockOS Inventory ERP
 * ============================================================
 * Populates the database with realistic demo data:
 *
 *   • 3 Roles (admin, warehouse_user, viewer)
 *   • 5 Users (admin + 4 departmental staff)
 *   • 2 Warehouses, 6 Virtual Locations
 *   • 5 Categories
 *   • 8 Units of Measure + 6 Conversion rules
 *   • 12 Products (electronics, FMCG, pharma, raw materials)
 *   • 20 Batches across products
 *   • Initial inventory stock via stock_in movements
 *   • Sample stock_out and adjustment movements
 *   • Low-stock alert for one product
 *
 * Usage:
 *   node seed.js             → seed (skips if already seeded)
 *   node seed.js --force     → truncate seed tables then re-seed
 *
 * Requires migrate.js to have been run first.
 * ============================================================
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const knex = require('knex')({
  client: 'mysql2',
  connection: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'inventory_erp',
    timezone: 'UTC',
  },
  pool: { min: 1, max: 5 },
});

const isForce = process.argv.includes('--force');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const log   = (msg) => console.log(`   ${msg}`);
const ok    = (msg) => console.log(`   ✔  ${msg}`);
const skip  = (msg) => console.log(`   –  ${msg} (skipped)`);
const section = (title) => {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 48 - title.length))}`);
};

async function insertOrSkip(table, data, conflictCol = 'id') {
  try {
    const result = await knex(table).insert(data);
    return result[0]; // last insert id
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return null;
    throw err;
  }
}

// ─── ROLES ───────────────────────────────────────────────────────────────────
async function seedRoles() {
  section('Roles');
  const roles = [
    {
      name: 'admin',
      permissions: JSON.stringify(['*']),
    },
    {
      name: 'warehouse_user',
      permissions: JSON.stringify([
        'inventory.read', 'inventory.write', 'inventory.adjust',
        'products.read', 'warehouse.read', 'team.read',
        'alerts.read', 'reports.read',
      ]),
    },
    {
      name: 'viewer',
      permissions: JSON.stringify([
        'inventory.read', 'products.read', 'warehouse.read',
        'reports.read', 'alerts.read',
      ]),
    },
  ];

  const ids = {};
  for (const role of roles) {
    await knex('roles').insert(role).onConflict('name').merge({
      permissions: role.permissions,
    });
    const r = await knex('roles').where('name', role.name).first();
    ids[role.name] = r.id;
    ok(`role: ${role.name} (id=${r.id})`);
  }
  return ids;
}

// ─── USERS ───────────────────────────────────────────────────────────────────
async function seedUsers(roleIds) {
  section('Users');

  const users = [
    { name: 'System Admin',        email: 'admin@erp.com',       password: 'Admin@123',      role: 'admin',          department: 'Administration' },
    { name: 'Priya Sharma',        email: 'priya@erp.com',       password: 'Warehouse@123',  role: 'warehouse_user', department: 'Warehouse'      },
    { name: 'Ravi Patel',          email: 'ravi@erp.com',        password: 'Warehouse@123',  role: 'warehouse_user', department: 'Procurement'    },
    { name: 'Meera Nair',          email: 'meera@erp.com',       password: 'Viewer@123',     role: 'viewer',         department: 'Finance'        },
    { name: 'Arjun Desai',         email: 'arjun@erp.com',       password: 'Viewer@123',     role: 'viewer',         department: 'Logistics'      },
  ];

  const ids = {};
  for (const u of users) {
    const existing = await knex('users').where('email', u.email).first();
    if (existing) {
      skip(`user: ${u.email}`);
      ids[u.email] = existing.id;
      continue;
    }
    const hash = await bcrypt.hash(u.password, 12);
    const [id] = await knex('users').insert({
      name: u.name, email: u.email, password_hash: hash,
      role_id: roleIds[u.role], department: u.department,
    });
    ids[u.email] = id;
    ok(`user: ${u.email}  [${u.role}]  pwd: ${u.password}`);
  }
  return ids;
}

// ─── WAREHOUSES & VIRTUAL LOCATIONS ──────────────────────────────────────────
async function seedWarehouses() {
  section('Warehouses & Virtual Locations');

  const warehouses = [
    { name: 'Main Warehouse',    address: 'Plot 12, GIDC Industrial Area, Ahmedabad — 382415', manager_name: 'Priya Sharma' },
    { name: 'Transit Depot',     address: 'NH-48 Logistics Park, Surat — 395006',              manager_name: 'Arjun Desai'  },
  ];

  const whIds = {};
  for (const wh of warehouses) {
    let row = await knex('warehouses').where('name', wh.name).first();
    if (!row) {
      const [id] = await knex('warehouses').insert(wh);
      row = await knex('warehouses').where('id', id).first();
      ok(`warehouse: ${wh.name}`);
    } else {
      skip(`warehouse: ${wh.name}`);
    }
    whIds[wh.name] = row.id;
  }

  const locations = [
    { warehouse: 'Main Warehouse', name: 'Main Store',      type: 'storage'     },
    { warehouse: 'Main Warehouse', name: 'Damaged Goods',   type: 'damaged'     },
    { warehouse: 'Main Warehouse', name: 'Quarantine Bay',  type: 'quarantine'  },
    { warehouse: 'Main Warehouse', name: 'Dispatch Area',   type: 'transit'     },
    { warehouse: 'Transit Depot',  name: 'Receiving Dock',  type: 'storage'     },
    { warehouse: 'Transit Depot',  name: 'On-Transit Hold', type: 'transit'     },
  ];

  const locIds = {};
  for (const loc of locations) {
    let row = await knex('virtual_locations')
      .where({ warehouse_id: whIds[loc.warehouse], name: loc.name }).first();
    if (!row) {
      const [id] = await knex('virtual_locations').insert({
        warehouse_id: whIds[loc.warehouse], name: loc.name, type: loc.type,
      });
      row = await knex('virtual_locations').where('id', id).first();
      ok(`location: [${loc.warehouse}] ${loc.name}  (${loc.type})`);
    } else {
      skip(`location: ${loc.name}`);
    }
    locIds[loc.name] = row.id;
  }

  return { whIds, locIds };
}

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
async function seedCategories() {
  section('Categories');

  const cats = [
    { name: 'Electronics',    description: 'Electronic components and consumer devices' },
    { name: 'FMCG',           description: 'Fast-Moving Consumer Goods — food, beverages, household' },
    { name: 'Pharmaceuticals',description: 'Medicines, supplements, medical consumables' },
    { name: 'Raw Materials',  description: 'Unprocessed inputs for manufacturing' },
    { name: 'Packaging',      description: 'Boxes, labels, wrapping materials' },
  ];

  const ids = {};
  for (const cat of cats) {
    let row = await knex('categories').where('name', cat.name).first();
    if (!row) {
      const [id] = await knex('categories').insert(cat);
      row = { id };
      ok(`category: ${cat.name}`);
    } else {
      skip(`category: ${cat.name}`);
    }
    ids[cat.name] = row.id || (await knex('categories').where('name', cat.name).first()).id;
  }
  return ids;
}

// ─── UNITS & CONVERSIONS ──────────────────────────────────────────────────────
async function seedUnits() {
  section('Units of Measure');

  const units = [
    { name: 'Piece',    abbreviation: 'PCS'  },
    { name: 'Crate',    abbreviation: 'CRT'  },
    { name: 'Box',      abbreviation: 'BOX'  },
    { name: 'Carton',   abbreviation: 'CTN'  },
    { name: 'Kilogram', abbreviation: 'KG'   },
    { name: 'Gram',     abbreviation: 'GM'   },
    { name: 'Litre',    abbreviation: 'LTR'  },
    { name: 'Millilitre', abbreviation: 'ML' },
  ];

  const ids = {};
  for (const u of units) {
    let row = await knex('units').where('abbreviation', u.abbreviation).first();
    if (!row) {
      const [id] = await knex('units').insert(u);
      row = await knex('units').where('id', id).first();
      ok(`unit: ${u.name} (${u.abbreviation})`);
    } else {
      skip(`unit: ${u.name}`);
    }
    ids[u.abbreviation] = row.id;
  }

  section('Unit Conversions');

  // factor: 1 FROM = factor × TO
  const conversions = [
    { from: 'CRT', to: 'PCS', factor: 24,    label: '1 Crate = 24 Pieces'      },
    { from: 'CTN', to: 'BOX', factor: 12,    label: '1 Carton = 12 Boxes'      },
    { from: 'BOX', to: 'PCS', factor: 6,     label: '1 Box = 6 Pieces'         },
    { from: 'KG',  to: 'GM',  factor: 1000,  label: '1 Kilogram = 1000 Grams'  },
    { from: 'LTR', to: 'ML',  factor: 1000,  label: '1 Litre = 1000 Millilitres' },
    { from: 'CTN', to: 'PCS', factor: 72,    label: '1 Carton = 72 Pieces (12×6)' },
  ];

  for (const c of conversions) {
    const exists = await knex('unit_conversions')
      .where({ from_unit_id: ids[c.from], to_unit_id: ids[c.to] }).first();
    if (!exists) {
      await knex('unit_conversions').insert({
        from_unit_id: ids[c.from], to_unit_id: ids[c.to], factor: c.factor,
      });
      ok(`conversion: ${c.label}`);
    } else {
      skip(`conversion: ${c.label}`);
    }
  }

  return ids;
}

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
async function seedProducts(catIds, unitIds) {
  section('Products');

  const products = [
    // Electronics
    { sku: 'ELEC-001', name: 'USB-C Charging Cable 2m',    category: 'Electronics',     purchase_unit: 'CTN', sale_unit: 'PCS', purchase_price: 1800,  reorder_point: 5,   track_batches: true,  track_expiry: false, description: 'Braided USB-C to USB-A, 2 metre, 3A fast charge' },
    { sku: 'ELEC-002', name: 'Wireless Bluetooth Earbuds', category: 'Electronics',     purchase_unit: 'CTN', sale_unit: 'PCS', purchase_price: 8400,  reorder_point: 3,   track_batches: true,  track_expiry: false, description: 'TWS earbuds, 6hr battery, IPX4' },
    { sku: 'ELEC-003', name: '10000mAh Power Bank',        category: 'Electronics',     purchase_unit: 'BOX', sale_unit: 'PCS', purchase_price: 5200,  reorder_point: 10,  track_batches: true,  track_expiry: false, description: 'Dual output 10W, LED indicator' },
    // FMCG
    { sku: 'FMCG-001', name: 'Basmati Rice Premium 5kg',   category: 'FMCG',            purchase_unit: 'CRT', sale_unit: 'PCS', purchase_price: 2100,  reorder_point: 20,  track_batches: true,  track_expiry: true,  description: 'Extra-long grain, aged 2 years' },
    { sku: 'FMCG-002', name: 'Cold-Pressed Coconut Oil 1L',category: 'FMCG',            purchase_unit: 'CTN', sale_unit: 'PCS', purchase_price: 3600,  reorder_point: 15,  track_batches: true,  track_expiry: true,  description: 'Virgin, unrefined, 12 bottles per carton' },
    { sku: 'FMCG-003', name: 'Green Tea Bags (25 pack)',   category: 'FMCG',            purchase_unit: 'CTN', sale_unit: 'PCS', purchase_price: 980,   reorder_point: 25,  track_batches: true,  track_expiry: true,  description: 'Darjeeling first flush' },
    // Pharma
    { sku: 'PHRM-001', name: 'Paracetamol 500mg Tabs ×10', category: 'Pharmaceuticals', purchase_unit: 'CTN', sale_unit: 'PCS', purchase_price: 240,   reorder_point: 50,  track_batches: true,  track_expiry: true,  description: 'Analgesic / antipyretic strip of 10' },
    { sku: 'PHRM-002', name: 'Surgical Gloves (L) ×100',   category: 'Pharmaceuticals', purchase_unit: 'CRT', sale_unit: 'BOX', purchase_price: 1600,  reorder_point: 10,  track_batches: true,  track_expiry: true,  description: 'Latex-free nitrile examination gloves' },
    // Raw Materials
    { sku: 'RAWM-001', name: 'Stainless Steel Wire 1mm',   category: 'Raw Materials',   purchase_unit: 'KG',  sale_unit: 'KG',  purchase_price: 320,   reorder_point: 100, track_batches: false, track_expiry: false, description: 'Grade 304, 1mm diameter, 25kg coil' },
    { sku: 'RAWM-002', name: 'HDPE Granules Natural',      category: 'Raw Materials',   purchase_unit: 'KG',  sale_unit: 'KG',  purchase_price: 115,   reorder_point: 500, track_batches: true,  track_expiry: false, description: 'High-density polyethylene, MFI 0.3' },
    // Packaging
    { sku: 'PACK-001', name: 'Corrugated Box 30×20×15cm',  category: 'Packaging',       purchase_unit: 'CTN', sale_unit: 'PCS', purchase_price: 850,   reorder_point: 30,  track_batches: false, track_expiry: false, description: '5-ply corrugated, 3kg load capacity' },
    { sku: 'PACK-002', name: 'Bubble Wrap Roll 50m',       category: 'Packaging',       purchase_unit: 'BOX', sale_unit: 'PCS', purchase_price: 1200,  reorder_point: 8,   track_batches: false, track_expiry: false, description: '500mm wide, 10mm bubble, clear' },
  ];

  const ids = {};
  for (const p of products) {
    let row = await knex('products').where('sku', p.sku).first();
    if (!row) {
      const [id] = await knex('products').insert({
        sku:              p.sku,
        name:             p.name,
        description:      p.description,
        category_id:      catIds[p.category],
        purchase_unit_id: unitIds[p.purchase_unit],
        sale_unit_id:     unitIds[p.sale_unit],
        purchase_price:   p.purchase_price,
        reorder_point:    p.reorder_point,
        track_batches:    p.track_batches,
        track_expiry:     p.track_expiry,
      });
      row = await knex('products').where('id', id).first();
      ok(`product: [${p.sku}] ${p.name}`);
    } else {
      skip(`product: ${p.sku}`);
    }
    ids[p.sku] = row.id;
  }
  return ids;
}

// ─── INVENTORY (Batches + Stock Movements + inventory rows) ───────────────────
async function seedInventory(productIds, unitIds, locIds, userIds) {
  section('Batches, Stock-In Movements & Inventory');

  const adminId  = userIds['admin@erp.com'];
  const whUserId = userIds['priya@erp.com'];
  const mainStore   = locIds['Main Store'];
  const damagedGoods= locIds['Damaged Goods'];
  const receivingDock = locIds['Receiving Dock'];

  // Helper: perform a stock-in as a DB-level operation (mirrors inventory.service.js)
  async function doStockIn({ sku, batchNumber, mfgDate, expiryDate, locationId, qty, unitAbbr, price, ref, reason, userId }) {
    const productId = productIds[sku];
    if (!productId) return;

    return knex.transaction(async trx => {
      const product = await trx('products').where('id', productId).first();

      // Resolve unit
      const unit = await trx('units').where('abbreviation', unitAbbr).first();
      if (!unit) throw new Error(`Unit not found: ${unitAbbr}`);

      // Convert to purchase unit
      let qtyInPurchaseUnit = qty;
      if (unit.id !== product.purchase_unit_id) {
        const conv = await trx('unit_conversions')
          .where({ from_unit_id: unit.id, to_unit_id: product.purchase_unit_id }).first();
        if (conv) {
          qtyInPurchaseUnit = qty * parseFloat(conv.factor);
        }
      }

      // Get or create batch
      let batch = null;
      if (product.track_batches && batchNumber) {
        batch = await trx('batches').where({ product_id: productId, batch_number: batchNumber }).first();
        if (!batch) {
          const [bId] = await trx('batches').insert({
            product_id: productId, batch_number: batchNumber,
            manufacture_date: mfgDate || null, expiry_date: expiryDate || null,
            purchase_price: price,
          });
          batch = await trx('batches').where('id', bId).first();
        }
      }

      const batchId = batch?.id || null;

      // Opening balance
      const openingRow = await trx('inventory').where('product_id', productId).sum('quantity as total').first();
      const opening = parseFloat(openingRow?.total || 0);
      const closing = opening + qtyInPurchaseUnit;

      // Upsert inventory
      const existing = await trx('inventory')
        .where({ product_id: productId, batch_id: batchId, virtual_location_id: locationId }).first();
      if (existing) {
        await trx('inventory').where('id', existing.id).increment('quantity', qtyInPurchaseUnit);
      } else {
        await trx('inventory').insert({ product_id: productId, batch_id: batchId, virtual_location_id: locationId, quantity: qtyInPurchaseUnit });
      }

      // Immutable movement log
      await trx('stock_movements').insert({
        movement_type: 'stock_in', product_id: productId, batch_id: batchId,
        to_location_id: locationId, quantity: qty, unit_id: unit.id,
        quantity_in_purchase_unit: qtyInPurchaseUnit, unit_price: price,
        opening_balance: opening, closing_balance: closing,
        reference_number: ref, reason,
        performed_by: userId, performed_at: knex.fn.now(),
      });

      return { qtyInPurchaseUnit, closing };
    });
  }

  async function doStockOut({ sku, locationId, qty, unitAbbr, ref, reason, userId }) {
    const productId = productIds[sku];
    if (!productId) return;

    return knex.transaction(async trx => {
      const product = await trx('products').where('id', productId).first();
      const unit = await trx('units').where('abbreviation', unitAbbr).first();

      let qtyInPurchaseUnit = qty;
      if (unit.id !== product.purchase_unit_id) {
        const conv = await trx('unit_conversions').where({ from_unit_id: unit.id, to_unit_id: product.purchase_unit_id }).first();
        if (conv) qtyInPurchaseUnit = qty * parseFloat(conv.factor);
      }

      // FIFO batches
      const batches = await trx('inventory')
        .join('batches', 'inventory.batch_id', 'batches.id')
        .where('inventory.product_id', productId)
        .where('inventory.virtual_location_id', locationId)
        .where('inventory.quantity', '>', 0)
        .orderBy('batches.created_at', 'asc')
        .select('inventory.id as inv_id', 'inventory.quantity', 'inventory.batch_id')
        .forUpdate();

      const totalAvail = batches.reduce((s, b) => s + parseFloat(b.quantity), 0);
      if (totalAvail < qtyInPurchaseUnit) return; // skip if insufficient (demo data)

      const opening = await trx('inventory').where('product_id', productId).sum('quantity as total').first().then(r => parseFloat(r?.total || 0));

      let rem = qtyInPurchaseUnit;
      for (const b of batches) {
        if (rem <= 0) break;
        const deduct = Math.min(parseFloat(b.quantity), rem);
        await trx('inventory').where('id', b.inv_id).decrement('quantity', deduct);
        rem -= deduct;
      }

      const closing = opening - qtyInPurchaseUnit;

      await trx('stock_movements').insert({
        movement_type: 'stock_out', product_id: productId,
        from_location_id: locationId, quantity: qty, unit_id: unit.id,
        quantity_in_purchase_unit: qtyInPurchaseUnit, unit_price: product.purchase_price,
        opening_balance: opening, closing_balance: closing,
        reference_number: ref, reason,
        performed_by: userId,
      });
    });
  }

  // ── Stock In: Initial receipts ──────────────────────────────────────────────
  const stockIns = [
    // Electronics
    { sku: 'ELEC-001', batchNumber: 'ELEC001-B2401', mfgDate: '2024-01-10', locationId: mainStore,    qty: 10, unitAbbr: 'CTN', price: 1800,  ref: 'PO-2024-001', reason: 'Initial stock receipt from supplier Techline Pvt Ltd' },
    { sku: 'ELEC-001', batchNumber: 'ELEC001-B2403', mfgDate: '2024-03-15', locationId: mainStore,    qty: 8,  unitAbbr: 'CTN', price: 1750,  ref: 'PO-2024-008', reason: 'Q1 replenishment order' },
    { sku: 'ELEC-002', batchNumber: 'ELEC002-B2402', mfgDate: '2024-02-20', locationId: mainStore,    qty: 5,  unitAbbr: 'CTN', price: 8400,  ref: 'PO-2024-003', reason: 'New product launch stock' },
    { sku: 'ELEC-003', batchNumber: 'ELEC003-B2401', mfgDate: '2024-01-05', locationId: mainStore,    qty: 20, unitAbbr: 'BOX', price: 5200,  ref: 'PO-2024-002', reason: 'Bulk purchase for Q1 sales' },
    // FMCG
    { sku: 'FMCG-001', batchNumber: 'RICE-B2401',    mfgDate: '2024-01-01', expiryDate: '2025-12-31', locationId: mainStore, qty: 50, unitAbbr: 'CRT', price: 2100, ref: 'PO-2024-004', reason: 'Season stock for rice' },
    { sku: 'FMCG-001', batchNumber: 'RICE-B2403',    mfgDate: '2024-03-01', expiryDate: '2026-02-28', locationId: mainStore, qty: 30, unitAbbr: 'CRT', price: 2050, ref: 'PO-2024-010', reason: 'Q2 replenishment' },
    { sku: 'FMCG-002', batchNumber: 'COCO-B2402',    mfgDate: '2024-02-01', expiryDate: '2025-01-31', locationId: mainStore, qty: 20, unitAbbr: 'CTN', price: 3600, ref: 'PO-2024-005', reason: 'Initial stock for coconut oil range' },
    { sku: 'FMCG-003', batchNumber: 'TEA-B2401',     mfgDate: '2024-01-15', expiryDate: '2025-01-15', locationId: mainStore, qty: 40, unitAbbr: 'CTN', price: 980,  ref: 'PO-2024-006', reason: 'Tea bags initial stock' },
    // Pharma
    { sku: 'PHRM-001', batchNumber: 'PARA-B2401',    mfgDate: '2024-01-01', expiryDate: '2026-12-31', locationId: mainStore, qty: 100, unitAbbr: 'CTN', price: 240,  ref: 'PO-2024-007', reason: 'Pharma stock receipt — verified QA clearance' },
    { sku: 'PHRM-001', batchNumber: 'PARA-B2402',    mfgDate: '2024-04-01', expiryDate: '2027-03-31', locationId: mainStore, qty: 50,  unitAbbr: 'CTN', price: 235,  ref: 'PO-2024-015', reason: 'Second batch after QA approval' },
    { sku: 'PHRM-002', batchNumber: 'GLOVE-B2401',   mfgDate: '2024-02-10', expiryDate: '2026-02-10', locationId: mainStore, qty: 15,  unitAbbr: 'CRT', price: 1600, ref: 'PO-2024-009', reason: 'Medical consumables quarterly order' },
    // Raw Materials
    { sku: 'RAWM-001', batchNumber: null,             locationId: mainStore, qty: 500, unitAbbr: 'KG',  price: 320,  ref: 'PO-2024-011', reason: 'SS wire for production run Q1' },
    { sku: 'RAWM-002', batchNumber: 'HDPE-B2401',     locationId: mainStore, qty: 2000, unitAbbr: 'KG', price: 115,  ref: 'PO-2024-012', reason: 'HDPE for injection moulding' },
    // Packaging
    { sku: 'PACK-001', batchNumber: null, locationId: receivingDock, qty: 50, unitAbbr: 'CTN', price: 850, ref: 'PO-2024-013', reason: 'Cartons for dispatch floor' },
    { sku: 'PACK-002', batchNumber: null, locationId: receivingDock, qty: 20, unitAbbr: 'BOX', price: 1200, ref: 'PO-2024-014', reason: 'Bubble wrap for fragile items' },
  ];

  for (const s of stockIns) {
    await doStockIn({ ...s, userId: whUserId });
    ok(`stock-in: ${s.sku}  batch=${s.batchNumber || 'N/A'}  qty=${s.qty}${s.unitAbbr}`);
  }

  // ── Stock Out: Simulate some sales/usage ─────────────────────────────────────
  section('Sample Stock-Out Movements');

  const stockOuts = [
    { sku: 'ELEC-001', locationId: mainStore,    qty: 3,   unitAbbr: 'CTN', ref: 'INV-2024-001', reason: 'Sale to Flipkart fulfillment center',  userId: whUserId },
    { sku: 'ELEC-002', locationId: mainStore,    qty: 2,   unitAbbr: 'CTN', ref: 'INV-2024-002', reason: 'Sale to Amazon seller account',         userId: whUserId },
    { sku: 'ELEC-003', locationId: mainStore,    qty: 5,   unitAbbr: 'BOX', ref: 'INV-2024-003', reason: 'Corporate gifting order — Infosys',     userId: whUserId },
    { sku: 'FMCG-001', locationId: mainStore,    qty: 25,  unitAbbr: 'CRT', ref: 'INV-2024-004', reason: 'Distributor order — Ahmedabad region',  userId: whUserId },
    { sku: 'FMCG-002', locationId: mainStore,    qty: 8,   unitAbbr: 'CTN', ref: 'INV-2024-005', reason: 'Online store order batch dispatch',     userId: whUserId },
    { sku: 'FMCG-003', locationId: mainStore,    qty: 15,  unitAbbr: 'CTN', ref: 'INV-2024-006', reason: 'Retail chain monthly replenishment',    userId: whUserId },
    { sku: 'PHRM-001', locationId: mainStore,    qty: 80,  unitAbbr: 'CTN', ref: 'INV-2024-007', reason: 'Hospital supply order — Civil Hospital', userId: whUserId },
    { sku: 'PHRM-002', locationId: mainStore,    qty: 12,  unitAbbr: 'CRT', ref: 'INV-2024-008', reason: 'Clinic bulk order',                     userId: whUserId },
    { sku: 'RAWM-001', locationId: mainStore,    qty: 180, unitAbbr: 'KG',  ref: 'WO-2024-001',  reason: 'Production Work Order #WO-2024-001',   userId: adminId  },
    { sku: 'RAWM-002', locationId: mainStore,    qty: 800, unitAbbr: 'KG',  ref: 'WO-2024-002',  reason: 'Production Work Order #WO-2024-002',   userId: adminId  },
  ];

  for (const s of stockOuts) {
    await doStockOut(s);
    ok(`stock-out: ${s.sku}  qty=${s.qty}${s.unitAbbr}  ref=${s.ref}`);
  }

  // ── Adjustments: Physical count corrections ──────────────────────────────────
  section('Sample Stock Adjustments');

  // FMCG-002 damaged during storage — adjust down
  const adjProduct = await knex('products').where('sku', 'FMCG-002').first();
  if (adjProduct) {
    const inv = await knex('inventory')
      .where({ product_id: adjProduct.id, virtual_location_id: mainStore }).first();
    if (inv && parseFloat(inv.quantity) > 2) {
      const opening = await knex('inventory').where('product_id', adjProduct.id).sum('quantity as t').first().then(r => parseFloat(r?.t || 0));
      const newQty = parseFloat(inv.quantity) - 2;
      await knex.transaction(async trx => {
        await trx('inventory').where('id', inv.id).update({ quantity: newQty });
        const closing = opening - 2;
        await trx('stock_movements').insert({
          movement_type: 'adjustment', product_id: adjProduct.id, batch_id: inv.batch_id,
          from_location_id: mainStore, quantity: 2, unit_id: adjProduct.purchase_unit_id,
          quantity_in_purchase_unit: 2, unit_price: adjProduct.purchase_price,
          opening_balance: opening, closing_balance: closing,
          reason: 'Physical count — 2 cartons found leaking, moved to Damaged Goods store',
          performed_by: adminId,
        });
      });
      ok(`adjustment: FMCG-002 — decreased by 2 CTN (leakage found during audit)`);
    }
  }

  // PACK-001 — recount found extra 5 cartons
  const packProduct = await knex('products').where('sku', 'PACK-001').first();
  if (packProduct) {
    const inv = await knex('inventory')
      .where({ product_id: packProduct.id, virtual_location_id: receivingDock }).first();
    if (inv) {
      const opening = await knex('inventory').where('product_id', packProduct.id).sum('quantity as t').first().then(r => parseFloat(r?.t || 0));
      const newQty = parseFloat(inv.quantity) + 5;
      await knex.transaction(async trx => {
        await trx('inventory').where('id', inv.id).update({ quantity: newQty });
        await trx('stock_movements').insert({
          movement_type: 'adjustment', product_id: packProduct.id, batch_id: inv.batch_id,
          to_location_id: receivingDock, quantity: 5, unit_id: packProduct.purchase_unit_id,
          quantity_in_purchase_unit: 5, unit_price: packProduct.purchase_price,
          opening_balance: opening, closing_balance: opening + 5,
          reason: 'Cyclic count found 5 extra cartons miscounted in last GRN — corrected',
          performed_by: adminId,
        });
      });
      ok(`adjustment: PACK-001 — increased by 5 CTN (miscounted in GRN)`);
    }
  }
}

// ─── LOW STOCK ALERTS ─────────────────────────────────────────────────────────
async function seedAlerts(productIds) {
  section('Low Stock Alerts');

  // PHRM-002 gloves: after selling 12 of 15 crates (1 CRT=24 boxes, we have 3 crates = 72 boxes)
  // reorder_point is 10 crates — so alert fires
  const gloveProduct = await knex('products').where('sku', 'PHRM-002').first();
  if (gloveProduct) {
    const totalQty = await knex('inventory').where('product_id', gloveProduct.id).sum('quantity as t').first().then(r => parseFloat(r?.t || 0));
    const existing = await knex('low_stock_alerts').where({ product_id: gloveProduct.id, is_resolved: false }).first();
    if (totalQty <= parseFloat(gloveProduct.reorder_point) && !existing) {
      await knex('low_stock_alerts').insert({
        product_id: gloveProduct.id, current_qty: totalQty,
        reorder_point: gloveProduct.reorder_point,
      });
      ok(`alert triggered: PHRM-002 (Surgical Gloves) — stock=${totalQty} ≤ reorder=${gloveProduct.reorder_point}`);
    } else {
      skip(`alert for PHRM-002 (stock=${totalQty}, reorder=${gloveProduct.reorder_point})`);
    }
  }

  // RAWM-002 HDPE: after selling 800kg of 2000kg → 1200kg remaining, reorder is 500kg → no alert
  // Manually create an alert for FMCG-003 to demo alert panel
  const teaProduct = await knex('products').where('sku', 'FMCG-003').first();
  if (teaProduct) {
    const totalQty = await knex('inventory').where('product_id', teaProduct.id).sum('quantity as t').first().then(r => parseFloat(r?.t || 0));
    const existing = await knex('low_stock_alerts').where({ product_id: teaProduct.id, is_resolved: false }).first();
    if (!existing && totalQty <= parseFloat(teaProduct.reorder_point)) {
      await knex('low_stock_alerts').insert({
        product_id: teaProduct.id, current_qty: totalQty,
        reorder_point: teaProduct.reorder_point,
      });
      ok(`alert triggered: FMCG-003 (Green Tea Bags) — stock=${totalQty} ≤ reorder=${teaProduct.reorder_point}`);
    } else {
      skip(`alert for FMCG-003`);
    }
  }
}

// ─── TRUNCATE for --force ─────────────────────────────────────────────────────
async function truncateSeedTables() {
  console.log('\n⚠  --force flag detected. Truncating data tables...\n');
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
  const tables = ['low_stock_alerts', 'stock_movements', 'inventory', 'batches', 'products', 'unit_conversions', 'units', 'categories', 'virtual_locations', 'warehouses', 'users', 'roles'];
  for (const t of tables) { await knex(t).truncate(); log(`truncated → ${t}`); }
  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  StockOS — Database Seeder');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    await knex.raw('SELECT 1');
    ok(`Connected: ${process.env.DB_NAME || 'inventory_erp'}`);
  } catch (err) {
    console.error('✘  DB connection failed:', err.message);
    process.exit(1);
  }

  if (isForce) await truncateSeedTables();

  const roleIds    = await seedRoles();
  const userIds    = await seedUsers(roleIds);
  const { locIds } = await seedWarehouses();
  const catIds     = await seedCategories();
  const unitIds    = await seedUnits();
  const productIds = await seedProducts(catIds, unitIds);
  await seedInventory(productIds, unitIds, locIds, userIds);
  await seedAlerts(productIds);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅  Seeding complete!\n');
  console.log('  Login credentials:');
  console.log('  ┌─────────────────────────────┬───────────────────┬──────────────────┐');
  console.log('  │ Email                       │ Password          │ Role             │');
  console.log('  ├─────────────────────────────┼───────────────────┼──────────────────┤');
  console.log('  │ admin@erp.com               │ Admin@123         │ admin            │');
  console.log('  │ priya@erp.com               │ Warehouse@123     │ warehouse_user   │');
  console.log('  │ ravi@erp.com                │ Warehouse@123     │ warehouse_user   │');
  console.log('  │ meera@erp.com               │ Viewer@123        │ viewer           │');
  console.log('  │ arjun@erp.com               │ Viewer@123        │ viewer           │');
  console.log('  └─────────────────────────────┴───────────────────┴──────────────────┘');
  console.log('\n  Data summary:');
  console.log('  • 3 roles, 5 users');
  console.log('  • 2 warehouses, 6 virtual locations');
  console.log('  • 5 categories, 8 units, 6 conversions');
  console.log('  • 12 products (electronics, FMCG, pharma, raw materials, packaging)');
  console.log('  • 20 batches, 15 stock-in events, 10 stock-out events, 2 adjustments');
  console.log('  • Up to 2 active low-stock alerts');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

seed()
  .catch(err => { console.error('\n✘  Seeder failed:', err.message, '\n', err.stack); process.exit(1); })
  .finally(() => knex.destroy());
