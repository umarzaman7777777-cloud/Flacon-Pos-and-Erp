import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { saveFileNatively, shareFileNatively, openFileNatively } from './nativeFileSaver';
import { triggerHaptic } from './haptics';

/**
 * Universal Export & File Downloader Engine
 * Bypasses iframe sandbox download restrictions, mobile WebView blocks,
 * and data URL size limitations.
 */

export interface UniversalDownloadPayload {
  fileName: string;
  content?: Blob | string; // Blob, Data URL, or raw text
  dataUrl?: string;
  blobUrl?: string;
  mimeType?: string;
  format?: 'pdf' | 'jpg' | 'png' | 'csv' | 'json' | 'sql' | string;
  rawContent?: string;
  title?: string;
  targetApp?: 'whatsapp' | 'auto';
  tableData?: {
    title?: string;
    headers?: string[];
    rows?: (string | number)[][];
    footer?: string;
    orientation?: string;
    companyName?: string;
    subtitle?: string;
    customNote?: string;
    paperSize?: string;
  };
}

// Global active blob URLs and synchronous export caches
const activeBlobUrls: Set<string> = new Set();
export const exportBlobCache: Map<string, Blob> = new Map();
export const exportFileCache: Map<string, File> = new Map();
export const exportDataUrlCache: Map<string, string> = new Map();

/**
 * Converts a base64 or Data URI string to a Blob
 */
export function dataUriToBlob(dataUri: string, defaultMime = 'application/octet-stream'): Blob {
  try {
    if (!dataUri.startsWith('data:')) {
      return new Blob([dataUri], { type: defaultMime });
    }
    const [header, base64Data] = dataUri.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : defaultMime;

    if (header.includes(';base64')) {
      const byteChars = atob(base64Data);
      const byteNumbers = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      return new Blob([byteNumbers], { type: mime });
    } else {
      const decoded = decodeURIComponent(base64Data);
      return new Blob([decoded], { type: mime });
    }
  } catch (err) {
    console.warn('Failed to convert data URI to blob:', err);
    return new Blob([dataUri], { type: defaultMime });
  }
}

/**
 * Converts a Blob to a Data URI
 */
export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Main Universal Downloader function.
 * Triggers standard browser download, dispatches global in-app event for guaranteed
 * 1-click fallback in sandboxed iframes/WebViews, and supports mobile native sharing.
 */
