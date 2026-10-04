import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingBag, Factory, Brush, Layers, Users, ArrowRight } from 'lucide-react';
import { AppState, AppView } from '../types';
import { fmt } from '../utils/helpers';

interface GlobalSearchModalProps {
  appState: AppState;
  onClose: () => void;
  onNavigate: (view: AppView, detailId?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  appState,
  onClose,
  onNavigate
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const q = query.toLowerCase().trim();

  // Search results collections
  const orderMatches = q
    ? appState.transactions.filter(
        t =>
          t.id.toLowerCase().includes(q) ||
          (t.factory && t.factory.toLowerCase().includes(q)) ||
          t.itemsSummary.toLowerCase().includes(q)
      )
    : [];

  const productMatches = q
    ? appState.products.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          (p.size && p.size.toLowerCase().includes(q)) ||
          (p.sizes && p.sizes.some((s: string) => s.toLowerCase().includes(q))) ||
          (p.gauge && p.gauge.toLowerCase().includes(q))
      )
    : [];

  const factoryMatches = q
    ? appState.factories.filter(
        f =>
          f.name.toLowerCase().includes(q) ||
          f.location.toLowerCase().includes(q) ||
          f.contact.toLowerCase().includes(q)
      )
    : [];

  const painterMatches = q
    ? appState.painters.filter(p => p.name.toLowerCase().includes(q))
    : [];

  const workerList = appState.workers || appState.labourWorkers || [];
  const workerMatches = q
    ? workerList.filter(
        (w: any) => w.name.toLowerCase().includes(q) || (w.workType && w.workType.toLowerCase().includes(q))
      )
    : [];

  const totalResults =
    orderMatches.length +
    productMatches.length +
    factoryMatches.length +
    painterMatches.length +
    workerMatches.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 p-4 pt-16 sm:pt-24 font-mono">
      <div className="w-full max-w-2xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search input header */}
        <div className="p-4 border-b border-[var(--steel-line)] flex items-center gap-3 bg-[var(--panel-raised)]">
          <Search size={20} className="text-[var(--yellow)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search orders (#0001), products, workshops, painters, workers..."
            className="w-full bg-transparent border-none text-sm text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none font-sans"
          />
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-[var(--text)]"
          >
            ESC
          </button>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {!q ? (
            <div className="text-center py-10 text-[var(--text-dim)]">
              Type anything to instantly query across all ERP databases.
            </div>
          ) : totalResults === 0 ? (
            <div className="text-center py-10 text-[var(--text-dim)]">
              No results found for "{query}".
            </div>
          ) : (
            <>
              {/* Orders */}
              {orderMatches.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--yellow)] mb-2 flex items-center gap-1.5">
                    <ShoppingBag size={12} />
                    <span>Orders Booked ({orderMatches.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {orderMatches.map(o => (
                      <div
                        key={o.id}
                        onClick={() => {
                          onNavigate('transactions');
                          onClose();
                        }}
                        className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] cursor-pointer flex items-center justify-between transition"
                      >
                        <div>
                          <div className="font-bold text-[var(--text)]">Order #{o.id} · {o.itemsSummary}</div>
                          <div className="text-[10px] text-[var(--text-dim)]">
                            Customer: {o.factory || 'Walk-in'} · {o.date}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-[var(--yellow)]">{fmt(o.total)}</div>
                          <div className="text-[10px] text-[var(--text-dim)]">{o.paid ? 'Paid' : 'Due'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Products */}
              {productMatches.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--yellow)] mb-2 flex items-center gap-1.5">
                    <Layers size={12} />
                    <span>Products ({productMatches.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {productMatches.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          onNavigate('products');
                          onClose();
                        }}
                        className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] cursor-pointer flex items-center justify-between transition"
                      >
                        <span className="font-bold text-[var(--text)] font-sans">{p.name}</span>
                        <span className="font-bold text-[var(--yellow)]">{fmt(p.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Factories */}
              {factoryMatches.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--yellow)] mb-2 flex items-center gap-1.5">
                    <Factory size={12} />
                    <span>Workshops & Customers ({factoryMatches.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {factoryMatches.map(f => (
                      <div
                        key={f.name}
                        onClick={() => {
                          onNavigate('factories');
                          onClose();
                        }}
                        className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] cursor-pointer flex items-center justify-between transition"
                      >
                        <div>
                          <div className="font-bold text-[var(--text)] font-sans">{f.name}</div>
                          <div className="text-[10px] text-[var(--text-dim)]">{f.location} · {f.contact}</div>
                        </div>
                        <ArrowRight size={14} className="text-[var(--text-dim)]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Painters */}
              {painterMatches.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--yellow)] mb-2 flex items-center gap-1.5">
                    <Brush size={12} />
                    <span>Painters ({painterMatches.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {painterMatches.map(p => (
                      <div
                        key={p.name}
                        onClick={() => {
                          onNavigate('paint_ledger');
                          onClose();
                        }}
                        className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] cursor-pointer flex items-center justify-between transition"
                      >
                        <span className="font-bold text-[var(--text)] font-sans">{p.name}</span>
                        <ArrowRight size={14} className="text-[var(--text-dim)]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workers */}
              {workerMatches.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--yellow)] mb-2 flex items-center gap-1.5">
                    <Users size={12} />
                    <span>Workers ({workerMatches.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {workerMatches.map(w => (
                      <div
                        key={w.name}
                        onClick={() => {
                          onNavigate('labour_ledger');
                          onClose();
                        }}
                        className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] cursor-pointer flex items-center justify-between transition"
                      >
                        <div>
                          <div className="font-bold text-[var(--text)] font-sans">{w.name}</div>
                          <div className="text-[10px] text-[var(--text-dim)]">{w.workType}</div>
                        </div>
                        <ArrowRight size={14} className="text-[var(--text-dim)]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
