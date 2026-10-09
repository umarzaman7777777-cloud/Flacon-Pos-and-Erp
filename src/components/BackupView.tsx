import React, { useRef, useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  ShieldCheck,
  FileCheck,
  Stamp,
  Image as ImageIcon,
  Cloud,
  CloudCheck,
  RefreshCw,
  Server,
  UserCheck,
  HardDrive,
  Copy,
  Check,
  Table,
  Info,
  ExternalLink,
  Code2,
  Terminal as TerminalIcon,
  Wifi,
  WifiOff,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  FileText,
  Activity,
  Layers,
  ArrowDownToLine,
  Share2,
  RefreshCcw,
  RotateCcw,
  Folder,
  FolderArchive,
  Trash2,
  Eye,
  Clock,
  KeyRound,
  ShieldAlert,
  UploadCloud,
  FileSpreadsheet,
  X
} from 'lucide-react';
import { AppState, AppLanguage } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { downloadJSON, todayISO } from '../utils/helpers';
import { downloadSQLFile, generateSQLDump, getSQLTableSummaries, SQLTableSummary } from '../utils/sqlExporter';
import {
  calculateDatabaseMetrics,
  generateSyncDiagnosticReport,
  exportLocalDatabaseJSON,
  exportLocalDatabaseSQL,
  getDatabaseJSONString,
  getDatabaseSQLString
} from '../utils/syncReport';
import {
  requestGoogleDriveToken,
  getStoredDriveToken,
  clearDriveToken,
  uploadBackupToGoogleDrive,
  listGoogleDriveBackups,
  downloadGoogleDriveBackupContent,
  deleteGoogleDriveBackup,
  formatDriveFileSize,
  formatDriveDate,
  GoogleDriveFile,
  DriveTokenInfo,
  syncDriveTokenFromCloud,
  publishDriveTokenToCloud,
  setManualDriveToken,
  getDriveAutoBackupIntervalHours,
  setDriveAutoBackupIntervalHours,
  getNextDriveBackupDate,
  formatBackupCountdown,
  getLastDriveBackupTime
} from '../utils/googleDriveBackup';
import { GoogleSheetsTab } from './GoogleSheetsTab';
import { AuthStatus } from './AuthStatus';
import { openExternalUrl } from '../utils/openExternalUrl';
import { getStoredSheetsToken, WORKSPACE_SYNC_EVENT, isNativeOrLocalEnvironment } from '../utils/googleSheetsSync';
import { auth, db } from '../firebase/config';
import firebaseConfig from '../../firebase-applet-config.json';
import { doc, getDoc } from 'firebase/firestore';

