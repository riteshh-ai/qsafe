// src/routes/chatRoutes.js
import express from 'express';
import { handleChatMessage } from '../controllers/chatController.js';

const router = express.Router();

// POST /api/chat
router.post('/', handleChatMessage);

// Ensure default export is present
export default router;