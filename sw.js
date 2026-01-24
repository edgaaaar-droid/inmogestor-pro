// Service Worker for InmoGestor Pro
const CACHE_NAME = 'inmogestor-pro-v53';
const urlsToCache = [
    './',
    './index.html?v=53',
    './css/styles.css?v=53',
    './js/app.js?v=53',
    './js/storage.js?v=53',
    './js/auth.js?v=53',
    './js/properties.js?v=53',
    './js/clients.js?v=53',
    './js/followups.js?v=53',
    './js/signs.js?v=53',
    './js/pdf-generator.js?v=53',
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
self.addEventListener('activate', event => {
    // Take control of all clients immediately
    event.waitUntil(clients.claim());

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
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
