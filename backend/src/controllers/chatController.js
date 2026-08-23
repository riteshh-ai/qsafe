// src/controllers/chatController.js
import { generateRAGResponse } from '../services/ragService.js';

export async function handleChatMessage(req, res) {
  const { message, selected_language, selectedLang, lang } = req.body;
  const requestedLang = selected_language || selectedLang || lang;

  try {
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "A valid non-empty message is required."
      });
    }

    // Set headers to prevent proxy/browser caching and ensure UTF-8 encoding
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    const reply = await generateRAGResponse(message.trim(), requestedLang);

    return res.json({
      success: true,
      response: reply,
      route: "QSAFE RAG Pipeline (Gemini 2.0 Flash)"
    });
  } catch (error) {
    console.error("Chat Controller Error:", error);

    const fallbackResponse = (requestedLang === 'ne' || requestedLang === 'ne_dev')
      ? "सेवा हाल उपलब्ध छैन। आपत्कालीन अवस्थामा नेपाल प्रहरी (१००) वा NDRRMA (११५५) मा सम्पर्क गर्नुहोस्।"
      : "Emergency AI service temporarily unavailable. Contact Police: 100 or NDRRMA: 1155.";

    return res.status(500).json({
      success: false,
      response: fallbackResponse,
      error: "Internal Server Error in Chat Pipeline."
    });
  }
}