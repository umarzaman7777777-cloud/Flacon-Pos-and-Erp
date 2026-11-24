/**
 * Unified Workshop & Lockscreen Notification Engine for Falcon Rod Maker POS
 *
 * Dispatches real mobile system & lockscreen alerts across ALL categories:
 * - Backups & Cloud Sync (Google Drive auto/manual, SQL/JSON export, Sheets errors, stale backups)
 * - Gate Passes (Outward dispatch, Supplier inward receipt, Pending confirmed orders awaiting pass)
 * - Cheques & Banking (Bounce/auto-reversal, Cleared, Presented, Endorsed, Overdue, Due today / ≤ 3 days)
 * - Orders & Payments (New orders created, payments recorded)
 * - Raw Material Low Stock (Below threshold alerts)
 * - Customer Inquiries (Urgent/high priority inquiries)
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AppState, ChequeRecord, ChequeStatus, Inquiry, RawStockItem, Transaction } from '../types';
import { extractAllCheques } from './chequeManager';
import { fmt, dmyToISO, parseDMY } from './helpers';
import {
  NotificationCategory,
  CachedOfflineNotification,
  getNotificationCategoryPrefs,
  getCachedOfflineNotifications,
  clearCachedOfflineNotifications,
  sendNativeNotification,
  setupAndroidLockscreenChannels,
  registerPosServiceWorker,
  scheduleLockscreenTestNotification
} from './mobilePermissions';
import { getLastDriveBackupTime, getDriveAutoBackupEnabled, getDriveAutoBackupIntervalHours, getNextDriveBackupDate } from './googleDriveBackup';

const COOLDOWN_STORAGE_KEY = 'falcon_notif_sent_cooldowns_v1';
const NATIVE_SCHEDULE_ID_MIN = 700000;
const NATIVE_SCHEDULE_ID_MAX = 799999;

export interface WorkshopAlertSummary {
  backups: {
    lastBackupIso: string | null;
    staleHours: number | null;
    isStale: boolean;
  };
  gatepasses: {
    pendingCount: number;
    orders: Array<{ id: string; factory: string; total: number }>;
  };
  cheques: {
    bouncedCount: number;
    overdueCount: number;
    dueWithin3DaysCount: number;
    urgentBatchCount: number;
    urgentList: ChequeRecord[];
  };
  stock: {
    lowCount: number;
    items: RawStockItem[];
  };
  inquiries: {
    openCount: number;
    urgentCount: number;
    items: Inquiry[];
  };
}

function getCooldownMap(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveCooldownMap(map: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    // Prune entries older than 7 days to keep storage tiny
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const pruned: Record<string, number> = {};
    for (const [k, ts] of Object.entries(map)) {
      if (typeof ts === 'number' && ts > cutoff) {
        pruned[k] = ts;
      }
    }
    localStorage.setItem(COOLDOWN_STORAGE_KEY, JSON.stringify(pruned));
  } catch {}
}

function shouldDispatchWithCooldown(dedupeKey: string, cooldownMs: number): boolean {
  const map = getCooldownMap();
  const last = map[dedupeKey] || 0;
  const now = Date.now();
  if (now - last < cooldownMs) {
    return false;
  }
  map[dedupeKey] = now;
  saveCooldownMap(map);
  return true;
}

function parseChequeDateLocal(raw?: string): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d, 9, 0, 0, 0);
  }
  const iso = dmyToISO(trimmed);
  if (iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d, 9, 0, 0, 0);
  }
  const parsed = parseDMY(trimmed);
  if (parsed) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 9, 0, 0, 0);
  }
  const dt = new Date(trimmed);
  if (isNaN(dt.getTime())) return null;
  dt.setHours(9, 0, 0, 0);
  return dt;
}

/**
 * Compute live workshop alert counts across every category
 */
