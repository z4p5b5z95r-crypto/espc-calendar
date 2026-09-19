/* ESPC 監測行程 — Service Worker
   用途：1) 顯示系統通知（Android／PWA 必須透過 SW 才能跳通知）
        2) 讓網站可「加入主畫面」成為 PWA
   注意：不做離線快取，永遠走網路，避免舊版卡住 */

const SW_VERSION = 'espc-v1';

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

/* 由頁面呼叫：postMessage({type:'notify', title, body, tag}) */
self.addEventListener('message', function (e) {
  const d = e.data || {};
  if (d.type !== 'notify') return;
  self.registration.showNotification(d.title || 'ESPC 監測行程', {
    body: d.body || '',
    tag: d.tag || 'espc-daily',
    renotify: true,
    requireInteraction: false,
    badge: 'icon.png',
    icon: 'icon.png',
    data: { url: d.url || './' }
  });
});

/* 點通知 → 切到已開啟的分頁，沒有就開新的 */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (let i = 0; i < list.length; i++) {
        if ('focus' in list[i]) return list[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

/* 預留：接上推播伺服器（OneSignal 等）後即可收背景推播 */
self.addEventListener('push', function (e) {
  let payload = {};
  try { payload = e.data ? e.data.json() : {}; } catch (err) { payload = {}; }
  e.waitUntil(
    self.registration.showNotification(payload.title || 'ESPC 監測行程', {
      body: payload.body || '',
      tag: payload.tag || 'espc-push',
      icon: 'icon.png',
      badge: 'icon.png',
      data: { url: payload.url || './' }
    })
  );
});
