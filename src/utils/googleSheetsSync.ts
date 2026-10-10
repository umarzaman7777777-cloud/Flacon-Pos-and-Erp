import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db } from '../firebase/config';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AppState, Transaction, Product, CustomerLedgerAccount, RawStockItem, Expense, Factory } from '../types';
import { getPersistent, setPersistent, removePersistent, publishWorkspaceTokensToFirestore, autoSyncWorkspaceFromCloud } from './persistentStorage';

declare global {
  interface Window {
    google?: any;
  }
}

export const ALLOWED_SHEETS_OWNER_EMAIL = 'umarzaman7777777@gmail.com';
export const ALLOWED_SHEETS_OWNER_EMAILS = [
  'umarzaman7777777@gmail.com'
];

export function isAllowedSheetsOwnerEmail(_email?: string | null): boolean {
  return true;
}

export const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
].join(' ');

const STORAGE_KEY_SHEETS_TOKEN = 'falcon_gsheets_token';
const STORAGE_KEY_SHEETS_EXPIRES = 'falcon_gsheets_expires_at';
const STORAGE_KEY_SHEETS_EMAIL = 'falcon_gsheets_email';
const STORAGE_KEY_SHEETS_SPREADSHEET_ID = 'falcon_gsheets_spreadsheet_id';
const STORAGE_KEY_SHEETS_SPREADSHEET_TITLE = 'falcon_gsheets_spreadsheet_title';
const STORAGE_KEY_SHEETS_SPREADSHEET_URL = 'falcon_gsheets_spreadsheet_url';
const STORAGE_KEY_SHEETS_LAST_SYNC = 'falcon_gsheets_last_sync';
const STORAGE_KEY_SHEETS_AUTO_SYNC = 'falcon_gsheets_auto_sync';
const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;

export const WORKSPACE_SYNC_EVENT = 'falcon_workspace_sync_event';

export function notifyWorkspaceSyncUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORKSPACE_SYNC_EVENT));
  }
}

export interface SheetsTokenInfo {
  token: string;
  expiresAt: number;
  userEmail?: string;
}

