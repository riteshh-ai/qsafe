 nlp
const express = require('express');
const fs = require('fs');
const path = require('path');
const { containerBootstrap } = require('@nlpjs/core');
const { Nlp } = require('@nlpjs/nlp');
const { Language } = require('@nlpjs/language-min');

const app = express();
const port = process.env.PORT || 3000;

function detectLocale(text) {
  return /[\u0900-\u097F]/.test(text) ? 'ne' : 'en';
}
function detectEmergencyKeywords(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase();
  const nepaliFlood = ['बाढी', 'बाढी आएको', 'बाढीले'];
  const romanizedFlood = ['badi', 'badi aayo', 'baadi', 'baadi aayo', 'pani', 'paani', 'paani aayo', 'pani ayo', 'badi aayo', 'house maa badi', 'house maa pani', 'house ma pani', 'ma pani', 'paani chha', 'paani chha'];
  const nepaliSos = ['सहायता', 'मलाई मदद', 'मलाई मद्दत', 'मलाई सहयोग', 'मद्दत चाहिन्छ', 'सहयोग चाहिन्छ', 'मलाई खबर', 'मेरो घर बाढी', 'मलाई बचाउनु', 'मलाई मद्दत'];
  const romanizedSos = ['malaai madat', 'malaai madat chahinchha', 'malaai sahayata', 'mero madat', 'mero help', 'help mero', 'bachau', 'bachnu', 'sos', 'help me', 'help ma', 'help mero'];
  const nepaliCollapse = ['भवन', 'भत्क'];
  
  const romanizedFire = ['aago', 'aago lagyo', 'aago laagyo', 'fire'];
  const nepaliShelter = ['शरण'];
  const romanizedShelter = ['sharan', 'shelter', 'safe house'];

  if (
    t.includes('flood') ||
    t.includes('flooded') ||
    t.includes('flooding') ||
    t.includes('water') ||
    t.includes('waters') ||
    t.includes('floods') ||
    nepaliFlood.some((phrase) => t.includes(phrase)) ||
    romanizedFlood.some((phrase) => t.includes(phrase))
  ) return 'flood_alert';

  if (
    t.includes('collapse') ||
    t.includes('collapsed') ||
    t.includes('building collapse') ||
    nepaliCollapse.some((phrase) => t.includes(phrase)) ||
    romanizedCollapse.some((phrase) => t.includes(phrase))
  ) return 'building_collapse_report';

  if (
    t.includes('help') ||
    t.includes('bachau') ||
    t.includes('bachnu') ||
    t.includes('sos') ||
    t.includes('madat') ||
    nepaliSos.some((phrase) => t.includes(phrase)) ||
    romanizedSos.some((phrase) => t.includes(phrase))
  ) return 'sos_help_request';

  if (
    t.includes('fire') ||
    nepaliFire.some((phrase) => t.includes(phrase)) ||
    romanizedFire.some((phrase) => t.includes(phrase))
  ) return 'fire_alert';

  if (
    t.includes('shelter') ||
    t.includes('shelters') ||
    nepaliShelter.some((phrase) => t.includes(phrase)) ||
    romanizedShelter.some((phrase) => t.includes(phrase))
  ) return 'shelter_request';

  return null;
}

function detectSmallTalkKeywords(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase();
  // tolerate repeated letters like 'thank youu' and compact spacing
  if (/\b(thank\s*u+|thank\s*you+|thanks?|ty)\b/.test(t) || /\b(धन्यवाद|धन्यबाद)\b/.test(t)) return 'thank_you';
  return null;
}

function extractWaterDepth(text) {
  if (!text || typeof text !== 'string') return null;
  const m = text.match(/(\d+\.?\d*)\s*(feet|ft|ft\.|meters|meter|m)\b/i);
  if (m) return `${m[1]} ${m[2]}`;
  return null;
}

