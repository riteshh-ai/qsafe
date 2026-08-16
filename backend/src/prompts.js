// src/prompts.js
/**
 * Master System Prompt & Language Guardrails Configuration for QSAFE Nepal
 */

export const MASTER_SYSTEM_PROMPT = `You are QSAFE, an AI Emergency & Disaster Safety Advisor built specifically for Nepal disaster response.

### 🚨 EMERGENCY DISASTER SAFETY PROTOCOLS

1. LANDSLIDES & MUDSLIDES (पहिरो / Pahiro):
   - IF INSIDE: Move to the top floor or far side of the building away from the slope. Cover under heavy furniture.
   - IF OUTSIDE: Move immediately to high, stable ground away from steep slopes, gullies, and river channels.
   - IF DRIVING: Watch for falling rocks and road cracks. Never drive through active mudflows.

2. EARTHQUAKES (भूकम्प / Bhukampa):
   - Immediate action: DROP, COVER, HOLD ON (घुँडा टेक, ओत लाग, समात / Ghunda teka, ot laga, samata).
   - Stay away from windows, tall heavy furniture, and unreinforced walls.
   - If outside: Move to an open area away from power lines and falling structures.

3. FLOODS & FLASH FLOODS (बाढी / Badi):
   - Move immediately to higher ground. NEVER walk or drive through moving water.
   - Turn off main electricity switches if safe. Stay away from riverbanks.

4. FIRST AID (प्राथमिक उपचार / Prathamik Upachar):
   - Bleeding: Apply direct pressure with clean cloth.
   - Burns: Cool with clean running water for 10-15 mins.
   - Fractures: Immobilize the limb. Do not force movement.

5. NEPAL EMERGENCY HOTLINES:
   - Nepal Police (नेपाल प्रहरी): 100
   - Armed Police Force (APF): 1114
   - Ambulance (एम्बुलेन्स): 102
   - NDRRMA (विपद् व्यवस्थापन): 16666`;

export const OFF_TOPIC_FALLBACKS = {
  en: `I am QSAFE, a dedicated Emergency & Disaster Safety Advisor. I can only assist with emergency topics such as:
• Earthquake & Flood Safety Protocols
• Landslide & Mudslide Safety
• First Aid Guidance
• Emergency Kit Checklists
• Nepal Emergency Hotlines (Police: 100 | NDRRMA: 16666 | Ambulance: 102)`,

  ne_dev: `म QSAFE, विपद् तथा आपतकालीन सुरक्षा सल्लाहकार हुँ। म केवल आपतकालीन र विपद् सम्बन्धी प्रश्नहरूको मात्र उत्तर दिन सक्छु:
• भूकम्प, बाढी र पहिरो सुरक्षा उपायहरू
• प्राथमिक उपचार मार्गदर्शन
• आपतकालीन हटलाइनहरू (प्रहरी: १०० | एम्बुलेन्स: १०२ | NDRRMA: १६६६६)`,

  ne_rom: `Ma QSAFE, emergency ra disaster safety advisor hu. Ma keval emergency related sodhai ko matra uttar dina sakchu:
• Bhukampa, Badi ra Pahiro bata bachne upaya
• Prathamik Upachar (First Aid) jankari
• Emergency Hotlines (Police: 100 | NDRRMA: 16666 | Ambulance: 102)`
};

/**
 * Language Detection & Normalization Logic
 * Rule 1: Selected Language (UI Precedence: en | ne_dev | ne_rom)
 * Rule 2: Fallback Auto-Detection (Devanagari \u0900-\u097F -> ne_dev, Romanized keywords -> ne_rom, else -> en)
 */
export function detectLanguageState(text, selectedLanguage = null) {
  if (selectedLanguage) {
    const s = String(selectedLanguage).toLowerCase().trim();
    if (s === 'ne_dev' || s === 'ne' || s === 'nepali' || s === 'devanagari' || s === 'np') return 'ne_dev';
    if (s === 'ne_rom' || s === 'romanized' || s === 'romanized_nepali') return 'ne_rom';
    if (s === 'en' || s === 'english') return 'en';
  }

  if (!text || typeof text !== 'string') return 'en';

  // Check for Devanagari script range U+0900 to U+097F
  if (/[\u0900-\u097F]/.test(text)) {
    return 'ne_dev';
  }

  // Check for Romanized Nepali keywords
  const romanizedKeywords = [
    'pahiro', 'bhukampa', 'bhuikampa', 'bhukamp', 'bachna', 'ghar', 'badi', 'baadhi',
    'aago', 'aagolagi', 'madat', 'maddat', 'sahayata', 'prathamik', 'upachar', 'ragat',
    'chot', 'khasne', 'jhola', 'samagri', 'prahari', 'damkal', 'dhalan', 'kotha', 'pani',
    'paani', 'bhatkieko', 'ghunda', 'teka', 'ot', 'laga', 'samata', 'nepal', 'kathmandu'
  ];
  const lowerText = text.toLowerCase();
  const isRomanized = romanizedKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(lowerText));
  if (isRomanized) {
    return 'ne_rom';
  }

  return 'en';
}

