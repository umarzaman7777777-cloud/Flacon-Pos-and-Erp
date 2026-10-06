import React, { useState } from 'react';
import {
  X,
  Wrench,
  Sliders,
  Check,
  Download,
  Printer,
  ShoppingCart,
  Maximize2,
  RefreshCw,
  Layers,
  Sparkles,
  Info,
  Shield,
  Circle,
  Hash,
  Eye
} from 'lucide-react';
import { Product, RodBlueprintSpecs, AppLanguage } from '../types';
import { fmt, STANDARD_DIAMETER_OPTIONS, parseDiameterToInches, formatDiameterMm } from '../utils/helpers';

interface RodBlueprintStudioModalProps {
  product: Product | null;
  language: AppLanguage;
  companyName: string;
  isOpen: boolean;
  onClose: () => void;
  onSaveBlueprint: (productId: number, specs: RodBlueprintSpecs) => void;
  onAddToCart?: (product: Product, color?: string, size?: string) => void;
}

export const defaultBlueprintSpecs = (product?: Product | null): RodBlueprintSpecs => {
  const isPedestal = product?.cat?.toLowerCase().includes('pedestal') ||
    product?.name?.toLowerCase().includes('pedestal');
  const sizeNum = parseInt(product?.size || '18', 10) || 18;
  const clampedSize = Math.max(1, Math.min(240, sizeNum));

  return {
    rodType: isPedestal ? 'pedestal' : 'ceiling',
    lengthInches: clampedSize,
    diameterInches: isPedestal ? '1"' : '3/4"',
    gauge: product?.gauge || '16 Gauge',
    hasTopClamp: true,
    hasBottomClamp: true,
    clampStyle: isPedestal ? 'telescopic_sleeve' : 'standard',
    clampSize: isPedestal ? '1"' : '3/4"',
    clampGauge: '16 Gauge',
    threadType: 'without_thread',
    threadStandard: 'BSPT',
    holeSizeMm: 8,
    topHoleCount: 1,
    bottomHoleCount: 2,
    hasSafetySlit: !isPedestal,
    hasWireConduit: true,
    canopyRings: !isPedestal,
    finishColor: product?.color || 'Matt Black',
    notes: product?.name || 'Standard Fan Rod Blueprint'
  };
};

