import React, { useState } from 'react';
import { Recycle, Plus, Trash2, Edit2, Download, Image as ImageIcon, Sliders } from 'lucide-react';
import { ScrapBuyer, ScrapEntry, AppLanguage, LedgerColumnConfig, ExportDocumentConfig } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, downloadCSV, exportTablePDF, exportTableJPG } from '../utils/helpers';
import { openExportModal } from '../utils/exportSettingsHelper';
import { computeScrapBuyerLedgerDetails } from '../utils/mathEngine';
import {
  buildLedgerExportTableData,
  getStoredLedgerColumnConfig,
  saveStoredLedgerColumnConfig
} from '../utils/ledgerExportHelper';
import { EditLedgerEntryModal } from './EditLedgerEntryModal';
import { LedgerStudioModal, DEFAULT_LEDGER_COLUMNS } from './LedgerStudioModal';

interface ScrapLedgerViewProps {
  buyers: ScrapBuyer[];
  language: AppLanguage;
  companyName: string;
  onSaveBuyer: (buyer: ScrapBuyer, oldName?: string) => void;
  onDeleteBuyer: (name: string) => void;
  onAddScrapEntry: (buyerName: string, entry: Omit<ScrapEntry, 'id'>) => void;
  onDeleteScrapEntry: (buyerName: string, entryId: string) => void;
  onUpdateScrapEntry?: (buyerName: string, entryId: string, updatedData: any) => void;
}

