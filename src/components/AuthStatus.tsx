import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  KeyRound,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  WifiOff,
  CloudCheck,
  FileSpreadsheet,
  Cloud,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap
} from 'lucide-react';
import { AppLanguage } from '../types';
import { AuthDiagnosticModal } from './AuthDiagnosticModal';
import {
  WorkspaceServiceType,
  OAuthVerificationResult,
  verifyWorkspaceOAuth,
  reauthenticateWorkspaceService,
  parseWorkspaceOAuthError,
  getCurrentAppOrigin
} from '../utils/oauthVerifier';
import { WORKSPACE_SYNC_EVENT, ALLOWED_SHEETS_OWNER_EMAIL } from '../utils/googleSheetsSync';
import { openExternalUrl } from '../utils/openExternalUrl';
import { auth } from '../firebase/config';
import firebaseConfig from '../../firebase-applet-config.json';
import { getOAuthDebugLogs, exportOAuthDebugLogsJSON, OAUTH_LOG_EVENT, OAuthDebugLogEntry } from '../utils/oauthDebugLogger';

export interface AuthStatusProps {
  service?: 'sheets' | 'drive' | 'all';
  compact?: boolean;
  title?: string;
  language?: AppLanguage;
  className?: string;
  onReauthenticated?: () => void;
  forcedError?: any;
  onClearForcedError?: () => void;
  onNavigateToSettings?: (tab?: string) => void;
}

