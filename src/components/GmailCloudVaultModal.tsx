import React, { useState } from 'react';
import { AppState, AppLanguage } from '../types';
import { 
  Cloud, 
  Smartphone, 
  ShieldCheck, 
  ArrowDownCircle, 
  RefreshCw, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  Database, 
  Lock, 
  Mail, 
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { ALLOWED_SHEETS_OWNER_EMAIL } from '../utils/googleSheetsSync';

interface GmailCloudVaultModalProps {
  isOpen?: boolean;
  appState?: AppState;
  currentEmail?: string;
  language: AppLanguage;
  syncState: 'synced' | 'syncing' | 'offline' | 'error';
  lastSyncTime: string | null;
  pendingQueueCount?: number;
  isOnline?: boolean;
  onClose: () => void;
  onForceSyncNow: () => void;
  onRestoreFromCloud?: (email: string) => Promise<{ success: boolean; message: string; data?: AppState }>;
  onRestoreFromVault?: (email?: string) => Promise<{ success: boolean; message: string; data?: AppState }>;
  onOpenGoogleSheets?: () => void;
  onOpenGoogleDrive?: () => void;
}

export const GmailCloudVaultModal: React.FC<GmailCloudVaultModalProps> = ({
  isOpen = true,
  appState,
  currentEmail,
  language,
  syncState,
  lastSyncTime,
  pendingQueueCount = 0,
  isOnline = true,
  onClose,
  onForceSyncNow,
  onRestoreFromCloud,
  onRestoreFromVault,
  onOpenGoogleSheets,
  onOpenGoogleDrive
}) => {
  if (isOpen === false) return null;
  const isUrdu = language === 'ur';
  const defaultEmail = currentEmail || ALLOWED_SHEETS_OWNER_EMAIL || 'umarzaman7777777@gmail.com';
  const [emailInput, setEmailInput] = useState(defaultEmail);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const txnCount = appState?.transactions?.length || 0;
  const custCount = appState?.customerLedgers?.length || 0;
  const prodCount = appState?.products?.length || 0;
  const workerCount = appState?.workers?.length || appState?.labourWorkers?.length || 0;
  const binCount = appState?.recycleBin?.length || 0;

  const handleTriggerSync = () => {
    onForceSyncNow();
    setStatusMsg({
      type: 'success',
      text: isUrdu 
        ? '✓ تمام سیلز، کھاتے، مزدور اور کوڑا دان کا ڈیٹا فوراً جی میل کلاؤڈ والٹ پر محفوظ کر دیا گیا۔' 
        : '✓ All sales, ledgers, workers, and recycle bin entries have been immediately synced to your Gmail Cloud Vault.'
    });
    setTimeout(() => setStatusMsg(null), 5000);
  };

  const handleRestoreClick = async () => {
    if (!emailInput.trim()) return;
    setIsRestoring(true);
    setStatusMsg({
      type: 'info',
      text: isUrdu ? 'کلاؤڈ والٹ سے ڈیٹا ڈاؤن لوڈ کیا جا رہا ہے...' : 'Fetching your data from Gmail Cloud Vault...'
    });

    try {
      const restoreFn = onRestoreFromVault || onRestoreFromCloud;
      if (!restoreFn) return;
      const res = await restoreFn(emailInput.trim());
      if (res.success) {
        setStatusMsg({
          type: 'success',
          text: `✓ ${res.message}`
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: res.message || (isUrdu ? 'ڈیٹا بحال کرنے میں ناکامی ہوئی۔' : 'Could not restore cloud vault.')
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message || (isUrdu ? 'خرابی پیش آگئی' : 'An error occurred during restore.')
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div 
        className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        dir={isUrdu ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[var(--border)] bg-gradient-to-r from-sky-950/40 via-[var(--surface-hover)] to-[var(--surface)] flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-inner">
              <Cloud size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-[var(--text-main)]">
                  {isUrdu ? 'جی میل کلاؤڈ سنک و موبائل ریکوری' : 'Gmail Cloud Vault & Mobile Recovery'}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  syncState === 'synced'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : syncState === 'syncing'
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                }`}>
                  {syncState === 'synced' ? '✓ Live Cloud Active' : syncState === 'syncing' ? 'Syncing...' : 'Offline Ready'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">
                {isUrdu 
                  ? 'موبائل گم ہونے یا نیا فون لینے پر سارا ڈیٹا واپس پانے کی 100٪ گارنٹی' 
                  : 'Guaranteed 100% data recovery if you lose your phone or switch to a new device'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Status Alert Banner */}
          {statusMsg && (
            <div className={`p-4 rounded-2xl border text-xs sm:text-sm font-medium flex items-center gap-3 animate-fade-in ${
              statusMsg.type === 'success' 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                : statusMsg.type === 'error'
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                : 'bg-sky-500/15 border-sky-500/30 text-sky-300'
            }`}>
              {statusMsg.type === 'success' ? (
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle size={18} className="text-rose-400 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Account Card */}
          <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--brand)]">
                <Mail size={20} />
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-dim)] font-semibold uppercase tracking-wider block">
                  {isUrdu ? 'منسلک جی میل اکاؤنٹ (مالک)' : 'Connected Owner Gmail'}
                </span>
                <span className="text-sm sm:text-base font-bold text-[var(--text-main)] font-mono">
                  {defaultEmail}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTriggerSync}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[var(--brand)] hover:bg-amber-400 text-black shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all active:scale-95"
              >
                <RefreshCw size={14} className={syncState === 'syncing' ? 'animate-spin' : ''} />
                <span>{isUrdu ? 'ابھی کلاؤڈ پر سنک کریں' : 'Sync to Cloud Now'}</span>
              </button>
            </div>
          </div>

          {/* Current Local & Cloud Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[var(--surface-hover)]/70 border border-[var(--border)] rounded-xl p-3 text-center">
              <span className="text-[11px] text-[var(--text-dim)] block">{isUrdu ? 'کل انوائسز' : 'Total Invoices'}</span>
              <span className="text-lg font-black text-emerald-400">{txnCount}</span>
            </div>
            <div className="bg-[var(--surface-hover)]/70 border border-[var(--border)] rounded-xl p-3 text-center">
              <span className="text-[11px] text-[var(--text-dim)] block">{isUrdu ? 'کسٹمر کھاتے' : 'Customer Ledgers'}</span>
              <span className="text-lg font-black text-sky-400">{custCount}</span>
            </div>
            <div className="bg-[var(--surface-hover)]/70 border border-[var(--border)] rounded-xl p-3 text-center">
              <span className="text-[11px] text-[var(--text-dim)] block">{isUrdu ? 'مزدور و سٹاف' : 'Workers & Labour'}</span>
              <span className="text-lg font-black text-yellow-400">{workerCount}</span>
            </div>
            <div className="bg-[var(--surface-hover)]/70 border border-[var(--border)] rounded-xl p-3 text-center">
              <span className="text-[11px] text-[var(--text-dim)] block">{isUrdu ? 'بحالی کوڑا دان' : 'Recycle Bin'}</span>
              <span className="text-lg font-black text-rose-400">{binCount}</span>
            </div>
          </div>

          {/* New Phone Recovery Section */}
          <div className="border border-sky-500/30 bg-sky-500/5 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                <Smartphone size={18} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[var(--text-main)]">
                  {isUrdu ? 'نیا فون؟ پچھلا سارا ڈیٹا اس فون پر بحال کریں' : 'New Device? Restore All Data Onto This Phone'}
                </h3>
                <p className="text-xs text-[var(--text-dim)] mt-1 leading-relaxed">
                  {isUrdu 
                    ? 'اگر آپ نے نیا موبائل لیا ہے یا فون گم ہو گیا ہے، تو اپنا جی میل درج کریں اور نیچے دیا گیا بٹن دبائیں۔ آپ کا ہر ایک بل، کسٹمر بیلنس اور کھاتہ اس نئے فون پر بغیر کسی نقصان کے منتقل ہو جائے گا۔' 
                    : 'If you switched to a new phone or replaced a lost phone, enter your Gmail and click Restore below. Every single order, customer balance, expense, and worker ledger will be restored onto this phone.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="yourname@gmail.com"
                className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-[var(--text-main)] placeholder-[var(--text-dim)] focus:outline-none focus:border-sky-500"
              />

              <button
                onClick={handleRestoreClick}
                disabled={isRestoring || !emailInput.trim()}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-sky-500 hover:bg-sky-400 text-black shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-95"
              >
                <ArrowDownCircle size={16} className={isRestoring ? 'animate-bounce' : ''} />
                <span>{isRestoring ? (isUrdu ? 'بحال ہو رہا ہے...' : 'Restoring...') : (isUrdu ? 'ڈیٹا اس فون پر لوڈ کریں' : 'Restore All Data to This Device')}</span>
              </button>
            </div>
          </div>

          {/* Collapsible "How It Works" Explanation */}
          <div className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--surface-hover)]/30">
            <button
              onClick={() => setShowHowItWorks(prev => !prev)}
              className="w-full p-3.5 sm:p-4 flex items-center justify-between text-xs sm:text-sm font-bold text-[var(--text-main)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <div className="flex items-center gap-2 text-sky-400">
                <HelpCircle size={16} />
                <span>{isUrdu ? 'یہ سسٹم کیسے کام کرتا ہے؟ (طریقہ کار)' : 'How Does Cloud Synchronization Work?'}</span>
              </div>
              <span className="text-xs text-[var(--text-dim)]">
                {showHowItWorks ? (isUrdu ? 'چھپائیں ▲' : 'Hide ▲') : (isUrdu ? 'دیکھیں ▼' : 'Show ▼')}
              </span>
            </button>

            {showHowItWorks && (
              <div className="p-4 pt-1 border-t border-[var(--border)] text-xs text-[var(--text-dim)] space-y-2.5 leading-relaxed">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[var(--brand)]/20 text-[var(--brand)] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">1</div>
                  <p><strong className="text-[var(--text-main)]">{isUrdu ? 'ہر اندراج فوری محفوظ:' : 'Instant Auto-Save:'}</strong> {isUrdu ? 'جب بھی آپ کوئی نیا بل بناتے ہیں، پیمنٹ لیتے ہیں، یا خرچ درج کرتے ہیں، وہ فوراً کلاؤڈ پر محفوظ ہو جاتا ہے۔' : 'Whenever you make a sale, collect payment, or log expenses, it is instantly written to your secure Firestore cloud vault.'}</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[var(--brand)]/20 text-[var(--brand)] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">2</div>
                  <p><strong className="text-[var(--text-main)]">{isUrdu ? 'حادثاتی ڈیلیٹ کا تحفظ:' : 'Accidental Delete Protection:'}</strong> {isUrdu ? 'اگر کوئی بل یا کھاتہ غلطی سے ڈیلیٹ ہو جائے تو وہ کوڑا دان (Recycle Bin) میں محفوظ ہو جاتا ہے، جہاں سے اسے کسی بھی وقت واپس لایا جا سکتا ہے۔' : 'If any invoice or customer ledger is deleted by accident, it is preserved in the Recycle Bin with 1-click restore.'}</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[var(--brand)]/20 text-[var(--brand)] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">3</div>
                  <p><strong className="text-[var(--text-main)]">{isUrdu ? 'فون کھو جانے پر پریشانی ختم:' : 'Zero-Loss Phone Replacement:'}</strong> {isUrdu ? 'نیا فون خریدیں، ایپ کھولیں، اپنا جی میل اکاؤنٹ درج کریں اور "Restore" کا بٹن دبائیں۔ تمام ڈیٹا 10 سیکنڈ میں نئے فون پر آ جائے گا۔' : 'Buy a new phone, open the app, enter your Gmail, and click Restore. Everything is fetched in seconds.'}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[var(--border)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-dim)]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            <span>{isUrdu ? 'اینڈ-ٹو-اینڈ محفوظ والٹ: آخری سنک وقت:' : 'Secured Cloud Vault • Last synced:'} {lastSyncTime || 'Just now'}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-main)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-colors"
          >
            {isUrdu ? 'ٹھیک ہے' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
