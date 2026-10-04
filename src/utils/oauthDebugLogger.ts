/**
 * Persistent OAuth & Workspace Debug Logger
 * 
 * Captures, structures, and persists failed and notable Google Sheets & Google Drive
 * authentication, token exchange, and API attempts to localStorage.
 * Provides remote diagnosis traces for "unknown gmail traces", origin mismatches,
 * scope rejections, token expiration, and identity conflicts.
 */

export interface OAuthDebugLogEntry {
  id: string;
  timestamp: string; // ISO string
  formattedTime: string; // Local human-readable time
  service: 'sheets' | 'drive' | 'general';
  category: 'token_exchange' | 'scope_validation' | 'api_probe' | 'origin_mismatch' | 'unknown_gmail_trace' | 'network' | 'user_cancelled';
  severity: 'error' | 'warn' | 'info';
  errorCode: string;
  httpStatus?: number | null;
  errorTitle: string;
  errorDescription: string;
  rawDetails?: string;
  userEmail?: string;
  origin?: string;
  clientId?: string;
  scopesRequested?: string[];
  scopesGranted?: string[];
  latencyMs?: number;
  userAgent?: string;
  onlineStatus: boolean;
  metadata?: Record<string, any>;
}

const STORAGE_KEY_OAUTH_DEBUG_LOGS = 'falcon_oauth_debug_logs';
const MAX_LOG_ENTRIES = 50;

export const OAUTH_LOG_EVENT = 'falcon_oauth_debug_log_updated';

/**
 * Retrieve all persisted OAuth debug logs from local storage.
 */
export function getOAuthDebugLogs(): OAuthDebugLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OAUTH_DEBUG_LOGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse OAuth debug logs from storage:', err);
    return [];
  }
}

/**
 * Notify listening UI components that the debug log store changed.
 */
function notifyLogUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OAUTH_LOG_EVENT));
  }
}

/**
 * Append a new debug log entry to persistent storage.
 */
export function logOAuthError(entry: Omit<OAuthDebugLogEntry, 'id' | 'timestamp' | 'formattedTime' | 'onlineStatus' | 'userAgent'> & { id?: string; timestamp?: string }): OAuthDebugLogEntry {
  const now = new Date();
  const fullEntry: OAuthDebugLogEntry = {
    id: entry.id || `oauth_err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: entry.timestamp || now.toISOString(),
    formattedTime: now.toLocaleString(),
    onlineStatus: typeof navigator !== 'undefined' ? navigator.onLine : true,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    origin: entry.origin || (typeof window !== 'undefined' ? window.location?.origin : ''),
    ...entry
  };

  try {
    const currentLogs = getOAuthDebugLogs();
    
    // Prevent spamming identical error logs within a 5-second window
    const recentDuplicate = currentLogs.find(l => 
      l.service === fullEntry.service &&
      l.errorCode === fullEntry.errorCode &&
      l.rawDetails === fullEntry.rawDetails &&
      (Date.now() - new Date(l.timestamp).getTime()) < 5000
    );

    if (recentDuplicate) {
      return recentDuplicate;
    }

    const updated = [fullEntry, ...currentLogs].slice(0, MAX_LOG_ENTRIES);
    localStorage.setItem(STORAGE_KEY_OAUTH_DEBUG_LOGS, JSON.stringify(updated));
    notifyLogUpdated();
  } catch (err) {
    console.error('Failed to save OAuth debug log to storage:', err);
  }

  return fullEntry;
}

/**
 * Clear all persisted debug logs.
 */
export function clearOAuthDebugLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_OAUTH_DEBUG_LOGS);
    notifyLogUpdated();
  } catch (err) {
    console.error('Failed to clear OAuth debug logs:', err);
  }
}

/**
 * Export debug logs as formatted JSON string for remote sharing and diagnosis.
 */
export function exportOAuthDebugLogsJSON(): string {
  const logs = getOAuthDebugLogs();
  const systemDiagnostic = {
    exportDate: new Date().toISOString(),
    exportedBy: 'Falcon Rod Maker POS Remote Diagnostics',
    appOrigin: typeof window !== 'undefined' ? window.location.origin : '',
    totalLogs: logs.length,
    deviceInfo: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      language: typeof navigator !== 'undefined' ? navigator.language : '',
      platform: typeof navigator !== 'undefined' ? (navigator as any).userAgentData?.platform || navigator.platform : '',
      online: typeof navigator !== 'undefined' ? navigator.onLine : true
    },
    logs
  };
  return JSON.stringify(systemDiagnostic, null, 2);
}