function hasLocation(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();
  // English heuristics: numbers, 'at', 'near', 'here', 'location', 'house', 'road', 'street', 'lane', 'km'
  if (/\b(at|near|here|located|location|address|ward|tole|house|road|street|lane|km|river|bridge|school|market)\b/.test(t)) return true;
  if (/\d{1,3}\s*(feet|ft|m|meters|km|kilometer|kilometre)?\b/.test(t)) return true;
  if (/\d{1,3}[,-]\d{1,3}/.test(t)) return true;
  // Nepali heuristics
  if (/\b(यहाँ|यहाँबाट|ठाउँ|घर|घरको|गाउँ|महल्ला|टोल|सडक|राप्ती|गोल्चा|चोक|स्कूल|बजार|पुल|रामेछाप|काठमाडौ|काठमाडौं|लैन्चौर|रास्ता|वडा)\b/.test(t)) return true;
  if (/\d+\s*(मिटर|मीटर|फिट|फुट|किलोमिटर|किमि)/.test(t)) return true;
  // Romanized/Latin-script Nepali location tokens and simple landmark patterns
  const romanizedLocationTokens = ['kathmandu', 'dillibazar', 'lalitpur', 'pokhara', 'bhaktapur', 'biratnagar', 'birgunj', 'butwal', 'nepalgunj', 'janakpur', 'chowk', 'tole', 'tol', 'bazar', 'market', 'school', 'bridge', 'river'];
  if (romanizedLocationTokens.some((tok) => t.includes(tok))) return true;

  // Patterns like "place city" or "place, city" (e.g., "dillibazar kathmandu" or "dillibazar, kathmandu")
  const cityList = ['kathmandu','lalitpur','pokhara','bhaktapur','biratnagar','birgunj','butwal','nepalgunj','janakpur'];
  const placeCityRegex = new RegExp("\\b([a-z0-9\-]{3,}\\s*(?:,)?\\s*)\\b(" + cityList.join('|') + ")\\b", 'i');
  if (placeCityRegex.test(t)) return true;

  // If the message is short and contains a comma-separated phrase, assume a location reply (e.g., "dillibazar, kathmandu")
  if (t.includes(',') && t.split(/\s*,\s*/).length <= 3 && t.split(/\s+/).length <= 5) return true;

  return false;
}

function hasInjuriesMention(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();
  if (/\b(injur|bleed|hurt|unconscious|trapped|broken|fracture|bleeding|pain|burn|cut|hospital|ambulance|मुटु|रक्त|खोप|चोट|घाइते|बोहोर्न|बाँया|दायाँ|पानी पस्नु)\b/.test(t)) return true;
  if (/\b(घाइते|चोट|रगत|रक्तश्राव|बाँया|दायाँ|हानि|बोहोर्न)\b/.test(t)) return true;
  return false;
}

function makeFloodResponse(text) {
  const depth = extractWaterDepth(text);
  if (depth) {
    return `Your home appears to have approximately ${depth} of water. Move to the highest safe area (roof or upper floor), avoid walking through floodwater, and call emergency services immediately if you are trapped. Do not touch electrical equipment.`;
  }
  return 'Get to higher ground, avoid contact with floodwater, move to upper floors if safe, and call emergency services if you are trapped.';
}

function mapIntentToResponse(intent, text) {
  const responses = {
    greeting: 'Namaste! How can I help with your emergency situation today?',
    thank_you: 'You’re welcome — stay safe. If you need help, tell me your situation.',
    building_collapse_report: 'Move away from the damaged building immediately, avoid debris, and call local rescue services for help.',
    goodbye_thanks: 'You’re welcome — stay safe. If you need help, tell me your situation.',
    sos_help_request: 'Help is on the way. Stay calm, share your location, and keep yourself safe until responders arrive.',
    preparedness_tips_query: 'After an earthquake, stay outside away from buildings, avoid damaged structures, and wait for official instructions.',
    flood_alert: makeFloodResponse(text),
    fire_alert: 'Leave the building immediately, stay low to avoid smoke, and call the fire department from a safe location.',
    medical_aid_request: 'If someone is injured, keep them calm, control any bleeding, and call medical services immediately.',
    shelter_request: 'Find the nearest emergency shelter and follow local authority instructions. Stay with community members where possible.',
    unknown: 'I’m not sure what you mean. Please ask about earthquake, flood, fire, shelter, or medical help.',
  };

  if (responses[intent]) return responses[intent];

  // If the classifier returned an unmapped intent, attempt emergency keyword detection
  const heuristic = detectEmergencyKeywords(text);
  if (heuristic && responses[heuristic]) return responses[heuristic];

  return responses.unknown;
}

