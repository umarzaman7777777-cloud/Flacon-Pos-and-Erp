import React, { useState } from 'react';
import { Minus, Plus, Edit3, Check } from 'lucide-react';
import { hapticQuantityChange } from '../utils/haptics';

export interface TouchRangeSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  unit?: string;
  label?: string;
  presets?: number[];
  secondaryInfo?: string;
  allowManualInput?: boolean;
  colorScheme?: 'amber' | 'emerald' | 'sky' | 'rose';
  className?: string;
}

export const TouchRangeSlider: React.FC<TouchRangeSliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
  unit = 'pcs',
  label,
  presets,
  secondaryInfo,
  allowManualInput = true,
  colorScheme = 'amber',
  className = ''
}) => {
  const [isManualInput, setIsManualInput] = useState(false);
  const [tempManualVal, setTempManualVal] = useState(String(value));

  // Percentage for track highlight
  const percent = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const handleChange = (newVal: number) => {
    const clamped = Math.min(max, Math.max(min, newVal));
    const rounded = step < 1 ? Math.round(clamped * 100) / 100 : Math.round(clamped);
    if (rounded !== value) {
      hapticQuantityChange();
      onChange(rounded);
    }
  };

  const handleStep = (delta: number) => {
    handleChange(value + delta);
  };

  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseFloat(tempManualVal);
    if (!isNaN(parsed)) {
      handleChange(parsed);
    }
    setIsManualInput(false);
  };

  const schemeColors = {
    amber: {
      accent: 'accent-amber-400',
      track: 'bg-amber-400',
      badge: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
      activeBtn: 'bg-amber-500 text-black border-amber-500',
      thumbBorder: 'border-amber-400'
    },
    emerald: {
      accent: 'accent-emerald-400',
      track: 'bg-emerald-400',
      badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
      activeBtn: 'bg-emerald-500 text-white border-emerald-500',
      thumbBorder: 'border-emerald-400'
    },
    sky: {
      accent: 'accent-sky-400',
      track: 'bg-sky-400',
      badge: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
      activeBtn: 'bg-sky-500 text-white border-sky-500',
      thumbBorder: 'border-sky-400'
    },
    rose: {
      accent: 'accent-rose-400',
      track: 'bg-rose-400',
      badge: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
      activeBtn: 'bg-rose-500 text-white border-rose-500',
      thumbBorder: 'border-rose-400'
    }
  }[colorScheme];

  return (
    <div className={`space-y-2 select-none ${className}`}>
      {/* Top Header Row with Value Badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {label && (
          <span className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider font-semibold">
            {label}
          </span>
        )}

        {/* Value Display / Manual Input Toggle */}
        <div className="flex items-center gap-1.5 ml-auto">
          {isManualInput ? (
            <form onSubmit={handleManualSubmit} className="flex items-center gap-1">
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={tempManualVal}
                onChange={e => setTempManualVal(e.target.value)}
                autoFocus
                className="w-20 px-2 py-0.5 rounded bg-[var(--panel-raised)] border border-amber-400 text-xs font-mono font-bold text-amber-300 text-center focus:outline-none"
              />
              <button
                type="submit"
                className="p-1 rounded bg-amber-500 text-black hover:bg-amber-400 transition"
                title="Save manual value"
              >
                <Check size={12} />
              </button>
            </form>
          ) : (
            <div
              onClick={() => {
                if (allowManualInput) {
                  setTempManualVal(String(value));
                  setIsManualInput(true);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-xs font-bold transition ${schemeColors.badge} ${
                allowManualInput ? 'cursor-pointer hover:border-amber-400/60' : ''
              }`}
              title={allowManualInput ? 'Tap to enter exact number' : undefined}
            >
              <span className="text-sm font-black">{value > 0 && min < 0 ? `+${value}` : value}</span>
              <span className="text-[10px] opacity-80">{unit}</span>
              {allowManualInput && <Edit3 size={10} className="opacity-60 hover:opacity-100 ml-0.5" />}
            </div>
          )}
        </div>
      </div>

      {/* Secondary Calculation info (e.g. Weight calculation, line subtotal) */}
      {secondaryInfo && (
        <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
          <span>{secondaryInfo}</span>
        </div>
      )}

      {/* Touch-Friendly Slider Track & Stepper Controls */}
      <div className="flex items-center gap-2">
        {/* Large Touch Decrement Button */}
        <button
          type="button"
          onClick={() => handleStep(-step)}
          disabled={value <= min}
          className="w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-400/50 text-[var(--text)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition shadow-xs cursor-pointer touch-manipulation"
          aria-label="Decrease quantity"
        >
          <Minus size={15} />
        </button>

        {/* Native Range Slider with Touch-Enhanced Styling */}
        <div className="relative flex-1 flex items-center py-2">
          {/* Custom Track Background with Highlight */}
          <div className="absolute inset-x-0 h-3 rounded-full bg-[var(--panel-raised)] border border-[var(--steel-line)] overflow-hidden pointer-events-none">
            <div
              className={`h-full opacity-80 ${schemeColors.track}`}
              style={{ width: `${percent}%` }}
            />
          </div>

          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => handleChange(parseFloat(e.target.value) || min)}
            className={`relative z-10 w-full h-7 bg-transparent appearance-none cursor-pointer focus:outline-none touch-none ${schemeColors.accent}`}
            aria-label={label || 'Quantity slider'}
          />
        </div>

        {/* Large Touch Increment Button */}
        <button
          type="button"
          onClick={() => handleStep(step)}
          disabled={value >= max}
          className="w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-400/50 text-[var(--text)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition shadow-xs cursor-pointer touch-manipulation"
          aria-label="Increase quantity"
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Preset Pills for 1-Tap Mobile Selection */}
      {presets && presets.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {presets.map(pVal => {
            const isSelected = value === pVal;
            return (
              <button
                key={pVal}
                type="button"
                onClick={() => handleChange(pVal)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition cursor-pointer active:scale-95 touch-manipulation ${
                  isSelected
                    ? schemeColors.activeBtn
                    : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-amber-400/40'
                }`}
              >
                {pVal > 0 && min < 0 ? `+${pVal}` : pVal} {unit}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
