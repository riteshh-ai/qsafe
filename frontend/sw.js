const CACHE_NAME = 'qsafe-nepal-v2';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',                  // Added missing stylesheet for offline rendering
    './app.js',
    './public/emergency_contacts.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('📦 Locking core UI assets into offline cache memory...');
            try {
                return await cache.addAll(ASSETS_TO_CACHE);
            } catch (err) {
                console.error('❌ Cache addAll failed for some assets:', err);
            }
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Completely bypass external domains, API calls, POSTs, or cachebust queries
    if (
        event.request.method !== 'GET' || 
        url.pathname.startsWith('/api/') || 
        url.search.includes('cachebust') ||
        !url.origin.includes(self.location.origin) // Bypasses external URL checks like google favicon & USGS endpoints
    ) {
        return; // Native network handling
    }

    // 2. Cache-First Strategy for internal static UI assets
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            // Let the network fetch proceed natively and propagate errors if offline
            return fetch(event.request);
        })
    );
});