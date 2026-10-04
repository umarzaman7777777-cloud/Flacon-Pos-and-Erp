import jsPDF from 'jspdf';
import { FALCON_LOGO_WHITE_BG_PNG } from './logoData';
import { recordExport, exportTableJPG } from './exportManager';
import { ExportDocumentConfig } from '../types';
import { getSavedExportConfig, hexToRgb } from './exportSettingsHelper';
import { triggerUniversalDownload } from './universalDownloader';

export { exportTableJPG };

export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return 'Rs 0';
  return 'Rs ' + Math.round(n).toLocaleString('en-PK');
}

export function escHtml(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoToDMY(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso).trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
}

export function dmyToISO(dmy: string | null | undefined): string {
  if (!dmy) return '';
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(dmy).trim());
  if (!m) return '';
  const pad = (n: string | number) => String(n).padStart(2, '0');
  return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
}

export function formatTime12(t: string | null | undefined): string {
  if (!t) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t).trim());
  if (!m) return String(t);
  let h = parseInt(m[1], 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h %= 12;
  if (h === 0) h = 12;
  return `${h}:${m[2]} ${ampm}`;
}

export function parseDMY(str: string | null | undefined): Date | null {
  if (!str) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(str).trim());
  if (m) {
    return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  }
  const iso = new Date(str + 'T00:00:00');
  return isNaN(iso.getTime()) ? null : iso;
}

const EN_ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const EN_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function enTwoDigits(n: number): string {
  return n < 20 ? EN_ONES[n] : EN_TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + EN_ONES[n % 10] : '');
}

function enThreeDigits(n: number): string {
  return n < 100 ? enTwoDigits(n) : EN_ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + enTwoDigits(n % 100) : '');
}

export function amountInWordsEnglish(amount: number): string {
  let num = Math.round(Math.abs(amount || 0));
  if (num === 0) return 'Rupees Zero Only';
  const crore = Math.floor(num / 1e7);
  num %= 1e7;
  const lakh = Math.floor(num / 1e5);
  num %= 1e5;
  const thousand = Math.floor(num / 1e3);
  const rest = num % 1e3;
  const parts: string[] = [];
  if (crore) parts.push(enThreeDigits(crore) + ' Crore');
  if (lakh) parts.push(enThreeDigits(lakh) + ' Lakh');
  if (thousand) parts.push(enThreeDigits(thousand) + ' Thousand');
  if (rest) parts.push(enThreeDigits(rest));
  return 'Rupees ' + parts.join(' ') + ' Only';
}

/**
 * Standard Fan & Tube Outer Diameter Options (from 1/8" upwards)
 */
export const STANDARD_DIAMETER_OPTIONS: string[] = [
  '1/8"',
  '1/4"',
  '3/8"',
  '1/2"',
  '5/8"',
  '3/4"',
  '7/8"',
  '1"',
  '1-1/8"',
  '1-1/4"',
  '1-3/8"',
  '1-1/2"',
  '1-3/4"',
  '2"',
  '2-1/4"',
  '2-1/2"',
  '3"'
];

/**
 * Converts imperial fractional or decimal diameter strings into numeric inches.
 * e.g., '1/8"' -> 0.125, '1-1/4"' -> 1.25, '3/4"' -> 0.75, '2"' -> 2.0
 */
