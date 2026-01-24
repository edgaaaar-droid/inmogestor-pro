// Service Worker for InmoGestor Pro - v70
const CACHE_NAME = 'inmogestor-pro-v70';
const urlsToCache = [
    './',
    './index.html?v=70',
    './css/styles.css?v=70',
    './js/app.js?v=70',
    './js/storage.js?v=70',
    './js/auth.js?v=70',
    './js/properties.js?v=70',
    './js/clients.js?v=70',
    './js/followups.js?v=70',
    './js/signs.js?v=70',
    './js/financials.js?v=70',
    './js/pdf-generator.js?v=70',
    './img/profile.jpg'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames.map(name => caches.delete(name))
        ))
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('version.json')) {
        event.respondWith(fetch(event.request).catch(() => new Response('{"version": 0}')));
        return;
    }
    if (event.request.mode === 'navigate' || event.request.url.includes('index.html')) {
        event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
        return;
    }
    event.respondWith(
        fetch(event.request).then(response => {
            if (response && response.status === 200) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
        }).catch(() => caches.match(event.request))
    );
});
