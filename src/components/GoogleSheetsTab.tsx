import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Cloud,
  Database,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  Link2,
  Unlink,
  Eye,
  Settings2,
  ArrowRight,
  Search,
  Zap,
  Clock,
  KeyRound,
  Layers,
  ChevronRight
} from 'lucide-react';
import { AppState, AppLanguage } from '../types';
import { AuthStatus } from './AuthStatus';
import { openExternalUrl } from '../utils/openExternalUrl';
import {
  ALLOWED_SHEETS_OWNER_EMAIL,
  SheetsTokenInfo,
  SpreadsheetInfo,
  SheetSyncResult,
  getStoredSheetsToken,
  storeSheetsToken,
  clearSheetsToken,
  getStoredSpreadsheetId,
  setStoredSpreadsheetId,
  getLastSheetsSyncTime,
  setLastSheetsSyncTime,
  getSheetsAutoSyncEnabled,
  setSheetsAutoSyncEnabled,
  requestGoogleSheetsToken,
  getSpreadsheetInfo,
  createMasterFalconSpreadsheet,
  ensureRequiredSheetsExist,
  formatSpreadsheetHeaders,
  populateAllSheets,
  syncSmartSpreadsheet,
  writeSheetValues,
  readSheetValues,
  buildTabValues,
  getAllApplicableSheetTabs,
  ALL_EXTENDED_SHEET_TABS,
  DEFAULT_SHEET_TABS,
  extractSpreadsheetId,
  syncSheetsTokenFromCloud,
  publishSheetsTokenToCloud,
  setManualSheetsToken,
  isNativeOrLocalEnvironment
} from '../utils/googleSheetsSync';

interface GoogleSheetsTabProps {
  appState: AppState;
  language: AppLanguage;
  currentUserEmail?: string;
  onNavigateToSettings?: (tab?: string) => void;
}

function getTabCardDetails(tab: string, state: AppState) {
  switch (tab) {
    case 'Dashboard':
      return {
        icon: '📈',
        badge: 'KPIs',
        badgeColor: 'bg-amber-500/20 text-amber-300',
        desc: 'Lifetime revenue, orders, uncollected balances, stock count, and sync timestamps.'
      };
    case 'Sales Transactions':
      return {
        icon: '🧾',
        badge: `${state.transactions?.length || 0} Invoices`,
        badgeColor: 'bg-emerald-500/20 text-emerald-400',
        desc: 'Every sale, invoice #, customer name, total PKR, payment method, gate pass sequence.'
      };
    case 'Product Catalog':
      return {
        icon: '📦',
        badge: `${state.products?.length || 0} SKUs`,
        badgeColor: 'bg-sky-500/20 text-sky-400',
        desc: 'Finished rod catalog, prices, current inventory, gauge, weight, reorder threshold.'
      };
    case 'Customer Ledgers':
      return {
        icon: '👥',
        badge: `${state.customerLedgers?.length || 0} Clients`,
        badgeColor: 'bg-purple-500/20 text-purple-400',
        desc: 'Customer credit ledger, outstanding receivables, contact details, balance history.'
      };
    case 'Customer Payments':
      return {
        icon: '💳',
        badge: `${state.customerPayments?.length || 0} Receipts`,
        badgeColor: 'bg-emerald-500/20 text-emerald-300',
        desc: 'Vouchers, bank slip references, cash deposits, and balance settlements.'
      };
    case 'Raw Material Stock':
      return {
        icon: '🪵',
        badge: `${state.rawStock?.length || 0} Raw Items`,
        badgeColor: 'bg-amber-500/20 text-amber-400',
        desc: 'Carbon fiber, resin, guides, tip tops, blanks, thread, and workshop supplies.'
      };
    case 'Raw Suppliers':
      return {
        icon: '🏭',
        badge: `${state.rawSuppliers?.length || 0} Suppliers`,
        badgeColor: 'bg-blue-500/20 text-blue-400',
        desc: 'Procurement suppliers, material bills, phone numbers, and payable accounts.'
      };
    case 'Factory Production':
      return {
        icon: '⚙️',
        badge: `${state.factories?.length || 0} Factories`,
        badgeColor: 'bg-indigo-500/20 text-indigo-400',
        desc: 'Outsourced factory lots, dispatched blank units, and completed rod returns.'
      };
    case 'Labour Workers':
      return {
        icon: '👷',
        badge: `${(state.labourWorkers || state.workers || []).length} Workers`,
        badgeColor: 'bg-orange-500/20 text-orange-400',
        desc: 'Craftsmen wages, piece-rate operations, attendance logs, and advance payouts.'
      };
    case 'Paint Ledger':
      return {
        icon: '🎨',
        badge: `${state.painters?.length || 0} Painters`,
        badgeColor: 'bg-pink-500/20 text-pink-400',
        desc: 'Color coating batches, rod painting rates, spray sessions, and painter ledger.'
      };
    case 'Scrap Ledger':
      return {
        icon: '♻️',
        badge: `${state.scrapBuyers?.length || 0} Buyers`,
        badgeColor: 'bg-lime-500/20 text-lime-400',
        desc: 'Carbon offcut waste, defective blank sales, scrap buyer payments, and weights.'
      };
    case 'Withdrawals':
      return {
        icon: '💸',
        badge: `${state.withdrawals?.length || 0} Records`,
        badgeColor: 'bg-rose-500/20 text-rose-400',
        desc: 'Partner drawings, owner capital disbursements, and cash register withdrawals.'
      };
    case 'Product Returns':
      return {
        icon: '🔄',
        badge: `${(state.productReturns || state.returns || []).length} Returns`,
        badgeColor: 'bg-red-500/20 text-red-400',
        desc: 'Returned rods, warranty inspections, restock status, and reason notes.'
      };
    case 'Workshop Expenses':
      return {
        icon: '📊',
        badge: `${state.expenses?.length || 0} Expenses`,
        badgeColor: 'bg-red-500/20 text-red-400',
        desc: 'Daily overheads, workshop utility bills, maintenance charges, and petty cash.'
      };
    case 'Custom Ledgers':
      return {
        icon: '📑',
        badge: `${state.customLedgersList?.length || 0} Ledgers`,
        badgeColor: 'bg-teal-500/20 text-teal-400',
        desc: 'Custom business ledgers, partner accounts, and special financial logs.'
      };
    case 'Inquiries':
      return {
        icon: '💬',
        badge: `${state.inquiries?.length || 0} Leads`,
        badgeColor: 'bg-cyan-500/20 text-cyan-400',
        desc: 'Wholesale buyer quotation inquiries, custom rod specs, and customer leads.'
      };
    default:
      return {
        icon: '📓',
        badge: 'Custom Ledger',
        badgeColor: 'bg-violet-500/20 text-violet-400',
        desc: `Dedicated dynamic worksheet auto-adjusted for ${tab}.`
      };
  }
}

