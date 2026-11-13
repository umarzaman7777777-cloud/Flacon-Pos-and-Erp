import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Phone,
  MessageCircle,
  ExternalLink,
  ArrowRight,
  ShieldAlert,
  Copy,
  Check,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  History,
  Search,
  Download,
  Layers
} from 'lucide-react';
import { AppState, AppLanguage, ChequeRecord, ChequeStatus, ChequeStatusLogEntry } from '../types';
import { fmt, todayISO, dmyToISO, parseDMY } from '../utils/helpers';
import {
  extractAllCheques,
  updateChequeStatusAndAutoReverse,
  buildChequeAuditTimeline,
  normalizeChequeNo
} from '../utils/chequeManager';
import { hapticTap, hapticTransactionComplete } from '../utils/haptics';

interface ChequeManagementWidgetProps {
  state: AppState;
  language: AppLanguage;
  onNavigate: (view: any) => void;
  onOpenCustomerLedger?: (factoryName: string) => void;
  onUpdateState?: (newState: AppState) => void;
}

function normalizeChequeDateISO(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const fromDmy = dmyToISO(trimmed);
  if (fromDmy) return fromDmy;
  const parsed = parseDMY(trimmed);
  if (parsed) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  }
  return '';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const ChequeManagementWidget: React.FC<ChequeManagementWidgetProps> = ({
  state,
  onNavigate,
  onOpenCustomerLedger,
  onUpdateState
}) => {
  const [widgetViewMode, setWidgetViewMode] = useState<'list' | 'calendar' | 'history'>('list');
  const [filterMode, setFilterMode] = useState<'all' | 'upcoming' | 'presented' | 'bounced' | 'overdue'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Historical Audit Log Filter State
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historySelectedChequeNo, setHistorySelectedChequeNo] = useState<string>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'cleared' | 'presented' | 'bounced' | 'overdue' | 'pending'>('all');
  const [historyLayoutMode, setHistoryLayoutMode] = useState<'timeline' | 'grouped'>('timeline');

  // Calendar Navigation State
  const todayStr = todayISO();
  const [calMonthDate, setCalMonthDate] = useState<{ year: number; month: number }>(() => {
    const [y, m] = todayStr.split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(todayStr);

  // Reconciliation Contact Modal State
  const [activeReconcileCheque, setActiveReconcileCheque] = useState<ChequeRecord | null>(null);
  const [customPhone, setCustomPhone] = useState<string>('');

  // Bounce Confirmation & Auto-Reversal Modal State
  const [bounceTargetCheque, setBounceTargetCheque] = useState<ChequeRecord | null>(null);
  const [bounceReason, setBounceReason] = useState<string>('');

  // Extract all cheques from existing ledger database
  const allCheques = useMemo(() => extractAllCheques(state), [state]);

  // Complete timestamped audit timeline across every cheque
  const auditTimeline = useMemo(() => buildChequeAuditTimeline(state), [state]);

  const filteredAuditLogs = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    const selectedNorm = historySelectedChequeNo !== 'all' ? normalizeChequeNo(historySelectedChequeNo) : '';

    return auditTimeline.filter(entry => {
      if (selectedNorm && normalizeChequeNo(entry.chequeNo) !== selectedNorm) {
        return false;
      }
      if (historyStatusFilter !== 'all' && entry.newStatus !== historyStatusFilter) {
        return false;
      }
      if (q) {
        const hay = `${entry.chequeNo} ${entry.payerParty} ${entry.payeeParty} ${entry.bankName} ${entry.notes || ''} ${entry.source || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [auditTimeline, historySearch, historySelectedChequeNo, historyStatusFilter]);

  const groupedAuditByCheque = useMemo(() => {
    const groups = new Map<
      string,
      {
        chequeNo: string;
        payerParty: string;
        payeeParty: string;
        bankName: string;
        amount: number;
        currentStatus: ChequeStatus;
        events: ChequeStatusLogEntry[];
      }
    >();

    // Populate chronological oldest->newest per cheque for clear lifecycle flow
    const ascLogs = [...filteredAuditLogs].sort((a, b) => {
      const tA = new Date(a.timestamp).getTime() || 0;
      const tB = new Date(b.timestamp).getTime() || 0;
      return tA - tB;
    });

    ascLogs.forEach(log => {
      const norm = normalizeChequeNo(log.chequeNo);
      const matchedCheque = allCheques.find(c => normalizeChequeNo(c.chequeNo) === norm);
      const existing = groups.get(norm);
      if (existing) {
        existing.events.push(log);
        existing.currentStatus = matchedCheque?.status || log.newStatus;
      } else {
        groups.set(norm, {
          chequeNo: log.chequeNo,
          payerParty: log.payerParty,
          payeeParty: log.payeeParty,
          bankName: log.bankName,
          amount: log.amount,
          currentStatus: matchedCheque?.status || log.newStatus,
          events: [log]
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) => {
      const latestA = new Date(a.events[a.events.length - 1]?.timestamp || 0).getTime();
      const latestB = new Date(b.events[b.events.length - 1]?.timestamp || 0).getTime();
      return latestB - latestA;
    });
  }, [filteredAuditLogs, allCheques]);

  const auditStats = useMemo(() => {
    const persistedTransitions = (state.chequeStatusLogs || []).length;
    const clearedEvents = auditTimeline.filter(e => e.newStatus === 'cleared').length;
    const bouncedEvents = auditTimeline.filter(e => e.newStatus === 'bounced').length;
    const uniqueCheques = new Set(auditTimeline.map(e => normalizeChequeNo(e.chequeNo))).size;
    return {
      totalEvents: auditTimeline.length,
      persistedTransitions,
      clearedEvents,
      bouncedEvents,
      uniqueCheques
    };
  }, [auditTimeline, state.chequeStatusLogs]);

  // Strict "Upcoming in Next 7 Days" list based on current date (0 <= daysRemaining <= 7, active statuses)
  const upcomingNext7Days = useMemo(() => {
    return allCheques
      .filter(
        c =>
          (c.status === 'pending' || c.status === 'presented') &&
          c.daysRemaining >= 0 &&
          c.daysRemaining <= 7
      )
      .sort((a, b) => a.daysRemaining - b.daysRemaining || b.amount - a.amount);
  }, [allCheques]);

  // Actionable cheques requiring watch (bounced, overdue, presented, or due within next 7 days)
  const actionableCheques = useMemo(() => {
    return allCheques.filter(c => {
      if (c.status === 'bounced') return true;
      if (c.status === 'overdue') return true;
      if (c.status === 'presented') return true;
      if (c.status === 'pending' && c.daysRemaining >= 0 && c.daysRemaining <= 7) return true;
      return false;
    });
  }, [allCheques]);

  // Sub-filter for the list view
  const displayCheques = useMemo(() => {
    if (filterMode === 'upcoming') return upcomingNext7Days;
    return actionableCheques.filter(c => {
      if (filterMode === 'presented') return c.status === 'presented';
      if (filterMode === 'bounced') return c.status === 'bounced';
      if (filterMode === 'overdue') return c.status === 'overdue';
      return true;
    });
  }, [actionableCheques, upcomingNext7Days, filterMode]);

  // Metrics
  const stats = useMemo(() => {
    let bouncedCount = 0;
    let bouncedAmount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let presentedCount = 0;
    let presentedAmount = 0;
    let upcomingCount = 0;
    let upcomingAmount = 0;

    actionableCheques.forEach(c => {
      if (c.status === 'bounced') {
        bouncedCount++;
        bouncedAmount += c.amount;
      } else if (c.status === 'overdue') {
        overdueCount++;
        overdueAmount += c.amount;
      } else if (c.status === 'presented') {
        presentedCount++;
        presentedAmount += c.amount;
      }
    });

    upcomingNext7Days.forEach(c => {
      upcomingCount++;
      upcomingAmount += c.amount;
    });

    const totalAtRisk = bouncedAmount + overdueAmount + presentedAmount + upcomingNext7Days
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + c.amount, 0);

    return {
      totalCount: actionableCheques.length,
      totalAtRisk,
      bouncedCount,
      bouncedAmount,
      overdueCount,
      overdueAmount,
      presentedCount,
      presentedAmount,
      upcomingCount,
      upcomingAmount
    };
  }, [actionableCheques, upcomingNext7Days]);

  // Map ALL cheques in database by YYYY-MM-DD maturity date for the Cheque Calendar
  const chequesByDate = useMemo(() => {
    const map = new Map<string, ChequeRecord[]>();
    allCheques.forEach(c => {
      const iso = normalizeChequeDateISO(c.chequeDate);
      if (!iso) return;
      const list = map.get(iso) || [];
      list.push(c);
      map.set(iso, list);
    });
    return map;
  }, [allCheques]);

  // Compute calendar grid metadata
  const calendarGrid = useMemo(() => {
    const { year, month } = calMonthDate;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDowMondayStart = (new Date(year, month, 1).getDay() + 6) % 7;

    const pad = (n: number) => String(n).padStart(2, '0');
    const todayParts = todayStr.split('-').map(Number);
    const todayLocal = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
    const sevenDaysEnd = new Date(todayLocal);
    sevenDaysEnd.setDate(sevenDaysEnd.getDate() + 7);

    const cells: Array<{
      day: number;
      isoDate: string;
      isToday: boolean;
      isInNext7Days: boolean;
      cheques: ChequeRecord[];
      totalAmount: number;
      hasBounced: boolean;
      hasOverdue: boolean;
      hasPresented: boolean;
      hasPending: boolean;
      hasCleared: boolean;
    }> = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const isoDate = `${year}-${pad(month + 1)}-${pad(day)}`;
      const cellLocal = new Date(year, month, day);
      const isToday = isoDate === todayStr;
      const isInNext7Days = cellLocal >= todayLocal && cellLocal <= sevenDaysEnd;
      const cheques = chequesByDate.get(isoDate) || [];

      cells.push({
        day,
        isoDate,
        isToday,
        isInNext7Days,
        cheques,
        totalAmount: cheques.reduce((s, ch) => s + ch.amount, 0),
        hasBounced: cheques.some(ch => ch.status === 'bounced'),
        hasOverdue: cheques.some(ch => ch.status === 'overdue'),
        hasPresented: cheques.some(ch => ch.status === 'presented'),
        hasPending: cheques.some(ch => ch.status === 'pending'),
        hasCleared: cheques.some(ch => ch.status === 'cleared')
      });
    }

    // Monthly totals summary
    let monthTotalAmount = 0;
    let monthChequeCount = 0;
    cells.forEach(c => {
      monthChequeCount += c.cheques.length;
      monthTotalAmount += c.totalAmount;
    });

    return {
      year,
      month,
      firstDowMondayStart,
      cells,
      monthChequeCount,
      monthTotalAmount
    };
  }, [calMonthDate, chequesByDate, todayStr]);

  const selectedDateCheques = useMemo(
    () => chequesByDate.get(selectedCalendarDate) || [],
    [chequesByDate, selectedCalendarDate]
  );

  // Navigate calendar month
  const shiftCalendarMonth = (delta: number) => {
    hapticTap();
    setCalMonthDate(prev => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const jumpCalendarToDate = (rawDate?: string) => {
    const iso = normalizeChequeDateISO(rawDate) || todayStr;
    const [y, m] = iso.split('-').map(Number);
    if (y && m) {
      setCalMonthDate({ year: y, month: m - 1 });
      setSelectedCalendarDate(iso);
      setWidgetViewMode('calendar');
      hapticTap();
    }
  };

  // Helper to resolve party phone number from existing app registries
  const resolvePartyPhone = (partyName: string): string => {
    const q = partyName.trim().toLowerCase();

    const foundFactory = state.factories?.find(f => f.name.toLowerCase() === q);
    if (foundFactory?.contact) return foundFactory.contact;

    const foundInq = state.inquiries?.find(i => i.party.toLowerCase() === q && i.phone && i.phone !== '—');
    if (foundInq?.phone) return foundInq.phone;

    return '';
  };

  // Format Pakistani phone to international WhatsApp format
  const formatPakPhone = (raw: string): string => {
    let cleaned = raw.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('03')) {
      cleaned = '92' + cleaned.substring(1);
    } else if (cleaned.startsWith('3') && cleaned.length === 10) {
      cleaned = '92' + cleaned;
    }
    return cleaned;
  };

  // Generate standardized Pakistani reconciliation statement
  const generateReconciliationMessage = (cheque: ChequeRecord): string => {
    const company = state.companyName || 'Falcon Rod Maker';
    const isBounced = cheque.status === 'bounced';
    const isPresented = cheque.status === 'presented';
    const party = cheque.payerParty;

    if (isBounced) {
      return `السلام علیکم ${party} صاحب،\nیہ پیغام ${company} گجرات کی جانب سے ہے۔\n\nآپ کا چیک نمبر #${cheque.chequeNo} برائے رقم ${fmt(cheque.amount)} (${cheque.bankName || 'بینک'}) بینک سے باؤنس / ڈس آنر ہو چکا ہے۔\n\nکھاتہ میں رقم کی کٹوتی منسوخ کر کے بقایا واجب الوصول بحال کر دیا گیا ہے۔ برائے مہربانی فوری رابطہ فرما کر رقم کلیئر فرمائیں۔ شکریہ!`;
    }

    if (isPresented) {
      return `السلام علیکم ${party} صاحب،\nیہ پیغام ${company} گجرات کی جانب سے ہے۔\n\nآپ کا چیک نمبر #${cheque.chequeNo} برائے رقم ${fmt(cheque.amount)} (${cheque.bankName || 'بینک'}) بینک میں برائے وصولی (Clearing) پیش کیا جا چکا ہے۔ برائے مہربانی اکاؤنٹ میں رقم کی دستیابی یقینی بنائیں۔ شکریہ!`;
    }

    if (cheque.status === 'overdue') {
      return `السلام علیکم ${party} صاحب،\nیہ پیغام ${company} گجرات کی جانب سے ہے۔\n\nچیک نمبر #${cheque.chequeNo} برائے رقم ${fmt(cheque.amount)} (${cheque.bankName || 'بینک'}) کی تاریخ برائے ادائیگی (${cheque.chequeDate}) گزر چکی ہے۔ برائے مہربانی چیک کی پاسنگ / کلیئرنس کی تصدیق فرمائیں۔ شکریہ!`;
    }

    return `السلام علیکم ${party} صاحب،\nیہ یاد دہانی ${company} گجرات کی جانب سے ہے۔\n\nچیک نمبر #${cheque.chequeNo} برائے رقم ${fmt(cheque.amount)} (${cheque.bankName || 'بینک'}) کی ادائیگی کی تاریخ نزدیک ہے (${cheque.chequeDate})۔ برائے مہربانی اکاؤنٹ میں مطلوبہ رقم کی موجودگی یقینی بنائیں۔ شکریہ!`;
  };

  const handleOpenWhatsApp = (cheque: ChequeRecord, directPhone?: string) => {
    hapticTap();
    const phone = directPhone || resolvePartyPhone(cheque.payerParty) || resolvePartyPhone(cheque.payeeParty);
    if (!phone) {
      setActiveReconcileCheque(cheque);
      setCustomPhone('');
      return;
    }

    const cleanPhone = formatPakPhone(phone);
    const message = generateReconciliationMessage(cheque);
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDirectCall = (cheque: ChequeRecord) => {
    hapticTap();
    const phone = resolvePartyPhone(cheque.payerParty) || resolvePartyPhone(cheque.payeeParty);
    if (!phone) {
      setActiveReconcileCheque(cheque);
      setCustomPhone('');
      return;
    }
    window.location.href = `tel:${phone.replace(/[^0-9+]/g, '')}`;
  };

  const handleStatusFieldChange = (cheque: ChequeRecord, newStatus: ChequeStatus) => {
    if (!onUpdateState) return;
    hapticTap();

    if (newStatus === 'bounced') {
      setBounceTargetCheque(cheque);
      setBounceReason(`Cheque #${cheque.chequeNo} returned unpaid / bounced from bank.`);
      return;
    }

    const { newState } = updateChequeStatusAndAutoReverse(
      state,
      cheque.chequeNo,
      newStatus,
      undefined,
      'Dashboard Widget'
    );
    onUpdateState(newState);
    hapticTransactionComplete();
  };

  const handleConfirmBounceAndAutoReverse = () => {
    if (!bounceTargetCheque || !onUpdateState) return;
    hapticTap();
    const { newState } = updateChequeStatusAndAutoReverse(
      state,
      bounceTargetCheque.chequeNo,
      'bounced',
      bounceReason,
      'Dashboard Widget'
    );
    onUpdateState(newState);
    hapticTransactionComplete();
    setBounceTargetCheque(null);
    setBounceReason('');
  };

  const openChequeHistory = (chequeNo: string) => {
    hapticTap();
    setHistorySelectedChequeNo(chequeNo);
    setHistoryStatusFilter('all');
    setHistorySearch('');
    setWidgetViewMode('history');
  };

  const handleExportAuditCsv = () => {
    const headers = ['Date', 'Time', 'Cheque #', 'Bank', 'Amount (Rs)', 'Payer', 'Payee', 'Previous Status', 'New Status', 'Source', 'Notes'];
    const rows = filteredAuditLogs.map(log => [
      log.date,
      log.time,
      log.chequeNo,
      log.bankName,
      String(log.amount),
      log.payerParty,
      log.payeeParty,
      log.previousStatus,
      log.newStatus,
      log.source || 'Cheque Management',
      (log.notes || '').replace(/"/g, '""')
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cheque_audit_log_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatAuditStatusBadge = (st: ChequeStatus | 'created') => {
    switch (st) {
      case 'created':
        return { label: 'Recorded', cls: 'bg-zinc-800 text-zinc-300 border-zinc-600' };
      case 'pending':
        return { label: 'Pending', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' };
      case 'presented':
        return { label: 'Presented', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40' };
      case 'cleared':
        return { label: 'Cleared', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'bounced':
        return { label: 'Bounced', cls: 'bg-rose-500/25 text-rose-300 border-rose-500/50' };
      case 'overdue':
        return { label: 'Overdue', cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40' };
      default:
        return { label: String(st), cls: 'bg-zinc-800 text-zinc-300 border-zinc-600' };
    }
  };

  const handleCopyMessage = (cheque: ChequeRecord) => {
    const text = generateReconciliationMessage(cheque);
    navigator.clipboard.writeText(text);
    setCopiedId(cheque.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Reusable card renderer for a cheque row (used in both List view and Calendar selected-date panel)
  const renderChequeRowCard = (cheque: ChequeRecord) => {
    const isBounced = cheque.status === 'bounced';
    const isPresented = cheque.status === 'presented';
    const isCleared = cheque.status === 'cleared';
    const isOverdue = cheque.status === 'overdue';
    const partyPhone = resolvePartyPhone(cheque.payerParty) || resolvePartyPhone(cheque.payeeParty);
    const isEndorsed = cheque.chequeType === 'endorsed_to_supplier';

    return (
      <div
        key={cheque.id}
        className={`p-3 rounded-xl border transition-all text-xs font-mono flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          isBounced
            ? 'bg-rose-950/20 border-rose-500/40 text-rose-200 hover:border-rose-400'
            : isPresented
            ? 'bg-sky-950/20 border-sky-500/40 text-sky-200 hover:border-sky-400'
            : isCleared
            ? 'bg-emerald-950/15 border-emerald-500/35 text-emerald-200 hover:border-emerald-400'
            : isOverdue
            ? 'bg-amber-950/20 border-amber-500/40 text-amber-200 hover:border-amber-400'
            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-zinc-300 hover:border-zinc-500'
        }`}
      >
        {/* Left Info */}
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-[var(--yellow)]">
              #{cheque.chequeNo}
            </span>
            <span className="text-zinc-300 text-xs">
              {cheque.bankName || 'Bank Cheque'}
            </span>
            <span className="font-bold text-white text-sm tabular-nums">
              {fmt(cheque.amount)}
            </span>

            {isBounced && (
              <span className="px-2 py-0.5 rounded bg-rose-500/30 text-rose-300 text-[10px] font-bold border border-rose-500/50">
                BOUNCED · DEBT RESTORED
              </span>
            )}
            {isPresented && (
              <span className="px-2 py-0.5 rounded bg-sky-500/30 text-sky-300 text-[10px] font-bold border border-sky-500/50">
                PRESENTED (IN BANK)
              </span>
            )}
            {isCleared && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-300 text-[10px] font-bold border border-emerald-500/50">
                CLEARED
              </span>
            )}
            {isOverdue && (
              <span className="px-2 py-0.5 rounded bg-amber-500/30 text-amber-300 text-[10px] font-bold border border-amber-500/50 animate-pulse">
                OVERDUE BY {Math.abs(cheque.daysRemaining)} DAYS
              </span>
            )}
            {!isBounced && !isPresented && !isCleared && !isOverdue && (
              <span className="px-2 py-0.5 rounded bg-zinc-700/60 text-zinc-200 text-[10px] font-medium border border-zinc-600">
                {cheque.daysRemaining === 0
                  ? 'DUE TODAY'
                  : cheque.daysRemaining === 1
                  ? 'DUE TOMORROW'
                  : `DUE IN ${cheque.daysRemaining} DAYS`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-sans text-zinc-300 flex-wrap">
            <span className="text-zinc-400">Payer:</span>
            <strong className="text-emerald-400">{cheque.customerLedgerName || cheque.payerParty}</strong>
            {isEndorsed && (
              <>
                <ArrowRight size={12} className="text-zinc-500" />
                <span className="text-zinc-400">Supplier:</span>
                <strong className="text-sky-400">{cheque.supplierName || cheque.payeeParty}</strong>
              </>
            )}
            <button
              type="button"
              onClick={() => jumpCalendarToDate(cheque.chequeDate)}
              className="text-zinc-400 hover:text-amber-300 font-mono text-[11px] ml-1 inline-flex items-center gap-1 cursor-pointer hover:underline"
              title="View on Cheque Calendar"
            >
              <CalendarIcon size={11} />
              <span>{cheque.chequeDate}</span>
            </button>
          </div>

          <div className="text-[11px] text-zinc-400 font-sans flex items-center gap-2 flex-wrap">
            <span>Contact:</span>
            {partyPhone ? (
              <span className="text-emerald-300 font-mono font-semibold">{partyPhone}</span>
            ) : (
              <span className="text-zinc-500 italic">No phone saved (tap WhatsApp to input)</span>
            )}
            {cheque.isCrossLinked && (
              <span className="text-[10px] text-sky-400 bg-sky-500/10 px-1.5 rounded font-mono border border-sky-500/20">
                Cross-Checked in Ledgers
              </span>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 flex-wrap shrink-0 self-end md:self-center font-sans">
          <div className="flex items-center gap-1.5 bg-black/50 border border-[var(--steel-line)] rounded-lg px-2 py-1 shrink-0">
            <span className="text-[10px] text-zinc-400 font-mono uppercase font-semibold">
              Status:
            </span>
            <select
              value={cheque.status}
              disabled={!onUpdateState}
              onChange={e => handleStatusFieldChange(cheque, e.target.value as ChequeStatus)}
              aria-label={`Status for cheque ${cheque.chequeNo}`}
              className={`text-xs font-mono font-bold rounded px-2 py-0.5 border cursor-pointer focus:outline-hidden transition-colors ${
                isBounced
                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/60'
                  : isCleared
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60'
                  : isPresented
                  ? 'bg-sky-950/80 text-sky-300 border-sky-500/60'
                  : isOverdue
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/60'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700'
              }`}
            >
              <option value="pending" className="bg-zinc-900 text-zinc-300">Pending</option>
              <option value="presented" className="bg-zinc-900 text-sky-400">Presented</option>
              <option value="cleared" className="bg-zinc-900 text-emerald-400">Cleared</option>
              <option value="bounced" className="bg-zinc-900 text-rose-400">Bounced</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => handleOpenWhatsApp(cheque)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            title="Send pre-filled reconciliation message on WhatsApp"
          >
            <MessageCircle size={14} />
            <span>WhatsApp</span>
          </button>

          {partyPhone && (
            <button
              type="button"
              onClick={() => handleDirectCall(cheque)}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition cursor-pointer"
              title={`Call ${partyPhone}`}
            >
              <Phone size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => handleCopyMessage(cheque)}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
            title="Copy reconciliation message to clipboard"
          >
            {copiedId === cheque.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>

          <button
            type="button"
            onClick={() => openChequeHistory(cheque.chequeNo)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-amber-500/20 border border-zinc-700 hover:border-amber-500/40 text-zinc-200 hover:text-amber-300 text-xs font-medium transition cursor-pointer"
            title="View timestamped status history for this cheque"
          >
            <History size={12} />
            <span>History</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (cheque.customerLedgerName && onOpenCustomerLedger) {
                onOpenCustomerLedger(cheque.customerLedgerName);
              } else if (cheque.customerLedgerName) {
                onNavigate('factories');
              } else if (cheque.supplierName) {
                onNavigate('raw_material');
              } else {
                onNavigate('cheques');
              }
            }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[var(--panel)] hover:bg-zinc-700 border border-[var(--steel-line)] text-zinc-300 text-xs font-medium transition cursor-pointer"
            title="Open Ledger for this account"
          >
            <span>Ledger</span>
            <ExternalLink size={12} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl overflow-hidden shadow-sm flex flex-col font-sans">
      {/* Widget Header */}
      <div className="p-4 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-transparent border-b border-[var(--steel-line)] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-black flex items-center justify-center font-bold shadow-xs">
            <CreditCard size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif font-bold text-base text-[var(--text)]">
                Cheque Clearance, 7-Day Upcoming & Calendar
              </h3>
              <span className="font-serif text-xs font-semibold text-amber-300">
                چیک مینجمنٹ و کیلنڈر
              </span>
              {stats.bouncedCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-mono text-[10px] font-bold animate-pulse">
                  {stats.bouncedCount} Bounced
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-dim)] font-mono">
              Upcoming 7-day maturity schedule, cheque calendar & automated reversal reconciliation
            </p>
          </div>
        </div>

        {/* Mode Switcher (Action List <-> Cheque Calendar) & Registry Link */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] p-0.5 text-xs font-mono">
            <button
              type="button"
              id="cheque-widget-view-list-btn"
              onClick={() => {
                hapticTap();
                setWidgetViewMode('list');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                widgetViewMode === 'list'
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ListChecks size={13} />
              <span>Watch & 7-Day</span>
            </button>
            <button
              type="button"
              id="cheque-widget-view-calendar-btn"
              onClick={() => {
                hapticTap();
                setWidgetViewMode('calendar');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                widgetViewMode === 'calendar'
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <CalendarIcon size={13} />
              <span>Cheque Calendar</span>
            </button>
            <button
              type="button"
              id="cheque-widget-view-history-btn"
              onClick={() => {
                hapticTap();
                setWidgetViewMode('history');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                widgetViewMode === 'history'
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <History size={13} />
              <span>Audit Log</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] ${
                  widgetViewMode === 'history'
                    ? 'bg-black/25 text-black'
                    : 'bg-black/40 text-amber-300'
                }`}
              >
                {auditStats.totalEvents}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('cheques')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--panel-raised)] hover:bg-amber-500 hover:text-black border border-[var(--steel-line)] text-amber-300 text-xs font-bold font-mono transition cursor-pointer"
          >
            <span>Full Registry</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-[var(--panel-raised)]/50 border-b border-[var(--steel-line)] text-xs font-mono">
        <div className="p-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]">
          <span className="text-[10px] text-zinc-400 block">Total Actionable</span>
          <div className="font-bold text-sm text-[var(--text)] mt-0.5">
            {stats.totalCount} Cheques
          </div>
          <span className="text-[10px] text-zinc-500">{fmt(stats.totalAtRisk)}</span>
        </div>

        <div
          onClick={() => {
            setWidgetViewMode('list');
            setFilterMode('upcoming');
          }}
          className={`p-2 rounded-lg border cursor-pointer transition ${
            stats.upcomingCount > 0
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:border-amber-400'
              : 'bg-[var(--panel)] border-[var(--steel-line)]'
          }`}
        >
          <span className="text-[10px] block opacity-85">Upcoming (Next 7d)</span>
          <div className="font-bold text-sm text-amber-300 mt-0.5">
            {stats.upcomingCount} Cheques
          </div>
          <span className="text-[10px] opacity-90">{fmt(stats.upcomingAmount)}</span>
        </div>

        <div className={`p-2 rounded-lg border ${
          stats.presentedCount > 0 ? 'bg-sky-500/10 border-sky-500/40 text-sky-300' : 'bg-[var(--panel)] border-[var(--steel-line)]'
        }`}>
          <span className="text-[10px] block opacity-80">Presented (In Bank)</span>
          <div className={`font-bold text-sm mt-0.5 ${stats.presentedCount > 0 ? 'text-sky-400' : 'text-zinc-300'}`}>
            {stats.presentedCount} Cheques
          </div>
          <span className="text-[10px] opacity-90">{fmt(stats.presentedAmount)}</span>
        </div>

        <div className={`p-2 rounded-lg border ${
          stats.bouncedCount > 0 ? 'bg-rose-500/10 border-rose-500/40 text-rose-300' : 'bg-[var(--panel)] border-[var(--steel-line)]'
        }`}>
          <span className="text-[10px] block opacity-80">Bounced (Reversed)</span>
          <div className={`font-bold text-sm mt-0.5 ${stats.bouncedCount > 0 ? 'text-rose-400' : 'text-zinc-300'}`}>
            {stats.bouncedCount} Cheques
          </div>
          <span className="text-[10px] opacity-90">{fmt(stats.bouncedAmount)}</span>
        </div>

        <div className={`p-2 rounded-lg border col-span-2 sm:col-span-1 ${
          stats.overdueCount > 0 ? 'bg-amber-950/30 border-amber-500/50 text-amber-300' : 'bg-[var(--panel)] border-[var(--steel-line)]'
        }`}>
          <span className="text-[10px] block opacity-80">Past Maturity Date</span>
          <div className={`font-bold text-sm mt-0.5 ${stats.overdueCount > 0 ? 'text-amber-400' : 'text-zinc-300'}`}>
            {stats.overdueCount} Cheques
          </div>
          <span className="text-[10px] opacity-90">{fmt(stats.overdueAmount)}</span>
        </div>
      </div>

      {/* VIEW MODE 1: WATCH LIST & DEDICATED UPCOMING 7-DAY SCHEDULE */}
      {widgetViewMode === 'list' ? (
        <>
          {/* Dedicated Upcoming Cheques (Next 7 Days) Quick Strip */}
          <div className="px-4 pt-3">
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Clock size={14} className="text-amber-400" />
                  <span>Upcoming Cheques Due in Next 7 Days ({todayStr} → +7d)</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                    {upcomingNext7Days.length} Due · {fmt(stats.upcomingAmount)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setWidgetViewMode('calendar')}
                  className="text-[11px] font-mono font-bold text-sky-300 hover:text-sky-200 flex items-center gap-1 cursor-pointer hover:underline"
                >
                  <CalendarIcon size={12} />
                  <span>Inspect on Calendar</span>
                </button>
              </div>

              {upcomingNext7Days.length === 0 ? (
                <p className="text-[11px] font-mono text-zinc-400">
                  No pending or presented cheques maturing within the next 7 days.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {upcomingNext7Days.map(c => (
                    <div
                      key={`up7_${c.id}`}
                      onClick={() => jumpCalendarToDate(c.chequeDate)}
                      className="p-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-amber-400/60 transition cursor-pointer flex items-center justify-between gap-2 text-xs font-mono"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[var(--yellow)]">#{c.chequeNo}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                            c.daysRemaining === 0
                              ? 'bg-rose-500/25 text-rose-300'
                              : c.daysRemaining <= 2
                              ? 'bg-amber-500/25 text-amber-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}>
                            {c.daysRemaining === 0 ? 'TODAY' : c.daysRemaining === 1 ? 'TOMORROW' : `IN ${c.daysRemaining}D`}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-300 font-sans truncate mt-0.5">
                          {c.customerLedgerName || c.payerParty}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {c.chequeDate} · {c.bankName || 'Bank'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-white">{fmt(c.amount)}</div>
                        <div className="text-[10px] uppercase text-zinc-400">{c.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 px-4 pt-3 overflow-x-auto text-xs">
            {[
              { id: 'all', label: 'All Actionable', count: actionableCheques.length },
              { id: 'upcoming', label: 'Upcoming (Next 7 Days)', count: upcomingNext7Days.length, isWarn: upcomingNext7Days.length > 0 },
              { id: 'presented', label: 'Presented (In Bank)', count: stats.presentedCount, isSky: stats.presentedCount > 0 },
              { id: 'bounced', label: 'Bounced / Dishonoured', count: stats.bouncedCount, isAlert: stats.bouncedCount > 0 },
              { id: 'overdue', label: 'Overdue', count: stats.overdueCount, isWarn: stats.overdueCount > 0 }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  filterMode === tab.id
                    ? 'bg-amber-500 text-black shadow-xs'
                    : 'bg-[var(--panel-raised)] border border-[var(--steel-line)] text-zinc-400 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  filterMode === tab.id
                    ? 'bg-black/25 text-black'
                    : tab.isAlert
                    ? 'bg-rose-500 text-white'
                    : tab.isWarn
                    ? 'bg-amber-500/20 text-amber-300'
                    : tab.isSky
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'bg-black/30 text-zinc-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Cheques List Body */}
          <div className="p-4 space-y-2.5 max-h-[460px] overflow-y-auto">
            {displayCheques.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 font-mono text-xs space-y-1 bg-[var(--panel-raised)]/30 rounded-xl border border-[var(--steel-line)]">
                <CheckCircle2 size={28} className="mx-auto text-emerald-400 mb-1" />
                <div className="font-bold text-zinc-200">No Cheques Matching Filter</div>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                  No cheques currently match this category. Switch tabs or inspect the Cheque Calendar to browse all maturity dates.
                </p>
              </div>
            ) : (
              displayCheques.map(cheque => renderChequeRowCard(cheque))
            )}
          </div>
        </>
      ) : widgetViewMode === 'calendar' ? (
        /* VIEW MODE 2: INTERACTIVE CHEQUE MATURITY CALENDAR */
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left / Main Calendar Grid (7 cols on desktop) */}
            <div className="lg:col-span-7 bg-[var(--panel-raised)]/40 border border-[var(--steel-line)] rounded-xl p-3.5 space-y-3">
              {/* Month Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} className="text-amber-400" />
                  <h4 className="font-serif font-bold text-sm text-[var(--text)]">
                    {MONTH_NAMES[calendarGrid.month]} {calendarGrid.year}
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-300">
                    {calendarGrid.monthChequeCount} chqs · {fmt(calendarGrid.monthTotalAmount)}
                  </span>
                </div>

                <div className="flex items-center gap-1 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => shiftCalendarMonth(-1)}
                    className="p-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-300 hover:text-white hover:border-amber-400 cursor-pointer"
                    title="Previous Month"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => jumpCalendarToDate(todayStr)}
                    className="px-2.5 py-1 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-amber-300 hover:bg-amber-500 hover:text-black font-bold transition cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftCalendarMonth(1)}
                    className="p-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-300 hover:text-white hover:border-amber-400 cursor-pointer"
                    title="Next Month"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] uppercase text-zinc-400 font-bold">
                {WEEKDAY_LABELS.map(wd => (
                  <div key={wd} className="py-1">{wd}</div>
                ))}
              </div>

              {/* Calendar Day Cells */}
              <div className="grid grid-cols-7 gap-1 font-mono">
                {Array.from({ length: calendarGrid.firstDowMondayStart }).map((_, i) => (
                  <div key={`empty_${i}`} className="h-14 sm:h-16 rounded-lg bg-black/15 border border-transparent" />
                ))}

                {calendarGrid.cells.map(cell => {
                  const isSelected = selectedCalendarDate === cell.isoDate;
                  const hasCheques = cell.cheques.length > 0;

                  return (
                    <button
                      key={cell.isoDate}
                      type="button"
                      onClick={() => {
                        hapticTap();
                        setSelectedCalendarDate(cell.isoDate);
                      }}
                      className={`h-14 sm:h-16 p-1 rounded-lg border text-left flex flex-col justify-between transition cursor-pointer relative ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400'
                          : cell.hasBounced
                          ? 'bg-rose-950/30 border-rose-500/50 hover:border-rose-400'
                          : cell.hasOverdue
                          ? 'bg-amber-950/30 border-amber-500/50 hover:border-amber-400'
                          : cell.isInNext7Days
                          ? 'bg-sky-500/10 border-sky-500/30 hover:border-sky-400'
                          : 'bg-[var(--panel)] border-[var(--steel-line)] hover:border-zinc-500'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-[11px] font-bold leading-none ${
                            cell.isToday
                              ? 'px-1 py-0.5 rounded bg-amber-500 text-black'
                              : isSelected
                              ? 'text-amber-300'
                              : 'text-zinc-300'
                          }`}
                        >
                          {cell.day}
                        </span>

                        {hasCheques && (
                          <span className="text-[9px] px-1 rounded bg-black/50 text-zinc-200 font-bold">
                            {cell.cheques.length}
                          </span>
                        )}
                      </div>

                      {hasCheques ? (
                        <div className="space-y-0.5 w-full overflow-hidden">
                          <div className="flex items-center gap-0.5">
                            {cell.hasBounced && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" title="Bounced" />}
                            {cell.hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Overdue" />}
                            {cell.hasPresented && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" title="Presented" />}
                            {cell.hasPending && <span className="w-1.5 h-1.5 rounded-full bg-yellow-300" title="Pending" />}
                            {cell.hasCleared && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Cleared" />}
                          </div>
                          <div className="text-[9px] text-zinc-300 font-bold truncate leading-tight">
                            {cell.totalAmount >= 1000
                              ? `${Math.round(cell.totalAmount / 1000)}k`
                              : cell.totalAmount}
                          </div>
                        </div>
                      ) : (
                        cell.isInNext7Days && (
                          <span className="text-[8px] text-sky-400/70 uppercase tracking-tighter">
                            7d
                          </span>
                        )
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Calendar Legend */}
              <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-[var(--steel-line)] text-[10px] font-mono text-zinc-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" /> Bounced</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Overdue</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400" /> Presented</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-300" /> Pending</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Cleared</span>
                <span className="flex items-center gap-1 ml-auto text-sky-300">Blue tint = Next 7-Day Window</span>
              </div>
            </div>

            {/* Right Panel: Cheques Due on Selected Date + Next 7 Days Quick Jump */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="bg-[var(--panel-raised)]/40 border border-[var(--steel-line)] rounded-xl p-3.5 flex-1 flex flex-col">
                <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-2 mb-3">
                  <div>
                    <div className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                      <span>Cheques for {selectedCalendarDate}</span>
                      {selectedCalendarDate === todayStr && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500 text-black font-mono text-[10px] font-bold">
                          TODAY
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {selectedDateCheques.length} cheque(s) totaling{' '}
                      {fmt(selectedDateCheques.reduce((s, c) => s + c.amount, 0))}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5 flex-1 max-h-[340px] overflow-y-auto pr-0.5">
                  {selectedDateCheques.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500 font-mono text-xs space-y-1">
                      <CalendarIcon size={24} className="mx-auto opacity-50 mb-1" />
                      <div>No cheques dated {selectedCalendarDate}</div>
                      <p className="text-[10px] text-zinc-500">
                        Select any highlighted date on the calendar or pick an upcoming cheque below.
                      </p>
                    </div>
                  ) : (
                    selectedDateCheques.map(chq => renderChequeRowCard(chq))
                  )}
                </div>
              </div>

              {/* Upcoming 7 Days Quick Jump List inside Calendar Mode */}
              <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-3 space-y-2">
                <div className="text-[11px] font-bold text-amber-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} />
                    <span>Next 7 Days Upcoming ({upcomingNext7Days.length})</span>
                  </span>
                  <span className="font-mono">{fmt(stats.upcomingAmount)}</span>
                </div>

                {upcomingNext7Days.length === 0 ? (
                  <p className="text-[11px] font-mono text-zinc-500">No cheques maturing in next 7 days.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {upcomingNext7Days.map(c => (
                      <button
                        key={`cal_up_${c.id}`}
                        type="button"
                        onClick={() => jumpCalendarToDate(c.chequeDate)}
                        className="w-full text-left p-2 rounded-lg bg-[var(--panel)] hover:border-amber-400 border border-[var(--steel-line)] flex items-center justify-between gap-2 text-xs font-mono transition cursor-pointer"
                      >
                        <div className="min-w-0 truncate">
                          <span className="font-bold text-[var(--yellow)]">#{c.chequeNo}</span>
                          <span className="text-zinc-400 mx-1">·</span>
                          <span className="text-zinc-200 font-sans">{c.customerLedgerName || c.payerParty}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="font-bold text-white">{fmt(c.amount)}</span>
                          <span className="block text-[10px] text-amber-300">
                            {c.chequeDate} ({c.daysRemaining === 0 ? 'Today' : `+${c.daysRemaining}d`})
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW MODE 3: HISTORICAL AUDIT TRAIL LOG */
        <div className="p-4 space-y-3.5">
          {/* Toolbar & Filters */}
          <div className="p-3 rounded-xl bg-[var(--panel-raised)]/60 border border-[var(--steel-line)] space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <History size={16} className="text-amber-400" />
                <div>
                  <h4 className="font-serif font-bold text-sm text-[var(--text)]">
                    Cheque Status Audit Trail & Historical Log
                  </h4>
                  <p className="text-[11px] font-mono text-zinc-400">
                    {auditStats.totalEvents} timestamped event(s) across {auditStats.uniqueCheques} cheque(s) ·{' '}
                    {auditStats.persistedTransitions} live status transition(s) recorded
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] p-0.5 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      hapticTap();
                      setHistoryLayoutMode('timeline');
                    }}
                    className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                      historyLayoutMode === 'timeline'
                        ? 'bg-amber-500 text-black'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Chronological Feed
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticTap();
                      setHistoryLayoutMode('grouped');
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                      historyLayoutMode === 'grouped'
                        ? 'bg-amber-500 text-black'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Layers size={11} />
                    <span>By Cheque</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleExportAuditCsv}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--panel)] hover:bg-zinc-700 border border-[var(--steel-line)] text-zinc-200 text-[11px] font-mono font-bold transition cursor-pointer"
                  title="Export filtered audit log to CSV"
                >
                  <Download size={12} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Search + Cheque Selector + Status Outcome Pills */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 text-xs font-mono">
              <div className="md:col-span-5 relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  placeholder="Search Cheque #, party, bank, or notes..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] placeholder-zinc-500 focus:border-amber-400 focus:outline-hidden text-xs"
                />
              </div>

              <div className="md:col-span-4">
                <select
                  value={historySelectedChequeNo}
                  onChange={e => setHistorySelectedChequeNo(e.target.value)}
                  aria-label="Filter audit log by cheque number"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] focus:border-amber-400 focus:outline-hidden text-xs"
                >
                  <option value="all">All Cheques ({allCheques.length})</option>
                  {allCheques.map(ch => (
                    <option key={`opt_${ch.id}`} value={ch.chequeNo}>
                      #{ch.chequeNo} · {ch.payerParty} ({fmt(ch.amount)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <select
                  value={historyStatusFilter}
                  onChange={e => setHistoryStatusFilter(e.target.value as any)}
                  aria-label="Filter audit log by target status"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] focus:border-amber-400 focus:outline-hidden text-xs"
                >
                  <option value="all">All Outcomes</option>
                  <option value="pending">Pending / Recorded</option>
                  <option value="presented">Presented (In Bank)</option>
                  <option value="cleared">Cleared</option>
                  <option value="bounced">Bounced (Reversed)</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>

            {historySelectedChequeNo !== 'all' && (
              <div className="flex items-center justify-between text-[11px] font-mono px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <span>
                  Showing audit trail strictly for Cheque <strong>#{historySelectedChequeNo}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setHistorySelectedChequeNo('all')}
                  className="underline font-bold hover:text-white cursor-pointer"
                >
                  Show All Cheques
                </button>
              </div>
            )}
          </div>

          {/* Audit Log Body */}
          {filteredAuditLogs.length === 0 ? (
            <div className="py-10 text-center text-zinc-400 font-mono text-xs space-y-1 bg-[var(--panel-raised)]/30 rounded-xl border border-[var(--steel-line)]">
              <History size={28} className="mx-auto text-zinc-500 mb-1" />
              <div className="font-bold text-zinc-200">No Audit Events Found</div>
              <p className="text-[11px] text-zinc-500">
                Try clearing filters or update any cheque status (e.g., Pending to Presented or Cleared) to record a new timestamped transition.
              </p>
            </div>
          ) : historyLayoutMode === 'timeline' ? (
            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {filteredAuditLogs.map(log => {
                const prevBadge = formatAuditStatusBadge(log.previousStatus);
                const nextBadge = formatAuditStatusBadge(log.newStatus);

                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-500/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      {/* Timestamp & Transition Badges */}
                      <div className="flex items-center gap-2 flex-wrap font-mono">
                        <span className="text-[11px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25">
                          {log.date} · {log.time}
                        </span>

                        <span className="font-bold text-white text-sm">
                          #{log.chequeNo}
                        </span>
                        <span className="text-zinc-400">{log.bankName}</span>
                        <span className="font-bold text-emerald-300 tabular-nums">
                          {fmt(log.amount)}
                        </span>
                      </div>

                      {/* Status Transition: e.g. Pending -> Cleared */}
                      <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                        <span className={`px-2 py-0.5 rounded border font-bold uppercase ${prevBadge.cls}`}>
                          {prevBadge.label}
                        </span>
                        <ArrowRight size={13} className="text-amber-400 shrink-0" />
                        <span className={`px-2 py-0.5 rounded border font-bold uppercase ${nextBadge.cls}`}>
                          {nextBadge.label}
                        </span>

                        {log.source && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-black/40 border border-zinc-700 text-zinc-400 text-[10px]">
                            via {log.source}
                          </span>
                        )}
                      </div>

                      {/* Parties & Notes */}
                      <div className="text-[11px] text-zinc-300 flex items-center gap-1.5 flex-wrap">
                        <span className="text-zinc-400">From:</span>
                        <strong className="text-emerald-400">{log.payerParty}</strong>
                        <ArrowRight size={11} className="text-zinc-500" />
                        <span className="text-zinc-400">To:</span>
                        <strong className="text-sky-400">{log.payeeParty}</strong>
                      </div>

                      {log.notes && (
                        <p className="text-[11px] font-mono text-zinc-400 bg-black/25 px-2.5 py-1.5 rounded-lg border border-zinc-800">
                          {log.notes}
                        </p>
                      )}

                      {log.reversedParties && log.reversedParties.length > 0 && (
                        <div className="text-[10px] font-mono text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-1 rounded">
                          Auto-Reversed Ledgers: {log.reversedParties.join(' · ')}
                        </div>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-end gap-1.5 shrink-0 font-mono">
                      <button
                        type="button"
                        onClick={() => setHistorySelectedChequeNo(log.chequeNo)}
                        className="px-2 py-1 rounded-lg bg-[var(--panel)] hover:bg-amber-500/20 border border-[var(--steel-line)] text-[11px] text-amber-300 transition cursor-pointer"
                      >
                        Filter #{log.chequeNo}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Grouped by Cheque Lifecycle View */
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {groupedAuditByCheque.map(group => {
                const curBadge = formatAuditStatusBadge(group.currentStatus);
                return (
                  <div
                    key={`grp_${group.chequeNo}`}
                    className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2.5"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[var(--steel-line)] pb-2">
                      <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                        <span className="font-bold text-sm text-[var(--yellow)]">#{group.chequeNo}</span>
                        <span className="text-zinc-300">{group.bankName}</span>
                        <span className="font-bold text-white">{fmt(group.amount)}</span>
                        <span className="text-zinc-400 font-sans">
                          ({group.payerParty} → {group.payeeParty})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="text-zinc-400">{group.events.length} event(s)</span>
                        <span className={`px-2 py-0.5 rounded border font-bold uppercase ${curBadge.cls}`}>
                          Current: {curBadge.label}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 pl-2 border-l-2 border-amber-500/35">
                      {group.events.map(ev => {
                        const prevBadge = formatAuditStatusBadge(ev.previousStatus);
                        const nextBadge = formatAuditStatusBadge(ev.newStatus);
                        return (
                          <div key={ev.id} className="pl-3 relative text-xs">
                            <span className="w-2 h-2 rounded-full bg-amber-400 absolute -left-[5px] top-1.5" />
                            <div className="flex items-center gap-2 flex-wrap font-mono text-[11px]">
                              <span className="text-amber-300 font-bold">
                                {ev.date} {ev.time}
                              </span>
                              <span className={`px-1.5 py-0.2 rounded border text-[10px] font-bold uppercase ${prevBadge.cls}`}>
                                {prevBadge.label}
                              </span>
                              <ArrowRight size={11} className="text-zinc-400" />
                              <span className={`px-1.5 py-0.2 rounded border text-[10px] font-bold uppercase ${nextBadge.cls}`}>
                                {nextBadge.label}
                              </span>
                              {ev.source && (
                                <span className="text-[10px] text-zinc-500">({ev.source})</span>
                              )}
                            </div>
                            {ev.notes && (
                              <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                                {ev.notes}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Widget Footer */}
      <div className="p-3 bg-[var(--panel-raised)]/70 border-t border-[var(--steel-line)] flex items-center justify-between text-xs text-zinc-400 font-mono">
        <span className="flex items-center gap-1.5">
          <ShieldAlert size={14} className="text-amber-400 shrink-0" />
          <span>Marking 'Bounced' automatically applies cross-ledger reversal so neither customer nor supplier gets an unjust deduction.</span>
        </span>
        <button
          type="button"
          onClick={() => onNavigate('cheques')}
          className="text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1 hover:underline cursor-pointer shrink-0 ml-2"
        >
          <span>Endorse or Audit Cheques</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* MODAL 1: CONFIRM BOUNCE WITH AUTOMATIC CROSS-LEDGER REVERSAL */}
      {bounceTargetCheque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
          <div className="bg-[var(--panel)] border border-rose-500/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-rose-500/30 bg-rose-950/40 flex items-center gap-2.5 text-rose-300">
              <AlertTriangle size={20} className="text-rose-400 shrink-0" />
              <h3 className="font-serif font-bold text-base text-white">
                Mark as Bounced: Automatic Ledger Update
              </h3>
            </div>

            <div className="p-4 space-y-3.5 text-xs text-zinc-300">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Cheque #:</span>
                  <span className="font-bold text-white">#{bounceTargetCheque.chequeNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Amount:</span>
                  <span className="font-bold text-amber-400">{fmt(bounceTargetCheque.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Bank:</span>
                  <span className="text-white">{bounceTargetCheque.bankName || 'Bank'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Payer Party:</span>
                  <span className="text-emerald-400 font-semibold">{bounceTargetCheque.payerParty}</span>
                </div>
                {bounceTargetCheque.supplierName && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Supplier Endorsed:</span>
                    <span className="text-sky-400 font-semibold">{bounceTargetCheque.supplierName}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 leading-relaxed bg-zinc-900/60 p-3 rounded-xl border border-[var(--steel-line)]">
                <div className="font-bold text-amber-400 flex items-center gap-1">
                  <ShieldAlert size={14} />
                  <span>Automatic Ledger Reversal Breakdown:</span>
                </div>
                <p>
                  1. <strong className="text-white">Customer Receivable Restored:</strong> Adds a debit entry
                  to <span className="text-amber-300 font-semibold">{bounceTargetCheque.payerParty}</span>'s ledger.
                  The payment deduction is cancelled and they still owe you.
                </p>
                {bounceTargetCheque.chequeType === 'endorsed_to_supplier' && (
                  <p>
                    2. <strong className="text-white">Supplier Payable Restored:</strong> Adds a credit entry
                    to <span className="text-sky-300 font-semibold">{bounceTargetCheque.supplierName || bounceTargetCheque.payeeParty}</span>'s
                    ledger. Falcon's payable liability remains owed to the mill.
                  </p>
                )}
                <p>
                  3. <strong className="text-white">Inquiries Alert:</strong> Dispatches a high-priority dishonour
                  alert in the Notifications Hub.
                </p>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Return / Dishonour Reason:</label>
                <input
                  type="text"
                  value={bounceReason}
                  onChange={e => setBounceReason(e.target.value)}
                  placeholder="e.g. Insufficient funds / Stop payment / Signature mismatch"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-[var(--text)] focus:border-rose-400 font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--steel-line)]">
                <button
                  type="button"
                  onClick={() => setBounceTargetCheque(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBounceAndAutoReverse}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase shadow-lg transition cursor-pointer"
                >
                  Confirm & Reverse Ledgers
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONTACT / WHATSAPP INPUT MODAL FOR PARTIES WITHOUT SAVED PHONE */}
      {activeReconcileCheque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
          <div className="bg-[var(--panel)] border border-amber-500/40 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-[var(--steel-line)] bg-[var(--panel-raised)]/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-emerald-400" />
                <h3 className="font-serif font-bold text-base text-[var(--text)]">
                  Contact for Reconciliation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveReconcileCheque(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs text-zinc-300 font-sans">
              <div className="p-3 rounded-xl bg-zinc-900 border border-[var(--steel-line)] font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Party:</span>
                  <span className="font-bold text-white">{activeReconcileCheque.payerParty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Cheque #:</span>
                  <span className="font-bold text-amber-400">#{activeReconcileCheque.chequeNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Amount:</span>
                  <span className="font-bold text-white">{fmt(activeReconcileCheque.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Maturity Date:</span>
                  <span className="text-zinc-300">{activeReconcileCheque.chequeDate}</span>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Enter Party Mobile / WhatsApp Number:</label>
                <input
                  type="text"
                  placeholder="e.g. 0300 1234567"
                  value={customPhone}
                  onChange={e => setCustomPhone(e.target.value)}
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-white font-mono focus:border-amber-400 text-sm"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Accepts Pakistani mobile numbers (03xx...) or international format.
                </span>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Reconciliation Message Preview:</label>
                <div className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-zinc-300 text-xs whitespace-pre-wrap font-sans leading-relaxed">
                  {generateReconciliationMessage(activeReconcileCheque)}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--steel-line)]">
                <button
                  type="button"
                  onClick={() => {
                    handleCopyMessage(activeReconcileCheque);
                    setActiveReconcileCheque(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-semibold"
                >
                  Copy Text
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (customPhone.trim()) {
                      handleOpenWhatsApp(activeReconcileCheque, customPhone.trim());
                      setActiveReconcileCheque(null);
                    } else {
                      alert('Please enter a phone number to launch WhatsApp.');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-md"
                >
                  <MessageCircle size={15} />
                  <span>Open WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
