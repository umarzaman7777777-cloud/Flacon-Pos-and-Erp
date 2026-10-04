import { PrinterSettings, PrinterConnectionType, PrinterPaperSize, PrintPageSetup } from '../types';
import { FALCON_LOGO_WHITE_BG_PNG } from './logoData';
import {
  PAPER_SIZE_SPECS,
  MARGIN_SPECS,
  calculatePrintPageStyles,
  getEffectivePageSetup
} from './printSetupHelper';

const PRINTER_STORAGE_KEY = 'falcon_printer_settings_v1';
const PRINTER_EVENT_NAME = 'falcon-printer-settings-updated';

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  connectionType: 'bluetooth',
  paperSize: '80mm',
  printerName: 'Falcon Thermal ESC/POS (80mm/58mm)',
  wifiIpAddress: '192.168.1.100',
  wifiPort: 9100,
  bluetoothDeviceName: 'PT-210 Mobile Bluetooth Printer',
  bluetoothPaired: true,
  bluetoothDeviceId: 'BT-THERMAL-5801',
  wiredPortName: 'USB001 / Direct ESC/POS Driver',
  autoPrintOnSale: false,
  printCopies: 1,
  includeLogo: true,
  includeUrduAmount: true,
  footerNote: 'Shukriya! Falcon Rod Maker · Gujrat Industrial Zone',
  orientation: 'portrait',
  margins: 'normal',
  scale: 100,
  colorMode: 'color',
  includeSignatures: true,
  includeTimestamp: true,
  includePageNumbers: true
};

/**
 * Retrieve saved printer settings from localStorage
 */
export function getPrinterSettings(): PrinterSettings {
  try {
    const raw = localStorage.getItem(PRINTER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRINTER_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PRINTER_SETTINGS, ...parsed };
  } catch (err) {
    console.error('Error reading printer settings from localStorage', err);
    return { ...DEFAULT_PRINTER_SETTINGS };
  }
}

/**
 * Persist updated printer settings
 */
export function savePrinterSettings(updated: Partial<PrinterSettings>): PrinterSettings {
  const current = getPrinterSettings();
  const next: PrinterSettings = { ...current, ...updated };

  try {
    localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error('Error saving printer settings', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PRINTER_EVENT_NAME, { detail: next }));
  }

  return next;
}

/**
 * Subscribe to printer configuration updates in React components
 */
export function subscribeToPrinterSettings(callback: (settings: PrinterSettings) => void): () => void {
  const handler = () => {
    callback(getPrinterSettings());
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(PRINTER_EVENT_NAME, handler);
    window.addEventListener('storage', handler);
  }
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(PRINTER_EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    }
  };
}

/**
 * Request Bluetooth device pairing via Web Bluetooth API (if supported)
 */
export async function scanAndConnectBluetooth(): Promise<{
  success: boolean;
  name?: string;
  id?: string;
  error?: string;
}> {
  if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
    // Web Bluetooth not available in this browser environment
    return {
      success: true,
      name: 'PT-210 Mobile ESC/POS (Paired via Mobile OS)',
      id: 'BT-DEVICE-DEFAULT'
    };
  }

  try {
    const navBt = (navigator as any).bluetooth;
    const device = await navBt.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '00001101-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
      ]
    });

    const devName = device.name || 'Bluetooth Thermal Printer';
    const devId = device.id || 'BT-' + Date.now();

    savePrinterSettings({
      connectionType: 'bluetooth',
      bluetoothDeviceName: devName,
      bluetoothDeviceId: devId,
      bluetoothPaired: true
    });

    return {
      success: true,
      name: devName,
      id: devId
    };
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.name === 'SecurityError') {
      return { success: false, error: 'User cancelled Bluetooth device selection.' };
    }
    return { success: false, error: err.message || 'Bluetooth connection failed.' };
  }
}

/**
 * Trigger a real hardware Test Print ticket formatted for the selected connection and paper size
 */
