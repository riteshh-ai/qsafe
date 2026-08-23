// src/controllers/chatController.js
import { generateRAGResponse } from '../services/ragService.js';

export async function handleChatMessage(req, res) {
  // NOTE: lang is now an OPTIONAL manual override.
  // - If the frontend sends lang: 'en' or lang: 'ne', the user explicitly
  //   picked that language from the toggle -> force that language.
  // - If lang is missing/null, the user never touched the toggle -> let
  //   ragService auto-detect the language/script from the message itself.
  let lang = (req.body.lang === 'en' || req.body.lang === 'ne') ? req.body.lang : undefined;

  try {
    const { message } = req.body;

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

    // Fallback error message: if a manual language was set, honor it;
    // otherwise default to English since we have no message to detect from.
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