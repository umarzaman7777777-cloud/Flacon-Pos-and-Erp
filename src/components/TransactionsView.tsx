import React, { useState } from 'react';
import {
  FileSpreadsheet,
  CheckCircle,
  CreditCard,
  Paperclip,
  Check,
  Edit2,
  Trash2,
  Search,
  Download,
  Percent,
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
  Layers
} from 'lucide-react';
import { Transaction, AppLanguage, CustomerPayment, GatePassData, RawSupplier } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, downloadCSV, exportTablePDF, exportTableJPG, amountInWordsEnglish, amountInWordsUrdu } from '../utils/helpers';
import { openExportModal } from '../utils/exportSettingsHelper';
import { TransactionPdfModal } from './TransactionPdfModal';
import { GatePassUploadModal } from './GatePassUploadModal';
import { GatePassViewerModal } from './GatePassViewerModal';
import { UnifiedGateReceiptsModal } from './UnifiedGateReceiptsModal';
import { getNextGateSequence } from '../utils/gateSequenceManager';
import {
  exportSingleTransactionPDF,
  printStyledTransactionDocument,
  printThermalReceiptDocument
} from '../utils/transactionPdf';
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'awaiting_gp' | 'with_gp' | 'unpaid'>('all');
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
        txn.itemsSummary.toLowerCase().includes(q);
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

    return true;
  });

  const awaitingCount = transactions.filter(t => !t.receiptUrl).length;
  const verifiedCount = transactions.filter(t => !!t.receiptUrl).length;

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

  return (
    <div className="space-y-4 font-mono">
      {/* Header with Search and Exports */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3 font-sans">
        <div>
          <h2 className="font-serif font-black text-xl text-[var(--text)]">{t('transactions_title')}</h2>
          <p className="text-xs text-[var(--text-dim)]">{t('transactions_sub')}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t('search_orders')}
              className="pl-9 pr-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-xs font-mono text-[var(--text)] focus:border-[var(--yellow)] focus:outline-none w-48 sm:w-60"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsUnifiedReceiptsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/50 text-xs font-mono font-bold text-amber-400 hover:bg-amber-500 hover:text-black transition cursor-pointer shadow-xs"
            title="View Unified Gate Receipts & Sequential Registry"
          >
            <ShieldCheck size={13} />
            <span>Gate Registry</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-mono font-semibold text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--yellow)] transition"
          >
            <Download size={13} />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-mono font-semibold text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--yellow)] transition"
          >
            <FileText size={13} />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExportJPG}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-mono font-semibold text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--yellow)] transition"
          >
            <ImageIcon size={13} />
            <span>JPG</span>
          </button>
        </div>
      </div>

      {/* Strict Gate Pass Requirement Banner if there are pending orders */}
      {awaitingCount > 0 && (
        <div
          id="gatepass-mandatory-warning-banner"
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border-2 border-amber-500/50 shadow-md font-sans"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle size={18} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs uppercase tracking-wider text-amber-400">
                  Strict Rule: Gate Pass Mandatory
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-black">
                  {awaitingCount} {awaitingCount === 1 ? 'Order Pending' : 'Orders Pending'}
                </span>
              </div>
              <p className="text-xs text-[var(--text)] mt-0.5 leading-relaxed">
                Orders booked cannot be transferred to final sales without an uploaded & verified Gate Pass delivery receipt (PDF or JPG).
              </p>
            </div>
          </div>
          <button
            type="button"
            id="filter-pending-gatepass-banner-btn"
            onClick={() => setStatusFilter('awaiting_gp')}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'awaiting_gp'
                ? 'bg-amber-500 text-black'
                : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-black border border-amber-500/40'
            }`}
          >
            <ShieldAlert size={13} />
            <span>Filter Pending Orders</span>
          </button>
        </div>
      )}

      {/* Filter Tabs Bar */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <div className="flex items-center p-1 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
          <button
            type="button"
            id="txn-filter-all"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg font-bold transition ${
              statusFilter === 'all'
                ? 'bg-[var(--yellow)] text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            All ({transactions.length})
          </button>

          <button
            type="button"
            id="txn-filter-awaiting-gp"
            onClick={() => setStatusFilter('awaiting_gp')}
            className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
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
            id="txn-filter-with-gp"
            onClick={() => setStatusFilter('with_gp')}
            className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
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
            id="txn-filter-unpaid"
            onClick={() => setStatusFilter('unpaid')}
            className={`px-3 py-1 rounded-lg font-bold transition ${
              statusFilter === 'unpaid'
                ? 'bg-[var(--yellow)] text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            Due / Unpaid
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-3 font-mono">
        {filteredTxns.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-dim)] bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl text-xs">
            {t('no_orders_found')}
          </div>
        ) : (
          filteredTxns.map(txn => {
            const info = getPaidInfo(txn);
            const isDelivered = !!txn.receiptUrl;
            const isPdf =
              txn.gatePass?.fileType === 'pdf' ||
              txn.receiptUrl?.startsWith('data:application/pdf') ||
              txn.gatePass?.fileName?.toLowerCase().endsWith('.pdf');

            return (
              <div
                key={txn.id}
                id={`txn-card-${txn.id}`}
                className={`p-4 rounded-xl transition space-y-3 text-xs relative ${
                  !isDelivered
                    ? 'bg-amber-950/20 border-2 border-amber-500/60 shadow-lg shadow-amber-500/5 hover:border-amber-400'
                    : 'bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)]'
                }`}
              >
                {/* Warning header strip for transactions lacking Gate Pass */}
                {!isDelivered && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3.5 py-2 rounded-lg bg-amber-500/25 border-2 border-amber-500 text-amber-300 font-sans shadow-md">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-amber-500 text-black font-black text-[10px] flex items-center gap-1 uppercase tracking-wider animate-pulse">
                        <AlertTriangle size={12} strokeWidth={3} />
                        <span>Strict Gate Rule</span>
                      </span>
                      <span className="font-black text-xs text-amber-200 tracking-wide">
                        Gate Pass Mandatory · Physical receipt (PDF/JPG) must be uploaded before moving into sales
                      </span>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-amber-500 text-black px-2.5 py-1 rounded shadow-xs shrink-0">
                      Upload Required
                    </span>
                  </div>
                )}

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  {/* Order ID & Timing */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedPdfTxn(txn)}
                      title="Open full invoice"
                      className="font-black text-base text-[var(--yellow)] hover:underline cursor-pointer"
                    >
                      #{txn.id}
                    </button>
                    <div>
                      <div className="text-[var(--text-dim)] text-[11px]">{txn.date} · {txn.time}</div>
                      {isDelivered ? (
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-amber-400 font-mono font-bold uppercase text-[10px] tracking-wider bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                            {txn.gateSequenceNo || txn.gatePass?.gateSequenceNo || 'GATE-SEQ'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold uppercase text-[10px] tracking-wider bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">
                            <ShieldCheck size={11} strokeWidth={2.5} /> In Sales · Gate Pass Verified
                          </span>
                          <span className="text-[10px] text-[var(--text-dim)] font-mono flex items-center gap-1">
                            <UserCheck size={11} className="text-emerald-400 shrink-0" />
                            <span>Received by: <strong className="text-[var(--text)]">{txn.gateReceivedBy || txn.gatePass?.receivedBy || 'Gate Officer: Verified'}</strong></span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setViewGatePassTxn(txn)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border hover:opacity-80 transition cursor-pointer flex items-center gap-1 ${
                              isPdf
                                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}
                            title="Click to view Gate Pass file"
                          >
                            <Eye size={10} />
                            <span>{isPdf ? 'PDF' : 'JPG'}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 text-black font-black uppercase text-[10px] tracking-wider bg-amber-500 px-2.5 py-0.5 rounded shadow-sm animate-pulse border border-amber-400">
                            <AlertTriangle size={11} strokeWidth={3} /> GATE PASS PENDING
                          </span>
                          <span className="text-[10px] text-amber-300 font-mono font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                            Strict Rule: Cannot enter sales without Gate Pass
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items & Customer */}
                  <div className="flex-1 min-w-0 px-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[var(--text)] font-sans">{txn.itemsSummary}</span>
                      {txn.factory && (
                        <span className="px-2 py-0.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--yellow)] text-[11px] font-bold">
                          {txn.factory}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--text-dim)] mt-1">
                      {[txn.sizes && `Size: ${txn.sizes}`, txn.colors && `Color: ${txn.colors}`]
                        .filter(Boolean)
                        .join('  |  ')}
                    </div>
                  </div>

                  {/* Price and Status */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="font-bold text-base text-[var(--yellow)]">{fmt(txn.total)}</div>
                      <div
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          info.status === 'Paid'
                            ? 'text-[var(--green)]'
                            : info.status === 'Partial'
                            ? 'text-amber-400'
                            : 'text-[var(--red)]'
                        }`}
                      >
                        {info.status === 'Paid'
                          ? t('paid')
                          : info.status === 'Partial'
                          ? `${t('partial')} (Due: ${fmt(info.due)})`
                          : `${t('unpaid')} (${fmt(info.due)})`}
                      </div>
                    </div>

                    {/* Actions family */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSelectedPdfTxn(txn)}
                        title="Export Formatted PDF Invoice"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--yellow)]/15 border border-[var(--yellow)] text-[var(--yellow)] font-bold text-[10px] uppercase hover:bg-[var(--yellow)] hover:text-[var(--canvas)] transition cursor-pointer"
                      >
                        <FileText size={11} />
                        <span>Invoice PDF</span>
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
                        title="Export High-Resolution Graphical JPG Invoice"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 font-bold text-[10px] uppercase hover:bg-amber-500 hover:text-black transition cursor-pointer disabled:opacity-50"
                      >
                        <ImageIcon size={11} />
                        <span>{exportingJpgId === txn.id ? 'Saving...' : 'Invoice JPG'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => printThermalReceiptDocument({ transaction: txn, customerPayments, companyName })}
                        title="Trigger browser print formatted for thermal receipt printers"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text)] font-bold text-[10px] uppercase hover:border-[var(--yellow)] hover:text-[var(--yellow)] transition cursor-pointer"
                      >
                        <Printer size={11} />
                        <span>Thermal</span>
                      </button>

                      {!txn.confirmed && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!isDelivered) {
                              setUploadGatePassTxn(txn);
                            } else {
                              onConfirmOrder(txn.id);
                            }
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-bold text-[10px] uppercase transition cursor-pointer ${
                            isDelivered
                              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 hover:bg-emerald-500/25'
                              : 'bg-amber-500/20 border-amber-500/60 text-amber-300 hover:bg-amber-500 hover:text-black shadow-xs'
                          }`}
                          title={
                            isDelivered
                              ? 'Confirm order in sales'
                              : 'Strict Rule: Physical Gate Pass required before confirming into sales'
                          }
                        >
                          {isDelivered ? <Check size={11} /> : <Lock size={11} className="text-amber-400" />}
                          <span>{isDelivered ? 'Confirm' : 'Pass Required'}</span>
                        </button>
                      )}

                      {info.due > 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenPayModal(txn)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--yellow)]/15 border border-[var(--yellow)] text-[var(--yellow)] font-bold text-[10px] uppercase hover:bg-[var(--yellow)]/25 transition"
                        >
                          <CreditCard size={11} />
                          <span>Pay</span>
                        </button>
                      )}

                      {/* STRICT GATE PASS ACTION: Upload if awaiting, or View if already uploaded */}
                      {!isDelivered ? (
                        <button
                          type="button"
                          id={`txn-gatepass-upload-btn-${txn.id}`}
                          onClick={() => setUploadGatePassTxn(txn)}
                          title="Mandatory: Upload Gate Pass (PDF/JPG) to solve this order and record into sales"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-black font-black text-[10px] uppercase hover:bg-amber-400 transition cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
                        >
                          <UploadCloud size={13} strokeWidth={2.5} />
                          <span>Upload Gate Pass</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          id={`txn-gatepass-view-btn-${txn.id}`}
                          onClick={() => setViewGatePassTxn(txn)}
                          title="View attached Gate Pass receipt"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500 text-emerald-400 font-bold text-[10px] uppercase hover:bg-emerald-500/25 transition cursor-pointer"
                        >
                          <Eye size={12} />
                          <span>View Gate Pass</span>
                        </button>
                      )}

                      {info.due > 0 && (
                        <button
                          type="button"
                          onClick={() => onNilOrder(txn.id)}
                          title="Write off balance"
                          className="px-2 py-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-red-400 text-[10px] font-bold uppercase transition"
                        >
                          Nil
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(txn.id)}
                        className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-red-400 hover:border-red-400 transition"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

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
                  className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase shadow"
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
