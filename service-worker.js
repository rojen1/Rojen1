const CACHE_NAME = 'rojen1-v38';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.json',
  './js/app.js',
  './js/version.js',
  './js/theme.js',
  './js/auth.js',
  './js/accounts.js',
  './js/regions.js',
  './js/waybill.js',
  './js/firebase.js',
  './js/firebase-config.js',
  './js/storage.js',
  './js/calculations.js',
  './js/client-history.js',
  './js/reorder.js',
  './js/export.js',
  './js/cash-calculator.js',
  './js/views/daily.js',
  './js/views/archive.js',
  './js/views/settings.js',
  './js/views/admin.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isAppAsset(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html')) {
    return true;
  }
  return url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) return;
  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('firebaseapp.com')) return;

  if (!isAppAsset(url)) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // Network-first for app shell — fresh updates when online, cache when offline.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
