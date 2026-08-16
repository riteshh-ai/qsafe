// src/services/ragService.js
import { googleAIModel } from '../config/gemini.js';
import { queryChromaCollection } from './chromaServices.js';
import { getCachedTelemetry } from './usgsService.js';
import {
  MASTER_SYSTEM_PROMPT,
  OFF_TOPIC_FALLBACKS,
  detectLanguageState,
  EMERGENCY_SAFETY_RESPONSES
} from '../prompts.js';

/**
 * Intelligent Rule-Based Fallback Safety Engine
 * Used when Gemini API is unconfigured, off-topic, or offline.
 */
function getFallbackSafetyResponse(query, langState = 'en') {
  const q = query.toLowerCase().trim();

  // Check Off-Topic / Unrelated query check first
  const isEmergencyRelated = /(earthquake|quake|tremor|bhuikampa|bhukamp|भूकम्प|कम्पन्|flood|water|baadhi|badi|बाढी|पानी|landslide|mudslide|pahiro|पहिरो|first aid|bleed|injury|burn|fracture|प्राथमिक|उपचार|रगत|घाइते|prathamik|upachar|kit|bag|supplies|jhola|झोला|सामग्री|fire|aago|आगो|आगलागी|दमकल|contact|number|phone|police|ambulance|nambar|नम्बर|प्रहरी|सम्पर्क|sos|help|madat|sahayata|मद्दत|सहयोग|बचाउ|collapse|debris|trapped|bhatkieko|भवन|भत्क)/i.test(q);

  const isGreeting = /^(hi|hello|namaste|namaskar|hey|नमस्ते|नमस्कार)$/i.test(q) || q.includes('namaste') || q.includes('नमस्ते');

  if (isGreeting) {
    return EMERGENCY_SAFETY_RESPONSES.greetings[langState] || EMERGENCY_SAFETY_RESPONSES.greetings['en'];
  }

  // 1. Landslide / Mudslide
  if (q.includes('landslide') || q.includes('mudslide') || q.includes('pahiro') || q.includes('पहिरो')) {
    return EMERGENCY_SAFETY_RESPONSES.landslide[langState] || EMERGENCY_SAFETY_RESPONSES.landslide['en'];
  }

  // 2. Flood
  if (q.includes('flood') || q.includes('water') || q.includes('baadhi') || q.includes('badi') || q.includes('बाढी') || q.includes('पानी')) {
    return EMERGENCY_SAFETY_RESPONSES.flood[langState] || EMERGENCY_SAFETY_RESPONSES.flood['en'];
  }

  // 3. Earthquake
  if (q.includes('earthquake') || q.includes('quake') || q.includes('tremor') || q.includes('bhuikampa') || q.includes('bhukamp') || q.includes('भूकम्प') || q.includes('कम्पन्')) {
    return EMERGENCY_SAFETY_RESPONSES.earthquake[langState] || EMERGENCY_SAFETY_RESPONSES.earthquake['en'];
  }

  // 4. First Aid
  if (q.includes('first aid') || q.includes('bleed') || q.includes('injury') || q.includes('burn') || q.includes('fracture') || q.includes('प्राथमिक') || q.includes('उपचार') || q.includes('रगत') || q.includes('घाइते') || q.includes('prathamik') || q.includes('upachar')) {
    return EMERGENCY_SAFETY_RESPONSES.first_aid[langState] || EMERGENCY_SAFETY_RESPONSES.first_aid['en'];
  }

  // 5. Emergency Hotlines / Contacts
  if (q.includes('contact') || q.includes('number') || q.includes('phone') || q.includes('police') || q.includes('ambulance') || q.includes('nambar') || q.includes('नम्बर') || q.includes('प्रहरी') || q.includes('सम्पर्क') || q.includes('hotline')) {
    return EMERGENCY_SAFETY_RESPONSES.contacts[langState] || EMERGENCY_SAFETY_RESPONSES.contacts['en'];
  }

  // If off-topic / unrelated to disaster safety, return the exact off-topic guardrail block
  if (!isEmergencyRelated) {
    return OFF_TOPIC_FALLBACKS[langState] || OFF_TOPIC_FALLBACKS['en'];
  }

  // Default disaster advisory in target language
  return EMERGENCY_SAFETY_RESPONSES.earthquake[langState] || EMERGENCY_SAFETY_RESPONSES.earthquake['en'];
}

