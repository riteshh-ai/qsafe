// =========================================================================
// LAYER 0: SERVICE WORKER REGISTRATION
// =========================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
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

// Global Map Instance, Coordinates & Markers
let map = null;
let mapMarkers = [];
let userLocationMarker = null;
let routingLine = null;
let watchId = null;

let userLat = null;
let userLng = null;
let lastRoutedCoords = null;
let currentTargetZone = null;
let isInitialFitDone = false;

// Custom Green Icon for Safe Grounds
const safeIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// =========================================================================
// LAYER 1.1: MAP INITIALIZATION & MAXIMIZE CONTROLS
// =========================================================================
function initializeMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || typeof L === 'undefined' || map) return;

    // Center map on Kathmandu default
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([27.7172, 85.3240], 13);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Leaflet Tile Layer (With OSM Fallback)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    setTimeout(() => {
        map.invalidateSize();
    }, 250);

    setupMapMaximizer();
    startLiveLocationTracking();
}

function setupMapMaximizer() {
    const mapWidget = document.getElementById('map-widget');
    const toggleBtn = document.getElementById('map-toggle-btn');

    if (toggleBtn && mapWidget) {
        toggleBtn.addEventListener('click', () => {
            const isMax = mapWidget.classList.toggle('maximized');

            if (isMax) {
                toggleBtn.textContent = '✕';
                toggleBtn.title = 'Close Window';
            } else {
                toggleBtn.textContent = '🗖';
                toggleBtn.title = 'Maximize Map';
            }

            setTimeout(() => {
                if (map) map.invalidateSize();
            }, 200);
        });
    }
}
// =========================================================================
// LAYER 1.2: COMPASS RADAR FALLBACK HUD & TILE PRE-CACHING
// =========================================================================
const CACHED_REGION_KEY = 'qsafe_cached_region_coords';
let radarHudElement = null;
let downloadPromptElement = null;

function calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return Math.round((θ * 180 / Math.PI + 360) % 360);
}

function getDirectionArrowAndCardinal(bearing) {
    const directions = [
        { label: 'N (उत्तर)', arrow: '⬆️' }, { label: 'NE (उत्तर-पूर्व)', arrow: '↗️' },
        { label: 'E (पूर्व)', arrow: '➡️' }, { label: 'SE (दक्षिण-पूर्व)', arrow: '↘️' },
        { label: 'S (दक्षिण)', arrow: '⬇️' }, { label: 'SW (दक्षिण-पश्चिम)', arrow: '↙️' },
        { label: 'W (पश्चिम)', arrow: '⬅️' }, { label: 'NW (उत्तर-पश्चिम)', arrow: '↖️' }
    ];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
}


