import React, { useState, useMemo } from 'react';
import { RecycleBinItem, RecycleBinItemType, AppLanguage } from '../types';
import { fmt } from '../utils/helpers';
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  Search, 
  X, 
  ShieldAlert, 
  FileText, 
  Users, 
  Factory as FactoryIcon, 
  Package, 
  DollarSign, 
  HardHat, 
  BookOpen, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';

interface RecycleBinModalProps {
  isOpen?: boolean;
  recycleBin?: RecycleBinItem[];
  items?: RecycleBinItem[];
  language: AppLanguage;
  onClose: () => void;
  onRestoreItem: (item: RecycleBinItem) => void;
  onRestoreAll: () => void;
  onPurgeItem: (itemId: string) => void;
  onEmptyBin: () => void;
}

const TYPE_CONFIG: Record<RecycleBinItemType, { labelEn: string; labelUr: string; icon: any; color: string; bg: string }> = {
  transaction: { labelEn: 'Sales Invoice', labelUr: 'سیلز انوائس', icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  customer: { labelEn: 'Customer Account', labelUr: 'کسٹمر کھاتہ', icon: Users, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30' },
  payment: { labelEn: 'Payment Entry', labelUr: 'ادائیگی اندراج', icon: DollarSign, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/30' },
  product: { labelEn: 'Catalog Product', labelUr: 'پراڈکٹ کیٹلاگ', icon: Package, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  factory: { labelEn: 'Factory Account', labelUr: 'فیکٹری کھاتہ', icon: FactoryIcon, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30' },
  factory_ledger_entry: { labelEn: 'Factory Entry', labelUr: 'فیکٹری اندراج', icon: FactoryIcon, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30' },
  custom_ledger: { labelEn: 'Custom Ledger', labelUr: 'کسٹم لیجر', icon: BookOpen, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
  custom_ledger_entry: { labelEn: 'Custom Entry', labelUr: 'کسٹم اندراج', icon: BookOpen, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
  painter: { labelEn: 'Paint Workshop', labelUr: 'پینٹ کھاتہ', icon: Sparkles, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/30' },
  paint_entry: { labelEn: 'Paint Entry', labelUr: 'پینٹ اندراج', icon: Sparkles, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/30' },
  supplier: { labelEn: 'Raw Supplier', labelUr: 'خام مال سپلائر', icon: Package, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
  raw_entry: { labelEn: 'Raw Material Entry', labelUr: 'خام مال اندراج', icon: Package, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
  worker: { labelEn: 'Labour Worker', labelUr: 'مزدور کھاتہ', icon: HardHat, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  labour_entry: { labelEn: 'Labour Entry', labelUr: 'مزدور اندراج', icon: HardHat, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  scrap_buyer: { labelEn: 'Scrap Buyer', labelUr: 'سکریپ خریدار', icon: Trash2, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
  scrap_entry: { labelEn: 'Scrap Entry', labelUr: 'سکریپ اندراج', icon: Trash2, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
  expense: { labelEn: 'Workshop Expense', labelUr: 'ورکشاپ خرچ', icon: DollarSign, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  withdrawal: { labelEn: 'Cash Withdrawal', labelUr: 'رقم نکلوائی', icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  inquiry: { labelEn: 'Customer Inquiry', labelUr: 'کسٹمر استفسار', icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  raw_stock: { labelEn: 'Inventory Item', labelUr: 'سٹاک آئٹم', icon: Package, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' }
};

export const RecycleBinModal: React.FC<RecycleBinModalProps> = ({
  isOpen = true,
  recycleBin,
  items,
  language,
  onClose,
  onRestoreItem,
  onRestoreAll,
  onPurgeItem,
  onEmptyBin
}) => {
  if (isOpen === false) return null;
  const activeItems = recycleBin || items || [];
  const isUrdu = language === 'ur';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'transaction' | 'customer' | 'worker' | 'raw' | 'expense' | 'other'>('all');
  const [confirmEmptyOpen, setConfirmEmptyOpen] = useState(false);
  const [restoredNotification, setRestoredNotification] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    return activeItems.filter(item => {
      // Type category filter
      if (selectedFilter === 'transaction' && item.itemType !== 'transaction' && item.itemType !== 'payment') return false;
      if (selectedFilter === 'customer' && item.itemType !== 'customer' && item.itemType !== 'factory' && item.itemType !== 'factory_ledger_entry') return false;
      if (selectedFilter === 'worker' && item.itemType !== 'worker' && item.itemType !== 'labour_entry') return false;
      if (selectedFilter === 'raw' && item.itemType !== 'supplier' && item.itemType !== 'raw_entry' && item.itemType !== 'raw_stock') return false;
      if (selectedFilter === 'expense' && item.itemType !== 'expense' && item.itemType !== 'withdrawal') return false;
      if (selectedFilter === 'other' && ['transaction', 'payment', 'customer', 'factory', 'factory_ledger_entry', 'worker', 'labour_entry', 'supplier', 'raw_entry', 'raw_stock', 'expense', 'withdrawal'].includes(item.itemType)) return false;

      // Text search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesSub = item.subtitle ? item.subtitle.toLowerCase().includes(query) : false;
        const matchesParent = item.parentEntityName ? item.parentEntityName.toLowerCase().includes(query) : false;
        const matchesId = item.originalId.toLowerCase().includes(query);
        return matchesTitle || matchesSub || matchesParent || matchesId;
      }

      return true;
    });
  }, [activeItems, selectedFilter, searchTerm]);

  const handleRestore = (item: RecycleBinItem) => {
    onRestoreItem(item);
    setRestoredNotification(`✓ ${isUrdu ? 'کامیابی سے بحال کر دیا گیا:' : 'Successfully restored:'} ${item.title}`);
    setTimeout(() => setRestoredNotification(null), 4000);
  };

  const handleRestoreAllItems = () => {
    if (activeItems.length === 0) return;
    onRestoreAll();
    setRestoredNotification(isUrdu ? 'تمام حذف شدہ آئٹمز بحال کر دیے گئے!' : 'All deleted items have been restored!');
    setTimeout(() => setRestoredNotification(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div 
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        dir={isUrdu ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between bg-gradient-to-r from-[var(--surface-hover)] to-[var(--surface)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Trash2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-main)]">
                  {isUrdu ? 'بحالی کوڑا دان (Recycle Bin)' : 'Recycle Bin & Accidental Delete Recovery'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {activeItems.length} {isUrdu ? 'آئٹمز' : 'items'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)]">
                {isUrdu 
                  ? 'غلطی سے ڈیلیٹ ہونے والے تمام ریکارڈز یہاں محفوظ ہیں۔ کسی بھی وقت ایک کلک سے بحال کریں۔' 
                  : 'Items deleted by accident are safely kept here. Restore any entry back to your active records anytime.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] transition-colors"
            title={isUrdu ? 'بند کریں' : 'Close'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Action & Notification Banner */}
        {restoredNotification && (
          <div className="px-4 py-2.5 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-medium flex items-center gap-2 animate-fade-in">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{restoredNotification}</span>
          </div>
        )}

        {/* Toolbar & Filter Tabs */}
        <div className="p-3 sm:p-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] sm:min-w-[280px]">
            <Search size={15} className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={isUrdu ? 'انوائس #، نام، یا کھاتہ تلاش کریں...' : 'Search deleted entries, invoice #, party name...'}
              className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl py-2 pl-9 pr-4 rtl:pl-4 rtl:pr-9 text-xs sm:text-sm text-[var(--text-main)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--brand)] transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-main)]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {activeItems.length > 0 && (
              <>
                <button
                  onClick={handleRestoreAllItems}
                  className="px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 transition-all shadow-sm"
                  title={isUrdu ? 'تمام آئٹمز بحال کریں' : 'Restore all items back to workspace'}
                >
                  <RotateCcw size={14} />
                  <span>{isUrdu ? 'تمام بحال کریں' : 'Restore All'}</span>
                </button>

                <button
                  onClick={() => setConfirmEmptyOpen(true)}
                  className="px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 flex items-center gap-1.5 transition-all"
                  title={isUrdu ? 'کوڑا دان خالی کریں' : 'Permanently purge all items'}
                >
                  <Trash2 size={14} />
                  <span>{isUrdu ? 'کوڑا دان خالی کریں' : 'Empty Bin'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2 border-b border-[var(--border)] flex items-center gap-2 overflow-x-auto text-xs bg-[var(--surface-hover)]/40 no-scrollbar">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedFilter === 'all'
                ? 'bg-[var(--brand)] text-black font-bold'
                : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface)]'
            }`}
          >
            {isUrdu ? 'سب ریکارڈز' : 'All Deleted'} ({activeItems.length})
          </button>
          <button
            onClick={() => setSelectedFilter('transaction')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedFilter === 'transaction'
                ? 'bg-emerald-500 text-black font-bold'
                : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface)]'
            }`}
          >
            {isUrdu ? 'انوائسز' : 'Invoices & Sales'}
          </button>
          <button
            onClick={() => setSelectedFilter('customer')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedFilter === 'customer'
                ? 'bg-sky-500 text-black font-bold'
                : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface)]'
            }`}
          >
            {isUrdu ? 'کسٹمرز و فیکٹریز' : 'Customers & Factories'}
          </button>
          <button
            onClick={() => setSelectedFilter('worker')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedFilter === 'worker'
                ? 'bg-yellow-500 text-black font-bold'
                : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface)]'
            }`}
          >
            {isUrdu ? 'مزدور و اجرت' : 'Labour & Wages'}
          </button>
          <button
            onClick={() => setSelectedFilter('raw')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedFilter === 'raw'
                ? 'bg-orange-500 text-black font-bold'
                : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface)]'
            }`}
          >
            {isUrdu ? 'خام مال' : 'Raw Materials'}
          </button>
          <button
            onClick={() => setSelectedFilter('expense')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedFilter === 'expense'
                ? 'bg-red-500 text-black font-bold'
                : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface)]'
            }`}
          >
            {isUrdu ? 'اخراجات' : 'Expenses'}
          </button>
          <button
            onClick={() => setSelectedFilter('other')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedFilter === 'other'
                ? 'bg-purple-500 text-black font-bold'
                : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface)]'
            }`}
          >
            {isUrdu ? 'دیگر' : 'Other'}
          </button>
        </div>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="p-12 text-center flex flex-col items-center justify-center flex-1">
            <div className="w-16 h-16 rounded-2xl bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--text-dim)] mb-4">
              <Trash2 size={28} className="opacity-40" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-[var(--text-main)] mb-1">
              {activeItems.length === 0 
                ? (isUrdu ? 'کوڑا دان خالی ہے' : 'Recycle Bin is Empty') 
                : (isUrdu ? 'کوئی ریکارڈ نہیں ملا' : 'No matching deleted items found')}
            </h3>
            <p className="text-xs text-[var(--text-dim)] max-w-sm">
              {activeItems.length === 0
                ? (isUrdu 
                    ? 'جب بھی آپ کوئی انوائس، کھاتہ، خرچ یا مزدور ڈیلیٹ کریں گے تو وہ حادثاتی ڈیلیٹ سے بچنے کے لیے یہاں محفوظ ہو جائے گا۔' 
                    : 'Whenever you delete an invoice, ledger entry, worker, or expense, it will be safely placed here so you never lose data.')
                : (isUrdu ? 'تلاش کا لفظ تبدیل کریں یا فلٹر کلیئر کریں۔' : 'Try searching for something else or switch the category filter.')}
            </p>
          </div>
        )}

        {/* Items List */}
        {filteredItems.length > 0 && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
            {filteredItems.map(item => {
              const cfg = TYPE_CONFIG[item.itemType] || TYPE_CONFIG.transaction;
              const Icon = cfg.icon;
              const formattedDate = new Date(item.deletedAt).toLocaleDateString(isUrdu ? 'ur-PK' : 'en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={item.id}
                  className="bg-[var(--surface-hover)] hover:bg-[var(--border)]/40 border border-[var(--border)] rounded-xl p-3 sm:p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${cfg.bg} ${cfg.color}`}>
                          {isUrdu ? cfg.labelUr : cfg.labelEn}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-[var(--text-main)]">
                          {item.title}
                        </h4>
                        {item.amount !== undefined && item.amount !== null && (
                          <span className="text-xs font-extrabold text-[var(--brand)]">
                            PKR {fmt(item.amount)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-[var(--text-dim)]">
                        {item.subtitle && <span>{item.subtitle}</span>}
                        {item.parentEntityName && (
                          <span>{isUrdu ? 'کھاتہ:' : 'Ledger:'} <strong className="text-[var(--text-main)]">{item.parentEntityName}</strong></span>
                        )}
                        <span>{isUrdu ? 'حذف وقت:' : 'Deleted:'} {formattedDate}</span>
                        {item.deletedBy && <span>{isUrdu ? 'بذریعہ:' : 'By:'} {item.deletedBy}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => handleRestore(item)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                      title={isUrdu ? 'ریکارڈ واپس بحال کریں' : 'Restore this item back to active records'}
                    >
                      <RotateCcw size={13} />
                      <span>{isUrdu ? 'بحال کریں' : 'Restore'}</span>
                    </button>

                    <button
                      onClick={() => onPurgeItem(item.id)}
                      className="p-1.5 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 border border-transparent hover:border-rose-500/30 transition-all"
                      title={isUrdu ? 'مستقل ڈیلیٹ کریں' : 'Permanently delete this entry'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Info */}
        <div className="p-3 sm:p-4 border-t border-[var(--border)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-dim)]">
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-[var(--brand)]" />
            <span>
              {isUrdu 
                ? 'کلاؤڈ سنک فعال ہے: تمام بحال شدہ آئٹمز فوراً آپ کے جی میل اکاؤنٹ میں بھی سنک ہو جائیں گے۔' 
                : 'Cloud Vault Protection: All restores and entries sync live to your Gmail Google account.'}
            </span>
          </div>
          <span className="text-[11px]">
            {filteredItems.length} of {activeItems.length} {isUrdu ? 'دکھائے جا رہے ہیں' : 'displayed'}
          </span>
        </div>
      </div>

      {/* Confirmation Dialog for Emptying Bin */}
      {confirmEmptyOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[var(--surface)] border border-rose-500/40 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-base font-bold text-[var(--text-main)]">
                {isUrdu ? 'کوڑا دان مکمل خالی کریں؟' : 'Permanently Empty Recycle Bin?'}
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-[var(--text-dim)] leading-relaxed">
              {isUrdu 
                ? `کیا آپ واقعی تمام ${activeItems.length} آئٹمز کو مستقل طور پر مٹانا چاہتے ہیں؟ اس کے بعد یہ ریکارڈز دوبارہ بحال نہیں ہو سکیں گے۔` 
                : `Are you sure you want to permanently purge all ${activeItems.length} deleted records? Once permanently deleted, they cannot be restored.`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmEmptyOpen(false)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-colors"
              >
                {isUrdu ? 'منسوخ کریں' : 'Cancel'}
              </button>

              <button
                onClick={() => {
                  onEmptyBin();
                  setConfirmEmptyOpen(false);
                }}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2"
              >
                <Trash2 size={15} />
                <span>{isUrdu ? 'ہاں، مستقل مٹائیں' : 'Yes, Purge Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
