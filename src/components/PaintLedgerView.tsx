import React, { useState, useMemo } from 'react';
import {
  Brush,
  Plus,
  Trash2,
  Edit2,
  Sliders,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { Painter, PaintEntry, AppLanguage, LedgerColumnConfig, ExportDocumentConfig } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, downloadCSV, exportTablePDF } from '../utils/helpers';
import { exportTableJPG } from '../utils/exportManager';
import { computePainterLedgerDetails } from '../utils/mathEngine';
import {
  buildLedgerExportTableData,
  getStoredLedgerColumnConfig,
  saveStoredLedgerColumnConfig
} from '../utils/ledgerExportHelper';
import { EditLedgerEntryModal } from './EditLedgerEntryModal';
import { LedgerStudioModal, DEFAULT_LEDGER_COLUMNS } from './LedgerStudioModal';

interface PaintLedgerViewProps {
  painters: Painter[];
  language: AppLanguage;
  companyName: string;
  onSavePainter: (painter: Painter, oldName?: string) => void;
  onDeletePainter: (name: string) => void;
  onAddPaintEntry: (painterName: string, entry: Omit<PaintEntry, 'id'>) => void;
  onDeletePaintEntry: (painterName: string, entryId: string) => void;
  onUpdatePaintEntry?: (painterName: string, entryId: string, updatedData: any) => void;
  onToggleChequeStatus: (painterName: string, entryId: string, status: 'cleared' | 'bounced') => void;
}

