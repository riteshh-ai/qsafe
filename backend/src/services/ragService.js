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

/**
 * Intent-to-Response Mapping Table.
 *
 * Exported (and hoisted to module scope) so the response-routing regression
 * suite can assert its invariants directly — a mapping table that no test can
 * see is how `preparedness_tips_query` silently pointed at the earthquake card.
 *
 * Intents deliberately absent from this table fall through to the clarification
 * path rather than being forced into the nearest disaster card. See
 * UNMAPPED_BY_DESIGN below.
 */
export const INTENT_RESPONSE_MAP = {
  // Greetings
  'greeting': 'greetings',

  // Critical SOS / Trapped
  // Only an explicit trapped/debris report gets the trapped_sos card. A bare
  // "help"/"emergency" (sos_help_request) is an unqualified distress signal —
  // answering it with "tap on pipes, conserve oxygen, do not shout" invents a
  // buried-alive scenario and gives advice that is wrong for a caller who is
  // not trapped. Route it to hotlines, which is actionable without fabricating.
  'trapped_debris_report': 'trapped_sos',
  'sos_help_request': 'contacts',

  // Fire
  'fire_incident_report': 'fire',
  'gas_leak_report': 'fire',

  // Building Collapse / Structural Damage
  'building_collapse_report': 'building_collapse',
  'building_damage_check': 'building_collapse',

  // Earthquake
  'earthquake_occurring_report': 'earthquake',
  'aftershock_information_query': 'earthquake',

  // Landslide
  'road_blockage_report': 'landslide',

  // Medical / First Aid
  'first_aid_query': 'first_aid',
  'medical_emergency_request': 'first_aid',
  'injury_report': 'first_aid',

  // Shelter, Safe Location & Relief Supplies
  'shelter_request': 'shelter',
  'safe_location_query': 'shelter',
  'evacuation_guidance_query': 'shelter',
  // food_water_request is an active request for relief NOW, not a packing
  // list. The shelter card carries relief-camp and Red Cross registration.
  'food_water_request': 'shelter',

  // Emergency Kit / Preparedness (Go-Bag checklist)
  'preparedness_tips_query': 'emergency_kit',

  // Missing Persons → contacts (closest available)
  'family_member_missing': 'contacts',
  'family_reunification_status': 'contacts',

  // Emergency Contacts
  'emergency_contact_request': 'contacts',
  'power_outage_report': 'contacts',
};

/**
 * Taxonomy intents intentionally left out of INTENT_RESPONSE_MAP.
 *
 * `status_check_general` ("what should I do", "what is the current situation")
 * carries no disaster of its own. Pointing it at any specific protocol card
 * would be exactly the false-certainty failure this table exists to prevent, so
 * it falls through to the clarification fallback instead.
 *
 * `fallback_unclear` and `goodbye_thanks` are handled explicitly below.
 */
export const UNMAPPED_BY_DESIGN = new Set([
  'status_check_general',
  'fallback_unclear',
  'goodbye_thanks',
]);

/**
 * Intelligent Rule-Based Fallback Safety Engine
 * Maps NLP classified intents to structured safety protocol responses.
 * Used when Gemini API is unconfigured, off-topic, or offline.
 */
