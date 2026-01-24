// Service Worker for InmoGestor Pro - v69 (Fresh Start)
const CACHE_NAME = 'inmogestor-pro-v69';
const urlsToCache = [
    './',
    './index.html?v=69',
    './css/styles.css?v=69',
    './js/app.js?v=69',
    './js/storage.js?v=69',
    './js/auth.js?v=69',
    './js/properties.js?v=69',
    './js/clients.js?v=69',
    './js/followups.js?v=69',
    './js/signs.js?v=69',
    './js/financials.js?v=69',
    './js/pdf-generator.js?v=69',
    './img/profile.jpg'
];

// Install event
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache v69');
                return cache.addAll(urlsToCache);
            })
    );
});

// Activate event - Clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    console.log('Deleting old cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        })
    );
});

// Fetch event - FORCE NETWORK for HTML and Version Check
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

// Listen for skipWaiting
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
