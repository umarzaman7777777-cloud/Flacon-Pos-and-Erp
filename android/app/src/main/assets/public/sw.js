// Service Worker for Falcon Rod Maker POS
// Handles Offline Caching, Native Web Push Notifications, and Background Alerts

const CACHE_NAME = 'falcon-pos-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/falcon-theme-rod-logo.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('SW Precache non-critical failure:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
      })
    ])
  );
});

// Push notification event listener
self.addEventListener('push', (event) => {
  let data = {
    title: 'Falcon Rod Maker POS',
    body: 'New workshop notification received.',
    icon: '/falcon-theme-rod-logo.svg',
    badge: '/favicon.png',
    tag: 'falcon-pos-alert',
    url: '/'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/falcon-theme-rod-logo.svg',
    badge: data.badge || '/favicon.png',
    tag: data.tag || 'falcon-pos-notification',
    vibrate: [250, 100, 250],
    requireInteraction: true,
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Open POS' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification interaction
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Allow clients to request a native system notification through the Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const payload = event.data.payload || {};
    const title = payload.title || 'Falcon Rod Maker POS';
    const options = {
      body: payload.body || 'Workshop alert',
      icon: payload.icon || '/falcon-theme-rod-logo.svg',
      badge: payload.badge || '/favicon.png',
      tag: payload.tag || 'falcon-pos-msg',
      vibrate: payload.vibrate || [250, 100, 250],
      requireInteraction: true,
      data: payload.data || { url: '/' }
    };
    self.registration.showNotification(title, options);
  }
});

// Background Sync Event (triggered when device has network or periodic sync)
self.addEventListener('sync', (event) => {
  if (event.tag === 'falcon-sync-sheets' || event.tag === 'falcon-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'EXECUTE_BACKGROUND_SYNC' });
        }
      })
    );
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'falcon-sync-sheets' || event.tag === 'falcon-periodic-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'EXECUTE_BACKGROUND_SYNC' });
        }
      })
    );
  }
});

