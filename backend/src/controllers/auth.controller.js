const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const knex = require('../config/knex');

const ROLES = [
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
    permissions: JSON.stringify(['inventory.read', 'products.read', 'warehouse.read', 'reports.read']),
  },
];

exports.seed = async (req, res) => {
  try {
    // Seed roles
    for (const role of ROLES) {
      await knex('roles').insert(role).onConflict('name').merge();
    }

    // Seed default admin
    const existing = await knex('users').where('email', 'admin@erp.com').first();
    if (!existing) {
      const adminRole = await knex('roles').where('name', 'admin').first();
      const hash = await bcrypt.hash('Admin@123', 12);
      await knex('users').insert({
        name: 'System Admin',
        email: 'admin@erp.com',
        password_hash: hash,
        role_id: adminRole.id,
        department: 'Administration',
      });

      // Seed warehouse user
      const whRole = await knex('roles').where('name', 'warehouse_user').first();
      const wHash = await bcrypt.hash('Warehouse@123', 12);
      await knex('users').insert({
        name: 'Warehouse Manager',
        email: 'warehouse@erp.com',
        password_hash: wHash,
        role_id: whRole.id,
        department: 'Warehouse',
      });
    }

    // Seed sample data
    await knex('warehouses').insert({ name: 'Main Warehouse', address: '123 Industrial Area', manager_name: 'John Doe' }).onConflict().ignore();
    const wh = await knex('warehouses').first();
    await knex('virtual_locations').insert([
      { warehouse_id: wh.id, name: 'Main Store', type: 'storage' },
      { warehouse_id: wh.id, name: 'Damaged Goods', type: 'damaged' },
      { warehouse_id: wh.id, name: 'On-Transit', type: 'transit' },
    ]).onConflict().ignore();

    await knex('units').insert([
      { name: 'Crate', abbreviation: 'CRT' },
      { name: 'Piece', abbreviation: 'PCS' },
      { name: 'Kilogram', abbreviation: 'KG' },
      { name: 'Litre', abbreviation: 'LTR' },
    ]).onConflict().ignore();

    await knex('categories').insert([
      { name: 'Electronics', description: 'Electronic components' },
      { name: 'Raw Materials', description: 'Unprocessed inputs' },
      { name: 'Finished Goods', description: 'Ready for sale' },
    ]).onConflict().ignore();

    return res.json({ message: 'Seeded successfully. Admin: admin@erp.com / Admin@123, Warehouse: warehouse@erp.com / Warehouse@123' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const user = await knex('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.email', email)
      .where('users.is_active', true)
      .select('users.*', 'roles.name as role_name', 'roles.permissions')
      .first();

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    const { password_hash, ...safeUser } = user;
    // mysql2 auto-parses JSON columns into objects; guard against both string and array
    safeUser.permissions = typeof safeUser.permissions === 'string'
      ? JSON.parse(safeUser.permissions || '[]')
      : (safeUser.permissions || []);

    return res.json({ token, user: safeUser });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.me = async (req, res) => {
  const { password_hash, ...safe } = req.user;
  res.json(safe);
};