export const ScrapLedgerView: React.FC<ScrapLedgerViewProps> = ({
  buyers,
  language,
  companyName,
  onSaveBuyer,
  onDeleteBuyer,
  onAddScrapEntry,
  onDeleteScrapEntry,
  onUpdateScrapEntry
}) => {
  const [selectedBuyerIdx, setSelectedBuyerIdx] = useState<number | null>(null);
  const [addBuyerModal, setAddBuyerModal] = useState(false);
  const [newBuyerName, setNewBuyerName] = useState('');

  // Form State
  const [desc, setDesc] = useState('');
  const [itemName, setItemName] = useState('Steel Wire Scrap');
  const [weight, setWeight] = useState('');
  const [rate, setRate] = useState('');
  const [debit, setDebit] = useState('');
  const [credit, setCredit] = useState('');
  const [date, setDate] = useState(todayISO());

  // Detailed payment & Studio states
  const [editingEntry, setEditingEntry] = useState<ScrapEntry | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [colConfig, setColConfig] = useState<LedgerColumnConfig>(() =>
    getStoredLedgerColumnConfig('scrap', DEFAULT_LEDGER_COLUMNS)
  );
  const [showExtendedPaymentFields, setShowExtendedPaymentFields] = useState(false);
  const [entryMethod, setEntryMethod] = useState('Cash');
  const [entryPaidBy, setEntryPaidBy] = useState('');
  const [entryPaidTo, setEntryPaidTo] = useState('');
  const [entryBankName, setEntryBankName] = useState('');
  const [entryAccountNumber, setEntryAccountNumber] = useState('');
  const [entryChequeNo, setEntryChequeNo] = useState('');

  const handleUpdateColConfig = (newCfg: LedgerColumnConfig) => {
    setColConfig(newCfg);
    saveStoredLedgerColumnConfig('scrap', newCfg);
  };

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const handleRecalcDebit = (wStr: string, rStr: string) => {
    const w = parseFloat(wStr) || 0;
    const r = parseFloat(rStr) || 0;
    if (w > 0 && r > 0 && !debit) {
      setDebit(String(w * r));
    }
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBuyerIdx === null) return;
    const b = buyers[selectedBuyerIdx];
    if (!b) return;

    const dVal = parseFloat(debit) || 0;
    const cVal = parseFloat(credit) || 0;
    if (dVal <= 0 && cVal <= 0) return;

    onAddScrapEntry(b.name, {
      date,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      desc: desc.trim() || 'Scrap transaction',
      itemName,
      weight: weight ? parseFloat(weight) : undefined,
      rate: rate ? parseFloat(rate) : undefined,
      debit: dVal,
      credit: cVal,
      method: cVal > 0 ? entryMethod : undefined,
      paidBy: entryPaidBy.trim() || undefined,
      paidTo: entryPaidTo.trim() || undefined,
      bankName: entryBankName.trim() || undefined,
      accountNumber: entryAccountNumber.trim() || undefined,
      chequeNo: entryChequeNo.trim() || undefined
    });

    setDesc('');
    setWeight('');
    setRate('');
    setDebit('');
    setCredit('');
    setEntryPaidBy('');
    setEntryPaidTo('');
    setEntryBankName('');
    setEntryAccountNumber('');
    setEntryChequeNo('');
  };

  const currentBuyer = selectedBuyerIdx !== null ? buyers[selectedBuyerIdx] : null;
  const currentBalance = currentBuyer
    ? currentBuyer.entries.reduce((sum, e) => sum + (e.debit || 0) - (e.credit || 0), 0)
    : 0;

  const handleExportCSV = (customCols?: LedgerColumnConfig) => {
    if (!currentBuyer) return;
    const effectiveCols = customCols || colConfig;
    const details = computeScrapBuyerLedgerDetails(currentBuyer.entries);
    const { headers, rows } = buildLedgerExportTableData(details.entriesWithBalance, effectiveCols);
    downloadCSV(`${currentBuyer.name}_Scrap_Ledger`, headers, rows);
  };

  const handleExportPDF = (customCols?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    if (!currentBuyer) return;
    const effectiveCols = customCols || colConfig;
    const details = computeScrapBuyerLedgerDetails(currentBuyer.entries);
    const { headers, rows } = buildLedgerExportTableData(details.entriesWithBalance, effectiveCols);
    openExportModal({
      title: `${currentBuyer.name} — Scrap Ledger`,
      headers,
      rows,
      filename: `${currentBuyer.name}_Scrap_Ledger`,
      companyName,
      subtitle: exportDocConfig?.subtitle || 'Industrial Scrap & Metal Offcut Sales',
      balanceFooterText: `Net Balance: ${fmt(currentBalance)}`,
      defaultFormat: 'pdf',
      initialOrientation: 'landscape'
    });
  };

  const handleExportJPG = (customCols?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    if (!currentBuyer) return;
    const effectiveCols = customCols || colConfig;
    const details = computeScrapBuyerLedgerDetails(currentBuyer.entries);
    const { headers, rows } = buildLedgerExportTableData(details.entriesWithBalance, effectiveCols);
    openExportModal({
      title: `${currentBuyer.name} — Scrap Ledger`,
      headers,
      rows,
      filename: `${currentBuyer.name}_Scrap_Ledger`,
      companyName,
      subtitle: exportDocConfig?.subtitle || 'Industrial Scrap & Metal Offcut Sales',
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
          <h2 className="font-serif font-black text-xl text-[var(--text)]">{t('scrapledger_title')}</h2>
          <p className="text-xs text-[var(--text-dim)]">{t('scrapledger_sub')}</p>
        </div>

        <button
          type="button"
          onClick={() => setAddBuyerModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow transition active:scale-95"
        >
          <Plus size={14} />
          <span>Add Scrap Buyer</span>
        </button>
      </div>

      {/* Buyers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {buyers.map((b, idx) => {
          const totalOwed = b.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
          const totalPaid = b.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
          const bal = totalOwed - totalPaid;

          return (
            <div
              key={b.name}
              className="bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] rounded-xl p-4 flex flex-col justify-between gap-3 shadow-sm transition group"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center text-[var(--yellow)]">
                  <Recycle size={16} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete ${b.name} and their whole ledger?`)) {
                      onDeleteBuyer(b.name);
                    }
                  }}
                  className="p-1.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:text-red-400 opacity-80 group-hover:opacity-100 transition"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-[var(--text)]">{b.name}</h4>
                <div className="text-[11px] text-[var(--text-dim)] font-mono mt-0.5">
                  {b.entries.length} scrap transactions recorded
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
                  onClick={() => setSelectedBuyerIdx(idx)}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] hover:bg-[var(--yellow)] hover:text-black border border-[var(--steel-line)] text-xs font-semibold transition"
                >
                  Ledger
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Buyer Modal */}
      {addBuyerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-sm bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-3">Add Scrap Buyer</h3>
            <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">Buyer Name</label>
            <input
              type="text"
              required
              value={newBuyerName}
              onChange={e => setNewBuyerName(e.target.value)}
              placeholder="e.g. Bismillah Scrap Merchant"
              className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddBuyerModal(false)}
                className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newBuyerName.trim()) {
                    onSaveBuyer({ name: newBuyerName.trim(), entries: [] });
                    setNewBuyerName('');
                    setAddBuyerModal(false);
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

      {/* Buyer Ledger Detail Modal */}
      {currentBuyer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 font-mono">
          <div className="w-full max-w-3xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-4 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-serif font-black text-lg sm:text-xl text-[var(--text)]">{currentBuyer.name}</h3>
                <span className="text-xs text-[var(--text-dim)]">Scrap Sales Account Ledger</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsStudioOpen(true)}
                  className="px-2.5 py-1 rounded bg-[var(--yellow)]/15 border border-[var(--yellow)]/30 text-[var(--yellow)] hover:bg-[var(--yellow)]/25 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="Open Ledger Studio to select export columns & visual layout"
                >
                  <Sliders size={12} />
                  <span>Ledger Studio</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportCSV()}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)]"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPDF()}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)]"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleExportJPG()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500 hover:text-black text-xs font-semibold text-amber-400 transition"
                  title="Export High-Resolution JPG Image"
                >
                  <ImageIcon size={12} />
                  <span>JPG</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBuyerIdx(null)}
                  className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Net Balance & Breakdown */}
            {(() => {
              const details = computeScrapBuyerLedgerDetails(currentBuyer.entries);
              return (
                <div className="my-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Total Scrap Billed (Debit)</div>
                    <div className="text-base font-bold text-[var(--red)] mt-0.5">{fmt(details.totalDebits)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Total Received (Credit)</div>
                    <div className="text-base font-bold text-[var(--green)] mt-0.5">{fmt(details.totalCredits)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Net Balance Due</div>
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
                        {details.netBalance > 0 ? 'Buyer Owes' : details.netBalance < 0 ? 'Advance' : 'Settled'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Entries Table */}
            <div className="flex-1 overflow-y-auto min-h-[160px] border border-[var(--steel-line)] rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)]">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Description / Item</th>
                    <th className="p-2.5">Weight (kg)</th>
                    <th className="p-2.5 text-right">Debit (Owed)</th>
                    <th className="p-2.5 text-right">Credit (Paid)</th>
                    <th className="p-2.5 text-right">Running Balance</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--steel-line)]">
                  {currentBuyer.entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-[var(--text-dim)]">
                        No scrap sales entries recorded yet.
                      </td>
                    </tr>
                  ) : (
                    computeScrapBuyerLedgerDetails(currentBuyer.entries).entriesWithBalance.map(e => (
                      <tr key={e.id} className="hover:bg-[var(--panel-raised)]/50">
                        <td className="p-2.5 whitespace-nowrap">{e.date}</td>
                        <td className="p-2.5">
                          <div>{e.desc}</div>
                          {e.itemName && (
                            <div className="text-[10px] text-[var(--yellow)]">
                              {e.itemName} {e.rate ? `@ ${fmt(e.rate)}/kg` : ''}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-[var(--text-dim)]">{e.weight ? `${e.weight} kg` : '—'}</td>
                        <td className="p-2.5 text-right font-semibold text-[var(--red)]">
                          {e.debit ? fmt(e.debit) : '—'}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-[var(--green)]">
                          {e.credit ? (
                            <div>
                              <div>{fmt(e.credit)}</div>
                              {e.method && (
                                <div className="text-[10px] text-[var(--yellow)] font-mono">{e.method}</div>
                              )}
                              {(e.paidBy || e.paidTo) && (
                                <div className="text-[9px] text-[var(--text-dim)] flex items-center justify-end gap-1 flex-wrap">
                                  {e.paidBy && <span>By: <strong className="text-[var(--text)]">{e.paidBy}</strong></span>}
                                  {e.paidTo && <span>→ To: <strong className="text-[var(--text)]">{e.paidTo}</strong></span>}
                                </div>
                              )}
                              {e.accountNumber && (
                                <div className="text-[9px] text-[var(--yellow)] font-mono">
                                  A/C: {e.accountNumber} {e.bankName && `(${e.bankName})`}
                                </div>
                              )}
                              {e.chequeNo && (
                                <div className="text-[9px] text-[var(--text-dim)] font-mono">
                                  Ref: {e.chequeNo}
                                </div>
                              )}
                            </div>
                          ) : '—'}
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
                            {e.runningBalance > 0 ? 'Dr' : e.runningBalance < 0 ? 'Cr' : ''}
                          </span>
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingEntry(e)}
                              className="text-[var(--text-dim)] hover:text-[var(--yellow)] hover:bg-[var(--panel-raised)] p-1 rounded transition cursor-pointer"
                              title="Edit Entry Details"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteScrapEntry(currentBuyer.name, e.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1 rounded transition cursor-pointer"
                              title="Delete Entry"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleAddEntry} className="mt-3 pt-3 border-t border-[var(--steel-line)] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-bold text-xs uppercase text-[var(--yellow)]">+ Log Scrap Sale or Payment</div>
                <button
                  type="button"
                  onClick={() => setShowExtendedPaymentFields(!showExtendedPaymentFields)}
                  className="text-[10px] text-[var(--yellow)] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                >
                  {showExtendedPaymentFields ? 'Hide Payment Channels' : '+ Detailed Payment (By / To / A/C)'}
                </button>
              </div>

              {/* Extended Payment Channels when toggled */}
              {showExtendedPaymentFields && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                  <select
                    value={entryMethod}
                    onChange={e => setEntryMethod(e.target.value)}
                    className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Transfer</option>
                    <option value="Online">Online / EasyPaisa</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                  <input
                    type="text"
                    value={entryPaidBy}
                    onChange={e => setEntryPaidBy(e.target.value)}
                    placeholder="Paid By (e.g. Buyer Name)"
                    className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                  />
                  <input
                    type="text"
                    value={entryPaidTo}
                    onChange={e => setEntryPaidTo(e.target.value)}
                    placeholder="Paid To (e.g. Workshop Cashier)"
                    className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                  />
                  <input
                    type="text"
                    value={entryBankName}
                    onChange={e => setEntryBankName(e.target.value)}
                    placeholder="Bank (e.g. Meezan, HBL)"
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
                <input
                  type="text"
                  required
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="e.g. Iron wire cutting / Payment received"
                  className="sm:col-span-2 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none"
                />
                <input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={e => {
                    setWeight(e.target.value);
                    handleRecalcDebit(e.target.value, rate);
                  }}
                  placeholder="Weight (kg)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
                <input
                  type="number"
                  min="0"
                  value={rate}
                  onChange={e => {
                    setRate(e.target.value);
                    handleRecalcDebit(weight, e.target.value);
                  }}
                  placeholder="Rate per kg"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  value={debit}
                  onChange={e => setDebit(e.target.value)}
                  placeholder="Debit - Owed (Rs)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
                <input
                  type="number"
                  min="0"
                  value={credit}
                  onChange={e => setCredit(e.target.value)}
                  placeholder="Credit - Paid (Rs)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow hover:bg-amber-400 transition cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Scrap Entry Modal */}
      {editingEntry && currentBuyer && (
        <EditLedgerEntryModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          title={`Edit Scrap Entry · ${currentBuyer.name}`}
          ledgerName={currentBuyer.name}
          entry={editingEntry}
          onSave={updated => {
            if (onUpdateScrapEntry) {
              onUpdateScrapEntry(currentBuyer.name, editingEntry.id, updated);
            }
          }}
        />
      )}

      {/* Ledger Column & Export Studio Modal */}
      {isStudioOpen && currentBuyer && (
        <LedgerStudioModal
          isOpen={isStudioOpen}
          onClose={() => setIsStudioOpen(false)}
          ledgerName={currentBuyer.name}
          ledgerSubtitle="Industrial Scrap & Metal Offcut Sales Ledger"
          columnConfig={colConfig}
          onUpdateColumnConfig={handleUpdateColConfig}
          companyName={companyName}
          activeBalance={currentBalance}
          sampleRows={currentBuyer.entries}
          onExportCSV={cfg => handleExportCSV(cfg)}
          onExportPDF={(cfg, docCfg) => handleExportPDF(cfg, docCfg)}
          onExportJPG={(cfg, docCfg) => handleExportJPG(cfg, docCfg)}
        />
      )}
    </div>
  );
};
