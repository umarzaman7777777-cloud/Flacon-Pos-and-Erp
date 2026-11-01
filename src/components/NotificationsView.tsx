import React, { useState } from 'react';
import {
  Bell,
  Plus,
  CheckCircle,
  AlertTriangle,
  Clock,
  Trash2,
  UploadCloud,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Check,
  Search,
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Inquiry, RawStockItem, Transaction, AppLanguage, GatePassData } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { todayISO, fmt } from '../utils/helpers';
import { MobilePermissionsCard } from './MobilePermissionsCard';
import { GatePassUploadModal } from './GatePassUploadModal';
import { hapticTap, hapticTransactionComplete } from '../utils/haptics';

interface NotificationsViewProps {
  inquiries: Inquiry[];
  rawStock: RawStockItem[];
  transactions: Transaction[];
  language: AppLanguage;
  companyName?: string;
  onAddInquiry: (inquiry: Omit<Inquiry, 'id' | 'resolved'>) => void;
  onResolveInquiry: (id: string) => void;
  onDeleteInquiry: (id: string) => void;
  onAttachGatePass?: (id: string, gatePass?: GatePassData) => void;
  onNavigate?: (view: any) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  inquiries,
  rawStock,
  transactions,
  language,
  companyName = 'Falcon Rod Maker',
  onAddInquiry,
  onResolveInquiry,
  onDeleteInquiry,
  onAttachGatePass,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'gatepass' | 'inquiries' | 'stock'>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [party, setParty] = useState('');
  const [phone, setPhone] = useState('');
  const [detail, setDetail] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'high' | 'urgent'>('high');

  // Gate Pass Upload Modal state
  const [uploadTxn, setUploadTxn] = useState<Transaction | null>(null);

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  // System notifications
  const lowStockAlerts = rawStock.filter(
    r => r.lowStockThreshold && ((r.initialWeight || 0) + (r.weight || 0)) <= r.lowStockThreshold
  );