function updateRadarHUD(userLat, userLng, targetZone) {
    if (!targetZone) return;

    if (!radarHudElement) {
        radarHudElement = document.createElement('div');
        radarHudElement.id = 'radar-hud-overlay';
        // FIXED: Changed 'right: 10px;' to 'right: 60px;' to clear the minimize button
        radarHudElement.style.cssText = `
            position: absolute; top: 10px; left: 10px; right: 60px; z-index: 1000;
            background: rgba(15, 23, 42, 0.92); color: #ffffff; padding: 8px 12px;
            border-radius: 8px; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.15); pointer-events: none; backdrop-filter: blur(4px);
        `;
        const mapWrapper = document.getElementById('map');
        if (mapWrapper) mapWrapper.appendChild(radarHudElement);
    }

    const distKm = getDistanceFromLatLonInKm(userLat, userLng, targetZone.lat, targetZone.lng);
    const distText = distKm < 1 ? `${Math.round(distKm * 1000)} meters` : `${distKm.toFixed(2)} km`;
    const bearing = calculateBearing(userLat, userLng, targetZone.lat, targetZone.lng);
    const nav = getDirectionArrowAndCardinal(bearing);

    radarHudElement.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <span style="color:#22c55e; font-weight:bold;">🧭 RADAR NAV:</span> 
                <strong>${targetZone.name}</strong>
            </div>
            <div style="font-weight:bold; color:#60a5fa;">${distText}</div>
        </div>
        <div style="margin-top:2px; color:#cbd5e1; font-size:11px;">
            Direction: <span style="font-size:14px;">${nav.arrow}</span> <strong>${nav.label} (${bearing}°)</strong>
        </div>
    `;
}


function latLngToTileXY(lat, lng, zoom) {
    const latRad = lat * Math.PI / 180;
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
}

async function downloadOfflineMapRegion(centerLat, centerLng, radiusKm = 10) {
    const TILE_CACHE_NAME = 'qsafe-map-tiles-v1';

    if (downloadPromptElement) {
        downloadPromptElement.innerHTML = `
            <div style="font-weight:bold; margin-bottom:4px;">⏳ Downloading 10 km Offline Map...</div>
            <div style="font-size:11px; color:#cbd5e1;" id="tile-progress-text">Calculating map tiles...</div>
        `;
    }

    try {
        const cache = await caches.open(TILE_CACHE_NAME);
        const latOffset = radiusKm / 111;
        const lngOffset = radiusKm / (111 * Math.cos(centerLat * Math.PI / 180));
        const minLat = centerLat - latOffset;
        const maxLat = centerLat + latOffset;
        const minLng = centerLng - lngOffset;
        const maxLng = centerLng + lngOffset;

        const zoomLevels = [12, 13, 14, 15, 16];
        const tileUrls = [];

        zoomLevels.forEach(zoom => {
            const minTile = latLngToTileXY(maxLat, minLng, zoom);
            const maxTile = latLngToTileXY(minLat, maxLng, zoom);
            for (let x = minTile.x; x <= maxTile.x; x++) {
                for (let y = minTile.y; y <= maxTile.y; y++) {
                    const subdomain = ['a', 'b', 'c'][(x + y) % 3];
                    tileUrls.push(`https://${subdomain}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`);
                }
            }
        });

        let completed = 0;
        const batchSize = 12;

        for (let i = 0; i < tileUrls.length; i += batchSize) {
            const batch = tileUrls.slice(i, i + batchSize);
            await Promise.all(batch.map(async (url) => {
                try {
                    const res = await fetch(url, { mode: 'cors' });
                    if (res.ok) await cache.put(url, res);
                } catch (e) {
                    // Suppress individual tile fetch failures
                }
            }));
            completed += batch.length;
            const progressTxt = document.getElementById('tile-progress-text');
            if (progressTxt) progressTxt.innerText = `Cached ${Math.min(completed, tileUrls.length)} / ${tileUrls.length} map tiles...`;
        }

        localStorage.setItem(CACHED_REGION_KEY, JSON.stringify({ lat: centerLat, lng: centerLng }));

        if (downloadPromptElement) {
            downloadPromptElement.style.background = '#15803d';
            downloadPromptElement.innerHTML = `✅ <strong>10 km Offline Map Downloaded!</strong> Map tiles are ready for offline emergencies.`;
            setTimeout(() => {
                if (downloadPromptElement) downloadPromptElement.remove();
                downloadPromptElement = null;
            }, 4000);
        }
    } catch (err) {
        console.warn("Tile caching error:", err);
        if (downloadPromptElement) {
            downloadPromptElement.innerHTML = `⚠️ Map download interrupted. Will retry when connection stabilizes.`;
        }
    }
}

function checkAndPromptRegionDownload(lat, lng) {
    if (!navigator.onLine) return;
    const savedRegion = localStorage.getItem(CACHED_REGION_KEY);
    if (savedRegion) {
        try {
            const { lat: cLat, lng: cLng } = JSON.parse(savedRegion);
            if (getDistanceFromLatLonInKm(lat, lng, cLat, cLng) < 7.5) return;
        } catch (e) {
            localStorage.removeItem(CACHED_REGION_KEY);
        }
    }
    showDownloadPromptUI(lat, lng);
}

