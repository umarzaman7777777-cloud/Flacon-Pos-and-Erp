// Service Worker for Falcon Rod Maker — POS & ERP
// Provides Offline Caching, Background Sync, Lockscreen Alerts (All Categories), and Deep-Link Routing

const CACHE_VERSION = 'falcon-pos-v3';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const FONT_CACHE = `fonts-${CACHE_VERSION}`;
const ALERTS_SNAPSHOT_CACHE = 'falcon-alerts-snapshot-v1';
const ALERTS_SNAPSHOT_URL = '/__falcon_alerts_snapshot__.json';

const DEFAULT_ICON = '/pwa-192x192.png';
const DEFAULT_BADGE = '/favicon.png';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',
  '/logo.svg',
  '/logo.png',
  '/logo-192.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/falcon-logo.png',
  '/falcon-theme-rod-logo.svg'
];

// Install: Pre-cache App Shell and core assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Non-critical precache warning:', err);
      });
    })
  );
});

// Activate: Clean up previous cache versions and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter(
              (key) =>
                key !== STATIC_CACHE &&
                key !== DYNAMIC_CACHE &&
                key !== FONT_CACHE &&
                key !== ALERTS_SNAPSHOT_CACHE
            )
            .map((key) => caches.delete(key))
        );
      })
    ])
  );
});

// Helper: Detect Vite development server module paths so we never stall or cache dev HMR modules
function isViteDevAsset(url) {
  const p = url.pathname;
  return (
    p.startsWith('/@vite') ||
    p.startsWith('/@react-refresh') ||
    p.startsWith('/@id/') ||
    p.startsWith('/@fs/') ||
    p.startsWith('/src/') ||
    p.startsWith('/node_modules/') ||
    url.searchParams.has('t') ||
    url.searchParams.has('v') ||
    /\.(ts|tsx|jsx|mts|cts)$/.test(p)
  );
}

// Fetch: Handle Offline Capabilities & Caching Strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and internal browser/chrome-extension requests
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // Never intercept API calls, Firestore RPC, or Vite dev source modules
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === ALERTS_SNAPSHOT_URL ||
    isViteDevAsset(url) ||
    url.hostname.includes('googleapis.com') && !url.hostname.includes('fonts.googleapis.com')
  ) {
    return;
  }

  // 1. Navigation requests (HTML documents): Network-first with fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
          return caches.match('/');
        })
    );
    return;
  }

  // 2. Google Fonts: Cache-first
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // 3. Static Assets (Images, SVGs, Fonts, Built Bundles): Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|webp|woff|woff2|ttf|json)$/) ||
    url.pathname.startsWith('/assets/');

  if (isStaticAsset && url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});

