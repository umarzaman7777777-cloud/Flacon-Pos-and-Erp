import React, { useState } from 'react';
import {
  X,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  Image as ImageIcon,
  Check,
  Calendar,
  Truck,
  User,
  Building,
  ShieldCheck,
  ExternalLink,
  UserCheck,
  Hash,
  Layers
} from 'lucide-react';
import { Transaction, AppLanguage } from '../types';
import { fmt } from '../utils/helpers';
import { UnifiedGateReceipt } from '../utils/gateSequenceManager';

interface GatePassViewerModalProps {
  transaction?: Transaction | null;
  receipt?: UnifiedGateReceipt | null;
  language?: AppLanguage;
  companyName?: string;
  onClose: () => void;
}

export const GatePassViewerModal: React.FC<GatePassViewerModalProps> = ({
  transaction,
  receipt,
  language,
  companyName,
  onClose
}) => {
  const gatePass = transaction?.gatePass;
  const fileData = receipt?.fileData || gatePass?.fileData || transaction?.receiptUrl;
  const isPdf =
    receipt?.fileType === 'pdf' ||
    gatePass?.fileType === 'pdf' ||
    fileData?.startsWith('data:application/pdf') ||
    receipt?.fileName?.toLowerCase().endsWith('.pdf') ||
    gatePass?.fileName?.toLowerCase().endsWith('.pdf');

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!fileData) {
    return null;
  }

  const handleZoomIn = () => setZoom(prev => Math.min(3, prev + 0.25));
  const handleZoomOut = () => setZoom(prev => Math.max(0.5, prev - 0.25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const id = receipt?.id || transaction?.id || 'RECEIPT';
  const seqNo = receipt?.gateSequenceNo || transaction?.gateSequenceNo || gatePass?.gateSequenceNo || 'GATE-SEQ-001';
  const partyName = receipt?.partyName || transaction?.factory || 'Walk-in Customer';
  const orderRef = receipt?.orderRef || (transaction ? `Order #${transaction.id}` : 'Order');
  const receiverName = receipt?.receivedBy || transaction?.gateReceivedBy || gatePass?.receivedBy || 'Gate Officer: Verified';
  const gatePost = receipt?.gatePost || transaction?.gatePost || gatePass?.gatePost || 'Gate 1';
  const dateStr = receipt?.date || transaction?.date || '';
  const uploadedAt = receipt?.uploadedAt || gatePass?.uploadedAt || dateStr;
  const vehicle = receipt?.vehicleNo || gatePass?.vehicleNo || 'Self Transport';
  const driver = receipt?.driverName || gatePass?.driverName || 'Authorized Staff';
  const totalVal = receipt?.totalAmount ?? transaction?.total;

  const fileName =
    receipt?.fileName ||
    gatePass?.fileName ||
    `GatePass_${id}.${isPdf ? 'pdf' : 'jpg'}`;

  const handlePrint = () => {
    if (isPdf) {
      const printWindow = window.open(fileData);
      if (printWindow) {
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
      }
    } else {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Gate Pass Receipt - ${seqNo} (${partyName})</title>
              <style>
                body { margin: 0; display: flex; align-items: center; justify-content: center; background: #fff; font-family: monospace; }
                .container { text-align: center; padding: 20px; }
                img { max-width: 100%; max-height: 90vh; object-fit: contain; }
                .meta { margin-top: 10px; font-size: 12px; color: #333; }
              </style>
            </head>
            <body>
              <div class="container">
                <img src="${fileData}" onload="window.print();window.close()" />
                <div class="meta">Gate Sequence: ${seqNo} | Received by: ${receiverName}</div>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  return (
    <div
      id="gate-pass-viewer-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 sm:p-6 overflow-hidden font-mono"
    >
      <div
        id="gate-pass-viewer-modal-content"
        className="w-full max-w-4xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-[var(--steel-line)] flex items-center justify-between bg-[var(--panel-raised)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              {isPdf ? <FileText size={20} /> : <ImageIcon size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-serif font-black text-base sm:text-lg text-[var(--text)] font-sans">
                  Gate Receipt Archive
                </h3>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider font-mono">
                  {seqNo}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 font-sans">
                  <ShieldCheck size={11} strokeWidth={2.5} />
                  <span>Gate Verified</span>
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">
                {orderRef} · <strong className="text-[var(--text)]">{partyName}</strong> · {dateStr}
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <a
              id="gate-pass-download-btn"
              href={fileData}
              download={fileName}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--yellow)] transition bg-[var(--panel)]"
              title="Download file to device"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Download</span>
            </a>

            <button
              type="button"
              id="gate-pass-print-btn"
              onClick={handlePrint}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--yellow)] transition bg-[var(--panel)]"
              title="Print Gate Pass"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              type="button"
              id="gate-pass-viewer-close-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] transition bg-[var(--panel)]"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Gate Order Sequence & Receiving Officer Bar */}
        <div className="px-4 py-2.5 bg-[var(--panel-raised)]/90 border-b border-[var(--steel-line)] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-[var(--text-dim)] shrink-0 font-sans">
          <div>
            <span className="text-[10px] uppercase text-[var(--text-dim)] block font-bold">Gate Sequence</span>
            <span className="font-bold text-amber-400 font-mono text-xs">{seqNo}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-[var(--text-dim)] block font-bold">Received By Staff</span>
            <span className="font-semibold text-emerald-400 font-mono flex items-center gap-1 truncate">
              <UserCheck size={12} />
              {receiverName}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-[var(--text-dim)] block font-bold">Gate Post / Location</span>
            <span className="font-semibold text-[var(--text)] font-mono truncate">
              {gatePost}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-[var(--text-dim)] block font-bold">
              {typeof totalVal === 'number' && totalVal > 0 ? 'Order Amount' : 'Uploaded At'}
            </span>
            <span className="font-bold text-[var(--yellow)] font-mono truncate">
              {typeof totalVal === 'number' && totalVal > 0 ? fmt(totalVal) : uploadedAt}
            </span>
          </div>
        </div>

        {/* Secondary Transport Bar */}
        <div className="px-4 py-2 bg-[var(--panel)] border-b border-[var(--steel-line)]/60 flex flex-wrap items-center justify-between text-[10px] text-[var(--text-dim)] gap-2 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span>Vehicle: <strong className="text-[var(--text)]">{vehicle}</strong></span>
            <span>·</span>
            <span>Driver: <strong className="text-[var(--text)]">{driver}</strong></span>
            {receipt?.summary && (
              <>
                <span>·</span>
                <span className="truncate max-w-xs sm:max-w-md text-[var(--text)] font-semibold">{receipt.summary}</span>
              </>
            )}
          </div>
          <span className="text-[9px] text-amber-400 font-mono font-bold">Order Received & Certified at Gate</span>
        </div>

        {/* Viewer Canvas Area */}
        <div className="flex-1 overflow-auto bg-black/50 p-4 flex items-center justify-center relative min-h-[360px]">
          {isPdf ? (
            <div className="w-full h-full min-h-[520px] flex flex-col items-center justify-center">
              <iframe
                src={fileData}
                title="Gate Pass PDF Document"
                className="w-full h-full min-h-[520px] rounded-lg border border-[var(--steel-line)] bg-white"
              />
            </div>
          ) : (
            <div className="relative overflow-auto max-w-full max-h-full flex items-center justify-center">
              <img
                src={fileData}
                alt="Gate Pass Full Document"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out'
                }}
                className="max-h-[70vh] object-contain rounded-lg shadow-2xl border border-[var(--steel-line)]"
              />
            </div>
          )}
        </div>

        {/* Controls Toolbar (Image controls) */}
        {!isPdf && (
          <div className="p-3 border-t border-[var(--steel-line)] bg-[var(--panel-raised)] flex items-center justify-between shrink-0 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1.5 rounded-lg border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[var(--text)] bg-[var(--panel)] transition"
                title="Zoom in"
              >
                <ZoomIn size={14} />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1.5 rounded-lg border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[var(--text)] bg-[var(--panel)] transition"
                title="Zoom out"
              >
                <ZoomOut size={14} />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                className="p-1.5 rounded-lg border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[var(--text)] bg-[var(--panel)] transition"
                title="Rotate 90 degrees"
              >
                <RotateCw size={14} />
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1.5 rounded-lg border border-[var(--steel-line)] text-[10px] text-[var(--text-dim)] hover:text-[var(--text)] bg-[var(--panel)] transition"
              >
                Reset
              </button>
              <span className="text-[10px] text-[var(--text-dim)] ml-2">
                Zoom: {Math.round(zoom * 100)}%
              </span>
            </div>

            <div className="text-[10px] text-[var(--text-dim)]">
              File: {fileName}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
