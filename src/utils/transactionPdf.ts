import { jsPDF } from 'jspdf';
import { Transaction, CustomerPayment, PrintPageSetup, ExportDocumentConfig } from '../types';
import { fmt, amountInWordsEnglish, amountInWordsUrdu } from './helpers';
import { FALCON_LOGO_WHITE_BG_PNG } from './logoData';
import { recordExport } from './exportManager';
import { getSavedExportConfig, hexToRgb } from './exportSettingsHelper';
import { triggerUniversalDownload } from './universalDownloader';
import {
  calculatePrintPageStyles,
  getEffectivePageSetup,
  PAPER_SIZE_SPECS
} from './printSetupHelper';

export interface ParsedItemRow {
  name: string;
  qty: number;
  rate: number;
  total: number;
  size?: string;
  color?: string;
}

export function parseTransactionItems(txn: Transaction): ParsedItemRow[] {
  const parts = txn.itemsSummary ? txn.itemsSummary.split(/\s*\+\s*|\n|;/).filter(Boolean) : [];
  const countParts = txn.itemCounts ? txn.itemCounts.split(/[,;]/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n)) : [];
  const rateParts = txn.itemRates ? txn.itemRates.split(/[,;]/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n)) : [];
  const sizeParts = txn.sizes ? txn.sizes.split(/[,;]/).map(s => s.trim()).filter(Boolean) : [];
  const colorParts = txn.colors ? txn.colors.split(/[,;]/).map(s => s.trim()).filter(Boolean) : [];

  const sanitizeName = (rawName: string) => {
    return rawName
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
      .replace(/Steel Taar/gi, 'M.S. Steel Pipe');
  };

  if (parts.length === 0) {
    return [{
      name: 'Ceiling Fan Down Rods',
      qty: txn.itemCount || 1,
      rate: txn.total / (txn.itemCount || 1),
      total: txn.total,
      size: txn.sizes,
      color: txn.colors
    }];
  }

  return parts.map((part, index) => {
    let name = sanitizeName(part.trim());
    let qty = 1;

    // Check pattern like "50x Product-Name" or "50 x Product"
    const match = name.match(/^(\d+)\s*x\s*(.+)$/i);
    if (match) {
      qty = parseInt(match[1], 10);
      name = sanitizeName(match[2].trim());
    } else if (countParts[index]) {
      qty = countParts[index];
    } else if (parts.length === 1 && txn.itemCount) {
      qty = txn.itemCount;
    }

    let rate = rateParts[index];
    if (!rate || isNaN(rate)) {
      if (parts.length === 1) {
        rate = Math.round(txn.total / Math.max(1, qty));
      } else {
        rate = Math.round(txn.total / Math.max(1, txn.itemCount || (qty * parts.length)));
      }
    }

    const total = qty * rate;
    return {
      name,
      qty,
      rate,
      total,
      size: sizeParts[index] || sizeParts[0] || txn.sizes,
      color: colorParts[index] || colorParts[0] || txn.colors
    };
  });
}

export interface ExportTransactionPdfOptions {
  transaction: Transaction;
  customerPayments: CustomerPayment[];
  companyName: string;
  companyTagline?: string;
  signatureUrl?: string;
  stampUrl?: string;
  pageSetup?: Partial<PrintPageSetup>;
  customExportConfig?: Partial<ExportDocumentConfig>;
}

/**
 * Exports a single transaction directly to a PDF file using jsPDF.
 */
