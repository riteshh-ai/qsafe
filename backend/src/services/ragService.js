// src/services/ragService.js
import { googleAIModel } from '../config/gemini.js';
import { queryChromaCollection } from './chromaServices.js';
import { getCachedTelemetry } from './usgsService.js';
import { getOfflineIntent } from './nlpClient.js';
import {
  MASTER_SYSTEM_PROMPT,
  OFF_TOPIC_FALLBACKS,
  detectLanguageState,
  EMERGENCY_SAFETY_RESPONSES
} from '../prompts.js';

// Keywords that require live USGS telemetry data
const SEISMIC_KEYWORDS = [
  'earthquake', 'tremor', 'quake', 'shake', 'seismic',
  'bhuikamp', 'भुइँचालो', 'भूकम्प', 'live status', 'recent tremor', 'status'
];

/**
 * Intent-to-Response Mapping Table.
 */
export const INTENT_RESPONSE_MAP = {
  'greeting': 'greetings',
  'trapped_debris_report': 'trapped_sos',
  'sos_help_request': 'contacts',
  'fire_incident_report': 'fire',
  'gas_leak_report': 'fire',
  'building_collapse_report': 'building_collapse',
  'building_damage_check': 'building_collapse',
  'earthquake_occurring_report': 'earthquake',
  'aftershock_information_query': 'earthquake',
  'road_blockage_report': 'landslide',
  'first_aid_query': 'first_aid',
  'medical_emergency_request': 'first_aid',
  'injury_report': 'first_aid',
  'shelter_request': 'shelter',
  'safe_location_query': 'shelter',
  'evacuation_guidance_query': 'shelter',
  'food_water_request': 'shelter',
  'preparedness_tips_query': 'emergency_kit',
  'family_member_missing': 'contacts',
  'family_reunification_status': 'contacts',
  'emergency_contact_request': 'contacts',
  'power_outage_report': 'contacts',
};

export const UNMAPPED_BY_DESIGN = new Set([
  'status_check_general',
  'fallback_unclear',
  'goodbye_thanks',
]);

/**
 * Intelligent Rule-Based Fallback Safety Engine
 */
