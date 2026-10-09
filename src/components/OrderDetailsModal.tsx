import React, { useState } from 'react';
import {
  X,
  FileText,
  Printer,
  Image as ImageIcon,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  UploadCloud,
  Eye,
  Check,
  Lock,
  Building,
  Calendar,
  Clock,
  UserCheck,
  Truck,
  Hash,
  DollarSign,
  Package,
  Layers,
  ArrowRight,
  FileCheck
} from 'lucide-react';
import { Transaction, AppLanguage, CustomerPayment } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, amountInWordsEnglish, amountInWordsUrdu } from '../utils/helpers';
import { parseTransactionItems, printThermalReceiptDocument } from '../utils/transactionPdf';
import { exportSingleTransactionJPG } from '../utils/exportManager';

interface OrderDetailsModalProps {
  transaction: Transaction | null;
  customerPayments: CustomerPayment[];
  language: AppLanguage;
  companyName: string;
  onClose: () => void;
  onOpenPayModal: (txn: Transaction) => void;
  onOpenGatePassUpload: (txn: Transaction) => void;
  onOpenGatePassView: (txn: Transaction) => void;
  onOpenInvoicePdf: (txn: Transaction) => void;
  onConfirmOrder: (id: string) => void;
  onNilOrder: (id: string) => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  transaction,
  customerPayments,
  language,
  companyName,
  onClose,
  onOpenPayModal,
  onOpenGatePassUpload,
  onOpenGatePassView,
  onOpenInvoicePdf,
  onConfirmOrder,
  onNilOrder
}) => {
  const [isExportingJpg, setIsExportingJpg] = useState(false);

  if (!transaction) return null;

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  // Payments & Balance Calculations
  const relevantPayments = customerPayments.filter(p => p.txnId === transaction.id);
  const recordedPaymentsSum = relevantPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = recordedPaymentsSum + (transaction.paid ? transaction.total : 0);
  const due = Math.max(0, transaction.total - totalPaid);
  const isPaid = due <= 0;
  const isPartial = totalPaid > 0 && due > 0;
  const paymentPercent = Math.min(100, Math.round((totalPaid / (transaction.total || 1)) * 100));

  const isDelivered = !!transaction.receiptUrl;
  const isPdf =
    transaction.gatePass?.fileType === 'pdf' ||
    transaction.receiptUrl?.startsWith('data:application/pdf') ||
    transaction.gatePass?.fileName?.toLowerCase().endsWith('.pdf');

  const items = parseTransactionItems(transaction);
  const totalItemQty = items.reduce((sum, item) => sum + (item.qty || 1), 0);

  const handleExportJpg = async () => {
    try {
      setIsExportingJpg(true);
      await exportSingleTransactionJPG({
        transaction,
        customerPayments,
        companyName
      });
    } catch (err) {
      console.error('Failed to export JPG invoice', err);
    } finally {
      setIsExportingJpg(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-5 backdrop-blur-xs font-mono overflow-y-auto">
      <div className="relative w-full max-w-3xl max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden my-auto animate-in fade-in duration-150">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 border-b border-[var(--steel-line)] bg-[var(--panel-raised)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--yellow)]/15 border border-[var(--yellow)]/30 text-[var(--yellow)]">
              <Package size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-serif font-black text-lg text-[var(--text)] tracking-tight">
                  Order Details #{transaction.id}
                </h3>
                {transaction.confirmed ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Check size={11} strokeWidth={2.5} /> In Sales
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <Clock size={11} /> Booked (Pending)
                  </span>
                )}
                {transaction.isJobWork && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                    Job Work
                  </span>
                )}
                {transaction.batchId && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                    Batch: {transaction.batchId}
                  </span>
                )}
                {transaction.trackingNumber && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    Trk: {transaction.trackingNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-dim)] flex items-center gap-2 mt-0.5">
                <span>{transaction.date}</span>
                <span>·</span>
                <span>{transaction.time}</span>
                {transaction.device && (
                  <>
                    <span>·</span>
                    <span className="text-[10px] opacity-75">{transaction.device}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition cursor-pointer"
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Customer / Factory & Dispatch Status Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Customer Information Card */}
            <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-dim)] flex items-center gap-1">
                  <Building size={12} /> Customer / Workshop
                </span>
                <span className="text-[10px] font-mono text-[var(--text-dim)]">Account</span>
              </div>
              <div className="text-sm font-bold text-[var(--text)] font-sans">
                {transaction.factory || 'Walk-in Customer'}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[var(--text-dim)] flex-wrap">
                <span>Total Items: <strong className="text-[var(--text)]">{totalItemQty || transaction.itemCount || 1} pcs</strong></span>
                {(() => {
                  const cleanSizes = transaction.sizes
                    ?.split(/[,;]/)
                    .map(s => s.trim())
                    .filter(s => s && s !== '-' && s !== '—')
                    .join(', ');
                  return cleanSizes ? (
                    <>
                      <span>·</span>
                      <span>Sizes: <strong className="text-[var(--text)]">{cleanSizes}</strong></span>
                    </>
                  ) : null;
                })()}
                {(() => {
                  const cleanColors = transaction.colors
                    ?.split(/[,;]/)
                    .map(s => s.trim())
                    .filter(s => s && s !== '-' && s !== '—')
                    .join(', ');
                  return cleanColors ? (
                    <>
                      <span>·</span>
                      <span>Colors: <strong className="text-[var(--text)]">{cleanColors}</strong></span>
                    </>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Gate Pass & Dispatch Status Card */}
            <div className={`p-3.5 rounded-xl border space-y-2 ${
              isDelivered
                ? 'bg-emerald-950/20 border-emerald-500/40'
                : 'bg-amber-950/20 border-amber-500/40'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 text-[var(--text-dim)]">
                  <Truck size={12} /> Dispatch & Gate Pass
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                  isDelivered ? 'bg-emerald-500 text-black' : 'bg-amber-500 text-black'
                }`}>
                  {isDelivered ? 'Verified & Solved' : 'Awaiting Gate Pass'}
                </span>
              </div>

              {isDelivered ? (
                <div className="space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-dim)]">Sequence No:</span>
                    <span className="font-bold text-amber-400 font-mono">
                      {transaction.gateSequenceNo || transaction.gatePass?.gateSequenceNo || 'GP-VERIFIED'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-dim)]">Received By:</span>
                    <span className="text-[var(--text)] font-bold">
                      {transaction.gateReceivedBy || transaction.gatePass?.receivedBy || 'Gate Officer'}
                    </span>
                  </div>
                  {transaction.gatePost && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-dim)]">Dispatch Post:</span>
                      <span className="text-[var(--text-dim)]">{transaction.gatePost}</span>
                    </div>
                  )}
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onOpenGatePassView(transaction)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold hover:bg-emerald-500 hover:text-black transition flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={12} />
                      <span>View Receipt Document ({isPdf ? 'PDF' : 'JPG'})</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-amber-300 leading-relaxed">
                    Physical delivery receipt must be uploaded to confirm dispatch and transfer into sales ledger.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenGatePassUpload(transaction)}
                    className="w-full py-1.5 rounded-lg bg-amber-500 text-black font-black uppercase text-[10px] tracking-wider hover:bg-amber-400 transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <UploadCloud size={13} strokeWidth={2.5} />
                    <span>Upload Gate Pass (PDF/JPG)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Ordered Line Items Breakdown Table */}
          <div className="rounded-xl border border-[var(--steel-line)] overflow-hidden bg-[var(--panel-raised)]">
            <div className="px-4 py-2.5 border-b border-[var(--steel-line)] bg-[var(--panel)] flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text)] flex items-center gap-1.5">
                <Layers size={13} className="text-[var(--yellow)]" />
                <span>Booked Items Breakdown</span>
              </span>
              <span className="text-[10px] text-[var(--text-dim)]">
                {items.length} {items.length === 1 ? 'item' : 'items'} ({totalItemQty} pcs)
              </span>
            </div>

            <div className="overflow-x-auto max-w-full ledger-scroll-container">
              <table className="w-full text-left text-xs min-w-[560px]">
                <thead>
                  <tr className="border-b border-[var(--steel-line)] text-[10px] uppercase font-bold text-[var(--text-dim)] bg-[var(--panel-raised)]">
                    <th className="px-3.5 py-2 w-8">#</th>
                    <th className="px-3.5 py-2">Item Description</th>
                    <th className="px-3.5 py-2">Size / Spec</th>
                    <th className="px-3.5 py-2">Color</th>
                    <th className="px-3.5 py-2 text-right">Qty</th>
                    <th className="px-3.5 py-2 text-right">Rate</th>
                    <th className="px-3.5 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--steel-line)]/50">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-[var(--panel)] transition">
                      <td className="px-3.5 py-2.5 text-[var(--text-dim)]">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 font-bold text-[var(--text)] font-sans">
                        <div>{it.name}</div>
                        {(it.batchId || it.trackingNumber) && (
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono font-normal">
                            {it.batchId && (
                              <span className="px-1.5 py-0.5 rounded bg-[var(--yellow)]/10 text-[var(--yellow)] border border-[var(--yellow)]/20">
                                Batch: {it.batchId}
                              </span>
                            )}
                            {it.trackingNumber && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                Trk: {it.trackingNumber}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-[var(--text-dim)]">{it.size || transaction.sizes || '—'}</td>
                      <td className="px-3.5 py-2.5 text-[var(--text-dim)]">{it.color || transaction.colors || '—'}</td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-[var(--text)]">{it.qty} pcs</td>
                      <td className="px-3.5 py-2.5 text-right text-[var(--text-dim)]">{fmt(it.rate)}</td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-[var(--yellow)]">{fmt(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--steel-line)] bg-[var(--panel)] font-bold text-xs">
                    <td colSpan={4} className="px-3.5 py-2.5 text-right uppercase text-[var(--text-dim)]">Total:</td>
                    <td className="px-3.5 py-2.5 text-right text-[var(--text)]">{totalItemQty} pcs</td>
                    <td className="px-3.5 py-2.5 text-right text-[var(--text-dim)]">—</td>
                    <td className="px-3.5 py-2.5 text-right text-sm text-[var(--yellow)]">{fmt(transaction.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Financial Summary & Balance Overview */}
          <div className="p-4 rounded-xl border border-[var(--steel-line)] bg-[var(--panel-raised)] space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--steel-line)]/60 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text)] flex items-center gap-1.5">
                <DollarSign size={13} className="text-[var(--yellow)]" />
                <span>Financial & Payment Status</span>
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                isPaid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : isPartial ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'
              }`}>
                {isPaid ? 'Fully Paid' : isPartial ? 'Partially Paid' : 'Unpaid'}
              </span>
            </div>

            {/* Key Figure Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]">
                <div className="text-[10px] uppercase text-[var(--text-dim)]">Gross Amount</div>
                <div className="text-base font-bold text-[var(--yellow)] mt-0.5">{fmt(transaction.total)}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]">
                <div className="text-[10px] uppercase text-[var(--text-dim)]">Amount Paid</div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">{fmt(totalPaid)}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]">
                <div className="text-[10px] uppercase text-[var(--text-dim)]">Balance Due</div>
                <div className={`text-base font-bold mt-0.5 ${due > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {fmt(due)}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]">
                <div className="text-[10px] uppercase text-[var(--text-dim)]">Payment Progress</div>
                <div className="text-base font-bold text-[var(--text)] mt-0.5">{paymentPercent}%</div>
              </div>
            </div>

            {/* Payment Progress Bar */}
            <div className="w-full bg-[var(--panel)] rounded-full h-2 overflow-hidden border border-[var(--steel-line)]/50">
              <div
                className={`h-full transition-all duration-300 ${
                  isPaid ? 'bg-emerald-500' : isPartial ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${paymentPercent}%` }}
              />
            </div>

            {/* Primary Payment Info & Reference */}
            {(transaction.method || transaction.detailCash || transaction.detailBank || transaction.detailOnline) && (
              <div className="text-[11px] text-[var(--text-dim)] bg-[var(--panel)] p-2.5 rounded-lg border border-[var(--steel-line)] flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-[var(--text-dim)]">Primary Method: </span>
                  <strong className="text-[var(--text)]">{transaction.method || 'Cash'}</strong>
                </div>
                {(transaction.detailCash || transaction.detailBank || transaction.detailOnline) && (
                  <div>
                    <span className="text-[var(--text-dim)]">Note: </span>
                    <span className="text-[var(--text)] font-mono">{transaction.detailCash || transaction.detailBank || transaction.detailOnline}</span>
                  </div>
                )}
              </div>
            )}

            {/* Payment Ledger History (if multiple payments) */}
            {relevantPayments.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] uppercase font-bold text-[var(--text-dim)]">
                  Customer Payment History ({relevantPayments.length})
                </div>
                <div className="space-y-1">
                  {relevantPayments.map(p => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded bg-[var(--panel)] border border-[var(--steel-line)]/50 text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-dim)]">{p.date}</span>
                        <span className="px-1.5 py-0.2 rounded bg-[var(--panel-raised)] text-[var(--yellow)] font-bold text-[10px]">
                          {p.method}
                        </span>
                        {p.detail && <span className="text-[var(--text-dim)]">({p.detail})</span>}
                      </div>
                      <div className="font-bold text-emerald-400">+{fmt(p.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions Bar */}
        <div className="p-4 border-t border-[var(--steel-line)] bg-[var(--panel-raised)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Left Actions: Print & Export */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onOpenInvoicePdf(transaction)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--yellow)]/15 border border-[var(--yellow)] text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-black font-bold text-xs uppercase transition cursor-pointer"
            >
              <FileText size={13} />
              <span>Invoice PDF</span>
            </button>

            <button
              type="button"
              disabled={isExportingJpg}
              onClick={handleExportJpg}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500 hover:text-black font-bold text-xs uppercase transition cursor-pointer disabled:opacity-50"
            >
              <ImageIcon size={13} />
              <span>{isExportingJpg ? 'Saving...' : 'Invoice JPG'}</span>
            </button>

            <button
              type="button"
              onClick={() => printThermalReceiptDocument({ transaction, customerPayments, companyName })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] hover:border-[var(--yellow)] hover:text-[var(--yellow)] font-bold text-xs uppercase transition cursor-pointer"
            >
              <Printer size={13} />
              <span>Thermal Print</span>
            </button>
          </div>

          {/* Right Workflow Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {due > 0 && (
              <button
                type="button"
                onClick={() => onOpenPayModal(transaction)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 text-black font-bold text-xs uppercase hover:bg-emerald-400 transition cursor-pointer shadow-sm"
              >
                <CreditCard size={13} />
                <span>Record Payment (Due: {fmt(due)})</span>
              </button>
            )}

            {!transaction.confirmed && (
              <button
                type="button"
                onClick={() => {
                  if (!isDelivered) {
                    onOpenGatePassUpload(transaction);
                  } else {
                    onConfirmOrder(transaction.id);
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs uppercase transition cursor-pointer ${
                  isDelivered
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500 hover:bg-emerald-500 hover:text-black'
                    : 'bg-amber-500 text-black hover:bg-amber-400 shadow-sm'
                }`}
              >
                {isDelivered ? <Check size={13} strokeWidth={2.5} /> : <UploadCloud size={13} />}
                <span>{isDelivered ? 'Confirm Into Sales' : 'Upload Gate Pass'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)] text-xs font-bold uppercase transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
