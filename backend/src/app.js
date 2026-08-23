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
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});
app.use(express.static(path.resolve(__dirname, '../../frontend'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Route Mounts
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/hazards', reportRoutes);
app.use('/api/sos', sosRoutes);

// Root route to serve Frontend UI
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../../frontend/index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'QSAFE Nepal Backend Active' });
});

// Initial Telemetry Cache Sync & 2-Minute Periodic Background Refresh
fetchNepalSeismicData();
setInterval(fetchNepalSeismicData, 120000);

export default app;