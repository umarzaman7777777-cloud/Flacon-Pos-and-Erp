import React, { useState } from 'react';
import { CustomLedger, CustomLedgerEntry, AppLanguage, LedgerColumnConfig, ExportDocumentConfig } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, downloadCSV, exportTablePDF } from '../utils/helpers';
import { exportTableJPG } from '../utils/exportManager';
import {
  buildLedgerExportTableData,
  getStoredLedgerColumnConfig,
  saveStoredLedgerColumnConfig
} from '../utils/ledgerExportHelper';
import {
  Trash2,
  Download,
  FileText,
  Sliders,
  Edit2,
  Image as ImageIcon,
  Plus,
  Minus,
  Scale,
  Wrench,
  Package,
  Truck,
  Layers,
  CheckCircle2,
  AlertCircle,
  Calculator,
  X,
  Check,
  ArrowRight
} from 'lucide-react';
import { EditLedgerEntryModal } from './EditLedgerEntryModal';
import { LedgerStudioModal, DEFAULT_LEDGER_COLUMNS } from './LedgerStudioModal';

const STANDARD_SIZES_WEIGHTS: Record<string, number> = {
  '6 inch': 0.45,
  '12 inch': 0.65,
  '18 inch': 0.85,
  '24 inch': 1.15,
  '30 inch': 1.45,
  '36 inch': 1.85,
  '48 inch': 2.45,
  '60 inch': 3.10
};

const JOB_WORK_OPERATIONS = [
  'Pipe Cutting',
  'Punching / Drilling',
  'Swaging & Threading',
  'Deburring & Edge Grinding',
  'Powder Coating',
  'Packing'
];

interface CustomLedgerDetailModalProps {
  customLedger: CustomLedger;
  language: AppLanguage;
  companyName: string;
  onClose: () => void;
  onAddEntry: (id: string, entry: Omit<CustomLedgerEntry, 'id'>) => void;
  onDeleteEntry: (ledgerId: string, entryId: string) => void;
  onUpdateEntry?: (ledgerId: string, entryId: string, updatedData: any) => void;
  onUpdateSelfWeightStock: (ledgerId: string, deltaKg: number) => void;
  onDeleteCustomLedger?: (ledgerId: string) => void;
}

