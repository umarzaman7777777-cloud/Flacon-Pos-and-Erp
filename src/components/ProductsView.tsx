import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, SlidersHorizontal, Scale, ShoppingCart, Layers, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { Product, AppLanguage, RecipeItem, RawStockItem } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt } from '../utils/helpers';
import { TouchRangeSlider } from './TouchRangeSlider';

interface ProductsViewProps {
  products: Product[];
  activeCat: string;
  language: AppLanguage;
  rawMaterialNames: string[];
  rawStock?: RawStockItem[];
  productColors: string[];
  productSizes: string[];
  productWeights: string[];
  onAddToCart: (product: Product, color?: string, size?: string, initialQty?: number) => void;
  onSaveProduct: (product: Product, id?: number) => void;
  onDeleteProduct: (id: number) => void;
}

const DEFAULT_NONE_COLOR = 'None (Without Colour / Raw)';
const STANDARD_READY_SIZES = ['R/6"', 'R/12"', 'R/18"', 'R/24"', 'R/30"', 'R/36"', 'R/48"', 'R/60"'];
const STANDARD_WEIGHTS = ['0.45 kg', '0.65 kg', '0.85 kg', '1.15 kg', '1.50 kg', '1.85 kg', '2.45 kg'];
const STANDARD_GAUGES = ['14 Gauge', '16 Gauge', '18 Gauge'];

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  activeCat,
  language,
  rawMaterialNames,
  rawStock = [],
  productColors,
  productSizes,
  productWeights,
  onAddToCart,
  onSaveProduct,
  onDeleteProduct
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [quantityModalProduct, setQuantityModalProduct] = useState<Product | null>(null);
  const [selectedQtyForProduct, setSelectedQtyForProduct] = useState(10);

  // Form State (Stock Quantity removed - products do not define manual finished stock here)
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [color, setColor] = useState(DEFAULT_NONE_COLOR);
  const [customColor, setCustomColor] = useState('');
  const [size, setSize] = useState('R/18"');
  const [weight, setWeight] = useState('0.85 kg');
  const [gauge, setGauge] = useState('16 Gauge');
  const [recipe, setRecipe] = useState<RecipeItem[]>([]);

  // Preserved legacy stock value when editing an existing product that already had one
  const [legacyPreservedStock, setLegacyPreservedStock] = useState<number | undefined>(undefined);
  const [legacyReorderLevel, setLegacyReorderLevel] = useState<number>(5);

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  // Compile full available raw materials list from true rawStock inventory
  const availableRawMaterials = useMemo(() => {
    const list: Array<{
      name: string;
      category?: string;
      unit: 'kg' | 'pcs';
      availableWeight?: number;
      availableQty?: number;
      reorderLevel?: number;
    }> = [];
    const seen = new Set<string>();

    if (rawStock && rawStock.length > 0) {
      rawStock.forEach(rs => {
        const u: 'kg' | 'pcs' = (rs.unit?.toLowerCase() === 'pcs' || rs.unit?.toLowerCase() === 'piece')
          ? 'pcs'
          : (rs.weight !== undefined && rs.weight > 0 ? 'kg' : (rs.quantity !== undefined && rs.quantity > 0 ? 'pcs' : 'kg'));
        
        list.push({
          name: rs.name,
          category: rs.category || 'Raw Material',
          unit: u,
          availableWeight: rs.weight ?? rs.initialWeight ?? 0,
          availableQty: rs.quantity ?? rs.items ?? rs.initialQuantity ?? 0,
          reorderLevel: rs.reorderLevel
        });
        seen.add(rs.name);
      });
    }

    // Merge any registered raw item names not present in rawStock
    (rawMaterialNames || []).forEach(rmName => {
      if (!seen.has(rmName)) {
        const isPipe = rmName.toLowerCase().includes('pipe');
        list.push({
          name: rmName,
          category: isPipe ? 'Raw Material' : 'Fittings',
          unit: isPipe ? 'kg' : 'pcs',
          availableWeight: isPipe ? 350 : 0,
          availableQty: !isPipe ? 1000 : 0
        });
        seen.add(rmName);
      }
    });

    return list;
  }, [rawStock, rawMaterialNames]);

  // Color options: Always ensure 'None (Without Colour / Raw)' is at index 0
  const colorOptions = useMemo(() => {
    const list: string[] = [DEFAULT_NONE_COLOR];
    const defaultPalette = [
      'Matt Black',
      'Shine Black',
      'Pure White',
      'Off-White',
      'Smoke Grey',
      'Silver',
      'Golden',
      'Antique Brass'
    ];
    defaultPalette.forEach(c => {
      if (!list.includes(c)) list.push(c);
    });
    (productColors || []).forEach(c => {
      if (c && !list.includes(c) && !c.toLowerCase().includes('without') && !c.toLowerCase().includes('none')) {
        list.push(c);
      }
    });
    return list;
  }, [productColors]);

  const filteredProducts = products.filter(p => {
    const matchesCat =
      !activeCat ||
      p.cat === activeCat ||
      (activeCat === 'Rod (Ceiling)' &&
        (p.cat === 'Ceiling Fan Down Rod' ||
          p.cat === 'Industrial Down Rod' ||
          p.cat?.toLowerCase().includes('ceiling') ||
          p.cat?.toLowerCase().includes('down rod'))) ||
      (activeCat === 'Rod (Pedestal)' &&
        (p.cat === 'Pedestal Extension Rod' ||
          p.cat === 'Bracket Fan Mounting Rod' ||
          p.cat?.toLowerCase().includes('pedestal')));
    const matchesSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setColor(DEFAULT_NONE_COLOR);
    setCustomColor('');
    setSize('R/18"');
    setWeight('0.85 kg');
    setGauge('16 Gauge');
    setLegacyPreservedStock(undefined);
    setLegacyReorderLevel(5);

    // Initial default recipe based on available true raw materials in stock
    const pipeMat = availableRawMaterials.find(m => m.name.toLowerCase().includes('pipe')) || availableRawMaterials[0];
    const fittingMat = availableRawMaterials.find(m => m.name.toLowerCase().includes('bolt') || m.name.toLowerCase().includes('pin') || m.unit === 'pcs');

    const initialRecipe: RecipeItem[] = [];
    if (pipeMat) {
      initialRecipe.push({
        material: pipeMat.name,
        weightPerUnit: 0.85
      });
    }
    if (fittingMat && fittingMat.name !== pipeMat?.name) {
      initialRecipe.push({
        material: fittingMat.name,
        itemsPerUnit: 1
      });
    }

    setRecipe(initialRecipe.length > 0 ? initialRecipe : [{ material: availableRawMaterials[0]?.name || 'M.S. Steel Pipe', weightPerUnit: 0.85 }]);
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(p.id);
    setName(p.name);
    setPrice(String(p.price));
    
    // Check color matching
    const pColor = p.color || DEFAULT_NONE_COLOR;
    const isNone = pColor.toLowerCase().includes('none') || pColor.toLowerCase().includes('without') || pColor.toLowerCase().includes('raw');
    if (isNone) {
      setColor(DEFAULT_NONE_COLOR);
      setCustomColor('');
    } else if (colorOptions.includes(pColor)) {
      setColor(pColor);
      setCustomColor('');
    } else {
      setColor('Other');
      setCustomColor(pColor);
    }

    setSize(p.size || 'R/18"');
    setWeight(p.weight || '0.85 kg');
    setGauge(p.gauge || '16 Gauge');
    setLegacyPreservedStock(p.stock);
    setLegacyReorderLevel(p.reorderLevel ?? 5);
    setRecipe(p.recipe ? [...p.recipe] : []);
    setModalOpen(true);
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this product?')) {
      onDeleteProduct(id);
    }
  };

  const handleAddRecipeRow = () => {
    const firstMat = availableRawMaterials[0];
    const defaultName = firstMat?.name || 'M.S. Steel Pipe';
    const isPcs = firstMat?.unit === 'pcs';
    setRecipe([
      ...recipe,
      isPcs
        ? { material: defaultName, itemsPerUnit: 1 }
        : { material: defaultName, weightPerUnit: 0.85 }
    ]);
  };

  const handleRemoveRecipeRow = (index: number) => {
    setRecipe(recipe.filter((_, i) => i !== index));
  };

  const handleRecipeMaterialChange = (index: number, newMaterialName: string) => {
    const foundMat = availableRawMaterials.find(m => m.name === newMaterialName);
    const updated = [...recipe];
    const isPcs = foundMat?.unit === 'pcs';
    
    updated[index] = {
      material: newMaterialName,
      weightPerUnit: isPcs ? undefined : (updated[index].weightPerUnit || 0.85),
      itemsPerUnit: isPcs ? (updated[index].itemsPerUnit || 1) : undefined
    };
    setRecipe(updated);
  };

  const handleRecipeValueChange = (index: number, field: 'weightPerUnit' | 'itemsPerUnit', val: number) => {
    const updated = [...recipe];
    updated[index] = {
      ...updated[index],
      [field]: val
    };
    setRecipe(updated);
  };

  // Toggle unit mode between weight (kg) and pieces (pcs)
  const handleToggleUnitMode = (index: number) => {
    const updated = [...recipe];
    const row = updated[index];
    if (row.weightPerUnit !== undefined) {
      updated[index] = {
        material: row.material,
        itemsPerUnit: 1,
        weightPerUnit: undefined
      };
    } else {
      updated[index] = {
        material: row.material,
        weightPerUnit: 0.85,
        itemsPerUnit: undefined
      };
    }
    setRecipe(updated);
  };

  // Quick auto-naming helper based on selected size, weight, and color
  const handleAutoSuggestName = () => {
    const cleanSize = size.replace(/[^\d]/g, '') || '18';
    const cleanColor = color === DEFAULT_NONE_COLOR ? 'Raw' : (color === 'Other' ? customColor.replace(/\s+/g, '-') : color.replace(/\s+/g, '-'));
    const generated = `Ceiling-Fan-Rod-${cleanSize}-${cleanColor}`;
    setName(generated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalColor = color === 'Other'
      ? (customColor.trim() || 'Custom')
      : color;

    // Filter valid recipe items
    const cleanedRecipe = recipe
      .filter(r => r.material && r.material.trim())
      .map(r => ({
        material: r.material.trim(),
        weightPerUnit: typeof r.weightPerUnit === 'number' && r.weightPerUnit > 0 ? r.weightPerUnit : undefined,
        itemsPerUnit: typeof r.itemsPerUnit === 'number' && r.itemsPerUnit > 0 ? Math.round(r.itemsPerUnit) : undefined
      }));

    const prod: Product = {
      id: editingId ?? Date.now(),
      name: name.trim(),
      price: parseFloat(price) || 0,
      cat: activeCat || 'Rod (Ceiling)',
      color: finalColor,
      size: size.trim(),
      weight: weight.trim(),
      gauge: gauge.trim(),
      // Stock quantity is NOT mentioned or arbitrarily assigned
      stock: legacyPreservedStock,
      reorderLevel: legacyReorderLevel,
      recipe: cleanedRecipe
    };

    onSaveProduct(prod, editingId || undefined);
    setModalOpen(false);
  };

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden break-words">
      {/* Category header & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-serif font-black text-xl text-[var(--text)]">
            {activeCat || 'All Rod Products'}
          </h2>
          <span className="text-xs font-mono text-[var(--text-dim)] bg-[var(--panel-raised)] px-2 py-0.5 rounded-full border border-[var(--steel-line)]">
            {filteredProducts.length} models
          </span>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t('search_products')}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-xs font-mono text-[var(--text)] focus:border-[var(--yellow)] focus:outline-none"
          />
        </div>
      </div>

      {/* Grid of Product Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
        {filteredProducts.map(p => {
          const isLowStock = p.stock !== undefined && p.stock <= (p.reorderLevel ?? 5);
          const hasRecipe = p.recipe && p.recipe.length > 0;
          const isRawColor = !p.color || p.color.toLowerCase().includes('none') || p.color.toLowerCase().includes('without') || p.color.toLowerCase().includes('raw');

          return (
            <div
              key={p.id}
              onClick={() => onAddToCart(p)}
              className="group relative bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] rounded-xl p-3.5 flex flex-col justify-between cursor-pointer transition-all duration-150 hover:-translate-y-0.5 shadow-sm active:scale-[0.98]"
            >
              {/* Top Row: recipe status & actions */}
              <div className="flex items-center justify-between mb-2">
                <span
                  title={hasRecipe ? `${p.recipe?.length} Raw Materials Linked (BOM)` : 'No recipe linked'}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 ${
                    hasRecipe
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-zinc-500/10 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  <Layers size={10} />
                  <span>{hasRecipe ? `${p.recipe?.length} Mat` : 'No BOM'}</span>
                </span>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setQuantityModalProduct(p);
                      setSelectedQtyForProduct(10);
                    }}
                    className="p-1 rounded bg-[var(--panel-raised)] hover:text-amber-400 border border-[var(--steel-line)] text-zinc-400 transition cursor-pointer"
                    title="Select quantity & weight with touch slider"
                  >
                    <SlidersHorizontal size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={e => handleOpenEdit(p, e)}
                    className="p-1 rounded bg-[var(--panel-raised)] hover:text-[var(--yellow)] border border-[var(--steel-line)] transition cursor-pointer"
                    title="Edit Model & Recipe"
                  >
                    <Edit2 size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={e => handleDelete(p.id, e)}
                    className="p-1 rounded bg-[var(--panel-raised)] hover:text-red-400 border border-[var(--steel-line)] transition"
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              {/* Product Info */}
              <div className="space-y-1.5 my-1">
                <h4 className="font-semibold text-xs sm:text-sm text-[var(--text)] line-clamp-2 leading-tight">
                  {p.name}
                </h4>
                
                <div className="flex flex-wrap items-center gap-1">
                  {/* Color tag */}
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                    isRawColor
                      ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                  }`}>
                    {isRawColor ? 'Raw / Unpainted' : p.color}
                  </span>

                  {/* Ready Size */}
                  {p.size && (
                    <span className="text-[10px] font-mono text-zinc-400 bg-black/30 px-1.5 py-0.2 rounded border border-[var(--steel-line)]">
                      {p.size}
                    </span>
                  )}

                  {/* Weight */}
                  {p.weight && (
                    <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-0.5">
                      <Scale size={9} />
                      {p.weight}
                    </span>
                  )}
                </div>
              </div>

              {/* Footer: price & stock status (stock is optional, no manual stock required) */}
              <div className="pt-2 border-t border-[var(--steel-line)]/50 mt-2 flex items-baseline justify-between font-mono">
                <div className="text-sm font-bold text-[var(--yellow)]">{fmt(p.price)}</div>
                {p.stock !== undefined && (
                  <span
                    className={`text-[10px] font-semibold ${
                      isLowStock ? 'text-red-400 font-bold animate-pulse' : 'text-[var(--text-dim)]'
                    }`}
                  >
                    {p.stock} left
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Product Card */}
        <button
          type="button"
          onClick={handleOpenAdd}
          className="border-2 border-dashed border-[var(--steel-line)] hover:border-[var(--yellow)] rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-[var(--text-dim)] hover:text-[var(--yellow)] min-h-[140px] transition cursor-pointer"
        >
          <div className="w-9 h-9 rounded-full bg-[var(--panel-raised)] flex items-center justify-center border border-[var(--steel-line)]">
            <Plus size={18} />
          </div>
          <span className="font-mono text-xs font-bold uppercase tracking-wider">Add Rod Product</span>
          <span className="text-[10px] text-zinc-500 text-center">Define size, colour & raw BOM</span>
        </button>
      </div>

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl shadow-2xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--steel-line)] flex items-center justify-between bg-[var(--panel-raised)]/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Layers size={16} />
                </div>
                <div>
                  <h3 className="font-serif font-black text-base sm:text-lg text-[var(--text)]">
                    {editingId ? 'Edit Rod Product & Recipe' : 'Add New Rod Product'}
                  </h3>
                  <p className="text-[11px] font-mono text-[var(--text-dim)]">
                    Configure specifications & raw material BOM deduction
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 font-mono text-xs overflow-y-auto flex-1">
              {/* Product Name & Suggestion */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[var(--text-dim)] uppercase tracking-wider text-[11px] font-bold">
                    Product Name
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoSuggestName}
                    className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition"
                    title="Auto-generate name based on size and finish"
                  >
                    <Sparkles size={11} />
                    <span>Auto-Suggest Name</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. American-Plain-Tikka-Tala or Ceiling-Fan-Rod-18-Deluxe"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text)] focus:outline-none transition"
                />
              </div>

              {/* Price (Rs) - Stock Quantity is NOT mentioned or required */}
              <div>
                <label className="block text-[var(--text-dim)] uppercase tracking-wider text-[11px] font-bold mb-1">
                  Price (PKR / Rs)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400 font-bold text-xs">
                    Rs.
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="380"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-xl pl-12 pr-3.5 py-2.5 text-sm font-bold text-[var(--text)] focus:outline-none transition"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Sale rate charged to fan workshop or customer at checkout.
                </p>
              </div>

              {/* Color Selection - Includes 'None / Without Colour' */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[var(--text-dim)] uppercase tracking-wider text-[11px] font-bold">
                    Colour / Surface Finish
                  </label>
                  <span className="text-[10px] text-amber-400 font-sans">
                    Includes 'None / Without' for raw unpainted rods
                  </span>
                </div>
                
                <select
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-xl px-3 py-2.5 text-xs text-[var(--text)] focus:outline-none transition"
                >
                  {colorOptions.map(c => (
                    <option key={c} value={c}>
                      {c === DEFAULT_NONE_COLOR ? '● None (Without Colour / Raw Steel Rod)' : c}
                    </option>
                  ))}
                  <option value="Other">Other Custom Colour…</option>
                </select>

                {color === DEFAULT_NONE_COLOR && (
                  <div className="mt-1.5 p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60 text-[10px] text-zinc-300 flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    <span>Raw Unpainted Finish: Can be supplied directly or logged into Paint Ledger for coating.</span>
                  </div>
                )}

                {color === 'Other' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      required
                      value={customColor}
                      onChange={e => setCustomColor(e.target.value)}
                      placeholder="Type custom colour or finish name (e.g. Copper Bronze)..."
                      className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-xl px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Ready Product Size & Standard Presets */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[var(--text-dim)] uppercase tracking-wider text-[11px] font-bold">
                    Ready Product Size (Rod Length)
                  </label>
                  <span className="text-[10px] text-zinc-400">Standard Gujrat Fan Rod Specs</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={size}
                    onChange={e => setSize(e.target.value)}
                    placeholder='e.g. R/12", R/18", 24 inch'
                    className="flex-1 bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-xl px-3 py-2 text-xs text-[var(--text)] focus:outline-none font-bold"
                  />
                </div>

                {/* Quick Selection Touch Chips for Ready Product Size */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[10px] text-zinc-500 mr-1">Ready Sizes:</span>
                  {STANDARD_READY_SIZES.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSize(preset)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition cursor-pointer ${
                        size === preset
                          ? 'bg-amber-500 text-black border-amber-500 font-bold shadow-sm'
                          : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-zinc-300 hover:border-amber-400'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weight & Pipe Gauge Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Weight */}
                <div>
                  <label className="block text-[var(--text-dim)] uppercase tracking-wider text-[11px] font-bold mb-1">
                    Ready Product Weight
                  </label>
                  <input
                    type="text"
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    placeholder="0.85 kg"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-xl px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
                  />
                  <div className="flex items-center gap-1 flex-wrap mt-1.5">
                    {STANDARD_WEIGHTS.slice(0, 5).map(wPreset => (
                      <button
                        key={wPreset}
                        type="button"
                        onClick={() => setWeight(wPreset)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition cursor-pointer ${
                          weight === wPreset
                            ? 'bg-amber-500 text-black border-amber-500 font-bold'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-zinc-400 hover:text-white'
                        }`}
                      >
                        {wPreset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gauge */}
                <div>
                  <label className="block text-[var(--text-dim)] uppercase tracking-wider text-[11px] font-bold mb-1">
                    Pipe Gauge (Wall Thickness)
                  </label>
                  <input
                    type="text"
                    value={gauge}
                    onChange={e => setGauge(e.target.value)}
                    placeholder="16 Gauge"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-xl px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
                  />
                  <div className="flex items-center gap-1 flex-wrap mt-1.5">
                    {STANDARD_GAUGES.map(gPreset => (
                      <button
                        key={gPreset}
                        type="button"
                        onClick={() => setGauge(gPreset)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition cursor-pointer ${
                          gauge === gPreset
                            ? 'bg-amber-500 text-black border-amber-500 font-bold'
                            : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-zinc-400 hover:text-white'
                        }`}
                      >
                        {gPreset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* RAW MATERIAL RECIPE (BOM) SECTION */}
              <div className="pt-3 border-t border-[var(--steel-line)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold uppercase tracking-wider text-amber-400 text-xs flex items-center gap-1.5">
                      <Layers size={13} />
                      Raw Material Recipe (Per Unit)
                    </span>
                    <p className="text-[10px] text-zinc-400">
                      Select true materials in inventory. Deducted automatically by weight & pieces on booking.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRecipeRow}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Add Material</span>
                  </button>
                </div>

                {recipe.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-[var(--steel-line)] text-center text-zinc-500 text-xs">
                    No raw materials linked yet. Click "+ Add Material" to pick true stock items from inventory.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {recipe.map((r, i) => {
                      const matchedStockItem = availableRawMaterials.find(m => m.name === r.material);
                      const isWeightBased = r.weightPerUnit !== undefined || (matchedStockItem?.unit === 'kg' && r.itemsPerUnit === undefined);
                      
                      const availableStockLabel = matchedStockItem
                        ? (matchedStockItem.unit === 'kg'
                            ? `${matchedStockItem.availableWeight ?? 0} kg available`
                            : `${matchedStockItem.availableQty ?? 0} pcs available`)
                        : 'Custom material';

                      // Calculate live capacity
                      const capacityCount = matchedStockItem
                        ? (isWeightBased && (r.weightPerUnit || 0) > 0
                            ? Math.floor((matchedStockItem.availableWeight ?? 0) / (r.weightPerUnit || 1))
                            : (!isWeightBased && (r.itemsPerUnit || 0) > 0
                                ? Math.floor((matchedStockItem.availableQty ?? 0) / (r.itemsPerUnit || 1))
                                : 0))
                        : null;

                      return (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            {/* Raw Material Selector from true inventory */}
                            <div className="flex-1 min-w-0">
                              <select
                                value={r.material}
                                onChange={e => handleRecipeMaterialChange(i, e.target.value)}
                                className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] focus:border-amber-400 focus:outline-none truncate"
                              >
                                {availableRawMaterials.map(mat => (
                                  <option key={mat.name} value={mat.name}>
                                    {mat.name} — ({mat.unit === 'pcs' ? `${mat.availableQty ?? 0} pcs` : `${mat.availableWeight ?? 0} kg`} in stock)
                                  </option>
                                ))}
                                {!availableRawMaterials.some(m => m.name === r.material) && (
                                  <option value={r.material}>{r.material} (Custom)</option>
                                )}
                              </select>
                            </div>

                            {/* Unit Mode Toggle button */}
                            <button
                              type="button"
                              onClick={() => handleToggleUnitMode(i)}
                              className="px-2 py-1 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-[10px] font-bold text-amber-400 hover:border-amber-400 transition cursor-pointer"
                              title="Switch between Weight (kg) and Piece (pcs) deduction"
                            >
                              {isWeightBased ? 'KG' : 'PCS'}
                            </button>

                            {/* Deduction input */}
                            <div className="w-28 shrink-0">
                              {isWeightBased ? (
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={r.weightPerUnit ?? ''}
                                    onChange={e => handleRecipeValueChange(i, 'weightPerUnit', parseFloat(e.target.value) || 0)}
                                    placeholder="0.85"
                                    className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg pl-2 pr-6 py-1.5 text-xs text-[var(--text)] focus:border-amber-400 focus:outline-none font-bold"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">
                                    kg
                                  </span>
                                </div>
                              ) : (
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="1"
                                    min="1"
                                    value={r.itemsPerUnit ?? ''}
                                    onChange={e => handleRecipeValueChange(i, 'itemsPerUnit', parseInt(e.target.value, 10) || 0)}
                                    placeholder="1"
                                    className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg pl-2 pr-7 py-1.5 text-xs text-[var(--text)] focus:border-amber-400 focus:outline-none font-bold"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">
                                    pcs
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Remove row */}
                            <button
                              type="button"
                              onClick={() => handleRemoveRecipeRow(i)}
                              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                              title="Remove raw material from BOM"
                            >
                              ✕
                            </button>
                          </div>

                          {/* Live Balance & Capacity badge */}
                          <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1">
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              <span>True Stock: <strong className="text-zinc-200">{availableStockLabel}</strong></span>
                            </span>
                            {capacityCount !== null && (
                              <span className="text-amber-400 font-mono">
                                Capacity: ~{capacityCount} rods
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-[var(--steel-line)] shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-white transition cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-2 py-2.5 rounded-xl bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow-lg hover:bg-amber-400 active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
                >
                  <CheckCircle2 size={15} />
                  <span>{editingId ? 'Update Rod Product' : 'Save Rod Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Touch-Friendly Quick Quantity & Weight POS Modal */}
      {quantityModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 font-mono animate-in fade-in duration-150">
          <div className="w-full max-w-md max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[var(--steel-line)] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h3 className="font-serif font-black text-base text-[var(--text)] line-clamp-1">
                    {quantityModalProduct.name}
                  </h3>
                  <div className="text-xs text-[var(--text-dim)] flex items-center gap-2 flex-wrap">
                    <span>{fmt(quantityModalProduct.price)} / unit</span>
                    {quantityModalProduct.size && <span>• {quantityModalProduct.size}</span>}
                    {quantityModalProduct.weight && (
                      <span className="text-amber-400 flex items-center gap-0.5">
                        <Scale size={11} />
                        {quantityModalProduct.weight}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setQuantityModalProduct(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Touch Range Slider */}
            <TouchRangeSlider
              value={selectedQtyForProduct}
              min={1}
              max={150}
              step={1}
              unit="pcs"
              label="Select Rod Order Quantity"
              onChange={val => setSelectedQtyForProduct(val)}
              presets={[1, 5, 10, 15, 20, 25, 50, 100]}
              secondaryInfo={
                (() => {
                  const numWeight = quantityModalProduct.weight ? parseFloat(quantityModalProduct.weight.replace(/[^\d.]/g, '')) || 0 : 0;
                  return numWeight > 0
                    ? `Estimated Weight: ${(selectedQtyForProduct * numWeight).toFixed(1)} kg • Order Subtotal: ${fmt(quantityModalProduct.price * selectedQtyForProduct)}`
                    : `Order Subtotal: ${fmt(quantityModalProduct.price * selectedQtyForProduct)}`;
                })()
              }
              colorScheme="amber"
            />

            {/* Total Summary & Add Button */}
            <div className="pt-2 border-t border-[var(--steel-line)] space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-dim)]">Cart Add Total:</span>
                <span className="font-bold text-base text-[var(--yellow)]">
                  {fmt(quantityModalProduct.price * selectedQtyForProduct)}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setQuantityModalProduct(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddToCart(
                      quantityModalProduct,
                      quantityModalProduct.color || undefined,
                      quantityModalProduct.size || undefined,
                      selectedQtyForProduct
                    );
                    setQuantityModalProduct(null);
                  }}
                  className="flex-2 py-2.5 rounded-xl bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow-lg hover:bg-amber-400 active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
                >
                  <Plus size={14} />
                  <span>Add {selectedQtyForProduct} pcs to Cart</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