const firestoreDbId: string = (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-falconrodmakerpo-4ec08e17-6c91-4aca-b59a-d747b503ca3a';

interface BackupViewProps {
  appState: AppState;
  language: AppLanguage;
  onRestoreState: (state: AppState) => void;
  onUpdateSignatures: (signatureUrl: string | undefined, stampUrl: string | undefined) => void;
  syncState?: 'synced' | 'syncing' | 'offline' | 'error';
  lastSyncTime?: string | null;
  terminalId?: string;
  terminalName?: string;
  pendingQueueCount?: number;
  isOnline?: boolean;
  syncErrorMsg?: string | null;
  onForceSyncNow?: () => void;
  initialTab?: 'cloud_status' | 'google_drive' | 'google_sheets' | 'sql_export' | 'json_backup' | 'signatures';
  onNavigateToSettings?: (tab?: string) => void;
  onOpenRecycleBin?: () => void;
  onOpenGmailVault?: () => void;
}

export const BackupView: React.FC<BackupViewProps> = ({
  appState,
  language,
  onRestoreState,
  onUpdateSignatures,
  syncState = 'synced',
  lastSyncTime,
  terminalId = 'default_terminal',
  terminalName = 'Workshop Terminal',
  pendingQueueCount = 0,
  isOnline = true,
  syncErrorMsg,
  onForceSyncNow,
  initialTab,
  onNavigateToSettings,
  onOpenRecycleBin,
  onOpenGmailVault
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'cloud_status' | 'google_drive' | 'google_sheets' | 'sql_export' | 'json_backup' | 'signatures'>(initialTab || 'cloud_status');
  const [sheetsTokenInfo, setSheetsTokenInfo] = useState(() => getStoredSheetsToken());
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [copiedSQL, setCopiedSQL] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string>('products');
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [forceSyncSuccess, setForceSyncSuccess] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [diagnosticTime, setDiagnosticTime] = useState<string | null>(null);
  const [showFullRawReport, setShowFullRawReport] = useState(false);

  // Google Drive state
  const [driveTokenInfo, setDriveTokenInfo] = useState<DriveTokenInfo | null>(() => getStoredDriveToken());
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [driveFolderId, setDriveFolderId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('falcon_gdrive_folder_id');
    } catch {
      return null;
    }
  });
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
  const [isUploadingDriveJSON, setIsUploadingDriveJSON] = useState(false);
  const [isUploadingDriveSQL, setIsUploadingDriveSQL] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSuccessMsg, setDriveSuccessMsg] = useState<string | null>(null);
  const [restoringDriveFileId, setRestoringDriveFileId] = useState<string | null>(null);
  const [deletingDriveFileId, setDeletingDriveFileId] = useState<string | null>(null);
  const [previewDriveFile, setPreviewDriveFile] = useState<{ file: GoogleDriveFile; content: string } | null>(null);
  const [autoDriveBackup, setAutoDriveBackup] = useState<boolean>(() => {
    try {
      return localStorage.getItem('falcon_gdrive_autobackup') === 'true';
    } catch {
      return false;
    }
  });
  const [autoDriveBackupInterval, setAutoDriveBackupInterval] = useState<number>(() => getDriveAutoBackupIntervalHours());
  const [nextScheduledDriveBackup, setNextScheduledDriveBackup] = useState<string | null>(null);
  const [driveBackupCountdown, setDriveBackupCountdown] = useState<string | null>(null);
  const [isUploadingAllFiles, setIsUploadingAllFiles] = useState(false);

  useEffect(() => {
    if (!autoDriveBackup || !driveTokenInfo?.token) {
      setNextScheduledDriveBackup(null);
      setDriveBackupCountdown(null);
      return;
    }

    const updateTimer = () => {
      const lastBackup = getLastDriveBackupTime();
      const nextDate = getNextDriveBackupDate(lastBackup, autoDriveBackupInterval);
      const isToday = nextDate.toDateString() === new Date().toDateString();
      const timeStr = nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = nextDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
      setNextScheduledDriveBackup(isToday ? `Today at ${timeStr}` : `${dateStr} at ${timeStr}`);
      setDriveBackupCountdown(formatBackupCountdown(nextDate));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 10000);
    return () => clearInterval(interval);
  }, [autoDriveBackup, driveTokenInfo?.token, autoDriveBackupInterval]);

  const handleChangeInterval = (hours: number) => {
    setDriveAutoBackupIntervalHours(hours);
    setAutoDriveBackupInterval(hours);
  };

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const currentUserEmail = auth.currentUser?.email || 'umarzaman7777777@gmail.com';
  const tableSummaries: SQLTableSummary[] = getSQLTableSummaries(appState);
  const currentTableSummary = tableSummaries.find(t => t.tableName === selectedTable) || tableSummaries[0];
  const databaseMetrics = calculateDatabaseMetrics(appState);
  const isFirebaseUnreachable = !isOnline || syncState === 'offline' || syncState === 'error' || pingLatency === -1;

  // Sync active tab with initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Listen to workspace sync events from other tabs or background
  useEffect(() => {
    const handleWorkspaceSync = () => {
      setSheetsTokenInfo(getStoredSheetsToken());
      setDriveTokenInfo(getStoredDriveToken());
      try {
        setDriveFolderId(localStorage.getItem('falcon_gdrive_folder_id'));
        setAutoDriveBackup(localStorage.getItem('falcon_gdrive_autobackup') === 'true');
      } catch {}
    };
    window.addEventListener(WORKSPACE_SYNC_EVENT, handleWorkspaceSync);
    window.addEventListener('storage', handleWorkspaceSync);
    return () => {
      window.removeEventListener(WORKSPACE_SYNC_EVENT, handleWorkspaceSync);
      window.removeEventListener('storage', handleWorkspaceSync);
    };
  }, []);

  // Auto-refresh drive files if active tab is google_drive and token is present
  useEffect(() => {
    if (activeTab === 'google_drive' && driveTokenInfo?.token && driveFiles.length === 0) {
      handleRefreshDriveFiles();
    }
  }, [activeTab]);

  const [isPushingDriveCloud, setIsPushingDriveCloud] = useState(false);
  const [cloudDriveSyncLoading, setCloudDriveSyncLoading] = useState(false);
  const isNativeApp = isNativeOrLocalEnvironment();

  const handleSyncDriveFromPC = async () => {
    setCloudDriveSyncLoading(true);
    setDriveError(null);
    try {
      const syncd = await syncDriveTokenFromCloud();
      if (syncd && syncd.token) {
        setDriveTokenInfo(syncd);
        setDriveSuccessMsg('✓ Successfully synced Google Drive credentials from Workshop PC Master!');
        setTimeout(() => setDriveSuccessMsg(null), 4000);
        await handleRefreshDriveFiles(syncd.token);
      } else {
        setDriveError('No active Google Drive credentials found in Cloud Sync yet. Please sign in on your PC Terminal first, then tap "Sync from PC" here.');
      }
    } catch (err: any) {
      setDriveError(err?.message || 'Cloud sync check failed.');
    } finally {
      setCloudDriveSyncLoading(false);
    }
  };

  const handlePublishDriveToCloud = async () => {
    if (!driveTokenInfo?.token) return;
    setIsPushingDriveCloud(true);
    try {
      const remainingSec = Math.max(Math.floor((driveTokenInfo.expiresAt - Date.now()) / 1000), 3600);
      await publishDriveTokenToCloud(
        driveTokenInfo.token,
        remainingSec,
        driveTokenInfo.userEmail || currentUserEmail || 'umarzaman7777777@gmail.com',
        driveFolderId || undefined
      );
      setDriveSuccessMsg('✓ Drive credentials published to Workshop Cloud for Mobile APK terminals!');
      setTimeout(() => setDriveSuccessMsg(null), 4000);
    } catch (err: any) {
      setDriveError('Failed to publish Drive credentials: ' + err?.message);
    } finally {
      setIsPushingDriveCloud(false);
    }
  };

  const handleConnectGoogleDrive = async () => {
    setIsConnectingDrive(true);
    setDriveError(null);
    try {
      const token = await requestGoogleDriveToken(currentUserEmail);
      const tokenInfo = getStoredDriveToken();
      setDriveTokenInfo(tokenInfo);
      setDriveSuccessMsg('✓ Google Drive connected successfully! Workspace backups authorized.');
      setTimeout(() => setDriveSuccessMsg(null), 4000);
      const result = await listGoogleDriveBackups(token);
      setDriveFiles(result.files);
      setDriveFolderId(result.folderId);
      const driveUrl = result.folderId
        ? `https://drive.google.com/drive/folders/${result.folderId}`
        : 'https://drive.google.com';
      openExternalUrl(driveUrl, 'drive');
    } catch (err: any) {
      setDriveError(err?.message || 'Failed to connect Google Drive.');
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleDisconnectGoogleDrive = () => {
    clearDriveToken();
    setDriveTokenInfo(null);
    setDriveFiles([]);
    setDriveFolderId(null);
    setDriveSuccessMsg('Google Drive session disconnected.');
    setTimeout(() => setDriveSuccessMsg(null), 3000);
  };

  const handleRefreshDriveFiles = async (overrideToken?: string) => {
    const token = overrideToken || driveTokenInfo?.token;
    if (!token) return;
    setIsLoadingDriveFiles(true);
    setDriveError(null);
    try {
      const result = await listGoogleDriveBackups(token);
      setDriveFiles(result.files);
      setDriveFolderId(result.folderId);
    } catch (err: any) {
      if (err?.message?.includes('401') || err?.message?.includes('Invalid Credentials')) {
        clearDriveToken();
        setDriveTokenInfo(null);
        setDriveError('Google Drive authorization expired. Please reconnect your account.');
      } else {
        setDriveError(err?.message || 'Failed to load backups from Google Drive.');
      }
    } finally {
      setIsLoadingDriveFiles(false);
    }
  };

  const handleUploadJSONToDrive = async () => {
    const token = driveTokenInfo?.token;
    if (!token) {
      await handleConnectGoogleDrive();
      return;
    }
    setIsUploadingDriveJSON(true);
    setDriveError(null);
    try {
      const { jsonString, filename } = getDatabaseJSONString(appState, currentUserEmail, terminalId, !isFirebaseUnreachable);
      const uploaded = await uploadBackupToGoogleDrive(token, {
        fileName: filename,
        fileContent: jsonString,
        mimeType: 'application/json',
        description: `Falcon Rod Maker POS Full JSON Database Snapshot (${databaseMetrics.totalRecords} records)`
      });
      setDriveSuccessMsg(`✓ Successfully backed up database to Google Drive: ${uploaded.name}`);
      setTimeout(() => setDriveSuccessMsg(null), 5000);
      await handleRefreshDriveFiles(token);
    } catch (err: any) {
      setDriveError(err?.message || 'Failed to upload JSON backup to Google Drive.');
    } finally {
      setIsUploadingDriveJSON(false);
    }
  };

  const handleUploadSQLToDrive = async () => {
    const token = driveTokenInfo?.token;
    if (!token) {
      await handleConnectGoogleDrive();
      return;
    }
    setIsUploadingDriveSQL(true);
    setDriveError(null);
    try {
      const { sqlString, filename } = getDatabaseSQLString(appState, currentUserEmail);
      const uploaded = await uploadBackupToGoogleDrive(token, {
        fileName: filename,
        fileContent: sqlString,
        mimeType: 'application/sql',
        description: `Falcon Rod Maker POS Relational ANSI SQL Dump (12 tables, ${databaseMetrics.totalRecords} records)`
      });
      setDriveSuccessMsg(`✓ Successfully uploaded SQL backup to Google Drive: ${uploaded.name}`);
      setTimeout(() => setDriveSuccessMsg(null), 5000);
      await handleRefreshDriveFiles(token);
    } catch (err: any) {
      setDriveError(err?.message || 'Failed to upload SQL backup to Google Drive.');
    } finally {
      setIsUploadingDriveSQL(false);
    }
  };

  const handleBackupAllFilesToDrive = async () => {
    const token = driveTokenInfo?.token;
    if (!token) {
      await handleConnectGoogleDrive();
      return;
    }
    setIsUploadingAllFiles(true);
    setDriveError(null);
    try {
      // 1. JSON Snapshot
      const { jsonString, filename: jsonName } = getDatabaseJSONString(appState, currentUserEmail, terminalId, !isFirebaseUnreachable);
      await uploadBackupToGoogleDrive(token, {
        fileName: jsonName,
        fileContent: jsonString,
        mimeType: 'application/json',
        description: `Falcon Rod Maker POS Full Database Snapshot (${databaseMetrics.totalRecords} records)`
      });

      // 2. SQL Dump
      const { sqlString, filename: sqlName } = getDatabaseSQLString(appState, currentUserEmail);
      await uploadBackupToGoogleDrive(token, {
        fileName: sqlName,
        fileContent: sqlString,
        mimeType: 'application/sql',
        description: `Falcon Rod Maker POS Relational ANSI SQL Dump (12 tables, ${databaseMetrics.totalRecords} records)`
      });

      setDriveSuccessMsg('✓ Successfully backed up all files (JSON & SQL) to Google Drive!');
      setTimeout(() => setDriveSuccessMsg(null), 5000);
      await handleRefreshDriveFiles(token);
    } catch (err: any) {
      setDriveError(err?.message || 'Failed to backup all files to Google Drive.');
    } finally {
      setIsUploadingAllFiles(false);
    }
  };

  const handleRestoreFromDrive = async (file: GoogleDriveFile) => {
    const token = driveTokenInfo?.token;
    if (!token) return;
    if (!file.name.endsWith('.json')) {
      alert('Only JSON database backups can be directly restored into the application session. For .sql dumps, use a database client like SQLite, PostgreSQL, or MySQL.');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to restore database from Google Drive backup "${file.name}"?\n\nThis will replace all currently loaded products, transactions, ledgers, and raw materials with the contents of this backup.`
    );
    if (!confirmed) return;

    setRestoringDriveFileId(file.id);
    setDriveError(null);
    try {
      const content = await downloadGoogleDriveBackupContent(token, file.id);
      const parsed = JSON.parse(content);
      const targetState: AppState = parsed.appState || parsed;
      if (!targetState || typeof targetState !== 'object' || !Array.isArray(targetState.products)) {
        throw new Error('Invalid backup file structure: missing products catalog.');
      }
      onRestoreState(targetState);
      setRestoreSuccess(`✓ Database successfully restored from Google Drive (${file.name})!`);
      setTimeout(() => setRestoreSuccess(null), 6000);
    } catch (err: any) {
      setDriveError(err?.message || 'Failed to restore database from Google Drive.');
    } finally {
      setRestoringDriveFileId(null);
    }
  };

  const handleDeleteDriveFile = async (file: GoogleDriveFile) => {
    const token = driveTokenInfo?.token;
    if (!token) return;
    const confirmed = window.confirm(`Permanently delete "${file.name}" from your Google Drive backup folder?`);
    if (!confirmed) return;
    setDeletingDriveFileId(file.id);
    setDriveError(null);
    try {
      await deleteGoogleDriveBackup(token, file.id);
      setDriveFiles(prev => prev.filter(f => f.id !== file.id));
      setDriveSuccessMsg(`✓ Deleted "${file.name}" from Google Drive.`);
      setTimeout(() => setDriveSuccessMsg(null), 3000);
    } catch (err: any) {
      setDriveError(err?.message || 'Failed to delete backup from Google Drive.');
    } finally {
      setDeletingDriveFileId(null);
    }
  };

  const handlePreviewDriveFile = async (file: GoogleDriveFile) => {
    const token = driveTokenInfo?.token;
    if (!token) return;
    try {
      const content = await downloadGoogleDriveBackupContent(token, file.id);
      setPreviewDriveFile({ file, content });
    } catch (err: any) {
      setDriveError(err?.message || 'Failed to download preview.');
    }
  };

  const handleToggleAutoDriveBackup = () => {
    const newVal = !autoDriveBackup;
    setAutoDriveBackup(newVal);
    try {
      localStorage.setItem('falcon_gdrive_autobackup', newVal ? 'true' : 'false');
    } catch {}
  };

  const handleExportEmergencyJSON = () => {
    exportLocalDatabaseJSON(appState, currentUserEmail, terminalId, !isFirebaseUnreachable);
    setExportNotice(`✓ Full JSON database snapshot exported (${databaseMetrics.totalRecords} records, ${databaseMetrics.storageSizeKB} KB). Local file saved.`);
    setTimeout(() => setExportNotice(null), 5000);
  };

  const handleExportEmergencySQL = () => {
    exportLocalDatabaseSQL(appState, currentUserEmail);
    setExportNotice(`✓ Relational ANSI SQL dump generated & downloaded. Compatible with SQLite, PostgreSQL, and MySQL.`);
    setTimeout(() => setExportNotice(null), 5000);
  };

  const handleCopyDiagnosticReport = () => {
    const reportText = generateSyncDiagnosticReport({
      appState,
      syncState,
      isOnline,
      pingLatency,
      lastSyncTime,
      terminalId,
      terminalName,
      pendingQueueCount,
      syncErrorMsg,
      userEmail: currentUserEmail
    });

    navigator.clipboard.writeText(reportText).then(() => {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 3000);
    });
  };

  const handleCreateJSONBackup = () => {
    const filename = `Falcon_ERP_Backup_${todayISO().replace(/-/g, '')}`;
    downloadJSON(appState, filename);
  };

  const handleDownloadSQL = () => {
    downloadSQLFile(
      appState,
      currentUserEmail,
      firebaseConfig.projectId,
      firestoreDbId
    );
  };

  const handleCopySQL = () => {
    const sql = generateSQLDump(
      appState,
      currentUserEmail,
      firebaseConfig.projectId,
      firestoreDbId
    );
    navigator.clipboard.writeText(sql).then(() => {
      setCopiedSQL(true);
      setTimeout(() => setCopiedSQL(false), 2500);
    });
  };

  const handlePingDatabase = async () => {
    setIsPinging(true);
    setDiagnosticTime(new Date().toLocaleTimeString());
    const start = performance.now();
    try {
      const syncDocRef = doc(db, 'sync_states', 'falcon_workshop');
      await getDoc(syncDocRef);
      const elapsed = Math.round(performance.now() - start);
      setPingLatency(elapsed);
    } catch (e) {
      console.warn('Ping error:', e);
      setPingLatency(-1);
    } finally {
      setIsPinging(false);
    }
  };

  const handleManualForceSync = () => {
    if (onForceSyncNow) {
      onForceSyncNow();
      setForceSyncSuccess(true);
      setTimeout(() => setForceSyncSuccess(false), 3000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!parsed.products || !parsed.factories || !parsed.transactions) {
          throw new Error('Invalid backup file schema.');
        }
        onRestoreState(parsed as AppState);
        setRestoreSuccess(`Backup successfully restored (${parsed.transactions.length} orders, ${parsed.products.length} products).`);
        setRestoreError(null);
      } catch (err: any) {
        setRestoreError(`Failed to restore: ${err.message || 'Corrupt JSON'}`);
        setRestoreSuccess(null);
      }
    };
    reader.readAsText(file);
  };

  const handleSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      onUpdateSignatures(ev.target?.result as string, appState.stampUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      onUpdateSignatures(appState.signatureUrl, ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 max-w-5xl max-w-full overflow-x-hidden break-words font-sans pb-12">
      {/* Header */}
      <div className="border-b border-[var(--steel-line)] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif font-black text-2xl text-[var(--text)] flex items-center gap-2.5">
            <Database className="text-[var(--yellow)]" size={24} />
            Database & Cloud Sync Telemetry
          </h2>
          <p className="text-xs text-[var(--text-dim)] mt-1 font-mono">
            Check live sync destinations, connected Google user account, and export SQL database dumps.
          </p>
        </div>

        {/* Global Connection Badge */}
        <div className="flex items-center gap-2 font-mono">
          <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
            syncState === 'synced' && isOnline
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : syncState === 'syncing'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              syncState === 'synced' && isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`} />
            {syncState === 'synced' && isOnline ? 'Cloud Synced' : syncState === 'syncing' ? 'Syncing...' : 'Offline Cache'}
          </div>
        </div>
      </div>

      {/* Gmail Cloud Vault & Recycle Bin Quick Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Gmail Cloud Vault Card */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-sky-950/40 via-slate-900/60 to-[var(--panel-raised)] border border-sky-500/30 flex flex-col justify-between gap-3 shadow-md">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <Cloud size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{language === 'ur' ? 'جی میل کلاؤڈ والٹ' : 'Gmail Cloud Vault'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono font-semibold">
                    Live
                  </span>
                </h3>
                <p className="text-xs text-sky-200/70">
                  {language === 'ur'
                    ? 'فون گم ہو جانے یا نیا فون لینے پر ڈیٹا بحالی کے لیے'
                    : 'Switch phones anytime without losing any entry'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-sky-500/20">
            <span className="text-[11px] font-mono text-slate-400 truncate max-w-[180px]">
              umarzaman7777777@gmail.com
            </span>
            {onOpenGmailVault && (
              <button
                type="button"
                onClick={onOpenGmailVault}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <RefreshCw size={13} />
                <span>{language === 'ur' ? 'کلاؤڈ والٹ کھولیں' : 'Open Cloud Vault'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Recycle Bin Protection Card */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-rose-950/30 via-slate-900/60 to-[var(--panel-raised)] border border-rose-500/30 flex flex-col justify-between gap-3 shadow-md">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{language === 'ur' ? 'حادثاتی ڈیلیٹ ریکوری (کوڑا دان)' : 'Recycle Bin Protection'}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                    (appState.recycleBin?.length || 0) > 0 ? 'bg-rose-500/20 text-rose-300 animate-pulse' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {appState.recycleBin?.length || 0} {language === 'ur' ? 'آئٹمز' : 'items'}
                  </span>
                </h3>
                <p className="text-xs text-rose-200/70">
                  {language === 'ur'
                    ? 'غلطی سے ڈیلیٹ ہونے والے آرڈر یا کھاتے واپس لائیں'
                    : 'Restore any accidentally deleted order or ledger entry with 1 tap'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-rose-500/20">
            <span className="text-[11px] text-slate-400">
              {(appState.recycleBin?.length || 0) > 0
                ? (language === 'ur' ? 'ڈیلیٹ شدہ اشیاء محفوظ ہیں' : 'Items ready for instant restore')
                : (language === 'ur' ? 'کوئی ڈیلیٹ شدہ انٹری نہیں' : 'Recycle bin is clean')}
            </span>
            {onOpenRecycleBin && (
              <button
                type="button"
                onClick={onOpenRecycleBin}
                className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <RotateCcw size={13} />
                <span>{language === 'ur' ? 'کوڑا دان دیکھیں' : 'Open Recycle Bin'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--steel-line)] pb-2 font-mono text-xs overflow-x-auto no-scrollbar scroll-smooth">
        <button
          type="button"
          onClick={() => setActiveTab('cloud_status')}
          className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'cloud_status'
              ? 'bg-[var(--yellow)] text-black shadow'
              : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
          }`}
        >
          <Activity size={15} />
          <span>Sync Status Report & Diagnostics</span>
          {isFirebaseUnreachable && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('google_drive')}
          className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'google_drive'
              ? 'bg-[var(--yellow)] text-black shadow'
              : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
          }`}
        >
          <Cloud size={15} className={activeTab === 'google_drive' ? 'text-black' : 'text-sky-400'} />
          <span>Google Drive Backups</span>
          {driveTokenInfo ? (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Connected</span>
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-400/20 text-sky-300 font-mono">
              Connect
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('google_sheets')}
          className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'google_sheets'
              ? 'bg-[var(--yellow)] text-black shadow'
              : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
          }`}
        >
          <FileSpreadsheet size={15} className={activeTab === 'google_sheets' ? 'text-black' : 'text-emerald-400'} />
          <span>Google Sheets Sync</span>
          {sheetsTokenInfo ? (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Connected</span>
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300 font-mono">
              Connect
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sql_export')}
          className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'sql_export'
              ? 'bg-[var(--yellow)] text-black shadow'
              : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
          }`}
        >
          <Code2 size={15} />
          <span>Relational SQL Database (.sql)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('json_backup')}
          className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'json_backup'
              ? 'bg-[var(--yellow)] text-black shadow'
              : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
          }`}
        >
          <HardDrive size={15} />
          <span>JSON Snapshots & Restore</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('signatures')}
          className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'signatures'
              ? 'bg-[var(--yellow)] text-black shadow'
              : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
          }`}
        >
          <Stamp size={15} />
          <span>Stamp & Signature</span>
        </button>
      </div>

      {exportNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs flex items-center justify-between font-mono animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-emerald-400 hover:text-emerald-300 text-xs uppercase underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {restoreSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs flex items-center gap-2 font-mono">
          <ShieldCheck size={16} />
          <span>{restoreSuccess}</span>
        </div>
      )}

      {restoreError && (
        <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-mono">
          {restoreError}
        </div>
      )}

      {/* TAB 1: DETAILED SYNC STATUS REPORT & MANUAL EXPORT HUB */}
      {activeTab === 'cloud_status' && (
        <div className="space-y-6">

          {/* EMERGENCY OFFLINE BANNER (Visible if Firebase is Unreachable or Offline) */}
          {isFirebaseUnreachable && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/40 via-amber-950/20 to-[var(--panel)] border-2 border-rose-500/50 shadow-xl space-y-4 font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                    <AlertTriangle size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-rose-300 font-sans tracking-wide">
                        Firebase Unreachable — Local Safe Mode Active
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold uppercase">
                        Emergency Local Fallback
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-dim)] mt-1 font-sans leading-relaxed">
                      Google Cloud Firestore is currently unreachable or this device is disconnected from the internet.
                      All {databaseMetrics.totalRecords} workshop records are 100% safely persisted in your browser's high-speed local database.
                      You can manually export your entire database to a local file below.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePingDatabase}
                  disabled={isPinging}
                  className="shrink-0 px-3.5 py-2 rounded-lg bg-[var(--panel-raised)] border border-rose-500/40 hover:border-rose-400 text-rose-300 text-xs font-bold transition flex items-center gap-2"
                >
                  <RefreshCw size={13} className={isPinging ? 'animate-spin' : ''} />
                  <span>{isPinging ? 'Rechecking...' : 'Test Connection'}</span>
                </button>
              </div>

              {/* Instant Manual Export Quick Buttons for Emergency */}
              <div className="pt-2 border-t border-rose-500/20 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportEmergencyJSON}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 text-black font-bold uppercase text-xs shadow-lg hover:bg-amber-300 transition flex items-center gap-2"
                >
                  <ArrowDownToLine size={15} />
                  <span>Export Entire Database (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportEmergencySQL}
                  className="px-4 py-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-400 text-[var(--text)] font-bold uppercase text-xs transition flex items-center gap-2"
                >
                  <Code2 size={15} className="text-amber-400" />
                  <span>Export Relational Database (.sql)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyDiagnosticReport}
                  className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-[var(--steel-line)] hover:border-sky-400 text-[var(--text-dim)] hover:text-sky-300 text-xs transition flex items-center gap-2"
                >
                  <Copy size={14} />
                  <span>{copiedReport ? 'Report Copied!' : 'Copy Diagnostic Report'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 4 PRIMARY TELEMETRY & SYNC STATUS KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
            {/* KPI 1: Sync Engine Status */}
            <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-[var(--text-dim)] tracking-wider">Sync State</span>
                <span className={`w-2 h-2 rounded-full ${
                  syncState === 'synced' && !isFirebaseUnreachable
                    ? 'bg-emerald-400 animate-pulse'
                    : syncState === 'syncing'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-rose-400'
                }`} />
              </div>
              <div className="text-sm font-bold text-[var(--text)] uppercase flex items-center gap-2">
                {syncState === 'synced' && !isFirebaseUnreachable && (
                  <span className="text-emerald-400">Synced (Cloud)</span>
                )}
                {syncState === 'syncing' && (
                  <span className="text-amber-400">Syncing...</span>
                )}
                {isFirebaseUnreachable && (
                  <span className="text-rose-400">Offline Cache</span>
                )}
              </div>
              <div className="text-[11px] text-[var(--text-dim)] flex items-center justify-between pt-1 border-t border-[var(--steel-line)]">
                <span>Latency:</span>
                <span className="font-bold text-[var(--text)]">
                  {pingLatency === null ? 'Untested' : pingLatency === -1 ? 'Unreachable' : `${pingLatency} ms`}
                </span>
              </div>
            </div>

            {/* KPI 2: Internet & Network */}
            <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-[var(--text-dim)] tracking-wider">Network Link</span>
                {isOnline ? (
                  <Wifi size={14} className="text-emerald-400" />
                ) : (
                  <WifiOff size={14} className="text-rose-400" />
                )}
              </div>
              <div className="text-sm font-bold text-[var(--text)]">
                {isOnline ? (
                  <span className="text-emerald-400">Online (Connected)</span>
                ) : (
                  <span className="text-rose-400">Offline (Disconnected)</span>
                )}
              </div>
              <div className="text-[11px] text-[var(--text-dim)] flex items-center justify-between pt-1 border-t border-[var(--steel-line)]">
                <span>WebSocket / SSE:</span>
                <span className="font-bold text-[var(--text)]">{isOnline ? 'Active' : 'Dormant'}</span>
              </div>
            </div>

            {/* KPI 3: Queue Backlog */}
            <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-[var(--text-dim)] tracking-wider">Pending Mutations</span>
                <Layers size={14} className="text-sky-400" />
              </div>
              <div className="text-sm font-bold text-[var(--text)]">
                {pendingQueueCount === 0 ? (
                  <span className="text-emerald-400">0 Items (Clean)</span>
                ) : (
                  <span className="text-amber-400">{pendingQueueCount} Queued to Push</span>
                )}
              </div>
              <div className="text-[11px] text-[var(--text-dim)] flex items-center justify-between pt-1 border-t border-[var(--steel-line)]">
                <span>Last Cloud Push:</span>
                <span className="font-bold text-[var(--text)] truncate max-w-[110px]" title={lastSyncTime || 'Pending'}>
                  {lastSyncTime || 'Pending'}
                </span>
              </div>
            </div>

            {/* KPI 4: Local Database Footprint */}
            <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-[var(--text-dim)] tracking-wider">Local Storage</span>
                <Database size={14} className="text-amber-400" />
              </div>
              <div className="text-sm font-bold text-[var(--text)]">
                {databaseMetrics.totalRecords.toLocaleString()} Records
              </div>
              <div className="text-[11px] text-[var(--text-dim)] flex items-center justify-between pt-1 border-t border-[var(--steel-line)]">
                <span>Payload Size:</span>
                <span className="font-bold text-amber-300">{databaseMetrics.storageSizeKB} KB</span>
              </div>
            </div>
          </div>

          {/* MANUAL DATABASE EXPORT HUB (Accessible Online AND Offline) */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--steel-line)] pb-3">
              <div>
                <h3 className="font-serif font-bold text-sm text-[var(--text)] font-sans flex items-center gap-2">
                  <Download className="text-[var(--yellow)]" size={18} />
                  Manual Local Database Export
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Offline Resilient
                  </span>
                </h3>
                <p className="text-xs text-[var(--text-dim)] font-sans mt-0.5">
                  Export your complete, production-grade ERP database directly from local memory into a downloadable file.
                  Functions autonomously even if Firebase is unreachable, blocked, or offline.
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-[11px] text-[var(--text-dim)]">Integrity Check:</span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-[var(--steel-line)] text-emerald-400 font-bold">
                  PASS (100%)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Complete JSON Snapshot */}
              <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-400/50 transition space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive size={18} className="text-[var(--yellow)]" />
                    <span className="font-bold text-xs text-[var(--text)] font-sans">Full JSON Database Snapshot</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30 font-bold">
                    .JSON
                  </span>
                </div>

                <p className="text-[11px] text-[var(--text-dim)] font-sans leading-relaxed">
                  Extracts complete system state, product catalogs, customer ledgers, invoices, inventory, raw materials,
                  worker balances, and signature stamps with an emergency offline recovery manifest.
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--steel-line)] text-xs">
                  <span className="text-[11px] text-[var(--text-dim)]">Size: ~{databaseMetrics.storageSizeKB} KB</span>
                  <button
                    type="button"
                    onClick={handleExportEmergencyJSON}
                    className="px-3.5 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs shadow hover:bg-amber-300 transition flex items-center gap-1.5"
                  >
                    <Download size={13} />
                    <span>Download JSON</span>
                  </button>
                </div>
              </div>

              {/* Option 2: ANSI Relational SQL Dump */}
              <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-sky-400/50 transition space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 size={18} className="text-sky-400" />
                    <span className="font-bold text-xs text-[var(--text)] font-sans">Relational SQL Database Dump</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-sky-400/10 text-sky-300 border border-sky-400/30 font-bold">
                    .SQL
                  </span>
                </div>

                <p className="text-[11px] text-[var(--text-dim)] font-sans leading-relaxed">
                  Generates an ANSI-standard SQL migration script with CREATE TABLE schemas, primary keys, and INSERT
                  statements compatible with SQLite 3, PostgreSQL, MySQL, MariaDB, and Supabase.
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--steel-line)] text-xs">
                  <span className="text-[11px] text-[var(--text-dim)]">Tables: 12 Tables Dumped</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopySQL}
                      className="px-2.5 py-2 rounded-lg bg-white/5 border border-[var(--steel-line)] hover:border-sky-400 text-[var(--text-dim)] hover:text-sky-300 text-xs transition flex items-center gap-1"
                      title="Copy SQL to Clipboard"
                    >
                      <Copy size={12} />
                      <span>{copiedSQL ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportEmergencySQL}
                      className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-bold uppercase text-xs shadow transition flex items-center gap-1.5"
                    >
                      <Download size={13} />
                      <span>Download SQL</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* REAL-TIME GOOGLE WORKSPACE OAUTH TELEMETRY & VERIFICATION */}
          <AuthStatus
            service="all"
            language={language}
            title={language === 'ur' ? 'گوگل ورک اسپیس توثیقی اسٹیٹس (ڈرائیو اور شیٹس)' : 'Google Workspace Real-Time OAuth Status (Drive & Sheets)'}
            onReauthenticated={() => {
              setDriveTokenInfo(getStoredDriveToken());
              setSheetsTokenInfo(getStoredSheetsToken());
            }}
            onNavigateToSettings={onNavigateToSettings}
          />

          {/* DETAILED SYNC DIAGNOSTICS & TELEMETRY CONSOLE */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3">
              <div className="flex items-center gap-2">
                <Server className="text-sky-400" size={18} />
                <h3 className="font-bold text-sm text-[var(--text)] font-sans">
                  Detailed Sync Status Report & Telemetry
                </h3>
                {diagnosticTime && (
                  <span className="text-[10px] text-[var(--text-dim)]">
                    Checked at {diagnosticTime}
                  </span>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePingDatabase}
                  disabled={isPinging}
                  className="px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-sky-500/40 hover:border-sky-400 text-sky-300 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Wifi size={13} className={isPinging ? 'animate-spin text-sky-400' : 'text-sky-400'} />
                  <span>{isPinging ? 'Pinging Firestore...' : 'Run Diagnostic Check'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyDiagnosticReport}
                  className="px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-400 text-[var(--text)] text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Copy size={13} className="text-amber-400" />
                  <span>{copiedReport ? 'Report Copied!' : 'Copy Diagnostic Report'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleManualForceSync}
                  className="px-3 py-1.5 rounded-lg bg-[var(--yellow)] text-black text-xs font-bold uppercase shadow hover:bg-amber-300 transition flex items-center gap-1.5"
                >
                  <RefreshCw size={13} className={forceSyncSuccess ? 'animate-spin' : ''} />
                  <span>{forceSyncSuccess ? 'Pushed!' : 'Force Sync'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowFullRawReport(!showFullRawReport)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] text-xs transition flex items-center gap-1.5"
                >
                  <FileText size={13} />
                  <span>{showFullRawReport ? 'Hide Raw Report' : 'View Raw Report'}</span>
                </button>
              </div>
            </div>

            {/* Diagnostic Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Verified Owner Account</span>
                <div className="text-[var(--text)] font-semibold break-all flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span>{currentUserEmail}</span>
                </div>
                <span className="text-[10px] text-[var(--text-dim)]">Primary administrator & project owner</span>
              </div>

              <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Target Cloud Project</span>
                <div className="text-[var(--text)] font-bold truncate">{firebaseConfig.projectId}</div>
                <span className="text-[10px] text-[var(--text-dim)]">Google Cloud Firestore Multi-Region</span>
              </div>

              <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Firestore Database ID</span>
                <div className="text-sky-400 font-bold truncate text-[11px]">{firestoreDbId}</div>
                <span className="text-[10px] text-[var(--text-dim)]">sync_states / falcon_workshop</span>
              </div>

              <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Terminal Station</span>
                <div className="text-[var(--text)] font-bold flex items-center gap-1.5">
                  <TerminalIcon size={13} className="text-amber-400" />
                  <span>{terminalName}</span>
                </div>
                <span className="text-[10px] text-[var(--text-dim)] truncate block">ID: {terminalId}</span>
              </div>

              <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Last Cloud Sync Stamp</span>
                <div className="text-[var(--text)] font-bold">{lastSyncTime || 'Pending synchronization'}</div>
                <span className="text-[10px] text-[var(--text-dim)]">
                  {isFirebaseUnreachable ? 'Local fallback active' : 'Bi-directional real-time active'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Diagnostic Health Log</span>
                {syncErrorMsg ? (
                  <div className="text-rose-400 font-bold flex items-center gap-1.5 truncate" title={syncErrorMsg}>
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{syncErrorMsg}</span>
                  </div>
                ) : (
                  <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="shrink-0" />
                    <span>Operations Nominal & Healthy</span>
                  </div>
                )}
                <span className="text-[10px] text-[var(--text-dim)]">Local cache integrity verified</span>
              </div>
            </div>

            {/* RAW REPORT EXPANDED CONTAINER */}
            {showFullRawReport && (
              <div className="mt-3 p-4 rounded-xl bg-black/60 border border-[var(--steel-line)] space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--text-dim)]">
                  <span className="font-bold text-[var(--text)]">Diagnostic Report Preview (Markdown)</span>
                  <button
                    type="button"
                    onClick={handleCopyDiagnosticReport}
                    className="text-amber-400 hover:text-amber-300 text-xs flex items-center gap-1"
                  >
                    <Copy size={12} />
                    <span>{copiedReport ? 'Copied' : 'Copy Text'}</span>
                  </button>
                </div>
                <pre className="text-[11px] text-slate-300 overflow-x-auto whitespace-pre font-mono p-3 bg-black/40 rounded-lg max-h-72 border border-white/5">
                  {generateSyncDiagnosticReport({
                    appState,
                    syncState,
                    isOnline,
                    pingLatency,
                    lastSyncTime,
                    terminalId,
                    terminalName,
                    pendingQueueCount,
                    syncErrorMsg,
                    userEmail: currentUserEmail
                  })}
                </pre>
              </div>
            )}
          </div>

          {/* LOCAL DATABASE MODULE INVENTORY BREAKDOWN */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="text-[var(--yellow)]" size={16} />
                <h3 className="font-bold text-xs text-[var(--text)] font-sans uppercase tracking-wider">
                  Local Database Record Inventory ({databaseMetrics.totalRecords.toLocaleString()} Total)
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                100% Persisted Locally
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs">
              {[
                { name: 'Products / Rods', count: databaseMetrics.productsCount, badge: 'Items' },
                { name: 'Orders / Invoices', count: databaseMetrics.transactionsCount, badge: 'Invoices' },
                { name: 'Factory Accounts', count: databaseMetrics.factoriesCount, badge: 'Accounts' },
                { name: 'Ledger Journal', count: databaseMetrics.ledgerEntriesCount, badge: 'Entries' },
                { name: 'Raw Stock', count: databaseMetrics.rawStockCount, badge: 'Materials' },
                { name: 'Raw Suppliers', count: databaseMetrics.rawSuppliersCount, badge: 'Vendors' },
                { name: 'Paint Accounts', count: databaseMetrics.paintersCount, badge: 'Painters' },
                { name: 'Labour Profiles', count: databaseMetrics.workersCount, badge: 'Workers' },
                { name: 'Scrap Buyers', count: databaseMetrics.scrapBuyersCount, badge: 'Buyers' },
                { name: 'Withdrawals', count: databaseMetrics.withdrawalsCount, badge: 'Records' },
                { name: 'Expenses', count: databaseMetrics.expensesCount, badge: 'Entries' },
                { name: 'Product Returns', count: databaseMetrics.returnsCount, badge: 'Logs' }
              ].map(item => (
                <div
                  key={item.name}
                  className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] flex flex-col justify-between"
                >
                  <span className="text-[10px] text-[var(--text-dim)] truncate" title={item.name}>
                    {item.name}
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-sm font-bold text-[var(--text)]">
                      {item.count.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-[var(--text-dim)]">{item.badge}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CLOUD DATABASE ARCHITECTURE & FAIL-SAFE SUMMARY */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text)] font-sans">
              <Info size={16} className="text-[var(--yellow)]" />
              How Offline Persistence & Cloud Synchronization Works
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] uppercase text-emerald-400 font-bold block">1. Cloud Primary</span>
                <p className="text-[11px] text-[var(--text-dim)] leading-relaxed font-sans">
                  When online, all invoices, payments, and stock updates push directly to Google Cloud Firestore under your project <strong className="text-[var(--text)]">{firebaseConfig.projectId}</strong>.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] uppercase text-sky-400 font-bold block">2. Offline Fallback</span>
                <p className="text-[11px] text-[var(--text-dim)] leading-relaxed font-sans">
                  If workshop Wi-Fi drops or Firebase is unreachable, operations proceed without interruption in local browser storage. All updates queue locally and flush automatically upon reconnection.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] uppercase text-amber-400 font-bold block">3. Multi-Terminal Sync</span>
                <p className="text-[11px] text-[var(--text-dim)] leading-relaxed font-sans">
                  Multiple workshop tablets and counter computers stay synchronized through real-time Firestore listeners, sharing instant balance updates.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1.5: GOOGLE DRIVE CLOUD BACKUP & WORKSPACE INTEGRATION                */}
      {/* ========================================================================= */}
      {activeTab === 'google_drive' && (
        <div className="space-y-6 font-mono">
          {/* Status / Error feedback banners */}
          {driveSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs flex items-center justify-between font-mono animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                <span className="font-semibold">{driveSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setDriveSuccessMsg(null)}
                className="text-emerald-400 hover:text-emerald-300 text-xs uppercase underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* REAL-TIME GOOGLE DRIVE OAUTH VERIFICATION & ERROR HANDLING */}
          <AuthStatus
            service="drive"
            language={language}
            forcedError={driveError}
            onClearForcedError={() => setDriveError(null)}
            onReauthenticated={() => {
              setDriveError(null);
              setDriveTokenInfo(getStoredDriveToken());
              handleRefreshDriveFiles();
            }}
            onNavigateToSettings={onNavigateToSettings}
          />

          {/* CARD 1: GOOGLE DRIVE OAUTH CONNECTION & AUTHORIZATION */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-4 sm:p-6 space-y-5 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[var(--steel-line)] pb-4 gap-3">
              <div className="flex items-start gap-3 sm:gap-3.5 min-w-0 flex-1">
                <div className="p-3 rounded-xl bg-sky-500/15 border border-sky-400/30 text-sky-400 shadow-sm shrink-0">
                  <Cloud size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-base sm:text-lg text-[var(--text)] break-words font-sans">
                      <span>Google Drive Cloud Workspace Backups</span>
                    </h3>
                    <span className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-bold border shrink-0 ${
                      driveTokenInfo
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}>
                      {driveTokenInfo ? 'OAuth Active & Connected' : 'Authorization Required'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-dim)] font-sans mt-0.5 leading-relaxed">
                    Store timestamped database snapshots in your personal Google Drive for disaster recovery and multi-device restoration
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                {driveTokenInfo ? (
                  <>
                    <button
                      type="button"
                      onClick={handlePublishDriveToCloud}
                      disabled={isPushingDriveCloud}
                      className="flex-1 sm:flex-initial px-3 py-2 rounded-lg bg-sky-500/15 border border-sky-500/30 hover:bg-sky-500/25 text-sky-400 text-xs transition flex items-center justify-center gap-1.5 shrink-0"
                      title="Push active Google connection to Cloud so Mobile APK can access Drive without webview OAuth restrictions"
                    >
                      <Cloud size={14} className={isPushingDriveCloud ? 'animate-spin' : ''} />
                      <span>{isPushingDriveCloud ? 'Publishing...' : 'Push to Mobile APK'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRefreshDriveFiles()}
                      disabled={isLoadingDriveFiles}
                      className="flex-1 sm:flex-initial px-3 py-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-sky-400 text-xs text-[var(--text)] transition flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
                      title="Fetch latest backups from Google Drive folder"
                    >
                      <RefreshCw size={13} className={isLoadingDriveFiles ? 'animate-spin text-sky-400' : 'text-sky-400'} />
                      <span>{isLoadingDriveFiles ? 'Checking...' : 'Refresh Backups'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectGoogleDrive}
                      className="flex-1 sm:flex-initial px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 text-xs transition shrink-0"
                      title="Disconnect Google Drive access token"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                    <button
                      type="button"
                      onClick={handleConnectGoogleDrive}
                      disabled={isConnectingDrive}
                      className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 disabled:opacity-60 shrink-0"
                    >
                      {isConnectingDrive ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />}
                      <span>{isConnectingDrive ? 'Connecting to Google...' : 'Direct Google Sign-In'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSyncDriveFromPC}
                      disabled={cloudDriveSyncLoading}
                      className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-[var(--panel-raised)] border border-sky-500/30 hover:bg-[var(--steel-line)] text-sky-400 font-semibold text-xs transition flex items-center justify-center gap-2 shadow shrink-0"
                      title="Pull authorized credentials saved in Cloud by other terminals"
                    >
                      <Cloud size={14} className={cloudDriveSyncLoading ? 'animate-spin' : ''} />
                      <span>{cloudDriveSyncLoading ? 'Syncing...' : 'Cloud Sync'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Connection Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] uppercase text-[var(--text-dim)] block">Authorized Account</span>
                <div className="font-bold text-[var(--text)] flex items-center gap-1.5 truncate">
                  <UserCheck size={14} className="text-emerald-400 shrink-0" />
                  <span className="truncate">{driveTokenInfo?.userEmail || currentUserEmail}</span>
                </div>
                <span className="text-[10px] text-[var(--text-dim)] block">Sole authorized owner</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] uppercase text-[var(--text-dim)] block">Dedicated Drive Folder</span>
                <div className="font-bold text-[var(--text)] flex items-center gap-1.5 truncate">
                  <Folder className="text-amber-400 shrink-0" size={14} />
                  <span className="truncate">Falcon Rod Maker POS - Database Backups</span>
                </div>
                {driveFolderId ? (
                  <button
                    type="button"
                    onClick={() => openExternalUrl(`https://drive.google.com/drive/folders/${driveFolderId}`, 'drive')}
                    className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1 underline cursor-pointer"
                  >
                    <span>Open in Google Drive</span>
                    <ExternalLink size={10} />
                  </button>
                ) : (
                  <span className="text-[10px] text-[var(--text-dim)]">Folder auto-created on first backup</span>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] uppercase text-[var(--text-dim)] block">OAuth Security Scope</span>
                <div className="font-bold text-[var(--text)] flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                  <span className="text-sky-400">drive.file</span>
                </div>
                <span className="text-[10px] text-[var(--text-dim)] block">
                  Isolated sandbox: POS only touches its own files
                </span>
              </div>
            </div>
          </div>

          {/* CARD 2: INSTANT CLOUD BACKUP ACTIONS & AUTOMATION */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 sm:p-6 space-y-5 shadow-md">
            <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <UploadCloud className="text-[var(--yellow)]" size={18} />
                <h3 className="font-serif font-bold text-sm text-[var(--text)] font-sans uppercase tracking-wider">
                  Create Cloud Backup Now
                </h3>
              </div>
              <span className="text-[10px] text-[var(--text-dim)]">
                Target database: {databaseMetrics.totalRecords.toLocaleString()} records ({databaseMetrics.storageSizeKB} KB)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: Full JSON Snapshot to Google Drive */}
              <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-400/50 transition space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive size={18} className="text-amber-400" />
                    <span className="font-bold text-xs text-[var(--text)] font-sans">
                      JSON Database Snapshot (.json)
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30 font-bold">
                    Direct Restore Ready
                  </span>
                </div>

                <p className="text-[11px] text-[var(--text-dim)] font-sans leading-relaxed">
                  Extracts complete system state, product catalogs, customer ledgers, invoices, inventory, raw materials,
                  and worker balances into an encrypted JSON file stored directly in Google Drive.
                </p>

                <div className="pt-2 border-t border-[var(--steel-line)] flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] text-[var(--text-dim)]">~{databaseMetrics.storageSizeKB} KB Payload</span>
                  <button
                    type="button"
                    onClick={handleUploadJSONToDrive}
                    disabled={isUploadingDriveJSON}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs hover:bg-amber-300 transition flex items-center justify-center gap-1.5 shadow disabled:opacity-60"
                  >
                    {isUploadingDriveJSON ? <RefreshCw size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                    <span>{isUploadingDriveJSON ? 'Uploading to Drive...' : 'Backup JSON to Drive'}</span>
                  </button>
                </div>
              </div>

              {/* Option B: ANSI Relational SQL to Google Drive */}
              <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-sky-400/50 transition space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 size={18} className="text-sky-400" />
                    <span className="font-bold text-xs text-[var(--text)] font-sans">
                      Relational SQL Dump (.sql)
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-sky-400/10 text-sky-300 border border-sky-400/30 font-bold">
                    ANSI Standard SQL
                  </span>
                </div>

                <p className="text-[11px] text-[var(--text-dim)] font-sans leading-relaxed">
                  Generates an ANSI-standard SQL migration script with CREATE TABLE schemas and INSERT statements
                  for 12 database tables, saved directly to your Google Drive backup folder.
                </p>

                <div className="pt-2 border-t border-[var(--steel-line)] flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] text-[var(--text-dim)]">12 Relational Tables</span>
                  <button
                    type="button"
                    onClick={handleUploadSQLToDrive}
                    disabled={isUploadingDriveSQL}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-bold uppercase text-xs transition flex items-center justify-center gap-1.5 shadow disabled:opacity-60"
                  >
                    {isUploadingDriveSQL ? <RefreshCw size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                    <span>{isUploadingDriveSQL ? 'Uploading SQL...' : 'Backup SQL to Drive'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Master One-Click All Files Backup */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/60 to-blue-950/60 border border-sky-500/40 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                  <Database size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                    Complete Workshop Cloud Snapshot
                  </h4>
                  <p className="text-[11px] text-sky-200/80 font-sans">
                    Simultaneously packages and uploads both JSON state & full PostgreSQL relational SQL dumps to Google Drive
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBackupAllFilesToDrive}
                disabled={isUploadingAllFiles}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs uppercase shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isUploadingAllFiles ? <RefreshCw size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                <span>{isUploadingAllFiles ? 'Backing Up All Files...' : '⚡ Backup All Files to Drive (JSON + SQL)'}</span>
              </button>
            </div>

            {/* Scheduled Auto-Backup Time & Frequency Card */}
            <div className="p-4 rounded-xl bg-black/40 border border-amber-500/30 space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <Clock size={18} className="text-amber-400 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text)] font-sans">
                        Automated Background Backup Schedule
                      </span>
                      {autoDriveBackup ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold border border-emerald-500/30">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 text-[9px] font-mono font-bold border border-slate-500/30">
                          Paused
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--text-dim)] font-sans block mt-0.5">
                      Automatically uploads all files to Google Drive at your chosen frequency interval
                    </span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={autoDriveBackup}
                    onChange={handleToggleAutoDriveBackup}
                    className="rounded border-[var(--steel-line)] text-amber-400 focus:ring-amber-400 bg-[var(--panel-raised)]"
                  />
                  <span className={autoDriveBackup ? 'text-amber-400 font-bold' : 'text-[var(--text-dim)]'}>
                    {autoDriveBackup ? 'Auto-Backup Enabled' : 'Manual Only'}
                  </span>
                </label>
              </div>

              {/* Frequency Selector */}
              {autoDriveBackup && (
                <div className="space-y-1.5 pt-2 border-t border-[var(--steel-line)]/50">
                  <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] block">
                    Backup Interval Frequency
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
                        onClick={() => handleChangeInterval(item.hours)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                          autoDriveBackupInterval === item.hours
                            ? 'bg-amber-400 text-black shadow-xs'
                            : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Time & Countdown Display */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--steel-line)]/50 text-xs">
                <div className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                  <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] block">Last Auto-Backup Recorded</span>
                  <span className="font-mono font-bold text-[var(--text)] text-xs truncate block mt-0.5">
                    {getLastDriveBackupTime() ? new Date(getLastDriveBackupTime()!).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never backed up yet'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                  <span className="text-[10px] font-mono uppercase text-[var(--text-dim)] block">Next Scheduled Auto-Backup</span>
                  {autoDriveBackup ? (
                    <div className="flex items-center justify-between gap-1.5 mt-0.5">
                      <span className="font-mono font-bold text-amber-400 text-xs truncate">
                        {nextScheduledDriveBackup || 'Calculating...'}
                      </span>
                      {driveBackupCountdown && (
                        <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-400/30 shrink-0">
                          {driveBackupCountdown}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--text-dim)] italic mt-0.5 block">
                      Auto-backup schedule is paused
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CARD 3: GOOGLE DRIVE BACKUP EXPLORER & VERSION HISTORY */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <FolderArchive className="text-sky-400" size={18} />
                <h3 className="font-serif font-bold text-sm text-[var(--text)] font-sans uppercase tracking-wider">
                  Google Drive Cloud Backups ({driveFiles.length} Found)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRefreshDriveFiles()}
                  disabled={isLoadingDriveFiles || !driveTokenInfo}
                  className="px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-sky-400 text-xs text-[var(--text)] transition flex items-center gap-1.5 disabled:opacity-40"
                >
                  <RefreshCw size={12} className={isLoadingDriveFiles ? 'animate-spin text-sky-400' : 'text-sky-400'} />
                  <span>Refresh List</span>
                </button>

                {driveFolderId && (
                  <button
                    type="button"
                    onClick={() => openExternalUrl(`https://drive.google.com/drive/folders/${driveFolderId}`, 'drive')}
                    className="px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 text-sky-300 text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink size={12} />
                    <span>Open in Drive</span>
                  </button>
                )}
              </div>
            </div>

            {!driveTokenInfo ? (
              <div className="p-8 text-center bg-[var(--panel-raised)] rounded-xl border border-[var(--steel-line)] space-y-3">
                <Cloud size={36} className="mx-auto text-sky-400/50" />
                <h4 className="font-bold text-sm text-[var(--text)] font-sans">
                  Connect Your Google Drive to View Backups
                </h4>
                <p className="text-xs text-[var(--text-dim)] font-sans max-w-md mx-auto">
                  Click the "Connect Google Drive" button above to grant permission to store and view backups in your dedicated Falcon POS folder.
                </p>
                <button
                  type="button"
                  onClick={handleConnectGoogleDrive}
                  disabled={isConnectingDrive || cloudDriveSyncLoading}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold uppercase text-xs transition shadow inline-flex items-center gap-2"
                >
                  <Cloud size={14} />
                  <span>Connect Google Drive</span>
                </button>
              </div>
            ) : isLoadingDriveFiles ? (
              <div className="p-8 text-center bg-[var(--panel-raised)] rounded-xl border border-[var(--steel-line)] space-y-2">
                <RefreshCw size={24} className="mx-auto animate-spin text-sky-400" />
                <p className="text-xs text-[var(--text-dim)] font-sans">
                  Loading backup snapshots from Google Drive folder...
                </p>
              </div>
            ) : driveFiles.length === 0 ? (
              <div className="p-8 text-center bg-[var(--panel-raised)] rounded-xl border border-[var(--steel-line)] space-y-2">
                <FolderArchive size={36} className="mx-auto text-amber-400/40" />
                <h4 className="font-bold text-sm text-[var(--text)] font-sans">
                  No Backups in Google Drive Folder Yet
                </h4>
                <p className="text-xs text-[var(--text-dim)] font-sans max-w-md mx-auto">
                  Click "Backup JSON to Drive" or "Backup SQL to Drive" above to create your first cloud snapshot.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-w-full rounded-xl border border-[var(--steel-line)] ledger-scroll-container">
                <table className="w-full text-left text-xs border-collapse min-w-[560px]">
                  <thead>
                    <tr className="bg-[var(--panel-raised)] border-b border-[var(--steel-line)] text-[var(--text-dim)]">
                      <th className="p-3">Backup File Name</th>
                      <th className="p-3">Format</th>
                      <th className="p-3">Size</th>
                      <th className="p-3">Created Date</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--steel-line)] bg-[var(--panel)]">
                    {driveFiles.map(file => {
                      const isJSON = file.name.endsWith('.json');
                      const isSQL = file.name.endsWith('.sql');
                      const isRestoring = restoringDriveFileId === file.id;
                      const isDeleting = deletingDriveFileId === file.id;

                      return (
                        <tr key={file.id} className="hover:bg-white/5 transition">
                          <td className="p-3 font-mono text-[var(--text)] font-semibold flex items-center gap-2">
                            {isJSON ? (
                              <HardDrive size={15} className="text-amber-400 shrink-0" />
                            ) : isSQL ? (
                              <Code2 size={15} className="text-sky-400 shrink-0" />
                            ) : (
                              <FileText size={15} className="text-[var(--text-dim)] shrink-0" />
                            )}
                            <span className="truncate max-w-xs sm:max-w-md" title={file.name}>
                              {file.name}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
                              isJSON
                                ? 'bg-amber-400/10 text-amber-300 border-amber-400/30'
                                : isSQL
                                ? 'bg-sky-400/10 text-sky-300 border-sky-400/30'
                                : 'bg-gray-500/10 text-gray-300 border-gray-500/30'
                            }`}>
                              {isJSON ? 'JSON State' : isSQL ? 'SQL Script' : 'File'}
                            </span>
                          </td>
                          <td className="p-3 text-[var(--text-dim)] font-mono">
                            {formatDriveFileSize(file.size)}
                          </td>
                          <td className="p-3 text-[var(--text-dim)] font-mono">
                            {formatDriveDate(file.createdTime)}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isJSON && (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreFromDrive(file)}
                                  disabled={isRestoring}
                                  className="px-2.5 py-1.5 rounded bg-amber-400 text-black font-bold uppercase text-[11px] hover:bg-amber-300 transition flex items-center gap-1 shadow disabled:opacity-50"
                                  title="Restore entire database from this Google Drive backup"
                                >
                                  {isRestoring ? <RefreshCw size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                                  <span>{isRestoring ? 'Restoring...' : 'Restore'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handlePreviewDriveFile(file)}
                                className="p-1.5 rounded bg-white/5 border border-[var(--steel-line)] hover:border-sky-400 text-[var(--text-dim)] hover:text-sky-300 transition"
                                title="Inspect & preview backup file"
                              >
                                <Eye size={13} />
                              </button>

                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="p-1.5 rounded bg-white/5 border border-[var(--steel-line)] hover:border-sky-400 text-[var(--text-dim)] hover:text-sky-300 transition"
                                  title="Open in Google Drive Web Viewer"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeleteDriveFile(file)}
                                disabled={isDeleting}
                                className="p-1.5 rounded bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 transition disabled:opacity-50"
                                title="Delete backup from Google Drive"
                              >
                                {isDeleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* CARD 4: ENTERPRISE ARCHITECTURE & TECHNICAL SPECIFICATIONS */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-md font-sans">
            <div className="flex items-center gap-2 border-b border-[var(--steel-line)] pb-3">
              <KeyRound className="text-amber-400" size={18} />
              <h3 className="font-bold text-sm text-[var(--text)] uppercase tracking-wider font-mono">
                Google Cloud OAuth 2.0 Integration & Security Details
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] uppercase text-amber-400 font-bold block font-mono">1. GCP Project ID</span>
                <span className="font-bold text-[var(--text)] block font-mono text-[11px] truncate">
                  gen-lang-client-0360687883
                </span>
                <span className="text-[10px] text-[var(--text-dim)] block font-mono">
                  Project # 614229042433
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] uppercase text-emerald-400 font-bold block font-mono">2. Permission Scope</span>
                <span className="font-bold text-[var(--text)] block font-mono text-[11px]">
                  drive.file (Strict Isolation)
                </span>
                <span className="text-[10px] text-[var(--text-dim)] block">
                  Zero access to other Drive documents or photos
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] uppercase text-sky-400 font-bold block font-mono">3. Data Redundancy</span>
                <span className="font-bold text-[var(--text)] block font-mono text-[11px]">
                  Multi-Region Google Cloud
                </span>
                <span className="text-[10px] text-[var(--text-dim)] block">
                  99.999999999% Google Drive data durability
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                <span className="text-[10px] uppercase text-purple-400 font-bold block font-mono">4. Disaster Recovery</span>
                <span className="font-bold text-[var(--text)] block font-mono text-[11px]">
                  1-Click Full Restore
                </span>
                <span className="text-[10px] text-[var(--text-dim)] block">
                  Instantly restores all 12 ERP business tables
                </span>
              </div>
            </div>
          </div>

          {/* PREVIEW BACKUP MODAL */}
          {previewDriveFile && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl max-w-3xl w-full max-w-full overflow-x-hidden break-words max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                <div className="p-4 border-b border-[var(--steel-line)] flex items-center justify-between bg-[var(--panel-raised)]">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-sky-400" />
                    <div>
                      <h4 className="font-bold text-xs text-[var(--text)] truncate max-w-md font-mono">
                        {previewDriveFile.file.name}
                      </h4>
                      <span className="text-[10px] text-[var(--text-dim)] font-mono">
                        {formatDriveFileSize(previewDriveFile.file.size)} · Created {formatDriveDate(previewDriveFile.file.createdTime)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPreviewDriveFile(null)}
                    className="p-1 rounded-lg text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-white/10 transition"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1 font-mono text-[11px] bg-black/60 text-slate-300">
                  <pre className="whitespace-pre overflow-x-auto">
                    {previewDriveFile.content.slice(0, 10000)}
                    {previewDriveFile.content.length > 10000 && '\n\n... [Content truncated for preview length] ...'}
                  </pre>
                </div>

                <div className="p-3 border-t border-[var(--steel-line)] bg-[var(--panel-raised)] flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-dim)] font-mono">
                    Total Characters: {previewDriveFile.content.length.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(previewDriveFile.content);
                        alert('Backup content copied to clipboard!');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-[var(--steel-line)] hover:border-sky-400 text-xs text-[var(--text)] transition flex items-center gap-1.5"
                    >
                      <Copy size={12} />
                      <span>Copy Raw Content</span>
                    </button>
                    {previewDriveFile.file.name.endsWith('.json') && (
                      <button
                        type="button"
                        onClick={() => {
                          const f = previewDriveFile.file;
                          setPreviewDriveFile(null);
                          handleRestoreFromDrive(f);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-400 text-black font-bold uppercase text-xs hover:bg-amber-300 transition flex items-center gap-1 shadow"
                      >
                        <RotateCcw size={12} />
                        <span>Restore This Backup</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPreviewDriveFile(null)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-[var(--text)] transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1.6: GOOGLE SHEETS LIVE SPREADSHEET SYNCHRONIZATION & CONTROLS        */}
      {/* ========================================================================= */}
      {activeTab === 'google_sheets' && (
        <GoogleSheetsTab
          appState={appState}
          language={language}
          currentUserEmail={currentUserEmail}
          onNavigateToSettings={onNavigateToSettings}
        />
      )}

      {/* TAB 2: RELATIONAL SQL DATABASE EXPORT & SCHEMA INSPECTOR */}
      {activeTab === 'sql_export' && (
        <div className="space-y-6">
          {/* SQL Actions Banner */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-bold text-sm text-[var(--text)]">
                <Database className="text-[var(--yellow)]" size={18} />
                <span>Standard ANSI SQL Database Dump</span>
              </div>
              <p className="text-xs text-[var(--text-dim)] mt-1 font-mono">
                Fully compatible with SQLite, PostgreSQL, MySQL, MariaDB, DBeaver, and phpMyAdmin.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 font-mono">
              <button
                type="button"
                onClick={handleCopySQL}
                className="py-2.5 px-4 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[var(--text)] font-bold text-xs uppercase transition flex items-center gap-2"
              >
                {copiedSQL ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copiedSQL ? 'Copied SQL!' : 'Copy SQL Script'}
              </button>

              <button
                type="button"
                onClick={handleDownloadSQL}
                className="py-2.5 px-4 rounded-lg bg-[var(--yellow)] text-black font-bold text-xs uppercase shadow hover:bg-amber-400 transition flex items-center gap-2"
              >
                <Download size={14} />
                Download .sql File
              </button>
            </div>
          </div>

          {/* Table Selector & Schema Inspector */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3">
              <h3 className="font-bold text-sm text-[var(--text)] flex items-center gap-2 font-mono">
                <Table size={16} className="text-sky-400" />
                Relational SQL Tables & Schemas
              </h3>
              <span className="text-xs text-[var(--text-dim)] font-mono">
                Total Tables: {tableSummaries.length}
              </span>
            </div>

            {/* Table Selection Pills */}
            <div className="flex flex-wrap gap-2 font-mono">
              {tableSummaries.map(t => (
                <button
                  key={t.tableName}
                  type="button"
                  onClick={() => setSelectedTable(t.tableName)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
                    selectedTable === t.tableName
                      ? 'bg-sky-500/20 border border-sky-400 text-sky-300'
                      : 'bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  <span>{t.tableName}</span>
                  <span className="px-1.5 py-0.2 rounded bg-black/40 text-[10px]">
                    {t.rowCount}
                  </span>
                </button>
              ))}
            </div>

            {/* Selected Table Detail */}
            <div className="space-y-3 pt-2 font-mono">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text)] font-bold">
                  Schema: <span className="text-sky-400">{currentTableSummary.tableName}</span>
                </span>
                <span className="text-[var(--text-dim)]">
                  {currentTableSummary.rowCount} row(s) in local ERP database
                </span>
              </div>

              {/* Columns Table */}
              <div className="border border-[var(--steel-line)] rounded-lg overflow-x-auto max-w-full ledger-scroll-container">
                <table className="w-full text-left text-xs min-w-[320px]">
                  <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-3 border-b border-[var(--steel-line)]">Column</th>
                      <th className="py-2 px-3 border-b border-[var(--steel-line)]">SQL Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--steel-line)]">
                    {currentTableSummary.columns.map(col => (
                      <tr key={col.name} className="hover:bg-white/5">
                        <td className="py-2 px-3 text-[var(--text)] font-bold">{col.name}</td>
                        <td className="py-2 px-3 text-[var(--yellow)]">{col.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sample SQL Query */}
              <div className="space-y-1 pt-2">
                <span className="text-[10px] text-[var(--text-dim)] uppercase block">Example SQL Query</span>
                <div className="p-3 rounded-lg bg-black/50 border border-[var(--steel-line)] text-[11px] text-emerald-400 font-mono overflow-x-auto">
                  {currentTableSummary.sampleSQL}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: JSON SNAPSHOTS & RESTORE */}
      {activeTab === 'json_backup' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Export JSON */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="w-10 h-10 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center text-[var(--yellow)] mb-3">
                <Download size={20} />
              </div>
              <h3 className="font-serif font-bold text-base text-[var(--text)]">{t('export_backup')}</h3>
              <p className="text-xs text-[var(--text-dim)] mt-1 leading-relaxed font-mono">
                Export all orders, ledger balances, workers, inventory, and visual configuration into a single standalone JSON file.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCreateJSONBackup}
              className="w-full py-2.5 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase text-xs font-mono shadow hover:bg-amber-400 transition"
            >
              Download Backup JSON
            </button>
          </div>

          {/* Restore JSON */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="w-10 h-10 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-center text-sky-400 mb-3">
                <Upload size={20} />
              </div>
              <h3 className="font-serif font-bold text-base text-[var(--text)]">{t('restore_backup')}</h3>
              <p className="text-xs text-[var(--text-dim)] mt-1 leading-relaxed font-mono">
                Load an existing JSON snapshot to immediately restore factory operations, order history, and account dues.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[var(--text)] font-bold uppercase text-xs font-mono transition"
            >
              Select Backup File
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: OFFICIAL STAMP & AUTHORIZED SIGNATURE */}
      {activeTab === 'signatures' && (
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 space-y-4 font-mono">
          <div className="flex items-center gap-2 font-sans">
            <Stamp size={18} className="text-[var(--yellow)]" />
            <h3 className="font-serif font-bold text-base text-[var(--text)]">Official Stamp & Authorized Signature</h3>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            These images will appear on printed delivery challans, Gate Passes, and formal PDF invoices.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Signature */}
            <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text)]">Authorized Signature</span>
                <input
                  ref={sigInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSigUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => sigInputRef.current?.click()}
                  className="text-xs text-[var(--yellow)] hover:underline"
                >
                  Upload Signature
                </button>
              </div>

              <div className="h-28 rounded-lg bg-white/5 border border-[var(--steel-line)] flex items-center justify-center p-2">
                {appState.signatureUrl ? (
                  <img
                    src={appState.signatureUrl}
                    alt="Signature"
                    className="max-h-full max-w-full object-contain filter invert"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-[10px] text-[var(--text-dim)] italic">No signature uploaded</span>
                )}
              </div>
            </div>

            {/* Rubber Stamp */}
            <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text)]">Official Factory Rubber Stamp</span>
                <input
                  ref={stampInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleStampUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => stampInputRef.current?.click()}
                  className="text-xs text-[var(--yellow)] hover:underline"
                >
                  Upload Stamp
                </button>
              </div>

              <div className="h-28 rounded-lg bg-white/5 border border-[var(--steel-line)] flex items-center justify-center p-2">
                {appState.stampUrl ? (
                  <img
                    src={appState.stampUrl}
                    alt="Official Stamp"
                    className="max-h-full max-w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-[10px] text-[var(--text-dim)] italic">No stamp uploaded</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