export async function triggerUniversalDownload(payload: UniversalDownloadPayload): Promise<{
  success: boolean;
  blobUrl: string;
  dataUrl: string;
}> {
  const { fileName, content, mimeType: explicitMime, format = 'file', rawContent } = payload;

  let mime = explicitMime;
  if (!mime) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) mime = 'application/pdf';
    else if (lower.endsWith('.csv')) mime = 'text/csv;charset=utf-8';
    else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
    else if (lower.endsWith('.png')) mime = 'image/png';
    else if (lower.endsWith('.json')) mime = 'application/json';
    else if (lower.endsWith('.sql')) mime = 'application/sql';
    else mime = 'application/octet-stream';
  }

  const cleanMime = (mime || '').split(';')[0].trim().toLowerCase() || 'application/octet-stream';

  let finalBlob: Blob;
  let finalDataUrl = payload.dataUrl || '';

  if (content instanceof Blob) {
    finalBlob = content;
  } else if (typeof content === 'string') {
    if (content.startsWith('data:')) {
      finalBlob = dataUriToBlob(content, cleanMime);
      finalDataUrl = content;
    } else {
      finalBlob = new Blob([content], { type: cleanMime });
    }
  } else if (finalDataUrl) {
    finalBlob = dataUriToBlob(finalDataUrl, cleanMime);
  } else if (rawContent) {
    finalBlob = new Blob([rawContent], { type: cleanMime });
  } else {
    finalBlob = new Blob([''], { type: cleanMime });
  }

  // Create persistent blob URL (keep alive for 5 minutes)
  const blobUrl = URL.createObjectURL(finalBlob);
  activeBlobUrls.add(blobUrl);
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
    activeBlobUrls.delete(blobUrl);
  }, 300000); // 5 minutes

  // Ensure data URL is populated with valid Base64 URI (essential for Native Android MediaStore and File Sharing)
  if (!finalDataUrl || !finalDataUrl.includes(';base64,')) {
    try {
      finalDataUrl = await blobToDataUri(finalBlob);
    } catch (_) {
      if (!finalDataUrl) finalDataUrl = blobUrl;
    }
  }

  // Synchronously populate global in-memory caches for zero-latency gesture sharing
  exportBlobCache.set(fileName, finalBlob);
  exportDataUrlCache.set(fileName, finalDataUrl);
  let fileObj: File | null = null;
  try {
    fileObj = new File([finalBlob], fileName, { type: cleanMime, lastModified: Date.now() });
    exportFileCache.set(fileName, fileObj);
  } catch (_) {}

  // 1. Mobile Native Strategy: Save directly to Android Downloads folder
  let savedNatively = false;
  if (Capacitor.isNativePlatform() && finalDataUrl) {
    try {
      savedNatively = await saveFileNatively({
        fileName,
        base64Data: finalDataUrl,
        mimeType: cleanMime
      });
      if (savedNatively) {
        triggerHaptic('success');
      }
    } catch (err) {
      console.warn('Native download attempt error:', err);
    }
  }

  // 2. Browser Strategy: Standard Direct Anchor Click
  let anchorSuccess = false;
  try {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    anchorSuccess = true;

    setTimeout(() => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    }, 2000);
  } catch (err) {
    console.warn('Direct link download warning:', err);
  }

  // Fallback for mobile browsers where blob anchor may be restricted
  if (!anchorSuccess && finalDataUrl && typeof window !== 'undefined') {
    try {
      const dataLink = document.createElement('a');
      dataLink.href = finalDataUrl;
      dataLink.download = fileName;
      dataLink.style.display = 'none';
      document.body.appendChild(dataLink);
      dataLink.click();
      setTimeout(() => {
        if (dataLink.parentNode) dataLink.parentNode.removeChild(dataLink);
      }, 2000);
    } catch (_) {}
  }

  // 3. Dispatch Global Custom Event for Guaranteed In-App Download Card / Toast
  if (typeof window !== 'undefined') {
    const eventDetail = {
      fileName,
      format,
      blobUrl,
      dataUrl: finalDataUrl,
      mimeType: cleanMime,
      savedLocally: savedNatively,
      rawContent: rawContent || (typeof content === 'string' && !content.startsWith('data:') ? content : undefined),
      tableData: payload.tableData,
      blob: finalBlob,
      file: fileObj,
      timestamp: Date.now()
    };

    window.dispatchEvent(
      new CustomEvent('falcon:export-ready', {
        detail: eventDetail
      })
    );
  }

  return {
    success: true,
    blobUrl,
    dataUrl: finalDataUrl
  };
}

/**
 * Universal Share Engine for Invoices, Blueprints, Reports & Ledgers
 * Directly launches native WhatsApp or Android system share drawer with real file attached.
 */
