// src/controllers/chatController.js
import { generateRAGResponse } from '../services/ragService.js';

export async function handleChatMessage(req, res) {
  try {
    const { message, lang = 'en' } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "A valid non-empty message is required."
      });
    }

    // Set headers to prevent proxy/browser caching for real-time safety queries
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    const reply = await generateRAGResponse(message.trim(), lang);

    return res.json({
      success: true,
      response: reply,
      route: "QSAFE RAG Pipeline (Gemini 2.0 Flash)"
    });
  } catch (error) {
    console.error("Chat Controller Error:", error);

    const fallbackResponse = lang === 'ne'
      ? "सेवा हाल उपलब्ध छैन। आपत्कालीन अवस्थामा नेपाल प्रहरी (१००) वा NDRRMA (११५५) मा सम्पर्क गर्नुहोस्।"
      : "Emergency AI service temporarily unavailable. Contact Police: 100 or NDRRMA: 1155.";

    return res.status(500).json({
      success: false,
      response: fallbackResponse,
      error: "Internal Server Error in Chat Pipeline."
    });
  }
}