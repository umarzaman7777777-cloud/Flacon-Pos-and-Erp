import React, { useState, useEffect, useRef } from 'react';
import { Printer, X, Copy, Check, FileText } from 'lucide-react';
import { subscribeToPrintPreview, PrintPreviewEventDetail } from '../utils/printPortal';

export const PrintPreviewModal: React.FC = () => {
  const [detail, setDetail] = useState<PrintPreviewEventDetail | null>(null);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const unsub = subscribeToPrintPreview(evt => {
      if (evt && evt.html) {
        setDetail(evt);
        setCopied(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (detail && iframeRef.current) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(detail.html);
        doc.close();
      }
    }
  }, [detail]);

  if (!detail) return null;

  const handlePrintClick = () => {
    // 1. Direct print from iframe content window if possible
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      }
    } catch (_) {}

    // 2. Fallback to global window print
    try {
      document.body.classList.add('printing-active');
      window.print();
    } catch (err) {
      console.warn('Print trigger note:', err);
    }
  };

  const handleCopyText = () => {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = detail.html;
      const text = tempDiv.innerText || tempDiv.textContent || '';
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Print preview document"
      className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs font-mono animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-3xl max-w-full overflow-x-hidden break-words max-h-[95vh] flex flex-col rounded-2xl bg-[var(--panel)] border border-[var(--steel-line)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--steel-line)] bg-[var(--panel-raised)] shrink-0 gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Printer size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-[var(--text)] truncate">
                {detail.title || 'Print Document Preview'}
              </h3>
              <p className="text-[10px] text-[var(--text-dim)] truncate">
                Ready for thermal or desktop paper printing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--steel-line)] hover:border-amber-400 text-xs text-[var(--text-dim)] hover:text-[var(--text)] flex items-center gap-1.5 transition cursor-pointer"
              title="Copy receipt plain text"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintClick}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md active:scale-95"
              title="Trigger browser print dialog"
            >
              <Printer size={14} />
              <span>Print Now</span>
            </button>

            <button
              type="button"
              onClick={() => setDetail(null)}
              className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition cursor-pointer"
              title="Close print preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Live Document Preview Viewer */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/60 flex justify-center">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl overflow-hidden border border-slate-300">
            <iframe
              ref={iframeRef}
              title="Print Preview Container"
              className="w-full min-h-[60vh] sm:min-h-[70vh] border-0 bg-white"
            />
          </div>
        </div>

        {/* Footer info note */}
        <div className="px-4 py-2 border-t border-[var(--steel-line)] bg-[var(--panel-raised)] text-[11px] text-[var(--text-dim)] flex items-center justify-between">
          <span className="flex items-center gap-1">
            <FileText size={12} className="text-amber-400" />
            <span>Click <strong>Print Now</strong> to select thermal or standard printer.</span>
          </span>
          <button
            type="button"
            onClick={() => setDetail(null)}
            className="text-xs hover:text-[var(--text)] text-[var(--text-dim)] cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