export const PaintLedgerView: React.FC<PaintLedgerViewProps> = ({
  painters,
  language,
  companyName,
  onSavePainter,
  onDeletePainter,
  onAddPaintEntry,
  onDeletePaintEntry,
  onUpdatePaintEntry,
}) => {
  const [selectedPainterIdx, setSelectedPainterIdx] = useState<number | null>(null);
  const [addPainterModal, setAddPainterModal] = useState(false);
  const [newPainterName, setNewPainterName] = useState('');

  // Entry Form State
  const [desc, setDesc] = useState('');
  const [color, setColor] = useState('Black');
  const [itemSize, setItemSize] = useState('18 inch');
  const [itemType] = useState('American Plain');
  const [itemFactory] = useState('');
  const [itemCount, setItemCount] = useState('');
  const [ratePerItem, setRatePerItem] = useState('');
  const [debit, setDebit] = useState('');
  const [credit, setCredit] = useState('');
  const [isDamage, setIsDamage] = useState(false);
  const [method, setMethod] = useState('Cash');
  const [detail] = useState('');
  const [date] = useState(todayISO());

  // Detailed payment & Studio states
  const [editingEntry, setEditingEntry] = useState<PaintEntry | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [colConfig, setColConfig] = useState<LedgerColumnConfig>(() =>
    getStoredLedgerColumnConfig('paint', DEFAULT_LEDGER_COLUMNS)
  );
  const [showExtendedPaymentFields, setShowExtendedPaymentFields] = useState(false);
  const [entryPaidBy, setEntryPaidBy] = useState('');
  const [entryPaidTo, setEntryPaidTo] = useState('');
  const [entryBankName, setEntryBankName] = useState('');
  const [entryAccountNumber, setEntryAccountNumber] = useState('');
  const [entryChequeNo, setEntryChequeNo] = useState('');

  // WIP Pipeline State
  const [activePainterTab, setActivePainterTab] = useState<'financials' | 'wip_pipeline'>('financials');
  const [wipDispatchType, setWipDispatchType] = useState<'outward' | 'inward'>('outward');
  const [wipBatchId, setWipBatchId] = useState('BATCH-2026-09');
  const [wipSize, setWipSize] = useState('18 inch');
  const [wipColor, setWipColor] = useState('Matt Black');
  const [wipDispatchedQty, setWipDispatchedQty] = useState('');
  const [wipReceivedQty, setWipReceivedQty] = useState('');
  const [wipRejectedQty, setWipRejectedQty] = useState('0');
  const [wipRejectionReason, setWipRejectionReason] = useState('Uneven coating / paint run');
  const [wipDeductPenalty, setWipDeductPenalty] = useState(true);
  const [wipUnitRate, setWipUnitRate] = useState('18');

  const handleUpdateColConfig = (newCfg: LedgerColumnConfig) => {
    setColConfig(newCfg);
    saveStoredLedgerColumnConfig('paint', newCfg);
  };

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const handleRecalcCredit = (countStr: string, rateStr: string) => {
    const c = parseFloat(countStr) || 0;
    const r = parseFloat(rateStr) || 0;
    if (c > 0 && r > 0 && !credit) {
      setCredit(String(c * r));
    }
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPainterIdx === null) return;
    const p = painters[selectedPainterIdx];
    if (!p) return;

    const dVal = parseFloat(debit) || 0;
    const cVal = (parseFloat(credit) || 0) * (isDamage ? -1 : 1);
    if (dVal <= 0 && cVal === 0) return;

    onAddPaintEntry(p.name, {
      date,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      desc: desc.trim() || 'Work logged',
      color,
      itemSize,
      itemType,
      itemFactory,
      itemCount,
      ratePerItem,
      debit: dVal,
      credit: cVal,
      method: dVal > 0 ? method : undefined,
      detail: dVal > 0 ? detail.trim() : undefined,
      paidBy: entryPaidBy.trim() || undefined,
      paidTo: entryPaidTo.trim() || undefined,
      bankName: entryBankName.trim() || undefined,
      accountNumber: entryAccountNumber.trim() || undefined,
      chequeNo: entryChequeNo.trim() || undefined
    });

    setDesc('');
    setDebit('');
    setCredit('');
    setItemCount('');
    setRatePerItem('');
    setIsDamage(false);
    setEntryPaidBy('');
    setEntryPaidTo('');
    setEntryBankName('');
    setEntryAccountNumber('');
    setEntryChequeNo('');
  };

  const currentPainter = selectedPainterIdx !== null ? painters[selectedPainterIdx] : null;
  const currentBalance = currentPainter
    ? currentPainter.entries.reduce((s, e) => s + (e.credit || 0) - (e.debit || 0), 0)
    : 0;

  // Closed-loop WIP Pipeline calculation for external spray painters
  const wipMetrics = useMemo(() => {
    if (!currentPainter) {
      return { totalDispatched: 0, totalReceived: 0, totalRejected: 0, activeWip: 0, rejectionRate: 0, wipEntries: [] as PaintEntry[] };
    }
    let totalDispatched = 0;
    let totalReceived = 0;
    let totalRejected = 0;
    const wipEntries: PaintEntry[] = [];

    currentPainter.entries.forEach(e => {
      const isOutward = e.entryType === 'dispatch_outward' || e.desc.includes('[JOB-OUT]');
      const isInward = e.entryType === 'receive_inward' || e.desc.includes('[JOB-IN]');

      if (isOutward) {
        totalDispatched += e.dispatchedQty || parseFloat(e.itemCount || '0') || 0;
        wipEntries.push(e);
      } else if (isInward) {
        totalReceived += e.receivedQty || parseFloat(e.itemCount || '0') || 0;
        if (e.rejectedQty) totalRejected += e.rejectedQty;
        wipEntries.push(e);
      }
    });

    const activeWip = Math.max(0, totalDispatched - totalReceived);
    const totalInspected = totalReceived;
    const rejectionRate = totalInspected > 0 ? (totalRejected / totalInspected) * 100 : 0;

    return { totalDispatched, totalReceived, totalRejected, activeWip, rejectionRate, wipEntries };
  }, [currentPainter]);

  const handleAddWipEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPainter) return;

    if (wipDispatchType === 'outward') {
      const dQty = parseFloat(wipDispatchedQty) || 0;
      if (dQty <= 0) return;
      onAddPaintEntry(currentPainter.name, {
        date,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        desc: `[JOB-OUT] Dispatched ${dQty} pcs ${wipSize} (${wipColor}) to spray booth`,
        color: wipColor,
        itemSize: wipSize,
        itemCount: String(dQty),
        entryType: 'dispatch_outward',
        dispatchedQty: dQty,
        batchId: wipBatchId.trim() || undefined,
        debit: 0,
        credit: 0
      });
      setWipDispatchedQty('');
    } else {
      const rQty = parseFloat(wipReceivedQty) || 0;
      const rejQty = parseFloat(wipRejectedQty) || 0;
      const rate = parseFloat(wipUnitRate) || 18;
      if (rQty <= 0) return;

      const goodQty = Math.max(0, rQty - rejQty);
      const earnedWorkAmount = goodQty * rate;
      const penaltyAmount = (wipDeductPenalty && rejQty > 0) ? rejQty * rate : 0;
      const finalCredit = Math.max(0, earnedWorkAmount - penaltyAmount);

      onAddPaintEntry(currentPainter.name, {
        date,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        desc: `[JOB-IN] Received ${rQty} pcs ${wipSize} (${wipColor}) · ${goodQty} Passed${rejQty > 0 ? ` · ${rejQty} Defective (${wipRejectionReason})` : ''}`,
        color: wipColor,
        itemSize: wipSize,
        itemCount: String(rQty),
        ratePerItem: String(rate),
        entryType: 'receive_inward',
        receivedQty: rQty,
        rejectedQty: rejQty,
        rejectionReason: rejQty > 0 ? wipRejectionReason : undefined,
        batchId: wipBatchId.trim() || undefined,
        debit: 0,
        credit: finalCredit
      });
      setWipReceivedQty('');
      setWipRejectedQty('0');
    }
  };

  const handleExportCSV = (customCols?: LedgerColumnConfig) => {
    if (!currentPainter) return;
    const effectiveCols = customCols || colConfig;
    const details = computePainterLedgerDetails(currentPainter.entries);
    const { headers, rows } = buildLedgerExportTableData(details.entriesWithBalance, effectiveCols);
    downloadCSV(`${currentPainter.name}_Paint_Ledger`, headers, rows);
  };

  const handleExportPDF = (customCols?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    if (!currentPainter) return;
    const effectiveCols = customCols || colConfig;
    const details = computePainterLedgerDetails(currentPainter.entries);
    const { headers, rows } = buildLedgerExportTableData(details.entriesWithBalance, effectiveCols);
    exportTablePDF(
      `${currentPainter.name} — Paint Ledger`,
      headers,
      rows,
      `${currentPainter.name}_Paint_Ledger`,
      exportDocConfig?.orientation || 'landscape',
      companyName,
      exportDocConfig?.subtitle || 'Paint & Powder Coating Services',
      exportDocConfig?.customNote || `Net Balance: ${fmt(currentBalance)}`,
      exportDocConfig
    );
  };

  const handleExportJPG = (customCols?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    if (!currentPainter) return;
    const effectiveCols = customCols || colConfig;
    const details = computePainterLedgerDetails(currentPainter.entries);
    const { headers, rows } = buildLedgerExportTableData(details.entriesWithBalance, effectiveCols);
    exportTableJPG(
      `${currentPainter.name} — Paint Ledger`,
      headers,
      rows,
      `${currentPainter.name}_Paint_Ledger`,
      companyName,
      exportDocConfig?.subtitle || 'Paint & Powder Coating Services',
      exportDocConfig?.customNote || `Net Balance: ${fmt(currentBalance)}`,
      exportDocConfig
    );
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden break-words">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3">
        <div>
          <h2 className="font-serif font-black text-xl text-[var(--text)]">{t('paint_title')}</h2>
          <p className="text-xs text-[var(--text-dim)]">{t('paint_sub')}</p>
        </div>

        <button
          type="button"
          onClick={() => setAddPainterModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow transition active:scale-95"
        >
          <Plus size={14} />
          <span>{t('add_painter')}</span>
        </button>
      </div>

      {/* Painters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {painters.map((p, idx) => {
          const totalPaid = p.entries.reduce((s, e) => s + (e.debit || 0), 0);
          const totalWork = p.entries.reduce((s, e) => s + (e.credit || 0), 0);
          const bal = totalWork - totalPaid;

          return (
            <div
              key={p.name}
              className="bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] rounded-xl p-4 flex flex-col justify-between gap-3 shadow-sm transition group"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center text-[var(--yellow)]">
                  <Brush size={16} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm((t('confirm_delete_painter') || 'Delete painter {name}?').replace('{name}', p.name))) {
                      onDeletePainter(p.name);
                    }
                  }}
                  className="p-1.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:text-red-400 opacity-80 group-hover:opacity-100 transition"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-[var(--text)]">{p.name}</h4>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {(p.colours || ['Black', 'White']).map(c => (
                    <span key={c} className="text-[10px] bg-[var(--panel-raised)] px-2 py-0.5 rounded text-[var(--text-dim)]">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--steel-line)] flex items-center justify-between font-mono">
                <div className="text-xs">
                  <span className={`font-bold ${bal > 0 ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>
                    {fmt(Math.abs(bal))}
                  </span>{' '}
                  <span className="text-[10px] text-[var(--text-dim)]">
                    ({bal > 0 ? t('owed') : t('advance')})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPainterIdx(idx)}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] hover:bg-[var(--yellow)] hover:text-black border border-[var(--steel-line)] text-xs font-semibold transition"
                >
                  Ledger
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Painter Modal */}
      {addPainterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-sm max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-3">{t('add_painter')}</h3>
            <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">Painter Name</label>
            <input
              type="text"
              required
              value={newPainterName}
              onChange={e => setNewPainterName(e.target.value)}
              placeholder="e.g. Rashid Painter"
              className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddPainterModal(false)}
                className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newPainterName.trim()) {
                    onSavePainter({ name: newPainterName.trim(), colours: ['Black', 'White', 'Silver'], entries: [] });
                    setNewPainterName('');
                    setAddPainterModal(false);
                  }
                }}
                className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase"
              >
                {t('add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Painter Ledger Detail Modal */}
      {currentPainter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 font-mono">
          <div className="w-full max-w-3xl max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-3 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-serif font-black text-lg sm:text-xl text-[var(--text)]">{currentPainter.name}</h3>
                <span className="text-xs text-[var(--text-dim)]">Painter Ledger & Powder Coating</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsStudioOpen(true)}
                  className="px-2.5 py-1 rounded bg-[var(--yellow)]/15 border border-[var(--yellow)]/30 text-[var(--yellow)] hover:bg-[var(--yellow)]/25 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="Open Ledger Studio to select export columns & visual layout"
                >
                  <Sliders size={12} />
                  <span>Ledger Studio</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportCSV()}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)]"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPDF()}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)]"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleExportJPG()}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-black transition"
                >
                  JPG
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPainterIdx(null)}
                  className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Sub-tab navigation: Ledger & Financials vs WIP Pipeline */}
            <div className="flex items-center gap-2 border-b border-[var(--steel-line)] pb-2 my-2.5">
              <button
                type="button"
                onClick={() => setActivePainterTab('financials')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activePainterTab === 'financials'
                    ? 'bg-[var(--yellow)] text-black shadow'
                    : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                <Brush size={13} />
                <span>Financial Ledger & Accounts</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePainterTab('wip_pipeline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activePainterTab === 'wip_pipeline'
                    ? 'bg-[var(--yellow)] text-black shadow'
                    : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                <Truck size={13} />
                <span>WIP & Powder Coating Pipeline</span>
                {wipMetrics.activeWip > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono ml-1 font-bold">
                    {wipMetrics.activeWip} WIP
                  </span>
                )}
              </button>
            </div>

            {activePainterTab === 'financials' ? (
              <>
                {/* Balance Breakdown Cards */}
            {(() => {
              const details = computePainterLedgerDetails(currentPainter.entries);
              return (
                <div className="my-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Total Work (Credit)</div>
                    <div className="text-base font-bold text-[var(--red)] mt-0.5">{fmt(details.totalCredits)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Total Paid (Debit)</div>
                    <div className="text-base font-bold text-[var(--green)] mt-0.5">{fmt(details.totalDebits)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Net Balance</div>
                    <div
                      className={`text-base font-bold mt-0.5 ${
                        details.netBalance > 0
                          ? 'text-[var(--red)]'
                          : details.netBalance < 0
                          ? 'text-[var(--green)]'
                          : 'text-gray-400'
                      }`}
                    >
                      {fmt(Math.abs(details.netBalance))}
                      <span className="text-[10px] font-normal ml-1">
                        {details.netBalance > 0 ? 'Owed to Painter' : details.netBalance < 0 ? 'Advance Paid' : 'Settled'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Mobile swipe hint */}
            <div className="sm:hidden flex items-center justify-between text-[10px] text-[var(--text-dim)] py-1 px-1">
              <span>← Swipe sideways to view full ledger →</span>
            </div>

            {/* Entries list */}
            <div className="flex-1 overflow-auto max-w-full min-h-[140px] max-h-[45vh] shrink-0 border border-[var(--steel-line)] rounded-lg ledger-scroll-container">
              <table className="w-full text-left text-xs border-collapse min-w-[920px]">
                <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)] sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5 whitespace-nowrap min-w-[90px]">Date</th>
                    <th className="p-2.5 min-w-[200px]">Description</th>
                    <th className="p-2.5 text-right whitespace-nowrap min-w-[110px]">Debit (Paid)</th>
                    <th className="p-2.5 text-right whitespace-nowrap min-w-[115px]">Credit (Work)</th>
                    <th className="p-2.5 text-right whitespace-nowrap min-w-[130px]">Running Balance</th>
                    <th className="p-2.5 whitespace-nowrap min-w-[130px]">Method</th>
                    <th className="p-2.5 text-center whitespace-nowrap min-w-[75px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--steel-line)]">
                  {currentPainter.entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-[var(--text-dim)]">
                        No entries logged yet.
                      </td>
                    </tr>
                  ) : (
                    computePainterLedgerDetails(currentPainter.entries).entriesWithBalance.map(e => (
                      <tr key={e.id} className="hover:bg-[var(--panel-raised)]/50">
                        <td className="p-2.5 whitespace-nowrap">{e.date}</td>
                        <td className="p-2.5">
                          <div className="font-semibold text-[var(--text)]">{e.desc}</div>
                          <div className="text-[10px] text-[var(--text-dim)]">
                            {[e.color, e.itemSize && `${e.itemSize} (${e.itemCount} pcs @ ${e.ratePerItem})`].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-semibold text-[var(--green)] whitespace-nowrap font-mono min-w-[110px]">
                          {e.debit ? fmt(e.debit) : '—'}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-[var(--red)] whitespace-nowrap font-mono min-w-[115px]">
                          {e.credit ? fmt(e.credit) : '—'}
                        </td>
                        <td
                          className={`p-2.5 text-right font-bold whitespace-nowrap font-mono min-w-[130px] ${
                            e.runningBalance > 0
                              ? 'text-[var(--red)]'
                              : e.runningBalance < 0
                              ? 'text-[var(--green)]'
                              : 'text-gray-400'
                          }`}
                        >
                          <span className="tabular-nums">{fmt(Math.abs(e.runningBalance))}</span>
                          <span className="text-[9px] font-normal ml-1 px-1 py-0.2 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text-dim)] inline-block">
                            {e.runningBalance > 0 ? 'Payable' : e.runningBalance < 0 ? 'Adv' : ''}
                          </span>
                        </td>
                        <td className="p-2.5 text-[var(--text-dim)]">
                          <div className="font-semibold text-[var(--text)]">{e.method || '—'}</div>
                          {(e.paidBy || e.paidTo) && (
                            <div className="text-[10px] text-[var(--text-dim)] flex items-center gap-1 mt-0.5 flex-wrap">
                              {e.paidBy && <span>By: <strong className="text-[var(--text)]">{e.paidBy}</strong></span>}
                              {e.paidTo && <span>→ To: <strong className="text-[var(--text)]">{e.paidTo}</strong></span>}
                            </div>
                          )}
                          {e.accountNumber && (
                            <div className="text-[10px] text-[var(--yellow)] font-mono mt-0.5">
                              A/C: {e.accountNumber} {e.bankName && `(${e.bankName})`}
                            </div>
                          )}
                          {(e.chequeNo || e.detail) && (
                            <div className="text-[9px] text-[var(--text-dim)] mt-0.5">
                              Ref: {e.chequeNo || e.detail} {e.chequeStatus && `(${e.chequeStatus})`}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingEntry(e)}
                              className="text-[var(--text-dim)] hover:text-[var(--yellow)] hover:bg-[var(--panel-raised)] p-1 rounded transition cursor-pointer"
                              title="Edit Entry Details"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeletePaintEntry(currentPainter.name, e.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1 rounded transition cursor-pointer"
                              title="Delete Entry"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Quick Add Entry Form */}
            <form onSubmit={handleAddEntry} className="mt-3 pt-3 border-t border-[var(--steel-line)] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-bold text-xs uppercase text-[var(--yellow)]">+ Add Paint Entry</div>
                <button
                  type="button"
                  onClick={() => setShowExtendedPaymentFields(!showExtendedPaymentFields)}
                  className="text-[10px] text-[var(--yellow)] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                >
                  {showExtendedPaymentFields ? 'Hide Payment Channels' : '+ Detailed Payment (By / To / A/C)'}
                </button>
              </div>

              {/* Extended Payment Channels when toggled */}
              {showExtendedPaymentFields && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                  <select
                    value={method}
                    onChange={e => setMethod(e.target.value)}
                    className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Transfer</option>
                    <option value="Online">Online / EasyPaisa</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                  <input
                    type="text"
                    value={entryPaidBy}
                    onChange={e => setEntryPaidBy(e.target.value)}
                    placeholder="Paid By (e.g. Workshop)"
                    className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                  />
                  <input
                    type="text"
                    value={entryPaidTo}
                    onChange={e => setEntryPaidTo(e.target.value)}
                    placeholder={`Paid To (e.g. ${currentPainter.name})`}
                    className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                  />
                  <input
                    type="text"
                    value={entryBankName}
                    onChange={e => setEntryBankName(e.target.value)}
                    placeholder="Bank (e.g. Meezan, HBL)"
                    className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                  />
                  <input
                    type="text"
                    value={entryAccountNumber}
                    onChange={e => setEntryAccountNumber(e.target.value)}
                    placeholder="Account Number / IBAN"
                    className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  required
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="e.g. 18 inch fan rods powder coated"
                  className="sm:col-span-2 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none"
                />
                <input
                  type="text"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  placeholder="Color (e.g. Matt Black)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)]"
                />
                <input
                  type="text"
                  value={itemSize}
                  onChange={e => setItemSize(e.target.value)}
                  placeholder='Size (e.g. 18")'
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input
                  type="number"
                  min="0"
                  value={itemCount}
                  onChange={e => {
                    setItemCount(e.target.value);
                    handleRecalcCredit(e.target.value, ratePerItem);
                  }}
                  placeholder="Item count"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
                <input
                  type="number"
                  min="0"
                  value={ratePerItem}
                  onChange={e => {
                    setRatePerItem(e.target.value);
                    handleRecalcCredit(itemCount, e.target.value);
                  }}
                  placeholder="Rate per item"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
                <input
                  type="number"
                  min="0"
                  value={debit}
                  onChange={e => setDebit(e.target.value)}
                  placeholder="Debit - Paid (Rs)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
                <input
                  type="number"
                  min="0"
                  value={credit}
                  onChange={e => setCredit(e.target.value)}
                  placeholder="Credit - Work (Rs)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-dim)]">
                    <input
                      type="checkbox"
                      checked={isDamage}
                      onChange={e => setIsDamage(e.target.checked)}
                      className="rounded"
                    />
                    <span>Damage Deduction</span>
                  </label>

                  <select
                    value={method}
                    onChange={e => setMethod(e.target.value)}
                    className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow hover:bg-amber-400 transition cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </>
        ) : (
          /* WIP & Powder Coating Pipeline Sub-View */
          <div className="space-y-3">
            {/* WIP Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-sky-500/30">
                <div className="text-[10px] uppercase text-sky-400 font-bold flex items-center gap-1">
                  <ArrowUpRight size={11} />
                  <span>Total Dispatched</span>
                </div>
                <div className="text-base font-bold text-sky-300 mt-1 font-mono">
                  {wipMetrics.totalDispatched} pcs
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-emerald-500/30">
                <div className="text-[10px] uppercase text-emerald-400 font-bold flex items-center gap-1">
                  <ArrowDownLeft size={11} />
                  <span>Received Good</span>
                </div>
                <div className="text-base font-bold text-emerald-300 mt-1 font-mono">
                  {wipMetrics.totalReceived} pcs
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-amber-500/30">
                <div className="text-[10px] uppercase text-amber-400 font-bold flex items-center gap-1">
                  <Clock size={11} />
                  <span>Active WIP At Booth</span>
                </div>
                <div className="text-base font-bold text-amber-300 mt-1 font-mono">
                  {wipMetrics.activeWip} pcs
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-rose-500/30">
                <div className="text-[10px] uppercase text-rose-400 font-bold flex items-center gap-1">
                  <ShieldAlert size={11} />
                  <span>Rejection Rate</span>
                </div>
                <div className="text-base font-bold text-rose-300 mt-1 font-mono">
                  {wipMetrics.rejectionRate.toFixed(1)}%
                  <span className="text-[10px] text-zinc-400 font-normal ml-1">
                    ({wipMetrics.totalRejected} pcs)
                  </span>
                </div>
              </div>
            </div>

            {/* WIP Log Table */}
            <div className="flex-1 overflow-auto max-w-full min-h-[140px] max-h-[35vh] shrink-0 border border-[var(--steel-line)] rounded-lg ledger-scroll-container">
              <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)] sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5 whitespace-nowrap">Date</th>
                    <th className="p-2.5 whitespace-nowrap">Pipeline Event</th>
                    <th className="p-2.5 whitespace-nowrap">Batch / Lot</th>
                    <th className="p-2.5 whitespace-nowrap">Specs (Size / Color)</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Quantity</th>
                    <th className="p-2.5 text-center whitespace-nowrap">QC Status</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Credit Note (Rs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--steel-line)] font-mono">
                  {wipMetrics.wipEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-[var(--text-dim)] font-sans">
                        No WIP dispatch or return entries logged yet. Use the dispatch form below to send rods for coating.
                      </td>
                    </tr>
                  ) : (
                    wipMetrics.wipEntries.map(e => {
                      const isOut = e.entryType === 'dispatch_outward' || e.desc.includes('[JOB-OUT]');
                      return (
                        <tr key={e.id} className="hover:bg-[var(--panel-raised)]/50">
                          <td className="p-2.5 whitespace-nowrap text-zinc-400">{e.date}</td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isOut ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {isOut ? '🚚 Outward Dispatch' : '📥 Inward Return'}
                            </span>
                          </td>
                          <td className="p-2.5 whitespace-nowrap text-amber-300">
                            {e.batchId || 'LOT-GENERAL'}
                          </td>
                          <td className="p-2.5 whitespace-nowrap text-zinc-200">
                            {e.itemSize || '-'} · {e.color || '-'}
                          </td>
                          <td className="p-2.5 text-right font-bold text-zinc-100">
                            {e.itemCount || e.dispatchedQty || e.receivedQty || 0} pcs
                          </td>
                          <td className="p-2.5 text-center">
                            {e.rejectedQty && e.rejectedQty > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold" title={e.rejectionReason}>
                                ⚠️ {e.rejectedQty} Defective
                              </span>
                            ) : (
                              <span className="text-emerald-400 text-[10px]">
                                ✓ Passed QC
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-bold text-amber-400">
                            {e.credit > 0 ? fmt(e.credit) : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* WIP Outward / Inward Logging Form */}
            <form onSubmit={handleAddWipEntry} className="border-t border-[var(--steel-line)] pt-3 space-y-2.5 bg-[var(--panel-raised)]/40 p-3 rounded-xl border">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 bg-black/40 p-0.5 rounded-lg border border-[var(--steel-line)]">
                  <button
                    type="button"
                    onClick={() => setWipDispatchType('outward')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      wipDispatchType === 'outward'
                        ? 'bg-sky-500 text-black shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <ArrowUpRight size={12} />
                    <span>1. Outward Dispatch (Send Raw Rods)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWipDispatchType('inward')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      wipDispatchType === 'inward'
                        ? 'bg-emerald-500 text-black shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <ArrowDownLeft size={12} />
                    <span>2. Inward Return (Receive Painted Rods)</span>
                  </button>
                </div>

                <span className="text-[10px] text-zinc-400 font-mono">
                  Subcontractor: <strong>{currentPainter.name}</strong>
                </span>
              </div>

              {wipDispatchType === 'outward' ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] uppercase text-zinc-400 block mb-0.5">Production Lot</label>
                      <input
                        type="text"
                        value={wipBatchId}
                        onChange={e => setWipBatchId(e.target.value.toUpperCase())}
                        placeholder="e.g. BATCH-2026-09"
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase text-zinc-400 block mb-0.5">Rod Length / Size</label>
                      <input
                        type="text"
                        value={wipSize}
                        onChange={e => setWipSize(e.target.value)}
                        placeholder='e.g. 18", 24", 36"'
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase text-zinc-400 block mb-0.5">Target Powder Color</label>
                      <input
                        type="text"
                        value={wipColor}
                        onChange={e => setWipColor(e.target.value)}
                        placeholder="e.g. Matt Black, Off-White"
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase text-sky-400 font-bold block mb-0.5">Dispatched Pieces (pcs)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={wipDispatchedQty}
                        onChange={e => setWipDispatchedQty(e.target.value)}
                        placeholder="e.g. 500"
                        className="w-full bg-[var(--panel)] border border-sky-500/50 rounded px-2.5 py-1.5 text-xs text-sky-300 font-bold font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-bold uppercase text-xs shadow transition cursor-pointer flex items-center gap-1.5"
                    >
                      <ArrowUpRight size={13} />
                      <span>Dispatch Rods to Painter</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] uppercase text-zinc-400 block mb-0.5">Production Lot</label>
                      <input
                        type="text"
                        value={wipBatchId}
                        onChange={e => setWipBatchId(e.target.value.toUpperCase())}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase text-zinc-400 block mb-0.5">Size & Color</label>
                      <input
                        type="text"
                        value={`${wipSize} · ${wipColor}`}
                        onChange={e => {
                          const parts = e.target.value.split('·');
                          if (parts[0]) setWipSize(parts[0].trim());
                          if (parts[1]) setWipColor(parts[1].trim());
                        }}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase text-emerald-400 font-bold block mb-0.5">Total Received (pcs)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={wipReceivedQty}
                        onChange={e => setWipReceivedQty(e.target.value)}
                        placeholder="e.g. 500"
                        className="w-full bg-[var(--panel)] border border-emerald-500/50 rounded px-2.5 py-1.5 text-xs text-emerald-300 font-bold font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase text-rose-400 font-bold block mb-0.5">Defective / Rejected (pcs)</label>
                      <input
                        type="number"
                        min="0"
                        value={wipRejectedQty}
                        onChange={e => setWipRejectedQty(e.target.value)}
                        placeholder="0"
                        className="w-full bg-[var(--panel)] border border-rose-500/50 rounded px-2.5 py-1.5 text-xs text-rose-300 font-bold font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] uppercase text-zinc-400 block mb-0.5">Defect Reason</label>
                      <select
                        value={wipRejectionReason}
                        onChange={e => setWipRejectionReason(e.target.value)}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-zinc-300"
                      >
                        <option value="Uneven coating / paint run">Uneven coating / paint run</option>
                        <option value="Pinholes & blistering">Pinholes & blistering</option>
                        <option value="Scratched during transit">Scratched during transit</option>
                        <option value="Color shade mismatch">Color shade mismatch</option>
                        <option value="Incomplete coverage / bare spots">Incomplete coverage / bare spots</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase text-zinc-400 block mb-0.5">Coating Rate (Rs / pc)</label>
                      <input
                        type="number"
                        min="1"
                        value={wipUnitRate}
                        onChange={e => setWipUnitRate(e.target.value)}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-4">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-rose-300">
                        <input
                          type="checkbox"
                          checked={wipDeductPenalty}
                          onChange={e => setWipDeductPenalty(e.target.checked)}
                          className="rounded text-rose-500"
                        />
                        <span>Deduct defect penalty from bill</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--steel-line)]/50">
                    <div className="text-xs text-zinc-400">
                      Net Approved: <strong className="text-emerald-400 font-mono">
                        {Math.max(0, (parseFloat(wipReceivedQty) || 0) - (parseFloat(wipRejectedQty) || 0))} pcs
                      </strong> · Payable: <strong className="text-amber-400 font-mono">
                        Rs {fmt(Math.max(0, ((parseFloat(wipReceivedQty) || 0) - (parseFloat(wipRejectedQty) || 0)) * (parseFloat(wipUnitRate) || 18) - (wipDeductPenalty ? (parseFloat(wipRejectedQty) || 0) * (parseFloat(wipUnitRate) || 18) : 0)))}
                      </strong>
                    </div>

                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase text-xs shadow transition cursor-pointer flex items-center gap-1.5"
                    >
                      <ArrowDownLeft size={13} />
                      <span>Receive Inward & Reconcile Bill</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}
          </div>
        </div>
      )}

      {/* Edit Paint Ledger Entry Modal */}
      {editingEntry && currentPainter && (
        <EditLedgerEntryModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          title={`Edit Paint Entry · ${currentPainter.name}`}
          ledgerName={currentPainter.name}
          entry={editingEntry}
          onSave={updated => {
            if (onUpdatePaintEntry) {
              onUpdatePaintEntry(currentPainter.name, editingEntry.id, updated);
            }
          }}
        />
      )}

      {/* Ledger Column & Export Studio Modal */}
      {isStudioOpen && currentPainter && (
        <LedgerStudioModal
          isOpen={isStudioOpen}
          onClose={() => setIsStudioOpen(false)}
          ledgerName={currentPainter.name}
          ledgerSubtitle="Paint & Powder Coating Services Ledger"
          columnConfig={colConfig}
          onUpdateColumnConfig={handleUpdateColConfig}
          companyName={companyName}
          activeBalance={currentBalance}
          sampleRows={currentPainter.entries}
          onExportCSV={cfg => handleExportCSV(cfg)}
          onExportPDF={(cfg, docCfg) => handleExportPDF(cfg, docCfg)}
          onExportJPG={(cfg, docCfg) => handleExportJPG(cfg, docCfg)}
        />
      )}
    </div>
  );
};
