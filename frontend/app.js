// =========================================================================
// LAYER 0: SERVICE WORKER REGISTRATION
// =========================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('🚀 Service Worker active:', reg.scope))
            .catch(err => console.error('❌ Service Worker failed:', err));
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

// =========================================================================
// LAYER 2.5: USGS LIVE SEISMIC TELEMETRY INTEGRATION
// =========================================================================
async function fetchLiveSeismicTelemetry() {
    if (!seismicTxt) return;

    const currentLang = langSelect ? langSelect.value : 'en';

    try {
        const response = await fetch(`${BACKEND_URL}/api/telemetry/live`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();

        if (data.count === 0) {
            seismicTxt.innerHTML = currentLang === 'ne'
                ? "🟢 नेपाल क्षेत्र: विगत २४ घण्टामा कुनै भूकम्प मापन भएको छैन।"
                : "🟢 Nepal Region: Seismic Quiet (No tremors in past 24h).";
            if (seismicBanner) seismicBanner.className = "seismic-banner normal";
        } else {
            const latest = data.events[0];
            const eventTime = new Date(latest.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            seismicTxt.innerHTML = currentLang === 'ne'
                ? `🚨 <strong>भूकम्प अलर्ट:</strong> M ${latest.magnitude} | ${latest.location} (${eventTime})`
                : `🚨 <strong>TREMOR ALERT:</strong> M ${latest.magnitude} | ${latest.location} (${eventTime})`;
            if (seismicBanner) seismicBanner.className = "seismic-banner active-alert";
        }
    } catch (err) {
        console.warn("Seismic Telemetry Endpoint unreachable, using offline fallback display.");
        seismicTxt.innerHTML = currentLang === 'ne'
            ? "⚠️ भूकम्प लाइभ सर्भर विच्छेद (अफलाइन मोड active)"
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
// LAYER 3: UI VIEWPORT RENDERER & FORMATTERS
// =========================================================================
function formatMessageContent(rawText) {
    if (!rawText) return "";
    // Parse Markdown bold syntax **text** -> <strong>text</strong>
    let formatted = rawText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Convert newlines to HTML break lines
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
}

function appendMessageToUI(text, sender, routeTag = "", customClass = "", elementId = "") {
    if (!chatLog) return;

    const bubble = document.createElement('div');
    if (elementId) bubble.id = elementId;
    
    bubble.className = `bubble ${sender} ${customClass}`.trim();
    bubble.innerHTML = formatMessageContent(text);

    if (routeTag) {
        const meta = document.createElement('div');
        meta.className = "meta-tag";
        meta.innerText = `Route: ${routeTag}`;
        bubble.appendChild(meta);
    }

    chatLog.appendChild(bubble);

    // Keep chat container scrollable and clean
    while (chatLog.children.length > 30) {
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
// LAYER 4: LOCAL INTENT DISPATCHER & RAG PIPELINE (DYNAMIC ONLINE/OFFLINE FIX)
// =========================================================================

// 1. Language Code Normalizer
function getNormalizedLang() {
    if (!langSelect) return 'en';
    const val = langSelect.value ? langSelect.value.toLowerCase() : '';
    if (val === 'np' || val === 'ne' || val === 'नेपाली' || val.includes('nepal')) {
        return 'np';
    }
    return 'en';
}

// 2. Dynamic Unknown Query Handler (Offline Fallback Only)
function getUnknownQueryResponse(lang) {
    if (lang === 'np') {
        return `[डेटा उपलब्ध छैन]
हाम्रो अफलाइन डेटाबेसमा यो प्रश्नको लागि कुनै जानकारी उपलब्ध छैन।

कृपया यी उपलब्ध विषयहरूमा खोजी गर्नुहोस्:
• भूकम्प सुरक्षा (Earthquake)
• प्राथमिक उपचार (First Aid)
• आपत्कालीन झोला (Emergency Kit)
• सम्पर्क नम्बर (Emergency Hotlines)

तत्काल सहयोगका लागि: प्रहरी १०० वा NDRRMA १६६६६ मा सम्पर्क गर्नुहोस्।`;
    } else {
        return `[NO DATA AVAILABLE]
We do not have specific safety guidance for this query in our offline database.

Please try asking about our supported emergency topics:
• Earthquake Protocol (भूकम्प)
• First Aid Guidance (प्राथमिक उपचार)
• Emergency Kit / Go-Bag (आपत्कालीन झोला)
• Emergency Hotlines (सम्पर्क नम्बर)

For immediate life safety: Call Police (100) or NDRRMA (16666).`;
    }
}

// 3. Knowledge Base for Specific Offline Intents
const LOCAL_KNOWLEDGE_BASE = {
    en: {
        first_aid: `[FIRST AID PROTOCOL]
• Bleeding: Apply direct, firm pressure with a clean cloth.
• Fractures: Immobilize the limb using a splint without trying to realign the bone.
• Burns: Flush immediately with cool, running water for 10 minutes.
• Unconsciousness: Place in recovery position and check breathing.`,

        earthquake: `[EARTHQUAKE SAFETY PROTOCOL]
• INDOORS: DROP, COVER, and HOLD ON under structural beams or stable furniture. Stay clear of masonry brick walls, windows, and heavy overhead fixtures.
• OUTDOORS: Move to an open area away from buildings, utility wires, and trees.
• AFTER SHAKING: Expect aftershocks. Use stairs, never elevators. Check for gas leaks.`,

        contacts: `[EMERGENCY HOTLINES - NEPAL]
• National Emergency Operations (NDRRMA): 16666
• Nepal Police Control: 100
• Armed Police Force Rescue: 1114
• Red Cross Ambulance Central: 102
• Fire Brigade: 101`,

        emergency_kit: `[EMERGENCY GO-BAG CHECKLIST]
• Water: 3 liters/person for at least 3 days.
• Food: Non-perishable, ready-to-eat items.
• Medical: First-aid kit, essential prescription meds.
• Tools: Flashlight, extra batteries, power bank, whistle, multi-tool knife.
• Documents: Copies of citizenship, insurance, emergency cash in waterproof bag.`,

        fire_flood: `[FIRE & FLOOD SAFETY]
• FIRE: Stay low to avoid smoke. Touch doors with the back of your hand before opening. If caught, Stop, Drop, and Roll.
• FLOOD: Move immediately to higher ground. Never walk or drive through moving floodwaters (15 cm of moving water can knock you down).`
    },

    np: {
        first_aid: `[प्राथमिक उपचार प्रणाली]
• रगत बग्ने: सफा कपडाले सिधै बलियो थिच्नुहोस्।
• हाड भाँचिएको: हड्डी सच्याउन नखोजी स्प्लिन्ट प्रयोग गरेर अङ्ग स्थिर राख्नुहोस्।
• पोलेको: तुरुन्तै १० मिनेटसम्म चिसो, बगिरहेको पानीले पखाल्नुहोस्।
• बेहोस: सुरक्षात्मक स्थिति (Recovery Position) मा राख्नुहोस् र सास फेरेको जाँच गर्नुहोस्।`,

        earthquake: `[भूकम्प सुरक्षा प्रणाली]
• घरभित्र: बलियो टेबलमुनि झुक्नुहोस् (DROP), ओत लाग्नुहोस् (COVER), र समात्नुहोस् (HOLD ON)। झ्याल र गह्रौँ फर्निचरबाट टाढा रहनुहोस्।
• बाहिर: भवन, बिजुलीको पोल र रुखहरूबाट टाढा खुला ठाउँमा जानुहोस्।
• कम्पन रोकिएपछि: पराकम्पनको लागि तयार रहनुहोस्। लिफ्ट प्रयोग नगर्नुहोस्।`,

        contacts: `[आकस्मिक हटलाइनहरू - नेपाल]
• राष्ट्रिय आपत्कालीन कार्य सञ्चालन केन्द्र (NDRRMA): १६६६६
• नेपाल प्रहरी नियन्त्रण: १००
• सशस्त्र प्रहरी बल उद्धार: १११४
• रेडक्रस एम्बुलेन्स सेन्टर: १०२
• दमकल (Fire): १०१`,

        emergency_kit: `[आपत्कालीन झोला (Go-Bag) सामग्री]
• पानी: प्रतिव्यक्ति दैनिक ३ लिटर (कमसेकम ३ दिनको लागि)।
• खाना: बिग्रिने नहुने र पकाउनु नपर्ने खानेकुरा।
• औषधि: प्राथमिक उपचार किट र आवश्यक नियमित औषधि।
• औजार: टर्चलाइट, पावर बैंक, सिट्टी (Whistle), चक्कु।
• कागजात: नागरिकताको प्रतिलिपि, नगद रूपैयाँ।`,

        fire_flood: `[आगो र बाढी सुरक्षा]
• आगलागी: धुवाँबाट बच्न निहुरिएर हिँड्नुहोस्। कपडामा आगो लागेमा - रोकिनुहोस्, भुइँमा सोल्टिनुहोस् (Stop, Drop, Roll)।
• बाढी: तुरुन्तै अग्लो ठाउँमा जानुहोस्। बगिरहेको बाढीको पानीमा कहिल्यै नहिँड्नुहोस्।`
    }
};

// 4. Keyword Rules
const INTENT_RULES = [
    {
        intent: 'first_aid',
        keywords: ['first aid', 'aid', 'bleed', 'bleeding', 'burn', 'fracture', 'cut', 'prathamik', 'upachar', 'ragat', 'poleko', 'haad', 'प्राथमिक', 'उपचार', 'रगत', 'पोलेको', 'हाड', 'घाउ']
    },
    {
        intent: 'earthquake',
        keywords: ['earthquake', 'quake', 'tremor', 'seismic', 'bhuinkampa', 'bhukampa', 'kampan', 'shake', 'bhu', 'भूकम्प', 'कम्पन', 'निर्देशिका']
    },
    {
        intent: 'contacts',
        keywords: ['contact', 'number', 'phone', 'call', 'hotline', 'police', 'ambulance', 'ndrrma', 'nambar', 'samparka', 'prahari', 'सम्पर्क', 'नम्बर', 'हटलाइन', 'प्रहरी', 'एम्बुलेन्स']
    },
    {
        intent: 'emergency_kit',
        keywords: ['kit', 'bag', 'go bag', 'supplies', 'pack', 'jhola', 'samagri', 'आपत्कालीन', 'झोला', 'सामग्री']
    },
    {
        intent: 'fire_flood',
        keywords: ['fire', 'flood', 'burns', 'aago', 'aagolagi', 'baadhi', 'badhi', 'damkal', 'आगो', 'आगलागी', 'बाढी', 'दमकल']
    }
];

// 5. Intent Matcher
function matchUserIntent(query) {
    const q = query.toLowerCase().trim();
    for (const rule of INTENT_RULES) {
        if (rule.keywords.some(keyword => q.includes(keyword.toLowerCase()))) {
            return rule.intent;
        }
    }
    return 'default';
}

// 6. Main Event Handler (Fetches from Backend when Online)
async function handleUserIntent() {
    const rawQuery = queryIn.value ? queryIn.value.trim() : "";
    if (!rawQuery) return;

    const currentLang = getNormalizedLang();
    const backendLang = (currentLang === 'np') ? 'ne' : 'en';

    // Step A: Render User Query
    appendMessageToUI(rawQuery, 'user');
    queryIn.value = '';

    // Step B: Show Loading Indicator
    const loadingId = appendLoadingBubble();

    // Step C: If Online, Fetch Directly from Live Gemini + ChromaDB API
    if (isSystemOnline) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: rawQuery, lang: backendLang })
            });

            if (response.ok) {
                const data = await response.json();
                removeLoadingBubble(loadingId);
                appendMessageToUI(
                    data.response || data.reply,
                    'sys', 
                    `Live RAG Pipeline (Gemini 2.0 + ChromaDB) [${currentLang.toUpperCase()}]`
                );
                return;
            }
        } catch (err) {
            console.warn("⚠️ Live API call failed. Falling back to offline local engine...", err);
        }
    }

    // Step D: Offline Fallback Engine (Used when offline or network fails)
    removeLoadingBubble(loadingId);

    // Handle Greetings in Offline Mode
    const greetings = ['hello', 'hi', 'namaste', 'namaskar', 'नमस्ते', 'नमस्कार', 'hey'];
    if (greetings.includes(rawQuery.toLowerCase())) {
        const greetingMsg = currentLang === 'np' 
            ? "नमस्ते! म QSAFE नेपाल अफलाइन आपत्कालीन सहायक हुँ। म तपाईंलाई भूकम्प सुरक्षा, प्राथमिक उपचार वा आपत्कालीन झोला सम्बन्धी जानकारी दिन सक्छु।"
            : "Namaste! I am QSAFE Nepal's emergency assistant. How can I assist you with disaster preparedness or safety guidance today?";
        
        appendMessageToUI(greetingMsg, 'sys', `Local Storage Fallback (${currentLang.toUpperCase()})`);
        return;
    }

    const detectedIntent = matchUserIntent(rawQuery);
    let responseText;

    if (detectedIntent === 'default') {
        responseText = getUnknownQueryResponse(currentLang);
    } else {
        const langDict = LOCAL_KNOWLEDGE_BASE[currentLang] || LOCAL_KNOWLEDGE_BASE['en'];
        responseText = langDict[detectedIntent];
    }

    appendMessageToUI(
        responseText, 
        'sys', 
        `Local Storage Fallback (${currentLang.toUpperCase()})`
    );
}
// =========================================================================
// LAYER 5: OFFLINE BACKUP PROCESSING (LOCAL JSON CACHE)
// =========================================================================
async function executeLocalCacheFallback(userQuery) {
    const currentLang = langSelect ? langSelect.value : 'en';

    try {
        const response = await fetch('/public/emergency_contacts.json');
        if (!response.ok) throw new Error("Local JSON cache file missing");
        
        const data = await response.json();
        const queryLower = userQuery.toLowerCase();
        
        let safetyMessage = "";
        let matchedIntent = "";
        let themeClass = "";

        if (
            queryLower.includes('namaste') || queryLower.includes('namaskar') || 
            queryLower.includes('hello') || queryLower.includes('hi') || 
            queryLower.includes('help') || queryLower.includes('maddat') ||
            queryLower.includes('मद्दत') || queryLower.includes('नमस्ते') || 
            queryLower.includes('नमस्कार')
        ) {
            safetyMessage = currentLang === 'en'
                ? "Namaste! I am QSAFE Nepal, your offline earthquake safety assistant. Ask me about emergency protocols, first aid, or supply kits."
                : "नमस्ते! म QSAFE नेपाल अफलाइन भूकम्प सुरक्षा सहायक हुँ। तपाईं मलाई भूकम्प सुरक्षा निर्देशिका, प्राथमिक उपचार वा आपतकालीन झोलाका बारेमा सोध्न सक्नुहुन्छ।";
            matchedIntent = currentLang === 'en' ? "Greeting / System Info" : "नमस्ते / प्रणाली जानकारी";
        } 
        else if (
            queryLower.includes('earthquake') || queryLower.includes('bhuikampa') || 
            queryLower.includes('bhukamp') || queryLower.includes('bhuikamp') || 
            queryLower.includes('shake') || queryLower.includes('tremor') || 
            queryLower.includes('quak') || queryLower.includes('भुइँचालो') || 
            queryLower.includes('भूकम्प') || queryLower.includes('k garne')
        ) {
            safetyMessage = data.static_checklists.earthquake[currentLang];
            matchedIntent = currentLang === 'en' ? "Earthquake Action Protocol" : "भूकम्प सुरक्षा निर्देशिका";
            themeClass = "earthquake-alert";
        } 
        else if (
            queryLower.includes('first aid') || queryLower.includes('injur') || 
            queryLower.includes('upachar') || queryLower.includes('उपचार') || 
            queryLower.includes('चोट')
        ) {
            safetyMessage = data.static_checklists.first_aid[currentLang];
            matchedIntent = currentLang === 'en' ? "Earthquake First-Aid Protocol" : "भूकम्प प्राथमिक उपचार";
        } 
        else if (
            queryLower.includes('kit') || queryLower.includes('bag') || 
            queryLower.includes('prepar') || queryLower.includes('jhola') || 
            queryLower.includes('झोला')
        ) {
            safetyMessage = data.static_checklists.kit[currentLang];
            matchedIntent = currentLang === 'en' ? "Earthquake Emergency Kit" : "भूकम्प आपतकालीन झोला";
        }
        else {
            safetyMessage = data.static_checklists.failsafe[currentLang];
            matchedIntent = currentLang === 'en' ? "Offline Earthquake Fail-Safe" : "अफलाइन भूकम्प सुरक्षा निर्देशिका";
        }

        const hotlineLabel = currentLang === 'en' ? "Emergency Hotlines" : "आपतकालीन हटलाइन नम्बरहरू";
        let output = `[CRITICAL OFF-GRID SAFETY HIGHLIGHT - ${matchedIntent.toUpperCase()}]\n${safetyMessage}\n\n${hotlineLabel}:\n`;
        
        if (data.hotlines && data.hotlines[currentLang]) {
            data.hotlines[currentLang].forEach(item => {
                const cleanPhone = item.phone.replace(/\s+/g, '');
                output += `• ${item.name}: <a href="tel:${cleanPhone}" class="hotline-link">${item.phone}</a>\n`;
            });
        }
        
        appendMessageToUI(output, "sys", `Local Storage Fallback (${currentLang.toUpperCase()})`, themeClass);

    } catch (err) {
        console.error("Local file extraction error:", err);
        const errMsg = currentLang === 'ne' 
            ? "गम्भीर त्रुटि: स्थानीय भण्डारण पहुँचयोग्य छैन।" 
            : "Critical error: Local offline storage inaccessible.";
        appendMessageToUI(errMsg, "sys", "Storage Error");
    }
}

// =========================================================================
// LAYER 6: EVENT LISTENERS
// =========================================================================
if (dispatchBtn) {
    dispatchBtn.addEventListener('click', handleUserIntent);
}

if (queryIn) {
    queryIn.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUserIntent();
    });
}

document.querySelectorAll('.chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
        const currentLang = langSelect ? langSelect.value : 'en';
        let targetQuery = chip.getAttribute('data-query');

        if (chip.id === 'chip-eq') {
            targetQuery = currentLang === 'ne' ? 'भूकम्प' : 'earthquake protocol';
        } else if (chip.id === 'chip-fa') {
            targetQuery = currentLang === 'ne' ? 'प्राथमिक उपचार' : 'first aid';
        } else if (chip.id === 'chip-kit') {
            targetQuery = currentLang === 'ne' ? 'आपतकालीन झोला' : 'emergency kit';
        }

        if (targetQuery && queryIn) {
            queryIn.value = targetQuery;
            handleUserIntent();
        }
    });
});