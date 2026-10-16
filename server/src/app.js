import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import workspaceRoutes from './routes/workspace.routes.js';
import accountRoutes from './routes/account.routes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { sendResponse } from './utils/sendResponse.js';

const app = express();

app.use(cors({ origin: process.env.WEB_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => sendResponse(res, true, { ok: true }, 'API is running.'));
app.use('/api/auth', authRoutes);
app.use('/api', workspaceRoutes);
app.use('/api', accountRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