export function parseDiameterToInches(diaStr: string | null | undefined): number {
  if (!diaStr) return 0.75;
  const clean = diaStr.replace(/"/g, '').trim();
  if (clean.includes('-')) {
    const [whole, frac] = clean.split('-');
    if (frac && frac.includes('/')) {
      const [num, den] = frac.split('/').map(Number);
      return Number(whole) + (den ? num / den : 0);
    }
    return parseFloat(whole) || 0.75;
  }
  if (clean.includes('/')) {
    const [num, den] = clean.split('/').map(Number);
    return den ? num / den : 0.75;
  }
  return parseFloat(clean) || 0.75;
}

/**
 * Formats imperial diameter string into exact millimeters.
 * e.g. '1/8"' -> '3.18', '3/4"' -> '19.05', '1"' -> '25.40'
 */
export function formatDiameterMm(diaStr: string | null | undefined): string {
  const inches = parseDiameterToInches(diaStr);
  return (inches * 25.4).toFixed(2);
}

const UR_UPTO_99 = [
  '', 'ایک', 'دو', 'تین', 'چار', 'پانچ', 'چھ', 'سات', 'آٹھ', 'نو', 'دس',
  'گیارہ', 'بارہ', 'تیرہ', 'چودہ', 'پندرہ', 'سولہ', 'سترہ', 'اٹھارہ', 'انیس', 'بیس',
  'اکیس', 'بائیس', 'تئیس', 'چوبیس', 'پچیس', 'چھبیس', 'ستائیس', 'اٹھاہیس', 'انتیس', 'تیس',
  'اکتیس', 'بتیس', 'تینتیس', 'چونتیس', 'پینتیس', 'چھتیس', 'سینتیس', 'اڑتیس', 'انتالیس', 'چالیس',
  'اکتالیس', 'بیالیس', 'تینتالیس', 'چوالیس', 'پینتالیس', 'چھیالیس', 'سینتالیس', 'اڑتالیس', 'انچاس', 'پچاس',
  'اکاون', 'باون', 'تریپن', 'چون', 'پچپن', 'چھپن', 'ستاون', 'اٹھاون', 'انسٹھ', 'ساٹھ',
  'اکسٹھ', 'باسٹھ', 'تریسٹھ', 'چونسٹھ', 'پینسٹھ', 'چھیاسٹھ', 'سڑسٹھ', 'اڑسٹھ', 'انہتر', 'ستر',
  'اکہتر', 'بہتر', 'تہتر', 'چوہتر', 'پچہتر', 'چھہتر', 'ستتر', 'اٹھہتر', 'اناسی', 'اسی',
  'اکیاسی', 'بیاسی', 'تراسی', 'چوراسی', 'پچاسی', 'چھیاسی', 'ستاسی', 'اٹھاسی', 'نواسی', 'نوے',
  'اکانوے', 'بانوے', 'ترانوے', 'چورانوے', 'پچانوے', 'چھیانوے', 'ستانوے', 'اٹھانوے', 'ننانوے'
];

function urThreeDigits(n: number): string {
  if (n < 100) return UR_UPTO_99[n];
  const h = Math.floor(n / 100);
  const rem = n % 100;
  return UR_UPTO_99[h] + ' سو' + (rem ? ' ' + UR_UPTO_99[rem] : '');
}

export function amountInWordsUrdu(amount: number): string {
  let num = Math.round(Math.abs(amount || 0));
  if (num === 0) return 'روپے صفر فقط';
  const crore = Math.floor(num / 1e7);
  num %= 1e7;
  const lakh = Math.floor(num / 1e5);
  num %= 1e5;
  const thousand = Math.floor(num / 1e3);
  const rest = num % 1e3;
  const parts: string[] = [];
  if (crore) parts.push(urThreeDigits(crore) + ' کروڑ');
  if (lakh) parts.push(urThreeDigits(lakh) + ' لاکھ');
  if (thousand) parts.push(urThreeDigits(thousand) + ' ہزار');
  if (rest) parts.push(urThreeDigits(rest));
  return 'روپے ' + parts.join(' ') + ' فقط';
}

export function csvEscape(val: any): string {
  const s = val === null || val === undefined ? '' : String(val);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][], footer?: string) {
  const lines = [headers.map(csvEscape).join(',')];
  rows.forEach(r => lines.push(r.map(csvEscape).join(',')));
  if (footer) lines.push(footer);
  const csvContent = '\ufeff' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const cleanName = filename.endsWith('.csv') ? filename : filename + '.csv';
  const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;

  triggerUniversalDownload({
    fileName: cleanName,
    content: blob,
    dataUrl,
    mimeType: 'text/csv;charset=utf-8',
    format: 'csv',
    rawContent: csvContent,
    title: cleanName
  });

  recordExport({
    title: `${cleanName.replace(/\.csv$/, '').replace(/_/g, ' ')}`,
    category: 'report',
    format: 'csv',
    fileName: cleanName,
    fileSize: `${Math.round(csvContent.length / 1024) || 1} KB`,
    dataUrl,
    description: `Exported spreadsheet CSV containing ${rows.length} rows and ${headers.length} columns.`,
    recordCount: rows.length
  });
}