// Build standardized lockscreen notification options
function buildLockscreenOptions(payload) {
  const targetView = (payload && (payload.view || (payload.data && payload.data.view))) || 'notifications';
  const targetUrl =
    (payload && (payload.url || (payload.data && payload.data.url))) ||
    `/?view=${encodeURIComponent(targetView)}`;

  const category = (payload && payload.category) || 'general';
  const tag =
    (payload && payload.tag) || `falcon-${category}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const opts = {
    body: (payload && payload.body) || 'Workshop notification received.',
    icon: (payload && payload.icon) || DEFAULT_ICON,
    badge: (payload && payload.badge) || DEFAULT_BADGE,
    tag,
    renotify: payload && payload.renotify !== undefined ? payload.renotify : true,
    silent: payload && payload.silent !== undefined ? payload.silent : false,
    vibrate: (payload && payload.vibrate) || [260, 110, 260, 110, 300],
    requireInteraction: true,
    timestamp: (payload && payload.timestamp) || Date.now(),
    data: {
      ...(payload && payload.data ? payload.data : {}),
      category,
      view: targetView,
      url: targetUrl
    },
    actions: [
      { action: 'open', title: payload && payload.actionLabel ? payload.actionLabel : 'Open Now' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  // Chromium Web Notification Triggers (best-effort for true OS wake-up when scheduled)
  if (payload && payload.triggerAt && typeof self.TimestampTrigger === 'function') {
    try {
      opts.showTrigger = new self.TimestampTrigger(payload.triggerAt);
    } catch (_) {}
  }

  return opts;
}

// Dispatch any due alerts stored in SW snapshot cache (used when woken by sync / periodicsync)
async function dispatchAlertsFromSnapshot() {
  try {
    const cache = await caches.open(ALERTS_SNAPSHOT_CACHE);
    const res = await cache.match(ALERTS_SNAPSHOT_URL);
    if (!res) return;
    const snapshot = await res.json();
    if (!snapshot || !Array.isArray(snapshot.alerts) || snapshot.alerts.length === 0) return;

    const now = Date.now();
    const updatedAlerts = [];
    for (const item of snapshot.alerts) {
      if (!item || item.dispatched) continue;
      if (!item.dueAt || item.dueAt <= now) {
        const title = item.title || 'Falcon POS Alert';
        const opts = buildLockscreenOptions(item);
        await self.registration.showNotification(title, opts);
      } else {
        updatedAlerts.push(item);
      }
    }

    await cache.put(
      ALERTS_SNAPSHOT_URL,
      new Response(JSON.stringify({ updatedAt: now, alerts: updatedAlerts }), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
  } catch (err) {
    console.warn('[SW] Snapshot dispatch warning:', err);
  }
}

// Push notification event listener
self.addEventListener('push', (event) => {
  let data = {
    title: 'Falcon Rod Maker — POS & ERP',
    body: 'New workshop notification received.',
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: 'falcon-pos-alert',
    view: 'notifications',
    url: '/?view=notifications'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(self.registration.showNotification(data.title, buildLockscreenOptions(data)));
});

// Notification interaction click handler -> opens or focuses & routes to exact view
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notifData = event.notification.data || {};
  const targetView = notifData.view || 'notifications';
  const targetUrl = notifData.url || `/?view=${encodeURIComponent(targetView)}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      // Focus existing app window and navigate directly via postMessage
      for (const client of clientList) {
        if (client.url && client.url.startsWith(self.location.origin) && 'focus' in client) {
          await client.focus();
          client.postMessage({
            type: 'NAVIGATE_FROM_NOTIFICATION',
            view: targetView,
            data: notifData
          });
          return;
        }
      }
      // App was completely closed -> launch directly into target view URL
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Client messages for immediate, scheduled, and background-snapshot notifications
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || !msg.type) return;

  if (msg.type === 'SHOW_NOTIFICATION') {
    const payload = msg.payload || {};
    const title = payload.title || 'Falcon Rod Maker — POS & ERP';
    event.waitUntil(self.registration.showNotification(title, buildLockscreenOptions(payload)));
    return;
  }

  if (msg.type === 'SCHEDULE_NOTIFICATION') {
    const payload = msg.payload || {};
    const delayMs = Math.max(0, Number(msg.delayMs || 3000));
    const title = payload.title || 'Falcon POS Lockscreen Alert';
    const triggerAt = Date.now() + delayMs;

    // If native Web Notification TimestampTrigger exists, register immediately
    if (typeof self.TimestampTrigger === 'function') {
      event.waitUntil(
        self.registration.showNotification(
          title,
          buildLockscreenOptions({ ...payload, triggerAt })
        )
      );
      return;
    }

    // Wait inside extendLifetime waitUntil while timer completes (survives screen lock for short/medium delays)
    event.waitUntil(
      new Promise((resolve) => {
        setTimeout(() => {
          self.registration
            .showNotification(title, buildLockscreenOptions(payload))
            .finally(resolve);
        }, delayMs);
      })
    );
    return;
  }

  if (msg.type === 'STORE_ALERTS_SNAPSHOT') {
    const alerts = Array.isArray(msg.alerts) ? msg.alerts : [];
    event.waitUntil(
      caches
        .open(ALERTS_SNAPSHOT_CACHE)
        .then((cache) =>
          cache.put(
            ALERTS_SNAPSHOT_URL,
            new Response(JSON.stringify({ updatedAt: Date.now(), alerts }), {
              headers: { 'Content-Type': 'application/json' }
            })
          )
        )
        .catch(() => {})
    );
  }
});

// Background Sync (triggers client sync + dispatches due workshop alerts even off-screen)
self.addEventListener('sync', (event) => {
  if (
    event.tag === 'falcon-sync-sheets' ||
    event.tag === 'falcon-sync' ||
    event.tag === 'falcon-alerts-check'
  ) {
    event.waitUntil(
      Promise.all([
        dispatchAlertsFromSnapshot(),
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: 'EXECUTE_BACKGROUND_SYNC' });
          }
        })
      ])
    );
  }
});

// Periodic Background Sync (installed PWA wake-up while phone is off / locked)
self.addEventListener('periodicsync', (event) => {
  if (
    event.tag === 'falcon-sync-sheets' ||
    event.tag === 'falcon-periodic-sync' ||
    event.tag === 'falcon-alerts-periodic'
  ) {
    event.waitUntil(
      Promise.all([
        dispatchAlertsFromSnapshot(),
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: 'EXECUTE_BACKGROUND_SYNC' });
          }
        })
      ])
    );
  }
});
