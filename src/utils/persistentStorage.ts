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
  try {
    // 1. Try dedicated workspace tokens document first, then fall back to workshop multi-terminal doc
    let tokens: any = null;
    try {
      const dedicatedRef = doc(db, 'sync_states', 'falcon_workspace_tokens');
      const dedicatedSnap = await getDoc(dedicatedRef);
      if (dedicatedSnap.exists()) {
        const d = dedicatedSnap.data();
        tokens = d?.workspace_tokens || d;
      }
    } catch (e) {
      console.debug('[PersistentStorage] Dedicated token doc fetch note:', e);
    }

    if (!tokens || (!tokens.sheetsToken && !tokens.driveToken)) {
      const syncDocRef = doc(db, 'sync_states', 'falcon_workshop');
      const snap = await getDoc(syncDocRef);
      if (snap.exists()) {
        const data = snap.data();
        tokens = data?.workspace_tokens || data;
      }
    }

    if (!tokens) {
      return { driveSynced: false, sheetsSynced: false };
    }

    let driveSynced = false;
    let sheetsSynced = false;

    // Check sheets token
    const sheetsToken = tokens.sheetsToken;
    if (sheetsToken && typeof sheetsToken === 'string' && !sheetsToken.startsWith('falcon_offline_session_')) {
      const currentToken = getPersistent('falcon_gsheets_token');
      // If current is missing or cloud token is valid, restore it
      if (!currentToken || (tokens.expiresAt && tokens.expiresAt > Date.now())) {
        await setPersistent('falcon_gsheets_token', sheetsToken);
        if (tokens.expiresAt) await setPersistent('falcon_gsheets_expires_at', tokens.expiresAt.toString());
        if (tokens.email) await setPersistent('falcon_gsheets_email', tokens.email);
        sheetsSynced = true;
      }
    }

    if (tokens.spreadsheetId) {
      await setPersistent('falcon_gsheets_spreadsheet_id', tokens.spreadsheetId);
    }
    if (tokens.spreadsheetTitle) {
      await setPersistent('falcon_gsheets_spreadsheet_title', tokens.spreadsheetTitle);
    }
    if (tokens.spreadsheetUrl) {
      await setPersistent('falcon_gsheets_spreadsheet_url', tokens.spreadsheetUrl);
    }
    await setPersistent('falcon_gsheets_auto_sync', 'true');

    // Check drive token
    const driveToken = tokens.driveToken;
    if (driveToken && typeof driveToken === 'string' && !driveToken.startsWith('falcon_offline_session_')) {
      const currentToken = getPersistent('falcon_gdrive_token');
      if (!currentToken || (tokens.expiresAt && tokens.expiresAt > Date.now())) {
        await setPersistent('falcon_gdrive_token', driveToken);
        if (tokens.expiresAt) await setPersistent('falcon_gdrive_expires_at', tokens.expiresAt.toString());
        if (tokens.email) await setPersistent('falcon_gdrive_email', tokens.email);
        driveSynced = true;
      }
    }

    if (tokens.driveFolderId) {
      await setPersistent('falcon_gdrive_folder_id', tokens.driveFolderId);
    }
    await setPersistent('falcon_gdrive_autobackup', 'true');

    if (sheetsSynced || driveSynced) {
      notifyWorkspaceSyncUpdated();
      console.info('[PersistentStorage] Successfully restored Google Workspace credentials from Firestore cloud sync.');
    }

    return { driveSynced, sheetsSynced };
  } catch (err) {
    console.warn('[PersistentStorage] autoSyncWorkspaceFromCloud notice:', err);
    return { driveSynced: false, sheetsSynced: false };
  }
}

let cloudListenerUnsub: (() => void) | null = null;
let dedicatedListenerUnsub: (() => void) | null = null;

