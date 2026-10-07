import React, { useState } from 'react';
import {
  FileSpreadsheet,
  CheckCircle,
  CreditCard,
  Check,
  Trash2,
  Search,
  Download,
  FileText,
  Printer,
  Image as ImageIcon,
  Eye,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  UploadCloud,
  Lock,
  Truck,
  UserCheck,
  Layers,
  List,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Package,
  DollarSign,
  Building,
  Clock,
  ExternalLink,
  Info
} from 'lucide-react';
import { Transaction, AppLanguage, CustomerPayment, GatePassData, RawSupplier } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, downloadCSV } from '../utils/helpers';
import { openExportModal } from '../utils/exportSettingsHelper';
import { TransactionPdfModal } from './TransactionPdfModal';
import { GatePassUploadModal } from './GatePassUploadModal';
import { GatePassViewerModal } from './GatePassViewerModal';
import { UnifiedGateReceiptsModal } from './UnifiedGateReceiptsModal';
import { OrderDetailsModal } from './OrderDetailsModal';
import { getNextGateSequence } from '../utils/gateSequenceManager';
import { printThermalReceiptDocument, parseTransactionItems } from '../utils/transactionPdf';
import { exportSingleTransactionJPG } from '../utils/exportManager';

interface TransactionsViewProps {
  transactions: Transaction[];
  customerPayments: CustomerPayment[];
  rawSuppliers?: RawSupplier[];
  language: AppLanguage;
  companyName: string;
  onConfirmOrder: (id: string) => void;
  onRecordPayment: (txnId: string, amount: number, method: string, detail: string) => void;
  onAttachGatePass: (id: string, gatePass?: GatePassData) => void;
  onNilOrder: (id: string) => void;
  onDeleteTransaction: (id: string) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  customerPayments,
  rawSuppliers = [],
  language,
  companyName,
  onConfirmOrder,
  onRecordPayment,
  onAttachGatePass,
  onNilOrder,
  onDeleteTransaction
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'awaiting_gp' | 'with_gp' | 'unpaid' | 'paid'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  
  // Modals state
  const [inspectOrderTxn, setInspectOrderTxn] = useState<Transaction | null>(null);
  const [paymentModalTxn, setPaymentModalTxn] = useState<Transaction | null>(null);
  const [selectedPdfTxn, setSelectedPdfTxn] = useState<Transaction | null>(null);
  const [uploadGatePassTxn, setUploadGatePassTxn] = useState<Transaction | null>(null);
  const [viewGatePassTxn, setViewGatePassTxn] = useState<Transaction | null>(null);
  const [isUnifiedReceiptsOpen, setIsUnifiedReceiptsOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payDetail, setPayDetail] = useState('');
  const [exportingJpgId, setExportingJpgId] = useState<string | null>(null);

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const getPaidInfo = (txn: Transaction) => {
    const pays = customerPayments.filter(p => p.txnId === txn.id);
    const amountPaid = pays.reduce((sum, p) => sum + p.amount, 0) + (txn.paid ? txn.total : 0);
    const due = Math.max(0, txn.total - amountPaid);
    const isPaid = due <= 0;
    const isPartial = amountPaid > 0 && due > 0;
    return {
      amountPaid,
      due,
      status: isPaid ? 'Paid' : isPartial ? 'Partial' : 'Unpaid'
    };
  };

