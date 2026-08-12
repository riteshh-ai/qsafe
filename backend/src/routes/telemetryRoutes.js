// src/routes/telemetryRoutes.js
import express from 'express';
import { getLiveTelemetry } from '../controllers/telemetryController.js';

const router = express.Router();

// GET /api/telemetry/live
router.get('/live', getLiveTelemetry);

export default router;