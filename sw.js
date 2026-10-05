/* ESPC 監測行程 — Service Worker
   用途：1) 接收 Firebase 推播並顯示通知（App 關著也收得到）
        2) 讓網站可「加入主畫面」成為 PWA
   注意：不做離線快取，永遠走網路，避免舊版卡住 */

const SW_VERSION = 'espc-v8';

/* 通知紀錄＋App 圖示紅點：每則推播記在 Cache Storage（最多 60 則），
   紅點數字＝還沒看過的則數；點通知、或在 App 的通知列表點開／全部已讀，才會減少（index.html notes*） */
const NOTE_KEY = './__notes';
function notesGet(c) { return c.match(NOTE_KEY).then(function (r) { return r ? r.json() : []; }).catch(function () { return []; }); }
function notesEdit(fn) {
  return caches.open('espc-badge').then(function (c) {
    return notesGet(c).then(function (list) {
      list = fn(list || []) || list;
      const n = list.filter(function (x) { return !x.r; }).length;
      return c.put(NOTE_KEY, new Response(JSON.stringify(list.slice(0, 60)))).then(function () {
        if (self.navigator && self.navigator.setAppBadge) return n ? self.navigator.setAppBadge(n) : self.navigator.clearAppBadge();
      });
    });
  }).catch(function () {});
}

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

/* App 問版本（更多頁顯示「推播服務 espc-vN」，確認手機已換成新版） */
self.addEventListener('message', function (e) {
  const d = e.data || {};
  if (d.type === 'ver' && e.source) e.source.postMessage({ type: 'ver', v: SW_VERSION, badge: !!(self.navigator && self.navigator.setAppBadge) });
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
  const nid = 'n' + Date.now() + Math.random().toString(36).slice(2, 6);
  const jobs = [self.registration.showNotification(title, {
    body: body,
    tag: d.cid ? 'espc-cast-' + d.cid : 'espc-' + (url.split('d=')[1] || 'push'),   // 同一天的提醒只留最新一則；廣播每則分開
    renotify: !d.recall,          // 收回：安靜地把原本那則換掉，不再響
    silent: !!d.recall,
    icon: 'icon-192-v3.png',
    badge: 'icon-192-v3.png',
    data: { url: url, nid: nid }
  })];
  // 記到通知列表、紅點 +1；收回的廣播：把原本那則從列表拿掉
  jobs.push(notesEdit(function (list) {
    if (d.recall) return list.filter(function (x) { return !(d.cid && x.c === String(d.cid)); });
    return [{ id: nid, t: title, b: body, u: url, c: d.cid ? String(d.cid) : '', at: Date.now(), r: 0 }].concat(list);
  }));
  // 廣播回條：手機收到就回報「送達」（App 關著也會跑）
  if (d.cid && d.rurl && d.sig && !d.recall) {
    const payload = JSON.stringify({ fn: 'castReceipt', args: [d.cid, d.u, 'd', d.sig] });
    jobs.push(fetch(d.rurl + '?payload=' + encodeURIComponent(payload), { mode: 'no-cors' }).catch(function () {}));
  }
  // App 開著的話，通知畫面馬上重新整理廣播
  jobs.push(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    list.forEach(function (c) { c.postMessage({ type: 'push', cid: d.cid || '', recall: !!d.recall, title: title }); });
  }).catch(function () {}));
  e.waitUntil(Promise.all(jobs));
});

/* 點通知：已開著的 App 就切過去並跳到那一天，沒開就開新的 */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  const nid = e.notification.data && e.notification.data.nid;
  e.waitUntil(notesEdit(function (list) { list.forEach(function (x) { if (x.id === nid) x.r = 1; }); return list; }).then(function () { return
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if ('focus' in c) {
          // App 已經開著：不重新載入整頁，叫畫面直接跳過去（快很多）
          c.postMessage({ type: 'open', url: target });
          return c.focus().catch(function () {});
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }); })
  );
});
