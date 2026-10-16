import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  ShoppingBag,
  Factory,
  Brush,
  Layers,
  Users,
  ArrowRight,
  Clock,
  Trash2,
  X,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { AppState, AppView } from '../types';
import { fmt } from '../utils/helpers';

export type RecentSearchType = 'product' | 'customer' | 'transaction' | 'painter' | 'worker' | 'query';

export interface RecentSearchEntry {
  id: string;
  type: RecentSearchType;
  title: string;
  subtitle?: string;
  badgeLabel: string;
  timestamp: number;
  view?: AppView;
  detailId?: string;
  queryText?: string;
}

const RECENT_SEARCHES_STORAGE_KEY = 'falcon_erp_recent_searches';
const MAX_RECENT_SEARCHES = 25;

function loadRecentSearches(): RecentSearchEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => item && typeof item.title === 'string' && typeof item.id === 'string');
    }
  } catch (err) {
    console.warn('Failed to load recent searches:', err);
  }
  return [];
}

function saveRecentSearches(items: RecentSearchEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_RECENT_SEARCHES)));
  } catch (err) {
    console.warn('Failed to save recent searches:', err);
  }
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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
  const [recentSearches, setRecentSearches] = useState<RecentSearchEntry[]>(() => loadRecentSearches());
  const [activeRecentTab, setActiveRecentTab] = useState<'all' | 'product' | 'customer' | 'transaction'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const recordRecentSearch = (entry: Omit<RecentSearchEntry, 'timestamp'>) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(
        item => item.id !== entry.id && !(item.type === entry.type && item.title.toLowerCase() === entry.title.toLowerCase())
      );
      const updated: RecentSearchEntry[] = [{ ...entry, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      saveRecentSearches(updated);
      return updated;
    });
  };

  const removeRecentSearch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(item => item.id !== id);
      saveRecentSearches(updated);
      return updated;
    });
  };

  const clearAllRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to clear recent searches:', err);
    }
  };

  const handleSelectRecent = (item: RecentSearchEntry) => {
    if (item.type === 'query' && item.queryText) {
      setQuery(item.queryText);
      inputRef.current?.focus();
      return;
    }

    if (item.view) {
      // Refresh timestamp so it stays fresh
      recordRecentSearch({
        id: item.id,
        type: item.type,
        title: item.title,
        subtitle: item.subtitle,
        badgeLabel: item.badgeLabel,
        view: item.view,
        detailId: item.detailId,
        queryText: item.queryText
      });
      onNavigate(item.view, item.detailId);
      onClose();
    }
  };

  const handleSelectOrder = (o: typeof appState.transactions[0]) => {
    recordRecentSearch({
      id: `order-${o.id}`,
      type: 'transaction',
      title: `Order #${o.id} · ${o.itemsSummary}`,
      subtitle: `Customer: ${o.factory || 'Walk-in'} · ${fmt(o.total)} · ${o.paid ? 'Paid' : 'Due'}`,
      badgeLabel: 'Transaction',
      view: 'transactions',
      detailId: o.id
    });
    onNavigate('transactions', o.id);
    onClose();
  };

  const handleSelectProduct = (p: typeof appState.products[0]) => {
    recordRecentSearch({
      id: `product-${p.id || p.name}`,
      type: 'product',
      title: p.name,
      subtitle: `${fmt(p.price)}${p.size ? ` · Size: ${p.size}` : ''}${p.gauge ? ` · ${p.gauge}` : ''}`,
      badgeLabel: 'Product',
      view: 'products',
      detailId: p.id !== undefined ? String(p.id) : undefined
    });
    onNavigate('products', p.id !== undefined ? String(p.id) : undefined);
    onClose();
  };

  const handleSelectCustomer = (f: typeof appState.factories[0]) => {
    recordRecentSearch({
      id: `customer-${f.name}`,
      type: 'customer',
      title: f.name,
      subtitle: `${f.location || 'Workshop/Customer'}${f.contact ? ` · ${f.contact}` : ''}`,
      badgeLabel: 'Customer',
      view: 'factories',
      detailId: f.name
    });
    onNavigate('factories', f.name);
    onClose();
  };

  const handleSelectPainter = (p: typeof appState.painters[0]) => {
    recordRecentSearch({
      id: `painter-${p.name}`,
      type: 'painter',
      title: p.name,
      subtitle: 'Paint Ledger Contractor',
      badgeLabel: 'Painter',
      view: 'paint_ledger',
      detailId: p.name
    });
    onNavigate('paint_ledger');
    onClose();
  };

  const handleSelectWorker = (w: any) => {
    recordRecentSearch({
      id: `worker-${w.name}`,
      type: 'worker',
      title: w.name,
      subtitle: w.workType || 'Labour Ledger Worker',
      badgeLabel: 'Worker',
      view: 'labour_ledger',
      detailId: w.name
    });
    onNavigate('labour_ledger');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'Enter' && query.trim()) {
      recordRecentSearch({
        id: `query-${query.trim().toLowerCase()}`,
        type: 'query',
        title: query.trim(),
        subtitle: `${totalResults} match${totalResults === 1 ? '' : 'es'} in ERP`,
        badgeLabel: 'Search Query',
        queryText: query.trim()
      });
      // If there's an exact top result, user can quickly navigate
      if (orderMatches.length > 0) {
        handleSelectOrder(orderMatches[0]);
      } else if (productMatches.length > 0) {
        handleSelectProduct(productMatches[0]);
      } else if (factoryMatches.length > 0) {
        handleSelectCustomer(factoryMatches[0]);
      }
    }
  };

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

  // Filtered recent searches for the "Recent Searches" view
  const displayedRecentSearches = useMemo(() => {
    if (activeRecentTab === 'all') return recentSearches;
    return recentSearches.filter(item => item.type === activeRecentTab);
  }, [recentSearches, activeRecentTab]);

  // While typing: find if any recent searches match current query
  const matchingRecentSearches = useMemo(() => {
    if (!q) return [];
    return recentSearches
      .filter(
        r =>
          r.title.toLowerCase().includes(q) ||
          (r.subtitle && r.subtitle.toLowerCase().includes(q)) ||
          (r.queryText && r.queryText.toLowerCase().includes(q))
      )
      .slice(0, 4);
  }, [recentSearches, q]);

  // Helper icon renderer
  const renderItemIcon = (type: RecentSearchType) => {
    switch (type) {
      case 'product':
        return (
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0 text-cyan-400">
            <Layers size={15} />
          </div>
        );
      case 'customer':
        return (
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/25 flex items-center justify-center shrink-0 text-purple-400">
            <Factory size={15} />
          </div>
        );
      case 'transaction':
        return (
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0 text-[var(--yellow)]">
            <ShoppingBag size={15} />
          </div>
        );
      case 'painter':
        return (
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/25 flex items-center justify-center shrink-0 text-orange-400">
            <Brush size={15} />
          </div>
        );
      case 'worker':
        return (
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center justify-center shrink-0 text-blue-400">
            <Users size={15} />
          </div>
        );
      case 'query':
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-zinc-500/10 border border-zinc-500/25 flex items-center justify-center shrink-0 text-zinc-400">
            <Search size={15} />
          </div>
        );
    }
  };

  const getBadgeStyle = (type: RecentSearchType) => {
    switch (type) {
      case 'product':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 'customer':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'transaction':
        return 'bg-amber-500/15 text-[var(--yellow)] border-amber-500/30';
      case 'painter':
        return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
      case 'worker':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'query':
      default:
        return 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30';
    }
  };

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-12 sm:pt-20 font-mono transition-opacity"
    >
      <div className="w-full max-w-2xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh]">
        {/* Search input header */}
        <div className="p-4 border-b border-[var(--steel-line)] flex items-center gap-3 bg-[var(--panel-raised)]">
          <Search size={20} className="text-[var(--yellow)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search products, customers, transactions (#0001), workers..."
            className="w-full bg-transparent border-none text-sm text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none font-sans"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              title="Clear input"
              className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--steel-line)]/40 transition"
            >
              <X size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--yellow)] transition"
          >
            ESC
          </button>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {!q ? (
            /* Recent Searches & Shortcuts View when input is empty */
            <div className="space-y-4">
              {/* Header with Title and Clear All */}
              <div className="flex items-center justify-between pb-1 border-b border-[var(--steel-line)]/60">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-[var(--yellow)]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text)]">
                    Recent Searches {recentSearches.length > 0 && `(${recentSearches.length})`}
                  </span>
                </div>
                {recentSearches.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllRecentSearches}
                    className="inline-flex items-center gap-1.5 text-[10px] text-[var(--text-dim)] hover:text-red-400 transition px-2 py-0.5 rounded hover:bg-red-500/10"
                    title="Clear search history"
                  >
                    <Trash2 size={12} />
                    <span>Clear history</span>
                  </button>
                )}
              </div>

              {/* Type Filter Tabs (if has items) */}
              {recentSearches.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setActiveRecentTab('all')}
                    className={`px-2.5 py-1 rounded-lg border transition ${
                      activeRecentTab === 'all'
                        ? 'bg-[var(--yellow)]/15 border-[var(--yellow)] text-[var(--yellow)] font-bold'
                        : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    All ({recentSearches.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRecentTab('product')}
                    className={`px-2.5 py-1 rounded-lg border transition ${
                      activeRecentTab === 'product'
                        ? 'bg-cyan-500/15 border-cyan-500 text-cyan-400 font-bold'
                        : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    Products ({recentSearches.filter(i => i.type === 'product').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRecentTab('customer')}
                    className={`px-2.5 py-1 rounded-lg border transition ${
                      activeRecentTab === 'customer'
                        ? 'bg-purple-500/15 border-purple-500 text-purple-400 font-bold'
                        : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    Customers ({recentSearches.filter(i => i.type === 'customer').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRecentTab('transaction')}
                    className={`px-2.5 py-1 rounded-lg border transition ${
                      activeRecentTab === 'transaction'
                        ? 'bg-amber-500/15 border-amber-500 text-[var(--yellow)] font-bold'
                        : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    Transactions ({recentSearches.filter(i => i.type === 'transaction').length})
                  </button>
                </div>
              )}

              {/* Recent Searches List */}
              {displayedRecentSearches.length > 0 ? (
                <div className="space-y-2">
                  {displayedRecentSearches.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectRecent(item)}
                      className="group p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] cursor-pointer flex items-center justify-between gap-3 transition-all hover:shadow-md"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {renderItemIcon(item.type)}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--text)] truncate font-sans text-xs sm:text-sm group-hover:text-[var(--yellow)] transition-colors">
                              {item.title}
                            </span>
                            <span
                              className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border shrink-0 ${getBadgeStyle(
                                item.type
                              )}`}
                            >
                              {item.badgeLabel}
                            </span>
                          </div>
                          {item.subtitle && (
                            <div className="text-[11px] text-[var(--text-dim)] truncate mt-0.5 font-sans">
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-[var(--text-dim)] hidden sm:inline">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                        <button
                          type="button"
                          onClick={e => removeRecentSearch(item.id, e)}
                          title="Remove from history"
                          className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 transition opacity-60 group-hover:opacity-100"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentSearches.length > 0 ? (
                <div className="text-center py-8 text-[var(--text-dim)] bg-[var(--panel-raised)]/50 rounded-xl border border-[var(--steel-line)]/50">
                  No recent searches in this category.
                </div>
              ) : (
                /* Empty state when no history exists yet */
                <div className="text-center py-10 px-4 bg-[var(--panel-raised)]/30 rounded-2xl border border-[var(--steel-line)]/40 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--yellow)]/10 border border-[var(--yellow)]/20 flex items-center justify-center text-[var(--yellow)] mb-3 shadow-inner">
                    <Clock size={24} />
                  </div>
                  <div className="font-bold text-sm text-[var(--text)] mb-1">No Recent Searches</div>
                  <div className="text-[var(--text-dim)] text-xs max-w-sm mb-5">
                    Search for products, customer ledgers, or transactions above to build your quick-access history.
                  </div>

                  {/* Quick Shortcut Buttons */}
                  <div className="flex flex-wrap justify-center gap-2 max-w-md">
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate('products');
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-cyan-500 hover:text-cyan-400 text-xs flex items-center gap-1.5 transition text-[var(--text)]"
                    >
                      <Layers size={13} className="text-cyan-400" />
                      <span>Browse Products</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate('factories');
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-purple-500 hover:text-purple-400 text-xs flex items-center gap-1.5 transition text-[var(--text)]"
                    >
                      <Factory size={13} className="text-purple-400" />
                      <span>Customer Ledgers</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate('transactions');
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] hover:text-[var(--yellow)] text-xs flex items-center gap-1.5 transition text-[var(--text)]"
                    >
                      <ShoppingBag size={13} className="text-[var(--yellow)]" />
                      <span>All Orders</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : totalResults === 0 && matchingRecentSearches.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-dim)] bg-[var(--panel-raised)]/30 rounded-xl border border-[var(--steel-line)]/40">
              <div className="mb-2 text-sm text-[var(--text)] font-bold">No results found</div>
              <div>No products, customers, or transactions matched "{query}".</div>
            </div>
          ) : (
            <>
              {/* Recently Searched Matches (if any match query) */}
              {matchingRecentSearches.length > 0 && (
                <div className="pb-2 border-b border-[var(--steel-line)]/60">
                  <div className="text-[10px] uppercase font-bold text-[var(--yellow)] mb-2 flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>Recent History Matches ({matchingRecentSearches.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchingRecentSearches.map(item => (
                      <div
                        key={`matched-recent-${item.id}`}
                        onClick={() => handleSelectRecent(item)}
                        className="p-2 rounded-lg bg-[var(--panel-raised)]/90 border border-[var(--yellow)]/30 hover:border-[var(--yellow)] cursor-pointer flex items-center justify-between transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {renderItemIcon(item.type)}
                          <div className="truncate">
                            <div className="font-bold text-[var(--text)] truncate font-sans text-xs">
                              {item.title}
                            </div>
                            {item.subtitle && (
                              <div className="text-[10px] text-[var(--text-dim)] truncate">
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border shrink-0 ${getBadgeStyle(
                            item.type
                          )}`}
                        >
                          {item.badgeLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders / Transactions */}
              {orderMatches.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--yellow)] mb-2 flex items-center gap-1.5">
                    <ShoppingBag size={12} />
                    <span>Transactions / Orders ({orderMatches.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {orderMatches.map(o => (
                      <div
                        key={o.id}
                        onClick={() => handleSelectOrder(o)}
                        className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] cursor-pointer flex items-center justify-between transition"
                      >
                        <div>
                          <div className="font-bold text-[var(--text)]">Order #{o.id} · {o.itemsSummary}</div>
                          <div className="text-[10px] text-[var(--text-dim)]">
                            Customer: {o.factory || 'Walk-in'} · {o.date}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
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
                  <div className="text-[10px] uppercase font-bold text-cyan-400 mb-2 flex items-center gap-1.5">
                    <Layers size={12} />
                    <span>Products ({productMatches.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {productMatches.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-cyan-500 cursor-pointer flex items-center justify-between transition"
                      >
                        <div>
                          <span className="font-bold text-[var(--text)] font-sans">{p.name}</span>
                          {(p.size || p.gauge) && (
                            <div className="text-[10px] text-[var(--text-dim)]">
                              {p.size ? `Size: ${p.size}` : ''} {p.gauge ? `· Gauge: ${p.gauge}` : ''}
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-cyan-400 shrink-0">{fmt(p.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Factories / Customers */}
              {factoryMatches.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase font-bold text-purple-400 mb-2 flex items-center gap-1.5">
                    <Factory size={12} />
                    <span>Workshops & Customers ({factoryMatches.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {factoryMatches.map(f => (
                      <div
                        key={f.name}
                        onClick={() => handleSelectCustomer(f)}
                        className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-purple-500 cursor-pointer flex items-center justify-between transition"
                      >
                        <div>
                          <div className="font-bold text-[var(--text)] font-sans">{f.name}</div>
                          <div className="text-[10px] text-[var(--text-dim)]">
                            {f.location || 'Workshop'} {f.contact ? `· ${f.contact}` : ''}
                          </div>
                        </div>
                        <ArrowRight size={14} className="text-[var(--text-dim)] shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Painters */}
              {painterMatches.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase font-bold text-orange-400 mb-2 flex items-center gap-1.5">
                    <Brush size={12} />
                    <span>Painters ({painterMatches.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {painterMatches.map(p => (
                      <div
                        key={p.name}
                        onClick={() => handleSelectPainter(p)}
                        className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-orange-500 cursor-pointer flex items-center justify-between transition"
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
                  <div className="text-[10px] uppercase font-bold text-blue-400 mb-2 flex items-center gap-1.5">
                    <Users size={12} />
                    <span>Workers ({workerMatches.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {workerMatches.map(w => (
                      <div
                        key={w.name}
                        onClick={() => handleSelectWorker(w)}
                        className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-blue-500 cursor-pointer flex items-center justify-between transition"
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

        {/* Modal Footer helper */}
        <div className="p-2.5 bg-[var(--panel-raised)] border-t border-[var(--steel-line)] flex items-center justify-between text-[10px] text-[var(--text-dim)] px-4">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded border border-[var(--steel-line)] bg-[var(--panel)] text-[var(--text)]">Enter</kbd> to search & select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded border border-[var(--steel-line)] bg-[var(--panel)] text-[var(--text)]">Esc</kbd> to close
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[var(--yellow)]">
            <Sparkles size={11} />
            <span>Falcon Instant Search</span>
          </div>
        </div>
      </div>
    </div>
  );
};

