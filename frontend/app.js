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
function formatMessageContent(rawText, isUrgent = false) {
    if (!rawText) return "";

    let clean = rawText.trim();

    // Check if message is a structured Protocol Card (e.g. starts with [PROTOCOL NAME])
    const headerMatch = clean.match(/^\[(.*?)\]\s*([\s\S]*)$/);
    if (headerMatch) {
        const headerTitle = headerMatch[1];
        const bodyContent = headerMatch[2];

        // Choose appropriate icon for header
        let icon = "🛡️";
        if (/trapped|थुनिएको|थुनिएँ|debris|बचाउ/i.test(headerTitle)) icon = "🚨";
        else if (/earthquake|bhukampa|भूकम्प/i.test(headerTitle)) icon = "🚨";
        else if (/first aid|upachar|उपचार|रगत|bleeding|burn|fracture/i.test(headerTitle)) icon = "🩹";
        else if (/landslide|pahiro|पहिरो/i.test(headerTitle)) icon = "⛰️";
        else if (/flood|badi|बाढी/i.test(headerTitle)) icon = "🌊";
        else if (/fire|aago|आगो|आगलागी/i.test(headerTitle)) icon = "🔥";
        else if (/hotline|contact|सम्पर्क|phone/i.test(headerTitle)) icon = "📞";
        else if (/kit|bag|झोला/i.test(headerTitle)) icon = "🎒";
        else if (/assembly|safe|सुरक्षित/i.test(headerTitle)) icon = "📍";

        const urgentClass = (isUrgent || /trapped|थुनिएको|थुनिएँ|bleeding|रगत|आगो|आगलागी|emergency/i.test(headerTitle)) ? "urgent-card" : "";

        let cardHtml = `<div class="protocol-card ${urgentClass}">`;
        cardHtml += `<div class="protocol-header"><span class="icon">${icon}</span> <span>${headerTitle}</span></div>`;

        // Split body lines
        const lines = bodyContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let listItems = [];
        let otherLines = [];
        let hotlineLine = null;

        lines.forEach(line => {
            if (line.includes('16666') || line.includes('100') || line.includes('102') || line.includes('1114') || line.includes('101')) {
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

        if (hotlineLine || urgentClass) {
            const dialUrgent = urgentClass ? "urgent-dial" : "";
            cardHtml += `
                <div class="hotline-section">
                    <div class="hotline-title">🚨 Emergency Hotlines (Nepal)</div>
                    <div class="hotline-pill-grid">
                        <a href="tel:100" class="hotline-pill ${dialUrgent}"><span class="icon">👮</span> Police: 100</a>
                        <a href="tel:102" class="hotline-pill ${dialUrgent}"><span class="icon">🚑</span> Ambulance: 102</a>
                        <a href="tel:16666" class="hotline-pill"><span class="icon">🏢</span> NDRRMA: 16666</a>
                        <a href="tel:1114" class="hotline-pill"><span class="icon">🚨</span> APF: 1114</a>
                        <a href="tel:101" class="hotline-pill"><span class="icon">🚒</span> Fire: 101</a>
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
    let out = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return out;
}

function appendMessageToUI(text, sender, customClass = "", elementId = "", isUrgent = false) {
    if (!chatLog) return;

    const bubble = document.createElement('div');
    if (elementId) bubble.id = elementId;
    
    bubble.className = `bubble ${sender} ${customClass}`.trim();
    bubble.innerHTML = formatMessageContent(text, isUrgent);

    chatLog.appendChild(bubble);

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

function showSyncToast(message) {
    const existing = document.querySelector('.sync-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'sync-toast';
    toast.innerHTML = `<span>🔄</span> <span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// =========================================================================
// LAYER 4: LOCAL KNOWLEDGE BASE & OFFLINE NLU ENGINE
// =========================================================================
function getNormalizedLang() {
    if (!langSelect) return 'en';
    return langSelect.value ? langSelect.value.trim() : 'en';
}

function detectUrgency(query) {
    const q = query.toLowerCase();
    const urgentKeywords = [
        'trapped', 'collapse', 'bury', 'buried', 'bleeding', 'blood', 'heart', 'unconscious',
        'help me', 'sos', 'dying', 'crushed', 'fire', 'burning', 'blast',
        'थुनिएँ', 'थुनिएको', 'च्यापिएको', 'रगत', 'बेहोस', 'मद्दत', 'बचाउ', 'आगो', 'आगलागी', 'भत्कियो', 'पर्खाल',
        'thuniyo', 'thunieko', 'chyapieko', 'ragat', 'madat', 'sahayata', 'bachau', 'aago', 'aagolagi', 'bhatkio', 'bhatkieko'
    ];
    return urgentKeywords.some(kw => q.includes(kw));
}

const LOCAL_KNOWLEDGE_BASE = {
    en: {
        trapped_debris_report: `[CRITICAL SOS: TRAPPED UNDER DEBRIS]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Stay calm and minimize movement to avoid kicking up dust.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Cover mouth with clothing. Tap on pipes or walls rhythmically—do not shout continuously.
3. 📞 **EMERGENCY HOTLINE CALL**: Police: 100 | APF Rescue: 1114`,

        earthquake_occurring_report: `[EARTHQUAKE SAFETY PROTOCOL]
1. 🛑 **IMMEDIATE HAZARD ACTION**: DROP, COVER, and HOLD ON under a sturdy desk or table.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Stay away from windows, glass, and unreinforced walls.
3. 📞 **EMERGENCY HOTLINE CALL**: Police: 100 | NDRRMA: 16666`,

        medical_emergency_request: `[MEDICAL EMERGENCY]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Ensure the area is safe before approaching the victim.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: If unconscious and not breathing, begin CPR immediately.
3. 📞 **EMERGENCY HOTLINE CALL**: Ambulance: 102 | Police: 100`,

        injury_report: `[INJURY REPORT]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Move the injured person to a safe area away from hazards.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Apply direct pressure to bleeding. Do not move suspected fractures.
3. 📞 **EMERGENCY HOTLINE CALL**: Ambulance: 102`,

        fire_incident_report: `[FIRE SAFETY & EVACUATION]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Evacuate immediately. Crawl low under smoke.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: If clothes catch fire: STOP, DROP, and ROLL.
3. 📞 **EMERGENCY HOTLINE CALL**: Fire Brigade: 101 | Police: 100`,

        gas_leak_report: `[GAS LEAK PROTOCOL]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Do not use any electrical switches, matches, or phones inside.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Open all windows and evacuate the building immediately.
3. 📞 **EMERGENCY HOTLINE CALL**: Fire Brigade: 101 | Police: 100`,

        building_collapse_report: `[BUILDING COLLAPSE PROTOCOL]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Evacuate if safe; do not re-enter the building.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Check yourself and others for injuries. Apply first aid.
3. 📞 **EMERGENCY HOTLINE CALL**: APF: 1114 | Police: 100`,

        building_damage_check: `[BUILDING DAMAGE CHECK]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Stay outside if you see deep diagonal cracks or tilting.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Turn off gas and electricity at the main switch.
3. 📞 **EMERGENCY HOTLINE CALL**: NDRRMA: 16666`,
        
        safe_location_query: `[EMERGENCY ASSEMBLY POINTS]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Move to open spaces (parks, school grounds).
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Avoid narrow alleys, tall walls, and power lines.
3. 📞 **EMERGENCY HOTLINE CALL**: Police: 100`,

        first_aid_query: `[FIRST AID EMERGENCY PROTOCOL]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Ensure scene safety.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Bleeding: Direct pressure. Burns: Cool water for 15 mins.
3. 📞 **EMERGENCY HOTLINE CALL**: Ambulance: 102`,

        sos_help_request: `[EMERGENCY SOS]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Identify your immediate threat (fire, collapse, flood).
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Take cover or evacuate to a safe zone.
3. 📞 **EMERGENCY HOTLINE CALL**: Police: 100 | Ambulance: 102`,

        greeting: `[GREETING]
Namaste! I am QSAFE, your emergency safety advisor. How can I assist you with earthquake, first aid, or disaster guidance today?`,
        goodbye_thanks: `[CLOSING]
Stay safe. Remember, in an emergency dial 100 for Police or 102 for Ambulance.`,
        shelter_request: `[SHELTER REQUEST]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Move to designated safe zones.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Contact local authorities for relief camp info.
3. 📞 **EMERGENCY HOTLINE CALL**: NDRRMA: 16666`,
        evacuation_guidance_query: `[EVACUATION GUIDANCE]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Follow marked evacuation routes.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Grab your go-bag and leave immediately.
3. 📞 **EMERGENCY HOTLINE CALL**: Police: 100`,
        family_member_missing: `[MISSING PERSON]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Ensure your own safety first.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Note down the last known location of the missing person.
3. 📞 **EMERGENCY HOTLINE CALL**: Police: 100`,
        family_reunification_status: `[FAMILY REUNIFICATION]
We are glad you are safe. Please update local volunteers or authorities about your status.`,
        food_water_request: `[RELIEF SUPPLIES]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Only consume sealed/boiled water.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Register at local relief camps.
3. 📞 **EMERGENCY HOTLINE CALL**: NDRRMA: 16666`,
        aftershock_information_query: `[AFTERSHOCKS]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Expect aftershocks. Do not re-enter damaged buildings.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Drop, Cover, Hold on during shaking.
3. 📞 **EMERGENCY HOTLINE CALL**: NDRRMA: 16666`,
        emergency_contact_request: `[EMERGENCY HOTLINES]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Dial appropriate number.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Police: 100, Ambulance: 102.
3. 📞 **EMERGENCY HOTLINE CALL**: NDRRMA: 16666 | APF: 1114 | Fire: 101`,
        power_outage_report: `[POWER OUTAGE]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Stay away from downed power lines.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Use flashlights, not candles.
3. 📞 **EMERGENCY HOTLINE CALL**: NEA/Police: 100`,
        road_blockage_report: `[ROAD BLOCKAGE]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Do not attempt to cross landslides or floods.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Turn around and find a safe open area.
3. 📞 **EMERGENCY HOTLINE CALL**: Traffic Police: 103 | Police: 100`,
        preparedness_tips_query: `[PREPAREDNESS]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Prepare a Go-Bag (Water, Food, Meds).
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Identify safe spots in your home.
3. 📞 **EMERGENCY HOTLINE CALL**: NDRRMA: 16666`,
        status_check_general: `[STATUS CHECK]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Assess your surroundings for danger.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Follow official instructions from authorities.
3. 📞 **EMERGENCY HOTLINE CALL**: NDRRMA: 16666`,
        fallback_unclear: `[EMERGENCY SAFETY ADVISORY]
I am specialized solely in disaster and emergency safety in Nepal.

Immediate assistance: Police: 100 | Ambulance: 102 | NDRRMA: 16666`
    },
    ne_dev: {
        trapped_debris_report: `[अति जरुरी SOS: भग्नावशेषमुनि थुनिएको]
1. 🛑 **IMMEDIATE HAZARD ACTION**: शान्त रहनुहोस्। धुलो नउडोस् भनेर धेरै नहल्लिने प्रयास गर्नुहोस्।
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: कपडाले नाक-मुख छोप्नुहोस्। पाइप वा पर्खालमा ढुङ्गाले ठोकेर ध्वनि संकेत दिनुहोस्।
3. 📞 **EMERGENCY HOTLINE CALL**: सशस्त्र प्रहरी: १११४ | प्रहरी: १००`,
        earthquake_occurring_report: `[भूकम्प सुरक्षा निर्देशिका]
1. 🛑 **IMMEDIATE HAZARD ACTION**: घुँडा टेक, ओत लाग, समात (DROP, COVER, HOLD ON)।
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: झ्याल, सिसा र कमजोर गाह्रोबाट टाढा बस्नुहोस्।
3. 📞 **EMERGENCY HOTLINE CALL**: प्रहरी: १०० | NDRRMA: १६६६६`,
        sos_help_request: `[आपत्कालीन मद्दत]
1. 🛑 **IMMEDIATE HAZARD ACTION**: आफ्नो वरपरको खतरा (आगो, बाढी, पहिरो) पहिचान गर्नुहोस्।
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: सुरक्षित स्थानमा जानुहोस्।
3. 📞 **EMERGENCY HOTLINE CALL**: प्रहरी: १०० | एम्बुलेन्स: १०२`
    },
    ne_rom: {
        trapped_debris_report: `[URGENT SOS: DEBRIS MUNI THUNIYO]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Shanta rahnuhos. Dhulo bata bachna dherai nahallinuhos.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Kapada le naak-mukh chopnuhos. Pipe ma thokera aawaj nikalnuhos.
3. 📞 **EMERGENCY HOTLINE CALL**: APF: 1114 | Police: 100`,
        earthquake_occurring_report: `[BHUKAMPA SAFETY PROTOCOL]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Baliyo table muni ghunda teker tauko chopnuhos (DROP, COVER, HOLD ON).
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Jhyal ra kamjor garo bata tadha rahnuhos.
3. 📞 **EMERGENCY HOTLINE CALL**: Police: 100 | NDRRMA: 16666`,
        sos_help_request: `[EMERGENCY SOS]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Aafno warapara ko khatara (aago, badi) heri surakshit thaun khojnuhos.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Turuntai khula thaun ma januhos.
3. 📞 **EMERGENCY HOTLINE CALL**: Police: 100 | Ambulance: 102`
    }
};

const INTENT_RULES = [
    { intent: 'greeting', keywords: ['hi', 'hello', 'namaste', 'namaskar', 'hey', 'नमस्ते', 'नमस्कार'] },
    { intent: 'goodbye_thanks', keywords: ['bye', 'thank you', 'thanks', 'dhanyabad', 'धन्यवाद', 'बिदा'] },
    { intent: 'sos_help_request', keywords: ['help', 'help me', 'sos', 'bachau', 'मलाई बचाउ', 'मद्दत', 'madat', 'sahayata'] },
    { intent: 'earthquake_occurring_report', keywords: ['earthquake now', 'bhukampa aayo', 'घर हल्लियो', 'bhuikampa', 'shake', 'भूकम्प', 'कम्पन्'] },
    { intent: 'trapped_debris_report', keywords: ['trapped', 'under rubble', 'under debris', 'pinned', 'buried', 'crushed', 'stuck inside', 'पर्खालमुनि', 'थुनिएँ', 'थुनिएको', 'च्यापिएको', 'भग्नावशेष', 'thuniyo', 'thunieko', 'chyapieko', 'debris muni'] },
    { intent: 'medical_emergency_request', keywords: ['need an ambulance', 'एम्बुलेन्स चाहियो', 'ambulance chaincha', 'unconscious', 'not breathing', 'heart attack', 'बेहोस'] },
    { intent: 'injury_report', keywords: ['i am injured', 'मलाई चोट लागेको छ', 'khutta ma chot', 'घाउ', 'चोट'] },
    { intent: 'fire_incident_report', keywords: ['fire', 'burning', 'smoke', 'fire brigade', 'आगो', 'आगलागी', 'धुवाँ', 'दमकल', 'aago', 'aagolagi', 'damkal'] },
    { intent: 'gas_leak_report', keywords: ['gas leak', 'ग्यास चुहियो', 'gas smell', 'smell gas'] },
    { intent: 'building_collapse_report', keywords: ['building collapsed', 'घर भत्कियो', 'ghar bhatkiyo', 'roof collapsed', 'भवन भत्कियो'] },
    { intent: 'building_damage_check', keywords: ['house has cracks', 'चिरा परेको छ', 'crack aayo', 'is my house safe', 'दरार'] },
    { intent: 'safe_location_query', keywords: ['safe location', 'assembly point', 'open space', 'open ground', 'कहाँ जाने', 'सुरक्षित ठाउँ', 'भेला हुने ठाउँ', 'surakshit thaun', 'khula thaun'] },
    { intent: 'shelter_request', keywords: ['need shelter', 'आश्रय चाहियो', 'shelter chaincha', 'tent', 'camp'] },
    { intent: 'evacuation_guidance_query', keywords: ['how to evacuate', 'निकासाको मार्ग', 'kasari safely evacuate'] },
    { intent: 'family_member_missing', keywords: ['missing', 'बेपत्ता', ' हराएको', 'haraeko', 'bepatta'] },
    { intent: 'family_reunification_status', keywords: ['found my family', 'सुरक्षित भेटियो', 'safe bhetiyo', 'found safe'] },
    { intent: 'food_water_request', keywords: ['drinking water', 'खानेपानी चाहियो', 'khane pani', 'food', 'ration', 'खाना'] },
    { intent: 'first_aid_query', keywords: ['how to stop bleeding', 'रगत बग्न रोक्ने उपाय', 'cpr kasari', 'how to treat', 'first aid', 'प्राथमिक उपचार'] },
    { intent: 'aftershock_information_query', keywords: ['aftershocks', 'पराकम्प', 'aftershock aaunxa', 'more shaking'] },
    { intent: 'emergency_contact_request', keywords: ['contact', 'number', 'phone', 'hotline', 'police number', 'ambulance number', 'सम्पर्क', 'नम्बर', 'हटलाइन'] },
    { intent: 'power_outage_report', keywords: ['power outage', 'बिजुली गएको छ', 'power cut', 'no electricity', 'line gayo'] },
    { intent: 'road_blockage_report', keywords: ['road blocked', 'सडक बन्द', 'road block bhayo', 'bato banda'] },
    { intent: 'preparedness_tips_query', keywords: ['how to prepare', 'गो-ब्याग कसरी', 'emergency kit ma k k', 'go bag', 'prepare'] },
    { intent: 'status_check_general', keywords: ['what should i do', 'अहिले मैले के गर्नुपर्छ', 'ahile k garne', 'what now'] },
    { intent: 'fallback_unclear', keywords: [] }
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
// LAYER 5: OFFLINE SOS OUTBOX QUEUE & AUTO-SYNC
// =========================================================================
const OFFLINE_QUEUE_KEY = 'qsafe_offline_sos_queue';

function getOfflineQueue() {
    try {
        const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

function queueOfflineReport(report) {
    try {
        const queue = getOfflineQueue();
        let coords = null;
        
        function _saveReport() {
            queue.push({
                id: `sos-${Date.now()}`,
                text: report.text,
                lang: report.lang,
                timestamp: new Date().toISOString(),
                isUrgent: report.isUrgent,
                coords: coords
            });
            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => { 
                    coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }; 
                    _saveReport();
                },
                (err) => { 
                    console.warn("GPS unavailable:", err); 
                    _saveReport(); 
                },
                { timeout: 5000 }
            );
        } else {
            _saveReport();
        }
    } catch (e) {
        console.warn("Could not save offline SOS queue:", e);
    }
}

async function syncOfflineReports() {
    const queue = getOfflineQueue();
    if (!queue || queue.length === 0) return;

    try {
        const count = queue.length;
        const res = await fetch(`${BACKEND_URL}/api/emergency/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reports: queue })
        });
        
        if (res.ok) {
            localStorage.removeItem(OFFLINE_QUEUE_KEY);
            showSyncToast(`${count} offline emergency report(s) synced with dispatch!`);
        } else {
            console.warn("Backend rejected sync:", res.status);
        }
    } catch (e) {
        console.warn("Failed to flush offline queue:", e);
    }
}

window.addEventListener('online', () => {
    syncOfflineReports();
});

// =========================================================================
// LAYER 6: MAIN DISPATCH HANDLER (ONLINE RAG -> OFFLINE NLU FALLBACK)
// =========================================================================
async function handleUserIntent() {
    const rawQuery = queryIn.value ? queryIn.value.trim() : "";
    if (!rawQuery) return;

    const selectedLang = getNormalizedLang();
    const isUrgent = detectUrgency(rawQuery);

    // Step A: Render User Query
    appendMessageToUI(rawQuery, 'usr');
    queryIn.value = '';

    // Step B: Show Loading Indicator
    const loadingId = appendLoadingBubble();

    // Step C: If Online, Fetch Directly from Live Backend API
    if (isSystemOnline) {
        try {
            const data = await safeFetchJson(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({ message: rawQuery, selected_language: selectedLang, lang: selectedLang })
            });

            removeLoadingBubble(loadingId);
            appendMessageToUI(data.response || data.reply, 'sys', '', '', isUrgent);
            return;
        } catch (err) {
            console.warn("⚠️ Live API call failed. Falling back to local offline engine...", err);
        }
    }

    // Step D: Offline Local Knowledge Base Fallback
    removeLoadingBubble(loadingId);

    // If urgent distress call during offline mode, store in offline outbox for automatic sync
    if (isUrgent) {
        queueOfflineReport({ text: rawQuery, lang: selectedLang, isUrgent: true });
    }

    // Greetings check
    const greetings = ['hello', 'hi', 'namaste', 'namaskar', 'नमस्ते', 'नमस्कार', 'hey'];
    if (greetings.includes(rawQuery.toLowerCase())) {
        const greetingMsg = selectedLang === 'ne_dev'
            ? "नमस्ते! म QSAFE, तपाईंको आपत्कालीन सुरक्षा सल्लाहकार हुँ। भूकम्प, पहिरो वा प्राथमिक उपचारबारे सोध्नुहोस्।"
            : (selectedLang === 'ne_rom'
                ? "Namaste! Ma QSAFE, tapainko emergency safety advisor hu. Bhukampa, pahiro va first aid bare sodhnuhos."
                : "Namaste! I am QSAFE, your emergency safety advisor. How can I assist you with earthquake, first aid, or disaster guidance today?");
        appendMessageToUI(greetingMsg, 'sys', '', '', false);
        return;
    }

    const detectedIntent = matchLocalIntent(rawQuery);
    const langDict = LOCAL_KNOWLEDGE_BASE[selectedLang] || LOCAL_KNOWLEDGE_BASE['en'];

    const responseCard = detectedIntent ? (langDict[detectedIntent] || LOCAL_KNOWLEDGE_BASE['en'][detectedIntent]) : null;
    if (responseCard) {
        appendMessageToUI(responseCard, 'sys', '', '', isUrgent);
        
    } else {
        const unknownMsg = selectedLang === 'ne_dev'
            ? `[विपद् सुरक्षा निर्देशिका]\nम केवल आपत्कालीन सुरक्षा (भूकम्प, पहिरो, प्राथमिक उपचार, आपतकालीन झोला) मा मद्दत गर्न सक्छु।\n\nतत्काल मद्दतको लागि: प्रहरी: १०० | एम्बुलेन्स: १०२ | NDRRMA: १६६६६`
            : (selectedLang === 'ne_rom'
                ? `[EMERGENCY SAFETY ADVISORY]\nMa keval disaster ra emergency safety ma matra maddat garna sakchu.\n\nEmergency Call: Police: 100 | Ambulance: 102 | NDRRMA: 16666`
                : `[EMERGENCY SAFETY ADVISORY]\nI am specialized solely in disaster and emergency safety in Nepal.\n\nImmediate assistance: Police: 100 | Ambulance: 102 | NDRRMA: 16666`);
        appendMessageToUI(unknownMsg, 'sys', '', '', isUrgent);
    }
}

// =========================================================================
// LAYER 7: EVENT LISTENERS & QUICK CHIPS
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

