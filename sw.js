// Sand service worker: lets the home-screen app open offline. Network first (so updates show up on the
// next launch), falling back to the cached copy. Cache name changes with every build.
const CACHE = 'sand-mwd32q6o';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'apple-touch-icon.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('sand-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !font) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // a launch on a bad connection should not hang: after 4 s use the cached copy if there is one
      const net = fetch(req);
      const cached = req.mode === 'navigate' ? await cache.match(req, { ignoreSearch: true }) : null;
      const res = cached ? await Promise.race([net, new Promise((r) => setTimeout(() => r(cached), 4000))]) : await net;
      if (res === cached) { net.then((r) => { if (r && r.ok) cache.put(req, r.clone()); }).catch(() => {}); return res; }
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      if (req.mode === 'navigate') { const idx = await cache.match('index.html') || await cache.match('./'); if (idx) return idx; }
      throw err;
    }
  })());
});
