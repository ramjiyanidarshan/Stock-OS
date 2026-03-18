const knex = require('../config/knex');
const bcrypt = require('bcryptjs');

// ---- WAREHOUSES ----
exports.listWarehouses = async (req, res) => {
  const whs = await knex('warehouses').where('is_active', true).orderBy('name');
  res.json(whs);
};

exports.createWarehouse = async (req, res) => {
  try {
    const [id] = await knex('warehouses').insert(req.body);
    const wh = await knex('warehouses').where('id', id).first();
    res.status(201).json(wh);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateWarehouse = async (req, res) => {
  try {
    await knex('warehouses').where('id', req.params.id).update(req.body);
    const wh = await knex('warehouses').where('id', req.params.id).first();
    res.json(wh);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteWarehouse = async (req, res) => {
  try {
    await knex('warehouses').where('id', req.params.id).update({ is_active: false });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ---- VIRTUAL LOCATIONS ----
exports.listLocations = async (req, res) => {
  const { warehouse_id } = req.query;
  let q = knex('virtual_locations as vl')
    .join('warehouses as w', 'vl.warehouse_id', 'w.id')
    .where('vl.is_active', true)
    .select('vl.*', 'w.name as warehouse_name')
    .orderBy('w.name').orderBy('vl.name');
  if (warehouse_id) q = q.where('vl.warehouse_id', warehouse_id);
  res.json(await q);
};

exports.createLocation = async (req, res) => {
  try {
    const [id] = await knex('virtual_locations').insert(req.body);
    const loc = await knex('virtual_locations').where('id', id).first();
    res.status(201).json(loc);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateLocation = async (req, res) => {
  try {
    await knex('virtual_locations').where('id', req.params.id).update(req.body);
    const loc = await knex('virtual_locations').where('id', req.params.id).first();
    res.json(loc);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteLocation = async (req, res) => {
  try {
    await knex('virtual_locations').where('id', req.params.id).update({ is_active: false });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ---- TEAM / USERS ----
exports.listUsers = async (req, res) => {
  const users = await knex('users as u')
    .leftJoin('roles as r', 'u.role_id', 'r.id')
    .select('u.id', 'u.name', 'u.email', 'u.department', 'u.is_active', 'u.created_at', 'r.name as role_name')
    .orderBy('u.name');
  res.json(users);
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role_id, department } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const [id] = await knex('users').insert({ name, email, password_hash: hash, role_id, department });
    const user = await knex('users as u').leftJoin('roles as r', 'u.role_id', 'r.id')
      .where('u.id', id).select('u.id', 'u.name', 'u.email', 'u.department', 'r.name as role_name').first();
    res.status(201).json(user);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateUser = async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    if (password) rest.password_hash = await bcrypt.hash(password, 12);
    await knex('users').where('id', req.params.id).update(rest);
    const user = await knex('users').where('id', req.params.id).first();
    const { password_hash, ...safe } = user;
    res.json(safe);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteUser = async (req, res) => {
  try {
    await knex('users').where('id', req.params.id).update({ is_active: false });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.listRoles = async (req, res) => {
  const roles = await knex('roles').select('id', 'name', 'permissions').orderBy('name');
  res.json(roles.map(r => ({
    ...r,
    permissions: typeof r.permissions === 'string'
      ? JSON.parse(r.permissions || '[]')
      : (r.permissions || []),
  })));
};