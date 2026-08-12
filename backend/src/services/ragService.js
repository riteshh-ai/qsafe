// src/services/ragService.js
import { googleAIModel } from '../config/gemini.js';
import { queryChromaCollection } from './chromaServices.js';
import { getCachedTelemetry } from './usgsService.js';

export const generateRAGResponse = async (userMessage, lang = 'en') => {
  try {
    const cleanMsg = userMessage.trim().toLowerCase();

    // 1. Guard against single-character/gibberish input
    if (cleanMsg.length < 2) {
      return lang === 'ne'
        ? "कृपया पूरा आपत्कालीन प्रश्न वा विषय टाइप गर्नुहोस्।"
        : "Please enter a specific safety question or topic.";
    }

    // 2. Guard against casual acknowledgments
    const acknowledgments = ['good', 'ok', 'okay', 'thanks', 'thank you', 'dhanyabad', 'धन्यवाद', 'great', 'fine'];
    if (acknowledgments.includes(cleanMsg)) {
      return lang === 'ne'
        ? "तपाईं सुरक्षित रहनुहोस्! के अरू कुनै जानकारी चाहिन्छ?"
        : "Stay safe! Let me know if you need any other safety guidance.";
    }

    // 3. Fetch live telemetry status
    let telemetrySummary = "No significant tremors (M ≥ 3.0) detected in the Nepal region in the past 24 hours.";
    try {
      const telemetry = getCachedTelemetry();
      if (telemetry && telemetry.summary) {
        telemetrySummary = telemetry.summary;
      }
    } catch (err) {
      console.warn("⚠️ Telemetry warning:", err.message);
    }

    // 4. Fetch context documents from Chroma service
    let contextText = "";
    try {
      const retrieved = await queryChromaCollection(userMessage);
      if (retrieved && !retrieved.includes("No additional static")) {
        contextText = retrieved;
      }
    } catch (err) {
      console.warn("⚠️ ChromaDB query failed:", err.message);
    }

    // 5. System Instruction
    const systemInstruction = `You are QSAFE Nepal, an emergency AI assistant designed for high-stress crisis scenarios.
Target Language: ${lang === 'ne' ? 'Nepali' : 'English'}.

CORE DIRECTIVES:
1. DATA SOURCES & TRUTHFULNESS:
   - Primary Source: Rely on [NDRRMA SAFETY CONTEXT] when available.
   - Fallback: If context is missing, use standard, verified global emergency/first-aid protocols.
   - Zero Hallucination: Do not invent unverified facts. Never refuse to provide critical life-safety guidance.

2. QUERY RELEVANCE & BREVITY:
   - STRICT WORD LIMIT: Keep responses strictly under 45 words total.
   - HYPER-FOCUSED: Answer only the exact scenario requested (e.g., if asked about "driving", give only vehicle safety steps—do not include general indoor steps).

3. FORMAT & VISIBILITY:
   - NO INTRO FLUFF: Omit setups like "Here are the steps...", "Sure!", or "Based on...". Jump directly into actionable points.
   - Use bold text for key actions and short bullet points for instant scanning.

RESPONSE SCHEMAS:
- GREETINGS: Max 20 words. State status (${telemetrySummary}) and ask how to help.
- EMERGENCY/SAFETY (Earthquake, First Aid, Fire, Kit):
  Output max 3-4 direct bullet points.
  Example:
  • **DROP**: To hands and knees.
  • **COVER**: Head and neck under sturdy desk.
  • **HOLD ON**: Until shaking stops.
- HOTLINES (if relevant): Police: 100 | NDRRMA: 1155.`;

    const model = googleAIModel({
      systemInstruction: systemInstruction,
    });

    const prompt = `[LIVE TELEMETRY STATUS]
${telemetrySummary}

${contextText ? `[NDRRMA SAFETY CONTEXT]\n${contextText}\n` : ''}
[USER QUESTION]
${userMessage}`;

    // 6. Generate AI response
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (!text || !text.trim()) {
      return lang === 'ne'
        ? "माफ गर्नुहोस्, प्रतिक्रिया सिर्जना गर्न सकिएन।"
        : "No response generated. Call Police: 100 or NDRRMA: 1155.";
    }

    return text.trim();

  } catch (error) {
    console.error("🔴 RAG Pipeline Detailed Error:", error);
    return lang === 'ne'
      ? "अनलाइन सेवा उपलब्ध हुन सकेन। नेपाल प्रहरी (१००) मा फोन गर्नुहोस्।"
      : "Emergency AI service unavailable. Contact Nepal Police (100).";
  }
};