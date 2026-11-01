import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  Minus,
  SlidersHorizontal,
  Scale,
  Sparkles,
  ArrowUp,
  AlertCircle,
  CheckCircle2,
  PackageCheck
} from 'lucide-react';
import { CartLine, Factory, Product, AppLanguage } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO } from '../utils/helpers';
import { TouchRangeSlider } from './TouchRangeSlider';
import { hapticTap, hapticAddToCart, hapticTransactionComplete } from '../utils/haptics';

interface CartPanelProps {
  cart: CartLine[];
  factories: Factory[];
  products?: Product[];
  customerLedgers?: { name: string; entries: { debit?: number; credit?: number }[] }[];
  nextTxnId: string;
  language: AppLanguage;
  onAddToCart?: (product: Product, color?: string, size?: string, initialQty?: number) => void;
  onUpdateQty: (id: number, delta: number) => void;
  onSetQty?: (id: number, qty: number) => void;
  onRemoveLine: (id: number) => void;
  onClearCart: () => void;
  onCheckoutUnpaid: (factoryName: string, orderDate: string) => void;
  onScrollToProducts?: () => void;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  factories,
  products = [],
  customerLedgers = [],
  nextTxnId,
  language,
  onAddToCart,
  onUpdateQty,
  onSetQty,
  onRemoveLine,
  onClearCart,
  onCheckoutUnpaid,
  onScrollToProducts
}) => {
  const [selectedFactory, setSelectedFactory] = useState(factories[0]?.name || 'Walk-in Customer');
  const [orderDate, setOrderDate] = useState(todayISO());
  const [expandedSliderId, setExpandedSliderId] = useState<number | null>(null);

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const totalAmount = cart.reduce((sum, line) => sum + line.price * line.qty, 0);
  const totalItems = cart.reduce((sum, line) => sum + line.qty, 0);

  // Parse total weight if items have weights (e.g. "0.85 kg")
  const totalWeightKg = cart.reduce((sum, line) => {
    if (!line.weight) return sum;
    const match = line.weight.match(/([\d.]+)/);
    const w = match ? parseFloat(match[1]) : 0;
    return sum + (w * line.qty);
  }, 0);

  // Calculate selected factory's current outstanding balance from customer ledger
  const factoryBalance = useMemo(() => {
    if (!selectedFactory) return null;
    const ledger = customerLedgers.find(cl => cl.name === selectedFactory);
    if (!ledger || !ledger.entries || ledger.entries.length === 0) return 0;
    return ledger.entries.reduce((acc, e) => acc + (e.debit || 0) - (e.credit || 0), 0);
  }, [selectedFactory, customerLedgers]);

  const handleCheckout = () => {
    if (cart.length === 0 || !selectedFactory) return;
    hapticTransactionComplete();
    onCheckoutUnpaid(selectedFactory, orderDate);
  };

  const handleSetLineQty = (id: number, currentQty: number, targetQty: number) => {
    if (onSetQty) {
      onSetQty(id, targetQty);
    } else {
      onUpdateQty(id, targetQty - currentQty);
    }
  };

  const handleQuickAdd = (prod: Product, defaultQty: number = 10) => {
    hapticAddToCart();
    if (onAddToCart) {
      onAddToCart(prod, prod.color, prod.size, defaultQty);
    }
  };

  return (
    <div
      id="cart-panel-section"
      className="w-full max-w-full overflow-x-hidden break-words lg:w-84 xl:w-96 bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl flex flex-col shrink-0 shadow-xl overflow-hidden font-mono"
    >
      {/* Header */}
      <div className="p-4 border-b border-[var(--steel-line)] flex items-center justify-between bg-[var(--panel-raised)]/40 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShoppingCart size={16} />
          </div>
          <div>
            <h2 className="font-serif font-black text-sm text-[var(--text)] leading-tight">
              {t('current_invoice')}
            </h2>
            <p className="text-[10px] text-[var(--text-dim)]">
              POS Order Booking & Dispatch
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-bold text-black bg-[var(--yellow)] px-2.5 py-1 rounded-lg shadow-sm border border-black/20">
            Order #{nextTxnId}
          </span>
        </div>
      </div>

      {/* Invoice Meta: Customer Factory & Date at the top */}
      <div className="p-3.5 border-b border-[var(--steel-line)] bg-[var(--panel-raised)]/20 space-y-2 shrink-0 text-xs">
        {/* Factory / Customer Selection with Live Khata Balance */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] uppercase font-bold text-[var(--text-dim)] tracking-wider">
              {t('factory_workshop')}
            </label>
            {factoryBalance !== null && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                  factoryBalance > 0
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : factoryBalance < 0
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
                title="Current Customer Ledger Balance"
              >
                {factoryBalance > 0
                  ? `Khata: Rs ${fmt(factoryBalance)} (Dr)`
                  : factoryBalance < 0
                  ? `Advance: Rs ${fmt(Math.abs(factoryBalance))} (Cr)`
                  : 'Khata: Nil (Settled)'}
              </span>
            )}
          </div>

          <select
            value={selectedFactory}
            onChange={e => setSelectedFactory(e.target.value)}
            className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-xl px-3 py-2 text-xs text-[var(--text)] font-semibold truncate outline-none transition"
          >
            {factories.map(f => (
              <option key={f.name} value={f.name}>{f.name}</option>
            ))}
            <option value="Walk-in Customer">Walk-in Customer (Cash / Direct)</option>
          </select>
        </div>

        {/* Date picker */}
        <div>
          <label className="block text-[10px] uppercase font-bold text-[var(--text-dim)] tracking-wider mb-1">
            {t('entry_date')}
          </label>
          <input
            type="date"
            value={orderDate}
            onChange={e => setOrderDate(e.target.value)}
            className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-xl px-3 py-1.5 text-xs text-[var(--text)] outline-none"
          />
        </div>
      </div>

      {/* Cart Line Items or Enhanced Empty State */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 min-h-[180px] max-h-[50vh] lg:max-h-[460px]">
        {cart.length === 0 ? (
          <div className="text-center py-6 px-3 text-[var(--text-dim)] font-mono text-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center mx-auto text-amber-400/80 shadow-inner">
              <ShoppingCart size={24} />
            </div>

            <div>
              <p className="font-bold text-zinc-200 text-xs">{t('invoice_empty')}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">{t('tap_product_add')}</p>
            </div>

            {/* Quick-Add Popular Rod Shortcuts */}
            {products.length > 0 && (
              <div className="pt-2 border-t border-[var(--steel-line)]/60 text-left space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Sparkles size={11} />
                    <span>Quick Add Popular Rods</span>
                  </span>
                  <span className="text-zinc-500 lowercase">(+10 pcs pack)</span>
                </div>

                <div className="space-y-1.5">
                  {products.slice(0, 4).map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleQuickAdd(p, 10)}
                      className="w-full p-2 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-400 text-left flex items-center justify-between transition cursor-pointer group active:scale-[0.99]"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-zinc-200 text-[11px] truncate group-hover:text-amber-400">
                          {p.name}
                        </div>
                        <div className="text-[9px] text-zinc-400">
                          {[p.size, p.weight].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-amber-400 text-xs">
                          {fmt(p.price)}
                        </div>
                        <span className="text-[9px] text-emerald-400 font-bold">
                          + Add 10
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Scroll back to products catalog button */}
            {onScrollToProducts && (
              <button
                type="button"
                onClick={onScrollToProducts}
                className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer pt-1"
              >
                <ArrowUp size={12} />
                <span>Browse Full Rods Catalog Above</span>
              </button>
            )}
          </div>
        ) : (
          cart.map(line => {
            const isSliderOpen = expandedSliderId === line.id;
            const unitWeightNum = line.weight ? parseFloat(line.weight.replace(/[^\d.]/g, '')) || 0 : 0;
            const lineWeightTotal = unitWeightNum > 0 ? (unitWeightNum * line.qty).toFixed(1) : null;

            return (
              <div
                key={`${line.id}_${line.color}_${line.size}`}
                className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] font-mono text-xs space-y-2 transition shadow-xs"
              >
                {/* Main Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[var(--text)] truncate text-xs">{line.name}</div>
                    <div className="text-[10px] text-[var(--text-dim)] flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="text-amber-400 font-semibold">{fmt(line.price)} / pc</span>
                      {line.size && <span>· {line.size}</span>}
                      {line.color && <span>· {line.color}</span>}
                      {lineWeightTotal && (
                        <span className="text-amber-400/90 font-medium flex items-center gap-0.5 bg-amber-500/10 px-1 rounded">
                          <Scale size={9} />
                          {lineWeightTotal} kg
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Stepper & Slider Toggle */}
                  <div className="flex items-center gap-1 shrink-0 bg-[var(--panel)] rounded-lg border border-[var(--steel-line)] p-0.5 shadow-inner">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(line.id, -1)}
                      className="w-7 h-7 sm:w-6 sm:h-6 rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel-raised)] active:scale-90 flex items-center justify-center transition cursor-pointer touch-manipulation"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={12} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedSliderId(isSliderOpen ? null : line.id)}
                      className={`font-bold text-xs px-2 py-0.5 rounded transition cursor-pointer touch-manipulation flex items-center gap-1 ${
                        isSliderOpen
                          ? 'bg-amber-500 text-black shadow-xs'
                          : 'text-amber-400 hover:bg-amber-500/10'
                      }`}
                      title="Tap to open touch quantity slider"
                    >
                      <span>{line.qty}</span>
                      <SlidersHorizontal size={9} className="opacity-70" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateQty(line.id, 1)}
                      className="w-7 h-7 sm:w-6 sm:h-6 rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel-raised)] active:scale-90 flex items-center justify-center transition cursor-pointer touch-manipulation"
                      aria-label="Increase quantity"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Line total & remove */}
                  <div className="text-right shrink-0 pl-1">
                    <div className="font-bold text-[var(--yellow)]">{fmt(line.price * line.qty)}</div>
                    <button
                      type="button"
                      onClick={() => onRemoveLine(line.id)}
                      className="text-[10px] text-red-400 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Quick Pack Buttons (+10, +20, +50) */}
                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[var(--steel-line)]/40 text-zinc-400">
                  <span>Quick Bundle Add:</span>
                  <div className="flex items-center gap-1">
                    {[10, 20, 50].map(addCount => (
                      <button
                        key={addCount}
                        type="button"
                        onClick={() => onUpdateQty(line.id, addCount)}
                        className="px-1.5 py-0.2 rounded bg-[var(--panel)] border border-[var(--steel-line)] hover:border-amber-400 text-amber-400 hover:text-white transition cursor-pointer"
                      >
                        +{addCount}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Touch-Friendly Range Slider Drawer */}
                {isSliderOpen && (
                  <div className="pt-2 pb-1 px-2.5 rounded-lg bg-[var(--panel)] border border-amber-400/30 animate-in fade-in slide-in-from-top-1 duration-150 space-y-1">
                    <TouchRangeSlider
                      value={line.qty}
                      min={1}
                      max={150}
                      step={1}
                      unit="pcs"
                      label="Touch Quantity Slider"
                      onChange={val => handleSetLineQty(line.id, line.qty, val)}
                      presets={[1, 5, 10, 15, 20, 25, 50, 100]}
                      secondaryInfo={
                        unitWeightNum > 0
                          ? `Total: ${(line.qty * unitWeightNum).toFixed(1)} kg (${line.weight}) • Rs ${fmt(line.price * line.qty)}`
                          : `Total: Rs ${fmt(line.price * line.qty)}`
                      }
                      colorScheme="amber"
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Checkout Controls - Styled with proper bottom clearance */}
      <div className="p-4 border-t border-[var(--steel-line)] bg-[var(--panel-raised)]/30 space-y-3 font-mono text-xs shrink-0 pb-16 lg:pb-4">
        {/* Sums & Weight Totals */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[var(--text-dim)]">
            <span>{t('items_label')}</span>
            <div className="flex items-center gap-2">
              {totalWeightKg > 0 && (
                <span className="text-amber-400 font-semibold flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 text-[11px]">
                  <Scale size={11} />
                  {totalWeightKg.toFixed(1)} kg
                </span>
              )}
              <span className="font-bold text-zinc-200">{totalItems} pcs</span>
            </div>
          </div>

          <div className="flex justify-between items-baseline font-bold text-sm text-[var(--text)] pt-1 border-t border-[var(--steel-line)]/50">
            <span>{t('total_label')}</span>
            <span className="text-lg text-[var(--yellow)] font-black">
              {fmt(totalAmount)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            disabled={cart.length === 0 || !selectedFactory}
            onClick={handleCheckout}
            className="w-full py-3.5 rounded-xl bg-[var(--yellow)] text-black font-black text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-400 active:scale-98 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
          >
            <PackageCheck size={16} />
            <span>{cart.length > 0 ? `Book Order #${nextTxnId} (${fmt(totalAmount)})` : t('unpaid_order_btn')}</span>
          </button>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              className="w-full py-2 rounded-xl border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-red-400 hover:border-red-400 transition cursor-pointer"
            >
              Clear Invoice
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
