import React, { useEffect, useState } from 'react';
import { WifiOff, CheckCircle2 } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnectedToast, setShowReconnectedToast] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedToast(true);
      const timer = setTimeout(() => setShowReconnectedToast(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnectedToast(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 left-4 z-[9990] flex items-center gap-2.5 rounded-xl bg-amber-500/95 text-slate-950 px-3.5 py-2 text-xs font-bold shadow-xl border border-amber-300 backdrop-blur-sm animate-bounce-subtle">
        <WifiOff className="w-4 h-4 text-slate-950 shrink-0" />
        <span>Offline Mode — All orders & ledgers stored locally with instant speed.</span>
      </div>
    );
  }

  if (showReconnectedToast) {
    return (
      <div className="fixed bottom-4 left-4 z-[9990] flex items-center gap-2.5 rounded-xl bg-emerald-600 text-white px-3.5 py-2 text-xs font-bold shadow-xl border border-emerald-400 backdrop-blur-sm transition-all duration-300">
        <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
        <span>Connection Restored — Syncing background transactions...</span>
      </div>
    );
  }

  return null;
};
