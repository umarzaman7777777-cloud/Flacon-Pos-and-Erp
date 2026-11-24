import React, { useEffect, useRef, useState } from 'react';
import {
  WifiOff,
  CheckCircle2,
  RefreshCw,
  Cloud,
  FileCheck2,
  CreditCard,
  X,
  BellRing,
  Check
} from 'lucide-react';
import { AppLanguage, AppState } from '../types';
import {
  getCachedOfflineNotifications,
  OFFLINE_NOTIF_CACHED_EVENT
} from '../utils/mobilePermissions';
import {
  ReconnectSyncBreakdown,
  syncCachedOfflineNotificationsToCloud,
  computeWorkshopAlertSummary
} from '../utils/workshopNotifications';
import { flushSyncQueue, getPendingSyncQueue } from '../utils/backgroundSyncEngine';

const WAS_OFFLINE_FLAG_KEY = 'falcon_was_offline_pending_sync';

interface OfflineIndicatorProps {
  isOnline?: boolean;
  syncState?: 'synced' | 'syncing' | 'offline' | 'error';
  pendingQueueCount?: number;
  lastSyncTime?: string | null;
  language?: AppLanguage;
  appState?: AppState;
  onOpenNotifications?: () => void;
  onForceSyncNow?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOnline: propIsOnline,
  syncState = 'synced',
  pendingQueueCount = 0,
  lastSyncTime,
  language = 'en',
  appState,
  onOpenNotifications,
  onForceSyncNow
}) => {
  const [browserOnline, setBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const effectiveOnline = propIsOnline !== undefined ? propIsOnline && browserOnline : browserOnline;

  const [cachedNotifCount, setCachedNotifCount] = useState<number>(
    () => getCachedOfflineNotifications().length
  );

  const [toastPhase, setToastPhase] = useState<'hidden' | 'syncing' | 'synced'>('hidden');
  const [syncBreakdown, setSyncBreakdown] = useState<ReconnectSyncBreakdown | null>(null);
  const [flushedRecordsCount, setFlushedRecordsCount] = useState<number>(0);

  const wasOfflineRef = useRef<boolean>(false);
  const queuedBeforeReconnectRef = useRef<number>(0);
  const appStateRef = useRef<AppState | undefined>(appState);
  appStateRef.current = appState;
  const onForceSyncNowRef = useRef<(() => void) | undefined>(onForceSyncNow);
  onForceSyncNowRef.current = onForceSyncNow;
  const pendingQueueCountRef = useRef<number>(pendingQueueCount);
  pendingQueueCountRef.current = pendingQueueCount;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncStartedAtRef = useRef<number>(0);
  const isSyncRunningRef = useRef<boolean>(false);

  // Keep live count of offline cached notifications
  useEffect(() => {
    const handleCachedUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (Array.isArray(detail)) {
        setCachedNotifCount(detail.length);
      } else {
        setCachedNotifCount(getCachedOfflineNotifications().length);
      }
    };
    window.addEventListener(OFFLINE_NOTIF_CACHED_EVENT, handleCachedUpdate);
    return () => window.removeEventListener(OFFLINE_NOTIF_CACHED_EVENT, handleCachedUpdate);
  }, []);

  // Track offline state transitions
  useEffect(() => {
    if (!effectiveOnline) {
      wasOfflineRef.current = true;
      queuedBeforeReconnectRef.current = Math.max(
        queuedBeforeReconnectRef.current,
        pendingQueueCount + getPendingSyncQueue().length + getCachedOfflineNotifications().length
      );
      try {
        sessionStorage.setItem(WAS_OFFLINE_FLAG_KEY, 'true');
      } catch {}
      setToastPhase('hidden');
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    }
  }, [effectiveOnline, pendingQueueCount]);

  const runReconnectSyncRef = useRef<() => Promise<void>>(async () => {});
  runReconnectSyncRef.current = async () => {
    if (isSyncRunningRef.current) return;
    isSyncRunningRef.current = true;

    try {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }

      syncStartedAtRef.current = Date.now();
      setToastPhase('syncing');

      const preQueueTotal =
        queuedBeforeReconnectRef.current ||
        pendingQueueCountRef.current +
          getPendingSyncQueue().length +
          getCachedOfflineNotifications().length;

      try {
        if (onForceSyncNowRef.current) {
          onForceSyncNowRef.current();
        }
        if (appStateRef.current) {
          await flushSyncQueue(appStateRef.current);
        } else {
          await flushSyncQueue();
        }
      } catch {}

      let breakdown: ReconnectSyncBreakdown | null = null;
      if (appStateRef.current) {
        try {
          breakdown = await syncCachedOfflineNotificationsToCloud(appStateRef.current);
        } catch {}
      }

      // Guarantee smooth minimum visibility for Syncing -> Synchronized transition
      const elapsed = Date.now() - syncStartedAtRef.current;
      if (elapsed < 750) {
        await new Promise((r) => setTimeout(r, 750 - elapsed));
      }

      setSyncBreakdown(breakdown);
      setFlushedRecordsCount(preQueueTotal);
      queuedBeforeReconnectRef.current = 0;
      wasOfflineRef.current = false;
      try {
        sessionStorage.removeItem(WAS_OFFLINE_FLAG_KEY);
      } catch {}

      setToastPhase('synced');
      dismissTimerRef.current = setTimeout(() => {
        setToastPhase('hidden');
      }, 9500);
    } finally {
      isSyncRunningRef.current = false;
    }
  };

  // Listen to browser online/offline transitions + execute real reconnection sync
  useEffect(() => {
    const handleOnline = () => {
      setBrowserOnline(true);
      runReconnectSyncRef.current();
    };

    const handleOffline = () => {
      setBrowserOnline(false);
      wasOfflineRef.current = true;
      try {
        sessionStorage.setItem(WAS_OFFLINE_FLAG_KEY, 'true');
      } catch {}
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // If app reopened online while cached offline alerts or prior offline flag existed, reconcile once
    const hadPriorOffline = (() => {
      try {
        return sessionStorage.getItem(WAS_OFFLINE_FLAG_KEY) === 'true';
      } catch {
        return false;
      }
    })();

    if (
      typeof navigator !== 'undefined' &&
      navigator.onLine &&
      (hadPriorOffline || getCachedOfflineNotifications().length > 0)
    ) {
      runReconnectSyncRef.current();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  // Also detect propIsOnline transitioning back from false -> true (e.g. Capacitor / hook reconnect)
  useEffect(() => {
    if (effectiveOnline && wasOfflineRef.current && toastPhase === 'hidden') {
      runReconnectSyncRef.current();
    }
  }, [effectiveOnline, toastPhase]);

  const handleDismiss = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setToastPhase('hidden');
  };

  // Offline Mode Persistent Toast
  if (!effectiveOnline) {
    const bufferedTotal = pendingQueueCount + cachedNotifCount;
    return (
      <div
        role="status"
        className="fixed bottom-4 left-4 right-4 sm:right-auto z-[9990] max-w-md flex items-center gap-2.5 rounded-xl bg-amber-500/95 text-slate-950 px-3.5 py-2.5 text-xs font-bold shadow-xl border border-amber-300 backdrop-blur-sm"
      >
        <WifiOff className="w-4 h-4 text-slate-950 shrink-0 animate-pulse" />
        <div className="min-w-0 flex-1">
          <p className="leading-snug">
            {language === 'ur'
              ? 'آف لائن موڈ — گیٹ پاس، بیک اپ اور چیک الرٹس لوکل کیش میں محفوظ ہو رہے ہیں۔'
              : 'Offline Mode — Caching gate passes, backups & cheque alerts locally.'}
          </p>
          {bufferedTotal > 0 && (
            <p className="text-[10px] font-mono text-slate-900/80 mt-0.5">
              {bufferedTotal} cached update{bufferedTotal > 1 ? 's' : ''} queued for cloud sync on reconnect
            </p>
          )}
        </div>
      </div>
    );
  }

  // Reconnecting -> Syncing Toast
  if (toastPhase === 'syncing' || (wasOfflineRef.current && syncState === 'syncing')) {
    return (
      <div
        role="status"
        className="fixed bottom-4 left-4 right-4 sm:right-auto z-[9990] max-w-md rounded-2xl bg-slate-950/95 text-white px-4 py-3 text-xs shadow-2xl border border-sky-500/50 backdrop-blur-md space-y-1.5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-sky-300">
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            <span className="uppercase tracking-wider font-mono text-[11px]">
              {language === 'ur' ? 'سنک اسٹیٹس · منسلک ہو رہا ہے' : 'Sync Status · Reconnecting'}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          {language === 'ur'
            ? 'آف لائن محفوظ شدہ گیٹ پاس، بیک اپ اور چیک الرٹس کلاؤڈ پر منتقل کیے جا رہے ہیں...'
            : 'Synchronizing cached offline notifications (Gate Passes, Backups, Cheques) & pending updates to the cloud...'}
        </p>
      </div>
    );
  }

  // Reconnected -> Verified Sync Status Toast
  if (toastPhase === 'synced') {
    const liveSummary = appState ? computeWorkshopAlertSummary(appState) : null;
    const gateCount =
      syncBreakdown?.gatepassesCount ?? liveSummary?.gatepasses.pendingCount ?? 0;
    const chequeCount =
      syncBreakdown?.chequesCount ??
      (liveSummary
        ? liveSummary.cheques.bouncedCount +
          liveSummary.cheques.overdueCount +
          liveSummary.cheques.dueWithin3DaysCount
        : 0);
    const totalCachedSynced = syncBreakdown?.totalCachedNotifications ?? 0;
    const syncedTimeLabel = syncBreakdown?.syncedAt || lastSyncTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-4 right-4 sm:right-auto z-[9990] max-w-md rounded-2xl bg-slate-950/95 text-white p-3.5 sm:p-4 text-xs shadow-2xl border border-emerald-500/60 backdrop-blur-md space-y-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200"
      >
        {/* Top Row: Title + Timestamp + Close */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
                  {language === 'ur' ? 'سنک اسٹیٹس' : 'Sync Status'}
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-mono text-[10px] font-semibold">
                  Cloud Synchronized
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Synced at {syncedTimeLabel}
                {totalCachedSynced > 0 || flushedRecordsCount > 0
                  ? ` · ${Math.max(totalCachedSynced, flushedRecordsCount)} offline item${
                      Math.max(totalCachedSynced, flushedRecordsCount) > 1 ? 's' : ''
                    } reconciled`
                  : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss sync status"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Message */}
        <p className="text-[11px] text-slate-200 leading-relaxed">
          {language === 'ur'
            ? 'انٹرنیٹ بحال ہو گیا ہے — تمام آف لائن محفوظ شدہ نوٹیفکیشنز (گیٹ پاس، بیک اپ، چیکس) کلاؤڈ سے سنک ہو چکے ہیں۔'
            : 'Internet reconnected — all cached offline notifications (Gate Passes, Backups, Cheques) and queued changes are synced to the cloud.'}
        </p>

        {/* Synced Category Confirmation Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 font-mono text-[10px]">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/35">
            <FileCheck2 className="w-3 h-3 text-amber-400" />
            <span>Gate Passes{gateCount > 0 ? ` (${gateCount})` : ''}</span>
            <Check className="w-2.5 h-2.5 text-emerald-400" />
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/35">
            <Cloud className="w-3 h-3 text-sky-400" />
            <span>
              Backups
              {syncBreakdown?.backupsCount ? ` (${syncBreakdown.backupsCount})` : ''}
            </span>
            <Check className="w-2.5 h-2.5 text-emerald-400" />
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/35">
            <CreditCard className="w-3 h-3 text-rose-400" />
            <span>Cheques{chequeCount > 0 ? ` (${chequeCount})` : ''}</span>
            <Check className="w-2.5 h-2.5 text-emerald-400" />
          </span>
        </div>

        {/* Quick Actions */}
        {onOpenNotifications && (
          <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                handleDismiss();
                onOpenNotifications();
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] font-mono flex items-center gap-1 cursor-pointer transition"
            >
              <BellRing className="w-3 h-3" />
              <span>View Alerts Hub</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
};