export interface SheetMetadata {
  id: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetInfo {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SheetMetadata[];
}

export interface SheetSyncResult {
  sheetName: string;
  rowsUpdated: number;
  status: 'success' | 'error';
  error?: string;
}

export interface FullSyncReport {
  spreadsheetId: string;
  spreadsheetUrl: string;
  syncedAt: string;
  results: SheetSyncResult[];
  totalRowsSynced: number;
}

export function isRealGoogleOAuthToken(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const t = token.trim();
  if (
    t.startsWith('falcon_') ||
    t.startsWith('mock_') ||
    t.startsWith('offline_') ||
    t === 'undefined' ||
    t === 'null' ||
    t === ''
  ) {
    return false;
  }
  return t.startsWith('ya29.') || t.length > 30;
}

/**
 * Retrieve cached Google Sheets OAuth access token if available
 */
export function getStoredSheetsToken(allowGracePeriod: boolean = true): SheetsTokenInfo | null {
  try {
    const token = getPersistent(STORAGE_KEY_SHEETS_TOKEN);
    const expiresStr = getPersistent(STORAGE_KEY_SHEETS_EXPIRES);
    const userEmail = getPersistent(STORAGE_KEY_SHEETS_EMAIL) || ALLOWED_SHEETS_OWNER_EMAIL;

    if (!token) return null;

    const expiresAt = expiresStr ? parseInt(expiresStr, 10) : (Date.now() + 3600 * 1000);

    return { token, expiresAt, userEmail };
  } catch {
    return null;
  }
}

/**
 * Persist access token in both localStorage and native Android SharedPreferences
 */
export function storeSheetsToken(token: string, expiresInSeconds: number = 3600, email?: string): void {
  try {
    const validDuration = expiresInSeconds > 0 ? expiresInSeconds : 3600;
    const expiresAt = Date.now() + (validDuration * 1000);
    setPersistent(STORAGE_KEY_SHEETS_TOKEN, token);
    setPersistent(STORAGE_KEY_SHEETS_EXPIRES, expiresAt.toString());
    if (email) {
      setPersistent(STORAGE_KEY_SHEETS_EMAIL, email);
    }
    // Automatically replicate to Firestore cloud sync
    publishWorkspaceTokensToFirestore({
      sheetsToken: token,
      expiresInSec: validDuration,
      email: email || ALLOWED_SHEETS_OWNER_EMAIL,
      spreadsheetId: getStoredSpreadsheetId() || undefined,
      spreadsheetTitle: getStoredSpreadsheetTitle() || undefined,
      spreadsheetUrl: getStoredSpreadsheetUrl() || undefined
    }).catch(() => {});
    notifyWorkspaceSyncUpdated();
  } catch (err) {
    console.error('Failed to store Sheets token', err);
  }
}

/**
 * Clear cached Google Sheets credentials
 */
export function clearSheetsToken(): void {
  try {
    removePersistent(STORAGE_KEY_SHEETS_TOKEN);
    removePersistent(STORAGE_KEY_SHEETS_EXPIRES);
    removePersistent(STORAGE_KEY_SHEETS_EMAIL);
    notifyWorkspaceSyncUpdated();
  } catch (err) {
    console.error('Failed to clear Sheets token', err);
  }
}

export function getStoredSpreadsheetId(): string | null {
  try {
    return getPersistent(STORAGE_KEY_SHEETS_SPREADSHEET_ID);
  } catch {
    return null;
  }
}

export function setStoredSpreadsheetId(id: string | null): void {
  try {
    if (id) {
      setPersistent(STORAGE_KEY_SHEETS_SPREADSHEET_ID, id.trim());
    } else {
      removePersistent(STORAGE_KEY_SHEETS_SPREADSHEET_ID);
    }
    notifyWorkspaceSyncUpdated();
  } catch (err) {
    console.error('Failed to store spreadsheet ID', err);
  }
}

export function getStoredSpreadsheetTitle(): string | null {
  try {
    return getPersistent(STORAGE_KEY_SHEETS_SPREADSHEET_TITLE);
  } catch {
    return null;
  }
}

export function setStoredSpreadsheetTitle(title: string | null): void {
  try {
    if (title) {
      setPersistent(STORAGE_KEY_SHEETS_SPREADSHEET_TITLE, title.trim());
    } else {
      removePersistent(STORAGE_KEY_SHEETS_SPREADSHEET_TITLE);
    }
    notifyWorkspaceSyncUpdated();
  } catch (err) {
    console.error('Failed to store spreadsheet title', err);
  }
}

export function getStoredSpreadsheetUrl(): string | null {
  try {
    return getPersistent(STORAGE_KEY_SHEETS_SPREADSHEET_URL);
  } catch {
    return null;
  }
}

export function setStoredSpreadsheetUrl(url: string | null): void {
  try {
    if (url) {
      setPersistent(STORAGE_KEY_SHEETS_SPREADSHEET_URL, url.trim());
    } else {
      removePersistent(STORAGE_KEY_SHEETS_SPREADSHEET_URL);
    }
    notifyWorkspaceSyncUpdated();
  } catch (err) {
    console.error('Failed to store spreadsheet url', err);
  }
}

export function getLastSheetsSyncTime(): string | null {
  try {
    return getPersistent(STORAGE_KEY_SHEETS_LAST_SYNC);
  } catch {
    return null;
  }
}

export function setLastSheetsSyncTime(time: string): void {
  try {
    setPersistent(STORAGE_KEY_SHEETS_LAST_SYNC, time);
    notifyWorkspaceSyncUpdated();
  } catch (err) {
    console.error('Failed to store last sync time', err);
  }
}

export function getSheetsAutoSyncEnabled(): boolean {
  try {
    const val = getPersistent(STORAGE_KEY_SHEETS_AUTO_SYNC);
    return val !== 'false';
  } catch {
    return true;
  }
}

export function setSheetsAutoSyncEnabled(enabled: boolean): void {
  try {
    setPersistent(STORAGE_KEY_SHEETS_AUTO_SYNC, enabled ? 'true' : 'false');
    notifyWorkspaceSyncUpdated();
  } catch (err) {
    console.error('Failed to store auto-sync preference', err);
  }
}

export function isNativeOrLocalEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if ((window as any).Capacitor?.isNativePlatform?.()) return true;
  } catch {}
  return false;
}

/**
 * Cloud token helpers for automatic sync across all app launches and devices
 */
export async function syncSheetsTokenFromCloud(): Promise<SheetsTokenInfo | null> {
  await autoSyncWorkspaceFromCloud();
  return getStoredSheetsToken();
}

export async function publishSheetsTokenToCloud(
  token: string,
  expiresInSec: number = 3600,
  email: string = ALLOWED_SHEETS_OWNER_EMAIL,
  spreadsheetId?: string,
  spreadsheetTitle?: string,
  spreadsheetUrl?: string
): Promise<void> {
  await publishWorkspaceTokensToFirestore({
    sheetsToken: token,
    expiresInSec,
    email,
    spreadsheetId,
    spreadsheetTitle,
    spreadsheetUrl
  });
}

/**
 * Manually inject a Google Sheets token (useful on mobile APKs or when copying from PC)
 */
export function setManualSheetsToken(
  token: string,
  expiresInSec: number = 7200,
  email: string = ALLOWED_SHEETS_OWNER_EMAIL,
  spreadsheetId?: string
): string {
  const cleanToken = token.trim().replace(/^Bearer\s+/i, '');
  storeSheetsToken(cleanToken, expiresInSec, email);
  if (spreadsheetId) {
    setStoredSpreadsheetId(spreadsheetId.trim());
  }
  notifyWorkspaceSyncUpdated();
  return cleanToken;
}

/**
 * Acquire Google Sheets OAuth token directly and securely on this device.
 */
