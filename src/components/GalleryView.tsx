import React, { useState, useEffect } from 'react';
import {
  Images,
  Package,
  Layers,
  Sparkles,
  Search,
  ShoppingCart,
  Check,
  Eye,
  FileText,
  Printer,
  Sliders,
  Scale,
  Ruler,
  Info,
  ChevronRight,
  Plus,
  Compass,
  Download,
  Trash2,
  ExternalLink,
  FileSpreadsheet,
  Image as ImageIcon,
  Filter,
  Calendar,
  Clock,
  ArrowDownToLine,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Wrench,
  Share2,
  Maximize2,
  SlidersHorizontal,
  Save,
  FileDown,
  Settings2,
  Shield,
  Circle
} from 'lucide-react';
import { Product, AppLanguage, RecipeItem, ExportedItem, RodBlueprintSpecs } from '../types';
import { DesignBlueprintStudio, RodBlueprintSvgOverlay } from './DesignBlueprintStudio';
import { RodBlueprintStudioModal, defaultBlueprintSpecs } from './RodBlueprintStudioModal';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, parseDiameterToInches, formatDiameterMm, STANDARD_DIAMETER_OPTIONS } from '../utils/helpers';
import { exportRodBlueprintPDF } from '../utils/blueprintPdfExport';
import {
  getExportedItems,
  loadExportedItems,
  deleteExportedItem,
  clearAllExportedItems,
  subscribeToExports,
  exportBlueprintJPG,
  exportSingleTransactionJPG,
  triggerFileDownload
} from '../utils/exportManager';
import { triggerUniversalDownload, shareExportFile } from '../utils/universalDownloader';
import { getAllExportsFromIndexedDb } from '../utils/exportDb';
import { triggerHaptic } from '../utils/haptics';

interface GalleryViewProps {
  products: Product[];
  language: AppLanguage;
  companyName: string;
  initialTab?: 'catalog' | 'custom_designer' | 'exports';
  onAddToCart: (product: Product, color?: string, size?: string) => void;
  onNavigateToPos?: () => void;
  onSaveProduct?: (product: Product) => void;
}

