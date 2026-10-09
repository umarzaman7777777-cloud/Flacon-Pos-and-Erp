import React, { useState } from 'react';
import {
  Package,
  AlertTriangle,
  Layers,
  Check,
  Plus,
  Minus,
  RefreshCw,
  Truck,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Eye,
  Lock,
  UploadCloud,
  Paperclip,
  SlidersHorizontal,
  BellRing,
  AlertCircle,
  CheckCircle2,
  Filter,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  X
} from 'lucide-react';
import { RawStockItem, Product, Transaction, AppLanguage, GatePassData } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, downloadCSV, exportTablePDF } from '../utils/helpers';
import { exportTableJPG } from '../utils/exportManager';
import { GatePassUploadModal } from './GatePassUploadModal';
import { GatePassViewerModal } from './GatePassViewerModal';
import { TouchRangeSlider } from './TouchRangeSlider';

interface StockViewProps {
  rawStock: RawStockItem[];
  products: Product[];
  transactions: Transaction[];
  language: AppLanguage;
  companyName: string;
  onUpdateRawStock: (name: string, deltaWeight: number, deltaItems: number) => void;
  onResetRawStock: (name: string) => void;
  onAttachGatePass: (txnId: string, gatePass?: GatePassData) => void;
  onUpdateProductStock?: (productId: number, newStock: number) => void;
  onNavigate?: (view: any) => void;
}