export function exportSingleTransactionPDF({
  transaction,
  customerPayments,
  companyName = 'Falcon Rod Maker',
  companyTagline = 'Industrial Fan Accessories & Workshop ERP · Gujrat, Pakistan',
  signatureUrl,
  stampUrl,
  pageSetup,
  customExportConfig
}: ExportTransactionPdfOptions) {
  const globalExportCfg = getSavedExportConfig();
  const exportCfg: ExportDocumentConfig = {
    ...globalExportCfg,
    ...customExportConfig
  };

  const effectiveSetup = { ...getEffectivePageSetup(), ...pageSetup };
  const effectiveOrientation = (exportCfg.orientation || effectiveSetup.orientation) === 'landscape' ? 'landscape' : 'portrait';
  
  let effectiveFormat: string | [number, number] = 'a4';
  const paper = (exportCfg.paperSize || effectiveSetup.paperSize) as string;
  if (paper === 'letter') effectiveFormat = 'letter';
  else if (paper === 'legal') effectiveFormat = 'legal';
  else if (paper === 'a5') effectiveFormat = 'a5';
  else if (paper === 'b5') effectiveFormat = 'b5';
  else if (paper === '80mm') effectiveFormat = [80, 220];
  else if (paper === '58mm') effectiveFormat = [58, 180];
  else if (paper === '100mm') effectiveFormat = [100, 150];
  else if (effectiveSetup.paperSize === 'custom' && effectiveSetup.customWidthMm && effectiveSetup.customHeightMm) {
    effectiveFormat = [effectiveSetup.customWidthMm, effectiveSetup.customHeightMm];
  }

  const doc = new jsPDF({
    orientation: effectiveOrientation,
    unit: 'mm',
    format: effectiveFormat
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const font = exportCfg.fontFamily === 'times' ? 'times' : exportCfg.fontFamily === 'courier' ? 'courier' : 'helvetica';
  const [hBgR, hBgG, hBgB] = hexToRgb(exportCfg.headerBgColor || '#1c1f22');
  const [hTxtR, hTxtG, hTxtB] = hexToRgb(exportCfg.headerTextColor || '#f5b700');
  const [hSubR, hSubG, hSubB] = hexToRgb(exportCfg.headerSubtitleColor || '#cbd5e1');
  const [accR, accG, accB] = hexToRgb(exportCfg.accentColor || '#f5b700');

  const relevantPayments = customerPayments.filter(p => p.txnId === transaction.id);
  const paymentsSum = relevantPayments.reduce((s, p) => s + p.amount, 0);
  const totalPaid = paymentsSum + (transaction.paid ? transaction.total : 0);
  const dueAmount = Math.max(0, transaction.total - totalPaid);
  const isPaid = dueAmount <= 0;
  const isPartial = totalPaid > 0 && dueAmount > 0;
  const statusLabel = isPaid ? 'PAID / COMPLETED' : isPartial ? 'PARTIAL PAYMENT' : 'UNPAID / ON CREDIT';

  const items = parseTransactionItems(transaction);

  // 1. Top Industrial Accent Band (Hazard Bar)
  if (exportCfg.showAccentBar !== false) {
    doc.setFillColor(accR, accG, accB);
    doc.rect(0, 0, pageWidth, 5, 'F');
    doc.setFillColor(hBgR, hBgG, hBgB);
    for (let x = 0; x < pageWidth; x += 12) {
      doc.triangle(x, 0, x + 6, 0, x + 3, 5, 'F');
    }
  }

  // 2. Main Header Block
  doc.setFillColor(hBgR, hBgG, hBgB);
  doc.rect(margin, 10, contentWidth, 26, 'F');

  // Embed authentic logo image in header
  if (exportCfg.showLogo !== false) {
    try {
      doc.addImage(FALCON_LOGO_WHITE_BG_PNG, 'PNG', margin + 3, 12, 21, 21);
    } catch (_) {}
  }

  doc.setTextColor(hTxtR, hTxtG, hTxtB);
  doc.setFontSize(15);
  doc.setFont(font, 'bold');
  doc.text((companyName || exportCfg.companyName || 'FALCON ROD MAKER').toUpperCase(), margin + 29, 19);

  doc.setTextColor(hSubR, hSubG, hSubB);
  doc.setFontSize(8.5);
  doc.setFont(font, 'normal');
  doc.text(companyTagline || exportCfg.subtitle || 'Industrial Fan Accessories & Workshop ERP · Gujrat, Pakistan', margin + 29, 25);
  doc.text('Authorized Workshop POS & Goods Dispatch Ledger', margin + 29, 30);

  // Invoice Number Badge in Header
  doc.setFillColor(44, 49, 54);
  doc.roundedRect(pageWidth - margin - 52, 14, 46, 18, 2, 2, 'F');
  doc.setTextColor(245, 183, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`INVOICE #${transaction.id}`, pageWidth - margin - 49, 21);
  doc.setTextColor(233, 231, 226);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`DATE: ${transaction.date}`, pageWidth - margin - 49, 28);

  // 3. Metadata Grid
  let y = 43;
  doc.setFillColor(245, 245, 247);
  doc.roundedRect(margin, y, contentWidth, 25, 2, 2, 'F');
  doc.setDrawColor(220, 223, 227);
  doc.roundedRect(margin, y, contentWidth, 25, 2, 2, 'S');

  // Customer column
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 120);
  doc.setFont('helvetica', 'bold');
  doc.text('BILLED CUSTOMER / FACTORY:', margin + 4, y + 6);
  doc.setFontSize(10);
  doc.setTextColor(34, 38, 42);
  doc.text(transaction.factory || 'Walk-in Counter Customer', margin + 4, y + 13);

  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 120);
  doc.text(`Time: ${transaction.time || '--:--'}  |  Order Status: ${transaction.confirmed ? 'Confirmed' : 'Pending'}`, margin + 4, y + 20);

  // Status column
  const statusX = pageWidth - margin - 60;
  doc.setFontSize(7.5);
  doc.text('PAYMENT STATUS:', statusX, y + 6);

  if (isPaid) {
    doc.setFillColor(76, 154, 90); // Green
    doc.setTextColor(255, 255, 255);
  } else if (isPartial) {
    doc.setFillColor(245, 183, 0); // Yellow/Amber
    doc.setTextColor(28, 31, 34);
  } else {
    doc.setFillColor(209, 67, 67); // Red
    doc.setTextColor(255, 255, 255);
  }
  doc.roundedRect(statusX, y + 8, 54, 8, 1.5, 1.5, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(statusLabel, statusX + 4, y + 13.5);

  doc.setTextColor(107, 114, 120);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Payment Method: ${transaction.method || 'Standard Account'}`, statusX, y + 21);

  // 4. Line Items Table Header
  y = 75;
  doc.setFillColor(44, 49, 54);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setTextColor(245, 183, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');

  const colX = {
    num: margin + 4,
    name: margin + 14,
    size: margin + 85,
    color: margin + 105,
    qty: margin + 125,
    rate: margin + 143,
    total: margin + 163
  };

  doc.text('#', colX.num, y + 5.5);
  doc.text('PRODUCT SPECIFICATION', colX.name, y + 5.5);
  doc.text('SIZE', colX.size, y + 5.5);
  doc.text('COLOR', colX.color, y + 5.5);
  doc.text('QTY', colX.qty, y + 5.5);
  doc.text('RATE (RS)', colX.rate, y + 5.5);
  doc.text('TOTAL (RS)', colX.total, y + 5.5);

  // 5. Line Items Rows
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(34, 38, 42);

  items.forEach((item, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(248, 249, 250);
      doc.rect(margin, y, contentWidth, 7, 'F');
    }
    doc.setDrawColor(230, 233, 236);
    doc.line(margin, y + 7, margin + contentWidth, y + 7);

    doc.text(String(index + 1), colX.num, y + 5);
    doc.text(String(item.name).slice(0, 36), colX.name, y + 5);
    doc.text(String(item.size || '-').slice(0, 10), colX.size, y + 5);
    doc.text(String(item.color || '-').slice(0, 10), colX.color, y + 5);
    doc.text(String(item.qty), colX.qty, y + 5);
    doc.text(fmt(item.rate), colX.rate, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(item.total), colX.total, y + 5);
    doc.setFont('helvetica', 'normal');

    y += 7.5;
  });

  // 6. Summary & Financial Totals Box
  y += 4;
  const summaryWidth = 75;
  const summaryX = pageWidth - margin - summaryWidth;

  doc.setFillColor(245, 245, 247);
  doc.roundedRect(summaryX, y, summaryWidth, 34, 2, 2, 'F');
  doc.setDrawColor(220, 223, 227);
  doc.roundedRect(summaryX, y, summaryWidth, 34, 2, 2, 'S');

  doc.setFontSize(8);
  doc.setTextColor(107, 114, 120);
  doc.text('Order Gross Total:', summaryX + 4, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 38, 42);
  doc.text(fmt(transaction.total), summaryX + summaryWidth - 4, y + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 120);
  doc.text('Amount Received:', summaryX + 4, y + 15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(76, 154, 90);
  doc.text(fmt(totalPaid), summaryX + summaryWidth - 4, y + 15, { align: 'right' });

  doc.setDrawColor(200, 203, 207);
  doc.line(summaryX + 4, y + 19, summaryX + summaryWidth - 4, y + 19);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(dueAmount > 0 ? 209 : 76, dueAmount > 0 ? 67 : 154, dueAmount > 0 ? 67 : 90);
  doc.setFontSize(9);
  doc.text('Balance Due:', summaryX + 4, y + 27);
  doc.text(fmt(dueAmount), summaryX + summaryWidth - 4, y + 27, { align: 'right' });

  // Amount in words (Left side of summary)
  const wordsWidth = summaryX - margin - 6;
  doc.setFillColor(252, 252, 253);
  doc.roundedRect(margin, y, wordsWidth, 34, 2, 2, 'F');
  doc.setDrawColor(220, 223, 227);
  doc.roundedRect(margin, y, wordsWidth, 34, 2, 2, 'S');

  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 120);
  doc.setFont('helvetica', 'bold');
  doc.text('AMOUNT IN WORDS (ENGLISH):', margin + 4, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(34, 38, 42);
  doc.setFontSize(8);
  const enWords = doc.splitTextToSize(amountInWordsEnglish(transaction.total), wordsWidth - 8);
  doc.text(enWords, margin + 4, y + 13);

  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 120);
  doc.setFont('helvetica', 'bold');
  doc.text('AMOUNT IN WORDS (URDU):', margin + 4, y + 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(amountInWordsUrdu(transaction.total), margin + 4, y + 29);

  // 7. Payment History Log (if any)
  y += 40;
  if (relevantPayments.length > 0 && y < pageHeight - 55) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 38, 42);
    doc.text('RECORDED CUSTOMER PAYMENTS:', margin, y);
    y += 4;

    relevantPayments.slice(0, 3).forEach(p => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(107, 114, 120);
      doc.text(`• ${p.date} (${p.time}) - ${p.method}: ${fmt(p.amount)} [${p.detail || 'Received'}]`, margin + 2, y);
      y += 5;
    });
    y += 2;
  }

  // 8. Signatures and Verification Footer
  const footerY = pageHeight - 38;
  doc.setDrawColor(220, 223, 227);
  doc.line(margin, footerY, margin + contentWidth, footerY);

  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 120);
  doc.setFont('helvetica', 'normal');

  // Signature lines
  const sigWidth = 45;
  doc.line(margin + 6, footerY + 18, margin + 6 + sigWidth, footerY + 18);
  doc.text('Prepared By (Operator)', margin + 10, footerY + 22);

  doc.line(pageWidth / 2 - sigWidth / 2, footerY + 18, pageWidth / 2 + sigWidth / 2, footerY + 18);
  doc.text('Factory Quality & Dispatch', pageWidth / 2 - 20, footerY + 22);

  doc.line(pageWidth - margin - 6 - sigWidth, footerY + 18, pageWidth - margin - 6, footerY + 18);
  doc.text('Customer Receiver Signature', pageWidth - margin - 6 - sigWidth + 4, footerY + 22);

  // Bottom Notice
  doc.setFillColor(28, 31, 34);
  doc.rect(0, pageHeight - 7, pageWidth, 7, 'F');
  doc.setTextColor(245, 183, 0);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('FALCON ROD MAKER · COMPUTER GENERATED DISPATCH INVOICE · GUJRAT, PUNJAB', pageWidth / 2, pageHeight - 2.5, { align: 'center' });

  // Save the PDF
  const filename = `Invoice_${transaction.id}_${(transaction.factory || 'Order').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const pdfBlob = doc.output('blob');
  const pdfDataUrl = doc.output('datauristring');

  triggerUniversalDownload({
    fileName: filename,
    content: pdfBlob,
    dataUrl: pdfDataUrl,
    mimeType: 'application/pdf',
    format: 'pdf',
    title: `Invoice #${transaction.id}`
  });

  recordExport({
    title: `Invoice #${transaction.id} — ${transaction.factory || 'Walk-in'} (PDF)`,
    category: 'invoice',
    format: 'pdf',
    fileName: filename,
    fileSize: '~140 KB',
    dataUrl: pdfDataUrl,
    description: `Official PDF invoice for ${transaction.factory || 'Walk-in customer'}. Total: ${fmt(transaction.total)}.`,
    recordCount: items.length,
    totalAmount: transaction.total,
    customerName: transaction.factory || 'Walk-in'
  });
}

/**
 * Renders the transaction using the exact CSS layout and triggers print / Save as PDF.
 * Leveraging current CSS styles, colors, typography, hazard bar, and print-media rules.
 */
export function printStyledTransactionDocument({
  transaction,
  customerPayments,
  companyName = 'Falcon Rod Maker',
  companyTagline = 'Precision Fan Rod Manufacturing ERP · Gujrat, Pakistan',
  pageSetup
}: ExportTransactionPdfOptions) {
  const effectiveSetup = { ...getEffectivePageSetup(), ...pageSetup };
  const styles = calculatePrintPageStyles(effectiveSetup);
  const spec = PAPER_SIZE_SPECS[effectiveSetup.paperSize] || PAPER_SIZE_SPECS.a4;
  const isLandscape = styles.effectiveOrientation === 'landscape';

  const relevantPayments = customerPayments.filter(p => p.txnId === transaction.id);
  const paymentsSum = relevantPayments.reduce((s, p) => s + p.amount, 0);
  const totalPaid = paymentsSum + (transaction.paid ? transaction.total : 0);
  const dueAmount = Math.max(0, transaction.total - totalPaid);
  const isPaid = dueAmount <= 0;
  const isPartial = totalPaid > 0 && dueAmount > 0;
  const statusLabel = isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID';

  const items = parseTransactionItems(transaction);
  const enWords = amountInWordsEnglish(transaction.total);
  const urWords = amountInWordsUrdu(transaction.total);

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice #${transaction.id} - ${transaction.factory || 'Order'} (${spec.name} ${styles.effectiveOrientation.toUpperCase()})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;700&family=Oswald:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    ${styles.pageRuleCss}
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0 auto;
      padding: ${styles.marginCss === '0' ? '4px' : '14px'};
      width: ${styles.bodyWidthCss};
      max-width: 100%;
      font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1C1F22;
      background: #FFFFFF;
      font-size: ${isLandscape ? '11.5px' : '12px'};
      line-height: 1.4;
      ${effectiveSetup.scale && effectiveSetup.scale !== 100 ? `zoom: ${effectiveSetup.scale / 100};` : ''}
      ${effectiveSetup.colorMode === 'monochrome' ? 'filter: grayscale(100%) contrast(125%);' : ''}
    }
    .hazard-strip {
      height: 6px;
      width: 100%;
      background: repeating-linear-gradient(135deg, #F5B700 0 14px, #1C1F22 14px 28px);
      margin-bottom: 12px;
      border-radius: 2px;
    }
    .header-card {
      background: #1C1F22;
      color: #E9E7E2;
      padding: ${isLandscape ? '14px 20px' : '18px 22px'};
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .brand-title {
      font-family: 'Oswald', sans-serif;
      font-size: ${isLandscape ? '22px' : '24px'};
      font-weight: 700;
      letter-spacing: 1px;
      color: #F5B700;
      margin: 0;
      text-transform: uppercase;
    }
    .brand-sub {
      color: #9AA0A6;
      font-size: 11px;
      margin-top: 3px;
      font-family: 'IBM Plex Mono', monospace;
    }
    .badge-invoice {
      background: #2C3136;
      border: 1px solid #4A5257;
      padding: 8px 16px;
      border-radius: 6px;
      text-align: right;
    }
    .badge-invoice .inv-num {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 16px;
      font-weight: 700;
      color: #F5B700;
    }
    .badge-invoice .inv-date {
      font-size: 10px;
      color: #9AA0A6;
      margin-top: 2px;
      font-family: 'IBM Plex Mono', monospace;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: ${isLandscape ? '1.4fr 1fr 1fr' : '1.5fr 1fr'};
      gap: 12px;
      margin-bottom: 14px;
    }
    .info-card {
      background: #F7F5F0;
      border: 1px solid #DCDFE3;
      padding: ${isLandscape ? '10px 14px' : '12px 16px'};
      border-radius: 6px;
    }
    .info-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #6B7278;
      font-family: 'IBM Plex Mono', monospace;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .info-val-strong {
      font-size: 14px;
      font-weight: 700;
      color: #22262A;
    }
    .status-pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .status-paid {
      background: #E8F5E9;
      color: #2E7D32;
      border: 1px solid #A5D6A7;
    }
    .status-partial {
      background: #FFF8E1;
      color: #F57F17;
      border: 1px solid #FFE082;
    }
    .status-unpaid {
      background: #FFEBEE;
      color: #C62828;
      border: 1px solid #FFCDD2;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-family: 'IBM Plex Mono', monospace;
      font-size: ${isLandscape ? '11px' : '11.5px'};
    }
    table.items-table th {
      background: #2C3136;
      color: #F5B700;
      text-align: left;
      padding: ${isLandscape ? '7px 10px' : '9px 10px'};
      font-size: 10px;
      text-transform: uppercase;
      border: 1px solid #3A4045;
    }
    table.items-table td {
      padding: ${isLandscape ? '7px 10px' : '9px 10px'};
      border: 1px solid #DCDFE3;
      color: #22262A;
    }
    table.items-table tr:nth-child(even) td {
      background: #FAF9F6;
    }
    .num-col {
      text-align: right;
    }
    .tag-pill {
      display: inline-block;
      padding: 2px 6px;
      background: #ECEFF1;
      border-radius: 3px;
      font-size: 10px;
      color: #455A64;
      margin-left: 4px;
    }
    .bottom-section {
      display: grid;
      grid-template-columns: ${isLandscape ? '1.2fr 1fr' : '1.4fr 1fr'};
      gap: 12px;
      margin-bottom: 16px;
    }
    .totals-table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
    }
    .totals-table td {
      padding: ${isLandscape ? '5px 8px' : '6px 10px'};
    }
    .totals-table tr.grand-total td {
      border-top: 2px solid #1C1F22;
      font-size: 14px;
      font-weight: 700;
      color: #DFA000;
      padding-top: 8px;
    }
    .urdu-text {
      font-family: 'Noto Nastaliq Urdu', serif;
      font-size: 13px;
      line-height: 1.8;
      direction: rtl;
      color: #22262A;
      margin-top: 4px;
    }
    .signatures-block {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      margin-top: ${isLandscape ? '20px' : '36px'};
      text-align: center;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 10px;
      color: #6B7278;
    }
    .sig-line {
      border-top: 1px dashed #9AA0A6;
      padding-top: 6px;
      margin-top: ${isLandscape ? '24px' : '40px'};
      font-weight: 600;
    }
    .footer-bar {
      margin-top: 18px;
      padding: 6px;
      background: #1C1F22;
      color: #F5B700;
      text-align: center;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 10px;
      letter-spacing: 0.5px;
      border-radius: 4px;
    }
    .page-setup-stamp {
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      color: #777;
      margin-bottom: 6px;
      font-family: 'IBM Plex Mono', monospace;
    }
  </style>
</head>
<body>
  <!-- Header Page Setup Stamp -->
  <div class="page-setup-stamp">
    <span>FORMAT: ${spec.name.toUpperCase()} · ${styles.effectiveOrientation.toUpperCase()} · MARGINS: ${effectiveSetup.margins.toUpperCase()}</span>
    ${effectiveSetup.includeTimestamp ? `<span>PRINTED: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString()}</span>` : ''}
    ${effectiveSetup.includePageNumbers ? `<span>PAGE 1 OF 1</span>` : ''}
  </div>

  <div class="hazard-strip"></div>

  <!-- Header -->
  <div class="header-card">
    <div style="display: flex; align-items: center; gap: 14px;">
      ${effectiveSetup.includeLogo ? `
      <img src="/falcon-theme-rod-logo.svg" alt="Falcon Logo" style="height: ${isLandscape ? '44px' : '52px'}; width: auto; object-fit: contain;" />
      ` : ''}
      <div>
        <h1 class="brand-title">${companyName}</h1>
        <div class="brand-sub">${companyTagline}</div>
      </div>
    </div>
    <div class="badge-invoice">
      <div class="inv-num">INVOICE #${transaction.id}</div>
      <div class="inv-date">DATE: ${transaction.date}</div>
    </div>
  </div>

  <!-- Meta Information -->
  <div class="meta-grid">
    <div class="info-card">
      <div class="info-label">Customer / Factory Account</div>
      <div class="info-val-strong">${transaction.factory || 'Walk-in Cash Customer'}</div>
      <div style="color: #6B7278; margin-top: 4px; font-size: 11px;">
        Account Type: Industrial Buyer · Gujrat Division
      </div>
    </div>
    <div class="info-card">
      <div class="info-label">Payment Status</div>
      <div>
        <span class="status-pill ${
          isPaid ? 'status-paid' : isPartial ? 'status-partial' : 'status-unpaid'
        }">
          ${statusLabel}
        </span>
      </div>
      <div style="color: #6B7278; margin-top: 6px; font-size: 10px; font-family: 'IBM Plex Mono', monospace;">
        Method: ${transaction.method || 'CASH'}
      </div>
    </div>
    ${isLandscape ? `
    <div class="info-card">
      <div class="info-label">Order Items Overview</div>
      <div class="info-val-strong">${items.length} Product Line(s)</div>
      <div style="color: #6B7278; margin-top: 4px; font-size: 10px; font-family: 'IBM Plex Mono', monospace;">
        Total Quantity: ${items.reduce((s, i) => s + (i.qty || 1), 0)} Pieces
      </div>
    </div>
    ` : ''}
  </div>

  <!-- Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 35px;">#</th>
        <th>Product Description</th>
        <th>Size</th>
        <th>Color</th>
        <th class="num-col" style="width: 60px;">Qty</th>
        <th class="num-col" style="width: 90px;">Rate (Rs)</th>
        <th class="num-col" style="width: 100px;">Amount (Rs)</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>
            <strong>${item.name}</strong>
          </td>
          <td>${item.size || '-'}</td>
          <td>${item.color || '-'}</td>
          <td class="num-col"><strong>${item.qty}</strong></td>
          <td class="num-col">${fmt(item.rate)}</td>
          <td class="num-col"><strong>${fmt(item.total)}</strong></td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <!-- Bottom Section: Words & Totals -->
  <div class="bottom-section">
    <div class="info-card">
      <div class="info-label">Amount in Words</div>
      <div style="font-weight: 600; color: #22262A; margin-top: 4px; font-size: 11px;">
        ${enWords}
      </div>
      ${effectiveSetup.includeUrduAmount ? `
      <div class="urdu-text">
        ${urWords}
      </div>
      ` : ''}

      ${
        relevantPayments.length > 0
          ? `
        <div style="margin-top: 10px; border-top: 1px solid #DCDFE3; padding-top: 8px;">
          <div class="info-label">Payment Record</div>
          ${relevantPayments
            .map(
              p => `
            <div style="font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #4A5257;">
              • ${p.date} (${p.time}) : <strong>${fmt(p.amount)}</strong> via ${p.method}
            </div>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }
    </div>

    <div class="info-card">
      <table class="totals-table">
        <tr>
          <td style="color: #6B7278;">Subtotal Amount:</td>
          <td class="num-col"><strong>${fmt(transaction.total)}</strong></td>
        </tr>
        <tr>
          <td style="color: #6B7278;">Total Paid:</td>
          <td class="num-col" style="color: #2E7D32;"><strong>${fmt(totalPaid)}</strong></td>
        </tr>
        <tr class="grand-total">
          <td>Balance Due:</td>
          <td class="num-col" style="color: ${dueAmount > 0 ? '#C62828' : '#2E7D32'};">
            ${fmt(dueAmount)}
          </td>
        </tr>
      </table>
    </div>
  </div>

  <!-- Signatures -->
  ${effectiveSetup.includeSignatures ? `
  <div class="signatures-block">
    <div>
      <div class="sig-line">Prepared By (Counter Terminal)</div>
    </div>
    <div>
      <div class="sig-line">Dispatch Officer & Quality Seal</div>
    </div>
    <div>
      <div class="sig-line">Customer Signature / Receiver</div>
    </div>
  </div>
  ` : ''}

  <!-- Footer Bar -->
  <div class="footer-bar">
    ${effectiveSetup.footerNote || 'FALCON ROD MAKER · POS & ERP SYSTEM · INDUSTRIAL GRADE FAN ACCESSORIES · GUJRAT, PUNJAB'}
  </div>

  <!-- Mobile Action Header -->
  <div class="no-print print-header-bar" style="position: sticky; top: 0; left: 0; right: 0; background: #0f172a; color: #fff; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: sans-serif; gap: 8px;">
    <span style="font-weight: bold; font-size: 13px; color: #fbbf24;">🦅 Falcon Rod Maker · Invoice #${transaction.id}</span>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" style="background: #f59e0b; color: #000; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer;">🖨 Print / Save PDF</button>
      <button onclick="window.close()" style="background: #334155; color: #fff; border: none; padding: 8px 12px; border-radius: 6px; font-size: 13px; cursor: pointer;">✕ Close</button>
    </div>
  </div>

  <style>
    @media print {
      .no-print, .print-header-bar { display: none !important; }
    }
  </style>

  <script>
    window.onload = function() {
      setTimeout(function() {
        try {
          window.print();
        } catch (_) {}
      }, 400);
    };
  </script>
</body>
</html>
  `;

  const isMobile = typeof navigator !== 'undefined' && (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && window.innerWidth < 1024)
  );

  if (isMobile) {
    // 1. Automatically trigger the PDF download so the file is saved directly to mobile Downloads
    try {
      exportSingleTransactionPDF({
        transaction,
        customerPayments,
        companyName,
        companyTagline,
        pageSetup
      });
    } catch (_) {}

    // 2. Open printable tab where mobile Chrome allows window.print()
    try {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(htmlContent);
        printWin.document.close();
      }
    } catch (_) {}
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) return;

  doc.open();
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch (_) {}
  }, 60000);
}

/**
 * Triggers a browser print-friendly layout for an individual transaction,
 * specially optimized for 80mm / 58mm thermal receipt roll printers.
 */
export function printThermalReceiptDocument(options: ExportTransactionPdfOptions) {
  const {
    transaction,
    customerPayments,
    companyName = 'Falcon Rod Maker',
    companyTagline = 'Precision Fan Rod Manufacturing · Gujrat',
    pageSetup
  } = options;

  const effectiveSetup = { ...getEffectivePageSetup(), ...pageSetup };
  const is58mm = effectiveSetup.paperSize === '58mm';
  const rollWidth = is58mm ? '58mm' : '80mm';
  const bodyWidth = is58mm ? '54mm' : '76mm';

  const relevantPayments = customerPayments.filter((p: CustomerPayment) => p.txnId === transaction.id);
  const paymentsSum = relevantPayments.reduce((s: number, p: CustomerPayment) => s + p.amount, 0);
  const totalPaid = paymentsSum + (transaction.paid ? transaction.total : 0);
  const dueAmount = Math.max(0, transaction.total - totalPaid);
  const isPaid = dueAmount <= 0;
  const isPartial = totalPaid > 0 && dueAmount > 0;
  const items = parseTransactionItems(transaction);

  const totalQty = items.reduce((acc: number, i) => acc + (i.qty || 1), 0);
  const amountWordsEn = amountInWordsEnglish(transaction.total);
  const amountWordsUr = amountInWordsUrdu(transaction.total);

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt #${transaction.id} - ${companyName} (${rollWidth})</title>
  <style>
    @page {
      size: ${rollWidth} auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      width: ${bodyWidth};
      max-width: ${rollWidth};
      margin: 0 auto;
      padding: 6px 4px 18px 4px;
      font-family: 'Courier New', Courier, monospace, monospace;
      font-size: ${is58mm ? '10px' : '11px'};
      line-height: 1.25;
      color: #000;
      background: #FFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      ${effectiveSetup.scale && effectiveSetup.scale !== 100 ? `zoom: ${effectiveSetup.scale / 100};` : ''}
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: bold; }
    
    .title-large {
      font-size: 15px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .sub-title {
      font-size: 9px;
      font-weight: bold;
      margin-bottom: 2px;
    }
    .badge-bar {
      font-size: 10px;
      font-weight: 900;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 3px 0;
      margin: 4px 0;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 5px;
      font-size: 10px;
    }
    .meta-table td {
      padding: 1px 0;
      vertical-align: top;
    }
    .divider-dash {
      border-bottom: 1px dashed #000;
      margin: 4px 0;
    }
    .divider-double {
      border-bottom: 2px solid #000;
      margin: 5px 0;
    }
    .divider-solid {
      border-bottom: 1px solid #000;
      margin: 4px 0;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin: 4px 0;
    }
    .items-table th {
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      padding: 3px 0;
      font-weight: bold;
      font-size: 10px;
    }
    .items-table td {
      padding: 2.5px 0;
      vertical-align: top;
    }
    .item-desc {
      font-weight: bold;
      padding-top: 2px;
    }
    .item-sub {
      font-size: 9px;
      color: #222;
      padding-left: 2px;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-top: 4px;
    }
    .summary-table td {
      padding: 2px 0;
    }
    .grand-row {
      font-size: 13px;
      font-weight: 900;
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      padding: 4px 0;
    }
    .words-box {
      border: 1px dashed #000;
      padding: 4px;
      margin: 6px 0;
      font-size: 9px;
      line-height: 1.3;
    }
    .payments-box {
      font-size: 9.5px;
      margin-top: 4px;
      border-top: 1px dotted #000;
      padding-top: 4px;
    }
    .barcode-mock {
      letter-spacing: 3px;
      font-size: 11px;
      font-weight: bold;
      margin: 6px 0 2px 0;
    }
    .footer-note {
      font-size: 8.5px;
      margin-top: 8px;
      line-height: 1.25;
    }
    .cut-line {
      margin-top: 12px;
      border-top: 1px dashed #777;
      text-align: center;
      font-size: 8px;
      padding-top: 2px;
    }
    @media print {
      body {
        width: 100%;
        margin: 0;
        padding: 2mm 1mm 8mm 1mm;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <!-- Thermal Header -->
  <div class="text-center">
    <img src="/falcon-theme-rod-logo.svg" alt="Falcon Rod Maker" style="max-height: 48px; max-width: 140px; margin: 0 auto 5px auto; display: block;" />
    <div class="title-large" style="font-size: 15px; font-weight: 900; text-transform: uppercase; margin-bottom: 2px;">${companyName}</div>
    <div class="sub-title">${companyTagline}</div>
    <div class="sub-title">Small Industrial Estate, Gujrat</div>
    <div class="sub-title">Ph: 0300-6268884 · 0321-7299990</div>
    <div class="badge-bar">
      *** SALE MEMO & DISPATCH RECEIPT ***
    </div>
  </div>

  <!-- Meta Info -->
  <table class="meta-table">
    <tr>
      <td class="bold" style="width: 50%;">INV #: ${transaction.id}</td>
      <td class="text-right bold" style="width: 50%;">DATE: ${transaction.date}</td>
    </tr>
    <tr>
      <td>TIME: ${transaction.time || '00:00'}</td>
      <td class="text-right">TERM: ${transaction.device || 'Counter 1'}</td>
    </tr>
    <tr>
      <td colspan="2" class="bold" style="padding-top: 3px;">
        CLIENT: ${transaction.factory || 'Walk-in Cash Order'}
      </td>
    </tr>
    <tr>
      <td colspan="2">
        STATUS: <strong>${isPaid ? 'PAID IN FULL [✓]' : isPartial ? 'PARTIALLY PAID [~]' : 'UNPAID / CREDIT [!]'}</strong>
      </td>
    </tr>
  </table>

  <!-- Items Table Header -->
  <table class="items-table">
    <thead>
      <tr>
        <th class="text-left" style="width: 50%;">ITEM</th>
        <th class="text-center" style="width: 15%;">QTY</th>
        <th class="text-right" style="width: 15%;">RATE</th>
        <th class="text-right" style="width: 20%;">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((it, idx) => `
        <tr>
          <td colspan="4" class="item-desc">${idx + 1}. ${it.name}</td>
        </tr>
        <tr>
          <td class="item-sub">
            ${[it.size ? 'Sz: ' + it.size : '', it.color ? 'Clr: ' + it.color : ''].filter(Boolean).join(' | ') || '-'}
          </td>
          <td class="text-center bold">${it.qty}</td>
          <td class="text-right">${fmt(it.rate)}</td>
          <td class="text-right bold">${fmt(it.total)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="divider-dash"></div>

  <!-- Summary Totals -->
  <table class="summary-table">
    <tr>
      <td>TOTAL ITEMS / QTY:</td>
      <td class="text-right bold">${items.length} items (${totalQty} pcs)</td>
    </tr>
    <tr>
      <td>SUBTOTAL AMOUNT:</td>
      <td class="text-right bold">${fmt(transaction.total)}</td>
    </tr>
    <tr class="grand-row">
      <td class="bold">NET PAYABLE:</td>
      <td class="text-right bold">${fmt(transaction.total)}</td>
    </tr>
    <tr>
      <td>AMOUNT RECEIVED:</td>
      <td class="text-right bold">${fmt(totalPaid)}</td>
    </tr>
    <tr style="font-size: 11.5px; font-weight: bold;">
      <td>BALANCE DUE:</td>
      <td class="text-right ${dueAmount > 0 ? 'bold' : ''}">
        ${dueAmount > 0 ? fmt(dueAmount) + ' (DUE)' : 'Rs 0 (NIL)'}
      </td>
    </tr>
  </table>

  <!-- Amount in Words -->
  <div class="words-box">
    <div><strong>In Words:</strong> ${amountWordsEn}</div>
    <div style="direction: rtl; text-align: right; margin-top: 2px;"><strong>حساب:</strong> ${amountWordsUr}</div>
  </div>

  ${relevantPayments.length > 0 ? `
  <div class="payments-box">
    <div class="bold" style="margin-bottom: 2px;">PAYMENT RECEIPTS LOG:</div>
    ${relevantPayments.map((p: CustomerPayment) => `
      <div style="display: flex; justify-content: space-between;">
        <span>• ${p.date} (${p.method}):</span>
        <span class="bold">${fmt(p.amount)}</span>
      </div>
      ${p.detail ? `<div style="font-size: 8.5px; padding-left: 8px; color: #333;">Ref: ${p.detail}</div>` : ''}
    `).join('')}
  </div>
  ` : ''}

  <div class="divider-dash"></div>

  <!-- Signatures and Barcode -->
  <div style="margin-top: 10px; display: flex; justify-content: space-between; font-size: 9px;">
    <div style="border-top: 1px dashed #000; width: 45%; text-align: center; padding-top: 2px;">
      Operator Sign
    </div>
    <div style="border-top: 1px dashed #000; width: 45%; text-align: center; padding-top: 2px;">
      Customer Sign
    </div>
  </div>

  <div class="text-center" style="margin-top: 10px;">
    <div class="barcode-mock">*FALCON-${transaction.id}*</div>
    <div class="footer-note">
      THANK YOU FOR YOUR BUSINESS!<br/>
      Goods once sold cannot be returned without verified gate pass.<br/>
      FALCON POS SYSTEM v2.4 · INDUSTRIAL ERP
    </div>
  </div>

  <div class="cut-line">
    - - - - - - - - - [ TEAR HERE ] - - - - - - - - -
  </div>

  <!-- Mobile Action Header -->
  <div class="no-print print-header-bar" style="position: sticky; top: 0; left: 0; right: 0; background: #0f172a; color: #fff; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: sans-serif; gap: 8px;">
    <span style="font-weight: bold; font-size: 13px; color: #fbbf24;">🦅 Thermal Receipt #${transaction.id}</span>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" style="background: #f59e0b; color: #000; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer;">🖨 Print Thermal</button>
      <button onclick="window.close()" style="background: #334155; color: #fff; border: none; padding: 8px 12px; border-radius: 6px; font-size: 13px; cursor: pointer;">✕ Close</button>
    </div>
  </div>

  <style>
    @media print {
      .no-print, .print-header-bar { display: none !important; }
    }
  </style>

  <script>
    window.onload = function() {
      setTimeout(function() {
        try {
          window.print();
        } catch (_) {}
      }, 350);
    };
  </script>
</body>
</html>
  `;

  const isMobile = typeof navigator !== 'undefined' && (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && window.innerWidth < 1024)
  );

  if (isMobile) {
    try {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(htmlContent);
        printWin.document.close();
      }
    } catch (_) {}
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) return;

  doc.open();
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch (_) {}
  }, 60000);
}
