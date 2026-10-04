import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, CheckCircle, Plus, Wrench, Trash2, Download, Image as ImageIcon } from 'lucide-react';
import { ProductReturn, Factory, Product, AppLanguage } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, downloadCSV, exportTablePDF } from '../utils/helpers';
import { exportTableJPG } from '../utils/exportManager';

interface ProductReturnsViewProps {
  returns: ProductReturn[];
  factories: Factory[];
  products: Product[];
  language: AppLanguage;
  companyName: string;
  onLogReturn: (entry: Omit<ProductReturn, 'id' | 'status'>) => void;
  onResolveReturn: (id: string, resolution: 'reworked' | 'scrapped', notes?: string) => void;
}

export const ProductReturnsView: React.FC<ProductReturnsViewProps> = ({
  returns,
  factories,
  products,
  language,
  companyName,
  onLogReturn,
  onResolveReturn
}) => {
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [resolveModalItem, setResolveModalItem] = useState<ProductReturn | null>(null);

  // Log return form
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.name || '');
  const [selectedFactory, setSelectedFactory] = useState(factories[0]?.name || '');
  const [qty, setQty] = useState('10');
  const [reason, setReason] = useState('Paint Flaking / Chipped');
  const [returnDate, setReturnDate] = useState(todayISO());

  // Resolve return form
  const [resolutionChoice, setResolutionChoice] = useState<'reworked' | 'scrapped'>('reworked');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseInt(qty, 10);
    if (!q || q <= 0) return;

    onLogReturn({
      date: returnDate,
      productName: selectedProduct,
      qty: q,
      factory: selectedFactory,
      reason
    });

    setLogModalOpen(false);
  };

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveModalItem) return;
    onResolveReturn(resolveModalItem.id, resolutionChoice, resolutionNotes.trim() || undefined);
    setResolveModalItem(null);
    setResolutionNotes('');
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Product', 'Quantity', 'Customer/Factory', 'Reason', 'Status', 'Resolution'];
    const rows = returns.map(r => [
      r.date,
      r.productName || r.product || 'Product',
      r.qty ?? r.quantity ?? 1,
      r.factory,
      r.reason || '—',
      r.status,
      r.resolution || '—'
    ]);
    downloadCSV('Product_Returns_Log', headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['Date', 'Product', 'Qty', 'Customer', 'Reason', 'Status'];
    const rows = returns.map(r => [
      r.date,
      r.productName || r.product || 'Product',
      String(r.qty ?? r.quantity ?? 1),
      r.factory,
      r.reason || '—',
      r.status
    ]);
    exportTablePDF('Defect & Product Returns Log', headers, rows, 'Product_Returns_Log', 'landscape', companyName);
  };

  const handleExportJPG = async () => {
    const headers = ['Date', 'Product', 'Qty', 'Customer', 'Reason', 'Status'];
    const rows = returns.map(r => [
      r.date,
      r.productName || r.product || 'Product',
      String(r.qty ?? r.quantity ?? 1),
      r.factory,
      r.reason || '—',
      r.status
    ]);
    await exportTableJPG(
      'Defect & Product Returns Log',
      headers,
      rows,
      'Product_Returns_Log',
      companyName,
      'Quality Control & Defect Replacements'
    );
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3 font-sans">
        <div>
          <h2 className="font-serif font-black text-xl text-[var(--text)]">{t('returns_title')}</h2>
          <p className="text-xs text-[var(--text-dim)]">{t('returns_sub')}</p>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)]"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="px-3 py-1.5 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)]"
          >
            PDF
          </button>
          <button
            type="button"
            onClick={handleExportJPG}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 text-xs font-semibold text-amber-400 hover:bg-amber-500 hover:text-black transition"
            title="Export High-Resolution JPG Image"
          >
            <ImageIcon size={13} />
            <span>JPG</span>
          </button>
          <button
            type="button"
            onClick={() => setLogModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow transition active:scale-95 font-sans"
          >
            <Plus size={14} />
            <span>{t('log_return')}</span>
          </button>
        </div>
      </div>

      {/* Returns List */}
      <div className="space-y-3">
        {returns.length === 0 ? (
          <div className="text-center py-12 bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl text-[var(--text-dim)] text-xs">
            No defective returns logged. Quality assurance is optimal.
          </div>
        ) : (
          returns.map(r => {
            const isPending = r.status === 'pending';

            return (
              <div
                key={r.id}
                className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                      isPending
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                        : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    }`}
                  >
                    <RotateCcw size={16} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[var(--text)] font-sans">{r.productName}</span>
                      <span className="px-2 py-0.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-bold text-[var(--yellow)]">
                        {r.qty} pcs
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          isPending ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>

                    <div className="text-xs text-[var(--text-dim)] mt-1">
                      Customer: <span className="text-[var(--text)]">{r.factory}</span> · Date: {r.date}
                    </div>
                    <div className="text-xs text-red-400/90 mt-0.5">Defect Reason: {r.reason}</div>
                    {r.resolution && (
                      <div className="text-[11px] text-emerald-400 mt-0.5">
                        Resolution: {r.resolution} {r.resolutionNotes && `(${r.resolutionNotes})`}
                      </div>
                    )}
                  </div>
                </div>

                {isPending && (
                  <button
                    type="button"
                    onClick={() => {
                      setResolveModalItem(r);
                      setResolutionChoice('reworked');
                      setResolutionNotes('');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow hover:bg-amber-400 transition shrink-0"
                  >
                    <Wrench size={13} />
                    <span>Resolve Return</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Log Return Modal */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-sm bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-3 font-sans">{t('log_return')}</h3>
            <form onSubmit={handleLogSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">Product</label>
                <select
                  value={selectedProduct}
                  onChange={e => setSelectedProduct(e.target.value)}
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)]"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">Customer / Workshop</label>
                <select
                  value={selectedFactory}
                  onChange={e => setSelectedFactory(e.target.value)}
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)]"
                >
                  {factories.map(f => (
                    <option key={f.name} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">Quantity (pcs)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">Return Date</label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={e => setReturnDate(e.target.value)}
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">Defect Reason</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Broken weld spot / Paint chipped"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLogModalOpen(false)}
                  className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow"
                >
                  Log Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Return Modal */}
      {resolveModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-sm bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-1 font-sans">Resolve Defect Return</h3>
            <p className="text-xs text-[var(--text-dim)] mb-3">
              {resolveModalItem.productName} ({resolveModalItem.qty} pcs) from {resolveModalItem.factory}
            </p>

            <form onSubmit={handleResolveSubmit} className="space-y-3 text-xs">
              <div className="space-y-2">
                <label className="block text-[10px] text-[var(--text-dim)] uppercase">Resolution Type</label>

                <div
                  onClick={() => setResolutionChoice('reworked')}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    resolutionChoice === 'reworked'
                      ? 'border-[var(--yellow)] bg-[var(--panel-raised)]'
                      : 'border-[var(--steel-line)]'
                  }`}
                >
                  <div className="font-bold text-[var(--text)]">Rework & Restock</div>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                    Items are repaired/repainted, customer credit refunded, and items restored to finished stock.
                  </div>
                </div>

                <div
                  onClick={() => setResolutionChoice('scrapped')}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    resolutionChoice === 'scrapped'
                      ? 'border-[var(--yellow)] bg-[var(--panel-raised)]'
                      : 'border-[var(--steel-line)]'
                  }`}
                >
                  <div className="font-bold text-[var(--text)]">Total Write-Off & Scrap</div>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                    Items are unrecoverable; written off and converted to scrap metal weight.
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">Resolution Notes</label>
                <input
                  type="text"
                  value={resolutionNotes}
                  onChange={e => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Sent for re-powder coating"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolveModalItem(null)}
                  className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow"
                >
                  Save Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
