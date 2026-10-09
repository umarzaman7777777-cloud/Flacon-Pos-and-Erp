import React from 'react';
import {
  X,
  FileSpreadsheet,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  UploadCloud,
  Database,
  ShieldCheck,
  Zap,
  ArrowRight,
  HardDrive,
  Clock,
  Timer
} from 'lucide-react';
import { AppState } from '../types';
import { AuthStatus } from './AuthStatus';
import { openExternalUrl } from '../utils/openExternalUrl';

interface WorkspaceSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  appState: AppState;
  // Workspace sync hook states & actions
  sheetsConnected: boolean;
  spreadsheetId: string | null;
  spreadsheetTitle: string | null;
  spreadsheetUrl: string | null;
  lastSheetsSync: string | null;
  sheetsAutoSync: boolean;
  isSyncingSheets: boolean;
  sheetsError: string | null;
  sheetsSuccessMsg: string | null;
  onSyncAllSheets: () => Promise<boolean>;
  onConnectSheets: () => Promise<string | null>;
  onDisconnectSheets: () => void;
  onToggleSheetsAutoSync: (enabled?: boolean) => void;

  driveConnected: boolean;
  driveFolderId: string | null;
  lastDriveBackup: string | null;
  driveAutoBackup: boolean;
  driveAutoBackupInterval?: number;
  nextScheduledDriveBackup?: string | null;
  driveBackupCountdown?: string | null;
  isUploadingDrive: boolean;
  driveError: string | null;
  driveSuccessMsg: string | null;
  driveBackupsCount: number;
  onBackupToDrive: (format: 'json' | 'sql') => Promise<boolean>;
  onBackupAllFilesToDrive?: () => Promise<boolean>;
  onConnectDrive: () => Promise<string | null>;
  onDisconnectDrive: () => void;
  onToggleDriveAutoBackup: (enabled?: boolean) => void;
  onChangeDriveAutoBackupInterval?: (hours: number) => void;

  // Auto-Sync Engine
  onAutoSyncNow?: () => Promise<boolean>;
  isAutoAuthenticating?: boolean;

  // Navigation
  onNavigateToBackupTab: (tab: 'google_sheets' | 'google_drive' | 'cloud_status') => void;
  // Firestore sync state
  syncState: 'synced' | 'syncing' | 'offline' | 'error';
  pendingQueueCount?: number;
}

