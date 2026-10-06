import React, { useState, useEffect } from 'react';
import { Grid, Eye, EyeOff, Ruler } from 'lucide-react';

interface BlueprintRulerOverlayProps {
  gridScale: number; // Minor division pitch in px (default 20)
  showGrid: boolean;
  theme?: 'dark' | 'light';
  onToggleGrid: () => void;
}

export const BlueprintRulerOverlay: React.FC<BlueprintRulerOverlayProps> = ({
  gridScale,
  showGrid,
  theme = 'dark',
  onToggleGrid
}) => {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const minorStep = Math.max(10, Math.min(80, gridScale || 20));
  const majorStep = minorStep * 5;

  // Generate coordinate ticks
  const xMajorTicks: number[] = [];
  const xMinorTicks: number[] = [];
  for (let x = 0; x <= dimensions.width + majorStep; x += minorStep) {
    if (x % majorStep === 0) {
      xMajorTicks.push(x);
    } else {
      xMinorTicks.push(x);
    }
  }

  const yMajorTicks: number[] = [];
  const yMinorTicks: number[] = [];
  for (let y = 0; y <= dimensions.height + majorStep; y += minorStep) {
    if (y % majorStep === 0) {
      yMajorTicks.push(y);
    } else {
      yMinorTicks.push(y);
    }
  }

  const isLight = theme === 'light';
  const majorColor = isLight ? '#0284c7' : '#38bdf8';
  const minorColor = isLight ? 'rgba(2, 132, 199, 0.35)' : 'rgba(56, 189, 248, 0.3)';
  const textColor = isLight ? 'text-sky-800' : 'text-sky-300';
  const rulerBg = isLight
    ? 'bg-slate-100/85 text-slate-800 border-slate-300/80 shadow-xs'
    : 'bg-[#090e17]/85 text-sky-300 border-sky-500/20 shadow-xs';

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* 1. COORDINATE RULERS (Rendered when showGrid is enabled)       */}
      {/* ------------------------------------------------------------- */}
      {showGrid && (
        <div
          className="fixed inset-0 pointer-events-none z-20 overflow-hidden select-none animate-in fade-in duration-200"
          aria-hidden="true"
        >
          {/* TOP HORIZONTAL COORDINATE RULER (X-AXIS) */}
          <div
            className={`absolute top-0 left-0 right-0 h-5.5 border-b backdrop-blur-xs flex items-center font-mono ${rulerBg}`}
          >
            {/* Origin Corner Chip */}
            <div className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center border-r border-sky-500/30 text-[9px] font-black tracking-tight text-amber-400 bg-black/40">
              0,0
            </div>

            {/* SVG Scale Lines & Ticks */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ paddingLeft: '0px' }}
            >
              {/* Minor tick marks */}
              {xMinorTicks.map(x => (
                <line
                  key={`x-min-${x}`}
                  x1={x}
                  y1={16}
                  x2={x}
                  y2={22}
                  stroke={minorColor}
                  strokeWidth="1"
                />
              ))}
              {/* Major tick marks */}
              {xMajorTicks.map(x => (
                <line
                  key={`x-maj-${x}`}
                  x1={x}
                  y1={8}
                  x2={x}
                  y2={22}
                  stroke={majorColor}
                  strokeWidth="1.5"
                />
              ))}
            </svg>

            {/* Numeric Labels along top edge */}
            {xMajorTicks.map(x => (
              <div
                key={`x-lbl-${x}`}
                className={`absolute top-0.5 text-[8.5px] font-bold ${textColor} leading-none pointer-events-none transform -translate-x-1/2`}
                style={{ left: `${x}px` }}
              >
                {x}
              </div>
            ))}

            {/* Axis Unit Tag on Far Right */}
            <div className="absolute right-2 top-0.5 text-[8px] font-bold text-amber-400/90 tracking-wider">
              X-AXIS (px) · {minorStep}px/div
            </div>
          </div>

          {/* LEFT VERTICAL COORDINATE RULER (Y-AXIS) */}
          <div
            className={`absolute top-0 left-0 bottom-0 w-6 border-r backdrop-blur-xs font-mono ${rulerBg}`}
          >
            {/* SVG Scale Lines & Ticks */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {/* Minor tick marks */}
              {yMinorTicks.map(y => (
                <line
                  key={`y-min-${y}`}
                  x1={17}
                  y1={y}
                  x2={24}
                  y2={y}
                  stroke={minorColor}
                  strokeWidth="1"
                />
              ))}
              {/* Major tick marks */}
              {yMajorTicks.map(y => (
                <line
                  key={`y-maj-${y}`}
                  x1={10}
                  y1={y}
                  x2={24}
                  y2={y}
                  stroke={majorColor}
                  strokeWidth="1.5"
                />
              ))}
            </svg>

            {/* Numeric Labels along left edge */}
            {yMajorTicks.map(y => (
              <div
                key={`y-lbl-${y}`}
                className={`absolute left-0.5 text-[8px] font-bold ${textColor} leading-none pointer-events-none transform -translate-y-1/2`}
                style={{ top: `${y}px` }}
              >
                {y}
              </div>
            ))}

            {/* Axis Unit Tag at Bottom Left */}
            <div
              className="absolute left-1 bottom-14 text-[8px] font-bold text-amber-400/90 tracking-wider pointer-events-none"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              Y-AXIS (px)
            </div>
          </div>

          {/* BOTTOM RIGHT COORDINATE CALIBRATION HUD BADGE */}
          <div className="absolute bottom-3 left-10 hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-sky-500/30 font-mono text-[9.5px] text-zinc-300 shadow-lg pointer-events-none">
            <span className="flex items-center gap-1 text-sky-400 font-bold">
              <Ruler size={11} />
              <span>Grid Scale:</span>
            </span>
            <span className="text-white font-bold">{minorStep}px (~{(minorStep * 0.264).toFixed(1)} mm)</span>
            <span className="text-zinc-500">|</span>
            <span className="text-amber-400 font-bold">Major: {majorStep}px</span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. FLOATING QUICK GRID ON/OFF SWITCH BUTTON                    */}
      {/* Allows users to view clear app or drafting grid instantly     */}
      {/* ------------------------------------------------------------- */}
      <div className="fixed bottom-4 right-4 z-40 flex items-center select-none">
        <button
          type="button"
          onClick={onToggleGrid}
          title={
            showGrid
              ? 'Click to turn OFF Blueprint Grid (View Clear Application Interface)'
              : 'Click to turn ON Blueprint Grid & Numeric Coordinate Rulers'
          }
          className={`group flex items-center gap-2 px-3 py-2 rounded-full border shadow-xl transition-all duration-200 cursor-pointer active:scale-95 font-mono text-xs font-bold backdrop-blur-md ${
            showGrid
              ? 'border-sky-400 bg-sky-950/85 text-sky-200 hover:bg-sky-900 shadow-[0_0_15px_rgba(56,189,248,0.35)] ring-1 ring-sky-400/40'
              : 'border-[var(--steel-line)] bg-zinc-900/85 text-[var(--text-dim)] hover:text-white hover:border-amber-400/60 shadow-lg'
          }`}
        >
          {showGrid ? (
            <>
              <div className="relative flex items-center justify-center">
                <Grid size={15} className="text-sky-400 animate-pulse" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <span className="flex items-center gap-1">
                <span>Grid:</span>
                <span className="text-emerald-400 font-black">ON</span>
                <span className="text-[10px] text-sky-300/80 font-normal hidden sm:inline">({minorStep}px)</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white font-sans font-semibold flex items-center gap-1 ml-0.5 group-hover:bg-rose-500/30 group-hover:text-rose-200 transition">
                <EyeOff size={11} />
                <span className="hidden sm:inline">Clear View</span>
              </span>
            </>
          ) : (
            <>
              <Grid size={14} className="text-zinc-400 group-hover:text-amber-400 transition-colors" />
              <span className="flex items-center gap-1">
                <span className="text-zinc-400 group-hover:text-zinc-200">Grid:</span>
                <span className="text-zinc-400 font-bold group-hover:text-amber-400">OFF</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-sans font-semibold flex items-center gap-1 ml-0.5 group-hover:bg-amber-500 group-hover:text-black transition">
                <Eye size={11} />
                <span className="hidden sm:inline">Show Grid</span>
              </span>
            </>
          )}
        </button>
      </div>
    </>
  );
};
