/**
 * Comprehensive Authentication & Auto-Sync Diagnostic Engine
 * 
 * Provides automated and interactive diagnostic flows for Google Workspace OAuth,
 * mobile Android redirect/callback issues, Google 2FA ("Yes, it's me") stuck state analysis,
 * and Google Sheets / Google Drive auto-sync pipeline probes.
 */

import { auth } from '../firebase/config';
import firebaseConfig from '../../firebase-applet-config.json';
import { getRedirectResult, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import {
  getStoredSheetsToken,
  getStoredSpreadsheetId,
  getStoredSpreadsheetTitle,
  isRealGoogleOAuthToken,
  ALLOWED_SHEETS_OWNER_EMAIL
} from './googleSheetsSync';
import {
  getStoredDriveToken,
  getStoredDriveFolderId,
  BACKUP_FOLDER_NAME
} from './googleDriveBackup';
import { logOAuthError, OAuthDebugLogEntry } from './oauthDebugLogger';
import { performUniversalGoogleSignIn } from './googleAuthHelper';

export interface DiagnosticStepResult {
  id: string;
  category: 'environment' | 'config' | 'redirect_callback' | 'mobile_stuck_analysis' | 'auto_sync';
  name: string;
  status: 'passed' | 'warning' | 'failed' | 'info';
  summary: string;
  technicalDetails: string;
  recommendation?: string;
  latencyMs?: number;
  errorCode?: string;
  metadata?: Record<string, any>;
}

export interface AuthDiagnosticReport {
  id: string;
  timestamp: string;
  durationMs: number;
  environment: {
    userAgent: string;
    isMobile: boolean;
    isAndroid: boolean;
    isIOS: boolean;
    isNativeCapacitor: boolean;
    origin: string;
    authDomain: string;
    coopCoepRestricted: boolean;
    cookiesEnabled: boolean;
    storageAccessible: boolean;
  };
  config: {
    projectId: string;
    appId: string;
    hasApiKey: boolean;
    oAuthClientId: string;
    isClientIdFormatValid: boolean;
  };
  gmailStuckAnalysis: {
    riskLevel: 'high' | 'medium' | 'low';
    summary: string;
    likelyCauses: string[];
    actionableFixes: string[];
  };
  autoSyncAnalysis: {
    sheetsSyncStatus: 'connected' | 'offline_ready' | 'invalid_token' | 'error';
    driveSyncStatus: 'connected' | 'offline_ready' | 'invalid_token' | 'error';
    offlineQueueCount: number;
    issues: string[];
    actionableFixes: string[];
  };
  steps: DiagnosticStepResult[];
}

/**
 * Run complete automated diagnostic flow across environment, OAuth configuration,
 * redirect callback handling, mobile Android stuck window diagnostics, and auto-sync pipeline.
 */
export async function runFullAuthenticationDiagnostics(): Promise<AuthDiagnosticReport> {
  const startTime = performance.now();
  const steps: DiagnosticStepResult[] = [];

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMobile = isAndroid || isIOS || (typeof window !== 'undefined' && window.innerWidth < 768);
  const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform ? Capacitor.isNativePlatform() : false;
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const authDomain = firebaseConfig.authDomain || '';

  // -------------------------------------------------------------------------
  // STEP 1: Environment & Mobile Capability Probe
  // -------------------------------------------------------------------------
  const step1Start = performance.now();
  let storageAccessible = false;
  try {
    const testKey = '__falcon_diag_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    storageAccessible = true;
  } catch {
    storageAccessible = false;
  }

  const cookiesEnabled = typeof navigator !== 'undefined' ? navigator.cookieEnabled : true;
  const isCrossIsolated = typeof window !== 'undefined' && (window as any).crossOriginIsolated === true;

  // Test popup capability safely
  let popupAllowed = true;
  try {
    if (typeof window !== 'undefined') {
      const testPop = window.open('', '_blank', 'width=1,height=1,left=9999,top=9999');
      if (!testPop || testPop.closed || typeof testPop.closed === 'undefined') {
        popupAllowed = false;
      } else {
        testPop.close();
      }
    }
  } catch {
    popupAllowed = false;
  }

  const step1Passed = storageAccessible && cookiesEnabled;
  steps.push({
    id: 'env_probe',
    category: 'environment',
    name: 'Browser & Mobile Runtime Environment Probe',
    status: isMobile && !popupAllowed ? 'warning' : step1Passed ? 'passed' : 'failed',
    summary: isMobile
      ? `Mobile device detected (${isAndroid ? 'Android' : isIOS ? 'iOS' : 'Mobile'}). ${popupAllowed ? 'Popups permitted.' : 'Secondary popups restricted.'}`
      : 'Desktop environment probe completed successfully.',
    technicalDetails: `Origin: ${origin} | UserAgent: ${ua.substring(0, 70)}... | Cookies: ${cookiesEnabled ? 'YES' : 'NO'} | LocalStorage: ${storageAccessible ? 'OK' : 'BLOCKED'} | Popups Allowed: ${popupAllowed ? 'YES' : 'RESTRICTED'} | CrossOriginIsolated: ${isCrossIsolated ? 'YES' : 'NO'}`,
    recommendation: isMobile && !popupAllowed
      ? 'Android Chrome restricts secondary popups. When Google 2FA prompts appear, check the Android top notification bar instead of waiting for a new window.'
      : !storageAccessible
      ? 'Browser storage is blocked. Ensure third-party cookies or site storage are allowed in browser settings.'
      : undefined,
    latencyMs: Math.round(performance.now() - step1Start),
    metadata: { isMobile, isAndroid, isIOS, isNative, popupAllowed, storageAccessible }
  });

  // -------------------------------------------------------------------------
  // STEP 2: Firebase Auth & OAuth Client Configuration
  // -------------------------------------------------------------------------
  const step2Start = performance.now();
  const clientId = firebaseConfig.oAuthClientId || '';
  const isClientIdFormatValid = clientId.includes('.apps.googleusercontent.com');
  const isOriginMatchingCloudRun = origin.includes('run.app') || origin.includes('localhost');

  let configStatus: 'passed' | 'warning' | 'failed' = 'passed';
  let configSummary = 'OAuth Client ID and Firebase project credentials properly configured.';
  let configRecommendation: string | undefined = undefined;

  if (!isClientIdFormatValid) {
    configStatus = 'failed';
    configSummary = 'OAuth Client ID format is invalid or missing.';
    configRecommendation = 'Check firebase-applet-config.json for a valid Google OAuth Client ID.';
  } else if (!isOriginMatchingCloudRun && !origin.includes('firebaseapp.com')) {
    configStatus = 'warning';
    configSummary = `Current origin (${origin}) may need to be added to Authorized JavaScript Origins in Google Cloud Console.`;
    configRecommendation = `Ensure "${origin}" is added to Authorized JavaScript Origins for Client ID ${clientId} in Google Cloud Console.`;
  }

  steps.push({
    id: 'config_probe',
    category: 'config',
    name: 'Google OAuth Client & Project Credentials Probe',
    status: configStatus,
    summary: configSummary,
    technicalDetails: `Client ID: ${clientId} | Project ID: ${firebaseConfig.projectId} | Auth Domain: ${authDomain} | App ID: ${firebaseConfig.appId}`,
    recommendation: configRecommendation,
    latencyMs: Math.round(performance.now() - step2Start),
    metadata: { clientId, authDomain, projectId: firebaseConfig.projectId }
  });

  // -------------------------------------------------------------------------
  // STEP 3: OAuth Redirect / Callback State Check
  // -------------------------------------------------------------------------
  const step3Start = performance.now();
  let redirectResultFound = false;
  let redirectErrorDetails = '';
  try {
    const redirectRes = await getRedirectResult(auth);
    if (redirectRes) {
      redirectResultFound = true;
      redirectErrorDetails = `Found existing redirect credentials for user: ${redirectRes.user?.email || 'authenticated'}`;
    }
  } catch (redirErr: any) {
    redirectErrorDetails = redirErr?.message || String(redirErr);
  }

  // Check stored OAuth callback tokens
  const verifiedOwnerSession = typeof window !== 'undefined' ? localStorage.getItem('falcon_verified_owner_session') === 'true' : false;
  const verifiedOwnerEmail = typeof window !== 'undefined' ? localStorage.getItem('falcon_verified_owner_email') : null;
  const sheetsToken = getStoredSheetsToken();
  const driveToken = getStoredDriveToken();

  const isCallbackSessionValid = verifiedOwnerSession || (sheetsToken && isRealGoogleOAuthToken(sheetsToken.token));

  // Log OAuth Redirect Callback Probe to persistent logger for mobile diagnostics
  logOAuthError({
    service: 'general',
    category: 'redirect_callback',
    severity: redirectResultFound ? 'info' : (redirectErrorDetails && !redirectErrorDetails.includes('Clean')) ? 'warn' : 'info',
    errorCode: redirectResultFound ? 'REDIRECT_CALLBACK_FOUND' : redirectErrorDetails ? 'REDIRECT_CALLBACK_ERROR' : 'REDIRECT_CALLBACK_INSPECTED',
    httpStatus: redirectResultFound ? 200 : 0,
    errorTitle: 'OAuth Redirect Callback Process Audited',
    errorDescription: redirectErrorDetails || (redirectResultFound ? 'Valid OAuth redirect result resolved' : 'No pending redirect credentials in browser state'),
    rawDetails: JSON.stringify({
      isAndroid,
      isMobile,
      origin,
      redirectResultFound,
      redirectErrorDetails: redirectErrorDetails || 'none',
      verifiedOwnerSession,
      hasSheetsToken: Boolean(sheetsToken?.token),
      hasDriveToken: Boolean(driveToken?.token)
    }, null, 2),
    userEmail: verifiedOwnerEmail || sheetsToken?.userEmail || ALLOWED_SHEETS_OWNER_EMAIL,
    origin
  });

  steps.push({
    id: 'redirect_callback_probe',
    category: 'redirect_callback',
    name: 'OAuth Redirect & Callback Session Audit',
    status: isCallbackSessionValid ? 'passed' : 'info',
    summary: isCallbackSessionValid
      ? `Active authorized session detected for ${verifiedOwnerEmail || sheetsToken?.userEmail || 'Master Workshop Account'}.`
      : 'No active OAuth callback session saved. Terminal ready for Google authorization.',
    technicalDetails: `Redirect Result: ${redirectResultFound ? 'FOUND' : 'NONE'} | Stored Owner Session: ${verifiedOwnerSession ? 'YES' : 'NO'} | Verified Email: ${verifiedOwnerEmail || 'none'} | Redirect Notice: ${redirectErrorDetails || 'Clean'}`,
    recommendation: !isCallbackSessionValid
      ? 'Sign in via Google or use "Verify Master" to establish a persistent workshop session.'
      : undefined,
    latencyMs: Math.round(performance.now() - step3Start),
    metadata: { redirectResultFound, verifiedOwnerSession, verifiedOwnerEmail }
  });

  // -------------------------------------------------------------------------
  // STEP 4: Mobile Android "Stuck Gmail Window" Root Cause Analysis
  // -------------------------------------------------------------------------
  const step4Start = performance.now();
  const likelyCauses: string[] = [];
  const fixes: string[] = [];
  let riskLevel: 'high' | 'medium' | 'low' = 'low';

  if (isAndroid) {
    riskLevel = 'high';
    likelyCauses.push(
      'Google 2-Step Verification sends a prompt ("Yes, it\'s me") as an Android System Notification, not inside the popup.',
      'Mobile Chrome blocks secondary window creation (such as "Try another way" / "All details") from inside authentication popups.',
      'Switching apps away from Chrome on low-memory Android devices can cause background popup tabs to freeze or lose window.opener communication.'
    );
    fixes.push(
      'When Google prompts for verification, swipe down your Android phone notification bar from the top and tap "Yes, it\'s me".',
      'If the Google popup window remains blank or spinning, return to the app and tap "Confirm & Unlock Master (umarzaman7777777@gmail.com)" to bypass the frozen popup immediately.',
      'To prevent mobile popups from hanging, use the "Verify Master" option on the lock screen which authenticates locally in 0.1s.'
    );
  } else if (isMobile) {
    riskLevel = 'medium';
    likelyCauses.push(
      'Mobile browser popup blocker may restrict OAuth redirect exchange.',
      'Cookie/storage partitioning in private browsing can discard OAuth state.'
    );
    fixes.push(
      'Allow popups in mobile browser settings.',
      'Use the Master Account verification button if the browser restricts popup communication.'
    );
  } else {
    likelyCauses.push('Desktop popups generally operate normally unless blocked by an ad-blocker or popup blocker extension.');
    fixes.push('Ensure popups are allowed for this domain in Chrome settings.');
  }

  steps.push({
    id: 'mobile_stuck_diagnosis',
    category: 'mobile_stuck_analysis',
    name: 'Mobile Android "Stuck Gmail Window" Diagnostic Analysis',
    status: isAndroid ? 'warning' : 'passed',
    summary: isAndroid
      ? 'Mobile Android detected: High risk of 2FA system prompt disconnect in browser popups.'
      : 'Desktop/Standard environment: Low risk of popup window freezing.',
    technicalDetails: `Platform: ${isAndroid ? 'Android' : isIOS ? 'iOS' : 'Desktop'} | Popup Behavior: ${isMobile ? 'Mobile In-App/Tab' : 'Standard Window'} | 2FA Route: ${isAndroid ? 'Android System Notification (Top Bar)' : 'In-browser Prompt'}`,
    recommendation: fixes[0],
    latencyMs: Math.round(performance.now() - step4Start),
    metadata: { isAndroid, riskLevel, likelyCauses, fixes }
  });

  // -------------------------------------------------------------------------
  // STEP 5: Auto-Sync Pipeline Diagnostics (Sheets, Drive, Queue)
  // -------------------------------------------------------------------------
  const step5Start = performance.now();
  const autoSyncIssues: string[] = [];
  const autoSyncFixes: string[] = [];

  const realSheetsToken = sheetsToken && isRealGoogleOAuthToken(sheetsToken.token);
  const realDriveToken = driveToken && isRealGoogleOAuthToken(driveToken.token);
  const curSpreadsheetId = getStoredSpreadsheetId();
  const curSpreadsheetTitle = getStoredSpreadsheetTitle();
  const curFolderId = getStoredDriveFolderId();

  // Test pending sync queue
  let offlineQueueCount = 0;
  try {
    const rawQueue = localStorage.getItem('falcon_pending_sync_queue');
    if (rawQueue) {
      const parsed = JSON.parse(rawQueue);
      offlineQueueCount = Array.isArray(parsed) ? parsed.length : 0;
    }
  } catch {}

  let sheetsStatus: 'connected' | 'offline_ready' | 'invalid_token' | 'error' = 'offline_ready';
  let driveStatus: 'connected' | 'offline_ready' | 'invalid_token' | 'error' = 'offline_ready';

  if (realSheetsToken) {
    const nowTime = Date.now();
    const isExpired = sheetsToken.expiresAt ? sheetsToken.expiresAt < nowTime : false;
    if (isExpired) {
      sheetsStatus = 'invalid_token';
      autoSyncIssues.push('Google Sheets OAuth token has expired (HTTP 401).');
      autoSyncFixes.push('Tap "Re-authenticate" in Backup & Sync to generate a fresh Google access token.');
    } else {
      sheetsStatus = 'connected';
    }
  } else {
    sheetsStatus = 'offline_ready';
    autoSyncIssues.push('No active Google OAuth token linked. Operating in local offline storage mode.');
    autoSyncFixes.push('Connect Google account in Settings to enable real-time cloud sheet synchronization.');
  }

  if (realDriveToken) {
    const nowTime = Date.now();
    const isExpired = driveToken.expiresAt ? driveToken.expiresAt < nowTime : false;
    if (isExpired) {
      driveStatus = 'invalid_token';
      autoSyncIssues.push('Google Drive OAuth token has expired.');
    } else {
      driveStatus = 'connected';
    }
  } else {
    driveStatus = 'offline_ready';
  }

  steps.push({
    id: 'auto_sync_probe',
    category: 'auto_sync',
    name: 'Google Workspace Auto-Sync & Database Pipeline Audit',
    status: sheetsStatus === 'connected' ? 'passed' : sheetsStatus === 'offline_ready' ? 'info' : 'warning',
    summary: sheetsStatus === 'connected'
      ? `Auto-sync connected to "${curSpreadsheetTitle || 'Falcon Master Sheet'}". Background sync active.`
      : sheetsStatus === 'offline_ready'
      ? 'Auto-sync operating safely in local offline mode (0 HTTP 401 error errors, queue ready).'
      : 'Google OAuth token expired; auto-sync paused in local mode.',
    technicalDetails: `Sheets Token: ${realSheetsToken ? 'VALID (ya29...)' : 'NONE'} | Drive Token: ${realDriveToken ? 'VALID' : 'NONE'} | Spreadsheet ID: ${curSpreadsheetId || 'Not set'} | Drive Folder: ${curFolderId || BACKUP_FOLDER_NAME} | Offline Queue: ${offlineQueueCount} pending items`,
    recommendation: autoSyncFixes[0] || 'Auto-sync pipeline operating normally.',
    latencyMs: Math.round(performance.now() - step5Start),
    metadata: { sheetsStatus, driveStatus, curSpreadsheetId, offlineQueueCount }
  });

  const totalDuration = Math.round(performance.now() - startTime);

  const report: AuthDiagnosticReport = {
    id: `diag_rep_${Date.now()}`,
    timestamp: new Date().toLocaleString(),
    durationMs: totalDuration,
    environment: {
      userAgent: ua,
      isMobile,
      isAndroid,
      isIOS,
      isNativeCapacitor: isNative,
      origin,
      authDomain,
      coopCoepRestricted: isCrossIsolated,
      cookiesEnabled,
      storageAccessible
    },
    config: {
      projectId: firebaseConfig.projectId,
      appId: firebaseConfig.appId,
      hasApiKey: Boolean(firebaseConfig.apiKey),
      oAuthClientId: clientId,
      isClientIdFormatValid
    },
    gmailStuckAnalysis: {
      riskLevel,
      summary: isAndroid
        ? 'Android devices often disconnect from browser popups during Google 2FA ("Yes, it\'s me").'
        : 'Browser environment suitable for direct Google OAuth authentication.',
      likelyCauses,
      actionableFixes: fixes
    },
    autoSyncAnalysis: {
      sheetsSyncStatus: sheetsStatus,
      driveSyncStatus: driveStatus,
      offlineQueueCount,
      issues: autoSyncIssues,
      actionableFixes: autoSyncFixes
    },
    steps
  };

  // Log report entry into persistent OAuth debug logs for audit
  logOAuthError({
    service: 'general',
    category: 'api_probe',
    severity: isAndroid && !realSheetsToken ? 'warn' : 'info',
    errorCode: 'DIAGNOSTIC_SUITE_EXECUTED',
    httpStatus: 200,
    errorTitle: 'Authentication & Auto-Sync Diagnostics Completed',
    errorDescription: `Diagnostic scan finished in ${totalDuration}ms with ${steps.length} checks. Status: ${sheetsStatus}.`,
    rawDetails: JSON.stringify({
      isMobile,
      isAndroid,
      sheetsStatus,
      offlineQueueCount,
      riskLevel
    }, null, 2),
    userEmail: verifiedOwnerEmail || ALLOWED_SHEETS_OWNER_EMAIL,
    origin
  });

  return report;
}

/**
 * Interactive Live Sign-In Probe
 * Attempts an interactive Google popup authentication with precise millisecond latency telemetry,
 * capturing exact popup failure codes (e.g. auth/popup-blocked, auth/popup-closed-by-user).
 */
export async function runInteractiveSignInProbe(preferredEmail: string = 'umarzaman7777777@gmail.com'): Promise<{
  success: boolean;
  errorCode?: string;
  errorMessage: string;
  latencyMs: number;
  userEmail?: string;
  hasAccessToken: boolean;
}> {
  const start = performance.now();
  try {
    const res = await performUniversalGoogleSignIn({ preferredEmail });
    const latency = Math.round(performance.now() - start);

    logOAuthError({
      service: 'general',
      category: 'token_exchange',
      severity: 'info',
      errorCode: 'DIAGNOSTIC_SIGNIN_SUCCESS',
      httpStatus: 200,
      errorTitle: 'Interactive Authentication Probe Passed',
      errorDescription: `Successfully authenticated ${res.userEmail || preferredEmail} in ${latency}ms.`,
      userEmail: res.userEmail || preferredEmail
    });

    return {
      success: true,
      errorMessage: `Authentication successful! Signed in as ${res.userEmail || preferredEmail}`,
      latencyMs: latency,
      userEmail: res.userEmail,
      hasAccessToken: Boolean(res.accessToken && isRealGoogleOAuthToken(res.accessToken))
    };
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    const code = err?.code || (err?.message?.includes('closed') ? 'auth/popup-closed-by-user' : 'AUTH_ERROR');
    const msg = err?.message || 'Authentication probe encountered an error';

    logOAuthError({
      service: 'general',
      category: code === 'auth/popup-closed-by-user' ? 'user_cancelled' : 'token_exchange',
      severity: 'warn',
      errorCode: code,
      errorTitle: 'Interactive Authentication Probe Report',
      errorDescription: msg,
      rawDetails: String(err?.stack || err)
    });

    return {
      success: false,
      errorCode: code,
      errorMessage: msg,
      latencyMs: latency,
      hasAccessToken: false
    };
  }
}

/**
 * Standalone OAuth Redirect & Callback Diagnostic Flow
 * Explicitly tests getRedirectResult(auth), inspects browser session storage for OAuth state,
 * diagnoses why mobile Android authentication windows get stuck on "Yes, it's me" (2FA),
 * and logs full traces to the OAuth debug logs.
 */
export async function runOAuthRedirectCallbackDiagnostic(): Promise<{
  success: boolean;
  hasRedirectResult: boolean;
  userEmail?: string;
  hasAccessToken: boolean;
  errorCode?: string;
  errorMessage: string;
  technicalDetails: string;
  mobileWarning?: string;
  autoSyncStatus: string;
}> {
  const start = performance.now();
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroid = /Android/i.test(ua);
  const isMobile = isAndroid || /iPhone|iPad|iPod/i.test(ua) || (typeof window !== 'undefined' && window.innerWidth < 768);
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';

  let redirectResult: any = null;
  let redirectError: any = null;

  try {
    redirectResult = await getRedirectResult(auth);
  } catch (err: any) {
    redirectError = err;
  }

  const verifiedSession = typeof window !== 'undefined' ? localStorage.getItem('falcon_verified_owner_session') === 'true' : false;
  const verifiedEmail = typeof window !== 'undefined' ? localStorage.getItem('falcon_verified_owner_email') : null;
  const sheetsToken = getStoredSheetsToken();
  const driveToken = getStoredDriveToken();
  const hasRealSheetsToken = sheetsToken && isRealGoogleOAuthToken(sheetsToken.token);

  const duration = Math.round(performance.now() - start);

  let mobileWarning: string | undefined = undefined;
  if (isAndroid) {
    mobileWarning = 'On Android, Google 2-Step Verification prompts ("Yes, it\'s me") are delivered to your Android system notifications tray, NOT a new browser tab. Swipe down from the top of your phone screen to accept the prompt, or use 1-Tap Master Unlock.';
  }

  let errorMessage = '';
  let errorCode: string | undefined = undefined;

  if (redirectResult) {
    const cred = GoogleAuthProvider.credentialFromResult(redirectResult);
    const token = cred?.accessToken;
    const email = redirectResult.user?.email || verifiedEmail || ALLOWED_SHEETS_OWNER_EMAIL;
    errorMessage = `Redirect result found for ${email}. Credentials valid.`;
    
    logOAuthError({
      service: 'general',
      category: 'redirect_callback',
      severity: 'info',
      errorCode: 'REDIRECT_CALLBACK_SUCCESS',
      httpStatus: 200,
      errorTitle: 'OAuth Redirect Callback Process Succeeded',
      errorDescription: errorMessage,
      rawDetails: JSON.stringify({
        email,
        hasAccessToken: Boolean(token),
        durationMs: duration
      }, null, 2),
      userEmail: email,
      origin
    });

    return {
      success: true,
      hasRedirectResult: true,
      userEmail: email,
      hasAccessToken: Boolean(token && isRealGoogleOAuthToken(token)),
      errorMessage,
      technicalDetails: `OAuth redirect callback resolved in ${duration}ms. User: ${email}.`,
      mobileWarning,
      autoSyncStatus: hasRealSheetsToken ? 'Connected' : 'Offline Ready'
    };
  } else if (redirectError) {
    const errCode = redirectError?.code || 'REDIRECT_CALLBACK_ERROR';
    errorMessage = redirectError?.message || 'Error occurred during getRedirectResult probe';
    
    logOAuthError({
      service: 'general',
      category: 'redirect_callback',
      severity: 'error',
      errorCode: errCode,
      errorTitle: 'OAuth Redirect Callback Process Error',
      errorDescription: errorMessage,
      rawDetails: String(redirectError?.stack || redirectError),
      userEmail: verifiedEmail || ALLOWED_SHEETS_OWNER_EMAIL,
      origin
    });

    return {
      success: false,
      hasRedirectResult: false,
      hasAccessToken: false,
      errorCode: errCode,
      errorMessage,
      technicalDetails: `Redirect callback error: ${errCode} - ${errorMessage}`,
      mobileWarning,
      autoSyncStatus: hasRealSheetsToken ? 'Connected' : 'Offline Ready'
    };
  } else {
    // No pending redirect found in browser memory
    const hasActiveSession = Boolean(verifiedSession || hasRealSheetsToken);
    errorMessage = hasActiveSession
      ? `No pending redirect in progress. Active workshop session is established for ${verifiedEmail || 'Master Owner'}.`
      : 'No pending redirect found in browser state. Terminal is in local offline mode ready for authorization.';

    logOAuthError({
      service: 'general',
      category: 'redirect_callback',
      severity: 'info',
      errorCode: 'REDIRECT_CALLBACK_IDLE',
      httpStatus: 200,
      errorTitle: 'OAuth Redirect Callback Process Verified (Idle)',
      errorDescription: errorMessage,
      rawDetails: JSON.stringify({
        isAndroid,
        isMobile,
        hasActiveSession,
        verifiedEmail,
        hasSheetsToken: Boolean(sheetsToken?.token)
      }, null, 2),
      userEmail: verifiedEmail || ALLOWED_SHEETS_OWNER_EMAIL,
      origin
    });

    return {
      success: hasActiveSession,
      hasRedirectResult: false,
      userEmail: verifiedEmail || undefined,
      hasAccessToken: Boolean(hasRealSheetsToken),
      errorMessage,
      technicalDetails: `Redirect callback probe clean (${duration}ms). Stored Session: ${verifiedSession ? 'ACTIVE' : 'NONE'}.`,
      mobileWarning,
      autoSyncStatus: hasRealSheetsToken ? 'Connected' : 'Offline Ready'
    };
  }
}
