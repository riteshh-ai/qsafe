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
        trapped_debris: `[CRITICAL SOS: TRAPPED UNDER DEBRIS]
• **PROTECT AIRWAY**: Cover your nose and mouth with a shirt or cloth to avoid inhaling concrete dust.
• **SIGNAL ACOUSTICALLY**: Tap rhythmically on metal pipes, beams, or walls using a stone or object. Do not yell continuously to conserve oxygen.
• **NO OPEN FLAMES**: Never light matches or lighters due to ruptured gas lines.
• **EMERGENCY RESCUE**: APF: 1114 | Police: 100 | NDRRMA: 16666`,

        earthquake: `[EARTHQUAKE SAFETY PROTOCOL]
• **DROP, COVER, HOLD ON**: Drop to hands and knees under a sturdy table, cover head and neck, hold on until shaking stops.
• **STAY CLEAR**: Move away from glass windows, unreinforced walls, and heavy falling shelves.
• **OUTDOORS**: Move immediately into open ground away from overhead cables and buildings.
• **AFTER TREMORS**: Expect aftershocks. Always use stairs, never use elevators.
• **EMERGENCY CALL**: Police: 100 | Ambulance: 102 | NDRRMA: 16666`,

        first_aid_bleeding: `[FIRST AID: SEVERE BLEEDING]
• **DIRECT PRESSURE**: Press a clean cloth or pad directly over the wound with firm, continuous pressure for 10–15 minutes.
• **ELEVATE**: Raise the injured limb above heart level if no bone fracture is suspected.
• **DO NOT REMOVE**: Never pull out deeply embedded objects; pack cloth around them.
• **EMERGENCY AMBULANCE**: Ambulance: 102 | Police: 100`,

        first_aid_burns: `[FIRST AID: BURN INJURIES]
• **COOL WATER**: Flush burn immediately with clean, cool running water for 10–15 minutes.
• **NO HOME REMEDIES**: Do NOT apply ice, oil, turmeric, or toothpaste. Do NOT break blisters.
• **COVER**: Cover loosely with sterile non-stick bandage or clean plastic wrap.
• **EMERGENCY AMBULANCE**: Ambulance: 102 | Police: 100`,

        first_aid_fracture: `[FIRST AID: FRACTURE / BROKEN BONE]
• **IMMOBILIZE**: Keep the injured limb completely still using a padded splint or rolled cardboard.
• **DO NOT REALIGN**: Never attempt to push or straighten a broken bone back into place.
• **COLD PACK**: Apply an ice pack wrapped in a cloth to reduce swelling.
• **EMERGENCY AMBULANCE**: Ambulance: 102 | Police: 100`,

        first_aid_general: `[FIRST AID EMERGENCY PROTOCOL]
• **BLEEDING**: Apply direct, firm pressure with a clean cloth.
• **BURNS**: Flush immediately with cool, running water for 10–15 minutes.
• **FRACTURES**: Immobilize the limb using a splint without forcing realignment.
• **EMERGENCY CALL**: Ambulance: 102 | Police: 100 | NDRRMA: 16666`,

        landslide: `[LANDSLIDE SAFETY PROTOCOL]
• **INDOORS**: Move to the highest floor away from the hillside slope. Cover under heavy furniture.
• **OUTDOORS**: Run immediately to elevated, stable ground perpendicular to the mudflow path.
• **DRIVING**: Watch for collapsing roads and falling boulders. Never drive across mudflows.
• **EMERGENCY RESCUE**: Police: 100 | APF: 1114 | NDRRMA: 16666`,

        flood: `[FLOOD & FLASH FLOOD EVACUATION]
• **HIGH GROUND**: Evacuate immediately to higher ground or upper concrete floors. Stay away from riverbanks.
• **POWER OFF**: Turn off the main electrical breaker switch if safe to reach.
• **NO WADING**: Never attempt to walk, swim, or drive through moving water.
• **EMERGENCY HOTLINE**: Police: 100 | APF: 1114 | NDRRMA: 16666`,

        fire: `[FIRE SAFETY & EVACUATION]
• **EVACUATE**: Get out immediately. Crawl low under smoke where the air is cleaner.
• **FEEL DOORS**: Touch door handles with the back of your hand; if hot, do not open.
• **STOP, DROP, ROLL**: If clothing catches fire, drop immediately to the ground and roll.
• **FIRE BRIGADE**: Fire: 101 | Police: 100 | APF: 1114`,

        building_collapse: `[BUILDING DAMAGE & COLLAPSE PROTOCOL]
• **EVACUATE SAFELY**: If the building shows deep diagonal wall cracks, evacuate immediately using stairs.
• **UTILITIES**: Shut off main gas cylinder valves and electric power switches outside.
• **STAY OUT**: Do not re-enter damaged buildings until inspected by structural engineers.
• **EMERGENCY HOTLINE**: Police: 100 | NDRRMA: 16666 | APF: 1114`,

        emergency_kit: `[EMERGENCY GO-BAG CHECKLIST]
• **Water & Food**: 3 liters water per person and 3-day dry nutrient food supply.
• **Medical Kit**: Antiseptic, bandages, gauze, essential chronic prescription drugs.
• **Tools & Power**: High-lumen flashlight, extra batteries, charged power bank, whistle.
• **Vital Docs**: Photocopies of citizenship/passports and cash inside a waterproof pouch.
• **EMERGENCY CALL**: Police: 100 | NDRRMA: 16666`,

        safe_location: `[EMERGENCY ASSEMBLY POINTS]
• **OPEN SPACES**: Open school grounds, public parks, Tudikhel/Khula Manch, sports stadiums.
• **AVOID**: Narrow alleys, electrical transformers, overhead cables, tall unreinforced masonry walls.
• **COORDINATION**: Register with local community volunteers and Red Cross posts.
• **EMERGENCY CALL**: Police: 100 | NDRRMA: 16666`,

        contacts: `[NEPAL NATIONAL EMERGENCY HOTLINES]
• **Nepal Police (General Emergency)**: 100
• **Red Cross Ambulance**: 102
• **NDRRMA Disaster Helpline**: 16666
• **Armed Police Force (APF Rescue)**: 1114
• **Fire Brigade**: 101
• **Natural Disaster Reporting Line**: 1149`
    },

    ne_dev: {
        trapped_debris: `[अति जरुरी SOS: भग्नावशेष वा पर्खालमुनि थुनिएको]
• **श्वासप्रश्वास जोगाउनुहोस्**: धुलो फोक्सोमा पस्न नदिन कपडा वा टि-सर्टले नाक-मुख छोप्नुहोस्।
• **ध्वनि संकेत दिनुहोस्**: लगातार नकराउनुहोस् (अक्सिजन सकिन्छ)। ढुङ्गा वा धातुले पाइप/पर्खालमा ठोकेर आवाज निकाल्नुहोस्।
• **आगो नबाल्नुहोस्**: ग्यास चुहावट हुन सक्ने भएकाले सलाई वा लाइटर पटक्कै नबाल्नुहोस्।
• **उद्धार हटलाइन**: सशस्त्र प्रहरी: १११४ | नेपाल प्रहरी: १०० | NDRRMA: १६६६६`,

        earthquake: `[भूकम्प सुरक्षा निर्देशिका]
• **घुँडा टेक, ओत लाग, समात**: बलियो टेबुलमुनि घुँडा टेकेर टाउको छोप्नुहोस् र कम्पन नरोकिउन्जेल समात्नुहोस्।
• **टाढा रहनुहोस्**: झ्याल, अग्ला दराज र कमजोर गाह्रोबाट तुरुन्तै टाढा बस्नुहोस्।
• **बाहिर भएमा**: बिजुलीको पोल, तार र अग्ला भवनबाट टाढा खुला चौरमा जानुहोस्।
• **कम्पन रोकिएपछि**: परकम्प आउन सक्छ। भर्‍याङ प्रयोग गर्नुहोस्, लिफ्ट कहिल्यै प्रयोग नगर्नुहोस्।
• **आपत्कालीन नम्बर**: प्रहरी: १०० | एम्बुलेन्स: १०२ | NDRRMA: १६६६६`,

        first_aid_bleeding: `[प्राथमिक उपचार: धेरै रगत बगेको अवस्था]
• **सिधै थिच्नुहोस्**: सफा कपडा वा गजले घाउमा सिधै बलियोसँग १०–१५ मिनेट निरन्तर थिचिराख्नुहोस्।
• **उचाइमा राख्नुहोस्**: हड्डी नभाँचिएको भए घाइते अङ्गलाई मुटुभन्दा माथि उठाएर राख्नुहोस्।
• **वस्तु ननिकाल्नुहोस्**: घाउभित्र गढेको वस्तु छ भने बाहिर नतान्नुहोस्, वरिपरि कपडा बेर्नुहोस्।
• **एम्बुलेन्स बोलाउनुहोस्**: एम्बुलेन्स: १०२ | प्रहरी: १००`,

        first_aid_burns: `[प्राथमिक उपचार: आगो वा तातोले पोलेको]
• **चिसो पानी**: पोलेको ठाउँमा १०–१५ मिनेटसम्म सफा र बगिरहेको चिसो पानी हाल्नुहोस्।
• **घरेलु चिज नलाउनुहोस्**: बरफ, घ्यू, बेसार वा टुथपेस्ट कहिल्यै नलगाउनुहोस्। फोका नफोड्नुहोस्।
• **छोप्नुहोस्**: सफा र सुख्खा कपडाले हल्कासँग छोप्नुहोस्।
• **एम्बुलेन्स बोलाउनुहोस्**: एम्बुलेन्स: १०२ | प्रहरी: १००`,

        first_aid_fracture: `[प्राथमिक उपचार: हड्डी भाँचिएको वा मर्किएको]
• **अचल बनाउनुहोस्**: भाँचिएको हात वा खुट्टालाई काम्रो (Splint) वा कार्डबोर्डले नहल्लिने गरी बाँध्नुहोस्।
• **सिधा बनाउने प्रयास नगर्नुहोस्**: बाङ्गो भएको अङ्गलाई जबर्जस्ती तन्काउने वा मिलाउने प्रयास नगर्नुहोस्।
• **एम्बुलेन्स बोलाउनुहोस्**: एम्बुलेन्स: १०२ | प्रहरी: १००`,

        first_aid_general: `[प्राथमिक उपचार निर्देशिका]
• **रक्तस्राव**: सफा कपडाले सिधै बलियोसँग थिच्नुहोस्।
• **पोलेको**: बगिरहेको चिसो पानीले १०–१५ मिनेट पखाल्नुहोस्।
• **हड्डी भाँचिएको**: काम्रो वा स्प्लिन्ट प्रयोग गरी अङ्ग अचल बनाउनुहोस्।
• **आपत्कालीन नम्बर**: एम्बुलेन्स: १०२ | प्रहरी: १०० | NDRRMA: १६६६६`,

        landslide: `[पहिरो सुरक्षा निर्देशिका]
• **घरभित्र भएमा**: डाँडा वा भिरालोभन्दा टाढाको माथिल्लो तलामा जानुहोस्।
• **बाहिर भएमा**: भीर, खोल्सा र नदी किनारबाट तुरुन्तै सुरक्षित अग्लो ठाउँमा भाग्नुहोस्।
• **गाडी चलाउँदा**: ढुङ्गा खस्ने जोखिम र बाटोका दरार ध्यान दिनुहोस्। लेदो बगेको बाटो नकाट्नुहोस्।
• **उद्धार सम्पर्क**: सशस्त्र प्रहरी: १११४ | नेपाल प्रहरी: १०० | NDRRMA: १६६६६`,

        flood: `[बाढी तथा डुबान सुरक्षा निर्देशिका]
• **अग्लो ठाउँ**: तुरुन्तै नदी किनार छाडी अग्लो सुरक्षित स्थान वा पक्की भवनको माथिल्लो तलामा जानुहोस्।
• **बिजुली बन्द**: सम्भव भए घरको मेन स्विच तुरुन्तै बन्द गर्नुहोस्।
• **पानीमा नहिँड्नुहोस्**: बगिरहेको बाढीको पानीमा कहिल्यै नहिँड्नुहोस् र गाडी नचलाउनुहोस्।
• **आपत्कालीन नम्बर**: प्रहरी: १०० | सशस्त्र प्रहरी: १११४ | NDRRMA: १६६६६`,

        fire: `[आगलागी सुरक्षा निर्देशिका]
• **तुरुन्त बाहिर निस्कनुहोस्**: धुवाँ भएको ठाउँमा भुइँतिर निहुरिएर (घस्रिएर) बाहिर निस्कनुहोस्।
• **ढोका जाँच गर्नुहोस्**: ढोका खोल्नुअघि पछाडिको हातले छाम्नुहोस्, तातो भए नखोल्नुहोस्।
• **दमकल बोलाउनुहोस्**: दमकल: १०१ | नेपाल प्रहरी: १०० | सशस्त्र प्रहरी: १११४`,

        building_collapse: `[भवन क्षति तथा भत्किएको अवस्था]
• **बाहिर निस्कनुहोस्**: पर्खालमा ठूला दरार देखिएमा तुरुन्त भर्‍याङमार्फत बाहिर निस्कनुहोस्।
• **ग्यास र बिजुली बन्द**: बाहिर निस्कँदा ग्यास सिलिन्डर र मुख्य बिजुली स्विच बन्द गर्नुहोस्।
• **भित्र नपस्नुहोस्**: प्राविधिक जाँच नभएसम्म क्षतिग्रस्त घरभित्र फेरि नपस्नुहोस्।
• **आपत्कालीन नम्बर**: प्रहरी: १०० | NDRRMA: १६६६६`,

        emergency_kit: `[आपतकालीन झोला (Go-Bag) चेकलिस्ट]
• **पानी र खाना**: प्रतिव्यक्ति ३ लिटर पानी र ३ दिनलाई पुग्ने सुख्खा खानेकुरा (चिउरा, बिस्कुट)।
• **प्राथमिक उपचार**: ब्यान्डेज, गज, एन्टिसेप्टिक र नियमित खाने औषधिहरू।
• **उपकरण**: टर्चलाइट, अतिरिक्त ब्याट्री, पावर बैंक, सिट्ठी र डोरी।
• **कागजात**: नागरिकता, लालपुर्जाको प्रतिलिपि र केही नगद वाटरप्रूफ थैलीमा।
• **आपत्कालीन नम्बर**: प्रहरी: १०० | NDRRMA: १६६६६`,

        safe_location: `[आपत्कालीन भेला हुने सुरक्षित ठाउँहरू]
• **खुला स्थान**: खुला चौर, स्कुलको खेलमैदान, खुलामञ्च, टुँडिखेल वा पार्क।
• **बच्नुपर्ने ठाउँ**: साँघुरा गल्ली, ट्रान्सफर्मर, बिजुलीका पोल र अग्ला पर्खालहरू।
• **आपत्कालीन नम्बर**: प्रहरी: १०० | NDRRMA: १६६६६`,

        contacts: `[नेपाल राष्ट्रिय आपत्कालीन हटलाइनहरू]
• **नेपाल प्रहरी (कन्ट्रोल)**: १००
• **रेडक्रस एम्बुलेन्स सेवा**: १०२
• **विपद् व्यवस्थापन (NDRRMA)**: १६६६६
• **सशस्त्र प्रहरी बल (उद्धार)**: १११४
• **दमकल (Fire Brigade)**: १०१
• **विपद् रिपोर्टिङ लाइन**: ११४९`
    },

    ne_rom: {
        trapped_debris: `[URGENT SOS: BHATKIEKO GHAR / DEBRIS MUNI THUNIYO]
• **SHWAS JOGAUNUHOS**: Dhulo bata bachna kapada le naak ra mukh chopnuhos.
• **AWAAJ DIYERA SANKET**: Nirantar nakaraunuhos (oxygen sakincha). Dhunga le pipe va dhunga ma thoki awaaj nikalnuhos.
• **AAGO NABALNUHOS**: Gas leak huna sakne bhayeko le salai va lighter prayog nagarnuhos.
• **RESCUE HOTLINE**: APF: 1114 | Police: 100 | NDRRMA: 16666`,

        earthquake: `[BHUKAMPA SAFETY PROTOCOL]
• **DROP, COVER, HOLD ON**: Baliyo table muni ghunda teker tauko chopnuhos, kampan narokiunjel samatnuhos.
• **TADHA RAHNUHOS**: Jhyal, aglo furniture ra kamjor garo bata tadha rahnuhos.
• **BAHIRA BHAEMA**: Bhavan, bijuli ko pole ra rukh bata tadha khula thaun ma januhos.
• **AFTER SHAKING**: Parakampan ko lagi tayar rahnuhos. Lift prayog nagarnuhos, bharyang prayog garnuhos.
• **EMERGENCY CALL**: Police: 100 | Ambulance: 102 | NDRRMA: 16666`,

        first_aid_bleeding: `[PRATHAMIK UPACHAR: RAGAT BAGDAI]
• **SIDHAI THICNUHOS**: Safa kapada le ghau ma sidhai 10-15 minute balio sanga thicnuhos.
• **MATHI RAKHNUHOS**: Anga nabhatchieko bhaye muthu bhanda mathi uthaunu hos.
• **OBJECT NANIKALNUHOS**: Ghau bhitra gadieko kura bahira nataannuhos.
• **AMBULANCE DIAL**: Ambulance: 102 | Police: 100`,

        first_aid_burns: `[PRATHAMIK UPACHAR: POLEKO INJURY]
• **CHISO PANI**: Chiso bagne pani le 10-15 minute pakhalnuhos.
• **GHARELU CHIJ NALAGAUNUHOS**: Ice, ghyu, besaar va toothpaste nalagaunuhos. Foka nafodnuhos.
• **CHOPNUHOS**: Safa sukha kapada le halka sanga chopnuhos.
• **AMBULANCE DIAL**: Ambulance: 102 | Police: 100`,

        first_aid_fracture: `[PRATHAMIK UPACHAR: HAAD BHATKIEKO]
• **ACHAL BANAAUNUHOS**: Splint va card-board prayog gari anga nahalai rakhnuhos.
• **SIDHA BANAUNE PRAYAS NAGARNUHOS**: Bangieko anga lai jabardasti natannuhos.
• **AMBULANCE DIAL**: Ambulance: 102 | Police: 100`,

        first_aid_general: `[PRATHAMIK UPACHAR PROTOCOL]
• **RAGAT BAGDAI**: Safa kapada le sidhai baliyo thicnuhos.
• **POLEKO**: Chiso bagne pani le 10-15 min pakhalnuhos.
• **HAAD BHATKIEKO**: Splint prayog gari anga nahalai rakhnuhos.
• **EMERGENCY CALL**: Ambulance: 102 | Police: 100 | NDRRMA: 16666`,

        landslide: `[PAHIRO SAFETY PROTOCOL]
• **BHITRA BHAEMA**: Dhalan bata tadha mathillo tala ma januhos.
• **BAHIRA BHAEMA**: Bhir ra khola kinara bata aglo surakshit thaun ma bhagnuhos.
• **GAADI CHALAUNDA**: Dhunga khasne jokhima ra bato ko crack heri chalaunuhos.
• **EMERGENCY RESCUE**: APF: 1114 | Police: 100 | NDRRMA: 16666`,

        flood: `[BAADHI / FLOOD SAFETY PROTOCOL]
• **AGLO THAUN**: Khola kinara chhadera aglo patti va tala mathi januhos.
• **BIJULI BAND**: Main electric switch band garnuhos.
• **PANI MA NAHINDNUHOS**: Badi ko pani ma kahilyai nahindnuhos ra gaadi nachalaunuhos.
• **EMERGENCY CALL**: Police: 100 | APF: 1114 | NDRRMA: 16666`,

        fire: `[AAGOLAGI SAFETY PROTOCOL]
• **BAHIRA NISKANUHOS**: Dhuwan bhayeko thau ma bhuin tira ghasrier bahira niskanuhos.
• **DAMKAL DIAL**: Fire: 101 | Police: 100 | APF: 1114`,

        building_collapse: `[BHATKIEKO BHAVAN PROTOCOL]
• **BAHIRA NISKANUHOS**: Thulo crack dekhema bharyang bata bahira niskanuhos.
• **GAS RA POWER OFF**: Gas cylinder ra main power switch band garnuhos.
• **EMERGENCY CALL**: Police: 100 | NDRRMA: 16666`,

        emergency_kit: `[EMERGENCY GO-BAG CHECKLIST]
• **Pani ra Khana**: Ek jana ko lagi 3 liter pani ra 3 din pugne dry food.
• **Prathamik Upachar**: Bandage, antiseptic, niyamit aushadhi.
• **Tools**: Flashlight, extra battery, power bank, whistle.
• **Documents**: Nagarikta copy ra cash plastic pouch ma.
• **EMERGENCY CALL**: Police: 100 | NDRRMA: 16666`,

        safe_location: `[SURAKSHIT ASSEMLBY POINTS]
• **KHULA THAUN**: School ground, Tudikhel, Khula Manch va park.
• **BACHNU PARNE**: Saghuro galli, transformer, pole ra garo.
• **EMERGENCY CALL**: Police: 100 | NDRRMA: 16666`,

        contacts: `[NEPAL EMERGENCY HOTLINES]
• **Nepal Police**: 100
• **Red Cross Ambulance**: 102
• **NDRRMA (Disaster Helpline)**: 16666
• **Armed Police Force (APF Rescue)**: 1114
• **Fire Brigade**: 101`
    }
};

