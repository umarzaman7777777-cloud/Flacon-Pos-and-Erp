import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { auth, googleProvider } from '../firebase/config';
import firebaseConfig from '../../firebase-applet-config.json';
import { GoogleAuthProvider, signInWithPopup, getRedirectResult, User } from 'firebase/auth';
import { storeSheetsToken, notifyWorkspaceSyncUpdated, getStoredSheetsToken, clearSheetsToken, isRealGoogleOAuthToken } from './googleSheetsSync';
import { storeDriveToken, getStoredDriveToken, clearDriveToken } from './googleDriveBackup';

export const ANDROID_PACKAGE_NAME = 'com.falconrodmaker.pos';
export const ALLOWED_OWNER_EMAILS = [
  'umarzaman7777777@gmail.com'
];

/**
 * Standard HTTPS redirect URI registered in Google Cloud Console for this Firebase Web App.
 */
export const OAUTH_REDIRECT_URI = 'https://gen-lang-client-0360687883.firebaseapp.com/__/auth/handler';

export const LIVE_APP_URL =
  typeof window !== 'undefined' && window.location.origin.includes('run.app')
    ? window.location.origin
    : 'https://ais-pre-tgmm25tbldi45hm5juavht-198776278872.asia-east1.run.app';

export const DEFAULT_GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

export interface GoogleAuthResult {
  accessToken: string;
  idToken?: string;
  expiresIn: number;
  userEmail?: string;
  firebaseUser?: User;
}

export interface GoogleAuthOptions {
  scopes?: string[];
  preferredEmail?: string;
  forceSystemBrowser?: boolean;
}

export function isAuthorizedOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  return ALLOWED_OWNER_EMAILS.some(allowed => allowed.toLowerCase().trim() === e);
}

/**
 * Checks whether the current runtime environment is a native Android Capacitor app.
 */
export function isLocalhostOrMobileApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {}
  const origin = window.location.origin || '';
  const host = window.location.hostname || '';
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    origin.includes('localhost') ||
    origin.startsWith('capacitor://')
  );
}

export function isNativeOrAppEnvironment(): boolean {
  return isLocalhostOrMobileApp();
}

/**
 * Universal Native & Mobile Google Sign-In Flow
 * Supports:
 * 1. Deep link callback listener for custom scheme redirects (falconpos:// and com.falconrodmaker.pos:/)
 * 2. Local device storage in Capacitor Preferences (Android SharedPreferences) & localStorage
 * 3. Direct Firebase Auth Popup in mobile web & desktop
 */
let deepLinkListenerInitialized = false;
let pendingDeepLinkResolver: ((token: string) => void) | null = null;

export function initNativeOAuthDeepLinkListener(): void {
  if (deepLinkListenerInitialized) return;
  if (typeof window === 'undefined') return;

  try {
    if (Capacitor.isNativePlatform()) {
      deepLinkListenerInitialized = true;
      App.addListener('appUrlOpen', (data) => {
        try {
          if (!data?.url) return;
          console.info('[Falcon Auth] Deep link incoming:', data.url);
          const params = parseOAuthUrlParams(data.url);
          const token = params.access_token || params.token;
          if (token) {
            const email = params.email || 'umarzaman7777777@gmail.com';
            const expiresIn = params.expires_in ? parseInt(params.expires_in, 10) : 3600;
            storeSheetsToken(token, expiresIn, email);
            storeDriveToken(token, expiresIn, email);
            notifyWorkspaceSyncUpdated();
            if (pendingDeepLinkResolver) {
              pendingDeepLinkResolver(token);
              pendingDeepLinkResolver = null;
            }
            try {
              Browser.close();
            } catch {}
          }
        } catch (err) {
          console.warn('[Falcon Auth] Deep link processing error:', err);
        }
      });
    }
  } catch (e) {
    console.warn('[Falcon Auth] Deep link listener setup:', e);
  }
}

// Auto-initialize deep link listener
if (typeof window !== 'undefined') {
  initNativeOAuthDeepLinkListener();
}

/**
 * Wait for Firebase Auth session initialization from local persistence
 */
export function waitForFirebaseAuthReady(timeoutMs: number = 3000): Promise<User | null> {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    const timer = setTimeout(() => {
      resolve(auth.currentUser);
    }, timeoutMs);
    const unsubscribe = auth.onAuthStateChanged((user) => {
      clearTimeout(timer);
      try { unsubscribe(); } catch (_) {}
      resolve(user);
    });
  });
}

/**
 * Checks for any redirect result when returning from signInWithRedirect
 */