export const WorkspaceSyncModal: React.FC<WorkspaceSyncModalProps> = ({
  isOpen,
  onClose,
  appState,
  sheetsConnected,
  spreadsheetId,
  spreadsheetTitle,
  spreadsheetUrl,
  lastSheetsSync,
  sheetsAutoSync,
  isSyncingSheets,
  sheetsError,
  sheetsSuccessMsg,
  onSyncAllSheets,
  onConnectSheets,
  onDisconnectSheets,
  onToggleSheetsAutoSync,
  driveConnected,
  driveFolderId,
  lastDriveBackup,
  driveAutoBackup,
  driveAutoBackupInterval = 4,
  nextScheduledDriveBackup,
  driveBackupCountdown,
  isUploadingDrive,
  driveError,
  driveSuccessMsg,
  driveBackupsCount,
  onBackupToDrive,
  onBackupAllFilesToDrive,
  onConnectDrive,
  onDisconnectDrive,
  onToggleDriveAutoBackup,
  onChangeDriveAutoBackupInterval,
  onAutoSyncNow,
  isAutoAuthenticating = false,
  onNavigateToBackupTab,
  syncState,
  pendingQueueCount = 0
}) => {
  if (!isOpen) return null;

  const totalTransactions = appState.transactions?.length || 0;
  const totalProducts = appState.products?.length || 0;
  const totalCustomers = appState.customerLedgers?.length || 0;

  const effectiveSheetUrl =
    spreadsheetUrl ||
    (spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : null);

  const effectiveDriveUrl = driveFolderId
    ? `https://drive.google.com/drive/folders/${driveFolderId}`
    : 'https://drive.google.com';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl max-w-full overflow-x-hidden break-words max-h-[90vh] flex flex-col rounded-2xl border border-[var(--steel-line)] bg-[var(--panel)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--steel-line)] bg-[var(--panel-raised)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Cloud size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[var(--text)] tracking-tight break-words">
                  Google Workspace & Cloud Sync
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold uppercase shrink-0">
                  Live Hub
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)]">
                Master synchronization for Google Sheets, Google Drive Backups, and Cloud POS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel-hover)] transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* NOTIFICATIONS & MESSAGES */}
        {(sheetsSuccessMsg || driveSuccessMsg) && (
          <div className="px-5 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{sheetsSuccessMsg || driveSuccessMsg}</span>
          </div>
        )}
        {(sheetsError || driveError) && (
          <div className="px-5 py-2.5 bg-[var(--panel)] border-b border-[var(--steel-line)]">
            <AuthStatus
              service={sheetsError ? 'sheets' : 'drive'}
              compact
              forcedError={sheetsError || driveError}
            />
          </div>
        )}

        {/* MODAL CONTENT */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* AUTO-AUTHENTICATION & STARTUP SYNC STATUS BANNER */}
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40">
                <Zap size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-300">
                    Auto-Authentication & Startup Sync
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[9px] font-bold border border-emerald-500/40">
                    ACTIVE
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-dim)] truncate mt-0.5">
                  Automatically authenticates Google Drive & Sheets and syncs all worksheets on app launch.
                </p>
              </div>
            </div>

            {onAutoSyncNow && (
              <button
                type="button"
                onClick={() => onAutoSyncNow()}
                disabled={isAutoAuthenticating || isSyncingSheets || isUploadingDrive}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
              >
                <RefreshCw size={13} className={isAutoAuthenticating || isSyncingSheets || isUploadingDrive ? 'animate-spin' : ''} />
                <span>{isAutoAuthenticating ? 'Auto-Syncing...' : 'Auto-Sync Now'}</span>
              </button>
            )}
          </div>

          {/* STATS STRIP */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl border border-[var(--steel-line)] bg-[var(--panel-raised)]">
              <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] block">POS Firestore</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    syncState === 'synced' ? 'bg-emerald-400' : syncState === 'syncing' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
                  }`}
                />
                <span className="text-xs font-bold text-[var(--text)] capitalize">{syncState}</span>
                {pendingQueueCount > 0 && (
                  <span className="text-[10px] font-mono text-amber-400">({pendingQueueCount} queued)</span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[var(--steel-line)] bg-[var(--panel-raised)]">
              <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] block">Google Sheets</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isSyncingSheets
                      ? 'bg-amber-400 animate-pulse'
                      : sheetsConnected && spreadsheetId
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                      : sheetsConnected
                      ? 'bg-sky-400'
                      : 'bg-slate-500'
                  }`}
                />
                <span className="text-xs font-bold text-[var(--text)]">
                  {isSyncingSheets ? 'Syncing...' : sheetsConnected && spreadsheetId ? 'Live Synced' : sheetsConnected ? 'Ready' : 'Not Connected'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[var(--steel-line)] bg-[var(--panel-raised)]">
              <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] block">Google Drive</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isUploadingDrive
                      ? 'bg-amber-400 animate-pulse'
                      : driveConnected
                      ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]'
                      : 'bg-slate-500'
                  }`}
                />
                <span className="text-xs font-bold text-[var(--text)]">
                  {isUploadingDrive ? 'Uploading...' : driveConnected ? `${driveBackupsCount} Backups` : 'Not Connected'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[var(--steel-line)] bg-[var(--panel-raised)]">
              <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] block">Live Database</span>
              <span className="text-xs font-mono font-bold text-[var(--text)] mt-1 block">
                {totalTransactions} Txns • {totalProducts} SKUs
              </span>
            </div>
          </div>

          {/* CARD 1: GOOGLE SHEETS LIVE SYNC */}
          <div className="p-4 rounded-xl border border-[var(--steel-line)] bg-[var(--panel-raised)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--steel-line)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--text)] break-words">
                      Google Sheets Real-time Synchronization
                    </h3>
                    {sheetsConnected && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                        Authorized
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-dim)]">
                    Maintains 7 live worksheets: Dashboard, Sales, Catalog, Ledgers, Raw Stock, Factories & Expenses
                  </p>
                </div>
              </div>

              <div>
                {!sheetsConnected ? (
                  <button
                    type="button"
                    onClick={onConnectSheets}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    <ShieldCheck size={14} />
                    <span>Connect Google Account</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onDisconnectSheets}
                    className="text-[11px] text-red-400 hover:underline cursor-pointer"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            {/* Sheets Details / Controls */}
            {sheetsConnected ? (
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] block">Linked Spreadsheet</span>
                    {spreadsheetId ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-[var(--text)] truncate max-w-xs sm:max-w-md">
                          {spreadsheetTitle || spreadsheetId}
                        </span>
                        {effectiveSheetUrl && (
                          <button
                            type="button"
                            onClick={() => openExternalUrl(effectiveSheetUrl, 'sheets')}
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline cursor-pointer"
                          >
                            <span>Open in Sheets</span>
                            <ExternalLink size={11} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-400">
                        No target spreadsheet chosen yet. Go to Sheets tab to select or generate one.
                      </span>
                    )}
                  </div>

                  {lastSheetsSync && (
                    <div className="text-right">
                      <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] block">Last Synchronized</span>
                      <span className="text-xs font-mono text-[var(--text)]">{lastSheetsSync}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={sheetsAutoSync}
                      onChange={e => onToggleSheetsAutoSync(e.target.checked)}
                      className="rounded border-[var(--steel-line)] text-emerald-500 focus:ring-emerald-500 bg-[var(--panel)]"
                    />
                    <span className={sheetsAutoSync ? 'text-emerald-400 font-semibold' : 'text-[var(--text-dim)]'}>
                      Auto-sync on new sales transactions
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSyncingSheets || !spreadsheetId}
                      onClick={() => onSyncAllSheets()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      <RefreshCw size={13} className={isSyncingSheets ? 'animate-spin' : ''} />
                      <span>{isSyncingSheets ? 'Syncing 7 Sheets...' : 'Sync All Sheets Now'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToBackupTab('google_sheets');
                      }}
                      className="flex items-center gap-1 text-xs text-[var(--text-dim)] hover:text-[var(--text)] px-2 py-1.5 rounded-lg hover:bg-[var(--panel-hover)] transition cursor-pointer"
                    >
                      <span>Manage Tabs</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[var(--text-dim)] p-2.5 rounded-lg bg-[var(--panel)] border border-dashed border-[var(--steel-line)]">
                Connect your master Google Account to unlock real-time streaming of all workshop receipts, inventory changes, customer balances, and raw material stocks directly to Google Sheets.
              </div>
            )}
          </div>

          {/* CARD 2: GOOGLE DRIVE CLOUD BACKUPS */}
          <div className="p-4 rounded-xl border border-[var(--steel-line)] bg-[var(--panel-raised)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--steel-line)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Cloud size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--text)] break-words">
                      Google Drive Dedicated Backups
                    </h3>
                    {driveConnected && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
                        Authorized
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-dim)]">
                    Isolated snapshot archives stored in "Falcon Rod Maker POS - Database Backups"
                  </p>
                </div>
              </div>

              <div>
                {!driveConnected ? (
                  <button
                    type="button"
                    onClick={onConnectDrive}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    <UploadCloud size={14} />
                    <span>Authorize Drive</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onDisconnectDrive}
                    className="text-[11px] text-red-400 hover:underline cursor-pointer"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            {/* Drive Details / Controls */}
            {driveConnected ? (
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] block">Backup Folder</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold text-[var(--text)]">
                        Falcon Rod Maker POS - Database Backups
                      </span>
                      <button
                        type="button"
                        onClick={() => openExternalUrl(effectiveDriveUrl, 'drive')}
                        className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline cursor-pointer"
                      >
                        <span>Open in Drive</span>
                        <ExternalLink size={11} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] block">Saved Backups</span>
                      <span className="text-xs font-mono font-bold text-sky-400">{driveBackupsCount} Files</span>
                    </div>
                    {lastDriveBackup && (
                      <div className="text-right">
                        <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] block">Last Upload</span>
                        <span className="text-xs font-mono text-[var(--text)]">
                          {new Date(lastDriveBackup).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scheduled Auto-Backup Time & Frequency Card */}
                <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-sky-500/30 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                        <Clock size={15} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--text)]">Auto-Backup of All Files</span>
                          {driveAutoBackup ? (
                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold border border-emerald-500/30">
                              Active
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded-full bg-slate-500/20 text-slate-400 text-[9px] font-mono font-bold border border-slate-500/30">
                              Paused
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--text-dim)]">
                          Periodically backs up all database files (JSON state & SQL dump) to Google Drive
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={driveAutoBackup}
                        onChange={e => onToggleDriveAutoBackup(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                    </label>
                  </div>

                  {/* Frequency Selector */}
                  {driveAutoBackup && (
                    <div className="space-y-1.5 pt-1.5 border-t border-[var(--steel-line)]/50">
                      <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] block">
                        Backup Frequency / Interval
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { label: 'Every 1h', hours: 1 },
                          { label: 'Every 2h', hours: 2 },
                          { label: 'Every 4h', hours: 4 },
                          { label: 'Every 6h', hours: 6 },
                          { label: 'Every 12h', hours: 12 },
                          { label: 'Daily (24h)', hours: 24 }
                        ].map(item => (
                          <button
                            key={item.hours}
                            type="button"
                            onClick={() => onChangeDriveAutoBackupInterval && onChangeDriveAutoBackupInterval(item.hours)}
                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold transition cursor-pointer ${
                              driveAutoBackupInterval === item.hours
                                ? 'bg-sky-500 text-white shadow-xs'
                                : 'bg-[var(--panel)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Time & Countdown Display */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[var(--steel-line)]/50 text-xs">
                    <div className="p-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]">
                      <span className="text-[9.5px] font-mono uppercase text-[var(--text-dim)] block">Last Auto-Backup</span>
                      <span className="font-mono font-bold text-[var(--text)] text-[11px] truncate block mt-0.5">
                        {lastDriveBackup ? new Date(lastDriveBackup).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never backed up yet'}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]">
                      <span className="text-[9.5px] font-mono uppercase text-[var(--text-dim)] block">Next Scheduled Backup</span>
                      {driveAutoBackup ? (
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="font-mono font-bold text-sky-400 text-[11px] truncate">
                            {nextScheduledDriveBackup || 'Calculating...'}
                          </span>
                          {driveBackupCountdown && (
                            <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono text-[9px] font-bold border border-sky-500/30 shrink-0">
                              {driveBackupCountdown}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[var(--text-dim)] italic mt-0.5 block">
                          Auto-backup disabled
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={isUploadingDrive}
                    onClick={() => onBackupAllFilesToDrive ? onBackupAllFilesToDrive() : onBackupToDrive('json')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow transition cursor-pointer"
                  >
                    <UploadCloud size={14} className={isUploadingDrive ? 'animate-spin' : ''} />
                    <span>{isUploadingDrive ? 'Backing Up All Files...' : '⚡ Backup All Files (JSON + SQL)'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isUploadingDrive}
                      onClick={() => onBackupToDrive('json')}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--panel-hover)] hover:bg-[var(--steel-line)] disabled:opacity-50 text-[var(--text)] text-xs font-semibold border border-[var(--steel-line)] transition cursor-pointer"
                    >
                      <span>JSON Only</span>
                    </button>

                    <button
                      type="button"
                      disabled={isUploadingDrive}
                      onClick={() => onBackupToDrive('sql')}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--panel-hover)] hover:bg-[var(--steel-line)] disabled:opacity-50 text-[var(--text)] text-xs font-semibold border border-[var(--steel-line)] transition cursor-pointer"
                    >
                      <span>SQL Only</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToBackupTab('google_drive');
                      }}
                      className="flex items-center gap-1 text-xs text-sky-400 hover:underline px-2 py-1.5 transition cursor-pointer ml-1"
                    >
                      <span>Explore</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[var(--text-dim)] p-2.5 rounded-lg bg-[var(--panel)] border border-dashed border-[var(--steel-line)]">
                Connect Google Drive to safely store full point-in-time JSON database snapshots and PostgreSQL schema dumps for instant cloud disaster recovery.
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--steel-line)] bg-[var(--panel-raised)]">
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-dim)] font-mono">
            <Zap size={13} className="text-amber-400" />
            <span>Authorized Owner: umarzaman7777777@gmail.com</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToBackupTab('cloud_status');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel-hover)] transition cursor-pointer"
            >
              Full Diagnostics
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[var(--yellow)] hover:bg-[var(--yellow)]/90 text-black text-xs font-bold transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
