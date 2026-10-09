import { FALCON_LOGO_PNG } from '../utils/logoData';
import React, { useState } from 'react';
import {
  LayoutDashboard,
  Bell,
  Images,
  Package,
  Factory,
  Layers,
  TrendingUp,
  FileSpreadsheet,
  Receipt,
  Undo2,
  Brush,
  Users,
  Recycle,
  Wallet,
  Boxes,
  Database,
  Settings,
  Info,
  ChevronRight,
  Menu,
  X,
  FolderDown,
  Printer,
  ShieldCheck,
  Trash2,
  Cloud
} from 'lucide-react';
import { AppLanguage, AppView } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { FalconLogo } from './FalconLogo';

interface SidebarProps {
  currentView: AppView;
  activeCat: string;
  language: AppLanguage;
  companyName?: string;
  companyTagline?: string;
  notificationCount: number;
  onSelectView: (view: AppView) => void;
  onSelectCategory: (cat: string) => void;
  onLock?: () => void;
  onOpenHelp?: () => void;
  onOpenAbout?: () => void;
  onOpenGateReceipts?: () => void;
  recycleBinCount?: number;
  onOpenRecycleBin?: () => void;
  onOpenGmailVault?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  activeCat,
  language,
  companyName = 'Falcon Rod Maker',
  companyTagline = 'Fan Accessories • Gujrat',
  notificationCount,
  onSelectView,
  onSelectCategory,
  onOpenAbout,
  onOpenGateReceipts,
  recycleBinCount = 0,
  onOpenRecycleBin,
  onOpenGmailVault,
  isOpen = false,
  onClose
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isMobileOpen = isOpen || internalOpen;

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    fanRods: true
  });

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const renderBilingual = (en: string, ur: string) => (
    <div className="flex flex-col min-w-0 text-left">
      <span className="leading-tight truncate">{en}</span>
      <span className="text-[10px] font-serif opacity-75 leading-tight truncate -mt-0.5">{ur}</span>
    </div>
  );

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const closeSidebar = () => {
    setInternalOpen(false);
    onClose?.();
  };

  const handleNavClick = (view: AppView) => {
    onSelectView(view);
    closeSidebar();
  };

  const handleCatClick = (cat: string) => {
    onSelectCategory(cat);
    closeSidebar();
  };

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Main Vertical Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 sm:w-80 lg:w-64 max-w-full overflow-x-hidden break-words bg-[var(--panel)] border-r border-[var(--steel-line)] flex flex-col shrink-0 h-full max-h-[100dvh] transform transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Logo Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-[var(--steel-line)] bg-[var(--panel-raised)]/40">
          <div 
            onClick={() => handleNavClick('overview')}
            className="flex items-center gap-2.5 cursor-pointer group select-none min-w-0"
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
              <span className="font-serif font-bold text-sm tracking-tight text-[var(--text)] group-hover:text-[var(--yellow)] transition-colors truncate">
                {companyName || 'Falcon Rod Maker'}
              </span>
              <span className="text-[10px] font-mono tracking-wider text-[var(--yellow)] uppercase font-semibold leading-none truncate mt-0.5">
                {companyTagline || 'Fan Accessories • Gujrat'}
              </span>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          <button
            type="button"
            onClick={closeSidebar}
            title="Close menu"
            className="lg:hidden p-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] transition shrink-0 ml-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Vertical Nav List */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Core Quick Views */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => handleNavClick('overview')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
              currentView === 'overview'
                ? 'bg-[var(--yellow)] text-black shadow'
                : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
            }`}
          >
            <LayoutDashboard size={16} className="shrink-0" />
            {renderBilingual('Overview Dashboard', 'کاروباری جائزہ')}
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('notifications')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition ${
              currentView === 'notifications'
                ? 'bg-[var(--yellow)] text-black shadow'
                : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Bell size={16} className="shrink-0" />
              {renderBilingual('Notifications & Alerts', 'اطلاعات و الرٹس')}
            </div>
            {notificationCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--red)] text-white text-[10px] font-mono font-bold shrink-0 ml-1">
                {notificationCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('gallery')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
              currentView === 'gallery'
                ? 'bg-[var(--yellow)] text-black shadow'
                : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
            }`}
          >
            <Images size={16} className="shrink-0" />
            {renderBilingual('Product Gallery', 'پروڈکٹ گیلری')}
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('exports')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition ${
              currentView === 'exports'
                ? 'bg-[var(--yellow)] text-black shadow'
                : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <FolderDown size={16} className="shrink-0" />
              {renderBilingual('Exports & Archive', 'محفوظ فائلز و ریکارڈ')}
            </div>
            <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase shrink-0 ml-1 ${
              currentView === 'exports' ? 'bg-black text-[var(--yellow)]' : 'bg-amber-400/20 text-amber-300'
            }`}>
              JPG/PDF
            </span>
          </button>
        </div>

        {/* Categories (Fan Rods) */}
        <div>
          <button
            type="button"
            onClick={() => toggleGroup('fanRods')}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Package size={16} className="text-[var(--yellow)] shrink-0" />
              {renderBilingual('Fan Rods Catalog', 'فین راڈز کیٹلاگ')}
            </div>
            <ChevronRight
              size={14}
              className={`transform transition-transform shrink-0 ${expandedGroups.fanRods ? 'rotate-90' : ''}`}
            />
          </button>

          {expandedGroups.fanRods && (
            <div className="ml-4 pl-2 border-l border-[var(--steel-line)] mt-1 space-y-1">
              {[
                { cat: 'Rod (Ceiling)', en: 'Ceiling Fan Rods', ur: 'سیلنگ فین راڈز', badge: 'Ceiling' },
                { cat: 'Rod (Pedestal)', en: 'Pedestal Fan Rods', ur: 'پیڈسٹل فین راڈز', badge: 'Pedestal' }
              ].map(item => {
                const isSelected =
                  currentView === 'products' &&
                  (activeCat === item.cat ||
                    (item.cat === 'Rod (Ceiling)' &&
                      (activeCat === 'Ceiling Fan Down Rod' ||
                        activeCat === 'Industrial Down Rod' ||
                        activeCat?.toLowerCase().includes('ceiling'))) ||
                    (item.cat === 'Rod (Pedestal)' &&
                      (activeCat === 'Pedestal Extension Rod' ||
                        activeCat === 'Bracket Fan Mounting Rod' ||
                        activeCat?.toLowerCase().includes('pedestal'))));

                return (
                  <button
                    key={item.cat}
                    type="button"
                    onClick={() => handleCatClick(item.cat)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-[var(--yellow)] text-black shadow font-bold'
                        : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
                    }`}
                  >
                    {renderBilingual(item.en, item.ur)}
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase shrink-0 ml-1 ${
                        isSelected
                          ? 'bg-black/20 text-black font-bold'
                          : 'bg-[var(--panel-raised)] text-[var(--text-dim)] border border-[var(--steel-line)]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Business Modules */}
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)] px-3 mb-1.5 flex items-center justify-between">
            <span>Business</span>
            <span className="font-serif normal-case text-[10px] opacity-75">کاروبار</span>
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => handleNavClick('factories')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'factories'
                  ? 'bg-[var(--yellow)] text-black shadow'
                  : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
              }`}
            >
              <Factory size={16} className="shrink-0" />
              {renderBilingual('Factories (Customers)', 'فیکٹریاں اور کسٹمرز')}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('raw_material')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'raw_material' || currentView === 'rawmaterial'
                  ? 'bg-[var(--yellow)] text-black shadow'
                  : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
              }`}
            >
              <Layers size={16} className="shrink-0" />
              {renderBilingual('Raw Material (Suppliers)', 'خام مال اور سپلائرز')}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('products')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'sales' || currentView === 'products'
                  ? 'bg-[var(--yellow)] text-black shadow'
                  : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
              }`}
            >
              <TrendingUp size={16} className="shrink-0" />
              {renderBilingual('Sales Counter (POS)', 'سیلز کاؤنٹر و آرڈرز')}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('transactions')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'transactions'
                  ? 'bg-[var(--yellow)] text-black shadow'
                  : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
              }`}
            >
              <FileSpreadsheet size={16} className="shrink-0" />
              {renderBilingual('Order Booked', 'بک شدہ آرڈرز')}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('expenses')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'expenses'
                  ? 'bg-[var(--yellow)] text-black shadow'
                  : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
              }`}
            >
              <Receipt size={16} className="shrink-0" />
              {renderBilingual('Daily Expenses', 'روزانہ کے اخراجات')}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('returns')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'returns' || currentView === 'productreturns'
                  ? 'bg-[var(--yellow)] text-black shadow'
                  : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
              }`}
            >
              <Undo2 size={16} className="shrink-0" />
              {renderBilingual('Product Returns', 'پروڈکٹ واپسی')}
            </button>
          </div>
        </div>

        {/* Industrial Ledgers */}
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)] px-3 mb-1.5 flex items-center justify-between">
            <span>Inventory & Ledgers</span>
            <span className="font-serif normal-case text-[10px] opacity-75">کھاتہ جات</span>
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => handleNavClick('paint_ledger')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'paint' || currentView === 'paint_ledger'
                  ? 'bg-[var(--yellow)] text-black shadow'
                  : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
              }`}
            >
              <Brush size={16} className="shrink-0" />
              {renderBilingual('Paint Ledger', 'رنگ لیجر')}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('labour_ledger')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'labourledger' || currentView === 'labour_ledger'
                  ? 'bg-[var(--yellow)] text-black shadow'
                  : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
              }`}
            >
              <Users size={16} className="shrink-0" />
              {renderBilingual('Labour Ledger', 'مزدوری لیجر')}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('scrapledger')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'scrapledger'
                  ? 'bg-[var(--yellow)] text-black shadow'
                  : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
              }`}
            >
              <Recycle size={16} className="shrink-0" />
              {renderBilingual('Scrap Ledger', 'سکریپ لیجر')}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('withdrawal')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'withdrawal'
                  ? 'bg-[var(--yellow)] text-black shadow'
                  : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
              }`}
            >
              <Wallet size={16} className="shrink-0" />
              {renderBilingual('Withdrawal Ledger', 'نکاسی لیجر')}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('stock')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'stock'
                  ? 'bg-[var(--yellow)] text-black shadow'
                  : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
              }`}
            >
              <Boxes size={16} className="shrink-0" />
              {renderBilingual('Stock Inventory', 'تیار مال اسٹاک')}
            </button>

            <button
              type="button"
              id="sidebar-nav-inventory-forecast"
              onClick={() => handleNavClick('inventory_forecast')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'inventory_forecast' || currentView === 'forecast'
                  ? 'bg-[var(--yellow)] text-black shadow'
                  : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <TrendingUp size={16} className="shrink-0 text-amber-400" />
                {renderBilingual('Inventory Forecast', 'پیش گوئی اسٹاک')}
              </div>
              <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-amber-500/20 text-amber-300">
                ROP
              </span>
            </button>

            {onOpenGateReceipts && (
              <button
                type="button"
                id="sidebar-nav-gate-receipts"
                onClick={() => {
                  onOpenGateReceipts();
                  closeSidebar();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-amber-400 hover:bg-amber-500/15 hover:text-amber-300 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ShieldCheck size={16} className="text-amber-400 shrink-0" />
                  {renderBilingual('Gate Receipts Registry', 'گیٹ پاس رجسٹر')}
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono font-bold shrink-0 ml-1">
                  #SEQ
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Data & System */}
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)] px-3 mb-1.5 flex items-center justify-between">
            <span>System</span>
            <span className="font-serif normal-case text-[10px] opacity-75">سسٹم</span>
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => handleNavClick('backup')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'backup'
                  ? 'bg-[var(--yellow)] text-black shadow'
                  : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
              }`}
            >
              <Database size={16} className="shrink-0" />
              {renderBilingual('Backup & Cloud', 'بیک اپ اور کلاؤڈ')}
            </button>

            {/* Gmail Cloud Vault & Phone Switch */}
            {onOpenGmailVault && (
              <button
                type="button"
                onClick={() => {
                  onOpenGmailVault();
                  closeSidebar();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition text-sky-400 hover:bg-sky-500/10 border border-sky-500/20"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Cloud size={16} className="shrink-0 text-sky-400" />
                  {renderBilingual('Gmail Cloud Vault', 'جی میل کلاؤڈ والٹ')}
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold uppercase shrink-0 ml-1">
                  Sync
                </span>
              </button>
            )}

            {/* Recycle Bin & Accidental Delete Recovery */}
            {onOpenRecycleBin && (
              <button
                type="button"
                onClick={() => {
                  onOpenRecycleBin();
                  closeSidebar();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition ${
                  recycleBinCount > 0 
                    ? 'text-rose-400 hover:bg-rose-500/10 border border-rose-500/30' 
                    : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Trash2 size={16} className={`shrink-0 ${recycleBinCount > 0 ? 'text-rose-400' : ''}`} />
                  {renderBilingual('Recycle Bin', 'بحالی کوڑا دان')}
                </div>
                {recycleBinCount > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-bold shrink-0 ml-1 shadow-xs animate-pulse">
                    {recycleBinCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              id="sidebar-nav-printer"
              onClick={() => handleNavClick('printer')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'printer'
                  ? 'bg-[var(--yellow)] text-black shadow'
                  : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Printer size={16} className="shrink-0" />
                {renderBilingual('Hardware Printer', 'تھرمل پرنٹر')}
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold uppercase shrink-0 ml-1">
                ESC/POS
              </span>
            </button>

            <button
              type="button"
              id="sidebar-nav-settings"
              onClick={() => handleNavClick('settings')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'settings' || currentView === 'visual_studio' || currentView === 'visualstudio'
                  ? 'bg-[var(--yellow)] text-black shadow'
                  : 'text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]'
              }`}
            >
              <Settings size={16} className="shrink-0" />
              {renderBilingual('System Settings', 'سسٹم سیٹنگز')}
            </button>
          </div>
        </div>
      </div>

        {/* Sidebar Footer without Help or Lock */}
        {onOpenAbout && (
          <div className="p-3 border-t border-[var(--steel-line)]">
            <button
              type="button"
              onClick={() => {
                onOpenAbout();
                closeSidebar();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)] transition"
            >
              <Info size={14} />
              <span>About Falcon Rod Maker</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