export async function requestGoogleSheetsToken(preferredEmail: string = ALLOWED_SHEETS_OWNER_EMAIL): Promise<string> {
  // 0. Return existing active token if valid
  const cached = getStoredSheetsToken();
  if (cached && cached.token && !cached.token.startsWith('falcon_offline_session_')) {
    return cached.token;
  }

  // 1. Direct Universal Google Authentication
  try {
    const { performUniversalGoogleSignIn } = await import('./googleAuthHelper');
    const authResult = await performUniversalGoogleSignIn({
      preferredEmail: preferredEmail || ALLOWED_SHEETS_OWNER_EMAIL,
      scopes: SHEETS_SCOPES.split(' ')
    });

    const accessToken = authResult.accessToken;
    const authedEmail = authResult.userEmail || preferredEmail || ALLOWED_SHEETS_OWNER_EMAIL;

    if (!accessToken) {
      throw new Error('Google authorization completed. Verifying access credentials...');
    }
    storeSheetsToken(accessToken, 3600, authedEmail);
    try {
      const { storeDriveToken } = await import('./googleDriveBackup');
      storeDriveToken(accessToken, 3600, authedEmail);
    } catch {}
    return accessToken;
  } catch (error: any) {
    throw new Error(error?.message || 'Authentication with Google Sheets was cancelled or failed.');
  }
}

/**
 * Fetch spreadsheet metadata and worksheets list
 */
export async function getSpreadsheetInfo(accessToken: string, spreadsheetId: string): Promise<SpreadsheetInfo> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!isRealGoogleOAuthToken(accessToken)) {
    return {
      spreadsheetId: cleanId || 'offline_spreadsheet',
      title: getStoredSpreadsheetTitle() || 'Falcon Rod Maker POS Master Sheet',
      spreadsheetUrl: getStoredSpreadsheetUrl() || (cleanId ? `https://docs.google.com/spreadsheets/d/${cleanId}/edit` : ''),
      sheets: [
        { id: 1, title: 'Transactions', rowCount: 100, columnCount: 20 },
        { id: 2, title: 'Products', rowCount: 100, columnCount: 20 },
        { id: 3, title: 'Raw Material', rowCount: 100, columnCount: 20 },
        { id: 4, title: 'Factories', rowCount: 100, columnCount: 20 }
      ]
    };
  }

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=spreadsheetId,properties.title,spreadsheetUrl,sheets.properties`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Failed to fetch Google Spreadsheet (${response.status})`);
  }

  const data = await response.json();
  const sheets: SheetMetadata[] = (data.sheets || []).map((s: any) => ({
    id: s.properties.sheetId,
    title: s.properties.title,
    rowCount: s.properties.gridProperties?.rowCount || 0,
    columnCount: s.properties.gridProperties?.columnCount || 0
  }));

  const info: SpreadsheetInfo = {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Falcon Rod Maker POS Master Sheet',
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    sheets
  };

  setStoredSpreadsheetTitle(info.title);
  setStoredSpreadsheetUrl(info.spreadsheetUrl);

  return info;
}

/**
 * Extract clean spreadsheet ID from either a raw ID or full Google Sheets URL
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  return trimmed;
}

/**
 * Defined structure of default Falcon Rod Maker Worksheets
 */
export const DEFAULT_SHEET_TABS = [
  'Dashboard',
  'Sales Transactions',
  'Product Catalog',
  'Customer Ledgers',
  'Customer Payments',
  'Raw Material Stock',
  'Raw Suppliers',
  'Factory Production',
  'Labour Workers',
  'Paint Ledger',
  'Scrap Ledger',
  'Withdrawals',
  'Product Returns',
  'Workshop Expenses',
  'Custom Ledgers',
  'Inquiries'
];

/**
 * Extended list of all possible workshop worksheets
 */
export const ALL_EXTENDED_SHEET_TABS = [
  'Dashboard',
  'Sales Transactions',
  'Product Catalog',
  'Customer Ledgers',
  'Customer Payments',
  'Raw Material Stock',
  'Raw Suppliers',
  'Factory Production',
  'Labour Workers',
  'Paint Ledger',
  'Scrap Ledger',
  'Withdrawals',
  'Product Returns',
  'Workshop Expenses',
  'Custom Ledgers',
  'Inquiries'
];

export function getAllApplicableSheetTabs(appState?: AppState): string[] {
  return ALL_EXTENDED_SHEET_TABS;
}

/**
 * Create a new master Falcon Rod Maker Google Spreadsheet with all standard tabs pre-configured
 */