export const GoogleSheetsTab: React.FC<GoogleSheetsTabProps> = ({
  appState,
  language = 'en',
  currentUserEmail = ALLOWED_SHEETS_OWNER_EMAIL,
  onNavigateToSettings
}) => {
  const applicableTabs = getAllApplicableSheetTabs(appState);
  // Token state
  const [tokenInfo, setTokenInfo] = useState<SheetsTokenInfo | null>(() => getStoredSheetsToken());
  const [isConnecting, setIsConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active spreadsheet state
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => getStoredSpreadsheetId());
  const [spreadsheetInfo, setSpreadsheetInfo] = useState<SpreadsheetInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [customSheetInput, setCustomSheetInput] = useState('');
  const [isCreatingMaster, setIsCreatingMaster] = useState(false);

  // Sync state
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncingSheetName, setSyncingSheetName] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => getLastSheetsSyncTime());
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => getSheetsAutoSyncEnabled());
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<SheetSyncResult[]>([]);

  // Explorer / Live Sheet Viewer state
  const [selectedExplorerTab, setSelectedExplorerTab] = useState<string>('Sales Transactions');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewRows, setPreviewRows] = useState<(string | number)[][]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSearch, setPreviewSearch] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Initial load of spreadsheet metadata if connected
  useEffect(() => {
    if (tokenInfo?.token && spreadsheetId) {
      handleLoadSpreadsheetInfo(tokenInfo.token, spreadsheetId);
    }
  }, [tokenInfo?.token, spreadsheetId]);

  const [isPushingCloud, setIsPushingCloud] = useState(false);
  const [cloudSyncLoading, setCloudSyncLoading] = useState(false);
  const isNativeApp = isNativeOrLocalEnvironment();

  const handleSyncFromPC = async () => {
    setCloudSyncLoading(true);
    setAuthError(null);
    try {
      const syncd = await syncSheetsTokenFromCloud();
      if (syncd && syncd.token) {
        setTokenInfo(syncd);
        setSyncSuccessMsg('✓ Successfully synced Google Sheets credentials from Workshop PC Master!');
        setTimeout(() => setSyncSuccessMsg(null), 4000);
        const sid = getStoredSpreadsheetId();
        if (sid) {
          setSpreadsheetId(sid);
          await handleLoadSpreadsheetInfo(syncd.token, sid);
        }
      } else {
        setAuthError('No active Google Sheets credentials found in Cloud Sync yet. Please sign in on your PC Terminal first, then tap "Sync from PC" here.');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Cloud sync check failed.');
    } finally {
      setCloudSyncLoading(false);
    }
  };

  const handlePublishToCloud = async () => {
    if (!tokenInfo?.token) return;
    setIsPushingCloud(true);
    try {
      const remainingSec = Math.max(Math.floor((tokenInfo.expiresAt - Date.now()) / 1000), 3600);
      await publishSheetsTokenToCloud(
        tokenInfo.token,
        remainingSec,
        tokenInfo.userEmail || ALLOWED_SHEETS_OWNER_EMAIL,
        spreadsheetId || undefined,
        spreadsheetInfo?.title,
        spreadsheetInfo?.spreadsheetUrl
      );
      setSyncSuccessMsg('✓ Credentials published to Workshop Cloud for Mobile APK terminals!');
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } catch (err: any) {
      setAuthError('Failed to push credentials: ' + err?.message);
    } finally {
      setIsPushingCloud(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setAuthError(null);
    try {
      const token = await requestGoogleSheetsToken(currentUserEmail);
      const updated = getStoredSheetsToken();
      setTokenInfo(updated);
      setSyncSuccessMsg('✓ Google Sheets authorization granted successfully!');
      setTimeout(() => setSyncSuccessMsg(null), 4000);

      // If we already have a spreadsheet ID, refresh its info and open native app directly
      if (spreadsheetId) {
        await handleLoadSpreadsheetInfo(token, spreadsheetId);
        openExternalUrl(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, 'sheets');
      } else {
        openExternalUrl('https://docs.google.com/spreadsheets', 'sheets');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to authenticate with Google Sheets.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    clearSheetsToken();
    setTokenInfo(null);
    setSpreadsheetInfo(null);
    setPreviewRows([]);
    setSyncSuccessMsg('Google Sheets credentials cleared.');
    setTimeout(() => setSyncSuccessMsg(null), 3000);
  };

  const handleLoadSpreadsheetInfo = async (token: string, id: string) => {
    setIsLoadingInfo(true);
    try {
      const info = await getSpreadsheetInfo(token, id);
      setSpreadsheetInfo(info);
      setSpreadsheetId(info.spreadsheetId);
      setStoredSpreadsheetId(info.spreadsheetId);
      setSyncErrorMsg(null);
      // Ensure all standard tabs exist in the connected spreadsheet
      ensureRequiredSheetsExist(token, info.spreadsheetId).catch(console.warn);
    } catch (err: any) {
      console.warn('Failed to load spreadsheet info:', err);
      // Stale or invalid ID
      setSpreadsheetInfo(null);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleCreateMasterSheet = async () => {
    let token = tokenInfo?.token;
    if (!token) {
      try {
        token = await requestGoogleSheetsToken(currentUserEmail);
        const updated = getStoredSheetsToken();
        setTokenInfo(updated);
      } catch (err: any) {
        setAuthError(err?.message || 'Authorization required.');
        return;
      }
    }

    setIsCreatingMaster(true);
    setSyncErrorMsg(null);
    try {
      const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const customTitle = `Falcon Rod Maker POS - Master Workshop Database (${dateStr})`;
      const created = await createMasterFalconSpreadsheet(token, appState, customTitle);
      setSpreadsheetInfo(created);
      setSpreadsheetId(created.spreadsheetId);
      setStoredSpreadsheetId(created.spreadsheetId);
      const now = new Date().toLocaleString('en-GB');
      setLastSyncTime(now);
      setLastSheetsSyncTime(now);
      setSyncSuccessMsg(`✓ Created master Google Sheet "${created.title}" with ${DEFAULT_SHEET_TABS.length} worksheets and populated latest workshop data!`);
      setTimeout(() => setSyncSuccessMsg(null), 6000);
      openExternalUrl(created.spreadsheetUrl, 'sheets');
      // Auto preview
      handleFetchLivePreview(token, created.spreadsheetId, 'Sales Transactions');
    } catch (err: any) {
      setSyncErrorMsg(err?.message || 'Failed to create master Google Sheet.');
    } finally {
      setIsCreatingMaster(false);
    }
  };

  const handleConnectCustomSheet = async () => {
    if (!customSheetInput.trim()) return;
    const cleanId = extractSpreadsheetId(customSheetInput);
    if (!cleanId) {
      setSyncErrorMsg('Please provide a valid Google Sheet ID or URL.');
      return;
    }

    let token = tokenInfo?.token;
    if (!token) {
      try {
        token = await requestGoogleSheetsToken(currentUserEmail);
        const updated = getStoredSheetsToken();
        setTokenInfo(updated);
      } catch (err: any) {
        setAuthError(err?.message || 'Authorization required.');
        return;
      }
    }

    setIsLoadingInfo(true);
    setSyncErrorMsg(null);
    try {
      const info = await getSpreadsheetInfo(token, cleanId);
      setSpreadsheetInfo(info);
      setSpreadsheetId(info.spreadsheetId);
      setStoredSpreadsheetId(info.spreadsheetId);
      setCustomSheetInput('');
      // Ensure all standard tabs exist in the newly connected spreadsheet
      ensureRequiredSheetsExist(token, info.spreadsheetId).catch(console.warn);
      setSyncSuccessMsg(`✓ Connected to Google Sheet: "${info.title}"`);
      setTimeout(() => setSyncSuccessMsg(null), 5000);
      openExternalUrl(info.spreadsheetUrl, 'sheets');
    } catch (err: any) {
      setSyncErrorMsg(`Could not connect to Google Sheet (${cleanId}): ${err?.message}`);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleDisconnectSpreadsheet = () => {
    setSpreadsheetId(null);
    setStoredSpreadsheetId(null);
    setSpreadsheetInfo(null);
    setPreviewRows([]);
    setSyncSuccessMsg('Disconnected from Google Sheet.');
    setTimeout(() => setSyncSuccessMsg(null), 3000);
  };

  const handleSyncAll = async () => {
    let token = tokenInfo?.token;
    if (!token) {
      try {
        token = await requestGoogleSheetsToken(currentUserEmail);
        const updated = getStoredSheetsToken();
        setTokenInfo(updated);
      } catch (err: any) {
        setAuthError(err?.message || 'Authorization required.');
        return;
      }
    }

    if (!spreadsheetId) {
      await handleCreateMasterSheet();
      return;
    }

    setIsSyncingAll(true);
    setSyncErrorMsg(null);
    try {
      const results = await syncSmartSpreadsheet(token, spreadsheetId, appState);
      setSyncResults(results);
      const errors = results.filter(r => r.status === 'error');
      const totalUpdated = results.reduce((sum, r) => sum + r.rowsUpdated, 0);
      const now = new Date().toLocaleString('en-GB');
      setLastSyncTime(now);
      setLastSheetsSyncTime(now);

      if (errors.length > 0) {
        setSyncErrorMsg(`Completed with notices: ${errors.length} sheet(s) encountered issues. ${totalUpdated} rows updated.`);
      } else {
        setSyncSuccessMsg(`✓ Full smart sync successful! Synchronized all ${results.length} workshop sheets (${totalUpdated} total rows) to Google Sheets.`);
        setTimeout(() => setSyncSuccessMsg(null), 6000);
      }

      // Refresh live preview if active
      if (selectedExplorerTab) {
        handleFetchLivePreview(token, spreadsheetId, selectedExplorerTab);
      }
    } catch (err: any) {
      setSyncErrorMsg(err?.message || 'Full sync to Google Sheets failed.');
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSyncSingleSheet = async (sheetTitle: string) => {
    let token = tokenInfo?.token;
    if (!token) {
      try {
        token = await requestGoogleSheetsToken(currentUserEmail);
        const updated = getStoredSheetsToken();
        setTokenInfo(updated);
      } catch (err: any) {
        setAuthError(err?.message || 'Authorization required.');
        return;
      }
    }

    if (!spreadsheetId) {
      setSyncErrorMsg('Please connect or create a Google Spreadsheet first.');
      return;
    }

    setSyncingSheetName(sheetTitle);
    setSyncErrorMsg(null);
    try {
      const values = buildTabValues(sheetTitle, appState);
      const rowsUpdated = await writeSheetValues(token, spreadsheetId, sheetTitle, values);
      const now = new Date().toLocaleString('en-GB');
      setLastSyncTime(now);
      setLastSheetsSyncTime(now);
      setSyncSuccessMsg(`✓ Successfully synced "${sheetTitle}" (${rowsUpdated} rows) to Google Sheets!`);
      setTimeout(() => setSyncSuccessMsg(null), 4000);

      if (selectedExplorerTab === sheetTitle) {
        handleFetchLivePreview(token, spreadsheetId, sheetTitle);
      }
    } catch (err: any) {
      setSyncErrorMsg(`Failed to sync "${sheetTitle}": ${err?.message}`);
    } finally {
      setSyncingSheetName(null);
    }
  };

  const handleFetchLivePreview = async (token: string, targetId: string, sheetTitle: string) => {
    setIsLoadingPreview(true);
    setPreviewError(null);
    try {
      const rows = await readSheetValues(token, targetId, sheetTitle, 40, appState);
      setPreviewRows(rows);
    } catch (err: any) {
      setPreviewError(err?.message || `Failed to read "${sheetTitle}" from Google Sheets.`);
      setPreviewRows([]);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleFormatHeaders = async () => {
    const token = tokenInfo?.token;
    if (!token || !spreadsheetId) return;
    try {
      await formatSpreadsheetHeaders(token, spreadsheetId);
      setSyncSuccessMsg('✓ Sheet headers successfully styled and frozen with Falcon Rod Maker branding!');
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } catch (err: any) {
      setSyncErrorMsg(`Header formatting notice: ${err?.message}`);
    }
  };

  const handleToggleAutoSync = () => {
    const next = !autoSyncEnabled;
    setAutoSyncEnabled(next);
    setSheetsAutoSyncEnabled(next);
    setSyncSuccessMsg(next ? '✓ Auto-sync enabled: Sales will automatically sync to Google Sheets.' : 'Auto-sync turned off.');
    setTimeout(() => setSyncSuccessMsg(null), 3000);
  };

  const copySpreadsheetLink = () => {
    if (!spreadsheetInfo?.spreadsheetUrl && !spreadsheetId) return;
    const url = spreadsheetInfo?.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const copySpreadsheetId = () => {
    if (!spreadsheetId) return;
    navigator.clipboard.writeText(spreadsheetId).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  // Filter preview rows
  const filteredPreviewRows = previewRows.length > 0 ? (
    previewSearch.trim() === ''
      ? previewRows
      : [
          previewRows[0],
          ...previewRows.slice(1).filter(row =>
            row.some(cell => String(cell).toLowerCase().includes(previewSearch.toLowerCase()))
          )
        ]
  ) : [];

  const isConnected = !!tokenInfo?.token;

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden break-words">
      {/* SUCCESS / ERROR ALERTS */}
      {syncSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-sm flex items-center justify-between font-mono animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>{syncSuccessMsg}</span>
          </div>
          <button onClick={() => setSyncSuccessMsg(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* REAL-TIME OAUTH VERIFICATION & ERROR HANDLING */}
      <AuthStatus
        service="sheets"
        language={language}
        forcedError={authError}
        onClearForcedError={() => setAuthError(null)}
        onReauthenticated={() => {
          setAuthError(null);
          setTokenInfo(getStoredSheetsToken());
          if (spreadsheetId) {
            const token = getStoredSheetsToken()?.token;
            if (token) handleLoadSpreadsheetInfo(token, spreadsheetId);
          }
        }}
        onNavigateToSettings={onNavigateToSettings}
      />

      {syncErrorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400 text-sm flex items-center justify-between font-mono animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            <span>{syncErrorMsg}</span>
          </div>
          <button onClick={() => setSyncErrorMsg(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 1. MASTER CONNECTION & SECURITY CARD */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[var(--panel)] border border-[var(--steel-line)] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--steel-line)]">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
              <FileSpreadsheet size={24} className="sm:w-7 sm:h-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-wide text-[var(--text)] break-words">
                  Google Sheets Synchronization Hub
                </h2>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                    Authorization Required
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-dim)] mt-1 max-w-2xl leading-relaxed">
                Bi-directional cloud spreadsheet sync for Falcon Rod Maker POS. Automatically formats, syncs, and organizes sales invoices, customer ledgers, product catalog, raw materials, and factory orders into Google Sheets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full md:w-auto">
            {isConnected ? (
              <>
                <button
                  type="button"
                  onClick={handlePublishToCloud}
                  disabled={isPushingCloud}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 transition flex items-center justify-center gap-2 shrink-0"
                  title="Push active Google connection to Cloud so Mobile APK can access Sheets without webview OAuth restrictions"
                >
                  <Cloud size={14} className={isPushingCloud ? 'animate-spin' : ''} />
                  <span>{isPushingCloud ? 'Publishing...' : 'Push to Mobile APK'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--panel-raised)] hover:bg-[var(--steel-line)] text-[var(--text)] border border-[var(--steel-line)] transition flex items-center justify-center gap-2 shrink-0"
                >
                  <RefreshCw size={14} className={isConnecting ? 'animate-spin' : ''} />
                  <span>Refresh Token</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Unlink size={14} />
                  <span>Disconnect</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 shrink-0"
                >
                  <FileSpreadsheet size={16} />
                  <span>{isConnecting ? 'Authorizing Google...' : 'Direct Google Sign-In'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncFromPC}
                  disabled={cloudSyncLoading}
                  className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-[var(--panel-raised)] hover:bg-[var(--steel-line)] text-emerald-400 border border-emerald-500/30 transition flex items-center justify-center gap-2 shrink-0"
                  title="Pull authorized credentials saved in Cloud by other terminals"
                >
                  <Cloud size={14} className={cloudSyncLoading ? 'animate-spin' : ''} />
                  <span>{cloudSyncLoading ? 'Syncing...' : 'Cloud Sync'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Security / Owner Banner */}
        <div className="mt-4 pt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center gap-3">
            <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-[var(--text-dim)] block">Authorized Workshop Owner</span>
              <span className="font-mono text-[var(--text)] truncate block">{ALLOWED_SHEETS_OWNER_EMAIL}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center gap-3">
            <Clock size={18} className="text-amber-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-[var(--text-dim)] block">Last Synchronized</span>
              <span className="text-[var(--text)] truncate block">{lastSyncTime || 'No sync completed yet'}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Zap size={18} className={autoSyncEnabled ? 'text-emerald-400' : 'text-[var(--text-dim)]'} />
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--text-dim)] block">Live Auto-Sync (Add / Edit / Delete)</span>
                <span className="text-[var(--text)] font-semibold">{autoSyncEnabled ? 'Active (Live Sync Enabled)' : 'Manual Sync Only'}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleAutoSync}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                autoSyncEnabled
                  ? 'bg-emerald-500 text-black'
                  : 'bg-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              {autoSyncEnabled ? 'LIVE ON' : 'DISABLED'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. SPREADSHEET MANAGER / SELECTOR */}
      <div className="p-6 rounded-2xl bg-[var(--panel)] border border-[var(--steel-line)] shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-black text-[var(--text)] flex items-center gap-2">
              <Database size={17} className="text-[var(--yellow)]" />
              Connected Google Spreadsheet
            </h3>
            <p className="text-xs text-[var(--text-dim)] mt-0.5">
              Manage the target Google Spreadsheet workbook for real-time synchronization.
            </p>
          </div>

          {spreadsheetId && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFormatHeaders}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--panel-raised)] hover:bg-[var(--steel-line)] text-[var(--text)] border border-[var(--steel-line)] transition flex items-center gap-1.5"
                title="Re-apply amber formatting, bold font, and freeze header row in all worksheets"
              >
                <Settings2 size={13} />
                Re-apply Formatting
              </button>
              <button
                type="button"
                onClick={handleDisconnectSpreadsheet}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                Switch Sheet
              </button>
            </div>
          )}
        </div>

        {spreadsheetInfo ? (
          <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-emerald-500/30 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[var(--text)]">{spreadsheetInfo.title}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400">
                    {spreadsheetInfo.sheets.length} Worksheets Active
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-dim)] font-mono">
                  <span>ID: {spreadsheetInfo.spreadsheetId}</span>
                  <button
                    type="button"
                    onClick={copySpreadsheetId}
                    className="hover:text-[var(--text)] transition flex items-center gap-1"
                  >
                    {copiedId ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedId ? 'Copied ID' : 'Copy ID'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                <button
                  type="button"
                  onClick={copySpreadsheetLink}
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-bold bg-[var(--panel)] hover:bg-[var(--steel-line)] text-[var(--text)] border border-[var(--steel-line)] transition flex items-center justify-center gap-1.5"
                >
                  {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Share Link'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openExternalUrl(spreadsheetInfo.spreadsheetUrl, 'sheets')}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span>Open in Google Sheets</span>
                  <ExternalLink size={13} />
                </button>
              </div>
            </div>

            {/* List of sheet tabs in workbook */}
            <div className="pt-2 border-t border-[var(--steel-line)] flex items-center gap-2 flex-wrap text-xs">
              <span className="text-[11px] font-bold text-[var(--text-dim)] uppercase">Active Tabs:</span>
              {spreadsheetInfo.sheets.map(sheet => (
                <span
                  key={sheet.id}
                  className="px-2.5 py-1 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-[var(--text)] text-[11px] font-mono flex items-center gap-1.5"
                >
                  <FileSpreadsheet size={12} className="text-emerald-400" />
                  {sheet.title}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-xl bg-[var(--panel-raised)] border border-dashed border-[var(--steel-line)] space-y-4">
            <div className="text-center py-2">
              <FileSpreadsheet size={36} className="mx-auto text-emerald-400 mb-2 opacity-80" />
              <h4 className="font-bold text-sm text-[var(--text)]">No Master Google Sheet Linked Yet</h4>
              <p className="text-xs text-[var(--text-dim)] max-w-md mx-auto mt-1">
                You can create a brand new automated master sheet with 7 formatted tabs, or connect an existing Google Sheet.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {/* Option A: Create Master */}
              <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] flex flex-col justify-between space-y-3">
                <div>
                  <span className="font-bold text-xs text-emerald-400 uppercase tracking-wider block">Recommended Option</span>
                  <h5 className="font-bold text-sm text-[var(--text)] mt-1">Create Falcon Master Spreadsheet</h5>
                  <p className="text-xs text-[var(--text-dim)] mt-1">
                    Auto-provisions a styled Google Spreadsheet with 7 worksheets, amber headers, frozen rows, and imports all current POS records.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreateMasterSheet}
                  disabled={isCreatingMaster}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow transition flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  {isCreatingMaster ? 'Provisioning Master Sheet...' : 'Create Master Workshop Sheet'}
                </button>
              </div>

              {/* Option B: Connect Existing */}
              <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] flex flex-col justify-between space-y-3">
                <div>
                  <span className="font-bold text-xs text-sky-400 uppercase tracking-wider block">Existing Spreadsheet</span>
                  <h5 className="font-bold text-sm text-[var(--text)] mt-1">Connect By URL or Sheet ID</h5>
                  <p className="text-xs text-[var(--text-dim)] mt-1">
                    Paste a link to any existing Google Sheet that you own or have edit permissions for.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customSheetInput}
                    onChange={e => setCustomSheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 px-3 py-2 rounded-xl text-xs bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text)] focus:outline-none focus:border-emerald-400 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleConnectCustomSheet}
                    disabled={isLoadingInfo || !customSheetInput.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--yellow)] hover:brightness-110 text-black transition shrink-0"
                  >
                    {isLoadingInfo ? 'Verifying...' : 'Connect'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. FULL DETAILED SYNC CONTROLS & MASTER BUTTON */}
      <div className="p-6 rounded-2xl bg-[var(--panel)] border border-[var(--steel-line)] shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-[var(--text)] flex items-center gap-2">
              <Zap size={17} className="text-emerald-400" />
              Workshop Synchronization Controls
            </h3>
            <p className="text-xs text-[var(--text-dim)] mt-0.5">
              Sync all datasets at once or execute surgical synchronization for individual operational tables.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            className="px-6 py-3 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-lg shadow-amber-500/20 transition flex items-center gap-2.5 self-start sm:self-auto"
          >
            <RefreshCw size={16} className={isSyncingAll ? 'animate-spin' : ''} />
            {isSyncingAll ? `Synchronizing All ${applicableTabs.length} Sheets...` : `Sync Entire Workshop (All ${applicableTabs.length} Sheets)`}
          </button>
        </div>

        {/* Dynamic Selective Sync Cards for All Applicable Sheets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 pt-2">
          {applicableTabs.map(tabTitle => {
            const info = getTabCardDetails(tabTitle, appState);
            const isSyncing = syncingSheetName === tabTitle;
            return (
              <div
                key={tabTitle}
                className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-500/40 transition flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-black text-[var(--text)] flex items-center gap-1.5 truncate">
                      <span>{info.icon}</span>
                      <span className="truncate">{tabTitle}</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 ${info.badgeColor}`}>
                      {info.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-dim)] mt-1.5 leading-relaxed line-clamp-2">
                    {info.desc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSyncSingleSheet(tabTitle)}
                  disabled={isSyncing || isSyncingAll}
                  className="w-full py-1.5 rounded-lg text-xs font-bold bg-[var(--panel)] hover:bg-[var(--steel-line)] text-[var(--text)] border border-[var(--steel-line)] transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? 'Syncing...' : `Sync ${tabTitle.replace('Ledger - ', '')}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. LIVE IN-APP SHEET EXPLORER & VIEWER */}
      <div className="p-6 rounded-2xl bg-[var(--panel)] border border-[var(--steel-line)] shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-[var(--text)] flex items-center gap-2">
              <Eye size={17} className="text-sky-400" />
              Live In-App Google Sheet Explorer
            </h3>
            <p className="text-xs text-[var(--text-dim)] mt-0.5">
              Inspect and verify the live rows directly stored in your Google Sheet workbook.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-[var(--text-dim)]" />
              <input
                type="text"
                value={previewSearch}
                onChange={e => setPreviewSearch(e.target.value)}
                placeholder="Search live rows..."
                className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text)] focus:outline-none focus:border-sky-400 font-mono w-48"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const token = tokenInfo?.token;
                if (token && spreadsheetId) {
                  handleFetchLivePreview(token, spreadsheetId, selectedExplorerTab);
                }
              }}
              disabled={isLoadingPreview || !spreadsheetId || !isConnected}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--panel-raised)] hover:bg-[var(--steel-line)] text-[var(--text)] border border-[var(--steel-line)] transition flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={isLoadingPreview ? 'animate-spin' : ''} />
              Fetch Live Data
            </button>
          </div>
        </div>

        {/* Tab pills for explorer */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {applicableTabs.map(tabTitle => (
            <button
              key={tabTitle}
              type="button"
              onClick={() => {
                setSelectedExplorerTab(tabTitle);
                const token = tokenInfo?.token;
                if (token && spreadsheetId) {
                  handleFetchLivePreview(token, spreadsheetId, tabTitle);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                selectedExplorerTab === tabTitle
                  ? 'bg-sky-500 text-black shadow'
                  : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--steel-line)]'
              }`}
            >
              <FileSpreadsheet size={12} />
              {tabTitle}
            </button>
          ))}
        </div>

        {/* Table View */}
        {previewError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {previewError}
          </div>
        )}

        {isLoadingPreview ? (
          <div className="p-12 text-center text-xs text-[var(--text-dim)] space-y-2">
            <RefreshCw size={24} className="mx-auto animate-spin text-sky-400" />
            <p>Querying Google Sheets API for worksheet "{selectedExplorerTab}"...</p>
          </div>
        ) : filteredPreviewRows.length > 0 ? (
          <div className="border border-[var(--steel-line)] rounded-xl overflow-hidden bg-[var(--panel-raised)]">
            <div className="overflow-x-auto max-h-96 max-w-full ledger-scroll-container">
              <table className="w-full text-xs text-left min-w-[600px]">
                {/* Header Row */}
                <thead className="sticky top-0 bg-[var(--panel)] border-b border-[var(--steel-line)] z-10 shadow-sm">
                  <tr>
                    {filteredPreviewRows[0].map((headerCell, idx) => (
                      <th
                        key={idx}
                        className="px-3.5 py-2.5 font-black text-[var(--text)] tracking-wider uppercase text-[11px] whitespace-nowrap border-r border-[var(--steel-line)] last:border-r-0"
                      >
                        {String(headerCell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                {/* Body Rows */}
                <tbody className="divide-y divide-[var(--steel-line)] font-mono">
                  {filteredPreviewRows.slice(1).map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-[var(--panel)] transition">
                      {row.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className="px-3.5 py-2 text-[var(--text)] whitespace-nowrap border-r border-[var(--steel-line)] last:border-r-0"
                        >
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-2.5 bg-[var(--panel)] border-t border-[var(--steel-line)] text-[11px] text-[var(--text-dim)] flex items-center justify-between font-mono">
              <span>Showing {filteredPreviewRows.length - 1} data rows from Google Sheet "{selectedExplorerTab}"</span>
              <span>Range: '{selectedExplorerTab}'!A1:Z30</span>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-[var(--text-dim)] border border-dashed border-[var(--steel-line)] rounded-xl">
            <p>No preview rows loaded. Click "Fetch Live Data" or sync this sheet to view live data.</p>
          </div>
        )}
      </div>
    </div>
  );
};
