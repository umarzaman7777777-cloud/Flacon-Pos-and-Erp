import React, { useState, useEffect } from 'react';
import {
  FileText,
  Trash2,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Info,
  ShieldAlert,
  Clock,
  ExternalLink,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import {
  OAuthDebugLogEntry,
  getOAuthDebugLogs,
  clearOAuthDebugLogs,
  exportOAuthDebugLogsJSON,
  OAUTH_LOG_EVENT
} from '../utils/oauthDebugLogger';
import { AppLanguage } from '../types';

interface OAuthDebugLogsSectionProps {
  language?: AppLanguage;
  onNavigateToBackup?: (tab?: any) => void;
}

export const OAuthDebugLogsSection: React.FC<OAuthDebugLogsSectionProps> = ({
  language = 'en',
  onNavigateToBackup
}) => {
  const [logs, setLogs] = useState<OAuthDebugLogEntry[]>(() => getOAuthDebugLogs());
  const [filterService, setFilterService] = useState<'all' | 'sheets' | 'drive'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setLogs(getOAuthDebugLogs());
    };
    window.addEventListener(OAUTH_LOG_EVENT, handleUpdate);
    return () => window.removeEventListener(OAUTH_LOG_EVENT, handleUpdate);
  }, []);

  const handleClear = () => {
    if (window.confirm('Clear all stored OAuth debug logs? This will wipe the failure history for this device.')) {
      clearOAuthDebugLogs();
      setLogs([]);
    }
  };

  const handleCopyAll = () => {
    const jsonStr = exportOAuthDebugLogsJSON();
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  };

  const handleCopySingle = (entry: OAuthDebugLogEntry) => {
    navigator.clipboard.writeText(JSON.stringify(entry, null, 2)).then(() => {
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleDownloadJSON = () => {
    const jsonStr = exportOAuthDebugLogsJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `falcon_oauth_debug_logs_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter(log => {
    if (filterService !== 'all' && log.service !== filterService) {
      return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        log.errorCode.toLowerCase().includes(q) ||
        log.errorTitle.toLowerCase().includes(q) ||
        log.errorDescription.toLowerCase().includes(q) ||
        (log.userEmail && log.userEmail.toLowerCase().includes(q)) ||
        (log.rawDetails && log.rawDetails.toLowerCase().includes(q)) ||
        log.category.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const unknownGmailCount = logs.filter(l => l.category === 'unknown_gmail_trace' || l.errorCode === 'AUTH_UNKNOWN_GMAIL_TRACE').length;

  return (
    <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 sm:p-6 space-y-5 shadow-md max-w-full overflow-x-hidden break-words">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
            <FileText size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base text-[var(--text)]">
                {language === 'ur' ? 'گوگل ورک اسپیس ڈیبگ لاگز (Debug Logs)' : 'Google Workspace OAuth Debug Logs'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                Remote Diagnostics Traces
              </span>
              {unknownGmailCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase">
                  {unknownGmailCount} Gmail Trace{unknownGmailCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-dim)] mt-0.5">
              {language === 'ur'
                ? 'گوگل شیٹس اور ڈرائیو کی ناکام توثیق اور نامعلوم ای میل ایڈریسز کا مستقل لاگ ریکارڈ'
                : 'Persistent audit trail of failed authentication, token exchanges, and unknown gmail traces for remote debugging'}
            </p>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleCopyAll}
            disabled={logs.length === 0}
            className="px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] hover:bg-[var(--panel-hover)] border border-[var(--steel-line)] text-xs text-[var(--text)] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
            title="Copy all logs as diagnostic JSON"
          >
            {copiedAll ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedAll ? 'Copied Full Report' : 'Copy Report'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJSON}
            disabled={logs.length === 0}
            className="px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] hover:bg-[var(--panel-hover)] border border-[var(--steel-line)] text-xs text-[var(--text)] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
            title="Download JSON dump"
          >
            <Download size={13} />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={logs.length === 0}
            className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
            title="Clear all logs"
          >
            <Trash2 size={13} />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Info Callout about Unknown Gmail Traces */}
      <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-200 text-xs space-y-1 font-mono">
        <div className="flex items-center gap-2 font-bold text-purple-300">
          <Info size={15} />
          <span>Remote Diagnosis Guide: "Unknown Gmail Traces"</span>
        </div>
        <p className="text-[11px] text-purple-200/90 leading-relaxed font-sans">
          When client devices encounter authorization rejections or fail to update Google Sheets, 
          this persistent logger preserves the raw OAuth responses, client IDs, browser origins, and email identity claims.
          Entries tagged as <strong className="text-rose-300 font-mono">AUTH_UNKNOWN_GMAIL_TRACE</strong> indicate that an unapproved Google Account was selected in the sign-in prompt instead of the authorized owner.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-[var(--text-dim)] flex items-center gap-1">
            <Filter size={13} />
            <span>Filter:</span>
          </span>
          {(['all', 'sheets', 'drive'] as const).map(svc => (
            <button
              key={svc}
              type="button"
              onClick={() => setFilterService(svc)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-semibold uppercase transition cursor-pointer ${
                filterService === svc
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-[var(--panel-raised)] text-[var(--text-dim)] border-[var(--steel-line)] hover:text-[var(--text)]'
              }`}
            >
              {svc}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--text-dim)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search errors, emails, codes..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs text-[var(--text)] focus:outline-none focus:border-purple-400 placeholder-[var(--text-dim)]"
          />
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="space-y-2.5">
        {filteredLogs.length === 0 ? (
          <div className="p-8 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] text-center text-xs text-[var(--text-dim)] space-y-1">
            <p className="font-semibold text-[var(--text)]">No OAuth failure records logged</p>
            <p className="text-[11px]">
              {logs.length > 0
                ? 'No log entries match the current filter or search criteria.'
                : 'Authentication attempts are either working normally or no errors have occurred on this device.'}
            </p>
          </div>
        ) : (
          filteredLogs.map(log => {
            const isExpanded = expandedLogId === log.id;
            const isUnknownGmail = log.category === 'unknown_gmail_trace' || log.errorCode === 'AUTH_UNKNOWN_GMAIL_TRACE';

            return (
              <div
                key={log.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isUnknownGmail
                    ? 'bg-rose-950/20 border-rose-500/40'
                    : log.severity === 'error'
                    ? 'bg-rose-500/5 border-rose-500/30'
                    : 'bg-[var(--panel-raised)] border-[var(--steel-line)]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                      isUnknownGmail
                        ? 'bg-rose-500/30 text-rose-200 border-rose-500/50'
                        : log.severity === 'error'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {log.errorCode}
                    </span>

                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-white/5 border border-white/10 text-[var(--text-dim)]">
                      {log.service}
                    </span>

                    <span className="font-semibold text-xs text-[var(--text)]">
                      {log.errorTitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-xs text-[var(--text-dim)] font-mono">
                    <span className="text-[11px] flex items-center gap-1">
                      <Clock size={12} />
                      {log.formattedTime}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopySingle(log)}
                      className="p-1 hover:text-[var(--text)] transition cursor-pointer"
                      title="Copy JSON entry"
                    >
                      {copiedId === log.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[11px] font-sans text-[var(--text)] cursor-pointer"
                    >
                      {isExpanded ? 'Less' : 'Inspect'}
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-xs text-[var(--text-dim)] leading-relaxed">
                  {log.errorDescription}
                </p>

                {log.userEmail && (
                  <div className="mt-1 text-[11px] font-mono text-[var(--text-dim)]">
                    Identity Claim: <span className="text-amber-300">{log.userEmail}</span>
                  </div>
                )}

                {/* Expanded Inspector */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-2 font-mono text-[11px] text-[var(--text-dim)]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2">
                      <div>
                        <span className="text-[var(--text-muted)] block text-[10px] uppercase">Category</span>
                        <span className="text-purple-300 font-semibold">{log.category}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] block text-[10px] uppercase">HTTP Status</span>
                        <span>{log.httpStatus ?? 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] block text-[10px] uppercase">Origin</span>
                        <span className="break-all">{log.origin || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] block text-[10px] uppercase">Online Status</span>
                        <span className={log.onlineStatus ? 'text-emerald-400' : 'text-rose-400'}>
                          {log.onlineStatus ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>

                    {log.rawDetails && (
                      <div>
                        <span className="text-rose-400 block text-[10px] uppercase mb-1">Raw Error Trace / Stack</span>
                        <pre className="p-2.5 rounded bg-black/60 border border-white/10 text-rose-300 text-[10px] overflow-x-auto whitespace-pre-wrap select-all font-mono">
                          {log.rawDetails}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