  const filteredTxns = transactions.filter(txn => {
    // Search query
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matches =
        txn.id.toLowerCase().includes(q) ||
        (txn.factory && txn.factory.toLowerCase().includes(q)) ||
        txn.itemsSummary.toLowerCase().includes(q) ||
        (txn.sizes && txn.sizes.toLowerCase().includes(q)) ||
        (txn.gateSequenceNo && txn.gateSequenceNo.toLowerCase().includes(q));
      if (!matches) return false;
    }

    // Status filter
    if (statusFilter === 'awaiting_gp') {
      return !txn.receiptUrl;
    }
    if (statusFilter === 'with_gp') {
      return !!txn.receiptUrl;
    }
    if (statusFilter === 'unpaid') {
      const info = getPaidInfo(txn);
      return info.due > 0;
    }
    if (statusFilter === 'paid') {
      const info = getPaidInfo(txn);
      return info.status === 'Paid';
    }

    return true;
  });

  // Summary Metrics
  const totalBookedCount = transactions.length;
  const totalBookedValue = transactions.reduce((sum, t) => sum + t.total, 0);
  const awaitingCount = transactions.filter(t => !t.receiptUrl).length;
  const awaitingValue = transactions.filter(t => !t.receiptUrl).reduce((sum, t) => sum + t.total, 0);
  const verifiedCount = transactions.filter(t => !!t.receiptUrl).length;
  const totalDueValue = transactions.reduce((sum, t) => sum + getPaidInfo(t).due, 0);
  const unpaidCount = transactions.filter(t => getPaidInfo(t).due > 0).length;

  const handleOpenPayModal = (txn: Transaction) => {
    const info = getPaidInfo(txn);
    setPaymentModalTxn(txn);
    setPayAmount(String(info.due));
    setPayMethod('Cash');
    setPayDetail('');
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalTxn) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    onRecordPayment(paymentModalTxn.id, amt, payMethod, payDetail);
    setPaymentModalTxn(null);
  };

  const handleExportCSV = () => {
    const headers = ['Order ID', 'Date', 'Time', 'Customer/Factory', 'Items', 'Total (Rs)', 'Status', 'Due (Rs)', 'Gate Pass'];
    const rows = filteredTxns.map(t => {
      const info = getPaidInfo(t);
      return [
        t.id,
        t.date,
        t.time,
        t.factory || 'Walk-in',
        t.itemsSummary.replace(/\n/g, '; '),
        t.total,
        info.status,
        info.due,
        t.receiptUrl ? 'Verified & In Sales' : 'Awaiting Gate Pass'
      ];
    });
    downloadCSV('Orders_Booked_Ledger', headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['ID', 'Date', 'Factory', 'Items', 'Total', 'Due', 'Gate Pass'];
    const rows = filteredTxns.map(t => {
      const info = getPaidInfo(t);
      return [
        t.id,
        t.date,
        t.factory || 'Walk-in',
        t.itemsSummary.replace(/\n/g, ' '),
        fmt(t.total),
        fmt(info.due),
        t.receiptUrl ? 'Verified' : 'Awaiting'
      ];
    });
    openExportModal({
      title: 'Order Booked Report',
      headers,
      rows,
      filename: 'Order_Booked_Report',
      companyName,
      subtitle: 'Authorized Sales & Order Ledger',
      defaultFormat: 'pdf',
      initialOrientation: 'landscape'
    });
  };

  const handleExportJPG = () => {
    const headers = ['ID', 'Date', 'Factory', 'Items Summary', 'Total (PKR)', 'Due (PKR)', 'Gate Pass'];
    const rows = filteredTxns.map(t => {
      const info = getPaidInfo(t);
      return [
        t.id,
        t.date,
        t.factory || 'Walk-in',
        t.itemsSummary.replace(/\n/g, ' '),
        fmt(t.total),
        fmt(info.due),
        t.receiptUrl ? 'Verified' : 'Awaiting'
      ];
    });
    openExportModal({
      title: 'Order Booked Report',
      headers,
      rows,
      filename: 'Order_Booked_Report',
      companyName,
      subtitle: 'Authorized Sales & Order Ledger',
      defaultFormat: 'jpg',
      initialOrientation: 'landscape'
    });
  };

  const toggleRowExpand = (id: string) => {
    setExpandedRowId(prev => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4 font-mono">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3 font-sans">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif font-black text-xl text-[var(--text)] tracking-tight">
              {t('transactions_title')}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--yellow)]">
              {transactions.length} Total
            </span>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            Industrial Sales Orders, Production Booking & Gate Pass Dispatch Ledger
          </p>
        </div>

        {/* Global Toolbar & Export Controls */}
        <div className="flex items-center gap-2 flex-wrap font-mono">
          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)]">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[var(--yellow)] text-black shadow-xs'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
              title="Clean Structured Table View"
            >
              <List size={13} />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-[var(--yellow)] text-black shadow-xs'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
              title="Visual Cards View"
            >
              <LayoutGrid size={13} />
              <span>Cards</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsUnifiedReceiptsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-xs font-bold text-amber-400 hover:bg-amber-500 hover:text-black transition cursor-pointer shadow-xs"
            title="View Unified Gate Receipts & Sequential Registry"
          >
            <ShieldCheck size={13} />
            <span>Gate Registry</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--yellow)] transition cursor-pointer"
            title="Download CSV Spreadsheet"
          >
            <Download size={13} />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--yellow)] transition cursor-pointer"
            title="Download PDF Ledger"
          >
            <FileText size={13} />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportJPG}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--yellow)] transition cursor-pointer"
            title="Download High-Res JPG"
          >
            <ImageIcon size={13} />
            <span>JPG</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono">
        <div className="p-3 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-[var(--text-dim)]">Total Orders Booked</div>
            <div className="text-base font-bold text-[var(--text)] font-sans mt-0.5">
              {totalBookedCount} <span className="text-xs text-[var(--text-dim)] font-mono">orders</span>
            </div>
            <div className="text-[11px] text-[var(--yellow)] font-bold mt-0.5">{fmt(totalBookedValue)}</div>
          </div>
          <div className="p-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text-dim)]">
            <Package size={18} />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--panel)] border border-amber-500/30 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-amber-400">Awaiting Gate Pass</div>
            <div className="text-base font-bold text-amber-400 font-sans mt-0.5">
              {awaitingCount} <span className="text-xs text-[var(--text-dim)] font-mono">pending</span>
            </div>
            <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{fmt(awaitingValue)}</div>
          </div>
          <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <ShieldAlert size={18} />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--panel)] border border-red-500/30 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-red-400">Outstanding Balance</div>
            <div className="text-base font-bold text-red-400 font-sans mt-0.5">
              {fmt(totalDueValue)}
            </div>
            <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{unpaidCount} orders due</div>
          </div>
          <div className="p-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400">
            <DollarSign size={18} />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--panel)] border border-emerald-500/30 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-emerald-400">Gate Pass Cleared</div>
            <div className="text-base font-bold text-emerald-400 font-sans mt-0.5">
              {verifiedCount} <span className="text-xs text-[var(--text-dim)] font-mono">in sales</span>
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-0.5">Physical receipts verified</div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck size={18} />
          </div>
        </div>
      </div>

      {/* Professional Notification Strip for Pending Gate Passes */}
      {awaitingCount > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs font-sans">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              <Info size={15} />
            </div>
            <div>
              <span className="font-bold text-amber-400">Dispatch Audit Requirement: </span>
              <span className="text-[var(--text)] text-xs">
                {awaitingCount} {awaitingCount === 1 ? 'order requires' : 'orders require'} an uploaded delivery receipt (PDF/JPG) before final confirmation into sales.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'awaiting_gp' ? 'all' : 'awaiting_gp')}
            className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer bg-amber-500 text-black hover:bg-amber-400"
          >
            <span>{statusFilter === 'awaiting_gp' ? 'Show All Orders' : `Filter Pending (${awaitingCount})`}</span>
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        {/* Filter Pills */}
        <div className="flex items-center p-1 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[var(--yellow)] text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            All ({transactions.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('awaiting_gp')}
            className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'awaiting_gp'
                ? 'bg-amber-500 text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <Lock size={11} />
            <span>Awaiting Gate Pass</span>
            {awaitingCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusFilter === 'awaiting_gp' ? 'bg-black text-amber-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {awaitingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('with_gp')}
            className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'with_gp'
                ? 'bg-emerald-500 text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <ShieldCheck size={11} />
            <span>Gate Pass Solved</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              statusFilter === 'with_gp' ? 'bg-black text-emerald-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {verifiedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('unpaid')}
            className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
              statusFilter === 'unpaid'
                ? 'bg-[var(--yellow)] text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            Due / Unpaid ({unpaidCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('paid')}
            className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
              statusFilter === 'paid'
                ? 'bg-emerald-500 text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            Fully Paid
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t('search_orders') || 'Search order #, customer, item...'}
            className="pl-9 pr-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-xs font-mono text-[var(--text)] focus:border-[var(--yellow)] focus:outline-none w-56 sm:w-72"
          />
        </div>
      </div>

      {/* Main List / Table Content */}
      {filteredTxns.length === 0 ? (
        <div className="p-10 text-center text-[var(--text-dim)] bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl text-xs space-y-2">
          <Package size={28} className="mx-auto text-[var(--text-dim)] opacity-50 mb-1" />
          <div className="font-bold text-[var(--text)]">{t('no_orders_found')}</div>
          <div className="text-[11px]">No orders match the current search query or filter selection.</div>
        </div>
      ) : viewMode === 'table' ? (
        /* ==================== CLEAN STRUCTURED TABLE VIEW ==================== */
        <div className="rounded-xl border border-[var(--steel-line)] overflow-hidden bg-[var(--panel)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-[var(--steel-line)] font-mono">
              <thead className="bg-[var(--panel-raised)] text-[10px] uppercase font-bold text-[var(--text-dim)] tracking-wider">
                <tr>
                  <th className="px-3 py-3 w-8 text-center"></th>
                  <th className="px-3 py-3">Order ID</th>
                  <th className="px-3 py-3">Date & Time</th>
                  <th className="px-3 py-3">Customer / Workshop</th>
                  <th className="px-3 py-3">Items Booked</th>
                  <th className="px-3 py-3 text-right">Total Amount</th>
                  <th className="px-3 py-3 text-center">Payment</th>
                  <th className="px-3 py-3 text-center">Gate Pass</th>
                  <th className="px-3 py-3 text-right">Actions & Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--steel-line)]/60">
                {filteredTxns.map(txn => {
                  const info = getPaidInfo(txn);
                  const isDelivered = !!txn.receiptUrl;
                  const isPdf =
                    txn.gatePass?.fileType === 'pdf' ||
                    txn.receiptUrl?.startsWith('data:application/pdf') ||
                    txn.gatePass?.fileName?.toLowerCase().endsWith('.pdf');
                  const isExpanded = expandedRowId === txn.id;
                  const parsedItems = parseTransactionItems(txn);

                  return (
                    <React.Fragment key={txn.id}>
                      <tr className={`hover:bg-[var(--panel-raised)]/70 transition ${
                        isExpanded ? 'bg-[var(--panel-raised)]/50' : ''
                      }`}>
                        {/* Expand toggle */}
                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleRowExpand(txn.id)}
                            className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer"
                            title="Toggle quick item breakdown"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>

                        {/* Order ID */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setInspectOrderTxn(txn)}
                            className="font-bold text-[var(--yellow)] hover:underline flex items-center gap-1 cursor-pointer"
                            title="Click to check all details"
                          >
                            <span>#{txn.id}</span>
                            {txn.confirmed && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Confirmed in sales" />
                            )}
                          </button>
                        </td>

                        {/* Date & Time */}
                        <td className="px-3 py-3 whitespace-nowrap text-[var(--text-dim)] text-[11px]">
                          <div>{txn.date}</div>
                          <div className="text-[10px] opacity-75">{txn.time}</div>
                        </td>

                        {/* Customer / Workshop */}
                        <td className="px-3 py-3">
                          <div className="font-bold text-[var(--text)] font-sans flex items-center gap-1.5">
                            <span className="truncate max-w-[180px]">{txn.factory || 'Walk-in Customer'}</span>
                          </div>
                          {(() => {
                            const specChips = [
                              txn.sizes?.split(/[,;]/).map(s => s.trim()).filter(s => s && s !== '-' && s !== '—').join(', '),
                              txn.colors?.split(/[,;]/).map(s => s.trim()).filter(s => s && s !== '-' && s !== '—').join(', ')
                            ].filter(Boolean);
                            return specChips.length > 0 ? (
                              <div className="text-[10px] text-[var(--text-dim)] truncate max-w-[200px]">
                                {specChips.join(' · ')}
                              </div>
                            ) : null;
                          })()}
                        </td>

                        {/* Items Booked */}
                        <td className="px-3 py-3">
                          <div className="font-semibold text-[var(--text)] font-sans line-clamp-1 max-w-[220px]">
                            {txn.itemsSummary}
                          </div>
                          <div className="text-[10px] text-[var(--text-dim)]">
                            {parsedItems.length} {parsedItems.length === 1 ? 'item' : 'items'} ({txn.itemCount || 1} pcs)
                          </div>
                        </td>

                        {/* Total Amount */}
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="font-bold text-[var(--yellow)]">{fmt(txn.total)}</div>
                          {info.due > 0 && (
                            <div className="text-[10px] text-red-400 font-bold">Due: {fmt(info.due)}</div>
                          )}
                        </td>

                        {/* Payment Status */}
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            info.status === 'Paid'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : info.status === 'Partial'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-red-500/15 text-red-400 border border-red-500/30'
                          }`}>
                            {info.status}
                          </span>
                        </td>

                        {/* Gate Pass Status */}
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {isDelivered ? (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <ShieldCheck size={11} strokeWidth={2.5} />
                              <span>{txn.gateSequenceNo || txn.gatePass?.gateSequenceNo || 'Verified'}</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <Lock size={10} />
                              <span>Awaiting Pass</span>
                            </span>
                          )}
                        </td>

                        {/* Actions & Dossier */}
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Primary workflow button */}
                            {!isDelivered ? (
                              <button
                                type="button"
                                onClick={() => setUploadGatePassTxn(txn)}
                                className="px-2.5 py-1 rounded bg-amber-500 text-black font-bold text-[10px] uppercase hover:bg-amber-400 transition cursor-pointer flex items-center gap-1 shadow-xs"
                                title="Upload Gate Pass receipt"
                              >
                                <UploadCloud size={11} strokeWidth={2.5} />
                                <span>Pass</span>
                              </button>
                            ) : !txn.confirmed ? (
                              <button
                                type="button"
                                onClick={() => onConfirmOrder(txn.id)}
                                className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold text-[10px] uppercase hover:bg-emerald-500 hover:text-black transition cursor-pointer flex items-center gap-1"
                                title="Confirm into sales ledger"
                              >
                                <Check size={11} strokeWidth={2.5} />
                                <span>Confirm</span>
                              </button>
                            ) : null}

                            {/* Pay button if due */}
                            {info.due > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenPayModal(txn)}
                                className="px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] uppercase hover:bg-emerald-500 hover:text-black transition cursor-pointer flex items-center gap-1"
                                title={`Record Payment (Due: ${fmt(info.due)})`}
                              >
                                <CreditCard size={11} />
                                <span>Pay</span>
                              </button>
                            )}

                            {/* Check All Details button */}
                            <button
                              type="button"
                              onClick={() => setInspectOrderTxn(txn)}
                              className="px-2 py-1 rounded bg-[var(--yellow)]/15 border border-[var(--yellow)] text-[var(--yellow)] font-bold text-[10px] uppercase hover:bg-[var(--yellow)] hover:text-black transition cursor-pointer flex items-center gap-1"
                              title="Check complete order details dossier"
                            >
                              <Eye size={11} />
                              <span>Details</span>
                            </button>

                            {/* Print / Export Icons Group */}
                            <div className="flex items-center border border-[var(--steel-line)] rounded bg-[var(--panel-raised)] overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setSelectedPdfTxn(txn)}
                                className="p-1 hover:bg-[var(--panel)] text-[var(--text-dim)] hover:text-[var(--text)] transition"
                                title="Invoice PDF"
                              >
                                <FileText size={11} />
                              </button>
                              <button
                                type="button"
                                disabled={exportingJpgId === txn.id}
                                onClick={async () => {
                                  try {
                                    setExportingJpgId(txn.id);
                                    await exportSingleTransactionJPG({
                                      transaction: txn,
                                      customerPayments,
                                      companyName
                                    });
                                  } catch (err) {
                                    console.error('Failed to export JPG invoice', err);
                                  } finally {
                                    setExportingJpgId(null);
                                  }
                                }}
                                className="p-1 hover:bg-[var(--panel)] text-[var(--text-dim)] hover:text-[var(--text)] transition disabled:opacity-50"
                                title="Invoice JPG"
                              >
                                <ImageIcon size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => printThermalReceiptDocument({ transaction: txn, customerPayments, companyName })}
                                className="p-1 hover:bg-[var(--panel)] text-[var(--text-dim)] hover:text-[var(--text)] transition"
                                title="Thermal Print"
                              >
                                <Printer size={11} />
                              </button>
                            </div>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => onDeleteTransaction(txn.id)}
                              className="p-1 rounded text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 transition"
                              title="Delete transaction"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Row Content: Quick breakdown */}
                      {isExpanded && (
                        <tr className="bg-[var(--panel-raised)]/40">
                          <td colSpan={9} className="px-6 py-4 border-b border-[var(--steel-line)]">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-[var(--steel-line)]/50 pb-2">
                                <span className="font-bold text-xs uppercase text-[var(--text)] flex items-center gap-2">
                                  <Package size={13} className="text-[var(--yellow)]" />
                                  <span>Order #{txn.id} — Full Items Breakdown</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setInspectOrderTxn(txn)}
                                  className="text-xs font-bold text-[var(--yellow)] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Open Comprehensive Dossier</span>
                                  <ExternalLink size={12} />
                                </button>
                              </div>

                              {/* Nested items table */}
                              <div className="rounded-lg border border-[var(--steel-line)] bg-[var(--panel)] overflow-hidden">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-[var(--panel-raised)] text-[10px] uppercase text-[var(--text-dim)] border-b border-[var(--steel-line)]">
                                    <tr>
                                      <th className="px-3 py-1.5">Item</th>
                                      <th className="px-3 py-1.5">Specs (Size / Color)</th>
                                      <th className="px-3 py-1.5 text-right">Quantity</th>
                                      <th className="px-3 py-1.5 text-right">Rate</th>
                                      <th className="px-3 py-1.5 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[var(--steel-line)]/40">
                                    {parsedItems.map((it, idx) => (
                                      <tr key={idx}>
                                        <td className="px-3 py-1.5 font-bold text-[var(--text)] font-sans">
                                          <div>{it.name}</div>
                                          {(it.batchId || it.trackingNumber) && (
                                            <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-mono font-normal">
                                              {it.batchId && (
                                                <span className="px-1 py-0.2 rounded bg-[var(--yellow)]/10 text-[var(--yellow)] border border-[var(--yellow)]/20">
                                                  Batch: {it.batchId}
                                                </span>
                                              )}
                                              {it.trackingNumber && (
                                                <span className="px-1 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                                  Trk: {it.trackingNumber}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-3 py-1.5 text-[var(--text-dim)]">
                                          {[it.size || txn.sizes, it.color || txn.colors].filter(Boolean).join(' · ') || '—'}
                                        </td>
                                        <td className="px-3 py-1.5 text-right text-[var(--text)]">{it.qty} pcs</td>
                                        <td className="px-3 py-1.5 text-right text-[var(--text-dim)]">{fmt(it.rate)}</td>
                                        <td className="px-3 py-1.5 text-right font-bold text-[var(--yellow)]">{fmt(it.total)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* Footer details row */}
                              <div className="flex flex-wrap items-center justify-between text-[11px] text-[var(--text-dim)] pt-1">
                                <div className="flex items-center gap-3">
                                  <span>Customer: <strong className="text-[var(--text)]">{txn.factory || 'Walk-in'}</strong></span>
                                  <span>·</span>
                                  <span>Total Paid: <strong className="text-emerald-400">{fmt(info.amountPaid)}</strong></span>
                                  <span>·</span>
                                  <span>Due: <strong className={info.due > 0 ? 'text-red-400' : 'text-emerald-400'}>{fmt(info.due)}</strong></span>
                                </div>
                                {isDelivered && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-emerald-400 font-bold">Gate Pass: {txn.gateSequenceNo || 'Verified'}</span>
                                    <button
                                      type="button"
                                      onClick={() => setViewGatePassTxn(txn)}
                                      className="text-[10px] text-[var(--yellow)] underline hover:opacity-80 cursor-pointer"
                                    >
                                      View Document
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ==================== REFINED VISUAL CARDS VIEW ==================== */
        <div className="space-y-3 font-mono">
          {filteredTxns.map(txn => {
            const info = getPaidInfo(txn);
            const isDelivered = !!txn.receiptUrl;
            const isPdf =
              txn.gatePass?.fileType === 'pdf' ||
              txn.receiptUrl?.startsWith('data:application/pdf') ||
              txn.gatePass?.fileName?.toLowerCase().endsWith('.pdf');
            const parsedItems = parseTransactionItems(txn);

            return (
              <div
                key={txn.id}
                id={`txn-card-${txn.id}`}
                className={`p-4 rounded-xl transition space-y-3 text-xs bg-[var(--panel)] border ${
                  !isDelivered
                    ? 'border-amber-500/40 hover:border-amber-400/80 shadow-xs'
                    : 'border-[var(--steel-line)] hover:border-[var(--yellow)]'
                }`}
              >
                {/* Card Top Row: Order ID, Date, Status Chips */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--steel-line)]/60 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setInspectOrderTxn(txn)}
                      className="font-black text-base text-[var(--yellow)] hover:underline cursor-pointer flex items-center gap-1"
                      title="Inspect complete order details"
                    >
                      <span>#{txn.id}</span>
                    </button>
                    <span className="text-[var(--text-dim)] text-[11px] flex items-center gap-1.5">
                      <Clock size={11} />
                      <span>{txn.date} · {txn.time}</span>
                    </span>
                    {txn.confirmed ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <Check size={10} strokeWidth={2.5} /> In Sales
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Pending
                      </span>
                    )}
                  </div>

                  {/* Dispatch / Gate Pass Status Pill */}
                  <div>
                    {isDelivered ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-bold uppercase text-[10px] tracking-wider bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                          <ShieldCheck size={11} strokeWidth={2.5} />
                          <span>{txn.gateSequenceNo || txn.gatePass?.gateSequenceNo || 'Gate Pass Verified'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setViewGatePassTxn(txn)}
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border bg-[var(--panel-raised)] text-[var(--text)] hover:border-[var(--yellow)] transition cursor-pointer"
                          title="View attached gate pass"
                        >
                          {isPdf ? 'PDF' : 'JPG'}
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-400 font-bold uppercase text-[10px] tracking-wider bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                        <Lock size={10} />
                        <span>Awaiting Gate Pass</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Middle: Customer, Items Summary, Pricing */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  {/* Left: Customer & Items */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[var(--text)] font-sans">
                        {txn.factory || 'Walk-in Customer'}
                      </span>
                      {txn.factory && (
                        <span className="px-2 py-0.2 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--yellow)] text-[10px] font-bold">
                          Workshop
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text)] font-sans">
                      {txn.itemsSummary}
                    </div>
                    <div className="text-[11px] text-[var(--text-dim)] flex items-center gap-2 flex-wrap">
                      <span>{parsedItems.length} items ({txn.itemCount || 1} pcs)</span>
                      {(() => {
                        const cleanSizes = txn.sizes?.split(/[,;]/).map(s => s.trim()).filter(s => s && s !== '-' && s !== '—').join(', ');
                        const cleanColors = txn.colors?.split(/[,;]/).map(s => s.trim()).filter(s => s && s !== '-' && s !== '—').join(', ');
                        const specChips = [cleanSizes && `Size: ${cleanSizes}`, cleanColors && `Color: ${cleanColors}`].filter(Boolean);
                        return specChips.length > 0 ? (
                          <>
                            <span>·</span>
                            <span>{specChips.join('  |  ')}</span>
                          </>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* Right: Total & Balance Due */}
                  <div className="text-left md:text-right shrink-0">
                    <div className="font-black text-lg text-[var(--yellow)]">{fmt(txn.total)}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5">
                      {info.status === 'Paid' ? (
                        <span className="text-emerald-400">Paid in Full</span>
                      ) : info.status === 'Partial' ? (
                        <span className="text-amber-400">Partial · Due: {fmt(info.due)}</span>
                      ) : (
                        <span className="text-red-400">Unpaid · Due: {fmt(info.due)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Clean Structured Actions Group */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--steel-line)]/50">
                  {/* Left: Check Details Button */}
                  <button
                    type="button"
                    onClick={() => setInspectOrderTxn(txn)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--yellow)]/15 border border-[var(--yellow)] text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-black font-bold text-xs uppercase transition cursor-pointer"
                  >
                    <Eye size={13} />
                    <span>Check All Details</span>
                  </button>

                  {/* Right: Operational Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Gate Pass action */}
                    {!isDelivered ? (
                      <button
                        type="button"
                        onClick={() => setUploadGatePassTxn(txn)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 text-black font-black text-[10px] uppercase hover:bg-amber-400 transition cursor-pointer shadow-xs"
                        title="Upload Gate Pass receipt"
                      >
                        <UploadCloud size={12} strokeWidth={2.5} />
                        <span>Upload Pass</span>
                      </button>
                    ) : !txn.confirmed ? (
                      <button
                        type="button"
                        onClick={() => onConfirmOrder(txn.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500 font-bold text-[10px] uppercase hover:bg-emerald-500 hover:text-black transition cursor-pointer"
                      >
                        <Check size={11} strokeWidth={2.5} />
                        <span>Confirm Order</span>
                      </button>
                    ) : null}

                    {/* Pay button */}
                    {info.due > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenPayModal(txn)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500 text-emerald-400 font-bold text-[10px] uppercase hover:bg-emerald-500 hover:text-black transition cursor-pointer"
                      >
                        <CreditCard size={11} />
                        <span>Pay</span>
                      </button>
                    )}

                    {/* Docs Group */}
                    <div className="flex items-center border border-[var(--steel-line)] rounded-lg bg-[var(--panel-raised)] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setSelectedPdfTxn(txn)}
                        className="px-2 py-1.5 text-[10px] font-bold text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition flex items-center gap-1"
                        title="Invoice PDF"
                      >
                        <FileText size={11} />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        disabled={exportingJpgId === txn.id}
                        onClick={async () => {
                          try {
                            setExportingJpgId(txn.id);
                            await exportSingleTransactionJPG({
                              transaction: txn,
                              customerPayments,
                              companyName
                            });
                          } catch (err) {
                            console.error('Failed to export JPG invoice', err);
                          } finally {
                            setExportingJpgId(null);
                          }
                        }}
                        className="px-2 py-1.5 text-[10px] font-bold text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition flex items-center gap-1 disabled:opacity-50"
                        title="Invoice JPG"
                      >
                        <ImageIcon size={11} />
                        <span>JPG</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => printThermalReceiptDocument({ transaction: txn, customerPayments, companyName })}
                        className="p-1.5 text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition"
                        title="Thermal Print"
                      >
                        <Printer size={12} />
                      </button>
                    </div>

                    {/* Nil button if due */}
                    {info.due > 0 && (
                      <button
                        type="button"
                        onClick={() => onNilOrder(txn.id)}
                        className="px-2 py-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-red-400 text-[10px] font-bold uppercase transition"
                        title="Write off balance"
                      >
                        Nil
                      </button>
                    )}

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => onDeleteTransaction(txn.id)}
                      className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-red-400 hover:border-red-400 transition"
                      title="Delete order"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* COMPREHENSIVE ORDER DETAILS MODAL (Check all details) */}
      {inspectOrderTxn && (
        <OrderDetailsModal
          transaction={inspectOrderTxn}
          customerPayments={customerPayments}
          language={language}
          companyName={companyName}
          onClose={() => setInspectOrderTxn(null)}
          onOpenPayModal={txn => {
            setInspectOrderTxn(null);
            handleOpenPayModal(txn);
          }}
          onOpenGatePassUpload={txn => {
            setInspectOrderTxn(null);
            setUploadGatePassTxn(txn);
          }}
          onOpenGatePassView={txn => {
            setViewGatePassTxn(txn);
          }}
          onOpenInvoicePdf={txn => {
            setInspectOrderTxn(null);
            setSelectedPdfTxn(txn);
          }}
          onConfirmOrder={id => {
            onConfirmOrder(id);
            setInspectOrderTxn(prev => (prev?.id === id ? { ...prev, confirmed: true } : prev));
          }}
          onNilOrder={id => {
            onNilOrder(id);
            setInspectOrderTxn(prev => (prev?.id === id ? { ...prev, paid: true } : prev));
          }}
        />
      )}

      {/* Record Payment Modal */}
      {paymentModalTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-sm bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-1 font-sans">
              {t('record_payment')} #{paymentModalTxn.id}
            </h3>
            <p className="text-xs text-[var(--text-dim)] mb-3">
              {paymentModalTxn.factory || 'Walk-in'} · {paymentModalTxn.itemsSummary}
            </p>

            <form onSubmit={handleSavePayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--text-dim)] uppercase mb-1">{t('amount_pkr')}</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--yellow)]"
                />
              </div>

              <div>
                <label className="block text-[var(--text-dim)] uppercase mb-1">{t('payment_method')}</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="Online">Online / Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-[var(--text-dim)] uppercase mb-1">Payment Reference / Note</label>
                <input
                  type="text"
                  value={payDetail}
                  onChange={e => setPayDetail(e.target.value)}
                  placeholder="e.g. Received at shop / Online slip #3819"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPaymentModalTxn(null)}
                  className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)] cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase shadow cursor-pointer"
                >
                  {t('record_payment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction PDF & Formatted Invoice Modal */}
      {selectedPdfTxn && (
        <TransactionPdfModal
          transaction={selectedPdfTxn}
          customerPayments={customerPayments}
          companyName={companyName}
          language={language}
          onClose={() => setSelectedPdfTxn(null)}
          onRecordPayment={txn => {
            handleOpenPayModal(txn);
          }}
        />
      )}

      {/* Strict Gate Pass Upload Modal */}
      {uploadGatePassTxn && (
        <GatePassUploadModal
          transaction={uploadGatePassTxn}
          language={language}
          companyName={companyName}
          nextGateSequence={getNextGateSequence(transactions, rawSuppliers)}
          onClose={() => setUploadGatePassTxn(null)}
          onConfirmUpload={(id, gp) => {
            onAttachGatePass(id, gp);
            setUploadGatePassTxn(null);
          }}
        />
      )}

      {/* Gate Pass Document Viewer Modal */}
      {viewGatePassTxn && (
        <GatePassViewerModal
          transaction={viewGatePassTxn}
          onClose={() => setViewGatePassTxn(null)}
        />
      )}

      {/* Unified Gate Receipts Registry Modal */}
      {isUnifiedReceiptsOpen && (
        <UnifiedGateReceiptsModal
          transactions={transactions}
          rawSuppliers={rawSuppliers}
          language={language}
          companyName={companyName}
          onClose={() => setIsUnifiedReceiptsOpen(false)}
          onOpenGatePassUploadForTxn={txn => {
            setIsUnifiedReceiptsOpen(false);
            setUploadGatePassTxn(txn);
          }}
        />
      )}
    </div>
  );
};
