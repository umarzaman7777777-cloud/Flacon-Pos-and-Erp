import React, { useState } from 'react';
import { CustomLedger, CustomLedgerEntry, AppLanguage } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, downloadCSV, exportTablePDF } from '../utils/helpers';
import { Trash2, Download, FileText, AlertCircle } from 'lucide-react';

interface CustomLedgerDetailModalProps {
  customLedger: CustomLedger;
  language: AppLanguage;
  companyName: string;
  onClose: () => void;
  onAddEntry: (id: string, entry: Omit<CustomLedgerEntry, 'id'>) => void;
  onDeleteEntry: (ledgerId: string, entryId: string) => void;
  onUpdateSelfWeightStock: (ledgerId: string, deltaKg: number) => void;
  onDeleteCustomLedger?: (ledgerId: string) => void;
}

export const CustomLedgerDetailModal: React.FC<CustomLedgerDetailModalProps> = ({
  customLedger,
  language,
  companyName,
  onClose,
  onAddEntry,
  onDeleteEntry,
  onUpdateSelfWeightStock,
  onDeleteCustomLedger
}) => {
  const [desc, setDesc] = useState('');
  const [size, setSize] = useState('18 inch');
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [debit, setDebit] = useState('');
  const [credit, setCredit] = useState('');
  const [date, setDate] = useState(todayISO());

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const totalDebit = customLedger.entries.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = customLedger.entries.reduce((s, e) => s + (e.credit || 0), 0);
  const netBalance = totalDebit - totalCredit;

  const handleQtyRateChange = (newQty: string, newRate: string) => {
    setQty(newQty);
    setRate(newRate);
    const q = parseFloat(newQty) || 0;
    const r = parseFloat(newRate) || 0;
    if (q > 0 && r > 0) {
      setDebit((q * r).toString());
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dVal = parseFloat(debit) || 0;
    const cVal = parseFloat(credit) || 0;
    if (dVal <= 0 && cVal <= 0) return;

    onAddEntry(customLedger.id, {
      date,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      desc: desc.trim() || 'Job-work entry',
      size,
      qty: qty ? parseInt(qty, 10) : undefined,
      rate: rate ? parseFloat(rate) : undefined,
      debit: dVal,
      credit: cVal
    });

    setDesc('');
    setQty('');
    setRate('');
    setDebit('');
    setCredit('');
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Description', 'Size', 'Qty', 'Rate', 'Debit (Billed)', 'Credit (Received)'];
    const rows = customLedger.entries.map(e => [
      e.date,
      e.desc,
      e.size || '—',
      e.qty ?? '—',
      e.rate ?? '—',
      e.debit,
      e.credit
    ]);
    downloadCSV(`${customLedger.name}_JobWork_Ledger`, headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['Date', 'Description', 'Size', 'Qty', 'Rate', 'Debit (Billed)', 'Credit (Received)'];
    const rows = customLedger.entries.map(e => [
      e.date,
      e.desc,
      e.size || '—',
      e.qty !== undefined ? `${e.qty} pcs` : '—',
      e.rate !== undefined ? fmt(e.rate) : '—',
      e.debit ? fmt(e.debit) : '—',
      e.credit ? fmt(e.credit) : '—'
    ]);
    exportTablePDF(
      `${customLedger.name} — Job-Work & Ancillary Ledger`,
      headers,
      rows,
      `${customLedger.name.replace(/\s+/g, '_')}_JobWork_Ledger`,
      'portrait',
      companyName
    );
  };

  const handleDeleteLedger = () => {
    if (!onDeleteCustomLedger) return;
    if (window.confirm(`Are you sure you want to delete the entire custom ledger for "${customLedger.name}"? This cannot be undone.`)) {
      onDeleteCustomLedger(customLedger.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 font-mono">
      <div className="w-full max-w-3xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-4 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-serif font-black text-lg sm:text-xl text-[var(--text)]">{customLedger.name}</h3>
            <span className="text-xs text-[var(--text-dim)]">Factory Ancillary & Job-Work Ledger</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPDF}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-red-500/60 text-xs font-semibold text-red-400 hover:text-red-300 transition"
              title="Export PDF Document"
            >
              <FileText size={13} />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] transition"
              title="Export CSV Spreadsheet"
            >
              <Download size={13} />
              <span>CSV</span>
            </button>
            {onDeleteCustomLedger && (
              <button
                type="button"
                onClick={handleDeleteLedger}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/10 border border-red-500/30 hover:border-red-500 text-xs font-semibold text-red-400 hover:text-red-300 transition"
                title="Delete this entire custom ledger"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Balance and Self-Weight Stock Banner */}
        <div className="my-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
            <div className="text-[10px] uppercase text-[var(--text-dim)]">Net Balance Due</div>
            <div className={`text-xl font-bold mt-1 ${netBalance > 0 ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>
              {fmt(Math.abs(netBalance))}
            </div>
            <div className="text-[10px] text-[var(--text-dim)]">
              {netBalance > 0 ? 'Party owes us (Receivable)' : netBalance < 0 ? 'Advance received' : 'Settled (Nil)'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase text-[var(--text-dim)]">Customer Steel Raw Stock</div>
              <div className="text-xl font-bold text-[var(--yellow)] mt-1">
                {(customLedger.selfWeightStock || 0).toFixed(1)} kg
              </div>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  const kg = prompt('Enter customer steel received in kg (e.g. 500):');
                  if (kg) onUpdateSelfWeightStock(customLedger.id, parseFloat(kg) || 0);
                }}
                className="px-2.5 py-1 rounded bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[10px] font-bold uppercase text-[var(--yellow)] transition"
              >
                + Add Steel
              </button>
            </div>
          </div>
        </div>

        {/* Entries Table */}
        <div className="flex-1 overflow-y-auto min-h-[160px] border border-[var(--steel-line)] rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)] sticky top-0">
              <tr>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Description</th>
                <th className="p-2.5">Size/Qty</th>
                <th className="p-2.5 text-right">Debit (Billed)</th>
                <th className="p-2.5 text-right">Credit (Recv)</th>
                <th className="p-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--steel-line)]">
              {customLedger.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[var(--text-dim)]">
                    No entries logged yet.
                  </td>
                </tr>
              ) : (
                customLedger.entries.map(e => (
                  <tr key={e.id} className="hover:bg-[var(--panel-raised)]/50">
                    <td className="p-2.5 whitespace-nowrap">{e.date}</td>
                    <td className="p-2.5">{e.desc}</td>
                    <td className="p-2.5 text-[var(--text-dim)]">
                      {[e.size, e.qty && `${e.qty} pcs`, e.rate && `@ ${fmt(e.rate)}`].filter(Boolean).join(' · ')}
                    </td>
                    <td className="p-2.5 text-right font-semibold text-[var(--red)]">
                      {e.debit ? fmt(e.debit) : '—'}
                    </td>
                    <td className="p-2.5 text-right font-semibold text-[var(--green)]">
                      {e.credit ? fmt(e.credit) : '—'}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => onDeleteEntry(customLedger.id, e.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                        title="Delete entry"
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

        {/* Quick Add Form */}
        <form onSubmit={handleAddSubmit} className="mt-3 pt-3 border-t border-[var(--steel-line)] space-y-2 text-xs">
          <div className="font-bold text-xs uppercase text-[var(--yellow)]">+ Log Job-Work Entry</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              required
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Description (e.g. 500 rods made)"
              className="sm:col-span-2 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none"
            />
            <input
              type="text"
              value={size}
              onChange={e => setSize(e.target.value)}
              placeholder='Size (e.g. 18")'
              className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)]"
            />
            <div className="grid grid-cols-2 gap-1">
              <input
                type="number"
                value={qty}
                onChange={e => handleQtyRateChange(e.target.value, rate)}
                placeholder="Qty (pcs)"
                className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)]"
              />
              <input
                type="number"
                value={rate}
                onChange={e => handleQtyRateChange(qty, e.target.value)}
                placeholder="Rate/pc"
                className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <input
              type="number"
              min="0"
              value={debit}
              onChange={e => setDebit(e.target.value)}
              placeholder="Debit / Billed (Rs)"
              className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
            />
            <input
              type="number"
              min="0"
              value={credit}
              onChange={e => setCredit(e.target.value)}
              placeholder="Credit / Received (Rs)"
              className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
            />
            <button
              type="submit"
              className="py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow hover:bg-amber-400 transition"
            >
              Save Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
