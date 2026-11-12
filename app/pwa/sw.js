/* Houle : fonctionne hors connexion. L'appli est servie depuis le cache et mise à jour en arrière-plan. */
const CACHE = 'houle-v1';
const SHELL = ['./houle.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // cartes, météo, Leaflet : toujours le réseau
  if (/\/(meta\.json|pres\.json|.*\.bin\.gz)$/.test(url.pathname)) return;  // données météo : jamais en cache
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/houle.html');
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(isPage ? './houle.html' : req, { ignoreSearch: true });
      const net = fetch(req).then((r) => { if (r && r.ok) c.put(isPage ? './houle.html' : req, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || new Response('Hors connexion', { status: 503 });
    })
  );
});
