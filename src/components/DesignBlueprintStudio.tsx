import React, { useState, useRef } from 'react';
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
  Eye,
  Settings2,
  Copy,
  CheckCircle2,
  SlidersHorizontal,
  ChevronRight,
  FileText,
  Loader2
} from 'lucide-react';
import { Product, RodBlueprintSpecs, AppLanguage } from '../types';
import { fmt, STANDARD_DIAMETER_OPTIONS, parseDiameterToInches, formatDiameterMm } from '../utils/helpers';
import { exportRodBlueprintPDF } from '../utils/blueprintPdfExport';

export interface DesignBlueprintStudioProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveBlueprint: (productId: number, specs: RodBlueprintSpecs) => void;
  onAddToCart?: (product: Product, color?: string, size?: string) => void;
  language?: AppLanguage;
  companyName?: string;
}

export const defaultRodSpecs = (product?: Product | null): RodBlueprintSpecs => {
  const isPedestal =
    product?.cat?.toLowerCase().includes('pedestal') ||
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
    hasGarterPin: !isPedestal,
    garterPinType: 'split_cotter',
    garterPinDiameterMm: 3.2,
    garterPinLengthMm: 45,
    garterPinMaterial: 'zinc_plated_steel',
    finishColor: product?.color || 'Matt Black',
    notes: product?.name || 'Standard Fan Rod Blueprint'
  };
};

/**
 * Reusable SVG Blueprint Overlay for Product Cards, Modal Canvas, and Individual Component Blueprints
 */
