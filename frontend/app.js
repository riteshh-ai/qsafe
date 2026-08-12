// =========================================================================
// LAYER 0: SERVICE WORKER REGISTRATION
// =========================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('≡ƒÜÇ Service Worker active:', reg.scope))
            .catch(err => console.error('Γ¥î Service Worker failed:', err));
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
                ? "≡ƒƒó αñ¿αÑçαñ¬αñ╛αñ▓ αñòαÑìαñ╖αÑçαññαÑìαñ░: αñ╡αñ┐αñùαññ αÑ¿αÑ¬ αñÿαñúαÑìαñƒαñ╛αñ«αñ╛ αñòαÑüαñ¿αÑê αñ¡αÑéαñòαñ«αÑìαñ¬ αñ«αñ╛αñ¬αñ¿ αñ¡αñÅαñòαÑï αñ¢αÑêαñ¿αÑñ"
                : "≡ƒƒó Nepal Region: Seismic Quiet (No tremors in past 24h).";
            if (seismicBanner) seismicBanner.className = "seismic-banner normal";
        } else {
            const latest = data.events[0];
            const eventTime = new Date(latest.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            seismicTxt.innerHTML = currentLang === 'ne'
                ? `≡ƒÜ¿ <strong>αñ¡αÑéαñòαñ«αÑìαñ¬ αñàαñ▓αñ░αÑìαñƒ:</strong> M ${latest.magnitude} | ${latest.location} (${eventTime})`
                : `≡ƒÜ¿ <strong>TREMOR ALERT:</strong> M ${latest.magnitude} | ${latest.location} (${eventTime})`;
            if (seismicBanner) seismicBanner.className = "seismic-banner active-alert";
        }
    } catch (err) {
        console.warn("Seismic Telemetry Endpoint unreachable, using offline fallback display.");
        seismicTxt.innerHTML = currentLang === 'ne'
            ? "ΓÜá∩╕Å αñ¡αÑéαñòαñ«αÑìαñ¬ αñ▓αñ╛αñçαñ¡ αñ╕αñ░αÑìαñ¡αñ░ αñ╡αñ┐αñÜαÑìαñ¢αÑçαñª (αñàαñ½αñ▓αñ╛αñçαñ¿ αñ«αÑïαñí active)"
            : "ΓÜá∩╕Å Live Seismic Feed Disconnected (Offline mode active)";
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
    if (val === 'np' || val === 'ne' || val === 'αñ¿αÑçαñ¬αñ╛αñ▓αÑÇ' || val.includes('nepal')) {
        return 'np';
    }
    return 'en';
}