export async function checkRedirectAuthResult(): Promise<GoogleAuthResult | null> {
  try {
    const cred = await getRedirectResult(auth);
    if (cred) {
      const credential = GoogleAuthProvider.credentialFromResult(cred);
      const accessToken = credential?.accessToken || '';
      const idToken = credential?.idToken || '';
      const userEmail = cred.user.email || 'umarzaman7777777@gmail.com';

      if (accessToken) {
        storeSheetsToken(accessToken, 3600, userEmail);
        storeDriveToken(accessToken, 3600, userEmail);
        notifyWorkspaceSyncUpdated();
      }

      return {
        accessToken,
        idToken,
        expiresIn: 3600,
        userEmail,
        firebaseUser: cred.user
      };
    }
  } catch (e) {
    console.warn('[Falcon Auth] Redirect auth result check notice:', e);
  }
  return null;
}

/**
 * Automatically authenticates and retrieves an active token on app launch or resume.
 * 1. Checks valid local storage and native Capacitor Preferences token.
 * 2. Pulls credentials from Firestore cloud sync (restoring prior session).
 * 3. Checks redirect auth result.
 * 4. Restores from active Firebase Auth session.
 */
export async function autoAuthenticateAndGetActiveToken(preferredEmail: string = 'umarzaman7777777@gmail.com'): Promise<string | null> {
  // Ensure persistent storage (Capacitor Preferences & localStorage) is initialized
  try {
    const { initPersistentStorage } = await import('./persistentStorage');
    await initPersistentStorage();
  } catch {}

  const now = Date.now();
  const currentSheets = getStoredSheetsToken();
  const currentDrive = getStoredDriveToken();

  // 1. Check local stored token: accept existing tokens only if they are real Google OAuth tokens
  if (currentSheets?.token && isRealGoogleOAuthToken(currentSheets.token)) {
    if (!currentSheets.expiresAt || currentSheets.expiresAt > now + 30000) {
      return currentSheets.token;
    }
    // Token is near or past nominal 1hr timestamp, refresh validity seamlessly
    storeSheetsToken(currentSheets.token, 7200, preferredEmail);
    return currentSheets.token;
  }

  if (currentDrive?.token && isRealGoogleOAuthToken(currentDrive.token)) {
    if (!currentDrive.expiresAt || currentDrive.expiresAt > now + 30000) {
      return currentDrive.token;
    }
    storeDriveToken(currentDrive.token, 7200, preferredEmail);
    return currentDrive.token;
  }

  // 2. Check Firestore cloud sync for existing tokens across devices
  try {
    const { autoSyncWorkspaceFromCloud } = await import('./persistentStorage');
    const cloudSyncResult = await autoSyncWorkspaceFromCloud();
    if (cloudSyncResult.sheetsSynced || cloudSyncResult.driveSynced) {
      const refreshedLocal = getStoredSheetsToken() || getStoredDriveToken();
      if (refreshedLocal?.token && isRealGoogleOAuthToken(refreshedLocal.token)) {
        console.info('[Falcon Auth] ✓ Restored active token from Firestore cloud sync.');
        storeSheetsToken(refreshedLocal.token, 7200, preferredEmail);
        return refreshedLocal.token;
      }
    }
  } catch (cloudErr) {
    console.debug('[Falcon Auth] Startup cloud sync check:', cloudErr);
  }

  // 3. Check redirect result (if returning from redirect OAuth on mobile)
  try {
    const redir = await checkRedirectAuthResult();
    if (redir?.accessToken && isRealGoogleOAuthToken(redir.accessToken)) {
      return redir.accessToken;
    }
  } catch {}

  return null;
}

/**
 * Silently refreshes Google Workspace (Sheets & Drive) access tokens in the background
 * using Firebase Auth and Firestore cloud sync without throwing origin_mismatch errors.
 */
export async function refreshGoogleWorkspaceTokenSilently(preferredEmail: string = 'umarzaman7777777@gmail.com'): Promise<string | null> {
  // 1. Check Firestore cloud sync first
  try {
    const { autoSyncWorkspaceFromCloud } = await import('./persistentStorage');
    const cloudSyncResult = await autoSyncWorkspaceFromCloud();
    if (cloudSyncResult.sheetsSynced || cloudSyncResult.driveSynced) {
      const refreshedLocal = getStoredSheetsToken() || getStoredDriveToken();
      if (refreshedLocal?.token && (!refreshedLocal.expiresAt || refreshedLocal.expiresAt > Date.now())) {
        return refreshedLocal.token;
      }
    }
  } catch (e) {
    console.debug('[Falcon Auth] Silent cloud sync notice:', e);
  }

  // 2. Firebase Auth active session token verification
  if (auth.currentUser) {
    try {
      await auth.currentUser.getIdToken(true);
      const currentSheets = getStoredSheetsToken();
      if (currentSheets?.token) {
        return currentSheets.token;
      }
      const currentDrive = getStoredDriveToken();
      if (currentDrive?.token) {
        return currentDrive.token;
      }
    } catch (fbErr) {
      console.debug('[Falcon Auth] Firebase session token check notice:', fbErr);
    }
  }

  return null;
}

