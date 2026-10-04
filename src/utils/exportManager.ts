import { ExportedItem, Transaction, CustomerPayment, ExportDocumentConfig } from '../types';
import { fmt, amountInWordsEnglish, amountInWordsUrdu } from './helpers';
import { FALCON_LOGO_WHITE_BG_PNG } from './logoData';
import { parseTransactionItems } from './transactionPdf';
import { getSavedExportConfig } from './exportSettingsHelper';
import { triggerUniversalDownload } from './universalDownloader';
import {
  saveExportToIndexedDb,
  getAllExportsFromIndexedDb,
  deleteExportFromIndexedDb,
  clearAllExportsFromIndexedDb
} from './exportDb';

// Polyfill CanvasRenderingContext2D.prototype.roundRect for cross-browser safety
if (typeof window !== 'undefined' && typeof CanvasRenderingContext2D !== 'undefined') {
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (
      this: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      radii?: number | number[]
    ) {
      const r = typeof radii === 'number' ? radii : Array.isArray(radii) ? radii[0] || 0 : 0;
      const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
      this.moveTo(x + radius, y);
      this.arcTo(x + w, y, x + w, y + h, radius);
      this.arcTo(x + w, y + h, x, y + h, radius);
      this.arcTo(x, y + h, x, y, radius);
      this.arcTo(x, y, x + w, y, radius);
      this.closePath();
      return this;
    };
  }
}

const EXPORTS_STORAGE_KEY = 'falcon_exported_files_v1';
const EXPORT_EVENT_NAME = 'falcon-exports-updated';

/**
 * Sanitize and migrate any legacy Fan Guard references in exported items to Fan Rod
 */
export function sanitizeExportedItem(item: ExportedItem): { item: ExportedItem; changed: boolean } {
  const replaceOldNames = (s: string) => {
    return s
      .replace(/Exhaust Fan Guard/gi, 'Exhaust Fan Mounting Rod')
      .replace(/Universal Fan Guard/gi, 'Universal Fan Down Rod')
      .replace(/Painted Fan Guards/gi, 'Painted Fan Rods')
      .replace(/Fan Guards/gi, 'Fan Rods')
      .replace(/Fan Guard/gi, 'Fan Rod')
      .replace(/fan guards/gi, 'fan rods')
      .replace(/fan guard/gi, 'fan rod')
      .replace(/American-Kingri-Tikka-Tala/gi, 'Ceiling-Fan-Rod-24-Heavy')
      .replace(/American-Plain-Tikka-Tala/gi, 'Ceiling-Fan-Rod-18-Deluxe')
      .replace(/Tikka-Tala/gi, 'Tubular-Rod')
      .replace(/Tikka/gi, 'Rod')
      .replace(/Patri/gi, 'M.S. Pipe')
      .replace(/Steel Taar/gi, 'M.S. Steel Pipe')
      .replace(/Guard CAD Blueprint/gi, 'Fan Rod CAD Blueprint')
      .replace(/Guard Blueprint/gi, 'Fan Rod Blueprint')
      .replace(/Fan_Guard/gi, 'Fan_Rod')
      .replace(/fan_guard/gi, 'fan_rod');
  };

  const newTitle = replaceOldNames(item.title);
  const newDesc = item.description ? replaceOldNames(item.description) : item.description;
  const newFileName = replaceOldNames(item.fileName);
  const newCustomer = item.customerName ? replaceOldNames(item.customerName) : item.customerName;

  const changed =
    newTitle !== item.title ||
    newDesc !== item.description ||
    newFileName !== item.fileName ||
    newCustomer !== item.customerName;

  return {
    item: {
      ...item,
      title: newTitle,
      description: newDesc,
      fileName: newFileName,
      customerName: newCustomer
    },
    changed
  };
}

// In-memory cache for synchronous instant rendering across views
let memoryExportsCache: ExportedItem[] = [];
let isDbLoaded = false;
const activeSubscribers = new Set<(items: ExportedItem[]) => void>();

function notifySubscribers() {
  const snapshot = [...memoryExportsCache];
  activeSubscribers.forEach(cb => {
    try {
      cb(snapshot);
    } catch (err) {
      console.warn('Export subscriber error', err);
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EXPORT_EVENT_NAME, { detail: snapshot }));
  }
}

// Initial sync from localStorage so UI is immediately populated
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(EXPORTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        let anyChanged = false;
        memoryExportsCache = parsed.map(it => {
          const { item: clean, changed } = sanitizeExportedItem(it);
          if (changed) anyChanged = true;
          return clean;
        });
        if (anyChanged) {
          safelySaveToLocalStorage(memoryExportsCache);
        }
      }
    }
  } catch (err) {
    console.warn('Initial localStorage export read failed', err);
  }

  // Asynchronously hydrate from IndexedDB to ensure full high-resolution dataUrls
  loadExportedItems().catch(() => {});
}

/**
 * Asynchronously load full high-resolution exports from IndexedDB and merge with cache
 */
export async function loadExportedItems(): Promise<ExportedItem[]> {
  try {
    const dbItems = await getAllExportsFromIndexedDb();
    if (dbItems && dbItems.length > 0) {
      // Merge: prefer dbItems as they contain full high-resolution dataUrl
      const itemMap = new Map<string, ExportedItem>();
      let anyChanged = false;
      
      // First populate from IndexedDB with sanitization
      dbItems.forEach(item => {
        const { item: clean, changed } = sanitizeExportedItem(item);
        if (changed) {
          anyChanged = true;
          saveExportToIndexedDb(clean).catch(() => {});
        }
        itemMap.set(clean.id, clean);
      });

      // Merge any items from memory that might not be in DB yet
      memoryExportsCache.forEach(item => {
        const { item: clean, changed } = sanitizeExportedItem(item);
        if (changed) anyChanged = true;
        if (!itemMap.has(clean.id)) {
          itemMap.set(clean.id, clean);
          // Persist missing items to IndexedDB
          saveExportToIndexedDb(clean).catch(() => {});
        } else if (!itemMap.get(clean.id)?.dataUrl && clean.dataUrl) {
          itemMap.set(clean.id, { ...itemMap.get(clean.id)!, dataUrl: clean.dataUrl });
        }
      });

      const merged = Array.from(itemMap.values());
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      memoryExportsCache = merged;
      if (anyChanged) {
        safelySaveToLocalStorage(memoryExportsCache);
      }
      isDbLoaded = true;
      notifySubscribers();
      return merged;
    } else if (memoryExportsCache.length > 0 && !isDbLoaded) {
      // Migrate initial localStorage cache to IndexedDB
      for (const item of memoryExportsCache) {
        const { item: clean } = sanitizeExportedItem(item);
        saveExportToIndexedDb(clean).catch(() => {});
      }
      isDbLoaded = true;
    }
  } catch (err) {
    console.warn('Failed to load exports from IndexedDB:', err);
  }
  return [...memoryExportsCache];
}

