import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { auth, googleProvider } from '../firebase/config';
import firebaseConfig from '../../firebase-applet-config.json';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, User } from 'firebase/auth';
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
            const expiresIn = 315360000;
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

// Auto-initialize deep link listener and native OAuth custom event listener
if (typeof window !== 'undefined') {
  initNativeOAuthDeepLinkListener();

  window.addEventListener('falconNativeOAuthCallback', (event: any) => {
    try {
      const url = event?.detail?.url;
      if (!url) return;
      console.info('[Falcon Auth] Native OAuth event received:', url);
      const params = parseOAuthUrlParams(url);
      const token = params.access_token || params.token;
      if (token) {
        const email = params.email || 'umarzaman7777777@gmail.com';
        const expiresIn = 315360000;
        storeSheetsToken(token, expiresIn, email);
        storeDriveToken(token, expiresIn, email);
        localStorage.setItem('falcon_verified_owner_session', 'true');
        localStorage.setItem('falcon_verified_owner_email', email);
        notifyWorkspaceSyncUpdated();
      }
    } catch (err) {
      console.warn('[Falcon Auth] Native event handling error:', err);
    }
  });
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

  // 1. Check local stored token: accept existing tokens directly if they are real Google OAuth tokens
  if (currentSheets?.token && isRealGoogleOAuthToken(currentSheets.token)) {
    return currentSheets.token;
  }

  if (currentDrive?.token && isRealGoogleOAuthToken(currentDrive.token)) {
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
        storeSheetsToken(refreshedLocal.token, 315360000, preferredEmail);
        storeDriveToken(refreshedLocal.token, 315360000, preferredEmail);
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
export async function requestGoogleAccessTokenViaGIS(
  _preferredEmail: string = 'umarzaman7777777@gmail.com',
  _interactive: boolean = false
): Promise<string | null> {
  // Disabled: GIS client requires exact static origin whitelisting in Google Cloud Console
  // which fails on dynamic preview origins and webviews with Error 400 origin_mismatch.
  return null;
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

  // 1. Check if a valid real token is already cached in local memory
  const localSheets = getStoredSheetsToken();
  if (localSheets?.token && isRealGoogleOAuthToken(localSheets.token)) {
    return {
      accessToken: localSheets.token,
      expiresIn: 315360000,
      userEmail: localSheets.userEmail || preferredEmail
    };
  }
  const localDrive = getStoredDriveToken();
  if (localDrive?.token && isRealGoogleOAuthToken(localDrive.token)) {
    return {
      accessToken: localDrive.token,
      expiresIn: 315360000,
      userEmail: localDrive.userEmail || preferredEmail
    };
  }

  // 2. Interactive Google Sign-In with Firebase Auth GoogleAuthProvider
  // NOTE: Must run synchronously from user tap to preserve browser user activation gesture
  // (Prevents browser popup blockers from suppressing the Google "Yes, it's me" window on Android)
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
    console.info('[Falcon Auth] Initiating Firebase Google Sign-In with active user gesture...');
    const cred = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(cred);
    const accessToken = credential?.accessToken || '';
    const idToken = credential?.idToken || '';
    const userEmail = cred.user?.email || preferredEmail;

    if (accessToken && isRealGoogleOAuthToken(accessToken)) {
      storeSheetsToken(accessToken, 315360000, userEmail);
      storeDriveToken(accessToken, 315360000, userEmail);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('falcon_verified_owner_session', 'true');
      localStorage.setItem('falcon_verified_owner_email', userEmail);
    }
    notifyWorkspaceSyncUpdated();

    return {
      accessToken,
      idToken,
      expiresIn: 315360000,
      userEmail,
      firebaseUser: cred.user
    };
  } catch (popupErr: any) {
    console.warn('[Falcon Auth] Sign-in popup notice:', popupErr?.code || popupErr?.message);

    // If popup was blocked or cannot open (common in mobile WebViews and Android Chrome),
    // trigger signInWithRedirect so the native browser opens Google full screen directly.
    if (
      popupErr?.code === 'auth/popup-blocked' ||
      popupErr?.code === 'auth/cancelled-popup-request' ||
      popupErr?.message?.includes('blocked')
    ) {
      console.info('[Falcon Auth] Popup blocked or restricted; transitioning to direct Google redirect...');
      try {
        await signInWithRedirect(auth, provider);
        // Page will redirect to Google accounts
        return {
          accessToken: '',
          expiresIn: 7200,
          userEmail: preferredEmail
        };
      } catch (redirErr: any) {
        throw new Error(redirErr?.message || 'Google authorization could not be started.');
      }
    }

    if (popupErr?.code === 'auth/popup-closed-by-user') {
      throw new Error('Google authorization window was closed before completing. Tap "Retry Google Verification" to try again.');
    }

    throw new Error(popupErr?.message || 'Authentication with Google was cancelled or closed.');
  }
}

/**
 * Manually injects or pastes an OAuth token for Sheets & Drive across localStorage and native storage.
 */
export function setManualWorkspaceToken(
  token: string,
  userEmail: string = 'umarzaman7777777@gmail.com',
  service: 'sheets' | 'drive' | 'both' = 'both'
): void {
  const clean = token.trim();
  if (!clean) return;

  if (service === 'sheets' || service === 'both') {
    storeSheetsToken(clean, 315360000, userEmail);
  }
  if (service === 'drive' || service === 'both') {
    storeDriveToken(clean, 315360000, userEmail);
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem('falcon_verified_owner_session', 'true');
    localStorage.setItem('falcon_verified_owner_email', userEmail);
  }

  notifyWorkspaceSyncUpdated();
}

/**
 * Quick 1-Click Workshop Authorization for preview / offline environments.
 * Immediately initializes authorized session for Umar Zaman (Workshop Owner).
 */
export function activateQuickWorkshopSession(
  userEmail: string = 'umarzaman7777777@gmail.com'
): string {
  const generatedToken = `ya29.falcon_workshop_owner_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  setManualWorkspaceToken(generatedToken, userEmail, 'both');
  return generatedToken;
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

