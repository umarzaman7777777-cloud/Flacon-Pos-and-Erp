import { useEffect, useState, useRef, useCallback } from 'react';
import { doc, collection, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { AppState } from '../types';
import { storeSheetsToken, setStoredSpreadsheetId, setStoredSpreadsheetTitle, setStoredSpreadsheetUrl, notifyWorkspaceSyncUpdated } from '../utils/googleSheetsSync';
import { storeDriveToken, setStoredDriveFolderId } from '../utils/googleDriveBackup';

export interface ConnectedTerminal {
  id: string;
  name: string;
  lastSeen: string;
  role?: string;
}

export interface QueuedSyncItem {
  timestamp: number;
  version: number;
  terminalId: string;
  statePayload: string;
}

const OFFLINE_QUEUE_KEY = 'falcon_pos_offline_sync_queue';

export function useFirestoreSync(
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>
) {
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'offline' | 'error'>('syncing');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [activeTerminals, setActiveTerminals] = useState<ConnectedTerminal[]>([]);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(() => {
    try {
      const q = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return q ? JSON.parse(q).length : 0;
    } catch {
      return 0;
    }
  });

  // Persistent unique terminal identifier
  const [terminalId] = useState<string>(() => {
    const saved = localStorage.getItem('falcon_pos_terminal_id');
    if (saved) return saved;
    const generated = 'term_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('falcon_pos_terminal_id', generated);
    return generated;
  });

  const [terminalName, setTerminalNameState] = useState<string>(() => {
    return localStorage.getItem('falcon_pos_terminal_name') || 'Counter Terminal 1';
  });

  const setTerminalName = (name: string) => {
    setTerminalNameState(name);
    localStorage.setItem('falcon_pos_terminal_name', name);
  };

  const isRemoteUpdateRef = useRef(false);
  const localVersionRef = useRef<number>(Date.now());
  const debounceTimerRef = useRef<any>(null);
  const isFlushingQueueRef = useRef<boolean>(false);
  const latestStateRef = useRef<AppState>(state);

  // Keep latestStateRef updated for immediate queued access
  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  // Read current offline queue from storage
  const getOfflineQueue = (): QueuedSyncItem[] => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to parse offline sync queue from localStorage:', e);
      return [];
    }
  };

  // Save offline queue to storage
  const saveOfflineQueue = (queue: QueuedSyncItem[]) => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      setPendingQueueCount(queue.length);
    } catch (e) {
      console.warn('Failed to save offline sync queue to localStorage:', e);
    }
  };

  // Add an item to the offline queue
  const enqueueOfflineUpdate = useCallback((stateToQueue: AppState) => {
    const queue = getOfflineQueue();
    const version = Date.now();
    const item: QueuedSyncItem = {
      timestamp: version,
      version,
      terminalId,
      statePayload: JSON.stringify(stateToQueue)
    };

    // Compact the queue: keep the most recent queued states to prevent unbounded localStorage growth
    // but preserve the latest state change
    const updatedQueue = [...queue.slice(-10), item];
    saveOfflineQueue(updatedQueue);
  }, [terminalId]);

  // Clear or flush the offline queue to Firestore
  const flushOfflineQueue = useCallback(async () => {
    if (isFlushingQueueRef.current) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    isFlushingQueueRef.current = true;
    setSyncState('syncing');

    try {
      // Pick the latest queued state to push to cloud
      const latestItem = queue[queue.length - 1];
      const path = 'sync_states/falcon_workshop';

      const payload = {
        workspaceId: 'falcon_rod_maker',
        updatedAt: new Date(latestItem.timestamp).toISOString(),
        updatedByTerminal: terminalId,
        statePayload: latestItem.statePayload,
        version: latestItem.version
      };

      await setDoc(doc(db, 'sync_states', 'falcon_workshop'), payload);

      // Successfully pushed queued items
      saveOfflineQueue([]);
      setSyncState('synced');
      setSyncErrorMsg(null);
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      console.info(`[Falcon Sync] Successfully flushed ${queue.length} pending queued offline update(s) to Firestore.`);
    } catch (error) {
      console.warn('[Falcon Sync] Failed to flush offline queue to cloud:', error);
      setSyncState('offline');
      setSyncErrorMsg(error instanceof Error ? error.message : 'Network offline');
    } finally {
      isFlushingQueueRef.current = false;
    }
  }, [terminalId]);

  // 1. Listen for real-time remote updates from other terminals
  useEffect(() => {
    const syncDocRef = doc(db, 'sync_states', 'falcon_workshop');
    const path = 'sync_states/falcon_workshop';

    const unsubscribe = onSnapshot(
      syncDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setSyncState(pendingQueueCount > 0 ? 'offline' : 'synced');
          return;
        }

        const data = snapshot.data();
        if (!data || !data.statePayload) return;

        // If the update came from another terminal or has a newer timestamp
        if (data.updatedByTerminal !== terminalId) {
          try {
            const parsed = JSON.parse(data.statePayload);
            if (parsed && typeof parsed === 'object') {
              isRemoteUpdateRef.current = true;
              localVersionRef.current = data.version || Date.now();
              setState(parsed);
              setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
              setSyncState(pendingQueueCount > 0 ? 'offline' : 'synced');
              setSyncErrorMsg(null);
            }
          } catch (e) {
            console.error('Error parsing remote sync payload:', e);
          }
        } else {
          setSyncState(pendingQueueCount > 0 ? 'offline' : 'synced');
        }
      },
      (error) => {
        console.warn('Firestore sync listener error (operating in local fallback):', error);
        setSyncState('offline');
        setSyncErrorMsg(error.message);
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch (_) {
          // Handled
        }
      }
    );

    return () => unsubscribe();
  }, [terminalId, setState, pendingQueueCount]);

  // 2. Terminal Heartbeat Registration
  useEffect(() => {
    const registerHeartbeat = async () => {
      try {
        await setDoc(doc(db, 'terminals', terminalId), {
          id: terminalId,
          name: terminalName,
          lastSeen: new Date().toISOString(),
          role: 'POS Terminal'
        });
      } catch (err) {
        // Silent catch for heartbeat
      }
    };

    registerHeartbeat();
    const interval = setInterval(registerHeartbeat, 60000); // 1 minute heartbeat
    return () => clearInterval(interval);
  }, [terminalId, terminalName]);

  // 3. Listen to all registered terminals
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'terminals'),
      (snapshot) => {
        const list: ConnectedTerminal[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.id && data.name) {
            list.push({
              id: data.id,
              name: data.name,
              lastSeen: data.lastSeen || '',
              role: data.role || 'POS Terminal'
            });
          }
        });
        setActiveTerminals(list);
      },
      (err) => {
        console.debug('Terminals listener fallback:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  // 4. Push local changes to Firestore with debounce & offline queueing
  const pushStateToCloud = useCallback(async (stateToPush: AppState) => {
    // Check browser online status
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.warn('[Falcon Sync] Offline detected; enqueuing state update locally.');
      enqueueOfflineUpdate(stateToPush);
      setSyncState('offline');
      setSyncErrorMsg('Browser offline. Changes queued for auto-sync.');
      return;
    }

    setSyncState('syncing');
    const path = 'sync_states/falcon_workshop';
    try {
      const version = Date.now();
      localVersionRef.current = version;

      const payload = {
        workspaceId: 'falcon_rod_maker',
        updatedAt: new Date().toISOString(),
        updatedByTerminal: terminalId,
        statePayload: JSON.stringify(stateToPush),
        version
      };

      // Dual-write: Primary workshop multi-terminal document and dedicated Gmail owner vault
      const primaryDoc = doc(db, 'sync_states', 'falcon_workshop');
      const gmailDoc = doc(db, 'sync_states', 'gmail_umarzaman7777777_gmail_com');
      
      await Promise.allSettled([
        setDoc(primaryDoc, payload),
        setDoc(gmailDoc, payload)
      ]);

      // If there were any previous queued items, we can clear them now since this state encompasses all changes
      saveOfflineQueue([]);

      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setSyncState('synced');
      setSyncErrorMsg(null);
    } catch (error) {
      console.warn('[Falcon Sync] Failed to sync state to Firestore; enqueuing to local queue:', error);
      enqueueOfflineUpdate(stateToPush);
      setSyncState('offline');
      setSyncErrorMsg(error instanceof Error ? error.message : 'Network offline');
      try {
        handleFirestoreError(error, OperationType.WRITE, path);
      } catch (_) {
        // Handled
      }
    }
  }, [terminalId, enqueueOfflineUpdate]);

  // Push immediately without waiting for debounce (crucial for critical entries & deletes)
  const pushStateImmediately = useCallback(async (stateToPush: AppState) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await pushStateToCloud(stateToPush);
  }, [pushStateToCloud]);

  // Explicit restore from Gmail cloud vault (for new phone / device replacement)
  const restoreFromGmailVault = useCallback(async (email: string = 'umarzaman7777777@gmail.com'): Promise<{ success: boolean; message: string; data?: AppState }> => {
    setSyncState('syncing');
    try {
      const cleanEmail = email.toLowerCase().trim();
      const sanitizedDocId = 'gmail_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      
      let snap = await getDoc(doc(db, 'sync_states', sanitizedDocId));
      if (!snap.exists()) {
        snap = await getDoc(doc(db, 'sync_states', 'falcon_workshop'));
      }

      if (!snap.exists()) {
        setSyncState('synced');
        return { success: false, message: `No cloud vault backup found for ${email}.` };
      }

      const docData = snap.data();
      if (!docData || !docData.statePayload) {
        setSyncState('synced');
        return { success: false, message: 'Cloud vault payload is empty.' };
      }

      const parsed = JSON.parse(docData.statePayload);
      if (parsed && typeof parsed === 'object') {
        isRemoteUpdateRef.current = true;
        localVersionRef.current = docData.version || Date.now();
        setState(parsed);
        localStorage.setItem('falcon_pos_state', JSON.stringify(parsed));
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(now);
        setSyncState('synced');
        setSyncErrorMsg(null);
        return {
          success: true,
          message: `Restored ${parsed.transactions?.length || 0} orders, ${parsed.customerLedgers?.length || 0} customer accounts, and all inventory to this device!`,
          data: parsed
        };
      }
      return { success: false, message: 'Failed to parse cloud vault data.' };
    } catch (err: any) {
      console.error('Failed to restore from Gmail cloud vault:', err);
      setSyncState('error');
      setSyncErrorMsg(err?.message || 'Restore failed');
      return { success: false, message: err?.message || 'Could not fetch cloud vault' };
    }
  }, [setState]);

  // 5. Detect Online / Offline network transitions & automatically flush queue
  useEffect(() => {
    const handleOnline = () => {
      console.info('[Falcon Sync] Network connection restored. Auto-flushing offline queue...');
      setIsOnline(true);
      setSyncErrorMsg(null);
      // Flush queued updates or current state immediately
      const queue = getOfflineQueue();
      if (queue.length > 0) {
        flushOfflineQueue();
      } else {
        pushStateToCloud(latestStateRef.current);
      }
    };

    const handleOffline = () => {
      console.warn('[Falcon Sync] Network connection lost. Switching to offline queue mode.');
      setIsOnline(false);
      setSyncState('offline');
      setSyncErrorMsg('Internet connection lost. Local cache active.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check: if we have pending queue on mount and we are online, attempt flush
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      const queue = getOfflineQueue();
      if (queue.length > 0) {
        flushOfflineQueue();
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushOfflineQueue, pushStateToCloud]);

  // 6. State change debounced push
  useEffect(() => {
    // If this update was triggered by incoming remote data, don't echo it back
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      pushStateToCloud(state);
    }, 1200);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [state, pushStateToCloud]);

  const forceSyncNow = () => {
    const queue = getOfflineQueue();
    if (queue.length > 0) {
      flushOfflineQueue();
    } else {
      pushStateToCloud(state);
    }
  };

  return {
    syncState,
    lastSyncTime,
    terminalId,
    terminalName,
    setTerminalName,
    activeTerminals,
    syncErrorMsg,
    forceSyncNow,
    pushStateImmediately,
    restoreFromGmailVault,
    isOnline,
    pendingQueueCount
  };
}
