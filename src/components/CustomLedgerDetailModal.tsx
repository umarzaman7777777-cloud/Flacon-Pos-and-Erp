import React, { useState } from 'react';
import { CustomLedger, CustomLedgerEntry, AppLanguage, LedgerColumnConfig, ExportDocumentConfig } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, downloadCSV, exportTablePDF, exportTableJPG } from '../utils/helpers';
import { openExportModal } from '../utils/exportSettingsHelper';
import {
  buildLedgerExportTableData,
  getStoredLedgerColumnConfig,
  saveStoredLedgerColumnConfig
} from '../utils/ledgerExportHelper';
import { Trash2, Download, FileText, AlertCircle, Sliders, Edit2, Image as ImageIcon } from 'lucide-react';
import { EditLedgerEntryModal } from './EditLedgerEntryModal';
import { LedgerStudioModal, DEFAULT_LEDGER_COLUMNS } from './LedgerStudioModal';

interface CustomLedgerDetailModalProps {
  customLedger: CustomLedger;
  language: AppLanguage;
  companyName: string;
  onClose: () => void;
  onAddEntry: (id: string, entry: Omit<CustomLedgerEntry, 'id'>) => void;
  onDeleteEntry: (ledgerId: string, entryId: string) => void;
  onUpdateEntry?: (ledgerId: string, entryId: string, updatedData: any) => void;
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
  onUpdateEntry,
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

