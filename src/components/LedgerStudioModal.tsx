import React, { useState } from 'react';
import {
  Sliders,
  Check,
  RotateCcw,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Palette,
  Layout,
  Type,
  Eye,
  X,
  Sparkles,
  Printer
} from 'lucide-react';
import { LedgerColumnConfig, ExportDocumentConfig } from '../types';
import {
  EXPORT_THEME_PRESETS,
  DEFAULT_EXPORT_CONFIG,
  getSavedExportConfig,
  saveExportConfig
} from '../utils/exportSettingsHelper';
import { fmt } from '../utils/helpers';
import { hapticTransactionComplete } from '../utils/haptics';

export const DEFAULT_LEDGER_COLUMNS: LedgerColumnConfig = {
  showDate: true,
  showTime: false,
  showDesc: true,
  showDebit: true,
  showCredit: true,
  showBalance: true,
  showMethod: true,
  showPaidBy: true,
  showPaidTo: true,
  showAccount: true,
  showRef: true,
  showTax: false
};

export interface ColumnOptionItem {
  key: keyof LedgerColumnConfig;
  label: string;
  category: 'core' | 'financial' | 'payment';
  desc: string;
}

export const LEDGER_COLUMN_OPTIONS: ColumnOptionItem[] = [
  { key: 'showDate', label: 'Date', category: 'core', desc: 'Transaction entry date (YYYY-MM-DD)' },
  { key: 'showTime', label: 'Time Stamp', category: 'core', desc: 'Exact time of booking / dispatch' },
  { key: 'showDesc', label: 'Description', category: 'core', desc: 'Narrative, order number, batch references' },
  { key: 'showDebit', label: 'Debit (Due / Billed)', category: 'financial', desc: 'Amount billed or owed to workshop' },
  { key: 'showCredit', label: 'Credit (Received / Paid)', category: 'financial', desc: 'Amount received or deposited' },
  { key: 'showBalance', label: 'Running Net Balance', category: 'financial', desc: 'Progressive cumulative ledger balance' },
  { key: 'showMethod', label: 'Payment Method', category: 'payment', desc: 'Cash, Online Transfer, Bank, Cheque' },
  { key: 'showPaidBy', label: 'Paid By (Sender)', category: 'payment', desc: 'Whome made the payment / party name' },
  { key: 'showPaidTo', label: 'Paid To (Receiver)', category: 'payment', desc: 'To whome payment was delivered / cashier' },
  { key: 'showAccount', label: 'Bank Name & A/C #', category: 'payment', desc: 'Which bank and account number / IBAN' },
  { key: 'showRef', label: 'Cheque # / Trx Ref', category: 'payment', desc: 'Bank reference, cheque slip number' },
  { key: 'showTax', label: 'Tax / Deductions', category: 'financial', desc: 'Withholding tax percent and amount' }
];

