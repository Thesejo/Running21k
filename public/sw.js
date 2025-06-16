const CACHE_NAME = 'carrera-gps-maplibre-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/socket.io/socket.io.js',
    'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js',
    'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('fetch', (event) => {
    // Excluir las conexiones de socket.io del cache
    if (event.request.url.includes('socket.io')) {
        return fetch(event.request);
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});
