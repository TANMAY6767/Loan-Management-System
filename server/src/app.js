import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import { sendResponse } from './utils/sendResponse.js';

const app = express();

app.use(cors({ origin: process.env.WEB_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => sendResponse(res, true, { ok: true }, 'API is running.'));
app.use('/api/auth', authRoutes);




export default app;