const knex = require('../config/knex');
const invService = require('../services/inventory.service');

exports.stockIn = async (req, res) => {
  try {
    const result = await invService.stockIn({ ...req.body, userId: req.user.id });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.stockOut = async (req, res) => {
  try {
    const result = await invService.stockOut({ ...req.body, userId: req.user.id });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.stockAdjust = async (req, res) => {
  try {
    const result = await invService.stockAdjust({ ...req.body, userId: req.user.id });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.stockTransfer = async (req, res) => {
  try {
    const result = await invService.stockTransfer({ ...req.body, userId: req.user.id });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getMovements = async (req, res) => {
  try {
    const { product_id, movement_type, from_date, to_date, page = 1, limit = 50, sku, batch_number, location_id } = req.query;
    let q = knex('stock_movements as sm')
      .join('products as p', 'sm.product_id', 'p.id')
      .leftJoin('batches as b', 'sm.batch_id', 'b.id')
      .leftJoin('virtual_locations as fl', 'sm.from_location_id', 'fl.id')
      .leftJoin('virtual_locations as tl', 'sm.to_location_id', 'tl.id')
      .leftJoin('users as u', 'sm.performed_by', 'u.id')
      .leftJoin('units as un', 'sm.unit_id', 'un.id')
      .select(
        'sm.*',
        'p.name as product_name', 'p.sku',
        'b.batch_number', 'b.expiry_date',
        'fl.name as from_location_name',
        'tl.name as to_location_name',
        'u.name as performed_by_name',
        'un.abbreviation as unit_abbreviation'
      )
      .orderBy('sm.performed_at', 'desc');

    if (product_id) q = q.where('sm.product_id', product_id);
    if (movement_type) q = q.where('sm.movement_type', movement_type);
    if (from_date) q = q.where('sm.performed_at', '>=', from_date);
    if (to_date) q = q.where('sm.performed_at', '<=', to_date);
    if (sku) q = q.where('p.sku', 'like', `%${sku}%`);
    if (batch_number) q = q.where('b.batch_number', 'like', `%${batch_number}%`);
    if (location_id) q = q.where(function() {
      this.where('sm.from_location_id', location_id).orWhere('sm.to_location_id', location_id);
    });

    const offset = (page - 1) * limit;
    const [{ total }] = await q.clone().clearSelect().count('sm.id as total');
    const data = await q.limit(limit).offset(offset);

    res.json({ data, total, page: +page, limit: +limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getInventoryOverview = async (req, res) => {
  try {
    const { sku, location_id, category_id, low_stock_only } = req.query;

    let q = knex('inventory as inv')
      .join('products as p', 'inv.product_id', 'p.id')
      .join('virtual_locations as vl', 'inv.virtual_location_id', 'vl.id')
      .join('warehouses as w', 'vl.warehouse_id', 'w.id')
      .leftJoin('batches as b', 'inv.batch_id', 'b.id')
      .leftJoin('categories as c', 'p.category_id', 'c.id')
      .leftJoin('units as pu', 'p.purchase_unit_id', 'pu.id')
      .where('p.is_active', true)
      .where('inv.quantity', '>', 0)
      .select(
        'p.id as product_id', 'p.name as product_name', 'p.sku',
        'p.reorder_point', 'p.purchase_price',
        'c.name as category_name',
        'vl.id as location_id', 'vl.name as location_name', 'vl.type as location_type',
        'w.name as warehouse_name',
        'b.id as batch_id', 'b.batch_number', 'b.expiry_date', 'b.purchase_price as batch_price',
        'inv.quantity',
        'pu.abbreviation as purchase_unit'
      );

    if (sku) q = q.where('p.sku', 'like', `%${sku}%`);
    if (location_id) q = q.where('vl.id', location_id);
    if (category_id) q = q.where('p.category_id', category_id);

    let rows = await q;

    // Compute valuation per row
    rows = rows.map(r => ({
      ...r,
      valuation: parseFloat(r.quantity) * parseFloat(r.batch_price || r.purchase_price),
    }));

    if (low_stock_only === 'true') {
      // Group by product and filter those below reorder point
      const productTotals = {};
      rows.forEach(r => {
        productTotals[r.product_id] = (productTotals[r.product_id] || 0) + parseFloat(r.quantity);
      });
      rows = rows.filter(r => productTotals[r.product_id] <= parseFloat(r.reorder_point));
    }

    // Dashboard summary
    const totalValuation = rows.reduce((s, r) => s + r.valuation, 0);

    res.json({ data: rows, totalValuation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const [products] = await knex('products').where('is_active', true).count('id as c');
    const [alerts] = await knex('low_stock_alerts').where('is_resolved', false).count('id as c');
    const [todayIn] = await knex('stock_movements')
      .where('movement_type', 'stock_in')
      .where('performed_at', '>=', knex.raw('CURDATE()'))
      .sum('quantity_in_purchase_unit as total');
    const [todayOut] = await knex('stock_movements')
      .where('movement_type', 'stock_out')
      .where('performed_at', '>=', knex.raw('CURDATE()'))
      .sum('quantity_in_purchase_unit as total');

    // Inventory valuation
    const invRows = await knex('inventory as inv')
      .join('products as p', 'inv.product_id', 'p.id')
      .leftJoin('batches as b', 'inv.batch_id', 'b.id')
      .select(knex.raw('SUM(inv.quantity * COALESCE(b.purchase_price, p.purchase_price)) as valuation'))
      .first();

    // Movement trend (last 7 days)
    const trend = await knex('stock_movements')
      .select(
        knex.raw('DATE(performed_at) as date'),
        knex.raw("SUM(CASE WHEN movement_type='stock_in' THEN quantity_in_purchase_unit ELSE 0 END) as stock_in"),
        knex.raw("SUM(CASE WHEN movement_type='stock_out' THEN quantity_in_purchase_unit ELSE 0 END) as stock_out")
      )
      .where('performed_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL 7 DAY)'))
      .groupBy(knex.raw('DATE(performed_at)'))
      .orderBy('date', 'asc');

    res.json({
      totalProducts: parseInt(products.c),
      lowStockAlerts: parseInt(alerts.c),
      todayStockIn: parseFloat(todayIn.total || 0),
      todayStockOut: parseFloat(todayOut.total || 0),
      totalValuation: parseFloat(invRows.valuation || 0),
      movementTrend: trend,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAlerts = async (req, res) => {
  try {
    const alerts = await knex('low_stock_alerts as a')
      .join('products as p', 'a.product_id', 'p.id')
      .leftJoin('categories as c', 'p.category_id', 'c.id')
      .where('a.is_resolved', false)
      .select('a.*', 'p.name as product_name', 'p.sku', 'c.name as category_name')
      .orderBy('a.triggered_at', 'desc');
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
