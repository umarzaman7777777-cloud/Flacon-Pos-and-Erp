import React, { useState } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Check, SlidersHorizontal, Scale } from 'lucide-react';
import { CartLine, Factory, AppLanguage } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO } from '../utils/helpers';
import { TouchRangeSlider } from './TouchRangeSlider';

interface CartPanelProps {
  cart: CartLine[];
  factories: Factory[];
  nextTxnId: string;
  language: AppLanguage;
  onUpdateQty: (id: number, delta: number) => void;
  onSetQty?: (id: number, qty: number) => void;
  onRemoveLine: (id: number) => void;
  onClearCart: () => void;
  onCheckoutUnpaid: (factoryName: string, orderDate: string) => void;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  factories,
  nextTxnId,
  language,
  onUpdateQty,
  onSetQty,
  onRemoveLine,
  onClearCart,
  onCheckoutUnpaid
}) => {
  const [selectedFactory, setSelectedFactory] = useState(factories[0]?.name || '');
  const [orderDate, setOrderDate] = useState(todayISO());
  const [expandedSliderId, setExpandedSliderId] = useState<number | null>(null);

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const totalAmount = cart.reduce((sum, line) => sum + line.price * line.qty, 0);
  const totalItems = cart.reduce((sum, line) => sum + line.qty, 0);

  // Parse total weight if items have weights (e.g. "1.2 kg")
  const totalWeightKg = cart.reduce((sum, line) => {
    if (!line.weight) return sum;
    const match = line.weight.match(/([\d.]+)/);
    const w = match ? parseFloat(match[1]) : 0;
    return sum + (w * line.qty);
  }, 0);

  const handleCheckout = () => {
    if (cart.length === 0 || !selectedFactory) return;
    onCheckoutUnpaid(selectedFactory, orderDate);
  };

  const handleSetLineQty = (id: number, currentQty: number, targetQty: number) => {
    if (onSetQty) {
      onSetQty(id, targetQty);
    } else {
      onUpdateQty(id, targetQty - currentQty);
    }
  };

  return (
    <div id="cart-panel-section" className="w-full max-w-full overflow-x-hidden break-words lg:w-80 xl:w-96 bg-[var(--panel)] border lg:border-l border-[var(--steel-line)] rounded-xl lg:rounded-none flex flex-col shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-[var(--steel-line)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} className="text-[var(--yellow)]" />
          <h2 className="font-serif font-bold text-sm text-[var(--text)]">{t('current_invoice')}</h2>
        </div>
        <div className="font-mono text-xs font-bold text-[var(--yellow)] bg-[var(--panel-raised)] px-2.5 py-0.5 rounded-full border border-[var(--steel-line)]">
          Order #{nextTxnId}
        </div>
      </div>

      {/* Cart Line Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[160px] max-h-[50vh] lg:max-h-none">
        {cart.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-dim)] font-mono text-xs space-y-1">
            <p>{t('invoice_empty')}</p>
            <p className="text-[10px] text-gray-400">{t('tap_product_add')}</p>
          </div>
        ) : (
          cart.map(line => {
            const isSliderOpen = expandedSliderId === line.id;
            const unitWeightNum = line.weight ? parseFloat(line.weight.replace(/[^\d.]/g, '')) || 0 : 0;
            const lineWeightTotal = unitWeightNum > 0 ? (unitWeightNum * line.qty).toFixed(1) : null;

            return (
              <div
                key={`${line.id}_${line.color}_${line.size}`}
                className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] font-mono text-xs space-y-2 transition shadow-xs"
              >
                {/* Main Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[var(--text)] truncate">{line.name}</div>
                    <div className="text-[10px] text-[var(--text-dim)] flex items-center gap-1.5 flex-wrap">
                      <span>{fmt(line.price)}</span>
                      {line.color && <span>· {line.color}</span>}
                      {line.size && <span>· {line.size}</span>}
                      {lineWeightTotal && (
                        <span className="text-amber-400/90 font-medium flex items-center gap-0.5">
                          <Scale size={10} />
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
                      <Minus size={13} />
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
                      <SlidersHorizontal size={10} className="opacity-70" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateQty(line.id, 1)}
                      className="w-7 h-7 sm:w-6 sm:h-6 rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel-raised)] active:scale-90 flex items-center justify-center transition cursor-pointer touch-manipulation"
                      aria-label="Increase quantity"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  {/* Line total & remove */}
                  <div className="text-right shrink-0">
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
                          ? `Scale: ${(line.qty * unitWeightNum).toFixed(1)} kg (${line.weight}) • Subtotal: ${fmt(line.price * line.qty)}`
                          : `Subtotal: ${fmt(line.price * line.qty)}`
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

      {/* Footer / Checkout Controls */}
      <div className="p-4 border-t border-[var(--steel-line)] space-y-3 font-mono text-xs">
        {/* Date & Factory picker */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase text-[var(--text-dim)] mb-1">
              {t('entry_date')}
            </label>
            <input
              type="date"
              value={orderDate}
              onChange={e => setOrderDate(e.target.value)}
              className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-[var(--text-dim)] mb-1">
              {t('factory_workshop')}
            </label>
            <select
              value={selectedFactory}
              onChange={e => setSelectedFactory(e.target.value)}
              className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)] truncate"
            >
              {factories.map(f => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Sums & Weight Totals */}
        <div className="pt-2 border-t border-[var(--steel-line)]/60 space-y-1.5">
          <div className="flex justify-between items-center text-[var(--text-dim)]">
            <span>{t('items_label')}</span>
            <div className="flex items-center gap-2">
              {totalWeightKg > 0 && (
                <span className="text-amber-400 font-semibold flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 text-[11px]">
                  <Scale size={11} />
                  {totalWeightKg.toFixed(1)} kg
                </span>
              )}
              <span>{totalItems} pcs</span>
            </div>
          </div>
          <div className="flex justify-between items-baseline font-bold text-sm text-[var(--text)]">
            <span>{t('total_label')}</span>
            <span className="text-base text-[var(--yellow)]">{fmt(totalAmount)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            disabled={cart.length === 0 || !selectedFactory}
            onClick={handleCheckout}
            className="w-full py-3 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-400 active:scale-98 transition shadow"
          >
            {t('unpaid_order_btn')}
          </button>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              className="w-full py-1.5 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-red-400 hover:border-red-400 transition"
            >
              Clear Invoice
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
