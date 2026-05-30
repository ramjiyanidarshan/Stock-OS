import Router from 'express';
import { getTransactionLogs } from '../controllers/log.controller.js';
export const logRoutes = Router();

logRoutes.get('/', getTransactionLogs);