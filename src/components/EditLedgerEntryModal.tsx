import React, { useState, useEffect } from 'react';
import {
  Edit3,
  Calendar,
  DollarSign,
  CreditCard,
  User,
  Building,
  Hash,
  FileText,
  Percent,
  Check,
  X
} from 'lucide-react';
import { todayISO, fmt } from '../utils/helpers';
import { hapticTransactionComplete } from '../utils/haptics';

export interface EditableLedgerEntryData {
  id: string;
  date: string;
  time?: string;
  desc?: string;
  debit: number;
  credit: number;
  method?: string;
  detail?: string;
  paidBy?: string;
  paidTo?: string;
  accountNumber?: string;
  bankName?: string;
  chequeNo?: string;
  chequeDate?: string;
  chequeStatus?: string;
  taxPercent?: number;
  taxAmt?: number;
  // Specific ancillary fields
  size?: string;
  qty?: number;
  rate?: number;
  color?: string;
  itemCount?: string;
  stockName?: string;
  itemName?: string;
  weightIn?: number;
  itemsIn?: number;
  weight?: string | number;
  category?: string;
  workType?: string;
  withdrawnBy?: string;
  withdrawnIn?: string;
  amount?: number;
  kind?: string;
  status?: string;
  units?: number;
  note?: string;
}

interface EditLedgerEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  ledgerName: string;
  entry: EditableLedgerEntryData | null;
  onSave: (updatedEntry: EditableLedgerEntryData) => void;
}

const COMMON_BANKS = [
  'Meezan Bank',
  'Habib Bank (HBL)',
  'Allied Bank (ABL)',
  'Bank Alfalah',
  'MCB Bank',
  'United Bank (UBL)',
  'Faysal Bank',
  'JazzCash',
  'EasyPaisa',
  'Cash Counter'
];

const PAYMENT_METHODS = [
  'Cash',
  'Online Transfer',
  'Bank Transfer',
  'Cheque',
  'JazzCash / EasyPaisa',
  'Pay Order',
  'Account Adjustment'
];

