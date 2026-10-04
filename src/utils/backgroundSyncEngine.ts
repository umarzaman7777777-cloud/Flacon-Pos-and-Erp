import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { AppState, Transaction } from '../types';
import { getPersistent, setPersistent } from './persistentStorage';
import {
  getStoredSheetsToken,
  getStoredSpreadsheetId,
  populateAllSheets,
  syncSingleTransactionWithSheet,
  getSheetsAutoSyncEnabled,
  notifyWorkspaceSyncUpdated
} from './googleSheetsSync';
import {
  getStoredDriveToken,
  getDriveAutoBackupEnabled,
  uploadBackupToGoogleDrive,
  setLastDriveBackupTime
} from './googleDriveBackup';
import { getDatabaseJSONString } from './syncReport';
import { refreshGoogleWorkspaceTokenSilently } from './googleAuthHelper';

const QUEUE_STORAGE_KEY = 'falcon_pending_sync_queue';

export type SyncTaskType = 'SHEETS_FULL_SYNC' | 'SHEETS_TXN_SYNC' | 'DRIVE_BACKUP';

export interface SyncTask {
  id: string;
  type: SyncTaskType;
  payload?: any;
  createdAt: string;
  retries: number;
  status: 'pending' | 'syncing' | 'failed';
  lastError?: string;
}

let isFlushing = false;
let stateGetter: (() => AppState) | null = null;
let engineInitialized = false;

/**
 * Retrieve the persistent pending sync queue
 */
export function getPendingSyncQueue(): SyncTask[] {
  try {
    const raw = getPersistent(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save the pending sync queue to persistent storage
 */
export async function savePendingSyncQueue(queue: SyncTask[]): Promise<void> {
  try {
    await setPersistent(QUEUE_STORAGE_KEY, JSON.stringify(queue.slice(0, 50)));
  } catch (err) {
    console.warn('[SyncEngine] Failed to save queue:', err);
  }
}

/**
 * Add a new sync task to the persistent queue
 */
export async function enqueueSyncTask(type: SyncTaskType, payload?: any): Promise<void> {
  const queue = getPendingSyncQueue();

  // Deduplicate full sync or drive backup tasks if already pending
  if (type === 'SHEETS_FULL_SYNC' || type === 'DRIVE_BACKUP') {
    const existing = queue.find(t => t.type === type && t.status === 'pending');
    if (existing) {
      existing.createdAt = new Date().toISOString();
      await savePendingSyncQueue(queue);
      return;
    }
  }

  const newTask: SyncTask = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    retries: 0,
    status: 'pending'
  };

  queue.push(newTask);
  await savePendingSyncQueue(queue);

  // Trigger background sync worker registration if supported
  tryRegisterServiceWorkerSync();

  // Try to flush immediately if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    flushSyncQueue().catch(() => {});
  }
}

/**
 * Process all pending sync tasks
 */
export async function flushSyncQueue(customState?: AppState): Promise<number> {
  if (isFlushing) return 0;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;

  const queue = getPendingSyncQueue();
  if (queue.length === 0) return 0;

  isFlushing = true;
  let processedCount = 0;
  const remainingQueue: SyncTask[] = [];

  const appState = customState || (stateGetter ? stateGetter() : null);

  for (const task of queue) {
    try {
      if (task.type === 'SHEETS_FULL_SYNC') {
        const token = getStoredSheetsToken();
        const spreadsheetId = getStoredSpreadsheetId();
        if (token?.token && spreadsheetId && appState) {
          await populateAllSheets(token.token, spreadsheetId, appState);
          processedCount++;
          continue;
        }
      } else if (task.type === 'SHEETS_TXN_SYNC') {
        const token = getStoredSheetsToken();
        const spreadsheetId = getStoredSpreadsheetId();
        const txn: Transaction = task.payload;
        if (token?.token && spreadsheetId && txn && appState) {
          await syncSingleTransactionWithSheet(token.token, spreadsheetId, txn, appState);
          processedCount++;
          continue;
        }
      } else if (task.type === 'DRIVE_BACKUP') {
        const driveToken = getStoredDriveToken();
        if (driveToken?.token && appState) {
          const { jsonString, filename } = getDatabaseJSONString(appState, driveToken.userEmail || 'umarzaman7777777@gmail.com', 'mobile_terminal', true);
          await uploadBackupToGoogleDrive(driveToken.token, {
            fileName: filename,
            fileContent: jsonString,
            mimeType: 'application/json',
            description: `Automated Background Backup (${appState.transactions?.length || 0} invoices)`
          });
          setLastDriveBackupTime(new Date().toISOString());
          processedCount++;
          continue;
        }
      }

      // If requirements were not met or task couldn't complete yet, keep in queue
      task.retries += 1;
      if (task.retries < 5) {
        remainingQueue.push(task);
      }
    } catch (err: any) {
      console.warn(`[SyncEngine] Error executing task ${task.id}:`, err?.message || err);
      const errMsg = String(err?.message || err || '');
      // If error was an expired token or 401, trigger silent background renewal
      if (errMsg.includes('401') || errMsg.includes('token') || errMsg.includes('UNAUTHENTICATED')) {
        refreshGoogleWorkspaceTokenSilently().catch(() => {});
      }
      task.retries += 1;
      task.status = 'failed';
      task.lastError = errMsg;
      if (task.retries < 5) {
        remainingQueue.push(task);
      }
    }
  }

  await savePendingSyncQueue(remainingQueue);
  isFlushing = false;

  if (processedCount > 0) {
    notifyWorkspaceSyncUpdated();
  }

  return processedCount;
}

/**
 * Register Service Worker Background Sync tag if supported
 */
function tryRegisterServiceWorkerSync() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      navigator.serviceWorker.ready
        .then((reg: any) => {
          if (reg.sync?.register) {
            return reg.sync.register('falcon-sync-sheets');
          }
        })
        .catch(err => {
          console.debug('[SyncEngine] Background sync registration:', err);
        });
    } catch {}
  }
}

