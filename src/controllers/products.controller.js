const knex = require('../config/knex');

exports.list = async (req, res) => {
  try {
    const { search, category_id, page = 1, limit = 20 } = req.query;
    let q = knex('products as p')
      .leftJoin('categories as c', 'p.category_id', 'c.id')
      .leftJoin('units as pu', 'p.purchase_unit_id', 'pu.id')
      .leftJoin('units as su', 'p.sale_unit_id', 'su.id')
      .where('p.is_active', true)
      .select('p.*', 'c.name as category_name', 'pu.name as purchase_unit_name', 'pu.abbreviation as purchase_unit_abbr', 'su.name as sale_unit_name', 'su.abbreviation as sale_unit_abbr')
      .orderBy('p.name');

    if (search) q = q.where(function() { this.where('p.name', 'like', `%${search}%`).orWhere('p.sku', 'like', `%${search}%`); });
    if (category_id) q = q.where('p.category_id', category_id);

    const [{ total }] = await q.clone().clearSelect().count('p.id as total');
    const data = await q.limit(+limit).offset((+page - 1) * +limit);
    res.json({ data, total, page: +page, limit: +limit, pages: Math.ceil(total / +limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.get = async (req, res) => {
  try {
    const p = await knex('products as p')
      .leftJoin('categories as c', 'p.category_id', 'c.id')
      .leftJoin('units as pu', 'p.purchase_unit_id', 'pu.id')
      .leftJoin('units as su', 'p.sale_unit_id', 'su.id')
      .where('p.id', req.params.id)
      .select('p.*', 'c.name as category_name', 'pu.name as purchase_unit_name', 'su.name as sale_unit_name')
      .first();
    if (!p) return res.status(404).json({ error: 'Not found' });
    const batches = await knex('batches').where('product_id', p.id).orderBy('created_at', 'asc');
    res.json({ ...p, batches });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const [id] = await knex('products').insert(req.body);
    const product = await knex('products').where('id', id).first();
    res.status(201).json(product);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.update = async (req, res) => {
  try {
    await knex('products').where('id', req.params.id).update(req.body);
    const product = await knex('products').where('id', req.params.id).first();
    res.json(product);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    await knex('products').where('id', req.params.id).update({ is_active: false });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Categories
exports.listCategories = async (req, res) => {
  const cats = await knex('categories').where('is_active', true).orderBy('name');
  res.json(cats);
};

exports.createCategory = async (req, res) => {
  try {
    const [id] = await knex('categories').insert(req.body);
    const cat = await knex('categories').where('id', id).first();
    res.status(201).json(cat);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteCategory = async (req, res) => {
  try {
    await knex('categories').where('id', req.params.id).update({ is_active: false });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Units
exports.listUnits = async (req, res) => {
  const units = await knex('units').orderBy('name');
  res.json(units);
};

exports.createUnit = async (req, res) => {
  try {
    const [id] = await knex('units').insert(req.body);
    const unit = await knex('units').where('id', id).first();
    res.status(201).json(unit);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.listConversions = async (req, res) => {
  const convs = await knex('unit_conversions as uc')
    .join('units as fu', 'uc.from_unit_id', 'fu.id')
    .join('units as tu', 'uc.to_unit_id', 'tu.id')
    .select('uc.*', 'fu.name as from_unit_name', 'tu.name as to_unit_name');
  res.json(convs);
};

exports.createConversion = async (req, res) => {
  try {
    const [id] = await knex('unit_conversions').insert(req.body);
    res.status(201).json({ id, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
