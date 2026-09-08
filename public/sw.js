/* GLSK Web Push Service Worker — v6.9 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: 'GLSK', body: event.data ? event.data.text() : 'New league activity' }; }

  event.waitUntil(self.registration.showNotification(
    data.title || 'Great Lake State Keepers',
    {
      body: data.body || 'New league activity',
      icon: '/glsk-icon-192.png',
      badge: '/glsk-badge-96.png',
      tag: data.tag || `glsk-${Date.now()}`,
      renotify: true,
      data: { url: data.url || '/league?tab=notifications', eventId: data.eventId || null }
    }
  ));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/league?tab=notifications', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('navigate' in client) {
        await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
