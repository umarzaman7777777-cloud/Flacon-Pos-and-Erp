import { performUniversalGoogleSignIn, refreshGoogleWorkspaceTokenSilently } from './googleAuthHelper';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  requestGoogleSheetsToken,
  clearSheetsToken,
  ALLOWED_SHEETS_OWNER_EMAIL,
  notifyWorkspaceSyncUpdated,
  syncSheetsTokenFromCloud,
  storeSheetsToken
} from './googleSheetsSync';
import {
  requestGoogleDriveToken,
  clearDriveToken,
  syncDriveTokenFromCloud,
  storeDriveToken
} from './googleDriveBackup';
import { logOAuthError } from './oauthDebugLogger';

export type WorkspaceServiceType = 'sheets' | 'drive';

export interface OAuthVerificationResult {
  service: WorkspaceServiceType;
  status: 'valid' | 'invalid' | 'expired' | 'missing' | 'checking';
  errorCode: string | null;
  httpStatus: number | null;
  errorTitle: string;
  errorDescription: string;
  actionRequired: string;
  verifiedEmail?: string;
  expiresInSeconds?: number;
  expiresAtFormatted?: string;
  scopesGranted?: string[];
  latencyMs?: number;
  lastCheckedAt: string;
  rawDetails?: string;
  suggestedOrigin?: string;
  resourceDetails?: {
    spreadsheetId?: string;
    spreadsheetTitle?: string;
    folderId?: string;
  };
}

const STORAGE_KEY_SHEETS_TOKEN = 'falcon_gsheets_token';
const STORAGE_KEY_SHEETS_EXPIRES = 'falcon_gsheets_expires_at';
const STORAGE_KEY_SHEETS_EMAIL = 'falcon_gsheets_email';
const STORAGE_KEY_SHEETS_SPREADSHEET_ID = 'falcon_gsheets_spreadsheet_id';

const STORAGE_KEY_DRIVE_TOKEN = 'falcon_gdrive_token';
const STORAGE_KEY_DRIVE_EXPIRES = 'falcon_gdrive_expires_at';
const STORAGE_KEY_DRIVE_EMAIL = 'falcon_gdrive_email';
const STORAGE_KEY_DRIVE_FOLDER_ID = 'falcon_gdrive_folder_id';

/**
 * Determine the current browser window origin for OAuth registration diagnostics
 */
export function getCurrentAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

/**
 * Parse any arbitrary error thrown by Google API or OAuth flows into a structured
 * verification result with specific error code, HTTP status, and recovery steps.
 */
