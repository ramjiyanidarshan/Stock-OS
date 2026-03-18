const jwt = require('jsonwebtoken');
const knex = require('../config/knex');

const authenticate = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await knex('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.id', decoded.id)
      .where('users.is_active', true)
      .select('users.*', 'roles.name as role_name', 'roles.permissions')
      .first();
    if (!user) return res.status(401).json({ error: 'User not found or inactive' });
    user.permissions = typeof user.permissions === 'string'
      ? JSON.parse(user.permissions || '[]')
      : (user.permissions || []);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authorize = (...requiredPermissions) => {
  return (req, res, next) => {
    const userPerms = req.user.permissions || [];
    const hasAll = requiredPermissions.every(p => userPerms.includes(p) || userPerms.includes('*'));
    if (!hasAll) {
      return res.status(403).json({
        error: 'Access denied',
        required: requiredPermissions,
        your_role: req.user.role_name,
      });
    }
    next();
  };
};

// Permissions reference:
// * = admin all-access
// inventory.read, inventory.write, inventory.adjust
// products.read, products.write, products.delete_category
// warehouse.read, warehouse.write
// team.read, team.write
// reports.read, reports.costs (procurement cost access)
// alerts.read

module.exports = { authenticate, authorize };