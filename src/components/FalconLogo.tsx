import React from 'react';
import { FALCON_LOGO_PNG } from '../utils/logoData';

export interface FalconLogoProps {
  variant?: 'full' | 'emblem' | 'icon' | 'badge' | 'image' | 'horizontal';
  size?: number | string;
  className?: string;
  color?: string;
  showText?: boolean;
  companyName?: string;
  companyTagline?: string;
  altText?: string;
  useImage?: boolean;
  onClick?: () => void;
}

export const FalconLogo: React.FC<FalconLogoProps> = ({
  variant = 'emblem',
  size = 40,
  className = '',
  color: _color,
  showText = false,
  companyName = 'Falcon Rod Maker',
  companyTagline = 'Fan Accessories • Gujrat',
  altText = 'Falcon Rod Maker Gujrat',
  onClick
}) => {
  const numericSize = typeof size === 'number' ? size : parseInt(size as string, 10) || 40;

  // Horizontal variant (emblem + company name & tagline side-by-side)
  if (variant === 'horizontal') {
    return (
      <div 
        onClick={onClick}
        className={`inline-flex items-center gap-2.5 select-none group ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        <div className="relative shrink-0 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-amber-500/15 blur-sm pointer-events-none group-hover:bg-amber-500/25 transition-all" />
          <img
            src="/falcon-theme-rod-logo.svg"
            alt={altText}
            style={{ height: `${Math.max(26, numericSize * 0.8)}px`, width: 'auto' }}
            className="relative z-10 object-contain select-none drop-shadow-[0_2px_8px_rgba(245,183,0,0.3)] transition-transform duration-200 group-hover:scale-105"
          />
        </div>
        <div className="flex flex-col text-left min-w-0">
          <span className="font-serif font-black text-sm tracking-tight text-[var(--text)] group-hover:text-amber-400 transition-colors truncate">
            {companyName}
          </span>
          <span className="text-[10px] font-mono tracking-wider text-[var(--yellow)] uppercase font-semibold leading-none truncate mt-0.5">
            {companyTagline}
          </span>
        </div>
      </div>
    );
  }

  // Full variant with text below
  if (variant === 'full' || showText) {
    return (
      <div 
        onClick={onClick}
        className={`inline-flex flex-col items-center select-none group ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        <div className="relative flex items-center justify-center py-1">
          <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl pointer-events-none group-hover:bg-amber-500/30 transition-all" />
          <img
            src="/falcon-theme-rod-logo.svg"
            alt={altText}
            style={{ height: `${numericSize}px`, width: 'auto' }}
            className="relative z-10 object-contain select-none max-w-full drop-shadow-[0_6px_20px_rgba(245,183,0,0.35)] transition-transform duration-200 group-hover:scale-105"
          />
        </div>
        <div className="mt-2 text-center">
          <div className="font-serif font-black text-sm text-[var(--text)] tracking-tight">
            {companyName}
          </div>
          <div className="text-[10px] font-mono text-[var(--yellow)] uppercase font-semibold">
            {companyTagline}
          </div>
        </div>
      </div>
    );
  }

  // Emblem, badge, icon, and image variants: Pure aesthetic standalone logo with subtle glowing aura and zero white boxes
  return (
    <div 
      onClick={onClick}
      className={`relative inline-flex items-center justify-center select-none group ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-lg pointer-events-none group-hover:bg-amber-500/30 transition-all" />
      <img
        src="/falcon-theme-rod-logo.svg"
        alt={altText}
        style={{ height: `${numericSize}px`, width: 'auto' }}
        className="relative z-10 object-contain select-none max-w-full drop-shadow-[0_4px_16px_rgba(245,183,0,0.35)] transition-transform duration-200 group-hover:scale-105"
      />
    </div>
  );
};

export default FalconLogo;