export function listenToCloudTokensRealtime(): void {
  if (cloudListenerUnsub) return;

  const handleSnapshot = (snapshot: any) => {
    try {
      if (!snapshot || !snapshot.exists()) return;
      const data = snapshot.data();
      const tokens = data?.workspace_tokens || data;
      if (!tokens) return;

      const localSheetsToken = getPersistent('falcon_gsheets_token');
      const localDriveToken = getPersistent('falcon_gdrive_token');

      let hasChanges = false;
      const incomingSheetsToken = tokens.sheetsToken;
      if (incomingSheetsToken && typeof incomingSheetsToken === 'string' && incomingSheetsToken !== localSheetsToken) {
        setPersistent('falcon_gsheets_token', incomingSheetsToken);
        if (tokens.expiresAt) setPersistent('falcon_gsheets_expires_at', tokens.expiresAt.toString());
        if (tokens.email) setPersistent('falcon_gsheets_email', tokens.email);
        hasChanges = true;
      }

      const incomingDriveToken = tokens.driveToken;
      if (incomingDriveToken && typeof incomingDriveToken === 'string' && incomingDriveToken !== localDriveToken) {
        setPersistent('falcon_gdrive_token', incomingDriveToken);
        if (tokens.expiresAt) setPersistent('falcon_gdrive_expires_at', tokens.expiresAt.toString());
        if (tokens.email) setPersistent('falcon_gdrive_email', tokens.email);
        hasChanges = true;
      }

      if (tokens.spreadsheetId && tokens.spreadsheetId !== getPersistent('falcon_gsheets_spreadsheet_id')) {
        setPersistent('falcon_gsheets_spreadsheet_id', tokens.spreadsheetId);
        hasChanges = true;
      }
      if (tokens.spreadsheetTitle) {
        setPersistent('falcon_gsheets_spreadsheet_title', tokens.spreadsheetTitle);
      }
      if (tokens.spreadsheetUrl) {
        setPersistent('falcon_gsheets_spreadsheet_url', tokens.spreadsheetUrl);
      }
      if (tokens.driveFolderId && tokens.driveFolderId !== getPersistent('falcon_gdrive_folder_id')) {
        setPersistent('falcon_gdrive_folder_id', tokens.driveFolderId);
        hasChanges = true;
      }

      if (hasChanges) {
        notifyWorkspaceSyncUpdated();
        console.info('[PersistentStorage] Realtime cloud update: Google Workspace credentials synchronized.');
      }
    } catch (e) {
      console.debug('[PersistentStorage] Token snapshot error:', e);
    }
  };

  try {
    const dedicatedRef = doc(db, 'sync_states', 'falcon_workspace_tokens');
    dedicatedListenerUnsub = onSnapshot(dedicatedRef, handleSnapshot, (err) => {
      console.debug('[PersistentStorage] Dedicated token listener note:', err);
    });

    const syncDocRef = doc(db, 'sync_states', 'falcon_workshop');
    cloudListenerUnsub = onSnapshot(syncDocRef, handleSnapshot, (err) => {
      console.debug('[PersistentStorage] Workshop token listener note:', err);
    });
  } catch (e) {
    console.debug('[PersistentStorage] Token listener setup note:', e);
  }
}

/**
 * Persist active Google Workspace credentials to Firestore cloud sync
 */
export async function publishWorkspaceTokensToFirestore(tokens: {
  sheetsToken?: string;
  driveToken?: string;
  expiresInSec?: number;
  email?: string;
  spreadsheetId?: string;
  spreadsheetTitle?: string;
  spreadsheetUrl?: string;
  driveFolderId?: string;
}): Promise<void> {
  try {
    const validDuration = (tokens.expiresInSec && tokens.expiresInSec > 0) ? tokens.expiresInSec : 3600;
    const expiresAt = Date.now() + (validDuration * 1000);

    const tokenPayload: Record<string, any> = {
      lastUpdated: new Date().toISOString(),
      expiresAt,
      email: tokens.email || 'umarzaman7777777@gmail.com'
    };
    if (tokens.sheetsToken) tokenPayload.sheetsToken = tokens.sheetsToken;
    if (tokens.driveToken) tokenPayload.driveToken = tokens.driveToken;
    if (tokens.spreadsheetId) tokenPayload.spreadsheetId = tokens.spreadsheetId;
    if (tokens.spreadsheetTitle) tokenPayload.spreadsheetTitle = tokens.spreadsheetTitle;
    if (tokens.spreadsheetUrl) tokenPayload.spreadsheetUrl = tokens.spreadsheetUrl;
    if (tokens.driveFolderId) tokenPayload.driveFolderId = tokens.driveFolderId;

    // 1. Write to dedicated tokens vault
    const dedicatedRef = doc(db, 'sync_states', 'falcon_workspace_tokens');
    await setDoc(dedicatedRef, {
      ...tokenPayload,
      workspace_tokens: tokenPayload
    }, { merge: true });

    // 2. Also dual-write to primary workshop document
    const syncDocRef = doc(db, 'sync_states', 'falcon_workshop');
    const workshopUpdatePayload: Record<string, any> = {
      'workspace_tokens.lastUpdated': tokenPayload.lastUpdated,
      'workspace_tokens.expiresAt': tokenPayload.expiresAt,
      'workspace_tokens.email': tokenPayload.email
    };
    if (tokens.sheetsToken) workshopUpdatePayload['workspace_tokens.sheetsToken'] = tokens.sheetsToken;
    if (tokens.driveToken) workshopUpdatePayload['workspace_tokens.driveToken'] = tokens.driveToken;
    if (tokens.spreadsheetId) workshopUpdatePayload['workspace_tokens.spreadsheetId'] = tokens.spreadsheetId;
    if (tokens.spreadsheetTitle) workshopUpdatePayload['workspace_tokens.spreadsheetTitle'] = tokens.spreadsheetTitle;
    if (tokens.spreadsheetUrl) workshopUpdatePayload['workspace_tokens.spreadsheetUrl'] = tokens.spreadsheetUrl;
    if (tokens.driveFolderId) workshopUpdatePayload['workspace_tokens.driveFolderId'] = tokens.driveFolderId;

    await setDoc(syncDocRef, workshopUpdatePayload, { merge: true });
    console.info('[PersistentStorage] Google Workspace credentials saved to Firestore cloud sync.');
  } catch (e) {
    console.warn('[PersistentStorage] Could not write tokens to Firestore:', e);
  }
}

