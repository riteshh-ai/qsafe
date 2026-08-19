// =========================================================================
// LAYER 0: SERVICE WORKER REGISTRATION
// =========================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('🚀 Service Worker active:', reg.scope))
            .catch(err => console.error('❌ Service Worker registration failed:', err));
    });
}

// =========================================================================
// LAYER 1: DOM ELEMENT SELECTORS & GLOBAL STATE
// =========================================================================
const chatLog = document.getElementById('chat-log');
const queryIn = document.getElementById('query-in');
const dispatchBtn = document.getElementById('dispatch-btn');
const telemetryBadge = document.getElementById('telemetry-badge');
const telemetryTxt = document.getElementById('telemetry-txt');
const langSelect = document.getElementById('lang-select');
const seismicBanner = document.getElementById('seismic-banner');
const seismicTxt = document.getElementById('seismic-txt');

let isSystemOnline = true;
const BACKEND_URL = 'http://localhost:5000';

// =========================================================================
// LAYER 2: ASYNCHRONOUS NETWORK MONITOR & REAL-TIME LISTENERS
// =========================================================================
function updateOnlineStatus(online) {
    isSystemOnline = online;
    if (telemetryBadge && telemetryTxt) {
        if (online) {
            telemetryBadge.className = "badge online";
            telemetryTxt.innerText = "Online";
        } else {
            telemetryBadge.className = "badge offline";
            telemetryTxt.innerText = "Offline";
        }
    }
}