function showDownloadPromptUI(lat, lng) {
    if (downloadPromptElement) return;
    downloadPromptElement = document.createElement('div');
    downloadPromptElement.id = 'download-region-prompt';
    downloadPromptElement.style.cssText = `
        position: absolute; bottom: 25px; left: 10px; right: 10px; z-index: 1000;
        background: #1e293b; color: #ffffff; padding: 10px 14px; border-radius: 8px;
        font-size: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); border: 1px solid #3b82f6;
    `;

    downloadPromptElement.innerHTML = `
        <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px; color: #60a5fa;">🗺️ New Region Detected!</div>
        <div style="margin-bottom: 8px; color: #e2e8f0;">Download <strong>10 km offline map tiles</strong> for your current location so you stay safe during crisis?</div>
        <div style="display: flex; gap: 8px;">
            <button id="btn-dl-yes" style="background: #2563eb; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; flex: 1;">Download 10km Map</button>
            <button id="btn-dl-no" style="background: #475569; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;">Later</button>
        </div>
    `;
    const mapWrapper = document.getElementById('map');
    if (mapWrapper) mapWrapper.appendChild(downloadPromptElement);

    document.getElementById('btn-dl-yes').onclick = () => downloadOfflineMapRegion(lat, lng, 10);
    document.getElementById('btn-dl-no').onclick = () => {
        downloadPromptElement.remove();
        downloadPromptElement = null;
    };
}

// =========================================================================
// LAYER 1.3: NATIONWIDE OFFLINE STORAGE (IndexedDB)
// =========================================================================
const DB_NAME = 'QSafeNepalDB';
const DB_VERSION = 2; // Incremented to manage reports store 
const STORE_ZONES = 'safe_zones';
const STORE_REPORTS = 'incident_reports';

function openQSafeDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_ZONES)) {
                db.createObjectStore(STORE_ZONES, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_REPORTS)) {
                const store = db.createObjectStore(STORE_REPORTS, { keyPath: 'id' });
                store.createIndex('synced', 'synced', { unique: false });
            }
        };
    });
}

async function saveZonesToCache(zones) {
    try {
        const db = await openQSafeDB();
        const tx = db.transaction(STORE_ZONES, 'readwrite');
        const store = tx.objectStore(STORE_ZONES);
        zones.forEach(zone => store.put(zone));
        return tx.complete;
    } catch (err) {
        console.warn("Could not save zones to IndexedDB:", err);
    }
}

async function getCachedZones() {
    try {
        const db = await openQSafeDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_ZONES, 'readonly');
            const store = tx.objectStore(STORE_ZONES);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        return [];
    }
}

