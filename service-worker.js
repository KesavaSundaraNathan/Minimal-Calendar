/* Authenwrite Calendar service worker — offline shell + notification handling. */

const CACHE = 'authenwrite-calendar-v2';

const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'src/index.js',
  'src/App.js',
  'src/styles/global.css',
  'src/components/dayView.js',
  'src/components/dialogs.js',
  'src/components/logPage.js',
  'src/components/modal.js',
  'src/components/monthView.js',
  'src/components/progress.js',
  'src/components/settingsPage.js',
  'src/components/toast.js',
  'src/components/weekView.js',
  'src/utils/actions.js',
  'src/utils/backup.js',
  'src/utils/dates.js',
  'src/utils/db.js',
  'src/utils/notifications.js',
  'src/utils/store.js',
  'src/utils/undo.js',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'fonts/SFProDisplay-Regular.otf',
  'fonts/SFProDisplay-Medium.otf',
  'fonts/SFProDisplay-Bold.otf'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
      return response;
    }).catch(() => cached))
  );
});

self.addEventListener('notificationclick', (event) => {
  const date = (event.notification.data && event.notification.data.date) || null;
  const action = event.action || '';
  const title = event.notification.title;
  event.notification.close();

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    if (action.startsWith('snooze-')) {
      const minutes = Number(action.split('-')[1]);
      if (clientList.length) {
        clientList[0].postMessage({ type: 'snooze', title, minutes });
      } else {
        setTimeout(() => self.registration.showNotification(title, { body: 'Snoozed reminder' }), minutes * 60000);
      }
      return;
    }

    for (const client of clientList) {
      if ('focus' in client) {
        client.postMessage({ type: 'open-date', date });
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow('./');
  })());
});
