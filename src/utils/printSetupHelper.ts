import {
  PrintPageSetup,
  PrinterPaperSize,
  PrintOrientation,
  PrintMargins,
  PrintColorMode
} from '../types';

export interface PaperSizeSpec {
  id: PrinterPaperSize;
  name: string;
  urduName: string;
  dimensions: string;
  widthMm: number;
  heightMm: number;
  category: 'sheet' | 'roll' | 'label';
  description: string;
}

export const PAPER_SIZE_SPECS: Record<PrinterPaperSize, PaperSizeSpec> = {
  a4: {
    id: 'a4',
    name: 'A4 Standard Sheet',
    urduName: 'اے فور شیٹ (معیاری)',
    dimensions: '210 × 297 mm (8.27 × 11.69 in)',
    widthMm: 210,
    heightMm: 297,
    category: 'sheet',
    description: 'Standard office & factory invoice sheet'
  },
  letter: {
    id: 'letter',
    name: 'US Letter',
    urduName: 'یو ایس لیٹر شیٹ',
    dimensions: '215.9 × 279.4 mm (8.5 × 11 in)',
    widthMm: 215.9,
    heightMm: 279.4,
    category: 'sheet',
    description: 'Standard desktop laser printer page'
  },
  legal: {
    id: 'legal',
    name: 'US Legal Sheet',
    urduName: 'لیگل پیپر (لمبا فارمیٹ)',
    dimensions: '215.9 × 355.6 mm (8.5 × 14 in)',
    widthMm: 215.9,
    heightMm: 355.6,
    category: 'sheet',
    description: 'Extended height for long orders and multi-item ledgers'
  },
  a5: {
    id: 'a5',
    name: 'A5 Half Sheet',
    urduName: 'اے فائیو (ہاف سائز پرچی)',
    dimensions: '148 × 210 mm (5.83 × 8.27 in)',
    widthMm: 148,
    heightMm: 210,
    category: 'sheet',
    description: 'Counter delivery challans, gate passes & bills'
  },
  b5: {
    id: 'b5',
    name: 'B5 Compact Sheet',
    urduName: 'بی فائیو کمپیکٹ',
    dimensions: '176 × 250 mm (6.93 × 9.84 in)',
    widthMm: 176,
    heightMm: 250,
    category: 'sheet',
    description: 'Mid-sized billing receipts'
  },
  '80mm': {
    id: '80mm',
    name: '80mm Thermal Roll (3-Inch)',
    urduName: 'تھری انچ تھرمل رول (۸۰ ایم ایم)',
    dimensions: '72-80mm width × Continuous Auto-Roll',
    widthMm: 80,
    heightMm: 0,
    category: 'roll',
    description: 'Shop counter thermal POS receipt printer'
  },
  '58mm': {
    id: '58mm',
    name: '58mm Mobile Thermal (2-Inch)',
    urduName: 'ٹو انچ موبائل تھرمل رول (۵۸ ایم ایم)',
    dimensions: '48-58mm width × Continuous Auto-Roll',
    widthMm: 58,
    heightMm: 0,
    category: 'roll',
    description: 'Portable Bluetooth belt printer (PT-210, POS-58)'
  },
  '100mm': {
    id: '100mm',
    name: '100mm / 4×6" Shipping Label',
    urduName: 'ڈسپیچ و کارٹن لیبل (۴ ضرب ۶ انچ)',
    dimensions: '100 × 150 mm (4 × 6 in)',
    widthMm: 100,
    heightMm: 150,
    category: 'label',
    description: 'Carton dispatch stickers and gate security badges'
  },
  custom: {
    id: 'custom',
    name: 'Custom Dimensions',
    urduName: 'اپنی مرضی کی پیمائش (کسٹم)',
    dimensions: 'User Specified (mm)',
    widthMm: 210,
    heightMm: 297,
    category: 'sheet',
    description: 'User-specified exact width & height in millimeters'
  }
};