interface LedgerStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  ledgerName: string;
  ledgerSubtitle?: string;
  columnConfig: LedgerColumnConfig;
  onUpdateColumnConfig: (config: LedgerColumnConfig) => void;
  companyName: string;
  activeBalance?: number;
  sampleRows?: any[];
  onExportCSV: (config: LedgerColumnConfig) => void;
  onExportPDF: (config: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => void;
  onExportJPG: (config: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => void;
}

export const LedgerStudioModal: React.FC<LedgerStudioModalProps> = ({
  isOpen,
  onClose,
  ledgerName,
  ledgerSubtitle = 'Detailed Ledger Account',
  columnConfig,
  onUpdateColumnConfig,
  companyName,
  activeBalance = 0,
  sampleRows = [],
  onExportCSV,
  onExportPDF,
  onExportJPG
}) => {
  const [cols, setCols] = useState<LedgerColumnConfig>({ ...columnConfig });
  const [activeTab, setActiveTab] = useState<'columns' | 'theme' | 'layout'>('columns');
  const [docConfig, setDocConfig] = useState<ExportDocumentConfig>(() => getSavedExportConfig());
  const [customTitle, setCustomTitle] = useState(`${ledgerName} — Ledger`);
  const [customSubtitle, setCustomSubtitle] = useState(ledgerSubtitle);
  const [customNote, setCustomNote] = useState('');
  const [savedBadge, setSavedBadge] = useState(false);

  if (!isOpen) return null;

  const toggleColumn = (key: keyof LedgerColumnConfig) => {
    setCols(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSelectPresetColumns = (preset: 'all' | 'standard' | 'minimal' | 'payment_audit') => {
    if (preset === 'all') {
      setCols({
        showDate: true,
        showTime: true,
        showDesc: true,
        showDebit: true,
        showCredit: true,
        showBalance: true,
        showMethod: true,
        showPaidBy: true,
        showPaidTo: true,
        showAccount: true,
        showRef: true,
        showTax: true
      });
    } else if (preset === 'standard') {
      setCols({ ...DEFAULT_LEDGER_COLUMNS });
    } else if (preset === 'minimal') {
      setCols({
        showDate: true,
        showTime: false,
        showDesc: true,
        showDebit: true,
        showCredit: true,
        showBalance: true,
        showMethod: false,
        showPaidBy: false,
        showPaidTo: false,
        showAccount: false,
        showRef: false,
        showTax: false
      });
    } else if (preset === 'payment_audit') {
      setCols({
        showDate: true,
        showTime: false,
        showDesc: true,
        showDebit: true,
        showCredit: true,
        showBalance: true,
        showMethod: true,
        showPaidBy: true,
        showPaidTo: true,
        showAccount: true,
        showRef: true,
        showTax: false
      });
    }
  };

  const handleApplyPresetTheme = (presetId: string) => {
    const found = EXPORT_THEME_PRESETS.find(p => p.id === presetId);
    if (!found) return;
    setDocConfig(prev => ({
      ...prev,
      presetId: found.id,
      headerBgColor: found.headerBgColor,
      headerTextColor: found.headerTextColor,
      headerSubtitleColor: found.headerSubtitleColor,
      tableHeaderBgColor: found.tableHeaderBgColor,
      tableHeaderTextColor: found.tableHeaderTextColor,
      accentColor: found.accentColor
    }));
  };

  const handleSaveAndApply = () => {
    onUpdateColumnConfig(cols);
    saveExportConfig(docConfig);
    hapticTransactionComplete();
    setSavedBadge(true);
    setTimeout(() => {
      setSavedBadge(false);
      onClose();
    }, 400);
  };

  const handleTriggerExport = (type: 'pdf' | 'jpg' | 'csv') => {
    onUpdateColumnConfig(cols);
    const mergedConfig: Partial<ExportDocumentConfig> = {
      ...docConfig,
      companyName,
      subtitle: customSubtitle,
      customNote
    };
    if (type === 'pdf') {
      onExportPDF(cols, mergedConfig);
    } else if (type === 'jpg') {
      onExportJPG(cols, mergedConfig);
    } else {
      onExportCSV(cols);
    }
  };

  const countActiveCols = Object.values(cols).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-xs font-mono overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden my-auto animate-in fade-in duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--steel-line)] bg-[var(--panel-raised)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--yellow)]/15 border border-[var(--yellow)]/30 text-[var(--yellow)]">
              <Sliders size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-black text-lg text-[var(--text)] tracking-tight">
                  Ledger Studio · Column & Export Studio
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--yellow)]/15 text-[var(--yellow)] border border-[var(--yellow)]/30">
                  {countActiveCols} Columns Visible
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)]">
                Account: <strong className="text-[var(--text)]">{ledgerName}</strong> · Choose exact details to show on screen & exports
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-[var(--panel)] border-b border-[var(--steel-line)] shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('columns')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'columns'
                ? 'bg-[var(--yellow)] text-black shadow-sm'
                : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
            }`}
          >
            <Eye size={13} />
            <span>1. Columns & Details ({countActiveCols})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('theme')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'theme'
                ? 'bg-[var(--yellow)] text-black shadow-sm'
                : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
            }`}
          >
            <Palette size={13} />
            <span>2. Theme & Visual Style</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('layout')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'layout'
                ? 'bg-[var(--yellow)] text-black shadow-sm'
                : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
            }`}
          >
            <Layout size={13} />
            <span>3. Paper & Document Info</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: COLUMNS SELECTION */}
          {activeTab === 'columns' && (
            <div className="space-y-4">
              {/* Presets Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[var(--steel-line)]">
                <span className="text-[11px] uppercase font-bold text-[var(--text-dim)] tracking-wider">
                  Quick Column Presets:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSelectPresetColumns('all')}
                    className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[11px] text-[var(--text)] transition cursor-pointer"
                  >
                    Select All (Full Audit)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPresetColumns('standard')}
                    className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[11px] text-[var(--text)] transition cursor-pointer"
                  >
                    Standard Accounting
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPresetColumns('payment_audit')}
                    className="px-2.5 py-1 rounded bg-[var(--yellow)]/15 border border-[var(--yellow)]/30 text-[11px] font-bold text-[var(--yellow)] transition cursor-pointer"
                  >
                    Payment Details Focused
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPresetColumns('minimal')}
                    className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[11px] text-[var(--text-dim)] transition cursor-pointer"
                  >
                    Compact / Minimal
                  </button>
                </div>
              </div>

              {/* Grouped Columns Checklist */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Core Columns */}
                <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2.5">
                  <div className="text-[11px] font-bold text-[var(--yellow)] uppercase tracking-wider">
                    Core Identification
                  </div>
                  {LEDGER_COLUMN_OPTIONS.filter(c => c.category === 'core').map(col => {
                    const isChecked = !!cols[col.key];
                    return (
                      <label
                        key={col.key}
                        className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition border ${
                          isChecked
                            ? 'bg-[var(--panel)] border-[var(--yellow)]/30 text-[var(--text)]'
                            : 'bg-transparent border-transparent text-[var(--text-dim)] hover:bg-[var(--panel)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleColumn(col.key)}
                          className="mt-0.5 accent-[var(--yellow)] cursor-pointer"
                        />
                        <div className="text-xs">
                          <div className="font-bold">{col.label}</div>
                          <div className="text-[10px] opacity-75">{col.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Financial Amounts */}
                <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2.5">
                  <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    Financial Columns
                  </div>
                  {LEDGER_COLUMN_OPTIONS.filter(c => c.category === 'financial').map(col => {
                    const isChecked = !!cols[col.key];
                    return (
                      <label
                        key={col.key}
                        className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition border ${
                          isChecked
                            ? 'bg-[var(--panel)] border-emerald-500/30 text-[var(--text)]'
                            : 'bg-transparent border-transparent text-[var(--text-dim)] hover:bg-[var(--panel)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleColumn(col.key)}
                          className="mt-0.5 accent-emerald-400 cursor-pointer"
                        />
                        <div className="text-xs">
                          <div className="font-bold">{col.label}</div>
                          <div className="text-[10px] opacity-75">{col.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Detailed Payment Breakdown */}
                <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2.5">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                    Payment Breakdown Details
                  </div>
                  {LEDGER_COLUMN_OPTIONS.filter(c => c.category === 'payment').map(col => {
                    const isChecked = !!cols[col.key];
                    return (
                      <label
                        key={col.key}
                        className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition border ${
                          isChecked
                            ? 'bg-[var(--panel)] border-amber-500/30 text-[var(--text)]'
                            : 'bg-transparent border-transparent text-[var(--text-dim)] hover:bg-[var(--panel)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleColumn(col.key)}
                          className="mt-0.5 accent-amber-400 cursor-pointer"
                        />
                        <div className="text-xs">
                          <div className="font-bold">{col.label}</div>
                          <div className="text-[10px] opacity-75">{col.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THEME & VISUAL STYLE */}
          {activeTab === 'theme' && (
            <div className="space-y-4">
              <div className="text-xs text-[var(--text-dim)]">
                Select visual color theme presets for PDF and JPG document exports.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {EXPORT_THEME_PRESETS.map(preset => {
                  const isSelected = docConfig.presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPresetTheme(preset.id)}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-[var(--yellow)] bg-[var(--panel-raised)] shadow-md ring-1 ring-[var(--yellow)]'
                          : 'border-[var(--steel-line)] bg-[var(--panel)] hover:border-[var(--text-dim)]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-xs text-[var(--text)] font-sans">{preset.name}</span>
                          {isSelected && <Check size={14} className="text-[var(--yellow)]" />}
                        </div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-5 h-5 rounded border border-white/20" style={{ background: preset.headerBgColor }} />
                          <div className="w-5 h-5 rounded border border-white/20" style={{ background: preset.headerTextColor }} />
                          <div className="w-5 h-5 rounded border border-white/20" style={{ background: preset.tableHeaderBgColor }} />
                          <div className="w-5 h-5 rounded border border-white/20" style={{ background: preset.accentColor }} />
                        </div>
                        <p className="text-[10px] text-[var(--text-dim)] leading-tight">{preset.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Document Display Toggles */}
              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
                <div className="text-[11px] font-bold text-[var(--text)] uppercase tracking-wider">
                  Visual Features & Accents
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={docConfig.showLogo}
                      onChange={e => setDocConfig(prev => ({ ...prev, showLogo: e.target.checked }))}
                      className="accent-[var(--yellow)]"
                    />
                    <span>Company Logo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={docConfig.showDate}
                      onChange={e => setDocConfig(prev => ({ ...prev, showDate: e.target.checked }))}
                      className="accent-[var(--yellow)]"
                    />
                    <span>Print Timestamp</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={docConfig.showStripedRows}
                      onChange={e => setDocConfig(prev => ({ ...prev, showStripedRows: e.target.checked }))}
                      className="accent-[var(--yellow)]"
                    />
                    <span>Striped Rows</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={docConfig.showSignatureLine}
                      onChange={e => setDocConfig(prev => ({ ...prev, showSignatureLine: e.target.checked }))}
                      className="accent-[var(--yellow)]"
                    />
                    <span>Signature Line</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LAYOUT & DOCUMENT INFO */}
          {activeTab === 'layout' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Paper Size */}
                <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
                  <div className="text-[11px] font-bold text-[var(--yellow)] uppercase tracking-wider">
                    Paper Size
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'a4', label: 'A4 Standard' },
                      { id: 'letter', label: 'US Letter' },
                      { id: '80mm', label: '80mm Thermal Slip' },
                      { id: '58mm', label: '58mm Mini POS' }
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setDocConfig(prev => ({ ...prev, paperSize: p.id as any }))}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition ${
                          docConfig.paperSize === p.id
                            ? 'bg-[var(--yellow)] text-black font-bold border-[var(--yellow)]'
                            : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text)]'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orientation */}
                <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
                  <div className="text-[11px] font-bold text-[var(--yellow)] uppercase tracking-wider">
                    Page Orientation
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'landscape', label: 'Landscape (Wide · Recommended)' },
                      { id: 'portrait', label: 'Portrait (Tall)' }
                    ].map(o => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setDocConfig(prev => ({ ...prev, orientation: o.id as any }))}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition ${
                          docConfig.orientation === o.id
                            ? 'bg-[var(--yellow)] text-black font-bold border-[var(--yellow)]'
                            : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text)]'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Document Text Fields */}
              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
                <div className="text-[11px] font-bold text-[var(--text)] uppercase tracking-wider">
                  Document Headers & Custom Footer
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">
                      Report Title
                    </label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={e => setCustomTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">
                      Subtitle
                    </label>
                    <input
                      type="text"
                      value={customSubtitle}
                      onChange={e => setCustomSubtitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Custom Footer Narrative / Bank Account Instructions
                  </label>
                  <input
                    type="text"
                    value={customNote}
                    onChange={e => setCustomNote(e.target.value)}
                    placeholder="e.g. Please transfer outstanding balances to Meezan Bank A/C 0201-01048291..."
                    className="w-full px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Footer with Direct Export & Save */}
        <div className="p-4 border-t border-[var(--steel-line)] bg-[var(--panel-raised)] shrink-0 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-dim)]">Export with selected columns:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleTriggerExport('csv')}
                className="px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-bold text-[var(--text)] flex items-center gap-1.5 transition cursor-pointer"
                title="Export filtered CSV spreadsheet"
              >
                <FileSpreadsheet size={13} className="text-emerald-400" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleTriggerExport('pdf')}
                className="px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-red-500 hover:text-red-400 text-xs font-bold text-[var(--text)] flex items-center gap-1.5 transition cursor-pointer"
                title="Generate customized PDF document"
              >
                <FileText size={13} className="text-red-400" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handleTriggerExport('jpg')}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500 hover:text-black text-xs font-bold text-amber-400 flex items-center gap-1.5 transition cursor-pointer"
                title="Generate high-resolution JPG image"
              >
                <ImageIcon size={13} />
                <span>JPG</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] text-xs font-bold text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              className="px-5 py-2 rounded-xl bg-[var(--yellow)] text-black font-black uppercase text-xs tracking-wider hover:brightness-110 transition flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Check size={14} strokeWidth={3} />
              <span>{savedBadge ? 'Saved!' : 'Apply to Table View'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
