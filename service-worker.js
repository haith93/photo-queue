/* Offline shell, trimmed from where_is_haitham. Bump VERSION on each deploy
   that changes the SHELL list. Supabase traffic is never cached: a queue
   that silently shows stale tasks is worse than one that says it is offline. */
const VERSION = 'pq-v1';
const SHELL = [
  './', './index.html', './manifest.json', './css/app.css',
  './js/app.js', './js/i18n.js', './js/queue.js', './js/supabase.js',
  './assets/icons/icon.svg', './assets/icons/icon-192.png', './assets/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // One missing file must not fail the whole install.
    await Promise.all(SHELL.map(url => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname.endsWith('.supabase.co')) return;

  // Pages and our own code: network first, so HTML and JS always come from the same deploy.
  if (request.mode === 'navigate' || (url.origin === self.location.origin && /\.(js|css|json)$/.test(url.pathname))) {
    event.respondWith(networkFirst(request));
  } else if (url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request))
        ?? (request.mode === 'navigate' ? await cache.match('./index.html') : undefined)
        ?? new Response('', { status: 504 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached ?? (await network) ?? new Response('', { status: 504 });
}
