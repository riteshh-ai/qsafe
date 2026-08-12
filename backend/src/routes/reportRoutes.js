// src/routes/reportRoutes.js
import express from 'express';

const router = express.Router();

// POST /api/reports - Submit a hazard or damage report
router.post('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Community report endpoint active.',
  });
});

// GET /api/reports - Fetch submitted reports
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    reports: [],
  });
});

export default router;