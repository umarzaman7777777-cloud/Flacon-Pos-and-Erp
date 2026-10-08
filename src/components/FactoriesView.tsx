import React, { useState } from 'react';
import {
  Factory as FactoryIcon,
  Phone,
  MapPin,
  FileText,
  Edit2,
  Trash2,
  Plus,
  Download,
  Printer,
  Sparkles,
  Image as ImageIcon,
  Sliders
} from 'lucide-react';
import {
  Factory,
  CustomerLedgerAccount,
  CustomerLedgerEntry,
  CustomLedger,
  AppLanguage,
  LedgerColumnConfig,
  ExportDocumentConfig
} from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, downloadCSV, exportTablePDF, amountInWordsEnglish, amountInWordsUrdu } from '../utils/helpers';
import { exportTableJPG } from '../utils/exportManager';
import { openExportModal } from '../utils/exportSettingsHelper';
import { computeCustomerLedgerDetails } from '../utils/mathEngine';
import {
  buildLedgerExportTableData,
  getStoredLedgerColumnConfig,
  saveStoredLedgerColumnConfig
} from '../utils/ledgerExportHelper';
import { EditLedgerEntryModal } from './EditLedgerEntryModal';
import { LedgerStudioModal, DEFAULT_LEDGER_COLUMNS } from './LedgerStudioModal';

interface FactoriesViewProps {
  factories: Factory[];
  customerLedgers: CustomerLedgerAccount[];
  customLedgersList: CustomLedger[];
  language: AppLanguage;
  companyName: string;
  selectedLedgerFactory: string | null;
  onSelectLedgerFactory: (name: string | null) => void;
  onSaveFactory: (factory: Factory, oldName?: string) => void;
  onDeleteFactory: (name: string) => void;
  onAddLedgerEntry: (factoryName: string, entry: Omit<CustomerLedgerEntry, 'id'>) => void;
  onDeleteLedgerEntry: (factoryName: string, entryId: string) => void;
  onUpdateLedgerEntry?: (factoryName: string, entryId: string, updatedData: Partial<CustomerLedgerEntry>) => void;
  onAddCustomLedger: (name: string) => void;
  onOpenCustomLedgerDetail: (cl: CustomLedger) => void;
}

