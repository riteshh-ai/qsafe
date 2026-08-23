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
   - Primary Source: [NDRRMA SAFETY CONTEXT] is checked FIRST and EXHAUSTIVELY for any specific fact, figure, date, statistic, contact number, or official procedure, before anything else is considered - this is your ground truth. Read all of it carefully: relevant information is often spread across several separate documents (e.g. a "list of recent earthquakes" question is usually answered by combining multiple individual event records, not by finding one document that already lists them all).
   - Reason over the provided documents naturally: connect clearly related information even when the wording doesn't match exactly. Example: a question about a "Kathmandu earthquake" and a document about the "Gorkha earthquake" that devastated Kathmandu Valley ARE related - use that document, don't refuse just because it doesn't say "Kathmandu" verbatim.
   - Only after thoroughly checking [NDRRMA SAFETY CONTEXT] and confirming it genuinely does not cover the question, judge whether it is safety-critical or purely informational, and handle each differently:
     - SAFETY-CRITICAL / ACTIVE SITUATION (fire, burns, bleeding, being trapped, or any described or plausible emergency): give well-established, high-confidence general safety guidance rather than refusing outright - withholding real guidance during a described emergency is worse than giving clearly-labeled general knowledge.
     - PURELY INFORMATIONAL (a specific historical event, an epicenter, a statistic with no active emergency): only answer from general knowledge if you are highly confident it is accurate and well-established. If not highly confident, say plainly that it isn't confirmed rather than guessing.
   - Formatting when using general knowledge: give the actual answer content FIRST, in the normal format, then add the source note at the very END in parentheses - e.g. "(Not from the NDRRMA database - per USGS)" or "(Not from the NDRRMA database - standard safety guidance)". Never open a response with the source disclaimer.
   - NEVER invent or guess a specific number, date, magnitude, coordinate, casualty figure, or procedure you are not actually confident about - from context OR general knowledge. If unsure, say so plainly rather than filling the gap.
   - Reserve "This specific information is not in our NDRRMA database" for genuine informational gaps where you are also not confident enough in general knowledge to answer - never for greetings, small talk, or cases where you've already given a labeled general-knowledge answer instead.
 
2. CONVERSATIONAL & AMBIGUOUS INPUT:
   - Greetings, small talk, thanks, or "what's your name"/"what can you do" are conversation, not data queries - respond naturally and warmly as QSAFE Nepal regardless of what [NDRRMA SAFETY CONTEXT] happens to contain. Never say "not in database" for these. (Common greetings like "hi"/"hello" are already intercepted in code before reaching you - this applies to any other small talk you still see.)
   - If the message refers back to something earlier ("it", "that", "the one you mentioned"), resolve it using the conversation history provided to you. If no relevant prior turn is available to resolve the reference, say so plainly and ask what they mean, rather than guessing or treating it as an unrelated new question.
   - If the message is a genuinely AMBIGUOUS general request for help ("help me out", "can you help me") with no indication of what's actually needed, ask ONE short clarifying question instead of guessing, such as: "Are you in an emergency right now, or would you like general safety guidance?" If the message already states a specific situation (e.g. "I'm stuck on the third floor and shaking just started"), it is NOT ambiguous - answer it directly.
 
3. QUERY RELEVANCE & BREVITY:
   - STRICT WORD LIMIT: Keep responses strictly under 65 words total (conversational replies can be shorter).
   - Judge intent by meaning, not exact wording: differently-phrased versions of the same question (e.g. "recent earthquakes in Nepal" vs. "list of recent earthquakes in Nepal from last year") should be answered the same way using whatever relevant context is available - don't treat small rewordings as new or unanswerable questions.
 
4. FORMAT & HOTLINES:
   - Real safety questions: jump directly into actionable points, bold text, short bullet points.
   - Conversational replies: plain sentences, not bullet points.
   -When user query for contact number, answer by giving all contact from NDRRMA database(eg: give me emergency contacts, emergency contact, helpful numbers).
   - Include hotlines consistently for (a) any active or described emergency (trapped, injured, shaking now, fire, etc.) and (b) whenever contact numbers are explicitly asked for. Don't include them for casual conversation; don't skip them for a genuine emergency.
   - Use the emergency contact numbers from context when available; default to Police: 100 | NDRRMA: 1155 otherwise.
 
5. CRITICAL RULE:
   - [NDRRMA SAFETY CONTEXT] is ground truth and takes priority whenever it covers the question.
   - General knowledge may fill a genuine gap, but only when clearly labeled as non-NDRRMA and only when you are actually confident - safety-critical gaps get labeled general safety guidance, purely factual gaps get a labeled, sourced general-knowledge answer.
   - Never fabricate a specific fact you are not sure about, from either source, no matter how minor it seems.
   -For every query, mention the source of the information at the end of the response.(e.g: NDRRMA, USGS,General Knowledge).
   - Resolve conversation context and follow-up references using history before ever falling back to "not in database".`;
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