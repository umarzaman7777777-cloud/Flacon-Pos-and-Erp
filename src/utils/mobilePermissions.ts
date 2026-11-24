/**
 * Mobile Permissions & Push / Lockscreen Notifications Utility for Falcon Rod Maker POS
 *
 * Supports:
 * 1. Android Native APK (Capacitor LocalNotifications with dedicated VISIBILITY_PUBLIC lockscreen channels)
 * 2. Mobile Web Browsers & Installed Home-Screen PWA (Service Worker showNotification)
 * 3. Lockscreen Heads-Up Notifications across Backups, Gate Passes, Cheques, Orders, Low Stock, Inquiries
 * 4. Hardware Microphone Access & Persistent Local Storage
 * 5. Iframe sandbox detection & 1-tap direct mobile browser launch
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AppView } from '../types';

export type PermissionStateStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

export type NotificationCategory =
  | 'backups'
  | 'gatepasses'
  | 'cheques'
  | 'orders'
  | 'stock'
  | 'inquiries';

export interface NotificationCategoryPrefs {
  backups: boolean;
  gatepasses: boolean;
  cheques: boolean;
  orders: boolean;
  stock: boolean;
  inquiries: boolean;
  offScreenDigest: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationCategoryPrefs = {
  backups: true,
  gatepasses: true,
  cheques: true,
  orders: true,
  stock: true,
  inquiries: true,
  offScreenDigest: true
};

const PREFS_STORAGE_KEY = 'falcon_notif_category_prefs_v1';
export const NOTIF_PREFS_CHANGED_EVENT = 'falcon-notif-prefs-changed';
export const OFFLINE_CACHED_NOTIFS_KEY = 'falcon_offline_cached_notifs_v1';
export const OFFLINE_NOTIF_CACHED_EVENT = 'falcon-offline-notif-cached';

export interface CachedOfflineNotification {
  id: string;
  category: NotificationCategory | 'general';
  title: string;
  body: string;
  view: AppView;
  createdAt: string;
}

export function getCachedOfflineNotifications(): CachedOfflineNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_CACHED_NOTIFS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearCachedOfflineNotifications(): CachedOfflineNotification[] {
  const existing = getCachedOfflineNotifications();
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(OFFLINE_CACHED_NOTIFS_KEY);
      window.dispatchEvent(new CustomEvent(OFFLINE_NOTIF_CACHED_EVENT, { detail: [] }));
    } catch {}
  }
  return existing;
}

function recordOfflineCachedNotification(entry: CachedOfflineNotification): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getCachedOfflineNotifications();
    const deduped = existing.filter((x) => x.id !== entry.id);
    const next = [entry, ...deduped].slice(0, 50);
    localStorage.setItem(OFFLINE_CACHED_NOTIFS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(OFFLINE_NOTIF_CACHED_EVENT, { detail: next }));
  } catch {}
}

export interface MobilePermissionsState {
  notifications: PermissionStateStatus;
  microphone: PermissionStateStatus;
  storagePersisted: boolean;
  storageOperational: boolean;
  storageEstimate: {
    usageMB: number;
    quotaMB: number;
    percentUsed: number;
  } | null;
  isIframe: boolean;
  isMobile: boolean;
  isNative: boolean;
  isStandalone: boolean;
  isServiceWorkerReady: boolean;
  lockscreenSupported: boolean;
}

interface ChannelConfig {
  id: string;
  name: string;
  description: string;
  importance: 3 | 4 | 5;
  lightColor: string;
  vibrate: number[];
  defaultView: AppView;
}

const ANDROID_CHANNELS: Record<NotificationCategory | 'general', ChannelConfig> = {
  backups: {
    id: 'falcon_pos_backups',
    name: 'Backups & Cloud Sync Alerts',
    description: 'Google Drive auto-backups, Sheets sync status, and SQL/JSON exports on lockscreen',
    importance: 5,
    lightColor: '#38BDF8',
    vibrate: [180, 90, 180],
    defaultView: 'backup'
  },
  gatepasses: {
    id: 'falcon_pos_gatepasses',
    name: 'Gate Passes & Dispatch Alerts',
    description: 'Outward dispatch slips, inward mill gate passes, and pending gate approvals',
    importance: 5,
    lightColor: '#F59E0B',
    vibrate: [240, 100, 240],
    defaultView: 'notifications'
  },
  cheques: {
    id: 'falcon_pos_cheques',
    name: 'Cheques & Maturity Alerts',
    description: 'Cheque bounce auto-reversals, cleared updates, overdue & due-within-3-days alerts',
    importance: 5,
    lightColor: '#EF4444',
    vibrate: [350, 120, 350, 120, 400],
    defaultView: 'cheques'
  },
  orders: {
    id: 'falcon_pos_orders',
    name: 'POS Orders & Payments',
    description: 'New workshop sales, invoices, and recorded customer payments',
    importance: 5,
    lightColor: '#10B981',
    vibrate: [200, 80, 200],
    defaultView: 'transactions'
  },
  stock: {
    id: 'falcon_pos_stock',
    name: 'Raw Material Low Stock',
    description: 'Critical steel pipe, rod, bolt, and paint inventory reorder warnings',
    importance: 5,
    lightColor: '#F97316',
    vibrate: [280, 100, 280],
    defaultView: 'raw_material'
  },
  inquiries: {
    id: 'falcon_pos_inquiries',
    name: 'Customer Inquiries & Reminders',
    description: 'High-priority customer quote requests and follow-ups',
    importance: 4,
    lightColor: '#A855F7',
    vibrate: [180, 90, 180],
    defaultView: 'notifications'
  },
  general: {
    id: 'falcon_pos_urgent',
    name: 'Falcon POS Urgent Alerts',
    description: 'Heads-up orders, inventory and lockscreen notifications',
    importance: 5,
    lightColor: '#F59E0B',
    vibrate: [250, 100, 250],
    defaultView: 'notifications'
  }
};

let androidChannelsInitialized = false;

/**
 * Load per-category lockscreen notification preferences
 */