async function evaluateNetworkConnectivity() {
    if (!navigator.onLine) {
        updateOnlineStatus(false);
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        // Ping local backend health check endpoint
        const res = await fetch(`${BACKEND_URL}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);

        updateOnlineStatus(res.ok);
    } catch (err) {
        updateOnlineStatus(false);
    }
}

// Real-time Network Listeners
window.addEventListener('online', () => evaluateNetworkConnectivity());
window.addEventListener('offline', () => updateOnlineStatus(false));

// Initial check & interval polling
evaluateNetworkConnectivity();
setInterval(evaluateNetworkConnectivity, 5000);

// Helper to explicitly decode UTF-8 byte buffers and normalize to Unicode NFC
async function safeFetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    const jsonString = decoder.decode(buffer).normalize('NFC');
    return JSON.parse(jsonString);
}

// =========================================================================
// LAYER 2.5: USGS LIVE SEISMIC TELEMETRY INTEGRATION
// =========================================================================
async function fetchLiveSeismicTelemetry() {
    if (!seismicTxt) return;

    const currentLang = langSelect ? langSelect.value : 'en';

    try {
        const data = await safeFetchJson(`${BACKEND_URL}/api/telemetry/live`);

        if (data.count === 0) {
            seismicTxt.innerHTML = currentLang === 'ne_dev'
                ? "🟢 नेपाल क्षेत्र: शान्त (विगत २४ घण्टामा कुनै ठूलो भूकम्प मापन भएको छैन)।"
                : (currentLang === 'ne_rom'
                    ? "🟢 Nepal Chhetra: Shant (Bhigat 24 ghanta ma kunai bhukampa chhaina)."
                    : "🟢 Nepal Region: Seismic Quiet (No tremors in past 24h).");
            if (seismicBanner) seismicBanner.className = "seismic-banner normal";
        } else {
            const latest = data.events[0];
            const eventTime = new Date(latest.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            seismicTxt.innerHTML = currentLang === 'ne_dev'
                ? `🚨 <strong>भूकम्प सतर्कता:</strong> M ${latest.magnitude} | ${latest.location} (${eventTime})`
                : (currentLang === 'ne_rom'
                    ? `🚨 <strong>BHUKAMPA ALERT:</strong> M ${latest.magnitude} | ${latest.location} (${eventTime})`
                    : `🚨 <strong>TREMOR ALERT:</strong> M ${latest.magnitude} | ${latest.location} (${eventTime})`);
            if (seismicBanner) seismicBanner.className = "seismic-banner active-alert";
        }
    } catch (err) {
        console.warn("Seismic Telemetry Endpoint unreachable, using offline fallback display.");
        seismicTxt.innerHTML = currentLang === 'ne_dev'
            ? "⚠️ भूकम्प लाइभ सर्भर विच्छेद (अफलाइन मोड सक्रिय)"
            : "⚠️ Live Seismic Feed Disconnected (Offline mode active)";
        if (seismicBanner) seismicBanner.className = "seismic-banner offline";
    }
}

fetchLiveSeismicTelemetry();
setInterval(fetchLiveSeismicTelemetry, 120000);

if (langSelect) {
    langSelect.addEventListener('change', () => fetchLiveSeismicTelemetry());
}

// =========================================================================
// LAYER 3: UI VIEWPORT RENDERER & FORMATTERS (CLEAN CARD PARSER)
// =========================================================================
function formatMessageContent(rawText) {
    if (!rawText) return "";

    let clean = rawText.trim();

    // Check if message is a structured Protocol Card (e.g. starts with [PROTOCOL NAME])
    const headerMatch = clean.match(/^\[(.*?)\]\s*([\s\S]*)$/);
    if (headerMatch) {
        const headerTitle = headerMatch[1];
        const bodyContent = headerMatch[2];

        // Choose appropriate icon for header
        let icon = "🛡️";
        if (/earthquake|bhukampa|भूकम्प/i.test(headerTitle)) icon = "🚨";
        else if (/first aid|upachar|उपचार/i.test(headerTitle)) icon = "🩹";
        else if (/landslide|pahiro|पहिरो/i.test(headerTitle)) icon = "⛰️";
        else if (/flood|badi|बाढी/i.test(headerTitle)) icon = "🌊";
        else if (/hotline|contact|सम्पर्क/i.test(headerTitle)) icon = "📞";
        else if (/kit|bag|झोला/i.test(headerTitle)) icon = "🎒";

        let cardHtml = `<div class="protocol-card">`;
        cardHtml += `<div class="protocol-header"><span class="icon">${icon}</span> <span>${headerTitle}</span></div>`;

        // Split body lines
        const lines = bodyContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let listItems = [];
        let otherLines = [];
        let hotlineLine = null;

        lines.forEach(line => {
            if (line.includes('16666') || line.includes('100') || line.includes('102') || line.includes('1114')) {
                hotlineLine = line;
            } else if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
                const bulletText = line.replace(/^[•\-*]\s*/, '');
                listItems.push(bulletText);
            } else {
                otherLines.push(line);
            }
        });

        if (otherLines.length > 0) {
            cardHtml += otherLines.map(ol => `<p>${parseInlineMarkdown(ol)}</p>`).join('');
        }

        if (listItems.length > 0) {
            cardHtml += `<ul class="protocol-list">`;
            listItems.forEach((item, index) => {
                cardHtml += `
                    <li class="protocol-item">
                        <span class="protocol-bullet">${index + 1}</span>
                        <div class="protocol-content">${parseInlineMarkdown(item)}</div>
                    </li>`;
            });
            cardHtml += `</ul>`;
        }

        if (hotlineLine) {
            cardHtml += `
                <div class="hotline-section">
                    <div class="hotline-title">Emergency Hotlines (Nepal)</div>
                    <div class="hotline-pill-grid">
                        <a href="tel:100" class="hotline-pill"><span class="icon">👮</span> Police: 100</a>
                        <a href="tel:102" class="hotline-pill"><span class="icon">🚑</span> Ambulance: 102</a>
                        <a href="tel:16666" class="hotline-pill"><span class="icon">🏢</span> NDRRMA: 16666</a>
                        <a href="tel:1114" class="hotline-pill"><span class="icon">🚨</span> APF: 1114</a>
                    </div>
                </div>`;
        }

        cardHtml += `</div>`;
        return cardHtml;
    }

    // Default Markdown Parser for regular conversation
    let formatted = parseInlineMarkdown(clean);
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
}

function parseInlineMarkdown(text) {
    if (!text) return "";
    // Parse Markdown bold syntax **text** -> <strong>text</strong>
    let out = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return out;
}

function appendMessageToUI(text, sender, customClass = "", elementId = "") {
    if (!chatLog) return;

    const bubble = document.createElement('div');
    if (elementId) bubble.id = elementId;
    
    bubble.className = `bubble ${sender} ${customClass}`.trim();
    bubble.innerHTML = formatMessageContent(text);

    chatLog.appendChild(bubble);

    // Keep chat container scrollable and clean
    while (chatLog.children.length > 40) {
        chatLog.removeChild(chatLog.firstChild);
    }

    chatLog.scrollTop = chatLog.scrollHeight;
}

function appendLoadingBubble() {
    const loadingId = `loading-${Date.now()}`;
    const bubble = document.createElement('div');
    bubble.id = loadingId;
    bubble.className = 'bubble sys loading';
    bubble.innerHTML = `<em>QSAFE AI is processing safety guidance...</em>`;
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
    return loadingId;
}

function removeLoadingBubble(loadingId) {
    const el = document.getElementById(loadingId);
    if (el) el.remove();
}

// =========================================================================
// LAYER 4: LOCAL KNOWLEDGE BASE & OFFLINE ENGINE
// =========================================================================
function getNormalizedLang() {
    if (!langSelect) return 'en';
    return langSelect.value ? langSelect.value.trim() : 'en';
}

const LOCAL_KNOWLEDGE_BASE = {
    en: {
        first_aid: `[FIRST AID EMERGENCY PROTOCOL]
• **BLEEDING**: Apply direct, firm pressure with a clean cloth.
• **BURNS**: Flush immediately with cool, running water for 10–15 minutes. Do not break blisters.
• **FRACTURES**: Immobilize the limb using a splint without trying to realign the bone.
• **EMERGENCY CALL**: Police: 100 | Ambulance: 102 | NDRRMA: 16666`,

        earthquake: `[EARTHQUAKE SAFETY PROTOCOL]
• **DROP, COVER, HOLD ON**: Drop to hands and knees under sturdy furniture, cover head/neck, hold on until shaking stops.
• **STAY CLEAR**: Move away from windows, heavy furniture, and unreinforced masonry walls.
• **OUTDOORS**: Move to an open area away from power lines, trees, and tall buildings.
• **AFTER SHAKING**: Expect aftershocks. Use stairs, never elevators.
• **EMERGENCY CALL**: Police: 100 | Ambulance: 102 | NDRRMA: 16666`,

        contacts: `[EMERGENCY HOTLINES - NEPAL]
• **Nepal Police Control**: 100
• **Red Cross Ambulance**: 102
• **NDRRMA Disaster Helpline**: 16666
• **Armed Police Force (APF)**: 1114
• **Fire Brigade**: 101`,

        emergency_kit: `[EMERGENCY GO-BAG CHECKLIST]
• **Water & Food**: 3 liters water per person and 3-day dry food supply.
• **First Aid Kit**: Bandages, antiseptic, essential prescription medicines.
• **Light & Tools**: Flashlight, extra batteries, power bank, whistle.
• **Documents**: Copies of citizenship/IDs sealed in a waterproof pouch.
• **EMERGENCY CALL**: Police: 100 | Ambulance: 102 | NDRRMA: 16666`,

        landslide: `[LANDSLIDE SAFETY PROTOCOL]
• **INDOORS**: Move to the highest floor away from the slope. Cover under heavy furniture.
• **OUTDOORS**: Run immediately to elevated, stable ground away from gullies and rivers.
• **DRIVING**: Watch for falling debris and road cracks. Never cross active mudflows.
• **EMERGENCY CALL**: Police: 100 | Ambulance: 102 | NDRRMA: 16666`
    },

    ne_dev: {
        first_aid: `[प्राथमिक उपचार निर्देशिका]
• **रक्तस्राव**: सफा कपडाले सिधै बलियोसँग थिच्नुहोस्।
• **पोलेको**: बगिरहेको चिसो पानीले १०–१५ मिनेट पखाल्नुहोस्। फोका नफोड्नुहोस्।
• **हड्डी भाँचिएको**: काम्रो वा स्प्लिन्ट प्रयोग गरी अङ्ग अचल बनाउनुहोस्।
• **आपत्कालीन नम्बर**: प्रहरी: १०० | एम्बुलेन्स: १०२ | NDRRMA: १६६६६`,

        earthquake: `[भूकम्प सुरक्षा निर्देशिका]
• **घुँडा टेक, ओत लाग, समात**: बलियो टेबुलमुनि जानुहोस्, टाउको छोप्नुहोस् र कम्पन नरोकिउन्जेल समात्नुहोस्।
• **टाढा रहनुहोस्**: झ्याल, अग्ला फर्निचर र गाह्रोबाट टाढा बस्नुहोस्।
• **बाहिर भएमा**: भवन, पोल र रूखबाट टाढा खुला ठाउँमा जानुहोस्।
• **कम्पन रोकिएपछि**: पराकम्पनको लागि तयार रहनुहोस्। लिफ्ट प्रयोग नगर्नुहोस्।
• **आपत्कालीन नम्बर**: प्रहरी: १०० | एम्बुलेन्स: १०२ | NDRRMA: १६६६६`,

        contacts: `[नेपाल आपत्कालीन हटलाइनहरू]
• **नेपाल प्रहरी**: १००
• **रेडक्रस एम्बुलेन्स**: १०२
• **विपद् व्यवस्थापन (NDRRMA)**: १६६६६
• **सशस्त्र प्रहरी बल (APF)**: १११४
• **दमकल (Fire Brigade)**: १०१`,

        emergency_kit: `[आपतकालीन झोला (Go-Bag) चेकलिस्ट]
• **पानी र खाना**: प्रतिव्यक्ति ३ लिटर पानी र ३ दिनलाई पुग्ने सुख्खा खानेकुरा।
• **प्राथमिक उपचार**: ब्यान्डेज, एन्टिसेप्टिक र आवश्यक औषधिहरू।
• **उपकरण**: टर्चलाइट, अतिरिक्त ब्याट्री, पावर बैंक, सिट्ठी।
• **कागजात**: नागरिकताको प्रतिलिपि र केही नगद वाटरप्रूफ ब्यागमा।
• **आपत्कालीन नम्बर**: प्रहरी: १०० | एम्बुलेन्स: १०२ | NDRRMA: १६६६६`,

        landslide: `[पहिरो सुरक्षा निर्देशिका]
• **घरभित्र भएमा**: डाँडाभन्दा टाढाको माथिल्लो तलामा जानुहोस्।
• **बाहिर भएमा**: भीर, खोल्सा र नदी किनारबाट तुरुन्तै अग्लो ठाउँमा जानुहोस्।
• **गाडी चलाउँदा**: ढुङ्गा खस्ने जोखिम र बाटोका दरार ध्यान दिनुहोस्।
• **आपत्कालीन नम्बर**: प्रहरी: १०० | एम्बुलेन्स: १०२ | NDRRMA: १६६६६`
    },

    ne_rom: {
        first_aid: `[PRATHAMIK UPACHAR PROTOCOL]
• **RAGAT BAGDAI**: Safa kapada le sidhai baliyo thicnuhos.
• **POLEKO**: Chiso bagne pani le 10-15 min pakhalnuhos. Foka nafodnuhos.
• **HAAD BHATKIEKO**: Splint prayog gari anga nahalai rakhnuhos.
• **EMERGENCY CALL**: Police: 100 | Ambulance: 102 | NDRRMA: 16666`,

        earthquake: `[BHUKAMPA SAFETY PROTOCOL]
• **DROP, COVER, HOLD ON**: Baliyo table muni ghunda teker tauko chopnuhos, kampan narokiunjel samatnuhos.
• **TADHA RAHNUHOS**: Jhyal, aglo furniture ra garo bata tadha rahnuhos.
• **BAHIRA BHAEMA**: Bhavan, bijuli ko pole ra rukh bata tadha khula thaun ma januhos.
• **AFTER SHAKING**: Parakampan ko lagi tayar rahnuhos. Lift prayog nagarnuhos.
• **EMERGENCY CALL**: Police: 100 | Ambulance: 102 | NDRRMA: 16666`,

        contacts: `[NEPAL EMERGENCY HOTLINES]
• **Nepal Police**: 100
• **Red Cross Ambulance**: 102
• **NDRRMA (Disaster Helpline)**: 16666
• **Armed Police Force (APF)**: 1114
• **Fire Brigade**: 101`,

        emergency_kit: `[EMERGENCY GO-BAG CHECKLIST]
• **Pani ra Khana**: Ek jana ko lagi 3 liter pani ra 3 din pugne dry food.
• **Prathamik Upachar**: Bandage, antiseptic, niyamit aushadhi.
• **Tools**: Flashlight, extra battery, power bank, whistle.
• **Documents**: Nagarikta copy ra cash plastic pouch ma.
• **EMERGENCY CALL**: Police: 100 | Ambulance: 102 | NDRRMA: 16666`,

        landslide: `[PAHIRO SAFETY PROTOCOL]
• **BHITRA BHAEMA**: Dhalan bata tadha mathillo tala ma januhos.
• **BAHIRA BHAEMA**: Bhir ra khola kinara bata aglo thaun ma januhos.
• **GAADI CHALAUNDA**: Dhunga khasne jokhima ra bato ko crack heri chalaunuhos.
• **EMERGENCY CALL**: Police: 100 | Ambulance: 102 | NDRRMA: 16666`
    }
};

const INTENT_RULES = [
    { intent: 'first_aid', keywords: ['first aid', 'bleed', 'bleeding', 'burn', 'fracture', 'cut', 'prathamik', 'upachar', 'ragat', 'poleko', 'प्राथमिक', 'उपचार', 'रगत', 'पोलेको', 'घाइते'] },
    { intent: 'earthquake', keywords: ['earthquake', 'quake', 'tremor', 'seismic', 'bhuikampa', 'bhukamp', 'shake', 'भूकम्प', 'कम्पन्', 'हल्लियो'] },
    { intent: 'contacts', keywords: ['contact', 'number', 'phone', 'hotline', 'police', 'ambulance', 'ndrrma', 'prahari', 'सम्पर्क', 'नम्बर', 'हटलाइन', 'प्रहरी', 'एम्बुलेन्स'] },
    { intent: 'emergency_kit', keywords: ['kit', 'bag', 'go bag', 'supplies', 'jhola', 'samagri', 'झोला', 'सामग्री'] },
    { intent: 'landslide', keywords: ['landslide', 'mudslide', 'pahiro', 'पहिरो', 'पहिरो आयो'] }
];

function matchLocalIntent(query) {
    const q = query.toLowerCase().trim();
    for (const rule of INTENT_RULES) {
        if (rule.keywords.some(keyword => q.includes(keyword.toLowerCase()))) {
            return rule.intent;
        }
    }
    return null;
}

// =========================================================================
// LAYER 5: MAIN DISPATCH HANDLER (ONLINE RAG -> OFFLINE NLU FALLBACK)
// =========================================================================
async function handleUserIntent() {
    const rawQuery = queryIn.value ? queryIn.value.trim() : "";
    if (!rawQuery) return;

    const selectedLang = getNormalizedLang();

    // Step A: Render User Query
    appendMessageToUI(rawQuery, 'usr');
    queryIn.value = '';

    // Step B: Show Loading Indicator
    const loadingId = appendLoadingBubble();

    // Step C: If Online, Fetch Directly from Live API
    if (isSystemOnline) {
        try {
            const data = await safeFetchJson(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({ message: rawQuery, selected_language: selectedLang, lang: selectedLang })
            });

            removeLoadingBubble(loadingId);
            appendMessageToUI(data.response || data.reply, 'sys');
            return;
        } catch (err) {
            console.warn("⚠️ Live API call failed. Falling back to local offline engine...", err);
        }
    }

    // Step D: Offline Local Knowledge Base Fallback
    removeLoadingBubble(loadingId);

    // Greetings check
    const greetings = ['hello', 'hi', 'namaste', 'namaskar', 'नमस्ते', 'नमस्कार', 'hey'];
    if (greetings.includes(rawQuery.toLowerCase())) {
        const greetingMsg = selectedLang === 'ne_dev'
            ? "नमस्ते! म QSAFE, तपाईंको आपत्कालीन सुरक्षा सल्लाहकार हुँ। भूकम्प, पहिरो वा प्राथमिक उपचारबारे सोध्नुहोस्।"
            : (selectedLang === 'ne_rom'
                ? "Namaste! Ma QSAFE, tapainko emergency safety advisor hu. Bhukampa, pahiro va first aid bare sodhnuhos."
                : "Namaste! I am QSAFE, your emergency safety advisor. How can I assist you with earthquake, first aid, or disaster guidance today?");
        appendMessageToUI(greetingMsg, 'sys');
        return;
    }

    const detectedIntent = matchLocalIntent(rawQuery);
    const langDict = LOCAL_KNOWLEDGE_BASE[selectedLang] || LOCAL_KNOWLEDGE_BASE['en'];

    if (detectedIntent && langDict[detectedIntent]) {
        appendMessageToUI(langDict[detectedIntent], 'sys');
    } else {
        const unknownMsg = selectedLang === 'ne_dev'
            ? `[विपद् सुरक्षा निर्देशिका]\nम केवल आपत्कालीन सुरक्षा (भूकम्प, पहिरो, प्राथमिक उपचार, आपतकालीन झोला) मा मद्दत गर्न सक्छु।\n\nतत्काल मद्दतको लागि: प्रहरी: १०० | एम्बुलेन्स: १०२ | NDRRMA: १६६६६`
            : (selectedLang === 'ne_rom'
                ? `[EMERGENCY SAFETY ADVISORY]\nMa keval disaster ra emergency safety ma matra maddat garna sakchu.\n\nEmergency Call: Police: 100 | Ambulance: 102 | NDRRMA: 16666`
                : `[EMERGENCY SAFETY ADVISORY]\nI am specialized solely in disaster and emergency safety in Nepal.\n\nImmediate assistance: Police: 100 | Ambulance: 102 | NDRRMA: 16666`);
        appendMessageToUI(unknownMsg, 'sys');
    }
}

// =========================================================================
// LAYER 6: EVENT LISTENERS & QUICK CHIPS
// =========================================================================
if (dispatchBtn) {
    dispatchBtn.addEventListener('click', handleUserIntent);
}

if (queryIn) {
    queryIn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleUserIntent();
        }
    });
}

// Quick Chips Trigger
document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const query = e.target.getAttribute('data-query');
        if (query) {
            queryIn.value = query;
            handleUserIntent();
        }
    });
});