export const EditLedgerEntryModal: React.FC<EditLedgerEntryModalProps> = ({
  isOpen,
  onClose,
  title,
  ledgerName,
  entry,
  onSave
}) => {
  const [date, setDate] = useState('');
  const [desc, setDesc] = useState('');
  const [debit, setDebit] = useState('');
  const [credit, setCredit] = useState('');
  const [method, setMethod] = useState('Cash');
  const [paidBy, setPaidBy] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [chequeStatus, setChequeStatus] = useState('');
  const [taxPercent, setTaxPercent] = useState('0');
  const [detail, setDetail] = useState('');

  // Ancillary optional fields
  const [size, setSize] = useState('');
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [color, setColor] = useState('');
  const [weight, setWeight] = useState('');
  const [itemsIn, setItemsIn] = useState('');
  const [stockName, setStockName] = useState('');
  const [workType, setWorkType] = useState('');
  const [category, setCategory] = useState('');
  const [withdrawnBy, setWithdrawnBy] = useState('');

  useEffect(() => {
    if (entry && isOpen) {
      setDate(entry.date || todayISO());
      setDesc(entry.desc || '');
      setDebit(entry.debit ? String(entry.debit) : entry.amount && !entry.credit ? String(entry.amount) : '');
      setCredit(entry.credit ? String(entry.credit) : '');
      setMethod(entry.method || (entry.withdrawnIn ? entry.withdrawnIn : 'Cash'));
      setPaidBy(entry.paidBy || entry.withdrawnBy || '');
      setPaidTo(entry.paidTo || '');
      setAccountNumber(entry.accountNumber || '');
      setBankName(entry.bankName || '');
      setChequeNo(entry.chequeNo || '');
      setChequeDate(entry.chequeDate || '');
      setChequeStatus(entry.chequeStatus || '');
      setTaxPercent(entry.taxPercent ? String(entry.taxPercent) : '0');
      setDetail(entry.detail || '');

      setSize(entry.size || '');
      setQty(entry.qty !== undefined ? String(entry.qty) : (entry.units !== undefined ? String(entry.units) : ''));
      setRate(entry.rate !== undefined ? String(entry.rate) : '');
      setColor(entry.color || '');
      setWeight(entry.weightIn !== undefined ? String(entry.weightIn) : (entry.weight !== undefined ? String(entry.weight) : ''));
      setItemsIn(entry.itemsIn !== undefined ? String(entry.itemsIn) : '');
      setStockName(entry.stockName || entry.itemName || '');
      setWorkType(entry.workType || '');
      setCategory(entry.category || '');
      setWithdrawnBy(entry.withdrawnBy || '');
    }
  }, [entry, isOpen]);

  if (!isOpen || !entry) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dVal = parseFloat(debit) || 0;
    const cVal = parseFloat(credit) || 0;
    const taxP = parseFloat(taxPercent) || 0;
    const computedTax = taxP > 0 ? Math.round((dVal * taxP) / 100) : 0;
    const numericWeight = weight ? parseFloat(weight) : undefined;
    const numericItems = itemsIn ? parseInt(itemsIn, 10) : undefined;

    const updated: EditableLedgerEntryData = {
      ...entry,
      date: date || todayISO(),
      desc: desc.trim() || 'Ledger entry',
      debit: dVal,
      credit: cVal,
      amount: dVal || cVal,
      method: method || 'Cash',
      paidBy: paidBy.trim() || undefined,
      paidTo: paidTo.trim() || undefined,
      accountNumber: accountNumber.trim() || undefined,
      bankName: bankName.trim() || undefined,
      chequeNo: chequeNo.trim() || undefined,
      chequeDate: chequeDate || undefined,
      chequeStatus: chequeStatus || undefined,
      taxPercent: taxP > 0 ? taxP : undefined,
      taxAmt: computedTax > 0 ? computedTax : undefined,
      detail: detail.trim() || undefined,
      size: size.trim() || undefined,
      qty: qty ? parseInt(qty, 10) : undefined,
      rate: rate ? parseFloat(rate) : undefined,
      color: color.trim() || undefined,
      weightIn: numericWeight,
      weight: numericWeight,
      itemsIn: numericItems,
      stockName: stockName.trim() || undefined,
      itemName: stockName.trim() || undefined,
      workType: workType.trim() || undefined,
      category: category.trim() || undefined,
      withdrawnBy: withdrawnBy.trim() || undefined
    };

    hapticTransactionComplete();
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-xs font-mono overflow-y-auto">
      <div className="relative w-full max-w-2xl max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden my-auto animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--steel-line)] bg-[var(--panel-raised)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--yellow)]/15 border border-[var(--yellow)]/30 text-[var(--yellow)]">
              <Edit3 size={18} />
            </div>
            <div>
              <h3 className="font-serif font-black text-lg text-[var(--text)] tracking-tight">
                {title || 'Edit Ledger Entry'}
              </h3>
              <p className="text-xs text-[var(--text-dim)]">
                Account: <strong className="text-[var(--text)]">{ledgerName}</strong> · Entry #{entry.id.slice(-6)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Row 1: Date & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar size={12} /> Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text)] focus:border-[var(--yellow)] outline-hidden font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1 flex items-center gap-1">
                <FileText size={12} /> Description / Particulars
              </label>
              <input
                type="text"
                required
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Order reference, payment receipt narrative..."
                className="w-full px-3 py-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text)] focus:border-[var(--yellow)] outline-hidden font-sans"
              />
            </div>
          </div>

          {/* Row 2: Financial Amounts (Debit & Credit) */}
          <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
            <div className="text-[11px] font-bold text-[var(--yellow)] uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign size={13} />
              <span>Financial Values</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">
                  Debit (Billed / Due Amount)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-[var(--text-dim)] font-mono">Rs</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={debit}
                    onChange={e => setDebit(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-mono font-bold text-sm focus:border-red-400 outline-hidden"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  Credit (Received / Paid Amount)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-[var(--text-dim)] font-mono">Rs</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={credit}
                    onChange={e => setCredit(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-mono font-bold text-sm focus:border-emerald-400 outline-hidden"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Percent size={11} /> WHT / Tax %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={taxPercent}
                  onChange={e => setTaxPercent(e.target.value)}
                  placeholder="0%"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-mono focus:border-[var(--yellow)] outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Comprehensive Payment & Account Details */}
          <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
            <div className="text-[11px] font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard size={13} className="text-[var(--yellow)]" />
              <span>Detailed Payment & Channel Information</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Payment Method */}
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Payment Method
                </label>
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] focus:border-[var(--yellow)] outline-hidden font-mono cursor-pointer"
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bank / Provider Name */}
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Building size={11} /> Bank / Financial Channel
                </label>
                <input
                  type="text"
                  list="bank-suggestions"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="e.g. Meezan Bank, HBL, JazzCash..."
                  className="w-full px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] focus:border-[var(--yellow)] outline-hidden font-sans"
                />
                <datalist id="bank-suggestions">
                  {COMMON_BANKS.map(b => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>

              {/* Paid By (Whome) */}
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <User size={11} /> Paid By (Sender / Account Holder)
                </label>
                <input
                  type="text"
                  value={paidBy}
                  onChange={e => setPaidBy(e.target.value)}
                  placeholder="Whome sent / paid the money"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] focus:border-[var(--yellow)] outline-hidden font-sans"
                />
              </div>

              {/* Paid To (To Whome) */}
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <User size={11} /> Paid To (Receiver / Counter Payee)
                </label>
                <input
                  type="text"
                  value={paidTo}
                  onChange={e => setPaidTo(e.target.value)}
                  placeholder="To whome was money handed/transferred"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] focus:border-[var(--yellow)] outline-hidden font-sans"
                />
              </div>

              {/* Account Number / IBAN */}
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Hash size={11} /> Account Number / IBAN
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder="Which account number / IBAN"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-mono focus:border-[var(--yellow)] outline-hidden"
                />
              </div>

              {/* Cheque / Transaction Ref # */}
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Hash size={11} /> Cheque # / Ref / Slip ID
                </label>
                <input
                  type="text"
                  value={chequeNo}
                  onChange={e => setChequeNo(e.target.value)}
                  placeholder="CHQ-123456 or Trx reference"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-mono focus:border-[var(--yellow)] outline-hidden"
                />
              </div>

              {/* Cheque Date & Status if Cheque */}
              {(method.toLowerCase().includes('cheque') || chequeNo) && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1">
                      Cheque Date
                    </label>
                    <input
                      type="date"
                      value={chequeDate}
                      onChange={e => setChequeDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-mono focus:border-[var(--yellow)] outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1">
                      Cheque Status
                    </label>
                    <select
                      value={chequeStatus}
                      onChange={e => setChequeStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-mono focus:border-[var(--yellow)] outline-hidden cursor-pointer"
                    >
                      <option value="">Status Unspecified</option>
                      <option value="pending">Pending Clearance</option>
                      <option value="cleared">Cleared in Bank</option>
                      <option value="bounced">Bounced / Returned</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Additional narrative / remarks */}
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1">
                Additional Notes / Banking Narration
              </label>
              <input
                type="text"
                value={detail}
                onChange={e => setDetail(e.target.value)}
                placeholder="Bank branch location, deposit slip remarks..."
                className="w-full px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] focus:border-[var(--yellow)] outline-hidden font-sans"
              />
            </div>
          </div>

          {/* Optional Ancillary fields if Job-Work / Custom / Paint entry */}
          {(entry.size !== undefined || entry.qty !== undefined || entry.color !== undefined || entry.weight !== undefined || entry.weightIn !== undefined || entry.itemsIn !== undefined || entry.stockName !== undefined || entry.workType !== undefined || entry.category !== undefined) && (
            <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
              <div className="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider">
                Industrial / Inventory Specifications
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {entry.size !== undefined && (
                  <div>
                    <label className="block text-[10px] text-[var(--text-dim)] mb-1">Size / Dimension</label>
                    <input
                      type="text"
                      value={size}
                      onChange={e => setSize(e.target.value)}
                      placeholder="18 inch, 24 inch..."
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-mono"
                    />
                  </div>
                )}
                {(entry.qty !== undefined || entry.units !== undefined) && (
                  <div>
                    <label className="block text-[10px] text-[var(--text-dim)] mb-1">Quantity / Units</label>
                    <input
                      type="number"
                      value={qty}
                      onChange={e => setQty(e.target.value)}
                      placeholder="100"
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-mono"
                    />
                  </div>
                )}
                {entry.rate !== undefined && (
                  <div>
                    <label className="block text-[10px] text-[var(--text-dim)] mb-1">Rate (Rs / Unit)</label>
                    <input
                      type="number"
                      value={rate}
                      onChange={e => setRate(e.target.value)}
                      placeholder="250"
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-mono"
                    />
                  </div>
                )}
                {entry.color !== undefined && (
                  <div>
                    <label className="block text-[10px] text-[var(--text-dim)] mb-1">Color / Finish</label>
                    <input
                      type="text"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      placeholder="Matt Black, White..."
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-sans"
                    />
                  </div>
                )}
                {(entry.weightIn !== undefined || entry.weight !== undefined) && (
                  <div>
                    <label className="block text-[10px] text-[var(--text-dim)] mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      step="any"
                      value={weight}
                      onChange={e => setWeight(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-mono"
                    />
                  </div>
                )}
                {entry.itemsIn !== undefined && (
                  <div>
                    <label className="block text-[10px] text-[var(--text-dim)] mb-1">Items / Bundles</label>
                    <input
                      type="number"
                      value={itemsIn}
                      onChange={e => setItemsIn(e.target.value)}
                      placeholder="e.g. 100"
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-mono"
                    />
                  </div>
                )}
                {(entry.stockName !== undefined || entry.itemName !== undefined) && (
                  <div>
                    <label className="block text-[10px] text-[var(--text-dim)] mb-1">Material / Item</label>
                    <input
                      type="text"
                      value={stockName}
                      onChange={e => setStockName(e.target.value)}
                      placeholder="Material name"
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-sans"
                    />
                  </div>
                )}
                {entry.workType !== undefined && (
                  <div>
                    <label className="block text-[10px] text-[var(--text-dim)] mb-1">Work Type</label>
                    <input
                      type="text"
                      value={workType}
                      onChange={e => setWorkType(e.target.value)}
                      placeholder="Welding, Assembly"
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-sans"
                    />
                  </div>
                )}
                {entry.category !== undefined && (
                  <div>
                    <label className="block text-[10px] text-[var(--text-dim)] mb-1">Expense Category</label>
                    <input
                      type="text"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      placeholder="Category"
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] font-sans"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--steel-line)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer font-bold text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[var(--yellow)] text-black font-black uppercase text-xs tracking-wider hover:brightness-110 transition flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Check size={14} strokeWidth={3} />
              <span>Save & Update Entry</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
