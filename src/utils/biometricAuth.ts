/**
 * Falcon Rod Maker POS - Hardware Biometric & Fingerprint Authentication
 * Uses native Android BiometricPrompt (via @aparajita/capacitor-biometric-auth)
 * on mobile devices, with W3C WebAuthn Level 2 for web browsers.
 *
 * CRITICAL RULE: This module NEVER fakes or auto-approves authentication.
 * It strictly requires a genuine hardware biometric confirmation from the OS.
 */

import { Capacitor } from '@capacitor/core';
import {
  BiometricAuth,
  BiometryType,
  AndroidBiometryStrength,
  BiometryError,
  BiometryErrorType
} from '@aparajita/capacitor-biometric-auth';
import { hapticTap, hapticTransactionComplete, hapticError } from './haptics';

export interface BiometricStatus {
  supported: boolean;
  hasPlatformSensor: boolean;
  isEnrolled: boolean;
  isSecureContext: boolean;
  isMobileDevice: boolean;
  mode: 'native' | 'webauthn' | 'none';
  biometryName?: string;
  reason?: string;
}

// Helper to encode ArrayBuffer to base64url string
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper to decode base64url string to Uint8Array
function base64ToUint8(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

function isValidDomain(host: string): boolean {
  if (!host || host === 'localhost') return false;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return false;
  if (host.includes(':')) return false;
  return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(host);
}

export function isMobile(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const hasTouchScreen = Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
  return isMobileUserAgent || hasTouchScreen || Capacitor.isNativePlatform();
}

/**
 * Checks biometric capabilities on the device.
 */
export async function checkBiometricSupport(): Promise<BiometricStatus> {
  const isNative = Capacitor.isNativePlatform();
  const mobile = isMobile();
  const isSec = typeof window !== 'undefined' ? (window.isSecureContext ?? true) : false;

  // 1. Native Capacitor check (Android APK)
  if (isNative) {
    try {
      const check = await BiometricAuth.checkBiometry();
      const hasBio = check.isAvailable || check.strongBiometryIsAvailable;
      return {
        supported: true,
        hasPlatformSensor: check.biometryType !== BiometryType.none,
        isEnrolled: hasBio,
        isSecureContext: true,
        isMobileDevice: true,
        mode: 'native',
        biometryName: check.biometryType === BiometryType.fingerprintAuthentication
          ? 'Fingerprint Scanner'
          : check.biometryType === BiometryType.faceAuthentication
          ? 'Face Unlock'
          : 'Biometric Sensor',
        reason: hasBio
          ? 'Hardware sensor enrolled and standby.'
          : check.reason || 'Biometric hardware detected. Please ensure fingerprint is enrolled in Android Settings.'
      };
    } catch (err: any) {
      console.warn('Native biometric check error:', err);
    }
  }

  // 2. Web browser WebAuthn check
  if (typeof window !== 'undefined' && window.PublicKeyCredential && isSec) {
    try {
      const hasPlatformSensor = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      const hasEnrolled = !!localStorage.getItem('falcon_fingerprint_cred_id');
      return {
        supported: true,
        hasPlatformSensor,
        isEnrolled: hasEnrolled,
        isSecureContext: isSec,
        isMobileDevice: mobile,
        mode: 'webauthn',
        biometryName: mobile ? 'Side-Mount Sensor' : 'Biometric Sensor',
        reason: hasPlatformSensor
          ? (mobile ? 'Side-mount hardware sensor ready.' : 'Hardware biometric sensor ready.')
          : 'Biometric hardware sensor standby.'
      };
    } catch (err: any) {
      console.warn('WebAuthn platform sensor check error:', err);
    }
  }

  // 3. Fallback for environments without biometric hardware
  return {
    supported: false,
    hasPlatformSensor: false,
    isEnrolled: false,
    isSecureContext: isSec,
    isMobileDevice: mobile,
    mode: 'none',
    reason: 'Biometric sensor not available in this environment. Use 4-digit PIN.'
  };
}

/**
 * Invokes native hardware biometric authentication.
 * Android OS will present its BiometricPrompt dialog and WAIT for the user to touch the sensor.
 * NEVER returns success without genuine OS verification.
 */
export async function authenticateWithFingerprint(
  userEmail: string = 'umarzaman7777777@gmail.com'
): Promise<{ success: boolean; message: string; enrolledNow?: boolean }> {
  if (typeof window === 'undefined') {
    return {
      success: false,
      message: 'Browser environment required.'
    };
  }

  // -------------------------------------------------------------
  // PATH 1: Native Android Capacitor Biometric Authentication
  // -------------------------------------------------------------
  if (Capacitor.isNativePlatform()) {
    try {
      // First check if biometry is enrolled
      const check = await BiometricAuth.checkBiometry();
      if (!check.isAvailable && !check.strongBiometryIsAvailable) {
        hapticError();
        return {
          success: false,
          message: check.reason || 'No fingerprint enrolled in Android phone settings. Please register your fingerprint in Android Settings > Security > Fingerprint, or use 4-digit PIN (321).'
        };
      }

      // Android OS will open the BiometricPrompt dialog and WAIT for the user's finger.
      await BiometricAuth.authenticate({
        reason: 'Place your registered finger on the sensor to unlock Falcon POS',
        androidTitle: 'Falcon Rod Maker POS',
        androidSubtitle: 'Biometric Security Verification',
        cancelTitle: 'Use PIN',
        allowDeviceCredential: false, // Strict biometric authentication only
        androidBiometryStrength: AndroidBiometryStrength.weak,
        androidConfirmationRequired: false
      });

      // If execution reaches here, Android OS officially verified the fingerprint!
      hapticTransactionComplete();
      localStorage.setItem('falcon_device_touch_enrolled', 'true');
      localStorage.setItem('falcon_fingerprint_user', userEmail);

      return {
        success: true,
        message: 'Fingerprint verified successfully by phone sensor!'
      };
    } catch (err: any) {
      console.warn('Native BiometricAuth.authenticate error:', err);
      hapticError();

      // Check specific error types from Android OS
      const code = err?.code || '';
      if (code === BiometryErrorType.userCancel || code === BiometryErrorType.appCancel) {
        return {
          success: false,
          message: 'Biometric scan was cancelled. Please touch sensor to try again or use PIN.'
        };
      }
      if (code === BiometryErrorType.authenticationFailed) {
        return {
          success: false,
          message: 'Fingerprint was not recognized. Please place your registered finger carefully.'
        };
      }
      if (code === BiometryErrorType.biometryLockout) {
        return {
          success: false,
          message: 'Too many unsuccessful attempts. Biometric sensor is temporarily locked. Please use 4-digit PIN (321).'
        };
      }
      if (code === BiometryErrorType.biometryNotEnrolled) {
        return {
          success: false,
          message: 'No fingerprint is enrolled on this phone. Please enroll in Android Settings or use PIN.'
        };
      }

      return {
        success: false,
        message: err?.message || 'Fingerprint verification failed. Please try again or use 4-digit PIN.'
      };
    }
  }

  // -------------------------------------------------------------
  // PATH 2: Web Browser W3C WebAuthn Level 2
  // -------------------------------------------------------------
  const hasWebAuthn = !!(window.PublicKeyCredential && typeof navigator.credentials?.create === 'function');
  const savedCredId = localStorage.getItem('falcon_fingerprint_cred_id');

  if (hasWebAuthn && window.isSecureContext) {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      // 1. Try assertion if already registered on this browser
      if (savedCredId) {
        try {
          const credBytes = base64ToUint8(savedCredId);
          const assertion = await navigator.credentials.get({
            publicKey: {
              challenge,
              allowCredentials: [
                {
                  id: credBytes.buffer as ArrayBuffer,
                  type: 'public-key'
                }
              ],
              userVerification: 'required',
              timeout: 60000
            }
          });

          if (assertion) {
            hapticTransactionComplete();
            return {
              success: true,
              message: 'Fingerprint verified!'
            };
          }
        } catch (getErr: any) {
          if (getErr?.name === 'NotAllowedError') {
            hapticError();
            return {
              success: false,
              message: 'Sensor scan was cancelled. Touch sensor again or use PIN.'
            };
          }
          console.warn('Assertion failed, falling through to enrollment:', getErr);
        }
      }

      // 2. Register credential on this browser
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);
      const hostname = window.location.hostname;
      const rpId = isValidDomain(hostname) ? hostname : undefined;

      const createOptions: CredentialCreationOptions = {
        publicKey: {
          challenge,
          rp: {
            name: 'Falcon Rod Maker POS',
            ...(rpId ? { id: rpId } : {})
          },
          user: {
            id: userId,
            name: userEmail,
            displayName: 'Falcon Owner'
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred'
          },
          timeout: 60000
        }
      };

      const newCredential = (await navigator.credentials.create(createOptions)) as PublicKeyCredential | null;
      if (newCredential && newCredential.rawId) {
        const b64 = bufferToBase64(newCredential.rawId);
        localStorage.setItem('falcon_fingerprint_cred_id', b64);
        localStorage.setItem('falcon_fingerprint_user', userEmail);
        localStorage.setItem('falcon_device_touch_enrolled', 'true');
        hapticTransactionComplete();
        return {
          success: true,
          enrolledNow: true,
          message: 'Fingerprint verified and enrolled on this device!'
        };
      }
    } catch (err: any) {
      hapticError();
      if (err?.name === 'NotAllowedError') {
        return {
          success: false,
          message: 'Sensor scan was cancelled or timed out. Please touch sensor to try again or use PIN.'
        };
      }
      return {
        success: false,
        message: err?.message || 'Biometric scan could not be completed. Please use 4-digit PIN (321).'
      };
    }
  }

  // -------------------------------------------------------------
  // PATH 3: If no biometric hardware is available in this browser
  // -------------------------------------------------------------
  // CRITICAL: NEVER AUTO-APPROVE! Always require the user to use their PIN or Google login.
  hapticError();
  return {
    success: false,
    message: 'Hardware biometric scanner not supported in this browser. Please enter your 4-digit PIN (321) to unlock.'
  };
}

/**
 * Clears stored biometric credential to allow re-enrolling
 */
export function clearStoredBiometrics() {
  localStorage.removeItem('falcon_fingerprint_cred_id');
  localStorage.removeItem('falcon_fingerprint_user');
  localStorage.removeItem('falcon_device_touch_enrolled');
}

export const clearBiometricEnrollment = clearStoredBiometrics;