export const RodBlueprintSvgOverlay: React.FC<{
  specs: RodBlueprintSpecs;
  interactive?: boolean;
  compact?: boolean;
  viewMode?: 'assembly' | 'rod' | 'clamps' | 'garter_pin' | 'exploded';
  className?: string;
  svgRef?: React.Ref<SVGSVGElement>;
}> = ({
  specs,
  interactive = false,
  compact = false,
  viewMode = 'assembly',
  className = '',
  svgRef
}) => {
  // Resolve colors
  const col = (specs.finishColor || 'black').toLowerCase();
  let strokeColor = '#38bdf8';
  let rodFill = 'url(#darkSheenOverlay)';

  if (col.includes('white')) {
    strokeColor = '#cbd5e1';
    rodFill = 'url(#whiteSheenOverlay)';
  } else if (col.includes('silver') || col.includes('grey') || col.includes('zinc')) {
    strokeColor = '#94a3b8';
    rodFill = 'url(#silverSheenOverlay)';
  } else if (col.includes('gold') || col.includes('brass')) {
    strokeColor = '#fbbf24';
    rodFill = 'url(#goldSheenOverlay)';
  }

  // Visual length scaling smoothly mapped for 1" - 240"
  const clampedLength = Math.max(1, Math.min(240, specs.lengthInches || 24));
  const lenRatio = Math.log10(clampedLength) / Math.log10(240); // 0 at 1", 1 at 240"
  const pipeWidth = Math.round(68 + lenRatio * 168);

  // Dynamic, proportional diameter scaling with clear visual graduation:
  // 1/8" -> ~11px, 1/4" -> ~13px, 1/2" -> ~18px, 3/4" -> ~22px, 1" -> ~27px, 1-1/4" -> ~32px, 1-1/2" -> ~37px, 2" -> ~46px, 3" -> ~63px
  const diaInches = parseDiameterToInches(specs.diameterInches);
  const baseDia = Math.max(0.125, Math.min(3.5, diaInches));
  const pipeHeight = Math.round(9 + Math.min(baseDia, 3.2) * 17.5);

  const viewBoxW = 280;
  const viewBoxH = compact ? 180 : 210;
  const startX = (viewBoxW - pipeWidth) / 2;
  const centerY = viewBoxH / 2 - (compact ? 8 : 10);

  // Dynamic clamp dimensions wrapping proportionally around the pipe body
  const clampHeight = Math.max(24, pipeHeight + 14);
  const clampY = centerY - clampHeight / 2;
  const clampEarOffset = clampHeight / 2 + 3;

  // Hole radius scaled to millimeters (6mm ~ 2.4px, 12mm ~ 4.8px)
  const holeRadius = Math.max(2.0, (specs.holeSizeMm / 8) * 3.2);

  const sharedDefs = (
    <defs>
      <linearGradient id="darkSheenOverlay" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#64748b" />
        <stop offset="35%" stopColor="#1e293b" />
        <stop offset="65%" stopColor="#0f172a" />
        <stop offset="100%" stopColor="#1e293b" />
      </linearGradient>
      <linearGradient id="whiteSheenOverlay" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="35%" stopColor="#e2e8f0" />
        <stop offset="70%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#cbd5e1" />
      </linearGradient>
      <linearGradient id="silverSheenOverlay" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#f1f5f9" />
        <stop offset="35%" stopColor="#94a3b8" />
        <stop offset="65%" stopColor="#475569" />
        <stop offset="100%" stopColor="#cbd5e1" />
      </linearGradient>
      <linearGradient id="goldSheenOverlay" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="40%" stopColor="#eab308" />
        <stop offset="70%" stopColor="#a16207" />
        <stop offset="100%" stopColor="#ca8a04" />
      </linearGradient>
    </defs>
  );

  // -------------------------------------------------------------
  // VIEW MODE 1: MAIN TUBULAR ROD BLUEPRINT (Component Detail)
  // -------------------------------------------------------------
  if (viewMode === 'rod') {
    const rodScaleW = 185;
    const rodStartX = 72;
    const rodH = Math.max(12, Math.min(54, pipeHeight));
    const secCX = 34;
    const secCY = centerY;
    const secR = Math.max(7, Math.min(26, rodH / 2));
    const gaugeNum = parseInt(specs.gauge || '16', 10);
    const wallThickMm = gaugeNum === 14 ? 2.0 : gaugeNum === 16 ? 1.6 : gaugeNum === 18 ? 1.2 : 0.9;
    const diaMm = diaInches * 25.4;
    const innerDiaMm = Math.max(1, diaMm - 2 * wallThickMm);
    const wallThickPx = Math.max(1.8, Math.min(secR * 0.45, (wallThickMm / Math.max(6, diaMm)) * (secR * 2.2)));
    const innerR = Math.max(2.5, secR - wallThickPx);

    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
        className={`w-full h-full drop-shadow-[0_0_15px_rgba(56,189,248,0.18)] transition-all duration-300 ${className}`}
      >
        {sharedDefs}
        {/* Title Block */}
        <text x="12" y="16" fill="#38bdf8" fontSize="8" fontFamily="monospace" fontWeight="bold">
          CAD PART 1: MAIN TUBULAR STEEL ROD
        </text>
        <text x={viewBoxW - 12} y="16" textAnchor="end" fill="#94a3b8" fontSize="7" fontFamily="monospace">
          OD: {specs.diameterInches} ({diaMm.toFixed(1)}mm) • GAUGE: {specs.gauge}
        </text>

        {/* Centerline Construction Axis */}
        <line x1="12" y1={centerY} x2={viewBoxW - 12} y2={centerY} stroke="#0284c7" strokeWidth="0.8" strokeDasharray="8 4 2 4" opacity="0.5" />

        {/* Cross Sectional View (Left Side) */}
        <g id="rod-section-view">
          <circle cx={secCX} cy={secCY} r={secR} fill="#1e293b" stroke="#38bdf8" strokeWidth="1.6" />
          <circle cx={secCX} cy={secCY} r={innerR} fill="#060c18" stroke="#0284c7" strokeWidth="1" strokeDasharray="3 2" />
          <line x1={secCX - secR} y1={secCY} x2={secCX - innerR} y2={secCY} stroke="#f59e0b" strokeWidth="1.5" />
          <text x={secCX} y={secCY + secR + 11} textAnchor="middle" fill="#38bdf8" fontSize="6" fontFamily="monospace" fontWeight="bold">
            Ø {specs.diameterInches} ({diaMm.toFixed(1)}mm)
          </text>
          <text x={secCX} y={secCY - secR - 6} textAnchor="middle" fill="#f59e0b" fontSize="5.5" fontFamily="monospace">
            ID {innerDiaMm.toFixed(1)}mm • {specs.gauge}
          </text>
        </g>

        {/* Main Tubular Shaft */}
        <rect
          x={rodStartX}
          y={centerY - rodH / 2}
          width={rodScaleW}
          height={rodH}
          rx="2"
          fill={rodFill}
          stroke={strokeColor}
          strokeWidth="1.8"
        />

        {/* Chamfers */}
        <path d={`M ${rodStartX} ${centerY - rodH / 2} L ${rodStartX + 4} ${centerY} L ${rodStartX} ${centerY + rodH / 2} Z`} fill="#38bdf8" opacity="0.4" />
        <path d={`M ${rodStartX + rodScaleW} ${centerY - rodH / 2} L ${rodStartX + rodScaleW - 4} ${centerY} L ${rodStartX + rodScaleW} ${centerY + rodH / 2} Z`} fill="#38bdf8" opacity="0.4" />

        {/* Top Through-Hole & Axis */}
        <circle cx={rodStartX + 18} cy={centerY} r={holeRadius} fill="#060c18" stroke="#38bdf8" strokeWidth="1.4" />
        <line x1={rodStartX + 18} y1={centerY - holeRadius - 4} x2={rodStartX + 18} y2={centerY + holeRadius + 4} stroke="#38bdf8" strokeWidth="0.8" />
        <line x1={rodStartX + 18 - holeRadius - 4} y1={centerY} x2={rodStartX + 18 + holeRadius + 4} y2={centerY} stroke="#38bdf8" strokeWidth="0.8" />

        {/* Safety Cotter Slit */}
        {specs.hasSafetySlit && (
          <line x1={rodStartX + 28} y1={centerY - 9} x2={rodStartX + 28} y2={centerY + 9} stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" />
        )}

        {/* Bottom Holes */}
        <circle cx={rodStartX + rodScaleW - 20} cy={centerY - 4} r={holeRadius} fill="#060c18" stroke="#38bdf8" strokeWidth="1.4" />
        <circle cx={rodStartX + rodScaleW - 20} cy={centerY + 4} r={holeRadius} fill="#060c18" stroke="#38bdf8" strokeWidth="1.4" />

        {/* Machined Screw Threads if enabled */}
        {(specs.threadType === 'top_only' || specs.threadType === 'both_ends') && (
          <rect x={rodStartX} y={centerY - rodH / 2} width={26} height={rodH} fill="url(#goldSheenOverlay)" stroke="#eab308" strokeWidth="1.2" opacity="0.9" />
        )}
        {(specs.threadType === 'bottom_only' || specs.threadType === 'both_ends') && (
          <rect x={rodStartX + rodScaleW - 26} y={centerY - rodH / 2} width={26} height={rodH} fill="url(#goldSheenOverlay)" stroke="#eab308" strokeWidth="1.2" opacity="0.9" />
        )}

        {/* Length Dimension Line */}
        <line x1={rodStartX} y1={centerY + rodH / 2 + 18} x2={rodStartX + rodScaleW} y2={centerY + rodH / 2 + 18} stroke="#f59e0b" strokeWidth="1.2" />
        <line x1={rodStartX} y1={centerY + rodH / 2 + 12} x2={rodStartX} y2={centerY + rodH / 2 + 24} stroke="#f59e0b" strokeWidth="1.2" />
        <line x1={rodStartX + rodScaleW} y1={centerY + rodH / 2 + 12} x2={rodStartX + rodScaleW} y2={centerY + rodH / 2 + 24} stroke="#f59e0b" strokeWidth="1.2" />
        <text x={rodStartX + rodScaleW / 2} y={centerY + rodH / 2 + 30} textAnchor="middle" fill="#f59e0b" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
          Length: {specs.lengthInches}&quot; ({Math.round(specs.lengthInches * 25.4)} mm / {(specs.lengthInches * 0.0254).toFixed(2)} m)
        </text>

        {/* Technical Callout Bar */}
        <rect x={rodStartX} y={centerY - rodH / 2 - 28} width={rodScaleW} height="18" rx="4" fill="#0b1320" stroke="#1e293b" strokeWidth="1" />
        <text x={rodStartX + rodScaleW / 2} y={centerY - rodH / 2 - 16} textAnchor="middle" fill="#94a3b8" fontSize="6.5" fontFamily="monospace">
          Cold-Rolled Steel Pipe • Threads: {specs.threadType === 'without_thread' || !specs.threadType ? 'None (Plain)' : specs.threadStandard || 'BSPT'} • Conduit: {specs.hasWireConduit ? 'Yes' : 'No'}
        </text>
      </svg>
    );
  }

  // -------------------------------------------------------------
  // VIEW MODE 2: CLAMPS BLUEPRINT (Component Detail)
  // -------------------------------------------------------------
  if (viewMode === 'clamps') {
    const clamp1X = 72;
    const clamp2X = 208;
    const clampCY = centerY + 4;
    const boreDia = specs.clampSize || specs.diameterInches || '3/4"';
    const clampG = specs.clampGauge || '16 Gauge';
    const boreDiaInches = parseDiameterToInches(boreDia);
    const boreRadius = Math.max(8, Math.min(23, Math.round(9 + boreDiaInches * 6.5)));

    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
        className={`w-full h-full drop-shadow-[0_0_15px_rgba(56,189,248,0.18)] transition-all duration-300 ${className}`}
      >
        {sharedDefs}
        {/* Title Block */}
        <text x="12" y="16" fill="#f59e0b" fontSize="8" fontFamily="monospace" fontWeight="bold">
          CAD PART 2: CEILING SHACKLE & MOTOR COUPLER CLAMPS
        </text>
        <text x={viewBoxW - 12} y="16" textAnchor="end" fill="#94a3b8" fontSize="7" fontFamily="monospace">
          BORE: {boreDia} ({formatDiameterMm(boreDia)} mm) • GAUGE: {clampG}
        </text>

        {/* Divider */}
        <line x1={viewBoxW / 2} y1="26" x2={viewBoxW / 2} y2={viewBoxH - 16} stroke="#334155" strokeWidth="0.8" strokeDasharray="4 4" />

        {/* LEFT: CEILING SHACKLE CLAMP */}
        <g id="cad-shackle-clamp">
          <text x={clamp1X} y="32" textAnchor="middle" fill="#38bdf8" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
            1. TOP CEILING SHACKLE COLLAR
          </text>
          {specs.hasTopClamp ? (
            <>
              {/* Collar body */}
              <rect x={clamp1X - 22} y={clampCY - 28} width="44" height="56" rx="6" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
              {/* Collar inner bore */}
              <circle cx={clamp1X} cy={clampCY - 4} r={boreRadius} fill="#060c18" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 2" />
              {/* Pinch bolt ears */}
              <rect x={clamp1X - 28} y={clampCY - 34} width="8" height="12" rx="2" fill="#475569" stroke="#f59e0b" strokeWidth="1.2" />
              <rect x={clamp1X - 28} y={clampCY + 18} width="8" height="12" rx="2" fill="#475569" stroke="#f59e0b" strokeWidth="1.2" />
              {/* Pinch bolt shaft */}
              <line x1={clamp1X - 24} y1={clampCY - 38} x2={clamp1X - 24} y2={clampCY + 34} stroke="#e2e8f0" strokeWidth="2" />
              <circle cx={clamp1X - 24} cy={clampCY - 38} r="3" fill="#cbd5e1" />
              <rect x={clamp1X - 26} y={clampCY + 30} width="4" height="4" fill="#94a3b8" />
              {/* Shackle cross bolt hole */}
              <circle cx={clamp1X} cy={clampCY - 4} r="4" fill="#0284c7" stroke="#ffffff" strokeWidth="1" />
              {/* Callouts */}
              <text x={clamp1X} y={clampCY + 38} textAnchor="middle" fill="#f59e0b" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
                Bore: Ø {boreDia} ({formatDiameterMm(boreDia)} mm)
              </text>
              <text x={clamp1X} y={clampCY + 48} textAnchor="middle" fill="#94a3b8" fontSize="6" fontFamily="monospace">
                Stamping: {clampG} Steel • Anti-Drop Flange
              </text>
            </>
          ) : (
            <g>
              <rect x={clamp1X - 35} y={clampCY - 25} width="70" height="50" rx="6" fill="#0b1320" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
              <text x={clamp1X} y={clampCY} textAnchor="middle" fill="#64748b" fontSize="7" fontFamily="monospace">
                [CLAMP OMITTED]
              </text>
              <text x={clamp1X} y={clampCY + 12} textAnchor="middle" fill="#f59e0b" fontSize="6" fontFamily="monospace">
                Bare Pipe End Configured
              </text>
            </g>
          )}
        </g>

        {/* RIGHT: BOTTOM MOTOR COUPLER CLAMP */}
        <g id="cad-motor-coupler">
          <text x={clamp2X} y="32" textAnchor="middle" fill="#38bdf8" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
            2. BOTTOM MOTOR SPINDLE COUPLER
          </text>
          {specs.hasBottomClamp ? (
            <>
              {/* Coupler body */}
              <rect x={clamp2X - 24} y={clampCY - 28} width="48" height="56" rx="6" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
              {/* Motor spindle socket bore */}
              <circle cx={clamp2X} cy={clampCY - 4} r={boreRadius + 1} fill="#060c18" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 2" />
              {/* Dual motor locking bolt pin holes */}
              <circle cx={clamp2X - 7} cy={clampCY - 4} r="3.5" fill="#0284c7" stroke="#ffffff" strokeWidth="0.8" />
              <circle cx={clamp2X + 7} cy={clampCY - 4} r="3.5" fill="#0284c7" stroke="#ffffff" strokeWidth="0.8" />
              {/* Pinch flange & bolt */}
              <rect x={clamp2X + 22} y={clampCY - 34} width="8" height="12" rx="2" fill="#475569" stroke="#f59e0b" strokeWidth="1.2" />
              <rect x={clamp2X + 22} y={clampCY + 18} width="8" height="12" rx="2" fill="#475569" stroke="#f59e0b" strokeWidth="1.2" />
              <line x1={clamp2X + 26} y1={clampCY - 38} x2={clamp2X + 26} y2={clampCY + 34} stroke="#e2e8f0" strokeWidth="2" />
              {/* Callouts */}
              <text x={clamp2X} y={clampCY + 38} textAnchor="middle" fill="#f59e0b" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
                Spindle Socket: Ø {boreDia}
              </text>
              <text x={clamp2X} y={clampCY + 48} textAnchor="middle" fill="#94a3b8" fontSize="6" fontFamily="monospace">
                Dual Rotor Bolts • Tolerance ±0.15mm
              </text>
            </>
          ) : (
            <g>
              <rect x={clamp2X - 35} y={clampCY - 25} width="70" height="50" rx="6" fill="#0b1320" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
              <text x={clamp2X} y={clampCY} textAnchor="middle" fill="#64748b" fontSize="7" fontFamily="monospace">
                [COUPLER OMITTED]
              </text>
              <text x={clamp2X} y={clampCY + 12} textAnchor="middle" fill="#f59e0b" fontSize="6" fontFamily="monospace">
                Direct Rotor Bolt Pipe End
              </text>
            </g>
          )}
        </g>
      </svg>
    );
  }

  // -------------------------------------------------------------
  // VIEW MODE 3: GARTER / COTTER PIN BLUEPRINT (Component Detail)
  // -------------------------------------------------------------
  if (viewMode === 'garter_pin') {
    const pinCX = 95;
    const pinCY = centerY - 5;
    const pinDia = specs.garterPinDiameterMm || 3.2;
    const pinLen = specs.garterPinLengthMm || 45;
    const isFitted = specs.hasGarterPin !== false;
    const pinType = specs.garterPinType || 'split_cotter';
    const matName =
      specs.garterPinMaterial === 'stainless_steel'
        ? 'Stainless Steel 304'
        : specs.garterPinMaterial === 'brass'
        ? 'Hardened Brass'
        : 'Zinc Plated High-Tensile Steel';

    const typeTitle =
      pinType === 'hairpin_r_clip'
        ? 'DIN 11024 • Hairpin R-Clip'
        : pinType === 'through_bolt_locknut'
        ? 'ISO 7040 • Through-Bolt & Locknut'
        : 'DIN 94 • Split Cotter Pin';

    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
        className={`w-full h-full drop-shadow-[0_0_15px_rgba(56,189,248,0.18)] transition-all duration-300 ${className}`}
      >
        {sharedDefs}
        {/* Title Block */}
        <text x="12" y="16" fill="#fbbf24" fontSize="8" fontFamily="monospace" fontWeight="bold">
          CAD PART 3: GARTER SAFETY PIN BLUEPRINT
        </text>
        <text x={viewBoxW - 12} y="16" textAnchor="end" fill="#94a3b8" fontSize="7" fontFamily="monospace">
          {isFitted ? `${typeTitle} • Ø${pinDia}mm × ${pinLen}mm` : 'GARTER PIN OMITTED'}
        </text>

        {/* Divider */}
        <line x1="165" y1="26" x2="165" y2={viewBoxH - 16} stroke="#334155" strokeWidth="0.8" strokeDasharray="4 4" />

        {/* LEFT: PRECISION PIN DRAWING */}
        {isFitted ? (
          <g id="pin-detail-vector">
            {pinType === 'hairpin_r_clip' ? (
              /* HAIRPIN R-CLIP DRAWING */
              <>
                {/* Upper Loop */}
                <circle cx={pinCX} cy={pinCY - 34} r="11" fill="none" stroke="#eab308" strokeWidth={Math.max(2.4, pinDia * 0.85)} />
                <circle cx={pinCX} cy={pinCY - 34} r="5" fill="#060c18" stroke="#a16207" strokeWidth="1" />
                {/* Straight Through Prong */}
                <line
                  x1={pinCX - 3}
                  y1={pinCY - 23}
                  x2={pinCX - 3}
                  y2={pinCY + 36}
                  stroke="#fbbf24"
                  strokeWidth={Math.max(2.2, pinDia * 0.85)}
                  strokeLinecap="round"
                />
                {/* Spring Retention Curved Wave */}
                <path
                  d={`M ${pinCX + 3} ${pinCY - 23} Q ${pinCX + 18} ${pinCY - 5} ${pinCX + 5} ${pinCY + 10} Q ${pinCX + 18} ${pinCY + 25} ${pinCX + 8} ${pinCY + 34}`}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={Math.max(2.2, pinDia * 0.85)}
                  strokeLinecap="round"
                />
                <text x={pinCX} y={pinCY + 54} textAnchor="middle" fill="#fbbf24" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
                  Quick-Release Spring Retainer Wave
                </text>
              </>
            ) : pinType === 'through_bolt_locknut' ? (
              /* THROUGH BOLT & NYLON LOCKNUT DRAWING */
              <>
                {/* Hex Bolt Head */}
                <rect x={pinCX - 14} y={pinCY - 38} width="28" height="10" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1.2" />
                <line x1={pinCX - 5} y1={pinCY - 38} x2={pinCX - 5} y2={pinCY - 28} stroke="#94a3b8" strokeWidth="1" />
                <line x1={pinCX + 5} y1={pinCY - 38} x2={pinCX + 5} y2={pinCY - 28} stroke="#94a3b8" strokeWidth="1" />
                {/* Threaded Bolt Shank */}
                <rect x={pinCX - 3.5} y={pinCY - 28} width="7" height="60" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
                {/* Threads */}
                {[-10, -5, 0, 5, 10, 15, 20].map(off => (
                  <line key={off} x1={pinCX - 3.5} y1={pinCY + off} x2={pinCX + 3.5} y2={pinCY + off + 2} stroke="#334155" strokeWidth="1" />
                ))}
                {/* Hex Locknut with blue nylon insert */}
                <rect x={pinCX - 12} y={pinCY + 22} width="24" height="14" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1.2" />
                <rect x={pinCX - 10} y={pinCY + 32} width="20" height="4" rx="1" fill="#3b82f6" />
                <text x={pinCX} y={pinCY + 54} textAnchor="middle" fill="#fbbf24" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
                  Vibration-Proof Nylon Insert Nut
                </text>
              </>
            ) : (
              /* STANDARD DIN 94 SPLIT COTTER PIN DRAWING */
              <>
                {/* Eyelet loop */}
                <circle cx={pinCX} cy={pinCY - 35} r="12" fill="none" stroke="#eab308" strokeWidth={Math.max(2.5, pinDia * 0.9)} />
                <circle cx={pinCX} cy={pinCY - 35} r="6" fill="#060c18" stroke="#a16207" strokeWidth="1" />

                {/* Straight leg */}
                <line
                  x1={pinCX - 2.5}
                  y1={pinCY - 23}
                  x2={pinCX - 2.5}
                  y2={pinCY + 36}
                  stroke="#fbbf24"
                  strokeWidth={Math.max(2.2, pinDia * 0.85)}
                  strokeLinecap="round"
                />
                {/* Split / flare leg with safety retention bend */}
                <path
                  d={`M ${pinCX + 2.5} ${pinCY - 23} L ${pinCX + 2.5} ${pinCY + 22} L ${pinCX + 14} ${pinCY + 38}`}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={Math.max(2.2, pinDia * 0.85)}
                  strokeLinecap="round"
                />
                <text x={pinCX} y={pinCY + 54} textAnchor="middle" fill="#fbbf24" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
                  15° Safety Retention Split Flare
                </text>
              </>
            )}

            {/* Dimension: Eyelet Loop Diameter */}
            <line x1={pinCX - 16} y1={pinCY - 35} x2={pinCX - 24} y2={pinCY - 35} stroke="#38bdf8" strokeWidth="0.8" />
            <text x={pinCX - 28} y={pinCY - 33} textAnchor="end" fill="#38bdf8" fontSize="6" fontFamily="monospace">
              Head Ø{(pinDia * 3.5).toFixed(1)}mm
            </text>

            {/* Dimension: Pin Diameter */}
            <line x1={pinCX + 16} y1={pinCY} x2={pinCX + 28} y2={pinCY} stroke="#38bdf8" strokeWidth="0.8" />
            <text x={pinCX + 32} y={pinCY + 2} fill="#38bdf8" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
              Body: Ø {pinDia} mm
            </text>

            {/* Dimension: Total Length */}
            <line x1={pinCX - 36} y1={pinCY - 35} x2={pinCX - 36} y2={pinCY + 36} stroke="#f59e0b" strokeWidth="1" />
            <line x1={pinCX - 40} y1={pinCY - 35} x2={pinCX - 32} y2={pinCY - 35} stroke="#f59e0b" strokeWidth="1" />
            <line x1={pinCX - 40} y1={pinCY + 36} x2={pinCX - 32} y2={pinCY + 36} stroke="#f59e0b" strokeWidth="1" />
            <text x={pinCX - 42} y={pinCY + 2} textAnchor="end" fill="#f59e0b" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
              L = {pinLen} mm
            </text>
          </g>
        ) : (
          /* OMITTED STATE */
          <g id="pin-omitted-vector">
            <rect x={pinCX - 50} y={pinCY - 28} width="100" height="56" rx="8" fill="#0b1320" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
            <text x={pinCX} y={pinCY - 4} textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace" fontWeight="bold">
              [GARTER PIN OMITTED]
            </text>
            <text x={pinCX} y={pinCY + 12} textAnchor="middle" fill="#f59e0b" fontSize="6" fontFamily="monospace">
              Direct Bolt Assembly Only
            </text>
          </g>
        )}

        {/* RIGHT: TUBE INTERLOCK ENGAGEMENT VIEW */}
        <g id="pin-engagement-view">
          <text x="220" y="32" textAnchor="middle" fill="#38bdf8" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
            INTERLOCK ENGAGEMENT
          </text>

          {/* Tube Section showing slit and inserted pin */}
          <rect x="185" y={centerY - 28} width="70" height="56" rx="4" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
          {/* Internal bore */}
          <rect x="193" y={centerY - 22} width="54" height="44" rx="2" fill="#060c18" stroke="#0284c7" strokeWidth="1" strokeDasharray="3 2" />

          {/* Safety slit channel */}
          <rect x="217" y={centerY - 34} width="6" height="68" fill="#f59e0b" opacity="0.3" />
          <line x1="220" y1={centerY - 32} x2="220" y2={centerY + 32} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />

          {/* Inserted Garter Pin Locking through */}
          {isFitted ? (
            pinType === 'through_bolt_locknut' ? (
              <>
                <rect x="214" y={centerY - 36} width="12" height="4" rx="1" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8" />
                <line x1="220" y1={centerY - 32} x2="220" y2={centerY + 30} stroke="#cbd5e1" strokeWidth="2.5" />
                <rect x="214" y={centerY + 28} width="12" height="6" rx="1" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8" />
                <rect x="215" y={centerY + 32} width="10" height="2" fill="#3b82f6" />
              </>
            ) : pinType === 'hairpin_r_clip' ? (
              <>
                <circle cx="220" cy={centerY - 36} r="6" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
                <line x1="220" y1={centerY - 30} x2="220" y2={centerY + 32} stroke="#fbbf24" strokeWidth="2.5" />
                <path d={`M 226 ${centerY - 28} Q 235 ${centerY} 226 ${centerY + 26}`} fill="none" stroke="#fbbf24" strokeWidth="2" />
              </>
            ) : (
              <>
                <circle cx="220" cy={centerY - 36} r="7" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
                <line x1="220" y1={centerY - 29} x2="220" y2={centerY + 28} stroke="#fbbf24" strokeWidth="2.5" />
                {/* Split legs emerging */}
                <line x1="220" y1={centerY + 28} x2="214" y2={centerY + 36} stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="220" y1={centerY + 28} x2="226" y2={centerY + 36} stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
              </>
            )
          ) : (
            <text x="220" y={centerY + 4} textAnchor="middle" fill="#64748b" fontSize="6.5" fontFamily="monospace">
              Open Hole
            </text>
          )}

          {/* Legend Notes */}
          <text x="220" y={centerY + 48} textAnchor="middle" fill="#38bdf8" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
            {isFitted ? 'Locks Shackle to Downrod' : 'Standard Bolt Only'}
          </text>
          <text x="220" y={centerY + 57} textAnchor="middle" fill="#94a3b8" fontSize="5.5" fontFamily="monospace">
            {isFitted ? `Material: ${matName}` : 'No secondary pin fitted'}
          </text>
        </g>
      </svg>
    );
  }

  // -------------------------------------------------------------
  // VIEW MODE 4: EXPLODED CAD ASSEMBLY PROJECTION
  // -------------------------------------------------------------
  if (viewMode === 'exploded') {
    const centerXpl = viewBoxW / 2;
    const centerYpl = centerY;
    const rodW = 100;
    const rodH = Math.max(12, Math.min(48, pipeHeight));

    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
        className={`w-full h-full drop-shadow-[0_0_15px_rgba(56,189,248,0.18)] transition-all duration-300 ${className}`}
      >
        {sharedDefs}
        {/* Title */}
        <text x="12" y="16" fill="#38bdf8" fontSize="8" fontFamily="monospace" fontWeight="bold">
          EXPLODED ASSEMBLY CAD BLUEPRINT
        </text>
        <text x={viewBoxW - 12} y="16" textAnchor="end" fill="#f59e0b" fontSize="7" fontFamily="monospace">
          4-PART MODULAR FAN ROD SYSTEM
        </text>

        {/* Master Centerline Axis */}
        <line x1="10" y1={centerYpl} x2={viewBoxW - 10} y2={centerYpl} stroke="#0284c7" strokeWidth="0.8" strokeDasharray="6 3 2 3" opacity="0.6" />

        {/* PART 1: Top Shackle Clamp (Shifted Far Left) */}
        <g id="exploded-top-clamp">
          <line x1="58" y1={centerYpl} x2={centerXpl - rodW / 2} y2={centerYpl} stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" />
          <rect x="36" y={centerYpl - 16} width="18" height="32" rx="3" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
          <rect x="32" y={centerYpl - 22} width="5" height="8" rx="1" fill="#475569" stroke="#f59e0b" strokeWidth="1" />
          <rect x="32" y={centerYpl + 14} width="5" height="8" rx="1" fill="#475569" stroke="#f59e0b" strokeWidth="1" />
          <line x1="34.5" y1={centerYpl - 24} x2="34.5" y2={centerYpl + 24} stroke="#94a3b8" strokeWidth="1.5" />
          {/* Bubble 1 */}
          <circle cx="45" cy={centerYpl - 30} r="7" fill="#f59e0b" />
          <text x="45" y={centerYpl - 27.5} textAnchor="middle" fill="#000" fontSize="7" fontFamily="monospace" fontWeight="bold">1</text>
          <text x="45" y={centerYpl + 26} textAnchor="middle" fill="#f59e0b" fontSize="5.5" fontFamily="monospace" fontWeight="bold">
            Ceiling Shackle
          </text>
        </g>

        {/* PART 2: Main Steel Rod (Center) */}
        <g id="exploded-main-rod">
          <rect
            x={centerXpl - rodW / 2}
            y={centerYpl - rodH / 2}
            width={rodW}
            height={rodH}
            rx="2"
            fill={rodFill}
            stroke={strokeColor}
            strokeWidth="1.8"
          />
          <circle cx={centerXpl - rodW / 2 + 12} cy={centerYpl} r="3" fill="#060c18" stroke="#38bdf8" strokeWidth="1.2" />
          {/* Bubble 2 */}
          <circle cx={centerXpl} cy={centerYpl - rodH / 2 - 14} r="7" fill="#38bdf8" />
          <text x={centerXpl} y={centerYpl - rodH / 2 - 11.5} textAnchor="middle" fill="#000" fontSize="7" fontFamily="monospace" fontWeight="bold">2</text>
          <text x={centerXpl} y={centerYpl + rodH / 2 + 16} textAnchor="middle" fill="#38bdf8" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
            Main Tube: {specs.lengthInches}&quot; ({specs.diameterInches} OD)
          </text>
        </g>

        {/* PART 3: Garter Safety Pin (Elevated above hole) */}
        {specs.hasGarterPin !== false && (
          <g id="exploded-garter-pin">
            <line x1={centerXpl - rodW / 2 + 12} y1={centerYpl - 42} x2={centerXpl - rodW / 2 + 12} y2={centerYpl - 6} stroke="#eab308" strokeWidth="1.2" strokeDasharray="3 2" />
            <polygon points={`${centerXpl - rodW / 2 + 9},${centerYpl - 8} ${centerXpl - rodW / 2 + 15},${centerYpl - 8} ${centerXpl - rodW / 2 + 12},${centerYpl - 2}`} fill="#eab308" />
            <circle cx={centerXpl - rodW / 2 + 12} cy={centerYpl - 52} r="5" fill="none" stroke="#fbbf24" strokeWidth="2" />
            <line x1={centerXpl - rodW / 2 + 12} y1={centerYpl - 47} x2={centerXpl - rodW / 2 + 12} y2={centerYpl - 30} stroke="#fbbf24" strokeWidth="2" />
            <line x1={centerXpl - rodW / 2 + 12} y1={centerYpl - 30} x2={centerXpl - rodW / 2 + 16} y2={centerYpl - 24} stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
            {/* Bubble 3 */}
            <circle cx={centerXpl - rodW / 2 + 12} cy={centerYpl - 64} r="7" fill="#fbbf24" />
            <text x={centerXpl - rodW / 2 + 12} y={centerYpl - 61.5} textAnchor="middle" fill="#000" fontSize="7" fontFamily="monospace" fontWeight="bold">3</text>
            <text x={centerXpl - rodW / 2 + 30} y={centerYpl - 50} fill="#fbbf24" fontSize="5.5" fontFamily="monospace" fontWeight="bold">
              Garter Pin
            </text>
          </g>
        )}

        {/* PART 4: Bottom Motor Coupler (Shifted Far Right) */}
        <g id="exploded-bottom-coupler">
          <line x1={centerXpl + rodW / 2} y1={centerYpl} x2={viewBoxW - 58} y2={centerYpl} stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" />
          <rect x={viewBoxW - 56} y={centerYpl - 16} width="18" height="32" rx="3" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
          <rect x={viewBoxW - 43} y={centerYpl - 22} width="5" height="8" rx="1" fill="#475569" stroke="#f59e0b" strokeWidth="1" />
          <rect x={viewBoxW - 43} y={centerYpl + 14} width="5" height="8" rx="1" fill="#475569" stroke="#f59e0b" strokeWidth="1" />
          <line x1={viewBoxW - 40.5} y1={centerYpl - 24} x2={viewBoxW - 40.5} y2={centerYpl + 24} stroke="#94a3b8" strokeWidth="1.5" />
          <circle cx={viewBoxW - 48} cy={centerYpl - 4} r="2.5" fill="#0284c7" />
          <circle cx={viewBoxW - 48} cy={centerYpl + 4} r="2.5" fill="#0284c7" />
          {/* Bubble 4 */}
          <circle cx={viewBoxW - 47} cy={centerYpl - 30} r="7" fill="#f59e0b" />
          <text x={viewBoxW - 47} y={centerYpl - 27.5} textAnchor="middle" fill="#000" fontSize="7" fontFamily="monospace" fontWeight="bold">4</text>
          <text x={viewBoxW - 47} y={centerYpl + 26} textAnchor="middle" fill="#f59e0b" fontSize="5.5" fontFamily="monospace" fontWeight="bold">
            Motor Coupler
          </text>
        </g>
      </svg>
    );
  }

  // -------------------------------------------------------------
  // VIEW MODE 5: ONE COMPLETE CATALOG ASSEMBLED ROD (Default Full)
  // -------------------------------------------------------------
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
      className={`w-full h-full drop-shadow-[0_0_15px_rgba(56,189,248,0.18)] transition-all duration-300 ${className}`}
    >
      {sharedDefs}

      {/* Centerline Construction Axis */}
      <line
        x1="12"
        y1={centerY}
        x2={viewBoxW - 12}
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
        fill={rodFill}
        stroke={strokeColor}
        strokeWidth="1.8"
        className="opacity-95"
      />

      {/* Chamfer cuts if clamps are disabled */}
      {!specs.hasTopClamp && (
        <path
          d={`M ${startX} ${centerY - pipeHeight / 2} L ${startX + 4} ${centerY} L ${startX} ${centerY + pipeHeight / 2} Z`}
          fill="#38bdf8"
          opacity="0.35"
        />
      )}
      {!specs.hasBottomClamp && (
        <path
          d={`M ${startX + pipeWidth} ${centerY - pipeHeight / 2} L ${startX + pipeWidth - 4} ${centerY} L ${startX + pipeWidth} ${centerY + pipeHeight / 2} Z`}
          fill="#38bdf8"
          opacity="0.35"
        />
      )}

      {/* Machined Screw Threads on Rod (With Threads Option) */}
      {(specs.threadType === 'top_only' || specs.threadType === 'both_ends') && (
        <g id="svg-top-threads">
          <rect
            x={startX}
            y={centerY - pipeHeight / 2}
            width={24}
            height={pipeHeight}
            fill="url(#goldSheenOverlay)"
            stroke="#eab308"
            strokeWidth="1.2"
            className="opacity-90"
          />
          {[0, 3, 6, 9, 12, 15, 18, 21].map(offset => (
            <line
              key={offset}
              x1={startX + offset}
              y1={centerY - pipeHeight / 2}
              x2={startX + offset + 2.5}
              y2={centerY + pipeHeight / 2}
              stroke="#78350f"
              strokeWidth="1.2"
            />
          ))}
          <text
            x={startX + 12}
            y={centerY - pipeHeight / 2 - 5}
            textAnchor="middle"
            fill="#fbbf24"
            fontSize="6"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {specs.clampSize || specs.diameterInches} {specs.threadStandard || 'BSPT'}
          </text>
        </g>
      )}

      {(specs.threadType === 'bottom_only' || specs.threadType === 'both_ends') && (
        <g id="svg-bottom-threads">
          <rect
            x={startX + pipeWidth - 24}
            y={centerY - pipeHeight / 2}
            width={24}
            height={pipeHeight}
            fill="url(#goldSheenOverlay)"
            stroke="#eab308"
            strokeWidth="1.2"
            className="opacity-90"
          />
          {[0, 3, 6, 9, 12, 15, 18, 21].map(offset => (
            <line
              key={offset}
              x1={startX + pipeWidth - 24 + offset}
              y1={centerY - pipeHeight / 2}
              x2={startX + pipeWidth - 24 + offset + 2.5}
              y2={centerY + pipeHeight / 2}
              stroke="#78350f"
              strokeWidth="1.2"
            />
          ))}
          <text
            x={startX + pipeWidth - 12}
            y={centerY - pipeHeight / 2 - 5}
            textAnchor="middle"
            fill="#fbbf24"
            fontSize="6"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {specs.clampSize || specs.diameterInches} {specs.threadStandard || 'BSPT'}
          </text>
        </g>
      )}

      {/* Internal Wiring Conduit Channel */}
      {specs.hasWireConduit && (
        <>
          <line
            x1={startX + (specs.hasTopClamp ? 16 : 6)}
            y1={centerY - 4}
            x2={startX + pipeWidth - (specs.hasBottomClamp ? 16 : 6)}
            y2={centerY - 4}
            stroke="#38bdf8"
            strokeWidth="0.8"
            strokeDasharray="3 2"
            className="opacity-60"
          />
          <line
            x1={startX + (specs.hasTopClamp ? 16 : 6)}
            y1={centerY + 4}
            x2={startX + pipeWidth - (specs.hasBottomClamp ? 16 : 6)}
            y2={centerY + 4}
            stroke="#38bdf8"
            strokeWidth="0.8"
            strokeDasharray="3 2"
            className="opacity-60"
          />
        </>
      )}

      {/* Canopy Grommet Rings */}
      {specs.canopyRings && (
        <>
          <rect
            x={startX + 22}
            y={centerY - pipeHeight / 2 - 2}
            width="5"
            height={pipeHeight + 4}
            rx="1.5"
            fill="#334155"
            stroke="#64748b"
            strokeWidth="1"
          />
          <rect
            x={startX + pipeWidth - 28}
            y={centerY - pipeHeight / 2 - 2}
            width="5"
            height={pipeHeight + 4}
            rx="1.5"
            fill="#334155"
            stroke="#64748b"
            strokeWidth="1"
          />
        </>
      )}

      {/* TOP END: ATTACHED CLAMP OR BARE TUBE */}
      {specs.hasTopClamp ? (
        <g id="attached-top-clamp">
          <rect
            x={startX - 14}
            y={clampY}
            width="16"
            height={clampHeight}
            rx="3"
            fill="#1e293b"
            stroke="#f59e0b"
            strokeWidth="2"
          />
          {/* Clamp mounting flange ears & pinch bolt */}
          <rect
            x={startX - 16}
            y={centerY - clampEarOffset - 4}
            width="5"
            height="8"
            rx="1"
            fill="#475569"
            stroke="#f59e0b"
            strokeWidth="1"
          />
          <rect
            x={startX - 16}
            y={centerY + clampEarOffset - 4}
            width="5"
            height="8"
            rx="1"
            fill="#475569"
            stroke="#f59e0b"
            strokeWidth="1"
          />
          <line
            x1={startX - 13.5}
            y1={centerY - clampEarOffset - 6}
            x2={startX - 13.5}
            y2={centerY + clampEarOffset + 6}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
          {specs.topHoleCount > 0 && (
            <circle
              cx={startX - 6}
              cy={centerY}
              r={holeRadius}
              fill="#0b1320"
              stroke="#f59e0b"
              strokeWidth="1.4"
            />
          )}
          {specs.hasSafetySlit && (
            <line
              x1={startX + 4}
              y1={centerY - 10}
              x2={startX + 4}
              y2={centerY + 10}
              stroke="#f59e0b"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          )}
          {/* Clamp Size & Gauge Label */}
          <text
            x={startX - 6}
            y={clampY + clampHeight + 8}
            textAnchor="middle"
            fill="#f59e0b"
            fontSize="5.5"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {specs.clampSize || specs.diameterInches} ({specs.clampGauge ? specs.clampGauge.replace(' Gauge', 'G') : specs.gauge.replace(' Gauge', 'G')})
          </text>
        </g>
      ) : (
        <g id="bare-top-holes">
          {specs.topHoleCount > 0 && (
            <>
              <circle
                cx={startX + 10}
                cy={centerY}
                r={holeRadius}
                fill="#0b1320"
                stroke="#38bdf8"
                strokeWidth="1.4"
              />
              <line
                x1={startX + 10}
                y1={centerY - holeRadius - 2}
                x2={startX + 10}
                y2={centerY + holeRadius + 2}
                stroke="#38bdf8"
                strokeWidth="0.8"
              />
            </>
          )}
          {specs.hasSafetySlit && (
            <line
              x1={startX + 18}
              y1={centerY - 6}
              x2={startX + 18}
              y2={centerY + 6}
              stroke="#f59e0b"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          )}
        </g>
      )}

      {/* INSERTED GARTER / COTTER SAFETY PIN IN COMPLETE ASSEMBLY VIEW */}
      {specs.hasGarterPin !== false && (
        <g id="assembled-garter-pin">
          {specs.garterPinType === 'hairpin_r_clip' ? (
            <>
              {/* Hairpin R-Clip Head Loop */}
              <circle
                cx={startX - (specs.hasTopClamp ? 6 : -10)}
                cy={clampY - 8}
                r="4.5"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
              />
              {/* Straight pin shank passing through tube & clamp */}
              <line
                x1={startX - (specs.hasTopClamp ? 6 : -10)}
                y1={clampY - 3.5}
                x2={startX - (specs.hasTopClamp ? 6 : -10)}
                y2={clampY + clampHeight + 6}
                stroke="#fbbf24"
                strokeWidth="2"
              />
              {/* Curved R-spring retention wire clipping outer tube */}
              <path
                d={`M ${startX - (specs.hasTopClamp ? 2 : -14)} ${clampY - 5} Q ${startX - (specs.hasTopClamp ? 12 : -4)} ${centerY} ${startX - (specs.hasTopClamp ? 2 : -14)} ${clampY + clampHeight + 3}`}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.8"
              />
            </>
          ) : specs.garterPinType === 'through_bolt_locknut' ? (
            <>
              {/* Hex Bolt Head on Top */}
              <rect
                x={startX - (specs.hasTopClamp ? 10 : -6)}
                y={clampY - 7}
                width="8"
                height="4"
                rx="1"
                fill="#cbd5e1"
                stroke="#475569"
                strokeWidth="1"
              />
              {/* Bolt shank */}
              <line
                x1={startX - (specs.hasTopClamp ? 6 : -10)}
                y1={clampY - 3}
                x2={startX - (specs.hasTopClamp ? 6 : -10)}
                y2={clampY + clampHeight + 6}
                stroke="#e2e8f0"
                strokeWidth="2"
              />
              {/* Nylon Locknut at Bottom */}
              <rect
                x={startX - (specs.hasTopClamp ? 10 : -6)}
                y={clampY + clampHeight + 3}
                width="8"
                height="5"
                rx="1"
                fill="#cbd5e1"
                stroke="#475569"
                strokeWidth="1"
              />
              <rect
                x={startX - (specs.hasTopClamp ? 9 : -7)}
                y={clampY + clampHeight + 7}
                width="6"
                height="1.8"
                rx="0.5"
                fill="#3b82f6"
              />
            </>
          ) : (
            <>
              {/* Standard DIN 94 Split Cotter Pin */}
              <circle
                cx={startX - (specs.hasTopClamp ? 6 : -10)}
                cy={clampY - 8}
                r="4.5"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.8"
              />
              <circle
                cx={startX - (specs.hasTopClamp ? 6 : -10)}
                cy={clampY - 8}
                r="2"
                fill="#060c18"
              />
              {/* Pin main shank passing down through the tube & clamp */}
              <line
                x1={startX - (specs.hasTopClamp ? 6 : -10)}
                y1={clampY - 3.5}
                x2={startX - (specs.hasTopClamp ? 6 : -10)}
                y2={clampY + clampHeight + 4}
                stroke="#fbbf24"
                strokeWidth="1.8"
              />
              {/* Flared split retention legs emerging at the bottom */}
              <line
                x1={startX - (specs.hasTopClamp ? 6 : -10)}
                y1={clampY + clampHeight + 4}
                x2={startX - (specs.hasTopClamp ? 11 : -15)}
                y2={clampY + clampHeight + 11}
                stroke="#fbbf24"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <line
                x1={startX - (specs.hasTopClamp ? 6 : -10)}
                y1={clampY + clampHeight + 4}
                x2={startX - (specs.hasTopClamp ? 3 : -7)}
                y2={clampY + clampHeight + 11}
                stroke="#fbbf24"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </>
          )}
        </g>
      )}

      {/* BOTTOM END: ATTACHED COUPLER CLAMP OR BARE TUBE */}
      {specs.hasBottomClamp ? (
        <g id="attached-bottom-clamp">
          <rect
            x={startX + pipeWidth - 2}
            y={clampY}
            width="18"
            height={clampHeight}
            rx="3"
            fill="#1e293b"
            stroke="#f59e0b"
            strokeWidth="2"
          />
          <rect
            x={startX + pipeWidth + 11}
            y={centerY - clampEarOffset - 4}
            width="5"
            height="8"
            rx="1"
            fill="#475569"
            stroke="#f59e0b"
            strokeWidth="1"
          />
          <rect
            x={startX + pipeWidth + 11}
            y={centerY + clampEarOffset - 4}
            width="5"
            height="8"
            rx="1"
            fill="#475569"
            stroke="#f59e0b"
            strokeWidth="1"
          />
          <line
            x1={startX + pipeWidth + 13.5}
            y1={centerY - clampEarOffset - 6}
            x2={startX + pipeWidth + 13.5}
            y2={centerY + clampEarOffset + 6}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
          {specs.bottomHoleCount >= 1 && (
            <circle
              cx={startX + pipeWidth + 6}
              cy={specs.bottomHoleCount === 2 ? centerY - 5 : centerY}
              r={holeRadius}
              fill="#0b1320"
              stroke="#f59e0b"
              strokeWidth="1.4"
            />
          )}
          {specs.bottomHoleCount === 2 && (
            <circle
              cx={startX + pipeWidth + 6}
              cy={centerY + 5}
              r={holeRadius}
              fill="#0b1320"
              stroke="#f59e0b"
              strokeWidth="1.4"
            />
          )}
          {/* Coupler Size Label */}
          <text
            x={startX + pipeWidth + 7}
            y={clampY + clampHeight + 8}
            textAnchor="middle"
            fill="#f59e0b"
            fontSize="5.5"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {specs.clampSize || specs.diameterInches} Coupler ({specs.clampGauge ? specs.clampGauge.replace(' Gauge', 'G') : specs.gauge.replace(' Gauge', 'G')})
          </text>
        </g>
      ) : (
        <g id="bare-bottom-holes">
          {specs.bottomHoleCount >= 1 && (
            <circle
              cx={startX + pipeWidth - 10}
              cy={specs.bottomHoleCount === 2 ? centerY - 4 : centerY}
              r={holeRadius}
              fill="#0b1320"
              stroke="#38bdf8"
              strokeWidth="1.4"
            />
          )}
          {specs.bottomHoleCount === 2 && (
            <circle
              cx={startX + pipeWidth - 10}
              cy={centerY + 4}
              r={holeRadius}
              fill="#0b1320"
              stroke="#38bdf8"
              strokeWidth="1.4"
            />
          )}
        </g>
      )}

      {/* Falcon Logo Insignia */}
      <image
        href="/falcon-theme-rod-logo.svg"
        x={startX + pipeWidth / 2 - 12}
        y={centerY - 8}
        width="24"
        height="16"
        className="select-none opacity-85"
      />

      {/* CAD Dimension Callouts */}
      <line
        x1={startX - (specs.hasTopClamp ? 10 : 0)}
        y1={centerY + 34}
        x2={startX + pipeWidth + (specs.hasBottomClamp ? 12 : 0)}
        y2={centerY + 34}
        stroke="#f59e0b"
        strokeWidth="1.2"
      />
      <line
        x1={startX - (specs.hasTopClamp ? 10 : 0)}
        y1={centerY + 26}
        x2={startX - (specs.hasTopClamp ? 10 : 0)}
        y2={centerY + 42}
        stroke="#f59e0b"
        strokeWidth="1.2"
      />
      <line
        x1={startX + pipeWidth + (specs.hasBottomClamp ? 12 : 0)}
        y1={centerY + 26}
        x2={startX + pipeWidth + (specs.hasBottomClamp ? 12 : 0)}
        y2={centerY + 42}
        stroke="#f59e0b"
        strokeWidth="1.2"
      />
      <text
        x={viewBoxW / 2}
        y={centerY + 52}
        textAnchor="middle"
        fill="#f59e0b"
        fontSize="9.5"
        fontFamily="monospace"
        fontWeight="bold"
      >
        L = {specs.lengthInches}&quot; ({Math.round(specs.lengthInches * 25.4)} mm)
      </text>

      {/* Detailed Callouts for Interactive View */}
      {interactive && (
        <>
          <line
            x1={startX - 22}
            y1={centerY - pipeHeight / 2}
            x2={startX - 22}
            y2={centerY + pipeHeight / 2}
            stroke="#38bdf8"
            strokeWidth="1"
          />
          <line
            x1={startX - 26}
            y1={centerY - pipeHeight / 2}
            x2={startX - 18}
            y2={centerY - pipeHeight / 2}
            stroke="#38bdf8"
            strokeWidth="1"
          />
          <line
            x1={startX - 26}
            y1={centerY + pipeHeight / 2}
            x2={startX - 18}
            y2={centerY + pipeHeight / 2}
            stroke="#38bdf8"
            strokeWidth="1"
          />
          <text
            x={startX - 28}
            y={centerY + 3}
            textAnchor="end"
            fill="#38bdf8"
            fontSize="7"
            fontFamily="monospace"
            fontWeight="bold"
          >
            Ø {specs.diameterInches} ({formatDiameterMm(specs.diameterInches)}mm)
          </text>

          <text
            x={viewBoxW / 2}
            y="26"
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="8.5"
            fontFamily="monospace"
          >
            M.S. STEEL • {specs.gauge} • HOLE Ø{specs.holeSizeMm}mm
          </text>
        </>
      )}
    </svg>
  );
};

