import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  CheckSquare,
  Download,
  Sliders,
  CreditCard,
  Image as ImageIcon,
  Package,
  Wrench,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Worker, LabourEntry, AppLanguage, LabourPieceRate, LedgerColumnConfig, ExportDocumentConfig, Product } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, downloadCSV, exportTablePDF, exportTableJPG } from '../utils/helpers';
import { openExportModal } from '../utils/exportSettingsHelper';
import { computeWorkerLedgerDetails } from '../utils/mathEngine';
import {
  buildLedgerExportTableData,
  getStoredLedgerColumnConfig,
  saveStoredLedgerColumnConfig
} from '../utils/ledgerExportHelper';
import { EditLedgerEntryModal } from './EditLedgerEntryModal';
import { LedgerStudioModal, DEFAULT_LEDGER_COLUMNS } from './LedgerStudioModal';

interface LabourLedgerViewProps {
  workers: Worker[];
  products?: Product[];
  language: AppLanguage;
  companyName: string;
  onSaveWorker: (worker: Worker) => void;
  onDeleteWorker: (name: string) => void;
  onAddLabourEntry: (workerName: string, entry: Omit<LabourEntry, 'id'>) => void;
  onDeleteLabourEntry: (workerName: string, entryId: string) => void;
  onUpdateLabourEntry?: (workerName: string, entryId: string, updatedData: any) => void;
  onBulkAttendance: (attendanceMap: Record<string, 'present' | 'half' | 'absent' | 'leave'>, date: string) => void;
}

const ITEM_COMPONENT_PRESETS = [
  'Swaged Ends & Cotter Hole',
  'Pipe Cutting & Punching',
  'Flange & Collar Welding',
  'Cotter Pin Hole & Deburring',
  'Power Press & Stamping',
  'Full Rod Assembly',
  'Deluxe Clamp & Rings Set',
  'Powder Coating & Buffing'
];

const DAILY_WAGE_COMPONENT_PRESETS = [
  'Day Shift - Production Line',
  'Day Shift - Welding Section',
  'Day Shift - Press & Punching',
  'Day Shift - Assembly Section',
  'Night Shift - General Work',
  'Overtime Duty (Extra Shift)',
  'Factory Maintenance Duty'
];

