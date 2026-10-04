import {
  ExportDocumentConfig,
  ExportThemePreset,
  ExportTablePayload
} from '../types';

export const EXPORT_THEME_PRESETS: ExportThemePreset[] = [
  {
    id: 'midnight',
    name: 'Midnight Industrial',
    headerBgColor: '#1c1f22',
    headerTextColor: '#f5b700',
    headerSubtitleColor: '#cbd5e1',
    tableHeaderBgColor: '#2d3748',
    tableHeaderTextColor: '#f8fafc',
    accentColor: '#f5b700',
    description: 'Dark steel header with iconic Falcon amber-gold typography'
  },
  {
    id: 'navy',
    name: 'Corporate Navy',
    headerBgColor: '#0f172a',
    headerTextColor: '#38bdf8',
    headerSubtitleColor: '#94a3b8',
    tableHeaderBgColor: '#1e293b',
    tableHeaderTextColor: '#f8fafc',
    accentColor: '#38bdf8',
    description: 'Deep navy blue header with crisp ice-blue accents'
  },
  {
    id: 'emerald',
    name: 'Emerald Workshop',
    headerBgColor: '#064e3b',
    headerTextColor: '#6ee7b7',
    headerSubtitleColor: '#a7f3d0',
    tableHeaderBgColor: '#047857',
    tableHeaderTextColor: '#ffffff',
    accentColor: '#34d399',
    description: 'Forest green banner with mint green highlights'
  },
  {
    id: 'crimson',
    name: 'Crimson Executive',
    headerBgColor: '#881337',
    headerTextColor: '#fecdd3',
    headerSubtitleColor: '#fda4af',
    tableHeaderBgColor: '#9f1239',
    tableHeaderTextColor: '#ffffff',
    accentColor: '#f43f5e',
    description: 'Rich burgundy header for formal factory audit statements'
  },
  {
    id: 'purple',
    name: 'Royal Amethyst',
    headerBgColor: '#3b0764',
    headerTextColor: '#fef08a',
    headerSubtitleColor: '#e9d5ff',
    tableHeaderBgColor: '#581c87',
    tableHeaderTextColor: '#ffffff',
    accentColor: '#eab308',
    description: 'Regal deep violet with bright gold accenting'
  },
  {
    id: 'charcoal',
    name: 'Charcoal Titanium',
    headerBgColor: '#262626',
    headerTextColor: '#ffffff',
    headerSubtitleColor: '#a3a3a3',
    tableHeaderBgColor: '#404040',
    tableHeaderTextColor: '#f5f5f5',
    accentColor: '#737373',
    description: 'Ultra-clean dark monochrome for laser & dot-matrix printing'
  },
  {
    id: 'minimal',
    name: 'Clean Minimalist (Light)',
    headerBgColor: '#f1f5f9',
    headerTextColor: '#0f172a',
    headerSubtitleColor: '#475569',
    tableHeaderBgColor: '#e2e8f0',
    tableHeaderTextColor: '#1e293b',
    accentColor: '#0284c7',
    description: 'High-contrast light background that saves printer toner'
  }
];

export const DEFAULT_EXPORT_CONFIG: ExportDocumentConfig = {
  presetId: 'midnight',
  headerBgColor: '#1c1f22',
  headerTextColor: '#f5b700',
  headerSubtitleColor: '#cbd5e1',
  tableHeaderBgColor: '#2d3748',
  tableHeaderTextColor: '#f8fafc',
  accentColor: '#f5b700',
  fontFamily: 'helvetica',
  fontSize: 'normal',
  paperSize: 'a4',
  orientation: 'landscape',
  showLogo: true,
  showDate: true,
  showStripedRows: true,
  showBorders: true,
  showSignatureLine: false,
  showAccentBar: true,
  companyName: 'Falcon Rod Maker',
  subtitle: 'Fan Accessories · Gujrat'
};

const STORAGE_KEY = 'falcon_export_doc_config_v1';
const MODAL_EVENT = 'falcon-open-export-modal';
const CONFIG_UPDATE_EVENT = 'falcon-export-config-updated';

/**
 * Retrieve saved export styling preferences from localStorage
 */
export function getSavedExportConfig(): ExportDocumentConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_EXPORT_CONFIG };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_EXPORT_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn('Failed to parse saved export config', err);
  }
  return { ...DEFAULT_EXPORT_CONFIG };
}

/**
 * Persist export styling preferences to localStorage
 */
export function saveExportConfig(patch: Partial<ExportDocumentConfig>): ExportDocumentConfig {
  const current = getSavedExportConfig();
  const updated: ExportDocumentConfig = { ...current, ...patch };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent(CONFIG_UPDATE_EVENT, { detail: updated }));
    } catch (err) {
      console.warn('Failed to save export config', err);
    }
  }
  return updated;
}

/**
 * Listen for export config updates
 */
export function subscribeToExportConfig(cb: (cfg: ExportDocumentConfig) => void): () => void {
  const handler = (e: Event) => {
    const custom = e as CustomEvent;
    cb(custom.detail || getSavedExportConfig());
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(CONFIG_UPDATE_EVENT, handler);
  }
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(CONFIG_UPDATE_EVENT, handler);
    }
  };
}

/**
 * Global Export Modal Dispatcher:
 * Allows ANY button across the app to invoke the full-featured Document Export Studio!
 */
export function openExportModal(payload: ExportTablePayload): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MODAL_EVENT, { detail: payload }));
  }
}

/**
 * Subscribe to open export modal events (used by global modal host)
 */
export function subscribeToExportModal(cb: (payload: ExportTablePayload | null) => void): () => void {
  const handler = (e: Event) => {
    const custom = e as CustomEvent;
    cb(custom.detail || null);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(MODAL_EVENT, handler);
  }
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(MODAL_EVENT, handler);
    }
  };
}

/**
 * Convert any HEX color string (#fff, #ffffff) into [r, g, b]
 */
export function hexToRgb(hex: string): [number, number, number] {
  if (!hex || typeof hex !== 'string') return [28, 31, 34];
  let c = hex.replace('#', '').trim();
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  if (c.length !== 6) return [28, 31, 34];
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