export const StockView: React.FC<StockViewProps> = ({
  rawStock,
  products,
  transactions,
  language,
  companyName,
  onUpdateRawStock,
  onResetRawStock,
  onAttachGatePass,
  onUpdateProductStock,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState<'ready' | 'raw' | 'finished'>('ready');
  const [gatePassSubTab, setGatePassSubTab] = useState<'awaiting' | 'solved'>('awaiting');
  const [adjustModalItem, setAdjustModalItem] = useState<RawStockItem | null>(null);
  const [adjustWeight, setAdjustWeight] = useState('');
  const [adjustItems, setAdjustItems] = useState('');

  // User-defined low-stock thresholds with localStorage persistence
  const [finishedThreshold, setFinishedThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('falcon_stock_threshold_finished');
    return saved ? Math.max(1, parseInt(saved, 10)) : 15;
  });

  const [rawWeightThreshold, setRawWeightThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('falcon_stock_threshold_raw');
    return saved ? Math.max(1, parseInt(saved, 10)) : 25;
  });

  const [useProductCustomThreshold, setUseProductCustomThreshold] = useState<boolean>(true);
  const [filterLowOnly, setFilterLowOnly] = useState<boolean>(false);
  const [showThresholdSettings, setShowThresholdSettings] = useState<boolean>(false);

  // Quick Restock modal for finished goods
  const [quickRestockProduct, setQuickRestockProduct] = useState<Product | null>(null);
  const [quickRestockQty, setQuickRestockQty] = useState<string>('20');

  // Custom threshold modal for individual product
  const [editingThresholdProduct, setEditingThresholdProduct] = useState<Product | null>(null);
  const [customThresholdInput, setCustomThresholdInput] = useState<string>('');

  // Gate Pass Modals state
  const [uploadGatePassTxn, setUploadGatePassTxn] = useState<Transaction | null>(null);
  const [viewGatePassTxn, setViewGatePassTxn] = useState<Transaction | null>(null);

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  // Threshold update handlers
  const handleSetFinishedThreshold = (val: number) => {
    const safeVal = Math.max(1, Math.min(9999, Math.round(val)));
    setFinishedThreshold(safeVal);
    localStorage.setItem('falcon_stock_threshold_finished', String(safeVal));
  };

  const handleSetRawWeightThreshold = (val: number) => {
    const safeVal = Math.max(1, Math.min(9999, Math.round(val)));
    setRawWeightThreshold(safeVal);
    localStorage.setItem('falcon_stock_threshold_raw', String(safeVal));
  };

  // Helper to determine threshold for a product
  const getProductThreshold = (p: Product): number => {
    if (useProductCustomThreshold && p.reorderLevel !== undefined && p.reorderLevel > 0) {
      return p.reorderLevel;
    }
    return finishedThreshold;
  };

  const isProductLowStock = (p: Product): boolean => {
    const threshold = getProductThreshold(p);
    return (p.stock || 0) < threshold;
  };

  // Helper for raw material threshold
  const getRawThreshold = (item: RawStockItem): number => {
    if (useProductCustomThreshold && item.lowStockThreshold && item.lowStockThreshold > 0) {
      return item.lowStockThreshold;
    }
    return rawWeightThreshold;
  };

  const isRawLowStock = (item: RawStockItem): boolean => {
    const currentWeight = (item.initialWeight || 0) + (item.weight || 0);
    const threshold = getRawThreshold(item);
    return currentWeight <= threshold;
  };

  const lowStockProducts = products.filter(isProductLowStock);
  const lowStockRaw = rawStock.filter(isRawLowStock);

  // Awaiting orders = transactions without an attached gate pass receipt
  const awaitingOrders = transactions.filter(t => !t.receiptUrl);
  // Solved orders = transactions with an attached gate pass receipt (verified in sales)
  const solvedOrders = transactions.filter(t => !!t.receiptUrl);

  const handleApplyAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalItem) return;
    const w = parseFloat(adjustWeight) || 0;
    const i = parseInt(adjustItems, 10) || 0;
    onUpdateRawStock(adjustModalItem.name, w, i);
    setAdjustModalItem(null);
    setAdjustWeight('');
    setAdjustItems('');
  };

  const handleApplyQuickRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRestockProduct || !onUpdateProductStock) return;
    const added = parseInt(quickRestockQty, 10) || 0;
    const current = quickRestockProduct.stock || 0;
    onUpdateProductStock(quickRestockProduct.id, current + added);
    setQuickRestockProduct(null);
    setQuickRestockQty('20');
  };

  const handleApplyCustomThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingThresholdProduct || !onUpdateProductStock) return;
    const newReorder = parseInt(customThresholdInput, 10);
    // In our app, Product reorderLevel can be set
    editingThresholdProduct.reorderLevel = !isNaN(newReorder) && newReorder > 0 ? newReorder : undefined;
    onUpdateProductStock(editingThresholdProduct.id, editingThresholdProduct.stock || 0);
    setEditingThresholdProduct(null);
    setCustomThresholdInput('');
  };

  const getStockExportData = () => {
    if (activeTab === 'raw') {
      const headers = ['Material Name', 'Weight Balance (kg)', 'Items Count', 'User Threshold (kg)', 'Status'];
      const rows = rawStock.map(item => {
        const currentWeight = (item.initialWeight || 0) + (item.weight || 0);
        const currentItems = (item.initialItems || 0) + (item.items || 0);
        const threshold = getRawThreshold(item);
        const isLow = currentWeight <= threshold;
        const deficit = threshold - currentWeight;
        return [
          item.name,
          `${currentWeight.toFixed(1)} kg`,
          `${currentItems} pcs`,
          `${threshold} kg`,
          isLow ? `LOW STOCK ALERT (-${deficit.toFixed(1)} kg)` : 'SAFE'
        ];
      });
      return { title: `Raw Material Stock (Threshold: ${rawWeightThreshold} kg)`, headers, rows, file: 'Raw_Material_Stock' };
    } else if (activeTab === 'finished') {
      const headers = ['Code', 'Product Name', 'Category', 'Stock Pcs', 'Rate (PKR)', 'Threshold', 'Stock Alert Status'];
      const rows = products.map(p => {
        const threshold = getProductThreshold(p);
        const isLow = (p.stock || 0) < threshold;
        const deficit = threshold - (p.stock || 0);
        return [
          `#${p.id}`,
          p.name,
          p.cat || 'General',
          `${p.stock || 0} pcs`,
          fmt(p.price),
          `${threshold} pcs`,
          isLow ? `CRITICAL LOW (Deficit: -${deficit} pcs)` : 'SAFE'
        ];
      });
      return { title: `Finished Goods Stock (Threshold: ${finishedThreshold} pcs)`, headers, rows, file: 'Finished_Goods_Stock' };
    } else {
      const isAwaiting = gatePassSubTab === 'awaiting';
      const list = isAwaiting ? awaitingOrders : solvedOrders;
      const headers = ['Order #', 'Customer / Factory', 'Date', 'Summary', 'Total (PKR)', 'Gate Pass Status'];
      const rows = list.map(t => [
        t.id,
        t.factory || 'Walk-in',
        t.date,
        t.itemsSummary.replace(/\n/g, ' '),
        fmt(t.total),
        t.receiptUrl ? 'Solved & In Sales (Gate Pass Uploaded)' : 'Awaiting Gate Pass'
      ]);
      return {
        title: isAwaiting ? 'Awaiting Gate Pass Orders' : 'Solved Gate Pass Dispatches (In Sales)',
        headers,
        rows,
        file: isAwaiting ? 'Awaiting_Gate_Pass_Orders' : 'Solved_Gate_Passes'
      };
    }
  };

  const handleExportCSV = () => {
    const data = getStockExportData();
    downloadCSV(data.file, data.headers, data.rows);
  };

  const handleExportPDF = () => {
    const data = getStockExportData();
    exportTablePDF(data.title, data.headers, data.rows, data.file, 'landscape', companyName);
  };

  const handleExportJPG = async () => {
    const data = getStockExportData();
    await exportTableJPG(
      data.title,
      data.headers,
      data.rows,
      data.file,
      companyName,
      'Falcon Factory Stock Audit'
    );
  };

  return (
    <div className="space-y-6 font-mono max-w-full overflow-x-hidden break-words">
      {/* Header with View Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3 font-sans">
        <div>
          <h2 className="font-serif font-black text-xl text-[var(--text)]">{t('stock_title')}</h2>
          <p className="text-xs text-[var(--text-dim)]">{t('stock_sub')}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap max-w-full">
          {/* Tab Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-mono max-w-full overflow-x-auto no-scrollbar">
            <button
              type="button"
              id="stock-tab-ready"
              onClick={() => setActiveTab('ready')}
              className={`px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 ${
                activeTab === 'ready' ? 'bg-[var(--yellow)] text-black' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              <Truck size={13} />
              <span>Gate Pass Receipts</span>
              {awaitingOrders.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-black flex items-center justify-center">
                  {awaitingOrders.length}
                </span>
              )}
            </button>
            <button
              type="button"
              id="stock-tab-raw"
              onClick={() => setActiveTab('raw')}
              className={`px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 ${
                activeTab === 'raw' ? 'bg-[var(--yellow)] text-black' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              <span>Raw Materials</span>
              {lowStockRaw.length > 0 && (
                <span
                  className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse"
                  title={`${lowStockRaw.length} raw materials below safety threshold`}
                >
                  {lowStockRaw.length}
                </span>
              )}
            </button>
            <button
              type="button"
              id="stock-tab-finished"
              onClick={() => setActiveTab('finished')}
              className={`px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 ${
                activeTab === 'finished' ? 'bg-[var(--yellow)] text-black' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              <span>Finished Goods</span>
              {lowStockProducts.length > 0 && (
                <span
                  className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse"
                  title={`${lowStockProducts.length} items below safety threshold`}
                >
                  {lowStockProducts.length}
                </span>
              )}
            </button>

            {onNavigate && (
              <button
                type="button"
                id="stock-tab-forecast"
                onClick={() => onNavigate('inventory_forecast')}
                className="px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 text-amber-400 hover:bg-amber-400/10 border border-amber-400/30 bg-amber-500/5 cursor-pointer"
                title="Open Predictive Raw Material Inventory Forecast & Reorder Points"
              >
                <TrendingUp size={13} className="text-amber-400" />
                <span>Inventory Forecast</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                  ROP
                </span>
              </button>
            )}
          </div>

          {/* User-Defined Threshold Button */}
          <button
            type="button"
            id="threshold-settings-btn"
            onClick={() => setShowThresholdSettings(!showThresholdSettings)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition cursor-pointer ${
              showThresholdSettings
                ? 'bg-[var(--yellow)] text-black border-[var(--yellow)] font-bold shadow-md'
                : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--yellow)]'
            }`}
            title="Configure user-defined low stock threshold"
          >
            <SlidersHorizontal size={13} />
            <span className="hidden sm:inline">Threshold:</span>
            <span className="font-bold text-[var(--text)]">
              {activeTab === 'raw' ? `${rawWeightThreshold} kg` : `${finishedThreshold} pcs`}
            </span>
          </button>

          {/* Quick Export Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[var(--text-dim)] hover:text-[var(--text)] text-xs transition bg-[var(--panel-raised)]"
              title="Export CSV spreadsheet"
            >
              <FileSpreadsheet size={13} />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[var(--text-dim)] hover:text-[var(--text)] text-xs transition bg-[var(--panel-raised)]"
              title="Export formatted PDF"
            >
              <Download size={13} />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              type="button"
              onClick={handleExportJPG}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[var(--text-dim)] hover:text-[var(--text)] text-xs transition bg-[var(--panel-raised)]"
              title="Export high-resolution JPG image"
            >
              <ImageIcon size={13} />
              <span className="hidden sm:inline">JPG</span>
            </button>
          </div>
        </div>
      </div>

      {/* Threshold Configuration Drawer */}
      {showThresholdSettings && (
        <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3 font-sans shadow-lg animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-[var(--yellow)]" />
              <span className="font-bold text-sm text-[var(--text)]">
                {activeTab === 'raw'
                  ? 'Raw Material Low Stock Threshold Settings'
                  : 'Finished Goods Low Stock Threshold Settings'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowThresholdSettings(false)}
              className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {activeTab === 'raw' ? (
            <div className="space-y-3 text-xs font-mono">
              <TouchRangeSlider
                value={rawWeightThreshold}
                min={5}
                max={250}
                step={5}
                unit="kg"
                label="Raw Material Weight Alert Limit"
                onChange={val => handleSetRawWeightThreshold(val)}
                presets={[10, 20, 25, 50, 75, 100, 150]}
                colorScheme="amber"
                secondaryInfo="Raw materials at or below this weight trigger a prominent warning"
              />
              <p className="text-[11px] text-[var(--text-dim)] pt-1 border-t border-[var(--steel-line)]/40">
                Raw materials whose balance falls to or below this weight will trigger a prominent visual warning badge and highlighted border.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-xs font-mono">
              <TouchRangeSlider
                value={finishedThreshold}
                min={1}
                max={100}
                step={1}
                unit="pcs"
                label="Finished Goods Alert Limit"
                onChange={val => handleSetFinishedThreshold(val)}
                presets={[5, 10, 15, 20, 25, 50]}
                colorScheme="amber"
                secondaryInfo="Finished rods at or below this count trigger low stock alerts"
              />

              <div className="flex items-center gap-2 pt-2 border-t border-[var(--steel-line)]/50">
                <label className="flex items-center gap-2 text-xs text-[var(--text-dim)] hover:text-[var(--text)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useProductCustomThreshold}
                    onChange={e => setUseProductCustomThreshold(e.target.checked)}
                    className="accent-[var(--yellow)] rounded"
                  />
                  <span>Respect custom item reorder levels when individually configured</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: Gate Pass Receipts (Ready for Dispatch) */}
      {activeTab === 'ready' && (
        <div className="space-y-4">
          {/* Strict Policy Banner */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[var(--text)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-sans">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 sm:mt-0">
                <ShieldAlert size={18} />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-amber-400 uppercase tracking-wide flex items-center gap-2">
                  <span>Strict Dispatch Policy Enforced</span>
                  <span className="text-[10px] px-2 py-0.2 rounded bg-amber-500/20 border border-amber-500/30 text-[var(--yellow)] font-mono">
                    PDF / JPG Mandatory
                  </span>
                </div>
                <p className="text-xs text-[var(--text-dim)] mt-0.5 leading-relaxed font-mono">
                  Orders cannot be marked <strong>solved or transferred into sales</strong> without uploading an official Gate Pass delivery receipt (PDF or JPG).
                </p>
              </div>
            </div>

            {/* Sub-tab switcher */}
            <div className="flex items-center p-1 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] text-xs font-mono shrink-0 w-full sm:w-auto justify-center">
              <button
                type="button"
                id="gatepass-subtab-awaiting"
                onClick={() => setGatePassSubTab('awaiting')}
                className={`px-3 py-1 rounded-lg transition font-bold flex items-center gap-1.5 ${
                  gatePassSubTab === 'awaiting'
                    ? 'bg-amber-500 text-black shadow'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                <span>Awaiting Gate Pass</span>
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${
                  gatePassSubTab === 'awaiting' ? 'bg-black text-amber-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {awaitingOrders.length}
                </span>
              </button>

              <button
                type="button"
                id="gatepass-subtab-solved"
                onClick={() => setGatePassSubTab('solved')}
                className={`px-3 py-1 rounded-lg transition font-bold flex items-center gap-1.5 ${
                  gatePassSubTab === 'solved'
                    ? 'bg-emerald-500 text-black shadow'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                <span>Solved & In Sales</span>
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${
                  gatePassSubTab === 'solved' ? 'bg-black text-emerald-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {solvedOrders.length}
                </span>
              </button>
            </div>
          </div>

          {/* Sub-View: Awaiting Gate Pass */}
          {gatePassSubTab === 'awaiting' && (
            <div className="space-y-3">
              {awaitingOrders.length === 0 ? (
                <div className="text-center py-12 bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl text-[var(--text-dim)] text-xs flex flex-col items-center justify-center gap-2">
                  <ShieldCheck size={28} className="text-emerald-400" />
                  <span className="font-bold text-[var(--text)]">All orders have been solved with gate passes!</span>
                  <p className="text-[11px] text-[var(--text-dim)]">No pending workshop dispatches awaiting gate pass upload.</p>
                </div>
              ) : (
                awaitingOrders.map(o => (
                  <div
                    key={o.id}
                    id={`awaiting-order-${o.id}`}
                    className="bg-[var(--panel)] border border-amber-500/30 hover:border-amber-500/60 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[var(--yellow)]">Order #{o.id}</span>
                        <span className="text-xs text-[var(--text-dim)]">· {o.date} {o.time}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] uppercase font-bold flex items-center gap-1">
                          <Lock size={10} />
                          <span>Gate Pass Required to Solve</span>
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--text)] font-sans">{o.itemsSummary}</div>
                      <div className="text-xs text-[var(--text-dim)] flex items-center gap-2">
                        <span>Customer: <strong className="text-[var(--text)]">{o.factory || 'Walk-in'}</strong></span>
                        <span>·</span>
                        <span>Size: <span className="text-[var(--text)]">{o.sizes || 'Standard'}</span></span>
                        <span>·</span>
                        <span>Color: <span className="text-[var(--text)]">{o.colors || 'Standard'}</span></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-[var(--steel-line)]/50 pt-2 md:pt-0">
                      <div className="text-left md:text-right">
                        <div className="text-base font-bold text-[var(--yellow)]">{fmt(o.total)}</div>
                        <div className="text-[10px] text-[var(--text-dim)]">{o.paid ? 'Paid' : 'Payment pending'}</div>
                      </div>

                      <button
                        type="button"
                        id={`upload-gatepass-btn-${o.id}`}
                        onClick={() => setUploadGatePassTxn(o)}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase text-xs shadow hover:shadow-amber-500/20 transition cursor-pointer"
                        title="Upload Gate Pass (PDF or JPG) to solve this order and transfer into sales"
                      >
                        <UploadCloud size={14} strokeWidth={2.5} />
                        <span>Upload Gate Pass & Solve</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sub-View: Solved & In Sales */}
          {gatePassSubTab === 'solved' && (
            <div className="space-y-3">
              {solvedOrders.length === 0 ? (
                <div className="text-center py-12 bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl text-[var(--text-dim)] text-xs">
                  No orders have been solved with gate passes yet.
                </div>
              ) : (
                solvedOrders.map(o => {
                  const isPdf =
                    o.gatePass?.fileType === 'pdf' ||
                    o.receiptUrl?.startsWith('data:application/pdf') ||
                    o.gatePass?.fileName?.toLowerCase().endsWith('.pdf');

                  return (
                    <div
                      key={o.id}
                      id={`solved-order-${o.id}`}
                      className="bg-[var(--panel)] border border-emerald-500/30 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[var(--yellow)]">Order #{o.id}</span>
                          <span className="text-xs text-[var(--text-dim)]">· {o.date}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-bold flex items-center gap-1">
                            <ShieldCheck size={11} strokeWidth={2.5} />
                            <span>Solved & Recorded in Sales</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isPdf
                              ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}>
                            {isPdf ? 'PDF Gate Pass' : 'JPG Image Pass'}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-[var(--text)] font-sans">{o.itemsSummary}</div>
                        <div className="text-xs text-[var(--text-dim)] flex items-center gap-2 flex-wrap">
                          <span>Customer: <strong className="text-[var(--text)]">{o.factory || 'Walk-in'}</strong></span>
                          {o.gatePass?.gatePassNo && (
                            <>
                              <span>·</span>
                              <span>Gate Pass: <strong className="text-[var(--yellow)]">{o.gatePass.gatePassNo}</strong></span>
                            </>
                          )}
                          {o.gatePass?.vehicleNo && (
                            <>
                              <span>·</span>
                              <span>Transport: <strong className="text-[var(--text)]">{o.gatePass.vehicleNo}</strong></span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-[var(--steel-line)]/50 pt-2 md:pt-0">
                        <div className="text-left md:text-right">
                          <div className="text-base font-bold text-emerald-400">{fmt(o.total)}</div>
                          <div className="text-[10px] text-[var(--text-dim)]">{o.paid ? 'Paid' : 'On Credit'}</div>
                        </div>

                        <button
                          type="button"
                          id={`view-gatepass-btn-${o.id}`}
                          onClick={() => setViewGatePassTxn(o)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 font-bold uppercase text-xs transition cursor-pointer"
                        >
                          <Eye size={13} />
                          <span>View Gate Pass</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Raw Materials */}
      {activeTab === 'raw' && (
        <div className="space-y-4">
          {/* Visual Alert Banner for Raw Materials */}
          {lowStockRaw.length > 0 ? (
            <div className="p-3.5 sm:p-4 rounded-xl bg-red-500/15 border-2 border-red-500/60 shadow-lg shadow-red-950/40 text-[var(--text)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-sans transition">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0 mt-0.5 sm:mt-0 shadow-xs">
                  <BellRing size={20} className="animate-pulse" />
                </div>
                <div>
                  <div className="text-sm font-black text-red-400 uppercase tracking-wide flex items-center gap-2 flex-wrap">
                    <span>Raw Material Low Stock Alert</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500 text-white font-bold animate-pulse">
                      {lowStockRaw.length} {lowStockRaw.length === 1 ? 'Material Critical' : 'Materials Critical'}
                    </span>
                    <span className="text-xs font-mono text-[var(--text-dim)] font-normal">
                      Threshold: &le; {rawWeightThreshold} kg
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-dim)] mt-0.5 font-mono">
                    The highlighted raw materials have dropped below your safety threshold ({rawWeightThreshold} kg). Immediate procurement needed.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setFilterLowOnly(!filterLowOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition flex items-center gap-1.5 cursor-pointer ${
                    filterLowOnly
                      ? 'bg-red-500 text-white shadow-md'
                      : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40'
                  }`}
                >
                  <Filter size={13} />
                  <span>{filterLowOnly ? 'Showing Critical' : 'Filter Critical'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowThresholdSettings(!showThresholdSettings)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] hover:bg-[var(--panel)] border border-[var(--steel-line)] text-xs text-[var(--text)] font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <SlidersHorizontal size={13} />
                  <span>Threshold ({rawWeightThreshold} kg)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between gap-3 text-xs font-sans">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>All raw materials are safely stocked above your threshold ({rawWeightThreshold} kg).</span>
              </div>
              <button
                type="button"
                onClick={() => setShowThresholdSettings(!showThresholdSettings)}
                className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] underline font-mono cursor-pointer"
              >
                Change threshold
              </button>
            </div>
          )}

          {/* Raw Stock Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {(filterLowOnly ? lowStockRaw : rawStock).map(item => {
              const currentWeight = (item.initialWeight || 0) + (item.weight || 0);
              const currentItems = (item.initialItems || 0) + (item.items || 0);
              const threshold = getRawThreshold(item);
              const isLow = currentWeight <= threshold;
              const deficit = threshold - currentWeight;
              const fillPercent = threshold > 0 ? Math.min(100, Math.max(0, Math.round((currentWeight / threshold) * 100))) : 100;

              return (
                <div
                  key={item.name}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                    isLow
                      ? 'bg-red-950/20 border-2 border-red-500 shadow-lg shadow-red-950/40'
                      : 'bg-[var(--panel)] border-[var(--steel-line)]'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--text)] font-sans">{item.name}</span>
                        {isLow && (
                          <span className="relative flex h-2.5 w-2.5" title="Below low-stock threshold!">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                          </span>
                        )}
                      </div>
                      {isLow ? (
                        <span className="px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-black uppercase tracking-wider animate-pulse">
                          CRITICAL LOW
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                          SAFE
                        </span>
                      )}
                    </div>

                    {isLow && (
                      <div className="mt-1.5 text-[11px] text-red-300 font-bold font-mono">
                        Deficit: -{deficit.toFixed(1)} kg (Limit: {threshold} kg)
                      </div>
                    )}
                  </div>

                  <div className="my-3 space-y-2">
                    <div>
                      <div className={`text-xl font-black ${isLow ? 'text-red-400' : 'text-[var(--yellow)]'}`}>
                        {currentWeight.toFixed(1)} <span className="text-xs font-normal text-[var(--text-dim)]">kg</span>
                      </div>
                      <div className="text-xs text-[var(--text-dim)]">
                        {currentItems} <span className="text-[10px]">pcs/coils</span>
                      </div>
                    </div>

                    {/* Visual Meter */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-[var(--text-dim)] font-mono">
                        <span>Threshold Fill: {fillPercent}%</span>
                        <span>Safe: &gt;{threshold} kg</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden border border-[var(--steel-line)]/50">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isLow ? 'bg-red-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${fillPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--steel-line)]">
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustModalItem(item);
                        setAdjustWeight('');
                        setAdjustItems('');
                      }}
                      className={`flex-1 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                        isLow
                          ? 'bg-red-500 hover:bg-red-400 text-white font-bold shadow'
                          : 'bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text)] hover:border-[var(--yellow)]'
                      }`}
                    >
                      Adjust Stock
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Reset ${item.name} stock to 0?`)) {
                          onResetRawStock(item.name);
                        }
                      }}
                      className="p-1.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:text-red-400 text-[var(--text-dim)] transition cursor-pointer"
                      title="Reset Weight"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Finished Goods */}
      {activeTab === 'finished' && (
        <div className="space-y-4">
          {/* Visual Alert Banner for Finished Goods */}
          {lowStockProducts.length > 0 ? (
            <div className="p-3.5 sm:p-4 rounded-xl bg-red-500/15 border-2 border-red-500/60 shadow-lg shadow-red-950/40 text-[var(--text)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-sans transition">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0 mt-0.5 sm:mt-0 shadow-xs">
                  <BellRing size={20} className="animate-pulse" />
                </div>
                <div>
                  <div className="text-sm font-black text-red-400 uppercase tracking-wide flex items-center gap-2 flex-wrap">
                    <span>Low Stock Alert</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500 text-white font-bold animate-pulse">
                      {lowStockProducts.length} {lowStockProducts.length === 1 ? 'Item Critical' : 'Items Critical'}
                    </span>
                    <span className="text-xs font-mono text-[var(--text-dim)] font-normal">
                      Threshold: &lt; {finishedThreshold} pcs
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-dim)] mt-0.5 font-mono">
                    Finished fan rod stock has dropped below your defined safety limit ({finishedThreshold} pcs). Workshop production or restocking required immediately.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setFilterLowOnly(!filterLowOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition flex items-center gap-1.5 cursor-pointer ${
                    filterLowOnly
                      ? 'bg-red-500 text-white shadow-md'
                      : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40'
                  }`}
                >
                  <Filter size={13} />
                  <span>{filterLowOnly ? 'Showing Critical' : 'Filter Critical'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowThresholdSettings(!showThresholdSettings)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] hover:bg-[var(--panel)] border border-[var(--steel-line)] text-xs text-[var(--text)] font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <SlidersHorizontal size={13} />
                  <span>Threshold ({finishedThreshold} pcs)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between gap-3 text-xs font-sans">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>All finished fan rod items are well-stocked above your safety threshold ({finishedThreshold} pcs).</span>
              </div>
              <button
                type="button"
                onClick={() => setShowThresholdSettings(!showThresholdSettings)}
                className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] underline font-mono cursor-pointer"
              >
                Change threshold
              </button>
            </div>
          )}

          {/* Empty state if filter is active */}
          {filterLowOnly && lowStockProducts.length === 0 ? (
            <div className="text-center py-12 bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl text-[var(--text-dim)] text-xs space-y-2">
              <CheckCircle2 size={24} className="mx-auto text-emerald-400" />
              <div className="font-bold text-[var(--text)]">No items are currently below your threshold ({finishedThreshold} pcs)!</div>
              <button
                type="button"
                onClick={() => setFilterLowOnly(false)}
                className="px-3 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs cursor-pointer"
              >
                Show All Items
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {(filterLowOnly ? lowStockProducts : products).map(p => {
                const pipeStock = rawStock.find(r => r.name.toLowerCase().includes('pipe') || r.name.toLowerCase().includes('steel') || r.name.toLowerCase().includes('tube') || r.name.toLowerCase().includes('wire'));
                const totalKg = pipeStock ? (pipeStock.initialWeight || 0) + (pipeStock.weight || 0) : 0;
                const weightPerPcs = p.recipe?.[0]?.weightPerUnit || 1.2;
                const buildable = weightPerPcs > 0 ? Math.floor(totalKg / weightPerPcs) : 0;

                const threshold = getProductThreshold(p);
                const isLow = (p.stock || 0) < threshold;
                const deficit = threshold - (p.stock || 0);
                const fillPercent = threshold > 0 ? Math.min(100, Math.max(0, Math.round(((p.stock || 0) / threshold) * 100))) : 100;

                return (
                  <div
                    key={p.id}
                    id={`stock-card-product-${p.id}`}
                    className={`rounded-xl p-4 flex flex-col justify-between gap-3 transition ${
                      isLow
                        ? 'bg-red-950/20 border-2 border-red-500 shadow-lg shadow-red-950/40'
                        : 'bg-[var(--panel)] border border-[var(--steel-line)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[var(--text)] font-sans">{p.name}</span>
                            {isLow && (
                              <span className="relative flex h-2.5 w-2.5" title="Critical low inventory!">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[var(--text-dim)] font-mono mt-0.5">
                            {p.cat || 'Rod'} {p.size ? `· ${p.size}` : ''}
                          </div>
                        </div>
                        <div className="text-xs text-[var(--yellow)] font-bold font-mono shrink-0">{fmt(p.price)}</div>
                      </div>

                      {/* Visual Alert Banner inside card */}
                      {isLow ? (
                        <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/50 flex items-center justify-between text-xs font-mono">
                          <span className="text-red-400 font-bold flex items-center gap-1.5">
                            <AlertTriangle size={13} className="shrink-0" />
                            <span>CRITICAL LOW</span>
                          </span>
                          <span className="text-red-300 font-bold">Deficit: -{deficit} pcs</span>
                        </div>
                      ) : (
                        <div className="mt-2.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs font-mono">
                          <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="shrink-0" />
                            <span>Safe Stock</span>
                          </span>
                          <span className="text-[var(--text-dim)]">+{ (p.stock || 0) - threshold } safe</span>
                        </div>
                      )}
                    </div>

                    {/* Stock Meter & Numbers */}
                    <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-dim)]">Finished Stock:</span>
                        <span className={`font-mono font-bold text-sm ${isLow ? 'text-red-400' : 'text-[var(--text)]'}`}>
                          {p.stock || 0} <span className="text-xs font-normal text-[var(--text-dim)]">pcs</span>
                        </span>
                      </div>

                      {/* Visual Stock Level Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-[var(--text-dim)] font-mono">
                          <span>Threshold Level: {fillPercent}%</span>
                          <span>Target: {threshold} pcs</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden border border-[var(--steel-line)]/50">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              fillPercent < 50
                                ? 'bg-red-500'
                                : fillPercent < 100
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, fillPercent)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[11px] pt-1 border-t border-[var(--steel-line)]/50">
                        <span className="text-[var(--text-dim)]">Raw Capacity:</span>
                        <span className="font-bold text-emerald-400">~{buildable} buildable</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1 border-t border-[var(--steel-line)]/60 text-xs">
                      {onUpdateProductStock && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuickRestockProduct(p);
                            setQuickRestockQty('20');
                          }}
                          className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                            isLow
                              ? 'bg-red-500 hover:bg-red-400 text-white shadow-md shadow-red-950/40'
                              : 'bg-[var(--panel-raised)] hover:bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)]'
                          }`}
                          title="Add inventory to this item"
                        >
                          <Plus size={13} />
                          <span>Restock</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setEditingThresholdProduct(p);
                          setCustomThresholdInput(String(threshold));
                        }}
                        className="py-1.5 px-2.5 rounded-lg bg-[var(--panel-raised)] hover:bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] transition flex items-center gap-1 cursor-pointer"
                        title="Set custom reorder threshold for this product"
                      >
                        <SlidersHorizontal size={13} />
                        <span className="text-[10px] font-mono">{threshold}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Quick Restock Modal for Finished Goods */}
      {quickRestockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-md max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-[var(--text)] font-sans">
                Restock {quickRestockProduct.name}
              </h3>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">
                Current Stock: <strong className="text-[var(--yellow)]">{quickRestockProduct.stock || 0} pcs</strong> (Threshold: {getProductThreshold(quickRestockProduct)} pcs)
              </p>
            </div>

            <form onSubmit={handleApplyQuickRestock} className="space-y-4 text-xs">
              <TouchRangeSlider
                value={parseInt(quickRestockQty, 10) || 10}
                min={1}
                max={250}
                step={1}
                unit="pcs"
                label="Add Quantity to Inventory"
                onChange={val => setQuickRestockQty(String(val))}
                presets={[10, 20, 25, 50, 100, 200]}
                secondaryInfo={
                  quickRestockProduct.weight
                    ? `Batch Scale Weight: ~${((parseInt(quickRestockQty, 10) || 10) * (parseFloat(quickRestockProduct.weight) || 0)).toFixed(1)} kg (${quickRestockProduct.weight} / pc)`
                    : undefined
                }
                colorScheme="amber"
              />

              <div className="flex gap-2 pt-2 border-t border-[var(--steel-line)]">
                <button
                  type="button"
                  onClick={() => setQuickRestockProduct(null)}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-[var(--text)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow cursor-pointer active:scale-98 transition"
                >
                  Add {quickRestockQty} to Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Product Custom Threshold Modal */}
      {editingThresholdProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-md max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl space-y-4">
            <div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-[var(--text)] font-sans">
                Set Alert Threshold
              </h3>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">
                Set custom low stock alert level for <strong className="text-[var(--text)]">{editingThresholdProduct.name}</strong>.
              </p>
            </div>

            <form onSubmit={handleApplyCustomThreshold} className="space-y-4 text-xs">
              <TouchRangeSlider
                value={parseInt(customThresholdInput, 10) || 5}
                min={1}
                max={100}
                step={1}
                unit="pcs"
                label="Low Stock Warning Limit"
                onChange={val => setCustomThresholdInput(String(val))}
                presets={[3, 5, 10, 15, 20, 25, 50]}
                secondaryInfo="Alert triggers when shop stock dips below this limit"
                colorScheme="rose"
              />

              <div className="flex gap-2 pt-2 border-t border-[var(--steel-line)]">
                <button
                  type="button"
                  onClick={() => setEditingThresholdProduct(null)}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-[var(--text)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow cursor-pointer active:scale-98 transition"
                >
                  Save Limit ({customThresholdInput} pcs)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-md max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl space-y-4">
            <div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-[var(--text)] mb-1 font-sans">
                Adjust {adjustModalItem.name}
              </h3>
              <p className="text-xs text-[var(--text-dim)]">
                Use the touch range sliders to add or deduct inventory smoothly on mobile.
              </p>
            </div>

            <form onSubmit={handleApplyAdjustment} className="space-y-4 text-xs">
              <TouchRangeSlider
                value={parseFloat(adjustWeight) || 0}
                min={-100}
                max={100}
                step={0.5}
                unit="kg"
                label="Delta Weight"
                onChange={val => setAdjustWeight(String(val))}
                presets={[-50, -25, -10, 0, 10, 25, 50]}
                colorScheme={(parseFloat(adjustWeight) || 0) >= 0 ? 'emerald' : 'rose'}
                secondaryInfo="Negative reduces stock, positive adds raw material"
              />

              <TouchRangeSlider
                value={parseInt(adjustItems, 10) || 0}
                min={-100}
                max={100}
                step={1}
                unit="pcs"
                label="Delta Items"
                onChange={val => setAdjustItems(String(val))}
                presets={[-50, -20, 0, 20, 50, 100]}
                colorScheme={(parseInt(adjustItems, 10) || 0) >= 0 ? 'emerald' : 'rose'}
                secondaryInfo="Negative deducts pieces, positive adds goods"
              />

              <div className="flex gap-2 pt-2 border-t border-[var(--steel-line)]">
                <button
                  type="button"
                  onClick={() => setAdjustModalItem(null)}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow active:scale-98 transition"
                >
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Strict Gate Pass Upload Modal */}
      {uploadGatePassTxn && (
        <GatePassUploadModal
          transaction={uploadGatePassTxn}
          language={language}
          companyName={companyName}
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
    </div>
  );
};
