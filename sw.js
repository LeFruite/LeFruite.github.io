/* Сервіс-воркер кабінету вчителя: сторінки відкриваються навіть при слабкому зв'язку.
   Сторінки учнів (index.html, live.html) і запити до Apps Script він не чіпає. */
const CACHE = 'samostiini-v3', FONTS = 'samostiini-fonts-v1';
const SHELL = ['editor.html', 'makeup.html', 'plan.html', 'grades.html', 'materials.html', 'journal.html', 'students.html', 'setup.html',
  'seating.html', 'live-teacher.html', 'docs.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// мережа з коротким очікуванням: якщо відповіді немає за ~3 с — беремо збережену копію (а мережа тим часом оновлює її)
function netFirst(r, ms) {
  return new Promise(resolve => {
    let done = false;
    const fromCache = () => caches.match(r).then(m => { if (m && !done) { done = true; resolve(m); } return m; });
    const t = setTimeout(fromCache, ms);
    fetch(r).then(res => {
      clearTimeout(t);
      if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); }
      if (!done) { done = true; resolve(res); }
    }).catch(() => { clearTimeout(t); fromCache().then(m => { if (!m && !done) { done = true; resolve(Response.error()); } }); });
  });
}
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (/(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname)) {   // шрифти: спершу збережене, у фоні оновлюється
    e.respondWith(caches.open(FONTS).then(c => c.match(r).then(hit => {
      const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  if (u.origin !== location.origin) return;                                   // Apps Script та інше — завжди напряму
  if (/\/(index|live)\.html$/.test(u.pathname) || u.pathname.endsWith('/')) return;   // сторінки учнів — лише з мережі
  if (/\.(html|js|css|webmanifest)$/.test(u.pathname)) { e.respondWith(netFirst(r, 3000)); return; }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); } return res; })));
});