export interface MarginSpec {
  id: PrintMargins;
  name: string;
  urduName: string;
  topMm: number;
  bottomMm: number;
  leftMm: number;
  rightMm: number;
  css: string;
}

export const MARGIN_SPECS: Record<PrintMargins, MarginSpec> = {
  none: {
    id: 'none',
    name: 'Borderless / None (0mm)',
    urduName: 'بغیر مارجن (۰ ملی میٹر)',
    topMm: 0,
    bottomMm: 0,
    leftMm: 0,
    rightMm: 0,
    css: '0'
  },
  compact: {
    id: 'compact',
    name: 'Narrow / Compact (5mm)',
    urduName: 'مختصر (۵ ملی میٹر)',
    topMm: 5,
    bottomMm: 5,
    leftMm: 5,
    rightMm: 5,
    css: '5mm'
  },
  normal: {
    id: 'normal',
    name: 'Normal Standard (10mm)',
    urduName: 'معمول (۱۰ ملی میٹر)',
    topMm: 10,
    bottomMm: 10,
    leftMm: 10,
    rightMm: 10,
    css: '10mm'
  },
  wide: {
    id: 'wide',
    name: 'Wide (20mm)',
    urduName: 'کشادہ (۲۰ ملی میٹر)',
    topMm: 20,
    bottomMm: 20,
    leftMm: 20,
    rightMm: 20,
    css: '20mm'
  },
  custom: {
    id: 'custom',
    name: 'Custom Margins',
    urduName: 'کسٹم مارجن',
    topMm: 10,
    bottomMm: 10,
    leftMm: 10,
    rightMm: 10,
    css: 'custom'
  }
};

export const DEFAULT_PAGE_SETUP: PrintPageSetup = {
  paperSize: 'a4',
  orientation: 'portrait',
  margins: 'normal',
  scale: 100,
  colorMode: 'color',
  includeLogo: true,
  includeUrduAmount: true,
  includeSignatures: true,
  includeTimestamp: true,
  includePageNumbers: true,
  showWatermark: false,
  printCopies: 1,
  footerNote: 'Falcon Rod Maker · Precision Industrial Fan Accessories · Gujrat Industrial Zone'
};

const STORAGE_KEY = 'falcon_print_page_setup_v2';
const EVENT_NAME = 'falcon-print-page-setup-updated';

/**
 * Retrieve saved print page setup from localStorage
 */
export function getEffectivePageSetup(): PrintPageSetup {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Fallback: check legacy printer settings
      const legacyRaw = localStorage.getItem('falcon_printer_settings_v1');
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        return {
          ...DEFAULT_PAGE_SETUP,
          paperSize: legacy.paperSize || DEFAULT_PAGE_SETUP.paperSize,
          includeLogo: legacy.includeLogo ?? DEFAULT_PAGE_SETUP.includeLogo,
          includeUrduAmount: legacy.includeUrduAmount ?? DEFAULT_PAGE_SETUP.includeUrduAmount,
          printCopies: legacy.printCopies || DEFAULT_PAGE_SETUP.printCopies,
          footerNote: legacy.footerNote || DEFAULT_PAGE_SETUP.footerNote,
          orientation: legacy.orientation || 'portrait',
          margins: legacy.margins || 'normal',
          scale: legacy.scale || 100,
          colorMode: legacy.colorMode || 'color'
        };
      }
      return { ...DEFAULT_PAGE_SETUP };
    }
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PAGE_SETUP, ...parsed };
  } catch (err) {
    console.error('Error reading print page setup from localStorage', err);
    return { ...DEFAULT_PAGE_SETUP };
  }
}

/**
 * Persist print page setup and notify subscribers
 */
