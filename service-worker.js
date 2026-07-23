const CACHE = 'mind-games-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=1.1.0',
  './fixes-v2.css?v=1.1.0',
  './app-v2-loader.js?v=1.1.0',
  './app-v2.part-1.txt?v=1.1.0',
  './app-v2.part-2.txt?v=1.1.0',
  './app-v2.part-3.txt?v=1.1.0',
  './app-v2.part-4.txt?v=1.1.0',
  './app-v2.part-5.txt?v=1.1.0',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/apple-touch-icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
