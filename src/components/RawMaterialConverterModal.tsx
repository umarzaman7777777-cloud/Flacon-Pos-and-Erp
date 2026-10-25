import React, { useState } from 'react';
import {
  Scale,
  Package,
  ArrowLeftRight,
  X,
  Copy,
  Check,
  Calculator,
  Ruler,
  Info
} from 'lucide-react';

interface RawMaterialConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyWeight?: (weightValue: string, unit: 'kg' | 'grams') => void;
  onApplyQuantity?: (itemCount: string, unit: string) => void;
  isInline?: boolean;
}

type ConverterTab = 'weight' | 'packaging' | 'length';

export const RawMaterialConverterModal: React.FC<RawMaterialConverterModalProps> = ({
  isOpen,
  onClose,
  onApplyWeight,
  onApplyQuantity,
  isInline = false
}) => {
  const [activeTab, setActiveTab] = useState<ConverterTab>('weight');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Weight Converter State
  const [weightValue, setWeightValue] = useState<string>('1');
  const [weightFromUnit, setWeightFromUnit] = useState<'ton' | 'kg' | 'grams' | 'maund' | 'quintal' | 'lbs'>('ton');

  // Packaging / Quantity Calculator State
  const [packCount, setPackCount] = useState<string>('10');
  const [packType, setPackType] = useState<string>('Bundles');
  const [itemsPerPack, setItemsPerPack] = useState<string>('20');
  const [targetItemUnit, setTargetItemUnit] = useState<string>('Pcs');

  // Length Converter State
  const [lengthValue, setLengthValue] = useState<string>('20');
  const [lengthFromUnit, setLengthFromUnit] = useState<'feet' | 'meters' | 'inches'>('feet');

  if (!isOpen && !isInline) return null;

  // Conversion calculations
  const numWeight = parseFloat(weightValue) || 0;

  // Normalize weight to kg
  let weightInKg = 0;
  switch (weightFromUnit) {
    case 'ton':
      weightInKg = numWeight * 1000;
      break;
    case 'kg':
      weightInKg = numWeight;
      break;
    case 'grams':
      weightInKg = numWeight / 1000;
      break;
    case 'maund':
      weightInKg = numWeight * 40; // 1 Maund/Mun = 40 kg
      break;
    case 'quintal':
      weightInKg = numWeight * 100; // 1 Quintal = 100 kg
      break;
    case 'lbs':
      weightInKg = numWeight * 0.45359237;
      break;
  }

  const weightConversions = {
    ton: weightInKg / 1000,
    kg: weightInKg,
    grams: weightInKg * 1000,
    maund: weightInKg / 40,
    quintal: weightInKg / 100,
    lbs: weightInKg * 2.20462
  };

  // Packaging calculations
  const numPacks = parseFloat(packCount) || 0;
  const numItemsPerPack = parseFloat(itemsPerPack) || 0;
  const totalCalculatedQuantity = Math.round(numPacks * numItemsPerPack);

  // Length calculations
  const numLength = parseFloat(lengthValue) || 0;
  let lengthInMeters = 0;
  switch (lengthFromUnit) {
    case 'feet':
      lengthInMeters = numLength * 0.3048;
      break;
    case 'meters':
      lengthInMeters = numLength;
      break;
    case 'inches':
      lengthInMeters = numLength * 0.0254;
      break;
  }

  const lengthConversions = {
    feet: lengthInMeters / 0.3048,
    meters: lengthInMeters,
    inches: lengthInMeters / 0.0254
  };

  const handleCopy = (val: string, key: string) => {
    navigator.clipboard?.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const formatNumber = (num: number, maxDigits = 4): string => {
    if (isNaN(num)) return '0';
    return Number(num.toFixed(maxDigits)).toLocaleString(undefined, {
      maximumFractionDigits: maxDigits
    });
  };

  const content = (
    <div className="flex flex-col space-y-3 font-mono text-xs">
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-2 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <div className="p-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400">
            <Calculator size={15} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[var(--text)] flex items-center gap-1.5">
              <span>Raw Material Converter</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] text-sky-300 font-normal">
                Reference Tool
              </span>
            </h3>
            <p className="text-[10px] text-[var(--text-dim)]">
              Convert tons, maunds, kg, grams, and packaging bundle quantities.
            </p>
          </div>
        </div>

        {!isInline && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] cursor-pointer"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)]">
        <button
          type="button"
          onClick={() => setActiveTab('weight')}
          className={`flex-1 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeTab === 'weight'
              ? 'bg-amber-500 text-black font-bold shadow'
              : 'text-[var(--text-dim)] hover:text-[var(--text)]'
          }`}
        >
          <Scale size={13} />
          <span>Weight (Tons / kg / g / Maund)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('packaging')}
          className={`flex-1 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeTab === 'packaging'
              ? 'bg-sky-500 text-black font-bold shadow'
              : 'text-[var(--text-dim)] hover:text-[var(--text)]'
          }`}
        >
          <Package size={13} />
          <span>Packaging (Packs → Items)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('length')}
          className={`py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeTab === 'length'
              ? 'bg-purple-500 text-white font-bold shadow'
              : 'text-[var(--text-dim)] hover:text-[var(--text)]'
          }`}
        >
          <Ruler size={13} />
          <span>Length (Pipe/Feet)</span>
        </button>
      </div>

      {/* TAB 1: WEIGHT CONVERTER */}
      {activeTab === 'weight' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* Input Controls */}
          <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
            <div className="text-[10px] uppercase text-[var(--text-dim)] font-bold">
              Enter Input Weight & Unit:
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                value={weightValue}
                onChange={e => setWeightValue(e.target.value)}
                placeholder="e.g. 2.5"
                className="flex-1 bg-[var(--panel)] border border-amber-500/40 rounded-lg px-3 py-2 text-sm text-[var(--text)] font-mono font-bold focus:outline-none focus:border-amber-400"
              />
              <select
                value={weightFromUnit}
                onChange={e => setWeightFromUnit(e.target.value as any)}
                className="w-40 bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] font-semibold cursor-pointer"
              >
                <option value="ton">Metric Tons (MT / Ton)</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="grams">Grams (g)</option>
                <option value="maund">Maund / Mun (40 kg)</option>
                <option value="quintal">Quintal (100 kg)</option>
                <option value="lbs">Pounds (lbs)</option>
              </select>
            </div>

            {/* Quick preset chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px]">
              <span className="text-[var(--text-dim)]">Quick presets:</span>
              <button
                type="button"
                onClick={() => { setWeightValue('1'); setWeightFromUnit('ton'); }}
                className="px-2 py-0.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] hover:border-amber-400 transition"
              >
                1 Ton
              </button>
              <button
                type="button"
                onClick={() => { setWeightValue('2.5'); setWeightFromUnit('ton'); }}
                className="px-2 py-0.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] hover:border-amber-400 transition"
              >
                2.5 Tons
              </button>
              <button
                type="button"
                onClick={() => { setWeightValue('500'); setWeightFromUnit('grams'); }}
                className="px-2 py-0.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] hover:border-amber-400 transition"
              >
                500 g
              </button>
              <button
                type="button"
                onClick={() => { setWeightValue('1'); setWeightFromUnit('maund'); }}
                className="px-2 py-0.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] hover:border-amber-400 transition"
              >
                1 Maund (من)
              </button>
              <button
                type="button"
                onClick={() => { setWeightValue('100'); setWeightFromUnit('kg'); }}
                className="px-2 py-0.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] hover:border-amber-400 transition"
              >
                100 kg
              </button>
            </div>
          </div>

          {/* Real-time Equivalent Outputs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {/* Kilograms (kg) - PRIMARY */}
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] text-amber-400 uppercase font-semibold">
                <span>Kilograms (kg)</span>
                <button
                  type="button"
                  onClick={() => handleCopy(formatNumber(weightConversions.kg), 'kg')}
                  className="hover:text-amber-200 transition"
                  title="Copy value"
                >
                  {copiedKey === 'kg' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                </button>
              </div>
              <div className="text-base sm:text-lg font-bold text-amber-300 font-mono mt-0.5 truncate">
                {formatNumber(weightConversions.kg)} <span className="text-xs font-normal">kg</span>
              </div>
              {onApplyWeight && (
                <button
                  type="button"
                  onClick={() => onApplyWeight(String(weightConversions.kg), 'kg')}
                  className="mt-1.5 w-full py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] uppercase transition cursor-pointer"
                >
                  Use in Entry (kg)
                </button>
              )}
            </div>

            {/* Grams (g) */}
            <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] uppercase font-semibold">
                <span>Grams (g)</span>
                <button
                  type="button"
                  onClick={() => handleCopy(formatNumber(weightConversions.grams), 'g')}
                  className="hover:text-[var(--text)] transition"
                  title="Copy value"
                >
                  {copiedKey === 'g' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                </button>
              </div>
              <div className="text-base sm:text-lg font-bold text-[var(--text)] font-mono mt-0.5 truncate">
                {formatNumber(weightConversions.grams, 2)} <span className="text-xs font-normal">g</span>
              </div>
              {onApplyWeight && (
                <button
                  type="button"
                  onClick={() => onApplyWeight(String(weightConversions.grams), 'grams')}
                  className="mt-1.5 w-full py-1 rounded bg-[var(--panel)] hover:bg-amber-500 hover:text-black border border-[var(--steel-line)] text-[var(--text-dim)] font-bold text-[10px] uppercase transition cursor-pointer"
                >
                  Use in Entry (g)
                </button>
              )}
            </div>

            {/* Metric Tons (MT) */}
            <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] uppercase font-semibold">
                <span>Metric Tons (MT)</span>
                <button
                  type="button"
                  onClick={() => handleCopy(formatNumber(weightConversions.ton), 'ton')}
                  className="hover:text-[var(--text)] transition"
                  title="Copy value"
                >
                  {copiedKey === 'ton' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                </button>
              </div>
              <div className="text-base sm:text-lg font-bold text-[var(--text)] font-mono mt-0.5 truncate">
                {formatNumber(weightConversions.ton, 4)} <span className="text-xs font-normal">Tons</span>
              </div>
              <div className="text-[9px] text-[var(--text-dim)] mt-1">1 MT = 1,000 kg</div>
            </div>

            {/* Maund / Mun (من) */}
            <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] uppercase font-semibold">
                <span>Maund (من)</span>
                <button
                  type="button"
                  onClick={() => handleCopy(formatNumber(weightConversions.maund), 'maund')}
                  className="hover:text-[var(--text)] transition"
                  title="Copy value"
                >
                  {copiedKey === 'maund' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                </button>
              </div>
              <div className="text-base sm:text-lg font-bold text-[var(--text)] font-mono mt-0.5 truncate">
                {formatNumber(weightConversions.maund, 3)} <span className="text-xs font-normal">Maunds</span>
              </div>
              <div className="text-[9px] text-[var(--text-dim)] mt-1">1 Maund = 40 kg</div>
            </div>

            {/* Quintals (100 kg) */}
            <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] uppercase font-semibold">
                <span>Quintals</span>
                <button
                  type="button"
                  onClick={() => handleCopy(formatNumber(weightConversions.quintal), 'quintal')}
                  className="hover:text-[var(--text)] transition"
                  title="Copy value"
                >
                  {copiedKey === 'quintal' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                </button>
              </div>
              <div className="text-base sm:text-lg font-bold text-[var(--text)] font-mono mt-0.5 truncate">
                {formatNumber(weightConversions.quintal, 3)} <span className="text-xs font-normal">q</span>
              </div>
              <div className="text-[9px] text-[var(--text-dim)] mt-1">1 Quintal = 100 kg</div>
            </div>

            {/* Pounds (lbs) */}
            <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] uppercase font-semibold">
                <span>Pounds (lbs)</span>
                <button
                  type="button"
                  onClick={() => handleCopy(formatNumber(weightConversions.lbs), 'lbs')}
                  className="hover:text-[var(--text)] transition"
                  title="Copy value"
                >
                  {copiedKey === 'lbs' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                </button>
              </div>
              <div className="text-base sm:text-lg font-bold text-[var(--text)] font-mono mt-0.5 truncate">
                {formatNumber(weightConversions.lbs, 2)} <span className="text-xs font-normal">lbs</span>
              </div>
              <div className="text-[9px] text-[var(--text-dim)] mt-1">1 kg ≈ 2.2046 lbs</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PACKAGING / QUANTITY CALCULATOR */}
      {activeTab === 'packaging' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2.5">
            <div className="text-[10px] uppercase text-[var(--text-dim)] font-bold">
              Calculate Total Items from Packs / Bundles:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-[var(--text-dim)] mb-1">Number of Packs</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    step="1"
                    value={packCount}
                    onChange={e => setPackCount(e.target.value)}
                    placeholder="e.g. 15"
                    className="flex-1 bg-[var(--panel)] border border-sky-500/40 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] font-mono font-bold focus:outline-none"
                  />
                  <select
                    value={packType}
                    onChange={e => setPackType(e.target.value)}
                    className="w-24 bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2 py-1.5 text-[11px] text-[var(--text)]"
                  >
                    <option value="Bundles">Bundles</option>
                    <option value="Boxes">Boxes</option>
                    <option value="Cartons">Cartons</option>
                    <option value="Crates">Crates</option>
                    <option value="Bags">Bags</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-dim)] mb-1">Items per Pack</label>
                <input
                  type="number"
                  step="1"
                  value={itemsPerPack}
                  onChange={e => setItemsPerPack(e.target.value)}
                  placeholder="e.g. 24"
                  className="w-full bg-[var(--panel)] border border-sky-500/40 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] font-mono font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-dim)] mb-1">Output Unit</label>
                <select
                  value={targetItemUnit}
                  onChange={e => setTargetItemUnit(e.target.value)}
                  className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] cursor-pointer"
                >
                  <option value="Pcs">Pcs (Pieces)</option>
                  <option value="Nos">Nos (Numbers)</option>
                  <option value="Units">Units</option>
                  <option value="Sets">Sets</option>
                </select>
              </div>
            </div>
          </div>

          {/* Packaging Result Card */}
          <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-[10px] uppercase text-sky-400 font-bold">
                Calculated Total Item Count:
              </div>
              <div className="text-xl sm:text-2xl font-black text-sky-300 font-mono mt-0.5">
                {totalCalculatedQuantity.toLocaleString()}{' '}
                <span className="text-sm font-normal text-sky-400/80">{targetItemUnit}</span>
              </div>
              <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                Formula: {packCount || '0'} {packType} × {itemsPerPack || '0'} items/{packType.slice(0, -1)}
              </div>
            </div>

            {onApplyQuantity && (
              <button
                type="button"
                onClick={() => onApplyQuantity(String(totalCalculatedQuantity), targetItemUnit)}
                className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs uppercase shadow transition cursor-pointer"
              >
                Use in Entry ({totalCalculatedQuantity} {targetItemUnit})
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LENGTH CONVERTER */}
      {activeTab === 'length' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
            <div className="text-[10px] uppercase text-[var(--text-dim)] font-bold">
              Pipe & Raw Rod Length Converter:
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                value={lengthValue}
                onChange={e => setLengthValue(e.target.value)}
                placeholder="e.g. 20"
                className="flex-1 bg-[var(--panel)] border border-purple-500/40 rounded-lg px-3 py-2 text-sm text-[var(--text)] font-mono font-bold focus:outline-none"
              />
              <select
                value={lengthFromUnit}
                onChange={e => setLengthFromUnit(e.target.value as any)}
                className="w-36 bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] font-semibold cursor-pointer"
              >
                <option value="feet">Feet (ft)</option>
                <option value="meters">Meters (m)</option>
                <option value="inches">Inches (in)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
              <div className="text-[10px] text-[var(--text-dim)] uppercase">Feet (ft)</div>
              <div className="text-base font-bold text-[var(--text)] font-mono mt-0.5">
                {formatNumber(lengthConversions.feet, 2)} ft
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
              <div className="text-[10px] text-[var(--text-dim)] uppercase">Meters (m)</div>
              <div className="text-base font-bold text-[var(--text)] font-mono mt-0.5">
                {formatNumber(lengthConversions.meters, 3)} m
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
              <div className="text-[10px] text-[var(--text-dim)] uppercase">Inches (in)</div>
              <div className="text-base font-bold text-[var(--text)] font-mono mt-0.5">
                {formatNumber(lengthConversions.inches, 1)} in
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Helpful reference note */}
      <div className="p-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[10px] text-[var(--text-dim)] flex items-center gap-1.5">
        <Info size={12} className="text-amber-400 shrink-0" />
        <span>
          <strong>Pro-tip:</strong> Steel mill delivery bills usually quote in Metric Tons or Maunds. Use this converter to enter precise kg in the raw material ledger.
        </span>
      </div>
    </div>
  );

  if (isInline) {
    return (
      <div className="w-full bg-[var(--panel)] border border-sky-500/30 rounded-xl p-3 shadow-md">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-xs font-mono">
      <div className="w-full max-w-lg bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-4 sm:p-5 shadow-2xl animate-in fade-in duration-150">
        {content}
      </div>
    </div>
  );
};