async function fetchSafeZonesForLocation(lat, lng) {
    if (!navigator.onLine) {
        console.log("📴 Offline mode: Loading safe zones from IndexedDB cache...");
        const cachedZones = await getCachedZones();
        if (cachedZones.length > 0) return cachedZones;
        return [{ id: 'fallback-1', name: "Local Open Safe Ground / खुला चौर", lat: lat + 0.005, lng: lng + 0.005 }];
    }

    const bbox = `${lat - 0.05},${lng - 0.05},${lat + 0.05},${lng + 0.05}`;
    const overpassQuery = `
        [out:json][timeout:10];
        (
          node["leisure"="park"](${bbox});
          way["leisure"="park"](${bbox});
          node["emergency"="assembly_point"](${bbox});
          way["emergency"="assembly_point"](${bbox});
          node["amenity"="shelter"](${bbox});
        );
        out center;
    `;

    try {
        const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`);
        const data = await response.json();
        let dynamicZones = [];

        if (data.elements && data.elements.length > 0) {
            dynamicZones = data.elements.map((el, index) => {
                const zoneLat = el.lat || (el.center && el.center.lat);
                const zoneLng = el.lon || (el.center && el.center.lng);
                const name = (el.tags && (el.tags.name || el.tags['name:en'] || el.tags['name:ne'])) || `Open Safe Area ${index + 1}`;
                return { id: `osm-${el.id || index}`, name: name, lat: zoneLat, lng: zoneLng };
            }).filter(z => z.lat && z.lng);
        }

        if (dynamicZones.length > 0) {
            await saveZonesToCache(dynamicZones);
            return dynamicZones;
        }
    } catch (err) {
        console.warn("⚠️ Overpass API fetch failed, falling back to local cache:", err);
    }

    const cachedZones = await getCachedZones();
    return cachedZones.length > 0 ? cachedZones : [
        { id: 'fallback-default', name: "Open Ground / खुला चौर", lat: lat + 0.005, lng: lng + 0.005 }
    ];
}

// =========================================================================
// LAYER 1.4: LIVE LOCATION TRACKING & DYNAMIC ROUTING
// =========================================================================
function startLiveLocationTracking() {
    if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
            async (position) => {
                userLat = position.coords.latitude;
                userLng = position.coords.longitude;

                if (userLocationMarker) {
                    userLocationMarker.setLatLng([userLat, userLng]);
                } else {
                    userLocationMarker = L.marker([userLat, userLng]).addTo(map)
                        .bindPopup("<b>📍 Your Location / तपाईंको स्थान</b>");
                }

                checkAndPromptRegionDownload(userLat, userLng);

                if (currentTargetZone) {
                    updateRadarHUD(userLat, userLng, currentTargetZone);
                }

                const distanceMoved = lastRoutedCoords
                    ? getDistanceFromLatLonInKm(lastRoutedCoords.lat, lastRoutedCoords.lng, userLat, userLng)
                    : Infinity;

                if (!lastRoutedCoords || distanceMoved > 0.015) {
                    lastRoutedCoords = { lat: userLat, lng: userLng };
                    await findNearestSafeZoneAndRoute(userLat, userLng, !isInitialFitDone);
                    isInitialFitDone = true;
                }
            },
            (error) => console.warn("Geolocation watch error:", error.message),
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
    }
}

async function routeToPoint(destLat, destLng) {
    if (!userLat || !userLng) return;
    if (routingLine) map.removeLayer(routingLine);

    // Hazard exclusion logic
    let excludeParam = "";
    if (typeof activeVerifiedHazards !== 'undefined' && activeVerifiedHazards.length > 0) {
        const hazardCoords = activeVerifiedHazards.map(h => `${h.lng},${h.lat}`).join(';');
        excludeParam = `&exclude=${encodeURIComponent(hazardCoords)}`;
    }

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${destLng},${destLat}?overview=full&geometries=geojson${excludeParam}`;

    try {
        const res = await fetch(osrmUrl);
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            routingLine = L.polyline(coords, { color: '#2563eb', weight: 6, opacity: 0.85 }).addTo(map);
            return;
        }
    } catch (err) {
        console.warn("⚠️ OSRM route unavailable or blocked. Drawing direct fallback line:", err);
    }

    // Geodesic Fallback Line
    routingLine = L.polyline([[userLat, userLng], [destLat, destLng]], {
        color: '#ff9100', weight: 5, opacity: 0.8, dashArray: '10, 10'
    }).addTo(map);
}

async function routeToSelectedZone(zone) {
    if (!userLat || !userLng) return;

    currentTargetZone = zone;
    updateRadarHUD(userLat, userLng, zone);

    // Utilize the hazard-aware unified router
    await routeToPoint(zone.lat, zone.lng);

    const currentLang = langSelect ? langSelect.value : 'en';
    const msg = currentLang === 'नेपाली' || currentLang === 'np' || currentLang === 'ne'
        ? `📍 **चयनित मार्गनिर्देशन:** तपाईंले छान्नु भएको सुरक्षित खुला चौर **${zone.name}** तर्फ जाने बाटो नक्सामा देखाइएको छ।`
        : `📍 **Selected Navigation:** Road path to your chosen safe area **${zone.name}** is now displayed on the map.`;

    appendMessageToUI(msg, 'sys', 'QSAFE Manual Route Selector');
}

