import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  Image as ImageIcon,
  ShieldCheck,
  Eye,
  Upload,
  UserCheck,
  Hash,
  Sliders,
  TrendingUp,
  Scale,
  Package,
  Boxes,
  Calculator,
  BarChart3,
  Search,
  ArrowLeftRight,
  PackagePlus,
  CheckCircle2,
  X,
  Building,
  AlertTriangle,
  Briefcase,
  CreditCard
} from 'lucide-react';
import {
  RawSupplier,
  RawEntry,
  AppLanguage,
  Transaction,
  GatePassData,
  LedgerColumnConfig,
  ExportDocumentConfig,
  RawStockItem,
  ProductionProjectCostEstimate,
  Factory,
  CustomLedger,
  Worker
} from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, downloadCSV, exportTablePDF } from '../utils/helpers';
import { exportTableJPG } from '../utils/exportManager';
import { computeSupplierLedgerDetails } from '../utils/mathEngine';
import { getNextGateSequence, UnifiedGateReceipt } from '../utils/gateSequenceManager';
import {
  buildLedgerExportTableData,
  getStoredLedgerColumnConfig,
  saveStoredLedgerColumnConfig
} from '../utils/ledgerExportHelper';
import { EditLedgerEntryModal } from './EditLedgerEntryModal';
import { LedgerStudioModal, DEFAULT_LEDGER_COLUMNS } from './LedgerStudioModal';
import { GatePassUploadModal } from './GatePassUploadModal';
import { GatePassViewerModal } from './GatePassViewerModal';
import { UnifiedGateReceiptsModal } from './UnifiedGateReceiptsModal';
import { RawMaterialConverterModal } from './RawMaterialConverterModal';
import { ProjectCostingSection } from './ProjectCostingSection';

interface RawMaterialViewProps {
  suppliers: RawSupplier[];
  rawStock?: RawStockItem[];
  productionProjects?: ProductionProjectCostEstimate[];
  factories?: Factory[];
  customLedgers?: CustomLedger[];
  workers?: Worker[];
  transactions?: Transaction[];
  language: AppLanguage;
  companyName: string;
  rawItemNames: string[];
  onSaveSupplier: (supplier: RawSupplier, oldName?: string) => void;
  onDeleteSupplier: (name: string) => void;
  onAddRawEntry: (supplierName: string, entry: Omit<RawEntry, 'id'>) => void;
  onDeleteRawEntry: (supplierName: string, entryId: string) => void;
  onUpdateRawEntry?: (supplierName: string, entryId: string, updatedData: any) => void;
  onAttachGatePass?: (supplierName: string, entryId: string, gatePass: GatePassData) => void;
  onAddRawStock?: (item: RawStockItem) => void;
  onSaveProject?: (project: ProductionProjectCostEstimate) => void;
  onDeleteProject?: (id: string) => void;
  onNavigate?: (view: any) => void;
}

