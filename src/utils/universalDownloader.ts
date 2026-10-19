import { Capacitor } from '@capacitor/core';
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

// Global active blob URLs to prevent premature garbage collection
const activeBlobUrls: Set<string> = new Set();

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

  let finalBlob: Blob;
  let finalDataUrl = payload.dataUrl || '';

  if (content instanceof Blob) {
    finalBlob = content;
  } else if (typeof content === 'string') {
    if (content.startsWith('data:')) {
      finalBlob = dataUriToBlob(content, mime);
      finalDataUrl = content;
    } else {
      finalBlob = new Blob([content], { type: mime });
    }
  } else if (finalDataUrl) {
    finalBlob = dataUriToBlob(finalDataUrl, mime);
  } else if (rawContent) {
    finalBlob = new Blob([rawContent], { type: mime });
  } else {
    finalBlob = new Blob([''], { type: mime });
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

  // 1. Mobile Native Strategy: Save directly to Android Downloads folder
  let savedNatively = false;
  if (Capacitor.isNativePlatform() && finalDataUrl) {
    try {
      savedNatively = await saveFileNatively({
        fileName,
        base64Data: finalDataUrl,
        mimeType: mime
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
      mimeType: mime,
      savedLocally: savedNatively,
      rawContent: rawContent || (typeof content === 'string' && !content.startsWith('data:') ? content : undefined),
      tableData: payload.tableData,
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
 * Automatically delegates to Capacitor native share intent (WhatsApp, Drive, Gmail)
 * or browser Web Share API with files support, falling back to direct WhatsApp link.
 */
export async function shareExportFile(payload: UniversalDownloadPayload): Promise<{
  success: boolean;
  method: string;
}> {
  const { fileName, content, dataUrl: explicitDataUrl, title = 'Falcon Rod Maker Export' } = payload;

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

  // 1. Clean MIME type (remove parameters like charset) and ensure correct file extension
  let cleanMime = (mime || '').split(';')[0].trim().toLowerCase();
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.pdf')) cleanMime = 'application/pdf';
  else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) cleanMime = 'image/jpeg';
  else if (lowerName.endsWith('.png')) cleanMime = 'image/png';
  else if (lowerName.endsWith('.csv')) cleanMime = 'text/csv';
  else if (lowerName.endsWith('.json')) cleanMime = 'application/json';
  else if (!cleanMime) cleanMime = 'application/octet-stream';

  let dataUrl = explicitDataUrl;

  // 2. Resolve Binary Blob from content, dataUrl, blobUrl, or rawContent
  let blob: Blob;
  if (content instanceof Blob) {
    blob = content;
  } else if (dataUrl) {
    blob = dataUriToBlob(dataUrl, cleanMime);
  } else if (payload.blobUrl) {
    try {
      const resp = await fetch(payload.blobUrl);
      blob = await resp.blob();
    } catch (_) {
      blob = new Blob([payload.rawContent || ''], { type: cleanMime });
    }
  } else if (payload.rawContent) {
    blob = new Blob([payload.rawContent], { type: cleanMime });
  } else if (typeof content === 'string') {
    if (content.startsWith('data:')) {
      blob = dataUriToBlob(content, cleanMime);
      if (!dataUrl) dataUrl = content;
    } else {
      blob = new Blob([content], { type: cleanMime });
    }
  } else {
    blob = new Blob([''], { type: cleanMime });
  }

  // Ensure dataUrl is converted to valid base64 data URI (required for Capacitor Android native intent)
  if (!dataUrl || !dataUrl.includes(';base64,')) {
    try {
      dataUrl = await blobToDataUri(blob);
    } catch (_) {}
  }

  // 3. Construct standard HTML5 File object for real attachment sharing
  let file: File | null = null;
  try {
    file = new File([blob], fileName, {
      type: cleanMime,
      lastModified: Date.now()
    });
  } catch (fileErr) {
    console.warn('Could not construct File object for native sharing:', fileErr);
  }

  // -----------------------------------------------------------------------------------------
  // Strategy 1: Capacitor Native Sharing (Android / iOS app wrapper)
  // Sends the real file bytes directly into Android ACTION_SEND intent with EXTRA_STREAM
  // -----------------------------------------------------------------------------------------
  if (Capacitor.isNativePlatform() && dataUrl) {
    try {
      const ok = await shareFileNatively({
        fileName,
        base64Data: dataUrl,
        mimeType: cleanMime
      });
      if (ok) {
        triggerHaptic('success');
        return { success: true, method: 'capacitor-native-file' };
      }
    } catch (err) {
      console.warn('Native Capacitor file share error, proceeding to Web Share:', err);
    }
  }

  // -----------------------------------------------------------------------------------------
  // Strategy 2: Web Share API Level 2 (files support)
  // Supported in Chrome on Android, Safari on iOS/macOS, Samsung Internet, Edge
  // This opens the OS native share dialog (WhatsApp, Gmail, Telegram, Drive, Bluetooth, etc.)
  // and hands over the ACTUAL ATTACHED FILE (not plain text)!
  // -----------------------------------------------------------------------------------------
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
        // CRITICAL FIX: Share ONLY { files: [file] } without 'title' or 'text'.
        // When 'title' or 'text' is included alongside 'files', native Android apps (especially WhatsApp)
        // prioritize the text string and DROP the file attachment, sending only text words!
        // Sending ONLY 'files: [file]' guarantees that WhatsApp, Gmail, and native apps attach the ACTUAL file!
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
        console.warn('Web Share file failed, falling back to guaranteed download:', shareErr);
      }
    }
  }

  // -----------------------------------------------------------------------------------------
  // Strategy 3: Guaranteed Real File Delivery Fallback
  // If the browser/environment does not support sharing files via Web Share:
  // NEVER send text words or details! Instead:
  // 1. Download the ACTUAL file to device storage so the user has the PDF/JPEG/CSV.
  // 2. Dispatch a notification that the real file is ready and saved.
  // -----------------------------------------------------------------------------------------
  try {
    // 1. Deliver the file to user's device
    await triggerUniversalDownload({
      fileName,
      content: blob,
      dataUrl,
      mimeType: cleanMime,
      format: payload.format,
      title
    });

    // 2. Inform user clearly that the real file is downloaded
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('falcon:toast', {
          detail: {
            type: 'success',
            title: 'File Downloaded to Device',
            message: `"${fileName}" has been saved. You can now attach this file directly in WhatsApp, Gmail, or your apps.`
          }
        })
      );
    }

    triggerHaptic('success');
    return { success: true, method: 'download-and-attach-guidance' };
  } catch (fallbackErr) {
    console.error('Fallback export delivery failed:', fallbackErr);
    return { success: false, method: 'failed' };
  }
}

