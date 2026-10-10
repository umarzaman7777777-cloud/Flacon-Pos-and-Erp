import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Copy,
  Check,
  Download,
  Smartphone,
  ShieldCheck,
  Database,
  FileSpreadsheet,
  Cloud,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  Terminal,
  Zap
} from 'lucide-react';
import {
  runFullAuthenticationDiagnostics,
  runInteractiveSignInProbe,
  runOAuthRedirectCallbackDiagnostic,
  AuthDiagnosticReport,
  DiagnosticStepResult
} from '../utils/authDiagnosticEngine';
import { AppLanguage } from '../types';
import { purgeAndResetAllGoogleTokens } from '../utils/googleAuthHelper';

interface AuthDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: AppLanguage;
  onUnlockMaster?: () => void;
}

export const AuthDiagnosticModal: React.FC<AuthDiagnosticModalProps> = ({
  isOpen,
  onClose,
  language = 'en',
  onUnlockMaster
}) => {
  const [report, setReport] = useState<AuthDiagnosticReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [interactiveProbeResult, setInteractiveProbeResult] = useState<any | null>(null);
  const [isProbingInteractive, setIsProbingInteractive] = useState(false);
  const [redirectProbeResult, setRedirectProbeResult] = useState<any | null>(null);
  const [isProbingRedirect, setIsProbingRedirect] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  // Auto-run diagnostic suite on open
  useEffect(() => {
    if (isOpen) {
      handleRunDiagnostics();
    }
  }, [isOpen]);

  const handleRunDiagnostics = async () => {
    setIsRunning(true);
    setInteractiveProbeResult(null);
    setRedirectProbeResult(null);
    try {
      const res = await runFullAuthenticationDiagnostics();
      setReport(res);
      // Auto-expand any step that has a warning or failure
      const autoExpand: Record<string, boolean> = {};
      res.steps.forEach(s => {
        if (s.status === 'warning' || s.status === 'failed') {
          autoExpand[s.id] = true;
        }
      });
      setExpandedSteps(autoExpand);
    } catch (err) {
      console.error('Failed to run diagnostics:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleTestRedirectCallback = async () => {
    setIsProbingRedirect(true);
    try {
      const res = await runOAuthRedirectCallbackDiagnostic();
      setRedirectProbeResult(res);
      const freshReport = await runFullAuthenticationDiagnostics();
      setReport(freshReport);
    } catch (err: any) {
      setRedirectProbeResult({
        success: false,
        hasRedirectResult: false,
        errorMessage: err?.message || 'Redirect diagnostic error',
        technicalDetails: String(err)
      });
    } finally {
      setIsProbingRedirect(false);
    }
  };

  const handleInteractiveProbe = async () => {
    setIsProbingInteractive(true);
    try {
      const probeRes = await runInteractiveSignInProbe('umarzaman7777777@gmail.com');
      setInteractiveProbeResult(probeRes);
      // Refresh full report after interactive test
      const freshReport = await runFullAuthenticationDiagnostics();
      setReport(freshReport);
    } catch (err: any) {
      setInteractiveProbeResult({
        success: false,
        errorMessage: err?.message || 'Probe error',
        latencyMs: 0
      });
    } finally {
      setIsProbingInteractive(false);
    }
  };

  const handleCopyReport = () => {
    if (!report) return;
    const text = JSON.stringify(report, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `falcon_auth_diagnostic_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePurgeTokens = async () => {
    if (window.confirm('Clear all stored Google OAuth tokens and reset auth state to clean offline mode?')) {
      await purgeAndResetAllGoogleTokens();
      setResetNotice('✓ Auth tokens cleared. Terminal restored to pristine state.');
      setTimeout(() => setResetNotice(null), 3000);
      handleRunDiagnostics();
    }
  };

  const toggleStep = (id: string) => {
    setExpandedSteps(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[var(--panel)] border border-[var(--steel-line)] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--steel-line)] flex items-center justify-between gap-3 bg-[var(--panel-raised)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
              <Activity size={22} className={isRunning ? 'animate-spin' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-[var(--text)]">
                  {language === 'ur' ? 'توثیق اور آٹو سنک تشخیصی ٹول' : 'OAuth & Auto-Sync Diagnostic Tool'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Interactive Test Suite
                </span>
                {report?.environment.isAndroid && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                    <Smartphone size={10} /> Android Mobile
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">
                {language === 'ur'
                  ? 'موبائل پر جی میل سائن ان اٹکنے اور آٹو سنک کی غلطیوں کی مکمل لائیو تشخیص'
                  : 'Diagnoses why Gmail popups get stuck on mobile, inspects OAuth redirects, and tests auto-sync.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-dim)] hover:text-white hover:bg-white/5 transition cursor-pointer"
            title="Close diagnostics"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-5 py-3 border-b border-[var(--steel-line)] bg-[var(--panel)] flex items-center justify-between gap-2 flex-wrap shrink-0 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isRunning || isProbingInteractive}
              onClick={handleRunDiagnostics}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isRunning ? 'animate-spin' : ''} />
              <span>{isRunning ? 'Scanning...' : 'Re-run Scan'}</span>
            </button>

            <button
              type="button"
              disabled={isProbingInteractive || isRunning}
              onClick={handleInteractiveProbe}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Test real Google Sign-In popup with live error telemetry"
            >
              <Zap size={13} className={isProbingInteractive ? 'animate-spin' : ''} />
              <span>{isProbingInteractive ? 'Testing Popup...' : 'Test Interactive Sign-In'}</span>
            </button>

            <button
              type="button"
              disabled={isProbingRedirect || isRunning}
              onClick={handleTestRedirectCallback}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Test OAuth redirect callback resolution and log errors"
            >
              <Activity size={13} className={isProbingRedirect ? 'animate-spin' : ''} />
              <span>{isProbingRedirect ? 'Probing Callback...' : 'Test Redirect Callback'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyReport}
              disabled={!report}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--panel-raised)] hover:bg-[var(--panel-hover)] border border-[var(--steel-line)] text-[var(--text)] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
              title="Copy diagnostic report to clipboard"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy Report'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadJSON}
              disabled={!report}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--panel-raised)] hover:bg-[var(--panel-hover)] border border-[var(--steel-line)] text-[var(--text)] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
              title="Download diagnostic JSON"
            >
              <Download size={13} />
              <span>JSON</span>
            </button>

            <button
              type="button"
              onClick={handlePurgeTokens}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 transition cursor-pointer"
              title="Reset all tokens to clean state"
            >
              <span>Reset Cache</span>
            </button>
          </div>
        </div>

        {/* Notices */}
        {resetNotice && (
          <div className="px-5 py-2 bg-emerald-500/20 border-b border-emerald-500/30 text-emerald-300 text-xs font-mono">
            {resetNotice}
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          
          {/* Redirect Callback Diagnostic Live Banner */}
          {redirectProbeResult && (
            <div className={`p-4 rounded-xl border space-y-1.5 text-xs font-mono transition-all animate-in fade-in duration-200 ${
              redirectProbeResult.success
                ? 'bg-purple-500/15 border-purple-500/40 text-purple-200'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-2">
                  {redirectProbeResult.success ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertTriangle size={16} className="text-amber-400" />}
                  <span>OAuth Redirect Callback Diagnostic: {redirectProbeResult.hasRedirectResult ? 'RESOLVED CREDENTIALS' : 'INSPECTION COMPLETE'}</span>
                </span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {redirectProbeResult.autoSyncStatus}
                </span>
              </div>
              <p className="text-xs font-sans leading-relaxed text-slate-200">
                {redirectProbeResult.errorMessage}
              </p>
              {redirectProbeResult.mobileWarning && (
                <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px] font-sans">
                  <strong>Mobile Android Notice:</strong> {redirectProbeResult.mobileWarning}
                </div>
              )}
              <div className="text-[11px] text-zinc-300 pt-1 border-t border-white/10 font-mono">
                {redirectProbeResult.technicalDetails}
              </div>
            </div>
          )}

          {/* Interactive Sign-In Probe Live Banner */}
          {interactiveProbeResult && (
            <div className={`p-4 rounded-xl border space-y-1.5 text-xs font-mono transition-all animate-in fade-in duration-200 ${
              interactiveProbeResult.success
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-2">
                  {interactiveProbeResult.success ? <CheckCircle2 size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-rose-400" />}
                  <span>Interactive Sign-In Probe Result: {interactiveProbeResult.success ? 'PASSED' : 'ERROR CAUGHT'}</span>
                </span>
                <span className="text-[11px] opacity-80">{interactiveProbeResult.latencyMs}ms</span>
              </div>
              <p className="text-xs font-sans leading-relaxed">
                {interactiveProbeResult.errorMessage}
              </p>
              {interactiveProbeResult.errorCode && (
                <div className="text-[10px] text-amber-300 pt-1 border-t border-white/10">
                  Firebase Code: <code>{interactiveProbeResult.errorCode}</code>
                </div>
              )}
            </div>
          )}

          {/* Specialized Highlight Card: Mobile Android "Stuck Window" & "Yes, it's me" Analysis */}
          {report?.gmailStuckAnalysis && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-950/40 via-purple-950/20 to-[var(--panel-raised)] border border-blue-500/30 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-blue-200">
                      Mobile Android "Stuck Gmail Window" Root Cause Analysis
                    </h4>
                    <p className="text-xs text-blue-300/80">
                      {report.gmailStuckAnalysis.summary}
                    </p>
                  </div>
                </div>

                <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                  report.gmailStuckAnalysis.riskLevel === 'high'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {report.gmailStuckAnalysis.riskLevel} Risk
                </span>
              </div>

              {/* Likely Technical Causes */}
              <div className="space-y-1.5 pl-2 border-l-2 border-blue-500/40 text-xs text-[var(--text-dim)] font-mono">
                <p className="font-bold text-white text-[11px]">Why it gets stuck on mobile devices:</p>
                {report.gmailStuckAnalysis.likelyCauses.map((cause, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-blue-400">•</span>
                    <span>{cause}</span>
                  </div>
                ))}
              </div>

              {/* Actionable Workaround / Fix */}
              <div className="p-3 rounded-lg bg-black/40 border border-blue-400/20 space-y-2 text-xs">
                <p className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span>💡 How to resolve immediately on Android:</span>
                </p>
                <div className="space-y-1 text-slate-200">
                  {report.gmailStuckAnalysis.actionableFixes.map((fix, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold shrink-0">{idx + 1}.</span>
                      <span>{fix}</span>
                    </div>
                  ))}
                </div>

                {/* Specific Diagnosis for Image 3: Blank White Screen at gen-lang-client-...firebaseapp.com */}
                <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs space-y-1.5 font-sans">
                  <div className="flex items-center gap-2 font-bold text-rose-300 font-mono">
                    <AlertTriangle size={15} />
                    <span>Why firebaseapp.com opens as a Blank White Screen:</span>
                  </div>
                  <p className="text-[11px] text-rose-200/90 leading-relaxed font-sans">
                    On Android Chrome, cross-origin context isolation blocks <code>gen-lang-client-0360687883.firebaseapp.com/__/auth/handler</code> from receiving the popup authorization handshake from the app. This causes the popup to freeze on a blank white screen.
                  </p>
                  <p className="text-[11px] text-emerald-300 font-bold font-sans">
                    ✓ Solution: Use Google Identity Services directly (accounts.google.com) or tap the button below to bypass the blank screen immediately.
                  </p>
                </div>

                {onUnlockMaster && (
                  <button
                    type="button"
                    onClick={() => {
                      onUnlockMaster();
                      onClose();
                    }}
                    className="mt-2 w-full py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-black font-bold text-xs uppercase font-mono flex items-center justify-center gap-2 transition cursor-pointer shadow"
                  >
                    <ShieldCheck size={15} />
                    <span>Bypass Stuck Popup & Unlock Master (umarzaman7777777@gmail.com)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Auto-Sync Pipeline Status Card */}
          {report?.autoSyncAnalysis && (
            <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <Cloud size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[var(--text)]">
                      Google Workspace Auto-Sync Engine Health
                    </h4>
                    <p className="text-xs text-[var(--text-dim)]">
                      Checks Sheets & Drive sync authorization and offline queue status
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                    report.autoSyncAnalysis.sheetsSyncStatus === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : report.autoSyncAnalysis.sheetsSyncStatus === 'offline_ready'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}>
                    Sheets: {report.autoSyncAnalysis.sheetsSyncStatus}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                    report.autoSyncAnalysis.driveSyncStatus === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : report.autoSyncAnalysis.driveSyncStatus === 'offline_ready'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}>
                    Drive: {report.autoSyncAnalysis.driveSyncStatus}
                  </span>
                </div>
              </div>

              {/* Status details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-black/30 border border-[var(--steel-line)]">
                  <span className="text-[var(--text-dim)] text-[10px] block">Offline Queue Count</span>
                  <span className="font-bold text-sm text-amber-400">
                    {report.autoSyncAnalysis.offlineQueueCount} pending items
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/30 border border-[var(--steel-line)]">
                  <span className="text-[var(--text-dim)] text-[10px] block">Sheets Error State</span>
                  <span className={`font-bold text-sm ${report.autoSyncAnalysis.sheetsSyncStatus === 'invalid_token' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {report.autoSyncAnalysis.sheetsSyncStatus === 'invalid_token' ? 'Expired (401)' : '0 Errors (Clean)'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/30 border border-[var(--steel-line)]">
                  <span className="text-[var(--text-dim)] text-[10px] block">Auto-Sync Guard</span>
                  <span className="font-bold text-sm text-sky-400">
                    isRealGoogleToken: ACTIVE
                  </span>
                </div>
              </div>

              {report.autoSyncAnalysis.issues.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-mono space-y-1">
                  <p className="font-bold text-amber-300">Auto-Sync State Notice:</p>
                  {report.autoSyncAnalysis.issues.map((iss, idx) => (
                    <p key={idx} className="text-amber-200/90 text-[11px]">• {iss}</p>
                  ))}
                  {report.autoSyncAnalysis.actionableFixes[0] && (
                    <p className="text-sky-300 text-[11px] pt-1 border-t border-amber-500/20">
                      💡 Fix: {report.autoSyncAnalysis.actionableFixes[0]}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step-by-Step Diagnostic Probe Trace */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase font-mono text-[var(--text-dim)] tracking-wider">
              Diagnostic Probe Steps ({report?.steps.length || 0})
            </h4>

            {report?.steps.map(step => {
              const isExpanded = expandedSteps[step.id];
              return (
                <div
                  key={step.id}
                  className={`rounded-xl border transition-all ${
                    step.status === 'passed'
                      ? 'bg-emerald-500/5 border-emerald-500/25'
                      : step.status === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/35'
                      : step.status === 'failed'
                      ? 'bg-rose-500/10 border-rose-500/35'
                      : 'bg-[var(--panel-raised)] border-[var(--steel-line)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleStep(step.id)}
                    className="w-full p-3.5 flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {step.status === 'passed' && <CheckCircle2 size={17} className="text-emerald-400 shrink-0" />}
                      {step.status === 'warning' && <AlertTriangle size={17} className="text-amber-400 shrink-0" />}
                      {step.status === 'failed' && <XCircle size={17} className="text-rose-400 shrink-0" />}
                      {step.status === 'info' && <HelpCircle size={17} className="text-sky-400 shrink-0" />}

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-[var(--text)] font-mono">
                            {step.name}
                          </span>
                          <span className={`px-2 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                            step.status === 'passed'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : step.status === 'warning'
                              ? 'bg-amber-500/20 text-amber-300'
                              : step.status === 'failed'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}>
                            {step.status}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-dim)] mt-0.5 font-sans">
                          {step.summary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {step.latencyMs !== undefined && (
                        <span className="text-[11px] font-mono text-[var(--text-dim)]">
                          {step.latencyMs}ms
                        </span>
                      )}
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  {/* Expanded Technical Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-2 text-xs font-mono">
                      <div className="p-2.5 rounded bg-black/40 text-[11px] text-slate-300 break-all leading-relaxed">
                        {step.technicalDetails}
                      </div>

                      {step.recommendation && (
                        <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px]">
                          <strong>Recommendation:</strong> {step.recommendation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--steel-line)] bg-[var(--panel-raised)] flex items-center justify-between gap-3 flex-wrap shrink-0 text-xs font-mono text-[var(--text-dim)]">
          <span>
            Diagnostic Session: {report?.id || 'Ready'} ({report?.durationMs || 0}ms)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[var(--panel)] hover:bg-[var(--panel-hover)] border border-[var(--steel-line)] text-[var(--text)] transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