export function exportTablePDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  orientation: 'portrait' | 'landscape' = 'landscape',
  companyName: string = 'Falcon Rod Maker',
  subtitle: string = 'Fan Accessories · Gujrat',
  balanceFooterText?: string,
  customConfig?: Partial<ExportDocumentConfig>
) {
  const globalCfg = getSavedExportConfig();
  const cfg: ExportDocumentConfig = {
    ...globalCfg,
    ...customConfig,
    companyName: customConfig?.companyName || companyName || globalCfg.companyName || 'Falcon Rod Maker',
    subtitle: customConfig?.subtitle || subtitle || globalCfg.subtitle || 'Fan Accessories · Gujrat',
    customNote: customConfig?.customNote !== undefined ? customConfig.customNote : balanceFooterText
  };

  const effectiveOrientation = cfg.orientation || orientation || 'landscape';
  let effectiveFormat: string | [number, number] = 'a4';
  if (cfg.paperSize === 'letter') effectiveFormat = 'letter';
  else if (cfg.paperSize === 'legal') effectiveFormat = 'legal';
  else if (cfg.paperSize === 'a5') effectiveFormat = 'a5';
  else if (cfg.paperSize === 'b5') effectiveFormat = 'b5';
  else if (cfg.paperSize === '80mm') effectiveFormat = [80, 220];
  else if (cfg.paperSize === '58mm') effectiveFormat = [58, 180];

  const doc = new jsPDF({
    orientation: effectiveOrientation,
    unit: 'mm',
    format: effectiveFormat
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const isThermal = cfg.paperSize === '80mm' || cfg.paperSize === '58mm';
  const margin = isThermal ? 4 : 12;
  const contentWidth = pageWidth - margin * 2;

  const font = cfg.fontFamily === 'times' ? 'times' : cfg.fontFamily === 'courier' ? 'courier' : 'helvetica';

  const [hBgR, hBgG, hBgB] = hexToRgb(cfg.headerBgColor || '#1c1f22');
  const [hTxtR, hTxtG, hTxtB] = hexToRgb(cfg.headerTextColor || '#f5b700');
  const [hSubR, hSubG, hSubB] = hexToRgb(cfg.headerSubtitleColor || '#cbd5e1');
  const [tblBgR, tblBgG, tblBgB] = hexToRgb(cfg.tableHeaderBgColor || '#2d3748');
  const [tblTxtR, tblTxtG, tblTxtB] = hexToRgb(cfg.tableHeaderTextColor || '#f8fafc');
  const [accR, accG, accB] = hexToRgb(cfg.accentColor || '#f5b700');

  const renderHeader = (isFirstPage: boolean) => {
    let headerHeight = isThermal ? 24 : 30;
    let currentY = 0;

    // Optional Accent / Hazard Bar
    if (cfg.showAccentBar && isFirstPage) {
      doc.setFillColor(accR, accG, accB);
      doc.rect(0, 0, pageWidth, isThermal ? 2.5 : 3.5, 'F');
      currentY = isThermal ? 2.5 : 3.5;
    }

    // Header container
    doc.setFillColor(hBgR, hBgG, hBgB);
    doc.rect(0, currentY, pageWidth, headerHeight, 'F');

    // Logo image
    let textStartX = margin;
    if (cfg.showLogo && isFirstPage) {
      try {
        const logoW = isThermal ? 13 : 18;
        const logoH = isThermal ? 13 : 18;
        doc.addImage(FALCON_LOGO_WHITE_BG_PNG, 'PNG', margin, currentY + 5, logoW, logoH);
        textStartX = margin + logoW + 4;
      } catch (_) {}
    }

    // Title / Company
    doc.setFont(font, 'bold');
    doc.setFontSize(isThermal ? 10 : 14);
    doc.setTextColor(hTxtR, hTxtG, hTxtB);
    doc.text(cfg.companyName || 'Falcon Rod Maker', textStartX, currentY + (isThermal ? 9 : 11));

    // Subtitle
    doc.setFont(font, 'normal');
    doc.setFontSize(isThermal ? 7 : 8.5);
    doc.setTextColor(hSubR, hSubG, hSubB);
    doc.text(cfg.subtitle || 'Fan Accessories · Gujrat', textStartX, currentY + (isThermal ? 14 : 17));

    // Document Title & Date
    const dateStr = cfg.showDate ? `Date: ${new Date().toLocaleDateString('en-GB')}` : '';
    const infoText = `Title: ${title}${dateStr ? '   |   ' + dateStr : ''}`;
    doc.setFontSize(isThermal ? 6.5 : 8);
    doc.text(infoText, textStartX, currentY + (isThermal ? 19 : 23));

    return currentY + headerHeight + (isThermal ? 4 : 8);
  };

  let y = renderHeader(true);
  const colWidth = contentWidth / Math.max(1, headers.length);
  const rowHeight = isThermal ? 5.5 : 6.8;

  // Table header renderer
  const renderTableHeader = () => {
    doc.setFillColor(tblBgR, tblBgG, tblBgB);
    doc.rect(margin, y - 5, contentWidth, isThermal ? 6.5 : 7.5, 'F');
    doc.setTextColor(tblTxtR, tblTxtG, tblTxtB);
    doc.setFont(font, 'bold');
    doc.setFontSize(isThermal ? 6.5 : 8);

    headers.forEach((h, i) => {
      const maxChar = Math.max(8, Math.floor(colWidth / 2.2));
      const txt = String(h).slice(0, maxChar);
      doc.text(txt, margin + 2 + i * colWidth, y);
    });
    y += isThermal ? 5 : 6;
  };

  renderTableHeader();

  // Rows renderer with multi-page handling
  doc.setFont(font, 'normal');
  doc.setFontSize(isThermal ? 6.5 : 7.5);

  rows.forEach((row, rowIndex) => {
    // Check page overflow
    if (y + rowHeight > pageHeight - (cfg.showSignatureLine ? 30 : 15)) {
      doc.addPage(effectiveFormat, effectiveOrientation);
      y = renderHeader(false);
      renderTableHeader();
      doc.setFont(font, 'normal');
      doc.setFontSize(isThermal ? 6.5 : 7.5);
    }

    if (cfg.showStripedRows && rowIndex % 2 === 1) {
      doc.setFillColor(245, 245, 247);
      doc.rect(margin, y - 4, contentWidth, rowHeight, 'F');
    }

    if (cfg.showBorders) {
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y - 4, contentWidth, rowHeight);
    }

    doc.setTextColor(30, 41, 59);
    row.forEach((cell, i) => {
      const maxChar = Math.max(10, Math.floor(colWidth / 1.9));
      const txt = String(cell ?? '').replace(/\n/g, ' ').slice(0, maxChar);
      doc.text(txt, margin + 2 + i * colWidth, y);
    });
    y += rowHeight;
  });

  // Balance / Custom Note Footer
  const noteToRender = cfg.customNote || balanceFooterText;
  if (noteToRender) {
    if (y + 12 > pageHeight - 15) {
      doc.addPage(effectiveFormat, effectiveOrientation);
      y = 15;
    }
    y += isThermal ? 4 : 6;
    doc.setFont(font, 'bold');
    doc.setFontSize(isThermal ? 7.5 : 9);
    doc.setTextColor(hBgR, hBgG, hBgB);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 4.5, contentWidth, 8, 'F');
    doc.text(noteToRender, margin + 3, y);
    y += 8;
  }

  // Optional Authorized Signature Line
  if (cfg.showSignatureLine) {
    if (y + 22 > pageHeight - 10) {
      doc.addPage(effectiveFormat, effectiveOrientation);
      y = 15;
    }
    y += 10;
    doc.setDrawColor(148, 163, 184);
    doc.line(pageWidth - margin - 50, y, pageWidth - margin, y);
    doc.setFont(font, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Authorized Signature & Stamp', pageWidth - margin - 48, y + 4);
  }

  const cleanPdfName = filename.endsWith('.pdf') ? filename : filename + '.pdf';
  const pdfBlob = doc.output('blob');
  const pdfDataUrl = doc.output('datauristring');

  triggerUniversalDownload({
    fileName: cleanPdfName,
    content: pdfBlob,
    dataUrl: pdfDataUrl,
    mimeType: 'application/pdf',
    format: 'pdf',
    title: `${title} Report`
  });

  recordExport({
    title: `${title} Report (PDF)`,
    category: 'report',
    format: 'pdf',
    fileName: cleanPdfName,
    fileSize: `~${Math.max(60, Math.round(rows.length * 2.5))} KB`,
    dataUrl: pdfDataUrl,
    description: `Exported customized PDF document for ${title} (${rows.length} records, ${cfg.paperSize.toUpperCase()} ${effectiveOrientation}).`,
    recordCount: rows.length
  });
}


export function downloadJSON(data: any, filename: string) {
  const jsonStr = JSON.stringify(data, null, 2);
  const cleanJsonName = filename.endsWith('.json') ? filename : `${filename}.json`;
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(jsonStr)}`;

  triggerUniversalDownload({
    fileName: cleanJsonName,
    content: blob,
    dataUrl,
    mimeType: 'application/json',
    format: 'json',
    rawContent: jsonStr
  });
}

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