export const FactoriesView: React.FC<FactoriesViewProps> = ({
  factories = [],
  customerLedgers = [],
  customLedgersList = [],
  language,
  companyName,
  selectedLedgerFactory,
  onSelectLedgerFactory,
  onSaveFactory,
  onDeleteFactory,
  onAddLedgerEntry,
  onDeleteLedgerEntry,
  onUpdateLedgerEntry,
  onAddCustomLedger,
  onOpenCustomLedgerDetail
}) => {
  // Factory Modal State
  const [factoryModalOpen, setFactoryModalOpen] = useState(false);
  const [editingFactory, setEditingFactory] = useState<Factory | null>(null);
  const [fname, setFname] = useState('');
  const [flocation, setFlocation] = useState('');
  const [fcontact, setFcontact] = useState('');

  // Add Entry Form inside Ledger Modal
  const [entryDesc, setEntryDesc] = useState('');
  const [entryDebit, setEntryDebit] = useState('');
  const [entryCredit, setEntryCredit] = useState('');
  const [entryMethod, setEntryMethod] = useState('Cash');
  const [entryPaidBy, setEntryPaidBy] = useState('');
  const [entryPaidTo, setEntryPaidTo] = useState('');
  const [entryAccountNumber, setEntryAccountNumber] = useState('');
  const [entryBankName, setEntryBankName] = useState('');
  const [entryChequeNo, setEntryChequeNo] = useState('');
  const [entryDetail, setEntryDetail] = useState('');
  const [entryTax, setEntryTax] = useState('0');
  const [entryDate, setEntryDate] = useState(todayISO());
  const [showExtendedPaymentFields, setShowExtendedPaymentFields] = useState(false);

  // Column Customizer & Studio State
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CustomerLedgerEntry | null>(null);
  const [colConfig, setColConfig] = useState<LedgerColumnConfig>(() => getStoredLedgerColumnConfig('customer', DEFAULT_LEDGER_COLUMNS));

  const handleUpdateColConfig = (newCfg: LedgerColumnConfig) => {
    setColConfig(newCfg);
    saveStoredLedgerColumnConfig('customer', newCfg);
  };

  // Add Custom Ledger Dialog
  const [customLedgerModalOpen, setCustomLedgerModalOpen] = useState(false);
  const [newCustomLedgerName, setNewCustomLedgerName] = useState('');

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const getFactoryBalance = (name: string) => {
    const acc = customerLedgers.find(cl => cl.name === name);
    if (!acc) return 0;
    return acc.entries.reduce((sum, e) => sum + (e.debit || 0) - (e.credit || 0), 0);
  };

  const handleOpenAddFactory = () => {
    setEditingFactory(null);
    setFname('');
    setFlocation('');
    setFcontact('');
    setFactoryModalOpen(true);
  };

  const handleOpenEditFactory = (f: Factory, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFactory(f);
    setFname(f.name);
    setFlocation(f.location);
    setFcontact(f.contact);
    setFactoryModalOpen(true);
  };

  const handleSaveFactorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fname.trim()) return;
    onSaveFactory(
      {
        name: fname.trim(),
        location: flocation.trim() || 'Gujrat',
        contact: fcontact.trim() || '—'
      },
      editingFactory ? editingFactory.name : undefined
    );
    setFactoryModalOpen(false);
  };

  const handleAddEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLedgerFactory) return;
    const debit = parseFloat(entryDebit) || 0;
    const credit = parseFloat(entryCredit) || 0;
    if (debit <= 0 && credit <= 0) return;

    const taxPercent = parseFloat(entryTax) || 0;
    const taxAmt = debit > 0 && taxPercent > 0 ? Math.round((debit * taxPercent) / 100) : 0;

    onAddLedgerEntry(selectedLedgerFactory, {
      date: entryDate,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      desc: entryDesc.trim() || 'Adjustment entry',
      debit,
      credit,
      method: credit > 0 || entryMethod !== 'Cash' ? entryMethod : undefined,
      paidBy: entryPaidBy.trim() || undefined,
      paidTo: entryPaidTo.trim() || undefined,
      accountNumber: entryAccountNumber.trim() || undefined,
      bankName: entryBankName.trim() || undefined,
      chequeNo: entryChequeNo.trim() || undefined,
      detail: entryDetail.trim() || undefined,
      taxPercent: taxPercent > 0 ? taxPercent : undefined,
      taxAmt: taxAmt > 0 ? taxAmt : undefined
    });

    setEntryDesc('');
    setEntryDebit('');
    setEntryCredit('');
    setEntryDetail('');
    setEntryPaidBy('');
    setEntryPaidTo('');
    setEntryAccountNumber('');
    setEntryBankName('');
    setEntryChequeNo('');
  };

  const activeAccount = customerLedgers.find(cl => cl.name === selectedLedgerFactory);
  const activeBalance = activeAccount
    ? activeAccount.entries.reduce((s, e) => s + (e.debit || 0) - (e.credit || 0), 0)
    : 0;

  const handleExportLedgerCSV = (customCols?: LedgerColumnConfig) => {
    if (!activeAccount) return;
    const effectiveCols = customCols || colConfig;
    const details = computeCustomerLedgerDetails(activeAccount.entries);
    const { headers, rows } = buildLedgerExportTableData(details.entriesWithBalance, effectiveCols);
    const footer = `\r\nTotal Balance Due: ${fmt(activeBalance)}\r\nEnglish: ${amountInWordsEnglish(
      activeBalance
    )}\r\nUrdu: ${amountInWordsUrdu(activeBalance)}`;
    downloadCSV(`${activeAccount.name}_Ledger`, headers, rows, footer);
  };

  const handleExportLedgerPDF = (customCols?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    if (!activeAccount) return;
    const effectiveCols = customCols || colConfig;
    const details = computeCustomerLedgerDetails(activeAccount.entries);
    const { headers, rows } = buildLedgerExportTableData(details.entriesWithBalance, effectiveCols);
    openExportModal({
      title: `${activeAccount.name} — Customer Ledger`,
      headers,
      rows,
      filename: `${activeAccount.name}_Ledger`,
      companyName,
      subtitle: 'Fan Accessories · Gujrat',
      balanceFooterText: `Net Balance: ${fmt(activeBalance)} (${amountInWordsEnglish(activeBalance)})`,
      defaultFormat: 'pdf',
      initialOrientation: exportDocConfig?.orientation || 'landscape',
      initialPaperSize: exportDocConfig?.paperSize || 'a4'
    });
  };

  const handleExportLedgerJPG = (customCols?: LedgerColumnConfig, exportDocConfig?: Partial<ExportDocumentConfig>) => {
    if (!activeAccount) return;
    const effectiveCols = customCols || colConfig;
    const details = computeCustomerLedgerDetails(activeAccount.entries);
    const { headers, rows } = buildLedgerExportTableData(details.entriesWithBalance, effectiveCols);
    openExportModal({
      title: `${activeAccount.name} — Customer Ledger`,
      headers,
      rows,
      filename: `${activeAccount.name}_Ledger`,
      companyName,
      subtitle: 'Authorized Factory Customer Ledger Account',
      balanceFooterText: `Net Balance: ${fmt(activeBalance)} (${activeBalance > 0 ? 'Receivable' : activeBalance < 0 ? 'Advance' : 'Settled'})`,
      defaultFormat: 'jpg',
      initialOrientation: exportDocConfig?.orientation || 'landscape',
      initialPaperSize: exportDocConfig?.paperSize || 'a4'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3">
        <div>
          <h2 className="font-serif font-black text-xl text-[var(--text)]">{t('factories_title')}</h2>
          <p className="text-xs text-[var(--text-dim)]">{t('factories_sub')}</p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddFactory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow transition active:scale-95"
        >
          <Plus size={14} />
          <span>{t('add_factory')}</span>
        </button>
      </div>

      {/* Factories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {factories.map(f => {
          const bal = getFactoryBalance(f.name);
          const isOwed = bal > 0;
          const isAdvance = bal < 0;

          return (
            <div
              key={f.name}
              className="bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] rounded-xl p-4 flex flex-col justify-between gap-3 shadow-sm transition group"
            >
              {/* Card Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center text-[var(--yellow)]">
                  <FactoryIcon size={16} />
                </div>
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={e => handleOpenEditFactory(f, e)}
                    className="p-1.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:text-[var(--yellow)] transition"
                    title="Edit"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm((t('confirm_delete_factory') || 'Delete factory {name}?').replace('{name}', f.name))) {
                        onDeleteFactory(f.name);
                      }
                    }}
                    className="p-1.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:text-red-400 transition"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Information */}
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-[var(--text)]">{f.name}</h4>
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
                  <MapPin size={12} className="shrink-0 text-[var(--yellow)]" />
                  <span className="truncate">{f.location}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
                  <Phone size={12} className="shrink-0 text-[var(--yellow)]" />
                  <span className="truncate">{f.contact}</span>
                </div>
              </div>

              {/* Balance & View Ledger trigger */}
              <div className="pt-2 border-t border-[var(--steel-line)] flex items-center justify-between font-mono">
                <div className="text-xs">
                  <span
                    className={`font-bold ${
                      isOwed ? 'text-[var(--red)]' : isAdvance ? 'text-[var(--green)]' : 'text-[var(--text-dim)]'
                    }`}
                  >
                    {fmt(Math.abs(bal))}
                  </span>{' '}
                  <span className="text-[10px] text-[var(--text-dim)]">
                    ({isOwed ? t('owed') : isAdvance ? t('advance') : t('settled')})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectLedgerFactory(f.name)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--panel-raised)] hover:bg-[var(--yellow)] hover:text-black border border-[var(--steel-line)] text-xs font-semibold transition"
                >
                  <FileText size={11} />
                  <span>Ledger</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Section: Custom Ledgers (Factory per Labour Ledger) */}
      <div className="pt-6 border-t border-[var(--steel-line)]">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <h3 className="font-serif font-bold text-base text-[var(--text)]">
              {t('custom_ledgers_title')}
            </h3>
            <p className="text-xs text-[var(--text-dim)]">{t('custom_ledgers_sub')}</p>
          </div>
          <button
            type="button"
            onClick={() => setCustomLedgerModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] text-xs font-mono font-semibold text-[var(--text-dim)] hover:text-[var(--yellow)] transition"
          >
            <Plus size={13} />
            <span>Add Specific Ledger</span>
          </button>
        </div>

        {(customLedgersList || []).length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-[var(--steel-line)] text-center text-xs font-mono text-[var(--text-dim)]">
            No specific job-work or ancillary customer ledgers created yet. Click "+ Add Specific Ledger" to track custom factory production and self-weight materials.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {(customLedgersList || []).map(cl => {
              const debit = (cl.entries || []).reduce((s, e) => s + (e.debit || 0), 0);
              const credit = (cl.entries || []).reduce((s, e) => s + (e.credit || 0), 0);
              const bal = debit - credit;

              return (
                <div
                  key={cl.id}
                  onClick={() => onOpenCustomLedgerDetail(cl)}
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] rounded-xl p-3.5 cursor-pointer transition shadow-sm font-mono text-xs flex justify-between items-center group"
                >
                  <div>
                    <div className="font-semibold text-sm text-[var(--text)] font-sans group-hover:text-[var(--yellow)] transition-colors">{cl.name}</div>
                    <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
                      Self-weight: {cl.selfWeightStock ?? 0} kg
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-[var(--yellow)]">{fmt(bal)}</div>
                    <div className="text-[10px] text-[var(--text-dim)]">{bal >= 0 ? 'Receivable' : 'Advance'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Factory Modal */}
      {factoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-6 shadow-2xl">
            <h3 className="font-serif font-bold text-lg text-[var(--text)] mb-4">
              {editingFactory ? 'Edit Factory' : t('add_factory')}
            </h3>
            <form onSubmit={handleSaveFactorySubmit} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[var(--text-dim)] uppercase mb-1">Factory Name</label>
                <input
                  type="text"
                  required
                  value={fname}
                  onChange={e => setFname(e.target.value)}
                  placeholder="e.g. Al-Madina Fan Workshop"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[var(--text-dim)] uppercase mb-1">Location</label>
                <input
                  type="text"
                  required
                  value={flocation}
                  onChange={e => setFlocation(e.target.value)}
                  placeholder="e.g. Shaheen Chowk, Gujrat"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[var(--text-dim)] uppercase mb-1">Contact Number</label>
                <input
                  type="text"
                  value={fcontact}
                  onChange={e => setFcontact(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                />
              </div>
              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setFactoryModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Ledger Detail Modal */}
      {selectedLedgerFactory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 font-mono">
          <div className="w-full max-w-3xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-3 sm:p-6 shadow-2xl max-h-[94vh] flex flex-col">
            {/* Modal Header with Title and Export Actions */}
            <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-serif font-black text-lg sm:text-xl text-[var(--text)]">
                  {selectedLedgerFactory}
                </h3>
                <span className="text-xs text-[var(--text-dim)]">Customer Ledger Detail</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleExportLedgerCSV()}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer"
                  title="Export Filtered CSV"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExportLedgerPDF()}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-red-500 hover:text-red-400 text-xs font-semibold text-[var(--text-dim)] transition cursor-pointer"
                  title="Configure & Export Customized PDF"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleExportLedgerJPG()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500 hover:text-black text-xs font-semibold text-amber-400 transition cursor-pointer"
                  title="Configure & Export High-Resolution JPG Image"
                >
                  <ImageIcon size={12} />
                  <span>JPG</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsStudioOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--yellow)]/15 border border-[var(--yellow)]/40 hover:bg-[var(--yellow)] hover:text-black text-xs font-bold text-[var(--yellow)] transition cursor-pointer"
                  title="Open Ledger Studio (Column Checklist, Theme, Layout & Exports)"
                >
                  <Sliders size={12} />
                  <span>Style Studio</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectLedgerFactory(null)}
                  className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Hero Balance & Breakdown Cards */}
            {(() => {
              const details = computeCustomerLedgerDetails(activeAccount?.entries || []);
              return (
                <div className="my-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)] tracking-wider">
                      Total Invoiced (Debit)
                    </div>
                    <div className="text-base font-bold text-[var(--red)] mt-0.5">
                      {fmt(details.totalDebits)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)] tracking-wider">
                      Total Received (Credit)
                    </div>
                    <div className="text-base font-bold text-[var(--green)] mt-0.5">
                      {fmt(details.totalCredits)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)] tracking-wider">
                      Closing Balance
                    </div>
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
                        {details.netBalance > 0 ? '(Dr)' : details.netBalance < 0 ? '(Cr Advance)' : '(NIL)'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Mobile swipe hint */}
            <div className="sm:hidden flex items-center justify-between text-[10px] text-[var(--text-dim)] py-1 px-1">
              <span>← Swipe sideways to view full ledger →</span>
            </div>

            {/* Entries Table */}
            <div className="flex-1 overflow-auto max-w-full min-h-[160px] border border-[var(--steel-line)] rounded-lg ledger-scroll-container">
              <table className="w-full text-left text-xs border-collapse min-w-[720px]">
                <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)] sticky top-0 z-10">
                  <tr>
                    {colConfig.showDate && <th className="p-2.5">Date</th>}
                    {colConfig.showTime && <th className="p-2.5">Time</th>}
                    {colConfig.showDesc && <th className="p-2.5">Description</th>}
                    {colConfig.showDebit && <th className="p-2.5 text-right">Debit (Due)</th>}
                    {colConfig.showCredit && <th className="p-2.5 text-right">Credit (Paid)</th>}
                    {colConfig.showBalance && <th className="p-2.5 text-right">Running Balance</th>}
                    {colConfig.showMethod && <th className="p-2.5">Method & Payment Details</th>}
                    {colConfig.showTax && <th className="p-2.5 text-right">Tax</th>}
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--steel-line)]">
                  {!activeAccount || activeAccount.entries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-[var(--text-dim)]">
                        No ledger entries recorded yet.
                      </td>
                    </tr>
                  ) : (
                    computeCustomerLedgerDetails(activeAccount.entries).entriesWithBalance.map(e => (
                      <tr key={e.id} className="hover:bg-[var(--panel-raised)]/50 transition">
                        {colConfig.showDate && <td className="p-2.5 whitespace-nowrap">{e.date}</td>}
                        {colConfig.showTime && <td className="p-2.5 whitespace-nowrap text-[10px] text-[var(--text-dim)] font-mono">{e.time || '--:--'}</td>}
                        {colConfig.showDesc && (
                          <td className="p-2.5">
                            <div className="font-sans text-[var(--text)] font-semibold">{e.desc}</div>
                            {e.taxAmt && (
                              <div className="text-[10px] text-[var(--yellow)]">
                                Tax ({e.taxPercent}%): {fmt(e.taxAmt)}
                              </div>
                            )}
                          </td>
                        )}
                        {colConfig.showDebit && (
                          <td className="p-2.5 text-right font-semibold text-[var(--red)]">
                            {e.debit ? fmt(e.debit) : '—'}
                          </td>
                        )}
                        {colConfig.showCredit && (
                          <td className="p-2.5 text-right font-semibold text-[var(--green)]">
                            {e.credit ? fmt(e.credit) : '—'}
                          </td>
                        )}
                        {colConfig.showBalance && (
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
                        )}
                        {colConfig.showMethod && (
                          <td className="p-2.5 text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-[var(--text)]">{e.method || (e.credit > 0 ? 'Cash' : '—')}</span>
                              {e.bankName && (
                                <span className="text-[10px] text-[var(--yellow)] font-mono">({e.bankName})</span>
                              )}
                            </div>
                            {(e.paidBy || e.paidTo) && (
                              <div className="text-[10px] text-[var(--text-dim)] flex items-center gap-1 mt-0.5 flex-wrap">
                                {e.paidBy && <span>By: <strong className="text-[var(--text)]">{e.paidBy}</strong></span>}
                                {e.paidTo && <span>→ To: <strong className="text-[var(--text)]">{e.paidTo}</strong></span>}
                              </div>
                            )}
                            {e.accountNumber && (
                              <div className="text-[10px] text-[var(--yellow)] font-mono mt-0.5">
                                A/C: {e.accountNumber}
                              </div>
                            )}
                            {(e.chequeNo || e.detail) && (
                              <div className="text-[9px] text-[var(--text-dim)] mt-0.5">
                                Ref: {e.chequeNo || e.detail} {e.chequeStatus && `(${e.chequeStatus})`}
                              </div>
                            )}
                          </td>
                        )}
                        {colConfig.showTax && (
                          <td className="p-2.5 text-right text-[var(--text-dim)]">
                            {e.taxAmt ? fmt(e.taxAmt) : '—'}
                          </td>
                        )}
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingEntry(e)}
                              className="text-[var(--text-dim)] hover:text-[var(--yellow)] hover:bg-[var(--panel-raised)] p-1.5 rounded transition cursor-pointer"
                              title="Edit Entry Details"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteLedgerEntry(selectedLedgerFactory, e.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1.5 rounded transition cursor-pointer"
                              title="Delete Entry"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Quick Add Entry Form */}
            <form onSubmit={handleAddEntrySubmit} className="mt-3 pt-3 border-t border-[var(--steel-line)] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-bold text-xs uppercase text-[var(--yellow)] flex items-center gap-1.5">
                  <Plus size={13} />
                  <span>Add Ledger Entry</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExtendedPaymentFields(!showExtendedPaymentFields)}
                  className="text-[10px] text-[var(--yellow)] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                >
                  {showExtendedPaymentFields ? 'Hide Payment Channels' : '+ Detailed Payment (By / To / A/C)'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  required
                  value={entryDesc}
                  onChange={e => setEntryDesc(e.target.value)}
                  placeholder="Description (e.g. Order #0005 / Cash Deposit)"
                  className="sm:col-span-2 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  value={entryDebit}
                  onChange={e => setEntryDebit(e.target.value)}
                  placeholder="Debit (Rs)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  value={entryCredit}
                  onChange={e => setEntryCredit(e.target.value)}
                  placeholder="Credit (Rs)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none"
                />
              </div>

              {/* Extended Payment Channels when toggled */}
              {showExtendedPaymentFields && (
                <div className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] grid grid-cols-1 sm:grid-cols-3 gap-2 animate-in fade-in duration-150">
                  <input
                    type="text"
                    value={entryPaidBy}
                    onChange={e => setEntryPaidBy(e.target.value)}
                    placeholder="Paid By (Sender / Account Holder)"
                    className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                  />
                  <input
                    type="text"
                    value={entryPaidTo}
                    onChange={e => setEntryPaidTo(e.target.value)}
                    placeholder="Paid To (Receiver / Cashier)"
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
                  <input
                    type="text"
                    value={entryChequeNo}
                    onChange={e => setEntryChequeNo(e.target.value)}
                    placeholder="Cheque # / Trx Reference"
                    className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                  />
                  <input
                    type="text"
                    value={entryDetail}
                    onChange={e => setEntryDetail(e.target.value)}
                    placeholder="Banking Narration / Branch"
                    className="bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <div className="flex items-center gap-2">
                  <select
                    value={entryMethod}
                    onChange={e => setEntryMethod(e.target.value)}
                    className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)] cursor-pointer"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Online">Online Transfer</option>
                    <option value="Bank">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="JazzCash / EasyPaisa">JazzCash / EasyPaisa</option>
                  </select>

                  <select
                    value={entryTax}
                    onChange={e => setEntryTax(e.target.value)}
                    className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)] cursor-pointer"
                  >
                    <option value="0">0% Tax</option>
                    <option value="18">18% GST</option>
                  </select>
                </div>

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

      {/* Edit Ledger Entry Modal */}
      {editingEntry && (
        <EditLedgerEntryModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          title={`Edit Ledger Entry · ${selectedLedgerFactory || ''}`}
          ledgerName={selectedLedgerFactory || ''}
          entry={editingEntry}
          onSave={updated => {
            if (selectedLedgerFactory && onUpdateLedgerEntry) {
              onUpdateLedgerEntry(selectedLedgerFactory, editingEntry.id, updated as any);
            }
          }}
        />
      )}

      {/* Ledger Column & Export Studio Modal */}
      {isStudioOpen && activeAccount && (
        <LedgerStudioModal
          isOpen={isStudioOpen}
          onClose={() => setIsStudioOpen(false)}
          ledgerName={selectedLedgerFactory || ''}
          ledgerSubtitle="Authorized Customer Factory Ledger Account"
          columnConfig={colConfig}
          onUpdateColumnConfig={handleUpdateColConfig}
          companyName={companyName}
          activeBalance={activeBalance}
          sampleRows={activeAccount.entries}
          onExportCSV={cfg => handleExportLedgerCSV(cfg)}
          onExportPDF={(cfg, docCfg) => handleExportLedgerPDF(cfg, docCfg)}
          onExportJPG={(cfg, docCfg) => handleExportLedgerJPG(cfg, docCfg)}
        />
      )}

      {/* Add Custom Ledger Dialog */}
      {customLedgerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-sm bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-3">Add Specific Ledger</h3>
            <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">Party Name</label>
            <input
              type="text"
              required
              value={newCustomLedgerName}
              onChange={e => setNewCustomLedgerName(e.target.value)}
              placeholder="e.g. Al-Hamd Fan (Basharat Sb)"
              className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCustomLedgerModalOpen(false)}
                className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newCustomLedgerName.trim()) {
                    onAddCustomLedger(newCustomLedgerName.trim());
                    setNewCustomLedgerName('');
                    setCustomLedgerModalOpen(false);
                  }
                }}
                className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase"
              >
                Add Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
