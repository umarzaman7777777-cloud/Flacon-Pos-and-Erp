import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Transaction } from '../types';
import {
  getStoredSheetsToken,
  getStoredSpreadsheetId,
  setStoredSpreadsheetId,
  getStoredSpreadsheetTitle,
  getStoredSpreadsheetUrl,
  getLastSheetsSyncTime,
  setLastSheetsSyncTime,
  getSheetsAutoSyncEnabled,
  setSheetsAutoSyncEnabled,
  clearSheetsToken,
  requestGoogleSheetsToken,
  populateAllSheets,
  createMasterFalconSpreadsheet,
  syncSingleTransactionWithSheet,
  WORKSPACE_SYNC_EVENT,
  notifyWorkspaceSyncUpdated,
  ALLOWED_SHEETS_OWNER_EMAIL,
  extractSpreadsheetId
} from '../utils/googleSheetsSync';
import {
  getStoredDriveToken,
  getStoredDriveFolderId,
  setStoredDriveFolderId,
  getOrCreateBackupFolder,
  getLastDriveBackupTime,
  setLastDriveBackupTime,
  getDriveAutoBackupEnabled,
  setDriveAutoBackupEnabled,
  getDriveAutoBackupIntervalHours,
  setDriveAutoBackupIntervalHours,
  getNextDriveBackupDate,
  formatBackupCountdown,
  clearDriveToken,
  requestGoogleDriveToken,
  uploadBackupToGoogleDrive,
  listGoogleDriveBackups
} from '../utils/googleDriveBackup';
import { getDatabaseJSONString } from '../utils/syncReport';
import { generateFullDatabaseSQL } from '../utils/sqlExporter';
import { initPersistentStorage } from '../utils/persistentStorage';
import { autoAuthenticateAndGetActiveToken, refreshGoogleWorkspaceTokenSilently } from '../utils/googleAuthHelper';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth } from '../firebase/config';
import { openExternalUrl } from '../utils/openExternalUrl';

export interface WorkspaceSyncState {
  // Google Sheets
  sheetsConnected: boolean;
  sheetsToken: string | null;
  spreadsheetId: string | null;
  spreadsheetTitle: string | null;
  spreadsheetUrl: string | null;
  lastSheetsSync: string | null;
  sheetsAutoSync: boolean;
  isSyncingSheets: boolean;
  sheetsError: string | null;
  sheetsSuccessMsg: string | null;

  // Google Drive
  driveConnected: boolean;
  driveToken: string | null;
  driveFolderId: string | null;
  lastDriveBackup: string | null;
  driveAutoBackup: boolean;
  driveAutoBackupInterval: number;
  nextScheduledDriveBackup: string | null;
  driveBackupCountdown: string | null;
  isUploadingDrive: boolean;
  driveError: string | null;
  driveSuccessMsg: string | null;
  driveBackupsCount: number;

  // Auto-Authentication Engine state
  isAutoAuthenticating: boolean;

  // Combined Status for Header Indicator
  workspaceStatus: 'syncing' | 'synced' | 'ready' | 'warning' | 'disconnected';
  statusBadgeText: string;
  statusBadgeTooltip: string;

  // Actions
  autoSyncNow: (customState?: AppState) => Promise<boolean>;
  syncAllSheets: (customState?: AppState) => Promise<boolean>;
  syncTransactionToSheets: (transaction: Transaction) => Promise<boolean>;
  backupToDrive: (format?: 'json' | 'sql', customState?: AppState) => Promise<boolean>;
  backupAllFilesToDrive: (customState?: AppState) => Promise<boolean>;
  connectSheets: () => Promise<string | null>;
  connectDrive: () => Promise<string | null>;
  disconnectSheets: () => void;
  disconnectDrive: () => void;
  toggleSheetsAutoSync: (enabled?: boolean) => void;
  toggleDriveAutoBackup: (enabled?: boolean) => void;
  changeDriveAutoBackupInterval: (hours: number) => void;
  refreshWorkspaceState: () => void;
  openSheetsApp: () => Promise<void>;
  openDriveApp: () => Promise<void>;
}

