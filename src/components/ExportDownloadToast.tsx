import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  ExternalLink,
  Copy,
  Check,
  X,
  FileText,
  Image as ImageIcon,
  Share2,
  FileSpreadsheet,
  Eye,
  Search,
  Layers
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { saveFileNatively } from '../utils/nativeFileSaver';
import { shareExportFile, openExportFile } from '../utils/universalDownloader';
import { triggerHaptic } from '../utils/haptics';

export interface ExportReadyEventDetail {
  fileName: string;
  format: string;
  blobUrl: string;
  dataUrl?: string;
  mimeType?: string;
  rawContent?: string;
  savedLocally?: boolean;
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
  timestamp: number;
}

export const ExportDownloadToast: React.FC = () => {
  const [activeExport, setActiveExport] = useState<ExportReadyEventDetail | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [openedNatively, setOpenedNatively] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isInAppPreviewOpen, setIsInAppPreviewOpen] = useState(false);
  const [csvFilter, setCsvFilter] = useState('');
  const [pdfEmbedMode, setPdfEmbedMode] = useState<'sheet' | 'embed'>('sheet');

  useEffect(() => {
    const handleExportReady = (e: Event) => {
      const customEvt = e as CustomEvent<ExportReadyEventDetail>;
      if (customEvt.detail && customEvt.detail.fileName) {
        setActiveExport(customEvt.detail);
        setCopied(false);
        setShared(false);
        setOpenedNatively(false);
        setSavedSuccess(Boolean(customEvt.detail.savedLocally));
        setCsvFilter('');
        setPdfEmbedMode('sheet');
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

  const getDecodedCsvText = (): string => {
    if (activeExport.rawContent) return activeExport.rawContent;
    if (!activeExport.dataUrl) return '';
    try {
      const dUrl = activeExport.dataUrl;
      if (dUrl.includes(';base64,')) {
        const b64 = dUrl.split(';base64,')[1];
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
      } else if (dUrl.includes(',')) {
        return decodeURIComponent(dUrl.split(',')[1]);
      }
    } catch (err) {
      console.warn('Could not decode CSV dataUrl:', err);
    }
    return '';
  };

  const handleCopyContent = async () => {
    try {
      const textToCopy = isCsv ? getDecodedCsvText() : activeExport.rawContent || activeExport.dataUrl || '';
      if (textToCopy) {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
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
        title: activeExport.fileName
      });
      if (res.success) {
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      }
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  // Direct native app open (e.g. Adobe/Google Drive PDF viewer, Google Sheets/Excel for CSV, Gallery for JPG)
  const handleOpenNatively = async () => {
    try {
      const res = await openExportFile({
        fileName: activeExport.fileName,
        dataUrl: activeExport.dataUrl,
        blobUrl: activeExport.blobUrl,
        mimeType: activeExport.mimeType,
        format: activeExport.format,
        rawContent: activeExport.rawContent
      });
      if (res.success) {
        setOpenedNatively(true);
        setTimeout(() => setOpenedNatively(false), 2500);
      }
    } catch (err) {
      console.warn('Open natively error:', err);
    }
  };

  const parsedCsv = useMemo(() => {
    if (activeExport.tableData?.headers && activeExport.tableData?.rows) {
      return {
        headers: activeExport.tableData.headers,
        rows: activeExport.tableData.rows.map(r => r.map(c => String(c ?? ''))),
        footer: activeExport.tableData.footer
      };
    }
    if (!isCsv) return { headers: [], rows: [] };
    const raw = getDecodedCsvText();
    if (!raw) return { headers: [], rows: [] };
    const clean = raw.replace(/^\ufeff/, '').trim();
    const lines = clean.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rawRows = lines.slice(1).map(parseLine);
    let footer: string | undefined;

    // Check if the last row is actually a footer line
    if (rawRows.length > 0 && rawRows[rawRows.length - 1].length === 1) {
      footer = rawRows.pop()![0];
    }

    return { headers, rows: rawRows, footer };
  }, [activeExport, isCsv]);

  const filteredCsvRows = useMemo(() => {
    if (!csvFilter.trim()) return parsedCsv.rows;
    const q = csvFilter.toLowerCase().trim();
    return parsedCsv.rows.filter(row => row.some(cell => cell.toLowerCase().includes(q)));
  }, [parsedCsv.rows, csvFilter]);

  // Structured table data for rendering PDF preview sheet
  const pdfSheetData = useMemo(() => {
    if (!isPdf) return null;
    if (activeExport.tableData) {
      return activeExport.tableData;
    }
    return null;
  }, [activeExport, isPdf]);

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
            onClick={() => setIsInAppPreviewOpen(true)}
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
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase border whitespace-nowrap shrink-0 ${
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
                  ? 'Saved to Downloads. Tap below to Open or Share.'
                  : 'Tap below to Open in Native App, Share, or Inspect:'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveExport(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Action Buttons Row */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Open Native File in Viewer (Adobe, Sheets, Excel, Gallery) */}
          <button
            type="button"
            onClick={handleOpenNatively}
            className={`flex-1 min-w-[130px] whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-white font-bold text-xs uppercase shadow transition active:scale-95 cursor-pointer ${
              isPdf
                ? 'bg-rose-600 hover:bg-rose-500'
                : isCsv
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-amber-600 hover:bg-amber-500'
            }`}
            title="Open directly in native viewer app without glitches"
          >
            {openedNatively ? <Check size={14} className="text-white" /> : <ExternalLink size={14} />}
            <span>
              {openedNatively
                ? 'Opened!'
                : isPdf
                ? 'Open PDF App'
                : isCsv
                ? 'Open Sheets/Excel'
                : 'Open Native'}
            </span>
          </button>

          {/* Share Button (WhatsApp / System Intent) */}
          <button
            type="button"
            onClick={handleShare}
            className="whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase shadow transition active:scale-95 cursor-pointer"
            title="Share real file to WhatsApp, Gmail, Drive, Bluetooth or device apps"
          >
            {shared ? <Check size={14} className="text-black" /> : <Share2 size={14} />}
            <span>{shared ? 'Shared!' : 'Share File'}</span>
          </button>

          {/* In-App Preview / Inspect Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsInAppPreviewOpen(true)}
            className="whitespace-nowrap shrink-0 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Inspect full file details in modal"
          >
            <Eye size={13} />
            <span>Inspect</span>
          </button>

          {/* Download to Device */}
          <button
            type="button"
            onClick={handleSaveFile}
            className="whitespace-nowrap shrink-0 px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Save file to local Downloads folder"
          >
            {savedSuccess ? <Check size={13} className="text-black" /> : <Download size={13} />}
            <span>{savedSuccess ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </aside>

      {/* In-App Multi-Format Document Inspector Lightbox Modal */}
      {isInAppPreviewOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-5 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[94vh]">
            {/* Header */}
            <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase whitespace-nowrap shrink-0 ${
                    isPdf
                      ? 'bg-rose-500 text-white'
                      : isCsv
                      ? 'bg-emerald-500 text-black'
                      : 'bg-amber-500 text-black'
                  }`}
                >
                  {activeExport.format.toUpperCase()}
                </span>
                <span className="text-sm font-bold text-white truncate">
                  {activeExport.fileName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isPdf && (
                  <button
                    type="button"
                    onClick={() => setPdfEmbedMode(prev => prev === 'sheet' ? 'embed' : 'sheet')}
                    className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
                    title="Toggle document sheet view or raw PDF embed"
                  >
                    <Layers size={13} />
                    <span>{pdfEmbedMode === 'sheet' ? 'Switch to Raw Embed' : 'Switch to Document Sheet'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsInAppPreviewOpen(false)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-500 hover:text-white text-slate-400 flex items-center justify-center transition cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Inspector Body: Format Specific View */}
            <div className="p-3 sm:p-4 overflow-y-auto max-h-[74vh] flex flex-col bg-[#070b12] text-slate-200">
              {/* PDF VIEWER */}
              {isPdf && (
                <div className="w-full flex flex-col items-center gap-3">
                  {/* Status & Action Bar */}
                  <div className="w-full flex items-center justify-between gap-2 p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex-wrap">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                      <FileText size={16} className="text-rose-400" />
                      <span>Falcon Vector PDF Document • Ready for Print & Native View</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenNatively}
                        className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition active:scale-95 cursor-pointer shadow"
                        title="Launch device's native PDF Viewer app (Adobe Acrobat, Google PDF Viewer, Drive)"
                      >
                        <ExternalLink size={13} />
                        <span>{openedNatively ? 'Opening...' : 'Open with PDF App'}</span>
                      </button>
                    </div>
                  </div>

                  {/* DOCUMENT SHEET VIEW (Works 100% reliably on Android WebView, iOS & Desktop without plugin errors) */}
                  {pdfEmbedMode === 'sheet' && (
                    <div className="w-full bg-slate-950/80 p-2 sm:p-4 rounded-xl border border-slate-800 overflow-x-auto">
                      <div className="bg-white text-slate-900 rounded-lg shadow-2xl p-4 sm:p-8 min-w-[580px] max-w-3xl mx-auto border border-slate-200 font-sans">
                        {/* Top Accent Stripe */}
                        <div className="h-1.5 w-full bg-amber-500 rounded-t -mt-4 sm:-mt-8 mb-4 sm:mb-6" />

                        {/* Document Header */}
                        <div className="bg-slate-900 text-white p-4 rounded-lg flex items-center justify-between gap-4 mb-5 border border-slate-800">
                          <div>
                            <h2 className="text-base sm:text-lg font-black tracking-wide text-amber-400 font-serif">
                              {pdfSheetData?.companyName || 'Falcon Rod Maker'}
                            </h2>
                            <p className="text-xs text-slate-300 mt-0.5">
                              {pdfSheetData?.subtitle || 'Fan Accessories · Gujrat'}
                            </p>
                            <div className="mt-2 text-[11px] font-mono text-slate-400">
                              <span>Title: {pdfSheetData?.title || activeExport.fileName.replace('.pdf', '')}</span>
                              <span className="mx-2">•</span>
                              <span>Date: {new Date().toLocaleDateString('en-GB')}</span>
                            </div>
                          </div>
                          <div className="px-3 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold uppercase text-right">
                            <span>{pdfSheetData?.orientation || 'Landscape'}</span>
                            <div className="text-[10px] text-slate-400 uppercase">{pdfSheetData?.paperSize || 'A4'}</div>
                          </div>
                        </div>

                        {/* Tabular Content */}
                        {pdfSheetData?.headers && pdfSheetData?.rows ? (
                          <div className="border border-slate-300 rounded overflow-hidden mb-5">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-800 text-slate-100 font-bold border-b border-slate-400">
                                <tr>
                                  <th className="py-2 px-2.5 w-10 text-center text-slate-400 border-r border-slate-700">#</th>
                                  {pdfSheetData.headers.map((h, i) => (
                                    <th key={i} className="py-2 px-3 border-r border-slate-700 whitespace-nowrap">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {pdfSheetData.rows.map((row, rIdx) => (
                                  <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                                    <td className="py-1.5 px-2 text-center text-slate-400 text-[10px] border-r border-slate-200">
                                      {rIdx + 1}
                                    </td>
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} className="py-1.5 px-3 text-slate-800 border-r border-slate-200 whitespace-nowrap font-mono text-[11px]">
                                        {String(cell ?? '')}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-6 text-center text-slate-500 font-mono text-xs border border-dashed rounded mb-5">
                            Standard Vector PDF Ready. Tap "Open with PDF App" below to view in your device's native PDF reader.
                          </div>
                        )}

                        {/* Balance / Custom Note Box */}
                        {pdfSheetData?.customNote && (
                          <div className="p-2.5 bg-slate-100 border border-slate-300 rounded text-xs font-bold text-slate-800 mb-5">
                            {pdfSheetData.customNote}
                          </div>
                        )}

                        {/* Signature Line */}
                        <div className="pt-6 border-t border-slate-300 flex justify-between items-end text-xs text-slate-500 font-mono">
                          <span>Falcon POS Official Record</span>
                          <div className="text-right">
                            <div className="w-44 border-b border-slate-400 mb-1" />
                            <span>Authorized Signature & Stamp</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RAW EMBED VIEW (Available if browser supports it) */}
                  {pdfEmbedMode === 'embed' && (
                    <div className="w-full min-h-[50vh] sm:min-h-[62vh] rounded-xl overflow-hidden bg-white/5 border border-slate-800 relative flex items-center justify-center">
                      <object
                        data={activeExport.blobUrl || activeExport.dataUrl}
                        type="application/pdf"
                        className="w-full h-[52vh] sm:h-[62vh] rounded-xl bg-white"
                      >
                        <div className="p-8 text-center flex flex-col items-center justify-center gap-4 bg-[#0a0f1d] w-full h-full text-slate-200">
                          <FileText size={36} className="text-rose-400" />
                          <h4 className="font-bold text-base text-white">{activeExport.fileName}</h4>
                          <p className="text-xs text-slate-400 max-w-sm">
                            Native mobile WebViews do not embed PDF viewer plugins. Tap below to launch your device's native PDF viewer app.
                          </p>
                          <button
                            type="button"
                            onClick={handleOpenNatively}
                            className="whitespace-nowrap flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase shadow transition active:scale-95 cursor-pointer"
                          >
                            <ExternalLink size={14} />
                            <span>Open in PDF Viewer</span>
                          </button>
                        </div>
                      </object>
                    </div>
                  )}
                </div>
              )}

              {/* CSV SPREADSHEET TABLE VIEWER */}
              {isCsv && (
                <div className="w-full flex flex-col gap-3">
                  {/* Top toolbar */}
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={csvFilter}
                        onChange={e => setCsvFilter(e.target.value)}
                        placeholder="Search ledger rows..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono px-2 py-1 rounded bg-slate-800 text-emerald-400 border border-slate-700 whitespace-nowrap">
                        {filteredCsvRows.length} {filteredCsvRows.length === 1 ? 'Row' : 'Rows'} • {parsedCsv.headers.length} Cols
                      </span>
                      <button
                        type="button"
                        onClick={handleOpenNatively}
                        className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition active:scale-95 cursor-pointer"
                        title="Open spreadsheet in Google Sheets or Microsoft Excel app"
                      >
                        <ExternalLink size={13} />
                        <span>Open in Sheets / Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyContent}
                        className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95 cursor-pointer"
                      >
                        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>{copied ? 'Copied' : 'Copy CSV'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Fully scrollable table with horizontal scroll indicator */}
                  <div className="w-full max-h-[58vh] overflow-x-auto overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/70 shadow-inner">
                    <table className="w-full text-left text-xs font-mono border-collapse min-w-[650px]">
                      <thead className="sticky top-0 z-10 bg-slate-900 text-amber-400 border-b border-slate-700 shadow">
                        <tr>
                          <th className="py-2.5 px-3 border-r border-slate-800 w-12 text-center text-slate-500 font-normal">
                            #
                          </th>
                          {parsedCsv.headers.map((h, i) => (
                            <th key={i} className="py-2.5 px-3 font-bold border-r border-slate-800 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {filteredCsvRows.length > 0 ? (
                          filteredCsvRows.map((row, rIdx) => (
                            <tr
                              key={rIdx}
                              className={rIdx % 2 === 0 ? 'bg-slate-900/30 hover:bg-slate-800/50' : 'bg-slate-950/60 hover:bg-slate-800/50'}
                            >
                              <td className="py-2 px-3 border-r border-slate-800/80 text-center text-slate-500 text-[10px]">
                                {rIdx + 1}
                              </td>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="py-2 px-3 border-r border-slate-800/80 text-slate-200 whitespace-nowrap">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={parsedCsv.headers.length + 1} className="py-8 text-center text-slate-500">
                              {csvFilter ? 'No rows match your filter query.' : 'Spreadsheet is empty.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Dedicated footer summary bar */}
                  {parsedCsv.footer && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-mono font-semibold">
                      <span>{parsedCsv.footer}</span>
                    </div>
                  )}
                </div>
              )}

              {/* IMAGE JPG/PNG VIEWER */}
              {isJpg && (
                <div className="flex flex-col items-center justify-center w-full gap-3">
                  <div className="w-full flex items-center justify-between gap-2 p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex-wrap">
                    <span className="text-xs font-mono text-slate-300">High-Resolution Document Image Graphic Archive</span>
                    <button
                      type="button"
                      onClick={handleOpenNatively}
                      className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow transition active:scale-95 cursor-pointer"
                    >
                      <ExternalLink size={13} />
                      <span>Open in Gallery / Photos</span>
                    </button>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 max-h-[66vh] overflow-auto flex items-center justify-center">
                    <img
                      src={activeExport.dataUrl || activeExport.blobUrl}
                      alt={activeExport.fileName}
                      className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-2xl"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Footer Actions */}
            <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap shrink-0">
              <button
                type="button"
                onClick={() => setIsInAppPreviewOpen(false)}
                className="whitespace-nowrap shrink-0 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {/* Native App Open Button */}
                <button
                  type="button"
                  onClick={handleOpenNatively}
                  className={`whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs uppercase shadow transition active:scale-95 cursor-pointer ${
                    isPdf
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : isCsv
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 text-black'
                  }`}
                  title="Open file directly in device native app"
                >
                  <ExternalLink size={13} />
                  <span>
                    {openedNatively
                      ? 'Opened!'
                      : isPdf
                      ? 'Open PDF App'
                      : isCsv
                      ? 'Open Sheets/Excel'
                      : 'Open Image App'}
                  </span>
                </button>

                {/* Share Button (WhatsApp / Apps) */}
                <button
                  type="button"
                  onClick={handleShare}
                  className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase shadow transition active:scale-95 cursor-pointer"
                  title="Share actual file to WhatsApp or native apps"
                >
                  {shared ? <Check size={13} className="text-black" /> : <Share2 size={13} />}
                  <span>{shared ? 'Shared!' : 'Share (WhatsApp)'}</span>
                </button>

                {/* Download Button */}
                <button
                  type="button"
                  onClick={handleSaveFile}
                  className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs uppercase shadow transition active:scale-95 cursor-pointer"
                  title="Download file to device"
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