export function computeWorkshopAlertSummary(state: AppState): WorkshopAlertSummary {
  const allCheques = extractAllCheques(state);
  const bounced = allCheques.filter((c) => c.status === 'bounced');
  const overdue = allCheques.filter((c) => c.status === 'overdue');
  const dueSoon = allCheques.filter(
    (c) =>
      (c.status === 'pending' || c.status === 'presented') &&
      c.daysRemaining >= 0 &&
      c.daysRemaining <= 3
  );
  const urgentBatchCount = allCheques.filter(
    (c) => c.isBatchDueSoon && (c.batchIds?.length || c.batchId)
  ).length;

  const pendingGatePasses = (state.transactions || []).filter(
    (t) => t.confirmed && !t.receiptUrl && !t.gatePass && !t.gatePassVerified
  );

  const lowStockItems = (state.rawStock || []).filter((r) => {
    if (!r.lowStockThreshold) return false;
    const avail = r.weight !== undefined ? r.weight : r.initialWeight || 0;
    return avail <= r.lowStockThreshold;
  });

  const openInquiries = (state.inquiries || []).filter((i) => !i.resolved);
  const urgentInquiries = openInquiries.filter(
    (i) => i.urgency === 'urgent' || i.urgency === 'high'
  );

  const lastBackupIso = getLastDriveBackupTime();
  let staleHours: number | null = null;
  if (lastBackupIso) {
    const t = new Date(lastBackupIso).getTime();
    if (!isNaN(t)) {
      staleHours = Math.round((Date.now() - t) / (1000 * 60 * 60));
    }
  }
  const intervalHours = getDriveAutoBackupIntervalHours() || 24;
  const isStale = staleHours === null || staleHours >= Math.max(24, intervalHours * 1.5);

  return {
    backups: {
      lastBackupIso,
      staleHours,
      isStale
    },
    gatepasses: {
      pendingCount: pendingGatePasses.length,
      orders: pendingGatePasses.slice(0, 5).map((t) => ({
        id: t.id,
        factory: t.factory || 'Customer',
        total: t.total || 0
      }))
    },
    cheques: {
      bouncedCount: bounced.length,
      overdueCount: overdue.length,
      dueWithin3DaysCount: dueSoon.length,
      urgentBatchCount,
      urgentList: [...bounced, ...overdue, ...dueSoon]
    },
    stock: {
      lowCount: lowStockItems.length,
      items: lowStockItems
    },
    inquiries: {
      openCount: openInquiries.length,
      urgentCount: urgentInquiries.length,
      items: urgentInquiries
    }
  };
}

// ============================================================================
// REAL-TIME CATEGORIZED EVENT NOTIFIERS
// ============================================================================

export async function notifyBackupEvent(params: {
  status: 'success' | 'error' | 'warning';
  title: string;
  body: string;
  tag?: string;
}): Promise<boolean> {
  return await sendNativeNotification(params.title, {
    body: params.body,
    category: 'backups',
    view: 'backup',
    tag: params.tag || `falcon-backup-${params.status}`,
    actionLabel: 'Open Backups',
    data: { backupStatus: params.status }
  });
}

export async function notifyGatePassEvent(params: {
  direction: 'outward' | 'inward' | 'required';
  orderOrSeq: string;
  partyName: string;
  detail?: string;
}): Promise<boolean> {
  const titleMap = {
    outward: `🛂 Dispatch Gate Pass #${params.orderOrSeq}`,
    inward: `📥 Inward Gate Pass #${params.orderOrSeq}`,
    required: `⏳ Gate Pass Required (#${params.orderOrSeq})`
  };
  const targetView = params.direction === 'required' ? 'notifications' : 'transactions';

  return await sendNativeNotification(titleMap[params.direction], {
    body: `${params.partyName}${params.detail ? ` — ${params.detail}` : ''}`,
    category: 'gatepasses',
    view: targetView,
    tag: `falcon-gatepass-${params.direction}-${params.orderOrSeq}`,
    actionLabel: params.direction === 'required' ? 'Attach Pass' : 'View Pass'
  });
}

