// =========================================================================
// LAYER 0: SERVICE WORKER REGISTRATION
// =========================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
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
    let formatted = rawText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
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
// LAYER 4: LOCAL INTENT DISPATCHER & RAG PIPELINE
// =========================================================================
function getNormalizedLang() {
    if (!langSelect) return 'en';
    const val = langSelect.value ? langSelect.value.toLowerCase() : '';
    if (val === 'np' || val === 'ne' || val === 'नेपाली' || val.includes('nepal')) return 'np';
    return 'en';
}

function getUnknownQueryResponse(lang) {
    if (lang === 'np') {
        return `[डेटा उपलब्ध छैन]\nहाम्रो अफलाइन डेटाबेसमा यो प्रश्नको लागि कुनै जानकारी उपलब्ध छैन।\n\nकृपया यी उपलब्ध विषयहरूमा खोजी गर्नुहोस्:\n• भूकम्प सुरक्षा (Earthquake)\n• प्राथमिक उपचार (First Aid)\n• आपत्कालीन झोला (Emergency Kit)\n• सम्पर्क नम्बर (Emergency Hotlines)\n\nतत्काल सहयोगका लागि: प्रहरी १०० वा NDRRMA १६६६६ मा सम्पर्क गर्नुहोस्।`;
    } else {
        return `[NO DATA AVAILABLE]\nWe do not have specific safety guidance for this query in our offline database.\n\nPlease try asking about our supported emergency topics:\n• Earthquake Protocol (भूकम्प)\n• First Aid Guidance (प्राथमिक उपचार)\n• Emergency Kit / Go-Bag (आपत्कालीन झोला)\n• Emergency Hotlines (सम्पर्क नम्बर)\n\nFor immediate life safety: Call Police (100) or NDRRMA (16666).`;
    }
}

const LOCAL_KNOWLEDGE_BASE = {
    en: {
        first_aid: `[FIRST AID PROTOCOL]\n• Bleeding: Apply direct, firm pressure with a clean cloth.\n• Fractures: Immobilize the limb using a splint without trying to realign the bone.\n• Burns: Flush immediately with cool, running water for 10 minutes.\n• Unconsciousness: Place in recovery position and check breathing.`,
        earthquake: `[EARTHQUAKE SAFETY PROTOCOL]\n• INDOORS: DROP, COVER, and HOLD ON under structural beams or stable furniture. Stay clear of masonry brick walls, windows, and heavy overhead fixtures.\n• OUTDOORS: Move to an open area away from buildings, utility wires, and trees.\n• AFTER SHAKING: Expect aftershocks. Use stairs, never elevators. Check for gas leaks.`,
        contacts: `[EMERGENCY HOTLINES - NEPAL]\n• National Emergency Operations (NDRRMA): 16666\n• Nepal Police Control: 100\n• Armed Police Force Rescue: 1114\n• Red Cross Ambulance Central: 102\n• Fire Brigade: 101`,
        emergency_kit: `[EMERGENCY GO-BAG CHECKLIST]\n• Water: 3 liters/person for at least 3 days.\n• Food: Non-perishable, ready-to-eat items.\n• Medical: First-aid kit, essential prescription meds.\n• Tools: Flashlight, extra batteries, power bank, whistle, multi-tool knife.\n• Documents: Copies of citizenship, insurance, emergency cash in waterproof bag.`,
        fire_flood: `[FIRE & FLOOD SAFETY]\n• FIRE: Stay low to avoid smoke. Touch doors with the back of your hand before opening. If caught, Stop, Drop, and Roll.\n• FLOOD: Move immediately to higher ground. Never walk or drive through moving floodwaters.`
    },
    np: {
        first_aid: `[प्राथमिक उपचार प्रणाली]\n• रगत बग्ने: सफा कपडाले सिधै बलियो थिच्नुहोस्।\n• हाड भाँचिएको: हड्डी सच्याउन नखोजी स्प्लिन्ट प्रयोग गरेर अङ्ग स्थिर राख्नुहोस्।\n• पोलेको: तुरुन्तै १० मिनेटसम्म चिसो, बगिरहेको पानीले पखाल्नुहोस्।\n• बेहोस: सुरक्षात्मक स्थिति (Recovery Position) मा राख्नुहोस् र सास फेरेको जाँच गर्नुहोस्।`,
        earthquake: `[भूकम्प सुरक्षा प्रणाली]\n• घरभित्र: बलियो टेबलमुनि झुक्नुहोस् (DROP), ओत लाग्नुहोस् (COVER), र समात्नुहोस् (HOLD ON)। झ्याल र गह्रौँ फर्निचरबाट टाढा रहनुहोस्।\n• बाहिर: भवन, बिजुलीको पोल र रुखहरूबाट टाढा खुला ठाउँमा जानुहोस्।\n• कम्पन रोकिएपछि: पराकम्पनको लागि तयार रहनुहोस्। लिफ्ट प्रयोग नगर्नुहोस्।`,
        contacts: `[आकस्मिक हटलाइनहरू - नेपाल]\n• राष्ट्रिय आपत्कालीन कार्य सञ्चालन केन्द्र (NDRRMA): १६६६६\n• नेपाल प्रहरी नियन्त्रण: १००\n• सशस्त्र प्रहरी बल उद्धार: १११४\n• रेडक्रस एम्बुलेन्स सेन्टर: १०२\n• दमकल (Fire): १०१`,
        emergency_kit: `[आपत्कालीन झोला (Go-Bag) सामग्री]\n• पानी: प्रतिव्यक्ति दैनिक ३ लिटर (कमसेकम ३ दिनको लागि)।\n• खाना: बिग्रिने नहुने र पकाउनु नपर्ने खानेकुरा।\n• औषधि: प्राथमिक उपचार किट र आवश्यक नियमित औषधि।\n• औजार: टर्चलाइट, पावर बैंक, सिट्टी (Whistle), चक्कु।\n• कागजात: नागरिकताको प्रतिलिपि, नगद रूपैयाँ।`,
        fire_flood: `[आगो र बाढी सुरक्षा]\n• आगलागी: धुवाँबाट बच्न निहुरिएर हिँड्नुहोस्। कपडामा आगो लागेमा - रोकिनुहोस्, भुइँमा सोल्टिनुहोस् (Stop, Drop, Roll)।\n• बाढी: तुरुन्तै अग्लो ठाउँमा जानुहोस्। बगिरहेको बाढीको पानीमा कहिल्यै नहिँड्नुहोस्।`
    }
};