/**
 * Retrieve all recorded exports synchronously (from memory/cache)
 */
export function getExportedItems(): ExportedItem[] {
  return [...memoryExportsCache];
}

/**
 * Helper to safely save to localStorage with quota protection
 */
function safelySaveToLocalStorage(items: ExportedItem[]) {
  try {
    // Try saving all items
    localStorage.setItem(EXPORTS_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('LocalStorage quota reached, saving compact metadata fallback', err);
    try {
      // Strip heavy dataUrl from older items in localStorage ONLY
      // (Full dataUrls remain 100% intact in IndexedDB and memory cache)
      const compactItems = items.map((item, idx) => {
        if (idx < 5) return item; // keep dataUrl for newest 5 items
        const { dataUrl: _, ...rest } = item;
        return rest as ExportedItem;
      });
      localStorage.setItem(EXPORTS_STORAGE_KEY, JSON.stringify(compactItems));
    } catch (compactErr) {
      // If still exceeding, keep only newest 25 metadata records
      try {
        const minimalItems = items.slice(0, 25).map(item => {
          const { dataUrl: _, ...rest } = item;
          return rest as ExportedItem;
        });
        localStorage.setItem(EXPORTS_STORAGE_KEY, JSON.stringify(minimalItems));
      } catch (_) {}
    }
  }
}

/**
 * Save an export item to IndexedDB, memory cache, and localStorage, then notify all UI listeners
 */
export function recordExport(item: Omit<ExportedItem, 'id' | 'createdAt'>): ExportedItem {
  const newItem: ExportedItem = {
    ...item,
    id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    createdAt: new Date().toISOString()
  };

  // Prepend so latest exports appear first, remove duplicates by filename and format
  memoryExportsCache = [
    newItem,
    ...memoryExportsCache.filter(i => i.fileName !== newItem.fileName || i.format !== newItem.format)
  ].slice(0, 200);

  // 1. Immediately notify all active UI listeners (synchronous state update)
  notifySubscribers();

  // 2. Persist full high-resolution dataUrl in IndexedDB (no 5MB quota restrictions)
  saveExportToIndexedDb(newItem).catch(err => {
    console.warn('IndexedDB async save warning:', err);
  });

  // 3. Persist to localStorage safely
  safelySaveToLocalStorage(memoryExportsCache);

  return newItem;
}

/**
 * Delete a specific export by ID
 */
export function deleteExportedItem(id: string): boolean {
  try {
    memoryExportsCache = memoryExportsCache.filter(item => item.id !== id);
    notifySubscribers();

    // Remove from IndexedDB
    deleteExportFromIndexedDb(id).catch(err => {
      console.warn('IndexedDB delete error', err);
    });

    // Update localStorage
    safelySaveToLocalStorage(memoryExportsCache);
    return true;
  } catch (err) {
    console.error('Failed to delete export item', err);
    return false;
  }
}

/**
 * Delete all exported files from archive
 */
export function clearAllExportedItems(): boolean {
  try {
    memoryExportsCache = [];
    notifySubscribers();

    // Clear IndexedDB
    clearAllExportsFromIndexedDb().catch(err => {
      console.warn('IndexedDB clear error', err);
    });

    // Clear localStorage
    localStorage.removeItem(EXPORTS_STORAGE_KEY);
    return true;
  } catch (err) {
    console.error('Failed to clear exports', err);
    return false;
  }
}

/**
 * Listen for export updates in React components
 */
export function subscribeToExports(callback: (items: ExportedItem[]) => void): () => void {
  activeSubscribers.add(callback);

  // Provide initial snapshot immediately
  try {
    callback([...memoryExportsCache]);
  } catch (_) {}

  const handler = (event: Event) => {
    const customEvt = event as CustomEvent;
    if (customEvt.detail && Array.isArray(customEvt.detail)) {
      callback([...customEvt.detail]);
    } else {
      callback([...memoryExportsCache]);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(EXPORT_EVENT_NAME, handler);
    window.addEventListener('storage', handler);
  }

  return () => {
    activeSubscribers.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener(EXPORT_EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    }
  };
}

/**
 * Helper to trigger immediate browser file download with blob conversion and error recovery
 */
export function triggerFileDownload(dataUrlOrBlob: string | Blob, fileName: string) {
  try {
    const isDataUrl = typeof dataUrlOrBlob === 'string' && dataUrlOrBlob.startsWith('data:');
    triggerUniversalDownload({
      fileName,
      content: dataUrlOrBlob,
      dataUrl: isDataUrl ? (dataUrlOrBlob as string) : undefined
    });
  } catch (err) {
    console.warn('Direct file download warning:', err);
  }
}

/**
 * Load an image from dataURL/src into an HTMLImageElement with timeout safety
 */
function loadImage(src: string, timeoutMs: number = 4000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!src) {
      return reject(new Error('Empty image source'));
    }
    const img = new Image();
    // Do NOT set crossOrigin for data: or blob: URIs as some browsers reject them
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }

    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      reject(new Error('Image load timed out'));
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = (e) => {
      clearTimeout(timer);
      reject(new Error('Failed to load image: ' + e));
    };
    img.src = src;
  });
}

/**
 * Formats approximate byte size of base64 data
 */
function estimateDataSize(dataUrl?: string): string {
  if (!dataUrl) return '150 KB';
  const bytes = Math.round((dataUrl.length * 3) / 4);
  if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return Math.round(bytes / 1024) + ' KB';
}

/**
 * EXPORT TRANSACTION AS CRISP HIGH-RESOLUTION JPG
 */
