import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  History,
  Layers,
  Package,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Truck,
  X,
  XCircle
} from 'lucide-react';
import { AppState, ChequeRecord, ChequeStatus } from '../types';
import { fmt } from '../utils/helpers';
import { resolveChequeDetailContext } from '../utils/chequeManager';
import { hapticTap } from '../utils/haptics';

interface StatusVisualStyle {
  label: string;
  badgeBg: string;
  rowBg: string;
  cardBg: string;
  calendarCellBg: string;
  calendarPillCls: string;
  dotCls: string;
  textAccent: string;
}

interface ChequeDetailSidePanelProps {
  state: AppState;
  cheque: ChequeRecord | null;
  filteredCheques: ChequeRecord[];
  onClose: () => void;
  onSelectCheque: (cheque: ChequeRecord) => void;
  onUpdateStatus: (cheque: ChequeRecord, newStatus: ChequeStatus) => void;
  onNavigateToView?: (view: any) => void;
  getStatusStyle: (status: ChequeStatus) => StatusVisualStyle;
}

type DetailSectionTab = 'all' | 'history' | 'invoice' | 'batch';

const formatStatusLabel = (status: ChequeStatus | 'created'): string => {
  if (status === 'created') return 'Created';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const getAuditBadgeClass = (status: ChequeStatus | 'created'): string => {
  switch (status) {
    case 'cleared':
      return 'bg-emerald-600/35 text-emerald-100 border-emerald-400/65';
    case 'bounced':
      return 'bg-red-600/40 text-red-100 border-red-400/70';
    case 'presented':
      return 'bg-amber-500/30 text-amber-100 border-amber-400/70';
    case 'overdue':
      return 'bg-orange-600/35 text-orange-100 border-orange-400/70';
    case 'pending':
      return 'bg-slate-600/45 text-slate-100 border-slate-400/55';
    case 'created':
    default:
      return 'bg-zinc-800 text-zinc-200 border-zinc-600';
  }
};

export const ChequeDetailSidePanel: React.FC<ChequeDetailSidePanelProps> = ({
  state,
  cheque,
  filteredCheques,
  onClose,
  onSelectCheque,
  onUpdateStatus,
  onNavigateToView,
  getStatusStyle
}) => {
  const [activeTab, setActiveTab] = useState<DetailSectionTab>('all');

  useEffect(() => {
    setActiveTab('all');
  }, [cheque?.id]);

  useEffect(() => {
    if (!cheque) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cheque, onClose]);

  const context = useMemo(() => {
    if (!cheque) return null;
    return resolveChequeDetailContext(state, cheque);
  }, [state, cheque]);

  if (!cheque || !context) return null;

  const statusStyle = getStatusStyle(cheque.status);
  const currentIndex = filteredCheques.findIndex(c => c.id === cheque.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredCheques.length - 1;

  const isPresented = cheque.status === 'presented';
  const isCleared = cheque.status === 'cleared';
  const isBounced = cheque.status === 'bounced';
  const isOverdue = cheque.status === 'overdue';
  const isEndorsed = cheque.chequeType === 'endorsed_to_supplier';

  const routeTypeLabel = isEndorsed
    ? '3rd-Party Endorsed'
    : cheque.chequeType === 'company_issued'
    ? 'Company Issued'
    : 'Customer Receipt';

  const directInvoicesCount = context.invoiceReferences.filter(inv => inv.isDirectMatch).length;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-xs"
      onClick={onClose}
      role="presentation"
    >
      <aside
        aria-label="Cheque Detail Side Panel"
        className="relative w-full sm:w-[470px] lg:w-[540px] h-full bg-[var(--panel)] border-l border-[var(--steel-line)] shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky Panel Header */}
        <header className="px-4 py-3.5 border-b border-[var(--steel-line)] bg-[var(--panel-raised)]/80 space-y-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-lg text-[var(--yellow)] tabular-nums">
                  #{cheque.chequeNo}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-bold uppercase ${statusStyle.badgeBg}`}
                >
                  {isCleared && <CheckCircle2 size={12} />}
                  {isPresented && <Clock size={12} />}
                  {isBounced && <XCircle size={12} />}
                  {isOverdue && <AlertTriangle size={12} />}
                  {cheque.status === 'pending' && <Clock size={12} />}
                  <span>{statusStyle.label}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-1 flex-wrap">
                <span className="text-zinc-200 font-medium">{cheque.bankName || 'Bank Cheque'}</span>
                <span aria-hidden="true">·</span>
                <span>{routeTypeLabel}</span>
                {cheque.isCrossLinked && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-sky-300 font-medium">Cross-Linked</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {currentIndex >= 0 && (
                <div className="inline-flex items-center gap-1 mr-1 font-mono text-[11px] text-zinc-400">
                  <button
                    type="button"
                    disabled={!hasPrev}
                    onClick={() => {
                      if (hasPrev) {
                        hapticTap();
                        onSelectCheque(filteredCheques[currentIndex - 1]);
                      }
                    }}
                    title="Previous Cheque"
                    className="p-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-300 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="px-1.5 tabular-nums whitespace-nowrap">
                    {currentIndex + 1}/{filteredCheques.length}
                  </span>
                  <button
                    type="button"
                    disabled={!hasNext}
                    onClick={() => {
                      if (hasNext) {
                        hapticTap();
                        onSelectCheque(filteredCheques[currentIndex + 1]);
                      }
                    }}
                    title="Next Cheque"
                    className="p-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-300 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="Close side panel"
                className="p-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Key Financial & Maturity Figures */}
          <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
            <div className="p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]">
              <span className="text-[10px] text-zinc-400 block">Amount (PKR)</span>
              <span className="text-sm font-bold text-[var(--text)] tabular-nums">
                {fmt(cheque.amount)}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]">
              <span className="text-[10px] text-zinc-400 block">Maturity Date</span>
              <span className="text-xs font-bold text-[var(--text)] tabular-nums block">
                {cheque.chequeDate}
              </span>
              <span className={`text-[10px] font-sans ${statusStyle.textAccent}`}>
                {isCleared
                  ? 'Settled'
                  : isBounced
                  ? 'Dishonoured'
                  : cheque.daysRemaining < 0
                  ? `${Math.abs(cheque.daysRemaining)}d overdue`
                  : cheque.daysRemaining === 0
                  ? 'Due today'
                  : `In ${cheque.daysRemaining}d`}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]">
              <span className="text-[10px] text-zinc-400 block">Issue Date</span>
              <span className="text-xs font-bold text-zinc-200 tabular-nums block">
                {cheque.issueDate || '—'}
              </span>
              <span className="text-[10px] font-sans text-zinc-400 truncate block">
                {cheque.isCrossLinked ? '2-Ledger Link' : 'Single Ledger'}
              </span>
            </div>
          </div>

          {/* Segmented Section Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[11px] font-mono">
            {[
              { id: 'all', label: 'All View' },
              { id: 'history', label: `History (${context.historyTimeline.length})` },
              { id: 'invoice', label: `Invoice (${context.invoiceReferences.length})` },
              { id: 'batch', label: `Batch (${context.batchIds.length})` }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  hapticTap();
                  setActiveTab(tab.id as DetailSectionTab);
                }}
                className={`py-1.5 px-2 rounded-md font-bold text-center transition cursor-pointer whitespace-nowrap truncate ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {/* Scrollable Detail Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          {/* Party Flow & Cross-Ledger Status (Shown in All View) */}
          {activeTab === 'all' && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-sky-400" />
                  <span>Party Flow & Ledger Protection</span>
                </h3>
                {cheque.reversalApplied && (
                  <span className="text-[10px] font-mono font-bold text-red-300">
                    Auto-Reversal Posted
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-[var(--panel-raised)]/70 border border-[var(--steel-line)] space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">From (Payer)</span>
                    <span className="font-semibold text-emerald-300">{cheque.payerParty}</span>
                  </div>
                  <ArrowRight size={14} className="text-zinc-500 shrink-0" />
                  {isEndorsed && (
                    <>
                      <div>
                        <span className="text-[10px] text-zinc-400 block">Via</span>
                        <span className="font-mono text-zinc-200">Falcon</span>
                      </div>
                      <ArrowRight size={14} className="text-zinc-500 shrink-0" />
                    </>
                  )}
                  <div>
                    <span className="text-[10px] text-zinc-400 block">To (Payee)</span>
                    <span className="font-semibold text-sky-300">{cheque.payeeParty}</span>
                  </div>
                </div>

                {cheque.notes && (
                  <div className="pt-2 border-t border-[var(--steel-line)]/70 text-[11px] text-zinc-300 leading-relaxed">
                    <span className="text-zinc-400 font-medium">Memo: </span>
                    {cheque.notes}
                  </div>
                )}

                {context.sourceVouchers.length > 0 && (
                  <div className="pt-2 border-t border-[var(--steel-line)]/70 space-y-1.5">
                    <div className="text-[10px] font-mono uppercase text-zinc-400">
                      Source Ledger Vouchers ({context.sourceVouchers.length})
                    </div>
                    {context.sourceVouchers.map(v => (
                      <div
                        key={`${v.ledgerType}_${v.entryId}`}
                        className="flex items-start justify-between gap-2 text-[11px] py-1 border-b border-[var(--steel-line)]/40 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-200 truncate">
                            {v.ledgerType}: {v.ledgerName}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-400 tabular-nums">
                            {v.date}
                            {v.time ? ` · ${v.time}` : ''} · Voucher {v.entryId}
                            {v.accountNumber ? ` · A/C ${v.accountNumber}` : ''}
                          </div>
                        </div>
                        <div className="font-mono font-bold text-right shrink-0 tabular-nums text-zinc-200">
                          {v.credit > 0 ? `+Cr ${fmt(v.credit)}` : `Dr ${fmt(v.debit)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* SECTION 1: AGGREGATED CHEQUE HISTORY TIMELINE */}
          {(activeTab === 'all' || activeTab === 'history') && (
            <section className="space-y-2.5" id="cheque-sidepanel-history">
              <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-1.5">
                <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <History size={14} className="text-amber-400" />
                  <span>Cheque History & Status Audit Trail</span>
                </h3>
                <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                  {context.historyTimeline.length} event{context.historyTimeline.length === 1 ? '' : 's'}
                </span>
              </div>

              {context.historyTimeline.length === 0 ? (
                <div className="p-4 rounded-xl bg-[var(--panel-raised)]/50 border border-[var(--steel-line)] text-center text-zinc-400 text-xs">
                  No status change events recorded for #{cheque.chequeNo} yet.
                </div>
              ) : (
                <ol className="space-y-2">
                  {context.historyTimeline.map((entry, idx) => (
                    <li
                      key={entry.id}
                      className="p-3 rounded-xl bg-[var(--panel-raised)]/65 border border-[var(--steel-line)] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span
                            className={`px-1.5 py-0.5 rounded border font-semibold ${getAuditBadgeClass(
                              entry.previousStatus
                            )}`}
                          >
                            {formatStatusLabel(entry.previousStatus)}
                          </span>
                          <ArrowRight size={11} className="text-zinc-500" />
                          <span
                            className={`px-1.5 py-0.5 rounded border font-bold ${getAuditBadgeClass(
                              entry.newStatus
                            )}`}
                          >
                            {formatStatusLabel(entry.newStatus)}
                          </span>
                          {idx === 0 && (
                            <span className="text-[10px] text-amber-300 font-semibold ml-1">
                              Latest
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                          {entry.date} · {entry.time}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <span>Source: {entry.source || 'Ledger Record'}</span>
                        {entry.isBaselineRecord && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Ledger Baseline</span>
                          </>
                        )}
                      </div>

                      {entry.notes && (
                        <p className="text-[11px] text-zinc-200 leading-relaxed">{entry.notes}</p>
                      )}

                      {entry.reversedParties && entry.reversedParties.length > 0 && (
                        <div className="text-[10px] font-mono text-red-300 pt-1 border-t border-[var(--steel-line)]/50">
                          Auto-Reversed: {entry.reversedParties.join(' · ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          {/* SECTION 2: ORIGINAL INVOICE REFERENCE & PAYMENT LINKAGE */}
          {(activeTab === 'all' || activeTab === 'invoice') && (
            <section className="space-y-2.5" id="cheque-sidepanel-invoice">
              <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-1.5">
                <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Receipt size={14} className="text-emerald-400" />
                  <span>Original Invoice Reference</span>
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                    {directInvoicesCount > 0
                      ? `${directInvoicesCount} linked`
                      : `${context.invoiceReferences.length} related`}
                  </span>
                  {onNavigateToView && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToView('transactions');
                      }}
                      className="text-[10px] font-mono text-amber-300 hover:text-amber-200 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Orders</span>
                      <ExternalLink size={10} />
                    </button>
                  )}
                </div>
              </div>

              {context.invoiceReferences.length === 0 ? (
                <div className="p-4 rounded-xl bg-[var(--panel-raised)]/50 border border-[var(--steel-line)] space-y-2 text-center">
                  <FileText size={22} className="mx-auto text-zinc-500" />
                  <div className="text-xs font-semibold text-zinc-300">
                    No Original Sales Invoice Linked
                  </div>
                  <p className="text-[11px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
                    This cheque was entered directly on{' '}
                    <span className="text-zinc-200 font-medium">{cheque.payerParty}</span>'s
                    ledger without referencing a specific Order/Invoice ID or Batch #.
                  </p>
                  {onNavigateToView && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToView(
                          cheque.chequeType === 'company_issued' ? 'raw_material' : 'factories'
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-amber-300 hover:border-amber-400 text-[11px] font-mono font-bold transition cursor-pointer"
                    >
                      <Building size={12} />
                      <span>
                        Open {cheque.chequeType === 'company_issued' ? 'Supplier' : 'Customer'} Ledger
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {context.invoiceReferences.map(inv => (
                    <div
                      key={inv.txnId}
                      className="p-3 rounded-xl bg-[var(--panel-raised)]/65 border border-[var(--steel-line)] space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap font-mono">
                            <span className="font-bold text-sm text-emerald-300 tabular-nums">
                              Invoice #{inv.txnId}
                            </span>
                            <span
                              className={`text-[10px] font-sans font-medium ${
                                inv.isDirectMatch ? 'text-sky-300' : 'text-zinc-400'
                              }`}
                            >
                              {inv.matchReason}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono tabular-nums mt-0.5">
                            {inv.date} · {inv.time} · {inv.factory}
                          </div>
                        </div>

                        <div className="text-right font-mono shrink-0">
                          <div className="font-bold text-sm text-[var(--text)] tabular-nums">
                            {fmt(inv.total)}
                          </div>
                          <span
                            className={`text-[10px] font-semibold ${
                              inv.paid ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {inv.paid ? 'Paid in Full' : 'Credit / Partial'}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-zinc-200 leading-relaxed pt-1 border-t border-[var(--steel-line)]/50">
                        {inv.itemsSummary}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-zinc-400 tabular-nums">
                        <span>Qty: {inv.itemCount}</span>
                        {inv.sizes && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Sizes: {inv.sizes}</span>
                          </>
                        )}
                        {inv.colors && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Colors: {inv.colors}</span>
                          </>
                        )}
                        {inv.method && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Method: {inv.method}</span>
                          </>
                        )}
                      </div>

                      {(inv.batchId || inv.trackingNumber || inv.gateSequenceNo || inv.gatePassNo) && (
                        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-zinc-300 pt-1 border-t border-[var(--steel-line)]/40">
                          {inv.batchId && (
                            <span className="inline-flex items-center gap-1 text-amber-300">
                              <Package size={10} />
                              <span>{inv.batchId}</span>
                            </span>
                          )}
                          {inv.trackingNumber && (
                            <span className="inline-flex items-center gap-1 text-sky-300">
                              <Truck size={10} />
                              <span>{inv.trackingNumber}</span>
                            </span>
                          )}
                          {(inv.gateSequenceNo || inv.gatePassNo) && (
                            <span className="text-zinc-300">
                              Gate Pass: {inv.gateSequenceNo || inv.gatePassNo}
                            </span>
                          )}
                        </div>
                      )}

                      {inv.payments.length > 0 && (
                        <div className="pt-1.5 border-t border-[var(--steel-line)]/50 space-y-1">
                          <div className="text-[10px] font-mono text-zinc-400 flex items-center justify-between">
                            <span>Recorded Invoice Payments ({inv.payments.length})</span>
                            <span className="text-emerald-300 tabular-nums">
                              {fmt(inv.totalPaidOnInvoice)} paid
                            </span>
                          </div>
                          {inv.payments.slice(0, 4).map(p => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between text-[10px] font-mono text-zinc-300 tabular-nums"
                            >
                              <span className="truncate pr-2">
                                {p.date} · {p.method}
                                {p.detail ? ` (${p.detail})` : ''}
                              </span>
                              <span className="font-bold text-emerald-300 shrink-0">
                                {fmt(p.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION 3: ASSOCIATED BATCH METADATA */}
          {(activeTab === 'all' || activeTab === 'batch') && (
            <section className="space-y-2.5" id="cheque-sidepanel-batch">
              <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-1.5">
                <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Layers size={14} className="text-amber-400" />
                  <span>Associated Batch Metadata</span>
                </h3>
                <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                  {context.batchIds.length} batch{context.batchIds.length === 1 ? '' : 'es'}
                </span>
              </div>

              {/* 3-Day Batch Due Proximity Alert */}
              {context.batchDueAlert.urgencyLevel !== 'none' && (
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                    context.batchDueAlert.isOverdue
                      ? 'bg-orange-950/35 border-orange-500/50 text-orange-100'
                      : 'bg-amber-500/12 border-amber-400/50 text-amber-100'
                  }`}
                >
                  <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-semibold">
                      Batch Maturity Watch · {context.batchDueAlert.label}
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      {context.batchDueAlert.isOverdue
                        ? 'This cheque has crossed maturity date. Confirm bank clearance or log bounce reversal.'
                        : 'Due within the 3-day proximity window. Verify funds or bank presentation status.'}
                    </p>
                  </div>
                </div>
              )}

              {context.batchMetadataList.length === 0 ? (
                <div className="p-4 rounded-xl bg-[var(--panel-raised)]/50 border border-[var(--steel-line)] space-y-1.5 text-center">
                  <Package size={22} className="mx-auto text-zinc-500" />
                  <div className="text-xs font-semibold text-zinc-300">
                    No Production Batch ID Assigned
                  </div>
                  <p className="text-[11px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
                    Endorsements or orders tagged with a Batch ID (e.g.{' '}
                    <span className="font-mono text-zinc-300">BATCH-202611-0001</span>) display
                    full batch exposure, linked shipments, and sibling cheques here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {context.batchMetadataList.map(meta => (
                    <div
                      key={meta.batchId}
                      className="p-3.5 rounded-xl bg-[var(--panel-raised)]/65 border border-[var(--steel-line)] space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 font-mono">
                            <Package size={13} className="text-amber-400 shrink-0" />
                            <span className="font-bold text-sm text-amber-300">{meta.batchId}</span>
                          </div>
                          {meta.trackingNumbers.length > 0 && (
                            <div className="text-[10px] font-mono text-sky-300 mt-0.5 flex items-center gap-1 flex-wrap">
                              <Truck size={11} className="shrink-0" />
                              <span>Tracking: {meta.trackingNumbers.join(', ')}</span>
                            </div>
                          )}
                        </div>

                        {meta.batchSummary && (
                          <div className="text-right font-mono text-[10px]">
                            <span className="font-bold text-zinc-200 tabular-nums block">
                              {fmt(meta.batchSummary.totalAmount)} total
                            </span>
                            <span className="text-zinc-400">
                              {meta.batchSummary.chequeCount} cheque
                              {meta.batchSummary.chequeCount === 1 ? '' : 's'} ·{' '}
                              {meta.batchSummary.alertLabel}
                            </span>
                          </div>
                        )}
                      </div>

                      {meta.batchSummary && (
                        <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-[var(--steel-line)]/50 font-mono text-[10px] tabular-nums">
                          <div>
                            <span className="text-zinc-400 block">Active Cheques</span>
                            <span className="font-bold text-zinc-200">
                              {meta.batchSummary.activeCount} / {meta.batchSummary.chequeCount}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-400 block">Earliest Due</span>
                            <span className="font-bold text-zinc-200">
                              {meta.batchSummary.earliestDueDate || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-400 block">Overdue Count</span>
                            <span
                              className={`font-bold ${
                                meta.batchSummary.overdueCount > 0
                                  ? 'text-orange-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {meta.batchSummary.overdueCount}
                            </span>
                          </div>
                        </div>
                      )}

                      {meta.linkedTransactions.length > 0 && (
                        <div className="pt-2 border-t border-[var(--steel-line)]/50 space-y-1">
                          <div className="text-[10px] font-mono uppercase text-zinc-400">
                            Production Orders in Batch ({meta.linkedTransactions.length})
                          </div>
                          {meta.linkedTransactions.map(t => (
                            <div
                              key={t.id}
                              className="flex items-center justify-between gap-2 text-[11px] py-1 border-b border-[var(--steel-line)]/35 last:border-b-0"
                            >
                              <div className="min-w-0">
                                <div className="font-mono font-semibold text-zinc-200 truncate">
                                  Order #{t.id} · {t.factory || 'Workshop Order'}
                                </div>
                                <div className="text-[10px] text-zinc-400 truncate">
                                  {t.itemsSummary} ({t.itemCount} pcs)
                                </div>
                              </div>
                              <span className="font-mono font-bold text-zinc-200 shrink-0 tabular-nums">
                                {fmt(t.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {meta.relatedProject && (
                        <div className="pt-2 border-t border-[var(--steel-line)]/50 space-y-1 text-[11px]">
                          <div className="text-[10px] font-mono uppercase text-zinc-400">
                            Matched Project Costing Spec
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-zinc-200 truncate">
                              {meta.relatedProject.projectName}
                            </span>
                            <span className="font-mono text-zinc-300 tabular-nums shrink-0">
                              {meta.relatedProject.rodSize}
                              {meta.relatedProject.gauge ? ` · ${meta.relatedProject.gauge}` : ''} ·{' '}
                              {meta.relatedProject.batchQuantity} pcs
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-zinc-400 tabular-nums">
                            Cost/pc: {fmt(meta.relatedProject.productionCostPerUnit)} · Quoted:{' '}
                            {fmt(meta.relatedProject.quotedPricePerUnit)} · Margin:{' '}
                            {meta.relatedProject.profitMarginPercent.toFixed(1)}%
                          </div>
                        </div>
                      )}

                      {meta.relatedCheques.length > 0 && (
                        <div className="pt-2 border-t border-[var(--steel-line)]/50 space-y-1.5">
                          <div className="text-[10px] font-mono uppercase text-zinc-400">
                            Other Cheques in {meta.batchId} ({meta.relatedCheques.length})
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {meta.relatedCheques.map(sib => {
                              const sibStyle = getStatusStyle(sib.status);
                              return (
                                <button
                                  key={sib.id}
                                  type="button"
                                  onClick={() => {
                                    hapticTap();
                                    onSelectCheque(sib);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-amber-400 text-[10px] font-mono flex items-center gap-1.5 cursor-pointer transition tabular-nums"
                                >
                                  <span className="font-bold text-amber-300">#{sib.chequeNo}</span>
                                  <span className="text-zinc-300">{fmt(sib.amount)}</span>
                                  <span className={sibStyle.textAccent}>{sibStyle.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Sticky Bottom Status Actions Footer */}
        <footer className="px-4 py-3 border-t border-[var(--steel-line)] bg-[var(--panel-raised)]/85 flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {!isPresented && !isCleared && !isBounced && (
              <button
                type="button"
                onClick={() => onUpdateStatus(cheque, 'presented')}
                className="px-3 py-1.5 rounded-lg bg-amber-500/25 text-amber-200 border border-amber-500/40 hover:bg-amber-500 hover:text-black font-bold text-xs transition cursor-pointer"
              >
                Present
              </button>
            )}
            {!isCleared && (
              <button
                type="button"
                onClick={() => onUpdateStatus(cheque, 'cleared')}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500 hover:text-black font-bold text-xs transition cursor-pointer"
              >
                Clear
              </button>
            )}
            {!isBounced && (
              <button
                type="button"
                onClick={() => onUpdateStatus(cheque, 'bounced')}
                className="px-3 py-1.5 rounded-lg bg-red-500/25 text-red-200 border border-red-500/40 hover:bg-red-600 hover:text-white font-bold text-xs transition cursor-pointer"
              >
                Bounce
              </button>
            )}
            {(isCleared || isBounced || isPresented) && (
              <button
                type="button"
                onClick={() => onUpdateStatus(cheque, 'pending')}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 font-semibold text-xs inline-flex items-center gap-1 transition cursor-pointer"
              >
                <RefreshCw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer transition ml-auto"
          >
            Close
          </button>
        </footer>
      </aside>
    </div>
  );
};