export async function notifyChequeEvent(params: {
  chequeNo: string;
  status: ChequeStatus | 'endorsed';
  amount: number;
  payerParty: string;
  payeeParty?: string;
  bankName?: string;
  chequeDate?: string;
  batchId?: string;
}): Promise<boolean> {
  const amtStr = `Rs ${fmt(params.amount)}`;
  const batchSuffix = params.batchId ? ` · Batch ${params.batchId}` : '';

  let title = `💳 Cheque #${params.chequeNo} Updated`;
  let body = `${params.payerParty} • ${amtStr}${batchSuffix}`;

  if (params.status === 'bounced') {
    title = `🚨 BOUNCED Cheque #${params.chequeNo} (${amtStr})`;
    body = `${params.payerParty}${
      params.payeeParty && params.payeeParty !== 'Falcon Rod Maker' ? ` → ${params.payeeParty}` : ''
    } dishonoured! Ledgers auto-reversed${batchSuffix}.`;
  } else if (params.status === 'cleared') {
    title = `✅ Cheque #${params.chequeNo} Cleared (${amtStr})`;
    body = `${params.bankName || 'Bank'} settled cheque from ${params.payerParty}${batchSuffix}.`;
  } else if (params.status === 'presented') {
    title = `🏦 Cheque #${params.chequeNo} Presented (${amtStr})`;
    body = `Deposited for clearing (${params.payerParty})${batchSuffix}.`;
  } else if (params.status === 'overdue') {
    title = `⚠️ OVERDUE Cheque #${params.chequeNo} (${amtStr})`;
    body = `Due ${params.chequeDate || 'today'} from ${params.payerParty}${batchSuffix}.`;
  } else if (params.status === 'endorsed') {
    title = `🔁 Endorsed Cheque #${params.chequeNo} (${amtStr})`;
    body = `${params.payerParty} → ${params.payeeParty || 'Supplier'} • Due ${params.chequeDate || ''}${batchSuffix}`;
  }

  return await sendNativeNotification(title, {
    body,
    category: 'cheques',
    view: 'cheques',
    tag: `falcon-cheque-${params.chequeNo}-${params.status}`,
    actionLabel: 'Open Cheques'
  });
}

export async function notifyOrderEvent(params: {
  type: 'created' | 'confirmed' | 'payment';
  orderId: string;
  customerName: string;
  amount: number;
  summary?: string;
}): Promise<boolean> {
  const title =
    params.type === 'payment'
      ? `💰 Payment Received (#${params.orderId})`
      : params.type === 'confirmed'
      ? `✓ Order #${params.orderId} Confirmed`
      : `🛒 Order #${params.orderId} Created`;

  return await sendNativeNotification(title, {
    body: `${params.customerName}: Rs ${fmt(params.amount)}${params.summary ? ` (${params.summary})` : ''}`,
    category: 'orders',
    view: 'transactions',
    tag: `falcon-order-${params.type}-${params.orderId}`,
    actionLabel: 'View Orders'
  });
}

export async function notifyInquiryEvent(inquiry: Omit<Inquiry, 'id' | 'resolved'>): Promise<boolean> {
  const prefix =
    inquiry.urgency === 'urgent' ? '🚨 URGENT Inquiry' : inquiry.urgency === 'high' ? '🔔 Priority Inquiry' : '📝 Customer Inquiry';
  return await sendNativeNotification(`${prefix}: ${inquiry.party}`, {
    body: `${inquiry.detail}${inquiry.phone && inquiry.phone !== '—' ? ` (${inquiry.phone})` : ''}`,
    category: 'inquiries',
    view: 'notifications',
    tag: `falcon-inquiry-${inquiry.party}-${Date.now()}`,
    actionLabel: 'Open Hub'
  });
}

// ============================================================================
// SCHEDULED & OFF-SCREEN / LOCKSCREEN MONITOR
// ============================================================================

/**
 * Push alert snapshot to Service Worker Cache so Web/PWA background sync / periodicsync
 * can fire lockscreen alerts even when tabs are sleeping or phone screen is off.
 */