export async function exportSingleTransactionJPG(options: {
  transaction: Transaction;
  customerPayments: CustomerPayment[];
  companyName?: string;
  companyTagline?: string;
  signatureUrl?: string;
  stampUrl?: string;
  customConfig?: Partial<ExportDocumentConfig>;
}): Promise<string> {
  const globalCfg = getSavedExportConfig();
  const cfg: ExportDocumentConfig = {
    ...globalCfg,
    ...options.customConfig
  };

  const {
    transaction,
    customerPayments,
    companyName = cfg.companyName || 'Falcon Rod Maker',
    companyTagline = cfg.subtitle || 'Industrial Fan Accessories & Workshop ERP · Gujrat, Pakistan',
    signatureUrl,
    stampUrl
  } = options;

  const relevantPayments = customerPayments.filter(p => p.txnId === transaction.id);
  const paymentsSum = relevantPayments.reduce((s, p) => s + p.amount, 0);
  const totalPaid = paymentsSum + (transaction.paid ? transaction.total : 0);
  const dueAmount = Math.max(0, transaction.total - totalPaid);
  const isPaid = dueAmount <= 0;
  const isPartial = totalPaid > 0 && dueAmount > 0;
  const statusLabel = isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID';

  const items = parseTransactionItems(transaction);

  // Setup Canvas with standard A4-proportioned dimensions and safe margins
  const canvas = document.createElement('canvas');
  const width = 1240;
  const margin = 48;
  const contentWidth = width - margin * 2;
  const baseHeight = 1380;
  const rowHeight = 44;
  const height = Math.max(baseHeight, 1060 + items.length * rowHeight);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Hazard Top Stripe
  const hazardHeight = 14;
  ctx.fillStyle = '#f5b700'; // Amber Yellow
  ctx.fillRect(0, 0, width, hazardHeight);
  ctx.fillStyle = '#1c1f22';
  for (let x = 0; x < width; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 14, 0);
    ctx.lineTo(x + 7, hazardHeight);
    ctx.closePath();
    ctx.fill();
  }

  // Header Banner Container
  const headerY = 28;
  const headerHeight = 130;

  ctx.fillStyle = '#1c1f22';
  ctx.beginPath();
  ctx.roundRect(margin, headerY, contentWidth, headerHeight, 12);
  ctx.fill();

  // Try drawing Falcon Logo
  try {
    const logoImg = await loadImage(FALCON_LOGO_WHITE_BG_PNG);
    ctx.save();
    ctx.drawImage(logoImg, margin + 20, headerY + 16, 96, 96);
    ctx.restore();
  } catch (_) {
    // Fallback logo graphic
    ctx.fillStyle = '#f5b700';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('FRM', margin + 30, headerY + 75);
  }

  // Invoice Number Badge in Header Top Right
  const badgeWidth = 240;
  const badgeHeight = 92;
  const badgeX = width - margin - badgeWidth - 18;
  const badgeY = headerY + 19;

  ctx.fillStyle = '#2a3036';
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 10);
  ctx.fill();
  ctx.strokeStyle = '#f5b700';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#f5b700';
  ctx.font = 'bold 19px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`INVOICE #${transaction.id}`, badgeX + badgeWidth / 2, badgeY + 35);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '13px monospace';
  ctx.fillText(`DATE: ${transaction.date}`, badgeX + badgeWidth / 2, badgeY + 60);
  if (transaction.time) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText(`TIME: ${transaction.time}`, badgeX + badgeWidth / 2, badgeY + 78);
  }
  ctx.textAlign = 'left';

  // Header Company Info with auto-scaling to prevent badge collision
  const textLeft = margin + 130;
  const maxTitleWidth = badgeX - textLeft - 15;
  const baseTitleFontSize = companyName.length > 24 ? 22 : companyName.length > 18 ? 26 : 30;
  ctx.fillStyle = '#f5b700';
  ctx.font = `bold ${baseTitleFontSize}px "Playfair Display", "Times New Roman", serif`;
  ctx.fillText(companyName.toUpperCase(), textLeft, headerY + 48, maxTitleWidth);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '14px "IBM Plex Sans", sans-serif';
  ctx.fillText(companyTagline, textLeft, headerY + 76, maxTitleWidth);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px monospace';
  ctx.fillText('Authorized Tax Invoice & Fan Accessories Dispatch Memo', textLeft, headerY + 98, maxTitleWidth);

  // Details Info Box (Customer, Status, Reference)
  let y = headerY + headerHeight + 25;
  const infoBoxHeight = 100;

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(margin, y, contentWidth, infoBoxHeight, 8);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Customer column
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('BILLED TO / CUSTOMER FACTORY:', margin + 20, y + 28);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "IBM Plex Sans", sans-serif';
  ctx.fillText(transaction.factory || 'Walk-in Workshop Customer', margin + 20, y + 56, contentWidth - 280);
  ctx.fillStyle = '#64748b';
  ctx.font = '13px "IBM Plex Sans", sans-serif';
  ctx.fillText('Industrial Fan Manufacturer & Distributor · Gujrat Region', margin + 20, y + 80, contentWidth - 280);

  // Status column
  const statusX = width - margin - 220;
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('PAYMENT STATUS:', statusX, y + 28);

  const statusBg = isPaid ? '#10b981' : isPartial ? '#f59e0b' : '#ef4444';
  ctx.fillStyle = statusBg;
  ctx.beginPath();
  ctx.roundRect(statusX, y + 38, 190, 36, 6);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(statusLabel, statusX + 95, y + 62);
  ctx.textAlign = 'left';

  // Table Header
  y += infoBoxHeight + 25;
  const thHeight = 40;
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(margin, y, contentWidth, thHeight, 6);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('#', margin + 16, y + 25);
  ctx.fillText('ITEM DESCRIPTION', margin + 55, y + 25);
  ctx.fillText('SPECIFICATION / COLOR', margin + 460, y + 25);
  
  ctx.textAlign = 'right';
  ctx.fillText('QTY', margin + 780, y + 25);
  ctx.fillText('RATE (PKR)', margin + 940, y + 25);
  ctx.fillText('TOTAL (PKR)', margin + contentWidth - 20, y + 25);
  ctx.textAlign = 'left';

  y += thHeight + 4;

  // Table Rows
  items.forEach((item, idx) => {
    const isAlt = idx % 2 === 1;
    ctx.fillStyle = isAlt ? '#f8fafc' : '#ffffff';
    ctx.fillRect(margin, y, contentWidth, rowHeight);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, y, contentWidth, rowHeight);

    ctx.fillStyle = '#64748b';
    ctx.font = '13px monospace';
    ctx.fillText(String(idx + 1).padStart(2, '0'), margin + 16, y + 27);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px "IBM Plex Sans", sans-serif';
    ctx.fillText(item.name.slice(0, 38), margin + 55, y + 27, 390);

    ctx.fillStyle = '#475569';
    ctx.font = '13px "IBM Plex Sans", sans-serif';
    const spec = [item.size, item.color].filter(Boolean).join(' • ') || 'Standard Fan Rod';
    ctx.fillText(spec.slice(0, 26), margin + 460, y + 27, 260);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(item.qty), margin + 780, y + 27);

    ctx.fillStyle = '#334155';
    ctx.font = '13px monospace';
    ctx.fillText(fmt(item.rate), margin + 940, y + 27);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(fmt(item.total), margin + contentWidth - 20, y + 27);
    ctx.textAlign = 'left';

    y += rowHeight;
  });

  // Summary and Totals Section
  y += 20;
  const summaryBoxWidth = 430;
  const summaryX = width - margin - summaryBoxWidth;

  // Amount in Words (Left)
  const wordsWidth = summaryX - margin - 30;
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(margin, y, wordsWidth, 140, 8);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('AMOUNT IN WORDS (RUPEES):', margin + 18, y + 26);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'italic 13px "IBM Plex Sans", sans-serif';
  ctx.fillText(amountInWordsEnglish(transaction.total), margin + 18, y + 50);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('URDU NOTATION (اردو):', margin + 18, y + 84);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif';
  ctx.fillText(amountInWordsUrdu(transaction.total), margin + 18, y + 112);

  // Financial Breakdown Box (Right)
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(summaryX, y, summaryBoxWidth, 140, 8);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px monospace';
  ctx.fillText('Invoice Grand Total:', summaryX + 20, y + 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(fmt(transaction.total), summaryX + summaryBoxWidth - 20, y + 32);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Amount Paid / Cleared:', summaryX + 20, y + 68);
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(fmt(totalPaid), summaryX + summaryBoxWidth - 20, y + 68);

  // Due divider line
  ctx.strokeStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(summaryX + 20, y + 84);
  ctx.lineTo(summaryX + summaryBoxWidth - 20, y + 84);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = dueAmount > 0 ? '#fca5a5' : '#e2e8f0';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('Net Balance Payable:', summaryX + 20, y + 114);
  ctx.fillStyle = dueAmount > 0 ? '#ef4444' : '#10b981';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(fmt(dueAmount), summaryX + summaryBoxWidth - 20, y + 114);
  ctx.textAlign = 'left';

  // Signatures & Authorization Blocks
  y += 165;
  const sigBoxWidth = (contentWidth - 40) / 2;

  // Box 1: Receiver
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(margin, y, sigBoxWidth, 90, 8);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#64748b';
  ctx.font = '12px monospace';
  ctx.fillText('Customer / Receiver Signature & Stamp:', margin + 15, y + 24);
  ctx.strokeStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(margin + 20, y + 70);
  ctx.lineTo(margin + sigBoxWidth - 20, y + 70);
  ctx.stroke();

  // Box 2: Authorized Signatory
  const authX = margin + sigBoxWidth + 40;
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(authX, y, sigBoxWidth, 90, 8);
  ctx.fill();
  ctx.strokeStyle = '#f5b700';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#b45309';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('Authorized Signature & Falcon Official Seal:', authX + 15, y + 24);

  // If signature or stamp provided
  if (signatureUrl) {
    try {
      const sigImg = await loadImage(signatureUrl);
      ctx.drawImage(sigImg, authX + 40, y + 28, 120, 50);
    } catch (_) {}
  }
  if (stampUrl) {
    try {
      const stampImg = await loadImage(stampUrl);
      ctx.drawImage(stampImg, authX + sigBoxWidth - 110, y + 28, 70, 50);
    } catch (_) {}
  }

  ctx.strokeStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(authX + 20, y + 70);
  ctx.lineTo(authX + sigBoxWidth - 20, y + 70);
  ctx.stroke();

  // Bottom Footer
  y += 115;
  ctx.fillStyle = '#64748b';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    'Falcon Rod Maker · Precision Fan Rod Manufacturing ERP · Gujrat, Pakistan · Computer-Generated Official Memo',
    width / 2,
    y
  );
  ctx.textAlign = 'left';

  // Generate JPG Data URL
  const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
  const cleanCustomer = (transaction.factory || 'WalkIn').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Invoice_${transaction.id}_${cleanCustomer}.jpg`;

  // Record in Gallery Exports Archive FIRST so it is safely preserved and visible in UI
  recordExport({
    title: `Invoice #${transaction.id} — ${transaction.factory || 'Walk-in'}`,
    category: 'invoice',
    format: 'jpg',
    fileName,
    fileSize: estimateDataSize(dataUrl),
    dataUrl,
    description: `Exported Invoice memo with ${items.length} item(s). Status: ${statusLabel}`,
    recordCount: items.length,
    totalAmount: transaction.total,
    customerName: transaction.factory || 'Walk-in'
  });

  // Trigger Download
  try {
    triggerFileDownload(dataUrl, fileName);
  } catch (err) {
    console.warn('Auto download error', err);
  }

  return dataUrl;
}

