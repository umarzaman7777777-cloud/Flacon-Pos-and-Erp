import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2, Share2, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full' | 'header';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header', className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already installed or running standalone, hide the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    try {
      setIsInstalling(true);
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  // Header compact button style
  if (variant === 'header') {
    if (isInstallable) {
      return (
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          title="Install Falcon POS App to Home Screen"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-300 hover:text-amber-200 hover:bg-amber-500/30 transition text-xs font-semibold shadow-sm active:scale-95 ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span className="hidden sm:inline">Install App</span>
        </button>
      );
    }

    if (isIOS) {
      return (
        <>
          <button
            onClick={() => setShowIOSGuide(true)}
            title="Add Falcon POS to iPhone / iPad Home Screen"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition text-xs font-medium ${className}`}
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Install on iOS</span>
          </button>

          {showIOSGuide && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="w-full max-w-sm max-w-full overflow-x-hidden break-words rounded-2xl bg-slate-900 border border-amber-500/30 p-6 shadow-2xl text-left">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <img src="/pwa-192x192.png" alt="Falcon POS" className="w-9 h-9 rounded-xl shadow" />
                    <div>
                      <h3 className="text-sm font-bold text-white">Install Falcon POS</h3>
                      <p className="text-xs text-amber-400 font-mono">Falcon Rod Maker — POS & ERP</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowIOSGuide(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 py-2 text-xs text-slate-300">
                  <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold">1</div>
                    <p>
                      Tap the <strong className="text-white flex items-center gap-1 inline-flex"><Share2 className="w-3.5 h-3.5 text-blue-400 inline" /> Share</strong> button in Safari toolbar.
                    </p>
                  </div>
                  <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold">2</div>
                    <p>
                      Scroll down and tap <strong className="text-white flex items-center gap-1 inline-flex"><PlusSquare className="w-3.5 h-3.5 text-emerald-400 inline" /> Add to Home Screen</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold">3</div>
                    <p>
                      Tap <strong className="text-amber-400">Add</strong> in top-right. Launch directly from your home screen with offline speed.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="mt-4 w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 text-xs transition"
                >
                  Got It
                </button>
              </div>
            </div>
          )}
        </>
      );
    }
  }

  // Full banner / card variant
  if (isInstallable) {
    return (
      <div className={`p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 border border-amber-500/30 flex items-center justify-between gap-4 ${className}`}>
        <div className="flex items-center gap-3">
          <img src="/pwa-192x192.png" alt="Falcon POS" className="w-12 h-12 rounded-xl shadow-md border border-amber-500/30" />
          <div>
            <h4 className="text-sm font-bold text-white">Install Falcon Rod Maker PWA</h4>
            <p className="text-xs text-slate-400">Works 100% offline with instant home screen access</p>
          </div>
        </div>
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-lg shrink-0"
        >
          <Download className="w-4 h-4" />
          Install App
        </button>
      </div>
    );
  }

  return null;
};