export const LabourLedgerView: React.FC<LabourLedgerViewProps> = ({
  workers,
  products,
  language,
  companyName,
  onSaveWorker,
  onDeleteWorker,
  onAddLabourEntry,
  onDeleteLabourEntry,
  onUpdateLabourEntry,
  onBulkAttendance
}) => {
  const [selectedWorkerIdx, setSelectedWorkerIdx] = useState<number | null>(null);
  const [addWorkerModal, setAddWorkerModal] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState(todayISO());
  const [bulkStatuses, setBulkStatuses] = useState<Record<string, 'present' | 'half' | 'absent' | 'leave'>>({});

  // Add worker form
  const [wName, setWName] = useState('');
  const [wType, setWType] = useState('Welding & Assembly');
  const [wRateType, setWRateType] = useState<'daily' | 'piece' | 'hourly' | 'both'>('daily');
  const [wRate, setWRate] = useState('1500');

  // Single Entry Form
  const [entryKind, setEntryKind] = useState<'attendance' | 'payment' | 'advance' | 'loan' | 'damage'>('attendance');
  const [entryDate, setEntryDate] = useState(todayISO());

  // Attendance / Work Sub-mode:
  // 'product' = Work By Item / Product (pieces completed, item details, auto-detects present)
  // 'work_type' = Work By Work Type / Duty (e.g. Pipe Cutting & Punching - full day/half day, auto-detects present)
  // 'non_working' = Mark Absent / Leave (unpaid or approval)
  const [workMode, setWorkMode] = useState<'product' | 'work_type' | 'non_working'>('product');

  // Work By Item / Product fields
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customProductName, setCustomProductName] = useState<string>('');
  const [itemSize, setItemSize] = useState<string>('18 inch');
  const [itemComponents, setItemComponents] = useState<string>('Swaged Ends & Cotter Hole');
  const [itemUnits, setItemUnits] = useState<string>('');
  const [itemRate, setItemRate] = useState<string>('8.5');

  // Work By Daily Wage fields
  const [selectedWorkType, setSelectedWorkType] = useState<string>('');
  const [customWorkType, setCustomWorkType] = useState<string>('');
  const [workShiftDuty, setWorkShiftDuty] = useState<'full' | 'half' | 'custom'>('full');
  const [workShiftsCount, setWorkShiftsCount] = useState<string>('1');
  const [workWageAmount, setWorkWageAmount] = useState<string>('1600');
  const [wageComponents, setWageComponents] = useState<string>('Day Shift - Production Line');

  // Non-working fields
  const [nonWorkingStatus, setNonWorkingStatus] = useState<'absent' | 'leave'>('absent');

  // Financial values & notes
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');

  // Detailed payment & Studio states
  const [editingEntry, setEditingEntry] = useState<LabourEntry | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [colConfig, setColConfig] = useState<LedgerColumnConfig>(() =>
    getStoredLedgerColumnConfig('labour', DEFAULT_LEDGER_COLUMNS)
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
    saveStoredLedgerColumnConfig('labour', newCfg);
  };

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const currentWorker = selectedWorkerIdx !== null ? workers[selectedWorkerIdx] : null;

  // Build selectable product options from products prop and worker pieceRates
  const productOptions = useMemo(() => {
    const list: Array<{ id: string; name: string; size?: string; defaultRate?: number }> = [];

    // Worker's own piece rates if defined
    if (currentWorker?.pieceRates && currentWorker.pieceRates.length > 0) {
      currentWorker.pieceRates.forEach((pr, idx) => {
        list.push({
          id: `worker-pr-${idx}`,
          name: `${currentWorker.workType || 'Custom Rod Work'} (${pr.size})`,
          size: pr.size,
          defaultRate: pr.rate
        });
      });
    }

    // Products from inventory
    if (products && products.length > 0) {
      products.forEach(p => {
        list.push({
          id: `prod-${p.id}`,
          name: p.name,
          size: p.size || '18 inch',
          defaultRate: p.price > 100 ? 10 : p.price
        });
      });
    }

    // Standard Falcon Rod Maker factory products
    const standardProducts = [
      { id: 'f-18', name: 'Ceiling-Fan-Rod-18-Deluxe', size: '18 inch', defaultRate: 8.5 },
      { id: 'f-24', name: 'Ceiling-Fan-Rod-24-Standard', size: '24 inch', defaultRate: 10 },
      { id: 'f-36', name: 'Ceiling-Fan-Rod-36-Industrial', size: '36 inch', defaultRate: 14 },
      { id: 'f-12', name: 'Ceiling-Fan-Rod-12-Heavy', size: '12 inch', defaultRate: 6.5 },
      { id: 'f-48', name: 'Ceiling-Fan-Rod-48-Commercial', size: '48 inch', defaultRate: 18 },
      { id: 'f-60', name: 'Ceiling-Fan-Rod-60-Custom', size: '60 inch', defaultRate: 22 },
      { id: 'f-clamp', name: 'Ceiling Fan Clamp Heavy Duty', size: '1 inch', defaultRate: 7 },
      { id: 'f-rings', name: 'Fan Canopy Rings Set', size: 'Standard', defaultRate: 4 },
      { id: 'f-swaged', name: 'Swaged Safety Cotter Rod', size: '18 inch', defaultRate: 9 },
      { id: 'f-custom', name: '+ Custom Product / Item Name', size: '', defaultRate: 10 }
    ];

    standardProducts.forEach(item => {
      if (!list.some(l => l.name.toLowerCase() === item.name.toLowerCase())) {
        list.push(item);
      }
    });

    return list;
  }, [products, currentWorker]);

  // Common workshop operations / work types
  const workTypeOptions = useMemo(() => {
    const types = new Set<string>();
    if (currentWorker?.workType) types.add(currentWorker.workType);
    types.add('Pipe Cutting & Punching');
    types.add('Welding & Assembly');
    types.add('Pipe Threading & Swaging');
    types.add('Flange & Collar Welding');
    types.add('Power Press & Stamping');
    types.add('Deburring & Grinding');
    types.add('Drilling & Hole Punching');
    types.add('Packing & Bundling');
    types.add('Factory General Duty');
    types.add('+ Other / Custom Work');
    return Array.from(types);
  }, [currentWorker?.workType]);

  // Synchronize defaults whenever a worker is opened
  useEffect(() => {
    if (currentWorker) {
      if (currentWorker.rateType === 'piece') {
        setWorkMode('product');
        const firstPiece = currentWorker.pieceRates?.[0];
        if (firstPiece) {
          setSelectedProductId(`worker-pr-0`);
          setCustomProductName(`${currentWorker.workType || 'Rod Work'} (${firstPiece.size})`);
          setItemSize(firstPiece.size || '18 inch');
          setItemRate(String(firstPiece.rate || 10));
        } else {
          setSelectedProductId('f-18');
          setCustomProductName('Ceiling-Fan-Rod-18-Deluxe');
          setItemSize('18 inch');
          setItemRate('8.5');
        }
      } else {
        // Daily or hourly worker
        setWorkMode('work_type');
        setSelectedWorkType(currentWorker.workType || 'Pipe Cutting & Punching');
        setWorkShiftDuty('full');
        setWorkWageAmount(String(currentWorker.rate || 1600));

        // Pre-set product rate and size in case they switch to By Product
        setSelectedProductId('f-18');
        setCustomProductName('Ceiling-Fan-Rod-18-Deluxe');
        setItemSize('18 inch');
        setItemRate('8.5');
      }
      setItemUnits('');
      setEntryNote('');
      setEntryAmount('');
    }
  }, [currentWorker?.name]);

  const handleProductSelect = (pId: string) => {
    setSelectedProductId(pId);
    if (pId === 'f-custom') {
      setCustomProductName('');
      return;
    }
    const found = productOptions.find(p => p.id === pId);
    if (found) {
      setCustomProductName(found.name);
      if (found.size) setItemSize(found.size);
      if (found.defaultRate) setItemRate(String(found.defaultRate));
    }
  };

  const getWorkerDues = (w: Worker) => {
    return computeWorkerLedgerDetails(w).netPayable;
  };

  const handleOpenBulk = () => {
    const initial: Record<string, 'present' | 'half' | 'absent' | 'leave'> = {};
    workers.forEach(w => {
      if (w.rateType === 'daily') initial[w.name] = 'present';
    });
    setBulkStatuses(initial);
    setBulkDate(todayISO());
    setBulkModalOpen(true);
  };

  const handleSaveBulk = () => {
    onBulkAttendance(bulkStatuses, bulkDate);
    setBulkModalOpen(false);
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorker) return;

    let debit = 0;
    let credit = 0;
    let status: 'present' | 'half' | 'absent' | 'leave' | undefined = undefined;
    let activeWorkType = currentWorker.workType;
    let activeItemName: string | undefined = undefined;
    let activeUnits: number | undefined = undefined;
    let activeRate: number | undefined = undefined;

    if (entryKind === 'attendance') {
      if (workMode === 'product') {
        const u = parseFloat(itemUnits) || 0;
        const r = parseFloat(itemRate) || 0;
        credit = u * r;
        // AUTOMATICALLY DETECTED AS PRESENT BECAUSE OF WORK ENTRY!
        status = 'present';
        activeItemName = selectedProductId === 'f-custom'
          ? (customProductName.trim() || 'Custom Rod Work')
          : (customProductName.trim() || (productOptions.find(p => p.id === selectedProductId)?.name || 'Production Item'));
        activeUnits = u;
        activeRate = r;
      } else if (workMode === 'work_type') {
        const wt = selectedWorkType === '+ Other / Custom Work'
          ? (customWorkType.trim() || 'Custom Work')
          : selectedWorkType;
        activeWorkType = wt;

        const shifts = parseFloat(workShiftsCount) || (workShiftDuty === 'half' ? 0.5 : 1);
        const dailyRate = parseFloat(workWageAmount) || (currentWorker.rate || 1600);
        credit = Math.round(shifts * dailyRate);

        if (workShiftDuty === 'half') {
          status = 'half';
        } else {
          // AUTOMATICALLY DETECTED AS PRESENT BECAUSE OF WORK ENTRY!
          status = 'present';
        }
        activeUnits = shifts;
        activeRate = dailyRate;
      } else {
        // non_working (Absent or Leave)
        credit = 0;
        status = nonWorkingStatus;
      }
    } else {
      debit = parseFloat(entryAmount) || 0;
    }

    onAddLabourEntry(currentWorker.name, {
      date: entryDate,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      kind: entryKind,
      status: entryKind === 'attendance' ? status : undefined,
      workMode: entryKind === 'attendance' ? workMode : undefined,
      itemName: activeItemName,
      productName: activeItemName,
      size: entryKind === 'attendance' && workMode === 'product' ? itemSize : undefined,
      itemComponents: entryKind === 'attendance'
        ? (workMode === 'product' ? (itemComponents.trim() || undefined) : (wageComponents.trim() || undefined))
        : undefined,
      dutyShift: entryKind === 'attendance' && workMode === 'work_type' ? workShiftDuty : undefined,
      shifts: entryKind === 'attendance' && workMode === 'work_type' ? (parseFloat(workShiftsCount) || (workShiftDuty === 'half' ? 0.5 : 1)) : undefined,
      dailyWageRate: entryKind === 'attendance' && workMode === 'work_type' ? (parseFloat(workWageAmount) || currentWorker.rate) : undefined,
      units: activeUnits,
      qty: activeUnits,
      rate: activeRate,
      note: entryNote.trim() || undefined,
      debit,
      credit,
      workType: activeWorkType,
      method: entryKind !== 'attendance' ? entryMethod : undefined,
      paidBy: entryPaidBy.trim() || undefined,
      paidTo: entryPaidTo.trim() || currentWorker.name,
      bankName: entryBankName.trim() || undefined,
      accountNumber: entryAccountNumber.trim() || undefined,
      chequeNo: entryChequeNo.trim() || undefined
    });

    // Reset unit inputs
    setItemUnits('');
    setEntryAmount('');
    setEntryNote('');
    setEntryPaidBy('');
    setEntryPaidTo('');
    setEntryBankName('');
    setEntryAccountNumber('');
    setEntryChequeNo('');
  };

  const handleExportCSV = (cfg?: LedgerColumnConfig) => {
    if (!currentWorker) return;
    const activeCfg = cfg || colConfig;
    const tableData = buildLedgerExportTableData(
      currentWorker.entries.map(e => ({
        ...e,
        desc: e.note || (e.itemName
          ? `[By Item] ${e.itemName}${e.itemComponents ? ` - ${e.itemComponents}` : ''} (${e.size || ''}) · ${e.units || e.qty || ''} pcs @ Rs ${e.rate || ''}`
          : e.workType && e.kind === 'attendance'
          ? `[By Daily Wage] ${e.workType}${e.itemComponents ? ` - ${e.itemComponents}` : ''} (${e.dutyShift === 'half' ? 'Half Day' : `${e.shifts || 1} Shift(s)`})`
          : e.kind),
        itemName: e.itemName || e.productName,
        stockName: e.itemName || e.productName,
        itemComponents: e.itemComponents,
        dutyShift: e.dutyShift,
        shifts: e.shifts,
        dailyWageRate: e.dailyWageRate,
        qty: e.units || e.qty,
        runningBalance: (e.credit || 0) - (e.debit || 0)
      })),
      activeCfg
    );
    downloadCSV(`${currentWorker.name}_Labour_Ledger`, tableData.headers, tableData.rows);
  };

  const handleExportPDF = (cfg?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    if (!currentWorker) return;
    const activeCfg = cfg || colConfig;
    const tableData = buildLedgerExportTableData(
      currentWorker.entries.map(e => ({
        ...e,
        desc: e.note || (e.itemName
          ? `[By Item] ${e.itemName}${e.itemComponents ? ` - ${e.itemComponents}` : ''} (${e.size || ''}) · ${e.units || e.qty || ''} pcs @ Rs ${e.rate || ''}`
          : e.workType && e.kind === 'attendance'
          ? `[By Daily Wage] ${e.workType}${e.itemComponents ? ` - ${e.itemComponents}` : ''} (${e.dutyShift === 'half' ? 'Half Day' : `${e.shifts || 1} Shift(s)`})`
          : e.kind),
        itemName: e.itemName || e.productName,
        stockName: e.itemName || e.productName,
        itemComponents: e.itemComponents,
        dutyShift: e.dutyShift,
        shifts: e.shifts,
        dailyWageRate: e.dailyWageRate,
        qty: e.units || e.qty,
        runningBalance: (e.credit || 0) - (e.debit || 0)
      })),
      activeCfg
    );
    openExportModal({
      title: `${currentWorker.name} — Labour Ledger`,
      headers: tableData.headers,
      rows: tableData.rows,
      filename: `${currentWorker.name}_Labour_Ledger`,
      companyName,
      subtitle: exportDocConfig?.subtitle || `${currentWorker.workType} · Wages Account`,
      balanceFooterText: `Net Dues: ${fmt(getWorkerDues(currentWorker))}`,
      defaultFormat: 'pdf',
      initialOrientation: 'landscape'
    });
  };

  const handleExportJPG = (cfg?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    if (!currentWorker) return;
    const activeCfg = cfg || colConfig;
    const tableData = buildLedgerExportTableData(
      currentWorker.entries.map(e => ({
        ...e,
        desc: e.note || (e.itemName
          ? `[By Item] ${e.itemName}${e.itemComponents ? ` - ${e.itemComponents}` : ''} (${e.size || ''}) · ${e.units || e.qty || ''} pcs @ Rs ${e.rate || ''}`
          : e.workType && e.kind === 'attendance'
          ? `[By Daily Wage] ${e.workType}${e.itemComponents ? ` - ${e.itemComponents}` : ''} (${e.dutyShift === 'half' ? 'Half Day' : `${e.shifts || 1} Shift(s)`})`
          : e.kind),
        itemName: e.itemName || e.productName,
        stockName: e.itemName || e.productName,
        itemComponents: e.itemComponents,
        dutyShift: e.dutyShift,
        shifts: e.shifts,
        dailyWageRate: e.dailyWageRate,
        qty: e.units || e.qty,
        runningBalance: (e.credit || 0) - (e.debit || 0)
      })),
      activeCfg
    );
    openExportModal({
      title: `${currentWorker.name} — Labour Ledger`,
      headers: tableData.headers,
      rows: tableData.rows,
      filename: `${currentWorker.name}_Labour_Ledger`,
      companyName,
      subtitle: exportDocConfig?.subtitle || `${currentWorker.workType} · Wages Account`,
      balanceFooterText: `Net Dues: ${fmt(getWorkerDues(currentWorker))}`,
      defaultFormat: 'jpg',
      initialOrientation: 'landscape'
    });
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden break-words">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3">
        <div>
          <h2 className="font-serif font-black text-xl text-[var(--text)]">{t('labourledger_title')}</h2>
          <p className="text-xs text-[var(--text-dim)]">{t('labourledger_sub')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenBulk}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] text-xs font-mono font-bold text-[var(--yellow)] hover:border-[var(--yellow)] transition"
          >
            <CheckSquare size={14} />
            <span>{t('mark_attendance')}</span>
          </button>
          <button
            type="button"
            onClick={() => setAddWorkerModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow transition active:scale-95"
          >
            <Plus size={14} />
            <span>{t('add_worker')}</span>
          </button>
        </div>
      </div>

      {/* Workers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {workers.map((w, idx) => {
          const dues = getWorkerDues(w);
          const isOwed = dues > 0;

          return (
            <div
              key={w.name}
              className="bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] rounded-xl p-4 flex flex-col justify-between gap-3 shadow-sm transition group"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center text-[var(--yellow)]">
                  <Users size={16} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm((t('confirm_delete_worker') || 'Delete worker {name}?').replace('{name}', w.name))) {
                      onDeleteWorker(w.name);
                    }
                  }}
                  className="p-1.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:text-red-400 opacity-80 group-hover:opacity-100 transition"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-[var(--text)]">{w.name}</h4>
                <div className="text-xs text-[var(--text-dim)] font-mono mt-0.5">
                  {w.workType} · <span className="font-semibold text-[var(--yellow)]">{w.rateType === 'piece' ? 'By Item' : w.rateType === 'daily' ? 'By Daily Wage' : w.rateType === 'both' ? 'By Item & Daily' : w.rateType}</span> ({w.rate ? `Rs ${fmt(w.rate)}` : 'piece-rate'})
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--steel-line)] flex items-center justify-between font-mono">
                <div className="text-xs">
                  <span className={`font-bold ${isOwed ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>
                    {fmt(Math.abs(dues))}
                  </span>{' '}
                  <span className="text-[10px] text-[var(--text-dim)]">({isOwed ? 'Dues' : 'Advance'})</span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedWorkerIdx(idx)}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] hover:bg-[var(--yellow)] hover:text-black border border-[var(--steel-line)] text-xs font-semibold transition"
                >
                  Ledger
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Worker Modal */}
      {addWorkerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-sm max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-3">{t('add_worker')}</h3>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!wName.trim()) return;
                onSaveWorker({
                  name: wName.trim(),
                  workType: wType.trim(),
                  rateType: wRateType,
                  rate: parseFloat(wRate) || 0,
                  pieceRates:
                    wRateType === 'piece' || wRateType === 'both'
                      ? [{ size: '18 inch', rate: parseFloat(wRate) || 10, rodSize: 'R/18"', guardSize: 'R/18"' }]
                      : undefined,
                  entries: []
                });
                setWName('');
                setAddWorkerModal(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">{t('labour_name')}</label>
                <input
                  type="text"
                  required
                  value={wName}
                  onChange={e => setWName(e.target.value)}
                  placeholder="e.g. Muhammad Rafiq"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">{t('work_type')}</label>
                <input
                  type="text"
                  value={wType}
                  onChange={e => setWType(e.target.value)}
                  placeholder="e.g. Welding, Assembly"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">Wage Setup</label>
                  <select
                    value={wRateType}
                    onChange={e => setWRateType(e.target.value as any)}
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-2 py-2 text-xs text-[var(--text)]"
                  >
                    <option value="daily">By Daily Wage</option>
                    <option value="piece">By Item / Product</option>
                    <option value="both">By Item & Daily Wage</option>
                    <option value="hourly">Hourly Rate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">
                    {wRateType === 'piece' ? 'Item Rate (Rs/pc)' : 'Daily Rate (Rs)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={wRate}
                    onChange={e => setWRate(e.target.value)}
                    placeholder="1500"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddWorkerModal(false)}
                  className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow"
                >
                  {t('add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Attendance Modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-md max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-2">{t('mark_attendance')}</h3>
            <div className="mb-3">
              <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">{t('entry_date')}</label>
              <input
                type="date"
                value={bulkDate}
                onChange={e => setBulkDate(e.target.value)}
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-1.5 text-xs text-[var(--text)]"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 my-3 divide-y divide-[var(--steel-line)]">
              {workers
                .filter(w => w.rateType === 'daily')
                .map(w => (
                  <div key={w.name} className="flex items-center justify-between pt-2">
                    <span className="font-semibold text-xs text-[var(--text)]">{w.name}</span>
                    <div className="flex gap-1">
                      {(['present', 'half', 'absent', 'leave'] as const).map(st => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setBulkStatuses(prev => ({ ...prev, [w.name]: st }))}
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition ${
                            bulkStatuses[w.name] === st
                              ? st === 'present'
                                ? 'bg-emerald-500 text-white'
                                : st === 'half'
                                ? 'bg-amber-500 text-black'
                                : 'bg-red-500 text-white'
                              : 'bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text-dim)]'
                          }`}
                        >
                          {st[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex gap-2 pt-3">
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveBulk}
                className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Worker Ledger Modal */}
      {currentWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 font-mono">
          <div className="w-full max-w-3xl max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-3 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-serif font-black text-lg sm:text-xl text-[var(--text)]">{currentWorker.name}</h3>
                <span className="text-xs text-[var(--text-dim)]">
                  {currentWorker.workType} · <span className="font-semibold text-[var(--yellow)]">{currentWorker.rateType === 'piece' ? 'By Item / Product' : currentWorker.rateType === 'daily' ? 'By Daily Wage' : currentWorker.rateType === 'both' ? 'By Item & Daily Wage' : currentWorker.rateType}</span> ({currentWorker.rate ? `Rs ${fmt(currentWorker.rate)}/day` : 'Piece-rate items'})
                </span>
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
                  onClick={() => setSelectedWorkerIdx(null)}
                  className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Breakdown & Dues Cards */}
            {(() => {
              const details = computeWorkerLedgerDetails(currentWorker);
              return (
                <div className="my-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)] font-bold">Total Wages Earned (Credit)</div>
                    <div className="text-base font-bold text-[var(--red)] mt-0.5">{fmt(details.totalCredits)}</div>
                    <div className="mt-2 pt-1.5 border-t border-[var(--steel-line)] flex flex-wrap items-center justify-between text-[10px] gap-1">
                      <span className="text-amber-400 font-bold">📦 By Item: {details.totalItemPieces} pcs ({fmt(details.totalItemWages)})</span>
                      <span className="text-blue-400 font-bold">💵 Daily: {details.totalDailyShifts} shifts ({fmt(details.totalDailyWages)})</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Total Paid (Debit)</div>
                    <div className="text-base font-bold text-[var(--green)] mt-0.5">{fmt(details.totalDebits)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Net Payable Dues</div>
                    <div
                      className={`text-base font-bold mt-0.5 ${
                        details.netPayable > 0
                          ? 'text-[var(--red)]'
                          : details.netPayable < 0
                          ? 'text-[var(--green)]'
                          : 'text-gray-400'
                      }`}
                    >
                      {fmt(Math.abs(details.netPayable))}
                      <span className="text-[10px] font-normal ml-1">
                        {details.netPayable > 0 ? 'Dues to Worker' : details.netPayable < 0 ? 'Advance Given' : 'Settled'}
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

            {/* Entries List */}
            <div className="flex-1 overflow-auto max-w-full min-h-[140px] max-h-[45vh] shrink-0 border border-[var(--steel-line)] rounded-lg ledger-scroll-container">
              <table className="w-full text-left text-xs border-collapse min-w-[660px]">
                <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)]">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Kind</th>
                    <th className="p-2.5">Status/Note</th>
                    <th className="p-2.5 text-right">Payment (Debit)</th>
                    <th className="p-2.5 text-right">Wages (Credit)</th>
                    <th className="p-2.5 text-right">Running Balance</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--steel-line)]">
                  {currentWorker.entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-[var(--text-dim)]">
                        No work or payment entries yet.
                      </td>
                    </tr>
                  ) : (
                    computeWorkerLedgerDetails(currentWorker).entriesWithBalance.map(e => (
                      <tr key={e.id} className="hover:bg-[var(--panel-raised)]/50">
                        <td className="p-2.5 whitespace-nowrap">{e.date}</td>
                        <td className="p-2.5 uppercase text-[10px] font-bold text-[var(--yellow)]">{e.kind}</td>
                        <td className="p-2.5">
                          <div className="space-y-1">
                            {/* Attendance / Status Badge */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {e.status === 'present' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle2 size={10} /> Present
                                </span>
                              )}
                              {e.status === 'half' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  <Clock size={10} /> Half Day
                                </span>
                              )}
                              {e.status === 'absent' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                                  ✕ Absent
                                </span>
                              )}
                              {e.status === 'leave' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                  ✉ Leave
                                </span>
                              )}
                              {e.kind !== 'attendance' && (
                                <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase">
                                  {e.kind === 'payment' ? 'Wage Paid' : e.kind}
                                </span>
                              )}
                            </div>

                            {/* Line: By Item / Product */}
                            {(e.itemName || e.productName) ? (
                              <div className="text-[11px] font-semibold text-[var(--text)] flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-mono font-bold tracking-wider">
                                  📦 BY ITEM
                                </span>
                                <span className="text-amber-400 font-bold">{e.itemName || e.productName}</span>
                                {e.size && (
                                  <span className="px-1.5 py-0.2 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[10px] font-mono text-[var(--text-dim)]">
                                    {e.size}
                                  </span>
                                )}
                                {e.itemComponents && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-300/90">
                                    ⚙️ {e.itemComponents}
                                  </span>
                                )}
                                {(e.units !== undefined || e.qty !== undefined) && (
                                  <span className="font-mono text-emerald-400 font-bold text-[11px]">
                                    · {e.units ?? e.qty} pcs
                                  </span>
                                )}
                                {e.rate && (
                                  <span className="font-mono text-[var(--text-dim)] text-[10px]">
                                    @ Rs {fmt(e.rate)}/pc
                                  </span>
                                )}
                              </div>
                            ) : (e.workType && e.kind === 'attendance') ? (
                              /* Line: By Daily Wage */
                              <div className="text-[11px] font-semibold text-[var(--text)] flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-mono font-bold tracking-wider">
                                  💵 BY DAILY WAGE
                                </span>
                                <span className="text-blue-300 font-bold">⚙️ {e.workType}</span>
                                {e.itemComponents && (
                                  <span className="px-1.5 py-0.2 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] font-mono text-blue-300/90">
                                    🏢 {e.itemComponents}
                                  </span>
                                )}
                                <span className="text-[10px] text-emerald-400 font-mono">
                                  ({e.dutyShift === 'half' || e.units === 0.5 ? 'Half Day · 0.5 Shift' : e.shifts ? `${e.shifts} Shift(s)` : 'Full Day · 1 Shift'})
                                </span>
                                {(e.dailyWageRate || e.rate) && (
                                  <span className="font-mono text-[var(--text-dim)] text-[10px]">
                                    @ Rs {fmt(e.dailyWageRate || e.rate)}/day
                                  </span>
                                )}
                              </div>
                            ) : null}

                            {/* Note */}
                            {e.note && (
                              <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                                {e.note}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-semibold text-[var(--green)]">
                          {e.debit ? (
                            <div>
                              <div>{fmt(e.debit)}</div>
                              {e.method && (
                                <div className="text-[10px] text-[var(--yellow)] font-mono">{e.method}</div>
                              )}
                              {(e.paidBy || e.paidTo) && (
                                <div className="text-[9px] text-[var(--text-dim)] flex items-center justify-end gap-1 flex-wrap">
                                  {e.paidBy && <span>By: <strong className="text-[var(--text)]">{e.paidBy}</strong></span>}
                                  {e.paidTo && <span>→ To: <strong className="text-[var(--text)]">{e.paidTo}</strong></span>}
                                </div>
                              )}
                              {e.accountNumber && (
                                <div className="text-[9px] text-[var(--yellow)] font-mono">
                                  A/C: {e.accountNumber} {e.bankName && `(${e.bankName})`}
                                </div>
                              )}
                              {e.chequeNo && (
                                <div className="text-[9px] text-[var(--text-dim)] font-mono">
                                  Ref: {e.chequeNo}
                                </div>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-[var(--red)]">
                          {e.credit ? fmt(e.credit) : '—'}
                        </td>
                        <td
                          className={`p-2.5 text-right font-bold ${
                            e.runningBalance > 0
                              ? 'text-[var(--red)]'
                              : e.runningBalance < 0
                              ? 'text-[var(--green)]'
                              : 'text-gray-400'
                          }`}
                        >
                          {fmt(Math.abs(e.runningBalance))}
                          <span className="text-[9px] font-normal ml-0.5">
                            {e.runningBalance > 0 ? 'Due' : e.runningBalance < 0 ? 'Adv' : ''}
                          </span>
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
                              onClick={() => onDeleteLabourEntry(currentWorker.name, e.id)}
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
            <form onSubmit={handleAddEntry} className="mt-3 pt-3 border-t border-[var(--steel-line)] space-y-2.5 text-xs">
              {/* Header: Kind selector & Date & Mode Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <select
                    value={entryKind}
                    onChange={e => setEntryKind(e.target.value as any)}
                    className="bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--yellow)] font-bold rounded-lg px-2.5 py-1 text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="attendance">📋 Attendance / Work</option>
                    <option value="payment">💸 Wages Payment</option>
                    <option value="advance">💳 Advance</option>
                    <option value="loan">🤝 Loan</option>
                    <option value="damage">⚠️ Damage Deduction</option>
                  </select>

                  <input
                    type="date"
                    value={entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-2 py-1 text-xs text-[var(--text)] font-mono"
                  />
                </div>

                {entryKind === 'attendance' ? (
                  /* Work sub-mode tabs: By Item / Product vs By Daily Wage vs Absent / Leave */
                  <div className="flex items-center bg-[var(--panel-raised)] p-0.5 rounded-lg border border-[var(--steel-line)] text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setWorkMode('product')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                        workMode === 'product'
                          ? 'bg-[var(--yellow)] text-black shadow-xs font-black'
                          : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Package size={13} />
                      <span>By Item / Product</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkMode('work_type')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                        workMode === 'work_type'
                          ? 'bg-[var(--yellow)] text-black shadow-xs font-black'
                          : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Calendar size={13} />
                      <span>By Daily Wage</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkMode('non_working')}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition cursor-pointer ${
                        workMode === 'non_working'
                          ? 'bg-red-500 text-white shadow-xs font-black'
                          : 'text-[var(--text-dim)] hover:text-red-400'
                      }`}
                    >
                      <AlertCircle size={13} />
                      <span>Absent/Leave</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowExtendedPaymentFields(!showExtendedPaymentFields)}
                    className="text-[10px] text-[var(--yellow)] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                  >
                    {showExtendedPaymentFields ? 'Hide Payment Channels' : '+ Detailed Payment Channels (By / To / A/C)'}
                  </button>
                )}
              </div>

              {/* MODE 1: Work By Item / Product */}
              {entryKind === 'attendance' && workMode === 'product' && (
                <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-amber-500/30 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between text-[11px] flex-wrap gap-2">
                    <span className="font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider text-xs">
                      <Package size={14} /> Log Work Line By Item / Product
                    </span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px] bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 size={12} /> Auto Attendance: Detected Present (Work Entry)
                    </span>
                  </div>

                  {/* Item Components Quick Chips */}
                  <div>
                    <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1">
                      Item Components & Operation Details
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {ITEM_COMPONENT_PRESETS.map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setItemComponents(preset)}
                          className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer border ${
                            itemComponents === preset
                              ? 'bg-[var(--yellow)] text-black border-[var(--yellow)] font-bold'
                              : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={itemComponents}
                      onChange={e => setItemComponents(e.target.value)}
                      placeholder="e.g. Swaged Ends & Cotter Hole, Flange Welding, Power Press Stamping..."
                      className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] focus:border-[var(--yellow)] outline-hidden font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    {/* Item / Product Selector */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1">
                        Select Item / Product
                      </label>
                      <select
                        value={selectedProductId}
                        onChange={e => handleProductSelect(e.target.value)}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] focus:border-[var(--yellow)] outline-hidden cursor-pointer"
                      >
                        <option value="">-- Choose Item / Product --</option>
                        {productOptions.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.size ? `(${p.size})` : ''} {p.defaultRate ? `· Rs ${p.defaultRate}/pc` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Custom Product Name if chosen */}
                    {(selectedProductId === 'f-custom' || !selectedProductId) && (
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1">
                          Custom Product / Item Name
                        </label>
                        <input
                          type="text"
                          value={customProductName}
                          onChange={e => setCustomProductName(e.target.value)}
                          placeholder="e.g. Swaged Ceiling Fan Rod 18-inch"
                          className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] focus:border-[var(--yellow)] outline-hidden"
                        />
                      </div>
                    )}

                    {/* Size / Dimension */}
                    <div>
                      <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1">
                        Size / Dimension
                      </label>
                      <input
                        type="text"
                        value={itemSize}
                        onChange={e => setItemSize(e.target.value)}
                        placeholder="e.g. 18 inch, 24 inch"
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] font-mono focus:border-[var(--yellow)] outline-hidden"
                      />
                    </div>

                    {/* Quantity completed */}
                    <div>
                      <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1">
                        Quantity (Pcs Completed) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={itemUnits}
                        onChange={e => setItemUnits(e.target.value)}
                        placeholder="e.g. 150"
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] font-mono font-bold focus:border-emerald-400 outline-hidden"
                      />
                    </div>

                    {/* Rate per piece */}
                    <div>
                      <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1">
                        Rate (Rs / Piece) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={itemRate}
                        onChange={e => setItemRate(e.target.value)}
                        placeholder="e.g. 8.5"
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] font-mono font-bold focus:border-[var(--yellow)] outline-hidden"
                      />
                    </div>

                    {/* Calculated Wages */}
                    <div className="flex flex-col justify-end">
                      <div className="p-2 rounded-lg bg-[var(--panel)] border border-amber-500/30 text-right">
                        <div className="text-[9px] text-[var(--text-dim)] uppercase font-bold">
                          {itemUnits || 0} pcs × Rs {itemRate || 0}
                        </div>
                        <div className="text-sm font-black font-mono text-[var(--red)]">
                          Rs {fmt((parseFloat(itemUnits) || 0) * (parseFloat(itemRate) || 0))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Note & Save */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={entryNote}
                      onChange={e => setEntryNote(e.target.value)}
                      placeholder="Item details / batch / punch machine notes (optional)"
                      className="flex-1 bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] focus:border-[var(--yellow)] outline-hidden font-sans"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-lg bg-[var(--yellow)] text-black font-black uppercase text-xs shadow hover:bg-amber-400 transition cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <CheckCircle2 size={13} strokeWidth={2.5} />
                      <span>Save By Item Entry</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 2: Work By Daily Wage */}
              {entryKind === 'attendance' && workMode === 'work_type' && (
                <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-blue-500/30 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between text-[11px] flex-wrap gap-2">
                    <span className="font-bold text-blue-400 flex items-center gap-1.5 uppercase tracking-wider text-xs">
                      <Calendar size={14} /> Log Work Line By Daily Wage
                    </span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px] bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 size={12} /> Auto Attendance: Detected {workShiftDuty === 'half' ? 'Half Day' : 'Present'} (Work Entry)
                    </span>
                  </div>

                  {/* Daily Wage / Shift Components Quick Chips */}
                  <div>
                    <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1">
                      Daily Wage Shift & Section Components
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {DAILY_WAGE_COMPONENT_PRESETS.map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setWageComponents(preset)}
                          className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer border ${
                            wageComponents === preset
                              ? 'bg-blue-500 text-white border-blue-400 font-bold'
                              : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={wageComponents}
                      onChange={e => setWageComponents(e.target.value)}
                      placeholder="e.g. Day Shift - Press Section, Night Shift, Assembly Line 1..."
                      className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] focus:border-blue-400 outline-hidden font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    {/* Work Type selector */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1">
                        Work Type / Operation
                      </label>
                      <select
                        value={selectedWorkType}
                        onChange={e => {
                          setSelectedWorkType(e.target.value);
                          if (e.target.value !== '+ Other / Custom Work') {
                            setCustomWorkType('');
                          }
                        }}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] focus:border-blue-400 outline-hidden cursor-pointer"
                      >
                        {workTypeOptions.map(wt => (
                          <option key={wt} value={wt}>
                            {wt}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Custom Work Type if chosen */}
                    {selectedWorkType === '+ Other / Custom Work' && (
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1">
                          Custom Work Type Name
                        </label>
                        <input
                          type="text"
                          value={customWorkType}
                          onChange={e => setCustomWorkType(e.target.value)}
                          placeholder="e.g. Swaging & Flange Welding"
                          className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] focus:border-blue-400 outline-hidden"
                        />
                      </div>
                    )}

                    {/* Duty Duration Selector */}
                    <div>
                      <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1">
                        Duty / Shift Duration
                      </label>
                      <select
                        value={workShiftDuty}
                        onChange={e => {
                          const val = e.target.value as 'full' | 'half' | 'custom';
                          setWorkShiftDuty(val);
                          if (val === 'full') {
                            setWorkShiftsCount('1');
                            setWorkWageAmount(String(currentWorker.rate || 1600));
                          } else if (val === 'half') {
                            setWorkShiftsCount('0.5');
                            setWorkWageAmount(String(currentWorker.rate || 1600));
                          }
                        }}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] focus:border-blue-400 outline-hidden cursor-pointer"
                      >
                        <option value="full">Full Day Duty (1 Shift - Present)</option>
                        <option value="half">Half Day Duty (0.5 Shift)</option>
                        <option value="custom">Custom Shifts / Overtime</option>
                      </select>
                    </div>

                    {/* Shifts / Days Count */}
                    <div>
                      <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1">
                        Shifts / Days Count *
                      </label>
                      <input
                        type="number"
                        step="0.25"
                        min="0.25"
                        required
                        value={workShiftsCount}
                        onChange={e => setWorkShiftsCount(e.target.value)}
                        placeholder="1"
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] font-mono font-bold focus:border-blue-400 outline-hidden"
                      />
                    </div>

                    {/* Wage Rate (Per Day) */}
                    <div>
                      <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1">
                        Daily Wage Rate (Rs/Day) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={workWageAmount}
                        onChange={e => setWorkWageAmount(e.target.value)}
                        placeholder="1600"
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] font-mono font-bold focus:border-blue-400 outline-hidden"
                      />
                    </div>

                    {/* Calculated Wage Breakdown */}
                    <div className="flex flex-col justify-end">
                      <div className="p-2 rounded-lg bg-[var(--panel)] border border-blue-500/30 text-right">
                        <div className="text-[9px] text-[var(--text-dim)] uppercase font-bold">
                          {workShiftsCount || 1} shifts × Rs {workWageAmount || 0}
                        </div>
                        <div className="text-sm font-black font-mono text-[var(--red)]">
                          Rs {fmt(Math.round((parseFloat(workShiftsCount) || 1) * (parseFloat(workWageAmount) || 0)))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Note & Save */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={entryNote}
                      onChange={e => setEntryNote(e.target.value)}
                      placeholder="Work notes / machine / shift particulars (optional)"
                      className="flex-1 bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] focus:border-blue-400 outline-hidden font-sans"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-black uppercase text-xs shadow transition cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <CheckCircle2 size={13} strokeWidth={2.5} />
                      <span>Save Daily Wage Entry</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 3: Non-Working (Absent / Leave) */}
              {entryKind === 'attendance' && workMode === 'non_working' && (
                <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/30 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
                      <AlertCircle size={13} /> Mark Non-Working Day (Absent / Leave)
                    </span>
                    <span className="text-[var(--text-dim)] text-[10px] font-mono">Wages: Rs 0 (No work logged)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1">
                        Attendance Status
                      </label>
                      <select
                        value={nonWorkingStatus}
                        onChange={e => setNonWorkingStatus(e.target.value as any)}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] focus:border-red-400 outline-hidden"
                      >
                        <option value="absent">Absent (Unpaid)</option>
                        <option value="leave">Leave (Approved)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1">
                        Reason / Note (optional)
                      </label>
                      <input
                        type="text"
                        value={entryNote}
                        onChange={e => setEntryNote(e.target.value)}
                        placeholder="e.g. Informed absence, sick leave, factory closed..."
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] focus:border-red-400 outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-lg bg-red-500 text-white font-bold uppercase text-xs shadow hover:bg-red-600 transition cursor-pointer"
                    >
                      Save Attendance Record
                    </button>
                  </div>
                </div>
              )}

              {/* Extended Payment Channels when toggled */}
              {showExtendedPaymentFields && entryKind !== 'attendance' && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                  <select
                    value={entryMethod}
                    onChange={e => setEntryMethod(e.target.value)}
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
                    placeholder="Paid By (e.g. Cashier / Owner)"
                    className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                  />
                  <input
                    type="text"
                    value={entryPaidTo}
                    onChange={e => setEntryPaidTo(e.target.value)}
                    placeholder={`Paid To (e.g. ${currentWorker.name})`}
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

              {/* Payment / Advance / Loan Form */}
              {entryKind !== 'attendance' && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="number"
                    min="1"
                    required
                    value={entryAmount}
                    onChange={e => setEntryAmount(e.target.value)}
                    placeholder="Amount (Rs)"
                    className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] font-mono font-bold focus:border-emerald-400 outline-hidden"
                  />

                  <select
                    value={entryMethod}
                    onChange={e => setEntryMethod(e.target.value)}
                    className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] font-mono focus:border-[var(--yellow)] outline-hidden cursor-pointer"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Transfer</option>
                    <option value="Online">Online / EasyPaisa / JazzCash</option>
                    <option value="Cheque">Cheque</option>
                  </select>

                  <input
                    type="text"
                    value={entryNote}
                    onChange={e => setEntryNote(e.target.value)}
                    placeholder="Payment note / reference"
                    className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] focus:border-[var(--yellow)] outline-hidden"
                  />

                  <button
                    type="submit"
                    className="py-1.5 rounded-lg bg-emerald-500 text-black font-black uppercase text-xs shadow hover:bg-emerald-400 transition cursor-pointer"
                  >
                    Save Payment
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Edit Worker Ledger Entry Modal */}
      {editingEntry && currentWorker && (
        <EditLedgerEntryModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          title={`Edit Worker Entry · ${currentWorker.name}`}
          ledgerName={currentWorker.name}
          entry={editingEntry}
          onSave={updated => {
            if (onUpdateLabourEntry) {
              onUpdateLabourEntry(currentWorker.name, editingEntry.id, updated);
            }
          }}
        />
      )}

      {/* Ledger Column & Export Studio Modal */}
      {isStudioOpen && currentWorker && (
        <LedgerStudioModal
          isOpen={isStudioOpen}
          onClose={() => setIsStudioOpen(false)}
          ledgerName={currentWorker.name}
          ledgerSubtitle={`${currentWorker.workType} · Wages & Labour Ledger`}
          columnConfig={colConfig}
          onUpdateColumnConfig={handleUpdateColConfig}
          companyName={companyName}
          activeBalance={getWorkerDues(currentWorker)}
          sampleRows={currentWorker.entries}
          onExportCSV={cfg => handleExportCSV(cfg)}
          onExportPDF={(cfg, docCfg) => handleExportPDF(cfg, docCfg)}
          onExportJPG={(cfg, docCfg) => handleExportJPG(cfg, docCfg)}
        />
      )}
    </div>
  );
};
