/**
 * PWA Service Worker Registration & Lifecycle Management
 * Keeps /sw.js registered (with Vite dev-module pass-through inside sw.js)
 * so ServiceWorker lockscreen notifications & background periodic sync work everywhere.
 */

export async function registerPwaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  const registerNow = async (): Promise<ServiceWorkerRegistration | null> => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.debug('[PWA] Service Worker registered with scope:', registration.scope);

      // Best-effort Periodic Background Sync registration for installed PWAs (off-screen checks)
      const regWithPeriodic = registration as ServiceWorkerRegistration & {
        periodicSync?: {
          register: (tag: string, opts?: { minInterval?: number }) => Promise<void>;
        };
      };
      if (regWithPeriodic.periodicSync && 'permissions' in navigator) {
        try {
          const permStatus = await navigator.permissions.query({
            name: 'periodic-background-sync' as PermissionName
          });
          if (permStatus.state === 'granted') {
            await regWithPeriodic.periodicSync.register('falcon-alerts-periodic', {
              minInterval: 60 * 60 * 1000 // 1 hour
            });
          }
        } catch {
          // Non-fatal on browsers without periodicSync support
        }
      }

      return registration;
    } catch (error) {
      console.debug('[PWA] Service Worker registration notice:', error);
      return null;
    }
  };

  if (document.readyState === 'complete') {
    return await registerNow();
  }

  return await new Promise((resolve) => {
    window.addEventListener(
      'load',
      () => {
        registerNow().then(resolve);
      },
      { once: true }
    );
  });
}