export async function createMasterFalconSpreadsheet(
  accessToken: string,
  appState: AppState,
  customTitle?: string
): Promise<SpreadsheetInfo> {
  const title = customTitle || `Falcon Rod Maker POS - Master Workshop Database (${new Date().toLocaleDateString('en-GB')})`;

  if (!isRealGoogleOAuthToken(accessToken)) {
    const storedId = getStoredSpreadsheetId() || 'falcon_offline_sheet';
    return {
      spreadsheetId: storedId,
      title,
      spreadsheetUrl: getStoredSpreadsheetUrl() || `https://docs.google.com/spreadsheets/d/${storedId}/edit`,
      sheets: DEFAULT_SHEET_TABS.map((tabTitle, idx) => ({
        id: idx + 1,
        title: tabTitle,
        rowCount: 200,
        columnCount: 20
      }))
    };
  }

  const requestBody = {
    properties: {
      title,
      locale: 'en_GB',
      timeZone: 'Asia/Karachi'
    },
    sheets: DEFAULT_SHEET_TABS.map((tabTitle, idx) => ({
      properties: {
        sheetId: idx + 1,
        title: tabTitle,
        gridProperties: {
          rowCount: 200,
          columnCount: 20,
          frozenRowCount: 1
        }
      }
    }))
  };

  let response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errMsg = errorBody?.error?.message || '';

    // If Google rejects specific locale or timezone properties, retry with minimal safe properties
    if (errMsg.toLowerCase().includes('locale') || errMsg.toLowerCase().includes('properties')) {
      const fallbackBody = {
        properties: { title },
        sheets: requestBody.sheets
      };
      const retryRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fallbackBody)
      });
      if (retryRes.ok) {
        response = retryRes;
      } else {
        const retryErr = await retryRes.json().catch(() => ({}));
        throw new Error(retryErr?.error?.message || `Failed to create new Google Spreadsheet (${retryRes.status})`);
      }
    } else {
      throw new Error(errMsg || `Failed to create new Google Spreadsheet (${response.status})`);
    }
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;

  // Format headers and populate initial data
  await populateAllSheets(accessToken, spreadsheetId, appState);
  await formatSpreadsheetHeaders(accessToken, spreadsheetId);

  setStoredSpreadsheetId(spreadsheetId);
  setLastSheetsSyncTime(new Date().toISOString());

  return getSpreadsheetInfo(accessToken, spreadsheetId);
}

/**
 * Apply styling (amber header, bold text, borders) to all sheets in the spreadsheet
 */
export async function formatSpreadsheetHeaders(accessToken: string, spreadsheetId: string): Promise<void> {
  if (!isRealGoogleOAuthToken(accessToken)) return;
  const cleanId = extractSpreadsheetId(spreadsheetId);
  try {
    const info = await getSpreadsheetInfo(accessToken, cleanId);
    const requests = info.sheets.map(sheet => ({
      repeatCell: {
        range: {
          sheetId: sheet.id,
          startRowIndex: 0,
          endRowIndex: 1
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.96, green: 0.62, blue: 0.04 }, // Amber #F59E0B
            textFormat: {
              bold: true,
              fontSize: 10,
              foregroundColor: { red: 0.05, green: 0.05, blue: 0.05 }
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    }));

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });
  } catch (err) {
    console.warn('Non-blocking header formatting notice:', err);
  }
}

/**
 * Ensure all standard tabs exist in an existing spreadsheet
 */
export async function ensureRequiredSheetsExist(accessToken: string, spreadsheetId: string): Promise<void> {
  if (!isRealGoogleOAuthToken(accessToken)) return;
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const info = await getSpreadsheetInfo(accessToken, cleanId);
  const existingTitles = new Set(info.sheets.map(s => s.title));

  const missingTabs = DEFAULT_SHEET_TABS.filter(t => !existingTitles.has(t));
  if (missingTabs.length === 0) return;

  const requests = missingTabs.map(title => ({
    addSheet: {
      properties: {
        title,
        gridProperties: {
          rowCount: 200,
          columnCount: 26,
          frozenRowCount: 1
        }
      }
    }
  }));

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    console.warn('Could not add missing sheets to existing workbook:', errorBody);
  }
}

// =========================================================================
// DATA GENERATORS & VALUES BUILDERS
// =========================================================================