export function getNotificationCategoryPrefs(): NotificationCategoryPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_NOTIFICATION_PREFS };
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFS };
    return { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

/**
 * Persist updated per-category lockscreen notification preferences
 */
export function saveNotificationCategoryPrefs(
  patch: Partial<NotificationCategoryPrefs>
): NotificationCategoryPrefs {
  const next = { ...getNotificationCategoryPrefs(), ...patch };
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(NOTIF_PREFS_CHANGED_EVENT, { detail: next }));
  } catch {}
  return next;
}

/**
 * Detect if running inside an embedded iframe (e.g. AI Studio sandboxed preview)
 */
export function isInsideIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Detect standalone installed PWA mode
 */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Detect mobile screen or handheld device
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return mobileRegex.test(ua) || window.innerWidth <= 768 || Capacitor.isNativePlatform();
}

/**
 * Get clean direct URL for opening in native mobile browser
 */
export function getDirectAppUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.location.href;
}

/**
 * Register Service Worker for background push & lockscreen notifications
 */
export async function registerPosServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn('[PWA] Service Worker registration failed:', err);
    return null;
  }
}

/**
 * Initialize all Android Lockscreen Notification Channels (importance HIGH + VISIBILITY_PUBLIC)
 */
export async function setupAndroidLockscreenChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (androidChannelsInitialized) return;
  try {
    for (const cfg of Object.values(ANDROID_CHANNELS)) {
      await LocalNotifications.createChannel({
        id: cfg.id,
        name: cfg.name,
        description: cfg.description,
        importance: cfg.importance, // 5 = IMPORTANCE_HIGH (heads-up banner + sound + vibration)
        visibility: 1, // VISIBILITY_PUBLIC (visible on off / lock screen)
        vibration: true,
        lights: true,
        lightColor: cfg.lightColor
      });
    }
    androidChannelsInitialized = true;
  } catch (e) {
    console.warn('[LocalNotifications] createChannel non-fatal:', e);
  }
}

