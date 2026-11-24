import { BatchDueAlertStatus, ChequeRecord } from '../types';

/**
 * Falcon Rod Maker POS - Batch ID & Tracking Number Generator
 *
 * Provides deterministic and segmented batch IDs and tracking numbers
 * for transaction orders and their individual line items.
 * Ensures that multi-item orders are clearly segmented by batch in the
 * transaction metadata, and monitors due-date proximity windows (within 3 days).
 */

export const DEFAULT_BATCH_DUE_WARNING_DAYS = 3;

export interface BatchItemInput {
  name?: string;
  size?: string;
  color?: string;
  qty?: number;
  price?: number;
  batchId?: string;
  trackingNumber?: string;
}

export interface BatchTrackingMetadata {
  /** Master Order Batch ID (e.g. "BATCH-20261007-0005") */
  batchId: string;
  /** Master Order Tracking Number (e.g. "TRK-20261007-0005") */
  trackingNumber: string;
  /** Comma-separated list of batch IDs for all items (e.g. "BATCH-0005-01, BATCH-0005-02") */
  itemBatches: string;
  /** Comma-separated list of tracking numbers for all items (e.g. "TRK-0005-01, TRK-0005-02") */
  itemTrackingNumbers: string;
  /** Individual batch IDs array for 1:1 positional indexing */
  batchesList: string[];
  /** Individual tracking numbers array for 1:1 positional indexing */
  trackingList: string[];
}

export interface TrackedChequeBatchSummary {
  batchId: string;
  chequeCount: number;
  activeCount: number;
  dueSoonCount: number;
  overdueCount: number;
  totalAmount: number;
  earliestDueDate: string;
  minDaysUntilDue: number | null;
  isWithin3DaysOfDueDate: boolean;
  isDueToday: boolean;
  hasOverdue: boolean;
  parties: string[];
  chequeNos: string[];
  alertLabel: string;
}

/**
 * Generates an isolated line-item batch identifier.
 * Format: BATCH-{orderId}-{lineIndex} (e.g., "BATCH-0005-01")
 */
export function generateLineBatchId(orderId: string, lineIndex: number): string {
  const cleanId = String(orderId || '0001').padStart(4, '0');
  const cleanIndex = String(lineIndex + 1).padStart(2, '0');
  return `BATCH-${cleanId}-${cleanIndex}`;
}

/**
 * Generates an isolated line-item tracking number.
 * Format: TRK-{orderId}-{lineIndex} (e.g., "TRK-0005-01")
 */
export function generateLineTrackingNumber(orderId: string, lineIndex: number): string {
  const cleanId = String(orderId || '0001').padStart(4, '0');
  const cleanIndex = String(lineIndex + 1).padStart(2, '0');
  return `TRK-${cleanId}-${cleanIndex}`;
}

/**
 * Generates batch and tracking metadata for a complete transaction and its item list.
 * Multi-item orders are clearly segmented by batch in both array and delimited string formats.
 */
export function generateBatchTrackingMetadata(
  orderId: string,
  items: BatchItemInput[] = [],
  orderDate?: string
): BatchTrackingMetadata {
  const dateCompact = (orderDate || new Date().toISOString().slice(0, 10)).replace(/[^0-9]/g, '');
  const cleanId = String(orderId || '0001').padStart(4, '0');

  // Master Transaction Batch ID & Tracking Number
  const masterBatchId = `BATCH-${dateCompact}-${cleanId}`;
  const masterTrackingNumber = `TRK-${dateCompact}-${cleanId}`;

  // If no items provided, generate defaults
  if (!items || items.length === 0) {
    const singleBatch = generateLineBatchId(cleanId, 0);
    const singleTrack = generateLineTrackingNumber(cleanId, 0);
    return {
      batchId: masterBatchId,
      trackingNumber: masterTrackingNumber,
      itemBatches: singleBatch,
      itemTrackingNumbers: singleTrack,
      batchesList: [singleBatch],
      trackingList: [singleTrack]
    };
  }

  // Segment each item by batch in the items list
  const batchesList = items.map((item, index) => {
    if (item.batchId && typeof item.batchId === 'string' && item.batchId.trim()) {
      return item.batchId.trim();
    }
    return generateLineBatchId(cleanId, index);
  });

  const trackingList = items.map((item, index) => {
    if (item.trackingNumber && typeof item.trackingNumber === 'string' && item.trackingNumber.trim()) {
      return item.trackingNumber.trim();
    }
    return generateLineTrackingNumber(cleanId, index);
  });

  return {
    batchId: masterBatchId,
    trackingNumber: masterTrackingNumber,
    itemBatches: batchesList.join(', '),
    itemTrackingNumbers: trackingList.join(', '),
    batchesList,
    trackingList
  };
}