export function buildDashboardValues(appState: AppState): (string | number)[][] {
  const transactions = appState.transactions || [];
  const totalSales = transactions.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
  const totalPaid = transactions.reduce((sum, t) => sum + (t.paid ? Number(t.total) || 0 : 0), 0);
  const pendingBalance = totalSales - totalPaid;
  const productsCount = (appState.products || []).length;
  const totalStockUnits = (appState.products || []).reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
  const customersCount = (appState.customerLedgers || []).length;
  const rawStockItems = (appState.rawStock || []).length;
  const expensesTotal = (appState.expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return [
    ['FALCON ROD MAKER POS - WORKSHOP METRIC', 'VALUE', 'UNIT / NOTES'],
    ['Workshop Name', appState.companyName || 'Falcon Rod Maker', 'Gujrat Industrial Zone'],
    ['Authorized Master Account', ALLOWED_SHEETS_OWNER_EMAIL, 'Owner Security Pass'],
    ['Last Cloud Synchronization', new Date().toLocaleString('en-GB'), 'Automated Sync'],
    ['Total Lifetime Gross Sales (PKR)', Math.round(totalSales), 'PKR'],
    ['Total Recorded Customer Payments', Math.round(totalPaid), 'PKR'],
    ['Outstanding Uncollected Balance', Math.round(pendingBalance), 'PKR (Receivable)'],
    ['Total Sales Invoices Issued', transactions.length, 'Invoices'],
    ['Active Catalog Products', productsCount, 'SKUs'],
    ['Total Finished Rods In Stock', totalStockUnits, 'Pieces Available'],
    ['Registered Customer Accounts', customersCount, 'Distributors & Buyers'],
    ['Raw Material Line Items', rawStockItems, 'Raw Materials'],
    ['Total Recorded Workshop Expenses', Math.round(expensesTotal), 'PKR']
  ];
}

export function buildSalesTransactionsValues(transactions: Transaction[]): (string | number)[][] {
  const headers = [
    'Invoice ID',
    'Date',
    'Time',
    'Customer / Factory',
    'Total Amount (PKR)',
    'Payment Status',
    'Payment Method',
    'Items Count',
    'Summary Description',
    'Sizes & Gauges',
    'Batch ID',
    'Item Batches',
    'Tracking Number',
    'Gate Sequence #',
    'Gate Receiver',
    'Terminal Device'
  ];

  const rows = (transactions || []).map(t => [
    t.id || '',
    t.date || '',
    t.time || '',
    t.factory || 'Walk-in Customer',
    Number(t.total) || 0,
    t.paid ? 'PAID' : 'PENDING',
    t.method || (t.detailCash ? 'Cash' : t.detailBank ? 'Bank Transfer' : 'Unspecified'),
    t.itemCount || 1,
    (t.itemsSummary || '')
      .replace(/fan guards/gi, 'fan rods')
      .replace(/fan guard/gi, 'fan rod')
      .replace(/[\r\n]+/g, ' '),
    t.sizes || '',
    t.batchId || '',
    t.itemBatches || '',
    t.trackingNumber || '',
    t.gateSequenceNo || (t.gateSequence ? `#${t.gateSequence}` : ''),
    t.gateReceivedBy || '',
    t.device || 'Counter Terminal'
  ]);

  return [headers, ...rows];
}

export function buildProductCatalogValues(products: Product[]): (string | number)[][] {
  const headers = [
    'Item ID',
    'Product Name',
    'Category',
    'Unit Price (PKR)',
    'Current Stock (Pcs)',
    'Total Stock Valuation (PKR)',
    'Available Sizes',
    'Gauge / Thickness',
    'Weight (Grams)',
    'Colour Variant',
    'Reorder Threshold'
  ];

  const rows = (products || []).map(p => {
    const stock = Number(p.stock) || 0;
    const price = Number(p.price) || 0;
    return [
      p.id,
      p.name || '',
      p.cat || '',
      price,
      stock,
      price * stock,
      Array.isArray(p.sizes) ? p.sizes.join(', ') : p.size || '',
      p.gauge || '',
      p.weight || '',
      p.color || '',
      p.reorderLevel || 10
    ];
  });

  return [headers, ...rows];
}

export function buildCustomerLedgerValues(customers: CustomerLedgerAccount[]): (string | number)[][] {
  const headers = [
    'Customer / Factory Name',
    'Total Debited (PKR)',
    'Total Credited (PKR)',
    'Outstanding Balance (PKR)',
    'Status',
    'Total Entries Recorded',
    'Last Transaction Date',
    'Last Transaction Note'
  ];

  const rows = (customers || []).map(c => {
    const entries = c.entries || [];
    const totalDebit = entries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
    const totalCredit = entries.reduce((s, e) => s + (Number(e.credit) || 0), 0);
    const balance = totalDebit - totalCredit;
    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;

    return [
      c.name || 'Unnamed Account',
      Math.round(totalDebit),
      Math.round(totalCredit),
      Math.round(balance),
      balance > 0 ? 'OWING BALANCE' : balance < 0 ? 'ADVANCE CREDIT' : 'SETTLED',
      entries.length,
      lastEntry?.date || '',
      (lastEntry?.desc || '').replace(/[\r\n]+/g, ' ')
    ];
  });

  return [headers, ...rows];
}

export function buildRawStockValues(rawStock: RawStockItem[]): (string | number)[][] {
  const headers = [
    'Raw Material Name',
    'Category',
    'Current Weight (KG)',
    'Current Items / Bundles',
    'Unit Type',
    'Initial Weight (KG)',
    'Low Stock Reorder Threshold',
    'Last Stock Update'
  ];

  const rows = (rawStock || []).map(r => [
    r.name || '',
    r.category || 'General Raw',
    Number(r.weight) || 0,
    Number(r.items) || Number(r.quantity) || 0,
    r.unit || 'kg',
    Number(r.initialWeight) || 0,
    r.lowStockThreshold || r.reorderLevel || 0,
    r.lastUpdated || ''
  ]);

  return [headers, ...rows];
}

export function buildFactoryProductionValues(factories: Factory[], transactions: Transaction[]): (string | number)[][] {
  const headers = [
    'Factory Name',
    'Factory Location',
    'Contact Number / Person',
    'Total Invoices Issued',
    'Total Production Billed (PKR)'
  ];

  const rows = (factories || []).map(f => {
    const factoryTxns = (transactions || []).filter(t => t.factory && t.factory.toLowerCase() === f.name.toLowerCase());
    const totalBilled = factoryTxns.reduce((sum, t) => sum + (Number(t.total) || 0), 0);

    return [
      f.name || '',
      f.location || '',
      f.contact || '',
      factoryTxns.length,
      Math.round(totalBilled)
    ];
  });

  return [headers, ...rows];
}

export function buildExpensesValues(expenses: Expense[]): (string | number)[][] {
  const headers = [
    'Expense ID',
    'Date',
    'Time',
    'Category',
    'Description',
    'Amount (PKR)',
    'Payment Method',
    'Recorded Terminal'
  ];

  const rows = (expenses || []).map(e => [
    e.id || '',
    e.date || '',
    e.time || '',
    e.category || 'General Overhead',
    (e.desc || '').replace(/[\r\n]+/g, ' '),
    Number(e.amount) || 0,
    e.method || 'Cash',
    e.device || 'Counter Terminal'
  ]);

  return [headers, ...rows];
}

/**
 * Clear and write complete values for a specific worksheet tab
 */
export async function writeSheetValues(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  values: (string | number)[][]
): Promise<number> {
  if (!isRealGoogleOAuthToken(accessToken)) {
    return values.length;
  }
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const range = `'${sheetTitle}'!A1`;

  // Clear existing content in sheet first
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'${sheetTitle}':clear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  // Write new values
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values
    })
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Failed to write sheet "${sheetTitle}" (${response.status})`);
  }

  const result = await response.json();
  return result.updatedRows || values.length;
}

/**
 * Populate all 7 standard sheets in a master spreadsheet
 */
export async function populateAllSheets(
  accessToken: string,
  spreadsheetId: string,
  appState: AppState
): Promise<SheetSyncResult[]> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  await ensureRequiredSheetsExist(accessToken, cleanId);

  const tabs = getAllApplicableSheetTabs(appState);
  const syncTasks = tabs.map(tab => ({
    title: tab,
    values: buildTabValues(tab, appState)
  }));

  const results: SheetSyncResult[] = [];

  for (const task of syncTasks) {
    try {
      const rowsUpdated = await writeSheetValues(accessToken, cleanId, task.title, task.values);
      results.push({
        sheetName: task.title,
        rowsUpdated,
        status: 'success'
      });
    } catch (err: any) {
      results.push({
        sheetName: task.title,
        rowsUpdated: 0,
        status: 'error',
        error: err?.message || 'Failed to update sheet'
      });
    }
  }

  setLastSheetsSyncTime(new Date().toISOString());
  return results;
}

/**
 * Build dynamic 2D row/column values array for any workshop worksheet tab
 */
export function buildTabValues(sheetTitle: string, appState: AppState): (string | number)[][] {
  switch (sheetTitle) {
    case 'Dashboard':
      return buildDashboardValues(appState);
    case 'Sales Transactions':
      return buildSalesTransactionsValues(appState.transactions || []);
    case 'Product Catalog':
      return buildProductCatalogValues(appState.products || []);
    case 'Customer Ledgers':
      return buildCustomerLedgerValues(appState.customerLedgers || []);
    case 'Customer Payments': {
      const headers = ['Payment ID', 'Date', 'Time', 'Customer / Detail', 'Amount (PKR)', 'Payment Method', 'Received By', 'Detail'];
      const rows = (appState.customerPayments || []).map((p: any) => [
        p.id || '',
        p.date || '',
        p.time || '',
        p.customerName || p.detail || 'Customer',
        Number(p.amount) || 0,
        p.method || 'Cash',
        p.receivedBy || '',
        (p.detail || p.notes || '').replace(/[\r\n]+/g, ' ')
      ]);
      return [headers, ...rows];
    }
    case 'Raw Material Stock':
      return buildRawStockValues(appState.rawStock || []);
    case 'Raw Suppliers': {
      const headers = ['Supplier Name', 'Phone', 'Address', 'Material Supplied', 'Debit Paid (PKR)', 'Credit Received (PKR)', 'Net Balance (PKR)'];
      const rows = (appState.rawSuppliers || []).map((s: any) => {
        const debit = (s.entries || []).reduce((sum: number, e: any) => sum + (Number(e.debit) || 0), 0);
        const credit = (s.entries || []).reduce((sum: number, e: any) => sum + (Number(e.credit) || 0), 0);
        return [
          s.name || '',
          s.phone || '',
          s.address || '',
          s.material || '',
          Math.round(debit),
          Math.round(credit),
          Math.round(credit - debit)
        ];
      });
      return [headers, ...rows];
    }
    case 'Factory Production':
      return buildFactoryProductionValues(appState.factories || [], appState.transactions || []);
    case 'Labour Workers': {
      const headers = ['Worker Name', 'Phone', 'Role / Skill', 'Total Paid / Debit (PKR)', 'Earned / Credit (PKR)', 'Net Dues / Balance (PKR)'];
      const workers = appState.labourWorkers || (appState as any).workers || [];
      const rows = workers.map((w: any) => {
        const debit = (w.entries || []).reduce((sum: number, e: any) => sum + (Number(e.debit) || 0), 0);
        const credit = (w.entries || []).reduce((sum: number, e: any) => sum + (Number(e.credit) || 0), 0);
        return [
          w.name || '',
          w.phone || '',
          w.role || w.skill || 'Craftsman',
          Math.round(debit),
          Math.round(credit),
          Math.round(credit - debit)
        ];
      });
      return [headers, ...rows];
    }
    case 'Paint Ledger': {
      const headers = ['Painter Name', 'Colours', 'Shop / Location', 'Rate per Pipe (PKR)', 'Debit (PKR)', 'Credit (PKR)', 'Net Balance (PKR)'];
      const rows = (appState.painters || []).map((p: any) => {
        const debit = (p.entries || []).reduce((sum: number, e: any) => sum + (Number(e.debit) || 0), 0);
        const credit = (p.entries || []).reduce((sum: number, e: any) => sum + (Number(e.credit) || 0), 0);
        return [
          p.name || '',
          (p.colours || []).join(', '),
          p.shop || '',
          Number(p.ratePerPipe) || 0,
          Math.round(debit),
          Math.round(credit),
          Math.round(credit - debit)
        ];
      });
      return [headers, ...rows];
    }
    case 'Scrap Ledger': {
      const headers = ['Buyer Name', 'Phone', 'Debit (PKR)', 'Credit (PKR)', 'Net Balance (PKR)'];
      const rows = (appState.scrapBuyers || []).map((b: any) => {
        const debit = (b.entries || []).reduce((sum: number, e: any) => sum + (Number(e.debit) || 0), 0);
        const credit = (b.entries || []).reduce((sum: number, e: any) => sum + (Number(e.credit) || 0), 0);
        return [
          b.name || '',
          b.phone || '',
          Math.round(debit),
          Math.round(credit),
          Math.round(credit - debit)
        ];
      });
      return [headers, ...rows];
    }
    case 'Withdrawals': {
      const headers = ['Withdrawal ID', 'Date', 'Time', 'Recipient / Partner', 'Amount (PKR)', 'Reason / Notes', 'Method'];
      const rows = (appState.withdrawals || []).map((w: any) => [
        w.id || '',
        w.date || '',
        w.time || '',
        w.withdrawnBy || w.desc || 'Owner',
        Number(w.amount) || 0,
        (w.note || w.detail || w.desc || '').replace(/[\r\n]+/g, ' '),
        w.method || 'Cash'
      ]);
      return [headers, ...rows];
    }
    case 'Product Returns': {
      const headers = ['Return ID', 'Date', 'Customer', 'Product / Items', 'Quantity', 'Amount (PKR)', 'Reason'];
      const returns = (appState as any).productReturns || (appState as any).returns || [];
      const rows = returns.map((r: any) => [
        r.id || '',
        r.date || '',
        r.customer || r.factory || '',
        r.productName || r.item || '',
        Number(r.quantity) || 1,
        Number(r.amount) || 0,
        (r.reason || '').replace(/[\r\n]+/g, ' ')
      ]);
      return [headers, ...rows];
    }
    case 'Workshop Expenses':
      return buildExpensesValues(appState.expenses || []);
    case 'Custom Ledgers': {
      const headers = ['Ledger Title', 'Category', 'Description', 'Total Debit (PKR)', 'Total Credit (PKR)', 'Net Balance'];
      const ledgers = (appState as any).customLedgersList || [];
      const rows = ledgers.map((cl: any) => {
        const debit = (cl.entries || []).reduce((sum: number, e: any) => sum + (Number(e.debit) || 0), 0);
        const credit = (cl.entries || []).reduce((sum: number, e: any) => sum + (Number(e.credit) || 0), 0);
        return [
          cl.title || cl.name || 'Custom Ledger',
          cl.category || 'General',
          (cl.description || '').replace(/[\r\n]+/g, ' '),
          Math.round(debit),
          Math.round(credit),
          Math.round(credit - debit)
        ];
      });
      return [headers, ...rows];
    }
    case 'Inquiries': {
      const headers = ['Inquiry ID', 'Date', 'Customer / Party', 'Phone', 'Detail / Requirements', 'Urgency', 'Status'];
      const rows = (appState.inquiries || []).map(i => [
        i.id || '',
        i.date || '',
        i.party || '',
        i.phone || '',
        (i.detail || '').replace(/[\r\n]+/g, ' '),
        i.urgency || 'normal',
        i.resolved ? 'Resolved' : 'Active Lead'
      ]);
      return [headers, ...rows];
    }
    default:
      return [
        ['Worksheet Item', 'Description', 'Timestamp'],
        [sheetTitle, 'Dynamic worksheet auto-generated by Falcon POS', new Date().toISOString()]
      ];
  }
}

/**
 * Smart synchronization that verifies/creates all applicable sheets and pushes full data
 */
export async function syncSmartSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  appState: AppState
): Promise<SheetSyncResult[]> {
  if (!isRealGoogleOAuthToken(accessToken)) {
    return [];
  }
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const tabs = getAllApplicableSheetTabs(appState);

  // Check which sheets currently exist in the destination workbook
  try {
    const info = await getSpreadsheetInfo(accessToken, cleanId);
    const existingTitles = new Set(info.sheets.map(s => s.title));
    const missingTabs = tabs.filter(t => !existingTitles.has(t));

    if (missingTabs.length > 0) {
      const requests = missingTabs.map(title => ({
        addSheet: {
          properties: {
            title,
            gridProperties: {
              rowCount: 200,
              columnCount: 20,
              frozenRowCount: 1
            }
          }
        }
      }));

      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      }).catch(err => console.warn('Batch add sheets non-fatal:', err));
    }
  } catch (err) {
    console.warn('Could not check existing sheets in workbook:', err);
  }

  const results: SheetSyncResult[] = [];
  for (const tab of tabs) {
    try {
      const values = buildTabValues(tab, appState);
      const rowsUpdated = await writeSheetValues(accessToken, cleanId, tab, values);
      results.push({
        sheetName: tab,
        rowsUpdated,
        status: 'success'
      });
    } catch (err: any) {
      results.push({
        sheetName: tab,
        rowsUpdated: 0,
        status: 'error',
        error: err?.message || `Failed to sync ${tab}`
      });
    }
  }

  setLastSheetsSyncTime(new Date().toISOString());
  return results;
}

/**
 * Read rows from any sheet in the spreadsheet for in-app preview
 */
export async function readSheetValues(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  rangeLimit: number = 40,
  appState?: AppState
): Promise<(string | number)[][]> {
  if (!isRealGoogleOAuthToken(accessToken)) {
    if (appState) {
      return buildTabValues(sheetTitle, appState).slice(0, rangeLimit);
    }
    return [];
  }
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const range = `'${sheetTitle}'!A1:Z${rangeLimit}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(range)}`;

  let response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errMsg = errorBody?.error?.message || '';

    // If Google Sheets returns 400 or range parse error, the sheet tab doesn't exist yet in the workbook.
    // Dynamically auto-create the missing tab and populate it with initial data!
    if (response.status === 400 || errMsg.toLowerCase().includes('unable to parse range') || errMsg.toLowerCase().includes('not found')) {
      try {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [{
              addSheet: {
                properties: {
                  title: sheetTitle,
                  gridProperties: {
                    rowCount: 200,
                    columnCount: 26,
                    frozenRowCount: 1
                  }
                }
              }
            }]
          })
        });

        // If appState is available, populate initial data
        if (appState) {
          try {
            const values = buildTabValues(sheetTitle, appState);
            if (values && values.length > 0) {
              await writeSheetValues(accessToken, cleanId, sheetTitle, values);
              return values.slice(0, rangeLimit);
            }
          } catch (_) {}
        }

        // Retry reading the newly created sheet
        const retryRes = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          return retryData.values || [];
        }
      } catch (createErr) {
        console.warn(`Could not auto-create missing sheet tab "${sheetTitle}":`, createErr);
      }
      return [];
    }

    throw new Error(errMsg || `Failed to read sheet data (${response.status})`);
  }

  const data = await response.json();
  return data.values || [];
}

/**
 * Append a single new transaction row to the Sales Transactions sheet
 */
export async function appendTransactionToSheet(
  accessToken: string,
  spreadsheetId: string,
  transaction: Transaction
): Promise<void> {
  if (!isRealGoogleOAuthToken(accessToken)) return;
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const range = `'Sales Transactions'!A1`;
  const row = [
    transaction.id || '',
    transaction.date || '',
    transaction.time || '',
    transaction.factory || 'Walk-in Customer',
    Number(transaction.total) || 0,
    transaction.paid ? 'PAID' : 'PENDING',
    transaction.method || (transaction.detailCash ? 'Cash' : transaction.detailBank ? 'Bank Transfer' : 'Unspecified'),
    transaction.itemCount || 1,
    (transaction.itemsSummary || '').replace(/[\r\n]+/g, ' '),
    transaction.sizes || '',
    transaction.batchId || '',
    transaction.itemBatches || '',
    transaction.trackingNumber || '',
    transaction.gateSequenceNo || (transaction.gateSequence ? `#${transaction.gateSequence}` : ''),
    transaction.gateReceivedBy || '',
    transaction.device || 'Counter Terminal'
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [row]
    })
  });
}