/**
 * EXPORT ANY TABLE REPORT AS CRISP HIGH-RESOLUTION JPG
 */
export async function exportTableJPG(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  companyName: string = 'Falcon Rod Maker',
  subtitle: string = 'Precision Fan Rod Manufacturing · Gujrat',
  balanceFooterText?: string,
  customConfig?: Partial<ExportDocumentConfig>
): Promise<string> {
  const globalCfg = getSavedExportConfig();
  const cfg: ExportDocumentConfig = {
    ...globalCfg,
    ...customConfig,
    companyName: customConfig?.companyName || companyName || globalCfg.companyName || 'Falcon Rod Maker',
    subtitle: customConfig?.subtitle || subtitle || globalCfg.subtitle || 'Precision Fan Rod Manufacturing · Gujrat',
    customNote: customConfig?.customNote !== undefined ? customConfig.customNote : balanceFooterText
  };

  const isPortrait = cfg.orientation === 'portrait';
  const isThermal80 = cfg.paperSize === '80mm';
  const isThermal58 = cfg.paperSize === '58mm';

  let width = 1450;
  let margin = 40;
  let rowHeight = 38;
  if (isThermal58) {
    width = 560;
    margin = 16;
    rowHeight = 30;
  } else if (isThermal80) {
    width = 740;
    margin = 22;
    rowHeight = 32;
  } else if (isPortrait) {
    width = 1100;
    margin = 36;
    rowHeight = 36;
  }

  const contentWidth = width - margin * 2;
  const tableRows = rows.slice(0, 200); // support up to 200 rows in single high-res image
  const extraFooterHeight = (cfg.customNote || balanceFooterText ? 90 : 50) + (cfg.showSignatureLine ? 90 : 0);
  const height = Math.max(780, 260 + tableRows.length * rowHeight + extraFooterHeight);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Font family mappings
  const sansFont = '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  const serifFont = '"Playfair Display", Georgia, "Times New Roman", serif';
  const monoFont = '"IBM Plex Mono", "Courier New", monospace';
  const chosenFont = cfg.fontFamily === 'times' ? serifFont : cfg.fontFamily === 'courier' ? monoFont : sansFont;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Optional Accent / Hazard Top Stripe
  let headerY = 16;
  if (cfg.showAccentBar) {
    const hazardHeight = isThermal58 ? 8 : 12;
    ctx.fillStyle = cfg.accentColor || '#f5b700';
    ctx.fillRect(0, 0, width, hazardHeight);
    headerY = hazardHeight + 12;
  }

  // Header Banner Container
  const headerHeight = isThermal58 ? 76 : 94;
  ctx.fillStyle = cfg.headerBgColor || '#1c1f22';
  ctx.beginPath();
  ctx.roundRect(margin, headerY, contentWidth, headerHeight, 8);
  ctx.fill();

  let textLeft = margin + 20;

  // Optional Logo
  if (cfg.showLogo) {
    try {
      const logoImg = await loadImage(FALCON_LOGO_WHITE_BG_PNG);
      const logoW = isThermal58 ? 50 : 70;
      const logoH = isThermal58 ? 50 : 70;
      ctx.drawImage(logoImg, margin + 14, headerY + (isThermal58 ? 16 : 12), logoW, logoH);
      textLeft = margin + logoW + 28;
    } catch (_) {}
  }

  // Header Company Name
  ctx.fillStyle = cfg.headerTextColor || '#f5b700';
  ctx.font = `bold ${isThermal58 ? '18px' : '23px'} ${chosenFont}`;
  ctx.fillText((cfg.companyName || 'Falcon Rod Maker').toUpperCase(), textLeft, headerY + (isThermal58 ? 30 : 38));

  // Subtitle
  ctx.fillStyle = cfg.headerSubtitleColor || '#cbd5e1';
  ctx.font = `${isThermal58 ? '10px' : '13px'} ${chosenFont}`;
  const dateStr = cfg.showDate ? ` · ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : '';
  ctx.fillText(`${cfg.subtitle || 'Fan Accessories · Gujrat'}${dateStr}`, textLeft, headerY + (isThermal58 ? 48 : 62));

  // Title / Document Badge
  if (!isThermal58) {
    const badgeW = Math.min(320, Math.max(220, title.length * 10 + 40));
    ctx.fillStyle = cfg.tableHeaderBgColor || '#2d3748';
    ctx.beginPath();
    ctx.roundRect(width - margin - badgeW - 10, headerY + 16, badgeW, 60, 6);
    ctx.fill();
    ctx.strokeStyle = cfg.accentColor || '#f5b700';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = cfg.accentColor || '#f5b700';
    ctx.font = `bold 14px ${monoFont}`;
    ctx.textAlign = 'center';
    ctx.fillText(title.toUpperCase().slice(0, 26), width - margin - (badgeW / 2) - 10, headerY + 42);
    ctx.fillStyle = '#94a3b8';
    ctx.font = `11px ${monoFont}`;
    ctx.fillText(`${rows.length} RECORD(S) · ${cfg.paperSize.toUpperCase()}`, width - margin - (badgeW / 2) - 10, headerY + 62);
    ctx.textAlign = 'left';
  }

  // Table Columns Setup
  let y = headerY + headerHeight + (isThermal58 ? 14 : 20);
  const colWidth = contentWidth / Math.max(1, headers.length);

  // Column Header Row
  ctx.fillStyle = cfg.tableHeaderBgColor || '#2d3748';
  ctx.beginPath();
  ctx.roundRect(margin, y, contentWidth, isThermal58 ? 32 : 38, 4);
  ctx.fill();

  ctx.fillStyle = cfg.tableHeaderTextColor || '#f8fafc';
  ctx.font = `bold ${isThermal58 ? '10px' : '12px'} ${chosenFont}`;
  headers.forEach((h, i) => {
    ctx.fillText(String(h).toUpperCase().slice(0, 22), margin + 12 + i * colWidth, y + (isThermal58 ? 20 : 24));
  });

  y += isThermal58 ? 36 : 42;

  // Data Rows
  tableRows.forEach((row, rowIndex) => {
    const isAlt = cfg.showStripedRows && rowIndex % 2 === 1;
    ctx.fillStyle = isAlt ? '#f8fafc' : '#ffffff';
    ctx.fillRect(margin, y, contentWidth, rowHeight);

    if (cfg.showBorders) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, y, contentWidth, rowHeight);
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = `${isThermal58 ? '10px' : '12px'} ${chosenFont}`;
    row.forEach((cell, i) => {
      const txt = String(cell ?? '').replace(/\n/g, ' ').slice(0, 30);
      ctx.fillText(txt, margin + 12 + i * colWidth, y + (isThermal58 ? 19 : 24));
    });

    y += rowHeight;
  });

  // Footer / Balance / Custom Note Text
  const finalNote = cfg.customNote || balanceFooterText;
  if (finalNote) {
    y += 14;
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.roundRect(margin, y, contentWidth, 44, 6);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = cfg.headerBgColor || '#0f172a';
    ctx.font = `bold ${isThermal58 ? '11px' : '14px'} ${chosenFont}`;
    ctx.fillText(finalNote, margin + 18, y + 27);
    y += 52;
  }

  // Optional Authorized Signature Line
  if (cfg.showSignatureLine) {
    y += 24;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width - margin - 240, y);
    ctx.lineTo(width - margin, y);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = `11px ${chosenFont}`;
    ctx.textAlign = 'right';
    ctx.fillText('Authorized Signature & Official Stamp', width - margin, y + 18);
    ctx.textAlign = 'left';
    y += 30;
  }

  // Bottom Notice
  y += 16;
  ctx.fillStyle = '#94a3b8';
  ctx.font = `11px ${monoFont}`;
  ctx.textAlign = 'center';
  ctx.fillText('Falcon Rod Maker ERP · High-Precision Export Document · Confidential Workshop Record', width / 2, y);
  ctx.textAlign = 'left';

  const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
  const cleanFileName = filename.endsWith('.jpg') ? filename : `${filename}.jpg`;

  // Record in Gallery FIRST so it is safely preserved and visible in UI
  recordExport({
    title: `${title} Report`,
    category: 'report',
    format: 'jpg',
    fileName: cleanFileName,
    fileSize: estimateDataSize(dataUrl),
    dataUrl,
    description: `Exported ${title} report with ${rows.length} record(s) (${cfg.paperSize.toUpperCase()} ${cfg.orientation}).`,
    recordCount: rows.length
  });

  // Trigger Download
  try {
    triggerFileDownload(dataUrl, cleanFileName);
  } catch (err) {
    console.warn('Auto download error', err);
  }

  return dataUrl;
}


/**
 * EXPORT BLUEPRINT SPEC SHEET AS JPG (Precision Fan Down Rod CAD Engineering Sheet)
 */
export async function exportBlueprintJPG(options: {
  diameter: number; // Rod length in inches (12, 18, 24, 30, 36, 48, etc.)
  spokes?: number; // legacy option, ignored
  pipeDiameter?: string;
  gauge: string;
  color: string;
  hasMono?: boolean;
  weightKg: number;
  price: number;
  companyName?: string;
}): Promise<string> {
  const {
    diameter: rodLengthInches,
    pipeDiameter = '3/4" (19.05 mm)',
    gauge,
    color,
    weightKg,
    price,
    companyName = 'Falcon Rod Maker'
  } = options;

  const canvas = document.createElement('canvas');
  const width = 1200;
  const height = 900;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // 1. Engineering Blueprint Dark Navy Canvas
  ctx.fillStyle = '#060f1d';
  ctx.fillRect(0, 0, width, height);

  // 2. CAD Precision Grid
  ctx.strokeStyle = '#0e1f36';
  ctx.lineWidth = 1;
  const gridSmall = 20;
  for (let x = 0; x < width; x += gridSmall) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSmall) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Major CAD grid lines (every 100px)
  ctx.strokeStyle = '#152945';
  ctx.lineWidth = 1.2;
  for (let x = 0; x < width; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Outer Technical Border with Double Border
  const margin = 32;
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 2;
  ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.strokeRect(margin + 5, margin + 5, width - (margin + 5) * 2, height - (margin + 5) * 2);

  // Corner CAD Alignment Marks
  const corners = [
    [margin + 5, margin + 5],
    [width - margin - 5, margin + 5],
    [margin + 5, height - margin - 5],
    [width - margin - 5, height - margin - 5]
  ];
  ctx.strokeStyle = '#f5b700';
  ctx.lineWidth = 1.5;
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 3. Top CAD Header Banner
  ctx.fillStyle = '#0b162c';
  ctx.fillRect(margin + 6, margin + 6, width - (margin + 6) * 2, 84);
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 1;
  ctx.strokeRect(margin + 6, margin + 6, width - (margin + 6) * 2, 84);

  // Logo / Emblem
  try {
    const logoImg = await loadImage(FALCON_LOGO_WHITE_BG_PNG);
    ctx.drawImage(logoImg, margin + 18, margin + 14, 68, 68);
  } catch (_) {}

  // Header Titles
  ctx.fillStyle = '#f5b700';
  ctx.font = 'bold 24px "Playfair Display", serif';
  ctx.fillText(companyName.toUpperCase() + ' · WORKSHOP CAD BLUEPRINT', margin + 115, margin + 38);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(
    `CEILING FAN TUBULAR DOWN ROD · NOMINAL LENGTH: ${rodLengthInches}" (${Math.round(rodLengthInches * 25.4)} mm)`,
    margin + 115,
    margin + 62
  );

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px monospace';
  ctx.fillText(
    `DWG NO: FRM-ROD-${rodLengthInches}-CAD · GAUGE: ${gauge} · COLOR: ${color.toUpperCase()} · SCALE: N.T.S. · REV: 02`,
    margin + 115,
    margin + 80
  );

  // 4. MAIN ELEVATION VIEW: Longitudinal Profile of the Fan Down Rod
  const elevY = 240;
  const rodStartX = 140;
  const rodEndX = width - 140;
  const rodPixelWidth = rodEndX - rodStartX;
  const rodHeight = 60; // outer pipe diameter representation

  // View Title Label
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('VIEW 1: LONGITUDINAL ELEVATION & INTERNAL WIREWAY CONDUIT (SIDE PROFILE)', rodStartX, elevY - 60);

  // Dimension: Overall Length Callout Line (Top)
  const dimY = elevY - 26;
  ctx.strokeStyle = '#f5b700';
  ctx.lineWidth = 1.5;
  // Extension lines
  ctx.beginPath();
  ctx.moveTo(rodStartX, elevY - 4);
  ctx.lineTo(rodStartX, dimY - 10);
  ctx.moveTo(rodEndX, elevY - 4);
  ctx.lineTo(rodEndX, dimY - 10);
  ctx.stroke();

  // Dimension line with arrows
  ctx.beginPath();
  ctx.moveTo(rodStartX, dimY);
  ctx.lineTo(rodEndX, dimY);
  ctx.stroke();

  // Left arrow
  ctx.fillStyle = '#f5b700';
  ctx.beginPath();
  ctx.moveTo(rodStartX, dimY);
  ctx.lineTo(rodStartX + 12, dimY - 4);
  ctx.lineTo(rodStartX + 12, dimY + 4);
  ctx.closePath();
  ctx.fill();

  // Right arrow
  ctx.beginPath();
  ctx.moveTo(rodEndX, dimY);
  ctx.lineTo(rodEndX - 12, dimY - 4);
  ctx.lineTo(rodEndX - 12, dimY + 4);
  ctx.closePath();
  ctx.fill();

  // Dimension Text
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    `TOTAL LENGTH L = ${rodLengthInches}.00" (${Math.round(rodLengthInches * 25.4)} mm) ± 0.5 mm`,
    (rodStartX + rodEndX) / 2,
    dimY - 7
  );
  ctx.textAlign = 'left';

  // Draw Cylindrical Pipe Body
  const rodGrad = ctx.createLinearGradient(0, elevY, 0, elevY + rodHeight);
  if (color.toLowerCase().includes('white')) {
    rodGrad.addColorStop(0, '#94a3b8');
    rodGrad.addColorStop(0.2, '#f8fafc');
    rodGrad.addColorStop(0.5, '#ffffff');
    rodGrad.addColorStop(0.8, '#cbd5e1');
    rodGrad.addColorStop(1, '#64748b');
  } else if (color.toLowerCase().includes('silver') || color.toLowerCase().includes('grey')) {
    rodGrad.addColorStop(0, '#475569');
    rodGrad.addColorStop(0.25, '#94a3b8');
    rodGrad.addColorStop(0.5, '#e2e8f0');
    rodGrad.addColorStop(0.75, '#64748b');
    rodGrad.addColorStop(1, '#334155');
  } else if (color.toLowerCase().includes('gold') || color.toLowerCase().includes('brass')) {
    rodGrad.addColorStop(0, '#78350f');
    rodGrad.addColorStop(0.25, '#d97706');
    rodGrad.addColorStop(0.5, '#fef3c7');
    rodGrad.addColorStop(0.75, '#b45309');
    rodGrad.addColorStop(1, '#451a03');
  } else {
    // Default Matt Black / Dark Industrial
    rodGrad.addColorStop(0, '#0f172a');
    rodGrad.addColorStop(0.25, '#334155');
    rodGrad.addColorStop(0.5, '#475569');
    rodGrad.addColorStop(0.75, '#1e293b');
    rodGrad.addColorStop(1, '#020617');
  }

  // Draw main pipe body
  ctx.fillStyle = rodGrad;
  ctx.fillRect(rodStartX, elevY, rodPixelWidth, rodHeight);

  // Outer Pipe Edges
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(rodStartX, elevY, rodPixelWidth, rodHeight);

  // Left & Right Pipe Rim End Bevels
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(rodStartX, elevY + rodHeight / 2, 7, rodHeight / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(rodEndX, elevY + rodHeight / 2, 7, rodHeight / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Internal Wireway Bore (Dashed lines through the pipe indicating hollow inner channel)
  const wallPx = 8;
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([8, 6]);
  // Top inner bore line
  ctx.beginPath();
  ctx.moveTo(rodStartX + 7, elevY + wallPx);
  ctx.lineTo(rodEndX - 7, elevY + wallPx);
  ctx.stroke();
  // Bottom inner bore line
  ctx.beginPath();
  ctx.moveTo(rodStartX + 7, elevY + rodHeight - wallPx);
  ctx.lineTo(rodEndX - 7, elevY + rodHeight - wallPx);
  ctx.stroke();

  // Centerline Axis (Dashed line through the middle extending beyond ends)
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.setLineDash([16, 4, 3, 4]);
  ctx.beginPath();
  ctx.moveTo(rodStartX - 40, elevY + rodHeight / 2);
  ctx.lineTo(rodEndX + 40, elevY + rodHeight / 2);
  ctx.stroke();
  ctx.setLineDash([]); // Reset dash

  // Left End (Ceiling Canopy Mount): Suspension Bolt Hole (Ø 8.5mm)
  const hole1X = rodStartX + 65;
  const holeCenterY = elevY + rodHeight / 2;
  const holeRadius = 11;

  ctx.fillStyle = '#060f1d';
  ctx.beginPath();
  ctx.arc(hole1X, holeCenterY, holeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f5b700';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Crosshairs in bolt hole
  ctx.strokeStyle = '#f5b700';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hole1X - 16, holeCenterY);
  ctx.lineTo(hole1X + 16, holeCenterY);
  ctx.moveTo(hole1X, holeCenterY - 16);
  ctx.lineTo(hole1X, holeCenterY + 16);
  ctx.stroke();

  // Cotter Pin Secondary Hole (Ø 4mm)
  const hole2X = rodStartX + 125;
  ctx.fillStyle = '#060f1d';
  ctx.beginPath();
  ctx.arc(hole2X, holeCenterY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Right End (Motor Yoke Mount): Yoke Clamp Bolt Hole (Ø 8.5mm)
  const hole3X = rodEndX - 65;
  ctx.fillStyle = '#060f1d';
  ctx.beginPath();
  ctx.arc(hole3X, holeCenterY, holeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f5b700';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Crosshairs in yoke bolt hole
  ctx.strokeStyle = '#f5b700';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hole3X - 16, holeCenterY);
  ctx.lineTo(hole3X + 16, holeCenterY);
  ctx.moveTo(hole3X, holeCenterY - 16);
  ctx.lineTo(hole3X, holeCenterY + 16);
  ctx.stroke();

  // Earthing Terminal Hole (M4)
  const hole4X = rodEndX - 120;
  ctx.fillStyle = '#060f1d';
  ctx.beginPath();
  ctx.arc(hole4X, holeCenterY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Callout Leaders & Notes (Left Side)
  ctx.strokeStyle = '#f5b700';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(hole1X, holeCenterY + holeRadius);
  ctx.lineTo(hole1X - 15, elevY + rodHeight + 35);
  ctx.lineTo(rodStartX - 40, elevY + rodHeight + 35);
  ctx.stroke();

  ctx.fillStyle = '#f5b700';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('CEILING HANGER PIN HOLE', rodStartX - 40, elevY + rodHeight + 28);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '10px monospace';
  ctx.fillText('Ø 8.5 mm (FOR SUSPENSION BOLT)', rodStartX - 40, elevY + rodHeight + 48);

  // Callout Leaders (Right Side)
  ctx.strokeStyle = '#f5b700';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(hole3X, holeCenterY + holeRadius);
  ctx.lineTo(hole3X + 15, elevY + rodHeight + 35);
  ctx.lineTo(rodEndX + 40, elevY + rodHeight + 35);
  ctx.stroke();

  ctx.fillStyle = '#f5b700';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('MOTOR YOKE CLAMP HOLE', rodEndX + 40, elevY + rodHeight + 28);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '10px monospace';
  ctx.fillText('Ø 8.5 mm (DEBURRED SAFETY BORE)', rodEndX + 40, elevY + rodHeight + 48);
  ctx.textAlign = 'left';

  // Callout Center: Internal Wireway
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('INTERNAL HOLLOW WIREWAY CONDUIT (ACCOMMODATES 3-CORE COPPER WIRING)', (rodStartX + rodEndX) / 2, elevY + rodHeight + 28);
  ctx.textAlign = 'left';

  // Pipe Diameter Dimension (Left Side vertical)
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.2;
  const diaDimX = rodStartX - 50;
  ctx.beginPath();
  ctx.moveTo(diaDimX, elevY);
  ctx.lineTo(diaDimX, elevY + rodHeight);
  ctx.moveTo(diaDimX - 5, elevY);
  ctx.lineTo(diaDimX + 5, elevY);
  ctx.moveTo(diaDimX - 5, elevY + rodHeight);
  ctx.lineTo(diaDimX + 5, elevY + rodHeight);
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`Ø ${pipeDiameter}`, diaDimX - 105, elevY + rodHeight / 2 + 4);

  // 5. DETAIL SECTION A-A: CROSS-SECTION PROFILE (Lower Left)
  const secCenterX = 180;
  const secCenterY = 590;
  const secOuterR = 68;
  const secInnerR = 52;

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('SECTION A-A: TUBULAR WALL PROFILE', 65, 475);

  // Outer circle
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(secCenterX, secCenterY, secOuterR, 0, Math.PI * 2);
  ctx.stroke();

  // Inner wireway bore circle
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(secCenterX, secCenterY, secInnerR, 0, Math.PI * 2);
  ctx.stroke();

  // Hatched wall thickness (CAD Section Hatching at 45 degrees)
  ctx.save();
  ctx.beginPath();
  ctx.arc(secCenterX, secCenterY, secOuterR, 0, Math.PI * 2);
  ctx.arc(secCenterX, secCenterY, secInnerR, 0, Math.PI * 2, true);
  ctx.clip();

  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 2;
  for (let d = -secOuterR * 2; d < secOuterR * 2; d += 10) {
    ctx.beginPath();
    ctx.moveTo(secCenterX - secOuterR + d, secCenterY - secOuterR);
    ctx.lineTo(secCenterX + secOuterR + d, secCenterY + secOuterR);
    ctx.stroke();
  }
  ctx.restore();

  // Crosshair centerlines
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.setLineDash([10, 4, 2, 4]);
  ctx.beginPath();
  ctx.moveTo(secCenterX - secOuterR - 20, secCenterY);
  ctx.lineTo(secCenterX + secOuterR + 20, secCenterY);
  ctx.moveTo(secCenterX, secCenterY - secOuterR - 20);
  ctx.lineTo(secCenterX, secCenterY + secOuterR + 20);
  ctx.stroke();
  ctx.setLineDash([]);

  // Section Callouts
  ctx.fillStyle = '#f5b700';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`OUTER DIA: Ø 19.05 mm (3/4")`, 65, 695);
  ctx.fillText(`WALL THICKNESS: ${gauge} (t ≈ 1.5 mm)`, 65, 715);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px monospace';
  ctx.fillText('COLD-ROLLED STEEL TUBING', 65, 735);

  // 6. HARDWARE FITTINGS & ASSEMBLY SPECIFICATION (Center Panel)
  const fitX = 350;
  const fitY = 470;
  const fitW = 320;
  const fitH = 295;

  ctx.fillStyle = '#0b162c';
  ctx.beginPath();
  ctx.roundRect(fitX, fitY, fitW, fitH, 8);
  ctx.fill();
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#f5b700';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('HARDWARE & MOUNTING SPECIFICATIONS', fitX + 16, fitY + 28);

  const fittings = [
    { title: 'SUSPENSION BOLT:', desc: 'M8 x 45 mm High-Tensile Steel with Locknut' },
    { title: 'SAFETY COTTER PIN:', desc: '3.2 mm x 30 mm Stainless Steel Split Pin' },
    { title: 'VIBRATION DAMPER:', desc: 'Heavy-Duty EPDM Synthetic Rubber Bushing' },
    { title: 'EARTH CONNECTION:', desc: 'M4 Brass Grounding Screw & Washer' },
    { title: 'SURFACE COATING:', desc: `${color} Electrostatic Powder Coat (80µm)` },
    { title: 'LOAD CAPACITY:', desc: 'Certified Safe Working Load: 65+ kg' }
  ];

  fittings.forEach((fit, idx) => {
    const itemY = fitY + 60 + idx * 38;
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10.5px monospace';
    ctx.fillText(fit.title, fitX + 16, itemY);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px "IBM Plex Sans", sans-serif';
    ctx.fillText(fit.desc, fitX + 16, itemY + 16);
  });

  // 7. TITLE BLOCK & BILL OF MATERIALS (Lower Right)
  const tblX = 695;
  const tblY = 470;
  const tblW = width - margin - tblX - 10;
  const tblH = 295;

  ctx.fillStyle = '#081224';
  ctx.beginPath();
  ctx.roundRect(tblX, tblY, tblW, tblH, 8);
  ctx.fill();
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Title block header
  ctx.fillStyle = '#1c1f22';
  ctx.beginPath();
  ctx.roundRect(tblX, tblY, tblW, 42, [8, 8, 0, 0]);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#f5b700';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('OFFICIAL BILL OF MATERIALS & SPEC SHEET', tblX + 16, tblY + 26);

  const bom = [
    { key: 'PART NAME', val: `${rodLengthInches}" Precision Tubular Fan Down Rod` },
    { key: 'APPLICATION', val: 'Ceiling Fan Suspension Assembly' },
    { key: 'MATERIAL', val: 'Cold-Rolled Mild Steel (M.S.) Tubing' },
    { key: 'PIPE GAUGE', val: gauge },
    { key: 'COLOR & FINISH', val: `${color} Powder Coating` },
    { key: 'NET UNIT WEIGHT', val: `${weightKg} kg` },
    { key: 'WHOLESALE RATE', val: `Rs ${fmt(price)} / Piece` },
    { key: 'MANUFACTURER', val: 'Falcon Rod Maker (Pvt) Ltd, Gujrat' }
  ];

  bom.forEach((row, idx) => {
    const rowY = tblY + 48 + idx * 30;
    const isAlt = idx % 2 === 1;
    if (isAlt) {
      ctx.fillStyle = '#0f1e36';
      ctx.fillRect(tblX + 2, rowY, tblW - 4, 28);
    }
    ctx.strokeStyle = '#152845';
    ctx.lineWidth = 1;
    ctx.strokeRect(tblX + 2, rowY, tblW - 4, 28);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(row.key, tblX + 14, rowY + 18);

    ctx.fillStyle = idx === 6 ? '#f5b700' : idx === 5 ? '#38bdf8' : '#f8fafc';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(row.val, tblX + 155, rowY + 18);
  });

  // 8. Footer Notes Bar
  const footY = height - margin - 28;
  ctx.fillStyle = '#64748b';
  ctx.font = '11px monospace';
  ctx.fillText(
    'FALCON ROD MAKER · CIRCULAR ROAD INDUSTRIAL ESTATE GUJRAT · ISO 9001 COMPLIANT WORKSHOP DRAWING · CONFIDENTIAL',
    margin + 18,
    footY
  );

  const cleanColor = color.replace(/\s+/g, '-');
  const fileName = `Blueprint_${rodLengthInches}in_FanRod_${cleanColor}.jpg`;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.94);

  // Record in Gallery FIRST so it is safely preserved and visible in UI
  recordExport({
    title: `${rodLengthInches}" Fan Rod CAD Blueprint (${color})`,
    category: 'blueprint',
    format: 'jpg',
    fileName,
    fileSize: estimateDataSize(dataUrl),
    dataUrl,
    description: `Engineering CAD blueprint for ${rodLengthInches}" ceiling fan down rod with ${gauge} tubing, pre-drilled safety bolt holes, and ${color} finish.`
  });

  // Trigger Download
  try {
    triggerFileDownload(dataUrl, fileName);
  } catch (err) {
    console.warn('Auto download error', err);
  }

  return dataUrl;
}