export function parseWorkspaceOAuthError(error: any, service: WorkspaceServiceType): OAuthVerificationResult {
  const now = new Date().toLocaleTimeString();
  const rawMsg = String(error?.message || error?.error_description || error?.error || error || '');
  const lower = rawMsg.toLowerCase();
  const origin = getCurrentAppOrigin();

  // 0. Identity Mismatch / Access Denied
  if (
    lower.includes('account not found') ||
    lower.includes('user not found') ||
    lower.includes('unregistered email') ||
    lower.includes('access_denied: user is not authorized') ||
    lower.includes('user_not_authorized')
  ) {
    const result: OAuthVerificationResult = {
      service,
      status: 'invalid',
      errorCode: 'AUTH_ACCESS_DENIED',
      httpStatus: 403,
      errorTitle: 'Google Account Authorization Required',
      errorDescription: 'The active Google authentication session was not authorized or access was denied.',
      actionRequired: `Sign in with an authorized Google account via "Re-authenticate".`,
      lastCheckedAt: now,
      rawDetails: rawMsg
    };
    logOAuthError({
      service,
      category: 'unknown_gmail_trace',
      severity: 'error',
      errorCode: result.errorCode!,
      httpStatus: result.httpStatus,
      errorTitle: result.errorTitle,
      errorDescription: result.errorDescription,
      rawDetails: rawMsg,
      origin
    });
    return result;
  }

  // 1. Origin Mismatch (Error 400)
  if (
    lower.includes('origin_mismatch') ||
    lower.includes('redirect_uri_mismatch') ||
    lower.includes('storagerelay') ||
    lower.includes('error 400: origin_mismatch')
  ) {
    const result: OAuthVerificationResult = {
      service,
      status: 'invalid',
      errorCode: 'HTTP_400_ORIGIN_MISMATCH',
      httpStatus: 400,
      errorTitle: 'Google OAuth Origin Mismatch',
      errorDescription: `The application domain (${origin}) has not been added to Authorized JavaScript Origins in Google Cloud Console.`,
      actionRequired: `Add "${origin}" to Authorized JavaScript origins for Client ID ${firebaseConfig.oAuthClientId} in Google Cloud Console.`,
      lastCheckedAt: now,
      rawDetails: rawMsg,
      suggestedOrigin: origin
    };
    logOAuthError({
      service,
      category: 'origin_mismatch',
      severity: 'error',
      errorCode: result.errorCode!,
      httpStatus: result.httpStatus,
      errorTitle: result.errorTitle,
      errorDescription: result.errorDescription,
      rawDetails: rawMsg,
      origin
    });
    return result;
  }

  // 1b. Mobile Localhost Connection Refused (ERR_CONNECTION_REFUSED)
  if (
    lower.includes('err_connection_refused') ||
    lower.includes('refused to connect') ||
    lower.includes('connection refused') ||
    (lower.includes('failed to fetch') && origin.includes('localhost'))
  ) {
    const liveUrl = typeof window !== 'undefined' && window.location.origin.includes('run.app')
      ? window.location.origin
      : 'https://ais-pre-tgmm25tbldi45hm5juavht-198776278872.asia-east1.run.app';
    const result: OAuthVerificationResult = {
      service,
      status: 'invalid',
      errorCode: 'ERR_CONNECTION_REFUSED',
      httpStatus: 0,
      errorTitle: 'Mobile Browser Localhost Not Found',
      errorDescription: 'Your mobile phone browser attempted to load "localhost", but an Android phone does not run a local web server.',
      actionRequired: `Open the live Cloud Web App on your mobile browser (${liveUrl}) instead of "localhost", or use the installed Falcon POS APK.`,
      lastCheckedAt: now,
      rawDetails: rawMsg,
      suggestedOrigin: liveUrl
    };
    logOAuthError({
      service,
      category: 'network',
      severity: 'error',
      errorCode: result.errorCode!,
      httpStatus: result.httpStatus,
      errorTitle: result.errorTitle,
      errorDescription: result.errorDescription,
      rawDetails: rawMsg,
      origin
    });
    return result;
  }

  // 2. Token Expired (HTTP 401)
  if (
    lower.includes('token_expired') ||
    lower.includes('expired') ||
    lower.includes('invalid credentials') ||
    lower.includes('401') ||
    lower.includes('unauthenticated') ||
    lower.includes('auth/id-token-expired')
  ) {
    const result: OAuthVerificationResult = {
      service,
      status: 'expired',
      errorCode: 'HTTP_401_TOKEN_EXPIRED',
      httpStatus: 401,
      errorTitle: 'OAuth Session Expired',
      errorDescription: 'The security access token issued by Google has expired after its validity period.',
      actionRequired: 'Click the Re-authenticate button to generate a fresh Google Workspace access token.',
      lastCheckedAt: now,
      rawDetails: rawMsg
    };
    logOAuthError({
      service,
      category: 'token_exchange',
      severity: 'warn',
      errorCode: result.errorCode!,
      httpStatus: result.httpStatus,
      errorTitle: result.errorTitle,
      errorDescription: result.errorDescription,
      rawDetails: rawMsg,
      origin
    });
    return result;
  }

  // 3. Insufficient Scopes / Permission Denied (HTTP 403)
  if (
    lower.includes('insufficientpermissions') ||
    lower.includes('insufficient_scope') ||
    lower.includes('insufficient authentication scopes') ||
    (lower.includes('403') && lower.includes('scope'))
  ) {
    const result: OAuthVerificationResult = {
      service,
      status: 'invalid',
      errorCode: 'HTTP_403_INSUFFICIENT_SCOPES',
      httpStatus: 403,
      errorTitle: 'Missing OAuth Permissions',
      errorDescription: `The connected Google token does not possess authorization for ${
        service === 'sheets' ? 'Google Sheets (spreadsheets)' : 'Google Drive (drive.file)'
      }.`,
      actionRequired: 'Click Re-authenticate and ensure all requested Google Workspace permissions are approved in the consent screen.',
      lastCheckedAt: now,
      rawDetails: rawMsg
    };
    logOAuthError({
      service,
      category: 'scope_validation',
      severity: 'error',
      errorCode: result.errorCode!,
      httpStatus: result.httpStatus,
      errorTitle: result.errorTitle,
      errorDescription: result.errorDescription,
      rawDetails: rawMsg,
      origin
    });
    return result;
  }

  // 4. Access Denied / Forbidden (HTTP 403)
  if (lower.includes('403') || lower.includes('permission_denied') || lower.includes('access denied')) {
    const result: OAuthVerificationResult = {
      service,
      status: 'invalid',
      errorCode: 'HTTP_403_ACCESS_DENIED',
      httpStatus: 403,
      errorTitle: 'Google API Access Forbidden',
      errorDescription: 'Google servers rejected the request. The connected account may lack access to this resource or organization policy blocked it.',
      actionRequired: 'Re-authenticate with an account that has editing rights, or inspect workspace file sharing.',
      lastCheckedAt: now,
      rawDetails: rawMsg
    };
    logOAuthError({
      service,
      category: 'api_probe',
      severity: 'error',
      errorCode: result.errorCode!,
      httpStatus: result.httpStatus,
      errorTitle: result.errorTitle,
      errorDescription: result.errorDescription,
      rawDetails: rawMsg,
      origin
    });
    return result;
  }

  // 5. Rate Limit Exceeded (HTTP 429)
  if (lower.includes('429') || lower.includes('ratelimitexceeded') || lower.includes('quota') || lower.includes('too many requests')) {
    const result: OAuthVerificationResult = {
      service,
      status: 'invalid',
      errorCode: 'HTTP_429_RATE_LIMIT',
      httpStatus: 429,
      errorTitle: 'Google API Rate Limit Reached',
      errorDescription: 'The Google Workspace API rate limit (100 requests per 100 seconds) was momentarily reached.',
      actionRequired: 'Wait 30-60 seconds for the quota window to reset, then retry your synchronization.',
      lastCheckedAt: now,
      rawDetails: rawMsg
    };
    logOAuthError({
      service,
      category: 'api_probe',
      severity: 'warn',
      errorCode: result.errorCode!,
      httpStatus: result.httpStatus,
      errorTitle: result.errorTitle,
      errorDescription: result.errorDescription,
      rawDetails: rawMsg,
      origin
    });
    return result;
  }

  // 6. Resource Not Found (HTTP 404)
  if (lower.includes('404') || lower.includes('not found') || lower.includes('filenotfound')) {
    const result: OAuthVerificationResult = {
      service,
      status: 'invalid',
      errorCode: 'HTTP_404_NOT_FOUND',
      httpStatus: 404,
      errorTitle: `${service === 'sheets' ? 'Spreadsheet' : 'Drive Backup'} Not Found`,
      errorDescription: 'The requested file or folder was moved, trashed, or does not exist in Google Drive.',
      actionRequired: service === 'sheets'
        ? 'Click "Create Master Sheet" or check the Spreadsheet ID configuration.'
        : 'A new Falcon Backups folder will be generated automatically on your next backup.',
      lastCheckedAt: now,
      rawDetails: rawMsg
    };
    logOAuthError({
      service,
      category: 'api_probe',
      severity: 'warn',
      errorCode: result.errorCode!,
      httpStatus: result.httpStatus,
      errorTitle: result.errorTitle,
      errorDescription: result.errorDescription,
      rawDetails: rawMsg,
      origin
    });
    return result;
  }

  // 7. Popup Closed by User or Mobile Browser Block
  if (lower.includes('popup-closed-by-user') || lower.includes('popup_closed_by_user') || lower.includes('popup was closed')) {
    const result: OAuthVerificationResult = {
      service,
      status: 'invalid',
      errorCode: 'AUTH_POPUP_CLOSED',
      httpStatus: 0,
      errorTitle: 'Mobile Workspace Authorization',
      errorDescription: 'On mobile, tap Re-authenticate to open Chrome for direct Google Workspace authorization, or tap "Sync from Cloud".',
      actionRequired: 'Tap Re-authenticate below to authorize Google Drive & Sheets in Chrome, or tap Sync from Cloud.',
      lastCheckedAt: now,
      rawDetails: rawMsg
    };
    logOAuthError({
      service,
      category: 'user_cancelled',
      severity: 'info',
      errorCode: result.errorCode!,
      httpStatus: 0,
      errorTitle: result.errorTitle,
      errorDescription: result.errorDescription,
      rawDetails: rawMsg,
      origin
    });
    return result;
  }

  // 8. Popup Blocked by Browser
  if (lower.includes('popup-blocked') || lower.includes('popup blocked')) {
    const result: OAuthVerificationResult = {
      service,
      status: 'invalid',
      errorCode: 'AUTH_POPUP_BLOCKED',
      httpStatus: 0,
      errorTitle: 'Browser Blocked Login Popup',
      errorDescription: 'Your web browser blocked the Google authentication popup window from opening.',
      actionRequired: 'Allow popups for this site in your browser address bar, then click Re-authenticate.',
      lastCheckedAt: now,
      rawDetails: rawMsg
    };
    logOAuthError({
      service,
      category: 'token_exchange',
      severity: 'warn',
      errorCode: result.errorCode!,
      httpStatus: 0,
      errorTitle: result.errorTitle,
      errorDescription: result.errorDescription,
      rawDetails: rawMsg,
      origin
    });
    return result;
  }

  // 9. Unauthorized Domain in Firebase Auth (e.g. AI Studio web preview iframe)
  if (lower.includes('unauthorized-domain') || lower.includes('auth/unauthorized-domain')) {
    const result: OAuthVerificationResult = {
      service,
      status: 'invalid',
      errorCode: 'AUTH_UNAUTHORIZED_DOMAIN',
      httpStatus: 403,
      errorTitle: 'Web Preview Domain Not in Firebase Allowlist',
      errorDescription: 'Google AI Studio preview domains (*.run.app / aistudio.google.com) are not added to the Firebase Authentication domain allowlist. This does NOT affect Android APK devices.',
      actionRequired: 'Click "Chrome Bridge" below to authorize directly, or authorize on your Android device.',
      lastCheckedAt: now,
      rawDetails: rawMsg
    };
    logOAuthError({
      service,
      category: 'token_exchange',
      severity: 'warn',
      errorCode: result.errorCode!,
      httpStatus: 403,
      errorTitle: result.errorTitle,
      errorDescription: result.errorDescription,
      rawDetails: rawMsg,
      origin
    });
    return result;
  }

  // 10. Offline / Network Connectivity
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('offline')) {
    const result: OAuthVerificationResult = {
      service,
      status: 'invalid',
      errorCode: 'NETWORK_CONNECTION_FAILURE',
      httpStatus: 0,
      errorTitle: 'Google Server Unreachable',
      errorDescription: 'Unable to reach Google OAuth / API endpoints. Device may be offline or DNS resolution failed.',
      actionRequired: 'Verify internet connection and retry once online.',
      lastCheckedAt: now,
      rawDetails: rawMsg
    };
    logOAuthError({
      service,
      category: 'network',
      severity: 'warn',
      errorCode: result.errorCode!,
      httpStatus: 0,
      errorTitle: result.errorTitle,
      errorDescription: result.errorDescription,
      rawDetails: rawMsg,
      origin
    });
    return result;
  }

  // 10. Fallback with preserved message
  const genericResult: OAuthVerificationResult = {
    service,
    status: 'invalid',
    errorCode: 'OAUTH_ERROR_GENERIC',
    httpStatus: error?.status || null,
    errorTitle: 'Workspace Authentication Error',
    errorDescription: rawMsg || 'An unknown error occurred while communicating with Google Workspace APIs.',
    actionRequired: 'Click Re-authenticate to refresh OAuth credentials and verify connectivity.',
    lastCheckedAt: now,
    rawDetails: rawMsg
  };
  logOAuthError({
    service,
    category: 'token_exchange',
    severity: 'error',
    errorCode: genericResult.errorCode!,
    httpStatus: genericResult.httpStatus,
    errorTitle: genericResult.errorTitle,
    errorDescription: genericResult.errorDescription,
    rawDetails: rawMsg,
    origin
  });
  return genericResult;
}

