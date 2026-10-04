import React, { useState } from 'react';
import { Bell, Plus, CheckCircle, AlertTriangle, Clock, Trash2 } from 'lucide-react';
import { Inquiry, RawStockItem, Transaction, AppLanguage } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { todayISO } from '../utils/helpers';
import { MobilePermissionsCard } from './MobilePermissionsCard';

interface NotificationsViewProps {
  inquiries: Inquiry[];
  rawStock: RawStockItem[];
  transactions: Transaction[];
  language: AppLanguage;
  onAddInquiry: (inquiry: Omit<Inquiry, 'id' | 'resolved'>) => void;
  onResolveInquiry: (id: string) => void;
  onDeleteInquiry: (id: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  inquiries,
  rawStock,
  transactions,
  language,
  onAddInquiry,
  onResolveInquiry,
  onDeleteInquiry
}) => {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [party, setParty] = useState('');
  const [phone, setPhone] = useState('');
  const [detail, setDetail] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'high' | 'urgent'>('high');

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  // System notifications
  const lowStockAlerts = rawStock.filter(
    r => r.lowStockThreshold && ((r.initialWeight || 0) + (r.weight || 0)) <= r.lowStockThreshold
  );
  const undeliveredConfirmed = transactions.filter(t => t.confirmed && !t.receiptUrl);

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

  return (
    <div className="space-y-6 max-w-4xl font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3 font-sans">
        <div>
          <h2 className="font-serif font-black text-xl text-[var(--text)]">{t('inquiries_title')}</h2>
          <p className="text-xs text-[var(--text-dim)]">{t('inquiries_sub')}</p>
        </div>

        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow transition active:scale-95 font-sans"
        >
          <Plus size={14} />
          <span>{t('add_inquiry')}</span>
        </button>
      </div>

      {/* Dedicated Push Notifications & Mobile Device Permissions Access Hub */}
      <MobilePermissionsCard language={language} />

      {/* Urgent System Alerts Banner */}
      {(lowStockAlerts.length > 0 || undeliveredConfirmed.length > 0) && (
        <div className="space-y-2">
          {lowStockAlerts.map(l => (
            <div
              key={l.name}
              className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>
                  <strong>CRITICAL INVENTORY:</strong> {l.name} balance is{' '}
                  {((l.initialWeight || 0) + (l.weight || 0)).toFixed(1)} kg (under {l.lowStockThreshold} kg threshold).
                </span>
              </div>
            </div>
          ))}

          {undeliveredConfirmed.map(u => (
            <div
              key={u.id}
              className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Clock size={16} />
                <span>
                  <strong>GATE PASS REQUIRED:</strong> Order #{u.id} for {u.factory || 'Walk-in'} requires Gate Pass (PDF/JPG) upload to solve and record into sales.
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Buyer Inquiries List */}
      <div className="space-y-3">
        {inquiries.length === 0 ? (
          <div className="text-center py-12 bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl text-[var(--text-dim)] text-xs">
            No active inquiries logged.
          </div>
        ) : (
          inquiries.map(inq => (
            <div
              key={inq.id}
              className={`bg-[var(--panel)] border rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm ${
                inq.resolved ? 'opacity-60 border-[var(--steel-line)]' : 'border-[var(--steel-line)] hover:border-[var(--yellow)]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center text-[var(--yellow)] shrink-0">
                  <Bell size={16} />
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-[var(--text)] font-sans">{inq.party}</span>
                    <span className="text-xs text-[var(--text-dim)] font-mono">{inq.phone}</span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
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
                      <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">
                        Resolved
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-[var(--text)] mt-1 font-sans">{inq.detail}</div>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">Logged: {inq.date}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!inq.resolved && (
                  <button
                    type="button"
                    onClick={() => onResolveInquiry(inq.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-xs font-bold uppercase transition"
                  >
                    <CheckCircle size={13} />
                    <span>Resolve</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onDeleteInquiry(inq.id)}
                  className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-red-400 transition"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Inquiry Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-sm bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-3 font-sans">{t('add_inquiry')}</h3>
            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">Party / Buyer Name</label>
                <input
                  type="text"
                  required
                  value={party}
                  onChange={e => setParty(e.target.value)}
                  placeholder="e.g. Lahore Electric Store (Kashif Sb)"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">Inquiry Details</label>
                <textarea
                  required
                  rows={3}
                  value={detail}
                  onChange={e => setDetail(e.target.value)}
                  placeholder="Inquired about rate for 500 pcs 24 inch heavy gauge ceiling fan rods..."
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-3 py-2 text-xs text-[var(--text)]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-dim)] uppercase mb-1">Urgency</label>
                <select
                  value={urgency}
                  onChange={e => setUrgency(e.target.value as any)}
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-2 text-xs text-[var(--text)]"
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
                  className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow"
                >
                  Save Inquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
