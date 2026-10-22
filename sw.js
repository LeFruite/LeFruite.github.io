/* Сервіс-воркер для кабінету вчителя: застосунок відкривається навіть при слабкому зв'язку.
   Сторінки учнів (index.html, live.html) і запити до Apps Script він не чіпає. */
const CACHE = 'samostiini-v1';
const SHELL = ['editor.html', 'seating.html', 'live-teacher.html', 'docs.html', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (/\/(index|live)\.html$/.test(u.pathname) || u.pathname.endsWith('/') ) return;   // сторінки учнів — лише з мережі
  e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); } return res; }).catch(() => caches.match(r)));
});
