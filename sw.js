/* ESPC 監測行程 — Service Worker
   用途：1) 接收 Firebase 推播並顯示通知（App 關著也收得到）
        2) 讓網站可「加入主畫面」成為 PWA
   注意：不做離線快取，永遠走網路，避免舊版卡住 */

const SW_VERSION = 'espc-v2';

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

/* 推播：後端送的是 data 訊息 {title, body, url}；也相容 notification 格式 */
self.addEventListener('push', function (e) {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (err) { p = { body: e.data ? e.data.text() : '' }; }
  const d = p.data || p;
  const n = p.notification || {};
  const title = d.title || n.title || 'ESPC 監測行程';
  const body = d.body || n.body || '';
  const url = d.url || (p.fcmOptions && p.fcmOptions.link) || './';
  e.waitUntil(self.registration.showNotification(title, {
    body: body,
    tag: 'espc-' + (url.split('d=')[1] || 'push'),   // 同一天的提醒只留最新一則
    renotify: true,
    icon: 'icon-192-v3.png',
    badge: 'icon-192-v3.png',
    data: { url: url }
  }));
});

/* 點通知：已開著的 App 就切過去並跳到那一天，沒開就開新的 */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if ('focus' in c) {
          if ('navigate' in c) return c.navigate(target).then(function (w) { return (w || c).focus(); });
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
