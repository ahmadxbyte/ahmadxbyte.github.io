const CACHE_VERSION = 'mm-v1.0.2-b11';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './i18n.js',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith('mm-v') && k !== CACHE_VERSION)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json') || url.pathname === '/version.json') return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      if (req.mode === 'navigate') {
        try {
          const fresh = await fetch(new Request(req.url, { cache: 'reload' }));
          if (fresh && fresh.ok && fresh.type === 'basic') {
            cache.put(req, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch (_) {
          const cachedNav = await cache.match(req) || await cache.match('./index.html');
          if (cachedNav) return cachedNav;
          throw _;
        }
      }
      const cached = await cache.match(req, { ignoreSearch: false });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok && res.type === 'basic') {
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch (err) {
        throw err;
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || './?openNotif=' + encodeURIComponent(data.id || '');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'OPEN_SUBSCRIPTION_RECEIPT', notification: data });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    })
  );
});
