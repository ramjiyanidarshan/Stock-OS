import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { getUsers } from '../models/user.model.js';
import { morphText, comparePassword } from '../helpers/text.helper.js';
import { validateRequestPayload } from '../helpers/validation.helper.js';

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

export const login = async (req, res, next) => {
  try {
    const payload = await validateRequestPayload(loginSchema, req.body);
    const { email, password } = payload;
    const [user] = await getUsers(req['x-db-connection'], { email }, ['FETCH_PASSWORD_HASH']);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await comparePassword(password, user[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      {
        id: user[0].id,
        name: morphText(user[0].name, 1),
        email: morphText(user[0].email, 1),
        role: user[0].role_name
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    const { password_hash, ...safeUser } = user[0];
    // mysql2 auto-parses JSON columns into objects; guard against both string and array
    safeUser.permissions = typeof user[0].permissions === 'string'
      ? JSON.parse(user[0].permissions || '[]')
      : (user[0].permissions || []);

    res.status(200).json({ token, user: safeUser });
  } catch (err) {
    next(err);
    res.status(403).json({ error: err.message });
  } finally {
    return res.end();
  }
};

export const me = async (req, res, next) => {
  try {
    let user = req['x-user'];
    const [userDetails] = await getUsers(req['x-db-connection'], { id: user.id });
    user = { ...user, name: userDetails[0].name, email: userDetails[0].email };
    if (!user) return res.status(304).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err) {
    next(err);
    return res.status(500).json({ error: err.message });
  } finally {
    return res.end();
  }
};