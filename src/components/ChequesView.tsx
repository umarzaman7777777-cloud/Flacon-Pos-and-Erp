import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  Building,
  Layers,
  Calendar,
  AlertCircle,
  ExternalLink,
  Info,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  List as ListIcon,
  X
} from 'lucide-react';
import {
  AppState,
  ChequeRecord,
  ChequeStatus,
  ChequeType,
  AppLanguage
} from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, dmyToISO, parseDMY, exportTablePDF, downloadCSV } from '../utils/helpers';
import {
  extractAllCheques,
  updateChequeStatusAndAutoReverse,
  endorseCustomerChequeToSupplier
} from '../utils/chequeManager';
import { hapticTap, hapticTransactionComplete } from '../utils/haptics';

interface ChequesViewProps {
  state: AppState;
  onUpdateState: (newState: AppState) => void;
  language: AppLanguage;
  onNavigateToView?: (view: any) => void;
}

const getChequeStatusStyle = (status: ChequeStatus) => {
  switch (status) {
    case 'cleared':
      return {
        label: 'Cleared',
        badgeBg: 'bg-emerald-600/35 text-emerald-100 border-emerald-400/70',
        rowBg: 'bg-emerald-950/20 hover:bg-emerald-950/35',
        cardBg: 'bg-emerald-950/30 border-emerald-500/50',
        calendarCellBg: 'bg-emerald-950/25 border-emerald-500/45 hover:border-emerald-400',
        calendarPillCls: 'bg-emerald-600/35 text-emerald-100 border-emerald-400/65',
        dotCls: 'bg-emerald-400',
        textAccent: 'text-emerald-300'
      };
    case 'bounced':
      return {
        label: 'Bounced',
        badgeBg: 'bg-red-600/40 text-red-100 border-red-400/75 shadow-xs',
        rowBg: 'bg-red-950/25 hover:bg-red-950/40',
        cardBg: 'bg-red-950/35 border-red-500/55',
        calendarCellBg: 'bg-red-950/30 border-red-500/55 hover:border-red-400',
        calendarPillCls: 'bg-red-600/40 text-red-100 border-red-400/70',
        dotCls: 'bg-red-400',
        textAccent: 'text-red-300'
      };
    case 'presented':
      return {
        label: 'Presented',
        badgeBg: 'bg-amber-500/30 text-amber-100 border-amber-400/75',
        rowBg: 'bg-amber-950/20 hover:bg-amber-950/35',
        cardBg: 'bg-amber-950/30 border-amber-500/50',
        calendarCellBg: 'bg-amber-950/25 border-amber-500/45 hover:border-amber-400',
        calendarPillCls: 'bg-amber-500/30 text-amber-100 border-amber-400/70',
        dotCls: 'bg-amber-400',
        textAccent: 'text-amber-300'
      };
    case 'overdue':
      return {
        label: 'Overdue',
        badgeBg: 'bg-orange-600/35 text-orange-100 border-orange-400/75 animate-pulse',
        rowBg: 'bg-orange-950/25 hover:bg-orange-950/40',
        cardBg: 'bg-orange-950/30 border-orange-500/55',
        calendarCellBg: 'bg-orange-950/30 border-orange-500/55 hover:border-orange-400',
        calendarPillCls: 'bg-orange-600/35 text-orange-100 border-orange-400/70',
        dotCls: 'bg-orange-400',
        textAccent: 'text-orange-300'
      };
    case 'pending':
    default:
      return {
        label: 'Pending',
        badgeBg: 'bg-slate-600/45 text-slate-100 border-slate-400/55',
        rowBg: 'hover:bg-[var(--panel-raised)]/40',
        cardBg: 'bg-[var(--panel-raised)] border-[var(--steel-line)]',
        calendarCellBg: 'bg-[var(--panel-raised)]/50 border-[var(--steel-line)] hover:border-zinc-500',
        calendarPillCls: 'bg-slate-700/75 text-slate-100 border-slate-500/65',
        dotCls: 'bg-slate-400',
        textAccent: 'text-slate-300'
      };
  }
};