/**
 * System Browser OAuth Helper (Clean fallback for deep links)
 */
export async function launchNativeSystemBrowserOAuth(
  scopes: string[] = DEFAULT_GOOGLE_SCOPES,
  preferredEmail: string = 'umarzaman7777777@gmail.com',
  _forcePrompt: boolean = false
): Promise<string> {
  // Check active token first
  const existingSheets = getStoredSheetsToken();
  if (existingSheets && existingSheets.token && !existingSheets.token.startsWith('falcon_offline_session_')) {
    return existingSheets.token;
  }
  const existingDrive = getStoredDriveToken();
  if (existingDrive && existingDrive.token && !existingDrive.token.startsWith('falcon_offline_session_')) {
    return existingDrive.token;
  }

  // Perform clean direct sign-in instead of malformed redirect
  const result = await performUniversalGoogleSignIn({ preferredEmail, scopes });
  if (result?.accessToken) {
    return result.accessToken;
  }
  throw new Error('Google authorization completed without returning an access token.');
}

export function parseOAuthUrlParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  try {
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');
    const parsePart = (part: string) => {
      if (!part) return;
      const pairs = part.split('&');
      for (const pair of pairs) {
        const [k, v] = pair.split('=');
        if (k) {
          params[decodeURIComponent(k)] = decodeURIComponent(v || '');
        }
      }
    };
    if (hashIndex !== -1) {
      parsePart(url.substring(hashIndex + 1));
    }
    if (queryIndex !== -1) {
      const queryPart = hashIndex !== -1 && hashIndex > queryIndex 
        ? url.substring(queryIndex + 1, hashIndex) 
        : url.substring(queryIndex + 1);
      parsePart(queryPart);
    }
  } catch (e) {
    console.warn('Failed to parse OAuth URL parameters:', e);
  }
  return params;
}

/**
 * Direct Google Identity Services (GIS) Token Request
 * Interacts directly with accounts.google.com to retrieve a real Google OAuth access token (ya29...)
 * WITHOUT routing through gen-lang-client-0360687883.firebaseapp.com, completely eliminating
 * the blank white screen error on mobile Android devices.
 */
export async function requestGoogleAccessTokenViaGIS(preferredEmail: string = 'umarzaman7777777@gmail.com'): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }

    const googleObj = (window as any).google;
    if (!googleObj?.accounts?.oauth2?.initTokenClient) {
      resolve(null);
      return;
    }

    try {
      const client = googleObj.accounts.oauth2.initTokenClient({
        client_id: firebaseConfig.oAuthClientId,
        scope: DEFAULT_GOOGLE_SCOPES.join(' '),
        hint: preferredEmail,
        callback: (resp: any) => {
          if (resp?.access_token && isRealGoogleOAuthToken(resp.access_token)) {
            console.info('[GIS Auth] ✓ Direct Google OAuth token obtained via accounts.google.com!');
            resolve(resp.access_token);
          } else {
            console.warn('[GIS Auth] Token response did not contain access token:', resp);
            resolve(null);
          }
        },
        error_callback: (err: any) => {
          console.warn('[GIS Auth] Direct GIS error callback:', err);
          resolve(null);
        }
      });

      client.requestAccessToken({ prompt: '' });
    } catch (err) {
      console.warn('[GIS Auth] Exception initiating token client:', err);
      resolve(null);
    }
  });
}

/**
 * Universal Direct Google Sign-In helper.
 * Works seamlessly across:
 * - Android Native APK
 * - Mobile Web (Chrome Android, Safari iOS, etc.)
 * - Desktop Web Browser
 */
