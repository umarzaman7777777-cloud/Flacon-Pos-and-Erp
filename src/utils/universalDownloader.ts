import { Capacitor } from '@capacitor/core';
import { saveFileNatively, shareFileNatively } from './nativeFileSaver';
import { openExternalUrl } from './openExternalUrl';
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
      if (!finalDataUrl) {
        finalDataUrl = `data:${mime},${encodeURIComponent(content)}`;
      }
    }
  } else if (finalDataUrl) {
    finalBlob = dataUriToBlob(finalDataUrl, mime);
  } else if (rawContent) {
    finalBlob = new Blob([rawContent], { type: mime });
    finalDataUrl = `data:${mime},${encodeURIComponent(rawContent)}`;
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

  // Ensure data URL is populated
  if (!finalDataUrl) {
    try {
      finalDataUrl = await blobToDataUri(finalBlob);
    } catch (_) {
      finalDataUrl = blobUrl;
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
    else mime = 'application/octet-stream';
  }

  let dataUrl = explicitDataUrl;
  if (!dataUrl) {
    if (typeof content === 'string' && content.startsWith('data:')) {
      dataUrl = content;
    } else if (content instanceof Blob) {
      dataUrl = await blobToDataUri(content);
    }
  }

  // 1. Android Capacitor Native Strategy (Direct System Share Intent -> WhatsApp / Drive / Files)
  if (Capacitor.isNativePlatform() && dataUrl) {
    try {
      const ok = await shareFileNatively({
        fileName,
        base64Data: dataUrl,
        mimeType: mime
      });
      if (ok) {
        triggerHaptic('success');
        return { success: true, method: 'capacitor-native' };
      }
    } catch (err) {
      console.warn('Native share failed, attempting web share fallback:', err);
    }
  }

  // 2. Web Share API Strategy (Mobile Chrome / Safari / Samsung Internet)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      let blob: Blob;
      if (content instanceof Blob) {
        blob = content;
      } else if (dataUrl) {
        blob = dataUriToBlob(dataUrl, mime);
      } else {
        blob = new Blob([payload.rawContent || ''], { type: mime });
      }

      const file = new File([blob], fileName, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title || fileName,
          text: `Falcon Rod Maker — ${title || fileName}`
        });
        triggerHaptic('success');
        return { success: true, method: 'web-share-file' };
      }
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        return { success: false, method: 'cancelled' };
      }
      console.warn('Web Share file failed:', shareErr);
    }
  }

  // 3. Fallback: External System Share via Browser / WhatsApp
  try {
    const textMsg = encodeURIComponent(
      `*Falcon Rod Maker — Export Archive*\n📄 *File:* ${fileName}\n${
        payload.title ? `📝 ${payload.title}\n` : ''
      }Generated from Falcon POS & ERP Terminal`
    );
    const waUrl = `https://api.whatsapp.com/send?text=${textMsg}`;
    await openExternalUrl(waUrl);
    triggerHaptic('click');
    return { success: true, method: 'whatsapp-direct' };
  } catch (_) {
    return { success: false, method: 'failed' };
  }
}
