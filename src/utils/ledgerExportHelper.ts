import { LedgerColumnConfig } from '../types';
import { fmt } from './helpers';

export interface StandardLedgerRowItem {
  id?: string;
  date: string;
  time?: string;
  desc: string;
  debit: number;
  credit: number;
  runningBalance?: number;
  method?: string;
  paidBy?: string;
  paidTo?: string;
  accountNumber?: string;
  bankName?: string;
  chequeNo?: string;
  taxAmt?: number;
  detail?: string;
  size?: string;
  qty?: number;
  rate?: number;
  color?: string;
  stockName?: string;
  itemName?: string;
  weight?: number | string;
  weightIn?: number | string;
  itemsIn?: number;
  workType?: string;
  category?: string;
  withdrawnBy?: string;
  status?: string;
  itemComponents?: string;
  dutyShift?: string;
  shifts?: number;
  dailyWageRate?: number;
}

export function buildLedgerExportTableData(
  entries: StandardLedgerRowItem[],
  config: LedgerColumnConfig
): { headers: string[]; rows: (string | number)[][] } {
  const headers: string[] = [];

  if (config.showDate) headers.push('Date');
  if (config.showTime) headers.push('Time');
  if (config.showDesc) headers.push('Description');
  if (config.showDebit) headers.push('Debit (Due / Billed)');
  if (config.showCredit) headers.push('Credit (Paid / Wages)');
  if (config.showBalance) headers.push('Running Balance');
  if (config.showMethod) headers.push('Payment Method');
  if (config.showPaidBy) headers.push('Paid By (Sender)');
  if (config.showPaidTo) headers.push('Paid To (Receiver)');
  if (config.showAccount) headers.push('Bank & Account #');
  if (config.showRef) headers.push('Cheque # / Ref');
  if (config.showTax) headers.push('Tax / Deductions');

  // Ensure at least core columns if all unchecked
  if (headers.length === 0) {
    headers.push('Date', 'Description', 'Debit', 'Credit', 'Balance');
  }

  const rows = (entries || []).map(e => {
    const row: (string | number)[] = [];

    if (config.showDate) row.push(e.date || '—');
    if (config.showTime) row.push(e.time || '—');
    if (config.showDesc) {
      let descStr = e.desc || '—';
      const metaParts: (string | null | undefined)[] = [];
      if (e.stockName || e.itemName) metaParts.push(e.stockName || e.itemName);
      if (e.itemComponents) metaParts.push(e.itemComponents);
      if (e.category) metaParts.push(e.category);
      if (e.workType) metaParts.push(e.workType);
      if (e.dutyShift) metaParts.push(e.dutyShift === 'full' ? 'Full Day' : e.dutyShift === 'half' ? 'Half Day' : e.dutyShift);
      if (e.status) metaParts.push(e.status);
      if (e.size) metaParts.push(e.size);
      if (e.qty) metaParts.push(`${e.qty} pcs`);
      if (e.weight || e.weightIn) metaParts.push(`${e.weight || e.weightIn} kg`);
      if (e.rate) metaParts.push(`@ Rs ${fmt(e.rate)}`);
      if (e.color) metaParts.push(e.color);

      const filteredMeta = metaParts.filter(Boolean);
      if (filteredMeta.length > 0) {
        descStr += ` (${filteredMeta.join(' · ')})`;
      }
      row.push(descStr);
    }
    if (config.showDebit) row.push(e.debit ? fmt(e.debit) : '—');
    if (config.showCredit) row.push(e.credit ? fmt(e.credit) : '—');
    if (config.showBalance) {
      const bal = e.runningBalance ?? (e.debit - e.credit);
      const sign = bal > 0 ? 'Dr' : bal < 0 ? 'Cr' : '';
      row.push(`${fmt(Math.abs(bal))} ${sign}`.trim());
    }
    if (config.showMethod) {
      row.push(e.method || (e.credit > 0 ? 'Cash' : e.debit > 0 ? 'Cash' : '—'));
    }
    if (config.showPaidBy) row.push(e.paidBy || e.withdrawnBy || '—');
    if (config.showPaidTo) row.push(e.paidTo || '—');
    if (config.showAccount) {
      const acParts = [e.bankName, e.accountNumber].filter(Boolean).join(' - ');
      row.push(acParts || '—');
    }
    if (config.showRef) {
      row.push(e.chequeNo || e.detail || '—');
    }
    if (config.showTax) {
      row.push(e.taxAmt ? fmt(e.taxAmt) : '—');
    }

    if (row.length === 0) {
      row.push(e.date || '—', e.desc || '—', fmt(e.debit), fmt(e.credit), fmt((e.debit || 0) - (e.credit || 0)));
    }

    return row;
  });

  return { headers, rows };
}

const STORAGE_PREFIX = 'falcon_ledger_cols_';

export function getStoredLedgerColumnConfig(ledgerType: string, defaultCfg?: LedgerColumnConfig): LedgerColumnConfig {
  const fallback = defaultCfg || {
    showDate: true,
    showTime: false,
    showDesc: true,
    showDebit: true,
    showCredit: true,
    showBalance: true,
    showMethod: true,
    showPaidBy: true,
    showPaidTo: true,
    showAccount: true,
    showRef: true,
    showTax: false
  };

  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${ledgerType}`);
    if (raw) {
      return { ...fallback, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('Failed to parse stored ledger column config', err);
  }
  return fallback;
}

export function saveStoredLedgerColumnConfig(ledgerType: string, config: LedgerColumnConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${ledgerType}`, JSON.stringify(config));
  } catch (err) {
    console.warn('Failed to save ledger column config', err);
  }
}
