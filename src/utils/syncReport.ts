import { AppState } from '../types';
import { downloadJSON, todayISO } from './helpers';
import { downloadSQLFile, generateSQLDump } from './sqlExporter';
import firebaseConfig from '../../firebase-applet-config.json';

const firestoreDbId: string = (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-falconrodmakerpo-4ec08e17-6c91-4aca-b59a-d747b503ca3a';

export interface DatabaseRecordMetrics {
  totalRecords: number;
  productsCount: number;
  transactionsCount: number;
  factoriesCount: number;
  ledgerEntriesCount: number;
  rawStockCount: number;
  rawSuppliersCount: number;
  paintersCount: number;
  workersCount: number;
  scrapBuyersCount: number;
  withdrawalsCount: number;
  expensesCount: number;
  returnsCount: number;
  storageSizeBytes: number;
  storageSizeKB: number;
}

export function calculateDatabaseMetrics(appState: AppState): DatabaseRecordMetrics {
  let ledgerEntriesCount = 0;
  if (appState.customerLedgers) {
    Object.values(appState.customerLedgers).forEach(ledger => {
      if (ledger && Array.isArray(ledger.entries)) {
        ledgerEntriesCount += ledger.entries.length;
      }
    });
  }

  const productsCount = appState.products?.length || 0;
  const transactionsCount = appState.transactions?.length || 0;
  const factoriesCount = appState.factories?.length || 0;
  const rawStockCount = appState.rawStock?.length || 0;
  const rawSuppliersCount = appState.rawSuppliers?.length || 0;
  const paintersCount = appState.painters?.length || 0;
  const workersCount = appState.workers?.length || 0;
  const scrapBuyersCount = appState.scrapBuyers?.length || 0;
  const withdrawalsCount = appState.withdrawals?.length || 0;
  const expensesCount = appState.expenses?.length || 0;
  const returnsCount = appState.productReturns?.length || 0;

  const totalRecords =
    productsCount +
    transactionsCount +
    factoriesCount +
    ledgerEntriesCount +
    rawStockCount +
    rawSuppliersCount +
    paintersCount +
    workersCount +
    scrapBuyersCount +
    withdrawalsCount +
    expensesCount +
    returnsCount;

  let storageSizeBytes = 0;
  try {
    storageSizeBytes = new Blob([JSON.stringify(appState)]).size;
  } catch {
    storageSizeBytes = JSON.stringify(appState).length;
  }
  const storageSizeKB = Math.round((storageSizeBytes / 1024) * 10) / 10;

  return {
    totalRecords,
    productsCount,
    transactionsCount,
    factoriesCount,
    ledgerEntriesCount,
    rawStockCount,
    rawSuppliersCount,
    paintersCount,
    workersCount,
    scrapBuyersCount,
    withdrawalsCount,
    expensesCount,
    returnsCount,
    storageSizeBytes,
    storageSizeKB
  };
}

export interface SyncReportOptions {
  appState: AppState;
  syncState: 'synced' | 'syncing' | 'offline' | 'error';
  isOnline: boolean;
  pingLatency: number | null;
  lastSyncTime?: string | null;
  terminalId: string;
  terminalName: string;
  pendingQueueCount: number;
  syncErrorMsg?: string | null;
  userEmail: string;
}

export function generateSyncDiagnosticReport(options: SyncReportOptions): string {
  const {
    appState,
    syncState,
    isOnline,
    pingLatency,
    lastSyncTime,
    terminalId,
    terminalName,
    pendingQueueCount,
    syncErrorMsg,
    userEmail
  } = options;

  const metrics = calculateDatabaseMetrics(appState);
  const timestamp = new Date().toISOString();
  const localDate = new Date().toLocaleString();

  const isFirebaseReachable = isOnline && syncState !== 'offline' && syncState !== 'error' && pingLatency !== -1;

  let report = `# FALCON ROD MAKER ERP — DETAILED SYNC STATUS & SYSTEM REPORT\n`;
  report += `Generated: ${localDate} (${timestamp})\n`;
  report += `=========================================================================\n\n`;

  report += `## 1. CLOUD SYNC & NETWORK REACHABILITY\n`;
  report += `- Overall Sync Engine State: ${syncState.toUpperCase()}\n`;
  report += `- Browser Network Connectivity: ${isOnline ? 'ONLINE' : 'OFFLINE (Disconnected)'}\n`;
  report += `- Firebase Firestore Reachability: ${isFirebaseReachable ? 'REACHABLE & HEALTHY' : 'UNREACHABLE / OFFLINE FALLBACK'}\n`;
  report += `- Firestore Ping Latency: ${pingLatency === null ? 'Untested' : pingLatency === -1 ? 'FAILED (Unreachable / Timeout)' : `${pingLatency} ms`}\n`;
  report += `- Target Cloud Project ID: ${firebaseConfig.projectId}\n`;
  report += `- Firestore Database ID: ${firestoreDbId}\n`;
  report += `- Realtime Collection Path: sync_states / falcon_workshop\n`;
  report += `- Last Cloud Sync: ${lastSyncTime || 'Pending initial synchronization'}\n`;
  report += `- Pending Local Mutations in Queue: ${pendingQueueCount} item(s)\n`;
  if (syncErrorMsg) {
    report += `- Current Error Diagnostics: ${syncErrorMsg}\n`;
  } else {
    report += `- Current Error Diagnostics: None (Operations Nominal)\n`;
  }
  report += `\n`;

  report += `## 2. TERMINAL DEVICE & AUTHENTICATION\n`;
  report += `- Terminal Name: ${terminalName}\n`;
  report += `- Terminal ID: ${terminalId}\n`;
  report += `- Verified Owner Account: ${userEmail}\n`;
  report += `- Terminal Role: POS Master Terminal\n`;
  report += `- Operational Mode: ${isFirebaseReachable ? 'Cloud Primary (Two-way Realtime)' : 'Autonomous Local Storage (Offline Safe)'}\n\n`;

  report += `## 3. LOCAL DATABASE VOLUME & STORAGE FOOTPRINT\n`;
  report += `- Total Active Records: ${metrics.totalRecords.toLocaleString()}\n`;
  report += `- Customer / Factory Orders: ${metrics.transactionsCount.toLocaleString()}\n`;
  report += `- Finished Products & Rods: ${metrics.productsCount.toLocaleString()}\n`;
  report += `- Industrial Accounts / Factories: ${metrics.factoriesCount.toLocaleString()}\n`;
  report += `- Customer Ledger Journal Entries: ${metrics.ledgerEntriesCount.toLocaleString()}\n`;
  report += `- Raw Material Stock Inventory: ${metrics.rawStockCount.toLocaleString()}\n`;
  report += `- Raw Material Suppliers: ${metrics.rawSuppliersCount.toLocaleString()}\n`;
  report += `- Paint Ledger Accounts: ${metrics.paintersCount.toLocaleString()}\n`;
  report += `- Labour & Worker Profiles: ${metrics.workersCount.toLocaleString()}\n`;
  report += `- Scrap Material Buyers: ${metrics.scrapBuyersCount.toLocaleString()}\n`;
  report += `- Cash Withdrawals: ${metrics.withdrawalsCount.toLocaleString()}\n`;
  report += `- Factory Expenses: ${metrics.expensesCount.toLocaleString()}\n`;
  report += `- Product Returns / Defective Logs: ${metrics.returnsCount.toLocaleString()}\n`;
  report += `- Local Storage Consumption: ${metrics.storageSizeKB} KB (~${(metrics.storageSizeKB / 1024).toFixed(2)} MB)\n\n`;

  report += `## 4. EMERGENCY OFFLINE RECOVERY RECOMMENDATION\n`;
  if (!isFirebaseReachable) {
    report += `[ACTION REQUIRED]: Firebase Firestore is currently unreachable. Your workshop operations are running entirely from high-performance local storage. All records remain 100% safe. You may use the "Export Entire Local Database" button below to save a manual JSON snapshot (.json) or full SQL dump (.sql) to your device.\n`;
  } else {
    report += `[ALL SYSTEMS OPERATIONAL]: Real-time bi-directional synchronization to Google Cloud Firestore is active. All transactions are securely duplicated in the cloud.\n`;
  }
  report += `=========================================================================\n`;

  return report;
}

export function getDatabaseJSONString(
  appState: AppState,
  userEmail: string,
  terminalId: string,
  isFirebaseReachable: boolean
): { jsonString: string; filename: string } {
  const timestamp = todayISO().replace(/-/g, '');
  const timeStr = new Date().toTimeString().slice(0, 5).replace(/:/g, '');
  const metrics = calculateDatabaseMetrics(appState);

  const exportPayload = {
    _meta: {
      exportType: 'FALCON_ERP_LOCAL_DATABASE_MANUAL_BACKUP',
      schemaVersion: '2.4.0',
      exportedAt: new Date().toISOString(),
      ownerEmail: userEmail,
      terminalId,
      firebaseReachable: isFirebaseReachable,
      offlineFallbackActive: !isFirebaseReachable,
      totalRecordCount: metrics.totalRecords,
      storageSizeKB: metrics.storageSizeKB,
      targetProject: firebaseConfig.projectId,
      targetDatabase: firestoreDbId
    },
    appState
  };

  const filename = isFirebaseReachable
    ? `Falcon_Database_Backup_${timestamp}_${timeStr}.json`
    : `Falcon_EMERGENCY_Database_${timestamp}_${timeStr}.json`;

  return {
    jsonString: JSON.stringify(exportPayload, null, 2),
    filename
  };
}

export function getDatabaseSQLString(
  appState: AppState,
  userEmail: string
): { sqlString: string; filename: string } {
  const timestamp = todayISO().replace(/-/g, '');
  const timeStr = new Date().toTimeString().slice(0, 5).replace(/:/g, '');
  const sqlString = generateSQLDump(
    appState,
    userEmail,
    firebaseConfig.projectId,
    firestoreDbId
  );
  const filename = `Falcon_Database_Backup_${timestamp}_${timeStr}.sql`;
  return { sqlString, filename };
}

export function exportLocalDatabaseJSON(
  appState: AppState,
  userEmail: string,
  terminalId: string,
  isFirebaseReachable: boolean
) {
  const timestamp = todayISO().replace(/-/g, '');
  const timeStr = new Date().toTimeString().slice(0, 5).replace(/:/g, '');
  const metrics = calculateDatabaseMetrics(appState);

  const exportPayload = {
    _meta: {
      exportType: 'FALCON_ERP_LOCAL_DATABASE_MANUAL_BACKUP',
      schemaVersion: '2.4.0',
      exportedAt: new Date().toISOString(),
      ownerEmail: userEmail,
      terminalId,
      firebaseReachable: isFirebaseReachable,
      offlineFallbackActive: !isFirebaseReachable,
      totalRecordCount: metrics.totalRecords,
      storageSizeKB: metrics.storageSizeKB,
      targetProject: firebaseConfig.projectId,
      targetDatabase: firestoreDbId
    },
    appState
  };

  const filename = isFirebaseReachable
    ? `Falcon_Local_Database_Backup_${timestamp}_${timeStr}`
    : `Falcon_EMERGENCY_OFFLINE_Database_${timestamp}_${timeStr}`;

  downloadJSON(exportPayload, filename);
}

export function exportLocalDatabaseSQL(appState: AppState, userEmail: string) {
  downloadSQLFile(
    appState,
    userEmail,
    firebaseConfig.projectId,
    firestoreDbId
  );
}