/**
 * Initialize the Continuous Background Sync Engine
 * Sets up hooks for:
 * 1. App backgrounding (@capacitor/app) -> flushes pending items before process sleep
 * 2. App resuming (@capacitor/app) -> flushes pending items upon return
 * 3. Page visibility change (document.visibilityState === 'hidden')
 * 4. Window beforeunload & pagehide
 * 5. Window online event
 * 6. Periodic interval timer
 */
export function initBackgroundSyncEngine(getState: () => AppState): () => void {
  if (engineInitialized) {
    stateGetter = getState;
    return () => {};
  }
  engineInitialized = true;
  stateGetter = getState;

  console.info('[SyncEngine] Initializing Continuous Background Sync Engine...');

  // 1. Capacitor Native App State Changes (Background / Foreground transition)
  let appStateListenerRemove: (() => void) | null = null;
  try {
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          // App is going to background or screen turning off:
          // Immediately flush all queued items so no transactions or sheets rows are left pending!
          console.info('[SyncEngine] App moving to background: flushing sync queue...');
          flushSyncQueue(getState()).catch(e => console.warn('[SyncEngine] Background flush error:', e));
        } else {
          // App returned to foreground:
          console.info('[SyncEngine] App resumed to foreground: checking sync queue...');
          flushSyncQueue(getState()).catch(e => console.warn('[SyncEngine] Resume flush error:', e));
        }
      }).then(handle => {
        appStateListenerRemove = () => handle.remove();
      });
    }
  } catch (err) {
    console.warn('[SyncEngine] App listener error:', err);
  }

  // 2. Page Visibility Listener (Web & WebView tab hiding)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      flushSyncQueue(getState()).catch(() => {});
    } else {
      flushSyncQueue(getState()).catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // 3. Online & Network Recovery Listener
  const handleOnline = () => {
    console.info('[SyncEngine] Network connection restored: flushing sync queue...');
    flushSyncQueue(getState()).catch(() => {});
  };
  window.addEventListener('online', handleOnline);

  // 4. Page Unload / Hide Listeners
  const handlePageHide = () => {
    flushSyncQueue(getState()).catch(() => {});
  };
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('beforeunload', handlePageHide);

  // 5. Periodic Background Interval (Every 25 seconds for queue flush)
  const intervalId = setInterval(() => {
    const queue = getPendingSyncQueue();
    if (queue.length > 0 && typeof navigator !== 'undefined' && navigator.onLine) {
      flushSyncQueue(getState()).catch(() => {});
    }
  }, 25000);

  // 6. Proactive Background Token Renewal (Every 35 minutes)
  // Keeps Google Workspace access continuously active without 1-hour expiration or 2FA prompts
  const tokenRefreshIntervalId = setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      refreshGoogleWorkspaceTokenSilently().catch(() => {});
    }
  }, 35 * 60 * 1000);

  // 7. Initial flush on boot
  setTimeout(() => {
    flushSyncQueue(getState()).catch(() => {});
  }, 2000);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('beforeunload', handlePageHide);
    clearInterval(intervalId);
    clearInterval(tokenRefreshIntervalId);
    if (appStateListenerRemove) appStateListenerRemove();
    engineInitialized = false;
  };
}