// 2. Dynamic Unknown Query Handler (Offline Fallback Only)
function getUnknownQueryResponse(lang) {
    if (lang === 'np') {
        return `[αñíαÑçαñƒαñ╛ αñëαñ¬αñ▓αñ¼αÑìαñº αñ¢αÑêαñ¿]
αñ╣αñ╛αñ«αÑìαñ░αÑï αñàαñ½αñ▓αñ╛αñçαñ¿ αñíαÑçαñƒαñ╛αñ¼αÑçαñ╕αñ«αñ╛ αñ»αÑï αñ¬αÑìαñ░αñ╢αÑìαñ¿αñòαÑï αñ▓αñ╛αñùαñ┐ αñòαÑüαñ¿αÑê αñ£αñ╛αñ¿αñòαñ╛αñ░αÑÇ αñëαñ¬αñ▓αñ¼αÑìαñº αñ¢αÑêαñ¿αÑñ

αñòαÑâαñ¬αñ»αñ╛ αñ»αÑÇ αñëαñ¬αñ▓αñ¼αÑìαñº αñ╡αñ┐αñ╖αñ»αñ╣αñ░αÑéαñ«αñ╛ αñûαÑïαñ£αÑÇ αñùαñ░αÑìαñ¿αÑüαñ╣αÑïαñ╕αÑì:
ΓÇó αñ¡αÑéαñòαñ«αÑìαñ¬ αñ╕αÑüαñ░αñòαÑìαñ╖αñ╛ (Earthquake)
ΓÇó αñ¬αÑìαñ░αñ╛αñÑαñ«αñ┐αñò αñëαñ¬αñÜαñ╛αñ░ (First Aid)
ΓÇó αñåαñ¬αññαÑìαñòαñ╛αñ▓αÑÇαñ¿ αñ¥αÑïαñ▓αñ╛ (Emergency Kit)
ΓÇó αñ╕αñ«αÑìαñ¬αñ░αÑìαñò αñ¿αñ«αÑìαñ¼αñ░ (Emergency Hotlines)

αññαññαÑìαñòαñ╛αñ▓ αñ╕αñ╣αñ»αÑïαñùαñòαñ╛ αñ▓αñ╛αñùαñ┐: αñ¬αÑìαñ░αñ╣αñ░αÑÇ αÑºαÑªαÑª αñ╡αñ╛ NDRRMA αÑºαÑ¼αÑ¼αÑ¼αÑ¼ αñ«αñ╛ αñ╕αñ«αÑìαñ¬αñ░αÑìαñò αñùαñ░αÑìαñ¿αÑüαñ╣αÑïαñ╕αÑìαÑñ`;
    } else {
        return `[NO DATA AVAILABLE]
We do not have specific safety guidance for this query in our offline database.

Please try asking about our supported emergency topics:
ΓÇó Earthquake Protocol (αñ¡αÑéαñòαñ«αÑìαñ¬)
ΓÇó First Aid Guidance (αñ¬αÑìαñ░αñ╛αñÑαñ«αñ┐αñò αñëαñ¬αñÜαñ╛αñ░)
ΓÇó Emergency Kit / Go-Bag (αñåαñ¬αññαÑìαñòαñ╛αñ▓αÑÇαñ¿ αñ¥αÑïαñ▓αñ╛)
ΓÇó Emergency Hotlines (αñ╕αñ«αÑìαñ¬αñ░αÑìαñò αñ¿αñ«αÑìαñ¼αñ░)

For immediate life safety: Call Police (100) or NDRRMA (16666).`;
    }
}

