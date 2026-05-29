import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {getUsers} from '../models/user.model.js';

export const login = async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const [user] = await getUsers(req['x-db-connection'], { email });
    console.log("user found for login:", user);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user[0].id, email: user[0].email, role: user[0].role_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    const { id, password_hash, ...safeUser } = user;
    // mysql2 auto-parses JSON columns into objects; guard against both string and array
    safeUser.permissions = typeof safeUser.permissions === 'string'
      ? JSON.parse(safeUser.permissions || '[]')
      : (safeUser.permissions || []);

    return res.json({ token, user: safeUser });
  } catch (err) {
    next(err);
    return res.status(500).json({ error: err.message });
  }
};