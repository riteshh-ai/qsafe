// src/routes/sosRoutes.js
import express from 'express';

const router = express.Router();

// POST /api/sos - Trigger emergency SOS signal
router.post('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SOS distress signal received.',
  });
});

export default router;