export async function syncAlertsSnapshotToServiceWorker(state: AppState): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const prefs = getNotificationCategoryPrefs();
    const summary = computeWorkshopAlertSummary(state);
    const alerts: Array<Record<string, any>> = [];
    const now = Date.now();

    if (prefs.cheques && summary.cheques.urgentList.length > 0) {
      for (const chq of summary.cheques.urgentList.slice(0, 6)) {
        const dueDate = parseChequeDateLocal(chq.chequeDate);
        const dueAt =
          chq.status === 'bounced' || chq.status === 'overdue' || chq.daysRemaining <= 0
            ? now
            : dueDate
            ? dueDate.getTime()
            : now;

        alerts.push({
          title:
            chq.status === 'bounced'
              ? `🚨 BOUNCED Chq #${chq.chequeNo} (Rs ${fmt(chq.amount)})`
              : chq.status === 'overdue'
              ? `⚠️ OVERDUE Chq #${chq.chequeNo} (${Math.abs(chq.daysRemaining)}d overdue)`
              : chq.daysRemaining === 0
              ? `📅 Cheque #${chq.chequeNo} DUE TODAY (Rs ${fmt(chq.amount)})`
              : `⏱️ Cheque #${chq.chequeNo} due in ${chq.daysRemaining}d (Rs ${fmt(chq.amount)})`,
          body: `${chq.payerParty}${chq.payeeParty ? ` → ${chq.payeeParty}` : ''}${
            chq.batchId ? ` · Batch ${chq.batchId}` : ''
          }`,
          category: 'cheques',
          view: 'cheques',
          tag: `falcon-sw-cheque-${chq.chequeNo}`,
          dueAt
        });
      }
    }

    if (prefs.gatepasses && summary.gatepasses.pendingCount > 0) {
      alerts.push({
        title: `🛂 ${summary.gatepasses.pendingCount} Order${summary.gatepasses.pendingCount > 1 ? 's' : ''} Awaiting Gate Pass`,
        body: summary.gatepasses.orders
          .map((o) => `#${o.id} (${o.factory})`)
          .join(', '),
        category: 'gatepasses',
        view: 'notifications',
        tag: 'falcon-sw-gatepass-pending',
        dueAt: now
      });
    }

    if (prefs.stock && summary.stock.lowCount > 0) {
      alerts.push({
        title: `📦 ${summary.stock.lowCount} Low Stock Material Alert${summary.stock.lowCount > 1 ? 's' : ''}`,
        body: summary.stock.items
          .slice(0, 3)
          .map((s) => s.name)
          .join(', '),
        category: 'stock',
        view: 'raw_material',
        tag: 'falcon-sw-low-stock',
        dueAt: now
      });
    }

    if (prefs.backups && summary.backups.isStale) {
      alerts.push({
        title: '☁️ Workshop Backup Reminder',
        body:
          summary.backups.staleHours === null
            ? 'No recent Google Drive cloud backup detected. Open Backup & Sync to secure workshop records.'
            : `Last Google Drive backup was ${summary.backups.staleHours}h ago. Tap to run backup now.`,
        category: 'backups',
        view: 'backup',
        tag: 'falcon-sw-backup-stale',
        dueAt: now
      });
    }

    const reg =
      (await navigator.serviceWorker.getRegistration()) || (await registerPosServiceWorker());
    reg?.active?.postMessage({
      type: 'STORE_ALERTS_SNAPSHOT',
      alerts
    });
  } catch (e) {
    console.debug('[WorkshopNotifications] SW snapshot warning:', e);
  }
}

/**
 * On Capacitor Native Android APK: schedule future AlarmManager notifications
 * for upcoming cheque maturities (within next 7 days at 9:00 AM) and next Drive backup
 * so they light up the lockscreen even if the app is completely killed and screen is off.
 */