/**
 * Parses YYYY-MM-DD, DD/MM/YYYY, or ISO strings into local calendar midnight Date.
 */
export function parseBatchTrackingDateLocal(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  if (!clean) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(clean);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const dt = new Date(y, m, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const dmyMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(clean);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    const dt = new Date(y, m, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const fallback = new Date(clean);
  if (isNaN(fallback.getTime())) return null;
  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
}

/**
 * Evaluates whether a batch/cheque due date is within the warning window (default: 3 days).
 * Settled/terminal statuses ('cleared', 'bounced', 'returned') never trigger a due-soon warning.
 */
export function evaluateBatchDueWindow(
  dueDateStr?: string,
  status?: string,
  warningWindowDays: number = DEFAULT_BATCH_DUE_WARNING_DAYS,
  referenceDate: Date = new Date()
): BatchDueAlertStatus {
  const normalizedStatus = (status || 'pending').toLowerCase();
  if (
    normalizedStatus === 'cleared' ||
    normalizedStatus === 'bounced' ||
    normalizedStatus === 'returned'
  ) {
    return {
      isWithinWarningWindow: false,
      isDueToday: false,
      isOverdue: false,
      daysUntilDue: null,
      urgencyLevel: 'none',
      label: ''
    };
  }

  const targetLocal = parseBatchTrackingDateLocal(dueDateStr);
  if (!targetLocal) {
    return {
      isWithinWarningWindow: false,
      isDueToday: false,
      isOverdue: false,
      daysUntilDue: null,
      urgencyLevel: 'none',
      label: ''
    };
  }

  const todayLocal = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const diffDays = Math.round(
    (targetLocal.getTime() - todayLocal.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return {
      isWithinWarningWindow: false,
      isDueToday: false,
      isOverdue: true,
      daysUntilDue: diffDays,
      urgencyLevel: 'overdue',
      label: `Overdue ${Math.abs(diffDays)}d`
    };
  }

  if (diffDays === 0) {
    return {
      isWithinWarningWindow: true,
      isDueToday: true,
      isOverdue: false,
      daysUntilDue: 0,
      urgencyLevel: 'due_today',
      label: 'Due Today'
    };
  }

  if (diffDays <= warningWindowDays) {
    return {
      isWithinWarningWindow: true,
      isDueToday: false,
      isOverdue: false,
      daysUntilDue: diffDays,
      urgencyLevel: 'within_3_days',
      label: diffDays === 1 ? 'Due Tomorrow' : `Due in ${diffDays}d`
    };
  }

  return {
    isWithinWarningWindow: false,
    isDueToday: false,
    isOverdue: false,
    daysUntilDue: diffDays,
    urgencyLevel: 'none',
    label: `Due in ${diffDays}d`
  };
}

/**
 * Extracts explicit production/order batch tokens (e.g. BATCH-202609-LOT02, BAT-...) from free text.
 */
export function extractBatchIdsFromText(text?: string): string[] {
  if (!text) return [];
  const matches = text.match(/\b(?:BATCH|BAT)-[A-Za-z0-9-]+\b/gi) || [];
  const seen = new Set<string>();
  const result: string[] = [];
  matches.forEach(m => {
    const clean = m.trim().toUpperCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  });
  return result;
}

/**
 * Extracts order IDs referenced in text (e.g. "Order #0002").
 */
export function extractOrderIdsFromText(text?: string): string[] {
  if (!text) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  const regex = /\bOrder\s*#?([A-Za-z0-9-]+)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const clean = match[1].trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }
  return result;
}

/**
 * Aggregates cheque records by batch ID and highlights batches within 3 days of due date.
 */
export function summarizeTrackedChequeBatches(
  cheques: ChequeRecord[],
  warningWindowDays: number = DEFAULT_BATCH_DUE_WARNING_DAYS
): TrackedChequeBatchSummary[] {
  const map = new Map<
    string,
    {
      batchId: string;
      cheques: ChequeRecord[];
      parties: Set<string>;
      chequeNos: Set<string>;
    }
  >();

  cheques.forEach(chq => {
    const ids =
      chq.batchIds && chq.batchIds.length > 0
        ? chq.batchIds
        : chq.batchId
        ? [chq.batchId]
        : [];
    if (ids.length === 0) return;

    ids.forEach(bId => {
      const cleanId = bId.trim();
      if (!cleanId) return;
      let group = map.get(cleanId);
      if (!group) {
        group = {
          batchId: cleanId,
          cheques: [],
          parties: new Set<string>(),
          chequeNos: new Set<string>()
        };
        map.set(cleanId, group);
      }
      group.cheques.push(chq);
      if (chq.customerLedgerName || chq.payerParty) {
        group.parties.add(chq.customerLedgerName || chq.payerParty);
      }
      group.chequeNos.add(chq.chequeNo);
    });
  });

  const summaries: TrackedChequeBatchSummary[] = [];

  map.forEach(group => {
    let totalAmount = 0;
    let activeCount = 0;
    let dueSoonCount = 0;
    let overdueCount = 0;
    let earliestDueDate = '';
    let earliestMs = Number.POSITIVE_INFINITY;
    let minDaysUntilDue: number | null = null;
    let isDueToday = false;

    group.cheques.forEach(c => {
      totalAmount += c.amount;
      const alert = c.batchDueAlert || evaluateBatchDueWindow(c.chequeDate, c.status, warningWindowDays);
      const isTerminal = c.status === 'cleared' || c.status === 'bounced' || c.status === 'returned';
      if (!isTerminal) {
        activeCount++;
        if (alert.isWithinWarningWindow) {
          dueSoonCount++;
        }
        if (alert.isDueToday) {
          isDueToday = true;
        }
        if (alert.isOverdue || c.status === 'overdue') {
          overdueCount++;
        }
        const dt = parseBatchTrackingDateLocal(c.chequeDate);
        if (dt) {
          const ms = dt.getTime();
          if (ms < earliestMs) {
            earliestMs = ms;
            earliestDueDate = c.chequeDate;
          }
        } else if (!earliestDueDate) {
          earliestDueDate = c.chequeDate;
        }
        if (alert.daysUntilDue !== null) {
          if (minDaysUntilDue === null || alert.daysUntilDue < minDaysUntilDue) {
            minDaysUntilDue = alert.daysUntilDue;
          }
        }
      }
    });

    if (!earliestDueDate && group.cheques[0]) {
      earliestDueDate = group.cheques[0].chequeDate;
    }

    const isWithin3DaysOfDueDate = dueSoonCount > 0;
    const alertLabel = isDueToday
      ? 'Due Today'
      : isWithin3DaysOfDueDate && minDaysUntilDue !== null
      ? minDaysUntilDue === 1
        ? 'Due Tomorrow'
        : `Due in ${minDaysUntilDue}d`
      : overdueCount > 0
      ? `Overdue`
      : activeCount > 0 && minDaysUntilDue !== null
      ? `Due in ${minDaysUntilDue}d`
      : 'Settled';

    summaries.push({
      batchId: group.batchId,
      chequeCount: group.cheques.length,
      activeCount,
      dueSoonCount,
      overdueCount,
      totalAmount,
      earliestDueDate,
      minDaysUntilDue,
      isWithin3DaysOfDueDate,
      isDueToday,
      hasOverdue: overdueCount > 0,
      parties: Array.from(group.parties),
      chequeNos: Array.from(group.chequeNos),
      alertLabel
    });
  });

  return summaries.sort((a, b) => {
    if (a.isWithin3DaysOfDueDate !== b.isWithin3DaysOfDueDate) {
      return a.isWithin3DaysOfDueDate ? -1 : 1;
    }
    if (a.hasOverdue !== b.hasOverdue) {
      return a.hasOverdue ? -1 : 1;
    }
    const dA = a.minDaysUntilDue ?? Number.MAX_SAFE_INTEGER;
    const dB = b.minDaysUntilDue ?? Number.MAX_SAFE_INTEGER;
    if (dA !== dB) return dA - dB;
    return a.batchId.localeCompare(b.batchId);
  });
}

