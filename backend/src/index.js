import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import {router as routes} from './routes/index.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, try again later' },
}));

app.use('/', routes);

const PORT = process.env.PORT || 5000;
const serverName = process.env.SERVER_NAME || 'StockOs API';
app.listen(PORT, () => console.log(`[*] Web server: ${serverName} running on port ${PORT}`));