async function loadModel() {
  const modelPath = path.resolve(__dirname, '..', 'offline-nlp', 'model.nlp.json');
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Offline model not found at ${modelPath}`);
  }

  const modelJson = fs.readFileSync(modelPath, 'utf8');
  const modelData = JSON.parse(modelJson);

  const container = await containerBootstrap();
  container.use(Nlp);
  container.use(Language);

  const nlp = container.get('nlp');
  nlp.settings.autoSave = false;
  nlp.settings.autoLoad = false;
  nlp.addLanguage(['en', 'ne']);
  nlp.fromJSON(modelData);

  return nlp;
}

app.use(express.json());
app.use(express.static(path.resolve(__dirname, '..', 'frontend')));

app.post('/api/classify', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Request body must include a text string.' });
    }

    if (!app.locals.nlp) {
      return res.status(503).json({ error: 'NLP model is not loaded yet.' });
    }

    const locale = detectLocale(text);
    const result = await app.locals.nlp.process(locale, text);
    const normalizedScore = typeof result.score === 'number' ? result.score : 0;

    // Small-talk override: if user says thanks, prefer the small-talk intent
    let finalIntent = result.intent;
    const smallTalkIntent = detectSmallTalkKeywords(text);
    if (smallTalkIntent) {
      finalIntent = smallTalkIntent;
    }

    // Heuristic emergency override: if text contains clear emergency keywords, prefer that intent.
    // This covers mixed Nepali/English phrases like "mero house maa badi aayo".
    const heuristicIntent = detectEmergencyKeywords(text);
    if (heuristicIntent && finalIntent !== heuristicIntent) {
      finalIntent = heuristicIntent;
    }

    // Build the response (mapIntentToResponse can use the original text for tailoring)
    const mappedResponse = mapIntentToResponse(finalIntent, text);

    // Follow-up flow for sos_help_request: ask for missing location or injury info
    let finalResponse = mappedResponse;
    let needsFollowUp = false;
    let followUpQuestion = null;
    let followUpSlot = null;

    // If the user reply looks like a location (romanized or Nepali) and the classifier
    // could not map the message, treat this as a provided location and confirm receipt.
    if (hasLocation(text) && (finalIntent === 'unknown' || normalizedScore < 0.55)) {
      finalIntent = 'sos_help_request';
      finalResponse = 'Location received. Responders will be notified — please stay safe and await help.';
      needsFollowUp = false;
    }

    if (finalIntent === 'sos_help_request') {
      if (!hasLocation(text)) {
        needsFollowUp = true;
        followUpSlot = 'location';
        followUpQuestion = 'Please provide your location or a nearby landmark so responders can find you.';
        finalResponse = followUpQuestion;
      } else if (!hasInjuriesMention(text)) {
        needsFollowUp = true;
        followUpSlot = 'injuries';
        followUpQuestion = 'Are there injured people? Reply yes/no and include brief details if available.';
        finalResponse = followUpQuestion;
      }
    }

    // If still low confidence and no heuristic matched, return a safe fallback message
    if (!heuristicIntent && normalizedScore < 0.55 && !needsFollowUp) {
      finalResponse = 'I’m not confident enough to answer that safely. Please ask about earthquake, flood, fire, shelter, or medical emergency guidance.';
    }

    return res.json({
      intent: finalIntent,
      response: finalResponse,
      score: normalizedScore,
      locale,
      utterance: result.utterance,
      lowConfidence: !heuristicIntent && normalizedScore < 0.55,
      heuristicOverride: Boolean(heuristicIntent),
      smallTalk: Boolean(smallTalkIntent),
      needsFollowUp,
      followUpSlot,
      followUpQuestion,
    });
  } catch (error) {
    console.error('Classification error:', error);
    return res.status(500).json({ error: 'Classification failed.' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

loadModel()
  .then((nlp) => {
    app.locals.nlp = nlp;
    app.listen(port, () => {
      console.log(`🚀 QSAFE backend running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to load offline NLP model:', error);
    process.exit(1);
  });

// server.js
import dotenv from 'dotenv';
import app from './src/app.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 QSAFE Nepal Backend listening on port ${PORT}`);
  console.log(`📡 USGS Telemetry Endpoint: http://localhost:${PORT}/api/telemetry/live`);
});
 main
