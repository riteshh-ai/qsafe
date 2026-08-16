// src/services/ragService.js
import { googleAIModel } from '../config/gemini.js';
import { queryChromaCollection } from './chromaServices.js';
import { getCachedTelemetry } from './usgsService.js';

/**
 * Intelligent Rule-Based Fallback Safety Engine
 * Used when Gemini API is unconfigured or network connectivity is unavailable.
 */
function getFallbackSafetyResponse(query, lang = 'en') {
  const q = query.toLowerCase().trim();

  // 1. Greetings
  if (/^(hi|hello|namaste|namaskar|hey|नमस्ते|नमस्कार)$/i.test(q) || q.includes('namaste') || q.includes('नमस्ते')) {
    return lang === 'ne' || lang === 'np'
      ? "नमस्ते! म QSAFE नेपाल आपत्कालीन सहायक हुँ। मलाई भूकम्प सुरक्षा, बाढी निर्देशिका, प्राथमिक उपचार वा आपत्कालीन नम्बरहरूबारे सोध्नुहोस्।"
      : "Namaste! I am QSAFE Nepal's emergency safety assistant. How can I help you with earthquake protocols, flood safety, first aid, or emergency hotlines today?";
  }

  // 2. Flood Safety
  if (q.includes('flood') || q.includes('water') || q.includes('baadhi') || q.includes('badi') || q.includes('बाढी') || q.includes('पानी')) {
    return lang === 'ne' || lang === 'np'
      ? "[बाढी सुरक्षा निर्देशिका]\n• **उच्च स्थानमा जानुहोस्**: तुरुन्तै माथिल्लो तला वा उच्च भागमा जानुहोस्।\n• **बग्दै गरेको पानीबाट बच्नुहोस्**: बाढीको पानीमा कहिल्यै नहिँड्नुहोस् (१५ सेमी बग्ने पानीले ढाल्न सक्छ)।\n• **बिजुली र ग्यास**: मुख्य स्विच बन्द गर्नुहोस्।\n• **आपत्कालीन नम्बर**: प्रहरी: १०० | NDRRMA: १६६६६ | सशस्त्र प्रहरी: १११४।"
      : "[FLOOD SAFETY PROTOCOL]\n• **GET TO HIGH GROUND**: Move immediately to upper floors or higher elevation.\n• **AVOID MOVING WATER**: Never walk or drive through floodwaters (15 cm of moving water can knock you down).\n• **UTILITIES**: Turn off main electricity and gas switches if safe to do so.\n• **HOTLINES**: Police: 100 | NDRRMA: 16666 | Armed Police Force: 1114.";
  }

  // 3. Earthquake Safety
  if (q.includes('earthquake') || q.includes('quake') || q.includes('tremor') || q.includes('bhuikampa') || q.includes('bhukamp') || q.includes('भूकम्प') || q.includes('कम्पन्')) {
    return lang === 'ne' || lang === 'np'
      ? "[भूकम्प सुरक्षा निर्देशिका]\n• **झुक्नुहोस् (DROP)**: घुँडा टेकेर बलियो टेबुलमुनि जानुहोस्।\n• **ओत लाग्नुहोस् (COVER)**: टाउको र गर्दन छोप्नुहोस्, झ्याल र भारी सामानबाट टाढा रहनुहोस्।\n• **समात्नुहोस् (HOLD ON)**: कम्पन नरोकिउन्जेल समातेर बस्नुहोस्। पराकम्पनको लागि तयार रहनुहोस्।\n• **बाहिर**: भवन र बिजुलीको पोलबाट टाढा खुला ठाउँमा जानुहोस्।"
      : "[EARTHQUAKE SAFETY PROTOCOL]\n• **DROP**: To your hands and knees under sturdy furniture.\n• **COVER**: Protect head and neck, away from windows and heavy objects.\n• **HOLD ON**: Stay in position until shaking stops. Prepare for aftershocks.\n• **OUTDOORS**: Move to open areas away from buildings, wires, and trees.";
  }

  // 4. First Aid
  if (q.includes('first aid') || q.includes('bleed') || q.includes('injury') || q.includes('burn') || q.includes('fracture') || q.includes('प्राथमिक') || q.includes('उपचार') || q.includes('रगत') || q.includes('घाइते')) {
    return lang === 'ne' || lang === 'np'
      ? "[प्राथमिक उपचार निर्देशिका]\n• **रक्तस्राव**: सफा कपडाले सिधै बलियो थिच्नुहोस्।\n• **हाड भत्किएको**: अङ्गलाई नहलाई अड्याउनुहोस् (स्प्लिन्ट प्रयोग गर्नुहोस्)।\n• **पोलेको**: बग्ने चिसो पानीले १० मिनेटसम्म पखाल्नुहोस्। ब्लिस्टर नफोड्नुहोस्।\n• **एम्बुलेन्स**: रेडक्रस एम्बुलेन्स: १०२ | नेपाल प्रहरी: १००।"
      : "[FIRST AID PROTOCOL]\n• **BLEEDING**: Apply direct, firm pressure with a clean cloth.\n• **FRACTURES**: Immobilize limb using a splint; do not try to realign bone.\n• **BURNS**: Flush immediately under cool running water for 10 minutes.\n• **AMBULANCE**: Red Cross: 102 | Nepal Police: 100.";
  }

  // 5. Emergency Kit / Go-Bag
  if (q.includes('kit') || q.includes('bag') || q.includes('supplies') || q.includes('jhola') || q.includes('झोला') || q.includes('सामग्री')) {
    return lang === 'ne' || lang === 'np'
      ? "[आपत्कालीन झोला (Go-Bag)]\n• **पानी**: प्रतिव्यक्ति दैनिक ३ लिटर (कमसेकम ३ दिनको लागि)।\n• **खाना**: बिग्रिएर नजाने, सिधै खान मिल्ने खानेकुरा।\n• **औजार**: टर्चलाइट, पावर बैंक, सिट्टी, औषधि, बहुउपयोगी चक्कु।\n• **कागजात**: नागरिकता, बिमा र नगद वाटरप्रूफ ब्यागमा।"
      : "[EMERGENCY GO-BAG CHECKLIST]\n• **WATER**: 3 liters/person/day for at least 3 days.\n• **FOOD**: Non-perishable, ready-to-eat items.\n• **SUPPLIES**: Flashlight, power bank, whistle, first-aid kit, multi-tool.\n• **DOCUMENTS**: ID copies, insurance, emergency cash in waterproof bag.";
  }

  // 6. Fire
  if (q.includes('fire') || q.includes('aago') || q.includes('आगो') || q.includes('आगलागी') || q.includes('दमकल')) {
    return lang === 'ne' || lang === 'np'
      ? "[आगलागी सुरक्षा]\n• **निहुरिनुहोस्**: धुवाँबाट बच्न भुइँतिर निहुरिएर बाहिर निस्कनुहोस्।\n• **ढोका**: ढोका खोल्नु अघि हातको पछाडिपट्टिले छोएर ताप जाँच्नुहोस्।\n• **कपडामा आगो लागेमा**: रोकिनुहोस्, भुइँमा सोल्टिनुहोस् (Stop, Drop, Roll)।\n• **दमकल**: १०१ वा १०० मा फोन गर्नुहोस्।"
      : "[FIRE SAFETY PROTOCOL]\n• **STAY LOW**: Crawl under smoke to reach safe exits.\n• **CHECK DOORS**: Touch doors with back of hand before opening.\n• **CLOTHES ON FIRE**: Stop, Drop, and Roll.\n• **FIRE BRIGADE**: Call 101 or Police 100 immediately.";
  }

  // 7. Emergency Hotlines / Contacts
  if (q.includes('contact') || q.includes('number') || q.includes('phone') || q.includes('police') || q.includes('ambulance') || q.includes('nambar') || q.includes('नम्बर') || q.includes('प्रहरी') || q.includes('सम्पर्क')) {
    return lang === 'ne' || lang === 'np'
      ? "[नेपाल आपत्कालीन नम्बरहरू]\n• **नेपाल प्रहरी**: १००\n• **NDRRMA आपत्कालीन केन्द्र**: १६६६६\n• **सशस्त्र प्रहरी बल उद्धार**: १११४\n• **रेडक्रस एम्बुलेन्स**: १०२\n• **दमकल**: १०१"
      : "[EMERGENCY HOTLINES - NEPAL]\n• **Nepal Police**: 100\n• **NDRRMA Emergency Center**: 16666\n• **Armed Police Force Rescue**: 1114\n• **Red Cross Ambulance**: 102\n• **Fire Brigade**: 101";
  }

  // 8. Building Collapse / Trapped
  if (q.includes('collapse') || q.includes('building') || q.includes('debris') || q.includes('trapped') || q.includes('भवन') || q.includes('भत्क')) {
    return lang === 'ne' || lang === 'np'
      ? "[भत्किएको भवन र उद्धार]\n• **सुरक्षित दुरी**: भत्किएका गाह्रो र भवनबाट टाढा रहनुहोस्।\n• **थुनिएको अवस्थामा**: धुलोबाट बच्न मुख कपडाले छोप्नुहोस्। पाइप वा भित्तामा हानेर उद्धारकर्तालाई सङ्केत दिनुहोस्।\n• **उद्धार**: सशस्त्र प्रहरी (१११४) वा प्रहरी (१००) मा फोन गर्नुहोस्।"
      : "[BUILDING COLLAPSE PROTOCOL]\n• **STAY CLEAR**: Move away from damaged structures and falling debris.\n• **TRAPPED**: Cover mouth with cloth. Tap on pipes or walls so rescuers can hear you. Shout only as last resort to save energy.\n• **RESCUE**: Call Armed Police Force (1114) or Police (100).";
  }

  // 9. Generic Fail-safe
  return lang === 'ne' || lang === 'np'
    ? "[QSAFE आपत्कालीन निर्देशिका]\nहामीसँग यी विषयहरूमा सुरक्षा निर्देशिका उपलब्ध छ:\n• भूकम्प सुरक्षा (Earthquake)\n• बाढी सुरक्षा (Flood)\n• प्राथमिक उपचार (First Aid)\n• आपत्कालीन झोला (Go-Bag)\n• आपत्कालीन नम्बरहरू (Police: 100 | NDRRMA: 16666)"
    : "[QSAFE EMERGENCY ADVISORY]\nPlease ask about supported disaster safety topics:\n• Earthquake Protocol (DROP, COVER, HOLD ON)\n• Flood Safety (High Ground, Avoid Moving Water)\n• First Aid Guidance (Bleeding, Burns, Fractures)\n• Emergency Kit Checklist (Go-Bag)\n• Emergency Hotlines (Police: 100 | NDRRMA: 16666 | APF: 1114)";
}