// 3. Knowledge Base for Specific Offline Intents
const LOCAL_KNOWLEDGE_BASE = {
    en: {
        first_aid: `[FIRST AID PROTOCOL]
ΓÇó Bleeding: Apply direct, firm pressure with a clean cloth.
ΓÇó Fractures: Immobilize the limb using a splint without trying to realign the bone.
ΓÇó Burns: Flush immediately with cool, running water for 10 minutes.
ΓÇó Unconsciousness: Place in recovery position and check breathing.`,

        earthquake: `[EARTHQUAKE SAFETY PROTOCOL]
ΓÇó INDOORS: DROP, COVER, and HOLD ON under structural beams or stable furniture. Stay clear of masonry brick walls, windows, and heavy overhead fixtures.
ΓÇó OUTDOORS: Move to an open area away from buildings, utility wires, and trees.
ΓÇó AFTER SHAKING: Expect aftershocks. Use stairs, never elevators. Check for gas leaks.`,

        contacts: `[EMERGENCY HOTLINES - NEPAL]
ΓÇó National Emergency Operations (NDRRMA): 16666
ΓÇó Nepal Police Control: 100
ΓÇó Armed Police Force Rescue: 1114
ΓÇó Red Cross Ambulance Central: 102
ΓÇó Fire Brigade: 101`,

        emergency_kit: `[EMERGENCY GO-BAG CHECKLIST]
ΓÇó Water: 3 liters/person for at least 3 days.
ΓÇó Food: Non-perishable, ready-to-eat items.
ΓÇó Medical: First-aid kit, essential prescription meds.
ΓÇó Tools: Flashlight, extra batteries, power bank, whistle, multi-tool knife.
ΓÇó Documents: Copies of citizenship, insurance, emergency cash in waterproof bag.`,

        fire_flood: `[FIRE & FLOOD SAFETY]
ΓÇó FIRE: Stay low to avoid smoke. Touch doors with the back of your hand before opening. If caught, Stop, Drop, and Roll.
ΓÇó FLOOD: Move immediately to higher ground. Never walk or drive through moving floodwaters (15 cm of moving water can knock you down).`
    },

    np: {
        first_aid: `[αñ¬αÑìαñ░αñ╛αñÑαñ«αñ┐αñò αñëαñ¬αñÜαñ╛αñ░ αñ¬αÑìαñ░αñúαñ╛αñ▓αÑÇ]
ΓÇó αñ░αñùαññ αñ¼αñùαÑìαñ¿αÑç: αñ╕αñ½αñ╛ αñòαñ¬αñíαñ╛αñ▓αÑç αñ╕αñ┐αñºαÑê αñ¼αñ▓αñ┐αñ»αÑï αñÑαñ┐αñÜαÑìαñ¿αÑüαñ╣αÑïαñ╕αÑìαÑñ
ΓÇó αñ╣αñ╛αñí αñ¡αñ╛αñüαñÜαñ┐αñÅαñòαÑï: αñ╣αñíαÑìαñíαÑÇ αñ╕αñÜαÑìαñ»αñ╛αñëαñ¿ αñ¿αñûαÑïαñ£αÑÇ αñ╕αÑìαñ¬αÑìαñ▓αñ┐αñ¿αÑìαñƒ αñ¬αÑìαñ░αñ»αÑïαñù αñùαñ░αÑçαñ░ αñàαñÖαÑìαñù αñ╕αÑìαñÑαñ┐αñ░ αñ░αñ╛αñûαÑìαñ¿αÑüαñ╣αÑïαñ╕αÑìαÑñ
ΓÇó αñ¬αÑïαñ▓αÑçαñòαÑï: αññαÑüαñ░αÑüαñ¿αÑìαññαÑê αÑºαÑª αñ«αñ┐αñ¿αÑçαñƒαñ╕αñ«αÑìαñ« αñÜαñ┐αñ╕αÑï, αñ¼αñùαñ┐αñ░αñ╣αÑçαñòαÑï αñ¬αñ╛αñ¿αÑÇαñ▓αÑç αñ¬αñûαñ╛αñ▓αÑìαñ¿αÑüαñ╣αÑïαñ╕αÑìαÑñ
ΓÇó αñ¼αÑçαñ╣αÑïαñ╕: αñ╕αÑüαñ░αñòαÑìαñ╖αñ╛αññαÑìαñ«αñò αñ╕αÑìαñÑαñ┐αññαñ┐ (Recovery Position) αñ«αñ╛ αñ░αñ╛αñûαÑìαñ¿αÑüαñ╣αÑïαñ╕αÑì αñ░ αñ╕αñ╛αñ╕ αñ½αÑçαñ░αÑçαñòαÑï αñ£αñ╛αñüαñÜ αñùαñ░αÑìαñ¿αÑüαñ╣αÑïαñ╕αÑìαÑñ`,

        earthquake: `[αñ¡αÑéαñòαñ«αÑìαñ¬ αñ╕αÑüαñ░αñòαÑìαñ╖αñ╛ αñ¬αÑìαñ░αñúαñ╛αñ▓αÑÇ]
ΓÇó αñÿαñ░αñ¡αñ┐αññαÑìαñ░: αñ¼αñ▓αñ┐αñ»αÑï αñƒαÑçαñ¼αñ▓αñ«αÑüαñ¿αñ┐ αñ¥αÑüαñòαÑìαñ¿αÑüαñ╣αÑïαñ╕αÑì (DROP), αñôαññ αñ▓αñ╛αñùαÑìαñ¿αÑüαñ╣αÑïαñ╕αÑì (COVER), αñ░ αñ╕αñ«αñ╛αññαÑìαñ¿αÑüαñ╣αÑïαñ╕αÑì (HOLD ON)αÑñ αñ¥αÑìαñ»αñ╛αñ▓ αñ░ αñùαñ╣αÑìαñ░αÑîαñü αñ½αñ░αÑìαñ¿αñ┐αñÜαñ░αñ¼αñ╛αñƒ αñƒαñ╛αñóαñ╛ αñ░αñ╣αñ¿αÑüαñ╣αÑïαñ╕αÑìαÑñ
ΓÇó αñ¼αñ╛αñ╣αñ┐αñ░: αñ¡αñ╡αñ¿, αñ¼αñ┐αñ£αÑüαñ▓αÑÇαñòαÑï αñ¬αÑïαñ▓ αñ░ αñ░αÑüαñûαñ╣αñ░αÑéαñ¼αñ╛αñƒ αñƒαñ╛αñóαñ╛ αñûαÑüαñ▓αñ╛ αñáαñ╛αñëαñüαñ«αñ╛ αñ£αñ╛αñ¿αÑüαñ╣αÑïαñ╕αÑìαÑñ
ΓÇó αñòαñ«αÑìαñ¬αñ¿ αñ░αÑïαñòαñ┐αñÅαñ¬αñ¢αñ┐: αñ¬αñ░αñ╛αñòαñ«αÑìαñ¬αñ¿αñòαÑï αñ▓αñ╛αñùαñ┐ αññαñ»αñ╛αñ░ αñ░αñ╣αñ¿αÑüαñ╣αÑïαñ╕αÑìαÑñ αñ▓αñ┐αñ½αÑìαñƒ αñ¬αÑìαñ░αñ»αÑïαñù αñ¿αñùαñ░αÑìαñ¿αÑüαñ╣αÑïαñ╕αÑìαÑñ`,

        contacts: `[αñåαñòαñ╕αÑìαñ«αñ┐αñò αñ╣αñƒαñ▓αñ╛αñçαñ¿αñ╣αñ░αÑé - αñ¿αÑçαñ¬αñ╛αñ▓]
ΓÇó αñ░αñ╛αñ╖αÑìαñƒαÑìαñ░αñ┐αñ» αñåαñ¬αññαÑìαñòαñ╛αñ▓αÑÇαñ¿ αñòαñ╛αñ░αÑìαñ» αñ╕αñ₧αÑìαñÜαñ╛αñ▓αñ¿ αñòαÑçαñ¿αÑìαñªαÑìαñ░ (NDRRMA): αÑºαÑ¼αÑ¼αÑ¼αÑ¼
ΓÇó αñ¿αÑçαñ¬αñ╛αñ▓ αñ¬αÑìαñ░αñ╣αñ░αÑÇ αñ¿αñ┐αñ»αñ¿αÑìαññαÑìαñ░αñú: αÑºαÑªαÑª
ΓÇó αñ╕αñ╢αñ╕αÑìαññαÑìαñ░ αñ¬αÑìαñ░αñ╣αñ░αÑÇ αñ¼αñ▓ αñëαñªαÑìαñºαñ╛αñ░: αÑºαÑºαÑºαÑ¬
ΓÇó αñ░αÑçαñíαñòαÑìαñ░αñ╕ αñÅαñ«αÑìαñ¼αÑüαñ▓αÑçαñ¿αÑìαñ╕ αñ╕αÑçαñ¿αÑìαñƒαñ░: αÑºαÑªαÑ¿
ΓÇó αñªαñ«αñòαñ▓ (Fire): αÑºαÑªαÑº`,

        emergency_kit: `[αñåαñ¬αññαÑìαñòαñ╛αñ▓αÑÇαñ¿ αñ¥αÑïαñ▓αñ╛ (Go-Bag) αñ╕αñ╛αñ«αñùαÑìαñ░αÑÇ]
ΓÇó αñ¬αñ╛αñ¿αÑÇ: αñ¬αÑìαñ░αññαñ┐αñ╡αÑìαñ»αñòαÑìαññαñ┐ αñªαÑêαñ¿αñ┐αñò αÑ⌐ αñ▓αñ┐αñƒαñ░ (αñòαñ«αñ╕αÑçαñòαñ« αÑ⌐ αñªαñ┐αñ¿αñòαÑï αñ▓αñ╛αñùαñ┐)αÑñ
ΓÇó αñûαñ╛αñ¿αñ╛: αñ¼αñ┐αñùαÑìαñ░αñ┐αñ¿αÑç αñ¿αñ╣αÑüαñ¿αÑç αñ░ αñ¬αñòαñ╛αñëαñ¿αÑü αñ¿αñ¬αñ░αÑìαñ¿αÑç αñûαñ╛αñ¿αÑçαñòαÑüαñ░αñ╛αÑñ
ΓÇó αñöαñ╖αñºαñ┐: αñ¬αÑìαñ░αñ╛αñÑαñ«αñ┐αñò αñëαñ¬αñÜαñ╛αñ░ αñòαñ┐αñƒ αñ░ αñåαñ╡αñ╢αÑìαñ»αñò αñ¿αñ┐αñ»αñ«αñ┐αññ αñöαñ╖αñºαñ┐αÑñ
ΓÇó αñöαñ£αñ╛αñ░: αñƒαñ░αÑìαñÜαñ▓αñ╛αñçαñƒ, αñ¬αñ╛αñ╡αñ░ αñ¼αÑêαñéαñò, αñ╕αñ┐αñƒαÑìαñƒαÑÇ (Whistle), αñÜαñòαÑìαñòαÑüαÑñ
ΓÇó αñòαñ╛αñùαñ£αñ╛αññ: αñ¿αñ╛αñùαñ░αñ┐αñòαññαñ╛αñòαÑï αñ¬αÑìαñ░αññαñ┐αñ▓αñ┐αñ¬αñ┐, αñ¿αñùαñª αñ░αÑéαñ¬αÑêαñ»αñ╛αñüαÑñ`,

        fire_flood: `[αñåαñùαÑï αñ░ αñ¼αñ╛αñóαÑÇ αñ╕αÑüαñ░αñòαÑìαñ╖αñ╛]
ΓÇó αñåαñùαñ▓αñ╛αñùαÑÇ: αñºαÑüαñ╡αñ╛αñüαñ¼αñ╛αñƒ αñ¼αñÜαÑìαñ¿ αñ¿αñ┐αñ╣αÑüαñ░αñ┐αñÅαñ░ αñ╣αñ┐αñüαñíαÑìαñ¿αÑüαñ╣αÑïαñ╕αÑìαÑñ αñòαñ¬αñíαñ╛αñ«αñ╛ αñåαñùαÑï αñ▓αñ╛αñùαÑçαñ«αñ╛ - αñ░αÑïαñòαñ┐αñ¿αÑüαñ╣αÑïαñ╕αÑì, αñ¡αÑüαñçαñüαñ«αñ╛ αñ╕αÑïαñ▓αÑìαñƒαñ┐αñ¿αÑüαñ╣αÑïαñ╕αÑì (Stop, Drop, Roll)αÑñ
ΓÇó αñ¼αñ╛αñóαÑÇ: αññαÑüαñ░αÑüαñ¿αÑìαññαÑê αñàαñùαÑìαñ▓αÑï αñáαñ╛αñëαñüαñ«αñ╛ αñ£αñ╛αñ¿αÑüαñ╣αÑïαñ╕αÑìαÑñ αñ¼αñùαñ┐αñ░αñ╣αÑçαñòαÑï αñ¼αñ╛αñóαÑÇαñòαÑï αñ¬αñ╛αñ¿αÑÇαñ«αñ╛ αñòαñ╣αñ┐αñ▓αÑìαñ»αÑê αñ¿αñ╣αñ┐αñüαñíαÑìαñ¿αÑüαñ╣αÑïαñ╕αÑìαÑñ`
    }
};

