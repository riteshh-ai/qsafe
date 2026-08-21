// =========================================================================
// QSAFE NEPAL SERVICE WORKER (CORE SHELL + RESILIENT MAP TILE CACHE)
// =========================================================================

const CACHE_NAME = 'qsafe-nepal-v4'; // Bumped version to force cache refresh
const TILE_CACHE_NAME = 'qsafe-map-tiles-v1';

const ASSETS_TO_CACHE = [
    '/',
    './',
    './index.html',
    './style.css',
    './styles.css',
    './app.js',
    './lib/leaflet.css', // Local Leaflet CSS
    './lib/leaflet.js',  // Local Leaflet JS
    './public/emergency_contacts.json',
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
];

// Helper: Try matching map tiles across OSM subdomains (a, b, c)
async function matchTileInCache(cache, request) {
    let response = await cache.match(request);
    if (response) return response;

    // Fallback: Check alternate OpenStreetMap subdomains
    const urlStr = request.url;
    if (urlStr.includes('.tile.openstreetmap.org/')) {
        const subdomains = ['a', 'b', 'c'];
        for (const sub of subdomains) {
            const altUrl = urlStr.replace(/\/\/[abc]\.tile\.openstreetmap\.org\//, `//${sub}.tile.openstreetmap.org/`);
            response = await cache.match(altUrl);
            if (response) return response;
        }
    }
    return null;
}

// 1. Install Event - Safe Non-Atomic Caching
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('📦 Locking core UI assets into offline cache memory...');
            await Promise.allSettled(
                ASSETS_TO_CACHE.map(async (url) => {
                    try {
                        await cache.add(url);
                    } catch (err) {
                        console.warn(`⚠️ Optional asset cache skipped: ${url}`);
                    }
                })
            );
        })
    );
    self.skipWaiting();
});

// 2. Activate Event - Cache Cleanup
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== TILE_CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Fetch Event - Offline Interceptor
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Bypass non-GET requests or backend API calls
    if (
        event.request.method !== 'GET' || 
        url.pathname.startsWith('/api/') || 
        url.search.includes('cachebust')
    ) {
        return; 
    }

    // A. Dynamic Map Tile Caching Strategy
    if (url.hostname.includes('openstreetmap.org') || url.hostname.includes('tile.')) {
        event.respondWith(
            caches.open(TILE_CACHE_NAME).then(async (cache) => {
                const cachedResponse = await matchTileInCache(cache, event.request);

                if (cachedResponse) {
                    fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                    }).catch(() => {});
                    
                    return cachedResponse;
                }

                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    return new Response('', { status: 404, statusText: 'Offline Tile Missing' });
                });
            })
        );
        return;
    }

    // B. Bypass external non-asset domains
    const allowedHosts = ['unpkg.com', 'raw.githubusercontent.com', 'cdnjs.cloudflare.com'];
    const isAllowedExternal = allowedHosts.some(host => url.hostname.includes(host));

    if (!url.origin.includes(self.location.origin) && !isAllowedExternal) {
        return; 
    }

    // C. Cache-First Strategy for Internal UI Shell & Static Assets
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (event.request.method === 'GET' && networkResponse && networkResponse.ok) {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }
                return networkResponse;
            }).catch(() => {
                if (
                    event.request.mode === 'navigate' ||
                    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))
                ) {
                    return caches.match('./index.html')
                        .then(res => res || caches.match('/index.html'))
                        .then(res => res || caches.match('/'));
                }
            });
        })
    );
});