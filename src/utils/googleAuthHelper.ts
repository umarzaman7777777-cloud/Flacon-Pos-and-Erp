import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { auth, googleProvider } from '../firebase/config';
import { GoogleAuthProvider, signInWithPopup, getRedirectResult, User } from 'firebase/auth';
import { storeSheetsToken, notifyWorkspaceSyncUpdated, getStoredSheetsToken, clearSheetsToken } from './googleSheetsSync';
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

export function isAuthorizedOwnerEmail(_email?: string | null): boolean {
  return true;
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
 * Silently refreshes Google Workspace (Sheets & Drive) access tokens in the background
 * without showing 2FA notifications, dialogs, or disrupting the workshop terminal.
 */
export async function refreshGoogleWorkspaceTokenSilently(preferredEmail: string = 'umarzaman7777777@gmail.com'): Promise<string | null> {
  // 1. Google Identity Services (GIS) silent token refresh (Web & Chrome)
  if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
    try {
      const scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ];
      const token = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Silent refresh timed out')), 6000);
        try {
          const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: '614229042433-9uj9cvog5bn4fv6476r6nc1ho6a4rsfs.apps.googleusercontent.com',
            scope: scopes.join(' '),
            hint: preferredEmail,
            prompt: '', // Empty prompt = silent background request without 2FA or popup!
            callback: (resp: any) => {
              clearTimeout(timer);
              if (resp?.access_token) {
                resolve(resp.access_token);
              } else {
                reject(new Error(resp?.error_description || resp?.error || 'No token returned'));
              }
            }
          });
          tokenClient.requestAccessToken({ prompt: '' });
        } catch (initErr) {
          clearTimeout(timer);
          reject(initErr);
        }
      });

      if (token) {
        storeSheetsToken(token, 3600, preferredEmail);
        storeDriveToken(token, 3600, preferredEmail);
        notifyWorkspaceSyncUpdated();
        console.info('[Falcon Auth] ✓ Google Workspace token refreshed silently in background.');
        return token;
      }
    } catch (silentErr) {
      console.debug('[Falcon Auth] GIS silent refresh notice:', silentErr);
    }
  }

  // 2. Firebase Auth active session fallback
  if (auth.currentUser) {
    try {
      await auth.currentUser.getIdToken(true);
      const currentSheets = getStoredSheetsToken();
      if (currentSheets?.token) {
        storeSheetsToken(currentSheets.token, 3600, preferredEmail);
      }
      const currentDrive = getStoredDriveToken();
      if (currentDrive?.token) {
        storeDriveToken(currentDrive.token, 3600, preferredEmail);
      }
      return currentSheets?.token || currentDrive?.token || null;
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
 * Universal Direct Google Sign-In helper.
 * Works seamlessly across:
 * - Android Native APK
 * - Mobile Web (Chrome Android, Safari iOS, etc.)
 * - Desktop Web Browser
 */
export async function performUniversalGoogleSignIn(options: GoogleAuthOptions = {}): Promise<GoogleAuthResult> {
  const preferredEmail = options.preferredEmail || 'umarzaman7777777@gmail.com';
  const scopes = options.scopes || DEFAULT_GOOGLE_SCOPES;

  // Configure Google Auth Provider with clean, deduplicated scopes
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
    login_hint: preferredEmail
  });
  
  // Google automatically includes openid, email, and profile; only add unique custom scopes
  const customScopes = Array.from(new Set(scopes)).filter(
    sc => sc && sc !== 'openid' && sc !== 'email' && sc !== 'profile'
  );
  for (const sc of customScopes) {
    provider.addScope(sc);
  }

  // 1. Direct Clean Google Sign-In (Firebase Auth Direct Popup)
  try {
    console.info('[Falcon Auth] Initiating Clean Direct Google Sign-In...');
    const cred = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(cred);
    const accessToken = credential?.accessToken || '';
    const idToken = credential?.idToken || '';
    const userEmail = cred.user.email || preferredEmail;

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
  } catch (popupErr: any) {
    console.warn('[Falcon Auth] Direct sign-in attempt notice:', popupErr?.code || popupErr?.message);

    // 2. Google Identity Services (GIS) Token Client Fallback (Web)
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      try {
        console.info('[Falcon Auth] Using Google Identity Services (GIS) direct authorization...');
        const token = await new Promise<string>((resolve, reject) => {
          const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: '614229042433-9uj9cvog5bn4fv6476r6nc1ho6a4rsfs.apps.googleusercontent.com',
            scope: scopes.join(' '),
            hint: preferredEmail,
            prompt: 'select_account',
            callback: (resp: any) => {
              if (resp.error) {
                reject(new Error(resp.error_description || resp.error));
              } else if (resp.access_token) {
                resolve(resp.access_token);
              } else {
                reject(new Error('No access token received from Google Identity Services.'));
              }
            }
          });
          tokenClient.requestAccessToken();
        });

        if (token) {
          storeSheetsToken(token, 3600, preferredEmail);
          storeDriveToken(token, 3600, preferredEmail);
          notifyWorkspaceSyncUpdated();
          return {
            accessToken: token,
            expiresIn: 3600,
            userEmail: preferredEmail
          };
        }
      } catch (gisErr) {
        console.warn('[Falcon Auth] GIS client attempt notice:', gisErr);
      }
    }

    if (popupErr?.code === 'auth/popup-blocked') {
      throw new Error('Google Sign-In popup was blocked by your browser. Please tap "Allow Popups" or try again directly.');
    }
    if (popupErr?.code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in window was closed before completion. Please tap Sign In again.');
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
 * Uses Google Identity Services with prompt: '' to fetch a fresh token seamlessly.
 */
export async function refreshGoogleTokensSilently(preferredEmail: string = 'umarzaman7777777@gmail.com'): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // 1. Try Google Identity Services (GIS) Token Client silently
  if ((window as any).google?.accounts?.oauth2) {
    try {
      const freshToken = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Silent refresh timed out')), 8000);
        try {
          const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: '614229042433-9uj9cvog5bn4fv6476r6nc1ho6a4rsfs.apps.googleusercontent.com',
            scope: DEFAULT_GOOGLE_SCOPES.join(' '),
            hint: preferredEmail,
            prompt: '', // Silent background refresh: no consent prompt
            callback: (resp: any) => {
              clearTimeout(timeout);
              if (resp.access_token) {
                resolve(resp.access_token);
              } else {
                reject(new Error(resp.error || 'No token in silent response'));
              }
            }
          });
          tokenClient.requestAccessToken({ prompt: '' });
        } catch (e) {
          clearTimeout(timeout);
          reject(e);
        }
      });

      if (freshToken) {
        storeSheetsToken(freshToken, 3600, preferredEmail);
        storeDriveToken(freshToken, 3600, preferredEmail);
        notifyWorkspaceSyncUpdated();
        return freshToken;
      }
    } catch (e) {
      console.info('[Falcon Auth] Silent background refresh notice:', e);
    }
  }

  return null;
}

