import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  Truck,
  ShieldAlert,
  Boxes,
  FileSpreadsheet,
  Download,
  Sliders,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  Info,
  CheckCircle2,
  RefreshCw,
  Phone,
  MapPin,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  Send,
  SlidersHorizontal,
  X,
  Plus,
  HelpCircle,
  FileText
} from 'lucide-react';
import { AppState, AppLanguage, RawStockItem } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, downloadCSV, exportTablePDF } from '../utils/helpers';
import {
  calculateInventoryForecast,
  loadSavedLeadTimes,
  saveLeadTimes,
  loadSavedSafetyBuffers,
  saveSafetyBuffers,
  MaterialForecastItem,
  DailyTrajectoryPoint
} from '../utils/inventoryForecastEngine';

interface InventoryForecastViewProps {
  state: AppState;
  language: AppLanguage;
  companyName: string;
  onNavigate?: (view: any) => void;
  onAddRawEntry?: (supplierName: string, entry: any) => void;
  onUpdateRawStock?: (name: string, deltaWeight: number, deltaItems: number) => void;
}

export const InventoryForecastView: React.FC<InventoryForecastViewProps> = ({
  state,
  language,
  companyName,
  onNavigate,
  onAddRawEntry,
  onUpdateRawStock
}) => {
  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  // Simulation Controls State
  const [demandMultiplier, setDemandMultiplier] = useState<number>(1.0); // 1.0 = baseline, 1.3 = +30%
  const [forecastHorizon, setForecastHorizon] = useState<number>(60); // 30, 60, 90 days
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeMaterialId, setActiveMaterialId] = useState<string>('');

  // Custom Lead Times & Safety Buffers (persisted)
  const [customLeadTimes, setCustomLeadTimes] = useState<Record<string, number>>(() => loadSavedLeadTimes());
  const [customSafetyBuffers, setCustomSafetyBuffers] = useState<Record<string, number>>(() => loadSavedSafetyBuffers());

  // Quick PO Draft Modal
  const [draftingMaterial, setDraftingMaterial] = useState<MaterialForecastItem | null>(null);
  const [draftQuantity, setDraftQuantity] = useState<string>('');
  const [draftRate, setDraftRate] = useState<string>('');
  const [draftSupplier, setDraftSupplier] = useState<string>('');
  const [draftNotes, setDraftNotes] = useState<string>('');
  const [draftSuccessNotice, setDraftSuccessNotice] = useState<string>('');

  // Info modal for formulas
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);

  // Compute Forecast via Calculation Engine
  const forecastResult = useMemo(() => {
    return calculateInventoryForecast(state, {
      demandMultiplier,
      horizonDays: forecastHorizon,
      customLeadTimes,
      customSafetyBuffers
    });
  }, [state, demandMultiplier, forecastHorizon, customLeadTimes, customSafetyBuffers]);

  const materials = forecastResult.materials;

  // Selected or default active material for detailed inspection
  const activeMaterial = useMemo(() => {
    if (activeMaterialId) {
      const found = materials.find(m => m.id === activeMaterialId || m.name === activeMaterialId);
      if (found) return found;
    }
    // Default to the highest risk material, or the first one
    return materials[0] || null;
  }, [materials, activeMaterialId]);

  // Filtered materials for grid
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'pipes' && !m.name.toLowerCase().includes('pipe')) return false;
        if (selectedCategory === 'fittings' && !m.name.toLowerCase().includes('bolt') && !m.name.toLowerCase().includes('fitting')) return false;
        if (selectedCategory === 'bushings' && !m.name.toLowerCase().includes('bush') && !m.name.toLowerCase().includes('ring')) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [materials, selectedCategory, searchQuery]);

  // Handler to adjust lead time for a material
  const handleLeadTimeChange = (materialKey: string, newDays: number) => {
    const val = Math.max(1, Math.min(60, Math.round(newDays)));
    const updated = { ...customLeadTimes, [materialKey]: val };
    setCustomLeadTimes(updated);
    saveLeadTimes(updated);
  };

  // Handler to adjust safety buffer for a material
  const handleSafetyBufferChange = (materialKey: string, newDays: number) => {
    const val = Math.max(0, Math.min(30, Math.round(newDays)));
    const updated = { ...customSafetyBuffers, [materialKey]: val };
    setCustomSafetyBuffers(updated);
    saveSafetyBuffers(updated);
  };

  // Open Draft Purchase Order Modal
  const handleOpenDraftPO = (m: MaterialForecastItem) => {
    setDraftingMaterial(m);
    setDraftQuantity(String(m.suggestedReorderQuantity));
    setDraftRate(String(m.latestPurchaseRate));
    setDraftSupplier(m.primarySupplierName);
    setDraftNotes(`Order for ${m.name} based on predictive inventory forecast. Lead time: ${m.leadTimeDays} days.`);
    setDraftSuccessNotice('');
  };

  // Submit Draft PO to rawSuppliers
  const handleConfirmDraftPO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftingMaterial || !draftSupplier) return;

    const qty = parseFloat(draftQuantity) || draftingMaterial.suggestedReorderQuantity;
    const rate = parseFloat(draftRate) || draftingMaterial.latestPurchaseRate;
    const totalCost = qty * rate;

    const todayStr = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
    const newEntry = {
      id: `reorder_po_${Date.now()}`,
      date: todayStr,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      desc: `Restock Purchase: ${qty} ${draftingMaterial.unit} ${draftingMaterial.name}`,
      stockName: draftingMaterial.name,
      weightIn: draftingMaterial.unit === 'kg' ? qty : undefined,
      itemsIn: draftingMaterial.unit !== 'kg' ? qty : undefined,
      rate,
      rateType: draftingMaterial.unit === 'kg' ? 'weight' : 'fixed',
      debit: 0,
      credit: totalCost,
      method: 'Pending Invoice',
      detail: draftNotes || 'Auto-generated from Inventory Forecast'
    };

    if (onAddRawEntry) {
      onAddRawEntry(draftSupplier, newEntry);
    }

    setDraftSuccessNotice(`Purchase order for ${qty} ${draftingMaterial.unit} successfully booked with ${draftSupplier}!`);
    setTimeout(() => {
      setDraftingMaterial(null);
      setDraftSuccessNotice('');
    }, 1800);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Raw Material',
      'Category',
      'Unit',
      'Current Stock',
      'Reorder Point (ROP)',
      'Lead Time (Days)',
      'Safety Buffer (Days)',
      'Avg Daily Consumption (ADC)',
      'Days To Reorder',
      'Predicted Reorder Date',
      'Days To Depletion',
      'Predicted Stockout Date',
      'Urgency Status',
      'Suggested Order Qty',
      'Est Cost (PKR)',
      'Supplier'
    ];

    const rows = materials.map(m => [
      m.name,
      m.category,
      m.unit,
      m.currentStock,
      m.effectiveReorderPoint,
      m.leadTimeDays,
      m.safetyBufferDays,
      m.averageDailyConsumption,
      m.daysUntilReorderPoint,
      m.predictedReorderDate,
      m.daysUntilStockout,
      m.predictedStockoutDate,
      m.urgencyLabel,
      m.suggestedReorderQuantity,
      m.estimatedReorderCost,
      m.primarySupplierName
    ]);

    downloadCSV(
      `Falcon_Raw_Material_Inventory_Forecast_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows,
      `Falcon Rod Maker · Forecast generated on ${forecastResult.asOfDate} with ${demandMultiplier}x demand multiplier`
    );
  };

  // Export PDF Report
  const handleExportPDF = () => {
    const headers = [
      'Raw Material',
      'Stock',
      'ROP',
      'Lead',
      'ADC/day',
      'Reorder In',
      'Reorder Date',
      'Stockout Date',
      'Urgency',
      'Suggest Qty',
      'Est Cost'
    ];

    const rows = materials.map(m => [
      m.name.length > 25 ? m.name.slice(0, 24) + '…' : m.name,
      `${m.currentStock} ${m.unit}`,
      `${m.effectiveReorderPoint} ${m.unit}`,
      `${m.leadTimeDays}d`,
      `${m.averageDailyConsumption} ${m.unit}`,
      m.daysUntilReorderPoint === 0 ? 'NOW' : `${m.daysUntilReorderPoint} days`,
      m.predictedReorderDate,
      m.predictedStockoutDate,
      m.urgencyLabel,
      `${m.suggestedReorderQuantity} ${m.unit}`,
      fmt(m.estimatedReorderCost)
    ]);

    exportTablePDF(
      'Raw Material Inventory Forecast & Reorder Prediction',
      headers,
      rows,
      `Falcon_Inventory_Forecast_${new Date().toISOString().slice(0, 10)}.pdf`,
      'landscape',
      companyName || 'Falcon Rod Maker',
      `Analysis As Of: ${forecastResult.asOfDate} · Demand Scenario: ${(demandMultiplier * 100).toFixed(0)}% · Active Horizon: ${forecastHorizon} Days`,
      `Critical Items: ${forecastResult.overallUrgencySummary.criticalCount} | Reorder Soon: ${forecastResult.overallUrgencySummary.reorderSoonCount} | Safe: ${forecastResult.overallUrgencySummary.healthyCount}`
    );
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner & Header */}
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Sparkles size={13} className="text-amber-500" />
                {language === 'ur' ? 'تجزیاتی پیشن گوئی' : 'Predictive Inventory Intelligence'}
              </span>
              <span className="text-xs text-[var(--text-dim)] font-mono">
                {language === 'ur' ? `تاریخ: ${forecastResult.asOfDate}` : `As of: ${forecastResult.asOfDate}`}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)]">
              {t('forecast_title')}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-dim)] mt-1 max-w-3xl">
              {t('forecast_sub')}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFormulaModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] text-[var(--text)] hover:border-amber-400 transition"
              title="View reorder formula and calculation methodology"
            >
              <HelpCircle size={15} className="text-amber-400" />
              <span>{language === 'ur' ? 'فارمولہ اور طریقہ کار' : 'ROP Formula'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] text-[var(--text)] hover:border-[var(--yellow)] transition"
            >
              <FileSpreadsheet size={15} className="text-emerald-400" />
              <span>{language === 'ur' ? 'ایکسپورٹ CSV' : 'Export CSV'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[var(--yellow)] text-black hover:opacity-90 transition shadow-sm"
            >
              <Download size={15} />
              <span>{language === 'ur' ? 'پی ڈی ایف رپورٹ' : 'PDF Forecast Memo'}</span>
            </button>
          </div>
        </div>

        {/* Sales Activity Summary Strip */}
        <div className="mt-5 pt-4 border-t border-[var(--border)]/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <Boxes size={16} />
            </div>
            <div>
              <div className="text-[var(--text-dim)] text-[11px]">{language === 'ur' ? 'تجزیہ شدہ آرڈرز' : 'Orders Analyzed'}</div>
              <div className="font-bold text-sm text-[var(--text)]">
                {forecastResult.salesMetrics.totalTransactionsAnalyzed}{' '}
                <span className="text-[10px] font-normal text-[var(--text-dim)]">({forecastResult.salesMetrics.totalFinishedUnitsSold} rods)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingUp size={16} />
            </div>
            <div>
              <div className="text-[var(--text-dim)] text-[11px]">{language === 'ur' ? 'سیلز کی رفتار' : 'Sales Run-Rate'}</div>
              <div className="font-bold text-sm text-[var(--text)] flex items-center gap-1">
                {forecastResult.salesMetrics.averageDailySalesVolume} rods/day
                {forecastResult.salesMetrics.salesVelocityChangePct > 0 ? (
                  <span className="text-[10px] text-emerald-400 flex items-center font-semibold">
                    <ArrowUpRight size={12} />+{forecastResult.salesMetrics.salesVelocityChangePct}%
                  </span>
                ) : forecastResult.salesMetrics.salesVelocityChangePct < 0 ? (
                  <span className="text-[10px] text-rose-400 flex items-center font-semibold">
                    <ArrowDownRight size={12} />{forecastResult.salesMetrics.salesVelocityChangePct}%
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Flame size={16} />
            </div>
            <div>
              <div className="text-[var(--text-dim)] text-[11px]">{language === 'ur' ? 'پائپ کی روزانہ کھپت' : 'Daily Steel Burn'}</div>
              <div className="font-bold text-sm text-[var(--text)]">
                {materials.find(m => m.name.toLowerCase().includes('16 gauge') || m.name.toLowerCase().includes('steel pipe'))?.averageDailyConsumption || 18.5} kg/day
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert size={16} />
            </div>
            <div>
              <div className="text-[var(--text-dim)] text-[11px]">{language === 'ur' ? 'فوری ری آرڈر ضروری' : 'Immediate Reorder'}</div>
              <div className="font-bold text-sm text-rose-400">
                {forecastResult.overallUrgencySummary.criticalCount > 0 ? (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    {forecastResult.overallUrgencySummary.criticalCount} Materials at ROP
                  </span>
                ) : (
                  <span className="text-emerald-400 font-semibold">All Safe &gt; ROP</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Simulation & What-If Parameter Controls */}
      <div className="bg-[var(--panel)] border border-amber-500/30 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-amber-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text)]">
              {language === 'ur' ? 'سیلز سیزن اور سپلائر سمولیشن (What-If Analysis)' : 'Peak Season & Lead Time Simulator'}
            </h2>
            {demandMultiplier !== 1.0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                Active Scenario: {(demandMultiplier * 100).toFixed(0)}% Demand
              </span>
            )}
          </div>

          {demandMultiplier !== 1.0 && (
            <button
              type="button"
              onClick={() => setDemandMultiplier(1.0)}
              className="text-xs text-amber-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <RefreshCw size={12} />
              {language === 'ur' ? 'نارمل سیلز پر ری سیٹ کریں' : 'Reset to Baseline (1.0x)'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Slider 1: Sales Demand Multiplier */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-dim)] font-medium">
                {language === 'ur' ? 'سیلز رش / سیزنل ضرب' : 'Sales Volume Surge Multiplier'}:
              </span>
              <span className="font-mono font-bold text-amber-400">
                {demandMultiplier === 1.0
                  ? '1.0x (Normal)'
                  : demandMultiplier > 1.0
                  ? `${demandMultiplier}x (+${Math.round((demandMultiplier - 1) * 100)}% Surge)`
                  : `${demandMultiplier}x (${Math.round((demandMultiplier - 1) * 100)}% Lull)`}
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={demandMultiplier}
              onChange={e => setDemandMultiplier(parseFloat(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[var(--text-dim)] font-mono">
              <span>0.5x (Quiet)</span>
              <span>1.0x (Baseline)</span>
              <span>1.5x (+50% Summer)</span>
              <span>2.5x (Peak Rush)</span>
            </div>
          </div>

          {/* Slider 2: Forecast Horizon */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-dim)] font-medium">
                {language === 'ur' ? 'پیش گوئی کی مدت' : 'Forecast Projection Horizon'}:
              </span>
              <span className="font-mono font-bold text-blue-400">
                {forecastHorizon} Days
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[30, 60, 90].map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setForecastHorizon(days)}
                  className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                    forecastHorizon === days
                      ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                      : 'border-[var(--border)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>
            <div className="text-[10px] text-[var(--text-dim)]">
              {language === 'ur' ? 'اگلے 30 سے 90 دن کی کھپت ٹریجیکٹری کا مشاہدہ کریں۔' : 'Simulate daily stock levels and depletion curve into the future.'}
            </div>
          </div>

          {/* Category Quick Filter */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-dim)] font-medium">
                {language === 'ur' ? 'خام مال زمرہ' : 'Filter Raw Material Category'}:
              </span>
              <span className="text-[11px] text-[var(--text-dim)]">{filteredMaterials.length} materials</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'pipes', label: 'M.S. Pipes' },
                { id: 'fittings', label: 'Fittings' },
                { id: 'bushings', label: 'Rings/Bush' }
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`py-1.5 text-xs font-semibold rounded-lg border transition text-center truncate px-1 ${
                    selectedCategory === cat.id
                      ? 'border-[var(--yellow)] bg-[var(--yellow)] text-black'
                      : 'border-[var(--border)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder={language === 'ur' ? 'خام مال تلاش کریں...' : 'Search raw materials...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>
      </div>

      {/* Primary Forecast Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Boxes size={18} className="text-amber-400" />
            <h2 className="text-base font-bold text-[var(--text)]">
              {language === 'ur' ? 'خام مال کی پیشن گوئی اور ری آرڈر پوائنٹس' : 'Raw Materials Reorder Status & Projections'}
            </h2>
          </div>
          <span className="text-xs text-[var(--text-dim)]">
            {language === 'ur' ? 'کلک کر کے تفصیلی چارٹ دیکھیں' : 'Click any card to inspect trajectory curve'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
          {filteredMaterials.map(m => {
            const isSelected = activeMaterial?.id === m.id || activeMaterial?.name === m.name;
            const stockPctOfROP = m.effectiveReorderPoint > 0 ? (m.currentStock / m.effectiveReorderPoint) * 100 : 100;
            const isCritical = m.urgencyStatus === 'critical';
            const isReorderSoon = m.urgencyStatus === 'reorder_soon';

            return (
              <div
                key={m.id || m.name}
                onClick={() => setActiveMaterialId(m.id || m.name)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-amber-400 bg-[var(--panel-raised)] shadow-md ring-1 ring-amber-400/40'
                    : 'border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-strong)]'
                }`}
              >
                {/* Status Header Badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
                      {m.category}
                    </span>
                    <h3 className="text-base font-bold text-[var(--text)] truncate">
                      {m.name}
                    </h3>
                  </div>

                  <div className="shrink-0">
                    {isCritical ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                        <AlertTriangle size={12} />
                        {language === 'ur' ? 'فوری آرڈر کریں!' : 'REORDER NOW'}
                      </span>
                    ) : isReorderSoon ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <Clock size={12} />
                        {language === 'ur' ? `${m.daysUntilReorderPoint} دن باقی` : `Reorder in ${m.daysUntilReorderPoint}d`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 size={12} />
                        {language === 'ur' ? `${m.daysUntilReorderPoint} دن محفوظ` : `Safe (${m.daysUntilReorderPoint}d to ROP)`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stock Level Gauge & Metrics */}
                <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-3.5 mb-3">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div>
                      <span className="text-2xl font-black text-[var(--text)] tracking-tight">
                        {m.currentStock.toLocaleString()}{' '}
                        <span className="text-xs font-normal text-[var(--text-dim)]">{m.unit}</span>
                      </span>
                      <span className="text-[11px] text-[var(--text-dim)] ml-2">
                        {language === 'ur' ? 'موجودہ اسٹاک' : 'Current Stock'}
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-amber-400">
                        ROP: {m.effectiveReorderPoint} {m.unit}
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)]">
                        Lead: {m.leadTimeDays}d + Buffer: {m.safetyBufferDays}d
                      </div>
                    </div>
                  </div>

                  {/* Stock vs ROP Progress Bar */}
                  <div className="w-full bg-[var(--border)] h-2.5 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full transition-all rounded-full ${
                        isCritical
                          ? 'bg-rose-500'
                          : isReorderSoon
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(8, stockPctOfROP * 0.6))}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-mono text-[var(--text-dim)] mt-1.5">
                    <span>Zero Stock (Stockout)</span>
                    <span className="text-amber-400 font-bold">▲ Reorder Point ({m.effectiveReorderPoint} {m.unit})</span>
                    <span>Safe Level</span>
                  </div>
                </div>

                {/* Forecast Timeline Dates Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--border)]">
                    <div className="text-[10px] text-[var(--text-dim)] flex items-center gap-1">
                      <Calendar size={11} className="text-amber-400" />
                      {language === 'ur' ? 'ری آرڈر پوائنٹ تاریخ' : 'Predicted Reorder Date'}
                    </div>
                    <div className="font-bold text-sm text-[var(--text)] mt-0.5">
                      {isCritical ? (
                        <span className="text-rose-400 font-black">TODAY (OVERDUE)</span>
                      ) : (
                        m.predictedReorderDate
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)]">
                      {isCritical ? 'Stock is at or below threshold' : `In ${m.daysUntilReorderPoint} calendar days`}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--border)]">
                    <div className="text-[10px] text-[var(--text-dim)] flex items-center gap-1">
                      <Clock size={11} className="text-rose-400" />
                      {language === 'ur' ? 'مکمل اسٹاک خاتمہ تاریخ' : 'Zero Stock Depletion Date'}
                    </div>
                    <div className="font-bold text-sm text-[var(--text)] mt-0.5">
                      {m.predictedStockoutDate}
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)]">
                      {language === 'ur' ? `اندرون ${m.daysUntilStockout} دن` : `In ${m.daysUntilStockout} days at current burn`}
                    </div>
                  </div>
                </div>

                {/* Consumption Velocity & Lead Time Sliders */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-2 border-t border-[var(--border)] mb-3">
                  <div>
                    <span className="text-[10px] text-[var(--text-dim)] block">
                      {language === 'ur' ? 'روزانہ اوسط کھپت' : 'Daily Burn (ADC)'}
                    </span>
                    <span className="font-bold font-mono text-[var(--text)]">
                      {m.averageDailyConsumption} {m.unit}/day
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-[var(--text-dim)] block">
                      {language === 'ur' ? 'تجویز کردہ آرڈر' : 'Suggested Reorder'}
                    </span>
                    <span className="font-bold font-mono text-emerald-400">
                      {m.suggestedReorderQuantity} {m.unit}
                    </span>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-[var(--text-dim)] block">
                      {language === 'ur' ? 'تخمینہ رقم' : 'Est. Order Cost'}
                    </span>
                    <span className="font-bold font-mono text-[var(--yellow)]">
                      {fmt(m.estimatedReorderCost)}
                    </span>
                  </div>
                </div>

                {/* Lead Time & Buffer Inline Steppers */}
                <div className="bg-[var(--panel)] border border-[var(--border)]/70 rounded-lg p-2.5 mb-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Truck size={14} className="text-blue-400" />
                    <div>
                      <div className="font-semibold text-[11px] text-[var(--text)]">
                        {language === 'ur' ? 'سپلائر ڈیلیوری دن' : 'Supplier Lead Time'}:
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)]">Time from mill to workshop</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleLeadTimeChange(m.id || m.name, m.leadTimeDays - 1)}
                      className="w-6 h-6 rounded bg-[var(--panel-raised)] border border-[var(--border)] flex items-center justify-center text-xs font-bold hover:bg-amber-400 hover:text-black transition"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold w-7 text-center text-amber-400">
                      {m.leadTimeDays}d
                    </span>
                    <button
                      type="button"
                      onClick={() => handleLeadTimeChange(m.id || m.name, m.leadTimeDays + 1)}
                      className="w-6 h-6 rounded bg-[var(--panel-raised)] border border-[var(--border)] flex items-center justify-center text-xs font-bold hover:bg-amber-400 hover:text-black transition"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Bottom Actions: Draft Reorder PO */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-[var(--text-dim)] truncate max-w-[190px]">
                    <span className="font-medium text-[var(--text)]">{m.primarySupplierName}</span>
                  </div>

                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleOpenDraftPO(m);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      isCritical
                        ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm'
                        : 'bg-amber-400/20 text-amber-300 hover:bg-amber-400 hover:text-black border border-amber-400/30'
                    }`}
                  >
                    <ShoppingCart size={13} />
                    <span>{language === 'ur' ? 'آرڈر ڈرافٹ کریں' : 'Draft Reorder PO'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deep-Dive Inspection Panel for the Active Material */}
      {activeMaterial && (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono uppercase text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                  In-Depth Material Depletion Analysis
                </span>
                <span className="text-xs text-[var(--text-dim)] font-mono">
                  Unit: {activeMaterial.unit}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)]">
                {activeMaterial.name}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenDraftPO(activeMaterial)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[var(--yellow)] text-black hover:opacity-90 transition"
              >
                <ShoppingCart size={14} />
                <span>{language === 'ur' ? 'خریداری آرڈر ڈرافٹ' : 'Draft Supplier Purchase Order'}</span>
              </button>
            </div>
          </div>

          {/* Interactive Trajectory Curve & Timeline */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                  <TrendingUp size={16} className="text-amber-400" />
                  {language === 'ur' ? 'اسٹاک تنزلی اور ری آرڈر ٹریجیکٹری چارٹ' : 'Stock Depletion Curve & Reorder Window'}
                </h3>
                <p className="text-xs text-[var(--text-dim)]">
                  {demandMultiplier === 1.0
                    ? `Showing ${forecastHorizon}-day trajectory based on historical sales run-rate (${activeMaterial.averageDailyConsumption} ${activeMaterial.unit}/day).`
                    : `Comparing baseline vs ${demandMultiplier}x simulated surge (${activeMaterial.averageDailyConsumption} ${activeMaterial.unit}/day).`}
                </p>
              </div>

              {/* Chart Legend */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-blue-400 inline-block" />
                  <span className="text-[var(--text-dim)]">Baseline Stock</span>
                </div>
                {demandMultiplier !== 1.0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-amber-400 border-dashed border-b-2 border-amber-400 inline-block" />
                    <span className="text-amber-400 font-bold">Simulated ({(demandMultiplier * 100).toFixed(0)}%)</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-rose-500 inline-block" />
                  <span className="text-rose-400">ROP Threshold ({activeMaterial.effectiveReorderPoint} {activeMaterial.unit})</span>
                </div>
              </div>
            </div>

            {/* SVG Interactive Trajectory Chart */}
            <div className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-xl p-4 overflow-x-auto">
              <div className="min-w-[550px] h-[220px] relative">
                {/* SVG Visual Chart */}
                {(() => {
                  const points = activeMaterial.trajectory;
                  if (!points || points.length === 0) return null;

                  const maxStock = Math.max(
                    activeMaterial.currentStock * 1.15,
                    activeMaterial.effectiveReorderPoint * 1.5,
                    100
                  );

                  const width = 600;
                  const height = 180;
                  const padX = 40;
                  const padY = 20;
                  const chartW = width - padX - 20;
                  const chartH = height - padY - 20;

                  // Scale helpers
                  const getX = (idx: number) => padX + (idx / (points.length - 1)) * chartW;
                  const getY = (val: number) => padY + chartH - (Math.max(0, val) / maxStock) * chartH;

                  // ROP Y line
                  const ropY = getY(activeMaterial.effectiveReorderPoint);

                  // Path for baseline
                  const baselinePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.stockLevel)}`).join(' ');

                  // Path for simulated
                  const simPath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.simulatedStockLevel ?? p.stockLevel)}`).join(' ');

                  return (
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                      {/* Grid Lines */}
                      <line x1={padX} y1={padY} x2={width - 20} y2={padY} stroke="currentColor" className="text-[var(--border)]" strokeDasharray="3 3" />
                      <line x1={padX} y1={padY + chartH / 2} x2={width - 20} y2={padY + chartH / 2} stroke="currentColor" className="text-[var(--border)]" strokeDasharray="3 3" />
                      <line x1={padX} y1={padY + chartH} x2={width - 20} y2={padY + chartH} stroke="currentColor" className="text-[var(--border)]" />

                      {/* Safety Stock / ROP Zone */}
                      <rect
                        x={padX}
                        y={ropY}
                        width={chartW}
                        height={Math.max(0, padY + chartH - ropY)}
                        fill="rgba(244, 63, 94, 0.08)"
                      />

                      {/* ROP Threshold Line */}
                      <line
                        x1={padX}
                        y1={ropY}
                        x2={width - 20}
                        y2={ropY}
                        stroke="#f43f5e"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <text x={padX + 6} y={ropY - 4} fill="#f43f5e" fontSize="9" fontWeight="bold">
                        ROP Trigger: {activeMaterial.effectiveReorderPoint} {activeMaterial.unit}
                      </text>

                      {/* Baseline Line */}
                      <path
                        d={baselinePath}
                        fill="none"
                        stroke="#60a5fa"
                        strokeWidth="2.5"
                      />

                      {/* Simulated Surge Line */}
                      {demandMultiplier !== 1.0 && (
                        <path
                          d={simPath}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth="2.5"
                          strokeDasharray="4 3"
                        />
                      )}

                      {/* Start Point Circle */}
                      <circle cx={getX(0)} cy={getY(activeMaterial.currentStock)} r="4" fill="#38bdf8" />
                      <text x={getX(0) + 6} y={getY(activeMaterial.currentStock) - 6} fill="#38bdf8" fontSize="10" fontWeight="bold">
                        Today: {activeMaterial.currentStock} {activeMaterial.unit}
                      </text>

                      {/* Axis Labels */}
                      <text x={padX} y={height - 4} fill="currentColor" className="text-[var(--text-dim)]" fontSize="9">Today</text>
                      <text x={padX + chartW / 2} y={height - 4} fill="currentColor" className="text-[var(--text-dim)]" fontSize="9" textAnchor="middle">
                        +{Math.round(forecastHorizon / 2)} Days
                      </text>
                      <text x={width - 20} y={height - 4} fill="currentColor" className="text-[var(--text-dim)]" fontSize="9" textAnchor="end">
                        +{forecastHorizon} Days
                      </text>

                      {/* Y-axis Labels */}
                      <text x={padX - 4} y={padY + 8} fill="currentColor" className="text-[var(--text-dim)]" fontSize="9" textAnchor="end">
                        {Math.round(maxStock)}
                      </text>
                      <text x={padX - 4} y={padY + chartH} fill="currentColor" className="text-[var(--text-dim)]" fontSize="9" textAnchor="end">
                        0
                      </text>
                    </svg>
                  );
                })()}
              </div>

              {/* Trajectory Milestone Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[var(--border)] text-xs">
                <div>
                  <span className="text-[10px] text-[var(--text-dim)] block">Today's Balance</span>
                  <span className="font-bold text-sm text-[var(--text)]">
                    {activeMaterial.currentStock} {activeMaterial.unit}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-dim)] block">Reorder Milestone Date</span>
                  <span className="font-bold text-sm text-amber-400">
                    {activeMaterial.predictedReorderDate}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-dim)] block">Lead Time Window</span>
                  <span className="font-bold text-sm text-blue-400">
                    {activeMaterial.leadTimeDays} Days to Deliver
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-dim)] block">Total Stockout Zero Line</span>
                  <span className="font-bold text-sm text-rose-400">
                    {activeMaterial.predictedStockoutDate}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bill of Materials (BOM) & Finished Rod Sales Correlation */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                  <Layers size={16} className="text-blue-400" />
                  {language === 'ur' ? 'پروڈکٹ ترکیب اور کھپت کا تناسب (Bill of Materials)' : 'Finished Fan Rod Bill of Materials (BOM) Share'}
                </h3>
                <p className="text-xs text-[var(--text-dim)]">
                  {language === 'ur'
                    ? 'کس تیار پروڈکٹ کی فروخت سے اس خام مال کی کتنی کھپت ہوتی ہے۔'
                    : 'Breakdown of sales transactions and recipe consumption per finished fan rod.'}
                </p>
              </div>
            </div>

            {activeMaterial.consumingProducts.length > 0 ? (
              <div className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-xl overflow-x-auto max-w-full ledger-scroll-container">
                <table className="w-full text-xs text-left min-w-[540px]">
                  <thead className="bg-[var(--panel)] border-b border-[var(--border)] text-[var(--text-dim)] font-mono text-[10px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Finished Product</th>
                      <th className="py-2.5 px-3">Unit Recipe</th>
                      <th className="py-2.5 px-3 text-right">Units Sold</th>
                      <th className="py-2.5 px-3 text-right">Total Burned</th>
                      <th className="py-2.5 px-3">Share %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {activeMaterial.consumingProducts.map(p => (
                      <tr key={p.productId} className="hover:bg-[var(--panel)]/60 transition">
                        <td className="py-2.5 px-3 font-semibold text-[var(--text)]">
                          {p.productName}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-dim)] font-mono">
                          {p.qtyPerUnit} {p.unit}/rod
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--text)]">
                          {p.historicalUnitsSold.toLocaleString()} pcs
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                          {p.totalConsumed.toLocaleString()} {p.unit}
                        </td>
                        <td className="py-2.5 px-3 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-[var(--border)] h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-amber-400 h-full rounded-full"
                                style={{ width: `${p.percentageShare}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] font-bold text-[var(--text)] w-8 text-right">
                              {p.percentageShare}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--panel-raised)] text-xs text-[var(--text-dim)] text-center">
                Standard baseline consumption applied from workshop catalog.
              </div>
            )}
          </div>

          {/* Supplier Contact Card & Purchase Specs */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                Primary Supplier Partner
              </span>
              <h4 className="text-base font-bold text-[var(--text)]">
                {activeMaterial.primarySupplierName}
              </h4>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-dim)]">
                <span className="flex items-center gap-1">
                  <Phone size={12} className="text-amber-400" />
                  {activeMaterial.primarySupplierContact}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={12} className="text-amber-400" />
                  {activeMaterial.primarySupplierLocation}
                </span>
                <span className="font-mono text-amber-300">
                  Last Rate: Rs {activeMaterial.latestPurchaseRate}/{activeMaterial.unit}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenDraftPO(activeMaterial)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-400 text-black hover:bg-amber-300 transition shadow shrink-0 self-start sm:self-auto"
            >
              <ShoppingCart size={15} />
              <span>
                {language === 'ur'
                  ? `آرڈر ڈرافٹ: ${activeMaterial.suggestedReorderQuantity} ${activeMaterial.unit}`
                  : `Draft Order: ${activeMaterial.suggestedReorderQuantity} ${activeMaterial.unit}`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Traceable Recent Raw Material Burn Log */}
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <Flame size={16} className="text-rose-400" />
              {language === 'ur' ? 'حالیہ سیلز آرڈرز سے خام مال کٹوتی لاگ' : 'Recent Sales Invoices & Raw Material Burn Audit'}
            </h3>
            <p className="text-xs text-[var(--text-dim)]">
              {language === 'ur'
                ? 'ہر سیلز آرڈر کے ساتھ خودکار طور پر کم ہونے والے خام مال کا ریکارڈ۔'
                : 'Direct linkage between finished rod sales and underlying raw material consumption.'}
            </p>
          </div>
          <span className="text-xs text-[var(--text-dim)] font-mono">
            Last {forecastResult.recentBurnLog.length} orders
          </span>
        </div>

        {forecastResult.recentBurnLog.length > 0 ? (
          <div className="overflow-x-auto max-w-full ledger-scroll-container">
            <table className="w-full text-xs text-left min-w-[620px]">
              <thead className="bg-[var(--panel-raised)] border-b border-[var(--border)] text-[var(--text-dim)] font-mono text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Order #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Customer Workshop</th>
                  <th className="py-2.5 px-3">Finished Items Summary</th>
                  <th className="py-2.5 px-3 text-right">Rods</th>
                  <th className="py-2.5 px-3">Raw Material Deducted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {forecastResult.recentBurnLog.map(log => (
                  <tr key={log.txnId} className="hover:bg-[var(--panel-raised)]/40 transition">
                    <td className="py-2 px-3 font-mono font-bold text-amber-400">
                      #{log.txnId}
                    </td>
                    <td className="py-2 px-3 text-[var(--text-dim)] whitespace-nowrap">
                      {log.date}
                    </td>
                    <td className="py-2 px-3 font-semibold text-[var(--text)]">
                      {log.factoryName}
                    </td>
                    <td className="py-2 px-3 text-[var(--text-dim)] max-w-xs truncate">
                      {log.itemsSummary}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-[var(--text)]">
                      {log.finishedUnits} pcs
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1.5">
                        {log.materialDeductions.map((d, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20"
                          >
                            <span>{d.materialName.split(' ')[0]}</span>
                            <span className="font-bold text-amber-400">-{d.amount} {d.unit}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[var(--text-dim)]">
            No sales burn log recorded yet.
          </div>
        )}
      </div>

      {/* Modal: Draft Purchase Order / Reorder */}
      {draftingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[var(--panel)] border border-amber-400/40 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              type="button"
              onClick={() => setDraftingMaterial(null)}
              className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-[var(--text)] transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart size={18} className="text-amber-400" />
              <h3 className="text-lg font-bold text-[var(--text)]">
                {language === 'ur' ? 'خام مال خریداری آرڈر ڈرافٹ' : 'Draft Supplier Purchase Order'}
              </h3>
            </div>
            <p className="text-xs text-[var(--text-dim)] mb-4">
              Pre-filled from predictive inventory model based on ADC and lead time.
            </p>

            {draftSuccessNotice ? (
              <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{draftSuccessNotice}</span>
              </div>
            ) : (
              <form onSubmit={handleConfirmDraftPO} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-dim)] mb-1">
                    Raw Material Item
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={draftingMaterial.name}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] text-[var(--text)] font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-dim)] mb-1">
                      Order Quantity ({draftingMaterial.unit})
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={draftQuantity}
                      onChange={e => setDraftQuantity(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] text-[var(--text)] font-mono font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-dim)] mb-1">
                      Rate per {draftingMaterial.unit} (PKR)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={draftRate}
                      onChange={e => setDraftRate(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] text-[var(--text)] font-mono font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-dim)] mb-1">
                    Supplier Name
                  </label>
                  <input
                    type="text"
                    required
                    value={draftSupplier}
                    onChange={e => setDraftSupplier(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] text-[var(--text)] focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-dim)] mb-1">
                    Estimated Total Order Value
                  </label>
                  <div className="text-xl font-bold font-mono text-[var(--yellow)] px-3 py-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--border)]">
                    {fmt((parseFloat(draftQuantity) || 0) * (parseFloat(draftRate) || 0))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-dim)] mb-1">
                    PO Notes / Delivery Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={draftNotes}
                    onChange={e => setDraftNotes(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] text-[var(--text)] focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDraftingMaterial(null)}
                    className="px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] text-[var(--text)] hover:opacity-80"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-[var(--yellow)] text-black hover:opacity-90 transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} />
                    <span>Confirm & Book in Supplier Ledger</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Formulas & Methodology Guide */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl w-full max-w-xl p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowFormulaModal(false)}
              className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-[var(--text)] transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <HelpCircle size={20} className="text-amber-400" />
              <h3 className="text-lg font-bold text-[var(--text)]">
                {language === 'ur' ? 'ری آرڈر پوائنٹ (ROP) فارمولہ اور حساب کتاب' : 'Inventory Forecasting Methodology & ROP Formulas'}
              </h3>
            </div>

            <div className="space-y-4 text-xs text-[var(--text-dim)] leading-relaxed">
              <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--border)]">
                <div className="font-bold text-[var(--text)] mb-1">
                  1. Average Daily Consumption (ADC)
                </div>
                <div className="font-mono text-amber-400">
                  ADC = Total Raw Material Burned via Finished Sales / Active Days Span
                </div>
                <div className="text-[11px] mt-1">
                  Calculated from each sales invoice multiplied by its bill of materials recipe (e.g. 0.8 kg per 18" Deluxe, 1.1 kg per 24" Standard, 1.75 kg per 36" Industrial).
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--border)]">
                <div className="font-bold text-[var(--text)] mb-1">
                  2. Safety Stock Buffer (SS)
                </div>
                <div className="font-mono text-amber-400">
                  Safety Stock = (Safety Buffer Days × ADC) + (0.5 × σ_d × √LeadTime)
                </div>
                <div className="text-[11px] mt-1">
                  Protects the workshop against supplier delivery delays from Gujranwala steel mills or sudden customer rush orders.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--border)]">
                <div className="font-bold text-[var(--text)] mb-1">
                  3. Effective Reorder Point (ROP)
                </div>
                <div className="font-mono text-amber-400">
                  ROP = (ADC × Supplier Lead Time) + Safety Stock
                </div>
                <div className="text-[11px] mt-1">
                  The exact stock level where a new order MUST be placed so materials arrive before inventory reaches zero.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--border)]">
                <div className="font-bold text-[var(--text)] mb-1">
                  4. Days Until Reorder & Depletion
                </div>
                <div className="font-mono text-amber-400">
                  Days to ROP = (Current Stock - ROP) / ADC
                </div>
                <div className="font-mono text-amber-400 mt-1">
                  Days to Stockout = Current Stock / ADC
                </div>
              </div>
            </div>

            <div className="mt-5 text-right">
              <button
                type="button"
                onClick={() => setShowFormulaModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--yellow)] text-black"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