async function findNearestSafeZoneAndRoute(userLat, userLng, fitBoundsFlag = false) {
    const safeZones = await fetchSafeZonesForLocation(userLat, userLng);

    mapMarkers.forEach(m => map.removeLayer(m));
    mapMarkers = [];

    let nearest = null;
    let minDistance = Infinity;

    safeZones.forEach(zone => {
        const safeIdKey = `route-btn-${zone.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const popupHTML = `
            <div style="font-family: inherit; min-width: 160px;">
                <b style="color: #16a34a;">🟢 Safe Assembly Area / खुला चौर</b><br>
                <div style="margin: 4px 0 8px 0; font-size: 13px;">${zone.name}</div>
                <button id="${safeIdKey}" style="background: #2563eb; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600; width: 100%;">
                    Navigate Here / यहाँ जानुहोस्
                </button>
            </div>
        `;

        const marker = L.marker([zone.lat, zone.lng], { icon: safeIcon })
            .addTo(map)
            .bindPopup(popupHTML);

        marker.on('popupopen', () => {
            const btn = document.getElementById(safeIdKey);
            if (btn) {
                btn.onclick = () => {
                    routeToSelectedZone(zone);
                    map.closePopup();
                };
            }
        });

        mapMarkers.push(marker);

        const dist = getDistanceFromLatLonInKm(userLat, userLng, zone.lat, zone.lng);
        if (dist < minDistance) {
            minDistance = dist;
            nearest = zone;
        }
    });

    if (nearest && fitBoundsFlag) {
        await routeToSelectedZone(nearest);
        const zoneMarker = L.marker([nearest.lat, nearest.lng], { icon: safeIcon });
        const group = new L.featureGroup([userLocationMarker, zoneMarker]);
        map.fitBounds(group.getBounds().pad(0.25));
    }
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// =========================================================================
// LAYER 1.5: HAZARD REPORTING, CLUSTERING & AVOIDANCE ENGINE
// =========================================================================
let activeVerifiedHazards = [];

function matchHazardIntent(text) {
    const q = text.toLowerCase();
    if (q.includes('road') || q.includes('block') || q.includes('close') || q.includes('बाटो') || q.includes('अवरोध') || q.includes('बन्द')) return 'road_block';
    if (q.includes('damage') || q.includes('collapse') || q.includes('wall') || q.includes('building') || q.includes('भवन') || q.includes('क्षति') || q.includes('भत्किएको')) return 'structural_damage';
    if (q.includes('landslide') || q.includes('rock') || q.includes('पहिरो')) return 'landslide';
    return 'other_hazard';
}

async function submitHazardReport(rawText, overrideType = null) {
    if (!userLat || !userLng) {
        appendMessageToUI("⚠️ GPS location required to report hazards.", 'sys');
        return;
    }

    const hazardType = overrideType || matchHazardIntent(rawText);
    const reportPayload = {
        id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: hazardType,
        description: rawText,
        lat: userLat,
        lng: userLng,
        timestamp: new Date().toISOString(),
        synced: 0
    };

    const db = await openQSafeDB();
    const tx = db.transaction(STORE_REPORTS, 'readwrite');
    await tx.objectStore(STORE_REPORTS).put(reportPayload);

    renderPendingHazardMarker(reportPayload);

    if (isSystemOnline) {
        await syncPendingReports();
        appendMessageToUI(`🚨 Hazard report submitted to admin queue for verification.`, 'sys');
    } else {
        appendMessageToUI(`📡 Offline mode: Report saved locally. It will auto-sync when online.`, 'sys');
    }
}

async function syncPendingReports() {
    if (!isSystemOnline) return;
    try {
        const db = await openQSafeDB();
        const tx = db.transaction(STORE_REPORTS, 'readonly');
        const store = tx.objectStore(STORE_REPORTS);
        const index = store.index('synced');
        const req = index.getAll(0);

        req.onsuccess = async () => {
            const unsynced = req.result;
            if (!unsynced || unsynced.length === 0) return;

            const res = await fetch(`${BACKEND_URL}/api/reports/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reports: unsynced })
            });

            if (res.ok) {
                const writeTx = db.transaction(STORE_REPORTS, 'readwrite');
                const writeStore = writeTx.objectStore(STORE_REPORTS);
                unsynced.forEach(item => {
                    item.synced = 1;
                    writeStore.put(item);
                });
                console.log(`✅ Synced ${unsynced.length} hazard report(s) to server.`);
                fetchVerifiedHazards();
            }
        };
    } catch (err) {
        console.warn("⚠️ Hazard report sync failed:", err);
    }
}

async function fetchVerifiedHazards() {
    if (!isSystemOnline) return;
    try {
        const res = await fetch(`${BACKEND_URL}/api/hazards/active`);
        if (res.ok) {
            activeVerifiedHazards = await res.json();
            renderVerifiedHazards(activeVerifiedHazards);
        }
    } catch (err) {
        console.warn("⚠️ Failed to fetch verified hazards:", err);
    }
}