export function saveEffectivePageSetup(updated: Partial<PrintPageSetup>): PrintPageSetup {
  const current = getEffectivePageSetup();
  const next: PrintPageSetup = { ...current, ...updated };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error('Error saving print page setup', err);
  }

  // Also sync paperSize and options to legacy printer settings
  try {
    const legacyRaw = localStorage.getItem('falcon_printer_settings_v1');
    const legacy = legacyRaw ? JSON.parse(legacyRaw) : {};
    const updatedLegacy = {
      ...legacy,
      paperSize: next.paperSize,
      orientation: next.orientation,
      margins: next.margins,
      scale: next.scale,
      colorMode: next.colorMode,
      includeLogo: next.includeLogo,
      includeUrduAmount: next.includeUrduAmount,
      includeSignatures: next.includeSignatures,
      includeTimestamp: next.includeTimestamp,
      includePageNumbers: next.includePageNumbers,
      printCopies: next.printCopies,
      footerNote: next.footerNote
    };
    localStorage.setItem('falcon_printer_settings_v1', JSON.stringify(updatedLegacy));
  } catch (_) {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
  }

  return next;
}

/**
 * Subscribe to page setup updates
 */
export function subscribeToPageSetup(callback: (setup: PrintPageSetup) => void): () => void {
  const handler = () => {
    callback(getEffectivePageSetup());
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
  }
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    }
  };
}

/**
 * Generates exact CSS @page rules and layout styles for print
 */
export function calculatePrintPageStyles(setup: PrintPageSetup): {
  pageRuleCss: string;
  marginCss: string;
  bodyWidthCss: string;
  aspectRatio: number; // width / height
  effectiveOrientation: PrintOrientation;
} {
  const spec = PAPER_SIZE_SPECS[setup.paperSize] || PAPER_SIZE_SPECS.a4;
  const isRoll = spec.category === 'roll';
  const effectiveOrientation = isRoll ? 'portrait' : setup.orientation;

  // Margin CSS
  let marginCss = '10mm';
  if (setup.margins === 'custom') {
    const t = setup.customMarginTopMm ?? setup.customMarginMm ?? 10;
    const r = setup.customMarginRightMm ?? setup.customMarginMm ?? 10;
    const b = setup.customMarginBottomMm ?? setup.customMarginMm ?? 10;
    const l = setup.customMarginLeftMm ?? setup.customMarginMm ?? 10;
    marginCss = `${t}mm ${r}mm ${b}mm ${l}mm`;
  } else {
    marginCss = MARGIN_SPECS[setup.margins]?.css || (isRoll ? '0' : '10mm');
  }

  // Size CSS for @page
  let sizeCss = 'A4 portrait';
  let bodyWidthCss = '100%';
  let aspectRatio = 210 / 297; // portrait A4

  if (isRoll) {
    const rollWidthMm = spec.widthMm || 80;
    sizeCss = `${rollWidthMm}mm auto`;
    bodyWidthCss = `${rollWidthMm - (setup.margins === 'none' ? 2 : 4)}mm`;
    aspectRatio = 80 / 180;
  } else if (setup.paperSize === 'custom' && setup.customWidthMm && setup.customHeightMm) {
    const w = effectiveOrientation === 'landscape' ? setup.customHeightMm : setup.customWidthMm;
    const h = effectiveOrientation === 'landscape' ? setup.customWidthMm : setup.customHeightMm;
    sizeCss = `${w}mm ${h}mm`;
    bodyWidthCss = `${w}mm`;
    aspectRatio = w / h;
  } else {
    // Sheet sizes
    const standardName = setup.paperSize.toUpperCase();
    sizeCss = `${standardName} ${effectiveOrientation}`;
    
    const wMm = effectiveOrientation === 'landscape' ? spec.heightMm : spec.widthMm;
    const hMm = effectiveOrientation === 'landscape' ? spec.widthMm : spec.heightMm;
    aspectRatio = wMm / hMm;
    bodyWidthCss = '100%';
  }

  const pageRuleCss = `@page { size: ${sizeCss}; margin: ${marginCss}; }`;

  return {
    pageRuleCss,
    marginCss,
    bodyWidthCss,
    aspectRatio,
    effectiveOrientation
  };
}
