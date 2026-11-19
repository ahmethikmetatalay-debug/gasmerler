// Uygulama olarak yüklenebilmek için gereken en basit service worker.
// Önbellek tutmaz: oyun zaten internet ister. GitHub Pages sayfaları 10 dakika önbellekte tutturuyor;
// oyunun kendi dosyaları her açılışta sunucuya sorulur (değişmediyse kısa bir "aynı" cevabı gelir),
// böylece her güncelleme anında gelir.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const ayniSite = new URL(r.url).origin === self.location.origin;
  if (!ayniSite) { e.respondWith(fetch(r)); return; }
  e.respondWith(fetch(r.mode === 'navigate' ? r.url : r, { cache: 'no-cache', credentials: 'same-origin' }).catch(() => fetch(r)));
});
