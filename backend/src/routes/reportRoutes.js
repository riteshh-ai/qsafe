import express from 'express';
import {
    syncReports,
    getActiveHazards,
    getAdminClusters,
    verifyHazard
} from '../controllers/reportController.js';

const router = express.Router();

// Synchronize offline reports from client queue
router.post('/sync', syncReports);

// Fetch active verified hazards for Leaflet map overlay
router.get('/active', getActiveHazards);

// Admin: Get all hazard clusters
router.get('/admin/clusters', getAdminClusters);

// Admin: Approve or dismiss a hazard cluster
router.post('/admin/verify', verifyHazard);

export default router;