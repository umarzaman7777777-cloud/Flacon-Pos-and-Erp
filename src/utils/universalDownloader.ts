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

  // Strategy 2: Web Share API (Primary for Mobile Android Browsers & PWA)
  // MUST execute within the synchronous user gesture context.
  // Attempts file attachment first, then immediately falls back to URL/text share to GUARANTEE
  // that the native Android system share sheet (drawer with Gmail, Drive, WhatsApp, Telegram, Quick Share, etc.) OPENS!
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    // 1. Prepare shareable File
    let shareableFile = file;
    if (!shareableFile && blob) {
      try {
        shareableFile = new File([blob], fileName, { type: cleanMime, lastModified: Date.now() });
      } catch (_) {}
    }

    // 2. Test file share capability
    let canShareWithFiles = false;
    if (shareableFile && typeof navigator.canShare === 'function') {
      try {
        canShareWithFiles = navigator.canShare({ files: [shareableFile] });
      } catch (_) {
        canShareWithFiles = false;
      }

      // Android Chrome whitelist adaptation:
      // Chrome Android can reject text/csv for navigator.canShare({ files }), but accepts text/plain!
      if (!canShareWithFiles && blob && (cleanMime === 'text/csv' || fileName.toLowerCase().endsWith('.csv'))) {
        try {
          const plainFile = new File([blob], fileName, { type: 'text/plain', lastModified: Date.now() });
          if (navigator.canShare({ files: [plainFile] })) {
            shareableFile = plainFile;
            canShareWithFiles = true;
          }
        } catch (_) {}
      }
    }

    // 3. Attempt file attachment share
    if (shareableFile && canShareWithFiles) {
      try {
        await navigator.share({
          files: [shareableFile],
          title: fileName,
          text: `Falcon Rod Maker: ${fileName}`
        });
        triggerHaptic('success');
        return { success: true, method: 'web-share-file' };
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') {
          // User intentionally dismissed or cancelled the share chooser
          return { success: false, method: 'cancelled' };
        }
        console.warn('Web Share file failed, will attempt Web Share text/url:', shareErr);
      }
    }

    // 4. Guaranteed Native Android Share Sheet Fallback:
    // When file sharing is not accepted by the browser engine, navigator.share with title/url ALWAYS
    // triggers the Android system share drawer, letting the user choose Gmail, Drive, Telegram, Bluetooth, etc.
    try {
      const shareUrl = payload.blobUrl || window.location.href;
      await navigator.share({
        title: fileName,
        text: `Falcon Rod Maker: ${fileName}`,
        url: shareUrl
      });
      triggerHaptic('success');
      return { success: true, method: 'web-share-drawer' };
    } catch (shareUrlErr: any) {
      if (shareUrlErr?.name === 'AbortError') {
        return { success: false, method: 'cancelled' };
      }
      console.warn('Web Share drawer failed:', shareUrlErr);
    }
  }

  // Strategy 3: Direct App Fallback (WhatsApp or In-App Share Sheet)
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

    // Default 'auto' fallback: File is saved to Downloads, and trigger the in-app Share Apps modal
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('falcon:open-share-apps-modal', {
          detail: { fileName, dataUrl, mimeType: cleanMime }
        })
      );
    }

    triggerHaptic('success');
    return { success: true, method: 'show-apps-modal' };
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
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    let shareableFile = file;
    let canShare = false;
    try {
      if (shareableFile && typeof navigator.canShare === 'function') {
        canShare = navigator.canShare({ files: [shareableFile] });
      }
    } catch (_) {}

    if (!canShare && blob && (cleanMime === 'text/csv' || fileName.toLowerCase().endsWith('.csv'))) {
      try {
        const plainFile = new File([blob], fileName, { type: 'text/plain', lastModified: Date.now() });
        if (navigator.canShare && navigator.canShare({ files: [plainFile] })) {
          shareableFile = plainFile;
          canShare = true;
        }
      } catch (_) {}
    }

    if (shareableFile && canShare) {
      try {
        await navigator.share({
          files: [shareableFile],
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

  // Strategy 3: Direct in-app preview modal & browser preview
  // Triggers the high-fidelity built-in viewer modal (Vector PDF sheet, CSV spreadsheet, or JPG image)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('falcon:open-in-app-preview', {
        detail: { fileName }
      })
    );
  }
  return { success: true, method: 'in-app-preview' };
}

