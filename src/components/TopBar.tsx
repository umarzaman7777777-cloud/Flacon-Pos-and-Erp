import React, { useState, useEffect } from 'react';
import {
  Search,
  Moon,
  Sun,
  Bell,
  Mic,
  Lock,
  Menu,
  Wifi,
  Bluetooth,
  Usb,
  Cloud,
  CloudOff,
  RefreshCw,
  Database,
  Trash2,
  Grid,
  AlertTriangle,
  Printer
} from 'lucide-react';
import { AppLanguage, AppTheme, PrinterSettings } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { getPrinterSettings, subscribeToPrinterSettings } from '../utils/printerManager';
import { getStoredSheetsToken, WORKSPACE_SYNC_EVENT, isRealGoogleOAuthToken } from '../utils/googleSheetsSync';
import { getStoredDriveToken } from '../utils/googleDriveBackup';
import { PWAInstallButton } from './PWAInstallButton';

interface TopBarProps {
  theme: AppTheme;
  language: AppLanguage;
  companyName?: string;
  companyTagline?: string;
  notificationCount: number;
  syncState: 'synced' | 'syncing' | 'offline' | 'error';
  pendingQueueCount?: number;
  workspaceStatus?: 'syncing' | 'synced' | 'ready' | 'warning' | 'disconnected';
  workspaceBadgeText?: string;
  workspaceTooltip?: string;
  sheetsConnected?: boolean;
  driveConnected?: boolean;
  isSyncingWorkspace?: boolean;
  isAutoAuthenticating?: boolean;
  onOpenWorkspaceModal?: () => void;
  onToggleTheme: () => void;
  onToggleLanguage?: (lang: AppLanguage) => void;
  onOpenSearch: () => void;
  onOpenVoice: () => void;
  onOpenNotifications: () => void;
  onRefreshOverview: () => void;
  onLock: () => void;
  onOpenSyncModal?: () => void;
  onToggleMenu?: () => void;
  onOpenPrinterConfig?: () => void;
  isPrinterConfigActive?: boolean;
  recycleBinCount?: number;
  onOpenRecycleBin?: () => void;
  onOpenGmailVault?: () => void;
  showBlueprintGrid?: boolean;
  onToggleBlueprintGrid?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  theme,
  language,
  companyName = 'Falcon Rod Maker',
  companyTagline = 'Precision Ceiling Fan Down Rod Specialist — Gujrat, Pakistan',
  notificationCount,
  syncState,
  pendingQueueCount = 0,
  workspaceStatus = 'disconnected',
  workspaceTooltip,
  sheetsConnected = false,
  driveConnected = false,
  isSyncingWorkspace = false,
  isAutoAuthenticating = false,
  onOpenWorkspaceModal,
  onToggleTheme,
  onOpenSearch,
  onOpenVoice,
  onOpenNotifications,
  onRefreshOverview,
  onLock,
  onOpenSyncModal,
  onToggleMenu,
  onOpenPrinterConfig,
  isPrinterConfigActive = false,
  recycleBinCount = 0,
  onOpenRecycleBin,
  showBlueprintGrid = false,
  onToggleBlueprintGrid
}) => {
  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  // Real-time Google Workspace Connectivity State
  const isTokenLive = (info: any) => {
    return Boolean(info && info.token && isRealGoogleOAuthToken(info.token));
  };

  const [localSheetsConnected, setLocalSheetsConnected] = useState(() => isTokenLive(getStoredSheetsToken()));
  const [localDriveConnected, setLocalDriveConnected] = useState(() => isTokenLive(getStoredDriveToken()));

  useEffect(() => {
    const checkTokens = () => {
      setLocalSheetsConnected(isTokenLive(getStoredSheetsToken()));
      setLocalDriveConnected(isTokenLive(getStoredDriveToken()));
    };
    checkTokens();
    window.addEventListener(WORKSPACE_SYNC_EVENT, checkTokens);
    window.addEventListener('storage', checkTokens);
    return () => {
      window.removeEventListener(WORKSPACE_SYNC_EVENT, checkTokens);
      window.removeEventListener('storage', checkTokens);
    };
  }, []);

  const hasSheets = sheetsConnected || localSheetsConnected;
  const hasDrive = driveConnected || localDriveConnected;
  const hasAnyGoogle = hasSheets || hasDrive;

  const isSyncing = isSyncingWorkspace || workspaceStatus === 'syncing' || isAutoAuthenticating;
  const hasAuthWarning = workspaceStatus === 'warning';

  const googleState: 'live' | 'syncing' | 'warning' | 'offline' = hasAuthWarning
    ? 'warning'
    : hasAnyGoogle
    ? 'live'
    : isSyncing
    ? 'syncing'
    : 'offline';

  // Printer settings
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(() => getPrinterSettings());

  useEffect(() => {
    setPrinterSettings(getPrinterSettings());
    const unsub = subscribeToPrinterSettings(settings => {
      setPrinterSettings(settings);
    });
    return () => unsub();
  }, []);

  const isBluetooth = printerSettings.connectionType === 'bluetooth';
  const isWifi = printerSettings.connectionType === 'wifi';

  const isPrinterReady = isBluetooth
    ? Boolean(printerSettings.bluetoothPaired)
    : isWifi
    ? Boolean(printerSettings.wifiIpAddress)
    : Boolean(printerSettings.wiredPortName);

  const printerBadgeLabel = isBluetooth
    ? printerSettings.bluetoothDeviceName
      ? printerSettings.bluetoothDeviceName.replace(/mobile|printer|thermal/gi, '').trim().split(' ')[0] || 'PT-210'
      : 'PT-210'
    : isWifi
    ? 'Wi-Fi'
    : 'USB';

  const printerTooltip = isBluetooth
    ? `Thermal POS Printer (Bluetooth): ${printerSettings.bluetoothPaired ? 'Paired & Ready' : 'Standby / Unpaired'} • ${printerSettings.bluetoothDeviceName || 'PT-210'} (${printerSettings.paperSize.toUpperCase()})`
    : isWifi
    ? `Thermal POS Printer (Wi-Fi LAN): ${printerSettings.wifiIpAddress ? `Connected (${printerSettings.wifiIpAddress})` : 'IP Not Configured'}`
    : `Thermal POS Printer (USB): Ready`;

  return (
    <header className="bg-[var(--panel)] border-b border-[var(--steel-line)] relative select-none max-w-full overflow-x-hidden break-words font-mono">
      {/* Row 1: Brand Identity Header */}
      <div className="px-3.5 sm:px-6 py-2.5 flex items-center justify-between border-b border-[var(--steel-line)]/50 bg-[var(--panel)]">
        <button
          type="button"
          onClick={onRefreshOverview}
          className="flex items-center gap-2.5 sm:gap-3 text-left group transition active:scale-[0.99] focus:outline-none min-w-0"
          title={t('update_overview')}
        >
          <div className="relative flex items-center justify-center shrink-0">
            <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-md pointer-events-none group-hover:bg-amber-500/35 transition-all" />
            <img
              src="/falcon-theme-rod-logo.svg"
              alt="Falcon Rod Maker"
              className="relative z-10 h-8 sm:h-9 w-auto object-contain select-none animate-logo-glow transition-transform duration-200 group-hover:scale-105 drop-shadow-[0_2px_10px_rgba(245,183,0,0.35)]"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-serif font-black text-sm sm:text-lg tracking-tight text-[var(--text)] group-hover:text-[var(--yellow)] transition-colors truncate">
              {companyName || 'Falcon Rod Maker'}
            </span>
            <span className="text-[9.5px] sm:text-[11px] font-mono tracking-wider text-[var(--yellow)] uppercase font-semibold leading-tight truncate">
              {companyTagline || 'Precision Ceiling Fan Down Rod Specialist — Gujrat, Pakistan'}
            </span>
          </div>
        </button>

        {/* Quick PWA Install Button on right of Row 1 */}
        <div className="hidden sm:block shrink-0">
          <PWAInstallButton variant="header" />
        </div>
      </div>

      {/* Row 2: Streamlined Quick Action Bar (Designed to never truncate or overflow) */}
      <div className="px-2.5 sm:px-6 py-1.5 flex items-center justify-between gap-1.5 sm:gap-2 bg-[var(--panel-raised)]/35 overflow-x-auto no-scrollbar">
        {/* Left Side: Navigation & Core Operations */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Menu button */}
          {onToggleMenu && (
            <button
              type="button"
              id="btn-toggle-main-menu"
              onClick={onToggleMenu}
              title="Toggle Menu"
              className="flex items-center gap-1 h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text)] hover:border-amber-400 transition active:scale-95 text-xs font-semibold cursor-pointer"
            >
              <Menu size={14} />
              <span className="hidden xs:inline">Menu</span>
            </button>
          )}

          {/* Lock Screen */}
          <button
            type="button"
            id="btn-header-lock-screen"
            onClick={onLock}
            title="Lock Terminal"
            className="flex items-center gap-1 h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 text-red-400 font-bold text-xs transition active:scale-95 cursor-pointer shadow-xs"
          >
            <Lock size={12} className="text-red-400 shrink-0" />
            <span className="uppercase tracking-wider">Lock</span>
          </button>

          {/* Voice Assistant Mic */}
          <button
            type="button"
            onClick={onOpenVoice}
            title="Voice Assistant (Urdu & English)"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Mic size={14} className="text-amber-400" />
          </button>

          {/* Global Search */}
          <button
            type="button"
            onClick={onOpenSearch}
            title={t('search_everything')}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] hover:border-amber-400 text-zinc-300 hover:text-white flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Search size={13} />
          </button>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={onToggleTheme}
            title="Switch theme"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] hover:border-amber-400 text-zinc-300 hover:text-white flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer"
          >
            {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} className="text-amber-400" />}
          </button>

          {/* Blueprint Grid ON / OFF */}
          {onToggleBlueprintGrid && (
            <button
              type="button"
              id="topbar-grid-toggle-btn"
              onClick={onToggleBlueprintGrid}
              title={showBlueprintGrid ? 'Grid: ON' : 'Grid: OFF'}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer ${
                showBlueprintGrid
                  ? 'border-sky-400 bg-sky-950/70 text-sky-300 shadow-xs'
                  : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-zinc-400 hover:text-white'
              }`}
            >
              <Grid size={13} />
            </button>
          )}
        </div>

        {/* Right Side: Status Badges, Notifications & Hardware Printer */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
          {/* Notifications Button */}
          <button
            type="button"
            onClick={onOpenNotifications}
            title={t('nav_notifications')}
            className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] hover:border-amber-400 text-zinc-300 hover:text-white flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Bell size={13} />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white font-mono text-[9px] font-bold flex items-center justify-center animate-pulse">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>

          {/* Recycle Bin Button */}
          <button
            type="button"
            onClick={onOpenRecycleBin}
            title="Recycle Bin (Recovery)"
            className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] hover:border-rose-400 text-zinc-300 hover:text-white flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Trash2 size={13} className={recycleBinCount > 0 ? 'text-rose-400' : 'text-zinc-400'} />
            {recycleBinCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white font-mono text-[9px] font-bold flex items-center justify-center shadow-xs">
                {recycleBinCount}
              </span>
            )}
          </button>

          {/* Terminal DB Status Capsule */}
          <button
            type="button"
            id="topbar-cloud-sync-btn"
            onClick={onOpenSyncModal}
            title="Terminal DB: Multi-device sync"
            className={`flex items-center gap-1.5 h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg border text-[10px] font-bold uppercase transition cursor-pointer active:scale-95 shrink-0 ${
              syncState === 'synced'
                ? 'border-indigo-500/40 bg-indigo-950/40 text-indigo-300 hover:border-indigo-400'
                : syncState === 'syncing'
                ? 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-zinc-400'
            }`}
          >
            <Database size={11} className="text-indigo-400 shrink-0" />
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                syncState === 'synced' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.7)]' : 'bg-amber-400'
              }`}
            />
            <span className="font-bold">DB</span>
          </button>

          {/* Google Workspace Live Sync Capsule */}
          <button
            type="button"
            id="topbar-workspace-sync-btn"
            onClick={onOpenWorkspaceModal}
            title={workspaceTooltip || 'Google Workspace Sync (Drive & Sheets)'}
            className={`flex items-center gap-1.5 h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg border text-[10px] font-bold uppercase transition cursor-pointer active:scale-95 shrink-0 ${
              googleState === 'warning'
                ? 'border-rose-500/80 bg-rose-950/60 text-rose-300'
                : googleState === 'live'
                ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-300 hover:border-emerald-400'
                : 'border-amber-500/50 bg-amber-950/40 text-amber-300'
            }`}
          >
            {googleState === 'warning' ? (
              <AlertTriangle size={12} className="text-rose-400 shrink-0" />
            ) : googleState === 'syncing' || isSyncing ? (
              <RefreshCw size={11} className="text-amber-400 animate-spin shrink-0" />
            ) : googleState === 'live' ? (
              <Cloud size={11} className="text-emerald-400 shrink-0" />
            ) : (
              <CloudOff size={11} className="text-amber-400 shrink-0" />
            )}

            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                googleState === 'live' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-amber-400'
              }`}
            />

            <span className="font-black text-[9.5px]">
              {googleState === 'live' ? 'LIVE' : googleState === 'warning' ? 'RE-AUTH' : 'SYNC'}
            </span>

            {googleState === 'live' && (
              <span className="hidden md:inline-flex items-center gap-1 text-[8.5px] text-emerald-400/80 font-normal">
                {hasSheets && <span>Sheets</span>}
                {hasDrive && <span>· Drive</span>}
              </span>
            )}
          </button>

          {/* Hardware Thermal Printer Capsule (Clean & Never Truncated) */}
          <button
            type="button"
            id="topbar-printer-status-btn"
            onClick={onOpenPrinterConfig}
            title={printerTooltip}
            className={`flex items-center gap-1.5 h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg border text-[10px] font-bold uppercase transition cursor-pointer active:scale-95 shrink-0 ${
              isPrinterConfigActive
                ? 'border-amber-400 bg-amber-500/15 text-amber-400'
                : 'border-[var(--steel-line)] bg-[var(--panel-raised)] text-zinc-300 hover:border-amber-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isPrinterReady ? 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]' : 'bg-amber-400 animate-pulse'
              }`}
            />
            {isBluetooth ? (
              <Bluetooth size={11} className={isPrinterReady ? 'text-sky-400' : 'text-amber-400'} />
            ) : isWifi ? (
              <Wifi size={11} className={isPrinterReady ? 'text-emerald-400' : 'text-amber-400'} />
            ) : (
              <Usb size={11} className="text-zinc-400" />
            )}
            <span className="font-bold">
              {printerBadgeLabel}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
