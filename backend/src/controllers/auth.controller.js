import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import knex from '../config/knex.js';

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


export const login = async (req, res) => {
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