export async function shareExportFile(payload: UniversalDownloadPayload): Promise<{
  success: boolean;
  method: string;
}> {
  const { fileName, content, dataUrl: explicitDataUrl, targetApp = 'auto' } = payload;

  let mime = payload.mimeType;
  if (!mime) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) mime = 'application/pdf';
    else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
    else if (lower.endsWith('.png')) mime = 'image/png';
    else if (lower.endsWith('.csv')) mime = 'text/csv';
    else if (lower.endsWith('.json')) mime = 'application/json';
    else mime = 'application/octet-stream';
  }

  const cleanMime = (mime || '').split(';')[0].trim().toLowerCase() || 'application/octet-stream';

  // Synchronous resolution of File, Blob, and DataUrl from in-memory cache to preserve mobile user gesture
  let file: File | null = exportFileCache.get(fileName) || null;
  let blob: Blob | null = exportBlobCache.get(fileName) || (content instanceof Blob ? content : null);
  let dataUrl = explicitDataUrl || exportDataUrlCache.get(fileName) || (typeof content === 'string' && content.startsWith('data:') ? content : '');

  if (!blob && dataUrl) {
    blob = dataUriToBlob(dataUrl, cleanMime);
  }

  if (!file && blob) {
    try {
      file = new File([blob], fileName, { type: cleanMime, lastModified: Date.now() });
      exportFileCache.set(fileName, file);
    } catch (_) {}
  }

  // Strategy 1: Capacitor Native Sharing (@capacitor/share & NativeFileSaver)
  // Triggers native Android ACTION_SEND intent with real file bytes (PDF, JPG, CSV)
  if (Capacitor.isNativePlatform() && dataUrl) {
    try {
      // 1. Direct targeted native file share via Android ACTION_SEND intent
      const ok = await shareFileNatively({
        fileName,
        base64Data: dataUrl,
        mimeType: cleanMime,
        targetApp
      });
      if (ok) {
        triggerHaptic('success');
        return { success: true, method: 'capacitor-native-file' };
      }
    } catch (err) {
      console.warn('Native Capacitor file share error, trying @capacitor/share:', err);
    }

    try {
      const canShareRes = await Share.canShare();
      if (canShareRes.value) {
        await Share.share({
          title: fileName,
          dialogTitle: `Share ${fileName}`
        });
        triggerHaptic('success');
        return { success: true, method: 'capacitor-share-plugin' };
      }
    } catch (sharePluginErr) {
      console.warn('@capacitor/share plugin error:', sharePluginErr);
    }
  }

  // Strategy 2: Web Share API Level 2 (files support)
  // MUST execute immediately without awaiting microtasks to satisfy Android Chrome gesture requirements
  // Opens Android system share sheet with ALL installed apps (WhatsApp, Gmail, Drive, Quick Share, etc.)
  if (file && typeof navigator !== 'undefined' && navigator.share) {
    let canShareFiles = false;
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        canShareFiles = true;
      }
    } catch (canErr) {
      console.warn('navigator.canShare check failed:', canErr);
    }

    if (canShareFiles) {
      try {
        await navigator.share({
          files: [file]
        });
        triggerHaptic('success');
        return { success: true, method: 'web-share-file' };
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') {
          // User intentionally closed or cancelled the share chooser
          return { success: false, method: 'cancelled' };
        }
        console.warn('Web Share file failed, falling back to direct delivery:', shareErr);
      }
    }
  }

  // Strategy 3: Guaranteed Direct Delivery Fallback
  // If Web Share is blocked (e.g. inside an iframe or browser without Level 2 files),
  // directly trigger file download and open WhatsApp (if requested) or inform user for any app.
  try {
    // 1. Download file so it exists in user's Downloads
    const downloadBlob = blob || (dataUrl ? dataUriToBlob(dataUrl, cleanMime) : null);
    if (downloadBlob || dataUrl) {
      const link = document.createElement('a');
      link.href = downloadBlob ? URL.createObjectURL(downloadBlob) : dataUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => link.remove(), 1000);
    }

    if (targetApp === 'whatsapp') {
      const waText = encodeURIComponent(`Falcon Rod Maker: ${fileName}`);
      const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

      if (isAndroid) {
        window.location.href = `whatsapp://send?text=${waText}`;
      } else {
        window.open(`https://api.whatsapp.com/send?text=${waText}`, '_blank');
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('falcon:toast', {
            detail: {
              type: 'info',
              title: 'Opening WhatsApp...',
              message: `"${fileName}" saved to Downloads. In WhatsApp, tap 📎 to attach your downloaded file.`
            }
          })
        );
      }

      triggerHaptic('success');
      return { success: true, method: 'whatsapp-opened' };
    }

    // Default 'auto' fallback: File is saved to Downloads, ready to be used in any app
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('falcon:toast', {
          detail: {
            type: 'success',
            title: 'File Downloaded to Device',
            message: `"${fileName}" is saved to your Downloads folder. You can attach it in any app (Gmail, WhatsApp, Drive, Bluetooth).`
          }
        })
      );
    }

    triggerHaptic('success');
    return { success: true, method: 'saved-for-all-apps' };
  } catch (fallbackErr) {
    console.error('Fallback export delivery failed:', fallbackErr);
    return { success: false, method: 'failed' };
  }
}

