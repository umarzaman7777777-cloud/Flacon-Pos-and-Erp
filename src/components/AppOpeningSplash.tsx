import React, { useEffect, useState } from 'react';
import { FalconLogo } from './FalconLogo';
import { Sparkles, Loader2 } from 'lucide-react';
import { AppLanguage } from '../types';

interface AppOpeningSplashProps {
  onComplete: () => void;
  companyName?: string;
  companyTagline?: string;
  language?: AppLanguage;
}

export const AppOpeningSplash: React.FC<AppOpeningSplashProps> = ({
  onComplete,
  companyName = 'Falcon Rod Maker',
  companyTagline = 'Fan Accessories • Gujrat',
  language = 'en'
}) => {
  const [phase, setPhase] = useState<'enter' | 'active' | 'exit'>('enter');

  useEffect(() => {
    // Ultra-snappy opening: active in 20ms, begins smooth fadeout at 420ms, unmounts at 580ms
    const timer1 = setTimeout(() => setPhase('active'), 20);
    const timer2 = setTimeout(() => setPhase('exit'), 420);
    const timer3 = setTimeout(() => onComplete(), 580);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <div
      id="app-opening-splash"
      onClick={onComplete}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-b from-[#070b14] via-[#0f172a] to-[#050811] text-white select-none transition-opacity duration-200 cursor-pointer ${
        phase === 'exit' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Radiant Background Aura */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-amber-500/25 via-yellow-400/20 to-transparent blur-3xl animate-pulse" />
        <div className="absolute w-72 h-72 rounded-full border border-amber-400/20 animate-ping opacity-25" />
      </div>

      {/* Main Logo Container */}
      <div
        className={`relative z-10 flex flex-col items-center justify-center p-6 text-center transform transition-all duration-400 ${
          phase === 'enter'
            ? 'scale-95 opacity-0 translate-y-2'
            : phase === 'active'
            ? 'scale-100 opacity-100 translate-y-0'
            : 'scale-102 opacity-0 -translate-y-1'
        }`}
      >
        {/* Clean Standalone Falcon Logo with Organic Ambient Glow & Floating Animation (NO BOXES) */}
        <div className="relative mb-5 flex items-center justify-center">
          {/* Subtle Golden Ambient Aura */}
          <div className="absolute inset-0 max-w-[140px] max-h-[140px] mx-auto rounded-full bg-amber-500/25 blur-2xl pointer-events-none animate-pulse" />
          
          {/* Standalone Logo Element */}
          <div className="relative z-10 transition-transform duration-300 hover:scale-105 flex items-center justify-center">
            <FalconLogo
              variant="emblem"
              size={110}
              className="drop-shadow-[0_8px_24px_rgba(245,183,0,0.45)]"
            />
          </div>
        </div>

        {/* Brand Name & Tagline */}
        <h1 className="font-serif font-black text-2xl sm:text-3xl text-white tracking-tight drop-shadow-md flex items-center gap-2">
          {companyName}
          <Sparkles size={18} className="text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
        </h1>
        
        <p className="font-mono text-xs sm:text-sm text-amber-400 font-bold uppercase tracking-widest mt-1 drop-shadow-xs">
          {companyTagline}
        </p>

        <div className="h-0.5 w-32 bg-gradient-to-r from-transparent via-amber-400 to-transparent my-4 opacity-80" />

        <p className="text-[11px] font-mono text-slate-300 tracking-wider uppercase font-semibold">
          Industrial POS &amp; Workshop ERP
        </p>

        {/* Login Options Loading Indicator Badge (Promptly Transitions directly to Lock Options) */}
        <div className="mt-7 flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/85 border border-amber-400/50 shadow-inner">
          <Loader2 size={13} className="text-amber-400 animate-spin" />
          <span className="text-[10px] sm:text-[11px] font-mono font-bold text-amber-300 uppercase tracking-widest">
            {language === 'ur' ? 'لاگ ان آپشنز لوڈ ہو رہے ہیں...' : 'Login Options Loading...'}
          </span>
        </div>
      </div>
    </div>
  );
};