// Memory cache for verification results to prevent continuous ping loops
const verificationCache: Record<string, { result: OAuthVerificationResult; cachedAt: number }> = {};

/**
 * Performs real-time active verification of Google Workspace OAuth credentials
 * against Google servers with latency timing and scope validation.
 */
export async function verifyWorkspaceOAuth(service: WorkspaceServiceType, forceNetworkPing: boolean = false): Promise<OAuthVerificationResult> {
  const nowTime = Date.now();
  if (!forceNetworkPing && verificationCache[service]) {
    const cached = verificationCache[service];
    // Return cached result if fresh within 5 minutes and was valid
    if (nowTime - cached.cachedAt < 300000 && cached.result.status === 'valid') {
      return cached.result;
    }
  }

  const startTime = Date.now();
  const now = new Date().toLocaleTimeString();

  // Step 1: Check localStorage presence
  const tokenKey = service === 'sheets' ? STORAGE_KEY_SHEETS_TOKEN : STORAGE_KEY_DRIVE_TOKEN;
  const expiresKey = service === 'sheets' ? STORAGE_KEY_SHEETS_EXPIRES : STORAGE_KEY_DRIVE_EXPIRES;
  const emailKey = service === 'sheets' ? STORAGE_KEY_SHEETS_EMAIL : STORAGE_KEY_DRIVE_EMAIL;

  let rawToken: string | null = null;
  let expiresStr: string | null = null;
  let userEmail: string | undefined = undefined;

  try {
    rawToken = localStorage.getItem(tokenKey);
    expiresStr = localStorage.getItem(expiresKey);
    userEmail = localStorage.getItem(emailKey) || undefined;
  } catch (storageErr) {
    return {
      service,
      status: 'invalid',
      errorCode: 'LOCAL_STORAGE_UNAVAILABLE',
      httpStatus: null,
      errorTitle: 'Local Storage Inaccessible',
      errorDescription: 'Browser local storage cannot be read (possibly blocked by privacy settings).',
      actionRequired: 'Enable cookies and local site data in browser settings.',
      lastCheckedAt: now
    };
  }

  if (!rawToken || rawToken.startsWith('falcon_offline_session_')) {
    if (rawToken && rawToken.startsWith('falcon_offline_session_')) {
      // Clean up fake dummy token
      if (service === 'sheets') clearSheetsToken();
      if (service === 'drive') clearDriveToken();
    }
    return {
      service,
      status: 'missing',
      errorCode: 'AUTH_NO_TOKEN',
      httpStatus: null,
      errorTitle: `${service === 'sheets' ? 'Google Sheets' : 'Google Drive'} Not Authenticated`,
      errorDescription: 'No active Google OAuth credential was found in this terminal.',
      actionRequired: 'Click Authenticate to grant Google Workspace access.',
      lastCheckedAt: now
    };
  }

  // Step 2: Smart token check & Automatic Silent Refresh
  let expiresAt = expiresStr ? parseInt(expiresStr, 10) : (Date.now() + 30 * 24 * 3600 * 1000);

  // If local timestamp seems expired or close, attempt automatic silent refresh first
  if (expiresAt && Date.now() > expiresAt - 30000) {
    try {
      const silentToken = await refreshGoogleWorkspaceTokenSilently(userEmail);
      if (silentToken) {
        rawToken = silentToken;
        expiresAt = Date.now() + 3600 * 1000;
      } else {
        if (service === 'sheets') {
          const synced = await syncSheetsTokenFromCloud();
          if (synced && synced.token && !synced.token.startsWith('falcon_offline_session_')) {
            rawToken = synced.token;
            expiresAt = synced.expiresAt;
          }
        } else {
          const synced = await syncDriveTokenFromCloud();
          if (synced && synced.token && !synced.token.startsWith('falcon_offline_session_')) {
            rawToken = synced.token;
            expiresAt = synced.expiresAt;
          }
        }
      }
    } catch {}
  }

  const secondsRemaining = expiresAt ? Math.round((expiresAt - Date.now()) / 1000) : 0;
  const expiresAtFormatted = expiresAt ? new Date(expiresAt).toLocaleTimeString() : undefined;

  // Check online status before network fetch
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      service,
      status: 'invalid',
      errorCode: 'NETWORK_OFFLINE',
      httpStatus: 0,
      errorTitle: 'Offline Mode Active',
      errorDescription: 'Device is disconnected from the internet. Real-time Google OAuth verification paused.',
      actionRequired: 'Reconnect to the internet to verify live Google Workspace credentials.',
      verifiedEmail: userEmail,
      expiresInSeconds: secondsRemaining,
      lastCheckedAt: now
    };
  }

  // Step 3: Real-time Ping Google Tokeninfo endpoint
  let scopesGranted: string[] = [];
  let tokenInfoEmail: string | undefined = userEmail;

  try {
    const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(rawToken || '')}`, {
      method: 'GET'
    });

    const latencyMs = Date.now() - startTime;

    if (!tokenInfoRes.ok) {
      const errJson = await tokenInfoRes.json().catch(() => ({}));
      const rawText = errJson.error_description || errJson.error || `HTTP ${tokenInfoRes.status}`;

      if (tokenInfoRes.status === 400 || tokenInfoRes.status === 401) {
        return {
          service,
          status: 'invalid',
          errorCode: 'HTTP_401_INVALID_TOKEN',
          httpStatus: tokenInfoRes.status,
          errorTitle: 'Token Rejected by Google',
          errorDescription: `Google authentication server rejected the credential (${rawText}).`,
          actionRequired: 'Click Re-authenticate to re-issue valid authorization credentials.',
          verifiedEmail: userEmail,
          latencyMs,
          lastCheckedAt: now,
          rawDetails: rawText
        };
      }

      return parseWorkspaceOAuthError(new Error(rawText), service);
    }

    const tokenData = await tokenInfoRes.json();
    tokenInfoEmail = tokenData.email || userEmail;
    const scopeStr = tokenData.scope || '';
    scopesGranted = scopeStr.split(' ').filter(Boolean);

    // Google confirmed token is valid: silently update local storage expiration without re-broadcasting sync events
    if (tokenData.expires_in) {
      const freshExpires = parseInt(tokenData.expires_in, 10);
      const expiresAtVal = Date.now() + Math.max(freshExpires, 3600) * 1000;
      try {
        localStorage.setItem(expiresKey, expiresAtVal.toString());
      } catch {}
    }

    // Validate Scope for the service
    const hasSheetsScope = scopesGranted.some(s => s.includes('spreadsheets'));
    const hasDriveScope = scopesGranted.some(s => s.includes('drive.file') || s.includes('drive'));

    if (service === 'sheets' && !hasSheetsScope) {
      return {
        service,
        status: 'invalid',
        errorCode: 'HTTP_403_INSUFFICIENT_SCOPES',
        httpStatus: 403,
        errorTitle: 'Missing Google Sheets Permission',
        errorDescription: 'The active token is valid, but lacks the "https://www.googleapis.com/auth/spreadsheets" scope.',
        actionRequired: 'Click Re-authenticate and grant spreadsheet access in the consent prompt.',
        verifiedEmail: tokenInfoEmail,
        scopesGranted,
        latencyMs,
        lastCheckedAt: now
      };
    }

    if (service === 'drive' && !hasDriveScope) {
      return {
        service,
        status: 'invalid',
        errorCode: 'HTTP_403_INSUFFICIENT_SCOPES',
        httpStatus: 403,
        errorTitle: 'Missing Google Drive Permission',
        errorDescription: 'The active token lacks the "https://www.googleapis.com/auth/drive.file" scope.',
        actionRequired: 'Click Re-authenticate and grant Google Drive file access in the consent prompt.',
        verifiedEmail: tokenInfoEmail,
        scopesGranted,
        latencyMs,
        lastCheckedAt: now
      };
    }
  } catch (netErr: any) {
    return parseWorkspaceOAuthError(netErr, service);
  }

  // Step 4: Live Probe of Target Workspace Resource
  try {
    const liveStartTime = Date.now();

    if (service === 'sheets') {
      const spreadsheetId = localStorage.getItem(STORAGE_KEY_SHEETS_SPREADSHEET_ID);
      const spreadsheetTitle = localStorage.getItem('falcon_gsheets_spreadsheet_title') || undefined;

      if (spreadsheetId) {
        const sheetRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties.title`,
          {
            headers: { Authorization: `Bearer ${rawToken}` }
          }
        );

        const latencyMs = Date.now() - startTime;

        if (!sheetRes.ok) {
          const errText = await sheetRes.text().catch(() => '');
          if (sheetRes.status === 404) {
            return {
              service,
              status: 'invalid',
              errorCode: 'HTTP_404_SPREADSHEET_NOT_FOUND',
              httpStatus: 404,
              errorTitle: 'Target Spreadsheet Not Found',
              errorDescription: `Google Sheet ID (${spreadsheetId}) does not exist or was deleted.`,
              actionRequired: 'Click "Create Master Sheet" or paste a valid Google Sheet ID.',
              verifiedEmail: tokenInfoEmail,
              scopesGranted,
              latencyMs,
              lastCheckedAt: now,
              resourceDetails: { spreadsheetId, spreadsheetTitle }
            };
          }
          if (sheetRes.status === 403) {
            return {
              service,
              status: 'invalid',
              errorCode: 'HTTP_403_SPREADSHEET_ACCESS_DENIED',
              httpStatus: 403,
              errorTitle: 'Spreadsheet Access Denied',
              errorDescription: `Account ${tokenInfoEmail} does not have edit access to this spreadsheet.`,
              actionRequired: 'Ensure the sheet is shared with edit rights, or Re-authenticate with the owner account.',
              verifiedEmail: tokenInfoEmail,
              scopesGranted,
              latencyMs,
              lastCheckedAt: now,
              resourceDetails: { spreadsheetId, spreadsheetTitle }
            };
          }
          return parseWorkspaceOAuthError(new Error(`HTTP ${sheetRes.status}: ${errText}`), service);
        }

        const sheetData = await sheetRes.json().catch(() => ({}));
        const validSheetsResult: OAuthVerificationResult = {
          service: 'sheets',
          status: 'valid',
          errorCode: null,
          httpStatus: 200,
          errorTitle: 'Google Sheets Active & Verified',
          errorDescription: `Live connection verified. Linked to "${sheetData.properties?.title || spreadsheetTitle || 'Falcon POS Sheet'}".`,
          actionRequired: 'OAuth credentials valid. Ready for automatic synchronization.',
          verifiedEmail: tokenInfoEmail,
          expiresInSeconds: secondsRemaining,
          expiresAtFormatted,
          scopesGranted,
          latencyMs,
          lastCheckedAt: now,
          resourceDetails: {
            spreadsheetId,
            spreadsheetTitle: sheetData.properties?.title || spreadsheetTitle
          }
        };
        verificationCache['sheets'] = { result: validSheetsResult, cachedAt: Date.now() };
        return validSheetsResult;
      }

      // No spreadsheet ID linked yet, but token itself is 100% verified
      const latencyMs = Date.now() - startTime;
      const validAuthSheetsResult: OAuthVerificationResult = {
        service: 'sheets',
        status: 'valid',
        errorCode: null,
        httpStatus: 200,
        errorTitle: 'Google Sheets Authorized',
        errorDescription: 'OAuth credentials verified. Ready to create or link a Google Spreadsheet.',
        actionRequired: 'Click "Create Master Sheet" to generate your workshop spreadsheet.',
        verifiedEmail: tokenInfoEmail,
        expiresInSeconds: secondsRemaining,
        expiresAtFormatted,
        scopesGranted,
        latencyMs,
        lastCheckedAt: now
      };
      verificationCache['sheets'] = { result: validAuthSheetsResult, cachedAt: Date.now() };
      return validAuthSheetsResult;
    }

    if (service === 'drive') {
      const folderId = localStorage.getItem(STORAGE_KEY_DRIVE_FOLDER_ID) || undefined;
      const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
        headers: { Authorization: `Bearer ${rawToken}` }
      });

      const latencyMs = Date.now() - startTime;

      if (!aboutRes.ok) {
        const errText = await aboutRes.text().catch(() => '');
        return parseWorkspaceOAuthError(new Error(`HTTP ${aboutRes.status}: ${errText}`), service);
      }

      const aboutData = await aboutRes.json().catch(() => ({}));
      const userDisplayName = aboutData.user?.displayName || tokenInfoEmail;

      const validDriveResult: OAuthVerificationResult = {
        service: 'drive',
        status: 'valid',
        errorCode: null,
        httpStatus: 200,
        errorTitle: 'Google Drive Active & Verified',
        errorDescription: `Live Google Drive API verified for ${userDisplayName}. Ready for database cloud backups.`,
        actionRequired: 'OAuth credentials valid. Ready for automated backups.',
        verifiedEmail: tokenInfoEmail,
        expiresInSeconds: secondsRemaining,
        expiresAtFormatted,
        scopesGranted,
        latencyMs,
        lastCheckedAt: now,
        resourceDetails: { folderId }
      };
      verificationCache['drive'] = { result: validDriveResult, cachedAt: Date.now() };
      return validDriveResult;
    }
  } catch (err: any) {
    return parseWorkspaceOAuthError(err, service);
  }

  return {
    service,
    status: 'valid',
    errorCode: null,
    httpStatus: 200,
    errorTitle: 'Verified',
    errorDescription: 'Credentials verified.',
    actionRequired: 'No action required.',
    lastCheckedAt: now
  };
}

/**
 * Perform re-authentication for the specified service with prompt: 'select_account'
 */
export async function reauthenticateWorkspaceService(
  _service: WorkspaceServiceType,
  preferredEmail?: string
): Promise<string> {
  const email = preferredEmail || ALLOWED_SHEETS_OWNER_EMAIL;
  // Clear cached tokens first so fresh authorization is requested
  clearSheetsToken();
  clearDriveToken();

  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ];

  const res = await performUniversalGoogleSignIn({
    preferredEmail: email,
    scopes
  });

  if (res?.accessToken) {
    storeSheetsToken(res.accessToken, 3600, email);
    storeDriveToken(res.accessToken, 3600, email);
    notifyWorkspaceSyncUpdated();
    return res.accessToken;
  }
  throw new Error('Google authorization completed without returning an access token.');
}
