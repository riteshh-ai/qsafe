// src/app.js
import express from 'express';
import cors from 'cors';

// Route Imports
import telemetryRoutes from './routes/telemetryRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import sosRoutes from './routes/sosRoutes.js';

// Services
import { fetchNepalSeismicData } from './services/usgsService.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.resolve(__dirname, '../../frontend')));

// Route Mounts
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sos', sosRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'QSAFE Nepal Backend Active' });
});

// Initial Telemetry Cache Sync & 2-Minute Periodic Background Refresh
fetchNepalSeismicData();
setInterval(fetchNepalSeismicData, 120000);

export default app;