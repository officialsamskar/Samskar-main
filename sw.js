/* Samskar service worker — offline shell with safe fallbacks.
 * Navigations: network-first (fresh content), cache fallback when offline/slow.
 * Same-origin assets: stale-while-revalidate. Bump VERSION to flush old caches. */
const VERSION = 'v1';
const CACHE = 'samskar-' + VERSION;
const PRECACHE = ['/', '/404.html', '/favicon.ico', '/icon-192.png', '/images/logo.webp', '/selfheal.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('samskar-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheable(req, res) {
  const url = new URL(req.url);
  return res && res.ok && res.type === 'basic' && !url.search;
}

async function networkFirst(req) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(req, { signal: ctrl.signal });
    clearTimeout(timer);
    if (cacheable(req, res)) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
    return res;
  } catch (err) {
    clearTimeout(timer);
    return (await caches.match(req)) || (await caches.match('/')) || (await caches.match('/404.html')) ||
      new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function staleWhileRevalidate(req) {
  const cached = await caches.match(req);
  const refresh = fetch(req).then(async (res) => {
    if (cacheable(req, res)) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
    return res;
  }).catch(() => null);
  return cached || (await refresh) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;      // never touch third-party (fonts, WhatsApp)
  if (url.pathname === '/sw.js') return;
  event.respondWith(req.mode === 'navigate' ? networkFirst(req) : staleWhileRevalidate(req));
});