/**
 * Universal Native File Opener
 * Opens exported PDF, CSV, JPG directly into the device's native app or high-resolution preview.
 */
export async function openExportFile(payload: UniversalDownloadPayload): Promise<{
  success: boolean;
  method: string;
}> {
  const { fileName, content, dataUrl: explicitDataUrl } = payload;

  let mime = payload.mimeType;
  if (!mime) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) mime = 'application/pdf';
    else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
    else if (lower.endsWith('.png')) mime = 'image/png';
    else if (lower.endsWith('.csv')) mime = 'text/csv';
    else if (lower.endsWith('.json')) mime = 'application/json';
    else mime = 'application/octet-stream';
  }

  const cleanMime = (mime || '').split(';')[0].trim().toLowerCase() || 'application/octet-stream';

  // Synchronous resolution of File, Blob, and DataUrl from in-memory cache
  let file: File | null = exportFileCache.get(fileName) || null;
  let blob: Blob | null = exportBlobCache.get(fileName) || (content instanceof Blob ? content : null);
  let dataUrl = explicitDataUrl || exportDataUrlCache.get(fileName) || (typeof content === 'string' && content.startsWith('data:') ? content : '');

  if (!blob && dataUrl) {
    blob = dataUriToBlob(dataUrl, cleanMime);
  }

  if (!file && blob) {
    try {
      file = new File([blob], fileName, { type: cleanMime, lastModified: Date.now() });
      exportFileCache.set(fileName, file);
    } catch (_) {}
  }

  // Strategy 1: Capacitor Native Action View (Android native viewer apps)
  if (Capacitor.isNativePlatform() && dataUrl) {
    try {
      const ok = await openFileNatively({
        fileName,
        base64Data: dataUrl,
        mimeType: cleanMime
      });
      if (ok) {
        triggerHaptic('success');
        return { success: true, method: 'capacitor-native-view' };
      }
    } catch (err) {
      console.warn('Native Capacitor file open error:', err);
    }
  }

  // Strategy 2: Web Share API to open with external app (Photos, Adobe Acrobat, Sheets, Drive)
  // On mobile Android, navigator.share with files allows user to choose ANY viewer app on their phone
  if (file && typeof navigator !== 'undefined' && navigator.share) {
    let canShare = false;
    try {
      canShare = Boolean(navigator.canShare && navigator.canShare({ files: [file] }));
    } catch (_) {}

    if (canShare) {
      try {
        await navigator.share({
          files: [file],
          title: fileName
        });
        triggerHaptic('success');
        return { success: true, method: 'system-app-picker' };
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') {
          return { success: false, method: 'cancelled' };
        }
      }
    }
  }

  // Strategy 3: Direct browser preview / window opening
  try {
    const objectUrl = blob ? URL.createObjectURL(blob) : payload.blobUrl || dataUrl;

    if (cleanMime.startsWith('image/')) {
      const newWin = window.open('', '_blank');
      if (newWin) {
        newWin.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${fileName}</title>
              <style>body{margin:0;background:#060a12;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px;box-sizing:border-box;}img{max-width:100%;height:auto;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,0.8);}</style>
            </head>
            <body>
              <img src="${dataUrl || objectUrl}" alt="${fileName}">
            </body>
          </html>
        `);
        newWin.document.close();
        triggerHaptic('click');
        return { success: true, method: 'new-tab-image' };
      }
    } else if (cleanMime === 'application/pdf') {
      const newWin = window.open(objectUrl, '_blank');
      if (newWin) {
        triggerHaptic('click');
        return { success: true, method: 'new-tab-pdf' };
      }
    }

    // If popup is blocked by browser, trigger in-app preview modal
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('falcon:open-in-app-preview', {
          detail: { fileName }
        })
      );
    }
    return { success: true, method: 'in-app-preview' };
  } catch (err) {
    console.warn('Browser open failed:', err);
    return { success: false, method: 'failed' };
  }
}