export const DesignBlueprintStudio: React.FC<DesignBlueprintStudioProps> = ({
  product,
  isOpen,
  onClose,
  onSaveBlueprint,
  onAddToCart,
  language = 'en',
  companyName = 'Falcon Rod Maker'
}) => {
  if (!isOpen || !product) return null;

  const [specs, setSpecs] = useState<RodBlueprintSpecs>(() => {
    return product.blueprintSpecs || defaultRodSpecs(product);
  });

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeTab, setActiveTab] = useState<'size' | 'clamps' | 'holes' | 'pipe' | 'cotter' | 'qa'>('size');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfExported, setPdfExported] = useState(false);

  const PRESET_LENGTHS = [1, 3, 6, 9, 12, 18, 20, 24, 30, 36, 48, 60, 72, 96, 120, 144, 180, 240];
  const GAUGE_OPTIONS = ['14 Gauge', '16 Gauge', '18 Gauge', '20 Gauge'];
  const DIAMETER_OPTIONS = STANDARD_DIAMETER_OPTIONS;
  const CLAMP_GAUGE_OPTIONS = ['12 Gauge', '14 Gauge', '16 Gauge', '18 Gauge', '20 Gauge'];
  const HOLE_SIZE_OPTIONS = [6, 8, 10, 12];

  const [diameterCategory, setDiameterCategory] = useState<'all' | 'small' | 'standard' | 'large'>('all');
  const [clampDiameterCategory, setClampDiameterCategory] = useState<'all' | 'small' | 'standard' | 'large'>('all');
  const [customDiameterInput, setCustomDiameterInput] = useState('');
  const [customClampSizeInput, setCustomClampSizeInput] = useState('');

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportRodBlueprintPDF({
        product,
        specs,
        companyName,
        svgElement: svgRef.current
      });
      setPdfExported(true);
      setTimeout(() => setPdfExported(false), 2500);
    } catch (err) {
      console.error('Failed to export blueprint PDF', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleSave = () => {
    onSaveBlueprint(product.id, specs);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
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
      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-sans">
      <div
        className="relative w-full max-w-5xl max-h-[94vh] flex flex-col rounded-2xl border border-[var(--steel-line)] bg-[var(--panel)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--steel-line)] bg-[var(--panel-raised)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <SlidersHorizontal size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight truncate">
                  Design Blueprint Studio
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase shrink-0">
                  {specs.rodType === 'pedestal' ? 'Pedestal Fan Rod' : 'Ceiling Fan Down-Rod'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold shrink-0">
                  {specs.lengthInches}&quot; ({Math.round(specs.lengthInches * 25.4)}mm)
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)] truncate mt-0.5 font-mono">
                Model: <span className="text-[var(--text)] font-semibold">{product.name}</span> · Live Blueprint Customizer
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

        {/* 2-Column Responsive Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-[var(--steel-line)]">
          
          {/* LEFT: LIVE SVG BLUEPRINT CANVAS */}
          <div className="lg:col-span-7 p-4 sm:p-6 flex flex-col justify-between bg-gradient-to-b from-[#060c18] via-[#091222] to-[#040810] relative">
            
            <div className="flex items-center justify-between text-xs font-mono text-[var(--text-dim)] mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-white uppercase text-[11px] tracking-wider">
                  Live CAD Vector Blueprint
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-[10px]">
                  OD: {specs.diameterInches} ({formatDiameterMm(specs.diameterInches)}mm)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                  {specs.gauge}
                </span>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500 hover:text-white font-mono text-[11px] font-bold transition active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Export CAD Blueprint & Technical Specs as PDF"
                >
                  {isExportingPdf ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : pdfExported ? (
                    <Check size={12} className="text-emerald-400" />
                  ) : (
                    <FileText size={12} />
                  )}
                  <span>{isExportingPdf ? 'Exporting...' : pdfExported ? 'PDF Saved!' : 'Export PDF'}</span>
                </button>
              </div>
            </div>

            {/* SVG Canvas Box with Millimeter Blueprint Grid */}
            <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-2xl bg-[#030712] border border-[#1e293b] flex items-center justify-center p-2 sm:p-4 overflow-hidden shadow-inner">
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

              <RodBlueprintSvgOverlay specs={specs} interactive={true} svgRef={svgRef} />

              {/* Status Overlay Badges */}
              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 font-mono text-[10px]">
                <span className="text-zinc-400">CLAMPS:</span>
                <span className={`font-bold ${
                  specs.hasTopClamp && specs.hasBottomClamp
                    ? 'text-emerald-400'
                    : !specs.hasTopClamp && !specs.hasBottomClamp
                    ? 'text-amber-400'
                    : 'text-sky-300'
                }`}>
                  {specs.hasTopClamp && specs.hasBottomClamp
                    ? 'Dual Clamps (Shackle + Coupler)'
                    : !specs.hasTopClamp && !specs.hasBottomClamp
                    ? 'Without Clamps (Bare Tube)'
                    : specs.hasTopClamp
                    ? 'Top Clamp Only'
                    : 'Bottom Clamp Only'}
                </span>
              </div>

              <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 font-mono text-[10px] text-sky-300">
                Hole Size: <span className="font-bold text-white">Ø {specs.holeSizeMm} mm</span>
              </div>
            </div>

            {/* Spec Footnote Summary */}
            <div className="mt-3 p-3 rounded-xl bg-[var(--panel-raised)]/60 border border-[var(--steel-line)] grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
              <div>
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Type</span>
                <span className="font-bold text-[var(--text)] capitalize">{specs.rodType}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Pipe Gauge</span>
                <span className="font-bold text-amber-400">{specs.gauge}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Outer Dia</span>
                <span className="font-bold text-sky-400">Ø {specs.diameterInches}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Threading</span>
                <span className="font-bold text-orange-400">
                  {specs.threadType === 'without_thread' || !specs.threadType
                    ? 'Without Thread'
                    : `With ${specs.threadStandard || 'BSPT'}`}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: SPECIFICATION TOGGLES & CONTROLS */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-[var(--panel)]">
            
            {/* Tabs */}
            <div className="flex border-b border-[var(--steel-line)] bg-[var(--panel-raised)]/70 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab('size')}
                className={`flex-1 py-3 px-2 font-bold text-center border-b-2 transition ${
                  activeTab === 'size'
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
                onClick={() => setActiveTab('pipe')}
                className={`flex-1 py-3 px-2 font-bold text-center border-b-2 transition ${
                  activeTab === 'pipe'
                    ? 'border-amber-400 text-amber-400 bg-[var(--panel)]'
                    : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                4. Gauge & Type
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cotter')}
                className={`flex-1 py-3 px-2 font-bold text-center border-b-2 transition ${
                  activeTab === 'cotter'
                    ? 'border-amber-400 text-amber-400 bg-[var(--panel)]'
                    : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                5. Cotter Pin
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('qa')}
                className={`flex-1 py-3 px-2 font-bold text-center border-b-2 transition ${
                  activeTab === 'qa'
                    ? 'border-amber-400 text-amber-400 bg-[var(--panel)]'
                    : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                6. QA & Specs
              </button>
            </div>

            {/* TAB CONTENTS */}
            <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto">
              
              {/* TAB 1: SIZE & DIAMETER */}
              {activeTab === 'size' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* PIPE LENGTH (1" - 240") */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-xs font-bold uppercase text-[var(--text)] font-mono block">
                          Pipe Length (Range: 1&quot; to 240&quot;)
                        </span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          {(specs.lengthInches / 12).toFixed(1)} feet · Standard or custom cut
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Direct Number Input */}
                        <div className="flex items-center rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] px-2 py-1">
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
                        <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold text-xs">
                          {Math.round(specs.lengthInches * 25.4)} mm
                          {specs.lengthInches >= 39.37 ? ` / ${(specs.lengthInches * 0.0254).toFixed(2)} m` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Stepper Buttons & Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSpecs(prev => ({ ...prev, lengthInches: Math.max(1, prev.lengthInches - 12) }))}
                          className="px-2 py-1 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-300 hover:text-white text-xs font-mono font-bold transition active:scale-95 cursor-pointer"
                          title="Minus 1 Foot (-12 inches)"
                        >
                          -12&quot;
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpecs(prev => ({ ...prev, lengthInches: Math.max(1, prev.lengthInches - 1) }))}
                          className="px-2 py-1 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-300 hover:text-white text-xs font-mono font-bold transition active:scale-95 cursor-pointer"
                          title="Minus 1 inch"
                        >
                          -1&quot;
                        </button>

                        <input
                          type="range"
                          min="1"
                          max="240"
                          step="1"
                          value={specs.lengthInches}
                          onChange={e => setSpecs(prev => ({ ...prev, lengthInches: Math.max(1, Math.min(240, parseInt(e.target.value, 10) || 1)) }))}
                          className="flex-1 accent-amber-400 cursor-pointer h-2 bg-[var(--panel)] rounded-lg"
                        />

                        <button
                          type="button"
                          onClick={() => setSpecs(prev => ({ ...prev, lengthInches: Math.min(240, prev.lengthInches + 1) }))}
                          className="px-2 py-1 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-300 hover:text-white text-xs font-mono font-bold transition active:scale-95 cursor-pointer"
                          title="Plus 1 inch"
                        >
                          +1&quot;
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpecs(prev => ({ ...prev, lengthInches: Math.min(240, prev.lengthInches + 12) }))}
                          className="px-2 py-1 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-300 hover:text-white text-xs font-mono font-bold transition active:scale-95 cursor-pointer"
                          title="Plus 1 Foot (+12 inches)"
                        >
                          +12&quot;
                        </button>
                      </div>

                      {/* Quick Length Chips Categorized */}
                      <div className="pt-1.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-dim)]">
                          <span>Quick Length Presets (1&quot; - 240&quot;):</span>
                          <span>{specs.lengthInches}&quot; selected</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                          {PRESET_LENGTHS.map(l => (
                            <button
                              key={l}
                              type="button"
                              onClick={() => setSpecs(prev => ({ ...prev, lengthInches: l }))}
                              className={`px-2 py-1 rounded text-xs font-mono transition cursor-pointer ${
                                specs.lengthInches === l
                                  ? 'bg-amber-400 text-black font-bold ring-2 ring-amber-300 shadow-sm'
                                  : 'bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                              }`}
                            >
                              {l}&quot;{l >= 36 ? ` (${(l / 12).toFixed(l % 12 === 0 ? 0 : 1)}ft)` : ''}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PIPE OUTER DIAMETER (1/8" - 3"+) */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <label className="text-xs font-mono font-bold uppercase text-[var(--text)] block">
                          Pipe Outer Diameter (OD: from 1/8&quot; upwards)
                        </label>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          Select standard bore or enter custom factory tooling diameter
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono font-bold text-xs">
                        Ø {specs.diameterInches} ({formatDiameterMm(specs.diameterInches)} mm)
                      </span>
                    </div>

                    {/* Filter Category Tabs */}
                    <div className="flex gap-1.5 p-1 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[11px] font-mono">
                      {[
                        { id: 'all', label: 'All Diameters (16)' },
                        { id: 'small', label: '1/8" - 5/8" (Thin)' },
                        { id: 'standard', label: '3/4" - 1-1/2" (Fan)' },
                        { id: 'large', label: '1-3/4" - 3" (Heavy)' }
                      ].map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setDiameterCategory(cat.id as any)}
                          className={`flex-1 py-1 px-1.5 rounded text-center transition cursor-pointer ${
                            diameterCategory === cat.id
                              ? 'bg-sky-500 text-black font-bold'
                              : 'text-[var(--text-dim)] hover:text-white'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Diameter Buttons Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {DIAMETER_OPTIONS.filter(dia => {
                        const inch = parseDiameterToInches(dia);
                        if (diameterCategory === 'small') return inch <= 0.625;
                        if (diameterCategory === 'standard') return inch >= 0.75 && inch <= 1.5;
                        if (diameterCategory === 'large') return inch >= 1.75;
                        return true;
                      }).map(dia => (
                        <button
                          key={dia}
                          type="button"
                          onClick={() => setSpecs(prev => ({
                            ...prev,
                            diameterInches: dia,
                            clampSize: prev.clampSize || dia
                          }))}
                          className={`p-2 rounded-xl border text-xs font-mono text-center transition cursor-pointer flex flex-col items-center justify-center ${
                            specs.diameterInches === dia
                              ? 'bg-sky-500/25 border-sky-400 text-sky-200 font-bold ring-2 ring-sky-400 shadow-md'
                              : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white hover:border-zinc-500'
                          }`}
                        >
                          <span className="text-xs font-bold">Ø {dia}</span>
                          <span className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            {formatDiameterMm(dia)} mm
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Custom Diameter Input */}
                    <div className="pt-2 border-t border-[var(--steel-line)] flex items-center gap-2">
                      <span className="text-xs font-mono text-[var(--text-dim)] shrink-0">Custom OD:</span>
                      <input
                        type="text"
                        placeholder="e.g. 1-3/4&quot;, 22mm, 1.2&quot;"
                        value={customDiameterInput}
                        onChange={e => setCustomDiameterInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-xs font-mono text-white focus:outline-none focus:border-sky-400"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customDiameterInput.trim()) {
                            const clean = customDiameterInput.trim().endsWith('"') ? customDiameterInput.trim() : `${customDiameterInput.trim()}"`;
                            setSpecs(prev => ({ ...prev, diameterInches: clean, clampSize: clean }));
                            setCustomDiameterInput('');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-sky-500 text-black font-mono font-bold text-xs hover:bg-sky-400 transition cursor-pointer"
                      >
                        Apply OD
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CLAMP TYPES & CONFIGURATION */}
              {activeTab === 'clamps' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Preset Toggles */}
                  <div>
                    <label className="text-xs font-mono font-bold uppercase text-[var(--text-dim)] block mb-1.5">
                      Toggle Clamp Presets (With or Without Clamps)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, hasTopClamp: true, hasBottomClamp: true }))}
                        className={`p-2.5 rounded-xl border text-xs font-bold font-mono transition text-left flex items-center justify-between cursor-pointer ${
                          specs.hasTopClamp && specs.hasBottomClamp
                            ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300 ring-1 ring-emerald-400'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        <div>
                          <span className="block">With Dual Clamps</span>
                          <span className="text-[10px] text-zinc-400 font-normal">Top shackle + motor coupler</span>
                        </div>
                        {specs.hasTopClamp && specs.hasBottomClamp && <Check size={14} className="text-emerald-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, hasTopClamp: false, hasBottomClamp: false }))}
                        className={`p-2.5 rounded-xl border text-xs font-bold font-mono transition text-left flex items-center justify-between cursor-pointer ${
                          !specs.hasTopClamp && !specs.hasBottomClamp
                            ? 'bg-amber-500/15 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        <div>
                          <span className="block">Without Clamps (Bare)</span>
                          <span className="text-[10px] text-zinc-400 font-normal">Hollow plain tube ends</span>
                        </div>
                        {!specs.hasTopClamp && !specs.hasBottomClamp && <Check size={14} className="text-amber-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, hasTopClamp: true, hasBottomClamp: false }))}
                        className={`p-2.5 rounded-xl border text-xs font-bold font-mono transition text-left flex items-center justify-between cursor-pointer ${
                          specs.hasTopClamp && !specs.hasBottomClamp
                            ? 'bg-sky-500/15 border-sky-400 text-sky-300 ring-1 ring-sky-400'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        <div>
                          <span className="block">Top Clamp Only</span>
                          <span className="text-[10px] text-zinc-400 font-normal">Ceiling hook shackle only</span>
                        </div>
                        {specs.hasTopClamp && !specs.hasBottomClamp && <Check size={14} className="text-sky-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, hasTopClamp: false, hasBottomClamp: true }))}
                        className={`p-2.5 rounded-xl border text-xs font-bold font-mono transition text-left flex items-center justify-between cursor-pointer ${
                          !specs.hasTopClamp && specs.hasBottomClamp
                            ? 'bg-sky-500/15 border-sky-400 text-sky-300 ring-1 ring-sky-400'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        <div>
                          <span className="block">Bottom Clamp Only</span>
                          <span className="text-[10px] text-zinc-400 font-normal">Motor shaft coupler only</span>
                        </div>
                        {!specs.hasTopClamp && specs.hasBottomClamp && <Check size={14} className="text-sky-400" />}
                      </button>
                    </div>
                  </div>

                  {/* Individual Clamp Switches */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[var(--text)] block font-mono">
                          Top Ceiling Shackle Collar
                        </span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          Locks onto ceiling hook shackle with pinch bolt
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, hasTopClamp: !prev.hasTopClamp }))}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                          specs.hasTopClamp ? 'bg-emerald-500 text-black' : 'bg-zinc-700 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {specs.hasTopClamp ? 'CLAMP ON' : 'BARE END'}
                      </button>
                    </div>

                    <div className="pt-2 border-t border-[var(--steel-line)] flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[var(--text)] block font-mono">
                          Bottom Motor Spindle Coupler
                        </span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          Locks onto fan rotor motor shaft with dual bolt pins
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, hasBottomClamp: !prev.hasBottomClamp }))}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                          specs.hasBottomClamp ? 'bg-emerald-500 text-black' : 'bg-zinc-700 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {specs.hasBottomClamp ? 'CLAMP ON' : 'BARE END'}
                      </button>
                    </div>
                  </div>

                  {/* Attached Clamp Size Selection (from 1/8" upwards) */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <label className="text-xs font-mono font-bold uppercase text-[var(--text)] block">
                          Clamp Bore Diameter (Clamp Size)
                        </label>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          Matching collar diameter fitted to the rod
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSpecs(prev => ({ ...prev, clampSize: prev.diameterInches }))}
                          className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-mono font-bold hover:bg-sky-500 hover:text-black transition cursor-pointer"
                          title="Set clamp bore size to match rod outer diameter"
                        >
                          Sync to Rod OD ({specs.diameterInches})
                        </button>
                        <span className="px-2.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono font-bold text-xs">
                          {specs.clampSize || specs.diameterInches}
                        </span>
                      </div>
                    </div>

                    {/* Filter Tabs for Clamp Sizes */}
                    <div className="flex gap-1 p-1 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[10px] font-mono">
                      {[
                        { id: 'all', label: 'All (16)' },
                        { id: 'small', label: '1/8" - 5/8"' },
                        { id: 'standard', label: '3/4" - 1-1/2"' },
                        { id: 'large', label: '1-3/4" - 3"' }
                      ].map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setClampDiameterCategory(cat.id as any)}
                          className={`flex-1 py-0.5 px-1 rounded text-center transition cursor-pointer ${
                            clampDiameterCategory === cat.id
                              ? 'bg-sky-500 text-black font-bold'
                              : 'text-[var(--text-dim)] hover:text-white'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {DIAMETER_OPTIONS.filter(dia => {
                        const inch = parseDiameterToInches(dia);
                        if (clampDiameterCategory === 'small') return inch <= 0.625;
                        if (clampDiameterCategory === 'standard') return inch >= 0.75 && inch <= 1.5;
                        if (clampDiameterCategory === 'large') return inch >= 1.75;
                        return true;
                      }).map(dia => (
                        <button
                          key={dia}
                          type="button"
                          onClick={() => setSpecs(prev => ({ ...prev, clampSize: dia }))}
                          className={`p-2 rounded-xl border text-xs font-mono text-center transition cursor-pointer flex flex-col items-center justify-center ${
                            (specs.clampSize || specs.diameterInches) === dia
                              ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold ring-1 ring-sky-400 shadow-xs'
                              : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                          }`}
                        >
                          <span className="font-bold">{dia}</span>
                          <span className="text-[10px] text-zinc-400">{formatDiameterMm(dia)} mm</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Attached Clamp Stamping Gauge */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono font-bold uppercase text-[var(--text)] block">
                        Clamp Stamping Thickness (Gauge)
                      </label>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">
                        {specs.clampGauge || '16 Gauge'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {CLAMP_GAUGE_OPTIONS.map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setSpecs(prev => ({ ...prev, clampGauge: g }))}
                          className={`p-2 rounded-xl border text-xs font-mono text-center transition cursor-pointer ${
                            (specs.clampGauge || '16 Gauge') === g
                              ? 'bg-amber-400 text-black font-bold border-amber-400 shadow-xs'
                              : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Threading Specification on Rod Ends (With Threads / Without Thread) */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <label className="font-bold uppercase text-[var(--text)]">
                        Threading Option (With Threads / Without Thread)
                      </label>
                      <span className="text-[11px] font-bold text-amber-400">
                        {specs.threadType === 'without_thread' || !specs.threadType
                          ? 'Without Thread (Plain)'
                          : `With Threads (${specs.threadStandard || 'BSPT'})`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, threadType: 'without_thread' }))}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                          specs.threadType === 'without_thread' || !specs.threadType
                            ? 'bg-amber-400 text-black font-bold border-amber-400 shadow-xs'
                            : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                        }`}
                      >
                        <div>
                          <span className="block font-bold">Without Thread</span>
                          <span className="text-[10px] text-zinc-500 font-normal">Smooth pipe / bolt through</span>
                        </div>
                        {(specs.threadType === 'without_thread' || !specs.threadType) && <Check size={14} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, threadType: 'both_ends' }))}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                          specs.threadType === 'both_ends'
                            ? 'bg-amber-400 text-black font-bold border-amber-400 shadow-xs'
                            : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                        }`}
                      >
                        <div>
                          <span className="block font-bold">With Threads (Both Ends)</span>
                          <span className="text-[10px] text-zinc-500 font-normal">Threaded top & bottom</span>
                        </div>
                        {specs.threadType === 'both_ends' && <Check size={14} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, threadType: 'top_only' }))}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                          specs.threadType === 'top_only'
                            ? 'bg-amber-400 text-black font-bold border-amber-400 shadow-xs'
                            : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                        }`}
                      >
                        <div>
                          <span className="block font-bold">Top Thread Only</span>
                          <span className="text-[10px] text-zinc-500 font-normal">Threaded into ceiling collar</span>
                        </div>
                        {specs.threadType === 'top_only' && <Check size={14} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, threadType: 'bottom_only' }))}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                          specs.threadType === 'bottom_only'
                            ? 'bg-amber-400 text-black font-bold border-amber-400 shadow-xs'
                            : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                        }`}
                      >
                        <div>
                          <span className="block font-bold">Bottom Thread Only</span>
                          <span className="text-[10px] text-zinc-500 font-normal">Threaded into fan motor</span>
                        </div>
                        {specs.threadType === 'bottom_only' && <Check size={14} />}
                      </button>
                    </div>

                    {/* Thread Standard Selector */}
                    {specs.threadType && specs.threadType !== 'without_thread' && (
                      <div className="pt-2 border-t border-[var(--steel-line)] flex items-center justify-between text-xs font-mono">
                        <span className="text-[var(--text-dim)]">Thread Standard:</span>
                        <div className="flex gap-1.5">
                          {(['BSPT', 'Metric', 'NPT'] as const).map(std => (
                            <button
                              key={std}
                              type="button"
                              onClick={() => setSpecs(prev => ({ ...prev, threadStandard: std }))}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                (specs.threadStandard || 'BSPT') === std
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-[var(--panel)] text-[var(--text-dim)] border border-[var(--steel-line)]'
                              }`}
                            >
                              {std}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: HOLE SIZES & SAFETY SLITS */}
              {activeTab === 'holes' && (
                <div className="space-y-4 animate-in fade-in duration-200">
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

                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3 text-xs font-mono">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="font-bold text-[var(--text)] block">Safety Cotter Pin Slit</span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          Secondary safety pin slot to prevent accidental uncoupling
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={specs.hasSafetySlit}
                        onChange={e => setSpecs(prev => ({ ...prev, hasSafetySlit: e.target.checked }))}
                        className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-[var(--steel-line)]">
                      <div>
                        <span className="font-bold text-[var(--text)] block">Wiring Conduit Channel</span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          Internal wiring passageway inside hollow tubular body
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={specs.hasWireConduit}
                        onChange={e => setSpecs(prev => ({ ...prev, hasWireConduit: e.target.checked }))}
                        className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 4: GAUGE & ROD TYPE */}
              {activeTab === 'pipe' && (
                <div className="space-y-4 animate-in fade-in duration-200">
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

                  {/* Threading Specification (With Threads / Without Thread) */}
                  <div className="pt-2 border-t border-[var(--steel-line)] space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <label className="font-bold uppercase text-[var(--text-dim)]">
                        Thread Specification (Machined Ends)
                      </label>
                      <span className="text-[10px] font-bold text-amber-400">
                        {specs.threadType === 'without_thread' || !specs.threadType
                          ? 'Without Thread'
                          : `With Threads (${specs.threadStandard || 'BSPT'})`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, threadType: 'without_thread' }))}
                        className={`p-2 rounded-lg border text-left flex items-center justify-between transition ${
                          specs.threadType === 'without_thread' || !specs.threadType
                            ? 'bg-amber-400 text-black font-bold border-amber-400 shadow-xs'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                        }`}
                      >
                        <span>Without Thread (Through-Bolt)</span>
                        {(specs.threadType === 'without_thread' || !specs.threadType) && <Check size={13} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, threadType: 'both_ends' }))}
                        className={`p-2 rounded-lg border text-left flex items-center justify-between transition ${
                          specs.threadType === 'both_ends'
                            ? 'bg-amber-400 text-black font-bold border-amber-400 shadow-xs'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                        }`}
                      >
                        <span>With Threads (Both Ends)</span>
                        {specs.threadType === 'both_ends' && <Check size={13} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, threadType: 'top_only' }))}
                        className={`p-2 rounded-lg border text-left flex items-center justify-between transition ${
                          specs.threadType === 'top_only'
                            ? 'bg-amber-400 text-black font-bold border-amber-400 shadow-xs'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                        }`}
                      >
                        <span>Top Thread Only (BSPT)</span>
                        {specs.threadType === 'top_only' && <Check size={13} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpecs(prev => ({ ...prev, threadType: 'bottom_only' }))}
                        className={`p-2 rounded-lg border text-left flex items-center justify-between transition ${
                          specs.threadType === 'bottom_only'
                            ? 'bg-amber-400 text-black font-bold border-amber-400 shadow-xs'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                        }`}
                      >
                        <span>Bottom Thread Only (BSPT)</span>
                        {specs.threadType === 'bottom_only' && <Check size={13} />}
                      </button>
                    </div>

                    {specs.threadType && specs.threadType !== 'without_thread' && (
                      <div className="pt-2 flex items-center justify-between text-xs font-mono">
                        <span className="text-[11px] text-[var(--text-dim)]">Thread Standard:</span>
                        <div className="flex gap-2">
                          {(['BSPT', 'Metric'] as const).map(std => (
                            <button
                              key={std}
                              type="button"
                              onClick={() => setSpecs(prev => ({ ...prev, threadStandard: std }))}
                              className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                                (specs.threadStandard || 'BSPT') === std
                                  ? 'bg-sky-400 text-black'
                                  : 'bg-zinc-800 text-zinc-300 hover:text-white'
                              }`}
                            >
                              {std === 'BSPT' ? 'BSPT (14 TPI Pipe Standard)' : 'Metric Fine (M25)'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: SAFETY COTTER / GARTER PIN */}
              {activeTab === 'cotter' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3 text-xs font-mono">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="font-bold text-[var(--text)] block">Include Safety Cotter / Garter Pin</span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          Secondary mechanical fastener to lock shackle bolt securely under rotational vibrations
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={specs.hasGarterPin ?? true}
                        onChange={e => setSpecs(prev => ({ ...prev, hasGarterPin: e.target.checked }))}
                        className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                      />
                    </label>

                    {(specs.hasGarterPin ?? true) && (
                      <div className="space-y-3 pt-2 border-t border-[var(--steel-line)]">
                        <div>
                          <span className="text-[10px] text-[var(--text-dim)] uppercase font-bold block mb-1">
                            Cotter Pin Type
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: 'split_cotter', label: 'Split Cotter Pin', desc: 'DIN 94 dual prong' },
                              { id: 'hairpin_r_clip', label: 'R-Clip Hairpin', desc: 'DIN 11024 spring wire' },
                              { id: 'through_bolt_locknut', label: 'Bolt & Locknut', desc: 'M6 Nyloc safety pair' }
                            ].map(pt => (
                              <button
                                key={pt.id}
                                type="button"
                                onClick={() => setSpecs(prev => ({ ...prev, garterPinType: pt.id as any }))}
                                className={`p-2 rounded-xl border text-left font-bold ${
                                  (specs.garterPinType || 'split_cotter') === pt.id
                                    ? 'bg-amber-400 text-black border-amber-400 shadow-sm'
                                    : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                                }`}
                              >
                                <span className="block text-xs">{pt.label}</span>
                                <span className="text-[9px] text-zinc-500 font-normal">{pt.desc}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] text-[var(--text-dim)] uppercase font-bold block mb-1">
                              Pin Diameter (mm)
                            </span>
                            <div className="grid grid-cols-4 gap-1">
                              {[2.5, 3.2, 4.0, 5.0].map(dia => (
                                <button
                                  key={dia}
                                  type="button"
                                  onClick={() => setSpecs(prev => ({ ...prev, garterPinDiameterMm: dia }))}
                                  className={`py-1.5 rounded-lg border text-center font-bold ${
                                    (specs.garterPinDiameterMm || 3.2) === dia
                                      ? 'bg-sky-400 text-black border-sky-400'
                                      : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                                  }`}
                                >
                                  Ø{dia}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] text-[var(--text-dim)] uppercase font-bold block mb-1">
                              Pin Length (mm)
                            </span>
                            <div className="grid grid-cols-4 gap-1">
                              {[35, 45, 55, 65].map(len => (
                                <button
                                  key={len}
                                  type="button"
                                  onClick={() => setSpecs(prev => ({ ...prev, garterPinLengthMm: len }))}
                                  className={`py-1.5 rounded-lg border text-center font-bold ${
                                    (specs.garterPinLengthMm || 45) === len
                                      ? 'bg-sky-400 text-black border-sky-400'
                                      : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                                  }`}
                                >
                                  {len}mm
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] text-[var(--text-dim)] uppercase font-bold block mb-1">
                            Pin Material Specification
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: 'zinc_plated_steel', label: 'Zinc Plated Steel' },
                              { id: 'stainless_steel', label: 'Stainless Steel 304' },
                              { id: 'brass', label: 'Corrosion-Resistant Brass' }
                            ].map(mat => (
                              <button
                                key={mat.id}
                                type="button"
                                onClick={() => setSpecs(prev => ({ ...prev, garterPinMaterial: mat.id as any }))}
                                className={`py-1.5 px-2 rounded-lg border text-center font-bold text-[11px] ${
                                  (specs.garterPinMaterial || 'zinc_plated_steel') === mat.id
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                                    : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                                }`}
                              >
                                {mat.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: QA, LOAD RATING & SPECS */}
              {activeTab === 'qa' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1.5">
                      <label className="font-bold uppercase text-[var(--text)] block">
                        CAD Drawing Revision
                      </label>
                      <select
                        value={specs.cadRevision || 'Rev A'}
                        onChange={e => setSpecs(prev => ({ ...prev, cadRevision: e.target.value }))}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-2 text-white"
                      >
                        <option value="Rev A">Rev A (Production Standard)</option>
                        <option value="Rev B">Rev B (Reinforced Clamping)</option>
                        <option value="Rev C">Rev C (Heavy Duty Certified)</option>
                      </select>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1.5">
                      <label className="font-bold uppercase text-[var(--text)] block">
                        Certified Safe Working Load
                      </label>
                      <select
                        value={specs.loadRatingKg || 35}
                        onChange={e => setSpecs(prev => ({ ...prev, loadRatingKg: parseInt(e.target.value, 10) }))}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-2 text-white"
                      >
                        <option value="25">25 kg (Lightweight Ceiling Fans)</option>
                        <option value="35">35 kg (Standard 56&quot; Fans)</option>
                        <option value="50">50 kg (Commercial Heavy Duty)</option>
                        <option value="75">75 kg (Industrial High-CFM)</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1.5 text-xs font-mono">
                    <label className="font-bold uppercase text-[var(--text)] block">
                      Lead Mechanical Engineer Sign-Off
                    </label>
                    <input
                      type="text"
                      value={specs.engineerSignOff || 'M. Bilal (Falcon Lead QA)'}
                      onChange={e => setSpecs(prev => ({ ...prev, engineerSignOff: e.target.value }))}
                      className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1.5 text-xs font-mono">
                    <label className="font-bold uppercase text-[var(--text)] block">
                      Workshop Blueprint Notes
                    </label>
                    <textarea
                      rows={2}
                      value={specs.notes || ''}
                      onChange={e => setSpecs(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="e.g. Ensure 80 micron electrostatic powder coat, deburr all bolt holes prior to painting"
                      className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Modal Actions */}
            <div className="p-4 border-t border-[var(--steel-line)] bg-[var(--panel-raised)] flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl border border-[var(--steel-line)] text-xs font-mono text-[var(--text-dim)] hover:text-white transition"
              >
                Close
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300 hover:bg-red-500 hover:text-white font-bold text-xs uppercase shadow transition active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Export CAD Blueprint & Technical Specs as PDF"
                >
                  {isExportingPdf ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : pdfExported ? (
                    <Check size={13} className="text-emerald-400" />
                  ) : (
                    <FileText size={13} />
                  )}
                  <span>{isExportingPdf ? 'Exporting...' : pdfExported ? 'PDF Saved!' : 'Export as PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 text-black font-bold text-xs uppercase shadow hover:bg-amber-300 transition active:scale-95 cursor-pointer"
                >
                  {saveSuccess ? <Check size={14} /> : <CheckCircle2 size={14} />}
                  <span>{saveSuccess ? 'Saved to Catalog!' : 'Save Specs to Card'}</span>
                </button>

                {onAddToCart && (
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold text-xs uppercase shadow hover:bg-emerald-400 transition active:scale-95 cursor-pointer"
                  >
                    <ShoppingCart size={14} />
                    <span>{cartSuccess ? 'Added to Order!' : 'Order Custom Spec'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
