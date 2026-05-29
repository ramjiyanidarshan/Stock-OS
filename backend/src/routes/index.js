import Router from 'express';
import {login} from '../controllers/auth.controller.js';
import {listUsers, createUser, updateUser, deleteUser} from '../controllers/users.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const router = Router();

// Public
router.post('/auth/login', login);

// Team
router.get('/team/users', authenticate, authorize('team.read'), listUsers);
// router.post('/team/users', authenticate, authorize('team.write'), createUser);
// router.put('/team/users/:id', authenticate, authorize('team.write'), updateUser);
// router.delete('/team/users/:id', authenticate, authorize('team.write'), deleteUser);
