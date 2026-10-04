import React, { useState } from 'react';
import { Users, Plus, Trash2, Edit2, Calendar, CheckSquare, Download } from 'lucide-react';
import { Worker, LabourEntry, AppLanguage, LabourPieceRate } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, todayISO, downloadCSV, exportTablePDF, exportTableJPG } from '../utils/helpers';
import { openExportModal } from '../utils/exportSettingsHelper';
import { computeWorkerLedgerDetails } from '../utils/mathEngine';

interface LabourLedgerViewProps {
  workers: Worker[];
  language: AppLanguage;
  companyName: string;
  onSaveWorker: (worker: Worker) => void;
  onDeleteWorker: (name: string) => void;
  onAddLabourEntry: (workerName: string, entry: Omit<LabourEntry, 'id'>) => void;
  onDeleteLabourEntry: (workerName: string, entryId: string) => void;
  onBulkAttendance: (attendanceMap: Record<string, 'present' | 'half' | 'absent' | 'leave'>, date: string) => void;
}

export const LabourLedgerView: React.FC<LabourLedgerViewProps> = ({
  workers,
  language,
  companyName,
  onSaveWorker,
  onDeleteWorker,
  onAddLabourEntry,
  onDeleteLabourEntry,
  onBulkAttendance
}) => {
  const [selectedWorkerIdx, setSelectedWorkerIdx] = useState<number | null>(null);
  const [addWorkerModal, setAddWorkerModal] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState(todayISO());
  const [bulkStatuses, setBulkStatuses] = useState<Record<string, 'present' | 'half' | 'absent' | 'leave'>>({});

  // Add worker form
  const [wName, setWName] = useState('');
  const [wType, setWType] = useState('Welding & Assembly');
  const [wRateType, setWRateType] = useState<'daily' | 'piece' | 'hourly'>('daily');
  const [wRate, setWRate] = useState('1500');

  // Single Entry Form
  const [entryKind, setEntryKind] = useState<'attendance' | 'payment' | 'advance' | 'loan' | 'damage'>('attendance');
  const [entryStatus, setEntryStatus] = useState<'present' | 'half' | 'absent' | 'leave'>('present');
  const [entryUnits, setEntryUnits] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [entryDate, setEntryDate] = useState(todayISO());

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const currentWorker = selectedWorkerIdx !== null ? workers[selectedWorkerIdx] : null;

  const getWorkerDues = (w: Worker) => {
    return computeWorkerLedgerDetails(w).netPayable;
  };

  const handleOpenBulk = () => {
    const initial: Record<string, 'present' | 'half' | 'absent' | 'leave'> = {};
    workers.forEach(w => {
      if (w.rateType === 'daily') initial[w.name] = 'present';
    });
    setBulkStatuses(initial);
    setBulkDate(todayISO());
    setBulkModalOpen(true);
  };

  const handleSaveBulk = () => {
    onBulkAttendance(bulkStatuses, bulkDate);
    setBulkModalOpen(false);
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorker) return;

    let debit = 0;
    let credit = 0;

    if (entryKind === 'attendance') {
      if (currentWorker.rateType === 'daily') {
        credit = entryStatus === 'present' ? currentWorker.rate : entryStatus === 'half' ? currentWorker.rate / 2 : 0;
      } else if (currentWorker.rateType === 'piece') {
        const u = parseFloat(entryUnits) || 0;
        const r = currentWorker.pieceRates?.[0]?.rate || 10;
        credit = u * r;
      } else {
        const u = parseFloat(entryUnits) || 0;
        credit = u * currentWorker.rate;
      }
    } else {
      debit = parseFloat(entryAmount) || 0;
    }

    onAddLabourEntry(currentWorker.name, {
      date: entryDate,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      kind: entryKind,
      status: entryKind === 'attendance' ? entryStatus : undefined,
      units: entryUnits ? parseFloat(entryUnits) : undefined,
      note: entryNote.trim() || undefined,
      debit,
      credit,
      workType: currentWorker.workType
    });

    setEntryUnits('');
    setEntryAmount('');
    setEntryNote('');
  };

  const handleExportCSV = () => {
    if (!currentWorker) return;
    const headers = ['Date', 'Kind', 'Status', 'Units', 'Note', 'Paid (Debit)', 'Earned (Credit)'];
    const rows = currentWorker.entries.map(e => [
      e.date,
      e.kind,
      e.status || '—',
      e.units || '—',
      e.note || '—',
      e.debit,
      e.credit
    ]);
    downloadCSV(`${currentWorker.name}_Labour_Ledger`, headers, rows);
  };

  const handleExportPDF = () => {
    if (!currentWorker) return;
    const headers = ['Date', 'Type', 'Status', 'Units', 'Paid', 'Earned'];
    const rows = currentWorker.entries.map(e => [
      e.date,
      e.kind,
      e.status || '—',
      e.units ? String(e.units) : '—',
      fmt(e.debit),
      fmt(e.credit)
    ]);
    openExportModal({
      title: `${currentWorker.name} — Labour Ledger`,
      headers,
      rows,
      filename: `${currentWorker.name}_Labour_Ledger`,
      companyName,
      subtitle: 'Fan Accessories · Gujrat',
      balanceFooterText: `Net Dues: ${fmt(getWorkerDues(currentWorker))}`,
      defaultFormat: 'pdf',
      initialOrientation: 'landscape'
    });
  };

  const handleExportJPG = () => {
    if (!currentWorker) return;
    const headers = ['Date', 'Type', 'Status', 'Units', 'Paid', 'Earned'];
    const rows = currentWorker.entries.map(e => [
      e.date,
      e.kind,
      e.status || '—',
      e.units ? String(e.units) : '—',
      fmt(e.debit),
      fmt(e.credit)
    ]);
    openExportModal({
      title: `${currentWorker.name} — Labour Ledger`,
      headers,
      rows,
      filename: `${currentWorker.name}_Labour_Ledger`,
      companyName,
      subtitle: 'Fan Accessories · Gujrat',
      balanceFooterText: `Net Dues: ${fmt(getWorkerDues(currentWorker))}`,
      defaultFormat: 'jpg',
      initialOrientation: 'landscape'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3">
        <div>
          <h2 className="font-serif font-black text-xl text-[var(--text)]">{t('labourledger_title')}</h2>
          <p className="text-xs text-[var(--text-dim)]">{t('labourledger_sub')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenBulk}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] text-xs font-mono font-bold text-[var(--yellow)] hover:border-[var(--yellow)] transition"
          >
            <CheckSquare size={14} />
            <span>{t('mark_attendance')}</span>
          </button>
          <button
            type="button"
            onClick={() => setAddWorkerModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow transition active:scale-95"
          >
            <Plus size={14} />
            <span>{t('add_worker')}</span>
          </button>
        </div>
      </div>

      {/* Workers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {workers.map((w, idx) => {
          const dues = getWorkerDues(w);
          const isOwed = dues > 0;

          return (
            <div
              key={w.name}
              className="bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] rounded-xl p-4 flex flex-col justify-between gap-3 shadow-sm transition group"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center text-[var(--yellow)]">
                  <Users size={16} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm((t('confirm_delete_worker') || 'Delete worker {name}?').replace('{name}', w.name))) {
                      onDeleteWorker(w.name);
                    }
                  }}
                  className="p-1.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:text-red-400 opacity-80 group-hover:opacity-100 transition"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-[var(--text)]">{w.name}</h4>
                <div className="text-xs text-[var(--text-dim)] font-mono mt-0.5">
                  {w.workType} · <span className="capitalize">{w.rateType}</span> ({w.rate ? fmt(w.rate) : 'piece-rate'})
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--steel-line)] flex items-center justify-between font-mono">
                <div className="text-xs">
                  <span className={`font-bold ${isOwed ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>
                    {fmt(Math.abs(dues))}
                  </span>{' '}
                  <span className="text-[10px] text-[var(--text-dim)]">({isOwed ? 'Dues' : 'Advance'})</span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedWorkerIdx(idx)}
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] hover:bg-[var(--yellow)] hover:text-black border border-[var(--steel-line)] text-xs font-semibold transition"
                >
                  Ledger
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Worker Modal */}
      {addWorkerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-sm bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-3">{t('add_worker')}</h3>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!wName.trim()) return;
                onSaveWorker({
                  name: wName.trim(),
                  workType: wType.trim(),
                  rateType: wRateType,
                  rate: parseFloat(wRate) || 0,
                  pieceRates:
                    wRateType === 'piece'
                      ? [{ size: '18 inch', rate: 10, rodSize: 'R/18"', guardSize: 'R/18"' }]
                      : undefined,
                  entries: []
                });
                setWName('');
                setAddWorkerModal(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">{t('labour_name')}</label>
                <input
                  type="text"
                  required
                  value={wName}
                  onChange={e => setWName(e.target.value)}
                  placeholder="e.g. Muhammad Rafiq"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">{t('work_type')}</label>
                <input
                  type="text"
                  value={wType}
                  onChange={e => setWType(e.target.value)}
                  placeholder="e.g. Welding, Assembly"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">{t('rate_type')}</label>
                  <select
                    value={wRateType}
                    onChange={e => setWRateType(e.target.value as any)}
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-2 py-2 text-xs text-[var(--text)]"
                  >
                    <option value="daily">{t('rate_type_daily')}</option>
                    <option value="piece">{t('rate_type_piece')}</option>
                    <option value="hourly">{t('rate_type_hourly')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">{t('rate_rs')}</label>
                  <input
                    type="number"
                    min="0"
                    value={wRate}
                    onChange={e => setWRate(e.target.value)}
                    placeholder="1500"
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddWorkerModal(false)}
                  className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow"
                >
                  {t('add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Attendance Modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-md bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-2">{t('mark_attendance')}</h3>
            <div className="mb-3">
              <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">{t('entry_date')}</label>
              <input
                type="date"
                value={bulkDate}
                onChange={e => setBulkDate(e.target.value)}
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-1.5 text-xs text-[var(--text)]"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 my-3 divide-y divide-[var(--steel-line)]">
              {workers
                .filter(w => w.rateType === 'daily')
                .map(w => (
                  <div key={w.name} className="flex items-center justify-between pt-2">
                    <span className="font-semibold text-xs text-[var(--text)]">{w.name}</span>
                    <div className="flex gap-1">
                      {(['present', 'half', 'absent', 'leave'] as const).map(st => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setBulkStatuses(prev => ({ ...prev, [w.name]: st }))}
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition ${
                            bulkStatuses[w.name] === st
                              ? st === 'present'
                                ? 'bg-emerald-500 text-white'
                                : st === 'half'
                                ? 'bg-amber-500 text-black'
                                : 'bg-red-500 text-white'
                              : 'bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text-dim)]'
                          }`}
                        >
                          {st[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex gap-2 pt-3">
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveBulk}
                className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Worker Ledger Modal */}
      {currentWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 font-mono">
          <div className="w-full max-w-3xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-4 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-serif font-black text-lg sm:text-xl text-[var(--text)]">{currentWorker.name}</h3>
                <span className="text-xs text-[var(--text-dim)]">
                  {currentWorker.workType} · {currentWorker.rateType} ({fmt(currentWorker.rate)})
                </span>
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
                  className="px-2.5 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-black transition"
                >
                  JPG
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedWorkerIdx(null)}
                  className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Breakdown & Dues Cards */}
            {(() => {
              const details = computeWorkerLedgerDetails(currentWorker);
              return (
                <div className="my-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Total Wages Earned (Credit)</div>
                    <div className="text-base font-bold text-[var(--red)] mt-0.5">{fmt(details.totalCredits)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Total Paid (Debit)</div>
                    <div className="text-base font-bold text-[var(--green)] mt-0.5">{fmt(details.totalDebits)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Net Payable Dues</div>
                    <div
                      className={`text-base font-bold mt-0.5 ${
                        details.netPayable > 0
                          ? 'text-[var(--red)]'
                          : details.netPayable < 0
                          ? 'text-[var(--green)]'
                          : 'text-gray-400'
                      }`}
                    >
                      {fmt(Math.abs(details.netPayable))}
                      <span className="text-[10px] font-normal ml-1">
                        {details.netPayable > 0 ? 'Dues to Worker' : details.netPayable < 0 ? 'Advance Given' : 'Settled'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Entries List */}
            <div className="flex-1 overflow-y-auto min-h-[160px] border border-[var(--steel-line)] rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)]">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Kind</th>
                    <th className="p-2.5">Status/Note</th>
                    <th className="p-2.5 text-right">Payment (Debit)</th>
                    <th className="p-2.5 text-right">Wages (Credit)</th>
                    <th className="p-2.5 text-right">Running Balance</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--steel-line)]">
                  {currentWorker.entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-[var(--text-dim)]">
                        No work or payment entries yet.
                      </td>
                    </tr>
                  ) : (
                    computeWorkerLedgerDetails(currentWorker).entriesWithBalance.map(e => (
                      <tr key={e.id} className="hover:bg-[var(--panel-raised)]/50">
                        <td className="p-2.5 whitespace-nowrap">{e.date}</td>
                        <td className="p-2.5 uppercase text-[10px] font-bold text-[var(--yellow)]">{e.kind}</td>
                        <td className="p-2.5">
                          {e.status && <span className="capitalize">{e.status}</span>}
                          {e.units && ` (${e.units} units)`}
                          {e.note && ` · ${e.note}`}
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
                            {e.runningBalance > 0 ? 'Due' : e.runningBalance < 0 ? 'Adv' : ''}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => onDeleteLabourEntry(currentWorker.name, e.id)}
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

            {/* Quick Add Entry */}
            <form onSubmit={handleAddEntry} className="mt-3 pt-3 border-t border-[var(--steel-line)] space-y-2 text-xs">
              <div className="font-bold text-xs uppercase text-[var(--yellow)]">+ Log Attendance or Payment</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <select
                  value={entryKind}
                  onChange={e => setEntryKind(e.target.value as any)}
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)]"
                >
                  <option value="attendance">Attendance / Work</option>
                  <option value="payment">Wages Payment</option>
                  <option value="advance">Advance</option>
                  <option value="loan">Loan</option>
                  <option value="damage">Damage Deduction</option>
                </select>

                {entryKind === 'attendance' ? (
                  currentWorker.rateType === 'daily' ? (
                    <select
                      value={entryStatus}
                      onChange={e => setEntryStatus(e.target.value as any)}
                      className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1.5 text-xs text-[var(--text)]"
                    >
                      <option value="present">Present (Full Day)</option>
                      <option value="half">Half Day</option>
                      <option value="absent">Absent</option>
                      <option value="leave">Leave</option>
                    </select>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      value={entryUnits}
                      onChange={e => setEntryUnits(e.target.value)}
                      placeholder="Units produced"
                      className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                    />
                  )
                ) : (
                  <input
                    type="number"
                    min="1"
                    value={entryAmount}
                    onChange={e => setEntryAmount(e.target.value)}
                    placeholder="Amount (Rs)"
                    className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                  />
                )}

                <input
                  type="text"
                  value={entryNote}
                  onChange={e => setEntryNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-[var(--text)]"
                />

                <button
                  type="submit"
                  className="py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow hover:bg-amber-400 transition"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