export async function scheduleNativeLockscreenReminders(state: AppState): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const check = await LocalNotifications.checkPermissions();
    if (check.display !== 'granted') return;

    await setupAndroidLockscreenChannels();
    const prefs = getNotificationCategoryPrefs();

    // Clear previously scheduled workshop reminders in our reserved ID range
    const pending = await LocalNotifications.getPending();
    const toCancel = (pending.notifications || []).filter(
      (n) => n.id >= NATIVE_SCHEDULE_ID_MIN && n.id <= NATIVE_SCHEDULE_ID_MAX
    );
    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel.map((n) => ({ id: n.id })) });
    }

    const toSchedule: any[] = [];
    let nextId = NATIVE_SCHEDULE_ID_MIN + 1;
    const now = Date.now();

    // 1. Schedule upcoming cheques (0–7 days away) at 09:00 AM on maturity date + 1 day prior warning
    if (prefs.cheques) {
      const cheques = extractAllCheques(state).filter(
        (c) => (c.status === 'pending' || c.status === 'presented') && c.daysRemaining >= 0 && c.daysRemaining <= 7
      );

      for (const chq of cheques.slice(0, 15)) {
        const dueMorning = parseChequeDateLocal(chq.chequeDate);
        if (dueMorning && dueMorning.getTime() > now + 60000) {
          toSchedule.push({
            id: nextId++,
            title: `💳 Cheque #${chq.chequeNo} Matured Today (Rs ${fmt(chq.amount)})`,
            body: `${chq.payerParty}${chq.payeeParty ? ` → ${chq.payeeParty}` : ''}${
              chq.batchId ? ` · Batch ${chq.batchId}` : ''
            }`,
            channelId: 'falcon_pos_cheques',
            schedule: { at: dueMorning, allowWhileIdle: true },
            smallIcon: 'ic_launcher_round',
            iconColor: '#EF4444',
            extra: { category: 'cheques', view: 'cheques', chequeNo: chq.chequeNo }
          });
        }

        // Advance 24h prior heads-up (at 10:00 AM the day before due date)
        if (dueMorning && chq.daysRemaining >= 1 && chq.daysRemaining <= 3) {
          const dayBefore = new Date(dueMorning.getTime() - 23 * 60 * 60 * 1000);
          if (dayBefore.getTime() > now + 60000) {
            toSchedule.push({
              id: nextId++,
              title: `⏱️ Cheque #${chq.chequeNo} Due Tomorrow (Rs ${fmt(chq.amount)})`,
              body: `Batch/Payment prep for ${chq.payerParty}${chq.batchId ? ` · [${chq.batchId}]` : ''}.`,
              channelId: 'falcon_pos_cheques',
              schedule: { at: dayBefore, allowWhileIdle: true },
              smallIcon: 'ic_launcher_round',
              iconColor: '#F59E0B',
              extra: { category: 'cheques', view: 'cheques', chequeNo: chq.chequeNo }
            });
          }
        }
      }
    }

    // 2. Schedule next Drive backup check reminder
    if (prefs.backups && getDriveAutoBackupEnabled()) {
      const last = getLastDriveBackupTime();
      const hours = getDriveAutoBackupIntervalHours();
      const nextDate = getNextDriveBackupDate(last, hours);
      if (nextDate.getTime() > now + 120000) {
        toSchedule.push({
          id: nextId++,
          title: '☁️ Falcon Scheduled Drive Backup Due',
          body: 'Open Falcon POS briefly or tap to sync & upload your scheduled Google Drive snapshot.',
          channelId: 'falcon_pos_backups',
          schedule: { at: nextDate, allowWhileIdle: true },
          smallIcon: 'ic_launcher_round',
          iconColor: '#38BDF8',
          extra: { category: 'backups', view: 'backup' }
        });
      }
    }

    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  } catch (err) {
    console.warn('[WorkshopNotifications] Native schedule warning:', err);
  }
}

/**
 * Evaluate live workshop state and fire lockscreen notifications across all pending categories
 * respecting deduplication cooldowns (or forcing on screen-off / manual trigger).
 */