function renderVerifiedHazards(hazards) {
    hazards.forEach(hazard => {
        let iconSymbol = '⚠️';
        let label = 'Hazard Zone / खतरा क्षेत्र';

        if (hazard.type === 'road_block') { iconSymbol = '🚧'; label = 'Road Closed / बाटो बन्द'; }
        else if (hazard.type === 'structural_damage') { iconSymbol = '🏚️'; label = 'Structural Damage / भवन क्षति'; }
        else if (hazard.type === 'landslide') { iconSymbol = '🪨'; label = 'Landslide / पहिरो'; }

        L.marker([hazard.lat, hazard.lng], {
            icon: L.divIcon({
                className: 'verified-hazard-marker',
                html: `<div style="font-size: 24px; filter: drop-shadow(0 0 4px red);">${iconSymbol}</div>`,
                iconSize: [30, 30]
            })
        }).addTo(map).bindPopup(`
            <strong style="color: #d32f2f;">${label}</strong><br>
            <p style="margin: 4px 0;">${hazard.description}</p>
            <small><b>Verified by Admin</b> (${hazard.reportCount || 1} report(s) in area)</small>
        `);
    });
}

function renderPendingHazardMarker(report) {
    L.marker([report.lat, report.lng], {
        icon: L.divIcon({
            className: 'pending-hazard-marker',
            html: `<div style="font-size: 20px; opacity: 0.7;">⏳</div>`,
            iconSize: [24, 24]
        })
    }).addTo(map).bindPopup(`<strong>Pending Verification</strong><br>${report.description}`);
}

function openReportModal() {
    const modal = document.getElementById('report-modal');
    if (modal) modal.style.display = 'flex';
}

function closeReportModal() {
    const modal = document.getElementById('report-modal');
    if (modal) modal.style.display = 'none';
    const descInput = document.getElementById('report-desc');
    if (descInput) descInput.value = '';
}