function getFallbackSafetyResponse(query, langState = 'en', nlpResult = null) {
  // If we have a successful NLP microservice classification (not offline fallback)
  if (nlpResult && nlpResult.source !== 'offline_fallback') {
    const intent = nlpResult.intent;

    // Lookup the mapped response category
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

  // Fallback to legacy regex/keyword matching if NLP service is offline or returned offline_fallback
  const q = query.toLowerCase().trim();

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

  const isEmergencyRelated = /(earthquake|quake|tremor|bhuikampa|bhukamp|भूकम्प|कम्पन्|flood|water|baadhi|badi|बाढी|पानी|landslide|mudslide|pahiro|पहिरो|first aid|bleed|injury|burn|fracture|प्राथमिक|उपचार|रगत|घाइते|prathamik|upachar|kit|bag|supplies|jhola|झोला|सामग्री|fire|aago|आगो|आगलागी|दमकल|contact|number|phone|police|ambulance|nambar|नम्बर|प्रहरी|सम्पर्क|sos|help|madat|sahayata|मद्दत|सहयोग|बचाउ|collapse|debris|trapped|bhatkieko|भवन|भत्क)/i.test(q);
  // If off-topic / unrelated to disaster safety, return a random off-topic guardrail response
  if (!isEmergencyRelated) {
    const fallbacks = OFF_TOPIC_FALLBACKS[langState] || OFF_TOPIC_FALLBACKS['en'];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
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

    // 3. Fetch offline NLU intent prediction
    const nlpResult = await getOfflineIntent(cleanMsg);

    // 4. Fetch live telemetry status
    let telemetrySummary = "No significant tremors (M ≥ 3.0) detected in the Nepal region in the past 24 hours.";
    try {
      const telemetry = getCachedTelemetry();
      if (telemetry && telemetry.summary) {
        telemetrySummary = telemetry.summary;
      }
    } catch (err) {
      console.warn("⚠️ Telemetry warning:", err.message);
    }

    // 5. Fetch context documents from Chroma service
    let contextText = "";
    try {
      const retrieved = await queryChromaCollection(userMessage);
      if (retrieved && !retrieved.includes("No additional static")) {
        contextText = retrieved;
      }
    } catch (err) {
      console.warn("⚠️ ChromaDB query failed:", err.message);
    }

    // 6. Build System Instruction with Strict Language-Lock Directive
    let languageDirective = "";
    if (langState === 'ne_dev') {
      languageDirective = `CRITICAL LANGUAGE REQUIREMENT: You MUST respond EXCLUSIVELY in DEVANAGARI NEPALI (नेपाली अक्षरहरू). Do not output English or Romanized script.`;
    } else if (langState === 'ne_rom') {
      languageDirective = `CRITICAL LANGUAGE REQUIREMENT: You MUST respond EXCLUSIVELY in ROMANIZED NEPALI (Nepali written in the Latin alphabet, e.g., "Ghunda teka, ot laga, samata. Aglo thaun ma januhos."). Do not output Devanagari script or pure English.`;
    } else {
      languageDirective = `CRITICAL LANGUAGE REQUIREMENT: You MUST respond EXCLUSIVELY in ENGLISH. Do not output Devanagari script.`;
    }

    // 6b. Off-topic gate.
    //
    // The intent taxonomy IS the domain definition: 24 of the 25 trained intents
    // are in-domain emergency intents, and `fallback_unclear` is the one the
    // model uses to say "this is not an emergency query". So when the offline NLP
    // microservice actually answered, its verdict is the authoritative one.
    //
    // Previously this branch re-derived topicality from the keyword regex below
    // and ANDed it with the classifier, which silently vetoed correctly
    // classified intents whose vocabulary simply is not in the regex — e.g.
    // power_outage_report ("no electricity since morning", 0.98),
    // safe_location_query ("where is the nearest safe zone", 0.98),
    // shelter_request, evacuation_guidance_query, aftershock_information_query,
    // building_damage_check, and Devanagari preparedness ("आपतकालीन किट", 1.00)
    // all returned the off-topic card. The regex is kept only for the degraded
    // path, where the microservice is unreachable and we have nothing better.
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

    // 7. Try generating response with Gemini LLM
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
        return text.trim().normalize('NFC');
      }
    } catch (geminiErr) {
      console.warn("⚠️ Gemini API unavailable/unconfigured. Routing to offline rule engine:", geminiErr.message);
    }

    // 8. Fallback to Language-Locked Safety Response Engine (with NLP results injected)
    const fallbackResponse = getFallbackSafetyResponse(userMessage, langState, nlpResult);
    return typeof fallbackResponse === 'string' ? fallbackResponse.normalize('NFC') : fallbackResponse;

  } catch (error) {
    console.error("🔴 RAG Pipeline Detailed Error:", error);
    const langState = detectLanguageState(userMessage, requestedLanguage);
    const fallbackResponse = getFallbackSafetyResponse(userMessage, langState);
    return typeof fallbackResponse === 'string' ? fallbackResponse.normalize('NFC') : fallbackResponse;
  }
};