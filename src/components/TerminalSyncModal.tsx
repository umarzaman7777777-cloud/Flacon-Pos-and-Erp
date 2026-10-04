import React, { useState } from 'react';
import { Cloud, RefreshCw, Smartphone, Laptop, Wifi, WifiOff, X, Check, Server, ShieldCheck, Activity, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { AppLanguage } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { testConnection } from '../firebase/config';

interface TerminalSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncState: 'synced' | 'syncing' | 'offline' | 'error';
  lastSyncTime: string | null;
  terminalId: string;
  terminalName: string;
  onUpdateTerminalName: (name: string) => void;
  onForceSync: () => void;
  language: AppLanguage;
  syncErrorMsg?: string | null;
  pendingQueueCount?: number;
  isOnline?: boolean;
  onOpenWorkspaceSync?: () => void;
}

export const TerminalSyncModal: React.FC<TerminalSyncModalProps> = ({
  isOpen,
  onClose,
  syncState,
  lastSyncTime,
  terminalId,
  terminalName,
  onUpdateTerminalName,
  onForceSync,
  language,
  syncErrorMsg,
  pendingQueueCount = 0,
  isOnline = true,
  onOpenWorkspaceSync
}) => {
  const [editingName, setEditingName] = useState(terminalName);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<{ status: 'idle' | 'success' | 'failed'; timeMs?: number } | null>(null);

  if (!isOpen) return null;

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingName.trim()) return;
    onUpdateTerminalName(editingName.trim());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleTestPing = async () => {
    setTestingPing(true);
    setPingResult(null);
    const start = Date.now();
    try {
      const ok = await testConnection();
      const elapsed = Date.now() - start;
      setPingResult({ status: ok ? 'success' : 'failed', timeMs: elapsed });
    } catch {
      setPingResult({ status: 'failed' });
    } finally {
      setTestingPing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono">
      <div className="w-full max-w-lg bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 bg-[var(--panel-raised)] border-b border-[var(--steel-line)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-xl p-1 px-2 shadow-xs border border-slate-200/80 flex items-center justify-center shrink-0">
              <img
                src="/falcon-theme-rod-logo.svg"
                alt="Falcon Rod Maker"
                className="h-8 w-auto object-contain select-none animate-logo-glow"
              />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm text-[var(--text)] font-sans flex items-center gap-2">
                Multi-Terminal Cloud Sync
                <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider font-mono ${
                  syncState === 'synced'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : syncState === 'syncing'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse'
                    : 'bg-red-500/15 text-red-400 border border-red-500/30'
                }`}>
                  {syncState}
                </span>
              </h3>
              <p className="text-[11px] text-[var(--text-dim)]">
                Firebase Firestore synchronization for Falcon Rod Maker
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--panel)] text-[var(--text-dim)] hover:text-[var(--text)] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 text-xs">
          
          {/* Status Banner */}
          <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              {syncState === 'synced' ? (
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Wifi size={16} />
                </div>
              ) : syncState === 'syncing' ? (
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center animate-spin">
                  <RefreshCw size={16} />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
                  <WifiOff size={16} />
                </div>
              )}
              <div>
                <div className="font-bold text-[var(--text)] flex items-center gap-2">
                  <span>
                    {syncState === 'synced'
                      ? 'Real-time Link Active'
                      : syncState === 'syncing'
                      ? 'Syncing to Cloud...'
                      : 'Offline Mode (Local Cache)'}
                  </span>
                  {pendingQueueCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 border border-amber-500/40 text-[var(--yellow)] font-bold">
                      {pendingQueueCount} queued
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                  Last cloud sync: <span className="text-[var(--text)]">{lastSyncTime || 'Just now'}</span>
                  {!isOnline && <span className="text-red-400 font-semibold ml-1.5">· Internet Disconnected</span>}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onForceSync}
              className="px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[var(--text)] hover:text-[var(--yellow)] font-bold flex items-center gap-1.5 transition"
            >
              <RefreshCw size={12} className={syncState === 'syncing' ? 'animate-spin' : ''} />
              <span>{pendingQueueCount > 0 ? `Flush Queue (${pendingQueueCount})` : 'Sync Now'}</span>
            </button>
          </div>

          {/* Offline Queue & Auto-Push Banner */}
          {pendingQueueCount > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-300">
              <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                {pendingQueueCount}
              </div>
              <div className="text-[11px] leading-relaxed">
                <span className="font-bold text-[var(--text)]">Offline Queue Active: </span>
                {pendingQueueCount} state update{pendingQueueCount > 1 ? 's are' : ' is'} stored in this browser's local cache. As soon as internet connectivity is detected, this queue will <strong>automatically push</strong> to Firebase without any data loss.
              </div>
            </div>
          )}

          {syncErrorMsg && (
            <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 text-[11px]">
              Offline notice: {syncErrorMsg}. Changes remain safely preserved locally on this terminal.
            </div>
          )}

          {/* Current Terminal Configuration */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">
              This Device (POS Terminal)
            </label>
            <form onSubmit={handleSaveName} className="flex gap-2">
              <input
                type="text"
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                placeholder="e.g. Counter 1, Workshop Floor, Dispatch Bay"
                className="flex-1 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:border-[var(--yellow)] focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[var(--yellow)] text-[var(--canvas)] font-bold hover:brightness-110 flex items-center gap-1.5 transition"
              >
                {savedSuccess ? <Check size={14} /> : null}
                <span>{savedSuccess ? 'Saved' : 'Save Name'}</span>
              </button>
            </form>
            <div className="text-[10px] text-[var(--text-dim)] flex items-center justify-between">
              <span>Terminal UID: <code className="text-[var(--text)]">{terminalId}</code></span>
              <span>Platform: <span className="text-[var(--yellow)] font-semibold">Industrial POS Web</span></span>
            </div>
          </div>

          {/* Cloud Architecture Details */}
          <div className="space-y-2 border-t border-[var(--steel-line)] pt-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider flex items-center gap-1.5">
                <Server size={12} />
                <span>Connected Cloud Infrastructure</span>
              </div>
              <button
                type="button"
                onClick={handleTestPing}
                disabled={testingPing}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[var(--text)] transition disabled:opacity-50"
              >
                <Activity size={11} className={testingPing ? 'animate-spin text-[var(--yellow)]' : 'text-emerald-400'} />
                <span>{testingPing ? 'Testing...' : 'Ping Cloud'}</span>
              </button>
            </div>

            {pingResult && (
              <div className={`p-2 rounded-lg border text-[10px] flex items-center justify-between ${
                pingResult.status === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}>
                <span>{pingResult.status === 'success' ? '✓ Cloud Firestore Reachable' : '⚠ Using Offline Persistence Cache'}</span>
                {pingResult.timeMs !== undefined && <span>{pingResult.timeMs}ms</span>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                <div className="text-[10px] text-[var(--text-dim)]">Database Engine</div>
                <div className="font-bold text-[var(--text)] mt-0.5">Google Cloud Firestore</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                <div className="text-[10px] text-[var(--text-dim)]">Security Rules</div>
                <div className="font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
                  <ShieldCheck size={12} />
                  <span>Enforced & Deployed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Google Workspace Cloud Sync Card */}
          {onOpenWorkspaceSync && (
            <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <FileSpreadsheet size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                    <span>Google Sheets & Drive Hub</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                      Live
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-dim)] truncate">
                    7-Sheet live streaming & automated Drive database snapshots
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWorkspaceSync();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0 transition cursor-pointer shadow-xs"
              >
                <span>Manage</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}

          {/* Multi-Device Synchronization Guide */}
          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1.5">
            <div className="text-[11px] font-bold text-[var(--yellow)] flex items-center gap-1.5">
              <Laptop size={14} />
              <span>Multi-Terminal Setup</span>
            </div>
            <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
              Open this application URL on your other shop counter tablet, warehouse laptop, or dispatch mobile terminal.
              All invoices, inventory changes, factory debit entries, and workshop ledgers update seamlessly in real time across all logged terminals.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[var(--panel-raised)] border-t border-[var(--steel-line)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-xs font-bold hover:border-[var(--yellow)] text-[var(--text)] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
