/* ==========================================================================
   BiliLIST notification worker
   --------------------------------------------------------------------------
   Low-stock alerts are shown through the browser's Notification API. A tiny
   service worker is enough to make them work on Android/Chrome, and clicking
   one brings the open BiliLIST tab back into focus (or opens a new one).
   Assets are not cached here on purpose: the app already versions its files.
   ========================================================================== */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i++) {
        var client = windows[i];
        if (client.url.indexOf(self.registration.scope) === 0 && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
      return null;
    })
  );
});