export const generateRAGResponse = async (userMessage, lang = 'en') => {
  try {
    const cleanMsg = userMessage.trim().toLowerCase();

    // 1. Guard against single-character/gibberish input
    if (cleanMsg.length < 2) {
      return lang === 'ne' || lang === 'np'
        ? "कृपया पूरा आपत्कालीन प्रश्न वा विषय टाइप गर्नुहोस्।"
        : "Please enter a specific safety question or topic.";
    }

    // 2. Guard against casual acknowledgments
    const acknowledgments = ['good', 'ok', 'okay', 'thanks', 'thank you', 'dhanyabad', 'धन्यवाद', 'great', 'fine'];
    if (acknowledgments.includes(cleanMsg)) {
      return lang === 'ne' || lang === 'np'
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

    // 5. Try generating response with Gemini LLM
    try {
      const systemInstruction = `You are QSAFE Nepal, an emergency AI assistant designed for high-stress crisis scenarios.
Target Language: ${lang === 'ne' || lang === 'np' ? 'Nepali' : 'English'}.

CORE DIRECTIVES:
1. DATA SOURCES & TRUTHFULNESS:
   - Primary Source: Rely on [NDRRMA SAFETY CONTEXT] when available.
   - Fallback: If context is missing, use standard, verified global emergency/first-aid protocols.
   - Zero Hallucination: Do not invent unverified facts. Never refuse to provide critical life-safety guidance.

2. QUERY RELEVANCE & BREVITY:
   - STRICT WORD LIMIT: Keep responses strictly under 45 words total.
   - HYPER-FOCUSED: Answer only the exact scenario requested.

3. FORMAT & VISIBILITY:
   - NO INTRO FLUFF: Jump directly into actionable bullet points.
   - Use bold text for key actions.

RESPONSE SCHEMAS:
- GREETINGS: Max 20 words. State status (${telemetrySummary}) and ask how to help.
- EMERGENCY/SAFETY (Earthquake, First Aid, Fire, Kit): Max 3-4 direct bullet points.
- HOTLINES: Police: 100 | NDRRMA: 16666.`;

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

    // 6. Intelligent Safety Engine Fallback (Used when Gemini API key is missing or API fails)
    return getFallbackSafetyResponse(userMessage, lang);

  } catch (error) {
    console.error("🔴 RAG Pipeline Detailed Error:", error);
    return getFallbackSafetyResponse(userMessage, lang);
  }
};