function getFallbackSafetyResponse(query, langState = 'en', nlpResult = null) {
  if (nlpResult && nlpResult.source !== 'offline_fallback') {
    const intent = nlpResult.intent;
    const responseCategory = INTENT_RESPONSE_MAP[intent];
    if (responseCategory) {
      const responses = EMERGENCY_SAFETY_RESPONSES[responseCategory];
      if (responses) {
        return responses[langState] || responses['en'];
      }
    }

    if (intent === 'fallback_unclear' || intent === 'goodbye_thanks') {
      const fallbacks = OFF_TOPIC_FALLBACKS[langState] || OFF_TOPIC_FALLBACKS['en'];
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
  }

  const q = query.toLowerCase().trim();
  const isGreeting = /^(hi|hello|namaste|namaskar|hey|नमस्ते|नमस्कार)$/i.test(q) || q.includes('namaste') || q.includes('नमस्ते');

  if (isGreeting) {
    return EMERGENCY_SAFETY_RESPONSES.greetings[langState] || EMERGENCY_SAFETY_RESPONSES.greetings['en'];
  }

  if (q.includes('landslide') || q.includes('mudslide') || q.includes('pahiro') || q.includes('पहिरो')) {
    return EMERGENCY_SAFETY_RESPONSES.landslide[langState] || EMERGENCY_SAFETY_RESPONSES.landslide['en'];
  }

  if (q.includes('flood') || q.includes('water') || q.includes('baadhi') || q.includes('badi') || q.includes('बाढी') || q.includes('पानी')) {
    return EMERGENCY_SAFETY_RESPONSES.flood[langState] || EMERGENCY_SAFETY_RESPONSES.flood['en'];
  }

  if (q.includes('earthquake') || q.includes('quake') || q.includes('tremor') || q.includes('bhuikampa') || q.includes('bhukamp') || q.includes('भूकम्प') || q.includes('कम्पन्')) {
    return EMERGENCY_SAFETY_RESPONSES.earthquake[langState] || EMERGENCY_SAFETY_RESPONSES.earthquake['en'];
  }

  if (q.includes('first aid') || q.includes('bleed') || q.includes('injury') || q.includes('burn') || q.includes('fracture') || q.includes('प्राथमिक') || q.includes('उपचार') || q.includes('रगत') || q.includes('घाइते') || q.includes('prathamik') || q.includes('upachar')) {
    return EMERGENCY_SAFETY_RESPONSES.first_aid[langState] || EMERGENCY_SAFETY_RESPONSES.first_aid['en'];
  }

  if (q.includes('contact') || q.includes('number') || q.includes('phone') || q.includes('police') || q.includes('ambulance') || q.includes('nambar') || q.includes('नम्बर') || q.includes('प्रहरी') || q.includes('सम्पर्क') || q.includes('hotline')) {
    return EMERGENCY_SAFETY_RESPONSES.contacts[langState] || EMERGENCY_SAFETY_RESPONSES.contacts['en'];
  }

  const isEmergencyRelated = /(earthquake|quake|tremor|bhuikampa|bhukamp|भूकम्प|कम्पन्|flood|water|baadhi|badi|बाढी|पानी|landslide|mudslide|pahiro|पहिरो|first aid|bleed|injury|burn|fracture|प्राथमिक|उपचार|रगत|घाइते|prathamik|upachar|kit|bag|supplies|jhola|झोला|सामग्री|fire|aago|आगो|आगलागी|दमकल|contact|number|phone|police|ambulance|nambar|नम्बर|प्रहरी|सम्पर्क|sos|help|madat|sahayata|मद्दत|सहयोग|बचाउ|collapse|debris|trapped|bhatkieko|भवन|भत्क)/i.test(q);
  if (!isEmergencyRelated) {
    const fallbacks = OFF_TOPIC_FALLBACKS[langState] || OFF_TOPIC_FALLBACKS['en'];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  return EMERGENCY_SAFETY_RESPONSES.earthquake[langState] || EMERGENCY_SAFETY_RESPONSES.earthquake['en'];
}

export const generateRAGResponse = async (userMessage, requestedLanguage = null) => {
  try {
    const cleanMsg = userMessage.trim();
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

    // 3. Parallel Data Retrieval
    const isSeismicQuery = SEISMIC_KEYWORDS.some(keyword => cleanMsg.toLowerCase().includes(keyword));
    const promises = [
      queryChromaCollection(cleanMsg).catch(err => {
        console.warn("Chroma query failed:", err.message);
        return "";
      }),
      getOfflineIntent(cleanMsg).catch(() => ({ intent: 'status_check_general', confidence: 0.0, source: 'offline_fallback' }))
    ];

    if (isSeismicQuery) {
      promises.push(Promise.resolve().then(() => getCachedTelemetry()).catch(() => null));
    }

    const results = await Promise.allSettled(promises);

    let contextText = "";
    if (results[0].status === 'fulfilled' && results[0].value && !results[0].value.includes("No additional static")) {
      contextText = results[0].value;
    }

    const nlpResult = results[1].status === 'fulfilled' ? results[1].value : { intent: 'status_check_general', confidence: 0.0, source: 'offline_fallback' };

    let telemetrySummary = "";
    if (isSeismicQuery && results[2] && results[2].status === 'fulfilled' && results[2].value?.summary) {
      telemetrySummary = results[2].value.summary;
    }

    // 4. Off-topic gate
    let isEmergencyRelated = false;
    if (nlpResult.source === 'offline_fallback') {
      isEmergencyRelated = /(earthquake|quake|tremor|bhuikampa|bhukamp|भूकम्प|कम्पन्|flood|water|baadhi|badi|बाढी|पानी|landslide|mudslide|pahiro|पहिरो|first aid|bleed|injury|burn|fracture|प्राथमिक|उपचार|रगत|घाइते|prathamik|upachar|kit|bag|supplies|jhola|झोला|सामग्री|fire|aago|आगो|आगलागी|दमकल|contact|number|phone|police|ambulance|nambar|नम्बर|प्रहरी|सम्पर्क|sos|help|madat|sahayata|मद्दत|सहयोग|बचाउ|collapse|debris|trapped|bhatkieko|भवन|भत्क|hi|hello|namaste|namaskar|hey|नमस्ते|नमस्कार)/i.test(cleanMsg);
    } else {
      isEmergencyRelated = nlpResult.intent !== 'fallback_unclear';
    }

    if (!isEmergencyRelated) {
      const fallbacks = OFF_TOPIC_FALLBACKS[langState] || OFF_TOPIC_FALLBACKS['en'];
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    // 5. Build Language Directive
    let languageDirective = "";
    if (langState === 'ne_dev') {
      languageDirective = `CRITICAL LANGUAGE REQUIREMENT: You MUST respond EXCLUSIVELY in DEVANAGARI NEPALI (नेपाली अक्षरहरू). Do not output English or Romanized script.`;
    } else if (langState === 'ne_rom') {
      languageDirective = `CRITICAL LANGUAGE REQUIREMENT: You MUST respond EXCLUSIVELY in ROMANIZED NEPALI (Nepali written in Latin alphabet, e.g., "Ghunda teka, ot laga, samata."). Do not output Devanagari script or pure English.`;
    } else {
      languageDirective = `CRITICAL LANGUAGE REQUIREMENT: You MUST respond EXCLUSIVELY in ENGLISH. Do not output Devanagari script.`;
    }

    // 6. Try generating response with Gemini LLM
    try {
      const systemInstruction = `You are QSAFE Nepal, an emergency AI assistant designed for high-stress crisis scenarios and disaster guidance.
${languageDirective}

CORE DIRECTIVES:
1. DATA SOURCES & TRUTHFULNESS:
   - Primary Source: [NDRRMA SAFETY CONTEXT] is checked FIRST and EXHAUSTIVELY for facts, figures, statistics, contact numbers, or official procedures.
   - For active emergencies (fire, trapped, bleeding, collapse), give clear, high-confidence actionable guidance immediately.
   - For general knowledge fallback, clearly state the guidance directly and mention the source at the end.
   - Never invent or guess specific figures or fake hotline numbers.

2. CONVERSATIONAL & AMBIGUOUS INPUT:
   - Greetings and thanks should be met with warm, concise disaster safety readiness.
   - If ambiguous, ask ONE short clarifying question.

3. QUERY RELEVANCE & BREVITY:
   - STRICT WORD LIMIT: Keep responses under 55 words total.
   - Real safety questions: jump directly into actionable points, bold text, short bullet points.
   - Hotlines: Police: 100 | NDRRMA: 1155 | Ambulance: 102 | Fire: 101.
${MASTER_SYSTEM_PROMPT ? '\n' + MASTER_SYSTEM_PROMPT : ''}`;

      const model = googleAIModel({
        systemInstruction: systemInstruction,
      });

      const promptParts = [];
      if (telemetrySummary) {
        promptParts.push(`[LIVE TELEMETRY STATUS]\n${telemetrySummary}`);
      }
      if (contextText) {
        promptParts.push(`[NDRRMA SAFETY CONTEXT]\n${contextText}`);
      }
      promptParts.push(`[USER QUESTION]\n${cleanMsg}`);

      const prompt = promptParts.join('\n\n');
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      if (text && text.trim()) {
        return text.trim().normalize('NFC');
      }
    } catch (geminiErr) {
      console.warn("⚠️ Gemini API unavailable/unconfigured. Routing to offline rule engine:", geminiErr.message);
    }

    // 7. Fallback to Language-Locked Safety Response Engine
    const fallbackResponse = getFallbackSafetyResponse(userMessage, langState, nlpResult);
    return typeof fallbackResponse === 'string' ? fallbackResponse.normalize('NFC') : fallbackResponse;

  } catch (error) {
    console.error("🔴 RAG Pipeline Detailed Error:", error);
    const langState = detectLanguageState(userMessage, requestedLanguage);
    const fallbackResponse = getFallbackSafetyResponse(userMessage, langState);
    return typeof fallbackResponse === 'string' ? fallbackResponse.normalize('NFC') : fallbackResponse;
  }
};