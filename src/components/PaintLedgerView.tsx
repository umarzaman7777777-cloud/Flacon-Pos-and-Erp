import React, { useState } from 'react';
import { Brush, Plus, Trash2, Edit2, Download, CheckCircle, AlertTriangle } from 'lucide-react';
import { Painter, PaintEntry, AppLanguage } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, downloadCSV, exportTablePDF, exportTableJPG, amountInWordsEnglish, amountInWordsUrdu } from '../utils/helpers';
import { openExportModal } from '../utils/exportSettingsHelper';
import { computePainterLedgerDetails } from '../utils/mathEngine';

interface PaintLedgerViewProps {
  painters: Painter[];
  language: AppLanguage;
  companyName: string;
  onSavePainter: (painter: Painter, oldName?: string) => void;
  onDeletePainter: (name: string) => void;
  onAddPaintEntry: (painterName: string, entry: Omit<PaintEntry, 'id'>) => void;
  onDeletePaintEntry: (painterName: string, entryId: string) => void;
  onToggleChequeStatus: (painterName: string, entryId: string, status: 'cleared' | 'bounced') => void;
}

export const PaintLedgerView: React.FC<PaintLedgerViewProps> = ({
  painters,
  language,
  companyName,
  onSavePainter,
  onDeletePainter,
  onAddPaintEntry,
  onDeletePaintEntry,
  onToggleChequeStatus
}) => {
  const [selectedPainterIdx, setSelectedPainterIdx] = useState<number | null>(null);
  const [addPainterModal, setAddPainterModal] = useState(false);
  const [newPainterName, setNewPainterName] = useState('');

  // Entry Form State
  const [desc, setDesc] = useState('');
  const [color, setColor] = useState('Black');
  const [itemSize, setItemSize] = useState('18 inch');
  const [itemType, setItemType] = useState('American Plain');
  const [itemFactory, setItemFactory] = useState('');
  const [itemCount, setItemCount] = useState('');
  const [ratePerItem, setRatePerItem] = useState('');
  const [debit, setDebit] = useState('');
  const [credit, setCredit] = useState('');
  const [isDamage, setIsDamage] = useState(false);
  const [method, setMethod] = useState('Cash');
  const [detail, setDetail] = useState('');
  const [date, setDate] = useState(todayISO());

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const handleRecalcCredit = (countStr: string, rateStr: string) => {
    const c = parseFloat(countStr) || 0;
    const r = parseFloat(rateStr) || 0;
    if (c > 0 && r > 0 && !credit) {
      setCredit(String(c * r));
    }
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPainterIdx === null) return;
    const p = painters[selectedPainterIdx];
    if (!p) return;

    const dVal = parseFloat(debit) || 0;
    const cVal = (parseFloat(credit) || 0) * (isDamage ? -1 : 1);
    if (dVal <= 0 && cVal === 0) return;

    onAddPaintEntry(p.name, {
      date,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      desc: desc.trim() || 'Work logged',
      color,
      itemSize,
      itemType,
      itemFactory,
      itemCount,
      ratePerItem,
      debit: dVal,
      credit: cVal,
      method: dVal > 0 ? method : undefined,
      detail: dVal > 0 ? detail.trim() : undefined
    });

    setDesc('');
    setDebit('');
    setCredit('');
    setItemCount('');
    setRatePerItem('');
    setIsDamage(false);
  };

  const currentPainter = selectedPainterIdx !== null ? painters[selectedPainterIdx] : null;
  const currentBalance = currentPainter
    ? currentPainter.entries.reduce((s, e) => s + (e.credit || 0) - (e.debit || 0), 0)
    : 0;

  const handleExportCSV = () => {
    if (!currentPainter) return;
    const headers = ['Date', 'Description', 'Color', 'Size', 'Count', 'Rate', 'Debit (Paid)', 'Credit (Work)'];
    const rows = currentPainter.entries.map(e => [
      e.date,
      e.desc,
      e.color || '—',
      e.itemSize || '—',
      e.itemCount || '—',
      e.ratePerItem || '—',
      e.debit,
      e.credit
    ]);
    downloadCSV(`${currentPainter.name}_Paint_Ledger`, headers, rows);
  };

  const handleExportPDF = () => {
    if (!currentPainter) return;
    const headers = ['Date', 'Description', 'Color', 'Size', 'Count', 'Rate', 'Paid', 'Work'];
    const rows = currentPainter.entries.map(e => [
      e.date,
      e.desc,
      e.color || '—',
      e.itemSize || '—',
      e.itemCount || '—',
      e.ratePerItem ? fmt(parseFloat(e.ratePerItem)) : '—',
      fmt(e.debit),
      fmt(e.credit)
    ]);
    openExportModal({
      title: `${currentPainter.name} — Paint Ledger`,
      headers,
      rows,
      filename: `${currentPainter.name}_Paint_Ledger`,
      companyName,
      subtitle: 'Fan Accessories · Gujrat',
      balanceFooterText: `Net Balance: ${fmt(currentBalance)}`,
      defaultFormat: 'pdf',
      initialOrientation: 'landscape'
    });
  };

  const handleExportJPG = () => {
    if (!currentPainter) return;
    const headers = ['Date', 'Description', 'Color', 'Size', 'Count', 'Rate', 'Paid', 'Work'];
    const rows = currentPainter.entries.map(e => [
      e.date,
      e.desc,
      e.color || '—',
      e.itemSize || '—',
      e.itemCount || '—',
      e.ratePerItem ? fmt(parseFloat(e.ratePerItem)) : '—',
      fmt(e.debit),
      fmt(e.credit)
    ]);
    openExportModal({
      title: `${currentPainter.name} — Paint Ledger`,
      headers,
      rows,
      filename: `${currentPainter.name}_Paint_Ledger`,
      companyName,
      subtitle: 'Fan Accessories · Gujrat',
      balanceFooterText: `Net Balance: ${fmt(currentBalance)}`,
      defaultFormat: 'jpg',
      initialOrientation: 'landscape'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3">
        <div>
          <h2 className="font-serif font-black text-xl text-[var(--text)]">{t('paint_title')}</h2>
          <p className="text-xs text-[var(--text-dim)]">{t('paint_sub')}</p>
        </div>

        <button
          type="button"
          onClick={() => setAddPainterModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow transition active:scale-95"
        >
          <Plus size={14} />
          <span>{t('add_painter')}</span>
        </button>
      </div>

      {/* Painters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {painters.map((p, idx) => {
          const totalPaid = p.entries.reduce((s, e) => s + (e.debit || 0), 0);
          const totalWork = p.entries.reduce((s, e) => s + (e.credit || 0), 0);
          const bal = totalWork - totalPaid;

          return (
            <div
              key={p.name}
              className="bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] rounded-xl p-4 flex flex-col justify-between gap-3 shadow-sm transition group"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center text-[var(--yellow)]">
                  <Brush size={16} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm((t('confirm_delete_painter') || 'Delete painter {name}?').replace('{name}', p.name))) {
                      onDeletePainter(p.name);
                    }
                  }}
                  className="p-1.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:text-red-400 opacity-80 group-hover:opacity-100 transition"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-[var(--text)]">{p.name}</h4>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {(p.colours || ['Black', 'White']).map(c => (
                    <span key={c} className="text-[10px] bg-[var(--panel-raised)] px-2 py-0.5 rounded text-[var(--text-dim)]">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--steel-line)] flex items-center justify-between font-mono">
                <div className="text-xs">
                  <span className={`font-bold ${bal > 0 ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>
                    {fmt(Math.abs(bal))}
                  </span>{' '}
                  <span className="text-[10px] text-[var(--text-dim)]">
                    ({bal > 0 ? t('owed') : t('advance')})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPainterIdx(idx)}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] hover:bg-[var(--yellow)] hover:text-black border border-[var(--steel-line)] text-xs font-semibold transition"
                >
                  Ledger
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Painter Modal */}
      {addPainterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-sm bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-3">{t('add_painter')}</h3>
            <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">Painter Name</label>
            <input
              type="text"
              required
              value={newPainterName}
              onChange={e => setNewPainterName(e.target.value)}
              placeholder="e.g. Rashid Painter"
              className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddPainterModal(false)}
                className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newPainterName.trim()) {
                    onSavePainter({ name: newPainterName.trim(), colours: ['Black', 'White', 'Silver'], entries: [] });
                    setNewPainterName('');
                    setAddPainterModal(false);
                  }
                }}
                className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase"
              >
                {t('add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Painter Ledger Detail Modal */}
      {currentPainter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 font-mono">
          <div className="w-full max-w-3xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-4 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-serif font-black text-lg sm:text-xl text-[var(--text)]">{currentPainter.name}</h3>
                <span className="text-xs text-[var(--text-dim)]">Painter Ledger & Powder Coating</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)]"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)]"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportJPG}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-black transition"
                >
                  JPG
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPainterIdx(null)}
                  className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Balance Breakdown Cards */}
            {(() => {
              const details = computePainterLedgerDetails(currentPainter.entries);
              return (
                <div className="my-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Total Work (Credit)</div>
                    <div className="text-base font-bold text-[var(--red)] mt-0.5">{fmt(details.totalCredits)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Total Paid (Debit)</div>
                    <div className="text-base font-bold text-[var(--green)] mt-0.5">{fmt(details.totalDebits)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Net Balance</div>
                    <div
                      className={`text-base font-bold mt-0.5 ${
                        details.netBalance > 0
                          ? 'text-[var(--red)]'
                          : details.netBalance < 0
                          ? 'text-[var(--green)]'
                          : 'text-gray-400'
                      }`}
                    >
                      {fmt(Math.abs(details.netBalance))}
                      <span className="text-[10px] font-normal ml-1">
                        {details.netBalance > 0 ? 'Owed to Painter' : details.netBalance < 0 ? 'Advance Paid' : 'Settled'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Entries list */}
            <div className="flex-1 overflow-y-auto min-h-[160px] border border-[var(--steel-line)] rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)]">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5 text-right">Debit (Paid)</th>
                    <th className="p-2.5 text-right">Credit (Work)</th>
                    <th className="p-2.5 text-right">Running Balance</th>
                    <th className="p-2.5">Method</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--steel-line)]">
                  {currentPainter.entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-[var(--text-dim)]">
                        No entries logged yet.
                      </td>
                    </tr>
                  ) : (
                    computePainterLedgerDetails(currentPainter.entries).entriesWithBalance.map(e => (
                      <tr key={e.id} className="hover:bg-[var(--panel-raised)]/50">
                        <td className="p-2.5 whitespace-nowrap">{e.date}</td>
                        <td className="p-2.5">
                          <div>{e.desc}</div>
                          <div className="text-[10px] text-[var(--text-dim)]">
                            {[e.color, e.itemSize && `${e.itemSize} (${e.itemCount} pcs @ ${e.ratePerItem})`].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-semibold text-[var(--green)]">
                          {e.debit ? fmt(e.debit) : '—'}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-[var(--red)]">
                          {e.credit ? fmt(e.credit) : '—'}
                        </td>
                        <td
                          className={`p-2.5 text-right font-bold ${
                            e.runningBalance > 0
                              ? 'text-[var(--red)]'
                              : e.runningBalance < 0
                              ? 'text-[var(--green)]'
                              : 'text-gray-400'
                          }`}
                        >
                          {fmt(Math.abs(e.runningBalance))}
                          <span className="text-[9px] font-normal ml-0.5">
                            {e.runningBalance > 0 ? 'Payable' : e.runningBalance < 0 ? 'Adv' : ''}
                          </span>
                        </td>
                        <td className="p-2.5 text-[var(--text-dim)]">
                          {e.method || '—'}
                          {e.chequeStatus && ` (${e.chequeStatus})`}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => onDeletePaintEntry(currentPainter.name, e.id)}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Quick Add Entry Form */}
            <form onSubmit={handleAddEntry} className="mt-3 pt-3 border-t border-[var(--steel-line)] space-y-2 text-xs">
              <div className="font-bold text-xs uppercase text-[var(--yellow)]">+ Add Paint Entry</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  required
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="e.g. 18 inch fan rods powder coated"
                  className="sm:col-span-2 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none"
                />
                <input
                  type="text"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  placeholder="Color (e.g. Matt Black)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)]"
                />
                <input
                  type="text"
                  value={itemSize}
                  onChange={e => setItemSize(e.target.value)}
                  placeholder='Size (e.g. 18")'
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input
                  type="number"
                  min="0"
                  value={itemCount}
                  onChange={e => {
                    setItemCount(e.target.value);
                    handleRecalcCredit(e.target.value, ratePerItem);
                  }}
                  placeholder="Item count"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
                <input
                  type="number"
                  min="0"
                  value={ratePerItem}
                  onChange={e => {
                    setRatePerItem(e.target.value);
                    handleRecalcCredit(itemCount, e.target.value);
                  }}
                  placeholder="Rate per item"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
                <input
                  type="number"
                  min="0"
                  value={debit}
                  onChange={e => setDebit(e.target.value)}
                  placeholder="Debit - Paid (Rs)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
                <input
                  type="number"
                  min="0"
                  value={credit}
                  onChange={e => setCredit(e.target.value)}
                  placeholder="Credit - Work (Rs)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-dim)]">
                    <input
                      type="checkbox"
                      checked={isDamage}
                      onChange={e => setIsDamage(e.target.checked)}
                      className="rounded"
                    />
                    <span>Damage Deduction</span>
                  </label>

                  <select
                    value={method}
                    onChange={e => setMethod(e.target.value)}
                    className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow hover:bg-amber-400 transition"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
