import React, { useState } from 'react';
import {
  X,
  Printer,
  Download,
  FileText,
  Check,
  CreditCard,
  Building,
  Calendar,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  Eye,
  Truck,
  Sliders,
  Share2
} from 'lucide-react';
import { Transaction, CustomerPayment, AppLanguage, PrintPageSetup } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, amountInWordsEnglish, amountInWordsUrdu } from '../utils/helpers';
import {
  exportSingleTransactionPDF,
  printStyledTransactionDocument,
  printThermalReceiptDocument,
  parseTransactionItems
} from '../utils/transactionPdf';
import { exportSingleTransactionJPG } from '../utils/exportManager';
import { shareExportFile } from '../utils/universalDownloader';
import { FalconLogo } from './FalconLogo';
import { GatePassViewerModal } from './GatePassViewerModal';
import { PrintPageSetupModal } from './PrintPageSetupModal';
import { getEffectivePageSetup, PAPER_SIZE_SPECS } from '../utils/printSetupHelper';

interface TransactionPdfModalProps {
  transaction: Transaction | null;
  customerPayments: CustomerPayment[];
  companyName: string;
  language: AppLanguage;
  onClose: () => void;
  onRecordPayment?: (txn: Transaction) => void;
}

export const TransactionPdfModal: React.FC<TransactionPdfModalProps> = ({
  transaction,
  customerPayments,
  companyName,
  language,
  onClose,
  onRecordPayment
}) => {
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [isGeneratingJpg, setIsGeneratingJpg] = useState(false);
  const [jpgSuccess, setJpgSuccess] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isViewingGatePass, setIsViewingGatePass] = useState(false);
  const [pageSetup, setPageSetup] = useState<PrintPageSetup>(getEffectivePageSetup);
  const [isPageSetupOpen, setIsPageSetupOpen] = useState(false);

  if (!transaction) return null;

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const relevantPayments = customerPayments.filter(p => p.txnId === transaction.id);
  const paymentsSum = relevantPayments.reduce((s, p) => s + p.amount, 0);
  const totalPaid = paymentsSum + (transaction.paid ? transaction.total : 0);
  const dueAmount = Math.max(0, transaction.total - totalPaid);
  const isPaid = dueAmount <= 0;
  const isPartial = totalPaid > 0 && dueAmount > 0;
  const items = parseTransactionItems(transaction);

  const handleShareInvoice = async () => {
    try {
      setIsSharing(true);
      const dataUrl = await exportSingleTransactionJPG({
        transaction,
        customerPayments,
        companyName
      });
      const cleanCustomer = (transaction.factory || 'WalkIn').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Invoice_${transaction.id}_${cleanCustomer}.jpg`;
      await shareExportFile({
        fileName,
        dataUrl,
        title: `Invoice #${transaction.id} — ${transaction.factory || 'Walk-in'} (Rs ${fmt(transaction.total)})`,
        format: 'jpg',
        mimeType: 'image/jpeg'
      });
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2500);
    } catch (err) {
      console.warn('Share invoice error:', err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await exportSingleTransactionPDF({
        transaction,
        customerPayments,
        companyName,
        pageSetup
      });
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 2500);
    } catch (err) {
      console.error('Error generating PDF', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadJpg = async () => {
    try {
      setIsGeneratingJpg(true);
      await exportSingleTransactionJPG({
        transaction,
        customerPayments,
        companyName
      });
      setJpgSuccess(true);
      setTimeout(() => setJpgSuccess(false), 2500);
    } catch (err) {
      console.error('Error generating JPG', err);
    } finally {
      setIsGeneratingJpg(false);
    }
  };

  const handlePrintDocument = () => {
    printStyledTransactionDocument({
      transaction,
      customerPayments,
      companyName,
      pageSetup
    });
  };

  const handlePrintThermal = () => {
    printThermalReceiptDocument({
      transaction,
      customerPayments,
      companyName,
      pageSetup
    });
  };

  const handleCopySummary = () => {
    const summary = `Invoice #${transaction.id}\nCustomer: ${transaction.factory || 'Walk-in'}\nTotal: Rs ${fmt(transaction.total)}\nDue: Rs ${fmt(dueAmount)}\nItems: ${transaction.itemsSummary}`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const paperSpec = PAPER_SIZE_SPECS[pageSetup.paperSize] || PAPER_SIZE_SPECS.a4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-5 font-mono">
      <div className="w-full max-w-3xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Bar */}
        <div className="p-4 bg-[var(--panel-raised)] border-b border-[var(--steel-line)] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--yellow)]/15 border border-[var(--yellow)]/30 flex items-center justify-center text-[var(--yellow)]">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[var(--text)] flex items-center gap-2">
                <span>Invoice #{transaction.id}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider ${
                    isPaid
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : isPartial
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'bg-red-500/15 text-red-400 border border-red-500/30'
                  }`}
                >
                  {isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID'}
                </span>
              </h3>
              <p className="text-[11px] text-[var(--text-dim)]">
                Formatted Document Layout & PDF Export
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPageSetupOpen(true)}
              title="Configure paper size (A4, Letter, Legal, etc.), orientation (portrait/landscape), margins & scaling"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs text-[var(--text)] hover:text-[var(--yellow)] font-bold transition cursor-pointer"
            >
              <Sliders size={14} className="text-[var(--yellow)]" />
              <span className="hidden sm:inline">Page Setup</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-[var(--yellow)] font-mono uppercase">
                {paperSpec.id} · {pageSetup.orientation === 'landscape' ? 'Land' : 'Port'}
              </span>
            </button>

            <button
              type="button"
              onClick={handlePrintThermal}
              title="Print layout formatted specifically for 80mm/58mm thermal receipt printers"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs text-[var(--text)] hover:text-[var(--yellow)] font-bold transition cursor-pointer"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Thermal Receipt</span>
              <span className="sm:hidden text-[10px]">Thermal</span>
            </button>

            <button
              type="button"
              onClick={handlePrintDocument}
              title="Print formatted document or save as PDF"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs text-[var(--text)] hover:text-[var(--yellow)] font-bold transition cursor-pointer"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print / Save PDF</span>
              <span className="sm:hidden text-[10px]">Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              title="Direct PDF file download"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer shadow-xs active:scale-95 ${
                pdfSuccess
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-[var(--panel-raised)] border-[var(--steel-line)] hover:border-[var(--yellow)] text-[var(--text)] hover:text-[var(--yellow)]'
              }`}
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 size={14} className="animate-spin text-[var(--yellow)]" />
                  <span>PDF...</span>
                </>
              ) : pdfSuccess ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShareInvoice}
              disabled={isSharing}
              title="Share Invoice directly to WhatsApp, Gmail, or device apps"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer shadow-xs active:scale-95 ${
                shareSuccess
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-black'
              }`}
            >
              {isSharing ? (
                <>
                  <Loader2 size={14} className="animate-spin text-emerald-400" />
                  <span>Sharing...</span>
                </>
              ) : shareSuccess ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span>Shared!</span>
                </>
              ) : (
                <>
                  <Share2 size={14} />
                  <span>Share (WhatsApp)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadJpg}
              disabled={isGeneratingJpg}
              title="Direct high-resolution JPG image download & save to Gallery"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-sm active:scale-95 ${
                jpgSuccess
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[var(--yellow)] text-[var(--canvas)] hover:brightness-110'
              }`}
            >
              {isGeneratingJpg ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>JPG...</span>
                </>
              ) : jpgSuccess ? (
                <>
                  <Check size={14} />
                  <span>JPG Saved!</span>
                </>
              ) : (
                <>
                  <ImageIcon size={14} />
                  <span>Export JPG</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Formatted Invoice Preview Scrollable Container */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 text-xs bg-[var(--bg)]">
          
          {/* Paper / Sheet Container */}
          <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl shadow-lg p-5 sm:p-8 space-y-6">
            
            {/* Hazard Stripe Header */}
            <div className="hazard-bar rounded-sm" />

            {/* Brand Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--steel-line)] pb-5">
              <div className="flex items-center gap-3.5">
                <div className="p-2 bg-white rounded-xl shadow-md border border-slate-200/80 shrink-0">
                  <img
                    src="/falcon-theme-rod-logo.svg"
                    alt="Falcon Rod Maker"
                    className="h-14 sm:h-16 w-auto object-contain"
                  />
                </div>
                <div>
                  <div className="inline-block px-2 py-0.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[10px] text-[var(--yellow)] font-bold uppercase tracking-wider mb-1">
                    ★ TAX INVOICE & DISPATCH MEMO ★
                  </div>
                  <h2 className="font-serif font-black text-lg text-[var(--text)] leading-tight">
                    {companyName || 'Falcon Rod Maker'}
                  </h2>
                  <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
                    Industrial Fan Accessories & Workshop POS · Gujrat, Pakistan
                  </p>
                </div>
              </div>

              <div className="bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl p-3.5 text-right space-y-1">
                <div className="text-[10px] text-[var(--text-dim)] uppercase font-semibold">Invoice Number</div>
                <div className="text-lg font-black text-[var(--yellow)]">#{transaction.id}</div>
                <div className="text-[10px] text-[var(--text-dim)] flex items-center justify-end gap-1">
                  <Calendar size={11} />
                  <span>{transaction.date}</span>
                  {transaction.time && (
                    <>
                      <Clock size={11} className="ml-1" />
                      <span>{transaction.time}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Meta Grid: Billed Account, Payment Status & Gate Pass Clearance */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Building size={12} />
                  <span>Customer / Account</span>
                </div>
                <div className="text-sm font-bold text-[var(--text)] truncate">
                  {transaction.factory || 'Walk-in Counter Order'}
                </div>
                <div className="text-[10px] text-[var(--text-dim)] mt-1">
                  Status: <span className="text-[var(--text)] font-semibold">{transaction.confirmed ? 'Confirmed Order' : 'Draft / Unconfirmed'}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                  Payment Status
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                      isPaid
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : isPartial
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-red-500/15 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {isPaid ? 'PAID / CLEARED' : isPartial ? 'PARTIAL' : 'UNPAID'}
                  </span>
                </div>
                <div className="text-[10px] text-[var(--text-dim)] mt-1.5">
                  Terms: <span className="text-[var(--text)]">{transaction.method || 'Ledger'}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Truck size={12} />
                  <span>Gate Pass Clearance</span>
                </div>
                {transaction.receiptUrl ? (
                  <div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30 uppercase">
                      <ShieldCheck size={11} strokeWidth={2.5} />
                      <span>Verified & Dispatched</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsViewingGatePass(true)}
                      className="mt-1.5 text-[10px] font-bold text-[var(--yellow)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={11} />
                      <span>View Uploaded Gate Pass</span>
                    </button>
                  </div>
                ) : (
                  <div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30 uppercase">
                      Pending Upload
                    </span>
                    <div className="text-[10px] text-[var(--text-dim)] mt-1">
                      Required for workshop clearance
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-[var(--steel-line)] rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--panel-raised)] border-b border-[var(--steel-line)] text-[10px] font-bold text-[var(--yellow)] uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3">Product Description</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3">Color</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Rate (Rs)</th>
                    <th className="py-2.5 px-3 text-right">Total (Rs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--steel-line)]">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[var(--panel-raised)]/50 transition">
                      <td className="py-2.5 px-3 text-[var(--text-dim)]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-[var(--text)]">{item.name}</td>
                      <td className="py-2.5 px-3 text-[var(--text-dim)]">{item.size || '-'}</td>
                      <td className="py-2.5 px-3 text-[var(--text-dim)]">{item.color || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[var(--text)]">{item.qty}</td>
                      <td className="py-2.5 px-3 text-right text-[var(--text-dim)]">{fmt(item.rate)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[var(--yellow)]">{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary & Amount in Words */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">
                    Amount in Words (English)
                  </div>
                  <div className="text-xs font-semibold text-[var(--text)] mt-1 leading-relaxed">
                    {amountInWordsEnglish(transaction.total)}
                  </div>
                </div>

                <div className="border-t border-[var(--steel-line)] pt-2.5">
                  <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">
                    Amount in Words (Urdu)
                  </div>
                  <div className="text-sm font-bold text-[var(--yellow)] mt-1 font-serif leading-relaxed" dir="rtl">
                    {amountInWordsUrdu(transaction.total)}
                  </div>
                </div>

                {relevantPayments.length > 0 && (
                  <div className="border-t border-[var(--steel-line)] pt-2.5 space-y-1">
                    <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">
                      Recorded Payment Receipts
                    </div>
                    {relevantPayments.map(p => (
                      <div key={p.id} className="text-[10px] text-[var(--text-dim)] flex justify-between">
                        <span>• {p.date} ({p.method}):</span>
                        <span className="text-emerald-400 font-bold">{fmt(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-[var(--text-dim)]">
                    <span>Order Subtotal:</span>
                    <span className="font-bold text-[var(--text)]">{fmt(transaction.total)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[var(--text-dim)]">
                    <span>Amount Received:</span>
                    <span className="font-bold text-emerald-400">{fmt(totalPaid)}</span>
                  </div>
                  <div className="border-t border-[var(--steel-line)] pt-2 flex justify-between text-sm font-bold">
                    <span className="text-[var(--text)]">Balance Due:</span>
                    <span className={dueAmount > 0 ? 'text-red-400' : 'text-emerald-400'}>
                      {fmt(dueAmount)}
                    </span>
                  </div>
                </div>

                {dueAmount > 0 && onRecordPayment && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRecordPayment(transaction);
                    }}
                    className="w-full py-2 rounded-lg bg-[var(--yellow)]/15 border border-[var(--yellow)] text-[var(--yellow)] font-bold text-xs hover:bg-[var(--yellow)]/25 flex items-center justify-center gap-1.5 transition"
                  >
                    <CreditCard size={13} />
                    <span>Record Payment for Balance</span>
                  </button>
                )}
              </div>
            </div>

            {/* Authorized Signatures & Seal */}
            <div className="border-t border-[var(--steel-line)] pt-6 grid grid-cols-3 gap-4 text-center text-[10px] text-[var(--text-dim)]">
              <div>
                <div className="border-b border-dashed border-[var(--steel-line)] pb-8" />
                <div className="pt-2 font-bold uppercase">Prepared By (Counter)</div>
              </div>
              <div>
                <div className="border-b border-dashed border-[var(--steel-line)] pb-8" />
                <div className="pt-2 font-bold uppercase">Dispatch & QA Seal</div>
              </div>
              <div>
                <div className="border-b border-dashed border-[var(--steel-line)] pb-8" />
                <div className="pt-2 font-bold uppercase">Customer Receiver</div>
              </div>
            </div>

            {/* Bottom Stamp Bar */}
            <div className="text-center text-[10px] text-[var(--text-dim)] border-t border-[var(--steel-line)] pt-3 flex items-center justify-between">
              <span>Falcon Rod Maker · Gujrat POS</span>
              <span>Computer Generated Document</span>
              <button
                type="button"
                onClick={handleCopySummary}
                className="hover:text-[var(--yellow)] transition flex items-center gap-1"
              >
                {copied ? <Check size={11} className="text-emerald-400" /> : null}
                <span>{copied ? 'Copied Summary' : 'Copy Summary'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[var(--panel-raised)] border-t border-[var(--steel-line)] flex items-center justify-between flex-wrap gap-2">
          <div className="text-[11px] text-[var(--text-dim)] flex items-center gap-2">
            <span>Setup: <strong className="text-[var(--text)] uppercase">{paperSpec.name} ({pageSetup.orientation})</strong></span>
            <button
              type="button"
              onClick={() => setIsPageSetupOpen(true)}
              className="text-[var(--yellow)] hover:underline font-bold text-xs cursor-pointer ml-1"
            >
              Change Setup
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintDocument}
              className="px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs font-bold text-[var(--text)] transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={13} />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-4 py-1.5 rounded-lg bg-[var(--yellow)] text-[var(--canvas)] font-bold text-xs hover:brightness-110 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={13} />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>

      {isViewingGatePass && (
        <GatePassViewerModal
          transaction={transaction}
          onClose={() => setIsViewingGatePass(false)}
        />
      )}

      {isPageSetupOpen && (
        <PrintPageSetupModal
          isOpen={isPageSetupOpen}
          onClose={() => setIsPageSetupOpen(false)}
          onSaved={(newSetup) => setPageSetup(newSetup)}
          language={language}
        />
      )}
    </div>
  );
};
