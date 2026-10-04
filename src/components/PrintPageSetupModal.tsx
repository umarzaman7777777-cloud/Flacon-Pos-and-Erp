import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Check,
  RotateCcw,
  Sliders,
  Layers,
  FileText,
  FileCheck,
  Minimize2,
  Maximize2,
  Percent,
  CheckSquare,
  Square,
  Sparkles,
  Info
} from 'lucide-react';
import {
  PrintPageSetup,
  PrinterPaperSize,
  PrintOrientation,
  PrintMargins,
  PrintColorMode,
  AppLanguage
} from '../types';
import {
  PAPER_SIZE_SPECS,
  MARGIN_SPECS,
  DEFAULT_PAGE_SETUP,
  getEffectivePageSetup,
  saveEffectivePageSetup,
  calculatePrintPageStyles
} from '../utils/printSetupHelper';
import { runTestPrint } from '../utils/printerManager';

interface PrintPageSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: AppLanguage;
  onSaved?: (setup: PrintPageSetup) => void;
}

export const PrintPageSetupModal: React.FC<PrintPageSetupModalProps> = ({
  isOpen,
  onClose,
  language = 'en',
  onSaved
}) => {
  const [setup, setSetup] = useState<PrintPageSetup>(getEffectivePageSetup);
  const [activeCategory, setActiveCategory] = useState<'all' | 'sheet' | 'roll' | 'label'>('all');
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [testPrintSuccess, setTestPrintSuccess] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSetup(getEffectivePageSetup());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentStyles = calculatePrintPageStyles(setup);
  const currentSpec = PAPER_SIZE_SPECS[setup.paperSize] || PAPER_SIZE_SPECS.a4;
  const isRoll = currentSpec.category === 'roll';

  const handleUpdate = (patch: Partial<PrintPageSetup>) => {
    setSetup(prev => ({ ...prev, ...patch }));
  };

  const handleSave = () => {
    const saved = saveEffectivePageSetup(setup);
    setJustSaved(true);
    if (onSaved) onSaved(saved);
    setTimeout(() => {
      setJustSaved(false);
      onClose();
    }, 450);
  };

  const handleReset = () => {
    setSetup({ ...DEFAULT_PAGE_SETUP });
  };

  const handleTriggerTest = async () => {
    try {
      setIsTestPrinting(true);
      // Temporarily persist current setup so test print consumes it
      saveEffectivePageSetup(setup);
      const res = await runTestPrint();
      if (res.success) {
        setTestPrintSuccess(true);
        setTimeout(() => setTestPrintSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTestPrinting(false);
    }
  };

  const sheetSizes = Object.values(PAPER_SIZE_SPECS).filter(
    s => activeCategory === 'all' || s.category === activeCategory
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 font-mono">
      <div className="w-full max-w-4xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Bar */}
        <div className="px-5 py-4 bg-[var(--panel-raised)] border-b border-[var(--steel-line)] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--yellow)]/15 border border-[var(--yellow)]/30 flex items-center justify-center text-[var(--yellow)]">
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="font-serif font-bold text-base text-[var(--text)] flex items-center gap-2">
                <span>Print Page Setup & Formats</span>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider bg-[var(--yellow)]/20 text-[var(--yellow)] border border-[var(--yellow)]/30">
                  {currentSpec.name} · {currentStyles.effectiveOrientation.toUpperCase()}
                </span>
              </h2>
              <p className="text-[11px] text-[var(--text-dim)]">
                Standard sheet sizes, thermal roll widths, portrait/landscape orientation, margins & scaling
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              title="Reset to factory defaults (A4 Portrait)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-amber-400 text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reset</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerTest}
              disabled={isTestPrinting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs text-[var(--text)] hover:text-[var(--yellow)] font-bold transition cursor-pointer"
            >
              <Printer size={13} />
              <span>{testPrintSuccess ? 'Printed!' : isTestPrinting ? 'Printing...' : 'Test Print'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6 bg-[var(--bg)] flex-1">
          
          {/* Main Grid: Left Settings + Right Live Visualizer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left 8 Columns: Controls */}
            <div className="lg:col-span-8 space-y-6">

              {/* 1. Paper Size Selector */}
              <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[var(--steel-line)]/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--yellow)]/20 text-[var(--yellow)] text-xs flex items-center justify-center font-bold">1</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                      Paper Size & Roll Format
                    </span>
                  </div>

                  {/* Filter chips */}
                  <div className="flex items-center gap-1 text-[10px]">
                    {(['all', 'sheet', 'roll', 'label'] as const).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveCategory(cat)}
                        className={`px-2 py-0.5 rounded font-mono uppercase transition cursor-pointer ${
                          activeCategory === cat
                            ? 'bg-[var(--yellow)] text-black font-bold'
                            : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {sheetSizes.map(spec => {
                    const isSelected = setup.paperSize === spec.id;
                    return (
                      <button
                        key={spec.id}
                        type="button"
                        onClick={() => handleUpdate({ paperSize: spec.id })}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? 'bg-[var(--yellow)]/15 border-[var(--yellow)] shadow-sm ring-1 ring-[var(--yellow)]'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] hover:border-[var(--steel-line)]/80 text-[var(--text-dim)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase ${
                            isSelected ? 'bg-[var(--yellow)] text-black' : 'bg-black/30 text-[var(--text-dim)]'
                          }`}>
                            {spec.category.toUpperCase()}
                          </span>
                          {isSelected && <Check size={14} className="text-[var(--yellow)]" />}
                        </div>
                        <div>
                          <div className={`font-serif font-bold text-xs ${isSelected ? 'text-[var(--yellow)]' : 'text-[var(--text)]'}`}>
                            {spec.name}
                          </div>
                          <div className="text-[10px] text-[var(--text-dim)] font-mono mt-0.5">
                            {spec.dimensions}
                          </div>
                        </div>
                        <div className="text-[9.5px] text-[var(--text-dim)] italic border-t border-[var(--steel-line)]/40 pt-1 line-clamp-1">
                          {spec.description}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Dimensions Input (if custom selected) */}
                {setup.paperSize === 'custom' && (
                  <div className="p-3 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl space-y-2 mt-2">
                    <div className="text-xs font-bold text-[var(--text)]">Specify Custom Dimensions (Millimeters)</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-[var(--text-dim)] block mb-1">Width (mm)</label>
                        <input
                          type="number"
                          value={setup.customWidthMm || 210}
                          onChange={e => handleUpdate({ customWidthMm: Math.max(20, parseInt(e.target.value, 10) || 210) })}
                          className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--text-dim)] block mb-1">Height (mm)</label>
                        <input
                          type="number"
                          value={setup.customHeightMm || 297}
                          onChange={e => handleUpdate({ customHeightMm: Math.max(20, parseInt(e.target.value, 10) || 297) })}
                          className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Orientation & Margins */}
              <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-4 sm:p-5 space-y-4">
                
                {/* Orientation Selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[var(--yellow)]/20 text-[var(--yellow)] text-xs flex items-center justify-center font-bold">2</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                        Page Orientation
                      </span>
                    </div>
                    {isRoll && (
                      <span className="text-[10px] text-amber-400 font-mono">
                        (Thermal continuous roll is vertical by design)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Portrait */}
                    <button
                      type="button"
                      disabled={isRoll}
                      onClick={() => handleUpdate({ orientation: 'portrait' })}
                      className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3.5 cursor-pointer ${
                        setup.orientation === 'portrait' || isRoll
                          ? 'bg-[var(--yellow)]/15 border-[var(--yellow)] shadow-sm ring-1 ring-[var(--yellow)]'
                          : 'bg-[var(--panel-raised)] border-[var(--steel-line)] hover:border-[var(--steel-line)]/80 text-[var(--text-dim)]'
                      } ${isRoll ? 'opacity-80' : ''}`}
                    >
                      {/* Portrait Icon */}
                      <div className="w-8 h-10 rounded border-2 border-current flex flex-col justify-between p-1 bg-black/20 shrink-0">
                        <div className="w-full h-1 bg-current opacity-70 rounded-xs" />
                        <div className="w-3/4 h-1 bg-current opacity-40 rounded-xs" />
                        <div className="w-full h-1 bg-current opacity-50 rounded-xs" />
                      </div>
                      <div>
                        <div className={`font-serif font-bold text-xs ${setup.orientation === 'portrait' ? 'text-[var(--yellow)]' : 'text-[var(--text)]'}`}>
                          Portrait (عمودی)
                        </div>
                        <div className="text-[10px] text-[var(--text-dim)] font-mono mt-0.5">
                          Standard vertical document orientation (Tall)
                        </div>
                      </div>
                    </button>

                    {/* Landscape */}
                    <button
                      type="button"
                      disabled={isRoll}
                      onClick={() => handleUpdate({ orientation: 'landscape' })}
                      className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3.5 cursor-pointer ${
                        setup.orientation === 'landscape' && !isRoll
                          ? 'bg-[var(--yellow)]/15 border-[var(--yellow)] shadow-sm ring-1 ring-[var(--yellow)]'
                          : 'bg-[var(--panel-raised)] border-[var(--steel-line)] hover:border-[var(--steel-line)]/80 text-[var(--text-dim)]'
                      } ${isRoll ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {/* Landscape Icon */}
                      <div className="w-10 h-7 rounded border-2 border-current flex flex-col justify-between p-1 bg-black/20 shrink-0">
                        <div className="w-full h-0.5 bg-current opacity-70 rounded-xs" />
                        <div className="w-2/3 h-0.5 bg-current opacity-40 rounded-xs" />
                        <div className="w-full h-0.5 bg-current opacity-50 rounded-xs" />
                      </div>
                      <div>
                        <div className={`font-serif font-bold text-xs ${setup.orientation === 'landscape' && !isRoll ? 'text-[var(--yellow)]' : 'text-[var(--text)]'}`}>
                          Landscape (افقی)
                        </div>
                        <div className="text-[10px] text-[var(--text-dim)] font-mono mt-0.5">
                          Wide horizontal sheet format for wide ledger tables
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Margins Selector */}
                <div className="pt-2 border-t border-[var(--steel-line)]/60">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--yellow)]/20 text-[var(--yellow)] text-xs flex items-center justify-center font-bold">3</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                      Print Margins & Padding
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.values(MARGIN_SPECS).filter(m => m.id !== 'custom').map(margin => {
                      const isSelected = setup.margins === margin.id;
                      return (
                        <button
                          key={margin.id}
                          type="button"
                          onClick={() => handleUpdate({ margins: margin.id })}
                          className={`p-2.5 rounded-lg border text-center transition cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--yellow)]/15 border-[var(--yellow)] text-[var(--yellow)] font-bold shadow-xs'
                              : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                          }`}
                        >
                          <div className="text-xs font-serif font-bold">{margin.name.split(' ')[0]}</div>
                          <div className="text-[10px] font-mono opacity-75">{margin.css}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scale & Fit */}
                <div className="pt-2 border-t border-[var(--steel-line)]/60">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[var(--yellow)]/20 text-[var(--yellow)] text-xs flex items-center justify-center font-bold">4</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                        Scale & Page Fit
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[var(--yellow)] font-mono">
                      {setup.scale || 100}%
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={60}
                      max={140}
                      step={5}
                      value={setup.scale || 100}
                      onChange={e => handleUpdate({ scale: parseInt(e.target.value, 10) })}
                      className="w-full accent-[var(--yellow)] h-1.5 bg-black/40 rounded-lg cursor-pointer"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      {[80, 90, 100, 110].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleUpdate({ scale: val })}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                            (setup.scale || 100) === val
                              ? 'bg-[var(--yellow)] text-black font-bold'
                              : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* 3. Color Mode & Content Elements */}
              <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--steel-line)]/60 pb-2.5">
                  <span className="w-5 h-5 rounded-full bg-[var(--yellow)]/20 text-[var(--yellow)] text-xs flex items-center justify-center font-bold">5</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                    Color Mode & Document Content
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Color Mode */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-[var(--text-dim)] block">Color Palette</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdate({ colorMode: 'color' })}
                        className={`p-2.5 rounded-lg border text-center transition cursor-pointer text-xs font-bold ${
                          setup.colorMode !== 'monochrome'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        🎨 Full Color
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdate({ colorMode: 'monochrome' })}
                        className={`p-2.5 rounded-lg border text-center transition cursor-pointer text-xs font-bold ${
                          setup.colorMode === 'monochrome'
                            ? 'bg-slate-300/20 border-slate-300 text-slate-100'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        ⬛ Monochrome (Eco)
                      </button>
                    </div>
                  </div>

                  {/* Print Copies */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-[var(--text-dim)] block">Number of Copies</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleUpdate({ printCopies: n })}
                          className={`p-2.5 rounded-lg border text-center transition cursor-pointer text-xs font-mono font-bold ${
                            (setup.printCopies || 1) === n
                              ? 'bg-[var(--yellow)] text-black border-[var(--yellow)]'
                              : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)]'
                          }`}
                        >
                          {n} {n === 1 ? 'Copy' : 'Copies'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] cursor-pointer">
                    <span className="text-xs text-[var(--text)]">Print Falcon Logo</span>
                    <input
                      type="checkbox"
                      checked={setup.includeLogo ?? true}
                      onChange={e => handleUpdate({ includeLogo: e.target.checked })}
                      className="accent-[var(--yellow)] rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] cursor-pointer">
                    <span className="text-xs text-[var(--text)]">Urdu Words (روپے)</span>
                    <input
                      type="checkbox"
                      checked={setup.includeUrduAmount ?? true}
                      onChange={e => handleUpdate({ includeUrduAmount: e.target.checked })}
                      className="accent-[var(--yellow)] rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] cursor-pointer">
                    <span className="text-xs text-[var(--text)]">3 Signatures Block</span>
                    <input
                      type="checkbox"
                      checked={setup.includeSignatures ?? true}
                      onChange={e => handleUpdate({ includeSignatures: e.target.checked })}
                      className="accent-[var(--yellow)] rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] cursor-pointer">
                    <span className="text-xs text-[var(--text)]">Timestamp & Header Stamp</span>
                    <input
                      type="checkbox"
                      checked={setup.includeTimestamp ?? true}
                      onChange={e => handleUpdate({ includeTimestamp: e.target.checked })}
                      className="accent-[var(--yellow)] rounded"
                    />
                  </label>
                </div>

                {/* Custom Footer Note */}
                <div className="pt-2">
                  <label className="text-[11px] text-[var(--text-dim)] block mb-1">
                    Custom Footer Disclaimer / Note
                  </label>
                  <input
                    type="text"
                    value={setup.footerNote || ''}
                    onChange={e => handleUpdate({ footerNote: e.target.value })}
                    placeholder="e.g. FALCON ROD MAKER · POS & ERP SYSTEM · GUJRAT"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-1.5 text-xs text-[var(--text)] font-mono focus:border-[var(--yellow)] focus:outline-none"
                  />
                </div>
              </div>

            </div>

            {/* Right 4 Columns: Live Sheet Visualizer & Summary */}
            <div className="lg:col-span-4 space-y-4">
              
              <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-4 sm:p-5 space-y-4 sticky top-4">
                <div className="flex items-center justify-between border-b border-[var(--steel-line)]/60 pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)] flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[var(--yellow)]" />
                    Live Layout Preview
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--panel-raised)] text-[var(--yellow)] border border-[var(--steel-line)]">
                    {currentStyles.effectiveOrientation.toUpperCase()}
                  </span>
                </div>

                {/* Miniature Sheet Visualizer Box */}
                <div className="w-full flex items-center justify-center p-4 bg-black/40 rounded-xl border border-[var(--steel-line)] min-h-[260px]">
                  <div
                    style={{
                      aspectRatio: `${currentStyles.aspectRatio}`,
                      width: currentStyles.effectiveOrientation === 'landscape' ? '100%' : '65%',
                      maxWidth: '100%',
                      maxHeight: '230px',
                      filter: setup.colorMode === 'monochrome' ? 'grayscale(100%) contrast(120%)' : 'none',
                      transform: `scale(${(setup.scale || 100) / 100})`,
                      transformOrigin: 'center center'
                    }}
                    className="bg-white rounded shadow-xl border border-gray-400 p-2.5 flex flex-col justify-between text-[7px] text-gray-800 transition-all duration-300"
                  >
                    {/* Miniature Page Content */}
                    <div className="space-y-1">
                      {/* Mini Hazard bar */}
                      <div className="h-1 w-full bg-amber-400 rounded-xs" />
                      
                      {/* Mini Header */}
                      <div className="bg-gray-900 text-white p-1 rounded flex justify-between items-center">
                        <div className="flex items-center gap-1">
                          {setup.includeLogo && <div className="w-3 h-3 bg-amber-400 rounded-xs" />}
                          <span className="font-bold text-[7px] text-amber-400">FALCON</span>
                        </div>
                        <span className="font-mono text-[6px] text-gray-300">#INV-01</span>
                      </div>

                      {/* Mini Meta Grid */}
                      <div className="grid grid-cols-2 gap-1">
                        <div className="bg-gray-100 p-1 rounded">
                          <div className="text-[5px] text-gray-500 uppercase">Customer</div>
                          <div className="font-bold text-[6px]">Royal Fan Corp</div>
                        </div>
                        <div className="bg-gray-100 p-1 rounded">
                          <div className="text-[5px] text-gray-500 uppercase">Status</div>
                          <div className="font-bold text-[6px] text-emerald-600">PAID</div>
                        </div>
                      </div>

                      {/* Mini Table Rows */}
                      <div className="border border-gray-200 rounded overflow-hidden">
                        <div className="bg-gray-200 p-0.5 flex justify-between font-bold text-[5px]">
                          <span>Item</span>
                          <span>Qty</span>
                          <span>Total</span>
                        </div>
                        <div className="p-0.5 flex justify-between text-[5px] border-b border-gray-100">
                          <span>1/2" Fan Rod</span>
                          <span>100</span>
                          <span>Rs 15k</span>
                        </div>
                        <div className="p-0.5 flex justify-between text-[5px]">
                          <span>Clamp Set</span>
                          <span>50</span>
                          <span>Rs 4k</span>
                        </div>
                      </div>
                    </div>

                    {/* Miniature Signatures & Footer */}
                    <div className="space-y-1 pt-1 border-t border-gray-200">
                      {setup.includeSignatures && (
                        <div className="flex justify-between text-[5px] text-gray-400 font-mono">
                          <span className="border-t border-gray-300 pt-0.5">Prepared</span>
                          <span className="border-t border-gray-300 pt-0.5">Verified</span>
                          <span className="border-t border-gray-300 pt-0.5">Customer</span>
                        </div>
                      )}
                      <div className="text-[5px] bg-gray-900 text-amber-400 text-center py-0.5 rounded-xs truncate">
                        FALCON ROD MAKER · POS SYSTEM
                      </div>
                    </div>
                  </div>
                </div>

                {/* Setup Summary Specs */}
                <div className="p-3 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--text-dim)]">Paper Size:</span>
                    <span className="text-[var(--text)] font-bold">{currentSpec.name}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--text-dim)]">Dimensions:</span>
                    <span className="text-[var(--text)]">{currentSpec.dimensions}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--text-dim)]">Orientation:</span>
                    <span className="text-[var(--text)] font-bold uppercase">{currentStyles.effectiveOrientation}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--text-dim)]">Margins:</span>
                    <span className="text-[var(--text)] uppercase">{setup.margins} ({currentStyles.marginCss})</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--text-dim)]">Scale:</span>
                    <span className="text-[var(--yellow)] font-bold">{setup.scale || 100}%</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--text-dim)]">Palette:</span>
                    <span className="text-[var(--text)] capitalize">{setup.colorMode}</span>
                  </div>
                </div>

                {/* Primary CTA: Save as Default */}
                <button
                  type="button"
                  onClick={handleSave}
                  className={`w-full py-2.5 rounded-xl font-bold font-mono text-xs uppercase transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                    justSaved
                      ? 'bg-emerald-500 text-white'
                      : 'bg-[var(--yellow)] text-black hover:brightness-110'
                  }`}
                >
                  <Check size={16} />
                  <span>{justSaved ? 'Settings Saved!' : 'Apply & Save Setup'}</span>
                </button>

              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