export const RawMaterialView: React.FC<RawMaterialViewProps> = ({
  suppliers,
  rawStock = [],
  productionProjects = [],
  factories = [],
  customLedgers = [],
  workers = [],
  transactions = [],
  language,
  companyName,
  rawItemNames,
  onSaveSupplier,
  onDeleteSupplier,
  onAddRawEntry,
  onDeleteRawEntry,
  onUpdateRawEntry,
  onAttachGatePass,
  onAddRawStock,
  onSaveProject,
  onDeleteProject,
  onNavigate
}) => {
  const [activeSectionTab, setActiveSectionTab] = useState<'suppliers' | 'project_costing'>('suppliers');
  const [selectedSupplierIdx, setSelectedSupplierIdx] = useState<number | null>(null);
  const [addSupplierModal, setAddSupplierModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');

  // Gate Pass & Unified Registry Modals
  const [isGateRegistryOpen, setIsGateRegistryOpen] = useState(false);
  const [uploadingRawEntry, setUploadingRawEntry] = useState<{ supplierName: string; entry: RawEntry } | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<UnifiedGateReceipt | null>(null);

  // Form State
  const [entryMode, setEntryMode] = useState<'weight' | 'quantity' | 'both'>('weight');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'grams'>('kg');
  const [itemUnit, setItemUnit] = useState<string>('Pcs');
  const [rateType, setRateType] = useState<'per_kg' | 'per_item'>('per_kg');
  const [autoCalculate, setAutoCalculate] = useState<boolean>(true);
  const [activeLedgerTab, setActiveLedgerTab] = useState<'all' | 'weight' | 'quantity' | 'payments' | 'summary'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isConverterOpen, setIsConverterOpen] = useState<boolean>(false);
  const [showInlineConverter, setShowInlineConverter] = useState<boolean>(false);

  const [desc, setDesc] = useState('');
  const [stockName, setStockName] = useState(rawItemNames[0] || 'M.S. Steel Pipe');
  const [weightIn, setWeightIn] = useState('');
  const [itemsIn, setItemsIn] = useState('');
  const [rate, setRate] = useState('');
  const [debit, setDebit] = useState('');
  const [credit, setCredit] = useState('');
  const [isReturn, setIsReturn] = useState(false);
  const [method, setMethod] = useState('Cash');
  const [detail, setDetail] = useState('');
  const [receivedBy, setReceivedBy] = useState('Gate Officer: M. Tariq');
  const [date] = useState(todayISO());

  // Detailed payment & Studio states
  const [editingEntry, setEditingEntry] = useState<RawEntry | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [colConfig, setColConfig] = useState<LedgerColumnConfig>(() =>
    getStoredLedgerColumnConfig('raw', DEFAULT_LEDGER_COLUMNS)
  );
  const [showExtendedPaymentFields, setShowExtendedPaymentFields] = useState(false);
  const [entryPaidBy, setEntryPaidBy] = useState('');
  const [entryPaidTo, setEntryPaidTo] = useState('');
  const [entryBankName, setEntryBankName] = useState('');
  const [entryAccountNumber, setEntryAccountNumber] = useState('');
  const [entryChequeNo, setEntryChequeNo] = useState('');

  // Add Raw Material Inventory Modal State
  const [isAddMaterialModalOpen, setIsAddMaterialModalOpen] = useState(false);
  const [newMatName, setNewMatName] = useState('');
  const [newMatCategory, setNewMatCategory] = useState('Pipes & Steel');
  const [newMatInitialWeight, setNewMatInitialWeight] = useState('');
  const [newMatWeightUnit, setNewMatWeightUnit] = useState<'kg' | 'grams' | 'tons'>('kg');
  const [newMatInitialQty, setNewMatInitialQty] = useState('');
  const [newMatQtyUnit, setNewMatQtyUnit] = useState('Pcs');
  const [newMatSupplierAssoc, setNewMatSupplierAssoc] = useState('');
  const [newMatCustomSupplier, setNewMatCustomSupplier] = useState('');
  const [newMatLowThreshold, setNewMatLowThreshold] = useState('');
  const [newMatUnitPrice, setNewMatUnitPrice] = useState('');
  const [createSupplierIfNew, setCreateSupplierIfNew] = useState(true);
  const [materialSuccessMessage, setMaterialSuccessMessage] = useState<string | null>(null);

  const handleOpenAddMaterialModal = (defaultSupplierName?: string) => {
    if (defaultSupplierName) {
      setNewMatSupplierAssoc(defaultSupplierName);
    } else if (suppliers.length > 0) {
      setNewMatSupplierAssoc(suppliers[0].name);
    } else {
      setNewMatSupplierAssoc('__none__');
    }
    setNewMatCustomSupplier('');
    setIsAddMaterialModalOpen(true);
  };

  const handleSaveNewRawMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newMatName.trim();
    if (!trimmedName) return;

    // Weight conversion to kg
    const rawWeightVal = parseFloat(newMatInitialWeight) || 0;
    let weightInKg = rawWeightVal;
    if (newMatWeightUnit === 'grams') {
      weightInKg = Number((rawWeightVal / 1000).toFixed(3));
    } else if (newMatWeightUnit === 'tons') {
      weightInKg = Number((rawWeightVal * 1000).toFixed(2));
    }

    const qtyVal = parseInt(newMatInitialQty, 10) || 0;
    const thresholdVal = parseFloat(newMatLowThreshold) || 0;

    // Determine final supplier association name
    let finalSupplier = newMatSupplierAssoc;
    if (newMatSupplierAssoc === '__new__') {
      finalSupplier = newMatCustomSupplier.trim();
    } else if (newMatSupplierAssoc === '__none__') {
      finalSupplier = 'In-House / Direct Purchase';
    }

    // If new supplier entered and is not registered, create them if toggle is on
    if (finalSupplier && finalSupplier !== 'In-House / Direct Purchase') {
      const exists = suppliers.some(s => s.name.toLowerCase() === finalSupplier.toLowerCase());
      if (!exists && createSupplierIfNew) {
        onSaveSupplier({ name: finalSupplier, entries: [] });
      }
    }

    const newStockItem: RawStockItem = {
      id: `rs_${Date.now()}`,
      name: trimmedName,
      category: newMatCategory || 'Raw Material',
      initialWeight: weightInKg,
      weight: weightInKg,
      initialQuantity: qtyVal,
      quantity: qtyVal,
      initialItems: qtyVal,
      items: qtyVal,
      unit: weightInKg > 0 && qtyVal === 0 ? 'kg' : (newMatQtyUnit || 'pcs'),
      lowStockThreshold: thresholdVal > 0 ? thresholdVal : undefined,
      reorderLevel: thresholdVal > 0 ? thresholdVal : undefined,
      supplier: finalSupplier || undefined,
      supplierAssociation: finalSupplier || undefined,
      lastUpdated: todayISO()
    };

    if (onAddRawStock) {
      onAddRawStock(newStockItem);
    }

    // Feedback
    const summary = weightInKg > 0 && qtyVal > 0
      ? `${weightInKg} kg & ${qtyVal} ${newMatQtyUnit}`
      : weightInKg > 0
      ? `${weightInKg} kg`
      : `${qtyVal} ${newMatQtyUnit}`;

    setMaterialSuccessMessage(`"${trimmedName}" (${summary}) saved to Raw Inventory with supplier: ${finalSupplier || 'Unassigned'}`);
    setTimeout(() => {
      setMaterialSuccessMessage(null);
    }, 5000);

    // Reset & close
    setIsAddMaterialModalOpen(false);
    setNewMatName('');
    setNewMatInitialWeight('');
    setNewMatInitialQty('');
    setNewMatSupplierAssoc('');
    setNewMatCustomSupplier('');
    setNewMatLowThreshold('');
    setNewMatUnitPrice('');
  };

  const handleUpdateColConfig = (newCfg: LedgerColumnConfig) => {
    setColConfig(newCfg);
    saveStoredLedgerColumnConfig('raw', newCfg);
  };

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  // Real-time Auto-calculate credit amount (Weight/Items × Rate, with kg/grams support)
  const computeCreditAmount = (
    mode: 'weight' | 'quantity' | 'both',
    wStr: string,
    wUnit: 'kg' | 'grams',
    iStr: string,
    rStr: string,
    rTyp: 'per_kg' | 'per_item'
  ) => {
    const rateNum = parseFloat(rStr) || 0;
    if (rateNum <= 0) return '';
    let quantity = 0;
    if (mode === 'weight') {
      const rawW = parseFloat(wStr) || 0;
      // If grams, convert to kg for rate per kg: (grams / 1000) * rate
      quantity = wUnit === 'grams' ? rawW / 1000 : rawW;
    } else if (mode === 'quantity') {
      quantity = parseFloat(iStr) || 0;
    } else if (mode === 'both') {
      if (rTyp === 'per_item') {
        quantity = parseFloat(iStr) || 0;
      } else {
        const rawW = parseFloat(wStr) || 0;
        quantity = wUnit === 'grams' ? rawW / 1000 : rawW;
      }
    }
    if (quantity <= 0) return '';
    const total = Math.round(quantity * rateNum * 100) / 100;
    return total > 0 ? String(total) : '';
  };

  const handleWeightChange = (newVal: string) => {
    setWeightIn(newVal);
    if (autoCalculate && (entryMode === 'weight' || (entryMode === 'both' && rateType === 'per_kg'))) {
      const calc = computeCreditAmount(entryMode, newVal, weightUnit, itemsIn, rate, rateType);
      if (calc) setCredit(calc);
    }
  };

  const handleWeightUnitChange = (newUnit: 'kg' | 'grams') => {
    setWeightUnit(newUnit);
    if (autoCalculate && (entryMode === 'weight' || (entryMode === 'both' && rateType === 'per_kg'))) {
      const calc = computeCreditAmount(entryMode, weightIn, newUnit, itemsIn, rate, rateType);
      if (calc) setCredit(calc);
    }
  };

  const handleItemsChange = (newVal: string) => {
    setItemsIn(newVal);
    if (autoCalculate && (entryMode === 'quantity' || (entryMode === 'both' && rateType === 'per_item'))) {
      const calc = computeCreditAmount(entryMode, weightIn, weightUnit, newVal, rate, rateType);
      if (calc) setCredit(calc);
    }
  };

  const handleItemUnitChange = (newUnit: string) => {
    setItemUnit(newUnit);
  };

  const handleRateChange = (newVal: string) => {
    setRate(newVal);
    if (autoCalculate) {
      const calc = computeCreditAmount(entryMode, weightIn, weightUnit, itemsIn, newVal, rateType);
      if (calc) setCredit(calc);
    }
  };

  const handleModeSwitch = (newMode: 'weight' | 'quantity' | 'both') => {
    setEntryMode(newMode);
    let newRateType = rateType;
    if (newMode === 'weight') {
      newRateType = 'per_kg';
      setRateType('per_kg');
    } else if (newMode === 'quantity') {
      newRateType = 'per_item';
      setRateType('per_item');
    }
    if (autoCalculate) {
      const calc = computeCreditAmount(newMode, weightIn, weightUnit, itemsIn, rate, newRateType);
      if (calc) setCredit(calc);
    }
  };

  const handleRateTypeSwitch = (newRType: 'per_kg' | 'per_item') => {
    setRateType(newRType);
    if (autoCalculate) {
      const calc = computeCreditAmount(entryMode, weightIn, weightUnit, itemsIn, rate, newRType);
      if (calc) setCredit(calc);
    }
  };

  const handleApplyWeightFromConverter = (weightVal: string, unit: 'kg' | 'grams') => {
    setWeightIn(weightVal);
    setWeightUnit(unit);
    const targetMode = entryMode === 'quantity' ? 'both' : entryMode;
    if (targetMode !== entryMode) setEntryMode(targetMode);
    if (autoCalculate) {
      const calc = computeCreditAmount(targetMode, weightVal, unit, itemsIn, rate, rateType);
      if (calc) setCredit(calc);
    }
  };

  const handleApplyQuantityFromConverter = (itemQty: string, unit: string) => {
    setItemsIn(itemQty);
    setItemUnit(unit);
    const targetMode = entryMode === 'weight' ? 'both' : entryMode;
    if (targetMode !== entryMode) setEntryMode(targetMode);
    if (autoCalculate) {
      const calc = computeCreditAmount(targetMode, weightIn, weightUnit, itemQty, rate, rateType);
      if (calc) setCredit(calc);
    }
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSupplierIdx === null) return;
    const s = suppliers[selectedSupplierIdx];
    if (!s) return;

    const dVal = parseFloat(debit) || 0;
    const cVal = parseFloat(credit) || 0;
    if (dVal <= 0 && cVal <= 0) return;

    // Weight and items parsed conditionally based on selected entry mode
    const hasWeight = entryMode === 'weight' || entryMode === 'both';
    const hasItems = entryMode === 'quantity' || entryMode === 'both';

    const rawW = hasWeight && weightIn ? parseFloat(weightIn) || 0 : 0;
    // Normalize to kg for inventory storage
    const wVal = hasWeight && weightIn ? (weightUnit === 'grams' ? rawW / 1000 : rawW) * (isReturn ? -1 : 1) : undefined;
    const iVal = hasItems && itemsIn ? (parseInt(itemsIn, 10) || 0) * (isReturn ? -1 : 1) : undefined;

    const defaultDesc = entryMode === 'quantity'
      ? `${stockName} (${iVal} ${itemUnit})`
      : entryMode === 'weight'
      ? `${stockName} (${weightIn} ${weightUnit})`
      : `${stockName} (${weightIn} ${weightUnit}, ${iVal} ${itemUnit})`;

    onAddRawEntry(s.name, {
      date,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      desc: desc.trim() || defaultDesc,
      stockName,
      unitType: entryMode,
      itemUnit: hasItems ? itemUnit : undefined,
      weightUnit: hasWeight ? weightUnit : undefined,
      rateType,
      weightIn: wVal,
      itemsIn: iVal,
      rate: rate ? parseFloat(rate) : undefined,
      isReturn,
      debit: dVal,
      credit: cVal,
      method: dVal > 0 ? method : (cVal > 0 && method !== 'Cash' ? method : undefined),
      detail: dVal > 0 ? detail.trim() : (detail.trim() || undefined),
      paidBy: entryPaidBy.trim() || undefined,
      paidTo: entryPaidTo.trim() || undefined,
      bankName: entryBankName.trim() || undefined,
      accountNumber: entryAccountNumber.trim() || undefined,
      chequeNo: entryChequeNo.trim() || undefined,
      receivedBy: receivedBy.trim() || 'Gate Officer: M. Tariq',
      gatePost: 'Raw Material Inward Gate'
    });

    setDesc('');
    setWeightIn('');
    setItemsIn('');
    setRate('');
    setDebit('');
    setCredit('');
    setIsReturn(false);
    setEntryPaidBy('');
    setEntryPaidTo('');
    setEntryBankName('');
    setEntryAccountNumber('');
    setEntryChequeNo('');
  };

  const currentSupplier = selectedSupplierIdx !== null ? suppliers[selectedSupplierIdx] : null;
  const currentBalance = currentSupplier
    ? currentSupplier.entries.reduce((sum, e) => sum + (e.credit || 0) - (e.debit || 0), 0)
    : 0;

  const handleExportCSV = (cfg?: LedgerColumnConfig) => {
    if (!currentSupplier) return;
    const activeCfg = cfg || colConfig;
    const tableData = buildLedgerExportTableData(
      currentSupplier.entries.map(e => ({
        ...e,
        runningBalance: (e.credit || 0) - (e.debit || 0)
      })),
      activeCfg
    );
    downloadCSV(`${currentSupplier.name}_Raw_Ledger`, tableData.headers, tableData.rows);
  };

  const handleExportPDF = (cfg?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    if (!currentSupplier) return;
    const activeCfg = cfg || colConfig;
    const tableData = buildLedgerExportTableData(
      currentSupplier.entries.map(e => ({
        ...e,
        runningBalance: (e.credit || 0) - (e.debit || 0)
      })),
      activeCfg
    );
    exportTablePDF(
      `${currentSupplier.name} — Raw Material Ledger`,
      tableData.headers,
      tableData.rows,
      `${currentSupplier.name}_Raw_Ledger`,
      exportDocConfig?.orientation || 'landscape',
      companyName,
      exportDocConfig?.subtitle || 'Raw Material Supplier Account',
      exportDocConfig?.customNote || `Net Balance: ${fmt(currentBalance)}`,
      exportDocConfig
    );
  };

  const handleExportJPG = (cfg?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    if (!currentSupplier) return;
    const activeCfg = cfg || colConfig;
    const tableData = buildLedgerExportTableData(
      currentSupplier.entries.map(e => ({
        ...e,
        runningBalance: (e.credit || 0) - (e.debit || 0)
      })),
      activeCfg
    );
    exportTableJPG(
      `${currentSupplier.name} — Raw Material Ledger`,
      tableData.headers,
      tableData.rows,
      `${currentSupplier.name}_Raw_Ledger`,
      companyName,
      exportDocConfig?.subtitle || 'Raw Material Supply & Inward Ledger',
      exportDocConfig?.customNote || `Net Balance: ${fmt(currentBalance)}`,
      exportDocConfig
    );
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden break-words">
      {/* View Section Tabs: Suppliers & Raw Ledgers vs Project Cost Estimator */}
      <div className="flex items-center gap-2 border-b border-[var(--steel-line)] pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSectionTab('suppliers')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase transition cursor-pointer border ${
            activeSectionTab === 'suppliers'
              ? 'bg-[var(--yellow)] text-black border-[var(--yellow)] shadow-sm'
              : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-white border-[var(--steel-line)]'
          }`}
        >
          <Layers size={14} />
          <span>Suppliers & Raw Ledgers</span>
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
              activeSectionTab === 'suppliers' ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {suppliers.length}
          </span>
        </button>

        <button
          type="button"
          id="raw-view-project-costing-tab-btn"
          onClick={() => setActiveSectionTab('project_costing')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase transition cursor-pointer border ${
            activeSectionTab === 'project_costing'
              ? 'bg-amber-500 text-black border-amber-400 shadow-sm'
              : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-white border-[var(--steel-line)]'
          }`}
        >
          <Calculator size={14} />
          <span>Customer & Factory Project Costing</span>
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
              activeSectionTab === 'project_costing'
                ? 'bg-black/20 text-black'
                : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            {productionProjects.length} Projects
          </span>
        </button>
      </div>

      {activeSectionTab === 'project_costing' ? (
        <ProjectCostingSection
          projects={productionProjects}
          rawStock={rawStock}
          factories={factories}
          customLedgers={customLedgers}
          workers={workers}
          companyName={companyName}
          language={language}
          onSaveProject={onSaveProject || (() => {})}
          onDeleteProject={onDeleteProject || (() => {})}
        />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3">
            <div>
              <h2 className="font-serif font-black text-xl text-[var(--text)]">{t('rawledger_title')}</h2>
              <p className="text-xs text-[var(--text-dim)]">{t('rawledger_sub')}</p>
            </div>

            <div className="flex items-center gap-2">
              {onNavigate && (
                <button
                  type="button"
                  id="raw-view-forecast-btn"
                  onClick={() => onNavigate('inventory_forecast')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs uppercase shadow hover:bg-amber-500/20 transition cursor-pointer"
                  title="Open Raw Material Inventory Forecast & Predictive Reorder Point Engine"
                >
                  <TrendingUp size={14} className="text-amber-400" />
                  <span>Forecast & ROP</span>
                </button>
              )}

              {onNavigate && (
                <button
                  type="button"
                  id="raw-view-cheques-btn"
                  onClick={() => onNavigate('cheques')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs uppercase shadow hover:bg-amber-500/25 transition cursor-pointer"
                  title="Open Cheques Management & Cross-Check Endorsed Cheques with Raw Material Suppliers"
                >
                  <CreditCard size={14} className="text-amber-400" />
                  <span>Cheques & Endorsements</span>
                </button>
              )}

              <button
                type="button"
                id="raw-view-gate-registry-btn"
                onClick={() => setIsGateRegistryOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs uppercase shadow hover:bg-amber-500/25 transition cursor-pointer"
              >
                <ShieldCheck size={14} className="text-amber-400" />
                <span>Gate Registry (#SEQ)</span>
              </button>

              <button
                type="button"
                id="raw-view-unit-converter-btn"
                onClick={() => setIsConverterOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold text-xs uppercase shadow hover:bg-sky-500/25 transition cursor-pointer"
                title="Open Unit Converter (Tons, Maund, kg, Grams, Packaging Items)"
              >
                <ArrowLeftRight size={14} className="text-sky-400" />
                <span>Converter</span>
              </button>

              <button
                type="button"
                id="raw-view-add-material-btn"
                onClick={() => handleOpenAddMaterialModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase shadow transition active:scale-95 cursor-pointer"
                title="Add a new raw material item to warehouse inventory stock"
              >
                <PackagePlus size={14} strokeWidth={2.5} />
                <span>Add Raw Material</span>
              </button>

              <button
                type="button"
                onClick={() => setAddSupplierModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow transition active:scale-95"
              >
                <Plus size={14} />
                <span>{t('add_supplier')}</span>
              </button>
            </div>
          </div>

          {/* Success Notification Banner */}
          {materialSuccessMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{materialSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setMaterialSuccessMessage(null)}
                className="text-emerald-400 hover:text-emerald-200 text-xs px-2 py-0.5 rounded border border-emerald-500/30"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Live Raw Stock Inventory Strip */}
          <div className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Boxes size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
                    <span>Warehouse Raw Inventory</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                      {rawStock.length} Items Active
                    </span>
                  </h3>
                  <p className="text-[11px] text-[var(--text-dim)]">
                    Live steel, pipes, hardware & chemicals in inventory ({rawStock.reduce((acc, r) => acc + (r.weight !== undefined ? r.weight : (r.initialWeight || 0)), 0).toFixed(1)} kg steel · {rawStock.reduce((acc, r) => acc + (r.quantity !== undefined ? r.quantity : (r.items !== undefined ? r.items : (r.initialQuantity || 0))), 0).toLocaleString()} units)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenAddMaterialModal()}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold uppercase transition cursor-pointer"
                >
                  <PackagePlus size={13} />
                  <span>+ New Material</span>
                </button>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('stock')}
                    className="text-xs text-[var(--yellow)] hover:underline flex items-center gap-1 font-mono"
                  >
                    <span>Full Stock View &rarr;</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Material Cards / Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
              {rawStock.slice(0, 8).map(item => {
                const currentW = item.weight !== undefined ? item.weight : (item.initialWeight || 0);
                const currentQ = item.quantity !== undefined ? item.quantity : (item.items !== undefined ? item.items : (item.initialQuantity || 0));
                const supplierLabel = item.supplier || item.supplierAssociation || 'General Direct';

                return (
                  <div
                    key={item.name}
                    className="p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-emerald-500/40 transition flex flex-col justify-between gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-semibold text-xs text-[var(--text)] line-clamp-1" title={item.name}>
                        {item.name}
                      </span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-300 uppercase shrink-0 font-mono">
                        {item.category || 'Raw'}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between font-mono text-xs">
                      <span className="font-bold text-[var(--yellow)]">
                        {currentW > 0 ? `${currentW.toFixed(1)} kg` : ''}
                        {currentW > 0 && currentQ > 0 ? ' · ' : ''}
                        {currentQ > 0 ? `${currentQ.toLocaleString()} ${item.unit || 'pcs'}` : ''}
                        {currentW === 0 && currentQ === 0 ? '0' : ''}
                      </span>
                      <span className="text-[10px] text-[var(--text-dim)] truncate max-w-[110px]" title={`Supplier: ${supplierLabel}`}>
                        {supplierLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Suppliers Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {suppliers.map((s, idx) => {
              const totalPaid = s.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
              const totalReceived = s.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
              const bal = totalReceived - totalPaid;

              return (
                <div
                  key={s.name}
                  className="bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] rounded-xl p-4 flex flex-col justify-between gap-3 shadow-sm transition group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center text-[var(--yellow)]">
                      <Layers size={16} />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm((t('confirm_delete_supplier') || 'Delete supplier {name}?').replace('{name}', s.name))) {
                          onDeleteSupplier(s.name);
                        }
                      }}
                      className="p-1.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:text-red-400 opacity-80 group-hover:opacity-100 transition"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm text-[var(--text)]">{s.name}</h4>
                    <div className="text-[11px] text-[var(--text-dim)] font-mono mt-0.5">
                      {s.entries.length} delivery/payment entries
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
                      onClick={() => setSelectedSupplierIdx(idx)}
                      className="px-2.5 py-1 rounded bg-[var(--panel-raised)] hover:bg-[var(--yellow)] hover:text-black border border-[var(--steel-line)] text-xs font-semibold transition"
                    >
                      Ledger
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add Supplier Modal */}
      {addSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-sm max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-3">{t('add_supplier')}</h3>
            <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">Supplier / Mill Name</label>
            <input
              type="text"
              required
              value={newSupplierName}
              onChange={e => setNewSupplierName(e.target.value)}
              placeholder="e.g. Ittefaq Steel Mills"
              className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddSupplierModal(false)}
                className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newSupplierName.trim()) {
                    onSaveSupplier({ name: newSupplierName.trim(), entries: [] });
                    setNewSupplierName('');
                    setAddSupplierModal(false);
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

      {/* Supplier Ledger Detail Modal */}
      {currentSupplier && (() => {
        const details = computeSupplierLedgerDetails(currentSupplier.entries);
        const totalWeightReceived = currentSupplier.entries.reduce((sum, e) => sum + (e.weightIn || 0), 0);
        const totalItemsReceived = currentSupplier.entries.reduce((sum, e) => sum + (e.itemsIn || 0), 0);

        const entriesWithWeight = currentSupplier.entries.filter(
          e => (e.weightIn !== undefined && e.weightIn !== 0) || e.unitType === 'weight'
        );
        const entriesWithItems = currentSupplier.entries.filter(
          e => (e.itemsIn !== undefined && e.itemsIn !== 0) || e.unitType === 'quantity'
        );
        const paymentEntries = currentSupplier.entries.filter(e => (e.debit || 0) > 0);

        // Auto-group material breakdown summary
        const materialSummaryMap = new Map<string, {
          material: string;
          deliveriesCount: number;
          totalWeight: number;
          totalItems: number;
          units: Set<string>;
          totalCredit: number;
          rates: number[];
          lastDate: string;
        }>();

        currentSupplier.entries.forEach(e => {
          if (!e.stockName && !e.weightIn && !e.itemsIn && !e.credit) return;
          const matName = e.stockName || 'General Raw Material';
          const existing = materialSummaryMap.get(matName) || {
            material: matName,
            deliveriesCount: 0,
            totalWeight: 0,
            totalItems: 0,
            units: new Set<string>(),
            totalCredit: 0,
            rates: [],
            lastDate: e.date
          };

          if (e.credit && e.credit > 0) {
            existing.deliveriesCount += 1;
          } else if ((e.weightIn || e.itemsIn) && !e.debit) {
            existing.deliveriesCount += 1;
          }
          if (e.weightIn) existing.totalWeight += e.weightIn;
          if (e.itemsIn) existing.totalItems += e.itemsIn;
          if (e.itemUnit) existing.units.add(e.itemUnit);
          if (e.credit) existing.totalCredit += e.credit;
          if (e.rate) existing.rates.push(e.rate);
          if (e.date && e.date > existing.lastDate) existing.lastDate = e.date;

          materialSummaryMap.set(matName, existing);
        });

        const materialSummaryList = Array.from(materialSummaryMap.values());

        // Filtered entries according to active tab
        let filteredEntriesWithBalance = details.entriesWithBalance.filter(e => {
          if (activeLedgerTab === 'weight') {
            return (e.weightIn !== undefined && e.weightIn !== 0) || e.unitType === 'weight';
          }
          if (activeLedgerTab === 'quantity') {
            return (e.itemsIn !== undefined && e.itemsIn !== 0) || e.unitType === 'quantity';
          }
          if (activeLedgerTab === 'payments') {
            return (e.debit || 0) > 0;
          }
          return true;
        });

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          filteredEntriesWithBalance = filteredEntriesWithBalance.filter(e => {
            return (
              (e.stockName && e.stockName.toLowerCase().includes(q)) ||
              (e.desc && e.desc.toLowerCase().includes(q)) ||
              (e.gateSequenceNo && e.gateSequenceNo.toLowerCase().includes(q)) ||
              (e.receivedBy && e.receivedBy.toLowerCase().includes(q)) ||
              (e.method && e.method.toLowerCase().includes(q)) ||
              (e.detail && e.detail.toLowerCase().includes(q)) ||
              (e.paidBy && e.paidBy.toLowerCase().includes(q)) ||
              (e.paidTo && e.paidTo.toLowerCase().includes(q)) ||
              (e.bankName && e.bankName.toLowerCase().includes(q)) ||
              (e.chequeNo && e.chequeNo.toLowerCase().includes(q))
            );
          });
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 font-mono">
            <div className="w-full max-w-4xl max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-3 sm:p-5 shadow-2xl max-h-[94vh] flex flex-col overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-serif font-black text-lg sm:text-xl text-[var(--text)] flex items-center gap-2">
                    <span>{currentSupplier.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--yellow)] font-mono font-normal">
                      Raw Material Supply Ledger
                    </span>
                  </h3>
                  <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
                    Track material inward deliveries by weight, by quantity/items, and payments.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleOpenAddMaterialModal(currentSupplier.name)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase transition shadow cursor-pointer"
                    title={`Add new raw material supplied by ${currentSupplier.name}`}
                  >
                    <PackagePlus size={13} strokeWidth={2.5} />
                    <span>+ Add Material</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsStudioOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-[var(--yellow)] hover:bg-amber-400 text-black text-xs font-bold uppercase transition shadow cursor-pointer"
                    title="Ledger Column & Export Studio"
                  >
                    <Sliders size={13} />
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
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500 hover:text-black text-xs font-semibold text-amber-400 transition"
                    title="Export High-Resolution JPG Image"
                  >
                    <ImageIcon size={12} />
                    <span>JPG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsGateRegistryOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-xs font-semibold text-amber-300 transition"
                    title="View Unified Gate Receipts Registry"
                  >
                    <ShieldCheck size={12} className="text-amber-400" />
                    <span>Gate Registry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSupplierIdx(null)}
                    className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Comprehensive Balance & Quantity/Weight Metrics Cards */}
              <div className="my-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex flex-col justify-between">
                  <div className="text-[10px] uppercase text-[var(--text-dim)] font-semibold flex items-center justify-between">
                    <span>Total Received</span>
                    <span className="text-[9px] text-[var(--red)] font-mono">Credit</span>
                  </div>
                  <div className="text-sm sm:text-base font-bold text-[var(--red)] mt-0.5 truncate">
                    {fmt(details.totalCredits)}
                  </div>
                  <div className="text-[9px] text-[var(--text-dim)] mt-0.5">Inward Deliveries</div>
                </div>

                <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex flex-col justify-between">
                  <div className="text-[10px] uppercase text-[var(--text-dim)] font-semibold flex items-center justify-between">
                    <span>Total Paid</span>
                    <span className="text-[9px] text-[var(--green)] font-mono">Debit</span>
                  </div>
                  <div className="text-sm sm:text-base font-bold text-[var(--green)] mt-0.5 truncate">
                    {fmt(details.totalDebits)}
                  </div>
                  <div className="text-[9px] text-[var(--text-dim)] mt-0.5">{paymentEntries.length} Payment Entries</div>
                </div>

                <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex flex-col justify-between col-span-2 sm:col-span-1">
                  <div className="text-[10px] uppercase text-[var(--text-dim)] font-semibold">Net Balance</div>
                  <div
                    className={`text-sm sm:text-base font-bold mt-0.5 truncate ${
                      details.netBalance > 0
                        ? 'text-[var(--red)]'
                        : details.netBalance < 0
                        ? 'text-[var(--green)]'
                        : 'text-gray-400'
                    }`}
                  >
                    {fmt(Math.abs(details.netBalance))}
                  </div>
                  <div className="text-[9px] font-normal truncate text-[var(--text-dim)]">
                    {details.netBalance > 0 ? '🔴 Owed to Supplier' : details.netBalance < 0 ? '🟢 Advance Paid' : '⚪ Settled'}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex flex-col justify-between">
                  <div className="text-[10px] uppercase text-amber-400 font-semibold flex items-center gap-1">
                    <Scale size={11} />
                    <span>Total Weight</span>
                  </div>
                  <div className="text-sm sm:text-base font-bold text-amber-300 mt-0.5 truncate font-mono">
                    {totalWeightReceived.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    <span className="text-[11px] font-normal text-amber-400/80 ml-1">kg</span>
                  </div>
                  <div className="text-[9px] text-[var(--text-dim)] mt-0.5">{entriesWithWeight.length} deliveries</div>
                </div>

                <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex flex-col justify-between">
                  <div className="text-[10px] uppercase text-sky-400 font-semibold flex items-center gap-1">
                    <Package size={11} />
                    <span>Total Items / Qty</span>
                  </div>
                  <div className="text-sm sm:text-base font-bold text-sky-300 mt-0.5 truncate font-mono">
                    {totalItemsReceived.toLocaleString()}
                    <span className="text-[11px] font-normal text-sky-400/80 ml-1">Units</span>
                  </div>
                  <div className="text-[9px] text-[var(--text-dim)] mt-0.5">{entriesWithItems.length} itemized entries</div>
                </div>
              </div>

              {/* Auto Detailed Tabs Bar & Search */}
              <div className="flex items-center justify-between gap-2 border-b border-[var(--steel-line)] pb-2 flex-wrap">
                <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveLedgerTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
                      activeLedgerTab === 'all'
                        ? 'bg-[var(--yellow)] text-black font-bold shadow'
                        : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
                    }`}
                  >
                    <span>All Entries</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeLedgerTab === 'all' ? 'bg-black/20 text-black' : 'bg-[var(--panel)] text-[var(--text-dim)]'}`}>
                      {currentSupplier.entries.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLedgerTab('weight')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
                      activeLedgerTab === 'weight'
                        ? 'bg-amber-500 text-black font-bold shadow'
                        : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
                    }`}
                  >
                    <Scale size={13} className={activeLedgerTab === 'weight' ? 'text-black' : 'text-amber-400'} />
                    <span>By Weight</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeLedgerTab === 'weight' ? 'bg-black/20 text-black' : 'bg-[var(--panel)] text-[var(--text-dim)]'}`}>
                      {entriesWithWeight.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLedgerTab('quantity')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
                      activeLedgerTab === 'quantity'
                        ? 'bg-sky-500 text-black font-bold shadow'
                        : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
                    }`}
                  >
                    <Package size={13} className={activeLedgerTab === 'quantity' ? 'text-black' : 'text-sky-400'} />
                    <span>By Items / Qty</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeLedgerTab === 'quantity' ? 'bg-black/20 text-black' : 'bg-[var(--panel)] text-[var(--text-dim)]'}`}>
                      {entriesWithItems.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLedgerTab('payments')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
                      activeLedgerTab === 'payments'
                        ? 'bg-emerald-500 text-black font-bold shadow'
                        : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
                    }`}
                  >
                    <span>💳 Payments</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeLedgerTab === 'payments' ? 'bg-black/20 text-black' : 'bg-[var(--panel)] text-[var(--text-dim)]'}`}>
                      {paymentEntries.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLedgerTab('summary')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
                      activeLedgerTab === 'summary'
                        ? 'bg-purple-500 text-white font-bold shadow'
                        : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
                    }`}
                  >
                    <BarChart3 size={13} className={activeLedgerTab === 'summary' ? 'text-white' : 'text-purple-400'} />
                    <span>Breakdown Summary</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeLedgerTab === 'summary' ? 'bg-white/20 text-white' : 'bg-[var(--panel)] text-[var(--text-dim)]'}`}>
                      {materialSummaryList.length}
                    </span>
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[180px] sm:min-w-[220px]">
                  <Search size={12} className="absolute left-2.5 top-2.5 text-[var(--text-dim)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search material, desc, gate #..."
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg pl-7 pr-6 py-1 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--yellow)]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1 text-[var(--text-dim)] hover:text-[var(--text)] text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* View Switch: Breakdown Summary Tab View vs Ledger Table */}
              {activeLedgerTab === 'summary' ? (
                /* Material Breakdown Summary View */
                <div className="flex-1 overflow-auto max-w-full min-h-[200px] max-h-[45vh] shrink-0 border border-[var(--steel-line)] rounded-lg p-3 space-y-3 bg-[var(--panel-raised)]/20">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-[var(--text)] flex items-center gap-2">
                        <Boxes size={16} className="text-purple-400" />
                        <span>Itemized Raw Material Supply Breakdown</span>
                      </h4>
                      <p className="text-[11px] text-[var(--text-dim)]">
                        Automated aggregate totals for all raw products delivered by {currentSupplier.name}.
                      </p>
                    </div>
                    <div className="text-xs font-mono text-[var(--yellow)]">
                      {materialSummaryList.length} Unique Materials Identified
                    </div>
                  </div>

                  {materialSummaryList.length === 0 ? (
                    <div className="text-center py-12 text-[var(--text-dim)]">
                      No material deliveries with quantities or weight logged yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)]">
                          <tr>
                            <th className="p-2.5">Raw Material / Product</th>
                            <th className="p-2.5 text-center">Deliveries</th>
                            <th className="p-2.5 text-right">Total Weight</th>
                            <th className="p-2.5 text-right">Total Items / Qty</th>
                            <th className="p-2.5 text-right">Avg Rate (Rs)</th>
                            <th className="p-2.5 text-right">Total Credit (Rs)</th>
                            <th className="p-2.5 text-center">Last Delivery</th>
                            <th className="p-2.5 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--steel-line)]">
                          {materialSummaryList.map(item => {
                            const avgRate = item.rates.length > 0
                              ? Math.round((item.rates.reduce((a, b) => a + b, 0) / item.rates.length) * 10) / 10
                              : null;
                            const unitLabel = Array.from(item.units).join(', ') || 'Units';

                            return (
                              <tr key={item.material} className="hover:bg-[var(--panel-raised)]/50 transition">
                                <td className="p-2.5 font-semibold text-[var(--text)]">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[var(--yellow)]" />
                                    <span>{item.material}</span>
                                  </div>
                                </td>
                                <td className="p-2.5 text-center font-mono">
                                  <span className="px-2 py-0.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[11px]">
                                    {item.deliveriesCount}
                                  </span>
                                </td>
                                <td className="p-2.5 text-right font-mono">
                                  {item.totalWeight > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-amber-300 font-bold">
                                      <Scale size={11} />
                                      {item.totalWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
                                    </span>
                                  ) : (
                                    <span className="text-[var(--text-dim)]">—</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-right font-mono">
                                  {item.totalItems > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-sky-300 font-bold">
                                      <Package size={11} />
                                      {item.totalItems.toLocaleString()} {unitLabel}
                                    </span>
                                  ) : (
                                    <span className="text-[var(--text-dim)]">—</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-right font-mono text-[var(--text-dim)]">
                                  {avgRate ? `Rs ${avgRate}` : '—'}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-[var(--red)]">
                                  {item.totalCredit > 0 ? fmt(item.totalCredit) : '—'}
                                </td>
                                <td className="p-2.5 text-center text-[var(--text-dim)] font-mono text-[11px]">
                                  {item.lastDate || '—'}
                                </td>
                                <td className="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveLedgerTab('all');
                                      setSearchQuery(item.material);
                                    }}
                                    className="px-2 py-0.5 rounded bg-[var(--panel-raised)] hover:bg-[var(--yellow)] hover:text-black border border-[var(--steel-line)] text-[10px] font-semibold transition cursor-pointer"
                                    title="View ledger entries for this material"
                                  >
                                    View Entries
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-[var(--panel-raised)] font-bold text-xs border-t-2 border-[var(--steel-line)]">
                          <tr>
                            <td className="p-2.5 uppercase text-[var(--yellow)]">Totals</td>
                            <td className="p-2.5 text-center font-mono">
                              {materialSummaryList.reduce((sum, i) => sum + i.deliveriesCount, 0)}
                            </td>
                            <td className="p-2.5 text-right font-mono text-amber-300">
                              {totalWeightReceived.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
                            </td>
                            <td className="p-2.5 text-right font-mono text-sky-300">
                              {totalItemsReceived.toLocaleString()} Units
                            </td>
                            <td className="p-2.5 text-right font-mono text-[var(--text-dim)]">—</td>
                            <td className="p-2.5 text-right font-mono text-[var(--red)]">
                              {fmt(details.totalCredits)}
                            </td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                /* Standard Ledger Table View */
                <>
                  {/* Mobile swipe hint */}
                  <div className="sm:hidden flex items-center justify-between text-[10px] text-[var(--text-dim)] py-1 px-1">
                    <span>← Swipe sideways to view full ledger →</span>
                    <span>{filteredEntriesWithBalance.length} entries</span>
                  </div>

                  {/* Entries list */}
                  <div className="flex-1 overflow-auto max-w-full min-h-[140px] max-h-[45vh] shrink-0 border border-[var(--steel-line)] rounded-lg ledger-scroll-container">
                    <table className="w-full text-left text-xs border-collapse min-w-[1040px]">
                      <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)] sticky top-0 z-10 font-mono tracking-wider">
                        <tr>
                          <th className="p-2.5 whitespace-nowrap min-w-[85px]">Date</th>
                          <th className="p-2.5 whitespace-nowrap min-w-[125px]">Gate / Officer</th>
                          <th className="p-2.5 min-w-[160px]">Description</th>
                          <th className="p-2.5 min-w-[160px]">Material & Qty</th>
                          <th className="p-2.5 text-right whitespace-nowrap min-w-[105px]">Debit (Paid)</th>
                          <th className="p-2.5 text-right whitespace-nowrap min-w-[110px]">Credit (Bill)</th>
                          <th className="p-2.5 text-right whitespace-nowrap min-w-[125px]">Running Balance</th>
                          <th className="p-2.5 whitespace-nowrap min-w-[130px]">Payment Details</th>
                          <th className="p-2.5 text-center whitespace-nowrap min-w-[80px]">Gate Pass</th>
                          <th className="p-2.5 text-center whitespace-nowrap min-w-[70px]">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--steel-line)]">
                        {filteredEntriesWithBalance.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="text-center py-8 text-[var(--text-dim)]">
                              {searchQuery ? `No ledger entries match "${searchQuery}".` : 'No delivery entries logged for this view.'}
                            </td>
                          </tr>
                        ) : (
                          filteredEntriesWithBalance.map(e => (
                            <tr key={e.id} className="hover:bg-[var(--panel-raised)]/50">
                              <td className="p-2.5 whitespace-nowrap">{e.date}</td>
                              <td className="p-2.5 whitespace-nowrap">
                                {e.gateSequence || e.gateSequenceNo ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/25 w-fit">
                                      <Hash size={10} />
                                      {e.gateSequenceNo || `#GATE-${String(e.gateSequence).padStart(3, '0')}`}
                                    </span>
                                    <span className="text-[10px] text-[var(--text-dim)] flex items-center gap-1 truncate max-w-[120px]" title={e.receivedBy || 'Gate Inward'}>
                                      <UserCheck size={9} className="text-emerald-400 shrink-0" />
                                      {e.receivedBy || 'Gate Inward'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-[var(--text-dim)] flex items-center gap-1">
                                    <UserCheck size={9} className="text-gray-500" />
                                    {e.receivedBy || 'Gate Inward'}
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 max-w-[180px] break-words">
                                <div className="font-medium text-[var(--text)]">{e.desc}</div>
                                {e.isReturn && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-red-500/15 border border-red-500/30 text-red-400 text-[9px] font-bold uppercase mt-0.5">
                                    Return (Stock Deducted)
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5">
                                <div className="flex flex-col gap-1">
                                  <span className="font-bold text-[var(--yellow)]">{e.stockName || '—'}</span>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {/* Weight Badge */}
                                    {e.weightIn !== undefined && e.weightIn !== null && e.weightIn !== 0 && (
                                      <span
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                                          e.weightIn < 0
                                            ? 'bg-red-500/15 text-red-300 border-red-500/30'
                                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                        }`}
                                        title={`Weight inward: ${e.weightUnit === 'grams' ? `${Math.round(e.weightIn * 1000)} grams (${e.weightIn} kg)` : `${e.weightIn} kg`}`}
                                      >
                                        <Scale size={10} />
                                        <span>
                                          {e.weightUnit === 'grams'
                                            ? `${e.weightIn > 0 ? `+${Math.round(e.weightIn * 1000)}` : Math.round(e.weightIn * 1000)} g`
                                            : `${e.weightIn > 0 ? `+${e.weightIn}` : e.weightIn} kg`}
                                        </span>
                                      </span>
                                    )}

                                    {/* Items / Quantity Badge */}
                                    {e.itemsIn !== undefined && e.itemsIn !== null && e.itemsIn !== 0 && (
                                      <span
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                                          e.itemsIn < 0
                                            ? 'bg-red-500/15 text-red-300 border-red-500/30'
                                            : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                        }`}
                                        title="Items / Quantity inward"
                                      >
                                        <Package size={10} />
                                        <span>{e.itemsIn > 0 ? `+${e.itemsIn}` : e.itemsIn} {e.itemUnit || 'Pcs'}</span>
                                      </span>
                                    )}

                                    {/* Rate Indicator */}
                                    {e.rate !== undefined && e.rate !== null && e.rate > 0 && (
                                      <span className="text-[10px] text-[var(--text-dim)] font-mono">
                                        @ Rs {e.rate}/{e.rateType === 'per_item' ? (e.itemUnit || 'item') : 'kg'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-2.5 text-right font-semibold text-[var(--green)] whitespace-nowrap font-mono min-w-[110px]">
                                {e.debit ? fmt(e.debit) : '—'}
                              </td>
                              <td className="p-2.5 text-right font-semibold text-[var(--red)] whitespace-nowrap font-mono min-w-[115px]">
                                {e.credit ? fmt(e.credit) : '—'}
                              </td>
                              <td
                                className={`p-2.5 text-right font-bold whitespace-nowrap font-mono min-w-[135px] ${
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
                              <td className="p-2.5 text-xs">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-[var(--text)]">{e.method || (e.debit > 0 ? 'Cash' : '—')}</span>
                                  {e.bankName && (
                                    <span className="text-[10px] text-[var(--yellow)] font-mono">({e.bankName})</span>
                                  )}
                                </div>
                                {(e.paidBy || e.paidTo) && (
                                  <div className="text-[10px] text-[var(--text-dim)] flex items-center gap-1 mt-0.5 flex-wrap">
                                    {e.paidBy && <span>By: <strong className="text-[var(--text)]">{e.paidBy}</strong></span>}
                                    {e.paidTo && <span>→ To: <strong className="text-[var(--text)]">{e.paidTo}</strong></span>}
                                  </div>
                                )}
                                {e.accountNumber && (
                                  <div className="text-[10px] text-[var(--yellow)] font-mono mt-0.5">
                                    A/C: {e.accountNumber}
                                  </div>
                                )}
                                {(e.chequeNo || e.detail) && (
                                  <div className="text-[9px] text-[var(--text-dim)] mt-0.5">
                                    Ref: {e.chequeNo || e.detail} {e.chequeStatus && `(${e.chequeStatus})`}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                {e.gatePass || e.receiptUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewingReceipt({
                                        id: e.id,
                                        sourceType: 'raw_material_supplier',
                                        orderRef: `Raw Mat #${e.id}`,
                                        partyName: currentSupplier.name,
                                        date: e.date,
                                        time: e.time,
                                        gateSequence: e.gateSequence || 1,
                                        gateSequenceNo: e.gateSequenceNo || (e.gateSequence ? `#GATE-${String(e.gateSequence).padStart(3, '0')}` : '#GATE-RAW'),
                                        receivedBy: e.receivedBy || e.gatePass?.receivedBy || 'Gate Inward Officer',
                                        receiverRole: e.gatePass?.receiverRole || 'Gate Inward Officer',
                                        gatePost: e.gatePost || e.gatePass?.gatePost || 'Raw Material Inward Gate',
                                        vehicleNo: e.gatePass?.vehicleNo,
                                        driverName: e.gatePass?.driverName,
                                        notes: e.gatePass?.notes,
                                        summary: `${e.desc} (${e.stockName || 'Raw Material'})`,
                                        totalAmount: e.credit || e.debit || 0,
                                        weightIn: e.weightIn,
                                        rawSupplierName: currentSupplier.name,
                                        fileData: e.gatePass?.fileData || e.receiptUrl || '',
                                        fileName: e.gatePass?.fileName || `GatePass_${e.id}`,
                                        fileType: e.gatePass?.fileType || 'image',
                                        fileSize: e.gatePass?.fileSize,
                                        uploadedAt: e.gatePass?.uploadedAt || e.date,
                                        verified: true
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-semibold hover:bg-emerald-500/25 transition cursor-pointer"
                                    title="View Gate Pass / Delivery Receipt"
                                  >
                                    <Eye size={11} />
                                    <span>Pass</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setUploadingRawEntry({ supplierName: currentSupplier.name, entry: e })}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-semibold hover:bg-amber-500/20 transition cursor-pointer"
                                    title="Attach Gate Pass (PDF/JPG)"
                                  >
                                    <Upload size={10} />
                                    <span>Attach</span>
                                  </button>
                                )}
                              </td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingEntry(e)}
                                    className="text-[var(--text-dim)] hover:text-[var(--yellow)] hover:bg-[var(--panel-raised)] p-1.5 rounded transition cursor-pointer"
                                    title="Edit Entry Details"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteRawEntry(currentSupplier.name, e.id)}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1.5 rounded transition cursor-pointer"
                                    title="Delete Entry"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Quick Add Entry Form with Multi-Selection (Weight, Items, Both) */}
              <form onSubmit={handleAddEntry} className="mt-3 pt-3 border-t border-[var(--steel-line)] space-y-2 text-xs">
                {/* Form Header with Toggle Switch: Quantity (item count) vs Weight (kg/grams) */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="font-bold text-xs uppercase text-[var(--yellow)] flex items-center gap-1">
                      <Plus size={13} />
                      <span>Add Entry:</span>
                    </span>

                    {/* Toggle Switch Component between Quantity and Weight */}
                    <div className="inline-flex items-center p-1 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] shadow-inner">
                      {/* Quantity Option Button */}
                      <button
                        type="button"
                        onClick={() => handleModeSwitch('quantity')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          entryMode === 'quantity'
                            ? 'bg-sky-500 text-black font-bold shadow ring-1 ring-sky-400'
                            : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                        }`}
                        title="Switch to Quantity mode (Item Count)"
                      >
                        <Package size={13} className={entryMode === 'quantity' ? 'text-black' : 'text-sky-400'} />
                        <span>Quantity</span>
                        <span className="text-[10px] opacity-75 hidden sm:inline">(item count)</span>
                      </button>

                      {/* Interactive Mechanical Sliding Toggle Track */}
                      <div
                        role="switch"
                        aria-checked={entryMode === 'weight'}
                        onClick={() => handleModeSwitch(entryMode === 'weight' ? 'quantity' : 'weight')}
                        className={`mx-1.5 relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none ${
                          entryMode === 'weight'
                            ? 'bg-amber-500/80 hover:bg-amber-500'
                            : entryMode === 'quantity'
                            ? 'bg-sky-500/80 hover:bg-sky-500'
                            : 'bg-purple-500'
                        }`}
                        title={`Click to toggle between Quantity & Weight modes (Active: ${entryMode.toUpperCase()})`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                            entryMode === 'weight'
                              ? 'translate-x-5'
                              : entryMode === 'quantity'
                              ? 'translate-x-0'
                              : 'translate-x-2.5'
                          }`}
                        >
                          {entryMode === 'weight' ? (
                            <Scale size={10} className="text-amber-400" />
                          ) : entryMode === 'quantity' ? (
                            <Package size={10} className="text-sky-300" />
                          ) : (
                            <Boxes size={10} className="text-purple-300" />
                          )}
                        </span>
                      </div>

                      {/* Weight Option Button */}
                      <button
                        type="button"
                        onClick={() => handleModeSwitch('weight')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          entryMode === 'weight'
                            ? 'bg-amber-500 text-black font-bold shadow ring-1 ring-amber-400'
                            : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                        }`}
                        title="Switch to Weight mode (kg / grams)"
                      >
                        <Scale size={13} className={entryMode === 'weight' ? 'text-black' : 'text-amber-400'} />
                        <span>Weight</span>
                        <span className="text-[10px] opacity-75 hidden sm:inline">(kg/grams)</span>
                      </button>

                      {/* Dual Both Mode Option */}
                      <button
                        type="button"
                        onClick={() => handleModeSwitch('both')}
                        className={`ml-1 text-[10px] px-2 py-1 rounded-md transition cursor-pointer ${
                          entryMode === 'both'
                            ? 'bg-purple-500 text-white font-bold shadow'
                            : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                        }`}
                        title="Record both Weight and Items count together"
                      >
                        Dual (Both)
                      </button>
                    </div>

                    {/* Auto-calc toggle */}
                    <button
                      type="button"
                      onClick={() => setAutoCalculate(!autoCalculate)}
                      className={`text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                        autoCalculate
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 font-semibold'
                          : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)]'
                      }`}
                      title="Automatically calculate Credit Amount when typing Rate & Quantity/Weight"
                    >
                      <Calculator size={11} />
                      <span>Auto-Calc: {autoCalculate ? 'ON' : 'OFF'}</span>
                    </button>

                    {/* Converter quick toggle */}
                    <button
                      type="button"
                      onClick={() => setShowInlineConverter(!showInlineConverter)}
                      className={`text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                        showInlineConverter
                          ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 font-semibold shadow'
                          : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-sky-300'
                      }`}
                      title="Toggle inline unit conversion calculator"
                    >
                      <ArrowLeftRight size={11} className="text-sky-400" />
                      <span>Converter {showInlineConverter ? '▲' : '▼'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowExtendedPaymentFields(!showExtendedPaymentFields)}
                    className="text-[10px] text-[var(--yellow)] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                  >
                    {showExtendedPaymentFields ? 'Hide Payment Channels' : '+ Detailed Payment (By / To / A/C)'}
                  </button>
                </div>

                {/* Inline Converter Utility */}
                {showInlineConverter && (
                  <div className="my-2">
                    <RawMaterialConverterModal
                      isOpen={true}
                      isInline={true}
                      onClose={() => setShowInlineConverter(false)}
                      onApplyWeight={(val, unit) => handleApplyWeightFromConverter(val, unit)}
                      onApplyQuantity={(qty, unit) => handleApplyQuantityFromConverter(qty, unit)}
                    />
                  </div>
                )}

                {/* Primary Inward Delivery Row - Dynamically changes based on Quantity vs Weight */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-4 flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">
                      Delivery Description
                    </label>
                    <input
                      type="text"
                      required
                      value={desc}
                      onChange={e => setDesc(e.target.value)}
                      placeholder={
                        entryMode === 'quantity'
                          ? `e.g. ${stockName} - ${itemsIn || '500'} ${itemUnit}`
                          : entryMode === 'weight'
                          ? `e.g. ${stockName} - ${weightIn || '450'} ${weightUnit}`
                          : `e.g. ${stockName} Delivery`
                      }
                      className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--yellow)]"
                    />
                  </div>

                  <div className="sm:col-span-3 flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">
                      Material Item
                    </label>
                    <select
                      value={stockName}
                      onChange={e => setStockName(e.target.value)}
                      className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--yellow)] cursor-pointer"
                    >
                      {rawItemNames.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* WEIGHT MODE: Weight In field with dynamic kg / grams toggle */}
                  {entryMode === 'weight' && (
                    <div className="sm:col-span-5 flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                        Inward Weight ({weightUnit})
                      </label>
                      <div className="flex items-center gap-1.5 bg-[var(--panel-raised)] border border-amber-500/40 rounded px-2 py-1">
                        <Scale size={13} className="text-amber-400 shrink-0" />
                        <input
                          type="number"
                          step="any"
                          value={weightIn}
                          onChange={e => handleWeightChange(e.target.value)}
                          placeholder={`Enter weight in ${weightUnit}`}
                          className="flex-1 bg-transparent text-xs text-[var(--text)] font-mono focus:outline-none"
                        />
                        {/* Dynamic Weight Unit Toggle: kg vs grams */}
                        <div className="inline-flex rounded-md bg-[var(--panel)] border border-[var(--steel-line)] p-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleWeightUnitChange('kg')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer ${
                              weightUnit === 'kg'
                                ? 'bg-amber-500 text-black shadow-sm'
                                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                            }`}
                            title="Weight in Kilograms (kg)"
                          >
                            kg
                          </button>
                          <button
                            type="button"
                            onClick={() => handleWeightUnitChange('grams')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer ${
                              weightUnit === 'grams'
                                ? 'bg-amber-500 text-black shadow-sm'
                                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                            }`}
                            title="Weight in Grams (g)"
                          >
                            grams
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* QUANTITY MODE: Item Count field with comprehensive unit selection */}
                  {entryMode === 'quantity' && (
                    <div className="sm:col-span-5 flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                        Inward Quantity ({itemUnit})
                      </label>
                      <div className="flex items-center gap-1.5 bg-[var(--panel-raised)] border border-sky-500/40 rounded px-2 py-1">
                        <Package size={13} className="text-sky-400 shrink-0" />
                        <input
                          type="number"
                          step="1"
                          value={itemsIn}
                          onChange={e => handleItemsChange(e.target.value)}
                          placeholder="Quantity count"
                          className="flex-1 bg-transparent text-xs text-[var(--text)] font-mono focus:outline-none"
                        />
                        <select
                          value={itemUnit}
                          onChange={e => handleItemUnitChange(e.target.value)}
                          className="w-28 bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-0.5 text-xs text-[var(--text)] font-mono shrink-0 cursor-pointer"
                        >
                          <option value="Pcs">Pcs (Pieces)</option>
                          <option value="Nos">Nos (Numbers)</option>
                          <option value="Bundles">Bundles</option>
                          <option value="Boxes">Boxes</option>
                          <option value="Cartons">Cartons</option>
                          <option value="Units">Units</option>
                          <option value="Sets">Sets</option>
                          <option value="Meters">Meters</option>
                          <option value="Coils">Coils</option>
                          <option value="Bags">Bags</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* BOTH MODE: Dual tracking */}
                  {entryMode === 'both' && (
                    <div className="sm:col-span-5 flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                        Dual Inward: Weight & Quantity
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {/* Weight part with kg/grams */}
                        <div className="flex items-center gap-1 bg-[var(--panel-raised)] border border-amber-500/40 rounded px-1.5 py-1">
                          <input
                            type="number"
                            step="any"
                            value={weightIn}
                            onChange={e => handleWeightChange(e.target.value)}
                            placeholder={`Weight (${weightUnit})`}
                            className="w-full bg-transparent text-xs text-[var(--text)] font-mono focus:outline-none"
                          />
                          <div className="inline-flex rounded bg-[var(--panel)] border border-[var(--steel-line)] p-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleWeightUnitChange('kg')}
                              className={`px-1 py-0.2 rounded text-[9px] font-bold font-mono transition cursor-pointer ${
                                weightUnit === 'kg' ? 'bg-amber-500 text-black' : 'text-[var(--text-dim)]'
                              }`}
                            >
                              kg
                            </button>
                            <button
                              type="button"
                              onClick={() => handleWeightUnitChange('grams')}
                              className={`px-1 py-0.2 rounded text-[9px] font-bold font-mono transition cursor-pointer ${
                                weightUnit === 'grams' ? 'bg-amber-500 text-black' : 'text-[var(--text-dim)]'
                              }`}
                            >
                              g
                            </button>
                          </div>
                        </div>

                        {/* Items part */}
                        <div className="flex items-center gap-1 bg-[var(--panel-raised)] border border-sky-500/40 rounded px-1.5 py-1">
                          <input
                            type="number"
                            step="1"
                            value={itemsIn}
                            onChange={e => handleItemsChange(e.target.value)}
                            placeholder="Qty"
                            className="w-14 flex-1 bg-transparent text-xs text-[var(--text)] font-mono focus:outline-none"
                          />
                          <select
                            value={itemUnit}
                            onChange={e => handleItemUnitChange(e.target.value)}
                            className="w-16 bg-[var(--panel)] border border-[var(--steel-line)] rounded px-1 py-0.5 text-[10px] text-[var(--text)] font-mono shrink-0 cursor-pointer"
                          >
                            <option value="Pcs">Pcs</option>
                            <option value="Nos">Nos</option>
                            <option value="Bundles">Bndl</option>
                            <option value="Boxes">Box</option>
                            <option value="Units">Unit</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Extended Payment Channels when toggled */}
                {showExtendedPaymentFields && (
                  <div className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] grid grid-cols-1 sm:grid-cols-3 gap-2 animate-in fade-in duration-150">
                    <input
                      type="text"
                      value={entryPaidBy}
                      onChange={e => setEntryPaidBy(e.target.value)}
                      placeholder="Paid By (Sender / Account Holder)"
                      className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                    />
                    <input
                      type="text"
                      value={entryPaidTo}
                      onChange={e => setEntryPaidTo(e.target.value)}
                      placeholder="Paid To (Receiver / Cashier)"
                      className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                    />
                    <input
                      type="text"
                      value={entryBankName}
                      onChange={e => setEntryBankName(e.target.value)}
                      placeholder="Bank Name (e.g. Meezan, HBL)"
                      className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                    />
                    <input
                      type="text"
                      value={entryAccountNumber}
                      onChange={e => setEntryAccountNumber(e.target.value)}
                      placeholder="Account Number / IBAN"
                      className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                    />
                    <input
                      type="text"
                      value={entryChequeNo}
                      onChange={e => setEntryChequeNo(e.target.value)}
                      placeholder="Cheque # / Trx Reference"
                      className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                    />
                    <input
                      type="text"
                      value={detail}
                      onChange={e => setDetail(e.target.value)}
                      placeholder="Banking Narration / Branch"
                      className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                    />
                  </div>
                )}

                {/* Financial and Payment Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {/* Rate field with unit context */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider flex items-center justify-between">
                      <span>Rate (Rs)</span>
                      {entryMode === 'both' && (
                        <span className="text-[9px] text-[var(--yellow)]">{rateType === 'per_kg' ? '/kg' : `/${itemUnit}`}</span>
                      )}
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={rate}
                        onChange={e => handleRateChange(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 min-w-0 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] font-mono focus:border-[var(--yellow)] focus:outline-none"
                      />
                      {entryMode === 'both' && (
                        <select
                          value={rateType}
                          onChange={e => handleRateTypeSwitch(e.target.value as 'per_kg' | 'per_item')}
                          className="w-16 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-1 py-1 text-[10px] text-[var(--text)] font-mono shrink-0 cursor-pointer"
                          title="Rate applied per kg or per item unit"
                        >
                          <option value="per_kg">/kg</option>
                          <option value="per_item">/{itemUnit}</option>
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Debit / Paid */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      Debit (Paid Rs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={debit}
                      onChange={e => setDebit(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[var(--panel-raised)] border border-emerald-500/30 rounded px-2.5 py-1.5 text-xs text-emerald-300 font-mono focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  {/* Credit / Material Inward with Auto badge clearly decoupled */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-rose-400">Credit (Bill Rs)</span>
                      {autoCalculate && (
                        <span
                          className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-500/30 text-[9px] font-mono text-emerald-400 font-bold"
                          title="Auto-calculated from Quantity/Weight & Rate"
                        >
                          AUTO
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={credit}
                      onChange={e => setCredit(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[var(--panel-raised)] border border-rose-500/30 rounded px-2.5 py-1.5 text-xs text-rose-300 font-mono focus:border-rose-400 focus:outline-none"
                    />
                  </div>

                  {/* Method */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">
                      Method
                    </label>
                    <select
                      value={method}
                      onChange={e => setMethod(e.target.value)}
                      className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)] focus:border-[var(--yellow)] focus:outline-none cursor-pointer"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank</option>
                      <option value="Online">Online</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>

                  {/* Gate Officer Receiver */}
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">
                      Gate Officer
                    </label>
                    <input
                      type="text"
                      value={receivedBy}
                      onChange={e => setReceivedBy(e.target.value)}
                      placeholder="Gate Officer: M. Tariq"
                      title="Name of gate officer receiving delivery"
                      className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] focus:border-[var(--yellow)] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-dim)]">
                    <input
                      type="checkbox"
                      checked={isReturn}
                      onChange={e => setIsReturn(e.target.checked)}
                      className="rounded"
                    />
                    <span>This is a return (deducts stock)</span>
                  </label>

                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow hover:bg-amber-400 transition cursor-pointer"
                  >
                    Save Entry
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Edit Ledger Entry Modal */}
      {editingEntry && (
        <EditLedgerEntryModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          title={`Edit Supplier Entry · ${currentSupplier?.name || ''}`}
          ledgerName={currentSupplier?.name || ''}
          entry={editingEntry}
          onSave={updated => {
            if (currentSupplier && onUpdateRawEntry) {
              onUpdateRawEntry(currentSupplier.name, editingEntry.id, updated);
            }
          }}
        />
      )}

      {/* Ledger Column & Export Studio Modal */}
      {isStudioOpen && currentSupplier && (
        <LedgerStudioModal
          isOpen={isStudioOpen}
          onClose={() => setIsStudioOpen(false)}
          ledgerName={currentSupplier.name}
          ledgerSubtitle="Raw Material Supplier Account Ledger"
          columnConfig={colConfig}
          onUpdateColumnConfig={handleUpdateColConfig}
          companyName={companyName}
          activeBalance={currentBalance}
          sampleRows={currentSupplier.entries}
          onExportCSV={cfg => handleExportCSV(cfg)}
          onExportPDF={(cfg, docCfg) => handleExportPDF(cfg, docCfg)}
          onExportJPG={(cfg, docCfg) => handleExportJPG(cfg, docCfg)}
        />
      )}

      {/* Global Unified Gate Receipts Registry Modal */}
      {isGateRegistryOpen && (
        <UnifiedGateReceiptsModal
          transactions={transactions}
          rawSuppliers={suppliers}
          language={language}
          companyName={companyName}
          onClose={() => setIsGateRegistryOpen(false)}
        />
      )}

      {/* Gate Pass Attachment Modal for Raw Delivery */}
      {uploadingRawEntry && (
        <GatePassUploadModal
          rawEntry={uploadingRawEntry}
          language={language}
          companyName={companyName}
          nextGateSequence={uploadingRawEntry.entry.gateSequence || getNextGateSequence(transactions, suppliers)}
          onClose={() => setUploadingRawEntry(null)}
          onConfirmUpload={(id, gp, rawSupplierName) => {
            if (rawSupplierName && onAttachGatePass) {
              onAttachGatePass(rawSupplierName, id, gp);
            }
            setUploadingRawEntry(null);
          }}
        />
      )}

      {/* Gate Pass Full Viewer Modal */}
      {viewingReceipt && (
        <GatePassViewerModal
          receipt={viewingReceipt}
          language={language}
          companyName={companyName}
          onClose={() => setViewingReceipt(null)}
        />
      )}

      {/* Raw Material Unit Converter Modal */}
      {isConverterOpen && (
        <RawMaterialConverterModal
          isOpen={isConverterOpen}
          onClose={() => setIsConverterOpen(false)}
          onApplyWeight={(val, unit) => {
            handleApplyWeightFromConverter(val, unit);
            setIsConverterOpen(false);
          }}
          onApplyQuantity={(qty, unit) => {
            handleApplyQuantityFromConverter(qty, unit);
            setIsConverterOpen(false);
          }}
        />
      )}

      {/* NEW MODAL: Add Raw Material Inventory Window */}
      {isAddMaterialModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 font-mono animate-in fade-in duration-150"
        >
          <div className="w-full max-w-xl bg-[var(--panel)] border border-emerald-500/50 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[var(--steel-line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <PackagePlus size={20} />
                </div>
                <div>
                  <h3 className="font-serif font-black text-base sm:text-lg text-[var(--text)]">
                    Add Raw Material Inventory
                  </h3>
                  <p className="text-xs text-emerald-400/90 font-sans">
                    Register new raw material into warehouse stock (<span className="font-mono font-bold text-white">state.rawStock</span>) & link supplier
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMaterialModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white transition hover:bg-[var(--panel-raised)]"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Presets for Gujrat Ceiling Fan Down Rod Fabrication */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-1">
                  <span>Quick Presets (Ceiling Fan Rod Industry)</span>
                </label>
                <span className="text-[10px] text-zinc-500">Click to autofill</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: 'M.S. Steel Pipe (16 Gauge - 3/4" Dia)', cat: 'Pipes & Steel', w: '500', unit: 'kg' },
                  { name: 'M.S. Heavy Pipe (14 Gauge - 1" Dia)', cat: 'Pipes & Steel', w: '350', unit: 'kg' },
                  { name: 'M.S. Steel Pipe (18 Gauge - 3/4" Dia)', cat: 'Pipes & Steel', w: '300', unit: 'kg' },
                  { name: 'Safety Bolt & Cotter Pin Sets', cat: 'Fittings & Hardware', q: '1000', unit: 'Pcs' },
                  { name: 'Rubber Bushings & Canopy Collars', cat: 'Fittings & Hardware', q: '1200', unit: 'Pcs' },
                  { name: 'Powder Pure Polyester (White)', cat: 'Coating & Paint', w: '50', unit: 'kg' },
                  { name: 'Powder Epoxy (Matte Black)', cat: 'Coating & Paint', w: '50', unit: 'kg' },
                  { name: 'Corrugated Down Rod Packing Sleeves', cat: 'Packaging Material', q: '800', unit: 'Pcs' },
                  { name: 'Taar 18 Gauge / Safety Wire', cat: 'Electrical / Wire', w: '80', unit: 'kg' }
                ].map(preset => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setNewMatName(preset.name);
                      setNewMatCategory(preset.cat);
                      if (preset.w) {
                        setNewMatInitialWeight(preset.w);
                        setNewMatWeightUnit('kg');
                      }
                      if (preset.q) {
                        setNewMatInitialQty(preset.q);
                        setNewMatQtyUnit(preset.unit || 'Pcs');
                      }
                    }}
                    className="px-2 py-1 rounded bg-[var(--panel-raised)] hover:bg-emerald-500/20 border border-[var(--steel-line)] hover:border-emerald-500/40 text-[10px] text-zinc-300 hover:text-emerald-300 transition text-left"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSaveNewRawMaterial} className="space-y-3.5 text-xs">
              {/* Material Name */}
              <div>
                <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
                  Raw Material Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newMatName}
                  onChange={e => setNewMatName(e.target.value)}
                  placeholder="e.g. M.S. Steel Pipe (16 Gauge - 3/4&quot; Dia) or Pure White Powder"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none"
                />
              </div>

              {/* Category & Unit Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
                    Category
                  </label>
                  <select
                    value={newMatCategory}
                    onChange={e => setNewMatCategory(e.target.value)}
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none"
                  >
                    <option value="Pipes & Steel">Pipes & Steel</option>
                    <option value="Fittings & Hardware">Fittings & Hardware</option>
                    <option value="Coating & Paint">Coating & Paint</option>
                    <option value="Packaging Material">Packaging Material</option>
                    <option value="Electrical / Wire">Electrical / Wire</option>
                    <option value="General Raw">General Raw</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
                    Primary Count Unit
                  </label>
                  <select
                    value={newMatQtyUnit}
                    onChange={e => setNewMatQtyUnit(e.target.value)}
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none"
                  >
                    <option value="Pcs">Pcs (Pieces)</option>
                    <option value="Bundles">Bundles</option>
                    <option value="Coils">Coils</option>
                    <option value="Boxes">Boxes</option>
                    <option value="Bags">Bags / Sacks</option>
                    <option value="Sets">Sets</option>
                  </select>
                </div>
              </div>

              {/* Quantities (Initial Weight & Initial Quantity) */}
              <div className="p-3 rounded-xl bg-[var(--panel-raised)]/70 border border-[var(--steel-line)] space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold block">
                  Initial Stock Inward (Weight & Quantity)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Initial Weight */}
                  <div>
                    <label className="text-[10px] uppercase text-zinc-400 block mb-1">
                      Initial Weight
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={newMatInitialWeight}
                        onChange={e => setNewMatInitialWeight(e.target.value)}
                        placeholder="e.g. 500"
                        className="flex-1 bg-[var(--panel)] border border-[var(--steel-line)] focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-[var(--text)] font-mono outline-none"
                      />
                      <select
                        value={newMatWeightUnit}
                        onChange={e => setNewMatWeightUnit(e.target.value as any)}
                        className="bg-[var(--panel)] border border-[var(--steel-line)] focus:border-emerald-400 rounded-xl px-2.5 py-2 text-xs text-zinc-300 font-mono outline-none shrink-0"
                      >
                        <option value="kg">kg</option>
                        <option value="grams">grams</option>
                        <option value="tons">Tons</option>
                      </select>
                    </div>
                    <span className="text-[9px] text-zinc-500 mt-0.5 block">
                      {newMatWeightUnit === 'tons' && parseFloat(newMatInitialWeight) > 0
                        ? `= ${(parseFloat(newMatInitialWeight) * 1000).toLocaleString()} kg`
                        : newMatWeightUnit === 'grams' && parseFloat(newMatInitialWeight) > 0
                        ? `= ${(parseFloat(newMatInitialWeight) / 1000).toFixed(3)} kg`
                        : 'Stored in kg for math & valuation'}
                    </span>
                  </div>

                  {/* Initial Quantity */}
                  <div>
                    <label className="text-[10px] uppercase text-zinc-400 block mb-1">
                      Initial Quantity / Items
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={newMatInitialQty}
                        onChange={e => setNewMatInitialQty(e.target.value)}
                        placeholder="e.g. 1000"
                        className="flex-1 bg-[var(--panel)] border border-[var(--steel-line)] focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-[var(--text)] font-mono outline-none"
                      />
                      <div className="px-3 py-2 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-300 font-mono text-xs flex items-center justify-center shrink-0">
                        {newMatQtyUnit}
                      </div>
                    </div>
                    <span className="text-[9px] text-zinc-500 mt-0.5 block">
                      Number of units, bolts, pipes, or boxes
                    </span>
                  </div>
                </div>
              </div>

              {/* Supplier Association */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase text-zinc-400 font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building size={12} className="text-emerald-400" />
                    <span>Supplier Association</span>
                  </span>
                  <span className="text-[9px] text-zinc-500 font-normal">Procurement source</span>
                </label>
                <select
                  value={newMatSupplierAssoc}
                  onChange={e => setNewMatSupplierAssoc(e.target.value)}
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none"
                >
                  <option value="__none__">-- In-House / Direct Purchase / Self --</option>
                  {suppliers.map(s => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.entries.length} entries on file)
                    </option>
                  ))}
                  <option value="__new__">+ Enter New Supplier / Mill Name...</option>
                </select>

                {/* Inline New Supplier Name Input */}
                {newMatSupplierAssoc === '__new__' && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 mt-1.5 animate-in fade-in duration-150">
                    <label className="text-[10px] uppercase text-amber-300 font-bold block">
                      New Supplier / Mill Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newMatCustomSupplier}
                      onChange={e => setNewMatCustomSupplier(e.target.value)}
                      placeholder="e.g. Mughal Steel Rolling Mills or Tariq Hardware"
                      className="w-full bg-[var(--panel)] border border-amber-500/50 focus:border-amber-400 rounded-lg px-3 py-1.5 text-xs text-[var(--text)] outline-none"
                    />
                    <label className="flex items-center gap-2 text-[10px] text-zinc-300 cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={createSupplierIfNew}
                        onChange={e => setCreateSupplierIfNew(e.target.checked)}
                        className="rounded border-[var(--steel-line)] text-emerald-500"
                      />
                      <span>Also create new supplier account ledger in Directory (`rawSuppliers`)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Low Stock Alert Threshold & Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] uppercase text-zinc-400 block mb-1">
                    Reorder / Low Stock Alert Level
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newMatLowThreshold}
                    onChange={e => setNewMatLowThreshold(e.target.value)}
                    placeholder="e.g. 100 kg or 200 pcs"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-[var(--text)] font-mono outline-none"
                  />
                  <span className="text-[9px] text-zinc-500 mt-0.5 block">
                    Triggers low stock badge & notifications
                  </span>
                </div>

                <div>
                  <label className="text-[10px] uppercase text-zinc-400 block mb-1">
                    Est. Unit Cost / Rate (Rs)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newMatUnitPrice}
                    onChange={e => setNewMatUnitPrice(e.target.value)}
                    placeholder="e.g. 290 Rs/kg or 15 Rs/pc"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-[var(--text)] font-mono outline-none"
                  />
                  <span className="text-[9px] text-zinc-500 mt-0.5 block">
                    Reference rate for inventory valuation
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--steel-line)]">
                <button
                  type="button"
                  onClick={() => setIsAddMaterialModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--steel-line)] hover:border-zinc-400 text-xs text-zinc-300 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase shadow-md transition cursor-pointer active:scale-95"
                >
                  <PackagePlus size={14} strokeWidth={2.5} />
                  <span>Save to Raw Inventory</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
