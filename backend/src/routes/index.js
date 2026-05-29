import Router from 'express';
import { authenticate } from '../middleware/auth.js';
import { authRoutes } from './auth.routes.js';
import {userRoutes} from './user.routes.js';
import { preProcessingTheRequest, errorHandler, notFoundHandler } from '../middleware/preprocessing.js';

export const router = Router();

router.use(preProcessingTheRequest);
router.use('/auth', authRoutes);
router.use('/users', authenticate, userRoutes);
router.use(errorHandler);
router.use(notFoundHandler);