import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { notifyWorkspaceSyncUpdated } from './googleSheetsSync';

const KNOWN_WORKSPACE_KEYS = [
  'falcon_gsheets_token',
  'falcon_gsheets_expires_at',
  'falcon_gsheets_email',
  'falcon_gsheets_spreadsheet_id',
  'falcon_gsheets_spreadsheet_title',
  'falcon_gsheets_spreadsheet_url',
  'falcon_gsheets_last_sync',
  'falcon_gsheets_auto_sync',
  'falcon_gdrive_token',
  'falcon_gdrive_expires_at',
  'falcon_gdrive_email',
  'falcon_gdrive_folder_id',
  'falcon_gdrive_last_backup_time',
  'falcon_gdrive_autobackup'
];

// Memory cache for instant synchronous access
const memoryCache: Record<string, string | null> = {};

/**
 * Synchronous get: checks memory cache first, then localStorage
 */
export function getPersistent(key: string): string | null {
  if (memoryCache[key] !== undefined) {
    return memoryCache[key];
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const val = localStorage.getItem(key);
      memoryCache[key] = val;
      return val;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Durable set: updates memory cache, localStorage, and Capacitor Preferences (Android SharedPreferences)
 */
export async function setPersistent(key: string, value: string): Promise<void> {
  memoryCache[key] = value;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[PersistentStorage] LocalStorage set error for ${key}:`, e);
    }
  }
  try {
    await Preferences.set({ key, value });
  } catch (e) {
    console.warn(`[PersistentStorage] Preferences set error for ${key}:`, e);
  }
}

/**
 * Durable remove: clears memory cache, localStorage, and Capacitor Preferences
 */
export async function removePersistent(key: string): Promise<void> {
  delete memoryCache[key];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
  try {
    await Preferences.remove({ key });
  } catch {}
}

/**
 * Initialize persistent storage on application startup.
 * Restores all keys from Capacitor Preferences to localStorage in case the WebView was restarted or cleared.
 */
let isInitialized = false;
export async function initPersistentStorage(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  try {
    for (const key of KNOWN_WORKSPACE_KEYS) {
      try {
        const prefResult = await Preferences.get({ key });
        if (prefResult.value) {
          memoryCache[key] = prefResult.value;
          if (typeof window !== 'undefined' && window.localStorage) {
            const currentLocal = localStorage.getItem(key);
            if (!currentLocal) {
              localStorage.setItem(key, prefResult.value);
            }
          }
        } else if (typeof window !== 'undefined' && window.localStorage) {
          const currentLocal = localStorage.getItem(key);
          if (currentLocal) {
            memoryCache[key] = currentLocal;
            // Backport to native Preferences
            Preferences.set({ key, value: currentLocal }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn(`[PersistentStorage] Key restore notice (${key}):`, err);
      }
    }

    console.info('[PersistentStorage] Successfully restored native credentials.');
  } catch (e) {
    console.warn('[PersistentStorage] Startup initialization note:', e);
  }

  // Automatic cloud sync on startup
  try {
    await autoSyncWorkspaceFromCloud();
  } catch {}

  // Listen to App lifecycle state changes (e.g. background to foreground resume)
  if (Capacitor.isNativePlatform()) {
    try {
      App.addListener('appStateChange', async (state) => {
        if (state.isActive) {
          console.info('[Falcon App] Resumed to foreground. Verifying workspace sync status...');
          await autoSyncWorkspaceFromCloud();
        }
      });
    } catch (e) {
      console.warn('[Falcon App] appStateChange listener setup notice:', e);
    }
  }

  // Set up real-time listener on Firestore sync_states/falcon_workshop so token updates propagate instantly!
  listenToCloudTokensRealtime();
}

/**
 * Automatically fetch active Google Drive & Sheets credentials from Firestore cloud sync
 */
export async function autoSyncWorkspaceFromCloud(): Promise<{ driveSynced: boolean; sheetsSynced: boolean }> {
  // Device-local tokens: Cloud token sync disabled per user preference
  return { driveSynced: false, sheetsSynced: false };
}

export function listenToCloudTokensRealtime(): void {
  // Device-local tokens: Cloud token listening disabled per user preference
}