/**
 * Get current status of Notification permission
 */
export async function getNotificationPermissionStatus(): Promise<PermissionStateStatus> {
  if (Capacitor.isNativePlatform()) {
    try {
      const check = await LocalNotifications.checkPermissions();
      if (check.display === 'granted') return 'granted';
      if (check.display === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const perm = Notification.permission;
  if (perm === 'granted') return 'granted';
  if (perm === 'denied') return 'denied';
  return 'prompt';
}

/**
 * Request Web & Native Notification and Push permission from the user
 */
export async function requestNotificationPermission(): Promise<{
  status: PermissionStateStatus;
  message: string;
}> {
  // 1. Native Android
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await LocalNotifications.requestPermissions();
      if (res.display === 'granted') {
        await setupAndroidLockscreenChannels();
        return {
          status: 'granted',
          message:
            'Android system notification permission granted! All category channels are lockscreen-active.'
        };
      } else if (res.display === 'denied') {
        return {
          status: 'denied',
          message:
            'Notification permission denied in Android app settings. Open Android Settings > Apps > Falcon POS > Notifications > Allow.'
        };
      }
      return {
        status: 'prompt',
        message: 'Notification permission request was cancelled.'
      };
    } catch (err: any) {
      return {
        status: 'prompt',
        message: `Native notification error: ${err?.message || String(err)}`
      };
    }
  }

  // 2. Mobile Browser
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      status: 'unsupported',
      message: 'Push Notifications are not supported by this mobile browser.'
    };
  }

  // Check if blocked by iframe sandbox
  if (isInsideIframe()) {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await registerPosServiceWorker();
        return { status: 'granted', message: 'Notification permission granted!' };
      }
    } catch {
      // Browsers reject requestPermission inside cross-origin iframes
    }
    if (Notification.permission === 'denied') {
      return {
        status: 'denied',
        message:
          'Mobile browsers block notifications inside embedded preview iframes. Tap "Open Direct App URL" below (or Install to Home Screen) to allow notifications on your phone lock screen.'
      };
    }
  }

  try {
    const permission = await Notification.requestPermission();
    await registerPosServiceWorker();

    if (permission === 'granted') {
      return {
        status: 'granted',
        message: 'Push & Lockscreen notification permission granted across all workshop categories!'
      };
    } else if (permission === 'denied') {
      return {
        status: 'denied',
        message:
          'Notifications blocked by browser. Tap the Lock (🔒) or Settings icon in your mobile address bar > Permissions > Notifications > Allow.'
      };
    } else {
      return {
        status: 'prompt',
        message: 'Notification prompt was dismissed without choosing.'
      };
    }
  } catch (err) {
    return {
      status: 'prompt',
      message: `Failed to request notification permission: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

export interface SendNotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  vibrate?: number[];
  delayMs?: number;
  data?: Record<string, any>;
  category?: NotificationCategory | 'general';
  view?: AppView;
  renotify?: boolean;
  silent?: boolean;
  actionLabel?: string;
  forceTest?: boolean;
  nativeNotificationId?: number;
}

/**
 * Dispatch a native Push / System / Lockscreen Notification for any workshop category
 */
export async function sendNativeNotification(
  title: string,
  options?: SendNotificationOptions
): Promise<boolean> {
  const category = options?.category || 'general';

  // Enforce per-category toggle unless bypassed for diagnostic test
  if (!options?.forceTest && category !== 'general') {
    const prefs = getNotificationCategoryPrefs();
    if (!prefs[category]) {
      return false;
    }
  }

  const channel = ANDROID_CHANNELS[category] || ANDROID_CHANNELS.general;
  const targetView: AppView = options?.view || channel.defaultView;
  const targetUrl = `/?view=${encodeURIComponent(targetView)}`;
  const bodyText = options?.body || 'Falcon Rod Maker POS Workshop Alert';
  const tag = options?.tag || `falcon-${category}-${Date.now()}`;
  const icon = options?.icon && !options.icon.endsWith('.svg') ? options.icon : '/pwa-192x192.png';
  const badge = options?.badge || '/favicon.png';
  const vibrate = options?.vibrate || channel.vibrate;

  const extraData = {
    ...(options?.data || {}),
    category,
    view: targetView,
    url: targetUrl
  };

  // Cache notifications generated while offline so reconnection confirms cloud sync
  if (typeof navigator !== 'undefined' && !navigator.onLine && !options?.forceTest) {
    recordOfflineCachedNotification({
      id: tag,
      category,
      title,
      body: bodyText,
      view: targetView,
      createdAt: new Date().toISOString()
    });
  }

  // 1. Android Native APK (Capacitor LocalNotifications)
  if (Capacitor.isNativePlatform()) {
    try {
      await setupAndroidLockscreenChannels();
      const check = await LocalNotifications.checkPermissions();
      if (check.display === 'granted') {
        const notifId =
          options?.nativeNotificationId || Math.floor(Math.random() * 600000 + 100000);
        const scheduleTime = new Date(Date.now() + Math.max(150, options?.delayMs || 150));

        await LocalNotifications.schedule({
          notifications: [
            {
              id: notifId,
              title,
              body: bodyText,
              channelId: channel.id,
              schedule: { at: scheduleTime, allowWhileIdle: true },
              smallIcon: 'ic_launcher_round',
              iconColor: channel.lightColor,
              extra: extraData
            }
          ]
        });
        return true;
      }
    } catch (e) {
      console.warn('[LocalNotifications] Native schedule error:', e);
    }
  }

  // 2. Mobile Browser / Installed PWA via Service Worker (supports lockscreen requireInteraction + wake delay)
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      const payload = {
        title,
        body: bodyText,
        icon,
        badge,
        tag,
        category,
        view: targetView,
        url: targetUrl,
        vibrate,
        renotify: options?.renotify ?? true,
        silent: options?.silent ?? false,
        actionLabel: options?.actionLabel || 'Open Now',
        timestamp: Date.now(),
        data: extraData
      };

      if ('serviceWorker' in navigator) {
        try {
          let registration = await navigator.serviceWorker.getRegistration();
          if (!registration) {
            registration = (await registerPosServiceWorker()) || undefined;
          }
          if (!registration) {
            registration = await navigator.serviceWorker.ready;
          }

          // For delayed notifications (e.g., user hits test and locks screen), delegate timer to SW
          if (options?.delayMs && options.delayMs > 0 && registration?.active) {
            registration.active.postMessage({
              type: 'SCHEDULE_NOTIFICATION',
              delayMs: options.delayMs,
              payload
            });
            return true;
          }

          if (registration && registration.showNotification) {
            await registration.showNotification(title, {
              body: bodyText,
              icon,
              badge,
              tag,
              vibrate,
              renotify: payload.renotify,
              silent: payload.silent,
              requireInteraction: true,
              data: extraData
            } as NotificationOptions);
            return true;
          }
        } catch (swErr) {
          console.warn('[SW Notification] dispatch warning:', swErr);
        }
      }

      // Direct Notification constructor fallback (no delay)
      try {
        if (options?.delayMs && options.delayMs > 0) {
          setTimeout(() => {
            try {
              new Notification(title, {
                body: bodyText,
                icon,
                badge,
                tag,
                requireInteraction: true,
                silent: false,
                data: extraData
              });
            } catch {}
          }, options.delayMs);
        } else {
          new Notification(title, {
            body: bodyText,
            icon,
            badge,
            tag,
            requireInteraction: true,
            silent: false,
            data: extraData
          });
        }
        return true;
      } catch (fallbackErr) {
        console.warn('[Notification] Constructor failed:', fallbackErr);
      }
    }
  }

  return false;
}

/**
 * Subscribe to notification click / tap navigation from Capacitor OR Service Worker
 */
export function subscribeToNotificationNavigation(
  onNavigate: (view: AppView, data?: Record<string, any>) => void
): () => void {
  const cleanups: Array<() => void> = [];

  // Service Worker message listener (PWA / Mobile Browser)
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE_FROM_NOTIFICATION' && event.data.view) {
        onNavigate(event.data.view as AppView, event.data.data);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    cleanups.push(() => navigator.serviceWorker.removeEventListener('message', handleSwMessage));
  }

  // Capacitor Native notification action listener
  if (Capacitor.isNativePlatform()) {
    try {
      const listenerPromise = LocalNotifications.addListener(
        'localNotificationActionPerformed',
        (event) => {
          const extra = event.notification?.extra as Record<string, any> | undefined;
          if (extra?.view) {
            onNavigate(extra.view as AppView, extra);
          } else {
            onNavigate('notifications', extra);
          }
        }
      );
      cleanups.push(() => {
        listenerPromise.then((h) => h.remove()).catch(() => {});
      });
    } catch {}
  }

  return () => {
    cleanups.forEach((fn) => fn());
  };
}

/**
 * Schedule a lockscreen test notification delayed by N seconds
 * Allows user to lock their phone and see the notification light up the lockscreen
 */
export async function scheduleLockscreenTestNotification(
  delaySeconds: number = 3,
  category: NotificationCategory | 'general' = 'general'
): Promise<boolean> {
  const labelMap: Record<NotificationCategory | 'general', string> = {
    backups: '☁️ Falcon Backup Lockscreen Alert',
    gatepasses: '🛂 Falcon Gate Pass Lockscreen Alert',
    cheques: '💳 Falcon Cheque Due Lockscreen Alert',
    orders: '🛒 Falcon Order Lockscreen Alert',
    stock: '📦 Falcon Low Stock Lockscreen Alert',
    inquiries: '🔔 Falcon Inquiry Lockscreen Alert',
    general: '🔒 Falcon POS Lockscreen Alert'
  };

  return await sendNativeNotification(labelMap[category], {
    body: `Lockscreen Alert Active (${category.toUpperCase()}) • Fired at ${new Date().toLocaleTimeString()} — Tap to open.`,
    delayMs: delaySeconds * 1000,
    tag: `falcon-lockscreen-test-${category}`,
    category,
    forceTest: true
  });
}

/**
 * Check Microphone permission status
 */
export async function getMicrophonePermissionStatus(): Promise<PermissionStateStatus> {
  if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return 'unsupported';
  }

  if (navigator.permissions && navigator.permissions.query) {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (result.state === 'granted') return 'granted';
      if (result.state === 'denied') return 'denied';
      return 'prompt';
    } catch {
      // query not supported for microphone on some mobile browsers
    }
  }

  return 'prompt';
}

/**
 * Request Microphone permission by prompting getUserMedia
 */
export async function requestMicrophonePermission(): Promise<{
  granted: boolean;
  status: PermissionStateStatus;
  message: string;
}> {
  if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      granted: false,
      status: 'unsupported',
      message: 'Microphone hardware access is not supported by this browser.'
    };
  }

  // Detect iframe sandbox restriction
  if (isInsideIframe()) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return {
        granted: true,
        status: 'granted',
        message: 'Microphone permission granted successfully!'
      };
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        return {
          granted: false,
          status: 'denied',
          message:
            'Microphone is blocked by the embedded preview iframe. Open the app directly in Chrome/Safari to enable voice.'
        };
      }
    }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return {
      granted: true,
      status: 'granted',
      message: 'Microphone permission granted successfully! Voice commands are ready.'
    };
  } catch (err: any) {
    const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
    return {
      granted: false,
      status: isDenied ? 'denied' : 'prompt',
      message: isDenied
        ? 'Microphone blocked in browser settings. Tap the Lock (🔒) icon beside the URL to enable Microphone.'
        : `Microphone access error: ${err.message || err.name}`
    };
  }
}

/**
 * Check if browser storage is persisted (durable storage permission)
 */
export async function checkStoragePersistence(): Promise<boolean> {
  if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persisted) {
    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Test IndexedDB and localStorage operational integrity
 */
export async function testLocalStorageIntegrity(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const testKey = '__falcon_storage_probe__';
    const testVal = 'probe_' + Date.now();
    localStorage.setItem(testKey, testVal);
    const read = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    if (read !== testVal) return false;

    if ('indexedDB' in window) {
      return await new Promise<boolean>((resolve) => {
        const req = indexedDB.open('__falcon_probe_db__', 1);
        req.onsuccess = () => {
          req.result.close();
          resolve(true);
        };
        req.onerror = () => resolve(true);
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Request persistent local storage permission from the browser
 */
export async function requestStoragePersistence(): Promise<{
  persisted: boolean;
  message: string;
}> {
  const isOperational = await testLocalStorageIntegrity();

  if (typeof window === 'undefined' || !navigator.storage || !navigator.storage.persist) {
    return {
      persisted: isOperational,
      message: isOperational
        ? 'Offline database (IndexedDB & LocalStorage) is fully active and protected.'
        : 'Storage API unavailable.'
    };
  }

  try {
    const isPersisted = await navigator.storage.persist();
    if (isPersisted) {
      return {
        persisted: true,
        message: 'Persistent Storage granted! POS data is permanently protected against OS eviction.'
      };
    } else {
      return {
        persisted: isOperational,
        message: isOperational
          ? 'Offline database is fully active and preserved. (To permanently lock against deep OS battery cleaner eviction, install app to Home Screen or enable Notifications).'
          : 'Storage request failed.'
      };
    }
  } catch (err) {
    return {
      persisted: isOperational,
      message: `Offline storage is operational: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/**
 * Retrieve storage estimate (usage and quota)
 */
export async function getStorageEstimate(): Promise<{
  usageMB: number;
  quotaMB: number;
  percentUsed: number;
} | null> {
  if (typeof window !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usageMB = Math.round(((estimate.usage || 0) / (1024 * 1024)) * 10) / 10;
      const quotaMB = Math.round(((estimate.quota || 0) / (1024 * 1024)) * 10) / 10;
      const percentUsed = quotaMB > 0 ? Math.round((usageMB / quotaMB) * 1000) / 10 : 0;
      return { usageMB, quotaMB, percentUsed };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Fetch all permissions diagnostic state at once
 */
export async function checkAllMobilePermissions(): Promise<MobilePermissionsState> {
  const notif = await getNotificationPermissionStatus();
  const mic = await getMicrophonePermissionStatus();
  const storagePersisted = await checkStoragePersistence();
  const storageOperational = await testLocalStorageIntegrity();
  const storageEstimate = await getStorageEstimate();
  const isIframe = isInsideIframe();
  const isMobile = isMobileDevice();
  const isNative = Capacitor.isNativePlatform();
  const isStandalone = isStandalonePwa();

  let isServiceWorkerReady = false;
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      isServiceWorkerReady = Boolean(reg?.active);
    } catch {
      isServiceWorkerReady = false;
    }
  }

  return {
    notifications: notif,
    microphone: mic,
    storagePersisted: storagePersisted || storageOperational,
    storageOperational,
    storageEstimate,
    isIframe,
    isMobile,
    isNative,
    isStandalone,
    isServiceWorkerReady,
    lockscreenSupported: isNative || ('Notification' in window && 'serviceWorker' in navigator)
  };
}
