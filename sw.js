/* ESPC 娃娃車 — Service Worker
   用途：接收推播（App 關著也收得到）、讓網頁可以「加入主畫面」
   不做離線快取，永遠走網路 */
const SW_VERSION = 'bus-v2';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (err) { p = { body: e.data ? e.data.text() : '' }; }
  const d = p.data || p, n = p.notification || {};
  const title = d.title || n.title || '娃娃車預約';
  const url = d.url || './';
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body: d.body || n.body || '', tag: d.tag || 'bus', renotify: true,
      icon: 'icon-192.png', badge: 'icon-192.png', data: { url: url }
    }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      list.forEach(function (c) { c.postMessage({ type: 'push', url: url }); });
    })
  ]));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  // iPhone：App 在背景時常常收不到 postMessage → 另外記下「要打開哪一筆」，App 回到前景自己來拿
  const keep = caches.open('bus-open').then(function (c) { return c.put('./__open', new Response(JSON.stringify({ url: url, at: Date.now() }))); }).catch(function () {});
  e.waitUntil(keep.then(function () { return self.clients.matchAll({ type: 'window', includeUncontrolled: true }); }).then(function (list) {
    for (let i = 0; i < list.length; i++) {
      if ('focus' in list[i]) { list[i].postMessage({ type: 'open', url: url }); return list[i].focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
