/**
 * Route table. Paths and methods mirror api.py one-for-one.
 */
import express from 'express';
import { healthCheck, predictIntent, serviceInfo } from '../controllers/predictController.js';

const router = express.Router();

router.get('/', serviceInfo);
router.get('/health', healthCheck);
router.post('/predict', predictIntent);

export default router;