// Technical fan down rod SVG engineering visualizer component
const FanRodWireframe: React.FC<{
  sizeInches?: number;
  colorName?: string;
  isInspecting?: boolean;
  wireGauge?: string;
  specs?: RodBlueprintSpecs;
  clampSize?: string;
  clampGauge?: string;
  threadType?: 'without_thread' | 'top_only' | 'bottom_only' | 'both_ends';
  threadStandard?: 'BSPT' | 'Metric' | 'None';
  hasTopClamp?: boolean;
  hasBottomClamp?: boolean;
}> = ({
  sizeInches: propSizeInches,
  colorName: propColorName,
  isInspecting = false,
  wireGauge: propWireGauge,
  specs,
  clampSize: propClampSize,
  clampGauge: propClampGauge,
  threadType: propThreadType,
  threadStandard: propThreadStandard,
  hasTopClamp: propHasTopClamp,
  hasBottomClamp: propHasBottomClamp,
}) => {
  const sizeInches = specs?.lengthInches ?? propSizeInches ?? 18;
  const colorName = specs?.finishColor ?? propColorName ?? 'Matt Black';
  const wireGauge = specs?.gauge ?? propWireGauge ?? '16 Gauge';
  const diameterInches = specs?.diameterInches ?? (specs?.rodType === 'pedestal' ? '1"' : '3/4"');
  const clampSize = specs?.clampSize ?? propClampSize ?? '3/4"';
  const clampGauge = specs?.clampGauge ?? propClampGauge ?? '16 Gauge';
  const threadType = specs?.threadType ?? propThreadType ?? 'without_thread';
  const threadStandard = specs?.threadStandard ?? propThreadStandard ?? 'BSPT';
  const hasTopClamp = specs ? specs.hasTopClamp : (propHasTopClamp !== undefined ? propHasTopClamp : true);
  const hasBottomClamp = specs ? specs.hasBottomClamp : (propHasBottomClamp !== undefined ? propHasBottomClamp : true);
  const holeSizeMm = specs?.holeSizeMm ?? 8;
  const topHoleCount = specs ? specs.topHoleCount : 1;
  const bottomHoleCount = specs ? specs.bottomHoleCount : 2;
  const hasSafetySlit = specs ? specs.hasSafetySlit : true;
  const hasWireConduit = specs ? specs.hasWireConduit : true;
  const canopyRings = specs ? specs.canopyRings : true;

  // Resolve color palette
  let strokeColor = '#38bdf8';
  let rodFill = 'url(#darkSheen)';
  if (colorName.toLowerCase().includes('black')) {
    strokeColor = colorName.toLowerCase().includes('shine') ? '#475569' : '#334155';
    rodFill = 'url(#darkSheen)';
  } else if (colorName.toLowerCase().includes('white')) {
    strokeColor = '#cbd5e1';
    rodFill = 'url(#whiteSheen)';
  } else if (colorName.toLowerCase().includes('silver') || colorName.toLowerCase().includes('grey') || colorName.toLowerCase().includes('zinc')) {
    strokeColor = '#94a3b8';
    rodFill = 'url(#silverSheen)';
  } else if (colorName.toLowerCase().includes('gold') || colorName.toLowerCase().includes('brass')) {
    strokeColor = '#fbbf24';
    rodFill = 'url(#goldSheen)';
  }

  // Visual length scaling clamped to viewBox (1" - 240")
  const clampedLen = Math.max(1, Math.min(240, sizeInches));
  const lenRatio = Math.log10(clampedLen) / Math.log10(240);
  const pipeWidth = Math.round(70 + lenRatio * 140);
  const diaIn = parseDiameterToInches(diameterInches);
  const pipeHeight = Math.max(9, Math.min(34, Math.round(9 + Math.sqrt(Math.max(0.1, diaIn) / 0.125) * 4.2)));
  const startX = (260 - pipeWidth) / 2;
  const centerY = 110;
  const holeRadius = Math.max(2.2, (holeSizeMm / 8) * 3.2);

  return (
    <div className={`relative flex items-center justify-center p-3 rounded-xl bg-gradient-to-b from-[#0b1320] to-[#040810] border border-[#1e293b] select-none ${isInspecting ? 'h-64 sm:h-80' : 'h-48'}`}>
      {/* Technical blueprint grid lines */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:12px_12px] opacity-40 rounded-xl" />

      {/* SVG Fan Down Rod Technical Drawing */}
      <svg
        viewBox="0 0 280 220"
        className="w-full h-full max-h-full drop-shadow-[0_0_15px_rgba(56,189,248,0.15)] transition-transform duration-300 hover:scale-105"
      >
        <defs>
          <linearGradient id="metalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="40%" stopColor="#0284c7" />
            <stop offset="60%" stopColor="#075985" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          <linearGradient id="darkSheen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="35%" stopColor="#1e293b" />
            <stop offset="65%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="whiteSheen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="35%" stopColor="#cbd5e1" />
            <stop offset="70%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="silverSheen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="35%" stopColor="#94a3b8" />
            <stop offset="65%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="goldSheen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="40%" stopColor="#eab308" />
            <stop offset="70%" stopColor="#a16207" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>
        </defs>

        {/* Centerline Construction Wire (Axis) */}
        <line
          x1="20"
          y1={centerY}
          x2="260"
          y2={centerY}
          stroke="#0284c7"
          strokeWidth="0.8"
          strokeDasharray="8 4 2 4"
          className="opacity-40"
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

        {/* Bare Pipe Cut Chamfers if clamps are omitted */}
        {!hasTopClamp && (
          <path
            d={`M ${startX} ${centerY - pipeHeight / 2} L ${startX + 4} ${centerY} L ${startX} ${centerY + pipeHeight / 2} Z`}
            fill="#38bdf8"
            opacity="0.3"
          />
        )}
        {!hasBottomClamp && (
          <path
            d={`M ${startX + pipeWidth} ${centerY - pipeHeight / 2} L ${startX + pipeWidth - 4} ${centerY} L ${startX + pipeWidth} ${centerY + pipeHeight / 2} Z`}
            fill="#38bdf8"
            opacity="0.3"
          />
        )}

        {/* Machined Screw Threads on Rod (With Threads Option) */}
        {(threadType === 'top_only' || threadType === 'both_ends') && (
          <g id="top-machined-threads">
            <rect
              x={startX}
              y={centerY - pipeHeight / 2}
              width={24}
              height={pipeHeight}
              fill="url(#goldSheen)"
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
              fontSize="6.5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {clampSize} {threadStandard}
            </text>
          </g>
        )}

        {(threadType === 'bottom_only' || threadType === 'both_ends') && (
          <g id="bottom-machined-threads">
            <rect
              x={startX + pipeWidth - 24}
              y={centerY - pipeHeight / 2}
              width={24}
              height={pipeHeight}
              fill="url(#goldSheen)"
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
              fontSize="6.5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {clampSize} {threadStandard}
            </text>
          </g>
        )}

        {/* Internal Wiring Conduit Channel (Dashed) */}
        {hasWireConduit && (
          <>
            <line
              x1={startX + (hasTopClamp ? 16 : 6)}
              y1={centerY - 4}
              x2={startX + pipeWidth - (hasBottomClamp ? 16 : 6)}
              y2={centerY - 4}
              stroke="#38bdf8"
              strokeWidth="0.8"
              strokeDasharray="3 2"
              className="opacity-60"
            />
            <line
              x1={startX + (hasTopClamp ? 16 : 6)}
              y1={centerY + 4}
              x2={startX + pipeWidth - (hasBottomClamp ? 16 : 6)}
              y2={centerY + 4}
              stroke="#38bdf8"
              strokeWidth="0.8"
              strokeDasharray="3 2"
              className="opacity-60"
            />
          </>
        )}

        {/* Left Side: Attached Ceiling Shackle Clamp Bracket OR Bare Pipe */}
        {hasTopClamp ? (
          <g id="attached-top-clamp">
            {/* Outer clamp collar wrapped around tube */}
            <rect
              x={startX - 14}
              y={centerY - 16}
              width="16"
              height="32"
              rx="3"
              fill="#1e293b"
              stroke="#f59e0b"
              strokeWidth="2"
            />
            {/* Clamp tightening flange ears & bolt */}
            <rect
              x={startX - 16}
              y={centerY - 22}
              width="5"
              height="8"
              rx="1"
              fill="#475569"
              stroke="#f59e0b"
              strokeWidth="1"
            />
            <rect
              x={startX - 16}
              y={centerY + 14}
              width="5"
              height="8"
              rx="1"
              fill="#475569"
              stroke="#f59e0b"
              strokeWidth="1"
            />
            {/* Pinch bolt line */}
            <line
              x1={startX - 13.5}
              y1={centerY - 24}
              x2={startX - 13.5}
              y2={centerY + 24}
              stroke="#94a3b8"
              strokeWidth="1.5"
            />
            {/* Retaining pin bore hole */}
            {topHoleCount > 0 && (
              <circle cx={startX - 6} cy={centerY} r={holeRadius} fill="#0b1320" stroke="#f59e0b" strokeWidth="1.4" />
            )}
            {hasSafetySlit && (
              <line x1={startX + 4} y1={centerY - 10} x2={startX + 4} y2={centerY + 10} stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
            )}
            {/* Clamp Size & Gauge Dimension Badge */}
            <text
              x={startX - 6}
              y={centerY + 27}
              textAnchor="middle"
              fill="#f59e0b"
              fontSize="6"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {clampSize} ({clampGauge.replace(' Gauge', 'G')})
            </text>
          </g>
        ) : (
          <g id="bare-top-holes">
            {topHoleCount > 0 && (
              <>
                <circle cx={startX + 10} cy={centerY} r={holeRadius} fill="#0b1320" stroke="#38bdf8" strokeWidth="1.4" />
                <line x1={startX + 10} y1={centerY - holeRadius - 2} x2={startX + 10} y2={centerY + holeRadius + 2} stroke="#38bdf8" strokeWidth="0.8" />
              </>
            )}
            {hasSafetySlit && (
              <line x1={startX + 18} y1={centerY - 6} x2={startX + 18} y2={centerY + 6} stroke="#f59e0b" strokeWidth="1.1" strokeLinecap="round" />
            )}
          </g>
        )}

        {/* Upper Canopy Seating Ring (Rubber Grommet) */}
        {canopyRings && (
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

        {/* Right Side: Attached Fan Motor Spindle Coupling Clamp OR Bare Pipe */}
        {hasBottomClamp ? (
          <g id="attached-bottom-clamp">
            {/* Motor Coupler Collar Body */}
            <rect
              x={startX + pipeWidth - 2}
              y={centerY - 16}
              width="18"
              height="32"
              rx="3"
              fill="#1e293b"
              stroke="#f59e0b"
              strokeWidth="2"
            />
            {/* Coupler pinch bolt ears */}
            <rect
              x={startX + pipeWidth + 11}
              y={centerY - 22}
              width="5"
              height="8"
              rx="1"
              fill="#475569"
              stroke="#f59e0b"
              strokeWidth="1"
            />
            <rect
              x={startX + pipeWidth + 11}
              y={centerY + 14}
              width="5"
              height="8"
              rx="1"
              fill="#475569"
              stroke="#f59e0b"
              strokeWidth="1"
            />
            {/* Pinch bolt rod */}
            <line
              x1={startX + pipeWidth + 13.5}
              y1={centerY - 24}
              x2={startX + pipeWidth + 13.5}
              y2={centerY + 24}
              stroke="#94a3b8"
              strokeWidth="1.5"
            />
            {/* Shaft socket hole */}
            {bottomHoleCount >= 1 && (
              <circle cx={startX + pipeWidth + 6} cy={bottomHoleCount === 2 ? centerY - 5 : centerY} r={holeRadius} fill="#0b1320" stroke="#f59e0b" strokeWidth="1.4" />
            )}
            {bottomHoleCount === 2 && (
              <circle cx={startX + pipeWidth + 6} cy={centerY + 5} r={holeRadius} fill="#0b1320" stroke="#f59e0b" strokeWidth="1.4" />
            )}
            {/* Clamp Size Label */}
            <text
              x={startX + pipeWidth + 7}
              y={centerY + 27}
              textAnchor="middle"
              fill="#f59e0b"
              fontSize="6"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {clampSize} Coupler
            </text>
          </g>
        ) : (
          <g id="bare-bottom-holes">
            {bottomHoleCount >= 1 && (
              <circle cx={startX + pipeWidth - 10} cy={bottomHoleCount === 2 ? centerY - 4 : centerY} r={holeRadius} fill="#0b1320" stroke="#38bdf8" strokeWidth="1.4" />
            )}
            {bottomHoleCount === 2 && (
              <circle cx={startX + pipeWidth - 10} cy={centerY + 4} r={holeRadius} fill="#0b1320" stroke="#38bdf8" strokeWidth="1.4" />
            )}
          </g>
        )}

        {/* Falcon Logo Insignia on Rod Body */}
        <image
          href="/falcon-theme-rod-logo.svg"
          x={126}
          y={centerY - 8}
          width="24"
          height="16"
          className="select-none opacity-85"
        />

        {/* CAD Dimension Callouts */}
        <line x1={startX - (hasTopClamp ? 14 : 0)} y1={centerY + 36} x2={startX + pipeWidth + (hasBottomClamp ? 16 : 0)} y2={centerY + 36} stroke="#f59e0b" strokeWidth="1.2" />
        <line x1={startX - (hasTopClamp ? 14 : 0)} y1={centerY + 28} x2={startX - (hasTopClamp ? 14 : 0)} y2={centerY + 44} stroke="#f59e0b" strokeWidth="1.2" />
        <line x1={startX + pipeWidth + (hasBottomClamp ? 16 : 0)} y1={centerY + 28} x2={startX + pipeWidth + (hasBottomClamp ? 16 : 0)} y2={centerY + 44} stroke="#f59e0b" strokeWidth="1.2" />
        <text x="140" y={centerY + 52} textAnchor="middle" fill="#f59e0b" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
          L = {sizeInches}&quot; ({Math.round(sizeInches * 25.4)} mm)
        </text>

        {isInspecting && (
          <>
            {/* Outer Diameter Measurement */}
            <line x1={startX - 24} y1={centerY - pipeHeight / 2} x2={startX - 24} y2={centerY + pipeHeight / 2} stroke="#38bdf8" strokeWidth="1" />
            <line x1={startX - 28} y1={centerY - pipeHeight / 2} x2={startX - 20} y2={centerY - pipeHeight / 2} stroke="#38bdf8" strokeWidth="1" />
            <line x1={startX - 28} y1={centerY + pipeHeight / 2} x2={startX - 20} y2={centerY + pipeHeight / 2} stroke="#38bdf8" strokeWidth="1" />
            <text x={startX - 30} y={centerY + 3} textAnchor="end" fill="#38bdf8" fontSize="8" fontFamily="monospace">
              Ø {diameterInches}
            </text>
            <text x="140" y="32" textAnchor="middle" fill="#94a3b8" fontSize="8.5" fontFamily="monospace">
              TUBE: {wireGauge} • CLAMP: {clampSize} ({clampGauge}) • HOLE Ø{holeSizeMm}mm
            </text>
          </>
        )}
      </svg>

      {/* Floating Specs Pill */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 font-mono text-[10px] text-zinc-300">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: strokeColor }} />
        <span>{sizeInches}&quot; Length</span>
      </div>

      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 font-mono text-[9px] text-sky-300 font-bold">
        {threadType === 'without_thread' ? 'Without Thread' : `With Threads (${threadStandard})`}
      </div>

      <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 font-mono text-[9px] font-bold">
        {hasTopClamp && hasBottomClamp ? (
          <span className="text-emerald-400">Dual Clamps ({clampSize})</span>
        ) : !hasTopClamp && !hasBottomClamp ? (
          <span className="text-amber-400">Bare Pipe (Without Clamps)</span>
        ) : hasTopClamp ? (
          <span className="text-sky-300">Top Clamp ({clampSize})</span>
        ) : (
          <span className="text-sky-300">Bottom Coupler ({clampSize})</span>
        )}
      </div>

      <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 font-mono text-[9px] text-amber-400 font-bold uppercase">
        {wireGauge} Pipe · {clampGauge.replace(' Gauge', 'G')} Clamp
      </div>
    </div>
  );
};

export const GalleryView: React.FC<GalleryViewProps> = ({
  products,
  language,
  companyName,
  initialTab = 'catalog',
  onAddToCart,
  onNavigateToPos,
  onSaveProduct
}) => {
  const [selectedCat, setSelectedCat] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartFeedback, setCartFeedback] = useState<number | null>(null);
  const [selectedColors, setSelectedColors] = useState<Record<number, string>>({});
  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<'catalog' | 'custom_designer' | 'exports'>(initialTab);
  const [customCartAdded, setCustomCartAdded] = useState(false);

  // Rod Blueprint Studio State
  const [blueprintStudioProduct, setBlueprintStudioProduct] = useState<Product | null>(null);
  const [customBlueprints, setCustomBlueprints] = useState<Record<number, RodBlueprintSpecs>>(() => {
    try {
      const saved = localStorage.getItem('falcon_rod_blueprints');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleSaveBlueprint = (productId: number, updatedSpecs: RodBlueprintSpecs) => {
    setCustomBlueprints(prev => {
      const updated = { ...prev, [productId]: updatedSpecs };
      try {
        localStorage.setItem('falcon_rod_blueprints', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save rod blueprint', e);
      }
      return updated;
    });

    if (onSaveProduct) {
      const found = products.find(p => p.id === productId);
      if (found) {
        onSaveProduct({
          ...found,
          blueprintSpecs: updatedSpecs
        });
      }
    }
  };

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Gallery Exports Archive State
  const [exportedItems, setExportedItems] = useState<ExportedItem[]>([]);
  const [exportFilterFormat, setExportFilterFormat] = useState<'all' | 'jpg' | 'pdf' | 'csv'>('all');
  const [exportFilterCategory, setExportFilterCategory] = useState<'all' | 'invoice' | 'report' | 'blueprint' | 'receipt'>('all');
  const [exportSearch, setExportSearch] = useState('');
  const [previewItem, setPreviewItem] = useState<ExportedItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ExportedItem | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [isExportingBlueprint, setIsExportingBlueprint] = useState(false);
  const [blueprintSuccess, setBlueprintSuccess] = useState(false);
  const [isGeneratingSampleJpg, setIsGeneratingSampleJpg] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [downloadFeedbackId, setDownloadFeedbackId] = useState<string | null>(null);
  const [sharingFeedbackId, setSharingFeedbackId] = useState<string | null>(null);

  const handleGenerateSampleJpg = async () => {
    try {
      setIsGeneratingSampleJpg(true);
      const demoTxn = {
        id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        factory: 'Royal Fan Works (Gujrat)',
        itemsSummary: '24" Heavy Duty Fan Rod (Matt Black) x 100 pcs\n18" Standard Fan Rod (Moon White) x 50 pcs',
        itemCount: 150,
        total: 185000,
        paid: true,
        confirmed: true,
        method: 'Bank Transfer / Meezan'
      };
      await exportSingleTransactionJPG({
        transaction: demoTxn,
        customerPayments: [],
        companyName
      });
      // Ensure exports filter is showing all or jpg
      if (exportFilterFormat !== 'all' && exportFilterFormat !== 'jpg') {
        setExportFilterFormat('all');
      }
    } catch (err) {
      console.error('Failed to generate sample JPG invoice', err);
    } finally {
      setIsGeneratingSampleJpg(false);
    }
  };

  // Keep exports in sync with IndexedDB, memory cache, and global export events
  useEffect(() => {
    // 1. Instant synchronous cache retrieval
    setExportedItems(getExportedItems());

    // 2. Hydrate full high-resolution data URLs from IndexedDB
    loadExportedItems().then(items => {
      if (items && items.length > 0) {
        setExportedItems(items);
      }
    });

    // 3. Listen for ongoing export recordings
    const unsubscribe = subscribeToExports(items => {
      setExportedItems(items);
      setPreviewItem(currentPreview => {
        if (!currentPreview) return null;
        const matching = items.find(i => i.id === currentPreview.id);
        return matching || currentPreview;
      });
    });
    return () => unsubscribe();
  }, []);

  // Comprehensive CAD Blueprint Designer & Specification State
  const [selectedCatalogProductId, setSelectedCatalogProductId] = useState<number | 'custom'>('custom');
  const [designerTab, setDesignerTab] = useState<'dimensions' | 'clamps' | 'holes' | 'threads' | 'cotter_pin' | 'finish_qa'>('dimensions');
  const [designerCadViewMode, setDesignerCadViewMode] = useState<'assembly' | 'rod' | 'clamps' | 'garter_pin' | 'exploded'>('assembly');
  const [customDiameterInput, setCustomDiameterInput] = useState<string>('');
  const [designerSaveSuccess, setDesignerSaveSuccess] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfSuccess, setPdfSuccess] = useState<boolean>(false);
  const designerSvgRef = React.useRef<SVGSVGElement | null>(null);

  // Core dimensional & engineering parameters
  const [calcDiameter, setCalcDiameter] = useState<number>(18);
  const [calcSpokes, setCalcSpokes] = useState<number>(12);
  const [calcGauge, setCalcGauge] = useState<string>('16 Gauge');
  const [calcColor, setCalcColor] = useState<string>('Matt Black');
  const [calcHasMono, setCalcHasMono] = useState<boolean>(true);
  const [calcClampSize, setCalcClampSize] = useState<string>('3/4"');
  const [calcClampGauge, setCalcClampGauge] = useState<string>('16 Gauge');
  const [calcThreadType, setCalcThreadType] = useState<'without_thread' | 'top_only' | 'bottom_only' | 'both_ends'>('without_thread');
  const [calcThreadStandard, setCalcThreadStandard] = useState<'BSPT' | 'Metric'>('BSPT');
  const [calcHasTopClamp, setCalcHasTopClamp] = useState<boolean>(true);
  const [calcHasBottomClamp, setCalcHasBottomClamp] = useState<boolean>(true);

  // Extended precision detail specifications
  const [calcRodType, setCalcRodType] = useState<'ceiling' | 'pedestal'>('ceiling');
  const [calcClampStyle, setCalcClampStyle] = useState<'standard' | 'heavy_duty' | 'ring_collar' | 'welded_flange' | 'telescopic_sleeve'>('standard');
  const [calcHoleSizeMm, setCalcHoleSizeMm] = useState<number>(8);
  const [calcTopHoleCount, setCalcTopHoleCount] = useState<number>(1);
  const [calcBottomHoleCount, setCalcBottomHoleCount] = useState<number>(2);
  const [calcTopHoleOffsetMm, setCalcTopHoleOffsetMm] = useState<number>(15);
  const [calcBottomHoleOffsetMm, setCalcBottomHoleOffsetMm] = useState<number>(25);
  const [calcSlitWidthMm, setCalcSlitWidthMm] = useState<number>(3.5);
  const [calcSlitLengthMm, setCalcSlitLengthMm] = useState<number>(18);
  const [calcHasWireConduit, setCalcHasWireConduit] = useState<boolean>(true);
  const [calcMaxWiringCables, setCalcMaxWiringCables] = useState<number>(4);
  const [calcCanopyRings, setCalcCanopyRings] = useState<boolean>(true);
  const [calcHasGarterPin, setCalcHasGarterPin] = useState<boolean>(true);
  const [calcGarterPinType, setCalcGarterPinType] = useState<'split_cotter' | 'hairpin_r_clip' | 'through_bolt_locknut'>('split_cotter');
  const [calcGarterPinDiameterMm, setCalcGarterPinDiameterMm] = useState<number>(3.2);
  const [calcGarterPinLengthMm, setCalcGarterPinLengthMm] = useState<number>(45);
  const [calcGarterPinMaterial, setCalcGarterPinMaterial] = useState<'zinc_plated_steel' | 'stainless_steel' | 'brass'>('zinc_plated_steel');
  const [calcClampBoltSize, setCalcClampBoltSize] = useState<'M6' | 'M8' | 'M10'>('M8');
  const [calcClampEarWidthMm, setCalcClampEarWidthMm] = useState<number>(22);
  const [calcCoatingType, setCalcCoatingType] = useState<'powder_coated' | 'liquid_enamel' | 'chrome_plated' | 'galvanized' | 'raw_primed'>('powder_coated');
  const [calcPipeEndCut, setCalcPipeEndCut] = useState<'square_deburred' | 'chamfer_45' | 'beveled' | 'slotted'>('square_deburred');
  const [calcToleranceMm, setCalcToleranceMm] = useState<number>(0.1);
  const [calcLoadRatingKg, setCalcLoadRatingKg] = useState<number>(35);
  const [calcCadRevision, setCalcCadRevision] = useState<string>('Rev A');
  const [calcEngineerSignOff, setCalcEngineerSignOff] = useState<string>('M. Bilal (Falcon Lead QA)');
  const [calcNotes, setCalcNotes] = useState<string>('Precision Fan Down Rod Manufacturing Specification Sheet');

  const currentBlueprintSpecs: RodBlueprintSpecs = {
    rodType: calcRodType,
    lengthInches: calcDiameter,
    diameterInches: calcClampSize,
    gauge: calcGauge,
    hasTopClamp: calcHasTopClamp,
    hasBottomClamp: calcHasBottomClamp,
    clampStyle: calcClampStyle,
    clampSize: calcClampSize,
    clampGauge: calcClampGauge,
    threadType: calcThreadType,
    threadStandard: calcThreadStandard,
    holeSizeMm: calcHoleSizeMm,
    topHoleCount: calcTopHoleCount,
    bottomHoleCount: calcBottomHoleCount,
    topHoleOffsetMm: calcTopHoleOffsetMm,
    bottomHoleOffsetMm: calcBottomHoleOffsetMm,
    hasSafetySlit: calcHasMono,
    slitWidthMm: calcSlitWidthMm,
    slitLengthMm: calcSlitLengthMm,
    hasWireConduit: calcHasWireConduit,
    maxWiringCables: calcMaxWiringCables,
    canopyRings: calcCanopyRings,
    hasGarterPin: calcHasGarterPin,
    garterPinType: calcGarterPinType,
    garterPinDiameterMm: calcGarterPinDiameterMm,
    garterPinLengthMm: calcGarterPinLengthMm,
    garterPinMaterial: calcGarterPinMaterial,
    clampBoltSize: calcClampBoltSize,
    clampEarWidthMm: calcClampEarWidthMm,
    coatingType: calcCoatingType,
    pipeEndCut: calcPipeEndCut,
    toleranceMm: calcToleranceMm,
    loadRatingKg: calcLoadRatingKg,
    cadRevision: calcCadRevision,
    engineerSignOff: calcEngineerSignOff,
    finishColor: calcColor,
    notes: calcNotes
  };

  const handleLoadProductIntoDesigner = (prodId: number | 'custom') => {
    setSelectedCatalogProductId(prodId);
    if (prodId === 'custom') {
      return;
    }
    const found = products.find(p => p.id === prodId);
    if (!found) return;

    const specs = found.blueprintSpecs;
    const sizeNum = parseInt(found.size || '18', 10) || 18;
    setCalcDiameter(specs?.lengthInches || sizeNum);
    setCalcColor(found.color || specs?.finishColor || 'Matt Black');
    setCalcGauge(found.gauge || specs?.gauge || '16 Gauge');
    if (specs) {
      setCalcRodType(specs.rodType || 'ceiling');
      setCalcClampSize(specs.clampSize || specs.diameterInches || '3/4"');
      setCalcClampGauge(specs.clampGauge || '16 Gauge');
      setCalcHasTopClamp(specs.hasTopClamp ?? true);
      setCalcHasBottomClamp(specs.hasBottomClamp ?? true);
      setCalcClampStyle(specs.clampStyle || 'standard');
      setCalcThreadType(specs.threadType || 'without_thread');
      setCalcThreadStandard((specs.threadStandard === 'Metric' ? 'Metric' : 'BSPT'));
      setCalcHoleSizeMm(specs.holeSizeMm || 8);
      setCalcTopHoleCount(specs.topHoleCount ?? 1);
      setCalcBottomHoleCount(specs.bottomHoleCount ?? 2);
      setCalcTopHoleOffsetMm(specs.topHoleOffsetMm ?? 15);
      setCalcBottomHoleOffsetMm(specs.bottomHoleOffsetMm ?? 25);
      setCalcSlitWidthMm(specs.slitWidthMm ?? 3.5);
      setCalcSlitLengthMm(specs.slitLengthMm ?? 18);
      setCalcHasMono(specs.hasSafetySlit ?? true);
      setCalcHasWireConduit(specs.hasWireConduit ?? true);
      setCalcCanopyRings(specs.canopyRings ?? true);
      setCalcHasGarterPin(specs.hasGarterPin ?? true);
      setCalcGarterPinType(specs.garterPinType || 'split_cotter');
      setCalcGarterPinDiameterMm(specs.garterPinDiameterMm || 3.2);
      setCalcGarterPinLengthMm(specs.garterPinLengthMm || 45);
      setCalcGarterPinMaterial(specs.garterPinMaterial || 'zinc_plated_steel');
      setCalcClampBoltSize(specs.clampBoltSize || 'M8');
      setCalcClampEarWidthMm(specs.clampEarWidthMm || 22);
      setCalcCoatingType(specs.coatingType || 'powder_coated');
      setCalcPipeEndCut(specs.pipeEndCut || 'square_deburred');
      setCalcToleranceMm(specs.toleranceMm || 0.1);
      setCalcLoadRatingKg(specs.loadRatingKg || 35);
      setCalcCadRevision(specs.cadRevision || 'Rev A');
      setCalcEngineerSignOff(specs.engineerSignOff || 'M. Bilal (Falcon Lead QA)');
      setCalcNotes(specs.notes || found.name);
    }
  };

  const handleSaveBlueprintToCatalog = (asNew: boolean = false) => {
    if (!onSaveProduct) return;
    
    if (asNew || selectedCatalogProductId === 'custom') {
      const newProd: Product = {
        id: Date.now(),
        name: `Fan Rod ${calcDiameter}" × Ø${calcClampSize} [${calcGauge.replace(' Gauge', 'G')} · ${calcColor}]`,
        price: estimatedWholesalePrice,
        cat: calcRodType === 'pedestal' ? 'Pedestal Extension Rod' : 'Ceiling Fan Down Rod',
        color: calcColor,
        size: `${calcDiameter}" × Ø${calcClampSize}`,
        gauge: calcGauge,
        weight: `${totalEstimatedWeightKg} kg`,
        stock: 25,
        reorderLevel: 5,
        blueprintSpecs: currentBlueprintSpecs
      };
      onSaveProduct(newProd);
      setSelectedCatalogProductId(newProd.id);
    } else {
      const found = products.find(p => p.id === selectedCatalogProductId);
      if (found) {
        const updated: Product = {
          ...found,
          size: `${calcDiameter}" × Ø${calcClampSize}`,
          gauge: calcGauge,
          color: calcColor,
          weight: `${totalEstimatedWeightKg} kg`,
          price: found.price || estimatedWholesalePrice,
          blueprintSpecs: currentBlueprintSpecs
        };
        onSaveProduct(updated);
      }
    }
    setDesignerSaveSuccess(true);
    setTimeout(() => setDesignerSaveSuccess(false), 2200);
  };

  const handleExportDesignerPDF = async () => {
    try {
      setIsExportingPdf(true);
      const prodForPdf: Product = {
        id: typeof selectedCatalogProductId === 'number' ? selectedCatalogProductId : Date.now(),
        name: typeof selectedCatalogProductId === 'number'
          ? (products.find(p => p.id === selectedCatalogProductId)?.name || `Falcon ${calcDiameter}" × Ø${calcClampSize} Down Rod (${calcColor})`)
          : `Falcon Fan Rod ${calcDiameter}" × Ø${calcClampSize} [${calcGauge.replace(' Gauge', 'G')} · ${calcColor}]`,
        price: estimatedWholesalePrice,
        cat: calcRodType === 'pedestal' ? 'Pedestal Extension Rod' : 'Ceiling Fan Down Rod',
        color: calcColor,
        size: `${calcDiameter}" × Ø${calcClampSize}`,
        gauge: calcGauge,
        weight: `${totalEstimatedWeightKg} kg`,
        blueprintSpecs: currentBlueprintSpecs
      };

      await exportRodBlueprintPDF({
        product: prodForPdf,
        specs: currentBlueprintSpecs,
        companyName,
        svgElement: designerSvgRef.current
      });
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to export blueprint PDF', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  // Filtered exports list
  const filteredExports = exportedItems.filter(item => {
    const matchFormat = exportFilterFormat === 'all' || item.format.toLowerCase() === exportFilterFormat.toLowerCase();
    const matchCategory = exportFilterCategory === 'all' || item.category.toLowerCase() === exportFilterCategory.toLowerCase();
    const q = exportSearch.trim().toLowerCase();
    const matchSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.fileName.toLowerCase().includes(q) ||
      (item.customerName && item.customerName.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q));
    return matchFormat && matchCategory && matchSearch;
  });

  const handleExportCustomBlueprintJPG = async () => {
    try {
      setIsExportingBlueprint(true);
      await exportBlueprintJPG({
        diameter: calcDiameter,
        spokes: calcSpokes,
        gauge: calcGauge,
        color: calcColor,
        hasMono: calcHasMono,
        weightKg: totalEstimatedWeightKg,
        price: estimatedWholesalePrice,
        companyName
      });
      setBlueprintSuccess(true);
      setTimeout(() => setBlueprintSuccess(false), 2500);
    } catch (err) {
      console.error('Error generating blueprint JPG', err);
    } finally {
      setIsExportingBlueprint(false);
    }
  };

  const handleExportProductBlueprintJPG = async (prod: Product) => {
    try {
      setIsExportingBlueprint(true);
      const sizeVal = parseInt(prod.size || '18', 10) || 18;
      const weightVal = parseFloat(prod.weight || '1.2') || 1.2;
      await exportBlueprintJPG({
        diameter: sizeVal,
        spokes: sizeVal >= 24 ? 16 : sizeVal >= 18 ? 12 : 8,
        gauge: '12 Gauge',
        color: prod.color || 'Black',
        hasMono: true,
        weightKg: weightVal,
        price: prod.price,
        companyName
      });
      setBlueprintSuccess(true);
      setTimeout(() => setBlueprintSuccess(false), 2500);
    } catch (err) {
      console.error('Error generating product blueprint JPG', err);
    } finally {
      setIsExportingBlueprint(false);
    }
  };

  const handleDeleteConfirmed = () => {
    if (itemToDelete) {
      deleteExportedItem(itemToDelete.id);
      if (previewItem?.id === itemToDelete.id) {
        setPreviewItem(null);
      }
      setItemToDelete(null);
    }
  };

  const handleClearAllConfirmed = () => {
    clearAllExportedItems();
    setPreviewItem(null);
    setShowClearAllConfirm(false);
  };

  const handleDownloadItem = async (item: ExportedItem) => {
    try {
      setDownloadFeedbackId(item.id);
      triggerHaptic('success');
      let dataUrl = item.dataUrl;
      if (!dataUrl) {
        const fullExports = await getAllExportsFromIndexedDb();
        const found = fullExports.find(i => i.id === item.id);
        if (found?.dataUrl) {
          dataUrl = found.dataUrl;
        }
      }

      await triggerUniversalDownload({
        fileName: item.fileName,
        content: dataUrl || `Falcon Rod Maker Export Archive\nDocument: ${item.title}\nFormat: ${item.format.toUpperCase()}\nCreated: ${item.createdAt}\n${item.description || ''}`,
        dataUrl,
        format: item.format,
        title: item.title
      });
      setTimeout(() => setDownloadFeedbackId(null), 2500);
    } catch (err) {
      console.warn('Download error:', err);
      setDownloadFeedbackId(null);
    }
  };

  const handleShareItem = async (item: ExportedItem) => {
    try {
      setSharingFeedbackId(item.id);
      triggerHaptic('click');
      let dataUrl = item.dataUrl;
      if (!dataUrl) {
        const fullExports = await getAllExportsFromIndexedDb();
        const found = fullExports.find(i => i.id === item.id);
        if (found?.dataUrl) {
          dataUrl = found.dataUrl;
        }
      }

      await shareExportFile({
        fileName: item.fileName,
        dataUrl,
        format: item.format,
        title: item.title,
        mimeType: item.format === 'jpg' ? 'image/jpeg' : item.format === 'pdf' ? 'application/pdf' : 'text/csv'
      });
      setTimeout(() => setSharingFeedbackId(null), 2500);
    } catch (err) {
      console.warn('Share error:', err);
      setSharingFeedbackId(null);
    }
  };

  // Categories extracted from products
  const categories = ['All', ...Array.from(new Set(products.map(p => p.cat).filter(Boolean)))];

  const filteredProducts = products.filter(p => {
    const matchCat = selectedCat === 'All' || p.cat === selectedCat;
    const matchQuery =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.cat && p.cat.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.color && p.color.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchQuery;
  });

  const handleAddWithFeedback = (product: Product) => {
    const chosenColor = selectedColors[product.id] || product.color;
    const chosenSize = selectedSizes[product.id] || product.size;
    onAddToCart(product, chosenColor, chosenSize);
    setCartFeedback(product.id);
    setTimeout(() => setCartFeedback(null), 1500);
  };

  // Physical engineering calculations for custom fan rod designer
  const diaInchesVal = parseDiameterToInches(calcClampSize);
  const diaMmVal = diaInchesVal * 25.4;
  const wallMmVal = calcGauge === '14 Gauge' ? 2.0 : calcGauge === '16 Gauge' ? 1.6 : calcGauge === '18 Gauge' ? 1.2 : 0.9;
  // Steel pipe weight: pi * (OD - t) * t * length * steel density (0.00000785 kg/mm3)
  const pipeWeightPerInchKg = Math.PI * Math.max(1, diaMmVal - wallMmVal) * wallMmVal * 25.4 * 0.00000785;
  const estimatedPipeWeightKg = Math.round((calcDiameter * pipeWeightPerInchKg) * 100) / 100;

  // Clamp weight scaled by clamp gauge and diameter size
  const clampUnitWeight =
    (calcClampGauge === '14 Gauge' ? 0.045 : calcClampGauge === '16 Gauge' ? 0.035 : 0.025) *
    Math.max(0.65, diaInchesVal / 0.75);
  const clampCount = (calcHasTopClamp ? 1 : 0) + (calcHasBottomClamp ? 1 : 0);
  const estimatedFittingsWeightKg = Math.round((clampCount * clampUnitWeight + (calcHasMono ? 0.02 : 0)) * 100) / 100;

  const totalEstimatedWeightKg = Math.round((estimatedPipeWeightKg + estimatedFittingsWeightKg) * 100) / 100;

  // Wholesale price taking into account pipe weight, clamp size, threading, and powder coating
  const threadCost = calcThreadType === 'both_ends' ? 65 : calcThreadType !== 'without_thread' ? 35 : 0;
  const clampBaseCost = clampCount * Math.round(18 + diaInchesVal * 16);
  const estimatedWholesalePrice = Math.round(estimatedPipeWeightKg * 290 + clampBaseCost + threadCost + 25);

  const currentBlueprintProduct: Product = {
    id: typeof selectedCatalogProductId === 'number' ? selectedCatalogProductId : Date.now(),
    name: typeof selectedCatalogProductId === 'number'
      ? (products.find(p => p.id === selectedCatalogProductId)?.name || `Falcon ${calcDiameter}" Down Rod (${calcColor})`)
      : `Falcon Fan Rod ${calcDiameter}" × Ø${calcClampSize} [${calcGauge.replace(' Gauge', 'G')} · ${calcColor}]`,
    price: estimatedWholesalePrice,
    cat: calcRodType === 'pedestal' ? 'Pedestal Extension Rod' : 'Ceiling Fan Down Rod',
    color: calcColor,
    size: `${calcDiameter}" × Ø${calcClampSize}`,
    gauge: calcGauge,
    weight: `${totalEstimatedWeightKg} kg`,
    stock: 25,
    reorderLevel: 5,
    blueprintSpecs: currentBlueprintSpecs
  };

  const handlePrintSpecSheet = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-[var(--text)]">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--steel-line)] pb-4 font-sans">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="bg-white rounded-xl p-1.5 px-2.5 shadow-xs border border-slate-200/80 shrink-0 hidden sm:flex items-center justify-center">
            <img
              src="/falcon-theme-rod-logo.svg"
              alt="Falcon Rod Maker"
              className="h-10 w-auto object-contain select-none animate-logo-glow"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[var(--yellow)] font-mono text-xs font-semibold uppercase tracking-wider mb-1">
              <Images size={16} />
              <span>Industrial Technical Showcase</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-[var(--text)]">
              Fan Rod Blueprint Gallery & Visual Catalog
            </h2>
            <p className="text-xs text-[var(--text-dim)] font-mono mt-0.5">
              Precision engineering specifications, tubular CAD wireframes, bills of materials, and manufacturing blueprints.
            </p>
          </div>
        </div>

        {/* View Toggle (Catalog vs Custom Rod Designer) */}
        <div className="flex items-center bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl p-1 gap-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
              activeTab === 'catalog'
                ? 'bg-[var(--yellow)] text-black shadow-sm'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <Package size={14} />
            <span>Finished Catalog</span>
          </button>
          {/* Button 2: Blueprint Designer (Selector 1) */}
          <button
            type="button"
            onClick={() => setActiveTab('custom_designer')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
              activeTab === 'custom_designer'
                ? 'bg-[var(--yellow)] text-black shadow-sm'
                : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)]'
            }`}
            title="In-Page Interactive CAD Blueprint Workshop: Edit rod dimensions, clamps, hole offsets, threading, cotter pins & materials with full technical details"
          >
            <Compass size={14} className={activeTab === 'custom_designer' ? 'text-black' : 'text-amber-400'} />
            <span>Blueprint Designer</span>
            <span className={`hidden md:inline-flex text-[9px] px-1.5 py-0.2 rounded font-sans font-semibold ${
              activeTab === 'custom_designer' ? 'bg-black/20 text-black' : 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
            }`}>
              Live CAD
            </span>
          </button>

          {/* Button 3: Blueprint Studio (Selector 2) */}
          <button
            type="button"
            onClick={() => {
              const currentProd: Product = typeof selectedCatalogProductId === 'number'
                ? products.find(p => p.id === selectedCatalogProductId) || filteredProducts[0] || products[0]
                : {
                    id: Date.now(),
                    name: `Falcon Fan Rod ${calcDiameter}" × Ø${calcClampSize} [${calcGauge.replace(' Gauge', 'G')} · ${calcColor}]`,
                    price: estimatedWholesalePrice,
                    cat: calcRodType === 'pedestal' ? 'Pedestal Extension Rod' : 'Ceiling Fan Down Rod',
                    color: calcColor,
                    size: `${calcDiameter}" × Ø${calcClampSize}`,
                    gauge: calcGauge,
                    weight: `${totalEstimatedWeightKg} kg`,
                    stock: 1,
                    reorderLevel: 5,
                    blueprintSpecs: currentBlueprintSpecs
                  };
              setBlueprintStudioProduct(currentProd);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition border border-amber-500/35 bg-amber-500/15 text-amber-300 hover:bg-amber-500 hover:text-black shadow-xs cursor-pointer active:scale-95"
            title="Open Fullscreen Interactive CAD Blueprint Studio Modal with orthographic engineering drawings, 3D exploded view, and PDF export"
          >
            <Wrench size={13} className="text-amber-400 group-hover:text-black" />
            <span>Blueprint Studio</span>
            <span className="hidden md:inline-flex text-[9px] px-1.5 py-0.2 rounded bg-amber-500/25 text-amber-200 font-sans font-semibold border border-amber-500/30">
              Modal
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('exports')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition relative ${
              activeTab === 'exports'
                ? 'bg-[var(--yellow)] text-black shadow-sm'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <ImageIcon size={14} />
            <span>Export Gallery</span>
            {exportedItems.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'exports'
                    ? 'bg-black text-[var(--yellow)]'
                    : 'bg-[var(--yellow)]/20 text-[var(--yellow)] border border-[var(--yellow)]/30'
                }`}
              >
                {exportedItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'catalog' && (
        <>
          {/* Controls bar: Search and Filter Pills */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search fan rods by name, size, or style..."
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--yellow)]"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCat(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap transition ${
                    selectedCat === cat
                      ? 'bg-[var(--yellow)] text-black font-bold shadow'
                      : 'bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProducts.map(product => {
              const customSpec = customBlueprints[product.id] || product.blueprintSpecs;
              const sizeVal = customSpec ? customSpec.lengthInches : (parseInt(product.size || '18', 10) || 18);
              const activeColor = customSpec?.finishColor || selectedColors[product.id] || product.color || 'Black';
              const isAdded = cartFeedback === product.id;

              return (
                <div
                  key={product.id}
                  className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-4 flex flex-col justify-between group hover:border-[var(--yellow)]/60 transition-all duration-200 shadow-sm"
                >
                  <div>
                    {/* Visual Wireframe Preview */}
                    <FanRodWireframe
                      sizeInches={sizeVal}
                      colorName={activeColor}
                      wireGauge={customSpec?.gauge || product.gauge || '16 Gauge'}
                      specs={customSpec}
                    />

                    {/* Metadata details */}
                    <div className="mt-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono font-semibold uppercase text-[var(--yellow)]">
                              {product.cat}
                            </span>
                            {customSpec && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase">
                                Custom Spec
                              </span>
                            )}
                          </div>
                          <h3 className="font-serif font-bold text-sm sm:text-base text-[var(--text)] group-hover:text-[var(--yellow)] transition-colors line-clamp-1">
                            {product.name}
                          </h3>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-sm sm:text-base text-emerald-400">
                            Rs {fmt(product.price)}
                          </span>
                          <span className="block text-[9px] text-[var(--text-dim)]">per piece</span>
                        </div>
                      </div>

                      {/* Specs Row */}
                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-[var(--steel-line)] text-center text-[10px] font-mono">
                        <div>
                          <span className="text-[var(--text-dim)] block">Length</span>
                          <span className="font-bold text-[var(--text)]">{customSpec ? `${customSpec.lengthInches}"` : product.size || '18"'}</span>
                        </div>
                        <div>
                          <span className="text-[var(--text-dim)] block">Clamps</span>
                          <span className={`font-bold ${
                            !customSpec || (customSpec.hasTopClamp && customSpec.hasBottomClamp)
                              ? 'text-emerald-400'
                              : !customSpec.hasTopClamp && !customSpec.hasBottomClamp
                              ? 'text-amber-400'
                              : 'text-sky-300'
                          }`}>
                            {!customSpec || (customSpec.hasTopClamp && customSpec.hasBottomClamp)
                              ? 'Dual Clamps'
                              : !customSpec.hasTopClamp && !customSpec.hasBottomClamp
                              ? 'Without Clamps'
                              : customSpec.hasTopClamp
                              ? 'Top Only'
                              : 'Bottom Only'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--text-dim)] block">Hole Size</span>
                          <span className="font-bold text-sky-400">
                            Ø {customSpec?.holeSizeMm || 8}mm
                          </span>
                        </div>
                      </div>

                      {/* Color Option Selector */}
                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <span className="text-[var(--text-dim)] text-[10px]">Color / Finish:</span>
                        <div className="flex items-center gap-1">
                          {['Shine Black', 'Matt Black', 'White', 'Silver'].map(clr => (
                            <button
                              key={clr}
                              type="button"
                              onClick={() => setSelectedColors(prev => ({ ...prev, [product.id]: clr }))}
                              title={clr}
                              className={`px-1.5 py-0.5 text-[9px] rounded border transition ${
                                activeColor === clr
                                  ? 'border-[var(--yellow)] bg-[var(--yellow)]/15 text-[var(--yellow)] font-bold'
                                  : 'border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                              }`}
                            >
                              {clr.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer with Edit Blueprint button */}
                  <div className="mt-4 pt-3 border-t border-[var(--steel-line)] flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setBlueprintStudioProduct(product)}
                      className="flex-1 min-w-[105px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs font-bold text-amber-300 hover:bg-amber-500 hover:text-black transition active:scale-95 shadow-xs cursor-pointer"
                      title="Open Rod Blueprint Studio: Edit length, clamps, holes, and dimensions"
                    >
                      <Wrench size={12} />
                      <span>Edit Blueprint</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="px-2.5 py-2 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-semibold text-[var(--text)] hover:border-[var(--yellow)] transition active:scale-95 cursor-pointer"
                      title="View full specification modal"
                    >
                      <Eye size={13} className="text-[var(--yellow)]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddWithFeedback(product)}
                      className={`flex-1 min-w-[95px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 shadow-sm cursor-pointer ${
                        isAdded
                          ? 'bg-emerald-500 text-white'
                          : 'bg-[var(--yellow)] text-black hover:brightness-110'
                      }`}
                    >
                      {isAdded ? <Check size={13} /> : <ShoppingCart size={13} />}
                      <span>{isAdded ? 'Added' : 'Order POS'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12 border border-dashed border-[var(--steel-line)] rounded-2xl p-6">
              <Images size={36} className="mx-auto text-[var(--text-dim)] mb-2 opacity-50" />
              <p className="text-sm font-semibold text-[var(--text)]">No Fan Rods Found</p>
              <p className="text-xs text-[var(--text-dim)] mt-1">Try selecting another category or clear the search query.</p>
            </div>
          )}
        </>
      )}

      {/* Custom Blueprint Fan Rod Designer / Estimator - Full CAD Engineering Workshop */}
      {activeTab === 'custom_designer' && (
        <div className="space-y-5">
          {/* Top Control Bar: Catalog Product Synchronizer & Quick Actions */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <SlidersHorizontal size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif font-black text-base sm:text-lg text-[var(--text)] tracking-tight">
                    CAD Blueprint Designer & Specification Workshop
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase">
                    {calcRodType === 'pedestal' ? 'Pedestal Fan Rod' : 'Ceiling Fan Down-Rod'}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
                    {calcDiameter}&quot; ({Math.round(calcDiameter * 25.4)}mm)
                  </span>
                </div>
                <p className="text-xs text-[var(--text-dim)] font-mono mt-0.5 truncate">
                  Full detail CAD engineering: Dimensions, Clamps, Hole Offsets, Lathe Threads, Cotter Pins & Material Specs
                </p>
              </div>
            </div>

            {/* Catalog Synchronizer & Studio Modal Launch */}
            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              <div className="flex items-center gap-1.5 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl px-2.5 py-1 text-xs font-mono">
                <span className="text-[var(--text-dim)] text-[11px] whitespace-nowrap">Load Model:</span>
                <select
                  value={selectedCatalogProductId}
                  onChange={e => {
                    const val = e.target.value === 'custom' ? 'custom' : parseInt(e.target.value, 10);
                    handleLoadProductIntoDesigner(val);
                  }}
                  className="bg-transparent text-[var(--yellow)] font-bold focus:outline-none cursor-pointer max-w-[160px] sm:max-w-[220px] truncate"
                >
                  <option value="custom" className="bg-zinc-900 text-white">✨ New Custom Specification</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                      {p.name} ({p.size || '18"'})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  const currentProd: Product = typeof selectedCatalogProductId === 'number'
                    ? products.find(p => p.id === selectedCatalogProductId) || currentBlueprintProduct
                    : currentBlueprintProduct;
                  setBlueprintStudioProduct(currentProd);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500 hover:text-black font-mono font-bold text-xs transition shadow-xs cursor-pointer active:scale-95"
                title="Launch Fullscreen CAD Blueprint Studio Modal"
              >
                <Maximize2 size={13} />
                <span className="hidden sm:inline">Fullscreen</span> Studio
              </button>
            </div>
          </div>

          {/* Main 2-Column Workshop: Detailed Tabs on Left, Live Vector Blueprint on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-4 sm:p-6">
            {/* LEFT COLUMN: 6 Detailed Engineering Tabs */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              {/* Tab Navigation Strip */}
              <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-mono font-bold">
                {[
                  { id: 'dimensions', label: '1. Dimensions & Tube', icon: Ruler },
                  { id: 'clamps', label: '2. Clamps', icon: Wrench },
                  { id: 'holes', label: '3. Holes & Slits', icon: Sliders },
                  { id: 'threads', label: '4. Lathe Threads', icon: Settings2 },
                  { id: 'cotter_pin', label: '5. Cotter Pin', icon: Shield },
                  { id: 'finish_qa', label: '6. Finish & QA', icon: Sparkles }
                ].map(t => {
                  const Icon = t.icon;
                  const isSel = designerTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDesignerTab(t.id as any)}
                      className={`flex-1 min-w-[110px] sm:min-w-0 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition text-[11px] cursor-pointer ${
                        isSel
                          ? 'bg-[var(--yellow)] text-black shadow-sm font-extrabold'
                          : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)]'
                      }`}
                    >
                      <Icon size={12} className={isSel ? 'text-black' : 'text-amber-400'} />
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: DIMENSIONS & TUBE GEOMETRY */}
              {designerTab === 'dimensions' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Application Type */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
                    <label className="text-[10px] uppercase text-[var(--text-dim)] font-mono font-bold block">
                      Application Type
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => {
                          setCalcRodType('ceiling');
                          setCalcClampSize('3/4"');
                          setCalcHasMono(true);
                          setCalcCanopyRings(true);
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                          calcRodType === 'ceiling'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold ring-1 ring-amber-400'
                            : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        <div>
                          <span className="block font-bold">Ceiling Fan Down-Rod</span>
                          <span className="text-[10px] text-zinc-400">Standard suspended ceiling installation</span>
                        </div>
                        {calcRodType === 'ceiling' && <Check size={14} className="text-amber-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCalcRodType('pedestal');
                          setCalcClampSize('1"');
                          setCalcHasMono(false);
                          setCalcCanopyRings(false);
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                          calcRodType === 'pedestal'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold ring-1 ring-amber-400'
                            : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        <div>
                          <span className="block font-bold">Pedestal Fan Extension Rod</span>
                          <span className="text-[10px] text-zinc-400">Heavy telescopic column / bracket tube</span>
                        </div>
                        {calcRodType === 'pedestal' && <Check size={14} className="text-amber-400" />}
                      </button>
                    </div>
                  </div>

                  {/* Pipe Length (1" to 240") */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
                      <div>
                        <span className="font-bold uppercase text-[var(--text)] block">
                          Pipe Length (Range: 1&quot; to 240&quot;)
                        </span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          {(calcDiameter / 12).toFixed(1)} feet · Standard or custom factory cut
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] px-2 py-1">
                          <input
                            type="number"
                            min="1"
                            max="240"
                            step="1"
                            value={calcDiameter}
                            onChange={e => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) setCalcDiameter(Math.max(1, Math.min(240, val)));
                            }}
                            className="w-14 bg-transparent text-right font-mono font-bold text-amber-300 text-sm focus:outline-none"
                          />
                          <span className="text-amber-300 font-mono font-bold text-sm ml-0.5">&quot;</span>
                        </div>
                        <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs">
                          {Math.round(calcDiameter * 25.4)} mm
                          {calcDiameter >= 39.37 ? ` / ${(calcDiameter * 0.0254).toFixed(2)}m` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Steppers & Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCalcDiameter(prev => Math.max(1, prev - 12))}
                          className="px-2.5 py-1 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-300 hover:text-white text-xs font-bold transition active:scale-95 cursor-pointer"
                          title="Minus 1 Foot (-12 inches)"
                        >
                          -12&quot;
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalcDiameter(prev => Math.max(1, prev - 1))}
                          className="px-2.5 py-1 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-300 hover:text-white text-xs font-bold transition active:scale-95 cursor-pointer"
                          title="Minus 1 inch"
                        >
                          -1&quot;
                        </button>

                        <input
                          type="range"
                          min="1"
                          max="240"
                          step="1"
                          value={calcDiameter}
                          onChange={e => setCalcDiameter(parseInt(e.target.value, 10) || 1)}
                          className="flex-1 accent-[var(--yellow)] cursor-pointer h-2 bg-[var(--panel)] rounded-lg"
                        />

                        <button
                          type="button"
                          onClick={() => setCalcDiameter(prev => Math.min(240, prev + 1))}
                          className="px-2.5 py-1 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-300 hover:text-white text-xs font-bold transition active:scale-95 cursor-pointer"
                          title="Plus 1 inch"
                        >
                          +1&quot;
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalcDiameter(prev => Math.min(240, prev + 12))}
                          className="px-2.5 py-1 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-zinc-300 hover:text-white text-xs font-bold transition active:scale-95 cursor-pointer"
                          title="Plus 1 Foot (+12 inches)"
                        >
                          +12&quot;
                        </button>
                      </div>

                      {/* Presets */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[1, 6, 12, 18, 20, 24, 30, 36, 48, 60, 72, 96, 120, 144, 240].map(l => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setCalcDiameter(l)}
                            className={`px-2 py-1 rounded text-xs font-mono transition cursor-pointer ${
                              calcDiameter === l
                                ? 'bg-[var(--yellow)] text-black font-bold ring-2 ring-yellow-300 shadow-sm'
                                : 'bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                            }`}
                          >
                            {l}&quot;{l >= 36 ? ` (${(l / 12).toFixed(l % 12 === 0 ? 0 : 1)}ft)` : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Outer Diameter (OD) & Inner Diameter (ID) */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
                      <div>
                        <label className="font-bold uppercase text-[var(--text)] block">
                          Pipe Outer Diameter (OD)
                        </label>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          From thin 1/8&quot; bore up to 3&quot; heavy industrial tubing
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
                        Ø {calcClampSize} ({formatDiameterMm(calcClampSize)} mm)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-mono">
                      {STANDARD_DIAMETER_OPTIONS.map(dia => (
                        <button
                          key={dia}
                          type="button"
                          onClick={() => setCalcClampSize(dia)}
                          className={`p-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                            calcClampSize === dia
                              ? 'bg-sky-500/25 border-sky-400 text-sky-200 font-bold ring-2 ring-sky-400 shadow-sm'
                              : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                          }`}
                        >
                          <span className="text-xs font-bold">Ø {dia}</span>
                          <span className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            {formatDiameterMm(dia)} mm
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Custom OD */}
                    <div className="pt-2 border-t border-[var(--steel-line)] flex items-center gap-2 text-xs font-mono">
                      <span className="text-[var(--text-dim)] shrink-0">Custom Tooling OD:</span>
                      <input
                        type="text"
                        placeholder="e.g. 1-3/4&quot;, 22mm, 1.2&quot;"
                        value={customDiameterInput}
                        onChange={e => setCustomDiameterInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-white focus:outline-none focus:border-sky-400"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customDiameterInput.trim()) {
                            const clean = customDiameterInput.trim().endsWith('"') ? customDiameterInput.trim() : `${customDiameterInput.trim()}"`;
                            setCalcClampSize(clean);
                            setCustomDiameterInput('');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-sky-500 text-black font-bold hover:bg-sky-400 transition cursor-pointer"
                      >
                        Apply OD
                      </button>
                    </div>
                  </div>

                  {/* Steel Wall Thickness & Gauge + End Cut */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1.5">
                      <label className="font-bold uppercase text-[var(--text)] block">
                        Pipe Steel Gauge (Wall Thickness)
                      </label>
                      <select
                        value={calcGauge}
                        onChange={e => setCalcGauge(e.target.value)}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-2 text-white focus:border-[var(--yellow)] focus:outline-none"
                      >
                        <option value="14 Gauge">14 Gauge (2.0 mm Heavy Duty)</option>
                        <option value="16 Gauge">16 Gauge (1.6 mm Standard Commercial)</option>
                        <option value="18 Gauge">18 Gauge (1.2 mm Light Duty)</option>
                        <option value="20 Gauge">20 Gauge (0.9 mm Extra Light)</option>
                      </select>
                      <div className="text-[10px] text-amber-400 pt-1">
                        Est. Pipe ID: {Math.max(2, Math.round((parseFloat(formatDiameterMm(calcClampSize)) - 2 * (calcGauge === '14 Gauge' ? 2.0 : calcGauge === '16 Gauge' ? 1.6 : calcGauge === '18 Gauge' ? 1.2 : 0.9)) * 10) / 10)} mm
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1.5">
                      <label className="font-bold uppercase text-[var(--text)] block">
                        Pipe End Cut & Deburring
                      </label>
                      <select
                        value={calcPipeEndCut}
                        onChange={e => setCalcPipeEndCut(e.target.value as any)}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-2 text-white focus:border-[var(--yellow)] focus:outline-none"
                      >
                        <option value="square_deburred">Square Cut & Deburred (Standard)</option>
                        <option value="chamfer_45">45° Internal/External Chamfer</option>
                        <option value="beveled">30° Weld Bevel Cut</option>
                        <option value="slotted">Axial Safety Slotted End</option>
                      </select>
                      <div className="text-[10px] text-[var(--text-dim)] pt-1">
                        CNC tolerance: {calcToleranceMm === 0.05 ? '±0.05 mm High Precision' : '±0.10 mm (ISO 2768-m)'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MOUNTING CLAMPS & SHACKLES */}
              {designerTab === 'clamps' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Clamp Presets */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase text-[var(--text-dim)] font-mono font-bold block">
                      Mounting Clamp Configuration
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      {[
                        { label: 'Dual Clamps (Top + Bottom)', desc: 'Ceiling shackle + motor coupler', top: true, bottom: true, icon: Check },
                        { label: 'Without Clamps (Bare Pipe)', desc: 'Hollow plain tube ends', top: false, bottom: false, icon: Circle },
                        { label: 'Top Clamp Only', desc: 'Ceiling shackle only', top: true, bottom: false, icon: Check },
                        { label: 'Bottom Clamp Only', desc: 'Motor coupler only', top: false, bottom: true, icon: Check }
                      ].map(opt => {
                        const isSel = calcHasTopClamp === opt.top && calcHasBottomClamp === opt.bottom;
                        return (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => {
                              setCalcHasTopClamp(opt.top);
                              setCalcHasBottomClamp(opt.bottom);
                            }}
                            className={`p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                              isSel
                                ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300 ring-1 ring-emerald-400 font-bold'
                                : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)]'
                            }`}
                          >
                            <div>
                              <span className="block">{opt.label}</span>
                              <span className="text-[10px] text-zinc-400 font-normal">{opt.desc}</span>
                            </div>
                            {isSel && <Check size={14} className="text-emerald-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clamp Style & Thickness */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1.5">
                      <label className="font-bold uppercase text-[var(--text)] block">
                        Clamp Fabrication Style
                      </label>
                      <select
                        value={calcClampStyle}
                        onChange={e => setCalcClampStyle(e.target.value as any)}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-2 text-white focus:border-[var(--yellow)] focus:outline-none"
                      >
                        <option value="standard">Standard Stamped Heavy Steel</option>
                        <option value="heavy_duty">Forged Heavy-Duty Cast Iron</option>
                        <option value="ring_collar">Split Ring Locking Collar</option>
                        <option value="welded_flange">Welded Heavy Base Flange</option>
                        <option value="telescopic_sleeve">Telescopic Sleeve (Pedestal)</option>
                      </select>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1.5">
                      <label className="font-bold uppercase text-[var(--text)] block">
                        Clamp Gauge (Stamping Thickness)
                      </label>
                      <select
                        value={calcClampGauge}
                        onChange={e => setCalcClampGauge(e.target.value)}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-2 text-white focus:border-[var(--yellow)] focus:outline-none"
                      >
                        <option value="12 Gauge">12 Gauge (2.6 mm Heavy Duty)</option>
                        <option value="14 Gauge">14 Gauge (2.0 mm Standard Heavy)</option>
                        <option value="16 Gauge">16 Gauge (1.6 mm Commercial)</option>
                        <option value="18 Gauge">18 Gauge (1.2 mm Light Duty)</option>
                      </select>
                    </div>
                  </div>

                  {/* Fastener Hardware: Bolt & Ear Width */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2 text-xs font-mono">
                    <span className="font-bold uppercase text-[var(--text)] block">
                      Fastener Hardware & Ear Geometry
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-[var(--text-dim)] block mb-1">Fastener Bolt Size</span>
                        <div className="flex gap-1">
                          {(['M6', 'M8', 'M10'] as const).map(b => (
                            <button
                              key={b}
                              type="button"
                              onClick={() => setCalcClampBoltSize(b)}
                              className={`flex-1 py-1.5 rounded-lg border text-center font-bold ${
                                calcClampBoltSize === b
                                  ? 'bg-amber-400 text-black border-amber-400'
                                  : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                              }`}
                            >
                              {b}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-[var(--text-dim)] block mb-1">Ear Width Spacing</span>
                        <div className="flex gap-1">
                          {[18, 22, 25, 30].map(w => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => setCalcClampEarWidthMm(w)}
                              className={`flex-1 py-1.5 rounded-lg border text-center font-bold ${
                                calcClampEarWidthMm === w
                                  ? 'bg-sky-400 text-black border-sky-400'
                                  : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                              }`}
                            >
                              {w}mm
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="col-span-2 sm:col-span-1 flex flex-col justify-end">
                        <div className="p-2 rounded bg-black/30 border border-white/5 text-[11px] text-zinc-300">
                          Locknut: <span className="text-emerald-400 font-bold">Nylon Insert</span> DIN 985
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: HOLE DRILLING & SAFETY SLITS */}
              {designerTab === 'holes' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Through-Hole Diameter */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
                    <label className="text-[10px] uppercase text-[var(--text-dim)] font-mono font-bold block">
                      Fastener Through-Hole Diameter
                    </label>
                    <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                      {[6, 8, 10, 12].map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setCalcHoleSizeMm(size)}
                          className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                            calcHoleSizeMm === size
                              ? 'bg-sky-500/25 border-sky-400 text-sky-200 font-bold ring-1 ring-sky-400'
                              : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                          }`}
                        >
                          <span className="block text-sm font-bold">Ø {size} mm</span>
                          <span className="text-[9px] text-[var(--text-dim)]">
                            {size === 6 ? 'M6 Bolt' : size === 8 ? 'Standard M8' : size === 10 ? 'Heavy M10' : '12mm Shackle'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Top & Bottom Hole Counts + Offsets */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--text)] uppercase">Top Safety Holes</span>
                        <span className="text-amber-400 font-bold">{calcTopHoleCount} holes · {calcTopHoleOffsetMm}mm off</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {[0, 1, 2].map(cnt => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setCalcTopHoleCount(cnt)}
                            className={`py-1.5 rounded-lg border font-bold ${
                              calcTopHoleCount === cnt
                                ? 'bg-amber-400 text-black border-amber-400'
                                : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                            }`}
                          >
                            {cnt === 0 ? 'None' : `${cnt} Hole`}
                          </button>
                        ))}
                      </div>
                      <div className="pt-1">
                        <span className="text-[10px] text-[var(--text-dim)] block mb-1">Offset from Top Edge:</span>
                        <div className="grid grid-cols-4 gap-1">
                          {[10, 15, 20, 25].map(off => (
                            <button
                              key={off}
                              type="button"
                              onClick={() => setCalcTopHoleOffsetMm(off)}
                              className={`py-1 rounded border text-[10px] font-bold ${
                                calcTopHoleOffsetMm === off
                                  ? 'bg-sky-400 text-black border-sky-400'
                                  : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                              }`}
                            >
                              {off}mm
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--text)] uppercase">Bottom Motor Holes</span>
                        <span className="text-amber-400 font-bold">{calcBottomHoleCount} holes · {calcBottomHoleOffsetMm}mm off</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {[0, 1, 2].map(cnt => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setCalcBottomHoleCount(cnt)}
                            className={`py-1.5 rounded-lg border font-bold ${
                              calcBottomHoleCount === cnt
                                ? 'bg-amber-400 text-black border-amber-400'
                                : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                            }`}
                          >
                            {cnt === 0 ? 'None' : `${cnt} Hole`}
                          </button>
                        ))}
                      </div>
                      <div className="pt-1">
                        <span className="text-[10px] text-[var(--text-dim)] block mb-1">Offset from Bottom Edge:</span>
                        <div className="grid grid-cols-4 gap-1">
                          {[15, 20, 30, 40].map(off => (
                            <button
                              key={off}
                              type="button"
                              onClick={() => setCalcBottomHoleOffsetMm(off)}
                              className={`py-1 rounded border text-[10px] font-bold ${
                                calcBottomHoleOffsetMm === off
                                  ? 'bg-sky-400 text-black border-sky-400'
                                  : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                              }`}
                            >
                              {off}mm
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Safety Slits & Internal Wiring Channel */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3 text-xs font-mono">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="font-bold text-[var(--text)] block">Safety Cotter Pin Slit</span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          Slot cut {calcSlitWidthMm}mm × {calcSlitLengthMm}mm for secondary safety locking
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={calcHasMono}
                        onChange={e => setCalcHasMono(e.target.checked)}
                        className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-[var(--steel-line)]">
                      <div>
                        <span className="font-bold text-[var(--text)] block">Internal Hollow Wiring Conduit</span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          Continuous tubular conduit for up to {calcMaxWiringCables} isolated copper wire lines
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={calcHasWireConduit}
                        onChange={e => setCalcHasWireConduit(e.target.checked)}
                        className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 4: THREADING & CNC LATHE TOOLING */}
              {designerTab === 'threads' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3 text-xs font-mono">
                    <label className="text-[10px] uppercase text-[var(--text-dim)] font-bold block">
                      CNC Lathe Threading Operations
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'without_thread', label: 'Without Thread (Plain Tube)', desc: 'Smooth bore for shackle through-bolts' },
                        { id: 'both_ends', label: 'With Threads (Both Ends)', desc: 'Threaded top & bottom motor coupler' },
                        { id: 'top_only', label: 'With Thread (Top End Only)', desc: 'Threaded into ceiling collar' },
                        { id: 'bottom_only', label: 'With Thread (Bottom End Only)', desc: 'Threaded into fan motor body' }
                      ].map(t => {
                        const isSel = calcThreadType === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setCalcThreadType(t.id as any)}
                            className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                              isSel
                                ? 'bg-amber-400 text-black font-bold border-amber-400 shadow-sm'
                                : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
                            }`}
                          >
                            <div>
                              <span className="block font-bold">{t.label}</span>
                              <span className="text-[10px] text-zinc-500 font-normal">{t.desc}</span>
                            </div>
                            {isSel && <Check size={14} />}
                          </button>
                        );
                      })}
                    </div>

                    {calcThreadType !== 'without_thread' && (
                      <div className="pt-2 border-t border-[var(--steel-line)] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[var(--text-dim)]">Thread Standard & Pitch:</span>
                          <div className="flex gap-1.5">
                            {(['BSPT', 'Metric', 'NPT'] as const).map(std => (
                              <button
                                key={std}
                                type="button"
                                onClick={() => setCalcThreadStandard(std as any)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  calcThreadStandard === std
                                    ? 'bg-sky-400 text-black'
                                    : 'bg-[var(--panel)] text-[var(--text-dim)] border border-[var(--steel-line)]'
                                }`}
                              >
                                {std === 'BSPT' ? 'BSPT (14 TPI Pipe)' : std === 'Metric' ? 'Metric (M25×1.5)' : 'NPT (US Taper)'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: SAFETY COTTER / GARTER PIN */}
              {designerTab === 'cotter_pin' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3 text-xs font-mono">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="font-bold text-[var(--text)] block">Include Safety Cotter / Garter Pin</span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          Mechanical locking pin to prevent bolt slippage under fan vibration
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={calcHasGarterPin}
                        onChange={e => setCalcHasGarterPin(e.target.checked)}
                        className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                      />
                    </label>

                    {calcHasGarterPin && (
                      <div className="space-y-3 pt-2 border-t border-[var(--steel-line)]">
                        <div>
                          <span className="text-[10px] text-[var(--text-dim)] uppercase font-bold block mb-1">
                            Cotter Pin Type
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: 'split_cotter', label: 'Split Cotter Pin', desc: 'DIN 94 dual leg' },
                              { id: 'hairpin_r_clip', label: 'R-Clip Hairpin', desc: 'DIN 11024 spring' },
                              { id: 'through_bolt_locknut', label: 'Bolt & Locknut', desc: 'M6 nyloc assembly' }
                            ].map(pt => (
                              <button
                                key={pt.id}
                                type="button"
                                onClick={() => setCalcGarterPinType(pt.id as any)}
                                className={`p-2 rounded-xl border text-left font-bold ${
                                  calcGarterPinType === pt.id
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
                                  onClick={() => setCalcGarterPinDiameterMm(dia)}
                                  className={`py-1.5 rounded-lg border text-center font-bold ${
                                    calcGarterPinDiameterMm === dia
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
                                  onClick={() => setCalcGarterPinLengthMm(len)}
                                  className={`py-1.5 rounded-lg border text-center font-bold ${
                                    calcGarterPinLengthMm === len
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
                                onClick={() => setCalcGarterPinMaterial(mat.id as any)}
                                className={`py-1.5 px-2 rounded-lg border text-center font-bold text-[11px] ${
                                  calcGarterPinMaterial === mat.id
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

              {/* TAB 6: FINISH, LOAD RATING & QA SIGN-OFF */}
              {designerTab === 'finish_qa' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Colors */}
                  <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2 text-xs font-mono">
                    <label className="text-[10px] uppercase text-[var(--text-dim)] font-bold block">
                      Electrostatic Powder Coating Finish (80 Micron)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { name: 'Matt Black', colorHex: '#18181b' },
                        { name: 'Pure White', colorHex: '#f8fafc' },
                        { name: 'Smoke Grey', colorHex: '#64748b' },
                        { name: 'Precision Silver', colorHex: '#cbd5e1' },
                        { name: 'Antique Gold', colorHex: '#ca8a04' },
                        { name: 'Hammered Copper', colorHex: '#b45309' },
                        { name: 'Royal Ivory', colorHex: '#fef3c7' },
                        { name: 'Raw Steel', colorHex: '#334155' }
                      ].map(c => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setCalcColor(c.name)}
                          className={`p-2 rounded-xl border flex items-center gap-2 transition cursor-pointer ${
                            calcColor === c.name
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold ring-1 ring-amber-400'
                              : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                          }`}
                        >
                          <span className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: c.colorHex }} />
                          <span className="truncate">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* QA & Engineering Sign-Off */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                      <span className="text-[10px] text-[var(--text-dim)] uppercase font-bold block">CAD Drawing Revision</span>
                      <select
                        value={calcCadRevision}
                        onChange={e => setCalcCadRevision(e.target.value)}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2 py-1.5 text-white"
                      >
                        <option value="Rev A">Rev A (Initial Production)</option>
                        <option value="Rev B">Rev B (Reinforced Clamps)</option>
                        <option value="Rev C">Rev C (Heavy Duty Certified)</option>
                      </select>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                      <span className="text-[10px] text-[var(--text-dim)] uppercase font-bold block">Certified Working Load</span>
                      <select
                        value={calcLoadRatingKg}
                        onChange={e => setCalcLoadRatingKg(parseInt(e.target.value, 10))}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2 py-1.5 text-white"
                      >
                        <option value="25">25 kg (Light Ceiling Fans)</option>
                        <option value="35">35 kg (Standard 56&quot; Fans)</option>
                        <option value="50">50 kg (Commercial Heavy Duty)</option>
                        <option value="75">75 kg (Industrial High-CFM)</option>
                      </select>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                      <span className="text-[10px] text-[var(--text-dim)] uppercase font-bold block">Lead Engineer Sign-Off</span>
                      <input
                        type="text"
                        value={calcEngineerSignOff}
                        onChange={e => setCalcEngineerSignOff(e.target.value)}
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2 py-1.5 text-white font-mono text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1 text-xs font-mono">
                    <span className="text-[10px] text-[var(--text-dim)] uppercase font-bold block">Workshop Fabrication Notes</span>
                    <input
                      type="text"
                      value={calcNotes}
                      onChange={e => setCalcNotes(e.target.value)}
                      placeholder="e.g. Pre-drill 8mm holes before powder coating, apply zinc wash"
                      className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Live Multi-Angle CAD Vector Blueprint Overlay & BOM */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              {/* CAD Multi-Angle View Switcher */}
              <div className="flex items-center justify-between gap-1 p-1 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-mono">
                {[
                  { id: 'assembly', label: '📐 Assembly' },
                  { id: 'rod', label: '📏 Tube' },
                  { id: 'clamps', label: '🔩 Clamps' },
                  { id: 'garter_pin', label: '🧷 Cotter Pin' },
                  { id: 'exploded', label: '⚙️ Exploded' }
                ].map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setDesignerCadViewMode(v.id as any)}
                    className={`flex-1 py-1 px-1.5 rounded-lg text-center font-bold text-[10px] transition cursor-pointer ${
                      designerCadViewMode === v.id
                        ? 'bg-sky-400 text-black shadow-xs font-black'
                        : 'text-[var(--text-dim)] hover:text-white'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              {/* High-Precision Interactive SVG Blueprint Canvas */}
              <div className="rounded-xl overflow-hidden border border-[var(--steel-line)] bg-zinc-950 p-2 shadow-inner">
                {/* Live Dimension & Spec Badges */}
                <div className="flex items-center justify-between flex-wrap gap-1.5 mb-2 px-1 text-[10px] font-mono">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-sky-500/25 text-sky-300 border border-sky-500/40 font-bold">
                      OD: Ø {calcClampSize} ({formatDiameterMm(calcClampSize)} mm)
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                      ID: Ø {Math.max(1, Math.round((parseFloat(formatDiameterMm(calcClampSize)) - 2 * wallMmVal) * 10) / 10)} mm
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      L: {calcDiameter}&quot;
                    </span>
                  </div>
                  <span className="text-zinc-400 font-bold bg-black/40 px-2 py-0.5 rounded border border-white/10">
                    Net: {totalEstimatedWeightKg} kg
                  </span>
                </div>

                <RodBlueprintSvgOverlay
                  specs={currentBlueprintSpecs}
                  interactive={true}
                  viewMode={designerCadViewMode}
                  svgRef={designerSvgRef}
                  className="w-full h-72 sm:h-80"
                />
              </div>

              {/* Calculated Bill of Materials (BOM) & Pricing Box */}
              <div className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl p-4 space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase text-[var(--yellow)] flex items-center gap-1.5">
                    <Scale size={14} />
                    <span>Calculated Bill of Materials</span>
                  </h4>
                  <span className="text-[10px] text-zinc-400 font-bold">
                    Factor of Safety: 5:1
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-black/30 border border-white/5">
                    <span className="text-[9px] text-[var(--text-dim)] block">Steel Pipe</span>
                    <span className="font-bold text-[var(--text)]">{estimatedPipeWeightKg} kg</span>
                  </div>
                  <div className="p-2 rounded bg-black/30 border border-white/5">
                    <span className="text-[9px] text-[var(--text-dim)] block">Fittings & Pin</span>
                    <span className="font-bold text-[var(--text)]">{estimatedFittingsWeightKg} kg</span>
                  </div>
                  <div className="p-2 rounded bg-black/30 border border-white/5">
                    <span className="text-[9px] text-[var(--text-dim)] block">Net Assembly</span>
                    <span className="font-bold text-amber-400">{totalEstimatedWeightKg} kg</span>
                  </div>
                  <div className="p-2 rounded bg-black/30 border border-white/5">
                    <span className="text-[9px] text-[var(--text-dim)] block">Wholesale Rate</span>
                    <span className="font-bold text-emerald-400">Rs {fmt(estimatedWholesalePrice)}</span>
                  </div>
                </div>

                {/* All Action Buttons */}
                <div className="space-y-2 pt-1">
                  {/* Send to POS Cart */}
                  <button
                    type="button"
                    onClick={() => {
                      const customItem: Product = {
                        id: Date.now(),
                        name: `Fan Rod ${calcDiameter}" × Ø${calcClampSize} [${calcGauge.replace(' Gauge', 'G')} · ${calcColor}]`,
                        price: estimatedWholesalePrice,
                        cat: calcRodType === 'pedestal' ? 'Pedestal Extension Rod' : 'Ceiling Fan Down Rod',
                        color: calcColor,
                        size: `${calcDiameter}" × Ø${calcClampSize}`,
                        gauge: calcGauge,
                        weight: `${totalEstimatedWeightKg} kg`,
                        stock: 1,
                        reorderLevel: 5,
                        blueprintSpecs: currentBlueprintSpecs
                      };
                      onAddToCart(customItem, calcColor, `${calcDiameter}" × Ø${calcClampSize}`);
                      setCustomCartAdded(true);
                      setTimeout(() => setCustomCartAdded(false), 2200);
                    }}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs shadow transition active:scale-95 cursor-pointer ${
                      customCartAdded
                        ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                        : 'bg-[var(--yellow)] text-black hover:brightness-110'
                    }`}
                  >
                    {customCartAdded ? (
                      <>
                        <Check size={14} className="stroke-[3]" />
                        <span>Added to POS Invoice Cart!</span>
                      </>
                    ) : (
                      <>
                        <ShoppingCart size={14} />
                        <span>Send Spec Rod Directly to POS Cart</span>
                      </>
                    )}
                  </button>

                  {/* Save to Catalog & Save as New Buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveBlueprintToCatalog(false)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-bold text-xs hover:bg-emerald-500 hover:text-black transition cursor-pointer active:scale-95"
                    >
                      {designerSaveSuccess ? (
                        <>
                          <CheckCircle2 size={13} className="text-emerald-400" />
                          <span>Specs Saved to Catalog!</span>
                        </>
                      ) : (
                        <>
                          <Save size={13} />
                          <span>Save Blueprint Specs</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveBlueprintToCatalog(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white font-bold text-xs transition cursor-pointer active:scale-95"
                      title="Add this customized fan rod as a new inventory item in the catalog"
                    >
                      <Plus size={13} />
                      <span>Add as New Item</span>
                    </button>
                  </div>

                  {/* High-Res Exports & Print */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={handleExportDesignerPDF}
                      disabled={isExportingPdf}
                      className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold text-[11px] hover:bg-sky-500 hover:text-black transition disabled:opacity-50 cursor-pointer active:scale-95"
                      title="Export official high-resolution CAD Blueprint PDF specification sheet"
                    >
                      {isExportingPdf ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : pdfSuccess ? (
                        <CheckCircle2 size={12} className="text-emerald-400" />
                      ) : (
                        <FileDown size={12} />
                      )}
                      <span>CAD PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportCustomBlueprintJPG}
                      disabled={isExportingBlueprint}
                      className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[11px] hover:bg-amber-500 hover:text-black transition disabled:opacity-50 cursor-pointer active:scale-95"
                      title="Export high-resolution Blueprint JPG drawing"
                    >
                      {isExportingBlueprint ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <ImageIcon size={12} />
                      )}
                      <span>CAD JPG</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintSpecSheet}
                      className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white font-bold text-[11px] transition cursor-pointer active:scale-95"
                      title="Print Technical Spec Sheet"
                    >
                      <Printer size={12} />
                      <span>Print</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Gallery & Archive Tab */}
      {activeTab === 'exports' && (
        <div className="space-y-6">
          {/* Summary Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 font-mono">
            <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase text-[var(--text-dim)] font-bold block">Total Exports</span>
                <span className="text-xl sm:text-2xl font-black text-[var(--text)]">{exportedItems.length}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center text-[var(--yellow)]">
                <Download size={20} />
              </div>
            </div>

            <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase text-amber-400/90 font-bold block">JPG Images</span>
                <span className="text-xl sm:text-2xl font-black text-amber-400">
                  {exportedItems.filter(i => i.format === 'jpg').length}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ImageIcon size={20} />
              </div>
            </div>

            <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase text-rose-400/90 font-bold block">PDF Documents</span>
                <span className="text-xl sm:text-2xl font-black text-rose-400">
                  {exportedItems.filter(i => i.format === 'pdf').length}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <FileText size={20} />
              </div>
            </div>

            <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase text-emerald-400/90 font-bold block">CSV Sheets</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-400">
                  {exportedItems.filter(i => i.format === 'csv').length}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <FileSpreadsheet size={20} />
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-4 space-y-3 font-sans">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[240px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                <input
                  type="text"
                  value={exportSearch}
                  onChange={e => setExportSearch(e.target.value)}
                  placeholder="Search exported files by title, filename, customer..."
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl pl-9 pr-8 py-2 text-xs text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--yellow)] font-mono"
                />
                {exportSearch && (
                  <button
                    onClick={() => setExportSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-dim)] hover:text-[var(--text)]"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
                <button
                  type="button"
                  disabled={isGeneratingSampleJpg}
                  onClick={handleGenerateSampleJpg}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500 hover:text-black text-xs font-mono font-bold transition cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Generate high-resolution sample JPG invoice to test export and gallery rendering"
                >
                  {isGeneratingSampleJpg ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Exporting JPG...</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon size={13} />
                      <span>+ Sample JPG Invoice</span>
                    </>
                  )}
                </button>

                {/* Clear All Exports Button */}
                {exportedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearAllConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 text-xs font-mono font-bold transition"
                  >
                    <Trash2 size={13} />
                    <span>Clear All Exports</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--steel-line)]/50 text-xs font-mono">
              {/* Format Filters */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-[var(--text-dim)] mr-1 flex items-center gap-1">
                  <Filter size={12} /> Format:
                </span>
                {(['all', 'jpg', 'pdf', 'csv'] as const).map(fmt => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setExportFilterFormat(fmt)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition ${
                      exportFilterFormat === fmt
                        ? fmt === 'jpg'
                          ? 'bg-amber-500 text-black shadow'
                          : fmt === 'pdf'
                          ? 'bg-rose-500 text-white shadow'
                          : fmt === 'csv'
                          ? 'bg-emerald-500 text-white shadow'
                          : 'bg-[var(--yellow)] text-black shadow'
                        : 'bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    {fmt === 'all' ? 'All Formats' : fmt.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Category Filters */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-[var(--text-dim)] mr-1">Type:</span>
                {(['all', 'invoice', 'report', 'blueprint', 'receipt'] as const).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setExportFilterCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] transition ${
                      exportFilterCategory === cat
                        ? 'bg-[var(--yellow)] text-black font-bold shadow'
                        : 'bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    {cat === 'all'
                      ? 'All Categories'
                      : cat === 'invoice'
                      ? 'Invoices'
                      : cat === 'report'
                      ? 'Reports'
                      : cat === 'blueprint'
                      ? 'Blueprints'
                      : 'Receipts'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Exported Items Grid */}
          {filteredExports.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-[var(--steel-line)] rounded-2xl p-8 bg-[var(--panel)]">
              <div className="w-16 h-16 rounded-2xl bg-[var(--panel-raised)] border border-[var(--steel-line)] mx-auto flex items-center justify-center text-[var(--text-dim)] mb-4">
                <ImageIcon size={32} />
              </div>
              <h3 className="font-serif font-bold text-lg text-[var(--text)]">No Exported Files Found</h3>
              <p className="text-xs text-[var(--text-dim)] max-w-md mx-auto mt-2 font-mono">
                {exportedItems.length === 0
                  ? 'All invoices, reports, blueprints, and ledgers exported in JPG, PDF, or CSV format are automatically archived here with instant preview, re-download, and deletion capabilities.'
                  : 'No exported files match your current search or format filters.'}
              </p>
              {exportedItems.length === 0 && (
                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    disabled={isGeneratingSampleJpg}
                    onClick={handleGenerateSampleJpg}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--yellow)] text-black font-mono font-bold text-xs uppercase shadow hover:bg-amber-400 transition cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isGeneratingSampleJpg ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Rendering High-Res JPG...</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon size={14} />
                        <span>Generate Sample Invoice (JPG)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 font-sans">
              {filteredExports.map(item => {
                const isJpg = item.format === 'jpg';
                const isPdf = item.format === 'pdf';
                const isCsv = item.format === 'csv';

                return (
                  <div
                    key={item.id}
                    className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl overflow-hidden shadow-sm hover:border-[var(--yellow)]/60 transition group flex flex-col justify-between"
                  >
                    <div>
                      {/* Visual Preview Banner */}
                      <div
                        onClick={() => setPreviewItem(item)}
                        className="relative h-52 w-full bg-[#070b12] border-b border-[var(--steel-line)] overflow-hidden cursor-pointer flex items-center justify-center p-2.5 group-hover:opacity-95 transition"
                      >
                        {isJpg ? (
                          item.dataUrl && !imageErrors[item.id] ? (
                            <img
                              src={item.dataUrl}
                              alt={item.title}
                              onError={() => setImageErrors(prev => ({ ...prev, [item.id]: true }))}
                              className="max-h-full max-w-full object-contain rounded transition duration-300 group-hover:scale-[1.02] shadow-md"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-2 p-4 text-center bg-gradient-to-b from-[#181a20] to-[#0f1115] w-full h-full">
                              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shadow">
                                <ImageIcon size={28} />
                              </div>
                              <div className="space-y-0.5">
                                <span className="font-mono text-[11px] text-amber-300 uppercase tracking-wider font-bold block">
                                  High-Resolution JPG
                                </span>
                                <span className="text-[10px] text-[var(--text-dim)] font-mono block">
                                  {item.category === 'invoice'
                                    ? 'Invoice Memo Document'
                                    : item.category === 'blueprint'
                                    ? 'CAD Technical Drawing'
                                    : 'Report Table Archive'}
                                </span>
                              </div>
                            </div>
                          )
                        ) : isPdf ? (
                          <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow">
                              <FileText size={28} />
                            </div>
                            <span className="font-mono text-[10px] text-rose-300 uppercase tracking-widest font-bold">
                              PDF Document Export
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow">
                              <FileSpreadsheet size={28} />
                            </div>
                            <span className="font-mono text-[10px] text-emerald-300 uppercase tracking-widest font-bold">
                              Spreadsheet CSV Export
                            </span>
                          </div>
                        )}

                        {/* Format Badge Overlay Top Left */}
                        <div className="absolute top-2.5 left-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase shadow-md ${
                              isJpg
                                ? 'bg-amber-500 text-black'
                                : isPdf
                                ? 'bg-rose-500 text-white'
                                : 'bg-emerald-500 text-white'
                            }`}
                          >
                            {item.format.toUpperCase()}
                          </span>
                        </div>

                        {/* Category Badge Top Right */}
                        <div className="absolute top-2.5 right-2.5">
                          <span className="px-2 py-0.5 rounded bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-mono uppercase text-zinc-300">
                            {item.category}
                          </span>
                        </div>

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white text-xs font-mono font-bold">
                          <Eye size={16} />
                          <span>Click to Inspect</span>
                        </div>
                      </div>

                      {/* Details Body */}
                      <div className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-serif font-bold text-sm text-[var(--text)] line-clamp-1" title={item.title}>
                            {item.title}
                          </h4>
                        </div>

                        <p className="font-mono text-[11px] text-[var(--text-dim)] truncate" title={item.fileName}>
                          {item.fileName}
                        </p>

                        {/* Metadata Tags */}
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-[var(--text-dim)] pt-1">
                          <span className="flex items-center gap-1 bg-[var(--panel-raised)] px-2 py-0.5 rounded border border-[var(--steel-line)]">
                            <Clock size={11} />
                            <span>{new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </span>

                          {item.fileSize && (
                            <span className="bg-[var(--panel-raised)] px-2 py-0.5 rounded border border-[var(--steel-line)] text-zinc-400">
                              {item.fileSize}
                            </span>
                          )}

                          {item.recordCount !== undefined && (
                            <span className="bg-[var(--panel-raised)] px-2 py-0.5 rounded border border-[var(--steel-line)] text-[var(--yellow)]">
                              {item.recordCount} records
                            </span>
                          )}

                          {item.totalAmount !== undefined && (
                            <span className="bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-emerald-400 font-bold">
                              Rs {fmt(item.totalAmount)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Footer */}
                    <div className="p-3 bg-[var(--panel-raised)] border-t border-[var(--steel-line)] flex items-center justify-between gap-2 font-mono text-xs">
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[var(--text)] text-[11px] font-bold transition cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>Preview</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleShareItem(item)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition active:scale-95 cursor-pointer ${
                            sharingFeedbackId === item.id
                              ? 'bg-emerald-500 text-white shadow'
                              : 'bg-emerald-500/15 border border-emerald-500/35 hover:bg-emerald-500 hover:text-black text-emerald-400'
                          }`}
                          title="Share to WhatsApp, Gmail, or device apps"
                        >
                          {sharingFeedbackId === item.id ? <Check size={13} /> : <Share2 size={13} />}
                          <span>{sharingFeedbackId === item.id ? 'Shared!' : 'Share'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadItem(item)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold shadow transition active:scale-95 cursor-pointer ${
                            downloadFeedbackId === item.id
                              ? 'bg-emerald-500 text-white'
                              : 'bg-[var(--yellow)] text-black hover:brightness-110'
                          }`}
                          title="Download exported file to device"
                        >
                          {downloadFeedbackId === item.id ? <Check size={13} /> : <Download size={13} />}
                          <span>{downloadFeedbackId === item.id ? 'Saved!' : 'Download'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition cursor-pointer"
                          title="Delete from Gallery"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* Blueprint Detail Inspection Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-[var(--panel-raised)] border-b border-[var(--steel-line)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--yellow)]/15 border border-[var(--yellow)]/30 flex items-center justify-center text-[var(--yellow)]">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[var(--text)]">
                    {selectedProduct.name}
                  </h3>
                  <span className="text-[10px] font-mono text-[var(--yellow)] uppercase">
                    {selectedProduct.cat} • Technical Specification Blueprint
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="w-7 h-7 rounded-lg border border-[var(--steel-line)] bg-[var(--panel)] hover:bg-red-500/10 hover:border-red-500 hover:text-red-400 text-[var(--text-dim)] flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-5">
              {/* Wireframe view */}
              <FanRodWireframe
                sizeInches={parseInt(selectedProduct.size || '18', 10) || 18}
                colorName={selectedProduct.color || 'Black'}
                isInspecting={true}
              />

              {/* Technical Specifications Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-[var(--panel-raised)] p-2.5 rounded-lg border border-[var(--steel-line)]">
                  <span className="text-[9px] text-[var(--text-dim)] uppercase block">Length</span>
                  <span className="font-bold text-[var(--text)]">{selectedProduct.size || '18 inch'}</span>
                </div>
                <div className="bg-[var(--panel-raised)] p-2.5 rounded-lg border border-[var(--steel-line)]">
                  <span className="text-[9px] text-[var(--text-dim)] uppercase block">Weight</span>
                  <span className="font-bold text-[var(--text)]">{selectedProduct.weight || '0.75 kg'}</span>
                </div>
                <div className="bg-[var(--panel-raised)] p-2.5 rounded-lg border border-[var(--steel-line)]">
                  <span className="text-[9px] text-[var(--text-dim)] uppercase block">Color Coating</span>
                  <span className="font-bold text-[var(--text)]">{selectedProduct.color || 'Black'}</span>
                </div>
                <div className="bg-[var(--panel-raised)] p-2.5 rounded-lg border border-[var(--steel-line)]">
                  <span className="text-[9px] text-[var(--text-dim)] uppercase block">Wholesale Rate</span>
                  <span className="font-bold text-emerald-400">Rs {fmt(selectedProduct.price)}</span>
                </div>
              </div>

              {/* Bill of Materials (Recipe Breakdown) */}
              <div className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl p-4">
                <h4 className="font-serif font-bold text-xs uppercase text-[var(--yellow)] mb-3 flex items-center gap-1.5">
                  <Layers size={14} />
                  <span>Factory Bill of Materials (Recipe Items)</span>
                </h4>

                {selectedProduct.recipe && selectedProduct.recipe.length > 0 ? (
                  <div className="space-y-1.5 text-xs">
                    {selectedProduct.recipe.map((r: RecipeItem, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1.5 px-2 rounded bg-black/20 border border-white/5"
                      >
                        <span className="font-mono text-[var(--text)]">{r.material}</span>
                        <span className="font-bold text-[var(--yellow)]">
                          {r.weightPerUnit ? `${r.weightPerUnit} kg` : `${r.itemsPerUnit} pcs`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-dim)] italic">
                    Standard fabrication recipe: Prime M.S. Steel Tube (16 Gauge), Pre-drilled safety cotter pin holes, hanging clamp fitting.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-[var(--panel-raised)] border-t border-[var(--steel-line)] flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportProductBlueprintJPG(selectedProduct)}
                  disabled={isExportingBlueprint}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition disabled:opacity-50"
                >
                  {isExportingBlueprint ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Exporting CAD...</span>
                    </>
                  ) : blueprintSuccess ? (
                    <>
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      <span className="text-emerald-400">Saved to Gallery!</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon size={14} />
                      <span>Export Blueprint (JPG)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handlePrintSpecSheet}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--yellow)] transition"
                >
                  <Printer size={14} />
                  <span>Print Spec Sheet</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="px-3 py-2 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] text-xs text-[var(--text)] hover:bg-[var(--panel-raised)] transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleAddWithFeedback(selectedProduct);
                    setSelectedProduct(null);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--yellow)] text-black font-bold text-xs hover:brightness-110 active:scale-95 shadow transition"
                >
                  <ShoppingCart size={14} />
                  <span>Add to POS Order</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export File High-Resolution Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 bg-[var(--panel-raised)] border-b border-[var(--steel-line)] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase ${
                    previewItem.format === 'jpg'
                      ? 'bg-amber-500 text-black'
                      : previewItem.format === 'pdf'
                      ? 'bg-rose-500 text-white'
                      : 'bg-emerald-500 text-white'
                  }`}
                >
                  {previewItem.format.toUpperCase()}
                </span>
                <div>
                  <h3 className="font-serif font-bold text-base text-[var(--text)] line-clamp-1">
                    {previewItem.title}
                  </h3>
                  <p className="font-mono text-[11px] text-[var(--text-dim)]">
                    {previewItem.fileName} • Exported on {new Date(previewItem.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="w-8 h-8 rounded-lg border border-[var(--steel-line)] bg-[var(--panel)] hover:bg-red-500/10 hover:border-red-500 hover:text-red-400 text-[var(--text-dim)] flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto max-h-[70vh] flex items-center justify-center bg-[#070b12]">
              {previewItem.format === 'jpg' ? (
                previewItem.dataUrl && !imageErrors[previewItem.id] ? (
                  <div className="flex flex-col items-center justify-center w-full">
                    <img
                      src={previewItem.dataUrl}
                      alt={previewItem.title}
                      onError={() => setImageErrors(prev => ({ ...prev, [previewItem.id]: true }))}
                      className="max-w-full max-h-[66vh] object-contain rounded-lg shadow-2xl border border-white/10"
                    />
                    <p className="mt-2 font-mono text-[11px] text-[var(--text-dim)]">
                      Full High-Resolution Graphic Archive • Click download to save raw image
                    </p>
                  </div>
                ) : (
                  <div className="p-8 text-center space-y-4 max-w-md">
                    <div className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center bg-amber-500/15 border border-amber-500/35 text-amber-400">
                      <ImageIcon size={40} />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-lg text-[var(--text)]">{previewItem.title}</h4>
                      <p className="text-xs text-[var(--text-dim)] font-mono mt-1">
                        {previewItem.description || 'Graphical JPG export archived'}
                      </p>
                    </div>
                    <div className="bg-[var(--panel)] p-4 rounded-xl border border-[var(--steel-line)] text-xs font-mono space-y-1.5 text-left">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-dim)]">Format:</span>
                        <span className="font-bold uppercase text-amber-400">{previewItem.format}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-dim)]">File Name:</span>
                        <span className="font-bold text-[var(--text)] truncate max-w-[200px]">{previewItem.fileName}</span>
                      </div>
                      {previewItem.fileSize && (
                        <div className="flex justify-between">
                          <span className="text-[var(--text-dim)]">Estimated Size:</span>
                          <span className="text-[var(--text)]">{previewItem.fileSize}</span>
                        </div>
                      )}
                      {previewItem.recordCount !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-[var(--text-dim)]">Rows / Records:</span>
                          <span className="text-[var(--text)]">{previewItem.recordCount}</span>
                        </div>
                      )}
                      {previewItem.totalAmount !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-[var(--text-dim)]">Total Amount:</span>
                          <span className="font-bold text-emerald-400">Rs {fmt(previewItem.totalAmount)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              ) : (
                <div className="p-8 text-center space-y-4 max-w-md">
                  <div className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    {previewItem.format === 'pdf' ? (
                      <FileText size={40} className="text-rose-400" />
                    ) : (
                      <FileSpreadsheet size={40} className="text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-lg text-[var(--text)]">{previewItem.title}</h4>
                    <p className="text-xs text-[var(--text-dim)] font-mono mt-1">{previewItem.description || 'Export document archived'}</p>
                  </div>
                  <div className="bg-[var(--panel)] p-4 rounded-xl border border-[var(--steel-line)] text-xs font-mono space-y-1.5 text-left">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-dim)]">Format:</span>
                      <span className="font-bold uppercase text-[var(--yellow)]">{previewItem.format}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-dim)]">File Name:</span>
                      <span className="font-bold text-[var(--text)] truncate max-w-[200px]">{previewItem.fileName}</span>
                    </div>
                    {previewItem.fileSize && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-dim)]">Estimated Size:</span>
                        <span className="text-[var(--text)]">{previewItem.fileSize}</span>
                      </div>
                    )}
                    {previewItem.recordCount !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-dim)]">Rows / Records:</span>
                        <span className="text-[var(--text)]">{previewItem.recordCount}</span>
                      </div>
                    )}
                    {previewItem.totalAmount !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-dim)]">Total Amount:</span>
                        <span className="font-bold text-emerald-400">Rs {fmt(previewItem.totalAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-[var(--panel-raised)] border-t border-[var(--steel-line)] flex items-center justify-between gap-3 font-mono">
              <button
                type="button"
                onClick={() => {
                  setItemToDelete(previewItem);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold transition"
              >
                <Trash2 size={14} />
                <span>Delete from Archive</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="px-4 py-2 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] text-xs text-[var(--text)] hover:bg-[var(--panel-raised)] transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleShareItem(previewItem)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition active:scale-95 cursor-pointer ${
                    sharingFeedbackId === previewItem.id
                      ? 'bg-emerald-500 text-white shadow'
                      : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-black'
                  }`}
                  title="Share to WhatsApp, Gmail, or device apps"
                >
                  {sharingFeedbackId === previewItem.id ? <Check size={14} /> : <Share2 size={14} />}
                  <span>{sharingFeedbackId === previewItem.id ? 'Shared!' : 'Share (WhatsApp)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadItem(previewItem)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs shadow transition active:scale-95 cursor-pointer ${
                    downloadFeedbackId === previewItem.id
                      ? 'bg-emerald-500 text-white'
                      : 'bg-[var(--yellow)] text-black hover:brightness-110'
                  }`}
                >
                  {downloadFeedbackId === previewItem.id ? <Check size={14} /> : <Download size={14} />}
                  <span>{downloadFeedbackId === previewItem.id ? 'Saved to Device!' : `Download ${previewItem.format.toUpperCase()}`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 font-sans">
          <div className="w-full max-w-md bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-[var(--text)]">Delete Exported File?</h3>
                <p className="text-xs text-[var(--text-dim)] font-mono">This will remove the file from your gallery archive.</p>
              </div>
            </div>

            <div className="p-3 bg-[var(--panel-raised)] rounded-xl border border-[var(--steel-line)] text-xs font-mono space-y-1">
              <p className="font-bold text-[var(--text)] line-clamp-1">{itemToDelete.title}</p>
              <p className="text-[var(--text-dim)] text-[11px] truncate">{itemToDelete.fileName}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text)] hover:bg-[var(--panel)] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition shadow"
              >
                <Trash2 size={13} />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 font-sans">
          <div className="w-full max-w-md bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-[var(--text)]">Clear All Gallery Exports?</h3>
                <p className="text-xs text-[var(--text-dim)] font-mono">This will permanently remove all {exportedItems.length} exported files from storage.</p>
              </div>
            </div>

            <p className="text-xs text-[var(--text-dim)]">
              You can always re-export invoices, reports, or blueprints anytime from the Point of Sale, Ledgers, or Blueprint Designer.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setShowClearAllConfirm(false)}
                className="px-4 py-2 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text)] hover:bg-[var(--panel)] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllConfirmed}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition shadow"
              >
                <Trash2 size={13} />
                <span>Clear All Files</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Rod Design Blueprint Studio Modal */}
      {blueprintStudioProduct && (
        <DesignBlueprintStudio
          product={blueprintStudioProduct}
          language={language}
          companyName={companyName}
          isOpen={Boolean(blueprintStudioProduct)}
          onClose={() => setBlueprintStudioProduct(null)}
          onSaveBlueprint={handleSaveBlueprint}
          onAddToCart={onAddToCart}
        />
      )}

    </div>
  );
};

export default GalleryView;
