import Router from 'express';
import { listUsers, createUser, updateUser, deleteUser } from '../controllers/users.controller.js';
import { authorize } from '../middleware/auth.js';
export const userRoutes = Router();

userRoutes.get('/', listUsers);
userRoutes.post('/', createUser);
userRoutes.delete('/:id', deleteUser);
userRoutes.put('/:id', updateUser);