export function useWorkspaceSync(appState: AppState, terminalId: string = 'default_terminal') {
  // Sheets state
  const [sheetsTokenInfo, setSheetsTokenInfo] = useState(() => getStoredSheetsToken());
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => getStoredSpreadsheetId());
  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string | null>(() => getStoredSpreadsheetTitle());
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(() => getStoredSpreadsheetUrl());
  const [lastSheetsSync, setLastSheetsSync] = useState<string | null>(() => getLastSheetsSyncTime());
  const [sheetsAutoSync, setSheetsAutoSync] = useState<boolean>(() => getSheetsAutoSyncEnabled());
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [sheetsSuccessMsg, setSheetsSuccessMsg] = useState<string | null>(null);

  // Drive state
  const [driveTokenInfo, setDriveTokenInfo] = useState(() => getStoredDriveToken());
  const [driveFolderId, setDriveFolderId] = useState<string | null>(() => getStoredDriveFolderId());
  const [lastDriveBackup, setLastDriveBackup] = useState<string | null>(() => getLastDriveBackupTime());
  const [driveAutoBackup, setDriveAutoBackup] = useState<boolean>(() => getDriveAutoBackupEnabled());
  const [driveAutoBackupInterval, setDriveAutoBackupInterval] = useState<number>(() => getDriveAutoBackupIntervalHours());
  const [nextScheduledDriveBackup, setNextScheduledDriveBackup] = useState<string | null>(null);
  const [driveBackupCountdown, setDriveBackupCountdown] = useState<string | null>(null);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSuccessMsg, setDriveSuccessMsg] = useState<string | null>(null);
  const [driveBackupsCount, setDriveBackupsCount] = useState<number>(0);
  const [isAutoAuthenticating, setIsAutoAuthenticating] = useState(true);

  const initialBackupChecked = useRef(false);
  const isBackingUpRef = useRef(false);
  const currentUserEmail = auth.currentUser?.email || ALLOWED_SHEETS_OWNER_EMAIL;

  // Refresh local state from storage
  const refreshWorkspaceState = useCallback(() => {
    const sToken = getStoredSheetsToken();
    setSheetsTokenInfo(sToken);
    setSpreadsheetId(getStoredSpreadsheetId());
    setSpreadsheetTitle(getStoredSpreadsheetTitle());
    setSpreadsheetUrl(getStoredSpreadsheetUrl());
    setLastSheetsSync(getLastSheetsSyncTime());
    setSheetsAutoSync(getSheetsAutoSyncEnabled());

    const dToken = getStoredDriveToken();
    setDriveTokenInfo(dToken);
    setDriveFolderId(getStoredDriveFolderId());
    setLastDriveBackup(getLastDriveBackupTime());
    setDriveAutoBackup(getDriveAutoBackupEnabled());
    setDriveAutoBackupInterval(getDriveAutoBackupIntervalHours());
  }, []);

  // Listen to custom workspace sync events and storage changes
  useEffect(() => {
    const handleUpdate = () => refreshWorkspaceState();
    window.addEventListener(WORKSPACE_SYNC_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    return () => {
      window.removeEventListener(WORKSPACE_SYNC_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [refreshWorkspaceState]);

  // Update schedule time & countdown timer
  useEffect(() => {
    if (!driveAutoBackup || !driveTokenInfo?.token) {
      setNextScheduledDriveBackup(null);
      setDriveBackupCountdown(null);
      return;
    }

    const updateTimer = () => {
      const nextDate = getNextDriveBackupDate(lastDriveBackup, driveAutoBackupInterval);
      const isToday = nextDate.toDateString() === new Date().toDateString();
      const timeStr = nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = nextDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
      setNextScheduledDriveBackup(isToday ? `Today at ${timeStr}` : `${dateStr} at ${timeStr}`);
      setDriveBackupCountdown(formatBackupCountdown(nextDate));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 10000);
    return () => clearInterval(interval);
  }, [driveAutoBackup, driveTokenInfo?.token, lastDriveBackup, driveAutoBackupInterval]);

  // Recurring Auto-Backup Engine for All Files
  useEffect(() => {
    if (!driveAutoBackup || !driveTokenInfo?.token) return;

    const checkAndTriggerBackup = async () => {
      if (isBackingUpRef.current) return;
      const nextDate = getNextDriveBackupDate(lastDriveBackup, driveAutoBackupInterval);
      if (Date.now() >= nextDate.getTime()) {
        console.info('[Workspace Sync] Scheduled Auto-Backup Due: Backing up all files to Google Drive...');
        isBackingUpRef.current = true;
        try {
          await backupAllFilesToDrive();
        } catch (e) {
          console.warn('[Workspace Sync] Scheduled auto-backup failed:', e);
        } finally {
          isBackingUpRef.current = false;
        }
      }
    };

    const checker = setInterval(checkAndTriggerBackup, 30000); // Check every 30s
    return () => clearInterval(checker);
  }, [driveAutoBackup, driveTokenInfo?.token, lastDriveBackup, driveAutoBackupInterval]);

  // Check Drive backups count if token exists
  useEffect(() => {
    if (driveTokenInfo?.token) {
      listGoogleDriveBackups(driveTokenInfo.token)
        .then(res => {
          setDriveBackupsCount(res.files.length);
          if (res.folderId) setDriveFolderId(res.folderId);
        })
        .catch(err => {
          console.warn('Silent drive list check:', err);
        });
    }
  }, [driveTokenInfo?.token]);

  // Automated Workspace Sync on App Launch and On-Demand
  const autoSyncNow = useCallback(async (customState?: AppState): Promise<boolean> => {
    const stateToSync = customState || appState;
    setIsAutoAuthenticating(true);
    setSheetsError(null);
    setDriveError(null);

    try {
      // 1. Initialize persistent storage and fetch active token via silent auto-auth
      await initPersistentStorage();
      const activeToken = await autoAuthenticateAndGetActiveToken(currentUserEmail);

      if (!activeToken) {
        console.info('[Workspace Sync] Auto-auth waiting for one-time Google connection.');
        setIsAutoAuthenticating(false);
        refreshWorkspaceState();
        return false;
      }

      refreshWorkspaceState();

      // 2. Auto-locate or create Master Spreadsheet
      let curSheetId = getStoredSpreadsheetId();
      if (!curSheetId) {
        try {
          console.info('[Workspace Sync] Setting up Master Falcon Spreadsheet automatically...');
          const info = await createMasterFalconSpreadsheet(activeToken, stateToSync);
          curSheetId = info.spreadsheetId;
          setStoredSpreadsheetId(curSheetId);
          setSpreadsheetId(curSheetId);
        } catch (e: any) {
          console.warn('[Workspace Sync] Auto-create spreadsheet notice:', e);
        }
      }

      // 3. Auto-locate or create Google Drive Backup folder
      let curFolderId = getStoredDriveFolderId();
      if (!curFolderId) {
        try {
          const folder = await getOrCreateBackupFolder(activeToken);
          setStoredDriveFolderId(folder.id);
          setDriveFolderId(folder.id);
        } catch (e: any) {
          console.warn('[Workspace Sync] Auto-create backup folder notice:', e);
        }
      }

      let sheetsSuccess = false;
      let driveSuccess = false;

      // 4. AUTOMATICALLY SYNC SHEETS ON APP OPEN
      if (curSheetId) {
        setIsSyncingSheets(true);
        try {
          await populateAllSheets(activeToken, curSheetId, stateToSync);
          const nowTime = new Date().toLocaleString('en-GB');
          setLastSheetsSync(nowTime);
          setLastSheetsSyncTime(nowTime);
          sheetsSuccess = true;
          console.info('[Workspace Sync] ✓ Google Sheets automatically synchronized on app launch!');
        } catch (sErr: any) {
          console.warn('[Workspace Sync] Startup Sheets sync notice:', sErr);
        } finally {
          setIsSyncingSheets(false);
        }
      }

      // 5. AUTOMATICALLY BACKUP TO GOOGLE DRIVE ON APP OPEN
      try {
        setIsUploadingDrive(true);
        const { jsonString, filename } = getDatabaseJSONString(stateToSync, currentUserEmail, terminalId, true);
        const uploaded = await uploadBackupToGoogleDrive(activeToken, {
          fileName: filename,
          fileContent: jsonString,
          mimeType: 'application/json',
          description: `Falcon Rod Maker POS - Automated App Launch Backup (${stateToSync.transactions?.length || 0} txns, ${stateToSync.products?.length || 0} products)`
        });
        const nowIso = new Date().toISOString();
        setLastDriveBackup(nowIso);
        setLastDriveBackupTime(nowIso);
        setDriveBackupsCount(prev => prev + 1);
        driveSuccess = true;
        console.info('[Workspace Sync] ✓ Google Drive backup uploaded on app launch:', uploaded.name);
      } catch (dErr: any) {
        console.warn('[Workspace Sync] Startup Drive backup notice:', dErr);
      } finally {
        setIsUploadingDrive(false);
      }

      if (sheetsSuccess || driveSuccess) {
        setSheetsSuccessMsg('✓ Google Workspace auto-authenticated & synced on app open!');
        setTimeout(() => setSheetsSuccessMsg(null), 5000);
        notifyWorkspaceSyncUpdated();
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('[Workspace Sync] Startup autoSyncNow notice:', err);
      return false;
    } finally {
      setIsAutoAuthenticating(false);
      refreshWorkspaceState();
    }
  }, [appState, currentUserEmail, terminalId, refreshWorkspaceState]);

  // Trigger Automatic Authentication & Sync immediately upon application mount
  useEffect(() => {
    if (initialBackupChecked.current) return;
    initialBackupChecked.current = true;

    console.info('[Workspace Sync] App opened: starting automatic authentication & sync...');
    autoSyncNow();
  }, [autoSyncNow]);

  // Auto-sync whenever user returns to or resumes the app
  useEffect(() => {
    const handleAppResume = () => {
      console.info('[Workspace Sync] Window focused / resumed: verifying workspace sync...');
      autoSyncNow();
    };
    window.addEventListener('focus', handleAppResume);
    return () => window.removeEventListener('focus', handleAppResume);
  }, [autoSyncNow]);

  // Debounced auto-sync engine with concurrency locking, maxWait, and cooldown buffer
  const lastSyncedHashRef = useRef<string>('');
  const debounceTimerRef = useRef<any>(null);
  const maxWaitTimerRef = useRef<any>(null);
  const firstChangeTimestampRef = useRef<number>(0);
  const isSyncExecutingRef = useRef<boolean>(false);
  const pendingSyncStateRef = useRef<AppState | null>(null);
  const lastSyncCompletedTimeRef = useRef<number>(0);

  const calculateFingerprint = useCallback((state: AppState): string => {
    const txLen = state.transactions?.length || 0;
    const firstTx = state.transactions?.[0];
    const txSig = firstTx ? `${firstTx.id}_${firstTx.date}_${firstTx.time}_${firstTx.total}` : 'empty';
    const payLen = state.customerPayments?.length || 0;
    const prodLen = state.products?.length || 0;
    const rawLen = state.rawStock?.length || 0;
    const expLen = state.expenses?.length || 0;
    const custLen = state.customerLedgers?.length || 0;
    return `${txLen}:${txSig}:${payLen}:${prodLen}:${rawLen}:${expLen}:${custLen}`;
  }, []);

  // Sync All 7 Google Sheets
  const syncAllSheets = useCallback(
    async (customState?: AppState): Promise<boolean> => {
      const token = sheetsTokenInfo?.token || getStoredSheetsToken()?.token;
      const targetId = spreadsheetId || getStoredSpreadsheetId();

      if (!token) {
        setSheetsError('Please connect your Google Account first to authorize Sheets.');
        return false;
      }
      if (!targetId) {
        setSheetsError('Please link or create a Google Spreadsheet first in the Sheets panel.');
        return false;
      }

      setIsSyncingSheets(true);
      setSheetsError(null);
      try {
        const stateToSync = customState || appState;
        await populateAllSheets(token, targetId, stateToSync);
        const now = new Date().toLocaleString('en-GB');
        setLastSheetsSync(now);
        setSheetsSuccessMsg('✓ All 7 Google Sheets tabs updated successfully!');
        setTimeout(() => setSheetsSuccessMsg(null), 4000);
        return true;
      } catch (err: any) {
        if (err?.message?.includes('401') || err?.message?.includes('Invalid Credentials')) {
          clearSheetsToken();
          setSheetsTokenInfo(null);
          setSheetsError('Google Sheets authorization expired. Please reconnect your account.');
        } else {
          setSheetsError(err?.message || 'Failed to sync with Google Sheets.');
        }
        return false;
      } finally {
        setIsSyncingSheets(false);
      }
    },
    [sheetsTokenInfo, spreadsheetId, appState]
  );

  const triggerDebouncedSync = useCallback((stateToSync: AppState) => {
    if (!sheetsAutoSync || !sheetsTokenInfo?.token || !spreadsheetId) return;

    const executeSync = async () => {
      // Cooldown check: prevent triggering within 10s of last sync
      const timeSinceLast = Date.now() - lastSyncCompletedTimeRef.current;
      if (timeSinceLast < 10000) {
        const remainingDelay = 10000 - timeSinceLast;
        debounceTimerRef.current = setTimeout(executeSync, remainingDelay);
        return;
      }

      if (isSyncExecutingRef.current) {
        // Another sync is currently in-flight; queue this state
        pendingSyncStateRef.current = stateToSync;
        return;
      }

      isSyncExecutingRef.current = true;
      firstChangeTimestampRef.current = 0;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);

      try {
        console.log('[Workspace Sync] Executing debounced Google Sheets auto-sync...');
        await syncAllSheets(stateToSync);
        lastSyncedHashRef.current = calculateFingerprint(stateToSync);
        lastSyncCompletedTimeRef.current = Date.now();
      } catch (e) {
        console.warn('[Workspace Sync] Debounced sync error:', e);
      } finally {
        isSyncExecutingRef.current = false;
        // If a pending change occurred during the sync execution, trigger it after cooldown
        if (pendingSyncStateRef.current) {
          const nextState = pendingSyncStateRef.current;
          pendingSyncStateRef.current = null;
          setTimeout(() => triggerDebouncedSync(nextState), 10000);
        }
      }
    };

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set max wait timer if this is the first change in the batch
    if (!firstChangeTimestampRef.current) {
      firstChangeTimestampRef.current = Date.now();
      maxWaitTimerRef.current = setTimeout(() => {
        executeSync();
      }, 25000); // 25s max wait
    }

    // 5-second debounce quiet period
    debounceTimerRef.current = setTimeout(executeSync, 5000);
  }, [sheetsAutoSync, sheetsTokenInfo?.token, spreadsheetId, syncAllSheets, calculateFingerprint]);

  useEffect(() => {
    if (!sheetsAutoSync || !sheetsTokenInfo?.token || !spreadsheetId) return;

    const currentHash = calculateFingerprint(appState);
    if (!lastSyncedHashRef.current) {
      lastSyncedHashRef.current = currentHash;
      return;
    }

    if (lastSyncedHashRef.current === currentHash) return;

    triggerDebouncedSync(appState);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [appState, sheetsAutoSync, sheetsTokenInfo?.token, spreadsheetId, calculateFingerprint, triggerDebouncedSync]);

  // Sequential transaction queue to avoid overlapping concurrent requests
  const isTxSyncingRef = useRef(false);
  const txQueueRef = useRef<{ transaction: Transaction; state?: AppState }[]>([]);

  const processTxQueue = async () => {
    if (isTxSyncingRef.current || txQueueRef.current.length === 0) return;
    const item = txQueueRef.current.shift();
    if (!item) return;

    isTxSyncingRef.current = true;
    try {
      const token = sheetsTokenInfo?.token || getStoredSheetsToken()?.token;
      const targetId = spreadsheetId || getStoredSpreadsheetId();
      if (token && targetId) {
        await syncSingleTransactionWithSheet(token, targetId, item.transaction, item.state || appState);
        const now = new Date().toLocaleString('en-GB');
        setLastSheetsSync(now);
      }
    } catch (err: any) {
      console.warn('Transaction Sheet sync failed, queued for background sync:', err);
      import('../utils/backgroundSyncEngine').then(({ enqueueSyncTask }) => {
        enqueueSyncTask('SHEETS_TXN_SYNC', item.transaction);
      }).catch(() => {});
    } finally {
      isTxSyncingRef.current = false;
      if (txQueueRef.current.length > 0) {
        setTimeout(processTxQueue, 1500); // 1.5s rate limit between single transactions
      }
    }
  };

  // Sync a single transaction to Google Sheets (debounced & serialized)
  const syncTransactionToSheets = useCallback(
    async (transaction: Transaction, latestState?: AppState): Promise<boolean> => {
      const token = sheetsTokenInfo?.token || getStoredSheetsToken()?.token;
      const targetId = spreadsheetId || getStoredSpreadsheetId();
      const isAuto = sheetsAutoSync || getSheetsAutoSyncEnabled();

      if (!isAuto || !token || !targetId) {
        return false;
      }

      txQueueRef.current.push({ transaction, state: latestState });
      processTxQueue();
      return true;
    },
    [sheetsTokenInfo, spreadsheetId, sheetsAutoSync, appState]
  );

  // Upload Database Snapshot to Google Drive
  const backupToDrive = useCallback(
    async (format: 'json' | 'sql' = 'json', customState?: AppState): Promise<boolean> => {
      const token = driveTokenInfo?.token || getStoredDriveToken()?.token;
      if (!token) {
        setDriveError('Please connect Google Drive first to create cloud backups.');
        return false;
      }

      setIsUploadingDrive(true);
      setDriveError(null);
      try {
        const stateToBackup = customState || appState;
        if (format === 'json') {
          const { jsonString, filename } = getDatabaseJSONString(stateToBackup, currentUserEmail, terminalId, true);
          const uploaded = await uploadBackupToGoogleDrive(token, {
            fileName: filename,
            fileContent: jsonString,
            mimeType: 'application/json',
            description: `Falcon Rod Maker POS Full JSON Database Snapshot (${stateToBackup.transactions.length} txns, ${stateToBackup.products.length} products)`
          });
          setDriveSuccessMsg(`✓ Successfully backed up JSON database to Google Drive: ${uploaded.name}`);
        } else {
          const sql = generateFullDatabaseSQL(
            stateToBackup,
            firebaseConfig.projectId,
            (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-falconrodmakerpo-4ec08e17-6c91-4aca-b59a-d747b503ca3a'
          );
          const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const filename = `Falcon_POS_PostgreSQL_Dump_${nowStr}.sql`;
          const uploaded = await uploadBackupToGoogleDrive(token, {
            fileName: filename,
            fileContent: sql,
            mimeType: 'application/sql',
            description: `Falcon Rod Maker POS Full PostgreSQL Schema & Data Dump`
          });
          setDriveSuccessMsg(`✓ Successfully uploaded SQL database dump to Google Drive: ${uploaded.name}`);
        }

        const now = new Date().toISOString();
        setLastDriveBackup(now);
        setDriveBackupsCount(prev => prev + 1);
        setTimeout(() => setDriveSuccessMsg(null), 5000);
        notifyWorkspaceSyncUpdated();
        return true;
      } catch (err: any) {
        if (err?.message?.includes('401') || err?.message?.includes('Invalid Credentials')) {
          clearDriveToken();
          setDriveTokenInfo(null);
          setDriveError('Google Drive authorization expired. Please reconnect your account.');
        } else {
          setDriveError(err?.message || 'Failed to upload backup to Google Drive.');
        }
        return false;
      } finally {
        setIsUploadingDrive(false);
      }
    },
    [driveTokenInfo, appState, currentUserEmail, terminalId]
  );

  // Backup All Files (both JSON Database Snapshot AND PostgreSQL SQL Dump)
  const backupAllFilesToDrive = useCallback(
    async (customState?: AppState): Promise<boolean> => {
      const token = driveTokenInfo?.token || getStoredDriveToken()?.token;
      if (!token) {
        setDriveError('Please connect Google Drive first to create cloud backups.');
        return false;
      }

      setIsUploadingDrive(true);
      setDriveError(null);
      try {
        const stateToBackup = customState || appState;
        
        // 1. Upload JSON Snapshot
        const { jsonString, filename: jsonName } = getDatabaseJSONString(stateToBackup, currentUserEmail, terminalId, true);
        await uploadBackupToGoogleDrive(token, {
          fileName: jsonName,
          fileContent: jsonString,
          mimeType: 'application/json',
          description: `Falcon Rod Maker POS Full JSON Database Snapshot (${stateToBackup.transactions.length} txns, ${stateToBackup.products.length} products)`
        });

        // 2. Upload SQL Dump
        const sql = generateFullDatabaseSQL(
          stateToBackup,
          firebaseConfig.projectId,
          (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-falconrodmakerpo-4ec08e17-6c91-4aca-b59a-d747b503ca3a'
        );
        const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const sqlName = `Falcon_POS_PostgreSQL_Dump_${nowStr}.sql`;
        await uploadBackupToGoogleDrive(token, {
          fileName: sqlName,
          fileContent: sql,
          mimeType: 'application/sql',
          description: `Falcon Rod Maker POS Full PostgreSQL Schema & Data Dump`
        });

        const now = new Date().toISOString();
        setLastDriveBackup(now);
        setLastDriveBackupTime(now);
        setDriveBackupsCount(prev => prev + 2);
        setDriveSuccessMsg(`✓ Successfully backed up all files (JSON & SQL) to Google Drive!`);
        setTimeout(() => setDriveSuccessMsg(null), 5000);
        notifyWorkspaceSyncUpdated();
        return true;
      } catch (err: any) {
        if (err?.message?.includes('401') || err?.message?.includes('Invalid Credentials')) {
          clearDriveToken();
          setDriveTokenInfo(null);
          setDriveError('Google Drive authorization expired. Please reconnect your account.');
        } else {
          setDriveError(err?.message || 'Failed to backup all files to Google Drive.');
        }
        return false;
      } finally {
        setIsUploadingDrive(false);
      }
    },
    [driveTokenInfo, appState, currentUserEmail, terminalId]
  );

  const changeDriveAutoBackupInterval = useCallback((hours: number) => {
    setDriveAutoBackupIntervalHours(hours);
    setDriveAutoBackupInterval(hours);
    const nextDate = getNextDriveBackupDate(lastDriveBackup, hours);
    const isToday = nextDate.toDateString() === new Date().toDateString();
    const timeStr = nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = nextDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
    setNextScheduledDriveBackup(isToday ? `Today at ${timeStr}` : `${dateStr} at ${timeStr}`);
    setDriveBackupCountdown(formatBackupCountdown(nextDate));
    notifyWorkspaceSyncUpdated();
  }, [lastDriveBackup]);

  // Connect Sheets
  const connectSheets = useCallback(async (): Promise<string | null> => {
    setSheetsError(null);
    try {
      const token = await requestGoogleSheetsToken(currentUserEmail);
      setSheetsTokenInfo(getStoredSheetsToken());
      setSheetsSuccessMsg('✓ Google Sheets connected successfully!');
      setTimeout(() => setSheetsSuccessMsg(null), 4000);
      notifyWorkspaceSyncUpdated();
      return token;
    } catch (err: any) {
      setSheetsError(err?.message || 'Failed to connect Google Sheets.');
      return null;
    }
  }, [currentUserEmail]);

  // Connect Drive
  const connectDrive = useCallback(async (): Promise<string | null> => {
    setDriveError(null);
    try {
      const token = await requestGoogleDriveToken(currentUserEmail);
      setDriveTokenInfo(getStoredDriveToken());
      setDriveSuccessMsg('✓ Google Drive connected successfully!');
      setTimeout(() => setDriveSuccessMsg(null), 4000);
      notifyWorkspaceSyncUpdated();
      return token;
    } catch (err: any) {
      setDriveError(err?.message || 'Failed to connect Google Drive.');
      return null;
    }
  }, [currentUserEmail]);

  // Disconnect Sheets
  const disconnectSheets = useCallback(() => {
    clearSheetsToken();
    setSheetsTokenInfo(null);
    setSheetsSuccessMsg('Google Sheets authorization disconnected.');
    setTimeout(() => setSheetsSuccessMsg(null), 3000);
    notifyWorkspaceSyncUpdated();
  }, []);

  // Disconnect Drive
  const disconnectDrive = useCallback(() => {
    clearDriveToken();
    setDriveTokenInfo(null);
    setDriveSuccessMsg('Google Drive session disconnected.');
    setTimeout(() => setDriveSuccessMsg(null), 3000);
    notifyWorkspaceSyncUpdated();
  }, []);

  // Toggle Sheets Auto Sync
  const toggleSheetsAutoSync = useCallback((enabled?: boolean) => {
    const newVal = enabled !== undefined ? enabled : !sheetsAutoSync;
    setSheetsAutoSync(newVal);
    setSheetsAutoSyncEnabled(newVal);
  }, [sheetsAutoSync]);

  // Toggle Drive Auto Backup
  const toggleDriveAutoBackup = useCallback((enabled?: boolean) => {
    const newVal = enabled !== undefined ? enabled : !driveAutoBackup;
    setDriveAutoBackup(newVal);
    setDriveAutoBackupEnabled(newVal);
  }, [driveAutoBackup]);

  // Calculate high-level status for header indicator
  const sheetsConnected = Boolean(sheetsTokenInfo?.token);
  const driveConnected = Boolean(driveTokenInfo?.token);
  const isSyncing = isSyncingSheets || isUploadingDrive;

  let workspaceStatus: 'syncing' | 'synced' | 'ready' | 'warning' | 'disconnected' = 'disconnected';
  let statusBadgeText = 'G-Sync';
  let statusBadgeTooltip = 'Google Workspace: Click to connect Google Sheets & Drive';

  if (isAutoAuthenticating) {
    workspaceStatus = 'syncing';
    statusBadgeText = 'Auto-Connecting...';
    statusBadgeTooltip = 'Google Workspace: Automatically authenticating and synchronizing with Google Sheets & Drive...';
  } else if (isSyncing) {
    workspaceStatus = 'syncing';
    statusBadgeText = isSyncingSheets ? 'Sheets Syncing...' : 'Drive Uploading...';
    statusBadgeTooltip = 'Google Workspace synchronizing live data in background...';
  } else if (sheetsConnected && spreadsheetId) {
    workspaceStatus = 'synced';
    if (driveConnected) {
      statusBadgeText = 'Sheets & Drive';
      statusBadgeTooltip = `Google Sheets (Live Sync Active) & Google Drive (${driveBackupsCount} backups) Connected`;
    } else {
      statusBadgeText = 'Sheets Live';
      statusBadgeTooltip = `Google Sheets: Linked to "${spreadsheetTitle || spreadsheetId}" (Auto-sync ${sheetsAutoSync ? 'ON' : 'OFF'})`;
    }
  } else if (driveConnected) {
    workspaceStatus = 'ready';
    statusBadgeText = 'Drive Ready';
    statusBadgeTooltip = `Google Drive: Connected (${driveBackupsCount} backups saved)`;
  } else if (sheetsConnected) {
    workspaceStatus = 'ready';
    statusBadgeText = 'Sheets Ready';
    statusBadgeTooltip = 'Google Sheets: Authorized. Auto-creating / linking spreadsheet.';
  }

  // Direct App Openers using Explicit Android Intents & Custom Tabs
  const openSheetsApp = useCallback(async () => {
    const targetUrl = spreadsheetUrl || (spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : 'https://docs.google.com/spreadsheets');
    await openExternalUrl(targetUrl, 'sheets');
  }, [spreadsheetUrl, spreadsheetId]);

  const openDriveApp = useCallback(async () => {
    const targetUrl = driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : 'https://drive.google.com';
    await openExternalUrl(targetUrl, 'drive');
  }, [driveFolderId]);

  return {
    // Sheets
    sheetsConnected,
    sheetsToken: sheetsTokenInfo?.token || null,
    spreadsheetId,
    spreadsheetTitle,
    spreadsheetUrl,
    lastSheetsSync,
    sheetsAutoSync,
    isSyncingSheets,
    sheetsError,
    sheetsSuccessMsg,

    // Drive
    driveConnected,
    driveToken: driveTokenInfo?.token || null,
    driveFolderId,
    lastDriveBackup,
    driveAutoBackup,
    driveAutoBackupInterval,
    nextScheduledDriveBackup,
    driveBackupCountdown,
    isUploadingDrive,
    driveError,
    driveSuccessMsg,
    driveBackupsCount,

    // Auto-auth engine
    isAutoAuthenticating,

    // Workspace overview
    workspaceStatus,
    statusBadgeText,
    statusBadgeTooltip,

    // Actions
    autoSyncNow,
    syncAllSheets,
    syncTransactionToSheets,
    backupToDrive,
    backupAllFilesToDrive,
    connectSheets,
    connectDrive,
    disconnectSheets,
    disconnectDrive,
    toggleSheetsAutoSync,
    toggleDriveAutoBackup,
    changeDriveAutoBackupInterval,
    refreshWorkspaceState,
    openSheetsApp,
    openDriveApp
  };
}
