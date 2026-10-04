import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  Download,
  Check,
  Image as ImageIcon,
  ShieldCheck,
  Eye,
  Upload,
  FileText,
  UserCheck,
  Hash
} from 'lucide-react';
import { RawSupplier, RawEntry, AppLanguage, Transaction, GatePassData } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, downloadCSV, exportTablePDF } from '../utils/helpers';
import { exportTableJPG } from '../utils/exportManager';
import { openExportModal } from '../utils/exportSettingsHelper';
import { computeSupplierLedgerDetails } from '../utils/mathEngine';
import { getNextGateSequence, UnifiedGateReceipt } from '../utils/gateSequenceManager';
import { GatePassUploadModal } from './GatePassUploadModal';
import { GatePassViewerModal } from './GatePassViewerModal';
import { UnifiedGateReceiptsModal } from './UnifiedGateReceiptsModal';

interface RawMaterialViewProps {
  suppliers: RawSupplier[];
  transactions?: Transaction[];
  language: AppLanguage;
  companyName: string;
  rawItemNames: string[];
  onSaveSupplier: (supplier: RawSupplier, oldName?: string) => void;
  onDeleteSupplier: (name: string) => void;
  onAddRawEntry: (supplierName: string, entry: Omit<RawEntry, 'id'>) => void;
  onDeleteRawEntry: (supplierName: string, entryId: string) => void;
  onAttachGatePass?: (supplierName: string, entryId: string, gatePass: GatePassData) => void;
}

