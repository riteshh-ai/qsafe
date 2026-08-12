// =========================================================================
// LAYER 1: DOM ELEMENT SELECTORS
// =========================================================================
const chatLog = document.getElementById('chat-log');
const queryIn = document.getElementById('query-in');
const dispatchBtn = document.getElementById('dispatch-btn');
const telemetryBadge = document.getElementById('telemetry-badge');
const telemetryTxt = document.getElementById('telemetry-txt');

// =========================================================================
// LAYER 2: NETWORK TELEMETRY MONITOR (UPDATED WITH CHAT NOTIFICATIONS)
// =========================================================================
let firstLoad = true; // Prevents spamming status messages when the app first opens

function syncNetworkInterface() {
    if (!telemetryBadge || !telemetryTxt) return;

    if (navigator.onLine) {
        telemetryBadge.className = "badge online";
        telemetryTxt.innerText = "Online";
        console.log("🌐 System link re-established. Cloud routes active.");
        
        // Only show message if switching states after initial boot
        if (!firstLoad) {
            appendMessageToUI("⚡ Connection restored. Cloud RAG routes re-activated.", "sys", "Network Monitor");
        }
    } else {
        telemetryBadge.className = "badge offline";
        telemetryTxt.innerText = "Offline";
        console.warn("⚠️ System disconnected. Routing traffic to local cache.");
        
        // Push a direct notification into the chat feed
        appendMessageToUI("⚠️ Connection lost. System switched to offline fail-safe mode. Using local data storage.", "sys", "Network Monitor");
    }
    
    firstLoad = false; // Calibration complete
}
// =========================================================================
// LAYER 3: UI VIEWPORT RENDERER
// =========================================================================
function appendMessageToUI(text, sender, routeTag = "") {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${sender}`;
    bubble.innerText = text;

    if (routeTag) {
        const meta = document.createElement('span');
        meta.className = "meta-tag";
        meta.innerText = `Route: ${routeTag}`;
        bubble.appendChild(meta);
    }

    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight; // Autoscroll to latest content
}

// =========================================================================
// LAYER 4: TRANSACTION EXECUTION ROUTER
// =========================================================================
async function handleUserIntent() {
    const rawInput = queryIn.value.trim();
    if (!rawInput) return;

    // Post user query to interface immediately and clear input bar
    appendMessageToUI(rawInput, 'usr');
    queryIn.value = '';

    // Emulate network processing latency (500ms)
    setTimeout(async () => {
        if (navigator.onLine) {
            try {
                const result = await classifyWithBackend(rawInput);
                appendMessageToUI(
                    `Predicted intent: ${result.intent} (score: ${Number(result.score || 0).toFixed(2)})`,
                    'sys',
                    'Offline Intent Classifier'
                );
            } catch (err) {
                console.error('Backend classification error:', err);
                appendMessageToUI(
                    'Offline classifier unreachable. Falling back to local safety guidance.',
                    'sys',
                    'Fallback Router'
                );
                await executeLocalCacheFallback(rawInput);
            }
        } else {
            await executeLocalCacheFallback(rawInput);
        }
    }, 500);
}

async function classifyWithBackend(userQuery) {
    const response = await fetch('/api/classify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: userQuery }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Backend classification failed');
    }

    return response.json();
}

// =========================================================================
// LAYER 5: OFFLINE BACKUP PROCESSING
// =========================================================================
async function executeLocalCacheFallback(userQuery) {
    try {
        // Fetch static data backup from local folder structure
        const response = await fetch('/public/emergency_contacts.json');
        const data = await response.json();

        const queryLower = userQuery.toLowerCase();

        if (queryLower.includes('earthquake') || queryLower.includes('bhuikampa') || queryLower.includes('shake')) {
            let output = `[CRITICAL OFF-GRID SAFETY HIGHLIGHT]\n${data.static_checklists.earthquake}\n\nEmergency Hotlines:\n`;
            data.hotlines.forEach(item => {
                output += `• ${item.name}: ${item.phone}\n`;
            });
            appendMessageToUI(output, "sys", "Local Core Asset JSON Layer");
        } else {
            appendMessageToUI(
                "System is offline. The local cache cannot resolve instructions for this phrase. Stay away from steep hillsides and fragile concrete walls. Call 16666 when cellular signals resume.",
                "sys",
                "Offline Safety Fail-Safe"
            );
        }
    } catch (err) {
        console.error("Local data ingestion error:", err);
        appendMessageToUI("Critical error: Local storage assets inaccessible.", "sys", "Storage Error");
    }
}

// =========================================================================
// LAYER 6: EVENT LISTENERS
// =========================================================================
dispatchBtn.addEventListener('click', handleUserIntent);
queryIn.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUserIntent();
});