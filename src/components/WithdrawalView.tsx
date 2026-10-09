import React, { useState } from 'react';
import { Wallet, Plus, ArrowUpRight, RotateCcw, Download, Image as ImageIcon, Sliders, Edit2 } from 'lucide-react';
import { WithdrawalEntry, AppLanguage, LedgerColumnConfig, ExportDocumentConfig } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, downloadCSV, exportTablePDF, exportTableJPG } from '../utils/helpers';
import { openExportModal } from '../utils/exportSettingsHelper';
import {
  buildLedgerExportTableData,
  getStoredLedgerColumnConfig,
  saveStoredLedgerColumnConfig
} from '../utils/ledgerExportHelper';
import { EditLedgerEntryModal } from './EditLedgerEntryModal';
import { LedgerStudioModal, DEFAULT_LEDGER_COLUMNS } from './LedgerStudioModal';

interface WithdrawalViewProps {
  withdrawals: WithdrawalEntry[];
  language: AppLanguage;
  companyName: string;
  onAddWithdrawal: (entry: Omit<WithdrawalEntry, 'id'>) => void;
  onReverseWithdrawal: (id: string) => void;
  onUpdateWithdrawal?: (id: string, updatedData: any) => void;
}

export const WithdrawalView: React.FC<WithdrawalViewProps> = ({
  withdrawals,
  language,
  companyName,
  onAddWithdrawal,
  onReverseWithdrawal,
  onUpdateWithdrawal
}) => {
  const [amount, setAmount] = useState('');
  const [withdrawnBy, setWithdrawnBy] = useState('Umar');
  const [withdrawnIn, setWithdrawnIn] = useState<'Cash' | 'Bank'>('Cash');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());

  // Detailed payment & Studio states
  const [editingEntry, setEditingEntry] = useState<WithdrawalEntry | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [colConfig, setColConfig] = useState<LedgerColumnConfig>(() =>
    getStoredLedgerColumnConfig('withdrawal', DEFAULT_LEDGER_COLUMNS)
  );
  const [showExtendedPaymentFields, setShowExtendedPaymentFields] = useState(false);
  const [entryPaidBy, setEntryPaidBy] = useState('');
  const [entryPaidTo, setEntryPaidTo] = useState('');
  const [entryBankName, setEntryBankName] = useState('');
  const [entryAccountNumber, setEntryAccountNumber] = useState('');
  const [entryChequeNo, setEntryChequeNo] = useState('');

  const handleUpdateColConfig = (newCfg: LedgerColumnConfig) => {
    setColConfig(newCfg);
    saveStoredLedgerColumnConfig('withdrawal', newCfg);
  };

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
      note: note.trim() || undefined,
      paidBy: entryPaidBy.trim() || undefined,
      paidTo: entryPaidTo.trim() || withdrawnBy,
      bankName: entryBankName.trim() || undefined,
      accountNumber: entryAccountNumber.trim() || undefined,
      chequeNo: entryChequeNo.trim() || undefined
    });

    setAmount('');
    setNote('');
    setEntryPaidBy('');
    setEntryPaidTo('');
    setEntryBankName('');
    setEntryAccountNumber('');
    setEntryChequeNo('');
  };

  const handleExportCSV = (customCols?: LedgerColumnConfig) => {
    const effectiveCols = customCols || colConfig;
    const { headers, rows } = buildLedgerExportTableData(
      withdrawals.map(w => ({
        ...w,
        debit: w.amount,
        credit: 0,
        runningBalance: w.amount,
        desc: w.note || w.desc,
        paidBy: w.paidBy || 'Business Cash/Bank',
        paidTo: w.paidTo || w.withdrawnBy
      })),
      effectiveCols
    );
    downloadCSV('Owner_Withdrawals', headers, rows);
  };

  const handleExportPDF = (customCols?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    const effectiveCols = customCols || colConfig;
    const { headers, rows } = buildLedgerExportTableData(
      withdrawals.map(w => ({
        ...w,
        debit: w.amount,
        credit: 0,
        runningBalance: w.amount,
        desc: w.note || w.desc,
        paidBy: w.paidBy || 'Business Cash/Bank',
        paidTo: w.paidTo || w.withdrawnBy
      })),
      effectiveCols
    );
    openExportModal({
      title: 'Owner Drawings & Withdrawals',
      headers,
      rows,
      filename: 'Owner_Withdrawals',
      companyName,
      subtitle: exportDocConfig?.subtitle || 'Proprietor Drawings & Capital Withdrawals',
      balanceFooterText: `Total Drawings: ${fmt(totalWithdrawn)}`,
      defaultFormat: 'pdf',
      initialOrientation: 'landscape'
    });
  };

  const handleExportJPG = (customCols?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    const effectiveCols = customCols || colConfig;
    const { headers, rows } = buildLedgerExportTableData(
      withdrawals.map(w => ({
        ...w,
        debit: w.amount,
        credit: 0,
        runningBalance: w.amount,
        desc: w.note || w.desc,
        paidBy: w.paidBy || 'Business Cash/Bank',
        paidTo: w.paidTo || w.withdrawnBy
      })),
      effectiveCols
    );
    openExportModal({
      title: 'Owner Drawings & Withdrawals',
      headers,
      rows,
      filename: 'Owner_Withdrawals',
      companyName,
      subtitle: exportDocConfig?.subtitle || 'Proprietor Drawings & Capital Withdrawals',
      balanceFooterText: `Total Drawings: ${fmt(totalWithdrawn)}`,
      defaultFormat: 'jpg',
      initialOrientation: 'landscape'
    });
  };

  return (
    <div className="space-y-6 font-mono max-w-full overflow-x-hidden break-words">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3 font-sans">
        <div>
          <h2 className="font-serif font-black text-xl text-[var(--text)]">{t('withdrawal_title')}</h2>
          <p className="text-xs text-[var(--text-dim)]">{t('withdrawal_sub')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsStudioOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-[var(--yellow)]/30 bg-[var(--yellow)]/15 text-xs font-bold text-[var(--yellow)] hover:bg-[var(--yellow)]/25 transition flex items-center gap-1.5 cursor-pointer"
            title="Open Ledger Studio to select export columns & visual layout"
          >
            <Sliders size={13} />
            <span>Ledger Studio</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportCSV()}
            className="px-3 py-1.5 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] transition"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => handleExportPDF()}
            className="px-3 py-1.5 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] transition"
          >
            PDF
          </button>
          <button
            type="button"
            onClick={() => handleExportJPG()}
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif font-bold text-sm text-[var(--text)] flex items-center gap-2 font-sans">
            <ArrowUpRight size={16} className="text-[var(--yellow)]" />
            <span>Record New Drawing / Cash Withdrawal</span>
          </h3>
          <button
            type="button"
            onClick={() => setShowExtendedPaymentFields(!showExtendedPaymentFields)}
            className="text-[10px] text-[var(--yellow)] hover:underline flex items-center gap-1 cursor-pointer font-bold"
          >
            {showExtendedPaymentFields ? 'Hide Payment Channels' : '+ Detailed Payment (By / To / A/C)'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {/* Extended Payment Channels when toggled */}
          {showExtendedPaymentFields && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)]">
              <select
                value={withdrawnIn}
                onChange={e => setWithdrawnIn(e.target.value as any)}
                className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
              >
                <option value="Cash">Cash Drawer</option>
                <option value="Bank">Bank Account</option>
              </select>
              <input
                type="text"
                value={entryPaidBy}
                onChange={e => setEntryPaidBy(e.target.value)}
                placeholder="Disbursed By (e.g. Workshop Cashier)"
                className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
              />
              <input
                type="text"
                value={entryPaidTo}
                onChange={e => setEntryPaidTo(e.target.value)}
                placeholder="Received By / Partner"
                className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
              />
              <input
                type="text"
                value={entryBankName}
                onChange={e => setEntryBankName(e.target.value)}
                placeholder="Bank Name (e.g. Meezan, HBL)"
                className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
              />
              <input
                type="text"
                value={entryAccountNumber}
                onChange={e => setEntryAccountNumber(e.target.value)}
                placeholder="Account Number / IBAN"
                className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
              />
            </div>
          )}

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
              className="px-5 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow hover:bg-amber-400 transition shrink-0 cursor-pointer"
            >
              Record Withdrawal
            </button>
          </div>
        </form>
      </div>

      {/* Mobile swipe hint */}
      <div className="sm:hidden flex items-center justify-between text-[10px] text-[var(--text-dim)] pb-1 px-1">
        <span>← Swipe sideways to view full ledger →</span>
      </div>

      {/* Withdrawals Log Table */}
      <div className="border border-[var(--steel-line)] rounded-xl overflow-x-auto max-w-full bg-[var(--panel)] ledger-scroll-container">
        <table className="w-full text-left text-xs border-collapse min-w-[620px]">
          <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)]">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Partner / Receiver</th>
              <th className="p-3">Source & Channel</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Note</th>
              <th className="p-3 text-center">Action / Status</th>
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
                  <td className="p-3 font-semibold text-[var(--yellow)]">
                    <div>{w.withdrawnBy}</div>
                    {(w.paidBy || w.paidTo) && (
                      <div className="text-[10px] text-[var(--text-dim)] flex items-center gap-1 mt-0.5">
                        {w.paidBy && <span>By: {w.paidBy}</span>}
                        {w.paidTo && <span>→ To: {w.paidTo}</span>}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-[var(--text-dim)]">
                    <div className="font-semibold text-[var(--text)]">{w.withdrawnIn || w.method || 'Cash'}</div>
                    {w.accountNumber && (
                      <div className="text-[10px] text-[var(--yellow)] font-mono mt-0.5">
                        A/C: {w.accountNumber} {w.bankName && `(${w.bankName})`}
                      </div>
                    )}
                    {w.chequeNo && (
                      <div className="text-[9px] text-[var(--text-dim)] mt-0.5">
                        Ref: {w.chequeNo}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right font-bold text-sm text-[var(--text)]">{fmt(w.amount)}</td>
                  <td className="p-3 text-[var(--text-dim)]">{w.note || w.desc || '—'}</td>
                  <td className="p-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingEntry(w)}
                        className="p-1.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--yellow)] transition cursor-pointer"
                        title="Edit Withdrawal Details"
                      >
                        <Edit2 size={12} />
                      </button>
                      {w.isReversed ? (
                        <span className="text-[10px] text-emerald-400 font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">Returned</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onReverseWithdrawal(w.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-emerald-500 hover:text-emerald-400 text-[10px] font-bold uppercase transition cursor-pointer"
                          title="Return funds to business"
                        >
                          <RotateCcw size={10} />
                          <span>Return</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Withdrawal Entry Modal */}
      {editingEntry && (
        <EditLedgerEntryModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          title="Edit Owner Drawing / Withdrawal"
          ledgerName="Owner Drawings"
          entry={{
            ...editingEntry,
            debit: editingEntry.amount,
            credit: 0
          }}
          onSave={updated => {
            if (onUpdateWithdrawal) {
              onUpdateWithdrawal(editingEntry.id, {
                ...updated,
                amount: updated.debit || updated.amount || editingEntry.amount
              });
            }
          }}
        />
      )}

      {/* Ledger Column & Export Studio Modal */}
      {isStudioOpen && (
        <LedgerStudioModal
          isOpen={isStudioOpen}
          onClose={() => setIsStudioOpen(false)}
          ledgerName="Owner Drawings & Capital Withdrawals"
          ledgerSubtitle="Proprietor Drawings & Capital Withdrawals Ledger"
          columnConfig={colConfig}
          onUpdateColumnConfig={handleUpdateColConfig}
          companyName={companyName}
          activeBalance={totalWithdrawn}
          sampleRows={withdrawals.map(w => ({
            ...w,
            debit: w.amount,
            credit: 0,
            runningBalance: w.amount,
            desc: w.note || w.desc
          }))}
          onExportCSV={cfg => handleExportCSV(cfg)}
          onExportPDF={(cfg, docCfg) => handleExportPDF(cfg, docCfg)}
          onExportJPG={(cfg, docCfg) => handleExportJPG(cfg, docCfg)}
        />
      )}
    </div>
  );
};