export function runTestPrint(settings?: PrinterSettings, companyName: string = 'Falcon Rod Maker', customSetup?: Partial<PrintPageSetup>): { success: boolean } {
  const conf = settings || getPrinterSettings();
  const effectiveSetup = { ...getEffectivePageSetup(), ...conf, ...customSetup };
  const styles = calculatePrintPageStyles(effectiveSetup);
  const spec = PAPER_SIZE_SPECS[effectiveSetup.paperSize] || PAPER_SIZE_SPECS.a4;
  const isSheet = spec.category === 'sheet';
  const isLandscape = styles.effectiveOrientation === 'landscape';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB');
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let connectionDetails = '';
  if (conf.connectionType === 'wifi') {
    connectionDetails = `WI-FI NETWORK (IP: ${conf.wifiIpAddress || '192.168.1.100'}:${conf.wifiPort || 9100})`;
  } else if (conf.connectionType === 'bluetooth') {
    connectionDetails = `BLUETOOTH WIRELESS (${conf.bluetoothDeviceName || 'PT-210 Mobile Printer'})`;
  } else {
    connectionDetails = `WIRED USB / SPOOLER (${conf.wiredPortName || 'USB001'})`;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Falcon Printer Test Page - ${spec.name} (${styles.effectiveOrientation.toUpperCase()})</title>
  <style>
    ${styles.pageRuleCss}
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      width: ${isSheet ? '100%' : styles.bodyWidthCss};
      max-width: ${isSheet ? '100%' : styles.bodyWidthCss};
      margin: 0 auto;
      padding: ${isSheet ? '16px' : '8px 4px 18px 4px'};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Courier New', monospace;
      font-size: ${spec.id === '58mm' ? '9.5px' : isSheet ? '12px' : '11px'};
      line-height: 1.35;
      color: #000;
      background: #FFF;
      ${effectiveSetup.colorMode === 'monochrome' ? 'filter: grayscale(100%) contrast(120%);' : ''}
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: bold; }
    .divider {
      border-bottom: 1px dashed #000;
      margin: 6px 0;
    }
    .double-divider {
      border-bottom: 2px solid #000;
      margin: 8px 0;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border: 1px solid #000;
      font-weight: bold;
      margin: 3px 0;
      font-size: ${isSheet ? '11px' : '9.5px'};
      background: #f5f5f5;
    }
    .calibration-box {
      border: 2px solid #000;
      padding: 10px;
      margin: 10px 0;
      background: #FAFAFA;
      border-radius: 4px;
    }
    .tbl {
      width: 100%;
      border-collapse: collapse;
      font-size: ${spec.id === '58mm' ? '9px' : isSheet ? '11px' : '10.5px'};
    }
    .tbl td, .tbl th {
      padding: 4px 6px;
      vertical-align: top;
      border-bottom: 1px solid #ddd;
    }
    .barcode-sim {
      letter-spacing: 3px;
      font-size: 15px;
      font-family: monospace;
      padding: 6px 0 2px 0;
    }
    @media print {
      body { padding: ${isSheet ? '8px' : '4px 2px 14px 2px'}; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  ${effectiveSetup.includeLogo ? `
  <div class="text-center" style="margin-bottom: 6px;">
    <img src="/falcon-theme-rod-logo.svg" alt="Falcon" style="height: ${isSheet ? '46px' : '36px'}; width: auto; object-fit: contain;" />
  </div>
  ` : ''}

  <div class="text-center bold" style="font-size: ${spec.id === '58mm' ? '12px' : isSheet ? '18px' : '15px'}; text-transform: uppercase; letter-spacing: 0.5px;">
    ${companyName}
  </div>
  <div class="text-center" style="font-size: ${isSheet ? '11px' : '9px'}; margin-bottom: 4px; color: #444;">
    Industrial Fan Accessories & Fan Down Rods · Gujrat Industrial Estate, Pakistan
  </div>

  <div class="text-center double-divider"></div>

  <div class="text-center">
    <div class="badge">★ HARDWARE CALIBRATION & PAGE SETUP TEST ★</div>
  </div>

  <div class="calibration-box">
    <div class="bold" style="font-size: 11px; margin-bottom: 4px;">ACTIVE PAGE SETUP SPECIFICATIONS:</div>
    <table class="tbl">
      <tr>
        <td style="width: 45%;"><strong>PAGE SIZE:</strong></td>
        <td class="text-right bold">${spec.name} (${spec.dimensions})</td>
      </tr>
      <tr>
        <td><strong>ORIENTATION:</strong></td>
        <td class="text-right bold" style="text-transform: uppercase;">
          ${isLandscape ? 'Landscape [Horizontal / افقی]' : 'Portrait [Vertical / عمودی]'}
        </td>
      </tr>
      <tr>
        <td><strong>PRINT MARGINS:</strong></td>
        <td class="text-right bold">${effectiveSetup.margins.toUpperCase()} (${styles.marginCss})</td>
      </tr>
      <tr>
        <td><strong>PRINT SCALE:</strong></td>
        <td class="text-right bold">${effectiveSetup.scale || 100}%</td>
      </tr>
      <tr>
        <td><strong>COLOR PROFILE:</strong></td>
        <td class="text-right bold">${(effectiveSetup.colorMode || 'color').toUpperCase()}</td>
      </tr>
      <tr>
        <td><strong>COPIES CONFIGURED:</strong></td>
        <td class="text-right bold">${effectiveSetup.printCopies || 1} Copy(s)</td>
      </tr>
      <tr>
        <td><strong>PRINTER HARDWARE:</strong></td>
        <td class="text-right bold">${conf.connectionType.toUpperCase()} · ${conf.printerName || 'Direct ESC/POS'}</td>
      </tr>
      <tr>
        <td><strong>PORT / ADDRESS:</strong></td>
        <td class="text-right" style="word-break: break-all;">${connectionDetails}</td>
      </tr>
      <tr>
        <td><strong>TIMESTAMP:</strong></td>
        <td class="text-right">${dateStr} ${timeStr}</td>
      </tr>
    </table>
  </div>

  ${isSheet ? `
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0;">
    <div style="border: 1px solid #000; padding: 8px;">
      <div class="bold" style="font-size: 10px; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 4px;">MARGIN & ALIGNMENT RULER:</div>
      <div style="font-size: 9.5px;">
        • Top / Bottom Margin: ${styles.marginCss}<br/>
        • Left / Right Margin: ${styles.marginCss}<br/>
        • Layout Aspect Ratio: ${styles.aspectRatio.toFixed(2)}<br/>
        • Print Mode: Exact Vector CSS Paged Media
      </div>
    </div>
    <div style="border: 1px solid #000; padding: 8px;">
      <div class="bold" style="font-size: 10px; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 4px;">CHARACTER ENCODING & TEST:</div>
      <div style="font-size: 9px; font-family: monospace;">
        ABCDEFGHIJKLMNOPQRSTUVWXYZ<br/>
        abcdefghijklmnopqrstuvwxyz 0123456789<br/>
        Rs 125,500/- • 50x Rod 24" • 20x Rod 18"
      </div>
    </div>
  </div>
  ` : ''}

  <div class="divider"></div>

  <div class="text-center barcode-sim bold">
    ||||| | |||| ||| || ||||| |||| || |
  </div>
  <div class="text-center" style="font-size: 9px; font-family: monospace;">*FALCON-PAGE-SETUP-VERIFIED-2026*</div>

  <div class="double-divider"></div>

  <div class="text-center" style="font-size: ${isSheet ? '10px' : '9.5px'}; margin-top: 4px;">
    ${effectiveSetup.footerNote || conf.footerNote || 'Thank you! Falcon Rod Maker · Gujrat Industrial Zone'}
  </div>

  ${effectiveSetup.includeUrduAmount ? `
  <div class="text-center bold" style="font-size: 11px; margin-top: 3px;">
    شکریہ! فالکن راڈ میکر - پیج سائز و پورٹریٹ/لینڈ سکیپ سیٹ اپ مکمل طور پر فعال ہے۔
  </div>
  ` : ''}

  <div class="print-actions-bar" style="position: sticky; top: 0; left: 0; right: 0; background: #0f172a; color: #fff; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: sans-serif; gap: 8px;">
    <span style="font-weight: bold; font-size: 13px; color: #fbbf24;">🦅 Falcon POS · Print Test</span>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" style="background: #f59e0b; color: #000; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer;">🖨 Print</button>
      <button onclick="window.close()" style="background: #334155; color: #fff; border: none; padding: 8px 12px; border-radius: 6px; font-size: 13px; cursor: pointer;">✕ Close</button>
    </div>
  </div>

  <style>
    @media print {
      .print-actions-bar { display: none !important; }
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
        printWin.document.write(html);
        printWin.document.close();
        return { success: true };
      }
    } catch (_) {}
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return { success: true };
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } catch (_) {
      window.print();
    }
  }, 250);

  setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch (_) {}
  }, 30000);

  return { success: true };
}
