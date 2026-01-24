// Service Worker for InmoGestor Pro
const CACHE_NAME = 'inmogestor-pro-v65';
const urlsToCache = [
    './',
    './index.html?v=60',
    './css/styles.css?v=60',
    './js/app.js?v=60',
    './js/storage.js?v=60',
    './js/auth.js?v=60',
    './js/properties.js?v=60',
    './js/clients.js?v=60',
    './js/followups.js?v=60',
    './js/signs.js?v=60',
    './js/financials.js?v=60',
    './js/pdf-generator.js?v=60',
    './img/profile.jpg'
];

// Install event
self.addEventListener('install', event => {
    // Force immediate activation
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Activate event - Clean old caches
// Activate event - Clean old caches
self.addEventListener('activate', event => {
    // Take control of all clients immediately
    event.waitUntil(clients.claim());

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Nuclear Option: Delete ALL caches to force fresh start
                    console.log('Deleting cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        })
    );
});

// Fetch event - network first, fallback to cache
// Fetch event - FORCE NETWORK for HTML
self.addEventListener('fetch', (event) => {
    // Exclude version.json from cache - ALWAYS Network First
    if (event.request.url.includes('version.json')) {
        event.respondWith(
            fetch(event.request).then(response => response).catch(() => new Response('{"version": 0}'))
        );
        return;
    }

    // Force Network for HTML (Navigation)
    if (event.request.mode === 'navigate' || event.request.url.includes('index.html')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone and cache the response
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});

// Listen for messages to update cache
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
