/**
 * PWA Service Worker Registration & Lifecycle Management
 * Ensures offline caching is active immediately on app startup
 */

export function registerPwaServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // In development and AI Studio preview environment, unregister any active service worker
  // to prevent it from intercepting Vite dev-server modules or causing preview load stalls.
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});
    return;
  }

  // In production builds (or standalone installed PWA), register service worker for offline support
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.debug('[PWA] Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.debug('[PWA] Service Worker registration notice:', error);
      });
  });
}
