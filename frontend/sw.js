// =========================================================================
// QSAFE Nepal Service Worker — v3
// Bump CACHE_NAME whenever static assets change.
// SW v3 evicts the old corrupt v2 cache on activation.
// =========================================================================
const CACHE_NAME = 'qsafe-nepal-v3';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './public/emergency_contacts.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('📦 SW v3: Caching core UI assets...');
            try {
                return await cache.addAll(ASSETS_TO_CACHE);
            } catch (err) {
                console.error('❌ SW v3: Cache addAll partial failure:', err);
            }
        })
    );
    // Take control immediately without waiting for old SW to die
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        // Evict ALL stale caches (v1, v2, etc.)
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => {
                    console.log(`🗑️ SW v3: Deleting stale cache: ${key}`);
                    return caches.delete(key);
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // ── Bypass rules: always fetch from network, never serve from cache ──
    if (
        event.request.method !== 'GET'                  ||
        url.pathname.startsWith('/api/')                 ||  // API endpoints
        url.search.includes('cachebust')                 ||  // explicit bypass
        url.search.match(/[?&]v=/)                       ||  // versioned assets (?v=3)
        !url.origin.includes(self.location.origin)           // external (USGS, etc.)
    ) {
        return; // Let browser handle natively — no respondWith()
    }

    // ── Cache-First for internal static assets ──
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request);
        })
    );
});