const INTENT_RULES = [
    { intent: 'first_aid', keywords: ['first aid', 'aid', 'bleed', 'bleeding', 'burn', 'fracture', 'cut', 'prathamik', 'upachar', 'ragat', 'poleko', 'haad', 'प्राथमिक', 'उपचार', 'रगत', 'पोलेको', 'हाड', 'घाउ'] },
    { intent: 'earthquake', keywords: ['earthquake', 'quake', 'tremor', 'seismic', 'bhuinkampa', 'bhukampa', 'kampan', 'shake', 'bhu', 'भूकम्प', 'कम्पन', 'निर्देशिका'] },
    { intent: 'contacts', keywords: ['contact', 'number', 'phone', 'call', 'hotline', 'police', 'ambulance', 'ndrrma', 'nambar', 'samparka', 'prahari', 'सम्पर्क', 'नम्बर', 'हटलाइन', 'प्रहरी', 'एम्बुलेन्स'] },
    { intent: 'emergency_kit', keywords: ['kit', 'bag', 'go bag', 'supplies', 'pack', 'jhola', 'samagri', 'आपत्कालीन', 'झोला', 'सामग्री'] },
    { intent: 'fire_flood', keywords: ['fire', 'flood', 'burns', 'aago', 'aagolagi', 'baadhi', 'badhi', 'damkal', 'आगो', 'आगलागी', 'बाढी', 'दमकल'] }
];

function matchUserIntent(query) {
    const q = query.toLowerCase().trim();
    for (const rule of INTENT_RULES) {
        if (rule.keywords.some(keyword => q.includes(keyword.toLowerCase()))) {
            return rule.intent;
        }
    }
    return 'default';
}

async function handleUserIntent() {
    const rawQuery = queryIn.value ? queryIn.value.trim() : "";
    if (!rawQuery) return;

    const currentLang = getNormalizedLang();
    const backendLang = (currentLang === 'np') ? 'ne' : 'en';

    appendMessageToUI(rawQuery, 'user');
    queryIn.value = '';

    const loadingId = appendLoadingBubble();

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
                appendMessageToUI(data.response || data.reply, 'sys', `Live RAG Pipeline (Gemini 2.0 + ChromaDB) [${currentLang.toUpperCase()}]`);
                return;
            }
        } catch (err) {
            console.warn("⚠️ Live API call failed. Falling back to offline local engine...", err);
        }
    }

    removeLoadingBubble(loadingId);

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
    appendMessageToUI(responseText, 'sys', `Local Storage Fallback (${currentLang.toUpperCase()})`);
}

// =========================================================================
// LAYER 5: EVENT LISTENERS & INITIALIZATION HOOKS
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
        let targetQuery = '';

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
    // Fetch initial hazards on load
    fetchVerifiedHazards();
});