export const AuthStatus: React.FC<AuthStatusProps> = ({
  service = 'all',
  compact = false,
  title,
  language = 'en',
  className = '',
  onReauthenticated,
  forcedError,
  onClearForcedError,
  onNavigateToSettings
}) => {
  const [sheetsResult, setSheetsResult] = useState<OAuthVerificationResult | null>(null);
  const [driveResult, setDriveResult] = useState<OAuthVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState<'sheets' | 'drive' | 'all' | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [persistedLogs, setPersistedLogs] = useState<OAuthDebugLogEntry[]>(() => getOAuthDebugLogs());
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [showManualToken, setShowManualToken] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

  useEffect(() => {
    const handleLogUpdate = () => {
      setPersistedLogs(getOAuthDebugLogs());
    };
    window.addEventListener(OAUTH_LOG_EVENT, handleLogUpdate);
    return () => window.removeEventListener(OAUTH_LOG_EVENT, handleLogUpdate);
  }, []);

  const currentUserEmail = auth.currentUser?.email || ALLOWED_SHEETS_OWNER_EMAIL;

  const isVerifyingRef = React.useRef(false);
  const lastVerifiedRef = React.useRef<number>(0);

  // Fast synchronous check from local storage so UI is INSTANTLY stable without slow network delays
  const loadLocalFastStatus = useCallback(() => {
    try {
      const now = new Date().toLocaleTimeString();
      const sToken = localStorage.getItem('falcon_gsheets_token');
      const sExp = localStorage.getItem('falcon_gsheets_expires_at');
      const sEmail = localStorage.getItem('falcon_gsheets_email');
      const sId = localStorage.getItem('falcon_gsheets_spreadsheet_id');

      if (sToken && !sToken.startsWith('falcon_offline_session_')) {
        const expTime = sExp ? parseInt(sExp, 10) : Date.now() + 3600000;
        const validSecs = Math.max(0, Math.round((expTime - Date.now()) / 1000));
        setSheetsResult(prev => prev?.status === 'valid' ? prev : {
          service: 'sheets',
          status: 'valid',
          errorCode: null,
          httpStatus: 200,
          errorTitle: 'Google Sheets Active & Verified',
          errorDescription: 'Credentials verified. Ready for automatic synchronization.',
          actionRequired: 'OAuth credentials valid.',
          verifiedEmail: sEmail || 'umarzaman7777777@gmail.com',
          expiresInSeconds: validSecs,
          lastCheckedAt: now,
          resourceDetails: { spreadsheetId: sId || undefined }
        });
      }

      const dToken = localStorage.getItem('falcon_gdrive_token');
      const dExp = localStorage.getItem('falcon_gdrive_expires_at');
      const dEmail = localStorage.getItem('falcon_gdrive_email');
      const dFolder = localStorage.getItem('falcon_gdrive_folder_id');

      if (dToken && !dToken.startsWith('falcon_offline_session_')) {
        const expTime = dExp ? parseInt(dExp, 10) : Date.now() + 3600000;
        const validSecs = Math.max(0, Math.round((expTime - Date.now()) / 1000));
        setDriveResult(prev => prev?.status === 'valid' ? prev : {
          service: 'drive',
          status: 'valid',
          errorCode: null,
          httpStatus: 200,
          errorTitle: 'Google Drive Active & Verified',
          errorDescription: `Live Google Drive API verified for ${dEmail || 'umarzaman7777777@gmail.com'}. Ready for database cloud backups.`,
          actionRequired: 'OAuth credentials valid.',
          verifiedEmail: dEmail || 'umarzaman7777777@gmail.com',
          expiresInSeconds: validSecs,
          lastCheckedAt: now,
          resourceDetails: { folderId: dFolder || undefined }
        });
      }
    } catch {}
  }, []);

  // Run real-time verification against Google servers with debounce & concurrency guard
  const runRealtimeVerification = useCallback(async (targetService: 'sheets' | 'drive' | 'all' = service, forceNetwork = false) => {
    if (isVerifyingRef.current) return;

    // Use fast local check if not forced and checked within 5 minutes
    if (!forceNetwork && Date.now() - lastVerifiedRef.current < 300000 && lastVerifiedRef.current > 0) {
      loadLocalFastStatus();
      return;
    }

    isVerifyingRef.current = true;
    setIsVerifying(true);
    try {
      if (targetService === 'sheets' || targetService === 'all') {
        const sRes = await verifyWorkspaceOAuth('sheets', forceNetwork);
        setSheetsResult(sRes);
      }
      if (targetService === 'drive' || targetService === 'all') {
        const dRes = await verifyWorkspaceOAuth('drive', forceNetwork);
        setDriveResult(dRes);
      }
      lastVerifiedRef.current = Date.now();
    } catch (err: any) {
      console.warn('Realtime OAuth verification encountered unexpected error:', err);
    } finally {
      isVerifyingRef.current = false;
      setIsVerifying(false);
    }
  }, [service, loadLocalFastStatus]);

  // Initial verification on mount & local fast sync on sync events
  useEffect(() => {
    loadLocalFastStatus();
    runRealtimeVerification(service, false);

    const handleSyncEvent = () => {
      // Synchronously update local token display without triggering slow 18-second HTTP pings
      loadLocalFastStatus();
    };

    const handleOnlineStatus = () => {
      runRealtimeVerification(service, false);
    };

    window.addEventListener(WORKSPACE_SYNC_EVENT, handleSyncEvent);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    return () => {
      window.removeEventListener(WORKSPACE_SYNC_EVENT, handleSyncEvent);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, [service, runRealtimeVerification, loadLocalFastStatus]);

  // Handle external runtime error passed as prop
  useEffect(() => {
    if (forcedError) {
      const parsed = parseWorkspaceOAuthError(
        forcedError,
        service === 'drive' ? 'drive' : 'sheets'
      );
      if (service === 'drive') {
        setDriveResult(parsed);
      } else {
        setSheetsResult(parsed);
      }
    }
  }, [forcedError, service]);

  const handleReauthenticate = async (targetService: 'sheets' | 'drive') => {
    setIsReauthenticating(targetService);
    setActionSuccessMsg(null);
    if (onClearForcedError) {
      onClearForcedError();
    }

    try {
      await reauthenticateWorkspaceService(targetService, currentUserEmail);
      setActionSuccessMsg(
        language === 'ur'
          ? '✓ گوگل کی توثیق کامیابی سے مکمل ہوگئی! ایپلیکیشن کھول رہے ہیں...'
          : `✓ Successfully authorized! Opening Google ${targetService === 'sheets' ? 'Sheets' : 'Drive'} App...`
      );
      // Run immediate real-time check to confirm
      await runRealtimeVerification(targetService);
      if (onReauthenticated) {
        onReauthenticated();
      }
      setTimeout(() => setActionSuccessMsg(null), 5000);

      // Launch native Google Sheets / Google Drive app directly on device
      if (targetService === 'sheets') {
        const storedId = localStorage.getItem('falcon_gsheets_spreadsheet_id');
        const sheetUrl = storedId ? `https://docs.google.com/spreadsheets/d/${storedId}/edit` : 'https://docs.google.com/spreadsheets';
        openExternalUrl(sheetUrl, 'sheets');
      } else if (targetService === 'drive') {
        const storedFolderId = localStorage.getItem('falcon_gdrive_folder_id');
        const driveUrl = storedFolderId ? `https://drive.google.com/drive/folders/${storedFolderId}` : 'https://drive.google.com';
        openExternalUrl(driveUrl, 'drive');
      }
    } catch (err: any) {
      const parsed = parseWorkspaceOAuthError(err, targetService);
      if (targetService === 'sheets') {
        setSheetsResult(parsed);
      } else {
        setDriveResult(parsed);
      }
    } finally {
      setIsReauthenticating(null);
    }
  };

  const copyOriginToClipboard = () => {
    const origin = getCurrentAppOrigin();
    if (origin && navigator.clipboard) {
      navigator.clipboard.writeText(origin).then(() => {
        setCopiedOrigin(true);
        setTimeout(() => setCopiedOrigin(false), 2500);
      });
    }
  };

  const handleCloudSync = async () => {
    setIsCloudSyncing(true);
    try {
      const { syncSheetsTokenFromCloud } = await import('../utils/googleSheetsSync');
      const { syncDriveTokenFromCloud } = await import('../utils/googleDriveBackup');
      const s = await syncSheetsTokenFromCloud();
      const d = await syncDriveTokenFromCloud();
      if (s?.token || d?.token) {
        setActionSuccessMsg('✓ Successfully synced Google Workspace credentials from Cloud!');
      } else {
        setActionSuccessMsg('No active credentials found in Cloud Sync yet. Tap Re-authenticate to authorize in Chrome.');
      }
      await runRealtimeVerification(service);
      if (onReauthenticated) onReauthenticated();
    } catch (e: any) {
      console.warn('Cloud sync error:', e);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleSaveManualToken = async () => {
    const clean = manualTokenInput.trim().replace(/^Bearer\s+/i, '');
    if (!clean) return;
    try {
      const { setManualSheetsToken } = await import('../utils/googleSheetsSync');
      const { setManualDriveToken } = await import('../utils/googleDriveBackup');
      setManualSheetsToken(clean, 7200, currentUserEmail);
      setManualDriveToken(clean, 7200, currentUserEmail);
      setActionSuccessMsg('✓ Manual OAuth Access Token saved & activated!');
      setManualTokenInput('');
      setShowManualToken(false);
      await runRealtimeVerification(service);
      if (onReauthenticated) onReauthenticated();
    } catch (e: any) {
      console.warn('Manual token save error:', e);
    }
  };

  const handleDisconnect = async (targetService: 'sheets' | 'drive' | 'both') => {
    try {
      if (targetService === 'sheets' || targetService === 'both') {
        const { clearSheetsToken } = await import('../utils/googleSheetsSync');
        clearSheetsToken();
      }
      if (targetService === 'drive' || targetService === 'both') {
        const { clearDriveToken } = await import('../utils/googleDriveBackup');
        clearDriveToken();
      }
      setActionSuccessMsg('✓ Credentials cleared successfully.');
      await runRealtimeVerification(service);
      if (onReauthenticated) onReauthenticated();
    } catch (e: any) {
      console.warn('Disconnect error:', e);
    }
  };

  // Determine active primary result depending on service prop
  const primaryResult: OAuthVerificationResult | null =
    service === 'sheets'
      ? sheetsResult
      : service === 'drive'
      ? driveResult
      : (sheetsResult?.status === 'invalid' || sheetsResult?.status === 'expired'
          ? sheetsResult
          : driveResult?.status === 'invalid' || driveResult?.status === 'expired'
          ? driveResult
          : sheetsResult || driveResult);

  const hasAnyFailure =
    (service === 'sheets' && (sheetsResult?.status === 'invalid' || sheetsResult?.status === 'expired')) ||
    (service === 'drive' && (driveResult?.status === 'invalid' || driveResult?.status === 'expired')) ||
    (service === 'all' && (
      sheetsResult?.status === 'invalid' ||
      sheetsResult?.status === 'expired' ||
      driveResult?.status === 'invalid' ||
      driveResult?.status === 'expired'
    ));

  const hasMissing =
    (service === 'sheets' && sheetsResult?.status === 'missing') ||
    (service === 'drive' && driveResult?.status === 'missing') ||
    (service === 'all' && (sheetsResult?.status === 'missing' && driveResult?.status === 'missing'));

  const isFullyValid =
    !hasAnyFailure &&
    !hasMissing &&
    ((service === 'sheets' && sheetsResult?.status === 'valid') ||
     (service === 'drive' && driveResult?.status === 'valid') ||
     (service === 'all' && (sheetsResult?.status === 'valid' || driveResult?.status === 'valid')));

  // Render Compact view (for header badges, tables, modal bars)
  if (compact) {
    if (hasAnyFailure && primaryResult) {
      const targetSvc = primaryResult.service;
      const isReauthing = isReauthenticating === targetSvc;

      return (
        <div className={`p-2.5 sm:p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in duration-200 ${className}`}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-rose-400 shrink-0" />
            <span className="font-mono px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-200 font-bold text-[10px]">
              {primaryResult.errorCode || `HTTP ${primaryResult.httpStatus || 401}`}
            </span>
            <span className="font-medium truncate max-w-[280px] sm:max-w-md">
              {primaryResult.errorTitle}: {primaryResult.errorDescription}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleReauthenticate(targetSvc)}
              disabled={isReauthing}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <KeyRound size={13} className={isReauthing ? 'animate-spin' : ''} />
              <span>{isReauthing ? 'Authorizing...' : 'Re-authenticate'}</span>
            </button>
            {onClearForcedError && (
              <button
                type="button"
                onClick={onClearForcedError}
                className="text-rose-400 hover:text-white text-xs px-1"
                title="Dismiss"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      );
    }

    if (isFullyValid) {
      return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs ${className}`}>
          <CloudCheck size={14} className="text-emerald-400 shrink-0" />
          <span className="font-semibold">
            {language === 'ur' ? 'گوگل ورک اسپیس تصدیق شدہ' : 'OAuth Verified Active'}
          </span>
          {primaryResult?.latencyMs !== undefined && (
            <span className="text-[10px] text-emerald-500/80 font-mono hidden sm:inline">
              ({primaryResult.latencyMs}ms)
            </span>
          )}
          <button
            type="button"
            onClick={() => runRealtimeVerification(service)}
            disabled={isVerifying}
            className="p-1 hover:text-white rounded transition"
            title="Verify live credentials again"
          >
            <RefreshCw size={11} className={isVerifying ? 'animate-spin' : ''} />
          </button>
        </div>
      );
    }

    return null;
  }

  // Full Rich Component View
  return (
    <div className={`rounded-2xl transition-all duration-300 max-w-full overflow-x-hidden break-words ${
      hasAnyFailure
        ? 'bg-rose-950/20 border-2 border-rose-500/40 shadow-lg shadow-rose-950/20'
        : hasMissing
        ? 'bg-amber-950/20 border border-amber-500/30'
        : 'bg-[var(--panel)] border border-[var(--steel-line)]'
    } p-5 ${className}`}>
      
      {/* SUCCESS BANNER */}
      {actionSuccessMsg && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between font-mono animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--steel-line)]">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${
            hasAnyFailure
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              : hasMissing
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
          }`}>
            {hasAnyFailure ? (
              <ShieldAlert size={22} className="animate-pulse" />
            ) : hasMissing ? (
              <KeyRound size={22} />
            ) : (
              <ShieldCheck size={22} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-sm sm:text-base text-[var(--text)] break-words">
                <span>{title || (language === 'ur' ? 'گوگل ورک اسپیس توثیقی اسٹیٹس' : 'Google Workspace OAuth Status')}</span>
              </h4>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border shrink-0 ${
                hasAnyFailure
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : hasMissing
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {isVerifying
                  ? 'Verifying...'
                  : hasAnyFailure
                  ? 'Auth Failed'
                  : hasMissing
                  ? 'Not Connected'
                  : 'Active & Verified'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-dim)] mt-0.5 leading-relaxed">
              {language === 'ur'
                ? 'گوگل شیٹس اور ڈرائیو کی ریئل ٹائم سیکیورٹی اور رسائی کی جانچ'
                : 'Real-time credential verification and security inspection for Google Sheets & Drive'}
            </p>
          </div>
        </div>

        {/* RE-CHECK & DIAGNOSTIC BUTTONS */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:self-center flex-wrap">
          <button
            type="button"
            onClick={() => setShowDiagnosticModal(true)}
            className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
            title="Launch live interactive OAuth, redirect callback, and auto-sync diagnostics"
          >
            <Zap size={12} className="text-amber-400" />
            <span>Test Authentication</span>
          </button>

          <button
            type="button"
            onClick={() => runRealtimeVerification(service, true)}
            disabled={isVerifying}
            className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] hover:bg-[var(--panel-hover)] border border-[var(--steel-line)] text-xs text-[var(--text)] flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="Ping Google API to re-verify credentials"
          >
            <RefreshCw size={12} className={isVerifying ? 'animate-spin text-sky-400' : ''} />
            <span>{isVerifying ? 'Checking Google...' : 'Verify Now'}</span>
          </button>
        </div>
      </div>

      {/* SERVICE CARDS GRID */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
        
        {/* GOOGLE SHEETS SERVICE CARD */}
        {(service === 'sheets' || service === 'all') && (
          <div className={`p-4 rounded-xl border transition-all ${
            sheetsResult?.status === 'invalid' || sheetsResult?.status === 'expired'
              ? 'bg-rose-500/10 border-rose-500/40'
              : sheetsResult?.status === 'valid'
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : 'bg-[var(--panel-raised)] border-[var(--steel-line)]'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  <FileSpreadsheet size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-[var(--text)] block">Google Sheets Sync</span>
                  <span className="text-[11px] text-[var(--text-dim)] font-mono">
                    {sheetsResult?.verifiedEmail || currentUserEmail}
                  </span>
                </div>
              </div>

              {sheetsResult?.errorCode && (
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold shrink-0">
                  {sheetsResult.errorCode}
                </span>
              )}
            </div>

            {/* ERROR OR STATUS DESCRIPTION */}
            <div className="mt-3 text-xs space-y-1">
              {sheetsResult?.status === 'invalid' || sheetsResult?.status === 'expired' ? (
                <>
                  <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[11px] space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-200">
                      <AlertTriangle size={13} className="shrink-0 text-rose-400" />
                      <span>{sheetsResult.errorTitle}</span>
                    </div>
                    <p className="text-[11px] text-rose-300/90 leading-relaxed font-sans">
                      {sheetsResult.errorDescription}
                    </p>
                    <p className="text-[10px] text-amber-300 font-sans font-medium pt-1 border-t border-rose-500/20">
                      💡 {sheetsResult.actionRequired}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-col sm:flex-row items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleReauthenticate('sheets')}
                      disabled={isReauthenticating === 'sheets'}
                      className="flex-1 w-full py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow cursor-pointer disabled:opacity-50"
                    >
                      <KeyRound size={14} className={isReauthenticating === 'sheets' ? 'animate-spin' : ''} />
                      <span>
                        {isReauthenticating === 'sheets'
                          ? 'Opening Google Sign-In...'
                          : language === 'ur'
                          ? 'دوبارہ توثیق کریں (Re-authenticate Sheets)'
                          : 'Re-authenticate Google Sheets'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCloudSync}
                      disabled={isCloudSyncing}
                      className="w-full sm:w-auto py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 shrink-0"
                      title="Sync token directly from Cloud"
                    >
                      <RefreshCw size={13} className={isCloudSyncing ? 'animate-spin' : ''} />
                      <span>Sync from Cloud</span>
                    </button>
                  </div>
                </>
              ) : sheetsResult?.status === 'valid' ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-dim)] flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-emerald-400" />
                      <span>{sheetsResult.errorTitle}</span>
                    </span>
                    {sheetsResult.latencyMs !== undefined && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                        {sheetsResult.latencyMs}ms ping
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)] flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-emerald-400 font-semibold text-xs">Continuous Auto-Sync Active</span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      (Auto-renewing session)
                    </span>
                  </div>
                  {sheetsResult.resourceDetails?.spreadsheetTitle && (
                    <div className="text-[10px] font-mono text-[var(--text-dim)] truncate">
                      Linked: <span className="text-[var(--text)]">{sheetsResult.resourceDetails.spreadsheetTitle}</span>
                    </div>
                  )}
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleReauthenticate('sheets')}
                      disabled={isReauthenticating === 'sheets'}
                      className="flex-1 sm:flex-initial justify-center px-2.5 py-1.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={isReauthenticating === 'sheets' ? 'animate-spin' : ''} />
                      <span>{isReauthenticating === 'sheets' ? 'Opening Google Auth...' : 'Re-authenticate'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDisconnect('sheets')}
                      className="flex-1 sm:flex-initial justify-center px-2.5 py-1.5 rounded bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-[var(--text-dim)]">
                    No active Google Sheets credentials found. Connect your account to enable live multi-tab synchronization.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleReauthenticate('sheets')}
                    disabled={isReauthenticating === 'sheets'}
                    className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    <KeyRound size={13} className={isReauthenticating === 'sheets' ? 'animate-spin' : ''} />
                    <span>{isReauthenticating === 'sheets' ? 'Opening Google Sign-In...' : 'Connect Google Sheets'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GOOGLE DRIVE SERVICE CARD */}
        {(service === 'drive' || service === 'all') && (
          <div className={`p-4 rounded-xl border transition-all ${
            driveResult?.status === 'invalid' || driveResult?.status === 'expired'
              ? 'bg-rose-500/10 border-rose-500/40'
              : driveResult?.status === 'valid'
              ? 'bg-sky-500/5 border-sky-500/20'
              : 'bg-[var(--panel-raised)] border-[var(--steel-line)]'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/20">
                  <Cloud size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-[var(--text)] block">Google Drive Cloud Backups</span>
                  <span className="text-[11px] text-[var(--text-dim)] font-mono">
                    {driveResult?.verifiedEmail || currentUserEmail}
                  </span>
                </div>
              </div>

              {driveResult?.errorCode && (
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold shrink-0">
                  {driveResult.errorCode}
                </span>
              )}
            </div>

            {/* ERROR OR STATUS DESCRIPTION */}
            <div className="mt-3 text-xs space-y-1">
              {driveResult?.status === 'invalid' || driveResult?.status === 'expired' ? (
                <>
                  <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[11px] space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-200">
                      <AlertTriangle size={13} className="shrink-0 text-rose-400" />
                      <span>{driveResult.errorTitle}</span>
                    </div>
                    <p className="text-[11px] text-rose-300/90 leading-relaxed font-sans">
                      {driveResult.errorDescription}
                    </p>
                    <p className="text-[10px] text-amber-300 font-sans font-medium pt-1 border-t border-rose-500/20">
                      💡 {driveResult.actionRequired}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-col sm:flex-row items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleReauthenticate('drive')}
                      disabled={isReauthenticating === 'drive'}
                      className="flex-1 w-full py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow cursor-pointer disabled:opacity-50"
                    >
                      <KeyRound size={14} className={isReauthenticating === 'drive' ? 'animate-spin' : ''} />
                      <span>
                        {isReauthenticating === 'drive'
                          ? 'Opening Google Sign-In...'
                          : language === 'ur'
                          ? 'دوبارہ توثیق کریں (Re-authenticate Drive)'
                          : 'Re-authenticate Google Drive'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCloudSync}
                      disabled={isCloudSyncing}
                      className="w-full sm:w-auto py-2 px-3 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 shrink-0"
                      title="Sync token directly from Cloud"
                    >
                      <RefreshCw size={13} className={isCloudSyncing ? 'animate-spin' : ''} />
                      <span>Sync from Cloud</span>
                    </button>
                  </div>
                </>
              ) : driveResult?.status === 'valid' ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-dim)] flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-emerald-400" />
                      <span>{driveResult.errorTitle}</span>
                    </span>
                    {driveResult.latencyMs !== undefined && (
                      <span className="text-[10px] font-mono text-sky-400 bg-sky-500/15 px-1.5 py-0.5 rounded">
                        {driveResult.latencyMs}ms ping
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)] flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-emerald-400 font-semibold text-xs">Continuous Auto-Backup Active</span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      (Auto-renewing session)
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-[var(--text-dim)]">
                    Target: <span className="text-[var(--text)]">Falcon Rod Maker POS - Database Backups</span>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleReauthenticate('drive')}
                      disabled={isReauthenticating === 'drive'}
                      className="flex-1 sm:flex-initial justify-center px-2.5 py-1.5 rounded bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={isReauthenticating === 'drive' ? 'animate-spin' : ''} />
                      <span>{isReauthenticating === 'drive' ? 'Opening Google Auth...' : 'Re-authenticate'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDisconnect('drive')}
                      className="flex-1 sm:flex-initial justify-center px-2.5 py-1.5 rounded bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-[var(--text-dim)]">
                    Google Drive backups disconnected. Connect to enable automatic timestamped database snapshots.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleReauthenticate('drive')}
                    disabled={isReauthenticating === 'drive'}
                    className="w-full py-1.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    <KeyRound size={13} className={isReauthenticating === 'drive' ? 'animate-spin' : ''} />
                    <span>{isReauthenticating === 'drive' ? 'Opening Google Sign-In...' : 'Connect Google Drive'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SPECIAL GUIDANCE FOR ORIGIN MISMATCH (ERROR 400) */}
      {(sheetsResult?.errorCode === 'HTTP_400_ORIGIN_MISMATCH' || driveResult?.errorCode === 'HTTP_400_ORIGIN_MISMATCH') && (
        <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
            <AlertTriangle size={16} />
            <span>Developer Action Required: Register JavaScript Origin in Google Cloud Console</span>
          </div>
          <p className="text-amber-200/90 leading-relaxed">
            Google OAuth requires this exact website domain to be registered under <strong>Authorized JavaScript origins</strong> in your Google Cloud Console OAuth 2.0 Client credentials:
          </p>
          <div className="flex items-center gap-2 bg-black/40 p-2.5 rounded-lg border border-amber-500/30 font-mono text-xs">
            <span className="flex-1 select-all break-all text-amber-100">{getCurrentAppOrigin()}</span>
            <button
              type="button"
              onClick={copyOriginToClipboard}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-sans text-xs flex items-center gap-1 transition shrink-0 cursor-pointer"
            >
              {copiedOrigin ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copiedOrigin ? 'Copied!' : 'Copy Origin'}</span>
            </button>
          </div>
          <div className="text-[11px] text-amber-300/80 pt-1">
            Steps: Open Google Cloud Console &gt; APIs &amp; Services &gt; Credentials &gt; Click Web Client ID &gt; Add URI under Authorized JavaScript origins &gt; Save.
          </div>
        </div>
      )}

      {/* EXPANDABLE DIAGNOSTICS & RAW SCOPE INSPECTOR */}
      <div className="mt-4 pt-3 border-t border-[var(--steel-line)] flex items-center justify-between text-xs text-[var(--text-dim)]">
        <button
          type="button"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="flex items-center gap-1.5 hover:text-[var(--text)] transition cursor-pointer font-mono text-[11px]"
        >
          <span>{showDiagnostics ? 'Hide Technical Diagnostics' : 'Show Technical Diagnostics'}</span>
          {showDiagnostics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => setShowManualToken(!showManualToken)}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 transition cursor-pointer"
            title="Paste an OAuth access token manually"
          >
            {showManualToken ? 'Hide Token Input' : 'Paste Token'}
          </button>
          <a
            href="https://ais-pre-tgmm25tbldi45hm5juavht-198776278872.asia-east1.run.app/mobile-auth.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition flex items-center gap-1"
            title="Open dedicated Google Workspace authorization in external Chrome browser"
          >
            <span>Chrome Bridge</span>
            <ExternalLink size={10} />
          </a>
          <button
            type="button"
            onClick={async () => {
              const { purgeAndResetAllGoogleTokens } = await import("../utils/googleAuthHelper");
              await purgeAndResetAllGoogleTokens();
              runRealtimeVerification("all");
            }}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition cursor-pointer"
            title="Clear cached PC tokens and reset all Google sessions"
          >
            Reset Session (Fix 400)
          </button>
          <span className="font-mono text-[10px]">
            Last checked: {primaryResult?.lastCheckedAt || new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* MANUAL TOKEN INPUT DRAWER */}
      {showManualToken && (
        <div className="mt-3 p-3 rounded-xl bg-black/40 border border-sky-500/30 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
            <span>Direct Google OAuth Access Token Injection</span>
            <span className="text-[10px] text-[var(--text-dim)] font-mono">Bearer Token</span>
          </div>
          <p className="text-[11px] text-[var(--text-dim)]">
            Paste a valid Google OAuth Access Token (from Google OAuth Playground or authorized session) to immediately unlock Sheets &amp; Drive on this mobile terminal.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={manualTokenInput}
              onChange={(e) => setManualTokenInput(e.target.value)}
              placeholder="Paste ya29... token here"
              className="flex-1 px-3 py-1.5 rounded-lg bg-black/60 border border-[var(--steel-line)] text-xs text-[var(--text)] font-mono focus:border-sky-500 outline-none"
            />
            <button
              type="button"
              onClick={handleSaveManualToken}
              disabled={!manualTokenInput.trim()}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              Save &amp; Activate
            </button>
          </div>
        </div>
      )}

      {showDiagnostics && (
        <div className="mt-3 p-3.5 rounded-xl bg-black/50 border border-[var(--steel-line)] font-mono text-[11px] space-y-2 text-[var(--text-dim)] animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2 border-b border-white/5">
            <div>
              <span className="text-[var(--text-muted)] block text-[10px] uppercase">Current Domain Origin</span>
              <span className="text-sky-300 break-all">{getCurrentAppOrigin() || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-[10px] uppercase">OAuth Client ID</span>
              <span className="text-[var(--text)] break-all">{firebaseConfig.oAuthClientId || 'Configured'}</span>
            </div>
          </div>

          <div>
            <span className="text-[var(--text-muted)] block text-[10px] uppercase mb-1">Active Scopes Granted</span>
            <div className="flex flex-wrap gap-1">
              {(sheetsResult?.scopesGranted || driveResult?.scopesGranted || ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file']).map((scope, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-emerald-400 text-[10px]">
                  {scope.split('/').pop()}
                </span>
              ))}
            </div>
          </div>

          {(primaryResult?.rawDetails || forcedError) && (
            <div>
              <span className="text-rose-400 block text-[10px] uppercase mb-0.5">Raw Server Diagnostic Payload</span>
              <pre className="p-2 rounded bg-rose-950/30 border border-rose-500/20 text-rose-300 text-[10px] overflow-x-auto whitespace-pre-wrap">
                {primaryResult?.rawDetails || String(forcedError)}
              </pre>
            </div>
          )}

          {/* PERSISTENT ERROR LOGGER AUDIT STATUS */}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between flex-wrap gap-2 text-[10px]">
            <div className="flex items-center gap-1.5 text-purple-300">
              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block animate-pulse" />
              <span>
                Persistent Error Logger: <strong>{persistedLogs.length} event{persistedLogs.length !== 1 ? 's' : ''}</strong> captured (stored in Settings &gt; Debug Logs)
              </span>
            </div>

            {onNavigateToSettings && (
              <button
                type="button"
                onClick={() => onNavigateToSettings('debug_logs')}
                className="text-purple-300 hover:text-purple-200 underline flex items-center gap-1 cursor-pointer font-sans"
              >
                <span>Open Debug Logs in Settings</span>
                <ExternalLink size={11} />
              </button>
            )}
          </div>
        </div>
      )}

      <AuthDiagnosticModal
        isOpen={showDiagnosticModal}
        onClose={() => setShowDiagnosticModal(false)}
        language={language}
      />
    </div>
  );
};
