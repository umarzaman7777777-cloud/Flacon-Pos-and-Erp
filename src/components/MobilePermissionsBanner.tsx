import React, { useState, useEffect } from 'react';
import {
  BellRing,
  Mic,
  HardDrive,
  ShieldAlert,
  ChevronRight,
  X,
  ExternalLink,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import {
  checkAllMobilePermissions,
  requestNotificationPermission,
  isInsideIframe,
  isMobileDevice,
  MobilePermissionsState
} from '../utils/mobilePermissions';
import { AppLanguage } from '../types';

interface MobilePermissionsBannerProps {
  language: AppLanguage;
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
}

export const MobilePermissionsBanner: React.FC<MobilePermissionsBannerProps> = ({
  language,
  onOpenSettings,
  onOpenNotifications
}) => {
  const [state, setState] = useState<MobilePermissionsState | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      if (localStorage.getItem('falcon_permissions_banner_dismissed') === 'true') return true;
      if (localStorage.getItem('falcon_block_permission_notifications') === 'true') return true;
      if (sessionStorage.getItem('falcon_permissions_banner_dismissed') === 'true') return true;
      return false;
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkAllMobilePermissions().then(setState);
  }, []);

  if (dismissed || !state) return null;

  // Suppress intrusive blocked banners inside iframes or when explicitly muted
  if (state.isIframe) return null;

  const isBlocked = state.notifications === 'denied' || state.microphone === 'denied';
  const needsNotifications = state.notifications !== 'granted';
  const needsMic = state.microphone !== 'granted';
  const needsStorage = !state.storagePersisted;

  // If everything is already granted, do not bother the user
  if (!needsNotifications && !needsMic && !needsStorage) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('falcon_permissions_banner_dismissed', 'true');
      sessionStorage.setItem('falcon_permissions_banner_dismissed', 'true');
    } catch {}
  };

  const handleMuteAll = () => {
    setDismissed(true);
    try {
      localStorage.setItem('falcon_block_permission_notifications', 'true');
      localStorage.setItem('falcon_permissions_banner_dismissed', 'true');
    } catch {}
  };

  const handleQuickEnable = async () => {
    setLoading(true);
    try {
      await requestNotificationPermission();
      const updated = await checkAllMobilePermissions();
      setState(updated);
      if (updated.notifications === 'granted' && onOpenNotifications) {
        onOpenNotifications();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDirect = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div
      id="mobile-permissions-ambient-banner"
      className="bg-gradient-to-r from-amber-500/15 via-[var(--panel-raised)] to-amber-500/10 border-b border-amber-500/30 px-3 sm:px-6 py-2 text-xs flex items-center justify-between gap-3 shadow-xs"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`p-1 rounded-full ${isBlocked ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'} shrink-0`}>
          <BellRing size={14} className={isBlocked ? '' : 'animate-pulse'} />
        </div>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-bold text-[var(--text)] text-xs truncate">
            {language === 'ur'
              ? isBlocked ? 'موبائل پرمیشنز براؤزر میں بلاک ہیں - درست کریں' : 'موبائل پش نوٹیفکیشن اور ڈیوائس اجازتیں درکار ہیں'
              : isBlocked ? 'Mobile Permissions Blocked by Browser — Fix Here' : 'Push Notifications & Device Access Pending'}
          </span>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-dim)]">
            {needsNotifications && (
              <span className={`px-1.5 py-0.2 rounded border ${state.notifications === 'denied' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                Push {state.notifications === 'denied' ? 'Blocked' : 'Pending'}
              </span>
            )}
            {needsMic && (
              <span className={`px-1.5 py-0.2 rounded border ${state.microphone === 'denied' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                Mic {state.microphone === 'denied' ? 'Blocked' : 'Pending'}
              </span>
            )}
            {needsStorage && (
              <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Offline Storage
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {state.isIframe && (
          <button
            type="button"
            onClick={handleOpenDirect}
            className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-black/40 border border-amber-400/40 text-amber-300 text-[11px] font-mono hover:text-white transition"
          >
            <ExternalLink size={11} />
            <span>Open Direct</span>
          </button>
        )}

        {needsNotifications && !isBlocked && (
          <button
            type="button"
            onClick={handleQuickEnable}
            disabled={loading}
            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] font-mono transition active:scale-95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Sparkles size={11} />
            <span>{language === 'ur' ? 'پش فعال کریں' : 'Enable Push'}</span>
          </button>
        )}

        {onOpenNotifications && (
          <button
            type="button"
            onClick={onOpenNotifications}
            className="flex items-center gap-1 text-[11px] font-bold text-[var(--text)] hover:text-[var(--yellow)] transition cursor-pointer px-2 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)]"
          >
            <span>{isBlocked ? (language === 'ur' ? 'درست کریں' : 'Fix Block') : (language === 'ur' ? 'تفصیلات' : 'Permissions')}</span>
            <ChevronRight size={12} />
          </button>
        )}

        <button
          type="button"
          onClick={handleMuteAll}
          title="Block all permission notifications & don't show again"
          className="text-[10px] text-[var(--text-dim)] hover:text-white px-1.5 py-0.5 rounded border border-transparent hover:border-[var(--steel-line)] transition hidden sm:inline"
        >
          {language === 'ur' ? 'دوبارہ نہ دکھائیں' : "Don't show"}
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          title="Dismiss banner"
          className="p-1 rounded-md text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};