function submitModalReport() {
    const typeSelect = document.getElementById('report-type');
    const descInput = document.getElementById('report-desc');

    const type = typeSelect ? typeSelect.value : 'other_hazard';
    const desc = descInput ? descInput.value.trim() : '';

    if (!desc) {
        alert("Please provide a description / विवरण लेख्नुहोस्");
        return;
    }

    submitHazardReport(desc, type);
    closeReportModal();
}

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
        const res = await fetch(`${BACKEND_URL}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        updateOnlineStatus(res.ok);
    } catch (err) {
        updateOnlineStatus(false);
    }
}

window.addEventListener('online', () => evaluateNetworkConnectivity());
window.addEventListener('offline', () => updateOnlineStatus(false));

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
            seismicTxt.innerHTML = (currentLang === 'ne_dev' || currentLang === 'ne' || currentLang === 'np')
                ? "🟢 नेपाल क्षेत्र: शान्त (विगत २४ घण्टामा कुनै ठूलो भूकम्प मापन भएको छैन)।"
                : (currentLang === 'ne_rom'
                    ? "🟢 Nepal Chhetra: Shant (Bhigat 24 ghanta ma kunai bhukampa chhaina)."
                    : "🟢 Nepal Region: Seismic Quiet (No tremors in past 24h).");
            if (seismicBanner) seismicBanner.className = "seismic-banner normal";
        } else {
            const latest = data.events[0];
            const eventTime = new Date(latest.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            seismicTxt.innerHTML = (currentLang === 'ne_dev' || currentLang === 'ne' || currentLang === 'np')
                ? `🚨 <strong>भूकम्प सतर्कता:</strong> M ${latest.magnitude} | ${latest.location} (${eventTime})`
                : (currentLang === 'ne_rom'
                    ? `🚨 <strong>BHUKAMPA ALERT:</strong> M ${latest.magnitude} | ${latest.location} (${eventTime})`
                    : `🚨 <strong>TREMOR ALERT:</strong> M ${latest.magnitude} | ${latest.location} (${eventTime})`);
            if (seismicBanner) seismicBanner.className = "seismic-banner active-alert";
        }
    } catch (err) {
        console.warn("Seismic Telemetry Endpoint unreachable, using offline fallback display.");
        seismicTxt.innerHTML = (currentLang === 'ne_dev' || currentLang === 'ne' || currentLang === 'np')
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
    const val = langSelect.value ? langSelect.value.trim() : 'en';
    if (val === 'ne' || val === 'np' || val === 'ne_dev') return 'ne_dev';
    if (val === 'ne_rom') return 'ne_rom';
    return 'en';
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
        first_aid_query: `[प्राथमिक उपचार प्रणाली]
1. 🛑 **IMMEDIATE HAZARD ACTION**: रगत बग्ने: सफा कपडाले सिधै बलियो थिच्नुहोस्।
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: पोलेको: तुरुन्तै १० मिनेटसम्म चिसो पानीले पखाल्नुहोस्।
3. 📞 **EMERGENCY HOTLINE CALL**: एम्बुलेन्स: १०२`,
        preparedness_tips_query: `[आपत्कालीन झोला (Go-Bag)]
1. 🛑 **IMMEDIATE HAZARD ACTION**: पानी र नबिग्रिने खानेकुरा जोहो गर्नुहोस्।
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: प्राथमिक उपचार किट र टर्चलाइट राख्नुहोस्।
3. 📞 **EMERGENCY HOTLINE CALL**: NDRRMA: १६६६६`,
        emergency_contact_request: `[आकस्मिक हटलाइनहरू]
• NDRRMA: १६६६६
• नेपाल प्रहरी: १००
• सशस्त्र प्रहरी: १११४
• एम्बुलेन्स: १०२
• दमकल: १०१`,
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
        first_aid_query: `[FIRST AID PROTOCOL]
1. 🛑 **IMMEDIATE HAZARD ACTION**: Ragat bageko ma safa kapada le thichnuhos.
2. 🩹 **IMMEDIATE LIFE-SAVING ACTION**: Poleko ma 10 min chiso pani halnuhos.
3. 📞 **EMERGENCY HOTLINE CALL**: Ambulance: 102`,
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
    { intent: 'preparedness_tips_query', keywords: ['how to prepare', 'गो-ब्याग कसरी', 'emergency kit ma k k', 'emergency kit', 'go bag', 'go-bag', 'preparedness', 'prepare', 'आपतकालीन किट', 'आपत्कालीन झोला'] },
    { intent: 'earthquake_occurring_report', keywords: ['earthquake', 'earthquake now', 'bhukampa aayo', 'घर हल्लियो', 'bhuikampa', 'bhukampa', 'shake', 'भूकम्प', 'कम्पन्'] },
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
    { intent: 'status_check_general', keywords: ['what should i do', 'अहिले मैले के गर्नुपर्छ', 'ahile k garne', 'what now'] },
    { intent: 'fallback_unclear', keywords: [] }
];

const LATIN_KEYWORD = /^[a-z0-9\s'-]+$/;

function keywordMatches(haystack, keyword) {
    const k = keyword.toLowerCase().trim();
    if (!k) return false;
    if (!LATIN_KEYWORD.test(k)) return haystack.includes(k);
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const plural = k.length >= 4 ? 's?' : '';
    return new RegExp(`(?<![a-z0-9])${escaped}${plural}(?![a-z0-9])`, 'i').test(haystack);
}

function matchLocalIntent(query) {
    const q = query.toLowerCase().trim();
    for (const rule of INTENT_RULES) {
        if (rule.keywords.some(keyword => keywordMatches(q, keyword))) {
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

    appendMessageToUI(rawQuery, 'usr');
    queryIn.value = '';

    const loadingId = appendLoadingBubble();

    if (isSystemOnline) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({ message: rawQuery, selected_language: selectedLang, lang: selectedLang })
            });

            if (response.ok) {
                const data = await response.json();
                removeLoadingBubble(loadingId);
                appendMessageToUI(data.response || data.reply, 'sys', 'Live RAG Pipeline (Gemini 2.0 + ChromaDB)', '', isUrgent);
                return;
            }
        } catch (err) {
            console.warn("⚠️ Live API call failed. Falling back to local offline engine...", err);
        }
    }

    // Step D: Offline Local Knowledge Base Fallback
    removeLoadingBubble(loadingId);

    if (isUrgent) {
        queueOfflineReport({ text: rawQuery, lang: selectedLang, isUrgent: true });
    }

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

// Ensure Map Initializations run cleanly on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMap);
} else {
    initializeMap();
}

window.addEventListener('load', () => {
    if (typeof map !== 'undefined' && map) {
        map.invalidateSize();
    }
    fetchVerifiedHazards();
});

