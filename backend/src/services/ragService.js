// src/services/ragService.js
import { googleAIModel } from '../config/gemini.js';
import { queryChromaCollection } from './chromaServices.js';
import { getCachedTelemetry } from './usgsService.js';

// Keywords that require live USGS telemetry data
const SEISMIC_KEYWORDS = [
  'earthquake', 'tremor', 'quake', 'shake', 'seismic', 
  'bhuikamp', 'भुइँचालो', 'भूकम्प', 'live status', 'recent tremor', 'status'
];

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

    // 3. Check if user is asking about seismic activity
    const isSeismicQuery = SEISMIC_KEYWORDS.some(keyword => cleanMsg.includes(keyword));

    // 4. Parallel Data Retrieval
    const promises = [queryChromaCollection(userMessage)];
    if (isSeismicQuery) {
      promises.push(Promise.resolve().then(() => getCachedTelemetry()));
    }

    const results = await Promise.allSettled(promises);

    // Parse ChromaDB Context
    let contextText = "";
    if (results[0].status === 'fulfilled' && results[0].value && !results[0].value.includes("No additional static")) {
      contextText = results[0].value;
    }

    // Parse Telemetry (only if it was requested)
    let telemetrySummary = "";
    if (isSeismicQuery && results[1] && results[1].status === 'fulfilled' && results[1].value?.summary) {
      telemetrySummary = results[1].value.summary;
    }

    // 5. Flexible System Instruction
    const systemInstruction = `You are QSAFE Nepal, an emergency AI assistant designed for high-stress crisis scenarios and disaster guidance.
Target Language: ${lang === 'ne' ? 'Nepali' : 'English'}.

CORE DIRECTIVES:
1. DATA SOURCES & TRUTHFULNESS:
   - Primary Source: Rely on [NDRRMA SAFETY CONTEXT] when available.
   - Fallback: If local context is missing, use verified historical/emergency facts (e.g., 2072 BS / 2015 earthquake, general NDRRMA policies).
   - Missing Documents: If specific document records are explicitly requested and missing, state politely that the document is not indexed yet.

2. QUERY RELEVANCE & BREVITY:
   - STRICT WORD LIMIT: Keep responses strictly under 65 words total.
   - HYPER-FOCUSED: Answer ONLY the exact scenario requested.

3. FORMAT & HOTLINES:
   - NOT MUCH INTRO FLUFF: Jump directly into actionable points.("Answer According to Nepali Environment,like when talking about water talk in litre instead of gallon")
   - Use bold text for key actions and short bullet points.
   - HOTLINES: Provide relevant numbers from the emergency contact directory inside context. If specific contacts are missing, default to: Police: 100 | NDRRMA: 1155.(dont provide them until asked about contact or emergency situations.)`;

    const model = googleAIModel({
      systemInstruction: systemInstruction,
    });

    // 6. Build Prompt
    const promptParts = [];
    if (telemetrySummary) {
      promptParts.push(`[LIVE TELEMETRY STATUS]\n${telemetrySummary}`);
    }
    if (contextText) {
      promptParts.push(`[NDRRMA SAFETY CONTEXT]\n${contextText}`);
    } else {
      promptParts.push(`[NDRRMA SAFETY CONTEXT]\nNo local vector documents retrieved for this query.`);
    }
    promptParts.push(`[USER QUESTION]\n${userMessage}`);

    const prompt = promptParts.join('\n\n');

    // 7. Generate Response
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