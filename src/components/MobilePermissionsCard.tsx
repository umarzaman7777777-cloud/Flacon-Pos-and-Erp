import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  BellRing,
  Mic,
  MicOff,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Info,
  Smartphone,
  Copy,
  Check,
  Volume2,
  Lock,
  ChevronDown,
  ChevronUp,
  Radio
} from 'lucide-react';
import {
  checkAllMobilePermissions,
  requestNotificationPermission,
  requestMicrophonePermission,
  requestStoragePersistence,
  sendNativeNotification,
  scheduleLockscreenTestNotification,
  getDirectAppUrl,
  MobilePermissionsState
} from '../utils/mobilePermissions';
import { AppLanguage } from '../types';

interface MobilePermissionsCardProps {
  language: AppLanguage;
  compact?: boolean;
  onPermissionsUpdated?: () => void;
}

export const MobilePermissionsCard: React.FC<MobilePermissionsCardProps> = ({
  language,
  compact = false,
  onPermissionsUpdated
}) => {
  const [permState, setPermState] = useState<MobilePermissionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [testNotificationSent, setTestNotificationSent] = useState(false);
  const [lockscreenTestPending, setLockscreenTestPending] = useState(false);
  const [lockscreenCountdown, setLockscreenCountdown] = useState<number | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showTroubleshootGuide, setShowTroubleshootGuide] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem('falcon_block_permission_notifications') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    try {
      if (next) {
        localStorage.setItem('falcon_block_permission_notifications', 'true');
        localStorage.setItem('falcon_permissions_banner_dismissed', 'true');
        setActionMessage('Permission warning banners blocked and muted.');
      } else {
        localStorage.removeItem('falcon_block_permission_notifications');
        localStorage.removeItem('falcon_permissions_banner_dismissed');
        setActionMessage('Permission notifications unmuted.');
      }
    } catch {}
  };

  // Live Microphone testing state
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micAudioLevel, setMicAudioLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const loadPermissions = async () => {
    try {
      const state = await checkAllMobilePermissions();
      setPermState(state);
    } catch (e) {
      console.warn('Failed to load permissions state', e);
    }
  };

  useEffect(() => {
    loadPermissions();
    return () => {
      stopMicTest();
    };
  }, []);

  const stopMicTest = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsTestingMic(false);
    setMicAudioLevel(0);
  };

  const handleStartMicTest = async () => {
    if (isTestingMic) {
      stopMicTest();
      return;
    }

    setLoading(true);
    setActionMessage('Testing microphone hardware...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsTestingMic(true);
      setActionMessage('Microphone is LIVE! Speak into your phone — watch the volume meter below.');

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setMicAudioLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      await loadPermissions();
      onPermissionsUpdated?.();
    } catch (err: any) {
      stopMicTest();
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setActionMessage(
        isDenied
          ? 'Microphone blocked by browser. Please follow the unblock steps below.'
          : `Microphone test error: ${err.message || String(err)}`
      );
      setShowTroubleshootGuide(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantNotifications = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await requestNotificationPermission();
      setActionMessage(res.message);
      if (res.status === 'granted') {
        // Send a welcome alert
        await sendNativeNotification('Falcon Rod Maker POS', {
          body: 'Push & Lockscreen notifications are active! You will receive instant order and workshop alerts.',
          icon: '/falcon-theme-rod-logo.svg'
        });
        setTestNotificationSent(true);
      } else if (res.status === 'denied') {
        setShowTroubleshootGuide(true);
      }
      await loadPermissions();
      onPermissionsUpdated?.();
    } catch (err: any) {
      setActionMessage(`Notification error: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestImmediateNotification = async () => {
    const success = await sendNativeNotification('Falcon Rod Maker POS Test Alert', {
      body: `Immediate push alert triggered at ${new Date().toLocaleTimeString()} — System delivery active!`,
      icon: '/falcon-theme-rod-logo.svg'
    });
    if (success) {
      setTestNotificationSent(true);
      setActionMessage('Test push notification sent successfully!');
      setTimeout(() => setTestNotificationSent(false), 4000);
    } else {
      setActionMessage('Could not dispatch notification. Make sure permission is granted and unblocked.');
      setShowTroubleshootGuide(true);
    }
  };

  const handleTestLockscreenNotification = async () => {
    setLockscreenTestPending(true);
    setLockscreenCountdown(3);
    setActionMessage('Lockscreen alert scheduled! LOCK YOUR PHONE NOW to test lockscreen banner...');

    let seconds = 3;
    const interval = setInterval(() => {
      seconds -= 1;
      setLockscreenCountdown(seconds);
      if (seconds <= 0) {
        clearInterval(interval);
        setLockscreenTestPending(false);
        setLockscreenCountdown(null);
      }
    }, 1000);

    const success = await scheduleLockscreenTestNotification(3);
    if (!success) {
      clearInterval(interval);
      setLockscreenTestPending(false);
      setLockscreenCountdown(null);
      setActionMessage('Could not schedule lockscreen alert. Please verify notification permission.');
      setShowTroubleshootGuide(true);
    }
  };

  const handleGrantMic = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await requestMicrophonePermission();
      setActionMessage(res.message);
      if (res.status === 'denied') {
        setShowTroubleshootGuide(true);
      }
      await loadPermissions();
      onPermissionsUpdated?.();
    } catch (err: any) {
      setActionMessage(`Mic error: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantStorage = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await requestStoragePersistence();
      setActionMessage(res.message);
      await loadPermissions();
      onPermissionsUpdated?.();
    } catch (err: any) {
      setActionMessage(`Storage error: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAll = async () => {
    setLoading(true);
    setActionMessage('Requesting all device permissions sequentially...');
    try {
      // 1. Notifications
      const notifRes = await requestNotificationPermission();
      // 2. Storage
      const storRes = await requestStoragePersistence();
      // 3. Microphone
      const micRes = await requestMicrophonePermission();

      const msgs = [notifRes.message, storRes.message, micRes.message].filter(Boolean);
      setActionMessage(msgs.join(' • '));

      if (notifRes.status === 'denied' || micRes.status === 'denied') {
        setShowTroubleshootGuide(true);
      }

      await loadPermissions();
      onPermissionsUpdated?.();
    } catch (err: any) {
      setActionMessage(`Error requesting permissions: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDirectUrl = () => {
    const url = getDirectAppUrl();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    }
  };

  const handleOpenInNewTab = () => {
    const url = getDirectAppUrl();
    window.open(url, '_blank');
  };

  if (!permState) {
    return (
      <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] animate-pulse flex items-center justify-between">
        <span className="text-xs text-[var(--text-dim)] font-mono">Checking mobile hardware permissions...</span>
        <RefreshCw size={14} className="animate-spin text-[var(--yellow)]" />
      </div>
    );
  }

  const allGranted =
    permState.notifications === 'granted' &&
    permState.microphone === 'granted' &&
    permState.storagePersisted;

  const anyDenied =
    permState.notifications === 'denied' ||
    permState.microphone === 'denied';

  return (
    <div
      id="mobile-device-permissions-card"
      className="p-4 sm:p-5 rounded-xl bg-gradient-to-b from-[var(--panel-raised)] to-[var(--panel)] border border-[var(--steel-line)] shadow-lg space-y-4 max-w-full overflow-x-hidden break-words"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[var(--steel-line)]/60">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[var(--yellow)]/15 text-[var(--yellow)] border border-[var(--yellow)]/30">
            <Smartphone size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-sm text-[var(--text)] tracking-tight break-words">
                <span>{language === 'ur' ? 'موبائل ڈیوائس پرمیشنز اور پش الرٹس' : 'Mobile Device Permissions & Lockscreen Alerts'}</span>
              </h4>
              {allGranted ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-bold shrink-0">
                  <CheckCircle2 size={11} /> {language === 'ur' ? 'تمام فعال' : 'All 100% Granted'}
                </span>
              ) : anyDenied ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold flex items-center gap-1 shrink-0">
                  <AlertTriangle size={11} /> {language === 'ur' ? 'اجازت بلاک ہے' : 'Permission Blocked'}
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shrink-0">
                  {language === 'ur' ? 'اجازت درکار ہے' : 'Action Required'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-dim)] mt-0.5 leading-relaxed">
              {language === 'ur'
                ? 'پش نوٹیفکیشن، لاک اسکرین الرٹس، آواز کے احکامات اور مستقل آف لائن ڈیٹا بیس۔'
                : 'Native push notifications, lockscreen heads-up banners, speech mic, and durable offline database.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {!allGranted && (
            <button
              type="button"
              onClick={handleGrantAll}
              disabled={loading}
              className="flex-1 sm:flex-initial justify-center px-3.5 py-1.5 rounded-lg bg-[var(--yellow)] hover:brightness-110 text-black font-mono text-xs font-bold transition active:scale-95 flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Sparkles size={13} />
              <span>{language === 'ur' ? 'تمام اجازتیں فعال کریں' : 'Grant / Fix All'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleMute}
            title={isMuted ? 'Permission warning banners are muted' : 'Click to block/mute all permission warning banners'}
            className={`flex-1 sm:flex-initial justify-center px-2.5 py-1.5 rounded-lg border text-xs font-mono transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              isMuted
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-white'
            }`}
          >
            <span>{isMuted ? (language === 'ur' ? 'انتباہات خاموش ہیں' : 'Alerts Blocked') : (language === 'ur' ? 'انتباہات بند کریں' : 'Block Alerts')}</span>
          </button>

          <button
            type="button"
            onClick={loadPermissions}
            title="Refresh permissions status"
            className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--yellow)] transition cursor-pointer shrink-0"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Embedded Iframe Sandbox Notice */}
      {permState.isIframe && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
          <Info size={16} className="shrink-0 mt-0.5 text-amber-400" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <p className="font-semibold leading-snug">
              {language === 'ur'
                ? 'براؤزر پریویو فریم میں ڈیوائس پرمیشن بلاک ہو سکتی ہے۔'
                : 'Running inside embedded preview sandbox.'}
            </p>
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              {language === 'ur'
                ? 'موبائل کروم اور سفاری عام طور پر فریم کے اندر مائیک اور پش کے پاپ اپس روک دیتے ہیں۔ حقیقی موبائل تجربے کے لیے براہ راست کھولیں۔'
                : 'Mobile browsers (Chrome, Safari) automatically block microphone & push popups inside embedded preview frames. Launch directly in your mobile browser to allow with 1 tap.'}
            </p>
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="px-2.5 py-1 rounded bg-amber-400 text-black font-bold text-[11px] font-mono flex items-center gap-1 hover:bg-amber-300 transition"
              >
                <ExternalLink size={12} />
                <span>{language === 'ur' ? 'براہ راست موبائل براؤزر میں کھولیں' : 'Open Direct App URL'}</span>
              </button>
              <button
                type="button"
                onClick={handleCopyDirectUrl}
                className="px-2.5 py-1 rounded bg-[var(--panel)] border border-amber-400/40 text-amber-300 font-mono text-[11px] flex items-center gap-1 hover:text-white transition"
              >
                {copiedUrl ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedUrl ? 'Copied Link!' : 'Copy Direct Link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Message */}
      {actionMessage && (
        <div className="p-2.5 rounded-lg bg-[var(--steel-line)]/40 border border-[var(--steel-line)] text-xs text-[var(--text)] font-mono flex items-center justify-between">
          <span className="leading-snug">{actionMessage}</span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-[var(--text-dim)] hover:text-[var(--text)] ml-2 text-sm shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Live Microphone Visualizer Test Box */}
      {isTestingMic && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold font-mono">
              <Radio size={14} className="animate-pulse" />
              <span>LIVE MICROPHONE HARDWARE DETECTED — SPEAK NOW</span>
            </div>
            <button
              type="button"
              onClick={stopMicTest}
              className="text-[11px] font-mono text-red-400 hover:underline cursor-pointer"
            >
              Stop Test
            </button>
          </div>
          {/* Level Bar */}
          <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden border border-emerald-500/30 p-0.5">
            <div
              className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500"
              style={{ width: `${Math.max(4, micAudioLevel)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-[var(--text-dim)]">
            <span>Input Volume: {micAudioLevel}%</span>
            <span className="text-emerald-300">Audio capture verified working</span>
          </div>
        </div>
      )}

      {/* Grid of 3 Main Mobile Permissions */}
      <div className={`grid grid-cols-1 ${compact ? 'gap-2.5' : 'md:grid-cols-3 gap-3'}`}>
        
        {/* 1. Push & Lockscreen Notifications */}
        <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] flex flex-col justify-between space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-lg ${
                  permState.notifications === 'granted'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : permState.notifications === 'denied'
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}
              >
                <BellRing size={16} />
              </div>
              <div>
                <span className="font-bold text-xs text-[var(--text)] block">
                  {language === 'ur' ? 'پش اور لاک اسکرین الرٹس' : 'Push & Lockscreen Alerts'}
                </span>
                <span className="text-[10px] text-[var(--text-dim)] font-mono">
                  {permState.isNative
                    ? 'Native Android Heads-Up'
                    : permState.isServiceWorkerReady
                    ? 'Service Worker Ready'
                    : 'Background Push'}
                </span>
              </div>
            </div>

            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                permState.notifications === 'granted'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : permState.notifications === 'denied'
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}
            >
              {permState.notifications === 'granted'
                ? 'GRANTED'
                : permState.notifications === 'denied'
                ? 'BLOCKED'
                : 'PROMPT'}
            </span>
          </div>

          <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
            {language === 'ur'
              ? 'موبائل لاک ہونے پر بھی نئے بل، ادائیگی اور اسٹاک کے الرٹس اسکرین پر روشن ہوں گے۔'
              : 'Displays high-priority notification cards directly on your phone lock screen with vibration and alert sound.'}
          </p>

          <div className="space-y-1.5 pt-1">
            {permState.notifications === 'granted' ? (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleTestImmediateNotification}
                  disabled={loading}
                  className="py-1.5 px-2 rounded-lg bg-[var(--panel-raised)] hover:bg-[var(--steel-line)] border border-[var(--steel-line)] text-[var(--text)] font-mono text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Bell size={11} className="text-emerald-400" />
                  <span>{testNotificationSent ? 'Sent!' : 'Test Push'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestLockscreenNotification}
                  disabled={lockscreenTestPending}
                  title="Schedules alert in 3s — Lock your phone to test lockscreen"
                  className="py-1.5 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Lock size={11} />
                  <span>
                    {lockscreenCountdown !== null ? `Lock now (${lockscreenCountdown}s)` : 'Test Lockscreen'}
                  </span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGrantNotifications}
                disabled={loading}
                className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <BellRing size={12} />
                <span>{language === 'ur' ? 'پش نوٹیفکیشن آن کریں' : 'Enable Push & Lockscreen'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Microphone Hardware Permission */}
        <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] flex flex-col justify-between space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-lg ${
                  permState.microphone === 'granted'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : permState.microphone === 'denied'
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}
              >
                <Mic size={16} />
              </div>
              <div>
                <span className="font-bold text-xs text-[var(--text)] block">
                  {language === 'ur' ? 'مائیکروفون ہارڈویئر' : 'Microphone Hardware'}
                </span>
                <span className="text-[10px] text-[var(--text-dim)] font-mono">
                  Voice Search & Commands
                </span>
              </div>
            </div>

            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                permState.microphone === 'granted'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : permState.microphone === 'denied'
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}
            >
              {permState.microphone === 'granted'
                ? 'GRANTED'
                : permState.microphone === 'denied'
                ? 'BLOCKED'
                : 'PROMPT'}
            </span>
          </div>

          <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
            {language === 'ur'
              ? 'اردو اور انگلش میں بول کر کسٹمر کھاتہ کھولنے اور فوری پروڈکٹ تلاش کرنے کے لیے۔'
              : 'Used for Urdu & English voice navigation, order lookups, and fast vocal commands.'}
          </p>

          <div className="space-y-1.5 pt-1">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={handleGrantMic}
                disabled={loading}
                className="py-1.5 px-2 rounded-lg bg-[var(--panel-raised)] hover:bg-[var(--steel-line)] border border-[var(--steel-line)] text-[var(--text)] font-mono text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <Mic size={11} className={permState.microphone === 'granted' ? 'text-emerald-400' : 'text-amber-400'} />
                <span>{permState.microphone === 'granted' ? 'Re-check' : 'Request Mic'}</span>
              </button>

              <button
                type="button"
                onClick={handleStartMicTest}
                disabled={loading}
                className={`py-1.5 px-2 rounded-lg font-mono text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                  isTestingMic
                    ? 'bg-red-500/20 border border-red-500 text-red-400 animate-pulse'
                    : 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                }`}
              >
                <Volume2 size={11} />
                <span>{isTestingMic ? 'Stop Mic' : 'Live Test'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Persistent Storage */}
        <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] flex flex-col justify-between space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-lg ${
                  permState.storagePersisted
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                }`}
              >
                <HardDrive size={16} />
              </div>
              <div>
                <span className="font-bold text-xs text-[var(--text)] block">
                  {language === 'ur' ? 'مستقل لوکل اسٹوریج' : 'Persistent Storage'}
                </span>
                <span className="text-[10px] text-[var(--text-dim)] font-mono">
                  {permState.storageEstimate
                    ? `${permState.storageEstimate.usageMB} MB Used (${permState.storageEstimate.quotaMB} MB Free)`
                    : 'IndexedDB & LocalStorage'}
                </span>
              </div>
            </div>

            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                permState.storagePersisted
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
              }`}
            >
              {permState.storagePersisted ? 'ACTIVE & SAFE' : 'STANDARD'}
            </span>
          </div>

          <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
            {language === 'ur'
              ? 'فون کی میموری کم ہونے پر بھی تمام بل، کیش اور انوینٹری محفوظ رہے گی۔'
              : 'Guarantees your offline transactions, ledgers & stock are saved locally and protected against OS cache clearing.'}
          </p>

          <div className="space-y-1.5 pt-1">
            <button
              type="button"
              onClick={handleGrantStorage}
              disabled={loading}
              className={`w-full py-1.5 px-3 rounded-lg font-mono text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                permState.storagePersisted
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-pointer hover:bg-emerald-500/25'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm cursor-pointer'
              }`}
            >
              <HardDrive size={12} />
              <span>{permState.storagePersisted ? 'Storage Protected (Click to Re-verify)' : 'Lock Persistent Storage'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Troubleshoot Accordion if any permission is denied */}
      {(anyDenied || showTroubleshootGuide) && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 space-y-3">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowTroubleshootGuide(!showTroubleshootGuide)}
          >
            <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
              <AlertTriangle size={15} />
              <span>
                {language === 'ur'
                  ? 'موبائل براؤزر میں پرمیشن ان بلاک کرنے کا طریقہ (Chrome / Safari / Android)'
                  : 'How to Unblock Permissions in Mobile Chrome / Safari / Android'}
              </span>
            </div>
            <button type="button" className="text-red-400 text-xs flex items-center gap-1">
              <span>{showTroubleshootGuide ? 'Hide Guide' : 'Show Guide'}</span>
              {showTroubleshootGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {showTroubleshootGuide && (
            <div className="space-y-2 text-xs text-[var(--text-dim)] pt-2 border-t border-red-500/20 font-mono leading-relaxed">
              <p className="text-[var(--text)] font-semibold">
                If the browser marked permissions as "Blocked" or "Denied", follow these 3 quick steps:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                {/* Chrome Mobile */}
                <div className="p-2.5 rounded-lg bg-black/30 border border-white/10 space-y-1">
                  <span className="font-bold text-amber-300 flex items-center gap-1">
                    📱 On Android Chrome Browser:
                  </span>
                  <ol className="list-decimal pl-4 space-y-1 text-zinc-300">
                    <li>Tap the <strong>Lock (🔒) or Tune settings</strong> icon in the address bar next to the URL.</li>
                    <li>Tap <strong>Permissions</strong> (or <strong>Site settings</strong>).</li>
                    <li>Toggle <strong>Notifications</strong> and <strong>Microphone</strong> from <em>Block</em> to <strong>Allow</strong>.</li>
                    <li>Tap <strong>Reload Page</strong> to apply immediately.</li>
                  </ol>
                </div>

                {/* iPhone / Safari */}
                <div className="p-2.5 rounded-lg bg-black/30 border border-white/10 space-y-1">
                  <span className="font-bold text-blue-300 flex items-center gap-1">
                    🍏 On iPhone / Safari:
                  </span>
                  <ol className="list-decimal pl-4 space-y-1 text-zinc-300">
                    <li>Tap the <strong>aA or Settings</strong> icon in the Safari search bar.</li>
                    <li>Tap <strong>Website Settings</strong> &gt; set <strong>Microphone</strong> to <em>Allow</em>.</li>
                    <li>For Lockscreen Notifications: Tap <strong>Share</strong> &gt; <strong>Add to Home Screen</strong>.</li>
                    <li>Open app from Home Screen to receive native push banners.</li>
                  </ol>
                </div>
              </div>

              <div className="pt-1 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-3 py-1.5 rounded-lg bg-[var(--yellow)] hover:brightness-110 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Reload &amp; Re-check Permissions</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenInNewTab}
                  className="px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text)] hover:text-white text-xs flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink size={12} />
                  <span>Open Direct Standalone URL</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