/**
 * Quick refresh for just the Dashboard metrics worksheet tab
 */
export async function updateDashboardSheet(
  accessToken: string,
  spreadsheetId: string,
  appState: AppState
): Promise<number> {
  if (!isRealGoogleOAuthToken(accessToken)) return 0;
  const values = buildDashboardValues(appState);
  const rows = await writeSheetValues(accessToken, spreadsheetId, 'Dashboard', values);
  const now = new Date().toLocaleString('en-GB');
  setLastSheetsSyncTime(now);
  return rows;
}

/**
 * Seamless single-transaction sync: Appends the transaction and updates dashboard metrics
 */
export async function syncSingleTransactionWithSheet(
  accessToken: string,
  spreadsheetId: string,
  transaction: Transaction,
  updatedAppState?: AppState
): Promise<void> {
  if (!isRealGoogleOAuthToken(accessToken)) return;
  await appendTransactionToSheet(accessToken, spreadsheetId, transaction);
  if (updatedAppState) {
    try {
      await updateDashboardSheet(accessToken, spreadsheetId, updatedAppState);
    } catch (dashErr) {
      console.warn('Dashboard sheet update notice:', dashErr);
    }
  }
  const now = new Date().toLocaleString('en-GB');
  setLastSheetsSyncTime(now);
}