export const RodBlueprintStudioModal: React.FC<RodBlueprintStudioModalProps> = ({
  product,
  language,
  companyName,
  isOpen,
  onClose,
  onSaveBlueprint,
  onAddToCart
}) => {
  if (!isOpen || !product) return null;

  // Local blueprint state initialized from product or defaults
  const [specs, setSpecs] = useState<RodBlueprintSpecs>(() => {
    return product.blueprintSpecs || defaultBlueprintSpecs(product);
  });

  const [activeTab, setActiveTab] = useState<'dimensions' | 'clamps' | 'holes' | 'finish'>('dimensions');
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [cartFeedback, setCartFeedback] = useState(false);

  // Quick preset lengths (1" - 240")
  const PRESET_LENGTHS = [1, 3, 6, 9, 12, 18, 20, 24, 30, 36, 48, 60, 72, 96, 120, 144, 180, 240];
  const GAUGE_OPTIONS = ['14 Gauge', '16 Gauge', '18 Gauge', '20 Gauge'];
  const CLAMP_GAUGE_OPTIONS: string[] = ['14 Gauge', '16 Gauge', '18 Gauge', '20 Gauge'];
  const DIAMETER_OPTIONS = STANDARD_DIAMETER_OPTIONS;
  const HOLE_SIZE_OPTIONS = [6, 8, 10, 12];
  const FINISH_COLORS = [
    { name: 'Matt Black', hex: '#1e293b', border: '#475569' },
    { name: 'Shine Black', hex: '#0f172a', border: '#64748b' },
    { name: 'Pure White', hex: '#f8fafc', border: '#cbd5e1' },
    { name: 'Silver Grey', hex: '#94a3b8', border: '#cbd5e1' },
    { name: 'Golden Brass', hex: '#eab308', border: '#ca8a04' },
    { name: 'Raw Zinc', hex: '#64748b', border: '#94a3b8' }
  ];

  // Colors for SVG pipe rendering
  const getRodGradient = () => {
    const col = (specs.finishColor || 'black').toLowerCase();
    if (col.includes('white')) return { stroke: '#cbd5e1', fill: 'url(#whiteSheen)' };
    if (col.includes('silver') || col.includes('zinc')) return { stroke: '#94a3b8', fill: 'url(#silverSheen)' };
    if (col.includes('gold') || col.includes('brass')) return { stroke: '#fbbf24', fill: 'url(#goldSheen)' };
    return { stroke: '#38bdf8', fill: 'url(#darkSheen)' };
  };

  const { stroke: pipeStroke, fill: pipeFill } = getRodGradient();

  // SVG layout calculations based on length & diameter (1" - 240")
  const clampedLength = Math.max(1, Math.min(240, specs.lengthInches || 24));
  const lenRatio = Math.log10(clampedLength) / Math.log10(240);
  const pipeWidth = Math.round(75 + lenRatio * 185);
  const diaInches = parseDiameterToInches(specs.diameterInches);
  const baseDia = Math.max(0.125, Math.min(3.5, diaInches));
  const pipeHeight = Math.round(9 + Math.min(baseDia, 3.2) * 17.5);
  const centerY = 110;
  const clampHeight = Math.max(24, pipeHeight + 14);
  const clampY = centerY - clampHeight / 2;
  const startX = (340 - pipeWidth) / 2;

  // Hole radius in SVG pixels based on holeSizeMm (6mm ~ 2.4px, 12mm ~ 4.8px)
  const holeRadius = Math.max(2.2, (specs.holeSizeMm / 8) * 3.2);

  const handleSave = () => {
    onSaveBlueprint(product.id, specs);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleAddToCart = () => {
    if (onAddToCart) {
      onAddToCart(
        {
          ...product,
          size: `${specs.lengthInches}"`,
          gauge: specs.gauge,
          blueprintSpecs: specs
        },
        specs.finishColor,
        `${specs.lengthInches}"`
      );
      setCartFeedback(true);
      setTimeout(() => setCartFeedback(false), 2000);
    }
  };

  const handlePrintBlueprint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-sans">
      <div
        className="relative w-full max-w-5xl max-h-[94vh] flex flex-col rounded-2xl border border-[var(--steel-line)] bg-[var(--panel)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--steel-line)] bg-[var(--panel-raised)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Wrench size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight truncate">
                  Rod Engineering & Blueprint Studio
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase shrink-0">
                  {specs.rodType === 'pedestal' ? 'Pedestal Fan Rod' : 'Ceiling Fan Down-Rod'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold shrink-0">
                  {specs.lengthInches}&quot; ({Math.round(specs.lengthInches * 25.4)}mm)
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)] truncate mt-0.5 font-mono">
                Model: <span className="text-[var(--text)] font-semibold">{product.name}</span> · Customize lengths, clamps, and hole diameters
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel-hover)] transition cursor-pointer shrink-0 ml-2"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY CONTAINER: 2-COLUMN LAYOUT (CANVAS + CONTROLS) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-[var(--steel-line)]">
          
          {/* LEFT: INTERACTIVE CAD BLUEPRINT CANVAS (7 cols) */}
          <div className="lg:col-span-7 p-4 sm:p-6 flex flex-col justify-between bg-gradient-to-b from-[#060c18] via-[#091222] to-[#040810] relative">
            
            {/* Canvas Toolbar Info */}
            <div className="flex items-center justify-between text-xs font-mono text-[var(--text-dim)] mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-white uppercase text-[11px] tracking-wider">Live CAD 2D View</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-[10px]">
                  OD: {specs.diameterInches}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                  {specs.gauge}
                </span>
              </div>
            </div>

            {/* SVG Engineering Canvas Container */}
            <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-2xl bg-[#030712] border border-[#1e293b] flex items-center justify-center p-2 sm:p-4 overflow-hidden shadow-inner">
              {/* Millimeter Blueprint Grid Background */}
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  backgroundImage: `
                    radial-gradient(circle, #38bdf8 0.75px, transparent 0.75px),
                    linear-gradient(to right, rgba(56, 189, 248, 0.08) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(56, 189, 248, 0.08) 1px, transparent 1px)
                  `,
                  backgroundSize: '16px 16px, 16px 16px, 16px 16px'
                }}
              />

              <svg
                viewBox="0 0 340 220"
                className="w-full h-full max-h-full drop-shadow-[0_0_20px_rgba(56,189,248,0.2)] transition-all duration-300"
              >
                <defs>
                  <linearGradient id="darkSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#64748b" />
                    <stop offset="35%" stopColor="#1e293b" />
                    <stop offset="65%" stopColor="#0f172a" />
                    <stop offset="100%" stopColor="#1e293b" />
                  </linearGradient>
                  <linearGradient id="whiteSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="35%" stopColor="#e2e8f0" />
                    <stop offset="70%" stopColor="#94a3b8" />
                    <stop offset="100%" stopColor="#cbd5e1" />
                  </linearGradient>
                  <linearGradient id="silverSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f1f5f9" />
                    <stop offset="35%" stopColor="#94a3b8" />
                    <stop offset="65%" stopColor="#475569" />
                    <stop offset="100%" stopColor="#cbd5e1" />
                  </linearGradient>
                  <linearGradient id="goldSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="40%" stopColor="#eab308" />
                    <stop offset="70%" stopColor="#a16207" />
                    <stop offset="100%" stopColor="#ca8a04" />
                  </linearGradient>
                </defs>

                {/* Centerline Construction Axis */}
                <line
                  x1="15"
                  y1={centerY}
                  x2="325"
                  y2={centerY}
                  stroke="#0284c7"
                  strokeWidth="0.8"
                  strokeDasharray="8 4 2 4"
                  className="opacity-45"
                />

                {/* Main Tubular Steel Pipe Body */}
                <rect
                  x={startX}
                  y={centerY - pipeHeight / 2}
                  width={pipeWidth}
                  height={pipeHeight}
                  rx="3"
                  fill={pipeFill}
                  stroke={pipeStroke}
                  strokeWidth="1.8"
                  className="opacity-95"
                />

                {/* Bare Pipe Cut Chamfers if clamps are disabled */}
                {!specs.hasTopClamp && (
                  <path
                    d={`M ${startX} ${centerY - pipeHeight / 2} L ${startX + 5} ${centerY} L ${startX} ${centerY + pipeHeight / 2} Z`}
                    fill="#38bdf8"
                    opacity="0.3"
                  />
                )}
                {!specs.hasBottomClamp && (
                  <path
                    d={`M ${startX + pipeWidth} ${centerY - pipeHeight / 2} L ${startX + pipeWidth - 5} ${centerY} L ${startX + pipeWidth} ${centerY + pipeHeight / 2} Z`}
                    fill="#38bdf8"
                    opacity="0.3"
                  />
                )}

                {/* Internal Wiring Conduit Channel */}
                {specs.hasWireConduit && (
                  <>
                    <line
                      x1={startX + (specs.hasTopClamp ? 14 : 6)}
                      y1={centerY - 4}
                      x2={startX + pipeWidth - (specs.hasBottomClamp ? 14 : 6)}
                      y2={centerY - 4}
                      stroke="#38bdf8"
                      strokeWidth="0.8"
                      strokeDasharray="3 2"
                      className="opacity-60"
                    />
                    <line
                      x1={startX + (specs.hasTopClamp ? 14 : 6)}
                      y1={centerY + 4}
                      x2={startX + pipeWidth - (specs.hasBottomClamp ? 14 : 6)}
                      y2={centerY + 4}
                      stroke="#38bdf8"
                      strokeWidth="0.8"
                      strokeDasharray="3 2"
                      className="opacity-60"
                    />
                  </>
                )}

                {/* Canopy Rings (Ceiling Rod Retainers) */}
                {specs.canopyRings && (
                  <>
                    <rect
                      x={startX + 24}
                      y={centerY - pipeHeight / 2 - 3}
                      width="5"
                      height={pipeHeight + 6}
                      rx="1.5"
                      fill="#334155"
                      stroke="#64748b"
                      strokeWidth="1"
                    />
                    <rect
                      x={startX + pipeWidth - 30}
                      y={centerY - pipeHeight / 2 - 3}
                      width="5"
                      height={pipeHeight + 6}
                      rx="1.5"
                      fill="#334155"
                      stroke="#64748b"
                      strokeWidth="1"
                    />
                  </>
                )}

                {/* LEFT / TOP END: CLAMP OR BARE TUBE */}
                {specs.hasTopClamp ? (
                  <g id="top-clamp-assembly">
                    {/* Clamp Bracket Collar */}
                    <rect
                      x={startX - 12}
                      y={clampY}
                      width="14"
                      height={clampHeight}
                      rx="3"
                      fill="#1e293b"
                      stroke="#f59e0b"
                      strokeWidth="1.8"
                    />
                    {/* Clamp Top Fastener Hole */}
                    {specs.topHoleCount > 0 && (
                      <circle
                        cx={startX - 5}
                        cy={centerY}
                        r={holeRadius}
                        fill="#0b1320"
                        stroke="#f59e0b"
                        strokeWidth="1.3"
                      />
                    )}
                    {/* Cross-Hole Alignment Line */}
                    {specs.topHoleCount > 0 && (
                      <line
                        x1={startX - 5}
                        y1={centerY - holeRadius - 3}
                        x2={startX - 5}
                        y2={centerY + holeRadius + 3}
                        stroke="#38bdf8"
                        strokeWidth="0.8"
                      />
                    )}
                    {/* Safety Cotter Pin Slit */}
                    {specs.hasSafetySlit && (
                      <line
                        x1={startX + 5}
                        y1={centerY - 10}
                        x2={startX + 5}
                        y2={centerY + 10}
                        stroke="#f59e0b"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    )}
                  </g>
                ) : (
                  /* Bare Tube Top: Hole drilled directly into pipe */
                  <g id="bare-top-holes">
                    {specs.topHoleCount > 0 && (
                      <>
                        <circle
                          cx={startX + 12}
                          cy={centerY}
                          r={holeRadius}
                          fill="#0b1320"
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                        <line
                          x1={startX + 12}
                          y1={centerY - holeRadius - 2}
                          x2={startX + 12}
                          y2={centerY + holeRadius + 2}
                          stroke="#38bdf8"
                          strokeWidth="0.8"
                        />
                      </>
                    )}
                    {specs.hasSafetySlit && (
                      <line
                        x1={startX + 22}
                        y1={centerY - 7}
                        x2={startX + 22}
                        y2={centerY + 7}
                        stroke="#f59e0b"
                        strokeWidth="1"
                      />
                    )}
                  </g>
                )}

                {/* RIGHT / BOTTOM END: CLAMP OR BARE TUBE */}
                {specs.hasBottomClamp ? (
                  <g id="bottom-clamp-assembly">
                    {/* Motor Coupling Spindle Collar */}
                    <rect
                      x={startX + pipeWidth - 2}
                      y={clampY}
                      width="16"
                      height={clampHeight}
                      rx="3"
                      fill="#1e293b"
                      stroke="#f59e0b"
                      strokeWidth="1.8"
                    />
                    {/* Bottom Holes (Single or Dual through-holes) */}
                    {specs.bottomHoleCount >= 1 && (
                      <circle
                        cx={startX + pipeWidth + 6}
                        cy={specs.bottomHoleCount === 2 ? centerY - 6 : centerY}
                        r={holeRadius}
                        fill="#0b1320"
                        stroke="#f59e0b"
                        strokeWidth="1.3"
                      />
                    )}
                    {specs.bottomHoleCount === 2 && (
                      <circle
                        cx={startX + pipeWidth + 6}
                        cy={centerY + 6}
                        r={holeRadius}
                        fill="#0b1320"
                        stroke="#f59e0b"
                        strokeWidth="1.3"
                      />
                    )}
                  </g>
                ) : (
                  /* Bare Tube Bottom: Holes drilled directly through pipe */
                  <g id="bare-bottom-holes">
                    {specs.bottomHoleCount >= 1 && (
                      <>
                        <circle
                          cx={startX + pipeWidth - 12}
                          cy={specs.bottomHoleCount === 2 ? centerY - 5 : centerY}
                          r={holeRadius}
                          fill="#0b1320"
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                        {specs.bottomHoleCount === 2 && (
                          <circle
                            cx={startX + pipeWidth - 12}
                            cy={centerY + 5}
                            r={holeRadius}
                            fill="#0b1320"
                            stroke="#38bdf8"
                            strokeWidth="1.5"
                          />
                        )}
                      </>
                    )}
                  </g>
                )}

                {/* Falcon Logo on Rod Body */}
                <image
                  href="/falcon-theme-rod-logo.svg"
                  x={158}
                  y={centerY - 8}
                  width="24"
                  height="16"
                  className="select-none opacity-85"
                />

                {/* CAD Technical Dimension Callouts */}
                {/* Length Line with Arrows */}
                <line
                  x1={startX - (specs.hasTopClamp ? 12 : 0)}
                  y1={centerY + 38}
                  x2={startX + pipeWidth + (specs.hasBottomClamp ? 14 : 0)}
                  y2={centerY + 38}
                  stroke="#f59e0b"
                  strokeWidth="1.2"
                />
                <line
                  x1={startX - (specs.hasTopClamp ? 12 : 0)}
                  y1={centerY + 30}
                  x2={startX - (specs.hasTopClamp ? 12 : 0)}
                  y2={centerY + 46}
                  stroke="#f59e0b"
                  strokeWidth="1.2"
                />
                <line
                  x1={startX + pipeWidth + (specs.hasBottomClamp ? 14 : 0)}
                  y1={centerY + 30}
                  x2={startX + pipeWidth + (specs.hasBottomClamp ? 14 : 0)}
                  y2={centerY + 46}
                  stroke="#f59e0b"
                  strokeWidth="1.2"
                />
                <text
                  x="170"
                  y={centerY + 54}
                  textAnchor="middle"
                  fill="#f59e0b"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  LENGTH = {specs.lengthInches}&quot; ({Math.round(specs.lengthInches * 25.4)} mm)
                </text>

                {/* Diameter Callout */}
                <line
                  x1={startX - 26}
                  y1={centerY - pipeHeight / 2}
                  x2={startX - 26}
                  y2={centerY + pipeHeight / 2}
                  stroke="#38bdf8"
                  strokeWidth="1"
                />
                <line
                  x1={startX - 30}
                  y1={centerY - pipeHeight / 2}
                  x2={startX - 22}
                  y2={centerY - pipeHeight / 2}
                  stroke="#38bdf8"
                  strokeWidth="1"
                />
                <line
                  x1={startX - 30}
                  y1={centerY + pipeHeight / 2}
                  x2={startX - 22}
                  y2={centerY + pipeHeight / 2}
                  stroke="#38bdf8"
                  strokeWidth="1"
                />
                <text
                  x={startX - 33}
                  y={centerY + 3}
                  textAnchor="end"
                  fill="#38bdf8"
                  fontSize="7.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  OD Ø {specs.diameterInches} ({formatDiameterMm(specs.diameterInches)}mm)
                </text>

                {/* Hole Size Annotation */}
                <text
                  x={startX + pipeWidth + 24}
                  y={centerY - 22}
                  textAnchor="start"
                  fill="#94a3b8"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  HOLE Ø {specs.holeSizeMm} mm
                </text>
                <path
                  d={`M ${startX + pipeWidth + 20} ${centerY - 25} L ${startX + pipeWidth + (specs.hasBottomClamp ? 6 : -12)} ${centerY - 6}`}
                  stroke="#94a3b8"
                  strokeWidth="0.8"
                  fill="none"
                />
              </svg>

              {/* Status Floating Pill (With / Without Clamps) */}
              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 font-mono text-[10px]">
                <span className="text-zinc-400">CLAMPS:</span>
                <span className={`font-bold ${
                  specs.hasTopClamp && specs.hasBottomClamp
                    ? 'text-emerald-400'
                    : !specs.hasTopClamp && !specs.hasBottomClamp
                    ? 'text-amber-400'
                    : 'text-sky-400'
                }`}>
                  {specs.hasTopClamp && specs.hasBottomClamp
                    ? 'Dual Clamps'
                    : !specs.hasTopClamp && !specs.hasBottomClamp
                    ? 'Without Clamps (Bare Tube)'
                    : specs.hasTopClamp
                    ? 'Top Clamp Only'
                    : 'Bottom Clamp Only'}
                </span>
              </div>

              {/* Hole Diameter Pill */}
              <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 font-mono text-[10px] text-sky-300">
                Hole Size: <span className="font-bold text-white">Ø {specs.holeSizeMm} mm</span>
              </div>
            </div>

            {/* Blueprint Technical Spec Footnote */}
            <div className="mt-3 p-3 rounded-xl bg-[var(--panel-raised)]/60 border border-[var(--steel-line)] grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
              <div>
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Category</span>
                <span className="font-bold text-[var(--text)] capitalize">{specs.rodType} Fan Rod</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Pipe Gauge</span>
                <span className="font-bold text-amber-400">{specs.gauge}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Outer Diameter</span>
                <span className="font-bold text-sky-400">{specs.diameterInches}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Cotter Pin Slit</span>
                <span className="font-bold text-emerald-400">{specs.hasSafetySlit ? 'Yes (Molded)' : 'Omitted'}</span>
              </div>
            </div>
          </div>

          {/* RIGHT: INTERACTIVE SPECIFICATION STUDIO CONTROLS (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-[var(--panel)]">
            
            {/* Control Tabs */}
            <div className="flex border-b border-[var(--steel-line)] bg-[var(--panel-raised)]/70 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab('dimensions')}
                className={`flex-1 py-3 px-2 font-bold text-center border-b-2 transition ${
                  activeTab === 'dimensions'
                    ? 'border-amber-400 text-amber-400 bg-[var(--panel)]'
                    : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                1. Size & OD
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('clamps')}
                className={`flex-1 py-3 px-2 font-bold text-center border-b-2 transition ${
                  activeTab === 'clamps'
                    ? 'border-amber-400 text-amber-400 bg-[var(--panel)]'
                    : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                2. Clamps
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('holes')}
                className={`flex-1 py-3 px-2 font-bold text-center border-b-2 transition ${
                  activeTab === 'holes'
                    ? 'border-amber-400 text-amber-400 bg-[var(--panel)]'
                    : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                3. Holes & Slits
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('finish')}
                className={`flex-1 py-3 px-2 font-bold text-center border-b-2 transition ${
                  activeTab === 'finish'
                    ? 'border-amber-400 text-amber-400 bg-[var(--panel)]'
                    : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                4. Finish
              </button>
            </div>

            {/* TAB CONTENTS */}
            <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto">
              
              {/* TAB 1: SIZE, DIAMETER & GAUGE */}
              {activeTab === 'dimensions' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Rod Category Switcher */}
                  <div>
                    <label className="text-xs font-mono font-bold uppercase text-[var(--text-dim)] block mb-1.5">
                      Fan Application Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({
                          ...prev,
                          rodType: 'ceiling',
                          diameterInches: '3/4"',
                          hasSafetySlit: true,
                          canopyRings: true
                        }))}
                        className={`p-2.5 rounded-xl border text-xs font-bold font-mono transition text-left flex items-center justify-between ${
                          specs.rodType === 'ceiling'
                            ? 'bg-amber-500/15 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        <span>Ceiling Fan Down-Rod</span>
                        {specs.rodType === 'ceiling' && <Check size={14} className="text-amber-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({
                          ...prev,
                          rodType: 'pedestal',
                          diameterInches: '1"',
                          hasSafetySlit: false,
                          canopyRings: false
                        }))}
                        className={`p-2.5 rounded-xl border text-xs font-bold font-mono transition text-left flex items-center justify-between ${
                          specs.rodType === 'pedestal'
                            ? 'bg-sky-500/15 border-sky-400 text-sky-300 ring-1 ring-sky-400'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        <span>Pedestal Extension Rod</span>
                        {specs.rodType === 'pedestal' && <Check size={14} className="text-sky-400" />}
                      </button>
                    </div>
                  </div>

                  {/* Length Slider & Quick Buttons */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold uppercase text-[var(--text)] font-mono">
                        Pipe Length (Range: 1&quot; to 240&quot;)
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] px-2 py-0.5">
                          <input
                            type="number"
                            min="1"
                            max="240"
                            step="1"
                            value={specs.lengthInches}
                            onChange={e => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v)) {
                                setSpecs(prev => ({ ...prev, lengthInches: Math.max(1, Math.min(240, v)) }));
                              }
                            }}
                            className="w-14 bg-transparent text-right font-mono font-bold text-amber-300 text-sm focus:outline-none"
                          />
                          <span className="text-amber-300 font-mono font-bold text-sm ml-0.5">&quot;</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold text-xs">
                          {Math.round(specs.lengthInches * 25.4)} mm
                          {specs.lengthInches >= 39.37 ? ` / ${(specs.lengthInches * 0.0254).toFixed(2)} m` : ''}
                        </span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="240"
                      step="1"
                      value={specs.lengthInches}
                      onChange={e => setSpecs(prev => ({ ...prev, lengthInches: Math.max(1, Math.min(240, parseInt(e.target.value, 10) || 1)) }))}
                      className="w-full accent-amber-400 cursor-pointer h-2 bg-[var(--panel)] rounded-lg"
                    />

                    {/* Quick length chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1 max-h-32 overflow-y-auto">
                      {PRESET_LENGTHS.map(l => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setSpecs(prev => ({ ...prev, lengthInches: l }))}
                          className={`px-2 py-1 rounded text-xs font-mono transition cursor-pointer ${
                            specs.lengthInches === l
                              ? 'bg-amber-400 text-black font-bold'
                              : 'bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                          }`}
                        >
                          {l}&quot;
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Outer Diameter (OD) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-mono font-bold uppercase text-[var(--text-dim)]">
                        Pipe Outer Diameter (OD: from 1/8&quot; upwards)
                      </label>
                      <span className="text-xs font-mono text-sky-400 font-bold">
                        Ø {specs.diameterInches} ({formatDiameterMm(specs.diameterInches)} mm)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {DIAMETER_OPTIONS.map(dia => (
                        <button
                          key={dia}
                          type="button"
                          onClick={() => setSpecs(prev => ({ ...prev, diameterInches: dia, clampSize: prev.clampSize || dia }))}
                          className={`p-2 rounded-lg border text-xs font-mono text-center transition cursor-pointer flex flex-col items-center justify-center ${
                            specs.diameterInches === dia
                              ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold ring-1 ring-sky-400'
                              : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                          }`}
                        >
                          <span>Ø {dia}</span>
                          <span className="text-[10px] text-zinc-400 font-mono mt-0.5">{formatDiameterMm(dia)} mm</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pipe Gauge / Thickness */}
                  <div>
                    <label className="text-xs font-mono font-bold uppercase text-[var(--text-dim)] block mb-1.5">
                      Pipe Wall Thickness (Gauge)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {GAUGE_OPTIONS.map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setSpecs(prev => ({ ...prev, gauge: g }))}
                          className={`p-2 rounded-lg border text-xs font-mono text-center transition ${
                            specs.gauge === g
                              ? 'bg-amber-400 text-black font-bold border-amber-400'
                              : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CLAMPS CONFIGURATION (WITH / WITHOUT CLAMPS) */}
              {activeTab === 'clamps' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  
                  {/* One-Click Presets */}
                  <div>
                    <label className="text-xs font-mono font-bold uppercase text-[var(--text-dim)] block mb-1.5">
                      Quick Clamp Configuration Presets
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({
                          ...prev,
                          hasTopClamp: true,
                          hasBottomClamp: true
                        }))}
                        className={`p-2.5 rounded-xl border text-xs font-bold font-mono transition text-left flex items-center justify-between ${
                          specs.hasTopClamp && specs.hasBottomClamp
                            ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300 ring-1 ring-emerald-400'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        <span>Standard Dual Clamps</span>
                        {specs.hasTopClamp && specs.hasBottomClamp && <Check size={14} className="text-emerald-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({
                          ...prev,
                          hasTopClamp: false,
                          hasBottomClamp: false
                        }))}
                        className={`p-2.5 rounded-xl border text-xs font-bold font-mono transition text-left flex items-center justify-between ${
                          !specs.hasTopClamp && !specs.hasBottomClamp
                            ? 'bg-amber-500/15 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        <span>Without Clamps (Bare Pipe)</span>
                        {!specs.hasTopClamp && !specs.hasBottomClamp && <Check size={14} className="text-amber-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({
                          ...prev,
                          hasTopClamp: true,
                          hasBottomClamp: false
                        }))}
                        className={`p-2.5 rounded-xl border text-xs font-bold font-mono transition text-left flex items-center justify-between ${
                          specs.hasTopClamp && !specs.hasBottomClamp
                            ? 'bg-sky-500/15 border-sky-400 text-sky-300 ring-1 ring-sky-400'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        <span>Top Clamp Only</span>
                        {specs.hasTopClamp && !specs.hasBottomClamp && <Check size={14} className="text-sky-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({
                          ...prev,
                          hasTopClamp: false,
                          hasBottomClamp: true
                        }))}
                        className={`p-2.5 rounded-xl border text-xs font-bold font-mono transition text-left flex items-center justify-between ${
                          !specs.hasTopClamp && specs.hasBottomClamp
                            ? 'bg-sky-500/15 border-sky-400 text-sky-300 ring-1 ring-sky-400'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        <span>Bottom Clamp Only</span>
                        {!specs.hasTopClamp && specs.hasBottomClamp && <Check size={14} className="text-sky-400" />}
                      </button>
                    </div>
                  </div>

                  {/* Individual Clamp Switches */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[var(--text)] block font-mono">
                          Top Ceiling Shackle / Collar Clamp
                        </span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          Attaches to roof hook / shackle bracket
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, hasTopClamp: !prev.hasTopClamp }))}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${
                          specs.hasTopClamp
                            ? 'bg-emerald-500 text-black'
                            : 'bg-zinc-700 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {specs.hasTopClamp ? 'CLAMP ON' : 'BARE END'}
                      </button>
                    </div>

                    <div className="pt-2 border-t border-[var(--steel-line)] flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[var(--text)] block font-mono">
                          Bottom Motor Spindle Coupling Clamp
                        </span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          Locks onto fan motor rotor shaft
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, hasBottomClamp: !prev.hasBottomClamp }))}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${
                          specs.hasBottomClamp
                            ? 'bg-emerald-500 text-black'
                            : 'bg-zinc-700 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {specs.hasBottomClamp ? 'CLAMP ON' : 'BARE END'}
                      </button>
                    </div>
                  </div>

                  {/* Attached Clamp Bore Size Selection */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono font-bold uppercase text-[var(--text)] block">
                        Clamp Bore Diameter (Clamp Size)
                      </label>
                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, clampSize: prev.diameterInches }))}
                        className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-mono font-bold hover:bg-sky-500 hover:text-black transition"
                      >
                        Sync to Rod OD ({specs.diameterInches})
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {DIAMETER_OPTIONS.map(dia => (
                        <button
                          key={dia}
                          type="button"
                          onClick={() => setSpecs(prev => ({ ...prev, clampSize: dia }))}
                          className={`p-1.5 rounded-lg border text-xs font-mono text-center transition flex flex-col items-center justify-center ${
                            (specs.clampSize || specs.diameterInches) === dia
                              ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold ring-1 ring-sky-400'
                              : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                          }`}
                        >
                          <span>{dia}</span>
                          <span className="text-[9px] text-zinc-400">{formatDiameterMm(dia)}mm</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Attached Clamp Stamping Gauge */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
                    <label className="text-xs font-mono font-bold uppercase text-[var(--text)] block">
                      Clamp Stamping Thickness (Gauge)
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {CLAMP_GAUGE_OPTIONS.map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setSpecs(prev => ({ ...prev, clampGauge: g }))}
                          className={`p-2 rounded-lg border text-xs font-mono text-center transition ${
                            (specs.clampGauge || '16 Gauge') === g
                              ? 'bg-amber-400 text-black font-bold border-amber-400'
                              : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Threading Specification on Rod Ends */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2.5">
                    <label className="text-xs font-mono font-bold uppercase text-[var(--text)] block">
                      Threading Specification (With Threads / Without Thread)
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, threadType: 'without_thread' }))}
                        className={`p-2 rounded-lg border text-left flex items-center justify-between ${
                          specs.threadType === 'without_thread' || !specs.threadType
                            ? 'bg-amber-400 text-black font-bold'
                            : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        <span>Without Thread</span>
                        {(specs.threadType === 'without_thread' || !specs.threadType) && <Check size={12} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, threadType: 'both_ends' }))}
                        className={`p-2 rounded-lg border text-left flex items-center justify-between ${
                          specs.threadType === 'both_ends'
                            ? 'bg-amber-400 text-black font-bold'
                            : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        <span>With Threads (Both Ends)</span>
                        {specs.threadType === 'both_ends' && <Check size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* Clamp Style Selector */}
                  {(specs.hasTopClamp || specs.hasBottomClamp) && (
                    <div>
                      <label className="text-xs font-mono font-bold uppercase text-[var(--text-dim)] block mb-1.5">
                        Clamp Design Style
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'standard', name: 'Standard Shackle' },
                          { id: 'heavy_duty', name: 'Heavy-Duty Cast' },
                          { id: 'ring_collar', name: 'Machined Ring Collar' },
                          { id: 'telescopic_sleeve', name: 'Telescopic Lock Sleeve' }
                        ].map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSpecs(prev => ({ ...prev, clampStyle: c.id as any }))}
                            className={`p-2.5 rounded-lg border text-xs font-mono text-left transition ${
                              specs.clampStyle === c.id
                                ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                                : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                            }`}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: HOLES, SLITS & WIREWAY */}
              {activeTab === 'holes' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  
                  {/* Hole Diameter Selector */}
                  <div>
                    <label className="text-xs font-mono font-bold uppercase text-[var(--text-dim)] block mb-1.5">
                      Fastener Through-Hole Diameter
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {HOLE_SIZE_OPTIONS.map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSpecs(prev => ({ ...prev, holeSizeMm: size }))}
                          className={`p-2.5 rounded-xl border text-xs font-mono text-center transition ${
                            specs.holeSizeMm === size
                              ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold ring-1 ring-sky-400'
                              : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                          }`}
                        >
                          <span className="block text-sm font-bold">Ø {size}mm</span>
                          <span className="text-[9px] text-[var(--text-dim)]">
                            {size === 6 ? 'M6 Bolt' : size === 8 ? 'Standard' : size === 10 ? 'Heavy' : '12mm Cotter'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Top & Bottom Hole Counts */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1.5">
                      <span className="text-xs font-bold text-[var(--text)] block font-mono">
                        Top Hole Count
                      </span>
                      <div className="grid grid-cols-3 gap-1">
                        {[0, 1, 2].map(cnt => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setSpecs(prev => ({ ...prev, topHoleCount: cnt }))}
                            className={`py-1 rounded text-xs font-mono font-bold ${
                              specs.topHoleCount === cnt
                                ? 'bg-amber-400 text-black'
                                : 'bg-[var(--panel)] text-[var(--text-dim)] border border-[var(--steel-line)]'
                            }`}
                          >
                            {cnt === 0 ? 'None' : `${cnt} Hole`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1.5">
                      <span className="text-xs font-bold text-[var(--text)] block font-mono">
                        Bottom Hole Count
                      </span>
                      <div className="grid grid-cols-3 gap-1">
                        {[0, 1, 2].map(cnt => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setSpecs(prev => ({ ...prev, bottomHoleCount: cnt }))}
                            className={`py-1 rounded text-xs font-mono font-bold ${
                              specs.bottomHoleCount === cnt
                                ? 'bg-amber-400 text-black'
                                : 'bg-[var(--panel)] text-[var(--text-dim)] border border-[var(--steel-line)]'
                            }`}
                          >
                            {cnt === 0 ? 'None' : `${cnt} Hole`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Safety Slit & Conduit Toggles */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3 text-xs font-mono">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="font-bold text-[var(--text)] block">Safety Cotter Pin Slit</span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          Secondary safety pin slot to prevent rod rotation
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={specs.hasSafetySlit}
                        onChange={e => setSpecs(prev => ({ ...prev, hasSafetySlit: e.target.checked }))}
                        className="rounded border-[var(--steel-line)] text-amber-500 focus:ring-amber-500 w-4 h-4 bg-[var(--panel)]"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-[var(--steel-line)]">
                      <div>
                        <span className="font-bold text-[var(--text)] block">Internal Wire Conduit Passage</span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          Hollow central bore for concealed electrical wiring
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={specs.hasWireConduit}
                        onChange={e => setSpecs(prev => ({ ...prev, hasWireConduit: e.target.checked }))}
                        className="rounded border-[var(--steel-line)] text-amber-500 focus:ring-amber-500 w-4 h-4 bg-[var(--panel)]"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-[var(--steel-line)]">
                      <div>
                        <span className="font-bold text-[var(--text)] block">Canopy Retainer Ring Grooves</span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          Rubber grommet seating stops for upper & lower cup
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={specs.canopyRings}
                        onChange={e => setSpecs(prev => ({ ...prev, canopyRings: e.target.checked }))}
                        className="rounded border-[var(--steel-line)] text-amber-500 focus:ring-amber-500 w-4 h-4 bg-[var(--panel)]"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 4: FINISH & COLOR */}
              {activeTab === 'finish' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div>
                    <label className="text-xs font-mono font-bold uppercase text-[var(--text-dim)] block mb-1.5">
                      Surface Finish & Powder Coating
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {FINISH_COLORS.map(c => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setSpecs(prev => ({ ...prev, finishColor: c.name }))}
                          className={`p-3 rounded-xl border text-left flex items-center gap-3 transition ${
                            specs.finishColor === c.name
                              ? 'bg-amber-500/15 border-amber-400 text-white ring-1 ring-amber-400 font-bold'
                              : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                          }`}
                        >
                          <span
                            className="w-5 h-5 rounded-full border shadow-sm shrink-0"
                            style={{ backgroundColor: c.hex, borderColor: c.border }}
                          />
                          <span className="text-xs font-mono">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes / Special Instructions */}
                  <div>
                    <label className="text-xs font-mono font-bold uppercase text-[var(--text-dim)] block mb-1">
                      Custom Factory Machining Notes
                    </label>
                    <textarea
                      rows={3}
                      value={specs.notes || ''}
                      onChange={e => setSpecs(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="e.g. Extra 5mm chamfer, drill cotter pin hole 15mm from top end, zinc plated..."
                      className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl p-3 text-xs text-[var(--text)] font-mono focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* STUDIO FOOTER ACTION BUTTONS */}
            <div className="p-4 border-t border-[var(--steel-line)] bg-[var(--panel-raised)] flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSpecs(defaultBlueprintSpecs(product))}
                  className="px-3 py-2 rounded-xl text-xs font-mono text-[var(--text-dim)] hover:text-white border border-[var(--steel-line)] hover:border-amber-400 transition flex items-center gap-1.5"
                  title="Reset to factory original blueprint defaults"
                >
                  <RefreshCw size={13} />
                  <span>Reset Defaults</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintBlueprint}
                  className="px-3 py-2 rounded-xl text-xs font-mono text-[var(--text)] bg-[var(--panel)] hover:bg-[var(--panel-hover)] border border-[var(--steel-line)] transition flex items-center gap-1.5"
                  title="Print CAD Blueprint Technical Sheet"
                >
                  <Printer size={13} className="text-amber-400" />
                  <span>Print Spec</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {onAddToCart && (
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs font-mono flex items-center gap-1.5 transition shadow"
                  >
                    <ShoppingCart size={14} />
                    <span>{cartFeedback ? 'Added to Cart!' : 'Add Custom to Order'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs font-mono flex items-center gap-1.5 transition shadow"
                >
                  <Check size={14} />
                  <span>{savedFeedback ? 'Saved to Catalog!' : 'Save Blueprint Specs'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
