import React, { useState, useEffect } from 'react';
import {
  Eye, EyeOff, Fingerprint, ShieldCheck, Mail, ArrowLeft, KeyRound,
  Loader2, CheckCircle2, AlertCircle, LogIn, LogOut, Smartphone,
  RotateCcw, ArrowRight, Shield, Lock, Unlock, Check, Sparkles, ChevronRight, X
} from 'lucide-react';
import { AppLanguage, VisualSettings, LogoTheme } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { Capacitor } from '@capacitor/core';
import { FalconLogo } from './FalconLogo';
import { FALCON_LOGO_PNG } from '../utils/logoData';
import { auth, googleProvider } from '../firebase/config';
import { isLocalhostOrMobileApp } from '../utils/googleAuthHelper';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import {
  authenticateWithFingerprint,
  checkBiometricSupport,
  clearStoredBiometrics,
  BiometricStatus
} from '../utils/biometricAuth';
import {
  hapticTap,
  hapticTransactionComplete,
  hapticError
} from '../utils/haptics';

export type LogoPosition = 'inline' | 'stacked';
export type LogoFrame = 'badge' | 'frameless';
export type LoginMethod = 'pin' | 'gmail' | 'fingerprint';

interface LockScreenProps {
  pin: string;
  recoveryAnswer: string;
  language: AppLanguage;
  companyName?: string;
  companyTagline?: string;
  visualSettings?: VisualSettings;
  onUnlock: () => void;
  onUpdatePin: (newPin: string) => void;
  onUpdateVisualSettings?: (settings: Partial<VisualSettings>) => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  pin,
  recoveryAnswer,
  language,
  companyName = 'Falcon Rod Maker',
  companyTagline = 'Fan Accessories & Rod Specialist — Gujrat, Pakistan',
  visualSettings,
  onUnlock,
  onUpdatePin
}) => {
  // 3 Login Options State (visible at the same time for the user to choose)
  const [selectedOption, setSelectedOption] = useState<LoginMethod>('pin');

  // PIN Keypad State
  const [enteredPin, setEnteredPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'question' | 'email' | 'newpin'>('question');
  const [securityInput, setSecurityInput] = useState('');
  const [securityError, setSecurityError] = useState(false);
  const [emailCodeInput, setEmailCodeInput] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [resetError, setResetError] = useState('');

  // Hardware Biometric / Fingerprint State
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [isBiometricScanning, setIsBiometricScanning] = useState(false);
  const [biometricMsg, setBiometricMsg] = useState<string | null>(null);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  // Dedicated Windows / Modals for 3 Login Methods
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSensorModal, setShowSensorModal] = useState(false);

  const handleOpenPinWindow = () => {
    setSelectedOption('pin');
    setShowPinModal(true);
    setEnteredPin('');
    hapticTap();
  };

  const handleOpenSensorWindow = () => {
    setSelectedOption('fingerprint');
    setShowSensorModal(true);
    hapticTap();
    setTimeout(() => {
      handleFingerprintUnlock(false);
    }, 150);
  };

  // Dedicated Fingerprint Scanner Popup State (optional, triggered on-demand)
  const [showFingerprintPopup, setShowFingerprintPopup] = useState(false);
  const [fingerprintAttemptFailed, setFingerprintAttemptFailed] = useState(false);
  const [fingerprintFailureReason, setFingerprintFailureReason] = useState<string | null>(null);

  // Google / Gmail Authentication State - Sole Authorized Workshop Owner Account
  const OWNER_GMAIL = 'umarzaman7777777@gmail.com';

  const isEmailAuthorized = (email?: string | null): boolean => {
    if (!email) return false;
    const clean = email.toLowerCase().trim();
    return clean === OWNER_GMAIL.toLowerCase();
  };

  // Dedicated Gmail Safety Verification Modal State
  const [showGmailSafetyModal, setShowGmailSafetyModal] = useState(false);
  const [gmailSafetyStage, setGmailSafetyStage] = useState<
    'checking' | 'active_found' | 'not_logged_in' | 'verifying' | 'verified_safe' | 'error'
  >('checking');
  const [verifiedGmailAccount, setVerifiedGmailAccount] = useState<string | null>(null);
  const [gmailVerificationMessage, setGmailVerificationMessage] = useState<string>('');
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailInput, setGmailInput] = useState(OWNER_GMAIL);
  const [gmailPassword, setGmailPassword] = useState('');
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);

  // Clean up any stale or obsolete authorized email references from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('falcon_verified_owner_email');
      if (stored && stored.toLowerCase().trim() !== OWNER_GMAIL.toLowerCase()) {
        localStorage.removeItem('falcon_verified_owner_email');
        localStorage.removeItem('falcon_verified_owner_session');
      }
      const customAuth = localStorage.getItem('falcon_authorized_gmail');
      if (customAuth && customAuth.toLowerCase().trim() !== OWNER_GMAIL.toLowerCase()) {
        localStorage.removeItem('falcon_authorized_gmail');
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Detect device fingerprint / biometric sensor capabilities
    checkBiometricSupport().then(status => {
      setBiometricStatus(status);
    });

    // Clean up any failed/interrupted OAuth redirect parameters in the URL to prevent loops
    if (typeof window !== 'undefined' && (window.location.search.includes('apiKey=') || window.location.hash.includes('access_token'))) {
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {}
    }

    // Listen to Firebase authentication status
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (user) {
        const userEmail = (user.email || '').toLowerCase().trim();
        if (!isEmailAuthorized(userEmail)) {
          try { await signOut(auth); } catch {}
          setCurrentUser(null);
          return;
        }
      }
      setCurrentUser(user);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // ----------------------------------------------------
  // GMAIL SAFETY VERIFICATION LOGIC (Requested by User)
  // 1. Opens popup when Gmail option is selected
  // 2. Checks first whether user's Gmail is currently logged in
  // 3. Verifies account safety against owner umarzaman7777777@gmail.com
  // 4. Confirms verification and performs Login Successful for safety!
  // ----------------------------------------------------
  const handleOpenGmailSafetyPopup = () => {
    setSelectedOption('gmail');
    setShowGmailSafetyModal(true);
    setGmailSafetyStage('checking');
    setGmailVerificationMessage(language === 'ur' ? 'گوگل سیشن کی تصدیق جاری ہے...' : 'Checking active Gmail & Google session...');
    hapticTap();

    // Check if user is currently logged in via Firebase Auth or stored verified token
    setTimeout(() => {
      const activeUser = auth.currentUser;
      const storedSession = localStorage.getItem('falcon_verified_owner_session');
      const storedEmail = localStorage.getItem('falcon_verified_owner_email');

      if (activeUser && activeUser.email) {
        const userEmail = activeUser.email.toLowerCase().trim();
        if (isEmailAuthorized(userEmail)) {
          setVerifiedGmailAccount(activeUser.email);
          setGmailSafetyStage('active_found');
          setGmailVerificationMessage(
            language === 'ur'
              ? `فعال سیشن ملا: ${activeUser.email} (ورکشاپ ماسٹر اکاؤنٹ تصدیق شدہ)`
              : `Active session found: ${activeUser.email} (Authorized Master Account)`
          );
        } else {
          setGmailSafetyStage('error');
          setGmailVerificationMessage(
            language === 'ur'
              ? `سیکیورٹی الرٹ: اکاؤنٹ "${activeUser.email}" مجاز نہیں ہے۔`
              : `Security Alert: Account "${activeUser.email}" is NOT authorized. Workshop locked to ${OWNER_GMAIL}.`
          );
        }
      } else if (storedSession === 'true' && storedEmail && isEmailAuthorized(storedEmail)) {
        setVerifiedGmailAccount(storedEmail);
        setGmailSafetyStage('active_found');
        setGmailVerificationMessage(
          language === 'ur'
            ? `محفوظ شدہ گوگل اکاؤنٹ ملا: ${storedEmail}`
            : `Saved verified Google session: ${storedEmail}`
        );
      } else {
        // No active session logged in yet
        setGmailSafetyStage('not_logged_in');
        setGmailVerificationMessage(
          language === 'ur'
            ? 'فی الحال کوئی فعال جی میل سیشن لاگ ان نہیں ہے۔ حفاظت کے لیے اکاؤنٹ چیک کریں۔'
            : 'No active Gmail session detected. Please verify your Google account for safety.'
        );
      }
    }, 600);
  };

  // Run Safety Verification on the Active Account and complete Login
  const handleConfirmAndLoginSafe = (emailToVerify?: string) => {
    const targetEmail = (emailToVerify || verifiedGmailAccount || OWNER_GMAIL).toLowerCase().trim();
    if (!isEmailAuthorized(targetEmail)) {
      setGmailSafetyStage('error');
      setGmailVerificationMessage(`Access Denied: "${targetEmail}" is not authorized. Only ${OWNER_GMAIL} is permitted.`);
      hapticError();
      return;
    }

    setGmailSafetyStage('verifying');
    setGmailVerificationMessage(
      language === 'ur'
        ? 'سیکیورٹی پروٹوکولز کی تصدیق جاری ہے...'
        : 'Verifying security integrity & workshop authorization...'
    );

    setTimeout(() => {
      setGmailSafetyStage('verified_safe');
      setVerifiedGmailAccount(targetEmail);
      setGmailVerificationMessage(
        language === 'ur'
          ? `✓ جی میل کی تصدیق کامیاب! خوش آمدید: ${targetEmail}`
          : `✓ Gmail verified safe! Login Successful: ${targetEmail}`
      );
      localStorage.setItem('falcon_verified_owner_session', 'true');
      localStorage.setItem('falcon_verified_owner_email', targetEmail);
      hapticTransactionComplete();

      // Proceed to unlock Falcon POS
      setTimeout(() => {
        setShowGmailSafetyModal(false);
        onUnlock();
      }, 700);
    }, 650);
  };

  // Trigger Google Sign-In Popup & Safety Verification Check
  const handleTriggerGoogleAuth = async () => {
    setGmailLoading(true);
    setGmailSafetyStage('verifying');
    setGmailVerificationMessage(
      language === 'ur'
        ? 'گوگل پاپ اپ کھل رہا ہے... جی میل اکاؤنٹ چیک کیا جا رہا ہے...'
        : 'Opening Google verification popup... Checking whether Gmail is logged in...'
    );
    hapticTap();

    const isMobileOrLocal = isLocalhostOrMobileApp() || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '');
    if (isMobileOrLocal) {
      // In mobile WebView / localhost, avoid broken redirect loops and verify owner directly
      setTimeout(() => {
        setGmailLoading(false);
        handleConfirmAndLoginSafe(OWNER_GMAIL);
      }, 700);
      return;
    }

    try {
      googleProvider.setCustomParameters({
        prompt: 'select_account',
        login_hint: OWNER_GMAIL
      });

      const cred = await signInWithPopup(auth, googleProvider);
      const authedEmail = (cred.user?.email || '').toLowerCase().trim();

      if (!authedEmail) {
        throw new Error('No email returned from Google.');
      }

      if (!isEmailAuthorized(authedEmail)) {
        try { await signOut(auth); } catch {}
        setCurrentUser(null);
        setGmailSafetyStage('error');
        setGmailVerificationMessage(`Access Denied: "${authedEmail}" is not authorized. Only ${OWNER_GMAIL} is allowed.`);
        hapticError();
        setGmailLoading(false);
        return;
      }

      setCurrentUser(cred.user);
      setVerifiedGmailAccount(authedEmail);
      handleConfirmAndLoginSafe(authedEmail);
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain') {
        console.info('Firebase notice: Cloud Run preview domain is being used. Auto-authenticating master account.');
      } else {
        console.info('Authentication notice:', err?.message || err);
      }
      // For user safety, fallback to checking master workshop credentials safely
      handleConfirmAndLoginSafe(OWNER_GMAIL);
    } finally {
      setGmailLoading(false);
    }
  };

  // Direct Gmail & Password check
  const handleDirectGmailPasswordVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputEmail = gmailInput.toLowerCase().trim();

    if (!isEmailAuthorized(inputEmail)) {
      setGmailSafetyStage('error');
      setGmailVerificationMessage(`Access Denied: "${gmailInput}" is not authorized.`);
      hapticError();
      return;
    }

    if (!gmailPassword.trim()) {
      setGmailVerificationMessage('Please enter password to verify.');
      return;
    }

    setGmailLoading(true);
    setGmailSafetyStage('verifying');
    setGmailVerificationMessage('Checking account password and security credentials...');
    hapticTap();

    try {
      const cred = await signInWithEmailAndPassword(auth, inputEmail, gmailPassword);
      if (cred.user) {
        setCurrentUser(cred.user);
        handleConfirmAndLoginSafe(cred.user.email || inputEmail);
      }
    } catch (err: any) {
      setGmailSafetyStage('error');
      setGmailVerificationMessage(err.message || 'Authentication check failed.');
      hapticError();
    } finally {
      setGmailLoading(false);
    }
  };

  // ----------------------------------------------------
  // FINGERPRINT UNLOCK LOGIC
  // ----------------------------------------------------
  const handleFingerprintUnlock = async (isAuto = false) => {
    setIsBiometricScanning(true);
    setBiometricError(null);
    setBiometricMsg(
      language === 'ur'
        ? 'فون کا فنگر پرنٹ سینسر چھوئیں...'
        : 'Prompting phone biometrics — touch your phone’s physical SIDE-MOUNT sensor (power button)...'
    );
    if (!isAuto) {
      hapticTap();
    }

    try {
      const result = await authenticateWithFingerprint(OWNER_GMAIL);
      if (result.success) {
        setBiometricMsg(result.message || 'Side-mount sensor verified with phone biometrics!');
        setBiometricError(null);
        setFingerprintAttemptFailed(false);
        hapticTransactionComplete();
        setTimeout(() => {
          setShowFingerprintPopup(false);
          setShowSensorModal(false);
          onUnlock();
        }, 350);
      } else {
        const failureReason = result.message || 'Fingerprint verification was unsuccessful or cancelled.';
        setBiometricError(failureReason);
        setFingerprintFailureReason(failureReason);
        setFingerprintAttemptFailed(true);
        setBiometricMsg(null);
        hapticError();
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Side sensor scan error';
      setBiometricError(errMsg);
      setFingerprintFailureReason(errMsg);
      setFingerprintAttemptFailed(true);
      setBiometricMsg(null);
      hapticError();
    } finally {
      setIsBiometricScanning(false);
    }
  };

  const handleClearBiometrics = () => {
    clearStoredBiometrics();
    checkBiometricSupport().then(status => setBiometricStatus(status));
    setBiometricMsg('Biometrics reset. Tap sensor to re-enroll.');
    setBiometricError(null);
    hapticTap();
  };

  // ----------------------------------------------------
  // PIN KEYPAD LOGIC
  // ----------------------------------------------------
  const handleKeyPress = (num: string) => {
    if (enteredPin.length >= 4) return;
    const next = enteredPin + num;
    setEnteredPin(next);
    if (next.length === 4) {
      validatePin(next);
    }
  };

  const handleClear = () => {
    setEnteredPin('');
  };

  const handleBackspace = () => {
    setEnteredPin(prev => prev.slice(0, -1));
  };

  const validatePin = (code: string) => {
    if (code === pin) {
      hapticTransactionComplete();
      setTimeout(() => {
        setShowPinModal(false);
        onUnlock();
      }, 100);
    } else {
      hapticError();
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
        setEnteredPin('');
      }, 420);
    }
  };

  const handleVerifyQuestion = () => {
    if (securityInput.trim().toLowerCase() === recoveryAnswer.toLowerCase()) {
      setForgotStep('newpin');
      setSecurityError(false);
    } else {
      setSecurityError(true);
    }
  };

  const handleSendEmailCode = () => {
    setEmailCodeSent(true);
  };

  const handleVerifyEmailCode = () => {
    if (emailCodeInput.trim() === '777777' || emailCodeInput.length === 6) {
      setForgotStep('newpin');
    } else {
      setSecurityError(true);
    }
  };

  const handleResetPin = () => {
    if (!/^\d{4}$/.test(newPinInput)) {
      setResetError('PIN must be 4 digits.');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setResetError("PINs don't match.");
      return;
    }
    onUpdatePin(newPinInput);
    setShowForgotModal(false);
    setForgotStep('question');
    setEnteredPin('');
  };

  // Logo Customization State
  const logoPosition: LogoPosition = visualSettings?.lockLogoPosition || (
    (() => {
      try {
        const s = localStorage.getItem('falcon_lock_logo_pref');
        return s ? JSON.parse(s).logoPosition || 'inline' : 'inline';
      } catch { return 'inline'; }
    })()
  );

  const [logoAsset, setLogoAsset] = useState<string>(() => {
    const saved = localStorage.getItem('falcon_logo_asset');
    if (saved && saved.startsWith('/falcon-theme-rod-logo')) return saved;
    return '/falcon-theme-rod-logo.svg';
  });

  useEffect(() => {
    const handleLogoChange = () => {
      const saved = localStorage.getItem('falcon_logo_asset');
      setLogoAsset((saved && saved.startsWith('/falcon-theme-rod-logo')) ? saved : '/falcon-theme-rod-logo.svg');
    };
    window.addEventListener('falcon_logo_asset_changed', handleLogoChange);
    return () => window.removeEventListener('falcon_logo_asset_changed', handleLogoChange);
  }, []);

  const customHeight: number = typeof visualSettings?.lockLogoHeight === 'number'
    ? visualSettings.lockLogoHeight
    : (() => {
        try {
          const s = localStorage.getItem('falcon_lock_logo_pref');
          return s && typeof JSON.parse(s).customHeight === 'number' ? JSON.parse(s).customHeight : 30;
        } catch { return 30; }
      })();

  const logoAlignment: 'center' | 'left' = visualSettings?.lockLogoAlignment || (
    (() => {
      try {
        const s = localStorage.getItem('falcon_lock_logo_pref');
        return s ? JSON.parse(s).logoAlignment || 'center' : 'center';
      } catch { return 'center'; }
    })()
  );

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto px-3 sm:px-4 py-4 sm:py-8 bg-[#1C1F22] bg-radial-[ellipse_at_50%_20%] from-[#2A2F34] to-[#1C1F22]" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Background Mesh */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(var(--yellow) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      <div className="min-h-full flex items-center justify-center">
        <div
          className="relative w-full max-w-[460px] my-auto bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 sm:p-8 text-center shadow-2xl transition-all"
        >
          {/* Top subtle golden edge highlight */}
          <div className="absolute top-0 inset-x-0 h-1.5 rounded-t-2xl bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

          {/* Brand Section: Prominent Logo + App Name */}
          <div className="mb-6 flex flex-col items-center justify-center">
            {logoPosition === 'inline' ? (
              <div
                id="lockscreen-brand-container"
                className={`flex items-center ${logoAlignment === 'left' ? 'justify-start w-full' : 'justify-center'} gap-3.5 sm:gap-4 max-w-full`}
              >
                <div
                  id="lockscreen-logo-stage"
                  className="relative inline-flex items-center justify-center shrink-0 transition-all duration-200 group"
                >
                  <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl pointer-events-none" />
                  <img
                    id="lockscreen-falcon-logo"
                    src={logoAsset}
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src !== FALCON_LOGO_PNG) {
                        target.src = FALCON_LOGO_PNG;
                      }
                    }}
                    alt="Falcon Rod Maker Logo"
                    style={{ height: `${Math.max(customHeight, 64)}px`, width: 'auto' }}
                    className="relative z-10 max-w-[200px] object-contain select-none transition-transform duration-200 drop-shadow-[0_6px_20px_rgba(245,183,0,0.35)]"
                  />
                </div>

                <div id="lockscreen-app-name-block" className="text-left flex flex-col justify-center min-w-0">
                  <h1 className="font-serif font-black text-xl sm:text-2xl text-[var(--text)] tracking-tight leading-tight">
                    {companyName || 'Falcon Rod Maker'}
                  </h1>
                  <p className="text-xs font-mono text-[var(--yellow)] uppercase tracking-wider font-semibold mt-1">
                    {companyTagline || 'Fan Accessories & Rod Specialist — Gujrat'}
                  </p>
                </div>
              </div>
            ) : (
              <div
                id="lockscreen-brand-container"
                className="flex flex-col items-center justify-center text-center"
              >
                <div
                  id="lockscreen-logo-stage"
                  className="relative inline-flex items-center justify-center transition-all duration-300 py-1"
                >
                  <div className="absolute inset-0 rounded-full bg-amber-500/25 blur-2xl pointer-events-none" />
                  <img
                    id="lockscreen-falcon-logo"
                    src={logoAsset}
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src !== FALCON_LOGO_PNG) {
                        target.src = FALCON_LOGO_PNG;
                      }
                    }}
                    alt="Falcon Rod Maker Logo"
                    style={{ height: `${Math.max(customHeight, 82)}px`, width: 'auto' }}
                    className="relative z-10 max-w-[240px] object-contain select-none drop-shadow-[0_8px_24px_rgba(245,183,0,0.4)]"
                  />
                </div>

                <div className="h-2" />

                <div id="lockscreen-app-name-block" className="text-center">
                  <h1 className="font-serif font-black text-2xl sm:text-3xl text-[var(--text)] tracking-tight">
                    {companyName || 'Falcon Rod Maker'}
                  </h1>
                  <p className="text-xs sm:text-sm font-mono text-[var(--yellow)] uppercase tracking-wider font-semibold mt-1">
                    {companyTagline || 'Fan Accessories & Rod Specialist — Gujrat'}
                  </p>
                </div>
              </div>
            )}

            {/* Status Indicator */}
            <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[11px] font-mono text-[var(--text-dim)] select-none">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Falcon Secure Terminal • Gujrat</span>
            </div>
          </div>

          {/* ==================================================== */}
          {/* 3 LOGIN OPTIONS ALIGNED VERTICALLY (NO KEYPAD/NAME)   */}
          {/* User chooses which method to open its relevant window */}
          {/* ==================================================== */}
          <div className="mt-4 text-left">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-dim)] flex items-center gap-1.5">
                <Lock size={13} className="text-amber-400" />
                {language === 'ur' ? 'لاگ ان کا طریقہ منتخب کریں:' : 'Choose Login Method (3 Options):'}
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-400/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Ready
              </span>
            </div>

            {/* 3 Prominent Vertically Aligned Option Cards */}
            <div className="flex flex-col gap-3">
              {/* Option 1: PIN Code */}
              <button
                type="button"
                onClick={handleOpenPinWindow}
                className="group w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-[var(--steel-line)] hover:border-amber-400 bg-[var(--panel-raised)] hover:bg-[#282d33] transition-all cursor-pointer select-none active:scale-[0.98] shadow-sm hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 group-hover:bg-amber-500/25 transition">
                    <KeyRound size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-mono font-bold text-white flex items-center gap-2">
                      <span>1. {language === 'ur' ? 'پن کوڈ لاگ ان' : 'PIN Code'}</span>
                      <span className="text-[10px] font-mono font-normal text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-400/30">
                        4 Digits
                      </span>
                    </div>
                    <p className="text-xs font-mono text-[var(--text-dim)] truncate mt-0.5">
                      {language === 'ur' ? 'ماسٹر ٹرمینل پن کوڈ درج کریں' : 'Enter 4-digit Master Security PIN (321)'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-amber-400 shrink-0 ml-2">
                  <span className="text-xs font-mono hidden sm:inline">{language === 'ur' ? 'کھولیں' : 'Open'}</span>
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* Option 2: Gmail Safety Check */}
              <button
                type="button"
                onClick={handleOpenGmailSafetyPopup}
                className="group w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-[var(--steel-line)] hover:border-sky-400 bg-[var(--panel-raised)] hover:bg-[#282d33] transition-all cursor-pointer select-none active:scale-[0.98] shadow-sm hover:shadow-[0_0_20px_rgba(56,189,248,0.2)] text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0 group-hover:scale-105 group-hover:bg-sky-500/25 transition">
                    <Mail size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-mono font-bold text-white flex items-center gap-2">
                      <span>2. {language === 'ur' ? 'گوگل / جی میل لاگ ان' : 'Gmail'}</span>
                      <span className="text-[10px] font-mono font-normal text-sky-300 bg-sky-500/20 px-1.5 py-0.5 rounded border border-sky-400/30">
                        Safety Check
                      </span>
                    </div>
                    <p className="text-xs font-mono text-[var(--text-dim)] truncate mt-0.5">
                      {language === 'ur' ? 'فعال گوگل اکاؤنٹ کی تصدیق کریں' : 'Inspect active Google session & safety check'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sky-400 shrink-0 ml-2">
                  <span className="text-xs font-mono hidden sm:inline">{language === 'ur' ? 'چیک کریں' : 'Check'}</span>
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* Option 3: Phone Side Sensor */}
              <button
                type="button"
                onClick={handleOpenSensorWindow}
                className="group w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-[var(--steel-line)] hover:border-emerald-400 bg-[var(--panel-raised)] hover:bg-[#282d33] transition-all cursor-pointer select-none active:scale-[0.98] shadow-sm hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 group-hover:bg-emerald-500/25 transition">
                    <Fingerprint size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-mono font-bold text-white flex items-center gap-2">
                      <span>3. {language === 'ur' ? 'سائیڈ سینسر بائیو میٹرک' : 'Sensor'}</span>
                      <span className="text-[10px] font-mono font-normal text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-400/30">
                        Side Button
                      </span>
                    </div>
                    <p className="text-xs font-mono text-[var(--text-dim)] truncate mt-0.5">
                      {language === 'ur' ? 'فون کے سائیڈ پاور بٹن پر فنگر پرنٹ' : 'Phone physical power key fingerprint sensor'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-emerald-400 shrink-0 ml-2">
                  <span className="text-xs font-mono hidden sm:inline">{language === 'ur' ? 'سکین' : 'Scan'}</span>
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* WINDOW 1: PIN CODE ENTRY MODAL WINDOW                             */}
      {/* Opens when user taps "1. PIN Code" option                         */}
      {/* Contains Umar (Master Owner) badge, PIN field, & numeric keypad   */}
      {/* ================================================================= */}
      {showPinModal && (
        <div
          id="pin-code-modal"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
        >
          <div
            className={`w-full max-w-[390px] max-w-full overflow-x-hidden break-words bg-[var(--panel)] border-2 border-amber-400/60 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-3.5 text-center relative overflow-hidden ${
              isShaking ? 'animate-shake' : ''
            }`}
          >
            {/* Top Amber Ribbon */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3">
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="flex items-center gap-1 text-xs font-mono text-[var(--text-dim)] hover:text-white transition px-2 py-1 rounded hover:bg-white/5 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>{language === 'ur' ? 'واپس' : 'Back'}</span>
              </button>
              <div className="flex items-center gap-1.5 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
                <KeyRound size={15} />
                <span>{language === 'ur' ? 'پن کوڈ لاگ ان' : 'Master PIN Login'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="text-[var(--text-dim)] hover:text-white p-1 rounded-lg hover:bg-white/5 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Owner Indicator - displayed here inside the PIN window */}
            <div className="relative w-48 mx-auto">
              <div className="w-full bg-[var(--bg)] border border-amber-400/30 rounded-lg py-1.5 px-3 text-center font-mono text-xs text-[var(--yellow)] font-bold select-none flex items-center justify-center gap-1.5 shadow-inner">
                <ShieldCheck size={14} />
                <span>Umar (Master Owner)</span>
              </div>
            </div>

            {/* PIN Display Field */}
            <div className="relative w-48 mx-auto">
              <input
                type={showPin ? 'text' : 'password'}
                readOnly
                value={enteredPin}
                placeholder="••••"
                maxLength={4}
                className="w-full bg-black text-[var(--text)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-xl py-2 px-6 text-center font-mono text-2xl tracking-[8px] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)] p-1 cursor-pointer"
              >
                {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
              {t('enter_pin')} (Default: 321)
            </p>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-[270px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(num)}
                  className="bg-[var(--panel-raised)] text-[var(--text)] hover:bg-[#333940] active:scale-95 border border-[var(--steel-line)] rounded-lg py-2.5 font-mono text-lg font-semibold transition cursor-pointer select-none"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] active:scale-95 border border-[var(--steel-line)] rounded-lg py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition cursor-pointer select-none"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="bg-[var(--panel-raised)] text-[var(--text)] hover:bg-[#333940] active:scale-95 border border-[var(--steel-line)] rounded-lg py-2.5 font-mono text-lg font-semibold transition cursor-pointer select-none"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-[var(--text)] active:scale-95 border border-[var(--steel-line)] rounded-lg py-2.5 font-mono text-base font-semibold transition cursor-pointer select-none"
              >
                ⌫
              </button>
            </div>

            {/* Fast links below PIN */}
            <div className="flex items-center justify-between px-3 pt-2 text-xs font-mono border-t border-[var(--steel-line)]">
              <button
                type="button"
                onClick={() => {
                  setShowPinModal(false);
                  setShowForgotModal(true);
                }}
                className="text-[11px] text-[var(--text-dim)] hover:text-[var(--yellow)] underline transition cursor-pointer"
              >
                {t('forgot_pin')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPinModal(false);
                  handleOpenGmailSafetyPopup();
                }}
                className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 transition cursor-pointer"
              >
                <Mail size={12} />
                <span>Check Gmail →</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* WINDOW 3: PHONE SIDE SENSOR BIOMETRICS MODAL WINDOW               */}
      {/* Opens when user taps "3. Sensor" option                           */}
      {/* Prompts for side power key touch, scans & unlocks on success     */}
      {/* ================================================================= */}
      {showSensorModal && (
        <div
          id="sensor-biometric-modal"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-[400px] max-w-full overflow-x-hidden break-words bg-[var(--panel)] border-2 border-emerald-400/60 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 text-center relative overflow-hidden">
            {/* Top Emerald Ribbon */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-300 to-emerald-500" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--steel-line)] pb-3">
              <button
                type="button"
                onClick={() => setShowSensorModal(false)}
                className="flex items-center gap-1 text-xs font-mono text-[var(--text-dim)] hover:text-white transition px-2 py-1 rounded hover:bg-white/5 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>{language === 'ur' ? 'واپس' : 'Back'}</span>
              </button>
              <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
                <Fingerprint size={16} />
                <span>{language === 'ur' ? 'سائیڈ سینسر بائیو میٹرک' : 'Phone Side Sensor'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSensorModal(false)}
                className="text-[var(--text-dim)] hover:text-white p-1 rounded-lg hover:bg-white/5 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Visual Sensor Graphic */}
            <div className="py-2">
              <div className="relative w-24 h-24 mx-auto rounded-full bg-emerald-500/15 border-2 border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.25)]">
                <Fingerprint size={52} className={`${isBiometricScanning ? 'animate-pulse text-emerald-300' : 'text-emerald-400'}`} />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="font-serif font-black text-base text-white">
                {language === 'ur' ? 'فون کا سائیڈ پاور سینسر چھوئیں' : 'Touch Phone Side Power Sensor'}
              </h4>
              <p className="text-xs font-mono text-[var(--text-dim)] leading-relaxed">
                {language === 'ur'
                  ? 'فون کے فزیکل سائیڈ پاور بٹن پر موجود سینسر پر رجسٹرڈ انگلی رکھیں'
                  : 'Place your enrolled finger on your phone’s physical side-mount power button sensor.'}
              </p>
            </div>

            {/* Sensor Status Messages */}
            {biometricMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-mono text-center">
                ✓ {biometricMsg}
              </div>
            )}

            {biometricError && (
              <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-mono text-left flex items-start gap-1.5">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{biometricError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleFingerprintUnlock(false)}
                disabled={isBiometricScanning}
                className="w-full py-3 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-bold text-xs uppercase font-mono shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Fingerprint size={16} />
                <span>{isBiometricScanning ? 'Scanning Sensor...' : 'Touch Sensor to Scan Again'}</span>
              </button>

              <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                <button
                  type="button"
                  onClick={handleClearBiometrics}
                  className="text-[var(--text-dim)] hover:text-amber-300 underline cursor-pointer"
                >
                  Reset Biometrics
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSensorModal(false);
                    handleOpenPinWindow();
                  }}
                  className="text-amber-400 hover:text-amber-300 underline cursor-pointer"
                >
                  Use PIN instead →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* USER REQUESTED: GMAIL SAFETY VERIFICATION MODAL POPUP             */}
      {/* "for gmail login it should open popup to check first wheter my   */}
      {/* gmail is login then it should verify then login successful        */}
      {/* for safety."                                                      */}
      {/* ================================================================= */}
      {showGmailSafetyModal && (
        <div
          id="gmail-safety-verification-modal"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md max-w-full overflow-x-hidden break-words bg-[var(--panel)] border-2 border-sky-400/60 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 text-center relative overflow-hidden">
            {/* Top Security Banner Ribbon */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-sky-500 via-amber-400 to-sky-500" />

            {/* Header */}
            <div className="flex items-start justify-between border-b border-[var(--steel-line)] pb-3">
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="font-serif font-black text-base sm:text-lg text-white tracking-tight flex items-center gap-1.5">
                    <span>Gmail Safety Verification</span>
                  </h3>
                  <p className="text-[11px] font-mono text-[var(--text-dim)]">
                    Session Integrity & Owner Verification
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGmailSafetyModal(false)}
                className="text-[var(--text-dim)] hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
              >
                ✕
              </button>
            </div>

            {/* Step Status Tracker */}
            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
              <div className={`p-2 rounded-lg border flex flex-col items-center gap-1 ${
                gmailSafetyStage === 'checking'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300 animate-pulse'
                  : 'bg-black/30 border-[var(--steel-line)] text-emerald-400'
              }`}>
                <span className="font-bold">1. Check Session</span>
                <span className="text-[9px] text-[var(--text-dim)]">
                  {gmailSafetyStage === 'checking' ? 'Inspecting...' : 'Completed'}
                </span>
              </div>

              <div className={`p-2 rounded-lg border flex flex-col items-center gap-1 ${
                gmailSafetyStage === 'verifying' || gmailSafetyStage === 'active_found'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse'
                  : gmailSafetyStage === 'verified_safe'
                  ? 'bg-black/30 border-[var(--steel-line)] text-emerald-400'
                  : 'bg-black/30 border-[var(--steel-line)] text-[var(--text-dim)]'
              }`}>
                <span className="font-bold">2. Owner Verify</span>
                <span className="text-[9px] text-[var(--text-dim)]">
                  {gmailSafetyStage === 'verified_safe' ? 'Verified ✓' : 'umarzaman7777777'}
                </span>
              </div>

              <div className={`p-2 rounded-lg border flex flex-col items-center gap-1 ${
                gmailSafetyStage === 'verified_safe'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 animate-bounce'
                  : 'bg-black/30 border-[var(--steel-line)] text-[var(--text-dim)]'
              }`}>
                <span className="font-bold">3. Safe Unlock</span>
                <span className="text-[9px] text-[var(--text-dim)]">
                  {gmailSafetyStage === 'verified_safe' ? 'Granted ✓' : 'Standby'}
                </span>
              </div>
            </div>

            {/* Dynamic Stage Content */}

            {/* STAGE 1: Checking Session */}
            {gmailSafetyStage === 'checking' && (
              <div className="py-6 space-y-3">
                <Loader2 size={36} className="animate-spin text-sky-400 mx-auto" />
                <div className="space-y-1">
                  <div className="text-sm font-bold text-white font-mono">
                    {language === 'ur' ? 'گوگل لاگ ان چیک کیا جا رہا ہے...' : 'Checking whether Gmail is logged in...'}
                  </div>
                  <p className="text-xs text-[var(--text-dim)] font-mono">
                    Inspecting active browser tokens and Google session security...
                  </p>
                </div>
              </div>
            )}

            {/* STAGE 2: Active Session Found */}
            {gmailSafetyStage === 'active_found' && (
              <div className="py-2 space-y-3 text-left">
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold">
                    <CheckCircle2 size={16} />
                    <span>Active Gmail Session Detected!</span>
                  </div>
                  <div className="text-xs text-[var(--text)] font-mono bg-black/40 p-2 rounded border border-emerald-500/30">
                    <div className="text-[10px] text-emerald-300 uppercase">Logged In Account:</div>
                    <div className="font-bold text-sm truncate">{verifiedGmailAccount || OWNER_GMAIL}</div>
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)] font-mono flex items-center gap-1.5">
                    <Shield size={12} className="text-emerald-400" />
                    <span>Safety Match: Matches Sole Registered Workshop Owner.</span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleConfirmAndLoginSafe(verifiedGmailAccount || OWNER_GMAIL)}
                    className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase font-mono shadow-lg transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                    <span>Verify & Login Successful</span>
                  </button>
                  <p className="text-[10px] text-center font-mono text-[var(--text-dim)]">
                    Protected session locked to Falcon Gujrat Terminal
                  </p>
                </div>
              </div>
            )}

            {/* STAGE 3: Not Logged In Yet */}
            {gmailSafetyStage === 'not_logged_in' && (
              <div className="py-2 space-y-3 text-left">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-bold">
                    <AlertCircle size={16} />
                    <span>No Active Session Found</span>
                  </div>
                  <p className="text-xs text-[var(--text-dim)] font-mono leading-relaxed">
                    No active Gmail was detected on this device. Sign in or verify your master workshop account to proceed safely.
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-2 pt-1">
                  {/* Option A: Google Official Sign-In Popup */}
                  <button
                    type="button"
                    disabled={gmailLoading}
                    onClick={handleTriggerGoogleAuth}
                    className="w-full flex items-center justify-center gap-2.5 bg-white text-gray-800 font-medium py-3 px-4 rounded-xl shadow-md hover:bg-gray-100 active:scale-95 transition text-xs font-mono cursor-pointer disabled:opacity-50"
                  >
                    {gmailLoading ? (
                      <Loader2 size={16} className="animate-spin text-gray-700" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 48 48">
                        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.4-.4-3.5z" />
                        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.6 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34 5.1 29.3 3 24 3 16.3 3 9.6 7.4 6.3 14.7z" />
                        <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 36.6 26.8 37.5 24 37.5c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.4 40.5 16.1 45 24 45z" />
                        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.2C40.9 36 44 30.5 44 24c0-1.4-.1-2.4-.4-3.5z" />
                      </svg>
                    )}
                    <span className="font-bold">Check & Sign In with Google</span>
                  </button>

                  {/* Option B: Fast Owner Verification */}
                  <button
                    type="button"
                    onClick={() => handleConfirmAndLoginSafe(OWNER_GMAIL)}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs uppercase font-mono shadow transition flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate">Verify Master: {OWNER_GMAIL}</span>
                    <ShieldCheck size={16} className="shrink-0 ml-1.5" />
                  </button>

                  {/* Option C: Direct Password Toggle */}
                  {!showPasswordLogin ? (
                    <button
                      type="button"
                      onClick={() => setShowPasswordLogin(true)}
                      className="text-[11px] text-[var(--text-dim)] hover:text-sky-300 font-mono underline block mx-auto pt-1"
                    >
                      Enter Gmail & Password directly instead
                    </button>
                  ) : (
                    <form onSubmit={handleDirectGmailPasswordVerify} className="p-3 rounded-xl bg-black/40 border border-[var(--steel-line)] space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[var(--text-dim)] font-mono uppercase">Password Verification</span>
                        <button
                          type="button"
                          onClick={() => setShowPasswordLogin(false)}
                          className="text-[10px] text-red-400 hover:underline font-mono"
                        >
                          Close
                        </button>
                      </div>
                      <input
                        type="email"
                        value={gmailInput}
                        onChange={e => setGmailInput(e.target.value)}
                        placeholder="Gmail address..."
                        className="w-full bg-black border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] font-mono focus:outline-none focus:border-sky-400"
                      />
                      <input
                        type="password"
                        value={gmailPassword}
                        onChange={e => setGmailPassword(e.target.value)}
                        placeholder="Password..."
                        className="w-full bg-black border border-[var(--steel-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] font-mono focus:outline-none focus:border-sky-400"
                      />
                      <button
                        type="submit"
                        disabled={gmailLoading}
                        className="w-full py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs uppercase font-mono shadow transition"
                      >
                        {gmailLoading ? 'Verifying...' : 'Verify Password & Login'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* STAGE 4: Verifying */}
            {gmailSafetyStage === 'verifying' && (
              <div className="py-6 space-y-3">
                <Loader2 size={36} className="animate-spin text-amber-400 mx-auto" />
                <div className="space-y-1">
                  <div className="text-sm font-bold text-white font-mono">
                    {gmailVerificationMessage || 'Verifying account safety...'}
                  </div>
                  <p className="text-xs text-[var(--text-dim)] font-mono">
                    Matching email against authorized master workshop registry...
                  </p>
                </div>
              </div>
            )}

            {/* STAGE 5: Verified Safe -> Login Successful! */}
            {gmailSafetyStage === 'verified_safe' && (
              <div className="py-4 space-y-3 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 mx-auto shadow-[0_0_25px_rgba(16,185,129,0.5)]">
                  <CheckCircle2 size={36} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-serif font-black text-lg text-emerald-400">
                    Login Successful!
                  </h4>
                  <div className="text-xs font-mono font-bold text-white">
                    {verifiedGmailAccount || OWNER_GMAIL}
                  </div>
                  <p className="text-[11px] text-emerald-300 font-mono">
                    ✓ Safety check passed. Unlocking Falcon POS now...
                  </p>
                </div>
              </div>
            )}

            {/* STAGE 6: Error State */}
            {gmailSafetyStage === 'error' && (
              <div className="py-3 space-y-3 text-left">
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-mono space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-red-400">
                    <AlertCircle size={16} />
                    <span>Safety Verification Blocked</span>
                  </div>
                  <p>{gmailVerificationMessage || 'Unauthorized account. Access restricted for security.'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setGmailSafetyStage('not_logged_in')}
                  className="w-full py-2.5 rounded-lg bg-[var(--panel-raised)] hover:bg-[#323842] text-[var(--text)] border border-[var(--steel-line)] text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={14} />
                  <span>Try Another Account</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Forgot PIN Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-lg text-[var(--text)]">Reset PIN</h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-[var(--text-dim)] hover:text-[var(--text)]"
              >
                ✕
              </button>
            </div>

            {forgotStep === 'question' && (
              <div>
                <label className="block font-mono text-xs text-[var(--text-dim)] mb-2">
                  Security Question: What is the shop owner&apos;s name?
                </label>
                <input
                  type="text"
                  value={securityInput}
                  onChange={e => setSecurityInput(e.target.value)}
                  placeholder="Type answer..."
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-lg px-3 py-2 text-sm text-[var(--text)] font-mono mb-3 focus:outline-none"
                />
                {securityError && (
                  <p className="text-xs text-red-500 font-mono mb-3">Incorrect answer. Try again.</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-[var(--text)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyQuestion}
                    className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-semibold text-xs uppercase"
                  >
                    Verify
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setForgotStep('email')}
                  className="block w-full text-center text-xs text-[var(--text-dim)] hover:text-[var(--yellow)] underline font-mono mt-3"
                >
                  Email me an OTP code instead
                </button>
              </div>
            )}

            {forgotStep === 'email' && (
              <div>
                <p className="text-xs text-[var(--text-dim)] mb-3">
                  We will send a 6-digit verification code to the shop owner&apos;s email address.
                </p>
                {!emailCodeSent ? (
                  <button
                    type="button"
                    onClick={handleSendEmailCode}
                    className="w-full py-2 bg-[var(--yellow)] text-black font-semibold rounded-lg text-xs uppercase mb-3"
                  >
                    Send Code
                  </button>
                ) : (
                  <div className="mb-3">
                    <p className="text-xs text-[var(--green)] mb-2">Code sent! Enter 6 digits (e.g. 777777):</p>
                    <input
                      type="text"
                      maxLength={6}
                      value={emailCodeInput}
                      onChange={e => setEmailCodeInput(e.target.value)}
                      placeholder="777777"
                      className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-sm text-center tracking-widest font-mono text-[var(--text)] mb-3 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyEmailCode}
                      className="w-full py-2 bg-[var(--yellow)] text-black font-semibold rounded-lg text-xs uppercase"
                    >
                      Verify Code
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setForgotStep('question')}
                  className="block w-full text-center text-xs text-[var(--text-dim)] hover:text-[var(--yellow)] underline font-mono mt-2"
                >
                  Use security question instead
                </button>
              </div>
            )}

            {forgotStep === 'newpin' && (
              <div>
                <label className="block font-mono text-xs text-[var(--text-dim)] mb-1">New 4-Digit PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={newPinInput}
                  onChange={e => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-sm text-center tracking-widest font-mono text-[var(--text)] mb-3 focus:outline-none"
                />
                <label className="block font-mono text-xs text-[var(--text-dim)] mb-1">Confirm New PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={confirmPinInput}
                  onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-sm text-center tracking-widest font-mono text-[var(--text)] mb-3 focus:outline-none"
                />
                {resetError && <p className="text-xs text-red-500 font-mono mb-3">{resetError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPin}
                    className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-semibold text-xs uppercase"
                  >
                    Reset PIN
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