  // Detailed payment & Studio states
  const [editingEntry, setEditingEntry] = useState<CustomLedgerEntry | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [colConfig, setColConfig] = useState<LedgerColumnConfig>(() =>
    getStoredLedgerColumnConfig('custom', DEFAULT_LEDGER_COLUMNS)
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
    saveStoredLedgerColumnConfig('custom', newCfg);
  };

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
      credit: cVal,
      method: cVal > 0 ? entryMethod : undefined,
      paidBy: entryPaidBy.trim() || undefined,
      paidTo: entryPaidTo.trim() || undefined,
      bankName: entryBankName.trim() || undefined,
      accountNumber: entryAccountNumber.trim() || undefined,
      chequeNo: entryChequeNo.trim() || undefined
    });

    setDesc('');
    setQty('');
    setRate('');
    setDebit('');
    setCredit('');
    setEntryPaidBy('');
    setEntryPaidTo('');
    setEntryBankName('');
    setEntryAccountNumber('');
    setEntryChequeNo('');
  };

  const handleExportCSV = (customCols?: LedgerColumnConfig) => {
    const effectiveCols = customCols || colConfig;
    const { headers, rows } = buildLedgerExportTableData(
      customLedger.entries.map(e => ({
        ...e,
        runningBalance: (e.debit || 0) - (e.credit || 0)
      })),
      effectiveCols
    );
    downloadCSV(`${customLedger.name}_JobWork_Ledger`, headers, rows);
  };

  const handleExportPDF = (customCols?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    const effectiveCols = customCols || colConfig;
    const { headers, rows } = buildLedgerExportTableData(
      customLedger.entries.map(e => ({
        ...e,
        runningBalance: (e.debit || 0) - (e.credit || 0)
      })),
      effectiveCols
    );
    openExportModal({
      title: `${customLedger.name} — Job-Work & Ancillary Ledger`,
      headers,
      rows,
      filename: `${customLedger.name.replace(/\s+/g, '_')}_JobWork_Ledger`,
      companyName,
      subtitle: exportDocConfig?.subtitle || 'Factory Ancillary & Job-Work Ledger',
      balanceFooterText: `Net Balance: ${fmt(netBalance)}`,
      defaultFormat: 'pdf',
      initialOrientation: 'landscape'
    });
  };

  const handleExportJPG = (customCols?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    const effectiveCols = customCols || colConfig;
    const { headers, rows } = buildLedgerExportTableData(
      customLedger.entries.map(e => ({
        ...e,
        runningBalance: (e.debit || 0) - (e.credit || 0)
      })),
      effectiveCols
    );
    openExportModal({
      title: `${customLedger.name} — Job-Work & Ancillary Ledger`,
      headers,
      rows,
      filename: `${customLedger.name.replace(/\s+/g, '_')}_JobWork_Ledger`,
      companyName,
      subtitle: exportDocConfig?.subtitle || 'Factory Ancillary & Job-Work Ledger',
      balanceFooterText: `Net Balance: ${fmt(netBalance)}`,
      defaultFormat: 'jpg',
      initialOrientation: 'landscape'
    });
  };

  const handleDeleteLedger = () => {
    if (!onDeleteCustomLedger) return;
    if (window.confirm(`Are you sure you want to delete the entire custom ledger for "${customLedger.name}"? This cannot be undone.`)) {
      onDeleteCustomLedger(customLedger.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 font-mono">
      <div className="w-full max-w-3xl max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-3 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-serif font-black text-lg sm:text-xl text-[var(--text)]">{customLedger.name}</h3>
            <span className="text-xs text-[var(--text-dim)]">Factory Ancillary & Job-Work Ledger</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
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
              onClick={() => handleExportPDF()}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-red-500/60 text-xs font-semibold text-red-400 hover:text-red-300 transition cursor-pointer"
              title="Export PDF Document"
            >
              <FileText size={13} />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportJPG()}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-amber-400 hover:text-amber-300 transition cursor-pointer"
              title="Export JPG Image"
            >
              <ImageIcon size={13} />
              <span>JPG</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportCSV()}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer"
              title="Export CSV Spreadsheet"
            >
              <Download size={13} />
              <span>CSV</span>
            </button>
            {onDeleteCustomLedger && (
              <button
                type="button"
                onClick={handleDeleteLedger}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/10 border border-red-500/30 hover:border-red-500 text-xs font-semibold text-red-400 hover:text-red-300 transition cursor-pointer"
                title="Delete this entire custom ledger"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] cursor-pointer"
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

        {/* Mobile swipe hint */}
        <div className="sm:hidden flex items-center justify-between text-[10px] text-[var(--text-dim)] py-1 px-1">
          <span>← Swipe sideways to view full ledger →</span>
        </div>

        {/* Entries Table */}
        <div className="flex-1 overflow-auto max-w-full min-h-[140px] max-h-[45vh] shrink-0 border border-[var(--steel-line)] rounded-lg ledger-scroll-container">
          <table className="w-full text-left text-xs border-collapse min-w-[580px]">
            <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)] sticky top-0">
              <tr>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Description</th>
                <th className="p-2.5">Size/Qty</th>
                <th className="p-2.5 text-right">Debit (Billed)</th>
                <th className="p-2.5 text-right">Credit (Received)</th>
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
                    <td className="p-2.5">
                      <div className="font-semibold text-[var(--text)]">{e.desc}</div>
                      {e.detail && <div className="text-[10px] text-[var(--text-dim)]">{e.detail}</div>}
                    </td>
                    <td className="p-2.5 text-[var(--text-dim)]">
                      {[e.size, e.qty && `${e.qty} pcs`, e.rate && `@ ${fmt(e.rate)}`].filter(Boolean).join(' · ')}
                    </td>
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
                    <td className="p-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingEntry(e)}
                          className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--yellow)] hover:bg-[var(--panel-raised)] transition cursor-pointer"
                          title="Edit Entry Details"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteEntry(customLedger.id, e.id)}
                          className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition cursor-pointer"
                          title="Delete entry"
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
        <form onSubmit={handleAddSubmit} className="mt-3 pt-3 border-t border-[var(--steel-line)] space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-bold text-xs uppercase text-[var(--yellow)]">+ Log Job-Work / Payment Entry</div>
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
                placeholder="Paid By (e.g. Party Name)"
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
              className="py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow hover:bg-amber-400 transition cursor-pointer"
            >
              Save Entry
            </button>
          </div>
        </form>
      </div>

      {/* Edit Custom Ledger Entry Modal */}
      {editingEntry && (
        <EditLedgerEntryModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          title={`Edit Entry · ${customLedger.name}`}
          ledgerName={customLedger.name}
          entry={editingEntry}
          onSave={updated => {
            if (onUpdateEntry) {
              onUpdateEntry(customLedger.id, editingEntry.id, updated);
            }
          }}
        />
      )}

      {/* Ledger Column & Export Studio Modal */}
      {isStudioOpen && (
        <LedgerStudioModal
          isOpen={isStudioOpen}
          onClose={() => setIsStudioOpen(false)}
          ledgerName={customLedger.name}
          ledgerSubtitle="Factory Ancillary & Job-Work Ledger Account"
          columnConfig={colConfig}
          onUpdateColumnConfig={handleUpdateColConfig}
          companyName={companyName}
          activeBalance={netBalance}
          sampleRows={customLedger.entries.map(e => ({
            ...e,
            runningBalance: (e.debit || 0) - (e.credit || 0)
          }))}
          onExportCSV={cfg => handleExportCSV(cfg)}
          onExportPDF={(cfg, docCfg) => handleExportPDF(cfg, docCfg)}
          onExportJPG={(cfg, docCfg) => handleExportJPG(cfg, docCfg)}
        />
      )}
    </div>
  );
};