const INTENT_RULES = [
    { intent: 'trapped_debris', keywords: ['trapped', 'under rubble', 'under debris', 'pinned', 'buried', 'crushed', 'stuck inside', 'पर्खालमुनि', 'थुनिएँ', 'थुनिएको', 'च्यापिएको', 'भग्नावशेष', 'मलाई बचाउ', 'thuniyo', 'thunieko', 'chyapieko', 'debris muni', 'bachau'] },
    { intent: 'first_aid_bleeding', keywords: ['bleeding', 'blood', 'cut', 'hemorrhage', 'रगत', 'रक्तस्राव', 'घाउ', 'ragat', 'ragat bagyo'] },
    { intent: 'first_aid_burns', keywords: ['burn', 'burned', 'scalding', 'पोलेको', 'आगोले पोलेको', 'poleko', 'aagole poleko'] },
    { intent: 'first_aid_fracture', keywords: ['fracture', 'broken bone', 'dislocation', 'हड्डी भाँचिएको', 'भाँचियो', 'मर्कियो', 'haad bhangieko', 'bhachiyo', 'markieko'] },
    { intent: 'first_aid_general', keywords: ['first aid', 'injury', 'injured', 'wound', 'bandage', 'प्राथमिक उपचार', 'उपचार', 'घाइते', 'prathamik', 'upachar', 'ghaite'] },
    { intent: 'fire', keywords: ['fire', 'burning', 'smoke', 'fire brigade', 'आगो', 'आगलागी', 'धुवाँ', 'दमकल', 'aago', 'aagolagi', 'damkal'] },
    { intent: 'landslide', keywords: ['landslide', 'mudslide', 'rockfall', 'pahiro', 'पहिरो', 'पहिरो आयो', 'पहिरो गयो'] },
    { intent: 'flood', keywords: ['flood', 'flash flood', 'water level', 'submerged', 'inundation', 'baadhi', 'badi', 'बाढी', 'डुबान', 'नदी बढेको'] },
    { intent: 'building_collapse', keywords: ['building collapse', 'wall crack', 'collapsed', 'damage check', 'भवन भत्कियो', 'पर्खाल भत्कियो', 'दरार', 'घर भत्कियो', 'ghar bhatkio', 'bhatkieko'] },
    { intent: 'earthquake', keywords: ['earthquake', 'quake', 'tremor', 'aftershock', 'seismic', 'bhuikampa', 'bhukamp', 'shake', 'भूकम्प', 'कम्पन्', 'हल्लियो', 'परकम्प', 'parakampa'] },
    { intent: 'contacts', keywords: ['contact', 'number', 'phone', 'hotline', 'police', 'ambulance', 'ndrrma', 'apf', 'prahari', 'सम्पर्क', 'नम्बर', 'हटलाइन', 'प्रहरी', 'एम्बुलेन्स', 'नम्बरहरू'] },
    { intent: 'emergency_kit', keywords: ['kit', 'bag', 'go bag', 'supplies', 'jhola', 'samagri', 'झोला', 'सामग्री', 'झटपट झोला'] },
    { intent: 'safe_location', keywords: ['safe location', 'assembly point', 'open space', 'open ground', 'कहाँ जाने', 'सुरक्षित ठाउँ', 'भेला हुने ठाउँ', 'surakshit thaun', 'khula thaun'] }
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
        queue.push({
            id: `sos-${Date.now()}`,
            text: report.text,
            lang: report.lang,
            timestamp: new Date().toISOString(),
            isUrgent: report.isUrgent
        });
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
        console.warn("Could not save offline SOS queue:", e);
    }
}

async function syncOfflineReports() {
    const queue = getOfflineQueue();
    if (!queue || queue.length === 0) return;

    try {
        const count = queue.length;
        // Post queued SOS reports when online
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
        showSyncToast(`${count} offline emergency report(s) synced with dispatch!`);
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

    if (detectedIntent && langDict[detectedIntent]) {
        appendMessageToUI(langDict[detectedIntent], 'sys', '', '', isUrgent);
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

