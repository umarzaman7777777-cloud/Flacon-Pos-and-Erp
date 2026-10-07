import React, { useState } from 'react';
import { Receipt, Plus, Trash2, Download, Tag, Image as ImageIcon, Sliders, Edit2 } from 'lucide-react';
import { Expense, AppLanguage, LedgerColumnConfig, ExportDocumentConfig } from '../types';
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

interface ExpensesViewProps {
  expenses: Expense[];
  categories: string[];
  language: AppLanguage;
  companyName: string;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateExpense?: (id: string, updatedData: any) => void;
  onAddCategory: (category: string) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  categories,
  language,
  companyName,
  onAddExpense,
  onDeleteExpense,
  onUpdateExpense,
  onAddCategory
}) => {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0] || 'Factory Electricity');
  const [method, setMethod] = useState('Cash');
  const [date, setDate] = useState(todayISO());

  // Detailed payment & Studio states
  const [editingEntry, setEditingEntry] = useState<Expense | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [colConfig, setColConfig] = useState<LedgerColumnConfig>(() =>
    getStoredLedgerColumnConfig('expenses', DEFAULT_LEDGER_COLUMNS)
  );
  const [showExtendedPaymentFields, setShowExtendedPaymentFields] = useState(false);
  const [entryPaidBy, setEntryPaidBy] = useState('');
  const [entryPaidTo, setEntryPaidTo] = useState('');
  const [entryBankName, setEntryBankName] = useState('');
  const [entryAccountNumber, setEntryAccountNumber] = useState('');
  const [entryChequeNo, setEntryChequeNo] = useState('');

  const handleUpdateColConfig = (newCfg: LedgerColumnConfig) => {
    setColConfig(newCfg);
    saveStoredLedgerColumnConfig('expenses', newCfg);
  };

  const [newCatModal, setNewCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const filteredExpenses = expenses.filter(e => {
    if (selectedCategoryFilter === 'all') return true;
    return e.category === selectedCategoryFilter;
  });

  const totalExpense = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !desc.trim()) return;

    onAddExpense({
      date,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      desc: desc.trim(),
      amount: amt,
      category,
      method,
      paidBy: entryPaidBy.trim() || undefined,
      paidTo: entryPaidTo.trim() || undefined,
      bankName: entryBankName.trim() || undefined,
      accountNumber: entryAccountNumber.trim() || undefined,
      chequeNo: entryChequeNo.trim() || undefined
    });

    setDesc('');
    setAmount('');
    setEntryPaidBy('');
    setEntryPaidTo('');
    setEntryBankName('');
    setEntryAccountNumber('');
    setEntryChequeNo('');
  };

  const handleExportCSV = (customCols?: LedgerColumnConfig) => {
    const effectiveCols = customCols || colConfig;
    const { headers, rows } = buildLedgerExportTableData(
      filteredExpenses.map(e => ({
        ...e,
        debit: e.amount,
        credit: 0,
        runningBalance: e.amount,
        desc: `${e.desc} (${e.category})`
      })),
      effectiveCols
    );
    downloadCSV('Factory_Expenses_Log', headers, rows);
  };

  const handleExportPDF = (customCols?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    const effectiveCols = customCols || colConfig;
    const { headers, rows } = buildLedgerExportTableData(
      filteredExpenses.map(e => ({
        ...e,
        debit: e.amount,
        credit: 0,
        runningBalance: e.amount,
        desc: `${e.desc} (${e.category})`
      })),
      effectiveCols
    );
    openExportModal({
      title: 'Factory Overheads & Expenses Log',
      headers,
      rows,
      filename: 'Factory_Expenses_Log',
      companyName,
      subtitle: exportDocConfig?.subtitle || 'Operational & Overhead Expense Ledger',
      balanceFooterText: `Total Expenses: ${fmt(totalExpense)}`,
      defaultFormat: 'pdf',
      initialOrientation: 'landscape'
    });
  };

  const handleExportJPG = (customCols?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    const effectiveCols = customCols || colConfig;
    const { headers, rows } = buildLedgerExportTableData(
      filteredExpenses.map(e => ({
        ...e,
        debit: e.amount,
        credit: 0,
        runningBalance: e.amount,
        desc: `${e.desc} (${e.category})`
      })),
      effectiveCols
    );
    openExportModal({
      title: 'Factory Overheads & Expenses Log',
      headers,
      rows,
      filename: 'Factory_Expenses_Log',
      companyName,
      subtitle: exportDocConfig?.subtitle || 'Operational & Overhead Expense Ledger',
      balanceFooterText: `Total Expenses: ${fmt(totalExpense)}`,
      defaultFormat: 'jpg',
      initialOrientation: 'landscape'
    });
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3 font-sans">
        <div>
          <h2 className="font-serif font-black text-xl text-[var(--text)]">{t('expenses_title')}</h2>
          <p className="text-xs text-[var(--text-dim)]">{t('expenses_sub')}</p>
        </div>

        <div className="flex items-center gap-2 font-mono">
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
            className="px-3 py-1.5 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => handleExportPDF()}
            className="px-3 py-1.5 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer"
          >
            PDF
          </button>
          <button
            type="button"
            onClick={() => handleExportJPG()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 text-xs font-semibold text-amber-400 hover:bg-amber-500 hover:text-black transition cursor-pointer"
            title="Export High-Resolution JPG Image"
          >
            <ImageIcon size={13} />
            <span>JPG</span>
          </button>
        </div>
      </div>

      {/* KPI banner */}
      <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase text-[var(--text-dim)]">Total Overhead Expense</div>
          <div className="text-2xl font-bold text-[var(--red)] mt-1">{fmt(totalExpense)}</div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center text-[var(--yellow)]">
          <Receipt size={18} />
        </div>
      </div>

      {/* Quick Add Form */}
      <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif font-bold text-sm text-[var(--text)] flex items-center gap-2 font-sans">
            <Plus size={16} className="text-[var(--yellow)]" />
            <span>Record Daily Expense</span>
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
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
              >
                <option value="Cash">Cash</option>
                <option value="Bank">Bank Account</option>
                <option value="Online">Online / EasyPaisa</option>
                <option value="Cheque">Cheque</option>
              </select>
              <input
                type="text"
                value={entryPaidBy}
                onChange={e => setEntryPaidBy(e.target.value)}
                placeholder="Paid By (e.g. Cashier / Umar)"
                className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
              />
              <input
                type="text"
                value={entryPaidTo}
                onChange={e => setEntryPaidTo(e.target.value)}
                placeholder="Paid To / Vendor Name"
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
            <div className="sm:col-span-2">
              <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">Expense Description</label>
              <input
                type="text"
                required
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="e.g. Oxygen & Acetylene gas cylinder refill"
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--yellow)]"
              />
            </div>

            <div>
              <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">Amount (Rs)</label>
              <input
                type="number"
                min="1"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Rs"
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--yellow)]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] text-[var(--text-dim)] uppercase">Category</label>
                <button
                  type="button"
                  onClick={() => setNewCatModal(true)}
                  className="text-[10px] text-[var(--yellow)] hover:underline"
                >
                  + Add
                </button>
              </div>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-2 text-xs text-[var(--text)] truncate"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
            <div className="flex items-center gap-2">
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)]"
              >
                <option value="Cash">Cash</option>
                <option value="Bank">Bank Account</option>
                <option value="Online">EasyPaisa / JazzCash</option>
                <option value="Cheque">Cheque</option>
              </select>

              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)]"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow hover:bg-amber-400 transition cursor-pointer"
            >
              Save Expense
            </button>
          </div>
        </form>
      </div>

      {/* Category Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedCategoryFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
            selectedCategoryFilter === 'all'
              ? 'bg-[var(--yellow)] text-black'
              : 'bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text-dim)]'
          }`}
        >
          All Categories
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategoryFilter(cat)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              selectedCategoryFilter === cat
                ? 'bg-[var(--yellow)] text-black'
                : 'bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text-dim)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="border border-[var(--steel-line)] rounded-xl overflow-hidden bg-[var(--panel)]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)]">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Description</th>
              <th className="p-3">Category</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Payment Method & Channels</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--steel-line)]">
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-[var(--text-dim)]">
                  No expenses logged under this category.
                </td>
              </tr>
            ) : (
              filteredExpenses.map(e => (
                <tr key={e.id} className="hover:bg-[var(--panel-raised)]/50">
                  <td className="p-3 whitespace-nowrap">{e.date}</td>
                  <td className="p-3 font-semibold text-[var(--text)] font-sans">{e.desc}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[10px] text-[var(--yellow)]">
                      {e.category}
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold text-sm text-[var(--red)]">{fmt(e.amount)}</td>
                  <td className="p-3 text-[var(--text-dim)]">
                    <div className="font-semibold text-[var(--text)]">{e.method || 'Cash'}</div>
                    {(e.paidBy || e.paidTo) && (
                      <div className="text-[10px] text-[var(--text-dim)] flex items-center gap-1 mt-0.5 flex-wrap">
                        {e.paidBy && <span>By: <strong className="text-[var(--text)]">{e.paidBy}</strong></span>}
                        {e.paidTo && <span>→ To: <strong className="text-[var(--text)]">{e.paidTo}</strong></span>}
                      </div>
                    )}
                    {e.accountNumber && (
                      <div className="text-[10px] text-[var(--yellow)] font-mono mt-0.5">
                        A/C: {e.accountNumber} {e.bankName && `(${e.bankName})`}
                      </div>
                    )}
                    {(e.chequeNo || e.detail) && (
                      <div className="text-[9px] text-[var(--text-dim)] mt-0.5">
                        Ref: {e.chequeNo || e.detail}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingEntry(e)}
                        className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--yellow)] hover:bg-[var(--panel-raised)] transition cursor-pointer"
                        title="Edit Expense Details"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(e.id)}
                        className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition cursor-pointer"
                        title="Delete"
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

      {/* Edit Expense Entry Modal */}
      {editingEntry && (
        <EditLedgerEntryModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          title="Edit Factory Overhead Expense"
          ledgerName="Factory Expenses"
          entry={{
            ...editingEntry,
            debit: editingEntry.amount,
            credit: 0
          }}
          onSave={updated => {
            if (onUpdateExpense) {
              onUpdateExpense(editingEntry.id, {
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
          ledgerName="Factory Overhead Expenses Log"
          ledgerSubtitle="Operational & Overhead Expense Ledger"
          columnConfig={colConfig}
          onUpdateColumnConfig={handleUpdateColConfig}
          companyName={companyName}
          activeBalance={totalExpense}
          sampleRows={filteredExpenses.map(e => ({
            ...e,
            debit: e.amount,
            credit: 0,
            runningBalance: e.amount,
            desc: `${e.desc} (${e.category})`
          }))}
          onExportCSV={cfg => handleExportCSV(cfg)}
          onExportPDF={(cfg, docCfg) => handleExportPDF(cfg, docCfg)}
          onExportJPG={(cfg, docCfg) => handleExportJPG(cfg, docCfg)}
        />
      )}

      {/* Add Category Modal */}
      {newCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-sm bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-3 font-sans">Add Expense Category</h3>
            <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">Category Name</label>
            <input
              type="text"
              required
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="e.g. Generator Fuel"
              className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNewCatModal(false)}
                className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newCatName.trim()) {
                    onAddCategory(newCatName.trim());
                    setCategory(newCatName.trim());
                    setNewCatName('');
                    setNewCatModal(false);
                  }
                }}
                className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
