import React, { useState } from 'react';
import { Wallet, Plus, ArrowUpRight, RotateCcw, Download, Image as ImageIcon } from 'lucide-react';
import { WithdrawalEntry, AppLanguage } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, downloadCSV, exportTablePDF } from '../utils/helpers';
import { exportTableJPG } from '../utils/exportManager';

interface WithdrawalViewProps {
  withdrawals: WithdrawalEntry[];
  language: AppLanguage;
  companyName: string;
  onAddWithdrawal: (entry: Omit<WithdrawalEntry, 'id'>) => void;
  onReverseWithdrawal: (id: string) => void;
}

export const WithdrawalView: React.FC<WithdrawalViewProps> = ({
  withdrawals,
  language,
  companyName,
  onAddWithdrawal,
  onReverseWithdrawal
}) => {
  const [amount, setAmount] = useState('');
  const [withdrawnBy, setWithdrawnBy] = useState('Umar');
  const [withdrawnIn, setWithdrawnIn] = useState<'Cash' | 'Bank'>('Cash');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const totalWithdrawn = withdrawals.reduce((sum, w) => sum + (w.isReversed ? 0 : w.amount), 0);
  const byUmar = withdrawals.filter(w => (w.withdrawnBy === 'Umar' || w.withdrawnBy === 'Umar Zaman') && !w.isReversed).reduce((s, w) => s + w.amount, 0);
  const otherWithdrawn = totalWithdrawn - byUmar;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;

    onAddWithdrawal({
      date,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      amount: amt,
      desc: note.trim() || `Drawing by ${withdrawnBy}`,
      method: withdrawnIn,
      detail: `Withdrawn by ${withdrawnBy}`,
      withdrawnBy,
      withdrawnIn,
      note: note.trim() || undefined
    });

    setAmount('');
    setNote('');
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Withdrawn By', 'Method', 'Amount (Rs)', 'Status', 'Note'];
    const rows = withdrawals.map(w => [
      w.date,
      w.withdrawnBy || w.detail || '—',
      w.withdrawnIn || w.method || 'Cash',
      w.amount,
      w.isReversed ? 'Reversed' : 'Active',
      w.note || w.desc || '—'
    ]);
    downloadCSV('Owner_Withdrawals', headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['Date', 'By', 'Method', 'Amount', 'Status', 'Note'];
    const rows = withdrawals.map(w => [
      w.date,
      w.withdrawnBy || w.detail || '—',
      w.withdrawnIn || w.method || 'Cash',
      fmt(w.amount),
      w.isReversed ? 'Reversed' : 'Active',
      w.note || w.desc || '—'
    ]);
    exportTablePDF('Owner Drawings & Withdrawals', headers, rows, 'Owner_Withdrawals', 'portrait', companyName);
  };

  const handleExportJPG = async () => {
    const headers = ['Date', 'By', 'Method', 'Amount (PKR)', 'Status', 'Note'];
    const rows = withdrawals.map(w => [
      w.date,
      w.withdrawnBy || w.detail || '—',
      w.withdrawnIn || w.method || 'Cash',
      fmt(w.amount),
      w.isReversed ? 'Reversed' : 'Active',
      w.note || w.desc || '—'
    ]);
    await exportTableJPG(
      'Owner Drawings & Withdrawals',
      headers,
      rows,
      'Owner_Withdrawals',
      companyName,
      'Equity & Partner Withdrawals Log',
      `Total Active Drawings: ${fmt(totalWithdrawn)}`
    );
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3 font-sans">
        <div>
          <h2 className="font-serif font-black text-xl text-[var(--text)]">{t('withdrawal_title')}</h2>
          <p className="text-xs text-[var(--text-dim)]">{t('withdrawal_sub')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] transition"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="px-3 py-1.5 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] transition"
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
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-[var(--text-dim)]">Total Active Drawings</div>
            <div className="text-2xl font-bold text-[var(--yellow)] mt-1">{fmt(totalWithdrawn)}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center text-[var(--yellow)]">
            <Wallet size={18} />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-[var(--text-dim)]">Withdrawn by Umar</div>
            <div className="text-xl font-bold text-[var(--yellow)] mt-1">{fmt(byUmar)}</div>
          </div>
          <span className="text-xs text-[var(--text-dim)]">Owner</span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-[var(--text-dim)]">Other / Staff Drawings</div>
            <div className="text-xl font-bold text-[var(--text)] mt-1">{fmt(otherWithdrawn)}</div>
          </div>
          <span className="text-xs text-[var(--text-dim)]">Operational</span>
        </div>
      </div>

      {/* Add Withdrawal Form */}
      <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)]">
        <h3 className="font-serif font-bold text-sm text-[var(--text)] mb-3 flex items-center gap-2 font-sans">
          <ArrowUpRight size={16} className="text-[var(--yellow)]" />
          <span>Record New Drawing / Cash Withdrawal</span>
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">{t('amount_rs')}</label>
              <input
                type="number"
                min="1"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Amount (Rs)"
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--yellow)]"
              />
            </div>

            <div>
              <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">Withdrawn By</label>
              <select
                value={withdrawnBy}
                onChange={e => setWithdrawnBy(e.target.value)}
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)]"
              >
                <option value="Umar">Umar</option>
                <option value="Staff">Staff</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">Withdrawn In</label>
              <select
                value={withdrawnIn}
                onChange={e => setWithdrawnIn(e.target.value as any)}
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)]"
              >
                <option value="Cash">Cash Drawer</option>
                <option value="Bank">Bank Account</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">{t('entry_date')}</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)]"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Note / Purpose (e.g. Personal emergency, family expense)"
              className="flex-1 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
            />
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow hover:bg-amber-400 transition shrink-0"
            >
              Record Withdrawal
            </button>
          </div>
        </form>
      </div>

      {/* Withdrawals Log Table */}
      <div className="border border-[var(--steel-line)] rounded-xl overflow-hidden bg-[var(--panel)]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)]">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Partner</th>
              <th className="p-3">Source</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Note</th>
              <th className="p-3 text-center">Status / Reversal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--steel-line)]">
            {withdrawals.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-[var(--text-dim)]">
                  No withdrawals recorded yet.
                </td>
              </tr>
            ) : (
              withdrawals.map(w => (
                <tr key={w.id} className={w.isReversed ? 'opacity-50 line-through' : 'hover:bg-[var(--panel-raised)]/50'}>
                  <td className="p-3 whitespace-nowrap">{w.date}</td>
                  <td className="p-3 font-semibold text-[var(--yellow)]">{w.withdrawnBy}</td>
                  <td className="p-3 text-[var(--text-dim)]">{w.withdrawnIn}</td>
                  <td className="p-3 text-right font-bold text-sm text-[var(--text)]">{fmt(w.amount)}</td>
                  <td className="p-3 text-[var(--text-dim)]">{w.note || '—'}</td>
                  <td className="p-3 text-center">
                    {w.isReversed ? (
                      <span className="text-[10px] text-emerald-400 font-bold uppercase">Returned</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onReverseWithdrawal(w.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-emerald-500 hover:text-emerald-400 text-[10px] font-bold uppercase transition"
                        title="Return funds to business"
                      >
                        <RotateCcw size={10} />
                        <span>Return</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
