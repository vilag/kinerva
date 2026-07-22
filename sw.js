const CACHE    = 'kinerva-v2';
const ORIGIN   = self.location.origin;
const SHELL    = [
  '/portal',
  '/paciente',
  '/privacidad',
  '/manifest.json',
  '/styles.css',
  '/logos/KINERVANE.png',
  '/icons/icon.svg',
];

/* ── Install: pre-cache app shell ────────────────────────────── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: purge old caches ──────────────────────────────── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: security-first cache strategy ───────────────────── */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Only handle GET from same origin
  if (e.request.method !== 'GET') return;
  if (url.origin !== ORIGIN) return;

  // Never cache API calls or admin panel
  const path = url.pathname;
  if (path.startsWith('/api/'))    return;
  if (path.startsWith('/admin'))   return;

  // Network-first for HTML pages (always fresh content)
  if (e.request.mode === 'navigate' || path.endsWith('.html') || path === '/portal' || path === '/paciente' || path === '/privacidad') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for static assets (CSS, fonts, images, icons)
  e.respondWith(
    caches.match(e.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok && url.origin === ORIGIN) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
  );
});
