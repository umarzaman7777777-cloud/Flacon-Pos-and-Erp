import React, { useState, useEffect } from 'react';
import {
  Settings,
  Sliders,
  Sparkles,
  MoveHorizontal,
  MoveVertical,
  Minus,
  Plus,
  AlignLeft,
  AlignCenter,
  Check,
  RotateCcw,
  Palette,
  Building,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Bell,
  Layers,
  Grid,
  Ruler,
  Image as ImageIcon,
  Smartphone,
  Volume2,
  Fingerprint,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  Printer,
  Wifi,
  Bluetooth,
  Usb,
  Radio,
  RefreshCw,
  FileText,
  Database,
  Download,
  HardDrive,
  Code2,
  Activity,
  AlertTriangle,
  Server,
  ArrowDownToLine,
  Copy,
  WifiOff,
  Cloud,
  FileSpreadsheet,
  ArrowRight,
  FileDown,
  Bug,
  Save
} from 'lucide-react';
import { OAuthDebugLogsSection } from './OAuthDebugLogsSection';
import { getOAuthDebugLogs, OAUTH_LOG_EVENT } from '../utils/oauthDebugLogger';
import {
  AppState,
  VisualSettings,
  ThemeMode,
  LogoTheme,
  AppLanguage,
  PrinterSettings,
  PrinterConnectionType,
  PrinterPaperSize,
  ExportDocumentConfig,
  ExportPaperSize,
  ExportOrientation,
  ExportFontFamily
} from '../types';
import {
  getSavedExportConfig,
  saveExportConfig,
  openExportModal,
  EXPORT_THEME_PRESETS
} from '../utils/exportSettingsHelper';
import { TRANSLATIONS } from '../utils/i18n';
import { FalconLogo } from './FalconLogo';
import { FALCON_LOGO_PNG } from '../utils/logoData';
import { auth, googleProvider, db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { performUniversalGoogleSignIn } from '../utils/googleAuthHelper';
import {
  calculateDatabaseMetrics,
  generateSyncDiagnosticReport,
  exportLocalDatabaseJSON,
  exportLocalDatabaseSQL
} from '../utils/syncReport';
import { isNativeOrLocalEnvironment } from '../utils/googleSheetsSync';
import {
  authenticateWithFingerprint,
  checkBiometricSupport,
  clearBiometricEnrollment,
  BiometricStatus
} from '../utils/biometricAuth';
import {
  getPrinterSettings,
  savePrinterSettings,
  subscribeToPrinterSettings,
  scanAndConnectBluetooth,
  runTestPrint
} from '../utils/printerManager';
import { PrintPageSetupModal } from './PrintPageSetupModal';
import {
  PAPER_SIZE_SPECS,
  MARGIN_SPECS,
  getEffectivePageSetup,
  saveEffectivePageSetup
} from '../utils/printSetupHelper';
import {
  hapticAddToCart,
  hapticTransactionComplete,
  hapticPullComplete,
  hapticTap,
  triggerHaptic
} from '../utils/haptics';
import { MobilePermissionsCard } from './MobilePermissionsCard';

export const LOGO_THEME_OPTIONS: { id: LogoTheme; name: string; color: string }[] = [
  { id: 'amber', name: 'Imperial Gold', color: '#f59e0b' },
  { id: 'ocean', name: 'Laser Cyan', color: '#06b6d4' },
  { id: 'emerald', name: 'Precision Green', color: '#10b981' },
  { id: 'sunset', name: 'Molten Flame', color: '#f97316' },
  { id: 'royal', name: 'Royal Purple', color: '#a855f7' },
  { id: 'crimson', name: 'Industrial Red', color: '#ef4444' },
  { id: 'steel', name: 'Chrome Steel', color: '#94a3b8' }
];

interface SettingsViewProps {
  visualSettings: VisualSettings;
  companyName: string;
  companyTagline: string;
  pin: string;
  recoveryAnswer: string;
  language: AppLanguage;
  initialTab?: 'all' | 'logo' | 'visual_studio' | 'branding' | 'security' | 'printer' | 'sync' | 'debug_logs';
  printerTabTrigger?: number;
  onUpdateVisualSettings: (settings: Partial<VisualSettings>) => void;
  onUpdateBranding: (name: string, tagline: string) => void;
  onUpdatePin: (newPin: string) => void;
  onUpdateRecoveryAnswer?: (newAnswer: string) => void;
  onUpdateAutolock?: (seconds: number) => void;
  onLockTerminal: () => void;
  appState?: AppState;
  syncState?: 'synced' | 'syncing' | 'offline' | 'error';
  lastSyncTime?: string | null;
  terminalId?: string;
  terminalName?: string;
  pendingQueueCount?: number;
  isOnline?: boolean;
  syncErrorMsg?: string | null;
  onForceSyncNow?: () => void;
  onNavigateToBackup?: (tab?: 'cloud_status' | 'google_drive' | 'google_sheets' | 'sql_export' | 'json_backup' | 'signatures') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  visualSettings,
  companyName,
  companyTagline,
  pin,
  recoveryAnswer,
  language,
  initialTab = 'all',
  printerTabTrigger,
  onUpdateVisualSettings,
  onUpdateBranding,
  onUpdatePin,
  onUpdateRecoveryAnswer,
  onUpdateAutolock,
  onLockTerminal,
  appState,
  syncState = 'synced',
  lastSyncTime,
  terminalId = 'terminal_01',
  terminalName = 'Counter Terminal',
  pendingQueueCount = 0,
  isOnline = true,
  syncErrorMsg,
  onForceSyncNow,
  onNavigateToBackup
}) => {
  const [activeSection, setActiveSection] = useState<'all' | 'logo' | 'visual_studio' | 'branding' | 'security' | 'printer' | 'sync' | 'permissions' | 'export_studio' | 'debug_logs'>(initialTab as any);
  const [showHiddenDebugTab, setShowHiddenDebugTab] = useState(false);
  const [oauthDebugLogsCount, setOauthDebugLogsCount] = useState<number>(() => getOAuthDebugLogs().length);

  useEffect(() => {
    const handleLogUpdate = () => {
      const logs = getOAuthDebugLogs();
      setOauthDebugLogsCount(logs.length);
      // Auto-reveal the hidden debug logs section if errors exist or if navigated to it
      if (logs.length > 0 || initialTab === ('debug_logs' as any)) {
        setShowHiddenDebugTab(true);
      }
    };
    handleLogUpdate();
    window.addEventListener(OAUTH_LOG_EVENT, handleLogUpdate);
    return () => window.removeEventListener(OAUTH_LOG_EVENT, handleLogUpdate);
  }, [initialTab]);

  const [newPinVal, setNewPinVal] = useState(pin);
  const [newRecoveryVal, setNewRecoveryVal] = useState(recoveryAnswer);
  const [selectedAutolockSec, setSelectedAutolockSec] = useState<number>(() => {
    if (appState?.autolockSeconds !== undefined) return appState.autolockSeconds;
    if (appState?.autolockMinutes !== undefined) return appState.autolockMinutes * 60;
    return 300;
  });
  const [pinSavedMsg, setPinSavedMsg] = useState(false);
  const [showPinMask, setShowPinMask] = useState(false);

  // Business Branding Draft & Save State
  const [draftCompanyName, setDraftCompanyName] = useState(companyName);
  const [draftCompanyTagline, setDraftCompanyTagline] = useState(companyTagline);
  const [brandingSavedMsg, setBrandingSavedMsg] = useState(false);
  const [visualSavedMsg, setVisualSavedMsg] = useState(false);
  const [allSettingsSavedMsg, setAllSettingsSavedMsg] = useState(false);

  useEffect(() => {
    setDraftCompanyName(companyName);
  }, [companyName]);

  useEffect(() => {
    setDraftCompanyTagline(companyTagline);
  }, [companyTagline]);

  const handleSaveBranding = () => {
    onUpdateBranding(draftCompanyName, draftCompanyTagline);
    triggerHaptic('success');
    setBrandingSavedMsg(true);
    setTimeout(() => setBrandingSavedMsg(false), 3000);
  };

  const handleSaveVisualSettings = () => {
    triggerHaptic('success');
    setVisualSavedMsg(true);
    setTimeout(() => setVisualSavedMsg(false), 3000);
  };

  const handleSavePrinterSettings = () => {
    savePrinterSettings(printerConf);
    triggerHaptic('success');
    setPrinterSavedMsg(true);
    setTimeout(() => setPrinterSavedMsg(false), 3000);
  };

  const handleSaveAllSettings = () => {
    // 1. Save Branding
    onUpdateBranding(draftCompanyName, draftCompanyTagline);

    // 2. Save Security PIN, recovery & autolock
    if (/^\d{4}$/.test(newPinVal)) {
      onUpdatePin(newPinVal);
    }
    if (onUpdateRecoveryAnswer && newRecoveryVal.trim()) {
      onUpdateRecoveryAnswer(newRecoveryVal.trim());
    }
    if (onUpdateAutolock) {
      onUpdateAutolock(selectedAutolockSec);
    }

    // 3. Save Printer & Exports
    savePrinterSettings(printerConf);
    saveExportConfig(exportConf);

    // 4. Trigger Haptics and visual notifications across all sections
    triggerHaptic('success');
    setAllSettingsSavedMsg(true);
    setBrandingSavedMsg(true);
    setPinSavedMsg(true);
    setPrinterSavedMsg(true);
    setVisualSavedMsg(true);
    setExportSavedMsg(true);
    setTimeout(() => setAllSettingsSavedMsg(false), 3500);
  };

  // Document Export Studio Configuration State
  const [exportConf, setExportConf] = useState<ExportDocumentConfig>(() => getSavedExportConfig());
  const [exportSavedMsg, setExportSavedMsg] = useState(false);

  const handleUpdateExportConfig = (updates: Partial<ExportDocumentConfig>) => {
    const next = saveExportConfig({ ...exportConf, ...updates });
    setExportConf(next);
    setExportSavedMsg(true);
    setTimeout(() => setExportSavedMsg(false), 2000);
  };

  const handleLaunchExportStudioPreview = () => {
    openExportModal({
      title: 'Factory Customer Ledger & Financial Audit',
      headers: ['Date', 'Description', 'Debit (PKR)', 'Credit (PKR)', 'Method', 'Tax'],
      rows: [
        ['2026-09-20', 'Ceiling Fan Down Rods (24 Heavy) x 500', '175,000', '0', 'Credit Invoice', '0'],
        ['2026-09-21', 'Bank Alfalah Cheque Deposit #4401', '0', '100,000', 'Bank Cheque', '0'],
        ['2026-09-22', 'Exhaust Fan Mounting Rods x 200', '48,000', '0', 'Credit Invoice', '0'],
        ['2026-09-22', 'Cash Partial Payment Receipt', '0', '45,000', 'Cash', '0']
      ],
      filename: 'Sample_Financial_Ledger',
      companyName: companyName || 'Falcon Rod Maker',
      subtitle: 'Industrial Fan Accessories & Workshop ERP · Gujrat',
      balanceFooterText: 'Net Balance Receivable: Rs 78,000 (Seventy-Eight Thousand Rupees Only)',
      defaultFormat: 'pdf',
      initialOrientation: exportConf.orientation,
      initialPaperSize: exportConf.paperSize
    });
  };

  // Sync Diagnostics & Manual Local Export State in Settings
  const [settingsExportNotice, setSettingsExportNotice] = useState<string | null>(null);
  const [copiedSettingsReport, setCopiedSettingsReport] = useState(false);
  const [settingsPingLatency, setSettingsPingLatency] = useState<number | null>(null);
  const [isSettingsPinging, setIsSettingsPinging] = useState(false);
  const [showSettingsRawReport, setShowSettingsRawReport] = useState(false);

  // Printer Hardware Configuration State
  const [printerConf, setPrinterConf] = useState<PrinterSettings>(() => getPrinterSettings());
  const [isScanningBt, setIsScanningBt] = useState(false);
  const [btScanMsg, setBtScanMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testPrintSuccess, setTestPrintSuccess] = useState(false);
  const [printerSavedMsg, setPrinterSavedMsg] = useState(false);
  const [isAdvancedPageSetupOpen, setIsAdvancedPageSetupOpen] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveSection(initialTab);
    }
  }, [initialTab, printerTabTrigger]);

  useEffect(() => {
    const unsub = subscribeToPrinterSettings(settings => {
      setPrinterConf(settings);
    });
    return () => unsub();
  }, []);

  const handleUpdatePrinter = (updated: Partial<PrinterSettings>) => {
    const next = savePrinterSettings(updated);
    setPrinterConf(next);
    onUpdateVisualSettings({ printerSettings: next });
    setPrinterSavedMsg(true);
    setTimeout(() => setPrinterSavedMsg(false), 2500);
  };

  const handleScanBluetooth = async () => {
    setIsScanningBt(true);
    setBtScanMsg(null);
    const res = await scanAndConnectBluetooth();
    setIsScanningBt(false);
    if (res.success) {
      setBtScanMsg({ type: 'success', text: `Device Connected: ${res.name || 'Mobile ESC/POS Printer'}` });
      setPrinterConf(getPrinterSettings());
    } else {
      setBtScanMsg({ type: 'error', text: res.error || 'Bluetooth device selection cancelled.' });
    }
  };

  const handleRunTestPrint = () => {
    runTestPrint(printerConf, companyName);
    setTestPrintSuccess(true);
    setTimeout(() => setTestPrintSuccess(false), 3000);
  };

  // Biometric & Google Auth settings state
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [bioTesting, setBioTesting] = useState(false);
  const [bioMsg, setBioMsg] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleMsg, setGoogleMsg] = useState<string | null>(null);

  useEffect(() => {
    checkBiometricSupport().then(status => setBiometricStatus(status));
    const unsubscribe = onAuthStateChanged(auth, user => setCurrentUser(user));
    return () => unsubscribe();
  }, []);

  const handleTestBiometric = async () => {
    setBioTesting(true);
    setBioMsg(null);
    setBioError(null);
    try {
      const res = await authenticateWithFingerprint(currentUser?.email || 'umarzaman7777777@gmail.com');
      if (res.success) {
        setBioMsg('✓ Fingerprint sensor confirmed! Sensor is active.');
        const updated = await checkBiometricSupport();
        setBiometricStatus(updated);
      } else {
        setBioError(res.message);
      }
    } catch (e: any) {
      setBioError(e?.message || 'Biometric scan error');
    } finally {
      setBioTesting(false);
    }
  };

  const handleClearBiometrics = () => {
    clearBiometricEnrollment();
    checkBiometricSupport().then(status => setBiometricStatus(status));
    setBioMsg('Fingerprint enrollment cleared from this device.');
  };

  const handleTestGoogle = async () => {
    setGoogleLoading(true);
    setGoogleMsg(null);
    try {
      const res = await performUniversalGoogleSignIn({
        preferredEmail: currentUser?.email || 'umarzaman7777777@gmail.com'
      });
      setGoogleMsg(`✓ Directly Authenticated with Google: ${res.userEmail || currentUser?.email || 'Verified'}`);
    } catch (e: any) {
      setGoogleMsg(`Authentication notice: ${e.message || 'Authorization was closed or cancelled.'}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await signOut(auth);
    setGoogleMsg('Google account signed out from this terminal.');
  };

  // Sync Diagnostics & Manual Local Database Export Handlers
  const isFirebaseUnreachable = !isOnline || syncState === 'offline' || syncState === 'error' || settingsPingLatency === -1;
  const metrics = appState ? calculateDatabaseMetrics(appState) : null;
  const ownerAccount = currentUser?.email || 'umarzaman7777777@gmail.com';

  const handleSettingsExportJSON = () => {
    if (!appState) return;
    exportLocalDatabaseJSON(appState, ownerAccount, terminalId || 'default_terminal', !isFirebaseUnreachable);
    setSettingsExportNotice(`✓ Full JSON database exported (${metrics?.totalRecords || 0} records).`);
    setTimeout(() => setSettingsExportNotice(null), 4000);
  };

  const handleSettingsExportSQL = () => {
    if (!appState) return;
    exportLocalDatabaseSQL(appState, ownerAccount);
    setSettingsExportNotice(`✓ Relational ANSI SQL dump generated & downloaded.`);
    setTimeout(() => setSettingsExportNotice(null), 4000);
  };

  const handleSettingsTestPing = async () => {
    setIsSettingsPinging(true);
    const start = performance.now();
    try {
      const syncDocRef = doc(db, 'sync_states', 'falcon_workshop');
      await getDoc(syncDocRef);
      const elapsed = Math.round(performance.now() - start);
      setSettingsPingLatency(elapsed);
    } catch {
      setSettingsPingLatency(-1);
    } finally {
      setIsSettingsPinging(false);
    }
  };

  const handleSettingsCopyReport = () => {
    if (!appState) return;
    const reportText = generateSyncDiagnosticReport({
      appState,
      syncState: syncState || 'synced',
      isOnline: isOnline !== false,
      pingLatency: settingsPingLatency,
      lastSyncTime,
      terminalId: terminalId || 'terminal_01',
      terminalName: terminalName || 'Counter Terminal',
      pendingQueueCount: pendingQueueCount || 0,
      syncErrorMsg,
      userEmail: ownerAccount
    });
    navigator.clipboard.writeText(reportText).then(() => {
      setCopiedSettingsReport(true);
      setTimeout(() => setCopiedSettingsReport(false), 3000);
    });
  };

  // Derive lock logo values from visualSettings with sensible defaults
  const [logoAsset, setLogoAsset] = useState<string>(() => {
    const saved = localStorage.getItem('falcon_logo_asset');
    return (saved && saved.startsWith('/falcon-theme-rod-logo')) ? saved : '/falcon-theme-rod-logo.svg';
  });
  const logoPosition = visualSettings.lockLogoPosition || 'inline';
  const customHeight = typeof visualSettings.lockLogoHeight === 'number' ? visualSettings.lockLogoHeight : 30;
  const logoVariant = visualSettings.lockLogoVariant || 'image';
  const logoFrame = visualSettings.lockLogoFrame || 'badge';
  const logoAlignment = visualSettings.lockLogoAlignment || 'center';
  const activeLogoTheme = visualSettings.logoTheme || 'amber';

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const updateLogoSettings = (updates: Partial<VisualSettings>) => {
    onUpdateVisualSettings(updates);
    try {
      const existing = localStorage.getItem('falcon_lock_logo_pref');
      const parsed = existing ? JSON.parse(existing) : {};
      const merged = {
        ...parsed,
        logoPosition: updates.lockLogoPosition ?? logoPosition,
        customHeight: updates.lockLogoHeight ?? customHeight,
        logoVariant: updates.lockLogoVariant ?? logoVariant,
        logoFrame: updates.lockLogoFrame ?? logoFrame,
        logoAlignment: updates.lockLogoAlignment ?? logoAlignment,
        activeLogoTheme: updates.logoTheme ?? activeLogoTheme
      };
      localStorage.setItem('falcon_lock_logo_pref', JSON.stringify(merged));
    } catch {
      // ignore
    }
  };

  const handleStepResize = (delta: number) => {
    const nextH = Math.max(18, Math.min(130, customHeight + delta));
    updateLogoSettings({ lockLogoHeight: nextH });
  };

  const themes: { id: ThemeMode; name: string; desc: string; bg: string; border: string }[] = [
    {
      id: 'dark',
      name: 'Industrial Charcoal',
      desc: 'Deep warm gunmetal with industrial yellow accent',
      bg: '#141414',
      border: '#f59e0b'
    },
    {
      id: 'light',
      name: 'Clean Light / High-Vis',
      desc: 'Crisp light background for bright factory daylight',
      bg: '#f8fafc',
      border: '#d97706'
    },
    {
      id: 'blue',
      name: 'Technical Blueprint',
      desc: 'Draftsman blue with cyan laser accents',
      bg: '#0a192f',
      border: '#38bdf8'
    },
    {
      id: 'retro',
      name: 'Foundry Amber',
      desc: 'Vintage molten amber iron furnace aesthetic',
      bg: '#1a1005',
      border: '#fb923c'
    },
    {
      id: 'minimal',
      name: 'Obsidian Minimal',
      desc: 'High contrast monochrome with razor sharpness',
      bg: '#09090b',
      border: '#e4e4e7'
    }
  ];

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^\d{4}$/.test(newPinVal)) {
      onUpdatePin(newPinVal);
      if (onUpdateRecoveryAnswer && newRecoveryVal.trim()) {
        onUpdateRecoveryAnswer(newRecoveryVal.trim());
      }
      if (onUpdateAutolock) {
        onUpdateAutolock(selectedAutolockSec);
      }
      setPinSavedMsg(true);
      setTimeout(() => setPinSavedMsg(false), 3000);
    }
  };

  const handleResetAllDefaults = () => {
    onUpdateBranding('Falcon Rod Maker', 'Fan Accessories & Rod Specialist — Gujrat, Pakistan');
    onUpdateVisualSettings({
      theme: 'dark',
      logoTheme: 'amber',
      showBlueprintGrid: true,
      density: 'comfortable',
      fontSize: 'normal',
      reduceMotion: false,
      lockLogoPosition: 'inline',
      lockLogoHeight: 30,
      lockLogoVariant: 'image',
      lockLogoFrame: 'badge',
      lockLogoAlignment: 'center'
    });
    try {
      localStorage.setItem('falcon_lock_logo_pref', JSON.stringify({
        logoPosition: 'inline',
        customHeight: 30,
        logoVariant: 'image',
        logoFrame: 'badge',
        logoAlignment: 'center',
        activeLogoTheme: 'amber'
      }));
    } catch {
      // ignore
    }
  };

  const currentColor = LOGO_THEME_OPTIONS.find(o => o.id === activeLogoTheme)?.color || '#f59e0b';

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono pb-12">
      {/* Header Banner */}
      <div className="border-b border-[var(--steel-line)] pb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3.5">
          <div className="relative group shrink-0 flex items-center justify-center p-1 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-[0_4px_16px_rgba(245,183,0,0.2)]">
            <div className="absolute inset-0 rounded-2xl bg-amber-500/20 blur-md pointer-events-none" />
            <img
              src="/falcon-theme-rod-logo.svg"
              alt="Falcon Rod Maker"
              className="relative z-10 h-10 w-auto object-contain select-none drop-shadow-[0_2px_10px_rgba(245,183,0,0.4)] rounded-xl"
            />
          </div>
          <div>
            <h1 className="font-serif font-black text-xl sm:text-2xl text-[var(--text)] tracking-tight flex items-center gap-2">
              <span>Settings & Customization Center</span>
              <Settings size={18} className="text-amber-400" />
            </h1>
            <p className="text-xs text-[var(--text-dim)] font-mono">
              Control lock screen logo positioning, sizing, Visual Studio themes & business branding
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <button
            type="button"
            onClick={handleSaveAllSettings}
            className={`flex-1 sm:flex-initial justify-center flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 shadow-md cursor-pointer shrink-0 ${
              allSettingsSavedMsg
                ? 'bg-emerald-500 text-black shadow-emerald-500/20'
                : 'bg-amber-400 hover:bg-amber-300 text-black shadow-amber-400/20'
            }`}
            title="Save all changes across branding, visual theme, security & printer"
          >
            {allSettingsSavedMsg ? <Check size={14} className="text-black" /> : <Save size={14} />}
            <span>{allSettingsSavedMsg ? 'All Settings Saved!' : 'Save All Settings'}</span>
          </button>

          {/* Hidden Debug Logs Trigger Button */}
          <button
            type="button"
            onClick={() => {
              setShowHiddenDebugTab(prev => !prev);
              if (!showHiddenDebugTab) {
                setActiveSection('debug_logs');
              } else if (activeSection === 'debug_logs') {
                setActiveSection('all');
              }
            }}
            className={`flex-1 sm:flex-initial justify-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition active:scale-95 shadow-sm cursor-pointer shrink-0 ${
              activeSection === 'debug_logs'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 ring-1 ring-purple-400'
                : showHiddenDebugTab || oauthDebugLogsCount > 0
                ? 'bg-[var(--panel-raised)] border-purple-500/30 text-purple-300 hover:border-purple-400'
                : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-purple-300 hover:border-purple-500/40'
            }`}
            title="Toggle Hidden Debug Logs (Google Workspace OAuth & Unknown Gmail Traces)"
          >
            <Bug size={13} className={oauthDebugLogsCount > 0 ? 'text-rose-400' : 'text-purple-400'} />
            <span>Debug Logs</span>
            {oauthDebugLogsCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-rose-500/30 text-rose-300 font-mono">
                {oauthDebugLogsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onLockTerminal}
            className="flex-1 sm:flex-initial justify-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-400 text-xs font-semibold text-[var(--text)] transition active:scale-95 shadow-sm shrink-0"
            title="Lock terminal screen immediately"
          >
            <Lock size={13} className="text-amber-400" />
            <span>Lock Terminal</span>
          </button>

          <button
            type="button"
            onClick={handleResetAllDefaults}
            className="flex-1 sm:flex-initial justify-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-400 text-xs font-semibold text-[var(--text)] transition active:scale-95 shadow-sm shrink-0"
            title="Reset all settings to default values"
          >
            <RotateCcw size={13} className="text-amber-400" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none scroll-smooth">
        {[
          { id: 'all', label: 'All Settings', icon: Sliders },
          { id: 'export_studio', label: 'PDF & JPG Export Studio', icon: FileDown, badge: 'Styles & Sizes' },
          { id: 'permissions', label: 'Mobile Device Permissions & Push', icon: Bell, badge: 'Push/Mic/Storage' },
          { id: 'sync', label: 'Backup & Cloud Sync', icon: Database, badge: 'Backup Tab' },
          { id: 'printer', label: 'Printer (Wi-Fi/Bluetooth/Wired)', icon: Printer, badge: 'Hardware' },
          { id: 'logo', label: 'Lock Screen Logo', icon: MoveHorizontal, badge: 'Move & Resize' },
          { id: 'visual_studio', label: 'Visual Studio & Themes', icon: Palette },
          { id: 'branding', label: 'Business Branding', icon: Building },
          { id: 'security', label: 'Security & PIN', icon: ShieldCheck },
          ...((showHiddenDebugTab || oauthDebugLogsCount > 0 || activeSection === 'debug_logs') ? [{
            id: 'debug_logs',
            label: 'Debug Logs (Google OAuth)',
            icon: Bug,
            badge: oauthDebugLogsCount > 0 ? `${oauthDebugLogsCount} Errors` : 'Hidden Log'
          }] : [])
        ].map(tab => {
          const Icon = tab.icon;
          const isSelected = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id === 'sync' && onNavigateToBackup) {
                  onNavigateToBackup('cloud_status');
                } else {
                  setActiveSection(tab.id as any);
                }
              }}
              className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition border cursor-pointer ${
                isSelected
                  ? 'bg-amber-400 text-black border-amber-400 font-bold shadow-md'
                  : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--steel-line)]/80'
              }`}
            >
              <Icon size={14} className={isSelected ? 'text-black' : 'text-amber-400'} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                  isSelected ? 'bg-black/20 text-black' : 'bg-amber-400/20 text-amber-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 0: MOBILE PERMISSIONS & PUSH NOTIFICATIONS ACCESS HUB */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'permissions') && (
        <MobilePermissionsCard language={language} />
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: LOCK SCREEN LOGO CONTROLS (Move, Resize to Small, Frame & Style) */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'logo') && (
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 sm:p-6 space-y-6 shadow-md">
          <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400">
                <MoveHorizontal size={18} />
              </div>
              <div>
                <h2 className="font-serif font-bold text-base sm:text-lg text-[var(--text)]">
                  Lock Screen Logo Positioning & Micro-Resizing
                </h2>
                <p className="text-[11px] text-[var(--text-dim)]">
                  Move logo placement and scale it down to small dimensions so it fits directly before the app name
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[11px] font-bold">
              Current: {logoPosition === 'inline' ? 'Inline Before Name' : 'Stacked Above Name'} • {customHeight}px
            </span>
          </div>

          {/* Interactive Live Preview Box of the Lock Screen Header */}
          <div className="p-4 sm:p-6 bg-slate-950/80 rounded-xl border border-[var(--steel-line)] flex flex-col items-center justify-center text-center">
            <div className="w-full flex items-center justify-between text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-3 px-1">
              <span>Lock Screen Live Render</span>
              <span className="text-amber-400 font-semibold">Real-time appearance</span>
            </div>

            <div className="w-full max-w-md py-4 px-4 bg-[#1C1F22] rounded-xl border border-slate-800 shadow-inner flex items-center justify-center">
              {logoPosition === 'inline' ? (
                <div className={`flex items-center ${logoAlignment === 'left' ? 'justify-start w-full' : 'justify-center'} gap-3 max-w-full`}>
                  <div
                    style={{
                      borderColor: logoFrame === 'badge' ? `${currentColor}80` : 'transparent',
                      boxShadow: logoFrame === 'badge' ? `0 4px 14px -2px ${currentColor}33` : 'none'
                    }}
                    className={`inline-flex items-center justify-center shrink-0 transition-all ${
                      logoFrame === 'badge' ? 'bg-white rounded-xl shadow-xs border p-1.5' : 'bg-transparent p-0'
                    }`}
                  >
                    <img
                      src={logoAsset}
                      alt="Falcon Preview"
                      style={{ height: `${customHeight}px`, width: 'auto' }}
                      className="max-w-[180px] object-contain select-none animate-logo-glow"
                    />
                  </div>
                  <div className="text-left flex flex-col justify-center min-w-0">
                    <h3 className="font-serif font-black text-base sm:text-lg text-slate-100 tracking-tight leading-tight truncate">
                      {companyName}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] font-mono text-amber-400 uppercase tracking-wider font-semibold truncate mt-0.5">
                      {companyTagline}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center">
                  <div
                    style={{
                      borderColor: logoFrame === 'badge' ? `${currentColor}80` : 'transparent',
                      boxShadow: logoFrame === 'badge' ? `0 10px 25px -5px ${currentColor}33` : 'none'
                    }}
                    className={`inline-flex items-center justify-center transition-all ${
                      logoFrame === 'badge' ? 'bg-white rounded-2xl shadow-lg border p-3' : 'bg-transparent p-0'
                    }`}
                  >
                    <img
                      src={logoAsset}
                      alt="Falcon Preview"
                      style={{ height: `${customHeight}px`, width: 'auto' }}
                      className="max-w-[220px] object-contain select-none animate-logo-glow"
                    />
                  </div>
                  <div style={{ height: `${Math.max(4, Math.min(14, customHeight * 0.12))}px` }} />
                  <h3 className="font-serif font-black text-base sm:text-lg text-slate-100">{companyName}</h3>
                  <p className="text-[10px] sm:text-[11px] font-mono text-amber-400 uppercase tracking-wider font-semibold mt-0.5">{companyTagline}</p>
                </div>
              )}
            </div>
          </div>

          {/* Unified Brand Logo Showcase */}
          <div className="space-y-3 pb-4 border-b border-[var(--steel-line)]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--text)] font-bold flex items-center gap-1.5">
                <span>Unified Official Brand Emblem</span>
              </label>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                ✓ Synchronized Everywhere (App, Launcher &amp; Web)
              </span>
            </div>

            <div className="p-4 rounded-xl border border-amber-500/50 bg-amber-500/10 flex flex-col sm:flex-row items-center gap-4 text-left shadow-lg">
              <div className="w-20 h-20 rounded-xl bg-slate-950 border border-amber-500/40 p-2 flex items-center justify-center shrink-0">
                <img src="/logo.svg" alt="Falcon POS Official Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">Falcon Rod Maker — Unified Master Brand Icon</span>
                  <span className="px-2 py-0.5 rounded text-[9px] bg-amber-500 text-black font-extrabold uppercase">Official</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Single source of truth (<code className="text-amber-300">/logo.svg</code> &amp; <code className="text-amber-300">/logo.png</code>) automatically generated and used across Android launcher mipmaps, web manifest, browser tab favicon, navigation headers, invoice PDF exports, and receipt printers.
                </p>
                <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-amber-400">
                  <span>Android Mipmaps: 48px to 192px</span>
                  <span>•</span>
                  <span>Web Favicon: 32px / 64px / 180px / 512px</span>
                </div>
              </div>
            </div>
          </div>

          {/* 1. Move Logo Position (Inline vs Stacked) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-1.5">
                <span>1. Move Logo Placement</span>
              </label>
              <span className="text-[11px] text-amber-400 font-medium">Position on Lock Screen</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                id="settings-btn-pos-inline"
                onClick={() => updateLogoSettings({
                  lockLogoPosition: 'inline',
                  lockLogoHeight: customHeight > 48 ? 30 : customHeight
                })}
                className={`p-3.5 rounded-xl border text-left font-mono transition flex flex-col justify-between ${
                  logoPosition === 'inline'
                    ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold shadow-xs'
                    : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text)]">
                    <MoveHorizontal size={14} className="text-amber-400" />
                    Inline Before App Name
                  </span>
                  {logoPosition === 'inline' && <Check size={14} className="text-amber-400" />}
                </div>
                <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
                  Places the resized logo horizontally on the exact same row directly before the company name.
                </p>
              </button>

              <button
                type="button"
                id="settings-btn-pos-stacked"
                onClick={() => updateLogoSettings({
                  lockLogoPosition: 'stacked',
                  lockLogoHeight: customHeight < 40 ? 76 : customHeight
                })}
                className={`p-3.5 rounded-xl border text-left font-mono transition flex flex-col justify-between ${
                  logoPosition === 'stacked'
                    ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold shadow-xs'
                    : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text)]">
                    <MoveVertical size={14} className="text-amber-400" />
                    Stacked Above App Name
                  </span>
                  {logoPosition === 'stacked' && <Check size={14} className="text-amber-400" />}
                </div>
                <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
                  Places the logo centered above the app name with dedicated clean vertical buffer spacing.
                </p>
              </button>
            </div>

            {/* Inline Alignment toggle */}
            {logoPosition === 'inline' && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs">
                <span className="text-[var(--text-dim)]">Inline Row Alignment:</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateLogoSettings({ lockLogoAlignment: 'center' })}
                    className={`px-3 py-1 rounded-lg flex items-center gap-1 transition ${
                      logoAlignment === 'center'
                        ? 'bg-amber-400 text-black font-bold'
                        : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    <AlignCenter size={12} />
                    <span>Centered</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLogoSettings({ lockLogoAlignment: 'left' })}
                    className={`px-3 py-1 rounded-lg flex items-center gap-1 transition ${
                      logoAlignment === 'left'
                        ? 'bg-amber-400 text-black font-bold'
                        : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    <AlignLeft size={12} />
                    <span>Left-Aligned</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Micro-Resizing Slider and Small Presets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">
                2. Resize Dimensions (Fine Micro-Tuning: 18px – 130px)
              </label>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => handleStepResize(-4)}
                    disabled={customHeight <= 18}
                    className="p-1 px-1.5 hover:text-amber-400 text-[var(--text-dim)] disabled:opacity-30 transition"
                    title="Scale down by 4px"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="px-2 font-bold text-amber-400 text-xs">{customHeight}px</span>
                  <button
                    type="button"
                    onClick={() => handleStepResize(4)}
                    disabled={customHeight >= 130}
                    className="p-1 px-1.5 hover:text-amber-400 text-[var(--text-dim)] disabled:opacity-30 transition"
                    title="Scale up by 4px"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>
            </div>

            {/* Slider */}
            <div className="p-3.5 bg-[var(--panel-raised)] rounded-xl border border-[var(--steel-line)] space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)]">
                <span>18px (Micro)</span>
                <span className="text-amber-400 font-semibold">Continuous Height Adjustment</span>
                <span>130px (Hero)</span>
              </div>
              <input
                type="range"
                min={18}
                max={130}
                step={2}
                value={customHeight}
                onChange={e => updateLogoSettings({ lockLogoHeight: parseInt(e.target.value, 10) })}
                className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Quick Sizing Presets */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { h: 20, label: '20px', desc: 'Micro Inline' },
                { h: 28, label: '28px', desc: 'Heading Fit' },
                { h: 38, label: '38px', desc: 'Inline Badge' },
                { h: 56, label: '56px', desc: 'Compact' },
                { h: 80, label: '80px', desc: 'Standard' },
                { h: 105, label: '105px', desc: 'Hero Crest' }
              ].map(preset => (
                <button
                  key={preset.h}
                  type="button"
                  onClick={() => updateLogoSettings({ lockLogoHeight: preset.h })}
                  className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center ${
                    customHeight === preset.h
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold shadow-xs'
                      : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  <span className="text-xs font-bold">{preset.label}</span>
                  <span className="text-[9px] text-[var(--text-dim)] mt-0.5 truncate leading-none">{preset.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Logo Frame & Style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Frame Backdrop */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">
                3. Logo Frame Backdrop
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateLogoSettings({ lockLogoFrame: 'badge' })}
                  className={`p-2.5 rounded-xl border text-left text-xs transition flex items-center justify-between ${
                    logoFrame === 'badge'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold'
                      : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-xs">Framed Badge</div>
                    <div className="text-[10px] text-[var(--text-dim)]">White backdrop & glow</div>
                  </div>
                  {logoFrame === 'badge' && <Check size={14} className="text-amber-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => updateLogoSettings({ lockLogoFrame: 'frameless' })}
                  className={`p-2.5 rounded-xl border text-left text-xs transition flex items-center justify-between ${
                    logoFrame === 'frameless'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold'
                      : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-xs">Frameless</div>
                    <div className="text-[10px] text-[var(--text-dim)]">Transparent canvas</div>
                  </div>
                  {logoFrame === 'frameless' && <Check size={14} className="text-amber-400" />}
                </button>
              </div>
            </div>

            {/* Graphics Variant */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">
                4. Logo Graphics Variant
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateLogoSettings({ lockLogoVariant: 'image' })}
                  className={`p-2.5 rounded-xl border text-left text-xs transition flex items-center justify-between ${
                    logoVariant === 'image'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold'
                      : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-xs">Downrod Photo Badge</div>
                    <div className="text-[10px] text-[var(--text-dim)]">Fan rod assembly photo</div>
                  </div>
                  {logoVariant === 'image' && <Check size={14} className="text-amber-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => updateLogoSettings({ lockLogoVariant: 'vector' })}
                  className={`p-2.5 rounded-xl border text-left text-xs transition flex items-center justify-between ${
                    logoVariant === 'vector'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold'
                      : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-xs">CAD Vector</div>
                    <div className="text-[10px] text-[var(--text-dim)]">Geometric CAD emblem</div>
                  </div>
                  {logoVariant === 'vector' && <Check size={14} className="text-amber-400" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: VISUAL STUDIO & ENVIRONMENT THEMES */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'visual_studio') && (
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 sm:p-6 space-y-6 shadow-md">
          <div className="flex items-center gap-2.5 border-b border-[var(--steel-line)] pb-3">
            <div className="p-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400">
              <Palette size={18} />
            </div>
            <div>
              <h2 className="font-serif font-bold text-base sm:text-lg text-[var(--text)]">
                Visual Studio: Themes & Workspace Environment
              </h2>
              <p className="text-[11px] text-[var(--text-dim)]">
                Customize workspace color archetypes, CAD blueprint grid, font scales, and accent glow
              </p>
            </div>
          </div>

          {/* Theme Archetypes */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">
              Workspace Environment Theme
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {themes.map(tOption => {
                const isSelected = visualSettings.theme === tOption.id;
                return (
                  <div
                    key={tOption.id}
                    onClick={() => onUpdateVisualSettings({ theme: tOption.id })}
                    style={{ backgroundColor: tOption.bg }}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between h-30 relative ${
                      isSelected
                        ? 'border-amber-400 ring-2 ring-amber-400/30 shadow-lg'
                        : 'border-[var(--steel-line)] opacity-80 hover:opacity-100 hover:border-[var(--steel-line)]/80'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-white flex items-center justify-between">
                        <span>{tOption.name}</span>
                        {isSelected && <Check size={14} className="text-amber-400" />}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1 leading-snug">{tOption.desc}</div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-2">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: tOption.border }} />
                      <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">Accent</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Falcon Official Logo & Accent Themes */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">
              Falcon Official Logo Accent & Glow Theme
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {LOGO_THEME_OPTIONS.map(lt => {
                const isSelected = activeLogoTheme === lt.id;
                return (
                  <div
                    key={lt.id}
                    onClick={() => updateLogoSettings({ logoTheme: lt.id })}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between bg-[var(--panel-raised)] hover:border-amber-400 ${
                      isSelected
                        ? 'border-amber-400 ring-2 ring-amber-400/30 font-bold text-amber-300'
                        : 'border-[var(--steel-line)] text-[var(--text)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-5 h-5 rounded-full border border-black/30 shrink-0 shadow-xs" style={{ backgroundColor: lt.color }} />
                      <div className="text-xs truncate">{lt.name}</div>
                    </div>
                    {isSelected && <Check size={14} className="text-amber-400 shrink-0 ml-1" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dedicated Blueprint Grid Overlay Toggle */}
          <div className="p-4 rounded-xl border border-[var(--steel-line)] bg-[var(--panel-raised)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className={`p-2.5 rounded-xl border transition ${
                  visualSettings.showBlueprintGrid
                    ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                    : 'bg-zinc-800/40 text-zinc-400 border-white/5'
                }`}>
                  <Grid size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-xs sm:text-sm text-[var(--text)]">
                      Blueprint Grid Overlay
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition ${
                      visualSettings.showBlueprintGrid
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'bg-zinc-800/60 text-zinc-500 border border-white/5'
                    }`}>
                      {visualSettings.showBlueprintGrid ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
                    Industrial layout measurement drafting grid on application background to visualize equipment dimensions and layout alignment accurately
                  </p>
                </div>
              </div>

              {/* Master Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={!!visualSettings.showBlueprintGrid}
                onClick={() => onUpdateVisualSettings({ showBlueprintGrid: !visualSettings.showBlueprintGrid })}
                className={`relative inline-flex h-8 w-15 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  visualSettings.showBlueprintGrid
                    ? 'bg-sky-500 shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                    : 'bg-zinc-700/60'
                }`}
              >
                <span className="sr-only">Toggle Blueprint Grid overlay</span>
                <span
                  className={`pointer-events-none inline-flex items-center justify-center h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out text-black ${
                    visualSettings.showBlueprintGrid ? 'translate-x-7 text-sky-600 font-bold' : 'translate-x-0 text-zinc-400'
                  }`}
                >
                  <Grid size={13} />
                </span>
              </button>
            </div>

            {/* Live Interactive Calibration & Visual Preview */}
            <div
              onClick={() => onUpdateVisualSettings({ showBlueprintGrid: !visualSettings.showBlueprintGrid })}
              className={`relative overflow-hidden rounded-xl border p-3 cursor-pointer transition select-none ${
                visualSettings.showBlueprintGrid
                  ? 'border-sky-500/40 bg-zinc-950/80 shadow-inner'
                  : 'border-[var(--steel-line)] bg-black/20 opacity-70 hover:opacity-90'
              }`}
            >
              {/* Dual-frequency CAD grid pattern preview dynamically scaled */}
              <div
                className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
                  visualSettings.showBlueprintGrid ? 'opacity-100 blueprint-grid-overlay' : 'opacity-20 bg-overlay-grid'
                }`}
                style={{
                  '--grid-minor': `${visualSettings.blueprintGridScale || 20}px`,
                  '--grid-major': `${(visualSettings.blueprintGridScale || 20) * 5}px`
                } as React.CSSProperties}
              />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${visualSettings.showBlueprintGrid ? 'bg-sky-400 animate-pulse' : 'bg-zinc-600'}`} />
                  <span className="font-bold text-[var(--text)]">
                    {visualSettings.showBlueprintGrid
                      ? `Active CAD Grid (${visualSettings.blueprintGridScale || 20}px Minor / ${(visualSettings.blueprintGridScale || 20) * 5}px Major)`
                      : 'Grid Disabled (Standard Solid Background)'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                  <span className="px-2 py-0.5 rounded bg-black/60 border border-white/10 flex items-center gap-1">
                    <Ruler size={11} className="text-amber-400" />
                    <span>~{(((visualSettings.blueprintGridScale || 20) * 0.264)).toFixed(1)} mm Pitch ({visualSettings.blueprintGridScale || 20}px)</span>
                  </span>
                  <span className="text-sky-400 font-bold">
                    {visualSettings.showBlueprintGrid ? 'Tap to disable' : 'Tap to enable'}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid Line Scale / Density Slider & Measurement Calibration */}
            <div className="pt-2 border-t border-[var(--steel-line)]/60 space-y-3 font-mono">
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Sliders size={13} className="text-sky-400" />
                  <span className="font-bold uppercase tracking-wider text-[var(--text)] text-[11px]">
                    Grid Line Scale & Density Calibration
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-bold">
                    {visualSettings.blueprintGridScale || 20}px / Division
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Major: {(visualSettings.blueprintGridScale || 20) * 5}px
                  </span>
                </div>
              </div>

              {/* Range Slider */}
              <div className="space-y-1">
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="1"
                  value={visualSettings.blueprintGridScale || 20}
                  onChange={e => onUpdateVisualSettings({ blueprintGridScale: parseInt(e.target.value, 10) })}
                  className="w-full h-2 rounded-lg bg-[var(--panel)] accent-sky-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[var(--text-dim)] pt-0.5">
                  <span>10px (Micro 2.5mm)</span>
                  <span className="text-amber-400 font-bold">20px (Default 5mm)</span>
                  <span>40px (10mm / 1cm)</span>
                  <span>80px (Large 20mm)</span>
                </div>
              </div>

              {/* Real-World Measurement Unit Presets */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] text-[var(--text-dim)] uppercase block font-semibold">
                  Real-World Physical Unit Presets:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10px]">
                  {[
                    { px: 10, label: 'Micro (2.5 mm)', desc: 'High-Density Lathe' },
                    { px: 20, label: '5.0 mm (Standard)', desc: 'Workshop Default' },
                    { px: 25, label: '1/4 Inch (6.35 mm)', desc: 'Imperial Fraction' },
                    { px: 38, label: '10.0 mm (1.0 cm)', desc: 'Metric Decimal' },
                    { px: 50, label: '1/2 Inch (12.7 mm)', desc: 'Heavy Rod Pitch' }
                  ].map(unit => {
                    const isSelected = (visualSettings.blueprintGridScale || 20) === unit.px;
                    return (
                      <button
                        key={unit.px}
                        type="button"
                        onClick={() => onUpdateVisualSettings({ blueprintGridScale: unit.px })}
                        className={`p-1.5 rounded-lg border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-sky-500/25 border-sky-400 text-sky-200 font-bold ring-1 ring-sky-400 shadow-xs'
                            : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white hover:border-zinc-500'
                        }`}
                      >
                        <span className="font-bold text-[11px]">{unit.label}</span>
                        <span className="text-[9px] text-zinc-400 mt-0.5">{unit.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Density & Font Scale */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            {/* Density */}
            <div className="p-3.5 rounded-xl border border-[var(--steel-line)] bg-[var(--panel-raised)] space-y-1">
              <div className="font-bold text-[var(--text)]">Data Density</div>
              <select
                value={visualSettings.density || 'comfortable'}
                onChange={e => onUpdateVisualSettings({ density: e.target.value as any })}
                className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] mt-1 focus:outline-none"
              >
                <option value="compact">Compact (High Information Density)</option>
                <option value="comfortable">Comfortable (Standard)</option>
              </select>
            </div>

            {/* Font Scale */}
            <div className="p-3.5 rounded-xl border border-[var(--steel-line)] bg-[var(--panel-raised)] space-y-1">
              <div className="font-bold text-[var(--text)]">Interface Font Scale</div>
              <select
                value={visualSettings.fontSize || 'normal'}
                onChange={e => onUpdateVisualSettings({ fontSize: e.target.value as any })}
                className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] mt-1 focus:outline-none"
              >
                <option value="small">Small (Industrial Terminal)</option>
                <option value="normal">Normal (Desktop Standard)</option>
                <option value="large">Large (High-Visibility Touch)</option>
              </select>
            </div>
          </div>

          {/* Industrial POS Haptic & Physical Confirmation */}
          <div className="p-4 rounded-xl border border-[var(--steel-line)] bg-[var(--panel-raised)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--steel-line)] pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
                  <Smartphone size={16} />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-[var(--text)]">Industrial Haptic & Physical Confirmation</div>
                  <div className="text-[11px] text-[var(--text-dim)]">
                    Tactile motor vibration and audible clicks for factory shopfloor feedback
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer bg-[var(--panel)] px-2.5 py-1 rounded-lg border border-[var(--steel-line)]">
                  <input
                    type="checkbox"
                    checked={visualSettings.hapticFeedback !== false}
                    onChange={e => onUpdateVisualSettings({ hapticFeedback: e.target.checked })}
                    className="accent-[var(--yellow)] rounded"
                  />
                  <span className="font-medium text-[var(--text)]">Vibration</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer bg-[var(--panel)] px-2.5 py-1 rounded-lg border border-[var(--steel-line)]">
                  <input
                    type="checkbox"
                    checked={visualSettings.hapticAudio !== false}
                    onChange={e => onUpdateVisualSettings({ hapticAudio: e.target.checked })}
                    className="accent-[var(--yellow)] rounded"
                  />
                  <span className="font-medium text-[var(--text)]">Tactile Audio</span>
                </label>
              </div>
            </div>

            {/* Live Haptic Interactive Test Bench */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => hapticAddToCart()}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-amber-400/50 hover:bg-amber-400/5 text-[11px] font-mono font-medium text-[var(--text)] active:scale-95 transition"
              >
                <span>🛒</span>
                <span>Test "Add to Cart"</span>
              </button>
              <button
                type="button"
                onClick={() => hapticTransactionComplete()}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-emerald-400/50 hover:bg-emerald-400/5 text-[11px] font-mono font-medium text-[var(--text)] active:scale-95 transition"
              >
                <span>💳</span>
                <span>Test "Transaction"</span>
              </button>
              <button
                type="button"
                onClick={() => hapticPullComplete()}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-cyan-400/50 hover:bg-cyan-400/5 text-[11px] font-mono font-medium text-[var(--text)] active:scale-95 transition"
              >
                <span>🔄</span>
                <span>Test "Pull Refresh"</span>
              </button>
            </div>
          </div>

          {/* Save Visual Studio Changes */}
          <div className="pt-3 border-t border-[var(--steel-line)] flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] text-[var(--text-dim)] font-mono">
              Theme, font scale, data density, and layout preferences applied to this device
            </span>
            <button
              type="button"
              onClick={handleSaveVisualSettings}
              className={`px-4 py-2 rounded-xl text-black font-mono font-bold text-xs uppercase shadow transition active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                visualSavedMsg
                  ? 'bg-emerald-500 shadow-emerald-500/20'
                  : 'bg-amber-400 hover:bg-amber-300 shadow-amber-400/20'
              }`}
            >
              {visualSavedMsg ? <Check size={14} /> : <Save size={14} />}
              <span>{visualSavedMsg ? '✓ Visual Settings Saved!' : 'Save Visual Settings'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: BUSINESS BRANDING & INVOICE HEADER */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'branding') && (
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
          <div className="flex items-center gap-2.5 border-b border-[var(--steel-line)] pb-3">
            <div className="p-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400">
              <Building size={18} />
            </div>
            <div>
              <h2 className="font-serif font-bold text-base sm:text-lg text-[var(--text)]">
                Business Identity & Invoice Headers
              </h2>
              <p className="text-[11px] text-[var(--text-dim)]">
                Official workshop credentials, headers, lock screen titles and printed receipts
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text)] uppercase tracking-wider mb-1.5">
                Company / Workshop Name
              </label>
              <input
                type="text"
                value={draftCompanyName}
                onChange={e => {
                  setDraftCompanyName(e.target.value);
                  onUpdateBranding(e.target.value, draftCompanyTagline);
                }}
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl px-3.5 py-2.5 text-sm font-bold text-[var(--text)] focus:outline-none focus:border-amber-400 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--text)] uppercase tracking-wider mb-1.5">
                Location / Specialty Tagline
              </label>
              <input
                type="text"
                value={draftCompanyTagline}
                onChange={e => {
                  setDraftCompanyTagline(e.target.value);
                  onUpdateBranding(draftCompanyName, e.target.value);
                }}
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:border-amber-400 transition"
              />
            </div>
          </div>

          {/* Save Branding Action Bar */}
          <div className="pt-3 border-t border-[var(--steel-line)] flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] text-[var(--text-dim)] font-mono">
              Official workshop title printed on receipts, exports, and lock screen
            </span>
            <button
              type="button"
              onClick={handleSaveBranding}
              className={`px-4 py-2 rounded-xl text-black font-mono font-bold text-xs uppercase shadow transition active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                brandingSavedMsg
                  ? 'bg-emerald-500 shadow-emerald-500/20'
                  : 'bg-amber-400 hover:bg-amber-300 shadow-amber-400/20'
              }`}
            >
              {brandingSavedMsg ? <Check size={14} /> : <Save size={14} />}
              <span>{brandingSavedMsg ? '✓ Workshop Details Saved!' : 'Save Workshop Branding'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: SECURITY & LOCK SCREEN PIN */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'security') && (
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
          <div className="flex items-center gap-2.5 border-b border-[var(--steel-line)] pb-3">
            <div className="p-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="font-serif font-bold text-base sm:text-lg text-[var(--text)]">
                Terminal Security & Lock Screen Credentials
              </h2>
              <p className="text-[11px] text-[var(--text-dim)]">
                Manage 4-digit terminal access PIN and owner security recovery question
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSecurity} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-[var(--text)] uppercase tracking-wider mb-1.5">
                  4-Digit Terminal PIN
                </label>
                <div className="relative">
                  <input
                    type={showPinMask ? 'text' : 'password'}
                    maxLength={4}
                    value={newPinVal}
                    onChange={e => setNewPinVal(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-widest text-[var(--text)] focus:outline-none focus:border-amber-400 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinMask(!showPinMask)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)]"
                  >
                    {showPinMask ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <span className="text-[10px] text-[var(--text-dim)] mt-1 block">Default PIN: 321</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text)] uppercase tracking-wider mb-1.5">
                  Security Recovery Answer (Q: What was your first business partner name?)
                </label>
                <input
                  type="text"
                  value={newRecoveryVal}
                  onChange={e => setNewRecoveryVal(e.target.value)}
                  placeholder="e.g. Umar"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:border-amber-400 transition"
                />
                <span className="text-[10px] text-[var(--text-dim)] mt-1 block">Used to reset PIN if forgotten</span>
              </div>
            </div>

            {/* Inactive Auto-Lock Timer Selector */}
            <div className="pt-2 border-t border-[var(--steel-line)]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="block text-[11px] font-bold text-[var(--text)] uppercase tracking-wider">
                    Terminal Inactive Auto-Lock Timer
                  </span>
                  <span className="text-[10px] text-[var(--text-dim)]">
                    Automatically locks the POS terminal screen when untouched or idle
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
                  {selectedAutolockSec === 0 ? 'Disabled' : selectedAutolockSec === 30 ? '30 Seconds' : selectedAutolockSec === 60 ? '1 Minute' : '5 Minutes'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { sec: 30, label: '30 Seconds', sub: 'High Security' },
                  { sec: 60, label: '1 Minute', sub: 'Standard' },
                  { sec: 300, label: '5 Minutes', sub: 'Busy Counter' },
                  { sec: 0, label: 'Never', sub: 'Always Awake' }
                ].map(opt => (
                  <button
                    key={opt.sec}
                    type="button"
                    onClick={() => setSelectedAutolockSec(opt.sec)}
                    className={`px-3 py-2 rounded-xl text-left border transition ${
                      selectedAutolockSec === opt.sec
                        ? "bg-amber-400/15 border-amber-400 text-amber-400 font-bold shadow-sm"
                        : "bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text)] hover:border-zinc-500"
                    }`}
                  >
                    <div className="text-xs font-mono">{opt.label}</div>
                    <div className="text-[10px] text-[var(--text-dim)]">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-semibold font-mono text-xs uppercase tracking-wider transition active:scale-95 shadow-md flex items-center gap-2"
              >
                <Check size={14} />
                <span>Save Security Credentials</span>
              </button>

              {pinSavedMsg && (
                <span className="text-xs text-emerald-400 font-mono font-bold animate-pulse">
                  ✓ Credentials saved successfully!
                </span>
              )}
            </div>
          </form>

          {/* Sub-Card: Biometric & Hardware Fingerprint Scanner */}
          <div className="mt-4 pt-4 border-t border-[var(--steel-line)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fingerprint size={16} className="text-amber-400" />
                <span className="font-bold text-xs text-[var(--text)] uppercase tracking-wider">
                  Hardware Fingerprint / Biometric Sensor
                </span>
              </div>
              <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                biometricStatus?.hasPlatformSensor
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}>
                {biometricStatus?.hasPlatformSensor ? 'Sensor Ready' : 'Hardware Standby'}
              </span>
            </div>

            <p className="text-[11px] text-[var(--text-dim)]">
              {biometricStatus?.reason || 'Hardware WebAuthn biometric standard for instant touch login without typing PIN.'}
            </p>

            {bioMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                {bioMsg}
              </div>
            )}
            {bioError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
                {bioError}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestBiometric}
                disabled={bioTesting}
                className="px-3.5 py-2 rounded-lg bg-[var(--panel-raised)] border border-amber-400/50 hover:border-amber-400 text-amber-300 font-mono text-xs font-semibold flex items-center gap-2 transition"
              >
                <Fingerprint size={14} className={bioTesting ? 'animate-bounce text-amber-400' : 'text-amber-400'} />
                <span>{bioTesting ? 'Scanning Sensor...' : 'Test / Enroll Fingerprint Now'}</span>
              </button>

              <button
                type="button"
                onClick={handleClearBiometrics}
                className="px-3.5 py-2 rounded-lg bg-white/5 border border-[var(--steel-line)] hover:border-red-400 text-[var(--text-dim)] hover:text-red-400 font-mono text-xs transition"
              >
                Reset Fingerprint Credentials
              </button>
            </div>
          </div>

          {/* Sub-Card: Connected Google Account */}
          <div className="mt-4 pt-4 border-t border-[var(--steel-line)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-sky-400" />
                <span className="font-bold text-xs text-[var(--text)] uppercase tracking-wider">
                  Connected Google Account
                </span>
              </div>
              <span className="text-[11px] font-mono text-[var(--text-dim)]">
                Owner: {currentUser?.email || 'umarzaman7777777@gmail.com'}
              </span>
            </div>

            <p className="text-[11px] text-[var(--text-dim)]">
              Enables 1-click single-sign-on or direct password recovery whenever PIN is forgotten.
            </p>

            {googleMsg && (
              <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-mono">
                {googleMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {currentUser ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 size={14} /> Signed In ({currentUser.email})
                  </span>
                  <button
                    type="button"
                    onClick={handleGoogleSignOut}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-red-400 text-xs font-mono transition"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={googleLoading}
                  onClick={handleTestGoogle}
                  className="px-3.5 py-2 rounded-lg bg-white text-gray-800 hover:bg-gray-100 font-mono text-xs font-medium flex items-center gap-2 shadow transition disabled:opacity-50"
                >
                  {googleLoading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} className="text-sky-600" />}
                  <span>Sign In with Google</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4.5: CLOUD SYNC & DATABASE TELEMETRY (HOSTED IN BACKUP TAB)       */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'sync') && (
        <div id="settings-sync-section" className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 sm:p-6 space-y-5 shadow-md font-mono">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-400/10 border border-sky-400/30 text-sky-400 shrink-0">
                <Database size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-serif font-bold text-base sm:text-lg text-[var(--text)] flex items-center gap-2 font-sans">
                    Sync Status, Cloud Telemetry & Offline Export
                  </h2>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border bg-sky-500/15 text-sky-400 border-sky-500/30 flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    Feature Hosted in Backup Tab
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-dim)] font-sans mt-0.5">
                  This feature belongs in the dedicated <strong>Backup & Cloud Sync</strong> tab. Real-time sync diagnostics, latency pings, offline JSON & SQL exports, Google Drive, and Google Sheets are all operated there.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onNavigateToBackup && (
                <button
                  type="button"
                  onClick={() => onNavigateToBackup('cloud_status')}
                  className="px-4 py-2 rounded-xl bg-[var(--yellow)] text-black font-bold uppercase text-xs hover:bg-amber-300 transition flex items-center gap-2 shadow-md cursor-pointer active:scale-95 font-sans"
                >
                  <Server size={14} />
                  <span>Open in Backup Tab</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Quick Access Portal to Backup Tab Features */}
          <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-sky-400" />
                <span className="font-bold text-xs text-[var(--text)] font-sans">
                  Available Backup & Synchronization Modules
                </span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                !isFirebaseUnreachable
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}>
                {!isFirebaseUnreachable ? '● Live Cloud Connected' : '▲ Offline Safe Mode'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => onNavigateToBackup?.('cloud_status')}
                className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] hover:border-sky-400 text-left transition group space-y-1.5 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text)] group-hover:text-sky-400 font-sans flex items-center gap-1.5">
                    <Activity size={14} className="text-sky-400" />
                    Sync Diagnostics
                  </span>
                  <ArrowRight size={12} className="text-[var(--text-dim)] group-hover:text-sky-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[10px] text-[var(--text-dim)] font-sans leading-relaxed">
                  Cloud ping test, mutation queue ({pendingQueueCount}), and latency diagnostics.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onNavigateToBackup?.('cloud_status')}
                className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] hover:border-amber-400 text-left transition group space-y-1.5 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text)] group-hover:text-amber-400 font-sans flex items-center gap-1.5">
                    <HardDrive size={14} className="text-amber-400" />
                    Offline JSON & SQL
                  </span>
                  <ArrowRight size={12} className="text-[var(--text-dim)] group-hover:text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[10px] text-[var(--text-dim)] font-sans leading-relaxed">
                  Export full JSON snapshots or relational ANSI SQL dumps ({metrics?.totalRecords || 0} records).
                </p>
              </button>

              <button
                type="button"
                onClick={() => onNavigateToBackup?.('google_drive')}
                className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] hover:border-sky-400 text-left transition group space-y-1.5 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text)] group-hover:text-sky-400 font-sans flex items-center gap-1.5">
                    <Cloud size={14} className="text-sky-400" />
                    Google Drive
                  </span>
                  <ArrowRight size={12} className="text-[var(--text-dim)] group-hover:text-sky-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[10px] text-[var(--text-dim)] font-sans leading-relaxed">
                  Isolated off-site cloud snapshots with 1-click restore into the workshop.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onNavigateToBackup?.('google_sheets')}
                className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] hover:border-emerald-400 text-left transition group space-y-1.5 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text)] group-hover:text-emerald-400 font-sans flex items-center gap-1.5">
                    <FileSpreadsheet size={14} className="text-emerald-400" />
                    Google Sheets
                  </span>
                  <ArrowRight size={12} className="text-[var(--text-dim)] group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[10px] text-[var(--text-dim)] font-sans leading-relaxed">
                  Live spreadsheet synchronization for sales, factory balances, and inventory.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: HARDWARE PRINTER CONFIGURATION (Wi-Fi, Bluetooth, Wired)       */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'printer') && (
        <div id="settings-printer-section" className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 sm:p-6 space-y-6 shadow-md">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-4 flex-wrap gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400 shrink-0">
                <Printer size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-serif font-bold text-base sm:text-lg text-[var(--text)] break-words">
                    <span>Hardware Thermal & Network Printer</span>
                  </h2>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30 shrink-0">
                    Wi-Fi · Bluetooth · Wired
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-dim)] font-mono mt-0.5 leading-relaxed">
                  Configure thermal POS receipt printing for mobile phones (side-mount biometric), workshop Wi-Fi, or desktop USB
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleRunTestPrint}
                className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 text-black font-mono font-bold text-xs uppercase shadow hover:bg-amber-300 transition active:scale-95 cursor-pointer"
                title="Send a sample ESC/POS formatted test receipt to the configured printer"
              >
                <Printer size={14} />
                <span>{testPrintSuccess ? 'Printed!' : 'Test Print Ticket'}</span>
              </button>
            </div>
          </div>

          {/* Connection Type Selection Grid */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-dim)] block">
              1. Connection Interface (Select Printer Mode)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Bluetooth Mode */}
              <button
                type="button"
                onClick={() => handleUpdatePrinter({ connectionType: 'bluetooth' })}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-3 transition cursor-pointer ${
                  printerConf.connectionType === 'bluetooth'
                    ? 'bg-sky-500/15 border-sky-400 shadow-md ring-1 ring-sky-400'
                    : 'bg-[var(--panel-raised)] border-[var(--steel-line)] hover:border-[var(--steel-line)]/80 text-[var(--text-dim)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${printerConf.connectionType === 'bluetooth' ? 'bg-sky-500 text-black' : 'bg-black/20 text-sky-400'}`}>
                    <Bluetooth size={18} />
                  </div>
                  {printerConf.connectionType === 'bluetooth' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
                  )}
                </div>
                <div>
                  <h3 className={`font-serif font-bold text-sm ${printerConf.connectionType === 'bluetooth' ? 'text-sky-300' : 'text-[var(--text)]'}`}>
                    Bluetooth Wireless
                  </h3>
                  <p className="text-[11px] text-[var(--text-dim)] mt-0.5 leading-relaxed font-mono">
                    Ideal for Android mobile phones, portable belt printers (PT-210, MPT-II, POS-58).
                  </p>
                </div>
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-sky-400 font-bold uppercase">Mobile Optimized</span>
                  <span className="text-[var(--text-dim)]">2.4 GHz RF</span>
                </div>
              </button>

              {/* Wi-Fi / LAN Mode */}
              <button
                type="button"
                onClick={() => handleUpdatePrinter({ connectionType: 'wifi' })}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-3 transition cursor-pointer ${
                  printerConf.connectionType === 'wifi'
                    ? 'bg-amber-400/15 border-amber-400 shadow-md ring-1 ring-amber-400'
                    : 'bg-[var(--panel-raised)] border-[var(--steel-line)] hover:border-[var(--steel-line)]/80 text-[var(--text-dim)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${printerConf.connectionType === 'wifi' ? 'bg-amber-400 text-black' : 'bg-black/20 text-amber-400'}`}>
                    <Wifi size={18} />
                  </div>
                  {printerConf.connectionType === 'wifi' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </div>
                <div>
                  <h3 className={`font-serif font-bold text-sm ${printerConf.connectionType === 'wifi' ? 'text-amber-300' : 'text-[var(--text)]'}`}>
                    Wi-Fi Network / LAN
                  </h3>
                  <p className="text-[11px] text-[var(--text-dim)] mt-0.5 leading-relaxed font-mono">
                    Direct socket IP printing across your local factory wireless router & LAN network.
                  </p>
                </div>
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-amber-400 font-bold uppercase">Socket TCP/IP</span>
                  <span className="text-[var(--text-dim)]">Port 9100</span>
                </div>
              </button>

              {/* Wired USB / Spooler Mode */}
              <button
                type="button"
                onClick={() => handleUpdatePrinter({ connectionType: 'wired' })}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-3 transition cursor-pointer ${
                  printerConf.connectionType === 'wired'
                    ? 'bg-emerald-500/15 border-emerald-400 shadow-md ring-1 ring-emerald-400'
                    : 'bg-[var(--panel-raised)] border-[var(--steel-line)] hover:border-[var(--steel-line)]/80 text-[var(--text-dim)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${printerConf.connectionType === 'wired' ? 'bg-emerald-500 text-black' : 'bg-black/20 text-emerald-400'}`}>
                    <Usb size={18} />
                  </div>
                  {printerConf.connectionType === 'wired' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </div>
                <div>
                  <h3 className={`font-serif font-bold text-sm ${printerConf.connectionType === 'wired' ? 'text-emerald-300' : 'text-[var(--text)]'}`}>
                    Wired USB / Cable
                  </h3>
                  <p className="text-[11px] text-[var(--text-dim)] mt-0.5 leading-relaxed font-mono">
                    Direct physical USB cable, OTG adapter, or Windows/Linux ESC/POS print driver.
                  </p>
                </div>
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-emerald-400 font-bold uppercase">Direct Spooler</span>
                  <span className="text-[var(--text-dim)]">USB001 / COM</span>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Detail Panels based on Connection Mode */}
          {printerConf.connectionType === 'bluetooth' && (
            <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-500/30 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Bluetooth size={16} className="text-sky-400" />
                  <span className="font-bold text-xs text-sky-200 uppercase tracking-wide">
                    Bluetooth Device Configuration
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isScanningBt}
                  onClick={handleScanBluetooth}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-400 text-sky-300 hover:bg-sky-500 hover:text-black font-mono font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isScanningBt ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  <span>{isScanningBt ? 'Scanning Nearby Devices...' : 'Scan & Pair Bluetooth'}</span>
                </button>
              </div>

              {btScanMsg && (
                <div className={`p-2.5 rounded-lg text-xs font-mono border ${
                  btScanMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                  {btScanMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] text-[var(--text-dim)] block mb-1">
                    Bluetooth Device Name
                  </label>
                  <input
                    type="text"
                    value={printerConf.bluetoothDeviceName || ''}
                    onChange={e => handleUpdatePrinter({ bluetoothDeviceName: e.target.value })}
                    placeholder="e.g. PT-210 Mobile Bluetooth Printer"
                    className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-3 py-1.5 text-xs text-[var(--text)] font-mono focus:border-sky-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--text-dim)] block mb-1">
                    Device Identifier / MAC
                  </label>
                  <input
                    type="text"
                    value={printerConf.bluetoothDeviceId || ''}
                    onChange={e => handleUpdatePrinter({ bluetoothDeviceId: e.target.value })}
                    placeholder="e.g. BT-THERMAL-5801 or Mobile Paired ID"
                    className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-3 py-1.5 text-xs text-[var(--text)] font-mono focus:border-sky-400 focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-[10px] text-sky-300/80 font-mono">
                Tip: If your mobile phone has a side-mount biometric sensor, pair your printer once in Android Bluetooth settings; Falcon Rod Maker will automatically route thermal print jobs via the OS print spooler.
              </p>
            </div>
          )}

          {printerConf.connectionType === 'wifi' && (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2">
                <Wifi size={16} className="text-amber-400" />
                <span className="font-bold text-xs text-amber-200 uppercase tracking-wide">
                  Wi-Fi TCP/IP Network Settings
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[var(--text-dim)] block mb-1">
                    Printer IP Address (Static recommended)
                  </label>
                  <input
                    type="text"
                    value={printerConf.wifiIpAddress || ''}
                    onChange={e => handleUpdatePrinter({ wifiIpAddress: e.target.value })}
                    placeholder="192.168.1.100"
                    className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-3 py-1.5 text-xs text-[var(--text)] font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--text-dim)] block mb-1">
                    Socket Port (Default 9100 for ESC/POS)
                  </label>
                  <input
                    type="number"
                    value={printerConf.wifiPort || 9100}
                    onChange={e => handleUpdatePrinter({ wifiPort: parseInt(e.target.value, 10) || 9100 })}
                    placeholder="9100"
                    className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-3 py-1.5 text-xs text-[var(--text)] font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-[10px] text-amber-300/80 font-mono">
                Connect the thermal printer to your shop/factory Wi-Fi network. Standard ESC/POS printers listen on raw port 9100.
              </p>
            </div>
          )}

          {printerConf.connectionType === 'wired' && (
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
              <div className="flex items-center gap-2">
                <Usb size={16} className="text-emerald-400" />
                <span className="font-bold text-xs text-emerald-200 uppercase tracking-wide">
                  Wired USB / Driver Spooler Configuration
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[var(--text-dim)] block mb-1">
                    Port / Spooler Name
                  </label>
                  <select
                    value={printerConf.wiredPortName || 'USB001 / Direct ESC/POS Driver'}
                    onChange={e => handleUpdatePrinter({ wiredPortName: e.target.value })}
                    className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-3 py-1.5 text-xs text-[var(--text)] font-mono focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="USB001 / Direct ESC/POS Driver">USB001 / Direct ESC/POS Driver</option>
                    <option value="USB002 / Secondary Thermal Port">USB002 / Secondary Thermal Port</option>
                    <option value="COM1 / Serial POS">COM1 / Serial POS</option>
                    <option value="COM2 / Serial POS">COM2 / Serial POS</option>
                    <option value="System Default Print Spooler">System Default Print Spooler</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-[var(--text-dim)] block mb-1">
                    Hardware Model Name
                  </label>
                  <input
                    type="text"
                    value={printerConf.printerName || ''}
                    onChange={e => handleUpdatePrinter({ printerName: e.target.value })}
                    placeholder="e.g. Xprinter 80mm / Epson TM-T20"
                    className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-3 py-1.5 text-xs text-[var(--text)] font-mono focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Paper Size & Roll Width */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-dim)] block">
                2. Paper Size, Orientation & Document Setup
              </label>
              <button
                type="button"
                onClick={() => setIsAdvancedPageSetupOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--yellow)]/15 border border-[var(--yellow)] text-[var(--yellow)] text-xs font-bold hover:bg-[var(--yellow)] hover:text-black transition cursor-pointer"
              >
                <Sliders size={13} />
                <span>Open Advanced Visual Page Setup</span>
              </button>
            </div>

            {/* Paper Sizes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {Object.values(PAPER_SIZE_SPECS).map(paper => {
                const isSelected = printerConf.paperSize === paper.id;
                return (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => handleUpdatePrinter({ paperSize: paper.id })}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1.5 transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400/15 border-amber-400 shadow-md ring-1 ring-amber-400'
                        : 'bg-[var(--panel-raised)] border-[var(--steel-line)] hover:border-[var(--steel-line)]/80 text-[var(--text-dim)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded ${
                        isSelected ? 'bg-amber-400 text-black' : 'bg-black/20 text-[var(--text-dim)]'
                      }`}>
                        {paper.category.toUpperCase()}
                      </span>
                      {isSelected && <Check size={14} className="text-amber-400" />}
                    </div>
                    <div>
                      <h4 className={`font-serif font-bold text-xs ${isSelected ? 'text-amber-300' : 'text-[var(--text)]'}`}>
                        {paper.name}
                      </h4>
                      <p className="text-[10px] text-[var(--text-dim)] mt-0.5 leading-relaxed font-mono">
                        {paper.dimensions}
                      </p>
                    </div>
                    <div className="text-[9px] text-[var(--text-dim)] italic border-t border-[var(--steel-line)]/40 pt-1 line-clamp-1">
                      {paper.description}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Orientation & Margins Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Orientation */}
              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
                <span className="text-xs font-bold text-[var(--text)] block">
                  Page Orientation
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdatePrinter({ orientation: 'portrait' })}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2.5 transition cursor-pointer text-xs font-bold ${
                      (printerConf.orientation || 'portrait') === 'portrait'
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                        : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                    }`}
                  >
                    <div className="w-4 h-6 border-2 border-current rounded-xs shrink-0" />
                    <div>
                      <div>Portrait</div>
                      <div className="text-[9.5px] opacity-75 font-normal">Vertical (عمودی)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdatePrinter({ orientation: 'landscape' })}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2.5 transition cursor-pointer text-xs font-bold ${
                      printerConf.orientation === 'landscape'
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                        : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                    }`}
                  >
                    <div className="w-6 h-4 border-2 border-current rounded-xs shrink-0" />
                    <div>
                      <div>Landscape</div>
                      <div className="text-[9.5px] opacity-75 font-normal">Horizontal (افقی)</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Margins */}
              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
                <span className="text-xs font-bold text-[var(--text)] block">
                  Print Margins
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['none', 'compact', 'normal', 'wide'] as const).map(marginKey => {
                    const isSelected = (printerConf.margins || 'normal') === marginKey;
                    const spec = MARGIN_SPECS[marginKey];
                    return (
                      <button
                        key={marginKey}
                        type="button"
                        onClick={() => handleUpdatePrinter({ margins: marginKey })}
                        className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold'
                            : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                        }`}
                      >
                        <div className="text-[11px] capitalize">{marginKey}</div>
                        <div className="text-[9px] opacity-75 font-mono">{spec.css}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Scaling & Color Mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Scale */}
              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[var(--text)]">Print Scale & Page Fit</span>
                  <span className="text-amber-400 font-mono font-bold">{printerConf.scale || 100}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={70}
                    max={130}
                    step={5}
                    value={printerConf.scale || 100}
                    onChange={e => handleUpdatePrinter({ scale: parseInt(e.target.value, 10) })}
                    className="w-full accent-amber-400 h-1.5 bg-black/40 rounded-lg cursor-pointer"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    {[80, 100, 110].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleUpdatePrinter({ scale: val })}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                          (printerConf.scale || 100) === val
                            ? 'bg-amber-400 text-black font-bold'
                            : 'bg-[var(--panel)] text-[var(--text-dim)]'
                        }`}
                      >
                        {val}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Color Mode */}
              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-2">
                <span className="text-xs font-bold text-[var(--text)] block">
                  Document Color Palette
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdatePrinter({ colorMode: 'color' })}
                    className={`p-2 rounded-lg border text-center transition cursor-pointer text-xs font-bold ${
                      (printerConf.colorMode || 'color') !== 'monochrome'
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                        : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                    }`}
                  >
                    🎨 Full Color
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdatePrinter({ colorMode: 'monochrome' })}
                    className={`p-2 rounded-lg border text-center transition cursor-pointer text-xs font-bold ${
                      printerConf.colorMode === 'monochrome'
                        ? 'bg-slate-300/20 border-slate-300 text-slate-100'
                        : 'bg-[var(--panel)] border-[var(--steel-line)] text-[var(--text-dim)]'
                    }`}
                  >
                    ⬛ Monochrome (Eco)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Ticket Preferences & Options */}
          <div className="space-y-4 pt-2 border-t border-[var(--steel-line)]/60">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-dim)] block">
              3. Receipt Content & Automation Options
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Logo in Header */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] cursor-pointer">
                <span className="text-xs text-[var(--text)]">Print Falcon Logo on Ticket Header</span>
                <input
                  type="checkbox"
                  checked={printerConf.includeLogo ?? true}
                  onChange={e => handleUpdatePrinter({ includeLogo: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                />
              </label>

              {/* Urdu Amount in Words */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] cursor-pointer">
                <span className="text-xs text-[var(--text)]">Include Urdu Amount Words (روپے)</span>
                <input
                  type="checkbox"
                  checked={printerConf.includeUrduAmount ?? true}
                  onChange={e => handleUpdatePrinter({ includeUrduAmount: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                />
              </label>

              {/* Auto Print on Sale Confirmation */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] cursor-pointer">
                <span className="text-xs text-[var(--text)]">Auto-Print Receipt when Order is Confirmed</span>
                <input
                  type="checkbox"
                  checked={printerConf.autoPrintOnSale ?? false}
                  onChange={e => handleUpdatePrinter({ autoPrintOnSale: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                />
              </label>

              {/* Number of Copies */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                <span className="text-xs text-[var(--text)]">Number of Print Copies</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleUpdatePrinter({ printCopies: n })}
                      className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition ${
                        (printerConf.printCopies || 1) === n
                          ? 'bg-amber-400 text-black shadow'
                          : 'bg-black/20 text-[var(--text-dim)] hover:text-[var(--text)]'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Footer Note */}
            <div>
              <label className="text-[11px] text-[var(--text-dim)] block mb-1">
                Receipt Footer Greeting Note
              </label>
              <input
                type="text"
                value={printerConf.footerNote || ''}
                onChange={e => handleUpdatePrinter({ footerNote: e.target.value })}
                placeholder="Shukriya! Falcon Rod Maker · Gujrat Industrial Zone"
                className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] font-mono focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Status Bar */}
          <div className="pt-3 border-t border-[var(--steel-line)] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-mono text-[var(--text)]">
                Active Printer: <strong className="text-amber-400 uppercase">{printerConf.connectionType}</strong> ({printerConf.paperSize})
              </span>
              {printerSavedMsg && (
                <span className="text-xs font-mono text-emerald-400 font-semibold flex items-center gap-1 ml-2">
                  <CheckCircle2 size={13} /> Saved
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSavePrinterSettings}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-black font-mono font-bold text-xs uppercase shadow transition active:scale-95 cursor-pointer ${
                  printerSavedMsg
                    ? 'bg-emerald-500 shadow-emerald-500/20'
                    : 'bg-emerald-400 hover:bg-emerald-300 shadow-emerald-400/20'
                }`}
              >
                {printerSavedMsg ? <Check size={14} /> : <Save size={14} />}
                <span>{printerSavedMsg ? '✓ Printer Saved!' : 'Save Printer Settings'}</span>
              </button>

              <button
                type="button"
                onClick={handleRunTestPrint}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 text-black font-mono font-bold text-xs uppercase shadow hover:bg-amber-300 transition active:scale-95 cursor-pointer"
              >
                <Printer size={14} />
                <span>{testPrintSuccess ? 'Printed Successfully!' : 'Trigger Test Print'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 6: DOCUMENT EXPORT STUDIO (PDF & JPG Styles, Themes & Sizes)      */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'export_studio') && (
        <div id="settings-export-studio-section" className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 sm:p-6 space-y-6 shadow-md">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400">
                <FileDown size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif font-bold text-lg text-[var(--text)]">
                    Document Export Studio · PDF & JPG
                  </h2>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-semibold border border-amber-400/30">
                    Global System Styling
                  </span>
                </div>
                <p className="text-xs text-[var(--text-dim)]">
                  Configure default header colors, typography, styles, paper sizes, and orientations for all PDF & JPG exports
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLaunchExportStudioPreview}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs transition shadow-md active:scale-95"
              title="Open full interactive live export preview & customizer"
            >
              <FileDown size={15} />
              <span>Launch Live Export Studio</span>
            </button>
          </div>

          {/* Quick Theme Presets */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-2">
              Default Color Theme Preset
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {EXPORT_THEME_PRESETS.map(preset => {
                const isSelected = exportConf.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      handleUpdateExportConfig({
                        presetId: preset.id,
                        headerBgColor: preset.headerBgColor,
                        headerTextColor: preset.headerTextColor,
                        headerSubtitleColor: preset.headerSubtitleColor,
                        tableHeaderBgColor: preset.tableHeaderBgColor,
                        tableHeaderTextColor: preset.tableHeaderTextColor,
                        accentColor: preset.accentColor
                      })
                    }
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400/10 ring-1 ring-amber-400/40'
                        : 'border-[var(--steel-line)] bg-[var(--panel-raised)] hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-xs text-[var(--text)] truncate">
                        {preset.name}
                      </span>
                      {isSelected && <Check size={12} className="text-amber-400 flex-shrink-0" />}
                    </div>
                    {/* Swatch Bar */}
                    <div className="flex h-3 w-full rounded overflow-hidden border border-black/20">
                      <div className="w-1/3" style={{ backgroundColor: preset.headerBgColor }} />
                      <div className="w-1/3" style={{ backgroundColor: preset.headerTextColor }} />
                      <div className="w-1/3" style={{ backgroundColor: preset.tableHeaderBgColor }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Layout & Typography Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Paper Size & Orientation */}
            <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] block">
                Default Page Geometry & Orientation
              </span>

              {/* Orientation */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateExportConfig({ orientation: 'portrait' })}
                  className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition ${
                    exportConf.orientation === 'portrait'
                      ? 'border-amber-400 bg-amber-400/15 text-[var(--text)]'
                      : 'border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  📄 Portrait (عمودی)
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateExportConfig({ orientation: 'landscape' })}
                  className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition ${
                    exportConf.orientation === 'landscape'
                      ? 'border-amber-400 bg-amber-400/15 text-[var(--text)]'
                      : 'border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  📑 Landscape (افقی)
                </button>
              </div>

              {/* Paper Sizes */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 pt-1">
                {(
                  [
                    { id: 'a4', name: 'A4' },
                    { id: 'letter', name: 'Letter' },
                    { id: 'legal', name: 'Legal' },
                    { id: 'a5', name: 'A5' },
                    { id: 'b5', name: 'B5' },
                    { id: '80mm', name: '80mm Roll' },
                    { id: '58mm', name: '58mm Slip' }
                  ] as const
                ).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleUpdateExportConfig({ paperSize: p.id })}
                    className={`py-1.5 px-2 rounded-lg text-xs font-mono text-center border transition ${
                      exportConf.paperSize === p.id
                        ? 'border-amber-400 bg-amber-400/20 text-[var(--text)] font-bold'
                        : 'border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] block">
                Default Typography & Font Family
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateExportConfig({ fontFamily: 'helvetica' })}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    exportConf.fontFamily === 'helvetica'
                      ? 'border-amber-400 bg-amber-400/15 text-[var(--text)]'
                      : 'border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  <div className="font-sans font-bold text-xs">Modern Sans</div>
                  <div className="text-[10px] text-[var(--text-dim)]">Helvetica / Clean</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateExportConfig({ fontFamily: 'times' })}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    exportConf.fontFamily === 'times'
                      ? 'border-amber-400 bg-amber-400/15 text-[var(--text)]'
                      : 'border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  <div className="font-serif font-bold text-xs">Classic Serif</div>
                  <div className="text-[10px] text-[var(--text-dim)]">Times / Audit</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateExportConfig({ fontFamily: 'courier' })}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    exportConf.fontFamily === 'courier'
                      ? 'border-amber-400 bg-amber-400/15 text-[var(--text)]'
                      : 'border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  <div className="font-mono font-bold text-xs">Technical Mono</div>
                  <div className="text-[10px] text-[var(--text-dim)]">Courier / CAD</div>
                </button>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConf.showLogo}
                    onChange={e => handleUpdateExportConfig({ showLogo: e.target.checked })}
                    className="rounded accent-amber-400"
                  />
                  <span className="text-[var(--text)]">Include Falcon Logo</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConf.showStripedRows}
                    onChange={e => handleUpdateExportConfig({ showStripedRows: e.target.checked })}
                    className="rounded accent-amber-400"
                  />
                  <span className="text-[var(--text)]">Alternating Zebra Rows</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConf.showSignatureLine}
                    onChange={e => handleUpdateExportConfig({ showSignatureLine: e.target.checked })}
                    className="rounded accent-amber-400"
                  />
                  <span className="text-[var(--text)]">Signature & Stamp Line</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConf.showAccentBar}
                    onChange={e => handleUpdateExportConfig({ showAccentBar: e.target.checked })}
                    className="rounded accent-amber-400"
                  />
                  <span className="text-[var(--text)]">Hazard / Accent Top Bar</span>
                </label>
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <div className="pt-3 border-t border-[var(--steel-line)] flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-[var(--text)]">
                Active Theme: <strong className="text-amber-400 capitalize">{exportConf.presetId}</strong> ({exportConf.paperSize.toUpperCase()} · {exportConf.orientation})
              </span>
              {exportSavedMsg && (
                <span className="text-emerald-400 font-semibold flex items-center gap-1 ml-2">
                  <CheckCircle2 size={13} /> Saved
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  saveExportConfig(exportConf);
                  triggerHaptic('success');
                  setExportSavedMsg(true);
                  setTimeout(() => setExportSavedMsg(false), 3000);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-black font-mono font-bold text-xs uppercase shadow transition active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                  exportSavedMsg
                    ? 'bg-emerald-500 shadow-emerald-500/20'
                    : 'bg-amber-400 hover:bg-amber-300 shadow-amber-400/20'
                }`}
              >
                {exportSavedMsg ? <Check size={13} /> : <Save size={13} />}
                <span>{exportSavedMsg ? '✓ Style Saved!' : 'Save Style Settings'}</span>
              </button>

              <button
                type="button"
                onClick={handleLaunchExportStudioPreview}
                className="text-xs text-[var(--yellow)] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <span>Live Preview</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 7: HIDDEN DEBUG LOGS (GOOGLE WORKSPACE OAUTH & GMAIL TRACES)       */}
      {/* ========================================================================= */}
      {(activeSection === 'debug_logs' || (activeSection === 'all' && (showHiddenDebugTab || oauthDebugLogsCount > 0))) && (
        <div id="settings-debug-logs-section">
          <OAuthDebugLogsSection
            language={language}
            onNavigateToBackup={onNavigateToBackup}
          />
        </div>
      )}

      {/* Sticky Floating Bottom Bar: Save & Implement All Settings */}
      <div className="sticky bottom-4 z-40 bg-slate-950/95 backdrop-blur-xl border border-amber-500/40 rounded-2xl p-3.5 sm:p-4 shadow-2xl shadow-black/80 flex items-center justify-between gap-4 flex-wrap animate-in fade-in slide-in-from-bottom-3 duration-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Settings size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">
                Terminal Settings & Configuration
              </span>
              {allSettingsSavedMsg && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                  ✓ Saved to Device & Database
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 font-mono">
              Permanently save and implement all edits across workshop branding, security, themes & printer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleResetAllDefaults}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-xs text-slate-300 font-semibold transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            title="Reset all settings to default values"
          >
            <RotateCcw size={13} />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAllSettings}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
              allSettingsSavedMsg
                ? 'bg-emerald-500 text-black shadow-emerald-500/30'
                : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black shadow-amber-500/30'
            }`}
          >
            {allSettingsSavedMsg ? <Check size={16} /> : <Save size={16} />}
            <span>{allSettingsSavedMsg ? '✓ All Settings Saved!' : 'Save & Implement All'}</span>
          </button>
        </div>
      </div>

      {/* Advanced Visual Print Page Setup Modal */}
      <PrintPageSetupModal
        isOpen={isAdvancedPageSetupOpen}
        onClose={() => setIsAdvancedPageSetupOpen(false)}
        onSaved={saved => {
          handleUpdatePrinter({
            paperSize: saved.paperSize,
            orientation: saved.orientation,
            margins: saved.margins,
            scale: saved.scale,
            colorMode: saved.colorMode
          });
        }}
        language={language}
      />
    </div>
  );
};
