// src/controllers/chatController.js
import { generateRAGResponse } from '../services/ragService.js';

export async function handleChatMessage(req, res) {
  try {
    const { message, selected_language, selectedLang, lang } = req.body;
    const requestedLang = selected_language || selectedLang || lang;
    
    if (!message) {
      return res.status(400).json({ error: "Message query is required." });
    }

    const reply = await generateRAGResponse(message, requestedLang);
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json({
      success: true,
      response: reply
    });
  } catch (error) {
    console.error("Chat Controller Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Internal Server Error in Chat Pipeline." 
    });
  }
}