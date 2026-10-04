import React, { useState } from 'react';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Search, ShieldAlert } from 'lucide-react';
import { Product, AppLanguage, RecipeItem } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt } from '../utils/helpers';

interface ProductsViewProps {
  products: Product[];
  activeCat: string;
  language: AppLanguage;
  rawMaterialNames: string[];
  productColors: string[];
  productSizes: string[];
  productWeights: string[];
  onAddToCart: (product: Product) => void;
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (id: number) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  activeCat,
  language,
  rawMaterialNames,
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

  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [color, setColor] = useState('Black');
  const [customColor, setCustomColor] = useState('');
  const [size, setSize] = useState('18 inch');
  const [weight, setWeight] = useState('1.2 kg');
  const [stock, setStock] = useState('');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [recipe, setRecipe] = useState<RecipeItem[]>([]);

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

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
    setColor(productColors[0] || 'Black');
    setCustomColor('');
    setSize(productSizes[0] || '18 inch');
    setWeight(productWeights[0] || '1.2 kg');
    setStock('25');
    setReorderLevel('5');
    setRecipe([{ material: 'M.S. Steel Pipe', weightPerUnit: 0.8 }, { material: 'Safety Bolt & Cotter Pin', itemsPerUnit: 1 }]);
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(p.id);
    setName(p.name);
    setPrice(String(p.price));
    if (productColors.includes(p.color || '')) {
      setColor(p.color || 'Black');
      setCustomColor('');
    } else {
      setColor('Other');
      setCustomColor(p.color || '');
    }
    setSize(p.size || '18 inch');
    setWeight(p.weight || '1.2 kg');
    setStock(p.stock !== undefined ? String(p.stock) : '');
    setReorderLevel(p.reorderLevel !== undefined ? String(p.reorderLevel) : '5');
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
    setRecipe([...recipe, { material: rawMaterialNames[0] || 'M.S. Steel Pipe', weightPerUnit: 0.5 }]);
  };

  const handleRemoveRecipeRow = (index: number) => {
    setRecipe(recipe.filter((_, i) => i !== index));
  };

  const handleRecipeChange = (index: number, field: keyof RecipeItem, val: any) => {
    const updated = [...recipe];
    updated[index] = { ...updated[index], [field]: val };
    setRecipe(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const prod: Product = {
      id: editingId ?? Date.now(),
      name: name.trim(),
      price: parseFloat(price) || 0,
      cat: activeCat || 'Rod (Ceiling)',
      color: color === 'Other' ? customColor.trim() || 'Custom' : color,
      size,
      weight,
      stock: stock ? parseInt(stock, 10) : undefined,
      reorderLevel: reorderLevel ? parseInt(reorderLevel, 10) : 5,
      recipe: recipe.filter(r => r.material.trim())
    };

    onSaveProduct(prod);
    setModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Category header & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-serif font-black text-xl text-[var(--text)]">
            {activeCat || 'All Products'}
          </h2>
          <span className="text-xs font-mono text-[var(--text-dim)] bg-[var(--panel-raised)] px-2 py-0.5 rounded-full border border-[var(--steel-line)]">
            {filteredProducts.length} items
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

          return (
            <div
              key={p.id}
              onClick={() => onAddToCart(p)}
              className="group relative bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] rounded-xl p-3.5 flex flex-col justify-between cursor-pointer transition-all duration-150 hover:-translate-y-0.5 shadow-sm active:scale-[0.98]"
            >
              {/* Top Row: recipe status & actions */}
              <div className="flex items-center justify-between mb-2">
                <span
                  title={hasRecipe ? 'Recipe tracked' : 'No recipe'}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    hasRecipe ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-gray-500/10 text-gray-400'
                  }`}
                >
                  {hasRecipe ? '✓' : '—'}
                </span>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={e => handleOpenEdit(p, e)}
                    className="p-1 rounded bg-[var(--panel-raised)] hover:text-[var(--yellow)] border border-[var(--steel-line)] transition"
                    title="Edit"
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
              <div className="space-y-1 my-1">
                <h4 className="font-semibold text-xs sm:text-sm text-[var(--text)] line-clamp-2 leading-tight">
                  {p.name}
                </h4>
                <div className="font-mono text-[10px] text-[var(--text-dim)] truncate">
                  {[p.color, p.size, p.weight].filter(Boolean).join(' · ')}
                </div>
              </div>

              {/* Footer: price & stock status */}
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
          className="border-2 border-dashed border-[var(--steel-line)] hover:border-[var(--yellow)] rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-[var(--text-dim)] hover:text-[var(--yellow)] min-h-[140px] transition"
        >
          <div className="w-8 h-8 rounded-full bg-[var(--panel-raised)] flex items-center justify-center">
            <Plus size={18} />
          </div>
          <span className="font-mono text-xs font-bold uppercase tracking-wider">Add Product</span>
        </button>
      </div>

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif font-bold text-lg text-[var(--text)] mb-4">
              {editingId ? t('edit_product') : t('add_product')}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[var(--text-dim)] uppercase tracking-wider mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. American-Plain-Tikka-Tala"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-dim)] uppercase tracking-wider mb-1">Price (Rs)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="380"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-dim)] uppercase tracking-wider mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={stock}
                    onChange={e => setStock(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[var(--text-dim)] uppercase tracking-wider mb-1">Color</label>
                  <select
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-2 py-2 text-xs text-[var(--text)]"
                  >
                    {productColors.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="Other">Other…</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--text-dim)] uppercase tracking-wider mb-1">Size</label>
                  <input
                    type="text"
                    value={size}
                    onChange={e => setSize(e.target.value)}
                    placeholder='18"'
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-2 py-2 text-xs text-[var(--text)]"
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-dim)] uppercase tracking-wider mb-1">Weight</label>
                  <input
                    type="text"
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    placeholder="1.2 kg"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-2 py-2 text-xs text-[var(--text)]"
                  />
                </div>
              </div>

              {color === 'Other' && (
                <div>
                  <input
                    type="text"
                    value={customColor}
                    onChange={e => setCustomColor(e.target.value)}
                    placeholder="Type custom color name..."
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-1.5 text-xs text-[var(--text)]"
                  />
                </div>
              )}

              {/* Recipe builder */}
              <div className="pt-2 border-t border-[var(--steel-line)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold uppercase text-[var(--yellow)]">Raw Material Recipe (Per Unit)</span>
                  <button
                    type="button"
                    onClick={handleAddRecipeRow}
                    className="text-xs text-[var(--yellow)] hover:underline"
                  >
                    + Add Material
                  </button>
                </div>

                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {recipe.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={r.material}
                        onChange={e => handleRecipeChange(i, 'material', e.target.value)}
                        placeholder="e.g. M.S. Steel Pipe"
                        className="flex-2 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)]"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={r.weightPerUnit ?? ''}
                        onChange={e => handleRecipeChange(i, 'weightPerUnit', parseFloat(e.target.value) || 0)}
                        placeholder="kg/unit"
                        className="flex-1 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveRecipeRow(i)}
                        className="text-red-400 p-1 hover:bg-red-500/10 rounded"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