/**
 * Universal Native File Opener
 * Opens exported PDF, CSV, JPG, or JSON directly into the device's default native viewer application
 * (e.g. Adobe Acrobat / Drive PDF Viewer for PDF, Google Sheets / Excel for CSV, Gallery for JPG)
 * via Android Intent.ACTION_VIEW or browser window without glitches.
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

  let cleanMime = (mime || '').split(';')[0].trim().toLowerCase();
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.pdf')) cleanMime = 'application/pdf';
  else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) cleanMime = 'image/jpeg';
  else if (lowerName.endsWith('.png')) cleanMime = 'image/png';
  else if (lowerName.endsWith('.csv')) cleanMime = 'text/csv';
  else if (lowerName.endsWith('.json')) cleanMime = 'application/json';
  else if (!cleanMime) cleanMime = 'application/octet-stream';

  let dataUrl = explicitDataUrl;

  // Resolve Binary Blob from content, dataUrl, blobUrl, or rawContent
  let blob: Blob;
  if (content instanceof Blob) {
    blob = content;
  } else if (dataUrl) {
    blob = dataUriToBlob(dataUrl, cleanMime);
  } else if (payload.blobUrl) {
    try {
      const resp = await fetch(payload.blobUrl);
      blob = await resp.blob();
    } catch (_) {
      blob = new Blob([payload.rawContent || ''], { type: cleanMime });
    }
  } else if (payload.rawContent) {
    blob = new Blob([payload.rawContent], { type: cleanMime });
  } else if (typeof content === 'string') {
    if (content.startsWith('data:')) {
      blob = dataUriToBlob(content, cleanMime);
      if (!dataUrl) dataUrl = content;
    } else {
      blob = new Blob([content], { type: cleanMime });
    }
  } else {
    blob = new Blob([''], { type: cleanMime });
  }

  // Ensure valid base64 data URI for Capacitor native intent
  if (!dataUrl || !dataUrl.includes(';base64,')) {
    try {
      dataUrl = await blobToDataUri(blob);
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

  // Strategy 2: Web Browser opening
  try {
    const objectUrl = URL.createObjectURL(blob);
    activeBlobUrls.add(objectUrl);
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      activeBlobUrls.delete(objectUrl);
    }, 180000);

    const newWin = window.open(objectUrl, '_blank', 'noopener,noreferrer');
    if (!newWin) {
      // Popup blocked or mobile browser: trigger direct download fallback
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
      }, 1500);
    }
    triggerHaptic('click');
    return { success: true, method: 'browser-tab' };
  } catch (err) {
    console.warn('Browser open failed:', err);
    return { success: false, method: 'failed' };
  }
}

