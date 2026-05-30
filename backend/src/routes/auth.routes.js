import Router from 'express';
import { login, me } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
export const authRoutes = Router();

authRoutes.post('/login', login);
authRoutes.get('/me', authenticate, me);