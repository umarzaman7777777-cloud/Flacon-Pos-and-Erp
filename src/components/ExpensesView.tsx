import React, { useState } from 'react';
import { Receipt, Plus, Trash2, Download, Tag, Image as ImageIcon } from 'lucide-react';
import { Expense, AppLanguage } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, downloadCSV, exportTablePDF } from '../utils/helpers';
import { exportTableJPG } from '../utils/exportManager';

interface ExpensesViewProps {
  expenses: Expense[];
  categories: string[];
  language: AppLanguage;
  companyName: string;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onDeleteExpense: (id: string) => void;
  onAddCategory: (category: string) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  categories,
  language,
  companyName,
  onAddExpense,
  onDeleteExpense,
  onAddCategory
}) => {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0] || 'Factory Electricity');
  const [method, setMethod] = useState('Cash');
  const [date, setDate] = useState(todayISO());

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
      method
    });

    setDesc('');
    setAmount('');
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Amount (Rs)', 'Method'];
    const rows = filteredExpenses.map(e => [e.date, e.desc, e.category, e.amount, e.method || 'Cash']);
    downloadCSV('Factory_Expenses_Log', headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['Date', 'Description', 'Category', 'Amount', 'Method'];
    const rows = filteredExpenses.map(e => [e.date, e.desc, e.category, fmt(e.amount), e.method || 'Cash']);
    exportTablePDF('Factory Overheads & Expenses Log', headers, rows, 'Factory_Expenses_Log', 'portrait', companyName);
  };

  const handleExportJPG = async () => {
    const headers = ['Date', 'Description', 'Category', 'Amount (PKR)', 'Method'];
    const rows = filteredExpenses.map(e => [e.date, e.desc, e.category, fmt(e.amount), e.method || 'Cash']);
    const total = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    await exportTableJPG(
      'Factory Overheads & Expenses Log',
      headers,
      rows,
      'Factory_Expenses_Log',
      companyName,
      'Operational & Overhead Expense Ledger',
      `Total Expenses: ${fmt(total)}`
    );
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
        <h3 className="font-serif font-bold text-sm text-[var(--text)] mb-3 flex items-center gap-2 font-sans">
          <Plus size={16} className="text-[var(--yellow)]" />
          <span>Record Daily Expense</span>
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
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
              </select>

              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)]"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow hover:bg-amber-400 transition"
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
              <th className="p-3">Method</th>
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
                  <td className="p-3 text-[var(--text-dim)]">{e.method || 'Cash'}</td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => onDeleteExpense(e.id)}
                      className="p-1 rounded text-red-400 hover:text-red-300 transition"
                      title="Delete"
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