  // Orders that are confirmed but still awaiting outward gate pass
  const undeliveredConfirmed = transactions.filter(t => t.confirmed && !t.receiptUrl && !t.gatePass);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!party.trim() || !detail.trim()) return;

    onAddInquiry({
      date: todayISO(),
      party: party.trim(),
      phone: phone.trim() || '—',
      detail: detail.trim(),
      urgency
    });

    setParty('');
    setPhone('');
    setDetail('');
    setAddModalOpen(false);
  };

  const handleQuickBypassGatePass = (txn: Transaction) => {
    hapticTransactionComplete();
    if (onAttachGatePass) {
      onAttachGatePass(txn.id);
    }
  };

  const totalAlertsCount = undeliveredConfirmed.length + lowStockAlerts.length + inquiries.filter(i => !i.resolved).length;

  return (
    <div className="space-y-5 max-w-4xl max-w-full overflow-x-hidden break-words font-mono pb-24 sm:pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3 font-sans">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Bell size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif font-black text-xl text-[var(--text)]">
                {t('inquiries_title')}
              </h2>
              {totalAlertsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-xs font-bold border border-amber-500/30">
                  {totalAlertsCount} Actionable
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-dim)]">
              Gate dispatch alerts, client inquiries & inventory warnings
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow transition active:scale-95 font-sans cursor-pointer hover:bg-amber-400"
        >
          <Plus size={15} />
          <span>{t('add_inquiry')}</span>
        </button>
      </div>

      {/* Segmented Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'all'
              ? 'bg-amber-500 text-black shadow-sm'
              : 'bg-[var(--panel-raised)] border border-[var(--steel-line)] text-zinc-400 hover:text-white'
          }`}
        >
          <span>All Alerts</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
            {totalAlertsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gatepass')}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'gatepass'
              ? 'bg-amber-500 text-black shadow-sm'
              : 'bg-[var(--panel-raised)] border border-[var(--steel-line)] text-zinc-400 hover:text-white'
          }`}
        >
          <Clock size={13} />
          <span>Gate Pass Required</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
            {undeliveredConfirmed.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inquiries')}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'inquiries'
              ? 'bg-amber-500 text-black shadow-sm'
              : 'bg-[var(--panel-raised)] border border-[var(--steel-line)] text-zinc-400 hover:text-white'
          }`}
        >
          <Bell size={13} />
          <span>Customer Inquiries</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
            {inquiries.length}
          </span>
        </button>

        {lowStockAlerts.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab('stock')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'stock'
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-[var(--panel-raised)] border border-[var(--steel-line)] text-zinc-400 hover:text-white'
            }`}
          >
            <AlertTriangle size={13} />
            <span>Low Stock</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
              {lowStockAlerts.length}
            </span>
          </button>
        )}
      </div>

      {/* Dedicated Push Notifications & Mobile Device Permissions Access Hub */}
      <MobilePermissionsCard language={language} />

      {/* SECTION 1: ACTIONABLE GATE PASS REQUIRED CARDS */}
      {(activeTab === 'all' || activeTab === 'gatepass') && undeliveredConfirmed.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-amber-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              <span>Gate Pass Required for Confirmed Orders ({undeliveredConfirmed.length})</span>
            </span>
            <span className="text-[10px] text-zinc-400 lowercase">
              upload delivery photo or bilty to solve
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {undeliveredConfirmed.map(u => (
              <div
                key={u.id}
                className="p-4 rounded-2xl bg-[var(--panel)] border border-amber-500/40 hover:border-amber-400 transition-all shadow-md space-y-3"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--steel-line)] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-black bg-amber-400 px-2.5 py-0.5 rounded-lg shadow-xs">
                      Order #{u.id}
                    </span>
                    <span className="font-bold text-sm text-[var(--text)] font-sans">
                      {u.factory || 'Walk-in Customer'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--text-dim)]">{u.date}</span>
                    <span className="font-bold text-amber-400">{fmt(u.total)}</span>
                  </div>
                </div>

                {/* Body Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="text-[var(--text)] font-sans line-clamp-1">
                      {u.itemsSummary || `${u.itemCount} items booked`}
                    </div>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold">
                        Awaiting Outward Gate Pass
                      </span>
                      <span>Requires signed delivery challan or vehicle pass</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setUploadTxn(u)}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow cursor-pointer touch-manipulation"
                    >
                      <UploadCloud size={14} />
                      <span>Attach Gate Pass</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickBypassGatePass(u)}
                      className="px-2.5 py-2 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-emerald-400 text-zinc-300 hover:text-emerald-400 text-xs font-semibold transition cursor-pointer"
                      title="Mark delivery slip verified without photo"
                    >
                      <Check size={14} />
                      <span className="hidden sm:inline">Quick Verify</span>
                    </button>

                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('transactions')}
                        className="p-2 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] text-zinc-400 hover:text-white transition cursor-pointer"
                        title="View in Transactions view"
                      >
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: LOW STOCK INVENTORY ALERTS */}
      {(activeTab === 'all' || activeTab === 'stock') && lowStockAlerts.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 uppercase tracking-wider">
            <AlertTriangle size={14} />
            <span>Critical Raw Material Inventory Warnings</span>
          </div>

          <div className="space-y-2">
            {lowStockAlerts.map(l => (
              <div
                key={l.name}
                className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <strong className="text-white text-sm font-sans block">{l.name}</strong>
                    <span className="text-[11px] text-red-300/80">
                      Balance: {((l.initialWeight || 0) + (l.weight || 0)).toFixed(1)} kg remaining (Below reorder threshold: {l.lowStockThreshold} kg)
                    </span>
                  </div>
                </div>

                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('raw_material')}
                    className="px-3 py-1.5 rounded-xl bg-red-500 text-white font-bold text-xs uppercase hover:bg-red-400 transition cursor-pointer shrink-0 self-end sm:self-auto"
                  >
                    Order from Mill
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: BUYER & WORKSHOP INQUIRIES */}
      {(activeTab === 'all' || activeTab === 'inquiries') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider">
            <span>Customer Phone Inquiries & Orders Log ({inquiries.length})</span>
            <span className="text-[10px] text-zinc-500 lowercase">click resolve when completed</span>
          </div>

          {inquiries.length === 0 ? (
            <div className="text-center py-12 bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl text-[var(--text-dim)] text-xs space-y-1">
              <p>No active customer inquiries logged.</p>
              <p className="text-[10px] text-zinc-500">Tap "+ Add Inquiry" above to record customer phone calls or quotes.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {inquiries.map(inq => (
                <div
                  key={inq.id}
                  className={`bg-[var(--panel)] border rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm transition-all ${
                    inq.resolved
                      ? 'opacity-60 border-[var(--steel-line)]'
                      : 'border-[var(--steel-line)] hover:border-[var(--yellow)]'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center text-[var(--yellow)] shrink-0">
                      <Bell size={17} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[var(--text)] font-sans">{inq.party}</span>
                        <span className="text-xs text-amber-400 font-mono font-semibold">{inq.phone}</span>
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                            inq.urgency === 'urgent'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                              : inq.urgency === 'high'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-[var(--panel-raised)] text-[var(--text-dim)]'
                          }`}
                        >
                          {inq.urgency}
                        </span>
                        {inq.resolved && (
                          <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <CheckCircle2 size={11} />
                            <span>Resolved</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-zinc-200 mt-1 font-sans leading-relaxed">{inq.detail}</div>
                      <div className="text-[10px] text-[var(--text-dim)] mt-1">Logged: {inq.date}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {!inq.resolved && (
                      <button
                        type="button"
                        onClick={() => onResolveInquiry(inq.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold uppercase transition cursor-pointer"
                      >
                        <CheckCircle size={13} />
                        <span>Resolve</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteInquiry(inq.id)}
                      className="p-1.5 rounded-xl border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-red-400 hover:border-red-400/50 transition cursor-pointer"
                      title="Delete inquiry"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Inquiry Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 font-mono animate-in fade-in duration-150">
          <div className="w-full max-w-md max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 sm:p-6 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-3 font-sans">{t('add_inquiry')}</h3>
            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold tracking-wider mb-1">Party / Buyer Name</label>
                <input
                  type="text"
                  required
                  value={party}
                  onChange={e => setParty(e.target.value)}
                  placeholder="e.g. Lahore Electric Store (Kashif Sb)"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold tracking-wider mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold tracking-wider mb-1">Inquiry Details</label>
                <textarea
                  required
                  rows={3}
                  value={detail}
                  onChange={e => setDetail(e.target.value)}
                  placeholder="Inquired about rate for 500 pcs 24 inch heavy gauge ceiling fan rods..."
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-dim)] uppercase font-bold tracking-wider mb-1">Urgency</label>
                <select
                  value={urgency}
                  onChange={e => setUrgency(e.target.value as any)}
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow hover:bg-amber-400 transition cursor-pointer"
                >
                  Save Inquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Gate Pass Upload Modal from Notifications */}
      {uploadTxn && (
        <GatePassUploadModal
          transaction={uploadTxn}
          language={language}
          companyName={companyName}
          onClose={() => setUploadTxn(null)}
          onConfirmUpload={(id, gatePass) => {
            if (onAttachGatePass) {
              onAttachGatePass(id, gatePass);
            }
            setUploadTxn(null);
          }}
        />
      )}
    </div>
  );
};