export async function evaluateAndDispatchWorkshopNotifications(
  state: AppState,
  options?: {
    triggerReason?: 'startup' | 'state_change' | 'interval' | 'going_hidden' | 'manual';
  }
): Promise<number> {
  const reason = options?.triggerReason || 'interval';
  const prefs = getNotificationCategoryPrefs();
  const summary = computeWorkshopAlertSummary(state);

  // Always refresh SW alert snapshot cache and native upcoming schedules
  syncAlertsSnapshotToServiceWorker(state).catch(() => {});
  scheduleNativeLockscreenReminders(state).catch(() => {});

  if (reason === 'going_hidden' && !prefs.offScreenDigest) {
    return 0;
  }

  let dispatchedCount = 0;
  const standardCooldownMs = reason === 'manual' ? 0 : 6 * 60 * 60 * 1000; // 6 hours per active condition
  const hiddenDigestCooldownMs = 30 * 60 * 1000; // 30 mins when locking screen / minimizing

  // 1. Cheques & Banking (Bounced / Overdue / Due within 3 days)
  if (prefs.cheques) {
    if (summary.cheques.bouncedCount > 0) {
      const key = `cheque_bounced_${summary.cheques.bouncedCount}`;
      if (shouldDispatchWithCooldown(key, reason === 'going_hidden' ? hiddenDigestCooldownMs : standardCooldownMs)) {
        const first = summary.cheques.urgentList.find((c) => c.status === 'bounced');
        const ok = await sendNativeNotification(
          `🚨 ${summary.cheques.bouncedCount} Bounced Cheque Alert${summary.cheques.bouncedCount > 1 ? 's' : ''}`,
          {
            body: first
              ? `Chq #${first.chequeNo} (${first.payerParty} · Rs ${fmt(first.amount)}) dishonoured. Ledger reversal active.`
              : 'Action required on bounced cheques.',
            category: 'cheques',
            view: 'cheques',
            tag: 'falcon-digest-cheques-bounced',
            actionLabel: 'Inspect Cheques'
          }
        );
        if (ok) dispatchedCount++;
      }
    }

    if (summary.cheques.overdueCount > 0 || summary.cheques.dueWithin3DaysCount > 0) {
      const totalDue = summary.cheques.overdueCount + summary.cheques.dueWithin3DaysCount;
      const key = `cheque_due_${summary.cheques.overdueCount}_${summary.cheques.dueWithin3DaysCount}`;
      if (shouldDispatchWithCooldown(key, reason === 'going_hidden' ? hiddenDigestCooldownMs : standardCooldownMs)) {
        const parts: string[] = [];
        if (summary.cheques.overdueCount > 0) parts.push(`${summary.cheques.overdueCount} Overdue`);
        if (summary.cheques.dueWithin3DaysCount > 0)
          parts.push(`${summary.cheques.dueWithin3DaysCount} Due ≤3 Days`);
        if (summary.cheques.urgentBatchCount > 0)
          parts.push(`${summary.cheques.urgentBatchCount} Linked Batch Watch`);

        const ok = await sendNativeNotification(`💳 Cheque Maturity Watch: ${parts.join(' · ')}`, {
          body: `${totalDue} cheque${totalDue > 1 ? 's' : ''} require clearance tracking or deposit. Tap to view schedule.`,
          category: 'cheques',
          view: 'cheques',
          tag: 'falcon-digest-cheques-due',
          actionLabel: 'Open Cheques'
        });
        if (ok) dispatchedCount++;
      }
    }
  }

  // 2. Gate Passes (Confirmed orders missing delivery/gate pass)
  if (prefs.gatepasses && summary.gatepasses.pendingCount > 0) {
    const key = `gatepass_pending_${summary.gatepasses.pendingCount}`;
    if (shouldDispatchWithCooldown(key, reason === 'going_hidden' ? hiddenDigestCooldownMs : standardCooldownMs)) {
      const sampleOrders = summary.gatepasses.orders
        .slice(0, 2)
        .map((o) => `#${o.id} (${o.factory})`)
        .join(', ');
      const ok = await sendNativeNotification(
        `🛂 ${summary.gatepasses.pendingCount} Confirmed Order${summary.gatepasses.pendingCount > 1 ? 's' : ''} Need Gate Pass`,
        {
          body: `Awaiting dispatch slip / bilty: ${sampleOrders}`,
          category: 'gatepasses',
          view: 'notifications',
          tag: 'falcon-digest-gatepasses',
          actionLabel: 'Attach Pass'
        }
      );
      if (ok) dispatchedCount++;
    }
  }

  // 3. Backups (Overdue cloud backup reminder)
  if (prefs.backups && summary.backups.isStale) {
    const bucket = summary.backups.staleHours === null ? 'none' : Math.floor(summary.backups.staleHours / 12);
    const key = `backup_stale_${bucket}`;
    if (shouldDispatchWithCooldown(key, standardCooldownMs)) {
      const ok = await sendNativeNotification('☁️ Cloud Backup Reminder', {
        body:
          summary.backups.staleHours === null
            ? 'Run a Google Drive / JSON backup to keep all workshop ledgers protected.'
            : `Last Google Drive backup was ${summary.backups.staleHours}h ago. Tap to create backup now.`,
        category: 'backups',
        view: 'backup',
        tag: 'falcon-digest-backup',
        actionLabel: 'Backup Now'
      });
      if (ok) dispatchedCount++;
    }
  }

  // 4. Raw Material Low Stock
  if (prefs.stock && summary.stock.lowCount > 0) {
    const key = `stock_low_${summary.stock.lowCount}`;
    if (shouldDispatchWithCooldown(key, reason === 'going_hidden' ? hiddenDigestCooldownMs : standardCooldownMs)) {
      const names = summary.stock.items
        .slice(0, 3)
        .map((i) => i.name)
        .join(', ');
      const ok = await sendNativeNotification(
        `📦 Low Raw Stock Alert (${summary.stock.lowCount} Item${summary.stock.lowCount > 1 ? 's' : ''})`,
        {
          body: `Below reorder threshold: ${names}`,
          category: 'stock',
          view: 'raw_material',
          tag: 'falcon-digest-stock',
          actionLabel: 'Order Stock'
        }
      );
      if (ok) dispatchedCount++;
    }
  }

  // 5. Urgent Open Inquiries
  if (prefs.inquiries && summary.inquiries.urgentCount > 0) {
    const key = `inquiries_urgent_${summary.inquiries.urgentCount}`;
    if (shouldDispatchWithCooldown(key, reason === 'going_hidden' ? hiddenDigestCooldownMs : standardCooldownMs)) {
      const top = summary.inquiries.items[0];
      const ok = await sendNativeNotification(
        `🔔 ${summary.inquiries.urgentCount} Priority Customer Inquir${summary.inquiries.urgentCount > 1 ? 'ies' : 'y'}`,
        {
          body: top ? `${top.party}: ${top.detail}` : 'Open Notifications Hub to respond.',
          category: 'inquiries',
          view: 'notifications',
          tag: 'falcon-digest-inquiries',
          actionLabel: 'Open Alerts'
        }
      );
      if (ok) dispatchedCount++;
    }
  }

  return dispatchedCount;
}