// 4. Keyword Rules
const INTENT_RULES = [
    {
        intent: 'first_aid',
        keywords: ['first aid', 'aid', 'bleed', 'bleeding', 'burn', 'fracture', 'cut', 'prathamik', 'upachar', 'ragat', 'poleko', 'haad', 'αñ¬αÑìαñ░αñ╛αñÑαñ«αñ┐αñò', 'αñëαñ¬αñÜαñ╛αñ░', 'αñ░αñùαññ', 'αñ¬αÑïαñ▓αÑçαñòαÑï', 'αñ╣αñ╛αñí', 'αñÿαñ╛αñë']
    },
    {
        intent: 'earthquake',
        keywords: ['earthquake', 'quake', 'tremor', 'seismic', 'bhuinkampa', 'bhukampa', 'kampan', 'shake', 'bhu', 'αñ¡αÑéαñòαñ«αÑìαñ¬', 'αñòαñ«αÑìαñ¬αñ¿', 'αñ¿αñ┐αñ░αÑìαñªαÑçαñ╢αñ┐αñòαñ╛']
    },
    {
        intent: 'contacts',
        keywords: ['contact', 'number', 'phone', 'call', 'hotline', 'police', 'ambulance', 'ndrrma', 'nambar', 'samparka', 'prahari', 'αñ╕αñ«αÑìαñ¬αñ░αÑìαñò', 'αñ¿αñ«αÑìαñ¼αñ░', 'αñ╣αñƒαñ▓αñ╛αñçαñ¿', 'αñ¬αÑìαñ░αñ╣αñ░αÑÇ', 'αñÅαñ«αÑìαñ¼αÑüαñ▓αÑçαñ¿αÑìαñ╕']
    },
    {
        intent: 'emergency_kit',
        keywords: ['kit', 'bag', 'go bag', 'supplies', 'pack', 'jhola', 'samagri', 'αñåαñ¬αññαÑìαñòαñ╛αñ▓αÑÇαñ¿', 'αñ¥αÑïαñ▓αñ╛', 'αñ╕αñ╛αñ«αñùαÑìαñ░αÑÇ']
    },
    {
        intent: 'fire_flood',
        keywords: ['fire', 'flood', 'burns', 'aago', 'aagolagi', 'baadhi', 'badhi', 'damkal', 'αñåαñùαÑï', 'αñåαñùαñ▓αñ╛αñùαÑÇ', 'αñ¼αñ╛αñóαÑÇ', 'αñªαñ«αñòαñ▓']
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
            console.warn("ΓÜá∩╕Å Live API call failed. Falling back to offline local engine...", err);
        }
    }

    // Step D: Offline Fallback Engine (Used when offline or network fails)
    removeLoadingBubble(loadingId);

    // Handle Greetings in Offline Mode
    const greetings = ['hello', 'hi', 'namaste', 'namaskar', 'αñ¿αñ«αñ╕αÑìαññαÑç', 'αñ¿αñ«αñ╕αÑìαñòαñ╛αñ░', 'hey'];
    if (greetings.includes(rawQuery.toLowerCase())) {
        const greetingMsg = currentLang === 'np' 
            ? "αñ¿αñ«αñ╕αÑìαññαÑç! αñ« QSAFE αñ¿αÑçαñ¬αñ╛αñ▓ αñàαñ½αñ▓αñ╛αñçαñ¿ αñåαñ¬αññαÑìαñòαñ╛αñ▓αÑÇαñ¿ αñ╕αñ╣αñ╛αñ»αñò αñ╣αÑüαñüαÑñ αñ« αññαñ¬αñ╛αñêαñéαñ▓αñ╛αñê αñ¡αÑéαñòαñ«αÑìαñ¬ αñ╕αÑüαñ░αñòαÑìαñ╖αñ╛, αñ¬αÑìαñ░αñ╛αñÑαñ«αñ┐αñò αñëαñ¬αñÜαñ╛αñ░ αñ╡αñ╛ αñåαñ¬αññαÑìαñòαñ╛αñ▓αÑÇαñ¿ αñ¥αÑïαñ▓αñ╛ αñ╕αñ«αÑìαñ¼αñ¿αÑìαñºαÑÇ αñ£αñ╛αñ¿αñòαñ╛αñ░αÑÇ αñªαñ┐αñ¿ αñ╕αñòαÑìαñ¢αÑüαÑñ"
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
            queryLower.includes('αñ«αñªαÑìαñªαññ') || queryLower.includes('αñ¿αñ«αñ╕αÑìαññαÑç') || 
            queryLower.includes('αñ¿αñ«αñ╕αÑìαñòαñ╛αñ░')
        ) {
            safetyMessage = currentLang === 'en'
                ? "Namaste! I am QSAFE Nepal, your offline earthquake safety assistant. Ask me about emergency protocols, first aid, or supply kits."
                : "αñ¿αñ«αñ╕αÑìαññαÑç! αñ« QSAFE αñ¿αÑçαñ¬αñ╛αñ▓ αñàαñ½αñ▓αñ╛αñçαñ¿ αñ¡αÑéαñòαñ«αÑìαñ¬ αñ╕αÑüαñ░αñòαÑìαñ╖αñ╛ αñ╕αñ╣αñ╛αñ»αñò αñ╣αÑüαñüαÑñ αññαñ¬αñ╛αñêαñé αñ«αñ▓αñ╛αñê αñ¡αÑéαñòαñ«αÑìαñ¬ αñ╕αÑüαñ░αñòαÑìαñ╖αñ╛ αñ¿αñ┐αñ░αÑìαñªαÑçαñ╢αñ┐αñòαñ╛, αñ¬αÑìαñ░αñ╛αñÑαñ«αñ┐αñò αñëαñ¬αñÜαñ╛αñ░ αñ╡αñ╛ αñåαñ¬αññαñòαñ╛αñ▓αÑÇαñ¿ αñ¥αÑïαñ▓αñ╛αñòαñ╛ αñ¼αñ╛αñ░αÑçαñ«αñ╛ αñ╕αÑïαñºαÑìαñ¿ αñ╕αñòαÑìαñ¿αÑüαñ╣αÑüαñ¿αÑìαñ¢αÑñ";
            matchedIntent = currentLang === 'en' ? "Greeting / System Info" : "αñ¿αñ«αñ╕αÑìαññαÑç / αñ¬αÑìαñ░αñúαñ╛αñ▓αÑÇ αñ£αñ╛αñ¿αñòαñ╛αñ░αÑÇ";
        } 
        else if (
            queryLower.includes('earthquake') || queryLower.includes('bhuikampa') || 
            queryLower.includes('bhukamp') || queryLower.includes('bhuikamp') || 
            queryLower.includes('shake') || queryLower.includes('tremor') || 
            queryLower.includes('quak') || queryLower.includes('αñ¡αÑüαñçαñüαñÜαñ╛αñ▓αÑï') || 
            queryLower.includes('αñ¡αÑéαñòαñ«αÑìαñ¬') || queryLower.includes('k garne')
        ) {
            safetyMessage = data.static_checklists.earthquake[currentLang];
            matchedIntent = currentLang === 'en' ? "Earthquake Action Protocol" : "αñ¡αÑéαñòαñ«αÑìαñ¬ αñ╕αÑüαñ░αñòαÑìαñ╖αñ╛ αñ¿αñ┐αñ░αÑìαñªαÑçαñ╢αñ┐αñòαñ╛";
            themeClass = "earthquake-alert";
        } 
        else if (
            queryLower.includes('first aid') || queryLower.includes('injur') || 
            queryLower.includes('upachar') || queryLower.includes('αñëαñ¬αñÜαñ╛αñ░') || 
            queryLower.includes('αñÜαÑïαñƒ')
        ) {
            safetyMessage = data.static_checklists.first_aid[currentLang];
            matchedIntent = currentLang === 'en' ? "Earthquake First-Aid Protocol" : "αñ¡αÑéαñòαñ«αÑìαñ¬ αñ¬αÑìαñ░αñ╛αñÑαñ«αñ┐αñò αñëαñ¬αñÜαñ╛αñ░";
        } 
        else if (
            queryLower.includes('kit') || queryLower.includes('bag') || 
            queryLower.includes('prepar') || queryLower.includes('jhola') || 
            queryLower.includes('αñ¥αÑïαñ▓αñ╛')
        ) {
            safetyMessage = data.static_checklists.kit[currentLang];
            matchedIntent = currentLang === 'en' ? "Earthquake Emergency Kit" : "αñ¡αÑéαñòαñ«αÑìαñ¬ αñåαñ¬αññαñòαñ╛αñ▓αÑÇαñ¿ αñ¥αÑïαñ▓αñ╛";
        }
        else {
            safetyMessage = data.static_checklists.failsafe[currentLang];
            matchedIntent = currentLang === 'en' ? "Offline Earthquake Fail-Safe" : "αñàαñ½αñ▓αñ╛αñçαñ¿ αñ¡αÑéαñòαñ«αÑìαñ¬ αñ╕αÑüαñ░αñòαÑìαñ╖αñ╛ αñ¿αñ┐αñ░αÑìαñªαÑçαñ╢αñ┐αñòαñ╛";
        }

        const hotlineLabel = currentLang === 'en' ? "Emergency Hotlines" : "αñåαñ¬αññαñòαñ╛αñ▓αÑÇαñ¿ αñ╣αñƒαñ▓αñ╛αñçαñ¿ αñ¿αñ«αÑìαñ¼αñ░αñ╣αñ░αÑé";
        let output = `[CRITICAL OFF-GRID SAFETY HIGHLIGHT - ${matchedIntent.toUpperCase()}]\n${safetyMessage}\n\n${hotlineLabel}:\n`;
        
        if (data.hotlines && data.hotlines[currentLang]) {
            data.hotlines[currentLang].forEach(item => {
                const cleanPhone = item.phone.replace(/\s+/g, '');
                output += `ΓÇó ${item.name}: <a href="tel:${cleanPhone}" class="hotline-link">${item.phone}</a>\n`;
            });
        }
        
        appendMessageToUI(output, "sys", `Local Storage Fallback (${currentLang.toUpperCase()})`, themeClass);

    } catch (err) {
        console.error("Local file extraction error:", err);
        const errMsg = currentLang === 'ne' 
            ? "αñùαñ«αÑìαñ¡αÑÇαñ░ αññαÑìαñ░αÑüαñƒαñ┐: αñ╕αÑìαñÑαñ╛αñ¿αÑÇαñ» αñ¡αñúαÑìαñíαñ╛αñ░αñú αñ¬αñ╣αÑüαñüαñÜαñ»αÑïαñùαÑìαñ» αñ¢αÑêαñ¿αÑñ" 
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
            targetQuery = currentLang === 'ne' ? 'αñ¡αÑéαñòαñ«αÑìαñ¬' : 'earthquake protocol';
        } else if (chip.id === 'chip-fa') {
            targetQuery = currentLang === 'ne' ? 'αñ¬αÑìαñ░αñ╛αñÑαñ«αñ┐αñò αñëαñ¬αñÜαñ╛αñ░' : 'first aid';
        } else if (chip.id === 'chip-kit') {
            targetQuery = currentLang === 'ne' ? 'αñåαñ¬αññαñòαñ╛αñ▓αÑÇαñ¿ αñ¥αÑïαñ▓αñ╛' : 'emergency kit';
        }

        if (targetQuery && queryIn) {
            queryIn.value = targetQuery;
            handleUserIntent();
        }
    });
});