export const generateRAGResponse = async (userMessage, requestedLanguage = null) => {
  try {
    const cleanMsg = userMessage.trim();

    // Determine target Language State (Primary: UI selected, Fallback: Auto-detect)
    const langState = detectLanguageState(cleanMsg, requestedLanguage);

    // 1. Guard against single-character/gibberish input
    if (cleanMsg.length < 2) {
      if (langState === 'ne_dev') return "कृपया पूरा आपत्कालीन प्रश्न वा विषय टाइप गर्नुहोस्।";
      if (langState === 'ne_rom') return "Kripaya pura emergency prashna va bishaya type garnuhos.";
      return "Please enter a specific safety question or topic.";
    }

    // 2. Guard against casual acknowledgments
    const acknowledgments = ['good', 'ok', 'okay', 'thanks', 'thank you', 'dhanyabad', 'धन्यवाद', 'great', 'fine'];
    if (acknowledgments.includes(cleanMsg.toLowerCase())) {
      if (langState === 'ne_dev') return "तपाईं सुरक्षित रहनुहोस्! के अरू कुनै जानकारी चाहिन्छ?";
      if (langState === 'ne_rom') return "Tapain surakshit rahnuhos! Ke aru kunai jankari chahincha?";
      return "Stay safe! Let me know if you need any other safety guidance.";
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

    // 5. Build System Instruction with Strict Language-Lock Directive
    let languageDirective = "";
    if (langState === 'ne_dev') {
      languageDirective = `CRITICAL LANGUAGE REQUIREMENT: You MUST respond EXCLUSIVELY in DEVANAGARI NEPALI (नेपाली अक्षरहरू). Do not output English or Romanized script.`;
    } else if (langState === 'ne_rom') {
      languageDirective = `CRITICAL LANGUAGE REQUIREMENT: You MUST respond EXCLUSIVELY in ROMANIZED NEPALI (Nepali written in the Latin alphabet, e.g., "Ghunda teka, ot laga, samata. Aglo thaun ma januhos."). Do not output Devanagari script or pure English.`;
    } else {
      languageDirective = `CRITICAL LANGUAGE REQUIREMENT: You MUST respond EXCLUSIVELY in ENGLISH. Do not output Devanagari script.`;
    }

    // Check off-topic check for LLM path
    const isEmergencyRelated = /(earthquake|quake|tremor|bhuikampa|bhukamp|भूकम्प|कम्पन्|flood|water|baadhi|badi|बाढी|पानी|landslide|mudslide|pahiro|पहिरो|first aid|bleed|injury|burn|fracture|प्राथमिक|उपचार|रगत|घाइते|prathamik|upachar|kit|bag|supplies|jhola|झोला|सामग्री|fire|aago|आगो|आगलागी|दमकल|contact|number|phone|police|ambulance|nambar|नम्बर|प्रहरी|सम्पर्क|sos|help|madat|sahayata|मद्दत|सहयोग|बचाउ|collapse|debris|trapped|bhatkieko|भवन|भत्क|hi|hello|namaste|namaskar|hey|नमस्ते|नमस्कार)/i.test(cleanMsg);

    if (!isEmergencyRelated) {
      return OFF_TOPIC_FALLBACKS[langState] || OFF_TOPIC_FALLBACKS['en'];
    }

    // 6. Try generating response with Gemini LLM
    try {
      const systemInstruction = `${MASTER_SYSTEM_PROMPT}

${languageDirective}

Target Language State: ${langState}
Live Telemetry: ${telemetrySummary}

STRICT INSTRUCTION: Keep responses under 45 words, direct bullet points, bold key action words.`;

      const model = googleAIModel({
        systemInstruction: systemInstruction,
      });

      const prompt = `[LIVE TELEMETRY STATUS]
${telemetrySummary}

${contextText ? `[NDRRMA SAFETY CONTEXT]\n${contextText}\n` : ''}
[USER QUESTION]
${userMessage}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      if (text && text.trim()) {
        return text.trim();
      }
    } catch (geminiErr) {
      console.warn("⚠️ Gemini API unavailable/unconfigured. Routing to offline rule engine:", geminiErr.message);
    }

    // 7. Fallback to Language-Locked Safety Response Engine
    return getFallbackSafetyResponse(userMessage, langState);

  } catch (error) {
    console.error("🔴 RAG Pipeline Detailed Error:", error);
    const langState = detectLanguageState(userMessage, requestedLanguage);
    return getFallbackSafetyResponse(userMessage, langState);
  }
};