export const CustomLedgerDetailModal: React.FC<CustomLedgerDetailModalProps> = ({
  customLedger,
  language,
  companyName,
  onClose,
  onAddEntry,
  onDeleteEntry,
  onUpdateEntry,
  onUpdateSelfWeightStock,
  onDeleteCustomLedger
}) => {
  // Modal states for Raw Material Inward and Adjustment windows
  const [isAddRawModalOpen, setIsAddRawModalOpen] = useState(false);
  const [isDeductRawModalOpen, setIsDeductRawModalOpen] = useState(false);
  const [showEstimatorDrawer, setShowEstimatorDrawer] = useState(false);

  // Inward Raw Material Modal Form State
  const [rawMaterialType, setRawMaterialType] = useState('M.S. Steel Pipe (Self-Weight)');
  const [rawInwardKg, setRawInwardKg] = useState('');
  const [rawVehicleNo, setRawVehicleNo] = useState('');
  const [rawDriverName, setRawDriverName] = useState('');
  const [rawGateRef, setRawGateRef] = useState('');
  const [rawDate, setRawDate] = useState(todayISO());
  const [rawNotes, setRawNotes] = useState('');
  const [rawLogEntryInLedger, setRawLogEntryInLedger] = useState(true);

  // Deduct / Adjust Raw Material Modal Form State
  const [rawDeductKg, setRawDeductKg] = useState('');
  const [rawDeductReason, setRawDeductReason] = useState('Customer Pickup / Scrap Return');
  const [rawDeductDate, setRawDeductDate] = useState(todayISO());
  const [rawDeductNotes, setRawDeductNotes] = useState('');
  const [rawDeductLogLedger, setRawDeductLogLedger] = useState(true);

  // Form Mode & Tab
  const [entryCategory, setEntryCategory] = useState<'job_work' | 'general' | 'payment'>('job_work');

  // Job-Work (Labour Only) Form State
  const [jwSize, setJwSize] = useState('18 inch');
  const [jwQty, setJwQty] = useState('100');
  const [jwWeightPerRod, setJwWeightPerRod] = useState(String(STANDARD_SIZES_WEIGHTS['18 inch'] || 0.85));
  const [jwLabourRate, setJwLabourRate] = useState('25');
  const [jwSelectedOps, setJwSelectedOps] = useState<string[]>([
    'Pipe Cutting',
    'Punching / Drilling',
    'Swaging & Threading'
  ]);
  const [jwAutoDeductStock, setJwAutoDeductStock] = useState(true);

  // General Entry Form State
  const [desc, setDesc] = useState('');
  const [size, setSize] = useState('18 inch');
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [debit, setDebit] = useState('');
  const [credit, setCredit] = useState('');
  const [date] = useState(todayISO());

  // Detailed payment & Studio states
  const [editingEntry, setEditingEntry] = useState<CustomLedgerEntry | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [colConfig, setColConfig] = useState<LedgerColumnConfig>(() =>
    getStoredLedgerColumnConfig('custom', DEFAULT_LEDGER_COLUMNS)
  );
  const [showExtendedPaymentFields, setShowExtendedPaymentFields] = useState(false);
  const [entryMethod, setEntryMethod] = useState('Cash');
  const [entryPaidBy, setEntryPaidBy] = useState('');
  const [entryPaidTo, setEntryPaidTo] = useState('');
  const [entryBankName, setEntryBankName] = useState('');
  const [entryAccountNumber, setEntryAccountNumber] = useState('');
  const [entryChequeNo, setEntryChequeNo] = useState('');

  const handleUpdateColConfig = (newCfg: LedgerColumnConfig) => {
    setColConfig(newCfg);
    saveStoredLedgerColumnConfig('custom', newCfg);
  };

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const totalDebit = customLedger.entries.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = customLedger.entries.reduce((s, e) => s + (e.credit || 0), 0);
  const netBalance = totalDebit - totalCredit;
  const currentCustomerStock = customLedger.selfWeightStock || 0;

  // Real-time Job-Work Calculations
  const jwParsedQty = parseInt(jwQty, 10) || 0;
  const jwParsedWeightPerRod = parseFloat(jwWeightPerRod) || 0;
  const jwParsedLabourRate = parseFloat(jwLabourRate) || 0;

  const jwTotalSteelNeededKg = Number((jwParsedQty * jwParsedWeightPerRod).toFixed(2));
  const jwTotalLabourCostBilled = Math.round(jwParsedQty * jwParsedLabourRate);
  const jwRemainingCustomerStock = Number((currentCustomerStock - jwTotalSteelNeededKg).toFixed(2));
  const jwHasStockShortage = jwRemainingCustomerStock < 0;

  // Handle Size Change in Job-Work
  const handleJwSizeChange = (newSize: string) => {
    setJwSize(newSize);
    if (STANDARD_SIZES_WEIGHTS[newSize]) {
      setJwWeightPerRod(String(STANDARD_SIZES_WEIGHTS[newSize]));
    }
  };

  const toggleJwOperation = (op: string) => {
    setJwSelectedOps(prev =>
      prev.includes(op) ? prev.filter(o => o !== op) : [...prev, op]
    );
  };

  // Submit Job-Work Entry (Labour Only, steel deducted from customer stock)
  const handleJobWorkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (jwParsedQty <= 0 || jwParsedLabourRate <= 0) return;

    const opsSummary = jwSelectedOps.length > 0 ? jwSelectedOps.join(', ') : 'Direct Fabrication';
    const entryDesc = `[JOB-WORK] ${jwParsedQty} pcs ${jwSize} Down Rods (${opsSummary}) · Labour @ Rs ${jwParsedLabourRate}/pc · Consumed ${jwTotalSteelNeededKg} kg Customer Steel`;

    onAddEntry(customLedger.id, {
      date,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      desc: entryDesc,
      size: jwSize,
      qty: jwParsedQty,
      rate: jwParsedLabourRate,
      debit: jwTotalLabourCostBilled,
      credit: 0,
      weight: String(jwTotalSteelNeededKg),
      weightPerItem: jwParsedWeightPerRod,
      selfWeightStock: jwAutoDeductStock ? jwRemainingCustomerStock : currentCustomerStock,
      material: 'Customer Steel Pipe',
      detail: `Customer provided raw steel. Billed for labour only (${opsSummary}).`
    });

    if (jwAutoDeductStock && jwTotalSteelNeededKg > 0) {
      onUpdateSelfWeightStock(customLedger.id, -jwTotalSteelNeededKg);
    }

    setJwQty('100');
  };

  const handleQtyRateChange = (newQty: string, newRate: string) => {
    setQty(newQty);
    setRate(newRate);
    const q = parseFloat(newQty) || 0;
    const r = parseFloat(newRate) || 0;
    if (q > 0 && r > 0) {
      setDebit((q * r).toString());
    }
  };

  // Submit General Billed Entry or Payment
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dVal = parseFloat(debit) || 0;
    const cVal = parseFloat(credit) || 0;
    if (dVal <= 0 && cVal <= 0) return;

    onAddEntry(customLedger.id, {
      date,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      desc: desc.trim() || 'Job-work entry',
      size,
      qty: qty ? parseInt(qty, 10) : undefined,
      rate: rate ? parseFloat(rate) : undefined,
      debit: dVal,
      credit: cVal,
      method: cVal > 0 ? entryMethod : undefined,
      paidBy: entryPaidBy.trim() || undefined,
      paidTo: entryPaidTo.trim() || undefined,
      bankName: entryBankName.trim() || undefined,
      accountNumber: entryAccountNumber.trim() || undefined,
      chequeNo: entryChequeNo.trim() || undefined
    });

    setDesc('');
    setQty('');
    setRate('');
    setDebit('');
    setCredit('');
    setEntryPaidBy('');
    setEntryPaidTo('');
    setEntryBankName('');
    setEntryAccountNumber('');
    setEntryChequeNo('');
  };

  // Submit Inward Customer Raw Material
  const handleConfirmAddRawMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    const weightVal = parseFloat(rawInwardKg) || 0;
    if (weightVal <= 0) return;

    onUpdateSelfWeightStock(customLedger.id, weightVal);

    if (rawLogEntryInLedger) {
      const detailsList = [
        rawVehicleNo ? `Vehicle: ${rawVehicleNo}` : '',
        rawDriverName ? `Driver: ${rawDriverName}` : '',
        rawGateRef ? `Gate: ${rawGateRef}` : '',
        rawNotes ? rawNotes : ''
      ].filter(Boolean).join(' · ');

      onAddEntry(customLedger.id, {
        date: rawDate,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        desc: `[RAW-INWARD] Customer delivered +${weightVal.toFixed(1)} kg ${rawMaterialType}${detailsList ? ` (${detailsList})` : ''}`,
        debit: 0,
        credit: 0,
        weight: String(weightVal),
        material: rawMaterialType,
        selfWeightStock: currentCustomerStock + weightVal,
        detail: `Customer provided raw material. Allocated strictly to ${customLedger.name}.`
      });
    }

    setIsAddRawModalOpen(false);
    setRawInwardKg('');
    setRawVehicleNo('');
    setRawDriverName('');
    setRawGateRef('');
    setRawNotes('');
  };

  // Submit Customer Raw Material Deduction / Return
  const handleConfirmDeductRawMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    const deductVal = parseFloat(rawDeductKg) || 0;
    if (deductVal <= 0) return;

    onUpdateSelfWeightStock(customLedger.id, -deductVal);

    if (rawDeductLogLedger) {
      onAddEntry(customLedger.id, {
        date: rawDeductDate,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        desc: `[RAW-ADJUST] Deducted -${deductVal.toFixed(1)} kg customer raw steel (${rawDeductReason})${rawDeductNotes ? ` · Note: ${rawDeductNotes}` : ''}`,
        debit: 0,
        credit: 0,
        weight: String(-deductVal),
        selfWeightStock: Math.max(0, currentCustomerStock - deductVal)
      });
    }

    setIsDeductRawModalOpen(false);
    setRawDeductKg('');
    setRawDeductNotes('');
  };

  const handleExportCSV = (customCols?: LedgerColumnConfig) => {
    const effectiveCols = customCols || colConfig;
    const { headers, rows } = buildLedgerExportTableData(
      customLedger.entries.map(e => ({
        ...e,
        runningBalance: (e.debit || 0) - (e.credit || 0)
      })),
      effectiveCols
    );
    downloadCSV(`${customLedger.name}_JobWork_Ledger`, headers, rows);
  };

  const handleExportPDF = (customCols?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    const effectiveCols = customCols || colConfig;
    const { headers, rows } = buildLedgerExportTableData(
      customLedger.entries.map(e => ({
        ...e,
        runningBalance: (e.debit || 0) - (e.credit || 0)
      })),
      effectiveCols
    );
    exportTablePDF(
      `${customLedger.name} — Job-Work & Ancillary Ledger`,
      headers,
      rows,
      `${customLedger.name.replace(/\s+/g, '_')}_JobWork_Ledger`,
      exportDocConfig?.orientation || 'landscape',
      companyName,
      exportDocConfig?.subtitle || 'Customer Raw Material & Direct Labour Ledger',
      exportDocConfig?.customNote || `Net Financial Due: ${fmt(netBalance)} | Customer Steel Stock: ${currentCustomerStock.toFixed(1)} kg`,
      exportDocConfig
    );
  };

  const handleExportJPG = (customCols?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    const effectiveCols = customCols || colConfig;
    const { headers, rows } = buildLedgerExportTableData(
      customLedger.entries.map(e => ({
        ...e,
        runningBalance: (e.debit || 0) - (e.credit || 0)
      })),
      effectiveCols
    );
    exportTableJPG(
      `${customLedger.name} — Job-Work & Ancillary Ledger`,
      headers,
      rows,
      `${customLedger.name.replace(/\s+/g, '_')}_JobWork_Ledger`,
      companyName,
      exportDocConfig?.subtitle || 'Customer Raw Material & Direct Labour Ledger',
      exportDocConfig?.customNote || `Net Financial Due: ${fmt(netBalance)} | Customer Steel Stock: ${currentCustomerStock.toFixed(1)} kg`,
      exportDocConfig
    );
  };

  const handleDeleteLedger = () => {
    if (!onDeleteCustomLedger) return;
    if (window.confirm(`Are you sure you want to delete the entire custom ledger for "${customLedger.name}"? This cannot be undone.`)) {
      onDeleteCustomLedger(customLedger.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 font-mono">
      <div className="w-full max-w-4xl max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-3 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3 flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif font-black text-lg sm:text-xl text-[var(--text)]">{customLedger.name}</h3>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase tracking-wider">
                Customer Material & Labour Job-Work
              </span>
            </div>
            <p className="text-xs text-[var(--text-dim)] mt-0.5">
              Customer provides their own raw material · Billed strictly for direct labour & processing charges
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowEstimatorDrawer(!showEstimatorDrawer)}
              className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                showEstimatorDrawer
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-amber-400 hover:border-amber-400'
              }`}
              title="Toggle Live Production Capacity & Labour Yield Estimator"
            >
              <Calculator size={13} />
              <span>Estimator</span>
            </button>
            <button
              type="button"
              onClick={() => setIsStudioOpen(true)}
              className="px-2.5 py-1 rounded bg-[var(--yellow)]/15 border border-[var(--yellow)]/30 text-[var(--yellow)] hover:bg-[var(--yellow)]/25 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Open Ledger Studio to select export columns & visual layout"
            >
              <Sliders size={12} />
              <span>Studio</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportPDF()}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-red-500/60 text-xs font-semibold text-red-400 hover:text-red-300 transition cursor-pointer"
              title="Export PDF Document"
            >
              <FileText size={13} />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportJPG()}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-amber-400 hover:text-amber-300 transition cursor-pointer"
              title="Export JPG Image"
            >
              <ImageIcon size={13} />
              <span>JPG</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportCSV()}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer"
              title="Export CSV Spreadsheet"
            >
              <Download size={13} />
              <span>CSV</span>
            </button>
            {onDeleteCustomLedger && (
              <button
                type="button"
                onClick={handleDeleteLedger}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/10 border border-red-500/30 hover:border-red-500 text-xs font-semibold text-red-400 hover:text-red-300 transition cursor-pointer"
                title="Delete this entire custom ledger"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Live Estimator & Simulation Drawer when toggled */}
        {showEstimatorDrawer && (
          <div className="my-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
              <div className="font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Calculator size={14} />
                <span>Customer Raw Steel & Labour Estimator</span>
              </div>
              <span className="text-[10px] text-zinc-400">
                Live Capacity Simulation Based on Allocated Steel
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]">
                <div className="text-[10px] uppercase text-zinc-400">Current Steel Balance</div>
                <div className="text-lg font-bold text-amber-300 font-mono mt-0.5">
                  {currentCustomerStock.toFixed(1)} kg
                </div>
                <div className="text-[10px] text-zinc-500">Separately allocated stock</div>
              </div>

              <div className="p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]">
                <div className="text-[10px] uppercase text-zinc-400">Production Capacity (18" Rods)</div>
                <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                  ~{Math.floor(currentCustomerStock / 0.85)} pcs
                </div>
                <div className="text-[10px] text-zinc-500">At standard 0.85 kg per rod</div>
              </div>

              <div className="p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]">
                <div className="text-[10px] uppercase text-zinc-400">Potential Labour Revenue</div>
                <div className="text-lg font-bold text-[var(--yellow)] font-mono mt-0.5">
                  {fmt(Math.floor(currentCustomerStock / 0.85) * 25)}
                </div>
                <div className="text-[10px] text-zinc-500">At Rs 25/pc direct labour rate</div>
              </div>
            </div>
          </div>
        )}

        {/* Balance and Customer Raw Stock Banner */}
        <div className="my-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
            <div className="text-[10px] uppercase text-[var(--text-dim)]">Net Financial Balance Due</div>
            <div className={`text-xl font-bold mt-1 ${netBalance > 0 ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>
              {fmt(Math.abs(netBalance))}
            </div>
            <div className="text-[10px] text-[var(--text-dim)]">
              {netBalance > 0 ? 'Party owes us for labour / work (Receivable)' : netBalance < 0 ? 'Advance received from party' : 'Settled (Nil)'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-[10px] uppercase text-[var(--text-dim)] flex items-center gap-1.5">
                <Layers size={12} className="text-amber-400" />
                <span>Customer Raw Material Stock</span>
              </div>
              <div className="text-xl font-bold text-[var(--yellow)] mt-1 font-mono">
                {currentCustomerStock.toFixed(1)} <span className="text-xs font-normal text-zinc-400">kg</span>
              </div>
              <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                Capacity: ~{Math.floor(currentCustomerStock / 0.85)} pcs 18" Down Rods
              </div>
            </div>

            <div className="flex gap-1.5 items-center">
              <button
                type="button"
                id="btn-add-customer-raw-material"
                onClick={() => setIsAddRawModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
                title="Open window to record customer-supplied raw material inward"
              >
                <Plus size={13} strokeWidth={2.5} />
                <span>+ Add Raw Material</span>
              </button>
              <button
                type="button"
                id="btn-adjust-customer-raw-material"
                onClick={() => setIsDeductRawModalOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-amber-400 text-[var(--text-dim)] hover:text-[var(--text)] text-xs font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95"
                title="Deduct or adjust customer raw material"
              >
                <Minus size={13} />
                <span>Adjust</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile swipe hint */}
        <div className="sm:hidden flex items-center justify-between text-[10px] text-[var(--text-dim)] py-1 px-1">
          <span>← Swipe sideways to view full ledger →</span>
        </div>

        {/* Entries Table */}
        <div className="flex-1 overflow-auto max-w-full min-h-[140px] max-h-[42vh] shrink-0 border border-[var(--steel-line)] rounded-lg ledger-scroll-container">
          <table className="w-full text-left text-xs border-collapse min-w-[850px]">
            <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)] sticky top-0 z-10">
              <tr>
                <th className="p-2.5 whitespace-nowrap min-w-[90px]">Date</th>
                <th className="p-2.5 min-w-[240px]">Description & Work Details</th>
                <th className="p-2.5 whitespace-nowrap min-w-[120px]">Size / Qty / Rate</th>
                <th className="p-2.5 text-right whitespace-nowrap min-w-[110px]">Debit (Labour Billed)</th>
                <th className="p-2.5 text-right whitespace-nowrap min-w-[115px]">Credit (Payment)</th>
                <th className="p-2.5 text-center whitespace-nowrap min-w-[75px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--steel-line)]">
              {customLedger.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[var(--text-dim)]">
                    No entries logged yet. Click "+ Add Raw Material" or log a Job-Work entry below.
                  </td>
                </tr>
              ) : (
                customLedger.entries.map(e => {
                  const isRawInward = e.desc.startsWith('[RAW-INWARD]');
                  const isJobWork = e.desc.startsWith('[JOB-WORK]');
                  const isPayment = (e.credit || 0) > 0;

                  return (
                    <tr key={e.id} className="hover:bg-[var(--panel-raised)]/50">
                      <td className="p-2.5 whitespace-nowrap text-[var(--text-dim)]">{e.date}</td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isRawInward && (
                            <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-bold uppercase">
                              Raw Inward
                            </span>
                          )}
                          {isJobWork && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold uppercase">
                              Labour Job-Work
                            </span>
                          )}
                          {isPayment && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold uppercase">
                              Payment
                            </span>
                          )}
                          <span className="font-semibold text-[var(--text)]">{e.desc}</span>
                        </div>
                        {e.detail && <div className="text-[10px] text-[var(--text-dim)] mt-0.5">{e.detail}</div>}
                      </td>
                      <td className="p-2.5 text-[var(--text-dim)] whitespace-nowrap">
                        {[e.size, e.qty && `${e.qty} pcs`, e.rate && `@ ${fmt(e.rate)}`].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="p-2.5 text-right font-semibold text-[var(--red)] whitespace-nowrap font-mono min-w-[110px]">
                        {e.debit ? fmt(e.debit) : '—'}
                      </td>
                      <td className="p-2.5 text-right font-semibold text-[var(--green)] whitespace-nowrap font-mono min-w-[115px]">
                        {e.credit ? (
                          <div>
                            <div>{fmt(e.credit)}</div>
                            {e.method && (
                              <div className="text-[10px] text-[var(--yellow)] font-mono">{e.method}</div>
                            )}
                            {(e.paidBy || e.paidTo) && (
                              <div className="text-[9px] text-[var(--text-dim)] flex items-center justify-end gap-1 flex-wrap">
                                {e.paidBy && <span>By: <strong className="text-[var(--text)]">{e.paidBy}</strong></span>}
                                {e.paidTo && <span>→ To: <strong className="text-[var(--text)]">{e.paidTo}</strong></span>}
                              </div>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingEntry(e)}
                            className="p-1 rounded bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[var(--text-dim)] hover:text-[var(--yellow)] transition cursor-pointer"
                            title="Edit entry"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteEntry(customLedger.id, e.id)}
                            className="p-1 rounded bg-[var(--panel)] border border-[var(--steel-line)] hover:border-red-500 text-[var(--text-dim)] hover:text-red-400 transition cursor-pointer"
                            title="Delete entry"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Action Form with Dedicated Job-Work (Customer Steel + Labour Cost) Mode */}
        <div className="mt-3 pt-3 border-t border-[var(--steel-line)] space-y-2.5 text-xs">
          {/* Category Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-[var(--panel-raised)] p-1 rounded-xl border border-[var(--steel-line)]">
              <button
                type="button"
                onClick={() => setEntryCategory('job_work')}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  entryCategory === 'job_work'
                    ? 'bg-amber-500 text-black shadow'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                <Wrench size={13} />
                <span>1. Job-Work (Customer Steel + Labour Cost)</span>
              </button>

              <button
                type="button"
                onClick={() => setEntryCategory('general')}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  entryCategory === 'general'
                    ? 'bg-amber-500 text-black shadow'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                <Package size={13} />
                <span>2. General Debit / Sale</span>
              </button>

              <button
                type="button"
                onClick={() => setEntryCategory('payment')}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  entryCategory === 'payment'
                    ? 'bg-emerald-500 text-black shadow'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                <CheckCircle2 size={13} />
                <span>3. Payment Received</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsAddRawModalOpen(true)}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer underline"
            >
              <Plus size={12} />
              <span>Receive Customer Raw Material (+kg)</span>
            </button>
          </div>

          {/* Form 1: Job-Work Mode (Customer Steel + Labour Only) */}
          {entryCategory === 'job_work' && (
            <form onSubmit={handleJobWorkSubmit} className="space-y-2.5 bg-[var(--panel-raised)]/40 p-3 rounded-xl border border-[var(--steel-line)]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] uppercase text-zinc-400 block mb-0.5">Rod Length / Size</label>
                  <select
                    value={jwSize}
                    onChange={e => handleJwSizeChange(e.target.value)}
                    className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)] outline-none"
                  >
                    {Object.keys(STANDARD_SIZES_WEIGHTS).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="Custom Length">Custom Length...</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase text-zinc-400 block mb-0.5">Quantity (pcs)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={jwQty}
                    onChange={e => setJwQty(e.target.value)}
                    placeholder="e.g. 200"
                    className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)] font-bold outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase text-zinc-400 block mb-0.5">Steel Weight / Rod (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.1"
                    value={jwWeightPerRod}
                    onChange={e => setJwWeightPerRod(e.target.value)}
                    placeholder="e.g. 0.85"
                    className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)] outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase text-amber-400 font-bold block mb-0.5">Labour Rate (Rs / pc)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    min="1"
                    value={jwLabourRate}
                    onChange={e => setJwLabourRate(e.target.value)}
                    placeholder="e.g. 25"
                    className="w-full bg-[var(--panel)] border border-amber-500/40 rounded px-2 py-1.5 text-xs text-amber-300 font-bold outline-none font-mono"
                  />
                </div>
              </div>

              {/* Operations Checkbox Pills */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase text-zinc-400 block">Fabrication Operations Included:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {JOB_WORK_OPERATIONS.map(op => {
                    const isSelected = jwSelectedOps.includes(op);
                    return (
                      <button
                        key={op}
                        type="button"
                        onClick={() => toggleJwOperation(op)}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-[var(--panel)] border-[var(--steel-line)] text-zinc-400 hover:text-white'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}{op}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Math Summary Card */}
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-amber-500/30 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] uppercase text-zinc-400">Customer Steel Consumed</div>
                  <div className="text-base font-bold text-amber-400 font-mono mt-0.5">
                    {jwTotalSteelNeededKg.toFixed(1)} kg
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {jwParsedQty} rods × {jwParsedWeightPerRod} kg/rod
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase text-zinc-400">Customer Stock Remaining</div>
                  <div className={`text-base font-bold font-mono mt-0.5 ${jwHasStockShortage ? 'text-red-400' : 'text-emerald-400'}`}>
                    {jwRemainingCustomerStock.toFixed(1)} kg
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {jwHasStockShortage ? (
                      <span className="text-red-400 font-bold">Shortage of {Math.abs(jwRemainingCustomerStock).toFixed(1)} kg</span>
                    ) : (
                      <span>Sufficient allocated stock</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase text-zinc-400">Direct Labour Charges Billed</div>
                  <div className="text-base font-bold text-[var(--yellow)] font-mono mt-0.5">
                    {fmt(jwTotalLabourCostBilled)}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Labour only (Raw steel cost = Rs 0)
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={jwAutoDeductStock}
                    onChange={e => setJwAutoDeductStock(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                  <span>Auto-deduct {jwTotalSteelNeededKg.toFixed(1)} kg from customer raw stock</span>
                </label>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--yellow)] hover:bg-amber-400 text-black font-bold uppercase text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14} strokeWidth={2.5} />
                  <span>Save Job-Work Entry ({fmt(jwTotalLabourCostBilled)})</span>
                </button>
              </div>
            </form>
          )}

          {/* Form 2: General Billed Entry */}
          {entryCategory === 'general' && (
            <form onSubmit={handleAddSubmit} className="space-y-2 bg-[var(--panel-raised)]/40 p-3 rounded-xl border border-[var(--steel-line)]">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  required
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Description (e.g. 500 rods made, special threading)"
                  className="sm:col-span-2 bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] outline-none"
                />
                <input
                  type="text"
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  placeholder='Size (e.g. 18")'
                  className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)] outline-none"
                />
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="number"
                    value={qty}
                    onChange={e => handleQtyRateChange(e.target.value, rate)}
                    placeholder="Qty (pcs)"
                    className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)] outline-none"
                  />
                  <input
                    type="number"
                    value={rate}
                    onChange={e => handleQtyRateChange(qty, e.target.value)}
                    placeholder="Rate/pc"
                    className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <input
                  type="number"
                  min="0"
                  required
                  value={debit}
                  onChange={e => setDebit(e.target.value)}
                  placeholder="Debit / Billed (Rs)"
                  className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--red)] font-bold outline-none"
                />
                <div />
                <button
                  type="submit"
                  className="py-1.5 rounded-lg bg-[var(--yellow)] hover:bg-amber-400 text-black font-bold uppercase text-xs shadow transition cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          )}

          {/* Form 3: Payment Received */}
          {entryCategory === 'payment' && (
            <form onSubmit={handleAddSubmit} className="space-y-2.5 bg-[var(--panel-raised)]/40 p-3 rounded-xl border border-[var(--steel-line)]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] uppercase text-zinc-400 block mb-0.5">Amount Received (Rs)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={credit}
                    onChange={e => setCredit(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full bg-[var(--panel)] border border-emerald-500/50 rounded px-2.5 py-1.5 text-xs text-emerald-300 font-bold outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase text-zinc-400 block mb-0.5">Payment Method</label>
                  <select
                    value={entryMethod}
                    onChange={e => setEntryMethod(e.target.value)}
                    className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)] outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Transfer</option>
                    <option value="Online">Online / EasyPaisa / JazzCash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase text-zinc-400 block mb-0.5">Paid By (Person / Party)</label>
                  <input
                    type="text"
                    value={entryPaidBy}
                    onChange={e => setEntryPaidBy(e.target.value)}
                    placeholder="e.g. Haji Munir"
                    className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase text-zinc-400 block mb-0.5">Received In (Account / Cashier)</label>
                  <input
                    type="text"
                    value={entryPaidTo}
                    onChange={e => setEntryPaidTo(e.target.value)}
                    placeholder="e.g. Workshop Cashier"
                    className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase text-xs shadow-md transition cursor-pointer"
                >
                  Record Payment Received ({fmt(parseFloat(credit) || 0)})
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* MODAL 1: Dedicated Customer Raw Material Inward Window */}
      {isAddRawModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-3 sm:p-4 font-mono animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[var(--panel)] border border-amber-500/50 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3.5">
            <div className="flex items-start justify-between border-b border-[var(--steel-line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <Scale size={20} />
                </div>
                <div>
                  <h4 className="font-serif font-black text-base text-[var(--text)]">
                    Receive Customer Raw Material
                  </h4>
                  <p className="text-xs text-amber-300/80">
                    Party: <strong>{customLedger.name}</strong> · Allocated Inventory
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddRawModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmAddRawMaterial} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] uppercase text-zinc-400 block mb-1">Material Specification</label>
                <select
                  value={rawMaterialType}
                  onChange={e => setRawMaterialType(e.target.value)}
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none"
                >
                  <option value="M.S. Steel Pipe (16 Gauge)">M.S. Steel Pipe (16 Gauge)</option>
                  <option value="M.S. Steel Pipe (14 Gauge)">M.S. Steel Pipe (14 Gauge)</option>
                  <option value="Heavy Gauge Prime Pipe">Heavy Gauge Prime Pipe</option>
                  <option value="Steel Rod Coils">Steel Rod Coils</option>
                  <option value="Hardware / Earthing Bolt Sets">Hardware / Earthing Bolt Sets</option>
                  <option value="Customer Custom Pipe">Customer Custom Pipe</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase text-amber-400 font-bold block mb-1">
                  Inward Weight (kg)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    required
                    min="0.1"
                    value={rawInwardKg}
                    onChange={e => setRawInwardKg(e.target.value)}
                    placeholder="e.g. 500.0"
                    className="w-full bg-[var(--panel-raised)] border border-amber-500/60 focus:border-amber-400 rounded-xl pl-3 pr-10 py-2.5 text-sm font-bold text-amber-300 font-mono outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-bold">
                    kg
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase text-zinc-400 block mb-1">Vehicle / Bilty No.</label>
                  <input
                    type="text"
                    value={rawVehicleNo}
                    onChange={e => setRawVehicleNo(e.target.value)}
                    placeholder="e.g. LES-1980"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--text)] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-zinc-400 block mb-1">Driver / Delivered By</label>
                  <input
                    type="text"
                    value={rawDriverName}
                    onChange={e => setRawDriverName(e.target.value)}
                    placeholder="e.g. M. Aslam"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--text)] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase text-zinc-400 block mb-1">Gate Pass / Slip Ref #</label>
                  <input
                    type="text"
                    value={rawGateRef}
                    onChange={e => setRawGateRef(e.target.value)}
                    placeholder="e.g. GP-CUST-042"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--text)] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-zinc-400 block mb-1">Receiving Date</label>
                  <input
                    type="date"
                    value={rawDate}
                    onChange={e => setRawDate(e.target.value)}
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--text)] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase text-zinc-400 block mb-1">Remarks / Quality Condition</label>
                <input
                  type="text"
                  value={rawNotes}
                  onChange={e => setRawNotes(e.target.value)}
                  placeholder="e.g. Customer provided 16G M.S. steel pipe for 18-inch down rods"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--text)] outline-none"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-[11px] text-blue-300">
                <span>New Allocated Steel Balance: </span>
                <strong className="text-white font-mono">
                  {(currentCustomerStock + (parseFloat(rawInwardKg) || 0)).toFixed(1)} kg
                </strong>
                <span className="text-blue-400 ml-1">
                  (Equivalent to ~{Math.floor((currentCustomerStock + (parseFloat(rawInwardKg) || 0)) / 0.85)} pcs 18" rods)
                </span>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-300 pt-1">
                <input
                  type="checkbox"
                  checked={rawLogEntryInLedger}
                  onChange={e => setRawLogEntryInLedger(e.target.checked)}
                  className="rounded text-amber-500"
                />
                <span>Also record Inward Slip in this customer ledger table</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--steel-line)]">
                <button
                  type="button"
                  onClick={() => setIsAddRawModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-[var(--steel-line)] text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>Confirm Inward Stock (+{parseFloat(rawInwardKg) || 0} kg)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Dedicated Customer Raw Material Deduction / Adjustment Window */}
      {isDeductRawModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-3 sm:p-4 font-mono animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3.5">
            <div className="flex items-start justify-between border-b border-[var(--steel-line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/40">
                  <Minus size={20} />
                </div>
                <div>
                  <h4 className="font-serif font-black text-base text-[var(--text)]">
                    Deduct / Adjust Customer Steel
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Party: <strong>{customLedger.name}</strong> · Current: {currentCustomerStock.toFixed(1)} kg
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeductRawModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmDeductRawMaterial} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] uppercase text-zinc-400 block mb-1">Adjustment Reason</label>
                <select
                  value={rawDeductReason}
                  onChange={e => setRawDeductReason(e.target.value)}
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none"
                >
                  <option value="Customer Pickup / Scrap Return">Customer Pickup / Scrap Return</option>
                  <option value="Off-cut Scrap Write-off">Off-cut Scrap Write-off</option>
                  <option value="Physical Stock Count Correction">Physical Stock Count Correction</option>
                  <option value="Transferred to Other Production Order">Transferred to Other Production Order</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase text-red-400 font-bold block mb-1">
                  Weight to Deduct (kg)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    required
                    min="0.1"
                    max={currentCustomerStock > 0 ? currentCustomerStock : undefined}
                    value={rawDeductKg}
                    onChange={e => setRawDeductKg(e.target.value)}
                    placeholder="e.g. 50.0"
                    className="w-full bg-[var(--panel-raised)] border border-red-500/60 rounded-xl pl-3 pr-10 py-2.5 text-sm font-bold text-red-300 font-mono outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-bold">
                    kg
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase text-zinc-400 block mb-1">Notes / Voucher Details</label>
                <input
                  type="text"
                  value={rawDeductNotes}
                  onChange={e => setRawDeductNotes(e.target.value)}
                  placeholder="e.g. Customer representative picked up off-cut scrap"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--text)] outline-none"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-900 border border-[var(--steel-line)] text-[11px] text-zinc-400">
                <span>Remaining Steel Balance After Deduction: </span>
                <strong className="text-white font-mono">
                  {Math.max(0, currentCustomerStock - (parseFloat(rawDeductKg) || 0)).toFixed(1)} kg
                </strong>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-300 pt-1">
                <input
                  type="checkbox"
                  checked={rawDeductLogLedger}
                  onChange={e => setRawDeductLogLedger(e.target.checked)}
                  className="rounded text-amber-500"
                />
                <span>Log Adjustment entry in this customer ledger table</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--steel-line)]">
                <button
                  type="button"
                  onClick={() => setIsDeductRawModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-[var(--steel-line)] text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs uppercase shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  <Minus size={14} />
                  <span>Confirm Deduction (-{parseFloat(rawDeductKg) || 0} kg)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Custom Ledger Entry Modal */}
      {editingEntry && (
        <EditLedgerEntryModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          title={`Edit Entry · ${customLedger.name}`}
          ledgerName={customLedger.name}
          entry={editingEntry}
          onSave={updated => {
            if (onUpdateEntry) {
              onUpdateEntry(customLedger.id, editingEntry.id, updated);
            }
          }}
        />
      )}

      {/* Ledger Column & Export Studio Modal */}
      {isStudioOpen && (
        <LedgerStudioModal
          isOpen={isStudioOpen}
          onClose={() => setIsStudioOpen(false)}
          ledgerName={customLedger.name}
          ledgerSubtitle="Customer Raw Material & Direct Labour Ledger"
          columnConfig={colConfig}
          onUpdateColumnConfig={handleUpdateColConfig}
          companyName={companyName}
          activeBalance={netBalance}
          sampleRows={customLedger.entries.map(e => ({
            ...e,
            runningBalance: (e.debit || 0) - (e.credit || 0)
          }))}
          onExportCSV={cfg => handleExportCSV(cfg)}
          onExportPDF={(cfg, docCfg) => handleExportPDF(cfg, docCfg)}
          onExportJPG={(cfg, docCfg) => handleExportJPG(cfg, docCfg)}
        />
      )}
    </div>
  );
};
