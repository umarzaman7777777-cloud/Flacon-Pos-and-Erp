import React, { useState, useEffect } from 'react';
import {
  FileDown,
  Image as ImageIcon,
  Check,
  RotateCcw,
  Palette,
  FileSpreadsheet,
  Layers,
  Type,
  Maximize2
} from 'lucide-react';
import {
  ExportTablePayload,
  ExportDocumentConfig,
  ExportFontFamily,
  ExportPaperSize,
  ExportOrientation
} from '../types';
import {
  EXPORT_THEME_PRESETS,
  DEFAULT_EXPORT_CONFIG,
  getSavedExportConfig,
  saveExportConfig
} from '../utils/exportSettingsHelper';
import { exportTablePDF } from '../utils/helpers';
import { exportTableJPG } from '../utils/exportManager';
import { FALCON_LOGO_WHITE_BG_PNG } from '../utils/logoData';

interface ExportCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: ExportTablePayload | null;
}

export const ExportCustomizerModal: React.FC<ExportCustomizerModalProps> = ({
  isOpen,
  onClose,
  payload
}) => {
  const [config, setConfig] = useState<ExportDocumentConfig>(() => getSavedExportConfig());
  const [docTitle, setDocTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [savedNotification, setSavedNotification] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'theme' | 'page' | 'typography' | 'content'>('theme');

  useEffect(() => {
    if (payload && isOpen) {
      const saved = getSavedExportConfig();
      setConfig(prev => ({
        ...prev,
        ...saved,
        orientation: payload.initialOrientation || saved.orientation || 'landscape',
        paperSize: payload.initialPaperSize || saved.paperSize || 'a4'
      }));
      setDocTitle(payload.title || 'Report');
      setCompanyName(payload.companyName || saved.companyName || 'Falcon Rod Maker');
      setSubtitle(payload.subtitle || saved.subtitle || 'Fan Accessories · Gujrat');
      setCustomNote(payload.balanceFooterText || '');
    }
  }, [payload, isOpen]);

  if (!isOpen || !payload) return null;

  const handleApplyPreset = (presetId: string) => {
    const found = EXPORT_THEME_PRESETS.find(p => p.id === presetId);
    if (!found) return;
    setConfig(prev => ({
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

  const handleSaveAsDefault = () => {
    const updated = saveExportConfig({
      ...config,
      companyName,
      subtitle
    });
    setConfig(updated);
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2500);
  };

  const handleResetDefaults = () => {
    setConfig({ ...DEFAULT_EXPORT_CONFIG });
    setCompanyName(DEFAULT_EXPORT_CONFIG.companyName || 'Falcon Rod Maker');
    setSubtitle(DEFAULT_EXPORT_CONFIG.subtitle || 'Fan Accessories · Gujrat');
  };

  const handleExportPDF = async () => {
    if (!payload) return;
    setIsExporting(true);
    try {
      const mergedConfig: Partial<ExportDocumentConfig> = {
        ...config,
        companyName,
        subtitle,
        customNote
      };
      exportTablePDF(
        docTitle || payload.title,
        payload.headers,
        payload.rows,
        payload.filename,
        config.orientation,
        companyName,
        subtitle,
        customNote,
        mergedConfig
      );
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJPG = async () => {
    if (!payload) return;
    setIsExporting(true);
    try {
      const mergedConfig: Partial<ExportDocumentConfig> = {
        ...config,
        companyName,
        subtitle,
        customNote
      };
      await exportTableJPG(
        docTitle || payload.title,
        payload.headers,
        payload.rows,
        payload.filename,
        companyName,
        subtitle,
        customNote,
        mergedConfig
      );
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportBoth = async () => {
    if (!payload) return;
    setIsExporting(true);
    try {
      const mergedConfig: Partial<ExportDocumentConfig> = {
        ...config,
        companyName,
        subtitle,
        customNote
      };
      exportTablePDF(
        docTitle || payload.title,
        payload.headers,
        payload.rows,
        payload.filename,
        config.orientation,
        companyName,
        subtitle,
        customNote,
        mergedConfig
      );
      await exportTableJPG(
        docTitle || payload.title,
        payload.headers,
        payload.rows,
        payload.filename,
        companyName,
        subtitle,
        customNote,
        mergedConfig
      );
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  // Preview Font CSS Family
  const previewFont =
    config.fontFamily === 'times'
      ? 'Georgia, "Times New Roman", serif'
      : config.fontFamily === 'courier'
      ? '"IBM Plex Mono", Courier, monospace'
      : '"IBM Plex Sans", -apple-system, sans-serif';

  const isPortrait = config.orientation === 'portrait';
  const isThermal = config.paperSize === '80mm' || config.paperSize === '58mm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--steel-line)] bg-[var(--panel-raised)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-[var(--yellow)] shadow-sm">
              <FileDown size={19} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-base text-[var(--text)]">
                  Document Export Studio · PDF & JPG
                </h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  {config.paperSize.toUpperCase()} · {config.orientation}
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)]">
                Customize header colors, typography, styles, paper sizes & layout for all exports
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              title="Reset to default theme & settings"
              className="px-2.5 py-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text)] border border-transparent hover:border-[var(--steel-line)] rounded-lg transition flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto">
          {/* Left Column: Live Visual Document Preview (5 cols) */}
          <div className="lg:col-span-5 p-4 bg-black/40 border-b lg:border-b-0 lg:border-r border-[var(--steel-line)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] flex items-center gap-1.5">
                  <Maximize2 size={13} className="text-amber-400" />
                  Live Document Preview
                </span>
                <span className="text-[11px] font-mono text-[var(--text-dim)]">
                  {payload.rows.length} record(s)
                </span>
              </div>

              {/* Scaled Mini Document Sheet Container */}
              <div className="flex justify-center p-2">
                <div
                  className="bg-white rounded-lg shadow-xl overflow-hidden transition-all duration-300 border border-slate-300"
                  style={{
                    width: isThermal ? (config.paperSize === '58mm' ? '210px' : '250px') : isPortrait ? '270px' : '360px',
                    minHeight: isThermal ? '320px' : isPortrait ? '380px' : '270px',
                    fontFamily: previewFont
                  }}
                >
                  {/* Accent Top Bar */}
                  {config.showAccentBar && (
                    <div
                      className="w-full h-1.5"
                      style={{ backgroundColor: config.accentColor }}
                    />
                  )}

                  {/* Header Container */}
                  <div
                    className="p-2.5 transition-colors duration-200"
                    style={{ backgroundColor: config.headerBgColor }}
                  >
                    <div className="flex items-center gap-2">
                      {config.showLogo && (
                        <img
                          src={FALCON_LOGO_WHITE_BG_PNG}
                          alt="Falcon Logo"
                          className="w-7 h-6 object-contain rounded bg-white/10 p-0.5"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-bold text-xs truncate leading-tight"
                          style={{ color: config.headerTextColor }}
                        >
                          {companyName.toUpperCase()}
                        </div>
                        <div
                          className="text-[9px] truncate opacity-90 leading-tight"
                          style={{ color: config.headerSubtitleColor }}
                        >
                          {subtitle}
                        </div>
                        {config.showDate && (
                          <div
                            className="text-[8px] opacity-75 truncate"
                            style={{ color: config.headerSubtitleColor }}
                          >
                            {new Date().toLocaleDateString('en-GB')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Title Banner */}
                    <div
                      className="mt-1.5 px-2 py-0.5 rounded text-[9px] font-bold text-center uppercase tracking-wider truncate"
                      style={{
                        backgroundColor: config.tableHeaderBgColor,
                        color: config.accentColor,
                        border: `1px solid ${config.accentColor}`
                      }}
                    >
                      {docTitle.toUpperCase().slice(0, 32)}
                    </div>
                  </div>

                  {/* Table Sample */}
                  <div className="p-2 text-[9px] text-slate-800">
                    <div
                      className="flex font-bold px-1.5 py-1 rounded"
                      style={{
                        backgroundColor: config.tableHeaderBgColor,
                        color: config.tableHeaderTextColor
                      }}
                    >
                      {payload.headers.slice(0, 4).map((h, i) => (
                        <div key={i} className="flex-1 truncate">
                          {String(h).slice(0, 10)}
                        </div>
                      ))}
                    </div>

                    {/* Sample Rows */}
                    {payload.rows.slice(0, 4).map((row, rIdx) => (
                      <div
                        key={rIdx}
                        className={`flex px-1.5 py-1 border-b border-slate-100 ${
                          config.showStripedRows && rIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                        } ${config.showBorders ? 'border-x border-slate-200' : ''}`}
                      >
                        {row.slice(0, 4).map((cell, cIdx) => (
                          <div key={cIdx} className="flex-1 truncate text-slate-700">
                            {String(cell ?? '')}
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* Balance / Custom Note Box */}
                    {customNote && (
                      <div className="mt-2 p-1.5 rounded bg-slate-100 border border-slate-300 font-semibold text-[9px] text-slate-800 truncate">
                        {customNote}
                      </div>
                    )}

                    {/* Signature Line Preview */}
                    {config.showSignatureLine && (
                      <div className="mt-4 pt-1 flex justify-end">
                        <div className="text-right">
                          <div className="w-24 border-b border-slate-400 mb-0.5"></div>
                          <div className="text-[7px] text-slate-500">Authorized Signature & Stamp</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Save as default feedback */}
            <div className="mt-3 flex items-center justify-between text-xs font-mono">
              <button
                type="button"
                onClick={handleSaveAsDefault}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-500 text-[var(--yellow)] transition text-xs font-semibold"
              >
                {savedNotification ? <Check size={14} className="text-emerald-400" /> : <Check size={14} />}
                <span>{savedNotification ? 'Saved as Default!' : 'Save Style as Default'}</span>
              </button>
              <span className="text-[11px] text-[var(--text-dim)]">Persists across all sessions</span>
            </div>
          </div>

          {/* Right Column: Customization Controls (7 cols) */}
          <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col space-y-4">
            {/* Navigation Tabs */}
            <div className="flex border-b border-[var(--steel-line)] gap-2 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('theme')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'theme'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel-raised)]'
                }`}
              >
                <Palette size={14} />
                <span>Colors & Themes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('page')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'page'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel-raised)]'
                }`}
              >
                <Layers size={14} />
                <span>Page & Layout</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('typography')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'typography'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel-raised)]'
                }`}
              >
                <Type size={14} />
                <span>Typography</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('content')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'content'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel-raised)]'
                }`}
              >
                <FileSpreadsheet size={14} />
                <span>Text & Branding</span>
              </button>
            </div>

            {/* TAB 1: Theme & Color Palette */}
            {activeTab === 'theme' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-2">
                    Curated Industrial & Executive Color Presets
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {EXPORT_THEME_PRESETS.map(preset => {
                      const isSelected = config.presetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyPreset(preset.id)}
                          className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40'
                              : 'border-[var(--steel-line)] bg-[var(--panel-raised)] hover:border-slate-500'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-xs text-[var(--text)] truncate">
                              {preset.name}
                            </span>
                            {isSelected && <Check size={12} className="text-amber-400 flex-shrink-0" />}
                          </div>
                          {/* Color Swatch Bar */}
                          <div className="flex h-3 w-full rounded overflow-hidden border border-black/20">
                            <div className="w-1/3" style={{ backgroundColor: preset.headerBgColor }} />
                            <div className="w-1/3" style={{ backgroundColor: preset.headerTextColor }} />
                            <div className="w-1/3" style={{ backgroundColor: preset.tableHeaderBgColor }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Color Pickers */}
                <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] block">
                    Custom Color Adjustments
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
                    <div>
                      <label className="block text-[11px] text-[var(--text-dim)] mb-1">Header BG</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.headerBgColor}
                          onChange={e => setConfig(prev => ({ ...prev, headerBgColor: e.target.value, presetId: 'custom' }))}
                          className="w-8 h-8 rounded border border-[var(--steel-line)] bg-transparent cursor-pointer"
                        />
                        <span className="text-[11px] text-[var(--text)] uppercase">{config.headerBgColor}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[var(--text-dim)] mb-1">Header Title</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.headerTextColor}
                          onChange={e => setConfig(prev => ({ ...prev, headerTextColor: e.target.value, presetId: 'custom' }))}
                          className="w-8 h-8 rounded border border-[var(--steel-line)] bg-transparent cursor-pointer"
                        />
                        <span className="text-[11px] text-[var(--text)] uppercase">{config.headerTextColor}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[var(--text-dim)] mb-1">Subtitle Text</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.headerSubtitleColor}
                          onChange={e => setConfig(prev => ({ ...prev, headerSubtitleColor: e.target.value, presetId: 'custom' }))}
                          className="w-8 h-8 rounded border border-[var(--steel-line)] bg-transparent cursor-pointer"
                        />
                        <span className="text-[11px] text-[var(--text)] uppercase">{config.headerSubtitleColor}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[var(--text-dim)] mb-1">Table Header BG</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.tableHeaderBgColor}
                          onChange={e => setConfig(prev => ({ ...prev, tableHeaderBgColor: e.target.value, presetId: 'custom' }))}
                          className="w-8 h-8 rounded border border-[var(--steel-line)] bg-transparent cursor-pointer"
                        />
                        <span className="text-[11px] text-[var(--text)] uppercase">{config.tableHeaderBgColor}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[var(--text-dim)] mb-1">Table Header Text</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.tableHeaderTextColor}
                          onChange={e => setConfig(prev => ({ ...prev, tableHeaderTextColor: e.target.value, presetId: 'custom' }))}
                          className="w-8 h-8 rounded border border-[var(--steel-line)] bg-transparent cursor-pointer"
                        />
                        <span className="text-[11px] text-[var(--text)] uppercase">{config.tableHeaderTextColor}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[var(--text-dim)] mb-1">Accent Stripe</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.accentColor}
                          onChange={e => setConfig(prev => ({ ...prev, accentColor: e.target.value, presetId: 'custom' }))}
                          className="w-8 h-8 rounded border border-[var(--steel-line)] bg-transparent cursor-pointer"
                        />
                        <span className="text-[11px] text-[var(--text)] uppercase">{config.accentColor}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Page Geometry & Layout */}
            {activeTab === 'page' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Orientation */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-2">
                    Document Orientation
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, orientation: 'portrait' as ExportOrientation }))}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between transition ${
                        config.orientation === 'portrait'
                          ? 'border-amber-500 bg-amber-500/10 text-[var(--text)]'
                          : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs">Portrait (عمودی)</div>
                        <div className="text-[11px] text-[var(--text-dim)]">Vertical format for audits & invoices</div>
                      </div>
                      <div className="w-6 h-8 border-2 border-current rounded flex items-center justify-center text-[10px]">
                        P
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, orientation: 'landscape' as ExportOrientation }))}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between transition ${
                        config.orientation === 'landscape'
                          ? 'border-amber-500 bg-amber-500/10 text-[var(--text)]'
                          : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs">Landscape (افقی)</div>
                        <div className="text-[11px] text-[var(--text-dim)]">Wide layout best for data-rich ledgers</div>
                      </div>
                      <div className="w-8 h-6 border-2 border-current rounded flex items-center justify-center text-[10px]">
                        L
                      </div>
                    </button>
                  </div>
                </div>

                {/* Paper Size */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-2">
                    Paper Size & Document Format
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        { id: 'a4', name: 'A4', desc: '210 × 297 mm' },
                        { id: 'letter', name: 'Letter', desc: '8.5 × 11 in' },
                        { id: 'legal', name: 'Legal', desc: '8.5 × 14 in' },
                        { id: 'a5', name: 'A5', desc: '148 × 210 mm' },
                        { id: 'b5', name: 'B5', desc: '176 × 250 mm' },
                        { id: '80mm', name: '80mm Thermal', desc: 'POS Roll' },
                        { id: '58mm', name: '58mm Slip', desc: 'Pocket Thermal' }
                      ] as { id: ExportPaperSize; name: string; desc: string }[]
                    ).map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, paperSize: p.id }))}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          config.paperSize === p.id
                            ? 'border-amber-500 bg-amber-500/15 text-[var(--text)] font-bold'
                            : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                        }`}
                      >
                        <div className="text-xs">{p.name}</div>
                        <div className="text-[10px] text-[var(--text-dim)]">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visual Elements Toggles */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-2">
                    Layout & Visual Elements
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showLogo}
                        onChange={e => setConfig(prev => ({ ...prev, showLogo: e.target.checked }))}
                        className="rounded accent-amber-500"
                      />
                      <span className="text-[var(--text)]">Falcon Rod Maker Logo</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showDate}
                        onChange={e => setConfig(prev => ({ ...prev, showDate: e.target.checked }))}
                        className="rounded accent-amber-500"
                      />
                      <span className="text-[var(--text)]">Date & Timestamp</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showStripedRows}
                        onChange={e => setConfig(prev => ({ ...prev, showStripedRows: e.target.checked }))}
                        className="rounded accent-amber-500"
                      />
                      <span className="text-[var(--text)]">Alternating Zebra Rows</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showBorders}
                        onChange={e => setConfig(prev => ({ ...prev, showBorders: e.target.checked }))}
                        className="rounded accent-amber-500"
                      />
                      <span className="text-[var(--text)]">Cell Grid Borders</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showSignatureLine}
                        onChange={e => setConfig(prev => ({ ...prev, showSignatureLine: e.target.checked }))}
                        className="rounded accent-amber-500"
                      />
                      <span className="text-[var(--text)]">Authorized Signature Line</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showAccentBar}
                        onChange={e => setConfig(prev => ({ ...prev, showAccentBar: e.target.checked }))}
                        className="rounded accent-amber-500"
                      />
                      <span className="text-[var(--text)]">Industrial Top Accent Bar</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Typography & Fonts */}
            {activeTab === 'typography' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-2">
                    Font Family & Typographic Personality
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, fontFamily: 'helvetica' as ExportFontFamily }))}
                      className={`p-3 rounded-xl border text-left transition ${
                        config.fontFamily === 'helvetica'
                          ? 'border-amber-500 bg-amber-500/10 text-[var(--text)]'
                          : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                      }`}
                    >
                      <div className="font-sans font-bold text-sm">Modern Sans-Serif</div>
                      <div className="text-[11px] text-[var(--text-dim)] mt-0.5">Helvetica / Clean High Legibility</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, fontFamily: 'times' as ExportFontFamily }))}
                      className={`p-3 rounded-xl border text-left transition ${
                        config.fontFamily === 'times'
                          ? 'border-amber-500 bg-amber-500/10 text-[var(--text)]'
                          : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                      }`}
                    >
                      <div className="font-serif font-bold text-sm">Classic Serif</div>
                      <div className="text-[11px] text-[var(--text-dim)] mt-0.5">Times / Formal Audit Elegance</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, fontFamily: 'courier' as ExportFontFamily }))}
                      className={`p-3 rounded-xl border text-left transition ${
                        config.fontFamily === 'courier'
                          ? 'border-amber-500 bg-amber-500/10 text-[var(--text)]'
                          : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                      }`}
                    >
                      <div className="font-mono font-bold text-sm">Technical Monospace</div>
                      <div className="text-[11px] text-[var(--text-dim)] mt-0.5">Courier / Engineering Workshop CAD</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-2">
                    Information Density & Row Scale
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(
                      [
                        { id: 'compact', name: 'Dense / Compact', desc: 'Fits max rows per page' },
                        { id: 'normal', name: 'Balanced / Standard', desc: 'Standard business spacing' },
                        { id: 'large', name: 'Comfortable', desc: 'Generous line heights' }
                      ] as const
                    ).map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, fontSize: item.id }))}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          config.fontSize === item.id
                            ? 'border-amber-500 bg-amber-500/15 text-[var(--text)] font-semibold'
                            : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                        }`}
                      >
                        <div className="text-xs">{item.name}</div>
                        <div className="text-[10px] text-[var(--text-dim)]">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Content, Headers & Branding */}
            {activeTab === 'content' && (
              <div className="space-y-3 font-mono text-xs animate-in fade-in duration-150">
                <div>
                  <label className="block text-[var(--text-dim)] uppercase mb-1">Document Report Title</label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={e => setDocTitle(e.target.value)}
                    placeholder="e.g. Al-Madina Fan Workshop Customer Ledger"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[var(--text-dim)] uppercase mb-1">Company / Workshop Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder="Falcon Rod Maker"
                      className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--text-dim)] uppercase mb-1">Subtitle / Location Tagline</label>
                    <input
                      type="text"
                      value={subtitle}
                      onChange={e => setSubtitle(e.target.value)}
                      placeholder="Fan Accessories · Gujrat"
                      className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[var(--text-dim)] uppercase mb-1">Balance / Custom Footer Note</label>
                  <input
                    type="text"
                    value={customNote}
                    onChange={e => setCustomNote(e.target.value)}
                    placeholder="e.g. Net Receivable: Rs 145,000 (Payment due within 15 days)"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-[var(--steel-line)] bg-[var(--panel-raised)]">
          <div className="text-xs text-[var(--text-dim)] font-mono">
            Output: <span className="text-[var(--text)] font-bold">{payload.filename}.[pdf/jpg]</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-3 py-2 rounded-xl border border-[var(--steel-line)] hover:border-slate-400 text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600/15 border border-red-500/40 hover:bg-red-600 hover:text-white text-xs font-semibold text-red-400 transition shadow-sm"
              title="Download vector PDF"
            >
              <FileDown size={14} />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportJPG}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500 hover:text-black text-xs font-semibold text-amber-400 transition shadow-sm"
              title="Download high-resolution JPG image"
            >
              <ImageIcon size={14} />
              <span>Export JPG</span>
            </button>

            <button
              type="button"
              onClick={handleExportBoth}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--yellow)] hover:bg-amber-400 text-black text-xs font-bold transition shadow-md"
              title="Download both PDF and JPG formats at once"
            >
              <FileDown size={14} />
              <span>Export Both</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
