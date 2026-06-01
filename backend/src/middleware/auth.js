import jwt from 'jsonwebtoken';

export const authenticate = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req['x-user'] = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorize = (...requiredPermissions) => {
  return (req, res, next) => {
    const userPerms = req['x-user'].permissions || [];
    const hasAll = requiredPermissions.every(p => userPerms.includes(p) || userPerms.includes('*'));
    if (!hasAll) {
      return res.status(403).json({
        error: 'Access denied',
        required: requiredPermissions,
        your_role: req['x-user'].role_name,
      });
    }
    next();
  };
};