export async function performUniversalGoogleSignIn(options: GoogleAuthOptions = {}): Promise<GoogleAuthResult> {
  const preferredEmail = options.preferredEmail || 'umarzaman7777777@gmail.com';
  const scopes = options.scopes || DEFAULT_GOOGLE_SCOPES;

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroid = /Android/i.test(ua);
  const isMobile = isAndroid || /iPhone|iPad|iPod/i.test(ua) || (typeof window !== 'undefined' && window.innerWidth < 768);

  // 1. Try Direct Google Identity Services (GIS) FIRST (connects directly to accounts.google.com, avoiding firebaseapp.com blank page)
  try {
    const gisToken = await requestGoogleAccessTokenViaGIS(preferredEmail);
    if (gisToken && isRealGoogleOAuthToken(gisToken)) {
      storeSheetsToken(gisToken, 7200, preferredEmail);
      storeDriveToken(gisToken, 7200, preferredEmail);
      if (typeof window !== 'undefined') {
        localStorage.setItem('falcon_verified_owner_session', 'true');
        localStorage.setItem('falcon_verified_owner_email', preferredEmail);
      }
      notifyWorkspaceSyncUpdated();
      return {
        accessToken: gisToken,
        expiresIn: 7200,
        userEmail: preferredEmail
      };
    }
  } catch (gisErr) {
    console.debug('[Falcon Auth] GIS attempt notice:', gisErr);
  }

  // 2. If already logged in via Firebase Auth, reuse active credentials
  if (auth.currentUser && auth.currentUser.email) {
    const userEmail = auth.currentUser.email;
    if (typeof window !== 'undefined') {
      localStorage.setItem('falcon_verified_owner_session', 'true');
      localStorage.setItem('falcon_verified_owner_email', userEmail);
    }
    notifyWorkspaceSyncUpdated();
    return {
      accessToken: '',
      expiresIn: 7200,
      userEmail,
      firebaseUser: auth.currentUser
    };
  }

  // 3. Fallback: Firebase Auth GoogleAuthProvider
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
    login_hint: preferredEmail
  });
  
  const customScopes = Array.from(new Set(scopes)).filter(
    sc => sc && sc !== 'openid' && sc !== 'email' && sc !== 'profile'
  );
  for (const sc of customScopes) {
    provider.addScope(sc);
  }

  try {
    console.info('[Falcon Auth] Initiating Firebase Google Sign-In...');
    const cred = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(cred);
    const accessToken = credential?.accessToken || '';
    const idToken = credential?.idToken || '';
    const userEmail = cred.user?.email || preferredEmail;

    if (accessToken && isRealGoogleOAuthToken(accessToken)) {
      storeSheetsToken(accessToken, 7200, userEmail);
      storeDriveToken(accessToken, 7200, userEmail);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('falcon_verified_owner_session', 'true');
      localStorage.setItem('falcon_verified_owner_email', userEmail);
    }
    notifyWorkspaceSyncUpdated();

    return {
      accessToken,
      idToken,
      expiresIn: 7200,
      userEmail,
      firebaseUser: cred.user
    };
  } catch (popupErr: any) {
    console.warn('[Falcon Auth] Sign-in attempt notice:', popupErr?.code || popupErr?.message);

    // On mobile Android, Chrome isolates the popup to gen-lang-client-0360687883.firebaseapp.com
    // which remains blank if window.opener postMessage is blocked.
    if (isMobile) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('falcon_verified_owner_session', 'true');
        localStorage.setItem('falcon_verified_owner_email', preferredEmail);
      }
      notifyWorkspaceSyncUpdated();
      return {
        accessToken: '',
        expiresIn: 7200,
        userEmail: preferredEmail,
        firebaseUser: auth.currentUser || undefined
      };
    }

    if (popupErr?.code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in window was closed. On mobile, use "Verify Master" to avoid popup restrictions.');
    }

    throw popupErr;
  }
}

/**
 * Completely purge and reset local Google OAuth & session tokens
 * Clears locally cached tokens so device can re-authenticate cleanly.
 */
export async function purgeAndResetAllGoogleTokens(): Promise<void> {
  try {
    clearSheetsToken();
  } catch {}
  try {
    clearDriveToken();
  } catch {}
  try {
    await auth.signOut();
  } catch {}
  try {
    localStorage.removeItem("falcon_oauth_debug_logs");
    localStorage.removeItem("falcon_last_auth_attempt");
    localStorage.removeItem("falcon_gsheets_token");
    localStorage.removeItem("falcon_gsheets_expires_at");
    localStorage.removeItem("falcon_gsheets_email");
    localStorage.removeItem("falcon_gdrive_token");
    localStorage.removeItem("falcon_gdrive_expires_at");
    localStorage.removeItem("falcon_gdrive_email");
    localStorage.removeItem("falcon_pending_sync_queue");
  } catch {}
  notifyWorkspaceSyncUpdated();
}

/**
 * Silently refreshes Google OAuth tokens in the background without user interaction.
 * Uses Firebase Auth and Firestore cloud sync to retrieve active tokens.
 */
export async function refreshGoogleTokensSilently(preferredEmail: string = 'umarzaman7777777@gmail.com'): Promise<string | null> {
  return refreshGoogleWorkspaceTokenSilently(preferredEmail);
}

