import React, { useState, useEffect } from 'react';
import {
  Download,
  ExternalLink,
  Copy,
  Check,
  X,
  FileText,
  Image as ImageIcon,
  Table,
  Share2,
  FileSpreadsheet,
  Eye
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { saveFileNatively, shareFileNatively } from '../utils/nativeFileSaver';
import { shareExportFile } from '../utils/universalDownloader';
import { triggerHaptic } from '../utils/haptics';

export interface ExportReadyEventDetail {
  fileName: string;
  format: string;
  blobUrl: string;
  dataUrl?: string;
  mimeType?: string;
  rawContent?: string;
  savedLocally?: boolean;
  timestamp: number;
}

export const ExportDownloadToast: React.FC = () => {
  const [activeExport, setActiveExport] = useState<ExportReadyEventDetail | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isInAppPreviewOpen, setIsInAppPreviewOpen] = useState(false);

  useEffect(() => {
    const handleExportReady = (e: Event) => {
      const customEvt = e as CustomEvent<ExportReadyEventDetail>;
      if (customEvt.detail && customEvt.detail.fileName) {
        setActiveExport(customEvt.detail);
        setCopied(false);
        setShared(false);
        setSavedSuccess(Boolean(customEvt.detail.savedLocally));
      }
    };

    window.addEventListener('falcon:export-ready', handleExportReady);
    return () => {
      window.removeEventListener('falcon:export-ready', handleExportReady);
    };
  }, []);

  if (!activeExport) return null;

  const isPdf = activeExport.fileName.toLowerCase().endsWith('.pdf') || activeExport.format === 'pdf';
  const isJpg =
    activeExport.fileName.toLowerCase().endsWith('.jpg') ||
    activeExport.fileName.toLowerCase().endsWith('.jpeg') ||
    activeExport.format === 'jpg';
  const isCsv = activeExport.fileName.toLowerCase().endsWith('.csv') || activeExport.format === 'csv';

  const downloadUrl = activeExport.dataUrl || activeExport.blobUrl || '#';

  const handleSaveFile = async () => {
    if (Capacitor.isNativePlatform() && activeExport.dataUrl) {
      try {
        const ok = await saveFileNatively({
          fileName: activeExport.fileName,
          base64Data: activeExport.dataUrl,
          mimeType: activeExport.mimeType || 'application/octet-stream'
        });
        if (ok) {
          triggerHaptic('success');
          setSavedSuccess(true);
          setTimeout(() => setActiveExport(null), 3500);
          return;
        }
      } catch (err) {
        console.warn('Native save failed, fallback to anchor:', err);
      }
    }

    // Browser direct download fallback
    try {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = activeExport.fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
      }, 1500);
      setSavedSuccess(true);
      setTimeout(() => setActiveExport(null), 3500);
    } catch (_) {}
  };

  const handleCopyContent = async () => {
    try {
      if (activeExport.rawContent) {
        await navigator.clipboard.writeText(activeExport.rawContent);
      } else if (activeExport.dataUrl) {
        await navigator.clipboard.writeText(activeExport.dataUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  const handleShare = async () => {
    try {
      const res = await shareExportFile({
        fileName: activeExport.fileName,
        dataUrl: activeExport.dataUrl,
        blobUrl: activeExport.blobUrl,
        mimeType: activeExport.mimeType,
        format: activeExport.format,
        title: activeExport.fileName,
        targetApp: 'whatsapp'
      });
      if (res.success) {
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      }
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  return (
    <>
      <aside
        role="status"
        aria-live="polite"
        aria-label="Export download prompt"
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] w-[95vw] max-w-lg bg-slate-950/95 text-white border border-amber-500/50 rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-200"
      >
        <div className="flex items-start justify-between gap-3">
          <div
            onClick={() => (activeExport.dataUrl || isJpg) && setIsInAppPreviewOpen(true)}
            className="flex items-center gap-3 min-w-0 cursor-pointer group"
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border overflow-hidden ${
                isPdf
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : isCsv
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-[#0b101b] text-amber-400 border-amber-500/30 p-1'
              }`}
            >
              {isJpg && activeExport.dataUrl ? (
                <img
                  src={activeExport.dataUrl}
                  alt={activeExport.fileName}
                  className="w-full h-full object-contain rounded"
                />
              ) : isPdf ? (
                <FileText size={22} />
              ) : isCsv ? (
                <FileSpreadsheet size={22} />
              ) : (
                <ImageIcon size={22} />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase border ${
                    savedSuccess
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {savedSuccess ? '✓ Saved' : `${activeExport.format.toUpperCase()} Ready`}
                </span>
                <span className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-[240px]">
                  {activeExport.fileName}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                {savedSuccess
                  ? 'Saved to Downloads. Tap Share to send on WhatsApp.'
                  : 'Tap below to Share (WhatsApp) or Download:'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveExport(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Action Buttons Row */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 flex-wrap">
          {/* Share Button (WhatsApp / System) */}
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase shadow transition active:scale-95 cursor-pointer"
            title="Share via WhatsApp, Drive, Bluetooth or Email"
          >
            {shared ? <Check size={14} className="text-black" /> : <Share2 size={14} />}
            <span>{shared ? 'Opening Share...' : 'Share (WhatsApp)'}</span>
          </button>

          {/* Download to Device */}
          <button
            type="button"
            onClick={handleSaveFile}
            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            {savedSuccess ? <Check size={14} className="text-black" /> : <Download size={14} />}
            <span>{savedSuccess ? 'Saved' : 'Save'}</span>
          </button>

          {/* In-App Preview Modal Trigger */}
          {(activeExport.dataUrl || isJpg) && (
            <button
              type="button"
              onClick={() => setIsInAppPreviewOpen(true)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Inspect full image in modal"
            >
              <Eye size={13} />
              <span>Inspect</span>
            </button>
          )}

          {/* Copy for CSV or Data */}
          {(isCsv || activeExport.rawContent) && (
            <button
              type="button"
              onClick={handleCopyContent}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Copy spreadsheet text to clipboard"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          )}
        </div>
      </aside>

      {/* In-App Full-Screen Inspector Lightbox Modal */}
      {isInAppPreviewOpen && activeExport.dataUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-amber-500 text-black">
                  {activeExport.format.toUpperCase()}
                </span>
                <span className="text-sm font-bold text-white truncate">
                  {activeExport.fileName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsInAppPreviewOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-500 hover:text-white text-slate-400 flex items-center justify-center transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[72vh] flex items-center justify-center bg-[#070b12]">
              <img
                src={activeExport.dataUrl}
                alt={activeExport.fileName}
                className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-2xl border border-white/10"
              />
            </div>

            <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsInAppPreviewOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase shadow transition active:scale-95 cursor-pointer"
                >
                  <Share2 size={13} />
                  <span>Share (WhatsApp)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveFile}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs uppercase shadow transition active:scale-95 cursor-pointer"
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