export interface ReconnectSyncBreakdown {
  totalCachedNotifications: number;
  gatepassesCount: number;
  backupsCount: number;
  chequesCount: number;
  otherCount: number;
  syncedAt: string;
  cachedItems: CachedOfflineNotification[];
}

/**
 * Reconciles cached offline notifications & updates Service Worker + Capacitor schedules once reconnected.
 */
export async function syncCachedOfflineNotificationsToCloud(
  state: AppState
): Promise<ReconnectSyncBreakdown> {
  const cachedItems = getCachedOfflineNotifications();
  const summary = computeWorkshopAlertSummary(state);

  await syncAlertsSnapshotToServiceWorker(state);
  await scheduleNativeLockscreenReminders(state);

  const cleared = clearCachedOfflineNotifications();
  const gatepassesCount =
    cleared.filter((i) => i.category === 'gatepasses').length || summary.gatepasses.pendingCount;
  const backupsCount = cleared.filter((i) => i.category === 'backups').length;
  const chequesCount =
    cleared.filter((i) => i.category === 'cheques').length ||
    summary.cheques.bouncedCount +
      summary.cheques.overdueCount +
      summary.cheques.dueWithin3DaysCount;
  const otherCount = cleared.filter(
    (i) => i.category !== 'gatepasses' && i.category !== 'backups' && i.category !== 'cheques'
  ).length;

  return {
    totalCachedNotifications: cleared.length,
    gatepassesCount,
    backupsCount,
    chequesCount,
    otherCount,
    syncedAt: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    cachedItems
  };
}

/**
 * Diagnostic helper: schedules a delayed multi-category lockscreen burst (Backups, Gate Passes, Cheques, Stock)
 * so the user can tap once, lock their mobile screen, and verify every category lights up on lockscreen.
 */
export async function triggerAllCategoryLockscreenTest(delaySeconds: number = 3): Promise<boolean> {
  const categories: NotificationCategory[] = ['backups', 'gatepasses', 'cheques', 'stock', 'orders', 'inquiries'];
  const results = await Promise.all(
    categories.map((cat, idx) =>
      scheduleLockscreenTestNotification(delaySeconds + idx * 0.4, cat)
    )
  );
  return results.some(Boolean);
}

/**
 * Helper to silence unused-import warnings while exposing category type
 */
export type { NotificationCategory, Transaction };