export const ChequesView: React.FC<ChequesViewProps> = ({
  state,
  onUpdateState,
  language,
  onNavigateToView
}) => {
  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  // Search, Filters & View Toggle (List <-> Monthly Calendar)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'customer' | 'amount' | 'chequeNo'>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'endorsed' | 'presented' | 'overdue' | 'pending' | 'cleared' | 'bounced'>('all');
  const [selectedBank, setSelectedBank] = useState<string>('all');

  // Calendar State
  const todayStr = todayISO();
  const [calMonthDate, setCalMonthDate] = useState<{ year: number; month: number }>(() => {
    const [y, m] = todayStr.split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(todayStr);

  // Modals
  const [isEndorseModalOpen, setIsEndorseModalOpen] = useState(false);
  const [isBounceConfirmModalOpen, setIsBounceConfirmModalOpen] = useState(false);
  const [selectedChequeForAction, setSelectedChequeForAction] = useState<ChequeRecord | null>(null);
  const [bounceReason, setBounceReason] = useState('');
  const [viewDetailsCheque, setViewDetailsCheque] = useState<ChequeRecord | null>(null);

  // Customer Cleared vs Bounced Summary Report Modal State
  const [isSummaryReportModalOpen, setIsSummaryReportModalOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [reportEndDate, setReportEndDate] = useState<string>(() => todayISO());
  const [reportDateField, setReportDateField] = useState<'chequeDate' | 'issueDate'>('chequeDate');

  // New Endorsement Form
  const [endorseForm, setEndorseForm] = useState({
    customerName: state.customerLedgers?.[0]?.name || '',
    supplierName: state.rawSuppliers?.[0]?.name || '',
    chequeNo: '',
    bankName: 'HBL',
    amount: '',
    chequeDate: todayISO(),
    notes: ''
  });

  // Extract all cheques dynamically
  const allCheques = useMemo(() => extractAllCheques(state), [state]);

  // Unique banks for filtering
  const banksList = useMemo(() => {
    const set = new Set<string>();
    allCheques.forEach(c => {
      if (c.bankName) set.add(c.bankName);
    });
    return Array.from(set);
  }, [allCheques]);

  // Filtered Cheques
  const filteredCheques = useMemo(() => {
    return allCheques.filter(cheque => {
      // Tab filter
      if (activeTab === 'endorsed' && cheque.chequeType !== 'endorsed_to_supplier') return false;
      if (activeTab === 'presented' && cheque.status !== 'presented') return false;
      if (activeTab === 'overdue' && cheque.status !== 'overdue') return false;
      if (activeTab === 'pending' && cheque.status !== 'pending') return false;
      if (activeTab === 'cleared' && cheque.status !== 'cleared') return false;
      if (activeTab === 'bounced' && cheque.status !== 'bounced') return false;

      // Bank filter
      if (selectedBank !== 'all' && cheque.bankName !== selectedBank) return false;

      // Search term (Customer name, Amount, or Cheque #)
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const normalizedNoQ = q.replace(/^#/, '');
        const numericQ = q.replace(/^(rs\.?\s*)/i, '').replace(/,/g, '').trim();

        const matchesNo = cheque.chequeNo.toLowerCase().includes(normalizedNoQ);
        const matchesCustomer =
          cheque.payerParty.toLowerCase().includes(q) ||
          Boolean(cheque.customerLedgerName?.toLowerCase().includes(q));
        const matchesOtherParties =
          cheque.payeeParty.toLowerCase().includes(q) ||
          Boolean(cheque.supplierName?.toLowerCase().includes(q));
        const matchesBank = Boolean(cheque.bankName?.toLowerCase().includes(q));
        const matchesNotes = Boolean(cheque.notes?.toLowerCase().includes(q));
        const matchesAmount =
          (numericQ.length > 0 && String(cheque.amount).includes(numericQ)) ||
          cheque.amount.toLocaleString().toLowerCase().includes(q) ||
          fmt(cheque.amount).toLowerCase().includes(q);

        if (searchField === 'customer') {
          return matchesCustomer;
        }
        if (searchField === 'amount') {
          return matchesAmount;
        }
        if (searchField === 'chequeNo') {
          return matchesNo;
        }
        return (
          matchesNo ||
          matchesCustomer ||
          matchesAmount ||
          matchesOtherParties ||
          matchesBank ||
          matchesNotes
        );
      }

      return true;
    });
  }, [allCheques, activeTab, selectedBank, searchTerm, searchField]);

  // Helper to normalize DD/MM/YYYY or YYYY-MM-DD to YYYY-MM-DD
  const normalizeDueDateISO = (raw?: string): string => {
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
  };

  // Map filtered cheques by normalized maturity/due date for Monthly Calendar view
  const chequesByDueDate = useMemo(() => {
    const map = new Map<string, ChequeRecord[]>();
    filteredCheques.forEach(c => {
      const iso = normalizeDueDateISO(c.chequeDate);
      if (!iso) return;
      const arr = map.get(iso) || [];
      arr.push(c);
      map.set(iso, arr);
    });
    return map;
  }, [filteredCheques]);

  // Distinct months containing filtered cheques (for instant jump pills)
  const activeMonthsWithCheques = useMemo(() => {
    const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const map = new Map<string, { year: number; month: number; label: string; count: number; total: number }>();
    filteredCheques.forEach(c => {
      const iso = normalizeDueDateISO(c.chequeDate);
      if (!iso) return;
      const [yStr, mStr] = iso.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1;
      if (isNaN(y) || isNaN(m)) return;
      const key = `${y}-${m}`;
      const existing = map.get(key) || {
        year: y,
        month: m,
        label: `${monthNamesShort[m]} ${y}`,
        count: 0,
        total: 0
      };
      existing.count += 1;
      existing.total += c.amount;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.year - b.year || a.month - b.month);
  }, [filteredCheques]);

  const calendarGrid = useMemo(() => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
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
      isNext7Days: boolean;
      cheques: ChequeRecord[];
      totalAmount: number;
      hasBounced: boolean;
      hasOverdue: boolean;
      hasPresented: boolean;
      hasPending: boolean;
      hasCleared: boolean;
    }> = [];

    let monthCount = 0;
    let monthTotal = 0;
    let monthCleared = 0;
    let monthBounced = 0;
    let monthPendingOrOverdue = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const isoDate = `${year}-${pad(month + 1)}-${pad(day)}`;
      const cellLocal = new Date(year, month, day);
      const isToday = isoDate === todayStr;
      const isNext7Days = cellLocal >= todayLocal && cellLocal <= sevenDaysEnd;
      const cheques = chequesByDueDate.get(isoDate) || [];
      const totalAmount = cheques.reduce((s, ch) => s + ch.amount, 0);

      monthCount += cheques.length;
      monthTotal += totalAmount;
      cheques.forEach(ch => {
        if (ch.status === 'cleared') monthCleared += ch.amount;
        else if (ch.status === 'bounced') monthBounced += ch.amount;
        else monthPendingOrOverdue += ch.amount;
      });

      cells.push({
        day,
        isoDate,
        isToday,
        isNext7Days,
        cheques,
        totalAmount,
        hasBounced: cheques.some(ch => ch.status === 'bounced'),
        hasOverdue: cheques.some(ch => ch.status === 'overdue'),
        hasPresented: cheques.some(ch => ch.status === 'presented'),
        hasPending: cheques.some(ch => ch.status === 'pending'),
        hasCleared: cheques.some(ch => ch.status === 'cleared')
      });
    }

    return {
      year,
      month,
      monthTitle: `${monthNames[month]} ${year}`,
      firstDowMondayStart,
      cells,
      monthCount,
      monthTotal,
      monthCleared,
      monthBounced,
      monthPendingOrOverdue
    };
  }, [calMonthDate, chequesByDueDate, todayStr]);

  const selectedDateCheques = useMemo(
    () => chequesByDueDate.get(selectedCalendarDate) || [],
    [chequesByDueDate, selectedCalendarDate]
  );

  const shiftCalendarMonth = (delta: number) => {
    hapticTap();
    setCalMonthDate(prev => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const jumpCalendarToMonth = (year: number, month: number, focusDate?: string) => {
    hapticTap();
    setCalMonthDate({ year, month });
    if (focusDate) {
      setSelectedCalendarDate(focusDate);
    } else {
      const pad = (n: number) => String(n).padStart(2, '0');
      const prefix = `${year}-${pad(month + 1)}-`;
      const firstDayWithCheque = Array.from(chequesByDueDate.keys())
        .filter(k => k.startsWith(prefix))
        .sort()[0];
      setSelectedCalendarDate(firstDayWithCheque || `${prefix}01`);
    }
  };

  // Statistics
  const stats = useMemo(() => {
    let totalCirculationAmount = 0;
    let pendingCount = 0;
    let presentedCount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let endorsedCount = 0;
    let endorsedAmount = 0;
    let bouncedCount = 0;
    let bouncedAmount = 0;

    allCheques.forEach(c => {
      if (c.status === 'pending' || c.status === 'presented' || c.status === 'overdue') {
        totalCirculationAmount += c.amount;
        pendingCount++;
      }
      if (c.status === 'presented') {
        presentedCount++;
      }
      if (c.status === 'overdue') {
        overdueCount++;
        overdueAmount += c.amount;
      }
      if (c.chequeType === 'endorsed_to_supplier') {
        endorsedCount++;
        endorsedAmount += c.amount;
      }
      if (c.status === 'bounced') {
        bouncedCount++;
        bouncedAmount += c.amount;
      }
    });

    return {
      totalCirculationAmount,
      pendingCount,
      presentedCount,
      overdueCount,
      overdueAmount,
      endorsedCount,
      endorsedAmount,
      bouncedCount,
      bouncedAmount
    };
  }, [allCheques]);

  // Customer Cleared vs Bounced Summary Report Data (filtered by selected date range)
  const customerSummaryReport = useMemo(() => {
    const normalizeISO = (raw?: string): string => {
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
    };

    const grouped = new Map<
      string,
      {
        customerName: string;
        totalCount: number;
        clearedCount: number;
        clearedAmount: number;
        bouncedCount: number;
        bouncedAmount: number;
        pendingCount: number;
        pendingAmount: number;
        totalAmount: number;
      }
    >();

    const customerCheques = allCheques.filter(
      c => c.customerLedgerName || c.chequeType === 'customer_received' || c.chequeType === 'endorsed_to_supplier'
    );

    customerCheques.forEach(c => {
      const rawDate = reportDateField === 'issueDate' ? (c.issueDate || c.chequeDate) : c.chequeDate;
      const isoDate = normalizeISO(rawDate);

      if (reportStartDate && isoDate && isoDate < reportStartDate) return;
      if (reportEndDate && isoDate && isoDate > reportEndDate) return;

      const customerName = c.customerLedgerName || c.payerParty || 'Unknown Customer';
      const existing = grouped.get(customerName) || {
        customerName,
        totalCount: 0,
        clearedCount: 0,
        clearedAmount: 0,
        bouncedCount: 0,
        bouncedAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
        totalAmount: 0
      };

      existing.totalCount += 1;
      existing.totalAmount += c.amount;

      if (c.status === 'cleared') {
        existing.clearedCount += 1;
        existing.clearedAmount += c.amount;
      } else if (c.status === 'bounced') {
        existing.bouncedCount += 1;
        existing.bouncedAmount += c.amount;
      } else {
        existing.pendingCount += 1;
        existing.pendingAmount += c.amount;
      }

      grouped.set(customerName, existing);
    });

    const rows = Array.from(grouped.values()).sort(
      (a, b) => b.bouncedAmount + b.clearedAmount - (a.bouncedAmount + a.clearedAmount)
    );

    const totals = rows.reduce(
      (acc, r) => ({
        totalCount: acc.totalCount + r.totalCount,
        clearedCount: acc.clearedCount + r.clearedCount,
        clearedAmount: acc.clearedAmount + r.clearedAmount,
        bouncedCount: acc.bouncedCount + r.bouncedCount,
        bouncedAmount: acc.bouncedAmount + r.bouncedAmount,
        pendingCount: acc.pendingCount + r.pendingCount,
        pendingAmount: acc.pendingAmount + r.pendingAmount,
        totalAmount: acc.totalAmount + r.totalAmount
      }),
      {
        totalCount: 0,
        clearedCount: 0,
        clearedAmount: 0,
        bouncedCount: 0,
        bouncedAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
        totalAmount: 0
      }
    );

    return { rows, totals };
  }, [allCheques, reportStartDate, reportEndDate, reportDateField]);

  // Handle Status Update (e.g. Cleared, Bounced)
  const handleUpdateStatus = (cheque: ChequeRecord, newStatus: ChequeStatus) => {
    hapticTap();
    if (newStatus === 'bounced') {
      setSelectedChequeForAction(cheque);
      setBounceReason(`Cheque #${cheque.chequeNo} returned unpaid / bounced from bank.`);
      setIsBounceConfirmModalOpen(true);
      return;
    }

    const { newState } = updateChequeStatusAndAutoReverse(
      state,
      cheque.chequeNo,
      newStatus,
      undefined,
      'Cheque Registry'
    );
    onUpdateState(newState);
    hapticTransactionComplete();
  };

  // Confirm Bounce with Reversals
  const handleConfirmBounce = () => {
    if (!selectedChequeForAction) return;
    const { newState } = updateChequeStatusAndAutoReverse(
      state,
      selectedChequeForAction.chequeNo,
      'bounced',
      bounceReason,
      'Cheque Registry'
    );
    onUpdateState(newState);
    hapticTransactionComplete();
    setIsBounceConfirmModalOpen(false);
    setSelectedChequeForAction(null);
  };

  // Submit Endorsement
  const handleEndorseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!endorseForm.chequeNo || !endorseForm.amount || Number(endorseForm.amount) <= 0) {
      alert('Please enter a valid Cheque Number and Amount.');
      return;
    }

    const newState = endorseCustomerChequeToSupplier(state, {
      chequeNo: endorseForm.chequeNo.trim(),
      bankName: endorseForm.bankName.trim() || 'Bank Cheque',
      amount: Number(endorseForm.amount),
      chequeDate: endorseForm.chequeDate || todayISO(),
      customerName: endorseForm.customerName.trim(),
      supplierName: endorseForm.supplierName.trim(),
      notes: endorseForm.notes.trim()
    });

    onUpdateState(newState);
    hapticTransactionComplete();
    setIsEndorseModalOpen(false);

    // Reset form
    setEndorseForm({
      customerName: state.customerLedgers?.[0]?.name || '',
      supplierName: state.rawSuppliers?.[0]?.name || '',
      chequeNo: '',
      bankName: 'HBL',
      amount: '',
      chequeDate: todayISO(),
      notes: ''
    });
  };

  // Export PDF
  const handleExportPDF = () => {
    const headers = [
      'Chq #',
      'Bank',
      'Payer (From)',
      'Payee (To)',
      'Type',
      'Due Date',
      'Amount (Rs)',
      'Status'
    ];

    const rows = filteredCheques.map(c => [
      c.chequeNo,
      c.bankName || '—',
      c.payerParty,
      c.payeeParty,
      c.chequeType === 'endorsed_to_supplier'
        ? '3rd-Party Endorsed'
        : c.chequeType === 'company_issued'
        ? 'Company Issued'
        : 'Customer Direct',
      c.chequeDate,
      fmt(c.amount),
      c.status.toUpperCase()
    ]);

    exportTablePDF(
      'Cheques Management & Clearance Registry',
      headers,
      rows,
      `Cheques_Registry_${todayISO()}.pdf`,
      'landscape',
      state.companyName || 'Falcon Rod Maker',
      'Cross-Ledger Auditing & Protection Register'
    );
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Cheque Number',
      'Bank',
      'Payer Party',
      'Payee Party',
      'Type',
      'Issue Date',
      'Clearing Due Date',
      'Amount (PKR)',
      'Status',
      'Cross-Linked',
      'Notes'
    ];

    const rows = filteredCheques.map(c => [
      c.chequeNo,
      c.bankName || '',
      c.payerParty,
      c.payeeParty,
      c.chequeType,
      c.issueDate || '',
      c.chequeDate,
      c.amount,
      c.status,
      c.isCrossLinked ? 'YES' : 'NO',
      c.notes || ''
    ]);

    downloadCSV(`cheques_register_${todayISO()}.csv`, headers, rows);
  };

  // Export Customer Cleared vs Bounced Summary PDF
  const handleExportSummaryPDF = () => {
    const { rows, totals } = customerSummaryReport;
    const headers = [
      'Customer / Factory',
      'Total Chqs',
      'Cleared Chqs',
      'Cleared Amount (PKR)',
      'Bounced Chqs',
      'Bounced Amount (PKR)',
      'Pending / In-Bank',
      'Clearance %'
    ];

    const tableRows: (string | number)[][] = rows.map(r => {
      const settled = r.clearedAmount + r.bouncedAmount;
      const clearRate = settled > 0 ? Math.round((r.clearedAmount / settled) * 100) : r.clearedAmount > 0 ? 100 : 0;
      return [
        r.customerName,
        r.totalCount,
        r.clearedCount,
        fmt(r.clearedAmount),
        r.bouncedCount,
        fmt(r.bouncedAmount),
        fmt(r.pendingAmount),
        settled > 0 ? `${clearRate}%` : 'Pending'
      ];
    });

    const grandSettled = totals.clearedAmount + totals.bouncedAmount;
    const grandClearRate = grandSettled > 0 ? Math.round((totals.clearedAmount / grandSettled) * 100) : 0;

    tableRows.push([
      'GRAND TOTAL',
      totals.totalCount,
      totals.clearedCount,
      fmt(totals.clearedAmount),
      totals.bouncedCount,
      fmt(totals.bouncedAmount),
      fmt(totals.pendingAmount),
      grandSettled > 0 ? `${grandClearRate}%` : '—'
    ]);

    const rangeLabel = `${reportStartDate || 'Start'} to ${reportEndDate || 'Present'}`;
    const basisLabel = reportDateField === 'issueDate' ? 'Issue Date' : 'Maturity/Clearing Date';
    const footerSummary = `Period: ${rangeLabel} (${basisLabel})   |   Total Cleared: ${fmt(totals.clearedAmount)} (${totals.clearedCount} chqs)   |   Total Bounced: ${fmt(totals.bouncedAmount)} (${totals.bouncedCount} chqs)`;

    exportTablePDF(
      `Customer Cheque Summary (Cleared vs Bounced) — ${rangeLabel}`,
      headers,
      tableRows,
      `Customer_Cheques_Cleared_vs_Bounced_${reportStartDate || 'all'}_to_${reportEndDate || todayISO()}.pdf`,
      'landscape',
      state.companyName || 'Falcon Rod Maker',
      `Cheque Reconciliation Summary (${rangeLabel})`,
      footerSummary
    );
  };

  // Export Customer Summary CSV
  const handleExportSummaryCSV = () => {
    const { rows, totals } = customerSummaryReport;
    const headers = [
      'Customer / Factory',
      'Total Cheques',
      'Cleared Count',
      'Cleared Amount (PKR)',
      'Bounced Count',
      'Bounced Amount (PKR)',
      'Pending / Overdue Count',
      'Pending / Overdue Amount (PKR)',
      'Total Volume (PKR)'
    ];

    const csvRows: (string | number)[][] = rows.map(r => [
      r.customerName,
      r.totalCount,
      r.clearedCount,
      r.clearedAmount,
      r.bouncedCount,
      r.bouncedAmount,
      r.pendingCount,
      r.pendingAmount,
      r.totalAmount
    ]);

    csvRows.push([
      'GRAND TOTAL',
      totals.totalCount,
      totals.clearedCount,
      totals.clearedAmount,
      totals.bouncedCount,
      totals.bouncedAmount,
      totals.pendingCount,
      totals.pendingAmount,
      totals.totalAmount
    ]);

    downloadCSV(
      `customer_cheques_summary_${reportStartDate || 'all'}_to_${reportEndDate || todayISO()}.csv`,
      headers,
      csvRows
    );
  };

  // Apply quick date preset for Summary Report
  const applyReportDatePreset = (preset: '30d' | 'thisMonth' | '90d' | 'all') => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const endIso = todayISO();

    if (preset === 'all') {
      setReportStartDate('');
      setReportEndDate(endIso);
      return;
    }
    if (preset === 'thisMonth') {
      setReportStartDate(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`);
      setReportEndDate(endIso);
      return;
    }
    const days = preset === '90d' ? 90 : 30;
    const start = new Date();
    start.setDate(start.getDate() - days);
    setReportStartDate(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`);
    setReportEndDate(endIso);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-24 font-sans">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <CreditCard size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-serif font-black text-[var(--text)] tracking-tight">
                Cheques Management System & Cross-Checking
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                چیک رجسٹر
              </span>
            </div>
            <p className="text-xs text-[var(--text-dim)] mt-0.5">
              Automated cross-ledger protection: customer receivable and raw material supplier payable reversals on bounce.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Monthly / List View Toggle */}
          <div className="inline-flex rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] p-0.5 text-xs font-mono">
            <button
              type="button"
              id="cheques-view-list-btn"
              onClick={() => {
                hapticTap();
                setViewMode('list');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <ListIcon size={14} />
              <span>List View</span>
            </button>
            <button
              type="button"
              id="cheques-view-calendar-btn"
              onClick={() => {
                hapticTap();
                setViewMode('calendar');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Calendar size={14} />
              <span>Monthly Calendar</span>
            </button>
          </div>

          <button
            type="button"
            id="cheques-summary-report-btn"
            onClick={() => setIsSummaryReportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500 hover:text-black text-xs font-bold transition cursor-pointer"
            title="Generate Customer Cleared vs Bounced Summary PDF by Date Range"
          >
            <BarChart3 size={15} />
            <span>Cleared vs Bounced PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] text-zinc-300 hover:text-white text-xs font-bold transition cursor-pointer"
            title="Download Spreadsheet"
          >
            <FileSpreadsheet size={15} />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] text-zinc-300 hover:text-white text-xs font-bold transition cursor-pointer"
            title="Print PDF Register"
          >
            <Printer size={15} />
            <span>PDF Register</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEndorseModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow transition active:scale-95 cursor-pointer hover:bg-amber-400"
          >
            <Plus size={16} />
            <span>Endorse Cheque to Raw Supplier</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Circulation */}
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>In Circulation (Pending)</span>
            <Clock size={16} className="text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-mono font-bold text-[var(--text)]">
              {fmt(stats.totalCirculationAmount)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              {stats.pendingCount} active cheques awaiting clearance
            </div>
          </div>
        </div>

        {/* 3rd Party Endorsed Cheques */}
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>Endorsed to Raw Suppliers</span>
            <ShieldCheck size={16} className="text-sky-400" />
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-mono font-bold text-sky-400">
              {fmt(stats.endorsedAmount)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              {stats.endorsedCount} customer cheques cross-linked to mills
            </div>
          </div>
        </div>

        {/* Overdue / Due Cheques */}
        <div className={`bg-[var(--panel)] border rounded-xl p-3.5 flex flex-col justify-between shadow-xs ${
          stats.overdueCount > 0 ? 'border-rose-500/50 bg-rose-500/5' : 'border-[var(--steel-line)]'
        }`}>
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>Overdue / Past Maturity</span>
            <AlertTriangle size={16} className={stats.overdueCount > 0 ? 'text-rose-400 animate-pulse' : 'text-zinc-500'} />
          </div>
          <div className="mt-2">
            <div className={`text-lg sm:text-xl font-mono font-bold ${stats.overdueCount > 0 ? 'text-rose-400' : 'text-[var(--text)]'}`}>
              {fmt(stats.overdueAmount)}
            </div>
            <div className="text-[11px] text-rose-300 mt-0.5">
              {stats.overdueCount} cheques requiring clearance confirmation
            </div>
          </div>
        </div>

        {/* Bounced / Auto-Reversed */}
        <div className="bg-[var(--panel)] border border-rose-500/30 rounded-xl p-3.5 flex flex-col justify-between shadow-xs bg-rose-950/10">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>Bounced (Auto-Reversed)</span>
            <XCircle size={16} className="text-rose-400" />
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-mono font-bold text-rose-400">
              {fmt(stats.bouncedAmount)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              {stats.bouncedCount} dishonoured · Debts fully restored
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Ledger Protection Explainer Banner */}
      <div className="bg-[var(--panel-raised)] border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3 text-xs">
        <Info size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-zinc-300">
          <div className="font-bold text-amber-300">
            How Falcon Rod Maker Automated Cross-Ledger Reversal Protects You:
          </div>
          <p className="leading-relaxed text-zinc-300">
            When you take a customer's cheque and hand it over to a raw material supplier (third-party endorsement),
            both ledgers are cross-checked by exact cheque number. If that cheque gets overdated or bounces at the bank,
            clicking <span className="text-rose-400 font-bold">"Mark Bounced"</span> instantly adds back the receivable to the
            customer's ledger (they still owe you) and adds back the payable to the raw supplier's ledger (you still owe them).
            Neither party gets an unjustified deduction!
          </p>
        </div>
      </div>

      {/* Search & Filtering Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-3">
        {/* Search Input Bar (Customer Name, Amount, or Cheque #) */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[280px]">
          <select
            aria-label="Search field"
            value={searchField}
            onChange={e => setSearchField(e.target.value as 'all' | 'customer' | 'amount' | 'chequeNo')}
            className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs font-mono text-amber-300 font-bold focus:outline-hidden focus:border-amber-400 shrink-0 cursor-pointer"
          >
            <option value="all">All Fields</option>
            <option value="customer">Customer</option>
            <option value="amount">Amount</option>
            <option value="chequeNo">Cheque #</option>
          </select>

          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              id="cheques-search-input"
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={
                searchField === 'customer'
                  ? 'Filter by customer name...'
                  : searchField === 'amount'
                  ? 'Filter by amount (e.g. 50000 or 50,000)...'
                  : searchField === 'chequeNo'
                  ? 'Filter by cheque number (e.g. 849102)...'
                  : 'Search customer name, amount, or cheque #...'
              }
              className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg pl-9 pr-24 py-1.5 text-xs text-[var(--text)] placeholder-zinc-500 focus:outline-hidden focus:border-amber-400 font-mono"
            />
            {searchTerm.trim() && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 font-mono text-[10px] font-bold">
                  {filteredCheques.length} found
                </span>
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                  title="Clear search"
                  className="p-0.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bank Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Bank:</span>
          <select
            value={selectedBank}
            onChange={e => setSelectedBank(e.target.value)}
            className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-hidden focus:border-amber-400"
          >
            <option value="all">All Banks</option>
            {banksList.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Segmented Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto">
          {[
            { id: 'all', label: 'All', count: allCheques.length, dotCls: '' },
            { id: 'endorsed', label: 'Endorsed (3rd-Party)', count: stats.endorsedCount, dotCls: 'bg-sky-400' },
            { id: 'presented', label: 'Presented', count: stats.presentedCount, dotCls: 'bg-amber-400' },
            { id: 'overdue', label: 'Overdue', count: stats.overdueCount, isAlert: stats.overdueCount > 0, dotCls: 'bg-orange-400' },
            { id: 'pending', label: 'Pending', count: allCheques.filter(c => c.status === 'pending').length, dotCls: 'bg-slate-400' },
            { id: 'cleared', label: 'Cleared', count: allCheques.filter(c => c.status === 'cleared').length, dotCls: 'bg-emerald-400' },
            { id: 'bounced', label: 'Bounced', count: stats.bouncedCount, isAlert: stats.bouncedCount > 0, dotCls: 'bg-red-400' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'bg-[var(--panel-raised)] border border-[var(--steel-line)] text-zinc-400 hover:text-white'
              }`}
            >
              {tab.dotCls && activeTab !== tab.id && (
                <span className={`w-2 h-2 rounded-full ${tab.dotCls}`} />
              )}
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === tab.id ? 'bg-black/25 text-black' : tab.isAlert ? 'bg-red-600 text-white' : 'bg-black/40 text-zinc-300'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Cheques Main View: Monthly Calendar OR List View */}
      {viewMode === 'calendar' ? (
        <div className="space-y-4">
          {/* Calendar Controls & Month Breakdown */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-amber-400" />
                  <h2 className="font-serif font-bold text-lg text-[var(--text)]">
                    {calendarGrid.monthTitle}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] text-zinc-200 font-bold">
                    {calendarGrid.monthCount} cheque(s) · {fmt(calendarGrid.monthTotal)}
                  </span>
                  {calendarGrid.monthPendingOrOverdue > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
                      Active/Due: {fmt(calendarGrid.monthPendingOrOverdue)}
                    </span>
                  )}
                  {calendarGrid.monthCleared > 0 && (
                    <span className="px-2 py-0.5 rounded bg-emerald-600/30 border border-emerald-400/60 text-emerald-100 font-bold">
                      Cleared: {fmt(calendarGrid.monthCleared)}
                    </span>
                  )}
                  {calendarGrid.monthBounced > 0 && (
                    <span className="px-2 py-0.5 rounded bg-red-600/30 border border-red-400/60 text-red-100 font-bold">
                      Bounced: {fmt(calendarGrid.monthBounced)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => shiftCalendarMonth(-1)}
                  className="p-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-zinc-300 hover:text-white hover:border-amber-400 transition cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const [y, m] = todayStr.split('-').map(Number);
                    jumpCalendarToMonth(y, m - 1, todayStr);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-amber-300 hover:bg-amber-500 hover:text-black font-bold transition cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => shiftCalendarMonth(1)}
                  className="p-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-zinc-300 hover:text-white hover:border-amber-400 transition cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            {/* Quick-Jump Pills for Months with Scheduled Cheques */}
            {activeMonthsWithCheques.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 text-[11px] font-mono">
                <span className="text-zinc-400 shrink-0 mr-1">Scheduled Months:</span>
                {activeMonthsWithCheques.map(mItem => {
                  const isActiveMonth = mItem.year === calMonthDate.year && mItem.month === calMonthDate.month;
                  return (
                    <button
                      key={`jm_${mItem.year}_${mItem.month}`}
                      type="button"
                      onClick={() => jumpCalendarToMonth(mItem.year, mItem.month)}
                      className={`px-2.5 py-1 rounded-lg border transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                        isActiveMonth
                          ? 'bg-amber-500 text-black border-amber-400 font-bold'
                          : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-zinc-300 hover:border-amber-400'
                      }`}
                    >
                      <span>{mItem.label}</span>
                      <span
                        className={`px-1 rounded text-[10px] ${
                          isActiveMonth ? 'bg-black/25 text-black' : 'bg-black/40 text-amber-300'
                        }`}
                      >
                        {mItem.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Calendar Grid + Selected Date Side Drawer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Main Monthly Grid (8 cols) */}
            <div className="lg:col-span-8 bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-3.5 space-y-2.5 shadow-xs">
              <div className="grid grid-cols-7 gap-1.5 text-center font-mono text-[11px] uppercase text-zinc-400 font-bold">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(wd => (
                  <div key={wd} className="py-1">{wd}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5 font-mono">
                {Array.from({ length: calendarGrid.firstDowMondayStart }).map((_, i) => (
                  <div
                    key={`cal_blank_${i}`}
                    className="min-h-[82px] sm:min-h-[96px] rounded-xl bg-black/15 border border-transparent"
                  />
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
                      className={`min-h-[82px] sm:min-h-[96px] p-1.5 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-400 ring-1 ring-amber-400'
                          : cell.hasBounced
                          ? 'bg-red-950/30 border-red-500/55 hover:border-red-400'
                          : cell.hasOverdue
                          ? 'bg-orange-950/30 border-orange-500/55 hover:border-orange-400'
                          : cell.hasPresented
                          ? 'bg-amber-950/25 border-amber-500/45 hover:border-amber-400'
                          : cell.hasCleared && !cell.hasPending
                          ? 'bg-emerald-950/25 border-emerald-500/45 hover:border-emerald-400'
                          : cell.isNext7Days
                          ? 'bg-sky-500/10 border-sky-500/30 hover:border-sky-400'
                          : 'bg-[var(--panel-raised)]/50 border-[var(--steel-line)] hover:border-zinc-500'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs font-bold leading-none ${
                            cell.isToday
                              ? 'px-1.5 py-0.5 rounded bg-amber-500 text-black'
                              : isSelected
                              ? 'text-amber-300'
                              : 'text-zinc-300'
                          }`}
                        >
                          {cell.day}
                        </span>
                        {hasCheques && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/60 text-zinc-200 font-bold">
                            {cell.cheques.length}
                          </span>
                        )}
                      </div>

                      {/* Plot Cheque Pills inside Day Cell */}
                      {hasCheques ? (
                        <div className="space-y-0.5 w-full mt-1 overflow-hidden">
                          {cell.cheques.slice(0, 2).map(ch => {
                            const pillStyle = getChequeStatusStyle(ch.status);

                            return (
                              <div
                                key={`cell_ch_${ch.id}`}
                                className={`text-[9px] px-1 py-0.2 rounded border truncate leading-tight font-medium ${pillStyle.calendarPillCls}`}
                                title={`#${ch.chequeNo} · ${ch.payerParty} · ${fmt(ch.amount)} (${ch.status})`}
                              >
                                #{ch.chequeNo} · {ch.amount >= 1000 ? `${Math.round(ch.amount / 1000)}k` : ch.amount}
                              </div>
                            );
                          })}
                          {cell.cheques.length > 2 && (
                            <div className="text-[9px] text-amber-300 font-bold pl-0.5">
                              +{cell.cheques.length - 2} more
                            </div>
                          )}
                          <div className="text-[9px] text-zinc-400 font-bold truncate pt-0.5">
                            {fmt(cell.totalAmount)}
                          </div>
                        </div>
                      ) : (
                        cell.isNext7Days && (
                          <span className="text-[9px] text-sky-400/70 uppercase self-end">
                            7d
                          </span>
                        )
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Calendar Legend */}
              <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-[var(--steel-line)] text-[11px] font-mono text-zinc-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-600 border border-slate-400" /> Pending</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500/60 border border-amber-400" /> Presented</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500/60 border border-emerald-400" /> Cleared</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-orange-500/65 border border-orange-400" /> Overdue</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-500/65 border border-red-400" /> Bounced</span>
                <span className="ml-auto text-sky-300 text-[10px]">Blue highlight = Next 7 Days</span>
              </div>
            </div>

            {/* Selected Date Cheques Inspector (4 cols) */}
            <div className="lg:col-span-4 bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-4 flex flex-col shadow-xs">
              <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif font-bold text-base text-[var(--text)]">
                      Due on {selectedCalendarDate}
                    </h3>
                    {selectedCalendarDate === todayStr && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black font-mono text-[10px] font-bold">
                        TODAY
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                    {selectedDateCheques.length} cheque(s) · Total{' '}
                    <strong className="text-amber-300">
                      {fmt(selectedDateCheques.reduce((s, c) => s + c.amount, 0))}
                    </strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-2.5 py-1 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[11px] font-mono text-zinc-300 hover:text-white transition cursor-pointer"
                >
                  All List
                </button>
              </div>

              <div className="space-y-2.5 flex-1 max-h-[520px] overflow-y-auto pr-0.5">
                {selectedDateCheques.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 font-mono text-xs space-y-2">
                    <Calendar size={30} className="mx-auto opacity-50" />
                    <div className="font-bold text-zinc-300">No Cheques Due on {selectedCalendarDate}</div>
                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                      Click any highlighted date cell or use the Scheduled Months bar above to inspect due cheques.
                    </p>
                  </div>
                ) : (
                  selectedDateCheques.map(cheque => {
                    const isEndorsed = cheque.chequeType === 'endorsed_to_supplier';
                    const isPresented = cheque.status === 'presented';
                    const isOverdue = cheque.status === 'overdue';
                    const isBounced = cheque.status === 'bounced';
                    const isCleared = cheque.status === 'cleared';
                    const statusStyle = getChequeStatusStyle(cheque.status);

                    return (
                      <div
                        key={`sel_${cheque.id}`}
                        className={`p-3 rounded-xl border space-y-2 text-xs transition ${statusStyle.cardBg}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 font-mono">
                              <span className="font-bold text-sm text-[var(--yellow)]">#{cheque.chequeNo}</span>
                              <span className="text-zinc-400">{cheque.bankName || 'Bank'}</span>
                            </div>
                            <div className="text-[11px] text-zinc-300 mt-0.5">
                              {isEndorsed ? (
                                <span>
                                  <strong className="text-emerald-400">{cheque.customerLedgerName || cheque.payerParty}</strong>
                                  {' → '}
                                  <strong className="text-sky-400">{cheque.supplierName || cheque.payeeParty}</strong>
                                </span>
                              ) : (
                                <span>
                                  {cheque.payerParty} → {cheque.payeeParty}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right font-mono shrink-0 space-y-1">
                            <div className="font-bold text-sm text-white">{fmt(cheque.amount)}</div>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] uppercase font-bold ${statusStyle.badgeBg}`}
                            >
                              {isCleared && <CheckCircle2 size={10} />}
                              {isPresented && <Clock size={10} />}
                              {isBounced && <XCircle size={10} />}
                              {isOverdue && <AlertTriangle size={10} />}
                              {cheque.status === 'pending' && <Clock size={10} />}
                              <span>{statusStyle.label}</span>
                            </span>
                          </div>
                        </div>

                        {cheque.notes && (
                          <div className="text-[11px] text-zinc-400 font-mono truncate">
                            {cheque.notes}
                          </div>
                        )}

                        {/* Quick Scheduling Status Actions */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-[var(--steel-line)]/60">
                          {!isPresented && !isCleared && !isBounced && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(cheque, 'presented')}
                              className="px-2 py-1 rounded bg-amber-500/25 text-amber-200 border border-amber-500/40 hover:bg-amber-500 hover:text-black font-bold text-[11px] transition cursor-pointer"
                            >
                              Present
                            </button>
                          )}
                          {!isCleared && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(cheque, 'cleared')}
                              className="px-2 py-1 rounded bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500 hover:text-black font-bold text-[11px] transition cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                          {!isBounced && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(cheque, 'bounced')}
                              className="px-2 py-1 rounded bg-red-500/25 text-red-200 border border-red-500/40 hover:bg-red-600 hover:text-white font-bold text-[11px] transition cursor-pointer"
                            >
                              Bounce
                            </button>
                          )}
                          {(isCleared || isBounced || isPresented) && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(cheque, 'pending')}
                              className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-[11px] transition cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewDetailsCheque(cheque)}
                            className="ml-auto p-1 rounded bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
                            title="View Full Cross-Check Details"
                          >
                            <Info size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : filteredCheques.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-12 text-center text-zinc-500 space-y-2">
          <CreditCard size={36} className="mx-auto text-zinc-600 mb-2" />
          <div className="text-sm font-bold text-zinc-300">No Cheques Matching Current Filters</div>
          <p className="text-xs max-w-md mx-auto">
            You can record customer cheques or directly endorse cheques to raw material suppliers using the button above.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--panel-raised)]/70 text-zinc-400 border-b border-[var(--steel-line)] uppercase text-[10px] tracking-wider font-mono">
                  <th className="py-2.5 px-3">Cheque # & Bank</th>
                  <th className="py-2.5 px-3">Flow & Cross-Link</th>
                  <th className="py-2.5 px-3">Maturity Date</th>
                  <th className="py-2.5 px-3 text-right">Amount (PKR)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--steel-line)]">
                {filteredCheques.map(cheque => {
                  const isEndorsed = cheque.chequeType === 'endorsed_to_supplier';
                  const isPresented = cheque.status === 'presented';
                  const isOverdue = cheque.status === 'overdue';
                  const isBounced = cheque.status === 'bounced';
                  const isCleared = cheque.status === 'cleared';
                  const statusStyle = getChequeStatusStyle(cheque.status);

                  return (
                    <tr
                      key={cheque.id}
                      className={`transition ${statusStyle.rowBg}`}
                    >
                      {/* Cheque # & Bank */}
                      <td className="py-3 px-3 align-top">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-sm text-[var(--yellow)]">
                            #{cheque.chequeNo}
                          </span>
                          <span className="text-xs text-zinc-300 font-semibold mt-0.5">
                            {cheque.bankName || 'Bank Cheque'}
                          </span>
                          {cheque.notes && (
                            <span className="text-[11px] text-zinc-500 truncate max-w-[200px] mt-0.5" title={cheque.notes}>
                              {cheque.notes}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Party Flow & Cross-Link */}
                      <td className="py-3 px-3 align-top">
                        <div className="space-y-1.5">
                          {isEndorsed ? (
                            <div className="flex items-center gap-1.5 text-xs flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                                Customer: {cheque.customerLedgerName || cheque.payerParty}
                              </span>
                              <ArrowRight size={13} className="text-zinc-500 shrink-0" />
                              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono text-[10px]">
                                Falcon
                              </span>
                              <ArrowRight size={13} className="text-zinc-500 shrink-0" />
                              <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 font-medium">
                                Supplier: {cheque.supplierName || cheque.payeeParty}
                              </span>
                            </div>
                          ) : cheque.chequeType === 'company_issued' ? (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                                Falcon Rod Maker (Own Cheque)
                              </span>
                              <ArrowRight size={13} className="text-zinc-500 shrink-0" />
                              <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 font-medium">
                                {cheque.payeeParty}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                                {cheque.payerParty}
                              </span>
                              <ArrowRight size={13} className="text-zinc-500 shrink-0" />
                              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                                Falcon
                              </span>
                            </div>
                          )}

                          {/* Cross-linking Badge */}
                          <div className="flex items-center gap-2">
                            {cheque.isCrossLinked && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-sky-300 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20 font-mono">
                                <ShieldCheck size={11} className="text-sky-400" />
                                <span>Cross-Checked in Both Ledgers</span>
                              </span>
                            )}
                            {isBounced && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-red-100 bg-red-600/30 px-1.5 py-0.2 rounded border border-red-400/55 font-mono font-bold">
                                <AlertCircle size={11} className="text-red-300" />
                                <span>Reversal Active: Debt Restored</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Due Date & Remaining */}
                      <td className="py-3 px-3 align-top font-mono">
                        <div className="flex flex-col">
                          <span className="text-xs text-[var(--text)] font-semibold">
                            {cheque.chequeDate}
                          </span>
                          {isCleared ? (
                            <span className="text-[10px] text-emerald-400 font-sans">
                              Cleared in bank
                            </span>
                          ) : isBounced ? (
                            <span className="text-[10px] text-red-400 font-sans font-bold">
                              Dishonoured / Bounced
                            </span>
                          ) : isOverdue ? (
                            <span className="text-[10px] text-orange-400 font-sans font-bold flex items-center gap-1">
                              <AlertTriangle size={11} />
                              Overdue by {Math.abs(cheque.daysRemaining)} days
                            </span>
                          ) : isPresented ? (
                            <span className="text-[10px] text-amber-300 font-sans font-semibold">
                              Presented at bank
                            </span>
                          ) : cheque.daysRemaining === 0 ? (
                            <span className="text-[10px] text-amber-400 font-sans font-bold">
                              Due Today!
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-400 font-sans">
                              Due in {cheque.daysRemaining} days
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 align-top text-right font-mono">
                        <span className="text-sm font-bold text-[var(--text)]">
                          {fmt(cheque.amount)}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3 align-top text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[11px] border ${statusStyle.badgeBg}`}
                        >
                          {isCleared && <CheckCircle2 size={13} />}
                          {isPresented && <Clock size={13} />}
                          {isBounced && <XCircle size={13} />}
                          {isOverdue && <AlertTriangle size={13} />}
                          {cheque.status === 'pending' && <Clock size={13} />}
                          <span>{statusStyle.label}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {!isPresented && !isCleared && !isBounced && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(cheque, 'presented')}
                              className="px-2 py-1 rounded bg-amber-500/25 text-amber-200 border border-amber-500/40 hover:bg-amber-500 hover:text-black font-bold text-[11px] transition cursor-pointer"
                              title="Mark as Presented in Bank"
                            >
                              Present
                            </button>
                          )}

                          {!isCleared && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(cheque, 'cleared')}
                              className="px-2 py-1 rounded bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500 hover:text-black font-bold text-[11px] transition cursor-pointer"
                              title="Mark as Cleared in Bank"
                            >
                              Clear
                            </button>
                          )}

                          {!isBounced && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(cheque, 'bounced')}
                              className="px-2 py-1 rounded bg-red-500/25 text-red-200 border border-red-500/40 hover:bg-red-600 hover:text-white font-bold text-[11px] transition cursor-pointer"
                              title="Mark as Bounced (Auto-Reverse Balances)"
                            >
                              Bounce
                            </button>
                          )}

                          {(isCleared || isBounced || isPresented) && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(cheque, 'pending')}
                              className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-[11px] transition cursor-pointer"
                              title="Reset to Pending"
                            >
                              Reset
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setViewDetailsCheque(cheque)}
                            className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
                            title="View Full Cross-Check Details"
                          >
                            <Info size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ENDORSE CHEQUE TO RAW MATERIAL SUPPLIER */}
      {isEndorseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[var(--panel)] border border-amber-500/30 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-[var(--steel-line)] bg-[var(--panel-raised)]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-amber-400" />
                <h3 className="font-serif font-bold text-base text-[var(--text)]">
                  Endorse Customer Cheque to Raw Supplier
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEndorseModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEndorseSubmit} className="p-4 space-y-3.5 text-xs">
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 text-sky-200 text-xs">
                <strong>Third-Party Parchi / Cheque Passing:</strong> This simultaneously credits the customer
                ledger and debits the raw material supplier ledger with the identical cheque number for seamless
                auditing and automated bounce protection.
              </div>

              {/* Customer Selector */}
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Customer / Factory (Received From):</label>
                <div className="flex gap-2">
                  <select
                    value={endorseForm.customerName}
                    onChange={e => setEndorseForm({ ...endorseForm, customerName: e.target.value })}
                    className="flex-1 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-[var(--text)] focus:border-amber-400"
                  >
                    {(state.customerLedgers || []).map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or type name..."
                    value={endorseForm.customerName}
                    onChange={e => setEndorseForm({ ...endorseForm, customerName: e.target.value })}
                    className="flex-1 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-[var(--text)] focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Raw Material Supplier Selector */}
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Raw Material Supplier (Given To):</label>
                <div className="flex gap-2">
                  <select
                    value={endorseForm.supplierName}
                    onChange={e => setEndorseForm({ ...endorseForm, supplierName: e.target.value })}
                    className="flex-1 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-[var(--text)] focus:border-amber-400"
                  >
                    {(state.rawSuppliers || []).map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or type supplier..."
                    value={endorseForm.supplierName}
                    onChange={e => setEndorseForm({ ...endorseForm, supplierName: e.target.value })}
                    className="flex-1 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-[var(--text)] focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Cheque # & Bank */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Cheque Number (#):</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 849102"
                    value={endorseForm.chequeNo}
                    onChange={e => setEndorseForm({ ...endorseForm, chequeNo: e.target.value })}
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 font-mono text-[var(--text)] focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Bank Name:</label>
                  <input
                    type="text"
                    placeholder="e.g. HBL / Meezan"
                    value={endorseForm.bankName}
                    onChange={e => setEndorseForm({ ...endorseForm, bankName: e.target.value })}
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-[var(--text)] focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Amount & Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Cheque Amount (PKR):</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Amount in Rs"
                    value={endorseForm.amount}
                    onChange={e => setEndorseForm({ ...endorseForm, amount: e.target.value })}
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 font-mono text-[var(--text)] focus:border-amber-400 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Clearing / Maturity Date:</label>
                  <input
                    type="date"
                    required
                    value={endorseForm.chequeDate}
                    onChange={e => setEndorseForm({ ...endorseForm, chequeDate: e.target.value })}
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 font-mono text-[var(--text)] focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Memo Notes */}
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Notes / Purpose (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Payment for pipe consignment #44"
                  value={endorseForm.notes}
                  onChange={e => setEndorseForm({ ...endorseForm, notes: e.target.value })}
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-[var(--text)] focus:border-amber-400"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--steel-line)]">
                <button
                  type="button"
                  onClick={() => setIsEndorseModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[var(--yellow)] text-black font-bold uppercase hover:bg-amber-400 shadow-md transition"
                >
                  Confirm & Cross-Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM BOUNCE WITH AUTOMATED CROSS-REVERSAL */}
      {isBounceConfirmModalOpen && selectedChequeForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[var(--panel)] border border-rose-500/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-rose-500/30 bg-rose-950/40 flex items-center gap-2.5 text-rose-300">
              <AlertTriangle size={20} className="text-rose-400 shrink-0" />
              <h3 className="font-serif font-bold text-base text-white">
                Confirm Cheque Bounce & Auto-Reversal
              </h3>
            </div>

            <div className="p-4 space-y-3.5 text-xs text-zinc-300">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Cheque #:</span>
                  <span className="font-bold text-white">#{selectedChequeForAction.chequeNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Amount:</span>
                  <span className="font-bold text-amber-400">{fmt(selectedChequeForAction.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Bank:</span>
                  <span className="text-white">{selectedChequeForAction.bankName || 'Bank'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Payer Party:</span>
                  <span className="text-white">{selectedChequeForAction.payerParty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Payee Party:</span>
                  <span className="text-white">{selectedChequeForAction.payeeParty}</span>
                </div>
              </div>

              <div className="space-y-1.5 leading-relaxed bg-zinc-900/60 p-3 rounded-xl border border-[var(--steel-line)]">
                <div className="font-bold text-amber-400 flex items-center gap-1">
                  <ShieldCheck size={14} />
                  <span>Automated Balance Protection Guarantee:</span>
                </div>
                <p>
                  1. <strong className="text-white">Customer Receivable Restored:</strong> A debit entry will be
                  automatically added to <span className="text-amber-300 font-semibold">{selectedChequeForAction.payerParty}</span>'s
                  ledger so the amount is NOT deducted and remains owed.
                </p>
                {selectedChequeForAction.chequeType === 'endorsed_to_supplier' && (
                  <p>
                    2. <strong className="text-white">Raw Supplier Payable Restored:</strong> A credit entry will be
                    automatically added to <span className="text-sky-300 font-semibold">{selectedChequeForAction.payeeParty}</span>'s
                    ledger so Falcon's liability remains owed to the supplier.
                  </p>
                )}
                <p>
                  3. <strong className="text-white">Urgent Notification:</strong> A high-priority alert will be
                  pinned in the Notifications Hub for immediate follow-up.
                </p>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Dishonour / Return Reason:</label>
                <input
                  type="text"
                  value={bounceReason}
                  onChange={e => setBounceReason(e.target.value)}
                  placeholder="e.g. Insufficient funds / Signature mismatch / Stop payment"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-[var(--text)] focus:border-rose-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--steel-line)]">
                <button
                  type="button"
                  onClick={() => setIsBounceConfirmModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBounce}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase shadow-lg transition cursor-pointer"
                >
                  Apply Auto-Reversals
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW FULL DETAILS & CROSS-CHECK BREAKDOWN */}
      {viewDetailsCheque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-[var(--steel-line)] bg-[var(--panel-raised)]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info size={18} className="text-amber-400" />
                <h3 className="font-serif font-bold text-base text-[var(--text)]">
                  Cheque Audit & Ledger Cross-Check
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewDetailsCheque(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs font-mono">
              {(() => {
                const detailStatusStyle = getChequeStatusStyle(viewDetailsCheque.status);
                return (
                  <div className={`grid grid-cols-2 gap-2.5 p-3.5 rounded-xl border ${detailStatusStyle.cardBg}`}>
                    <div>
                      <span className="text-zinc-400 block">Cheque Number:</span>
                      <span className="font-bold text-amber-400 text-sm">#{viewDetailsCheque.chequeNo}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">Amount:</span>
                      <span className="font-bold text-white text-sm">{fmt(viewDetailsCheque.amount)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">Bank Name:</span>
                      <span className="text-zinc-200">{viewDetailsCheque.bankName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block mb-1">Status:</span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-bold uppercase text-[11px] ${detailStatusStyle.badgeBg}`}
                      >
                        {viewDetailsCheque.status === 'cleared' && <CheckCircle2 size={12} />}
                        {viewDetailsCheque.status === 'presented' && <Clock size={12} />}
                        {viewDetailsCheque.status === 'bounced' && <XCircle size={12} />}
                        {viewDetailsCheque.status === 'overdue' && <AlertTriangle size={12} />}
                        {viewDetailsCheque.status === 'pending' && <Clock size={12} />}
                        <span>{detailStatusStyle.label}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">Maturity Date:</span>
                      <span className="text-zinc-200">{viewDetailsCheque.chequeDate}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">Days Status:</span>
                      <span className={`font-semibold ${detailStatusStyle.textAccent}`}>
                        {viewDetailsCheque.daysRemaining < 0
                          ? `${Math.abs(viewDetailsCheque.daysRemaining)} days overdue`
                          : `${viewDetailsCheque.daysRemaining} days remaining`}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Cross-Link Status */}
              <div className="p-3 rounded-xl bg-zinc-900 border border-[var(--steel-line)] space-y-1.5 font-sans">
                <span className="text-xs font-bold text-zinc-300 block">Cross-Ledger Verification:</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400">Customer Ledger:</span>
                  <span className="font-semibold text-emerald-400">
                    {viewDetailsCheque.customerLedgerName || viewDetailsCheque.payerParty}
                  </span>
                </div>
                {viewDetailsCheque.supplierName && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-400">Raw Supplier Ledger:</span>
                    <span className="font-semibold text-sky-400">
                      {viewDetailsCheque.supplierName}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs mt-2">
                  <span className="text-zinc-400">Reversal Status:</span>
                  <span
                    className={
                      viewDetailsCheque.reversalApplied
                        ? 'px-2 py-0.5 rounded border bg-red-600/30 border-red-400/55 text-red-100 font-bold'
                        : 'px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 border border-slate-600/50'
                    }
                  >
                    {viewDetailsCheque.reversalApplied ? 'Reversal Entry Posted in Ledgers' : 'Not Required / Pending'}
                  </span>
                </div>
              </div>

              {viewDetailsCheque.notes && (
                <div className="p-2.5 rounded-lg bg-[var(--panel-raised)] text-zinc-400 text-xs">
                  <strong className="text-zinc-300">Memo / Details:</strong> {viewDetailsCheque.notes}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setViewDetailsCheque(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CUSTOMER CLEARED VS BOUNCED SUMMARY REPORT (PDF & CSV) */}
      {isSummaryReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[var(--panel)] border border-emerald-500/40 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 border-b border-[var(--steel-line)] bg-[var(--panel-raised)]/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <BarChart3 size={18} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[var(--text)]">
                    Customer Cheque Summary Report — Cleared vs Bounced
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-mono">
                    Compare cleared vs dishonoured cheque volumes by customer over a selected date range
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSummaryReportModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filter & Date Range Controls */}
            <div className="p-4 border-b border-[var(--steel-line)] bg-[var(--panel-raised)]/30 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Date Range Inputs */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">From Date</label>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={e => setReportStartDate(e.target.value)}
                      className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 font-mono text-xs text-[var(--text)] focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">To Date</label>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={e => setReportEndDate(e.target.value)}
                      className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 font-mono text-xs text-[var(--text)] focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Date Basis</label>
                    <select
                      value={reportDateField}
                      onChange={e => setReportDateField(e.target.value as 'chequeDate' | 'issueDate')}
                      className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 font-mono text-xs text-[var(--text)] focus:border-amber-400"
                    >
                      <option value="chequeDate">Maturity / Clearing Date</option>
                      <option value="issueDate">Issue / Ledger Entry Date</option>
                    </select>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-col items-start sm:items-end">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase mb-1">Quick Ranges</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: '30d', label: 'Last 30 Days' },
                      { id: 'thisMonth', label: 'This Month' },
                      { id: '90d', label: 'Last 90 Days' },
                      { id: 'all', label: 'All Time' }
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyReportDatePreset(p.id as any)}
                        className="px-2.5 py-1 rounded-lg bg-[var(--panel-raised)] hover:bg-amber-500 hover:text-black border border-[var(--steel-line)] text-[11px] font-bold transition cursor-pointer"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Aggregate Totals Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 font-mono">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-[10px] text-emerald-300 block uppercase">Total Cleared</span>
                  <div className="font-bold text-sm text-emerald-400 mt-0.5">
                    {fmt(customerSummaryReport.totals.clearedAmount)}
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {customerSummaryReport.totals.clearedCount} cheques cleared
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
                  <span className="text-[10px] text-rose-300 block uppercase">Total Bounced</span>
                  <div className="font-bold text-sm text-rose-400 mt-0.5">
                    {fmt(customerSummaryReport.totals.bouncedAmount)}
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {customerSummaryReport.totals.bouncedCount} cheques dishonoured
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <span className="text-[10px] text-amber-300 block uppercase">Pending / In-Bank</span>
                  <div className="font-bold text-sm text-amber-400 mt-0.5">
                    {fmt(customerSummaryReport.totals.pendingAmount)}
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {customerSummaryReport.totals.pendingCount} awaiting clearance
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)]">
                  <span className="text-[10px] text-zinc-400 block uppercase">Clearance Rate</span>
                  <div className="font-bold text-sm text-[var(--text)] mt-0.5">
                    {(() => {
                      const settled =
                        customerSummaryReport.totals.clearedAmount + customerSummaryReport.totals.bouncedAmount;
                      return settled > 0
                        ? `${Math.round((customerSummaryReport.totals.clearedAmount / settled) * 100)}%`
                        : '—';
                    })()}
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {customerSummaryReport.rows.length} customers in period
                  </span>
                </div>
              </div>
            </div>

            {/* Preview Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {customerSummaryReport.rows.length === 0 ? (
                <div className="py-10 text-center text-zinc-400 font-mono text-xs space-y-1">
                  <Calendar size={28} className="mx-auto text-zinc-600 mb-2" />
                  <div className="font-bold text-zinc-300">No Customer Cheques Found in Selected Range</div>
                  <p className="text-[11px] text-zinc-500">
                    Adjust the start/end date or switch to "All Time" to inspect full customer cheque history.
                  </p>
                </div>
              ) : (
                <div className="border border-[var(--steel-line)] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="bg-[var(--panel-raised)] text-zinc-400 border-b border-[var(--steel-line)] uppercase text-[10px]">
                        <th className="py-2.5 px-3">Customer / Factory</th>
                        <th className="py-2.5 px-3 text-center">Cheques</th>
                        <th className="py-2.5 px-3 text-right text-emerald-400">Cleared (PKR)</th>
                        <th className="py-2.5 px-3 text-right text-rose-400">Bounced (PKR)</th>
                        <th className="py-2.5 px-3 text-right text-amber-300">Pending / Overdue</th>
                        <th className="py-2.5 px-3 text-right">Clearance %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--steel-line)]">
                      {customerSummaryReport.rows.map(r => {
                        const settled = r.clearedAmount + r.bouncedAmount;
                        const clearRate = settled > 0 ? Math.round((r.clearedAmount / settled) * 100) : null;
                        return (
                          <tr key={r.customerName} className="hover:bg-[var(--panel-raised)]/40">
                            <td className="py-2.5 px-3 font-sans font-semibold text-[var(--text)]">
                              {r.customerName}
                            </td>
                            <td className="py-2.5 px-3 text-center text-zinc-300">
                              {r.totalCount}
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                              {fmt(r.clearedAmount)}{' '}
                              <span className="text-[10px] text-zinc-500 font-normal">({r.clearedCount})</span>
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${r.bouncedAmount > 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
                              {fmt(r.bouncedAmount)}{' '}
                              <span className="text-[10px] text-zinc-500 font-normal">({r.bouncedCount})</span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-amber-300">
                              {fmt(r.pendingAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold">
                              {clearRate !== null ? (
                                <span className={clearRate >= 80 ? 'text-emerald-400' : 'text-rose-400'}>
                                  {clearRate}%
                                </span>
                              ) : (
                                <span className="text-zinc-500">Pending</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[var(--panel-raised)] font-bold border-t border-[var(--steel-line)]">
                        <td className="py-2.5 px-3 text-[var(--yellow)]">GRAND TOTAL</td>
                        <td className="py-2.5 px-3 text-center text-white">{customerSummaryReport.totals.totalCount}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-400">
                          {fmt(customerSummaryReport.totals.clearedAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-400">
                          {fmt(customerSummaryReport.totals.bouncedAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-300">
                          {fmt(customerSummaryReport.totals.pendingAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-white">
                          {(() => {
                            const s =
                              customerSummaryReport.totals.clearedAmount + customerSummaryReport.totals.bouncedAmount;
                            return s > 0 ? `${Math.round((customerSummaryReport.totals.clearedAmount / s) * 100)}%` : '—';
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-[var(--steel-line)] bg-[var(--panel-raised)]/60 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-zinc-400">
                Range: {reportStartDate || 'Beginning'} → {reportEndDate || 'Today'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSummaryReportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={customerSummaryReport.rows.length === 0}
                  onClick={handleExportSummaryCSV}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-200 hover:text-white disabled:opacity-40 text-xs font-bold cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  disabled={customerSummaryReport.rows.length === 0}
                  onClick={handleExportSummaryPDF}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-xs font-bold uppercase shadow-md transition cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Download Summary PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
