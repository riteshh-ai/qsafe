// src/controllers/chatController.js
import { generateRAGResponse } from '../services/ragService.js';

export async function handleChatMessage(req, res) {
  try {
    const { message, lang = 'en' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message query is required." });
    }

    const reply = await generateRAGResponse(message, lang);
    
    return res.json({
      success: true,
      response: reply,
      route: "Live Telemetry + ChromaDB + Gemini 2.0 Flash RAG"
    });
  } catch (error) {
    console.error("Chat Controller Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Internal Server Error in Chat Pipeline." 
    });
  }
}