/**
 * Categorized Disaster Protocol Responses by Language State
 */
export const EMERGENCY_SAFETY_RESPONSES = {
  landslide: {
    en: `[LANDSLIDE & MUDSLIDE PROTOCOL]
• **INSIDE**: Move to the top floor or far side of the building away from the slope. Cover under heavy furniture.
• **OUTSIDE**: Move immediately to high, stable ground away from steep slopes, gullies, and river channels.
• **DRIVING**: Watch for falling rocks and road cracks. Never drive through active mudflows.
• **HOTLINES**: Police: 100 | NDRRMA: 16666 | APF: 1114.`,

    ne_dev: `[पहिरो सुरक्षा निर्देशिका]
• **भित्र भएमा**: ढलानबाट टाढा माथिल्लो तला वा घरको पछाडिपट्टिको कोठामा जानुहोस्। बलियो फर्निचरमुनि ओत लाग्नुहोस्।
• **बाहिर भएमा**: भीर, पहिरो र नदी किनारबाट तुरुन्तै अग्लो र सुरक्षित ठाउँमा जानुहोस्।
• **गाडी चलाउँदा**: खस्ने ढुङ्गा र बाटोको दरार ध्यान दिनुहोस्। पहिरो बगिरहेको बाटोमा गाडी नचलाउनुहोस्।
• **आपत्कालीन नम्बर**: प्रहरी: १०० | NDRRMA: १६६६६ | सशस्त्र प्रहरी: १११४।`,

    ne_rom: `[PAHIRO SAFETY PROTOCOL]
• **BHITRA BHAEMA**: Dhalan bata tadhako mathillo tala va pachadiko kotha ma januhos. Bhari furniture muni ot lagunuhos.
• **BAHIRA BHAEMA**: Bhir, pahiro ra khola kinara bata turuntai aglo ra thir thaun ma januhos.
• **GAADI CHALAUNDA**: Khasne dhunga ra bato ko crack dhyan dinuhos. Pahiro bagirakeko bato ma gaadi nachalaunuhos.
• **EMERGENCY**: Police: 100 | NDRRMA: 16666 | APF: 1114.`
  },

  earthquake: {
    en: `[EARTHQUAKE SAFETY PROTOCOL]
• **DROP, COVER, HOLD ON**: Drop to hands and knees, cover head/neck under sturdy furniture, hold on until shaking stops.
• **STAY CLEAR**: Stay away from windows, heavy furniture, and unreinforced masonry walls.
• **OUTSIDE**: Move to an open area away from power lines, trees, and buildings.
• **AFTER SHAKING**: Expect aftershocks. Use stairs, never elevators.`,

    ne_dev: `[भूकम्प सुरक्षा निर्देशिका]
• **घुँडा टेक, ओत लाग, समात (DROP, COVER, HOLD ON)**: घुँडा टेकेर बलियो टेबुलमुनि जानुहोस्, टाउको र गर्दन छोप्नुहोस्, कम्पन नरोकिउन्जेल समातेर बस्नुहोस्।
• **सुरक्षित रहनुहोस्**: झ्याल, अग्ला फर्निचर र गाह्रोबाट टाढा रहनुहोस्।
• **बाहिर भएमा**: भवन, बिजुलीको पोल र रुखहरूबाट टाढा खुला ठाउँमा जानुहोस्।
• **कम्पन रोकिएपछि**: पराकम्पनको लागि तयार रहनुहोस्। लिफ्ट प्रयोग नगर्नुहोस्।`,

    ne_rom: `[BHUKAMPA SAFETY PROTOCOL]
• **GHUNDA TEKA, OT LAGA, SAMATA (DROP, COVER, HOLD ON)**: Ghunda teker baliyo table muni januhos, tauko ra gardan chopnuhos, kampan narokiunjel samater basnuhos.
• **TADHA RAHNUHOS**: Jhyal, aglo furniture ra dhungagaaro bata tadha rahnuhos.
• **BAHIRA BHAEMA**: Bhavan, bijuli ko pole ra rukh bata tadha khula thaun ma januhos.
• **AFTER SHAKING**: Parakampan ko lagi tayar rahnuhos. Lift prayog nagarnuhos.`
  },

  flood: {
    en: `[FLOOD & FLASH FLOOD PROTOCOL]
• **HIGH GROUND**: Move immediately to higher ground.
• **NEVER CROSS**: Never walk or drive through moving water (15 cm of moving water can knock you down).
• **UTILITIES**: Turn off main electricity switches if safe to do so. Stay away from riverbanks.
• **HOTLINES**: Police: 100 | NDRRMA: 16666 | APF: 1114.`,

    ne_dev: `[बाढी सुरक्षा निर्देशिका]
• **उच्च स्थान**: तुरुन्तै माथिल्लो तला वा उच्च भागमा जानुहोस्।
• **पानी नतर्नुहोस्**: बग्दै गरेको पानीमा कहिल्यै नहिँड्नुहोस् वा गाडी नचलाउनुहोस् (१५ सेमी बग्ने पानीले ढाल्न सक्छ)।
• **बिजुली**: मुख्य स्विच बन्द गर्नुहोस्। खोला र नदी किनारबाट टाढा रहनुहोस्।
• **आपत्कालीन नम्बर**: प्रहरी: १०० | NDRRMA: १६६६६ | सशस्त्र प्रहरी: १११४।`,

    ne_rom: `[BADI RA FLASH FLOOD PROTOCOL]
• **AGLO THAUN**: Turuntai mathillo tala va aglo thaun ma januhos.
• **PANI NATARNUHOS**: Bagdai gareko pani ma kahilyai nahindnuhos va gaadi nachalaunuhos (15 cm bagne pani le dhalna sakcha).
• **ELECTRICITY**: Main switch band garnuhos. Khola kinara bata tadha rahnuhos.
• **EMERGENCY**: Police: 100 | NDRRMA: 16666 | APF: 1114.`
  },

  first_aid: {
    en: `[FIRST AID PROTOCOL]
• **BLEEDING**: Apply direct, firm pressure with a clean cloth.
• **BURNS**: Cool with clean running water for 10-15 minutes. Do not break blisters.
• **FRACTURES**: Immobilize the limb using a splint. Do not force movement or attempt to realign.
• **AMBULANCE**: Call Red Cross Ambulance: 102 | Police: 100.`,

    ne_dev: `[प्राथमिक उपचार मार्गदर्शन]
• **रक्तस्राव**: सफा कपडाले सिधै बलियो थिच्नुहोस्।
• **पोलेको**: बग्ने चिसो पानीले १०-१५ मिनेटसम्म पखाल्नुहोस्। फोका नफोड्नुहोस्।
• **हाड भत्किएको**: अङ्गलाई नहलाई स्प्लिन्ट प्रयोग गरी अड्याउनुहोस्। जबरजस्ती चलाउने नगर्नुहोस्।
• **एम्बुलेन्स**: रेडक्रस एम्बुलेन्स: १०२ | प्रहरी: १००।`,

    ne_rom: `[PRATHAMIK UPACHAR (FIRST AID) JANKARI]
• **RAGAT BAGDAI**: Safa kapada le sidhai baliyo thicnuhos.
• **POLEKO**: Bagne chiso pani le 10-15 min pakhalnuhos. Foka nafodnuhos.
• **HAAD BHATKIEKO**: Anga lai nahalai splint prayog gari adyaunuhos. Jabardasti nachalaunuhos.
• **AMBULANCE**: Red Cross Ambulance: 102 | Police: 100.`
  },

  contacts: {
    en: `[NEPAL EMERGENCY HOTLINES]
• **Nepal Police (नेपाल प्रहरी)**: 100
• **Armed Police Force (APF)**: 1114
• **Ambulance (एम्बुलेन्स)**: 102
• **NDRRMA (विपद् व्यवस्थापन)**: 16666`,

    ne_dev: `[नेपाल आपत्कालीन हटलाइनहरू]
• **नेपाल प्रहरी**: १००
• **सशस्त्र प्रहरी बल (APF)**: १११४
• **एम्बुलेन्स (रेडक्रस)**: १०२
• **NDRRMA (विपद् व्यवस्थापन)**: १६६६६`,

    ne_rom: `[NEPAL EMERGENCY HOTLINES]
• **Nepal Police**: 100
• **Armed Police Force (APF)**: 1114
• **Ambulance**: 102
• **NDRRMA (Vipad Byabasthapan)**: 16666`
  },

  greetings: {
    en: `Namaste! I am QSAFE, your AI Emergency & Disaster Safety Advisor for Nepal. How can I assist you with earthquake, flood, landslide, or first aid guidance today?`,
    ne_dev: `नमस्ते! म QSAFE, नेपाल विपद् तथा आपत्कालीन सुरक्षा सल्लाहकार हुँ। मलाई भूकम्प, बाढी, पहिरो वा प्राथमिक उपचारबारे सोध्नुहोस्।`,
    ne_rom: `Namaste! Ma QSAFE, Nepal emergency ra disaster safety advisor hu. Bhukampa, Badi, Pahiro va Prathamik Upachar bare sodhnuhos.`
  }
};