export const RawMaterialView: React.FC<RawMaterialViewProps> = ({
  suppliers,
  transactions = [],
  language,
  companyName,
  rawItemNames,
  onSaveSupplier,
  onDeleteSupplier,
  onAddRawEntry,
  onDeleteRawEntry,
  onAttachGatePass
}) => {
  const [selectedSupplierIdx, setSelectedSupplierIdx] = useState<number | null>(null);
  const [addSupplierModal, setAddSupplierModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');

  // Gate Pass & Unified Registry Modals
  const [isGateRegistryOpen, setIsGateRegistryOpen] = useState(false);
  const [uploadingRawEntry, setUploadingRawEntry] = useState<{ supplierName: string; entry: RawEntry } | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<UnifiedGateReceipt | null>(null);

  // Form State
  const [desc, setDesc] = useState('');
  const [stockName, setStockName] = useState(rawItemNames[0] || 'M.S. Steel Pipe');
  const [weightIn, setWeightIn] = useState('');
  const [itemsIn, setItemsIn] = useState('');
  const [rate, setRate] = useState('');
  const [debit, setDebit] = useState('');
  const [credit, setCredit] = useState('');
  const [isReturn, setIsReturn] = useState(false);
  const [method, setMethod] = useState('Cash');
  const [detail, setDetail] = useState('');
  const [receivedBy, setReceivedBy] = useState('Gate Officer: M. Tariq');
  const [date, setDate] = useState(todayISO());

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSupplierIdx === null) return;
    const s = suppliers[selectedSupplierIdx];
    if (!s) return;

    const dVal = parseFloat(debit) || 0;
    const cVal = parseFloat(credit) || 0;
    if (dVal <= 0 && cVal <= 0) return;

    const wVal = weightIn ? (parseFloat(weightIn) || 0) * (isReturn ? -1 : 1) : undefined;
    const iVal = itemsIn ? (parseInt(itemsIn, 10) || 0) * (isReturn ? -1 : 1) : undefined;

    onAddRawEntry(s.name, {
      date,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      desc: desc.trim() || 'Raw material transaction',
      stockName,
      weightIn: wVal,
      itemsIn: iVal,
      rate: rate ? parseFloat(rate) : undefined,
      isReturn,
      debit: dVal,
      credit: cVal,
      method: dVal > 0 ? method : undefined,
      detail: dVal > 0 ? detail.trim() : undefined,
      receivedBy: receivedBy.trim() || 'Gate Officer: M. Tariq',
      gatePost: 'Raw Material Inward Gate'
    });

    setDesc('');
    setWeightIn('');
    setItemsIn('');
    setRate('');
    setDebit('');
    setCredit('');
    setIsReturn(false);
  };

  const currentSupplier = selectedSupplierIdx !== null ? suppliers[selectedSupplierIdx] : null;
  const currentBalance = currentSupplier
    ? currentSupplier.entries.reduce((sum, e) => sum + (e.credit || 0) - (e.debit || 0), 0)
    : 0;

  const handleExportCSV = () => {
    if (!currentSupplier) return;
    const headers = ['Date', 'Description', 'Material', 'Weight In (kg)', 'Items In', 'Debit (Paid)', 'Credit (Received)'];
    const rows = currentSupplier.entries.map(e => [
      e.date,
      e.desc,
      e.stockName || '—',
      e.weightIn ?? '—',
      e.itemsIn ?? '—',
      e.debit,
      e.credit
    ]);
    downloadCSV(`${currentSupplier.name}_Raw_Ledger`, headers, rows);
  };

  const handleExportPDF = () => {
    if (!currentSupplier) return;
    const headers = ['Date', 'Description', 'Material', 'Weight', 'Paid', 'Received'];
    const rows = currentSupplier.entries.map(e => [
      e.date,
      e.desc,
      e.stockName || '—',
      e.weightIn ? `${e.weightIn} kg` : '—',
      fmt(e.debit),
      fmt(e.credit)
    ]);
    openExportModal({
      title: `${currentSupplier.name} — Raw Material Ledger`,
      headers,
      rows,
      filename: `${currentSupplier.name}_Raw_Ledger`,
      companyName,
      subtitle: 'Fan Accessories · Gujrat',
      balanceFooterText: `Net Balance: ${fmt(currentBalance)}`,
      defaultFormat: 'pdf',
      initialOrientation: 'landscape'
    });
  };

  const handleExportJPG = () => {
    if (!currentSupplier) return;
    const headers = ['Date', 'Description', 'Material', 'Weight', 'Paid (Debit)', 'Received (Credit)'];
    const rows = currentSupplier.entries.map(e => [
      e.date,
      e.desc,
      e.stockName || '—',
      e.weightIn ? `${e.weightIn} kg` : '—',
      fmt(e.debit),
      fmt(e.credit)
    ]);
    openExportModal({
      title: `${currentSupplier.name} — Raw Material Ledger`,
      headers,
      rows,
      filename: `${currentSupplier.name}_Raw_Ledger`,
      companyName,
      subtitle: 'Raw Material Supply & Inward Ledger',
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
          <h2 className="font-serif font-black text-xl text-[var(--text)]">{t('rawledger_title')}</h2>
          <p className="text-xs text-[var(--text-dim)]">{t('rawledger_sub')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="raw-view-gate-registry-btn"
            onClick={() => setIsGateRegistryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs uppercase shadow hover:bg-amber-500/25 transition cursor-pointer"
          >
            <ShieldCheck size={14} className="text-amber-400" />
            <span>Gate Registry (#SEQ)</span>
          </button>

          <button
            type="button"
            onClick={() => setAddSupplierModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow transition active:scale-95"
          >
            <Plus size={14} />
            <span>{t('add_supplier')}</span>
          </button>
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {suppliers.map((s, idx) => {
          const totalPaid = s.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
          const totalReceived = s.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
          const bal = totalReceived - totalPaid;

          return (
            <div
              key={s.name}
              className="bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] rounded-xl p-4 flex flex-col justify-between gap-3 shadow-sm transition group"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center text-[var(--yellow)]">
                  <Layers size={16} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm((t('confirm_delete_supplier') || 'Delete supplier {name}?').replace('{name}', s.name))) {
                      onDeleteSupplier(s.name);
                    }
                  }}
                  className="p-1.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:text-red-400 opacity-80 group-hover:opacity-100 transition"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-[var(--text)]">{s.name}</h4>
                <div className="text-[11px] text-[var(--text-dim)] font-mono mt-0.5">
                  {s.entries.length} delivery/payment entries
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
                  onClick={() => setSelectedSupplierIdx(idx)}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] hover:bg-[var(--yellow)] hover:text-black border border-[var(--steel-line)] text-xs font-semibold transition"
                >
                  Ledger
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Supplier Modal */}
      {addSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-sm bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-3">{t('add_supplier')}</h3>
            <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">Supplier / Mill Name</label>
            <input
              type="text"
              required
              value={newSupplierName}
              onChange={e => setNewSupplierName(e.target.value)}
              placeholder="e.g. Ittefaq Steel Mills"
              className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddSupplierModal(false)}
                className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newSupplierName.trim()) {
                    onSaveSupplier({ name: newSupplierName.trim(), entries: [] });
                    setNewSupplierName('');
                    setAddSupplierModal(false);
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

      {/* Supplier Ledger Detail Modal */}
      {currentSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 font-mono">
          <div className="w-full max-w-3xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-4 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-serif font-black text-lg sm:text-xl text-[var(--text)]">{currentSupplier.name}</h3>
                <span className="text-xs text-[var(--text-dim)]">Raw Material Supply Ledger</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)]"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)]"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportJPG}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500 hover:text-black text-xs font-semibold text-amber-400 transition"
                  title="Export High-Resolution JPG Image"
                >
                  <ImageIcon size={12} />
                  <span>JPG</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsGateRegistryOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-xs font-semibold text-amber-300 transition"
                  title="View Unified Gate Receipts Registry"
                >
                  <ShieldCheck size={12} className="text-amber-400" />
                  <span>Gate Registry</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSupplierIdx(null)}
                  className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Balance Breakdown Cards */}
            {(() => {
              const details = computeSupplierLedgerDetails(currentSupplier.entries);
              return (
                <div className="my-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Total Received (Credit)</div>
                    <div className="text-base font-bold text-[var(--red)] mt-0.5">{fmt(details.totalCredits)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Total Paid (Debit)</div>
                    <div className="text-base font-bold text-[var(--green)] mt-0.5">{fmt(details.totalDebits)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Net Balance</div>
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
                        {details.netBalance > 0 ? 'Owed to Supplier' : details.netBalance < 0 ? 'Advance Paid' : 'Settled'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Entries list */}
            <div className="flex-1 overflow-y-auto min-h-[160px] border border-[var(--steel-line)] rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)]">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Gate Seq / Receiver</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5">Material</th>
                    <th className="p-2.5 text-right">Debit (Paid)</th>
                    <th className="p-2.5 text-right">Credit (Received)</th>
                    <th className="p-2.5 text-right">Running Balance</th>
                    <th className="p-2.5 text-center">Gate Pass</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--steel-line)]">
                  {currentSupplier.entries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-[var(--text-dim)]">
                        No delivery entries logged yet.
                      </td>
                    </tr>
                  ) : (
                    computeSupplierLedgerDetails(currentSupplier.entries).entriesWithBalance.map(e => (
                      <tr key={e.id} className="hover:bg-[var(--panel-raised)]/50">
                        <td className="p-2.5 whitespace-nowrap">{e.date}</td>
                        <td className="p-2.5 whitespace-nowrap">
                          {e.gateSequence || e.gateSequenceNo ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/25 w-fit">
                                <Hash size={10} />
                                {e.gateSequenceNo || `#GATE-${String(e.gateSequence).padStart(3, '0')}`}
                              </span>
                              <span className="text-[10px] text-[var(--text-dim)] flex items-center gap-1 truncate max-w-[120px]" title={e.receivedBy || 'Gate Inward'}>
                                <UserCheck size={9} className="text-emerald-400 shrink-0" />
                                {e.receivedBy || 'Gate Inward'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[var(--text-dim)] flex items-center gap-1">
                              <UserCheck size={9} className="text-gray-500" />
                              {e.receivedBy || 'Gate Inward'}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5">{e.desc}</td>
                        <td className="p-2.5">
                          <span className="text-[var(--yellow)]">{e.stockName || '—'}</span>
                          {e.weightIn ? ` (${e.weightIn} kg)` : ''}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-[var(--green)]">
                          {e.debit ? fmt(e.debit) : '—'}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-[var(--red)]">
                          {e.credit ? fmt(e.credit) : '—'}
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
                            {e.runningBalance > 0 ? 'Payable' : e.runningBalance < 0 ? 'Adv' : ''}
                          </span>
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          {e.gatePass || e.receiptUrl ? (
                            <button
                              type="button"
                              onClick={() => {
                                setViewingReceipt({
                                  id: e.id,
                                  sourceType: 'raw_material_supplier',
                                  orderRef: `Raw Mat #${e.id}`,
                                  partyName: currentSupplier.name,
                                  date: e.date,
                                  time: e.time,
                                  gateSequence: e.gateSequence || 1,
                                  gateSequenceNo: e.gateSequenceNo || (e.gateSequence ? `#GATE-${String(e.gateSequence).padStart(3, '0')}` : '#GATE-RAW'),
                                  receivedBy: e.receivedBy || e.gatePass?.receivedBy || 'Gate Inward Officer',
                                  receiverRole: e.gatePass?.receiverRole || 'Gate Inward Officer',
                                  gatePost: e.gatePost || e.gatePass?.gatePost || 'Raw Material Inward Gate',
                                  vehicleNo: e.gatePass?.vehicleNo,
                                  driverName: e.gatePass?.driverName,
                                  notes: e.gatePass?.notes,
                                  summary: `${e.desc} (${e.stockName || 'Raw Material'})`,
                                  totalAmount: e.credit || e.debit || 0,
                                  weightIn: e.weightIn,
                                  rawSupplierName: currentSupplier.name,
                                  fileData: e.gatePass?.fileData || e.receiptUrl || '',
                                  fileName: e.gatePass?.fileName || `GatePass_${e.id}`,
                                  fileType: e.gatePass?.fileType || 'image',
                                  fileSize: e.gatePass?.fileSize,
                                  uploadedAt: e.gatePass?.uploadedAt || e.date,
                                  verified: true
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-semibold hover:bg-emerald-500/25 transition cursor-pointer"
                              title="View Gate Pass / Delivery Receipt"
                            >
                              <Eye size={11} />
                              <span>Pass</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setUploadingRawEntry({ supplierName: currentSupplier.name, entry: e })}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-semibold hover:bg-amber-500/20 transition cursor-pointer"
                              title="Attach Gate Pass (PDF/JPG)"
                            >
                              <Upload size={10} />
                              <span>Attach</span>
                            </button>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => onDeleteRawEntry(currentSupplier.name, e.id)}
                            className="text-red-400 hover:text-red-300 p-1"
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

            {/* Quick Add Entry Form */}
            <form onSubmit={handleAddEntry} className="mt-3 pt-3 border-t border-[var(--steel-line)] space-y-2 text-xs">
              <div className="font-bold text-xs uppercase text-[var(--yellow)]">+ Add Delivery / Payment Entry</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  required
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Description (e.g. 12 Gauge wire coil)"
                  className="sm:col-span-2 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none"
                />
                <select
                  value={stockName}
                  onChange={e => setStockName(e.target.value)}
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)]"
                >
                  {rawItemNames.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={weightIn}
                  onChange={e => setWeightIn(e.target.value)}
                  placeholder="Weight In (kg)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <input
                  type="number"
                  min="0"
                  value={rate}
                  onChange={e => setRate(e.target.value)}
                  placeholder="Rate per kg (Rs)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
                <input
                  type="number"
                  min="0"
                  value={debit}
                  onChange={e => setDebit(e.target.value)}
                  placeholder="Debit - Paid (Rs)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
                <input
                  type="number"
                  min="0"
                  value={credit}
                  onChange={e => setCredit(e.target.value)}
                  placeholder="Credit - Material (Rs)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value)}
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                  <option value="Online">Online</option>
                  <option value="Cheque">Cheque</option>
                </select>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={e => setReceivedBy(e.target.value)}
                  placeholder="Gate Receiver"
                  title="Name of gate officer receiving delivery"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-dim)]">
                  <input
                    type="checkbox"
                    checked={isReturn}
                    onChange={e => setIsReturn(e.target.checked)}
                    className="rounded"
                  />
                  <span>This is a return (deducts stock)</span>
                </label>

                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow hover:bg-amber-400 transition"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Unified Gate Receipts Registry Modal */}
      {isGateRegistryOpen && (
        <UnifiedGateReceiptsModal
          transactions={transactions}
          rawSuppliers={suppliers}
          language={language}
          companyName={companyName}
          onClose={() => setIsGateRegistryOpen(false)}
        />
      )}

      {/* Gate Pass Attachment Modal for Raw Delivery */}
      {uploadingRawEntry && (
        <GatePassUploadModal
          rawEntry={uploadingRawEntry}
          language={language}
          companyName={companyName}
          nextGateSequence={uploadingRawEntry.entry.gateSequence || getNextGateSequence(transactions, suppliers)}
          onClose={() => setUploadingRawEntry(null)}
          onConfirmUpload={(id, gp, rawSupplierName) => {
            if (rawSupplierName && onAttachGatePass) {
              onAttachGatePass(rawSupplierName, id, gp);
            }
            setUploadingRawEntry(null);
          }}
        />
      )}

      {/* Gate Pass Full Viewer Modal */}
      {viewingReceipt && (
        <GatePassViewerModal
          receipt={viewingReceipt}
          language={language}
          companyName={companyName}
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </div>
  );
};
