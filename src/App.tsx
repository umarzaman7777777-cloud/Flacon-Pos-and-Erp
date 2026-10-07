import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowDown,
  RefreshCw,
  Check,
  RotateCcw,
  Trash2,
  Cloud,
  ShoppingCart
} from 'lucide-react';
import {
  AppState,
  AppView,
  AppLanguage,
  Product,
  Transaction,
  Factory,
  Painter,
  RawSupplier,
  RawEntry,
  Worker,
  ScrapBuyer,
  WithdrawalEntry,
  ProductReturn,
  Expense,
  Inquiry,
  VisualSettings,
  CartLine,
  CustomLedger,
  GatePassData,
  RecycleBinItem
} from './types';
import { INITIAL_STATE, INITIAL_PRODUCTS } from './utils/initialData';
import { todayISO, generateId, fmt } from './utils/helpers';
import { generateBatchTrackingMetadata } from './utils/batchTrackingGenerator';
import {
  hapticAddToCart,
  hapticTransactionComplete,
  hapticPullThreshold,
  hapticPullComplete,
  hapticQuantityChange,
  hapticTap,
  hapticWarning,
  hapticError,
  configureHaptics
} from './utils/haptics';

import { ExportDownloadToast } from './components/ExportDownloadToast';
import { OfflineIndicator } from './components/OfflineIndicator';
import { LockScreen } from './components/LockScreen';
import { AppOpeningSplash } from './components/AppOpeningSplash';
import { TopBar } from './components/TopBar';
import { BlueprintRulerOverlay } from './components/BlueprintRulerOverlay';
import { Sidebar } from './components/Sidebar';
import { OverviewView } from './components/OverviewView';
import { ProductsView } from './components/ProductsView';
import { CartPanel } from './components/CartPanel';
import { TransactionsView } from './components/TransactionsView';
import { FactoriesView } from './components/FactoriesView';
import { PaintLedgerView } from './components/PaintLedgerView';
import { RawMaterialView } from './components/RawMaterialView';
import { LabourLedgerView } from './components/LabourLedgerView';
import { ScrapLedgerView } from './components/ScrapLedgerView';
import { WithdrawalView } from './components/WithdrawalView';
import { StockView } from './components/StockView';
import { ProductReturnsView } from './components/ProductReturnsView';
import { ExpensesView } from './components/ExpensesView';
import { SettingsView } from './components/SettingsView';
import { GalleryView } from './components/GalleryView';
import { BackupView } from './components/BackupView';
import { NotificationsView } from './components/NotificationsView';
import { VoiceModal } from './components/VoiceModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { CustomLedgerDetailModal } from './components/CustomLedgerDetailModal';
import { TerminalSyncModal } from './components/TerminalSyncModal';
import { WorkspaceSyncModal } from './components/WorkspaceSyncModal';
import { UnifiedGateReceiptsModal } from './components/UnifiedGateReceiptsModal';
import { ExportCustomizerModal } from './components/ExportCustomizerModal';
import { ExportTablePayload } from './types';
import { subscribeToExportModal } from './utils/exportSettingsHelper';
import { MobilePermissionsBanner } from './components/MobilePermissionsBanner';
import { getNextGateSequence, formatGateSequence } from './utils/gateSequenceManager';
import { useFirestoreSync } from './firebase/useFirestoreSync';
import { useWorkspaceSync } from './hooks/useWorkspaceSync';
import { checkRedirectAuthResult, initNativeOAuthDeepLinkListener } from './utils/googleAuthHelper';
import { initPersistentStorage } from './utils/persistentStorage';
import { testConnection } from './firebase/config';
import { buildRecycleBinItem, restoreItemFromBin, purgeItemFromBin, emptyRecycleBin } from './utils/recycleBin';
import { RecycleBinModal } from './components/RecycleBinModal';
import { GmailCloudVaultModal } from './components/GmailCloudVaultModal';
import {
  registerPosServiceWorker,
  requestStoragePersistence,
  sendNativeNotification
} from './utils/mobilePermissions';
import { initBackgroundSyncEngine } from './utils/backgroundSyncEngine';

const STORAGE_KEY = 'falcon_rod_erp_state_v1';

export const App: React.FC = () => {
  // Load initial state with local storage fallback
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          // Revert any incorrect/stale logo and branding settings across the app
          if (!parsed.companyName || parsed.companyName !== 'Falcon Rod Maker') {
            parsed.companyName = 'Falcon Rod Maker';
          }
          parsed.companyTagline = 'Precision Ceiling Fan Down Rod Specialist — Gujrat, Pakistan';

          // Migrate any legacy Fan Guard entries and datasets to Fan Rods
          const hasLegacyGuardData = 
            parsed.products?.some((p: any) => p.name?.includes('Tikka') || p.name?.includes('Guard') || p.name?.includes('Universal-Heavy')) ||
            parsed.guardSizes?.some((s: string) => s.startsWith('P/')) ||
            parsed.rawStock?.some((rs: any) => rs.name?.includes('Steel Taar') || rs.name?.includes('Chutki'));

          if (hasLegacyGuardData) {
            parsed.products = INITIAL_PRODUCTS;
            parsed.items = INITIAL_STATE.items;
            parsed.customerLedgers = INITIAL_STATE.customerLedgers;
            parsed.transactions = INITIAL_STATE.transactions;
            parsed.painters = INITIAL_STATE.painters;
            parsed.rawSuppliers = INITIAL_STATE.rawSuppliers;
            parsed.labourWorkers = INITIAL_STATE.labourWorkers;
            parsed.workers = INITIAL_STATE.workers;
            parsed.scrapBuyers = INITIAL_STATE.scrapBuyers;
            parsed.customLedgersList = INITIAL_STATE.customLedgersList;
            parsed.returns = INITIAL_STATE.returns;
            parsed.productReturns = INITIAL_STATE.productReturns;
            parsed.inquiries = INITIAL_STATE.inquiries;
            parsed.rawStock = INITIAL_STATE.rawStock;
            parsed.rodSizes = INITIAL_STATE.rodSizes;
            parsed.rodWeights = INITIAL_STATE.rodWeights;
            parsed.guardSizes = INITIAL_STATE.guardSizes;
            parsed.guardWeights = INITIAL_STATE.guardWeights;
            parsed.productNames = INITIAL_STATE.productNames;
            parsed.productSizes = INITIAL_STATE.productSizes;
            parsed.productWeights = INITIAL_STATE.productWeights;
            parsed.rawItemNames = INITIAL_STATE.rawItemNames;
            parsed.rawLedgerDescriptions = INITIAL_STATE.rawLedgerDescriptions;
            parsed.workTypes = INITIAL_STATE.workTypes;
            parsed.productColours = INITIAL_STATE.productColours;
          } else {
            // Ensure rodSizes and rodWeights are initialized and mapped
            if (!parsed.rodSizes || parsed.guardSizes?.some((s: string) => s.startsWith('P/'))) {
              parsed.rodSizes = INITIAL_STATE.rodSizes;
              parsed.guardSizes = INITIAL_STATE.guardSizes;
            }
            if (!parsed.rodWeights) {
              parsed.rodWeights = INITIAL_STATE.rodWeights;
              parsed.guardWeights = INITIAL_STATE.guardWeights;
            }

            // Deep sanitize any remaining text in existing objects
            const sanitizeText = (txt: string) => {
              if (!txt || typeof txt !== 'string') return txt;
              return txt
                .replace(/Exhaust Fan Guard/gi, 'Exhaust Fan Mounting Rod')
                .replace(/Universal Fan Guard/gi, 'Universal Fan Down Rod')
                .replace(/Painted Fan Guards/gi, 'Painted Fan Rods')
                .replace(/Fan Guards/gi, 'Fan Rods')
                .replace(/Fan Guard/gi, 'Fan Rod')
                .replace(/fan guards/gi, 'fan rods')
                .replace(/fan guard/gi, 'fan rod')
                .replace(/American-Kingri-Tikka-Tala/gi, 'Ceiling-Fan-Rod-24-Heavy')
                .replace(/American-Plain-Tikka-Tala/gi, 'Ceiling-Fan-Rod-18-Deluxe')
                .replace(/Tikka-Tala/gi, 'Tubular-Rod')
                .replace(/Tikka/gi, 'Rod')
                .replace(/Patri/gi, 'M.S. Pipe')
                .replace(/Steel Taar/gi, 'M.S. Steel Pipe');
            };

            if (parsed.transactions && Array.isArray(parsed.transactions)) {
              let repairedCount = 0;
              parsed.transactions = parsed.transactions.map((tx: any, idx: number) => {
                let modified = false;
                if (tx.itemsSummary) {
                  const sanitized = sanitizeText(tx.itemsSummary);
                  if (sanitized !== tx.itemsSummary) {
                    tx.itemsSummary = sanitized;
                    modified = true;
                  }
                }

                // Ensure valid string ID
                if (!tx.id || typeof tx.id !== 'string') {
                  tx.id = String(idx + 1).padStart(4, '0');
                  modified = true;
                }

                // Ensure total is numeric
                if (typeof tx.total !== 'number' || isNaN(tx.total)) {
                  tx.total = parseFloat(tx.total) || 0;
                  modified = true;
                }

                // Ensure itemCount is valid
                if (typeof tx.itemCount !== 'number' || isNaN(tx.itemCount) || tx.itemCount <= 0) {
                  const sumParts = tx.itemsSummary ? tx.itemsSummary.split(/\s*\+\s*|\n|;/) : [];
                  let count = 0;
                  sumParts.forEach((p: string) => {
                    const m = p.match(/^(\d+)\s*x/i);
                    count += m ? parseInt(m[1], 10) : 1;
                  });
                  tx.itemCount = count > 0 ? count : 1;
                  modified = true;
                }

                // Backfill itemCounts if missing
                if (!tx.itemCounts && tx.itemsSummary) {
                  const parts = tx.itemsSummary.split(/\s*\+\s*|\n|;/).filter(Boolean);
                  const counts: number[] = [];
                  parts.forEach((p: string) => {
                    const m = p.match(/^(\d+)\s*x/i);
                    counts.push(m ? parseInt(m[1], 10) : 1);
                  });
                  if (counts.length > 0) {
                    tx.itemCounts = counts.join(', ');
                    modified = true;
                  }
                }

                // Backfill itemRates if missing
                if (!tx.itemRates && tx.itemsSummary) {
                  const parts = tx.itemsSummary.split(/\s*\+\s*|\n|;/).filter(Boolean);
                  const total = tx.total || 0;
                  const totalQty = tx.itemCount || parts.length || 1;
                  const avgRate = Math.round(total / totalQty);
                  tx.itemRates = parts.map(() => avgRate).join(', ');
                  modified = true;
                }

                // Ensure customer/factory has a fallback
                if (!tx.factory || typeof tx.factory !== 'string' || !tx.factory.trim()) {
                  tx.factory = 'Walk-in Customer';
                  modified = true;
                }

                // Ensure date and time
                if (!tx.date) {
                  tx.date = todayISO();
                  modified = true;
                }
                if (!tx.time) {
                  tx.time = '12:00';
                  modified = true;
                }

                // Ensure boolean flags
                if (typeof tx.confirmed !== 'boolean') {
                  tx.confirmed = !!tx.receiptUrl;
                  modified = true;
                }
                if (typeof tx.paid !== 'boolean') {
                  tx.paid = false;
                  modified = true;
                }

                // Backfill batchId and itemBatches for consistent tracking segmentation
                if (!tx.batchId) {
                  const parts = tx.itemsSummary ? tx.itemsSummary.split(/\s*\+\s*|\n|;/).filter(Boolean) : [];
                  const meta = generateBatchTrackingMetadata(tx.id || '0001', parts.map(() => ({})), tx.date);
                  tx.batchId = meta.batchId;
                  tx.trackingNumber = meta.trackingNumber;
                  if (!tx.itemBatches) tx.itemBatches = meta.itemBatches;
                  if (!tx.itemTrackingNumbers) tx.itemTrackingNumbers = meta.itemTrackingNumbers;
                  modified = true;
                }

                if (modified) repairedCount++;
                return tx;
              });

              console.info(`[Falcon ERP] Storage state validated: ${parsed.transactions.length} transactions loaded (${repairedCount} normalized/repaired).`);
            }
            if (parsed.customerLedgers && Array.isArray(parsed.customerLedgers)) {
              parsed.customerLedgers.forEach((cl: any) => {
                if (cl.entries && Array.isArray(cl.entries)) {
                  cl.entries.forEach((e: any) => {
                    if (e.desc) e.desc = sanitizeText(e.desc);
                  });
                }
              });
            }
            if (parsed.painters && Array.isArray(parsed.painters)) {
              parsed.painters.forEach((p: any) => {
                if (p.entries && Array.isArray(p.entries)) {
                  p.entries.forEach((e: any) => {
                    if (e.desc) e.desc = sanitizeText(e.desc);
                    if (e.itemType) e.itemType = sanitizeText(e.itemType);
                  });
                }
              });
            }
          }

          if (parsed.products && Array.isArray(parsed.products)) {
            parsed.products = parsed.products.map((p: any) => {
              if (
                p.cat === 'Ceiling Fan Down Rod' ||
                p.cat === 'Industrial Down Rod' ||
                (p.cat && typeof p.cat === 'string' && (p.cat.toLowerCase().includes('ceiling') || p.cat.toLowerCase().includes('down rod')))
              ) {
                return { ...p, cat: 'Rod (Ceiling)' };
              }
              if (
                p.cat === 'Pedestal Extension Rod' ||
                p.cat === 'Bracket Fan Mounting Rod' ||
                (p.cat && typeof p.cat === 'string' && p.cat.toLowerCase().includes('pedestal'))
              ) {
                return { ...p, cat: 'Rod (Pedestal)' };
              }
              return p;
            });
          }
          if (parsed.visualSettings) {
            if (parsed.visualSettings.logoTheme === 'cyan') {
              parsed.visualSettings.logoTheme = 'amber';
            }
            if (parsed.visualSettings.theme === 'blue') {
              parsed.visualSettings.theme = 'dark';
            }
          } else {
            parsed.visualSettings = INITIAL_STATE.visualSettings;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading state from localStorage:', e);
    }
    return INITIAL_STATE;
  });

  // Active view and navigation
  const [activeView, setActiveView] = useState<AppView>('overview');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isLocked, setIsLocked] = useState(true);
  const [showOpeningSplash, setShowOpeningSplash] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Modals
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isUnifiedGateReceiptsOpen, setIsUnifiedGateReceiptsOpen] = useState(false);
  const [selectedCustomLedger, setSelectedCustomLedger] = useState<CustomLedger | null>(null);
  const [selectedLedgerFactory, setSelectedLedgerFactory] = useState<string | null>(null);
  const [printerTabTrigger, setPrinterTabTrigger] = useState(0);
  const [backupInitialTab, setBackupInitialTab] = useState<'cloud_status' | 'google_drive' | 'google_sheets' | 'sql_export' | 'json_backup' | 'signatures'>('cloud_status');
  const [settingsInitialTab, setSettingsInitialTab] = useState<'all' | 'logo' | 'visual_studio' | 'branding' | 'security' | 'printer' | 'sync' | 'debug_logs'>('all');

  // Document Export Studio Modal (PDF & JPG with Full Customization)
  const [globalExportPayload, setGlobalExportPayload] = useState<ExportTablePayload | null>(null);
  const [isGlobalExportOpen, setIsGlobalExportOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToExportModal(payload => {
      if (payload) {
        setGlobalExportPayload(payload);
        setIsGlobalExportOpen(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Direct Mobile and Native Google Auth initialization with Persistent Storage
  useEffect(() => {
    initPersistentStorage().catch(err => console.warn('Persistent storage init notice:', err));
    initNativeOAuthDeepLinkListener();
    checkRedirectAuthResult().catch(err => console.warn('Auth redirect check:', err));
  }, []);

  // Automatic Inactivity Screen Lock
  useEffect(() => {
    // If screen is already locked, no need to run timer
    if (isLocked) return;

    // Timeout in seconds: 30, 60, 300, or 0 (disabled)
    const timeoutSec = state.autolockSeconds !== undefined 
      ? state.autolockSeconds 
      : (state.autolockMinutes !== undefined ? state.autolockMinutes * 60 : 300);

    // If 0, auto-lock is disabled
    if (timeoutSec <= 0) return;

    let timeoutId: any = null;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsLocked(true);
      }, timeoutSec * 1000);
    };

    // User activity events that reset the lock countdown
    const activityEvents = [
      "mousedown",
      "mousemove",
      "touchstart",
      "keydown",
      "scroll",
      "click"
    ];

    activityEvents.forEach(evt => {
      window.addEventListener(evt, resetTimer, { passive: true });
    });

    // Start initial timer
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, resetTimer);
      });
    };
  }, [isLocked, state.autolockSeconds, state.autolockMinutes]);

  // Pull-to-Refresh Mechanism for Main App Viewport
  const mainScrollRef = useRef<HTMLElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [pullSuccess, setPullSuccess] = useState(false);
  const touchStartY = useRef(0);
  const isTouchPulling = useRef(false);
  const mouseStartY = useRef(0);
  const isMouseDownPulling = useRef(false);
  const hasTriggeredThresholdHaptic = useRef(false);

  const executePullRefresh = () => {
    setIsPullRefreshing(true);
    setPullDistance(52); // Keep indicator comfortably visible during refresh
    hapticPullThreshold();
    setActiveView('overview');
    setTimeout(() => {
      setPullSuccess(true);
      hapticPullComplete();
      setTimeout(() => {
        setIsPullRefreshing(false);
        setPullSuccess(false);
        setPullDistance(0);
        hasTriggeredThresholdHaptic.current = false;
      }, 650);
    }, 650);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (mainScrollRef.current && mainScrollRef.current.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isTouchPulling.current = true;
      hasTriggeredThresholdHaptic.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isTouchPulling.current || isPullRefreshing) return;
    if (mainScrollRef.current && mainScrollRef.current.scrollTop <= 0) {
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - touchStartY.current;
      if (deltaY > 0) {
        const distance = Math.min(80, Math.pow(deltaY, 0.82) * 1.5);
        setPullDistance(distance);
        if (distance >= 50 && !hasTriggeredThresholdHaptic.current) {
          hasTriggeredThresholdHaptic.current = true;
          hapticPullThreshold();
        } else if (distance < 50 && hasTriggeredThresholdHaptic.current) {
          hasTriggeredThresholdHaptic.current = false;
        }
      } else {
        setPullDistance(0);
        hasTriggeredThresholdHaptic.current = false;
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isTouchPulling.current) return;
    isTouchPulling.current = false;
    if (pullDistance >= 50 && !isPullRefreshing) {
      executePullRefresh();
    } else {
      setPullDistance(0);
      hasTriggeredThresholdHaptic.current = false;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mainScrollRef.current && mainScrollRef.current.scrollTop <= 0 && e.clientY < 260) {
      mouseStartY.current = e.clientY;
      isMouseDownPulling.current = true;
      hasTriggeredThresholdHaptic.current = false;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownPulling.current || isPullRefreshing) return;
    if (mainScrollRef.current && mainScrollRef.current.scrollTop <= 0) {
      const deltaY = e.clientY - mouseStartY.current;
      if (deltaY > 0) {
        const distance = Math.min(80, Math.pow(deltaY, 0.82) * 1.5);
        setPullDistance(distance);
        if (distance >= 50 && !hasTriggeredThresholdHaptic.current) {
          hasTriggeredThresholdHaptic.current = true;
          hapticPullThreshold();
        } else if (distance < 50 && hasTriggeredThresholdHaptic.current) {
          hasTriggeredThresholdHaptic.current = false;
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (!isMouseDownPulling.current) return;
    isMouseDownPulling.current = false;
    if (pullDistance >= 50 && !isPullRefreshing) {
      executePullRefresh();
    } else {
      setPullDistance(0);
      hasTriggeredThresholdHaptic.current = false;
    }
  };

  // Firestore Multi-Terminal Cloud Synchronization
  const {
    syncState,
    lastSyncTime,
    terminalId,
    terminalName,
    setTerminalName,
    syncErrorMsg,
    forceSyncNow,
    pushStateImmediately,
    restoreFromGmailVault,
    isOnline,
    pendingQueueCount
  } = useFirestoreSync(state, setState);

  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [isGmailVaultOpen, setIsGmailVaultOpen] = useState(false);
  const [undoToast, setUndoToast] = useState<{
    id: string;
    message: string;
    binItem: RecycleBinItem;
  } | null>(null);

  const triggerUndoToast = (binItem: RecycleBinItem, message?: string) => {
    setUndoToast({
      id: binItem.id,
      message: message || `${binItem.title} moved to Recycle Bin`,
      binItem
    });
  };

  useEffect(() => {
    if (!undoToast) return;
    const timer = setTimeout(() => setUndoToast(null), 7000);
    return () => clearTimeout(timer);
  }, [undoToast]);

  const handleRestoreBinItem = (item: RecycleBinItem) => {
    setState(prev => {
      const restored = restoreItemFromBin(item, prev);
      pushStateImmediately(restored);
      return restored;
    });
    setUndoToast(null);
  };

  const handleRestoreAllBinItems = () => {
    setState(prev => {
      let current = prev;
      for (const item of (prev.recycleBin || [])) {
        current = restoreItemFromBin(item, current);
      }
      current = { ...current, recycleBin: [] };
      pushStateImmediately(current);
      return current;
    });
    setUndoToast(null);
  };

  const handlePurgeBinItem = (itemId: string) => {
    setState(prev => {
      const purged = purgeItemFromBin(itemId, prev);
      pushStateImmediately(purged);
      return purged;
    });
  };

  const handleEmptyBin = () => {
    setState(prev => {
      const emptied = emptyRecycleBin(prev);
      pushStateImmediately(emptied);
      return emptied;
    });
  };

  // Central Google Workspace synchronization (Google Sheets live mirror & Google Drive auto-backups)
  const workspaceSync = useWorkspaceSync(state, terminalId);

  // Auto-sync after returning from mobile redirect authentication
  useEffect(() => {
    checkRedirectAuthResult().then(res => {
      if (res?.accessToken) {
        workspaceSync.autoSyncNow();
      }
    }).catch(() => {});
  }, [workspaceSync]);

  // Connection health verification and PWA background service worker on boot
  useEffect(() => {
    testConnection();
    // Initialize PWA Service Worker for mobile push & background notifications
    registerPosServiceWorker().catch(e => console.debug('SW init:', e));
    // Proactively request persistent storage to protect local database
    requestStoragePersistence().catch(e => console.debug('Storage persist init:', e));
    // Initialize Continuous Background Sync Engine (keeps syncing even when app is minimized or backgrounded)
    const cleanupSync = initBackgroundSyncEngine(() => state);
    return () => {
      cleanupSync();
    };
  }, [state]);

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Error saving state to localStorage:', e);
    }
  }, [state]);

  // Synchronize HTML Theme and Direction
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.visualSettings.theme);
    document.documentElement.setAttribute('data-logo-theme', state.visualSettings.logoTheme);
    document.documentElement.setAttribute('dir', state.language === 'ur' ? 'rtl' : 'ltr');
    document.documentElement.lang = state.language;
    if (state.companyName) {
      document.title = `${state.companyName} — POS & ERP`;
    }
  }, [state.visualSettings.theme, state.visualSettings.logoTheme, state.language, state.companyName]);

  // Keyboard shortcut: Cmd+K / Ctrl+K for Global Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Synchronize Haptic configuration with Visual Settings
  useEffect(() => {
    configureHaptics({
      enabled: state.visualSettings?.hapticFeedback !== false,
      audio: state.visualSettings?.hapticAudio !== false
    });
  }, [state.visualSettings?.hapticFeedback, state.visualSettings?.hapticAudio]);

  // ----------------------------------------------------
  // CART HANDLERS (POS & Invoicing)
  // ----------------------------------------------------
  const handleAddToCart = (product: Product, color?: string, size?: string) => {
    hapticAddToCart();
    setState(prev => {
      const existingIdx = prev.cart.findIndex(
        l => l.id === product.id && l.color === color && l.size === size
      );
      if (existingIdx >= 0) {
        const updated = [...prev.cart];
        updated[existingIdx].qty += 1;
        return { ...prev, cart: updated };
      } else {
        const newLine: CartLine = {
          id: product.id,
          name: product.name,
          price: product.price,
          qty: 1,
          color,
          size
        };
        return { ...prev, cart: [...prev.cart, newLine] };
      }
    });
  };

  const handleUpdateCartQty = (id: number, delta: number) => {
    hapticQuantityChange();
    setState(prev => {
      const updated = prev.cart
        .map(item => (item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item))
        .filter(item => item.qty > 0);
      return { ...prev, cart: updated };
    });
  };

  const handleRemoveCartLine = (id: number) => {
    hapticWarning();
    setState(prev => ({
      ...prev,
      cart: prev.cart.filter(item => item.id !== id)
    }));
  };

  const handleClearCart = () => {
    hapticError();
    setState(prev => ({ ...prev, cart: [] }));
  };

  const handleCheckoutUnpaid = (factoryName: string, orderDate: string) => {
    if (!state.cart || state.cart.length === 0) {
      console.warn('[Falcon ERP] handleCheckoutUnpaid aborted: Cart is empty.');
      return;
    }
    hapticTransactionComplete();

    // 1. Validate & sanitize parameters
    const safeCustomer = (factoryName && typeof factoryName === 'string' && factoryName.trim())
      ? factoryName.trim()
      : 'Walk-in Customer';
    const safeDate = (orderDate && typeof orderDate === 'string' && orderDate.trim())
      ? orderDate.trim()
      : todayISO();
    const safeTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    // 2. Validate Cart Lines & Compute Metrics
    const validLines = state.cart.map((line, idx) => {
      const qty = typeof line.qty === 'number' && !isNaN(line.qty) && line.qty > 0 ? line.qty : 1;
      const price = typeof line.price === 'number' && !isNaN(line.price) && line.price >= 0 ? line.price : 0;
      const name = line.name?.trim() || `Down Rod Item #${idx + 1}`;
      const size = line.size?.trim() ? line.size.trim() : '-';
      const color = line.color?.trim() ? line.color.trim() : '-';
      return {
        ...line,
        qty,
        price,
        name,
        size,
        color
      };
    });

    const totalAmount = validLines.reduce((sum, line) => sum + line.price * line.qty, 0);
    const totalItems = validLines.reduce((sum, line) => sum + line.qty, 0);

    // 3. Construct 1:1 positional metadata arrays to prevent misalignment in invoices and breakdowns
    const summaryStr = validLines.map(c => `${c.qty}x ${c.name}`).join(' + ');
    const countsStr = validLines.map(c => String(c.qty)).join(', ');
    const ratesStr = validLines.map(c => String(c.price)).join(', ');
    const productIdsStr = validLines.map(c => String(c.id)).join(', ');
    const sizesStr = validLines.map(c => c.size).join(', ');
    const colorsStr = validLines.map(c => c.color).join(', ');

    // 4. Ensure next order ID is valid and collision-free
    let assignedId = state.nextTxnId;
    if (!assignedId || isNaN(parseInt(assignedId, 10))) {
      assignedId = '0001';
    }
    const existingIds = new Set(state.transactions.map(t => t.id));
    if (existingIds.has(assignedId)) {
      const maxNum = state.transactions.reduce((max, t) => {
        const n = parseInt(t.id, 10);
        return !isNaN(n) && n > max ? n : max;
      }, 0);
      assignedId = String(maxNum + 1).padStart(4, '0');
      console.warn(`[Falcon ERP] ID collision detected. Auto-adjusted nextTxnId to #${assignedId}`);
    }

    // 5. Generate Batch ID and Tracking Number generator for every transaction items list
    // Ensures multi-item orders are clearly segmented by batch in transaction metadata
    const batchMeta = generateBatchTrackingMetadata(assignedId, validLines, safeDate);

    const newTxn: Transaction = {
      id: assignedId,
      date: safeDate,
      time: safeTime,
      total: totalAmount,
      itemCount: totalItems,
      itemCounts: countsStr,
      itemRates: ratesStr,
      itemProductIds: productIdsStr,
      paid: false,
      itemsSummary: summaryStr,
      factory: safeCustomer,
      colors: colorsStr,
      sizes: sizesStr,
      confirmed: false,
      device: 'POS-Terminal',
      batchId: batchMeta.batchId,
      trackingNumber: batchMeta.trackingNumber,
      itemBatches: batchMeta.itemBatches,
      itemTrackingNumbers: batchMeta.itemTrackingNumbers
    };

    console.info('[Falcon ERP] handleCheckoutUnpaid: New transaction created & validated:', {
      orderId: newTxn.id,
      customer: newTxn.factory,
      itemCount: newTxn.itemCount,
      total: newTxn.total,
      itemCounts: newTxn.itemCounts,
      itemRates: newTxn.itemRates,
      sizes: newTxn.sizes,
      colors: newTxn.colors,
      batchId: newTxn.batchId,
      trackingNumber: newTxn.trackingNumber,
      itemBatches: newTxn.itemBatches,
      itemTrackingNumbers: newTxn.itemTrackingNumbers,
      lineItemsCount: validLines.length
    });

    // 6. Calculate next order id, e.g. "0005" -> "0006"
    const nextNum = parseInt(assignedId, 10) + 1;
    const nextIdStr = String(nextNum).padStart(4, '0');

    // 7. Also append a Debit entry in this factory's customer ledger with batch reference
    const ledgerDesc = `Order #${assignedId} (${summaryStr})${newTxn.batchId ? ` · [${newTxn.batchId}]` : ''}`;
    const updatedCustomerLedgers = prevCustomerLedgersAddDebit(
      state.customerLedgers,
      safeCustomer,
      ledgerDesc,
      totalAmount,
      safeDate
    );

    // 7. Automatically decrement finished goods inventory stock
    const cartProductQty: Record<string, number> = {};
    validLines.forEach(c => {
      cartProductQty[c.name] = (cartProductQty[c.name] || 0) + c.qty;
    });
    const updatedProducts = state.products.map(p => {
      const soldQty = cartProductQty[p.name];
      if (soldQty && p.stock !== undefined) {
        return { ...p, stock: Math.max(0, p.stock - soldQty) };
      }
      return p;
    });

    // 8. Dispatch native push notification if enabled
    sendNativeNotification(`Order #${assignedId} Created`, {
      body: `${safeCustomer}: Rs. ${totalAmount.toLocaleString()} (${summaryStr})`,
      icon: '/falcon-theme-rod-logo.svg'
    });

    const updatedState: AppState = {
      ...state,
      cart: [],
      products: updatedProducts,
      transactions: [newTxn, ...state.transactions],
      customerLedgers: updatedCustomerLedgers,
      nextTxnId: nextIdStr
    };

    setState(updatedState);

    // 9. Sync newly created transaction to Google Sheets live mirror if connected
    workspaceSync.syncTransactionToSheets(newTxn, updatedState);

    console.info(`[Falcon ERP] State committed with Order #${assignedId}. Total transactions in state: ${updatedState.transactions.length}`);

    setActiveView('transactions');
  };

  const prevCustomerLedgersAddDebit = (
    ledgers: AppState['customerLedgers'],
    factoryName: string,
    desc: string,
    amount: number,
    date: string
  ) => {
    const existing = ledgers.find(l => l.name === factoryName);
    const newEntry = {
      id: generateId('cledger'),
      date,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      desc,
      debit: amount,
      credit: 0
    };

    if (existing) {
      return ledgers.map(l =>
        l.name === factoryName ? { ...l, entries: [...l.entries, newEntry] } : l
      );
    } else {
      return [...ledgers, { name: factoryName, entries: [newEntry] }];
    }
  };

  // ----------------------------------------------------
  // TRANSACTION ACTIONS
  // ----------------------------------------------------
  const handleConfirmOrder = (id: string) => {
    hapticTap();
    console.info(`[Falcon ERP] handleConfirmOrder called for Order #${id}`);
    setState(prev => {
      const target = prev.transactions.find(t => t.id === id);
      if (!target) {
        console.warn(`[Falcon ERP] handleConfirmOrder: Order #${id} not found in state transactions.`);
        return prev;
      }
      if (target.confirmed) {
        console.info(`[Falcon ERP] Order #${id} is already confirmed in sales.`);
        return prev;
      }

      const updatedTransactions = prev.transactions.map(t => {
        if (t.id === id) {
          const isDelivered = !!t.receiptUrl;
          return {
            ...t,
            confirmed: true,
            gatePassVerified: isDelivered ? true : (t.gatePassVerified ?? false)
          };
        }
        return t;
      });

      const confirmedTxn = updatedTransactions.find(t => t.id === id)!;
      console.info(`[Falcon ERP] Order #${id} successfully confirmed into sales.`, {
        orderId: id,
        customer: confirmedTxn.factory,
        total: confirmedTxn.total,
        receiptUrl: confirmedTxn.receiptUrl ? 'Present' : 'None',
        gatePassVerified: confirmedTxn.gatePassVerified
      });

      // Synchronize confirmed status with Google Sheets live mirror if connected
      workspaceSync.syncTransactionToSheets(confirmedTxn, { ...prev, transactions: updatedTransactions });

      return {
        ...prev,
        transactions: updatedTransactions
      };
    });
  };

  const handleRecordPayment = (txnId: string, amount: number, method: string, detail: string) => {
    hapticTransactionComplete();
    const payment = {
      id: generateId('pay'),
      txnId,
      amount,
      date: todayISO(),
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      method,
      detail
    };

    setState(prev => {
      const targetTxn = prev.transactions.find(t => t.id === txnId);
      const updatedPayments = [...prev.customerPayments, payment];

      // If fully paid, mark transaction paid
      const totalPaidForTxn = updatedPayments
        .filter(p => p.txnId === txnId)
        .reduce((sum, p) => sum + p.amount, 0);

      const isNowFullyPaid = targetTxn ? totalPaidForTxn >= targetTxn.total : false;

      // Also log credit in customer ledger if factory associated
      let updatedLedgers = prev.customerLedgers;
      if (targetTxn?.factory) {
        updatedLedgers = prev.customerLedgers.map(cl => {
          if (cl.name === targetTxn.factory) {
            return {
              ...cl,
              entries: [
                ...cl.entries,
                {
                  id: generateId('cledger'),
                  date: todayISO(),
                  time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                  desc: `Payment for Order #${txnId} (${detail || method})`,
                  debit: 0,
                  credit: amount,
                  method
                }
              ]
            };
          }
          return cl;
        });
      }

      return {
        ...prev,
        customerPayments: updatedPayments,
        transactions: prev.transactions.map(t =>
          t.id === txnId ? { ...t, paid: isNowFullyPaid } : t
        ),
        customerLedgers: updatedLedgers
      };
    });
  };

  const handleAttachGatePass = (id: string, gatePass?: GatePassData) => {
    setState(prev => {
      const seq = gatePass?.gateSequence || getNextGateSequence(prev.transactions, prev.rawSuppliers);
      const seqNo = gatePass?.gateSequenceNo || formatGateSequence(seq);
      const receiver = gatePass?.receivedBy || 'Gate Officer: M. Tariq';
      const post = gatePass?.gatePost || 'Main Dispatch Gate 1';
      const role = gatePass?.receiverRole || 'Gate Officer / Receiver';

      return {
        ...prev,
        transactions: prev.transactions.map(t =>
          t.id === id
            ? {
                ...t,
                confirmed: true,
                receiptUrl: gatePass?.fileData || t.receiptUrl || 'attached_gate_pass',
                gatePass: gatePass
                  ? {
                      ...gatePass,
                      gateSequence: gatePass.gateSequence || seq,
                      gateSequenceNo: gatePass.gateSequenceNo || seqNo,
                      receivedBy: gatePass.receivedBy || receiver,
                      gatePost: gatePass.gatePost || post,
                      receiverRole: gatePass.receiverRole || role
                    }
                  : t.gatePass || {
                      fileData: 'attached_gate_pass',
                      fileName: `GatePass_${id}`,
                      fileType: 'pdf',
                      uploadedAt: todayISO(),
                      verified: true,
                      gateSequence: seq,
                      gateSequenceNo: seqNo,
                      receivedBy: receiver,
                      gatePost: post,
                      receiverRole: role
                    },
                gatePassVerified: true,
                gateSequence: seq,
                gateSequenceNo: seqNo,
                gateReceivedBy: receiver,
                gateReceivedAt: gatePass?.uploadedAt || todayISO(),
                gatePost: post,
                receiverRole: role
              }
            : t
        )
      };
    });
  };

  const handleNilOrder = (id: string) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => (t.id === id ? { ...t, paid: true } : t))
    }));
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm(`Are you sure you want to delete Order #${id}? It will be kept in Recycle Bin.`)) {
      hapticWarning();
      const targetTxn = state.transactions.find(t => t.id === id);
      if (!targetTxn) return;

      const associatedPayment = (state.customerPayments || []).find(p => p.txnId === id);
      const associatedLedgerEntries = (state.customerLedgers || [])
        .find(cl => cl.name === targetTxn.factory)
        ?.entries.filter(e => e.desc.includes(`Order #${id}`) || e.desc.includes(`Order #${id} `)) || [];

      const binItem = buildRecycleBinItem({
        itemType: 'transaction',
        originalId: id,
        title: `Order #${id} - ${targetTxn.factory || 'Walk-in'}`,
        subtitle: `${targetTxn.itemCount || 0} items • PKR ${fmt(targetTxn.total)}`,
        amount: targetTxn.total,
        parentEntityName: targetTxn.factory || undefined,
        payload: {
          transaction: targetTxn,
          customerPayment: associatedPayment,
          customerLedgerEntries: associatedLedgerEntries
        }
      });

      setState(prev => {
        // Remove order debit & payment credit entries from the customer ledger
        const updatedCustomerLedgers = prev.customerLedgers.map(cl => {
          if (targetTxn?.factory && cl.name === targetTxn.factory) {
            return {
              ...cl,
              entries: cl.entries.filter(
                e => !e.desc.includes(`Order #${id}`) && !e.desc.includes(`Order #${id} `)
              )
            };
          }
          return cl;
        });

        const newState: AppState = {
          ...prev,
          transactions: prev.transactions.filter(t => t.id !== id),
          customerPayments: prev.customerPayments.filter(p => p.txnId !== id),
          customerLedgers: updatedCustomerLedgers,
          recycleBin: [binItem, ...(prev.recycleBin || [])]
        };

        pushStateImmediately(newState);
        return newState;
      });

      triggerUndoToast(binItem, `Order #${id} moved to Recycle Bin`);
    }
  };

  // ----------------------------------------------------
  // PRODUCT CATALOG ACTIONS
  // ----------------------------------------------------
  const handleSaveProduct = (productData: Omit<Product, 'id'>, id?: number) => {
    setState(prev => {
      let newState: AppState;
      if (id) {
        newState = {
          ...prev,
          products: prev.products.map(p => (p.id === id ? { ...productData, id } : p))
        };
      } else {
        const nextId = prev.products.reduce((max, p) => Math.max(max, p.id), 0) + 1;
        newState = {
          ...prev,
          products: [...prev.products, { ...productData, id: nextId }]
        };
      }
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleDeleteProduct = (id: number) => {
    const prod = state.products.find(p => p.id === id);
    if (!prod) return;

    const binItem = buildRecycleBinItem({
      itemType: 'product',
      originalId: String(id),
      title: prod.name,
      subtitle: `${prod.cat || ''} • ${prod.size || ''} • PKR ${prod.price}`,
      amount: prod.price,
      payload: prod
    });

    setState(prev => {
      const newState: AppState = {
        ...prev,
        products: prev.products.filter(p => p.id !== id),
        recycleBin: [binItem, ...(prev.recycleBin || [])]
      };
      pushStateImmediately(newState);
      return newState;
    });

    triggerUndoToast(binItem, `${prod.name} moved to Recycle Bin`);
  };

  const handleUpdateProductStock = (productId: number, newStock: number) => {
    setState(prev => ({
      ...prev,
      products: prev.products.map(p => (p.id === productId ? { ...p, stock: Math.max(0, newStock) } : p))
    }));
  };

  // ----------------------------------------------------
  // FACTORY & CUSTOMER LEDGER ACTIONS
  // ----------------------------------------------------
  const handleSaveFactory = (factory: Factory, oldName?: string) => {
    setState(prev => {
      let newState: AppState;
      if (oldName) {
        newState = {
          ...prev,
          factories: prev.factories.map(f => (f.name === oldName ? factory : f)),
          customerLedgers: prev.customerLedgers.map(cl =>
            cl.name === oldName ? { ...cl, name: factory.name } : cl
          )
        };
      } else {
        newState = {
          ...prev,
          factories: [...prev.factories, factory],
          customerLedgers: [...prev.customerLedgers, { name: factory.name, entries: [] }]
        };
      }
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleDeleteFactory = (name: string) => {
    const factory = state.factories.find(f => f.name === name);
    const ledger = state.customerLedgers.find(cl => cl.name === name);
    if (!factory && !ledger) return;

    const binItem = buildRecycleBinItem({
      itemType: 'factory',
      originalId: name,
      title: `Customer / Factory: ${name}`,
      subtitle: `${ledger?.entries?.length || 0} ledger entries`,
      payload: { factory, customerLedger: ledger }
    });

    setState(prev => {
      const newState: AppState = {
        ...prev,
        factories: prev.factories.filter(f => f.name !== name),
        customerLedgers: prev.customerLedgers.filter(cl => cl.name !== name),
        recycleBin: [binItem, ...(prev.recycleBin || [])]
      };
      pushStateImmediately(newState);
      return newState;
    });

    triggerUndoToast(binItem, `${name} moved to Recycle Bin`);
  };

  const handleAddLedgerEntry = (factoryName: string, entryData: any) => {
    hapticTransactionComplete();
    setState(prev => {
      const newState: AppState = {
        ...prev,
        customerLedgers: prev.customerLedgers.map(cl => {
          if (cl.name === factoryName) {
            return {
              ...cl,
              entries: [...cl.entries, { ...entryData, id: generateId('cledger') }]
            };
          }
          return cl;
        })
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleUpdateLedgerEntry = (factoryName: string, entryId: string, updatedData: any) => {
    hapticTransactionComplete();
    setState(prev => {
      const newState: AppState = {
        ...prev,
        customerLedgers: prev.customerLedgers.map(cl => {
          if (cl.name === factoryName) {
            return {
              ...cl,
              entries: cl.entries.map(e => (e.id === entryId ? { ...e, ...updatedData } : e))
            };
          }
          return cl;
        })
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleDeleteLedgerEntry = (factoryName: string, entryId: string) => {
    const targetEntry = state.customerLedgers
      .find(cl => cl.name === factoryName)
      ?.entries.find(e => e.id === entryId);

    if (targetEntry) {
      const binItem = buildRecycleBinItem({
        itemType: 'factory_ledger_entry',
        originalId: entryId,
        title: targetEntry.desc || 'Ledger Entry',
        subtitle: `${factoryName} • Debit: ${targetEntry.debit || 0} | Credit: ${targetEntry.credit || 0}`,
        amount: targetEntry.debit || targetEntry.credit || 0,
        parentEntityName: factoryName,
        payload: targetEntry
      });

      setState(prev => {
        const newState: AppState = {
          ...prev,
          customerLedgers: prev.customerLedgers.map(cl => {
            if (cl.name === factoryName) {
              return {
                ...cl,
                entries: cl.entries.filter(e => e.id !== entryId)
              };
            }
            return cl;
          }),
          recycleBin: [binItem, ...(prev.recycleBin || [])]
        };
        pushStateImmediately(newState);
        return newState;
      });

      triggerUndoToast(binItem, `Ledger entry moved to Recycle Bin`);
    }
  };

  // Custom Job-Work Ledgers
  const handleAddCustomLedger = (name: string) => {
    const newCl: CustomLedger = {
      id: generateId('custom_ledger'),
      name,
      entries: [],
      selfWeightStock: 0
    };
    setState(prev => {
      const newState: AppState = {
        ...prev,
        customLedgersList: [...(prev.customLedgersList || []), newCl]
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleAddCustomLedgerEntry = (ledgerId: string, entryData: any) => {
    hapticTransactionComplete();
    const newEntry = { ...entryData, id: generateId('c_entry') };
    setState(prev => {
      const newState: AppState = {
        ...prev,
        customLedgersList: (prev.customLedgersList || []).map(cl =>
          cl.id === ledgerId
            ? { ...cl, entries: [...cl.entries, newEntry] }
            : cl
        )
      };
      pushStateImmediately(newState);
      return newState;
    });
    if (selectedCustomLedger?.id === ledgerId) {
      setSelectedCustomLedger(prev =>
        prev
          ? {
              ...prev,
              entries: [...prev.entries, newEntry]
            }
          : null
      );
    }
  };

  const handleUpdateCustomLedgerEntry = (ledgerId: string, entryId: string, updatedData: any) => {
    hapticTransactionComplete();
    setState(prev => {
      const newState: AppState = {
        ...prev,
        customLedgersList: (prev.customLedgersList || []).map(cl =>
          cl.id === ledgerId
            ? {
                ...cl,
                entries: cl.entries.map(e => (e.id === entryId ? { ...e, ...updatedData } : e))
              }
            : cl
        )
      };
      pushStateImmediately(newState);
      return newState;
    });
    if (selectedCustomLedger?.id === ledgerId) {
      setSelectedCustomLedger(prev =>
        prev
          ? {
              ...prev,
              entries: prev.entries.map(e => (e.id === entryId ? { ...e, ...updatedData } : e))
            }
          : null
      );
    }
  };

  const handleDeleteCustomLedgerEntry = (ledgerId: string, entryId: string) => {
    const targetLedger = (state.customLedgersList || []).find(cl => cl.id === ledgerId);
    const targetEntry = targetLedger?.entries.find(e => e.id === entryId);

    if (targetEntry) {
      const binItem = buildRecycleBinItem({
        itemType: 'custom_ledger_entry',
        originalId: entryId,
        title: targetEntry.desc || 'Custom Entry',
        subtitle: `${targetLedger?.name || 'Custom'} • Debit: ${targetEntry.debit || 0} | Credit: ${targetEntry.credit || 0}`,
        amount: targetEntry.debit || targetEntry.credit || 0,
        parentEntityName: ledgerId,
        payload: targetEntry
      });

      setState(prev => {
        const newState: AppState = {
          ...prev,
          customLedgersList: (prev.customLedgersList || []).map(cl =>
            cl.id === ledgerId ? { ...cl, entries: cl.entries.filter(e => e.id !== entryId) } : cl
          ),
          recycleBin: [binItem, ...(prev.recycleBin || [])]
        };
        pushStateImmediately(newState);
        return newState;
      });

      if (selectedCustomLedger?.id === ledgerId) {
        setSelectedCustomLedger(prev =>
          prev ? { ...prev, entries: prev.entries.filter(e => e.id !== entryId) } : null
        );
      }

      triggerUndoToast(binItem, `Custom entry moved to Recycle Bin`);
    }
  };

  const handleDeleteCustomLedger = (ledgerId: string) => {
    const targetLedger = (state.customLedgersList || []).find(cl => cl.id === ledgerId);
    if (!targetLedger) return;

    const binItem = buildRecycleBinItem({
      itemType: 'custom_ledger',
      originalId: ledgerId,
      title: `Custom Ledger: ${targetLedger.name}`,
      subtitle: `${targetLedger.entries?.length || 0} entries`,
      payload: targetLedger
    });

    setState(prev => {
      const newState: AppState = {
        ...prev,
        customLedgersList: (prev.customLedgersList || []).filter(cl => cl.id !== ledgerId),
        recycleBin: [binItem, ...(prev.recycleBin || [])]
      };
      pushStateImmediately(newState);
      return newState;
    });

    if (selectedCustomLedger?.id === ledgerId) {
      setSelectedCustomLedger(null);
    }

    triggerUndoToast(binItem, `${targetLedger.name} moved to Recycle Bin`);
  };

  const handleUpdateSelfWeightStock = (ledgerId: string, deltaKg: number) => {
    setState(prev => ({
      ...prev,
      customLedgersList: (prev.customLedgersList || []).map(cl =>
        cl.id === ledgerId
          ? { ...cl, selfWeightStock: Math.max(0, (cl.selfWeightStock || 0) + deltaKg) }
          : cl
      )
    }));
    if (selectedCustomLedger?.id === ledgerId) {
      setSelectedCustomLedger(prev =>
        prev
          ? { ...prev, selfWeightStock: Math.max(0, (prev.selfWeightStock || 0) + deltaKg) }
          : null
      );
    }
  };

  // ----------------------------------------------------
  // PAINTER LEDGER ACTIONS
  // ----------------------------------------------------
  const handleSavePainter = (painter: Painter, oldName?: string) => {
    setState(prev => {
      let newState: AppState;
      if (oldName) {
        newState = {
          ...prev,
          painters: prev.painters.map(p => (p.name === oldName ? painter : p))
        };
      } else {
        newState = {
          ...prev,
          painters: [...prev.painters, painter]
        };
      }
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleDeletePainter = (name: string) => {
    const painter = (state.painters || []).find(p => p.name === name);
    if (!painter) return;

    const binItem = buildRecycleBinItem({
      itemType: 'painter',
      originalId: name,
      title: `Painter: ${name}`,
      subtitle: `${painter.entries?.length || 0} entries`,
      payload: painter
    });

    setState(prev => {
      const newState: AppState = {
        ...prev,
        painters: prev.painters.filter(p => p.name !== name),
        recycleBin: [binItem, ...(prev.recycleBin || [])]
      };
      pushStateImmediately(newState);
      return newState;
    });

    triggerUndoToast(binItem, `${name} moved to Recycle Bin`);
  };

  const handleAddPaintEntry = (painterName: string, entryData: any) => {
    setState(prev => {
      const newState: AppState = {
        ...prev,
        painters: prev.painters.map(p =>
          p.name === painterName
            ? { ...p, entries: [...p.entries, { ...entryData, id: generateId('paint') }] }
            : p
        )
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleUpdatePaintEntry = (painterName: string, entryId: string, updatedData: any) => {
    hapticTransactionComplete();
    setState(prev => {
      const newState: AppState = {
        ...prev,
        painters: prev.painters.map(p =>
          p.name === painterName
            ? {
                ...p,
                entries: p.entries.map(e => (e.id === entryId ? { ...e, ...updatedData } : e))
              }
            : p
        )
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleDeletePaintEntry = (painterName: string, entryId: string) => {
    const painter = (state.painters || []).find(p => p.name === painterName);
    const targetEntry = painter?.entries.find(e => e.id === entryId);
    if (targetEntry) {
      const binItem = buildRecycleBinItem({
        itemType: 'paint_entry',
        originalId: entryId,
        title: `Paint Entry: ${targetEntry.color || targetEntry.desc || 'Batch'}`,
        subtitle: `${painterName} • Count: ${targetEntry.itemCount || 0}`,
        parentEntityName: painterName,
        payload: targetEntry
      });

      setState(prev => {
        const newState: AppState = {
          ...prev,
          painters: prev.painters.map(p =>
            p.name === painterName ? { ...p, entries: p.entries.filter(e => e.id !== entryId) } : p
          ),
          recycleBin: [binItem, ...(prev.recycleBin || [])]
        };
        pushStateImmediately(newState);
        return newState;
      });

      triggerUndoToast(binItem, `Paint entry moved to Recycle Bin`);
    }
  };

  const handleToggleChequeStatus = (
    painterName: string,
    entryId: string,
    status: 'cleared' | 'bounced'
  ) => {
    setState(prev => ({
      ...prev,
      painters: prev.painters.map(p =>
        p.name === painterName
          ? {
              ...p,
              entries: p.entries.map(e => (e.id === entryId ? { ...e, chequeStatus: status } : e))
            }
          : p
      )
    }));
  };

  // ----------------------------------------------------
  // RAW MATERIAL SUPPLIER ACTIONS
  // ----------------------------------------------------
  const handleSaveSupplier = (supplier: RawSupplier, oldName?: string) => {
    setState(prev => {
      let newState: AppState;
      if (oldName) {
        newState = {
          ...prev,
          rawSuppliers: prev.rawSuppliers.map(s => (s.name === oldName ? supplier : s))
        };
      } else {
        newState = {
          ...prev,
          rawSuppliers: [...prev.rawSuppliers, supplier]
        };
      }
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleDeleteSupplier = (name: string) => {
    const supplier = (state.rawSuppliers || []).find(s => s.name === name);
    if (!supplier) return;

    const binItem = buildRecycleBinItem({
      itemType: 'supplier',
      originalId: name,
      title: `Supplier: ${name}`,
      subtitle: `${supplier.entries?.length || 0} entries`,
      payload: supplier
    });

    setState(prev => {
      const newState: AppState = {
        ...prev,
        rawSuppliers: prev.rawSuppliers.filter(s => s.name !== name),
        recycleBin: [binItem, ...(prev.recycleBin || [])]
      };
      pushStateImmediately(newState);
      return newState;
    });

    triggerUndoToast(binItem, `${name} moved to Recycle Bin`);
  };

  const handleAddRawEntry = (supplierName: string, entryData: any) => {
    setState(prev => {
      // Also update inventory raw stock if weightIn/itemsIn logged
      let updatedStock = prev.rawStock;
      if (entryData.stockName && (entryData.weightIn || entryData.itemsIn)) {
        updatedStock = prev.rawStock.map(rs => {
          if (rs.name === entryData.stockName) {
            return {
              ...rs,
              weight: (rs.weight || 0) + (entryData.weightIn || 0),
              items: (rs.items || 0) + (entryData.itemsIn || 0)
            };
          }
          return rs;
        });
      }

      // Compute sequential gate order tracking for incoming material/deliveries
      let finalEntry: RawEntry = { ...entryData, id: generateId('raw') };
      if (finalEntry.gatePass || finalEntry.receivedBy || finalEntry.weightIn || finalEntry.itemsIn) {
        const seq = finalEntry.gateSequence || finalEntry.gatePass?.gateSequence || getNextGateSequence(prev.transactions, prev.rawSuppliers);
        const seqNo = finalEntry.gateSequenceNo || finalEntry.gatePass?.gateSequenceNo || formatGateSequence(seq);
        const receiver = finalEntry.receivedBy || finalEntry.gatePass?.receivedBy || 'Gate Inward Officer: M. Tariq';
        const post = finalEntry.gatePost || finalEntry.gatePass?.gatePost || 'Raw Material Inward Gate';

        finalEntry = {
          ...finalEntry,
          gateSequence: seq,
          gateSequenceNo: seqNo,
          receivedBy: receiver,
          gatePost: post,
          gatePass: finalEntry.gatePass
            ? {
                ...finalEntry.gatePass,
                gateSequence: seq,
                gateSequenceNo: seqNo,
                receivedBy: receiver,
                gatePost: post
              }
            : finalEntry.gatePass
        };
      }

      return {
        ...prev,
        rawStock: updatedStock,
        rawSuppliers: prev.rawSuppliers.map(s =>
          s.name === supplierName
            ? { ...s, entries: [...s.entries, finalEntry] }
            : s
        )
      };
    });
  };

  const handleAttachRawGatePass = (supplierName: string, entryId: string, gatePass: GatePassData) => {
    setState(prev => {
      const seq = gatePass.gateSequence || getNextGateSequence(prev.transactions, prev.rawSuppliers);
      const seqNo = gatePass.gateSequenceNo || formatGateSequence(seq);
      const receiver = gatePass.receivedBy || 'Gate Inward Officer: M. Tariq';
      const post = gatePass.gatePost || 'Raw Material Inward Gate';

      return {
        ...prev,
        rawSuppliers: prev.rawSuppliers.map(s =>
          s.name === supplierName
            ? {
                ...s,
                entries: s.entries.map(e =>
                  e.id === entryId
                    ? {
                        ...e,
                        gatePass: {
                          ...gatePass,
                          gateSequence: seq,
                          gateSequenceNo: seqNo,
                          receivedBy: receiver,
                          gatePost: post
                        },
                        receiptUrl: gatePass.fileData,
                        gateSequence: seq,
                        gateSequenceNo: seqNo,
                        receivedBy: receiver,
                        gatePost: post
                      }
                    : e
                )
              }
            : s
        )
      };
    });
  };

  const handleUpdateRawEntry = (supplierName: string, entryId: string, updatedData: any) => {
    hapticTransactionComplete();
    setState(prev => {
      const newState: AppState = {
        ...prev,
        rawSuppliers: prev.rawSuppliers.map(s =>
          s.name === supplierName
            ? {
                ...s,
                entries: s.entries.map(e => (e.id === entryId ? { ...e, ...updatedData } : e))
              }
            : s
        )
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleDeleteRawEntry = (supplierName: string, entryId: string) => {
    const supplier = (state.rawSuppliers || []).find(s => s.name === supplierName);
    const targetEntry = supplier?.entries.find(e => e.id === entryId);
    if (targetEntry) {
      const binItem = buildRecycleBinItem({
        itemType: 'raw_entry',
        originalId: entryId,
        title: `Raw Entry: ${targetEntry.desc || 'Material Delivery'}`,
        subtitle: `${supplierName} • Weight: ${targetEntry.weightIn || 0} kg`,
        parentEntityName: supplierName,
        payload: targetEntry
      });

      setState(prev => {
        const newState: AppState = {
          ...prev,
          rawSuppliers: prev.rawSuppliers.map(s =>
            s.name === supplierName ? { ...s, entries: s.entries.filter(e => e.id !== entryId) } : s
          ),
          recycleBin: [binItem, ...(prev.recycleBin || [])]
        };
        pushStateImmediately(newState);
        return newState;
      });

      triggerUndoToast(binItem, `Raw entry moved to Recycle Bin`);
    }
  };

  // ----------------------------------------------------
  // LABOUR LEDGER ACTIONS
  // ----------------------------------------------------
  const handleSaveWorker = (worker: Worker) => {
    setState(prev => {
      let newState: AppState;
      const idx = prev.workers.findIndex(w => w.name === worker.name);
      if (idx >= 0) {
        const updated = [...prev.workers];
        updated[idx] = worker;
        newState = { ...prev, workers: updated };
      } else {
        newState = { ...prev, workers: [...prev.workers, worker] };
      }
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleDeleteWorker = (name: string) => {
    const worker = (state.workers || []).find(w => w.name === name);
    if (!worker) return;

    const binItem = buildRecycleBinItem({
      itemType: 'worker',
      originalId: name,
      title: `Worker: ${name}`,
      subtitle: `${worker.workType || 'Labour'} • ${worker.entries?.length || 0} entries`,
      payload: worker
    });

    setState(prev => {
      const newState: AppState = {
        ...prev,
        workers: prev.workers.filter(w => w.name !== name),
        recycleBin: [binItem, ...(prev.recycleBin || [])]
      };
      pushStateImmediately(newState);
      return newState;
    });

    triggerUndoToast(binItem, `${name} moved to Recycle Bin`);
  };

  const handleAddLabourEntry = (workerName: string, entryData: any) => {
    setState(prev => {
      const newState: AppState = {
        ...prev,
        workers: prev.workers.map(w =>
          w.name === workerName
            ? { ...w, entries: [...w.entries, { ...entryData, id: generateId('labour') }] }
            : w
        )
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleUpdateLabourEntry = (workerName: string, entryId: string, updatedData: any) => {
    hapticTransactionComplete();
    setState(prev => {
      const newState: AppState = {
        ...prev,
        workers: prev.workers.map(w =>
          w.name === workerName
            ? {
                ...w,
                entries: w.entries.map(e => (e.id === entryId ? { ...e, ...updatedData } : e))
              }
            : w
        )
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleDeleteLabourEntry = (workerName: string, entryId: string) => {
    const worker = (state.workers || []).find(w => w.name === workerName);
    const targetEntry = worker?.entries.find(e => e.id === entryId);
    if (targetEntry) {
      const binItem = buildRecycleBinItem({
        itemType: 'labour_entry',
        originalId: entryId,
        title: `Labour: ${targetEntry.note || targetEntry.kind}`,
        subtitle: `${workerName} • Debit: ${targetEntry.debit || 0} | Credit: ${targetEntry.credit || 0}`,
        amount: targetEntry.debit || targetEntry.credit || 0,
        parentEntityName: workerName,
        payload: targetEntry
      });

      setState(prev => {
        const newState: AppState = {
          ...prev,
          workers: prev.workers.map(w =>
            w.name === workerName ? { ...w, entries: w.entries.filter(e => e.id !== entryId) } : w
          ),
          recycleBin: [binItem, ...(prev.recycleBin || [])]
        };
        pushStateImmediately(newState);
        return newState;
      });

      triggerUndoToast(binItem, `Labour entry moved to Recycle Bin`);
    }
  };

  const handleBulkAttendance = (
    attendanceMap: Record<string, 'present' | 'half' | 'absent' | 'leave'>,
    date: string
  ) => {
    setState(prev => {
      const updatedWorkers = prev.workers.map(w => {
        const status = attendanceMap[w.name];
        if (!status || w.rateType !== 'daily') return w;

        const credit = status === 'present' ? w.rate : status === 'half' ? w.rate / 2 : 0;
        const newEntry = {
          id: generateId('labour'),
          date,
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          kind: 'attendance' as const,
          status,
          debit: 0,
          credit,
          workType: w.workType,
          note: `Daily Attendance (${status})`
        };

        return {
          ...w,
          entries: [...w.entries, newEntry]
        };
      });

      const newState: AppState = { ...prev, workers: updatedWorkers };
      pushStateImmediately(newState);
      return newState;
    });
  };

  // ----------------------------------------------------
  // SCRAP LEDGER ACTIONS
  // ----------------------------------------------------
  const handleSaveScrapBuyer = (buyer: ScrapBuyer, oldName?: string) => {
    setState(prev => {
      let newState: AppState;
      if (oldName) {
        newState = {
          ...prev,
          scrapBuyers: prev.scrapBuyers.map(b => (b.name === oldName ? buyer : b))
        };
      } else {
        newState = { ...prev, scrapBuyers: [...prev.scrapBuyers, buyer] };
      }
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleDeleteScrapBuyer = (name: string) => {
    const buyer = (state.scrapBuyers || []).find(b => b.name === name);
    if (!buyer) return;

    const binItem = buildRecycleBinItem({
      itemType: 'scrap_buyer',
      originalId: name,
      title: `Scrap Buyer: ${name}`,
      subtitle: `${buyer.entries?.length || 0} entries`,
      payload: buyer
    });

    setState(prev => {
      const newState: AppState = {
        ...prev,
        scrapBuyers: prev.scrapBuyers.filter(b => b.name !== name),
        recycleBin: [binItem, ...(prev.recycleBin || [])]
      };
      pushStateImmediately(newState);
      return newState;
    });

    triggerUndoToast(binItem, `${name} moved to Recycle Bin`);
  };

  const handleAddScrapEntry = (buyerName: string, entryData: any) => {
    setState(prev => {
      const newState: AppState = {
        ...prev,
        scrapBuyers: prev.scrapBuyers.map(b =>
          b.name === buyerName
            ? { ...b, entries: [...b.entries, { ...entryData, id: generateId('scrap') }] }
            : b
        )
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleUpdateScrapEntry = (buyerName: string, entryId: string, updatedData: any) => {
    hapticTransactionComplete();
    setState(prev => {
      const newState: AppState = {
        ...prev,
        scrapBuyers: prev.scrapBuyers.map(b =>
          b.name === buyerName
            ? {
                ...b,
                entries: b.entries.map(e => (e.id === entryId ? { ...e, ...updatedData } : e))
              }
            : b
        )
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleDeleteScrapEntry = (buyerName: string, entryId: string) => {
    const buyer = (state.scrapBuyers || []).find(b => b.name === buyerName);
    const targetEntry = buyer?.entries.find(e => e.id === entryId);
    if (targetEntry) {
      const binItem = buildRecycleBinItem({
        itemType: 'scrap_entry',
        originalId: entryId,
        title: `Scrap: ${targetEntry.desc || targetEntry.itemName || 'Scrap Sale'}`,
        subtitle: `${buyerName} • Weight: ${targetEntry.weight || 0} kg`,
        parentEntityName: buyerName,
        payload: targetEntry
      });

      setState(prev => {
        const newState: AppState = {
          ...prev,
          scrapBuyers: prev.scrapBuyers.map(b =>
            b.name === buyerName ? { ...b, entries: b.entries.filter(e => e.id !== entryId) } : b
          ),
          recycleBin: [binItem, ...(prev.recycleBin || [])]
        };
        pushStateImmediately(newState);
        return newState;
      });

      triggerUndoToast(binItem, `Scrap entry moved to Recycle Bin`);
    }
  };

  // ----------------------------------------------------
  // WITHDRAWALS ACTIONS
  // ----------------------------------------------------
  const handleAddWithdrawal = (entryData: any) => {
    hapticTransactionComplete();
    setState(prev => {
      const newState: AppState = {
        ...prev,
        withdrawals: [{ ...entryData, id: generateId('wdraw') }, ...prev.withdrawals]
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleUpdateWithdrawal = (withdrawalId: string, updatedData: any) => {
    hapticTransactionComplete();
    setState(prev => {
      const newState: AppState = {
        ...prev,
        withdrawals: prev.withdrawals.map(w =>
          w.id === withdrawalId
            ? {
                ...w,
                ...updatedData,
                amount: typeof updatedData.amount === 'number' && updatedData.amount > 0
                  ? updatedData.amount
                  : updatedData.debit || updatedData.credit || w.amount
              }
            : w
        )
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleReverseWithdrawal = (id: string) => {
    setState(prev => {
      const newState: AppState = {
        ...prev,
        withdrawals: prev.withdrawals.map(w => (w.id === id ? { ...w, isReversed: true } : w))
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  // ----------------------------------------------------
  // STOCK MANAGEMENT ACTIONS
  // ----------------------------------------------------
  const handleUpdateRawStock = (name: string, deltaWeight: number, deltaItems: number) => {
    setState(prev => {
      const newState: AppState = {
        ...prev,
        rawStock: prev.rawStock.map(rs =>
          rs.name === name
            ? {
                ...rs,
                weight: (rs.weight || 0) + deltaWeight,
                items: (rs.items || 0) + deltaItems
              }
            : rs
        )
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleResetRawStock = (name: string) => {
    setState(prev => {
      const newState: AppState = {
        ...prev,
        rawStock: prev.rawStock.map(rs =>
          rs.name === name ? { ...rs, weight: 0, items: 0, initialWeight: 0, initialItems: 0 } : rs
        )
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  // ----------------------------------------------------
  // PRODUCT RETURNS ACTIONS
  // ----------------------------------------------------
  const handleLogReturn = (entryData: any) => {
    const newReturn: ProductReturn = {
      ...entryData,
      id: generateId('ret'),
      status: 'pending'
    };
    setState(prev => {
      const newState: AppState = {
        ...prev,
        productReturns: [newReturn, ...prev.productReturns]
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleResolveReturn = (
    id: string,
    resolution: 'reworked' | 'scrapped',
    notes?: string
  ) => {
    setState(prev => {
      const target = prev.productReturns.find(r => r.id === id);
      if (!target) return prev;

      let updatedProducts = prev.products;
      if (resolution === 'reworked') {
        // Restore finished goods product stock
        const returnQty = target.qty || target.quantity || 0;
        updatedProducts = prev.products.map(p =>
          p.name === (target.productName || target.product) ? { ...p, stock: (p.stock || 0) + returnQty } : p
        );
      }

      const newState: AppState = {
        ...prev,
        products: updatedProducts,
        productReturns: prev.productReturns.map(r =>
          r.id === id ? { ...r, status: 'resolved', resolution, resolutionNotes: notes } : r
        )
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  // ----------------------------------------------------
  // OVERHEAD EXPENSES ACTIONS
  // ----------------------------------------------------
  const handleAddExpense = (expenseData: any) => {
    hapticTransactionComplete();
    setState(prev => {
      const newState: AppState = {
        ...prev,
        expenses: [{ ...expenseData, id: generateId('exp') }, ...prev.expenses]
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleUpdateExpense = (expenseId: string, updatedData: any) => {
    hapticTransactionComplete();
    setState(prev => {
      const newState: AppState = {
        ...prev,
        expenses: prev.expenses.map(e =>
          e.id === expenseId
            ? {
                ...e,
                ...updatedData,
                amount: typeof updatedData.amount === 'number' && updatedData.amount > 0
                  ? updatedData.amount
                  : updatedData.debit || updatedData.credit || e.amount
              }
            : e
        )
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleDeleteExpense = (id: string) => {
    const exp = (state.expenses || []).find(e => e.id === id);
    if (!exp) return;

    const binItem = buildRecycleBinItem({
      itemType: 'expense',
      originalId: id,
      title: `Expense: ${exp.desc || exp.category}`,
      subtitle: `${exp.category} • PKR ${fmt(exp.amount)}`,
      amount: exp.amount,
      payload: exp
    });

    setState(prev => {
      const newState: AppState = {
        ...prev,
        expenses: prev.expenses.filter(e => e.id !== id),
        recycleBin: [binItem, ...(prev.recycleBin || [])]
      };
      pushStateImmediately(newState);
      return newState;
    });

    triggerUndoToast(binItem, `Expense moved to Recycle Bin`);
  };

  const handleAddCategory = (category: string) => {
    setState(prev => ({
      ...prev,
      expenseCategories: Array.from(new Set([...prev.expenseCategories, category]))
    }));
  };

  // ----------------------------------------------------
  // INQUIRIES & NOTIFICATIONS ACTIONS
  // ----------------------------------------------------
  const handleAddInquiry = (inquiryData: any) => {
    setState(prev => {
      const newState: AppState = {
        ...prev,
        inquiries: [{ ...inquiryData, id: generateId('inq'), resolved: false }, ...prev.inquiries]
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleResolveInquiry = (id: string) => {
    setState(prev => {
      const newState: AppState = {
        ...prev,
        inquiries: prev.inquiries.map(i => (i.id === id ? { ...i, resolved: true } : i))
      };
      pushStateImmediately(newState);
      return newState;
    });
  };

  const handleDeleteInquiry = (id: string) => {
    const inq = (state.inquiries || []).find(i => i.id === id);
    if (!inq) return;

    const binItem = buildRecycleBinItem({
      itemType: 'inquiry',
      originalId: id,
      title: `Inquiry: ${inq.party}`,
      subtitle: inq.detail,
      payload: inq
    });

    setState(prev => {
      const newState: AppState = {
        ...prev,
        inquiries: prev.inquiries.filter(i => i.id !== id),
        recycleBin: [binItem, ...(prev.recycleBin || [])]
      };
      pushStateImmediately(newState);
      return newState;
    });

    triggerUndoToast(binItem, `Inquiry moved to Recycle Bin`);
  };

  // ----------------------------------------------------
  // VISUAL SETTINGS & BRANDING
  // ----------------------------------------------------
  const handleUpdateVisualSettings = (settings: Partial<VisualSettings>) => {
    setState(prev => ({
      ...prev,
      visualSettings: { ...prev.visualSettings, ...settings }
    }));
  };

  const handleUpdateBranding = (companyName: string, companyTagline: string) => {
    setState(prev => ({
      ...prev,
      companyName,
      companyTagline
    }));
  };

  const handleUpdateSignatures = (
    signatureUrl: string | undefined,
    stampUrl: string | undefined
  ) => {
    setState(prev => ({
      ...prev,
      signatureUrl,
      stampUrl
    }));
  };

  const handleRestoreState = (restored: AppState) => {
    setState(restored);
  };

  const handleOpenPrinterConfig = () => {
    setActiveView('printer');
    setPrinterTabTrigger(prev => prev + 1);
    setTimeout(() => {
      const el = document.getElementById('settings-printer-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  // ----------------------------------------------------
  // LOCK SCREEN CHECK
  // ----------------------------------------------------
  if (isLocked) {
    return (
      <>
        {showOpeningSplash && (
          <AppOpeningSplash
            onComplete={() => setShowOpeningSplash(false)}
            companyName={state.companyName}
            companyTagline={state.companyTagline}
          />
        )}
        <LockScreen
          pin={state.pin || '321'}
          recoveryAnswer={state.recoveryAnswer || 'Umar'}
          language={state.language}
          companyName={state.companyName}
          companyTagline={state.companyTagline}
          visualSettings={state.visualSettings}
          onUnlock={() => setIsLocked(false)}
          onUpdatePin={newPin => setState(prev => ({ ...prev, pin: newPin }))}
          onUpdateVisualSettings={handleUpdateVisualSettings}
        />
      </>
    );
  }

  const activeInquiryCount = (state.inquiries || []).filter(i => !i.resolved).length;

  return (
    <div
      className={`h-screen h-[100dvh] max-h-screen flex flex-col bg-[var(--canvas)] text-[var(--text)] transition-colors duration-200 overflow-hidden relative ${
        state.visualSettings.showBlueprintGrid ? 'blueprint-bg' : ''
      }`}
    >
      {/* Industrial CAD Blueprint Grid Background Overlay */}
      {state.visualSettings.showBlueprintGrid && (
        <div
          className="fixed inset-0 pointer-events-none z-0 blueprint-grid-overlay animate-in fade-in duration-300"
          style={{
            '--grid-minor': `${state.visualSettings.blueprintGridScale || 20}px`,
            '--grid-major': `${(state.visualSettings.blueprintGridScale || 20) * 5}px`
          } as React.CSSProperties}
          aria-hidden="true"
        />
      )}

      {/* Blueprint Grid Numeric Coordinate Rulers & Floating Quick-Toggle HUD */}
      <BlueprintRulerOverlay
        gridScale={state.visualSettings.blueprintGridScale || 20}
        showGrid={!!state.visualSettings.showBlueprintGrid}
        theme={state.visualSettings.theme === 'light' ? 'light' : 'dark'}
        onToggleGrid={() =>
          handleUpdateVisualSettings({ showBlueprintGrid: !state.visualSettings.showBlueprintGrid })
        }
      />

      {/* Top Navigation Bar */}
      <TopBar
        theme={state.visualSettings.theme === 'light' ? 'light' : 'dark'}
        language={state.language}
        companyName={state.companyName}
        companyTagline={state.companyTagline}
        notificationCount={activeInquiryCount}
        syncState={syncState}
        pendingQueueCount={pendingQueueCount}
        workspaceStatus={workspaceSync.workspaceStatus}
        workspaceBadgeText={workspaceSync.statusBadgeText}
        workspaceTooltip={workspaceSync.statusBadgeTooltip}
        sheetsConnected={workspaceSync.sheetsConnected}
        driveConnected={workspaceSync.driveConnected}
        isSyncingWorkspace={workspaceSync.isSyncingSheets || workspaceSync.isUploadingDrive}
        isAutoAuthenticating={workspaceSync.isAutoAuthenticating}
        showBlueprintGrid={!!state.visualSettings.showBlueprintGrid}
        onToggleBlueprintGrid={() =>
          handleUpdateVisualSettings({ showBlueprintGrid: !state.visualSettings.showBlueprintGrid })
        }
        onOpenWorkspaceModal={() => setIsWorkspaceModalOpen(true)}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onToggleTheme={() => {
          const next = state.visualSettings.theme === 'dark' ? 'light' : 'dark';
          handleUpdateVisualSettings({ theme: next });
        }}
        onToggleLanguage={(lang: AppLanguage) => setState(prev => ({ ...prev, language: lang }))}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenVoice={() => setIsVoiceModalOpen(true)}
        onOpenNotifications={() => setActiveView('notifications')}
        onRefreshOverview={() => setActiveView('overview')}
        onLock={() => setIsLocked(true)}
        onToggleMenu={() => setIsSidebarOpen(prev => !prev)}
        onOpenPrinterConfig={handleOpenPrinterConfig}
        isPrinterConfigActive={activeView === 'printer'}
        recycleBinCount={state.recycleBin?.length || 0}
        onOpenRecycleBin={() => setIsRecycleBinOpen(true)}
        onOpenGmailVault={() => setIsGmailVaultOpen(true)}
      />

      {/* Mobile Permissions & Push Notifications Ambient Status Bar */}
      <MobilePermissionsBanner
        language={state.language}
        onOpenNotifications={() => setActiveView('notifications')}
        onOpenSettings={() => setActiveView('settings')}
      />

      {/* Main App Layout */}
      <div className="flex-1 flex overflow-hidden relative min-h-0 min-w-0">
        {/* Collapsible Industrial Sidebar */}
        <Sidebar
          currentView={activeView}
          activeCat={activeCategory}
          language={state.language}
          companyName={state.companyName}
          companyTagline={state.companyTagline}
          notificationCount={activeInquiryCount}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onOpenGateReceipts={() => setIsUnifiedGateReceiptsOpen(true)}
          recycleBinCount={state.recycleBin?.length || 0}
          onOpenRecycleBin={() => setIsRecycleBinOpen(true)}
          onOpenGmailVault={() => setIsGmailVaultOpen(true)}
          onSelectView={view => {
            setActiveView(view);
            setIsSidebarOpen(false);
          }}
          onSelectCategory={cat => {
            setActiveCategory(cat);
            setActiveView('products');
            setIsSidebarOpen(false);
          }}
          onOpenAbout={() => setActiveView('settings')}
        />

        {/* Viewport Content Area with Native Pull-To-Refresh */}
        <main
          ref={mainScrollRef}
          onTouchStart={activeView === 'overview' ? handleTouchStart : undefined}
          onTouchMove={activeView === 'overview' ? handleTouchMove : undefined}
          onTouchEnd={activeView === 'overview' ? handleTouchEnd : undefined}
          onMouseDown={activeView === 'overview' ? handleMouseDown : undefined}
          onMouseMove={activeView === 'overview' ? handleMouseMove : undefined}
          onMouseUp={activeView === 'overview' ? handleMouseUp : undefined}
          className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-6 pb-32 sm:pb-20 relative select-text min-h-0 min-w-0 touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
        >
          {/* Pull-To-Refresh Animated Indicator */}
          <div
            style={{
              height: pullDistance > 0 ? `${pullDistance}px` : 0,
              opacity: pullDistance > 8 ? Math.min(1, pullDistance / 35) : 0
            }}
            className="overflow-hidden transition-[height,opacity] duration-150 flex items-center justify-center pointer-events-none mb-1"
          >
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--panel-raised)] border border-[var(--steel-line)] shadow-md text-xs font-mono">
              {isPullRefreshing ? (
                pullSuccess ? (
                  <>
                    <Check size={14} className="text-emerald-400" />
                    <span className="text-emerald-400 font-bold">
                      {state.language === 'ur' ? 'اوورویو تازہ ہو گیا!' : 'Overview Updated!'}
                    </span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} className="text-[var(--yellow)] animate-spin" />
                    <span className="text-[var(--yellow)] font-semibold">
                      {state.language === 'ur' ? 'اوورویو تازہ ہو رہا ہے…' : 'Updating Overview…'}
                    </span>
                  </>
                )
              ) : (
                <>
                  <ArrowDown
                    size={14}
                    className={`transition-transform duration-200 ${
                      pullDistance >= 50 ? 'rotate-180 text-[var(--yellow)]' : 'text-[var(--text-dim)]'
                    }`}
                  />
                  <span className={pullDistance >= 50 ? 'text-[var(--yellow)] font-bold' : 'text-[var(--text-dim)]'}>
                    {pullDistance >= 50
                      ? state.language === 'ur'
                        ? 'تازہ کرنے کے لیے چھوڑیں'
                        : 'Release to update overview'
                      : state.language === 'ur'
                      ? 'اوورویو تازہ کرنے کے لیے نیچے کھینچیں'
                      : 'Pull down to update overview'}
                  </span>
                </>
              )}
            </div>
          </div>

          {activeView === 'overview' && (
            <OverviewView
              state={state}
              language={state.language}
              onNavigate={view => setActiveView(view)}
              onOpenCustomerLedger={(factoryName: string) => {
                setSelectedLedgerFactory(factoryName);
                setActiveView('factories');
              }}
            />
          )}

          {(activeView === 'products' || activeView === 'sales') && (
            <div className="flex flex-col lg:flex-row gap-4 items-start">
              <div className="flex-1 w-full min-w-0">
                <ProductsView
                  products={state.products}
                  activeCat={activeCategory}
                  language={state.language}
                  rawMaterialNames={state.rawItemNames || []}
                  productColors={state.productColours || []}
                  productSizes={state.productSizes || []}
                  productWeights={state.productWeights || []}
                  onAddToCart={handleAddToCart}
                  onSaveProduct={handleSaveProduct}
                  onDeleteProduct={handleDeleteProduct}
                />
              </div>
              <CartPanel
                cart={state.cart}
                factories={state.factories}
                nextTxnId={state.nextTxnId}
                language={state.language}
                onUpdateQty={handleUpdateCartQty}
                onRemoveLine={handleRemoveCartLine}
                onClearCart={handleClearCart}
                onCheckoutUnpaid={handleCheckoutUnpaid}
              />
              {/* Mobile Quick Cart Jump Floating Pill */}
              {state.cart.length > 0 && (
                <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById('cart-panel-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--yellow)] text-black font-bold text-xs shadow-2xl border-2 border-black/20 active:scale-95 transition cursor-pointer"
                  >
                    <ShoppingCart size={14} />
                    <span>
                      Order #{state.nextTxnId} ({state.cart.reduce((s, l) => s + l.qty, 0)} items)
                    </span>
                    <ArrowDown size={13} />
                  </button>
                </div>
              )}
            </div>
          )}

          {activeView === 'transactions' && (
            <TransactionsView
              transactions={state.transactions}
              rawSuppliers={state.rawSuppliers}
              customerPayments={state.customerPayments}
              language={state.language}
              companyName={state.companyName}
              onConfirmOrder={handleConfirmOrder}
              onRecordPayment={handleRecordPayment}
              onAttachGatePass={handleAttachGatePass}
              onNilOrder={handleNilOrder}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {activeView === 'factories' && (
            <FactoriesView
              factories={state.factories}
              customerLedgers={state.customerLedgers}
              customLedgersList={state.customLedgersList || []}
              language={state.language}
              companyName={state.companyName}
              selectedLedgerFactory={selectedLedgerFactory}
              onSelectLedgerFactory={setSelectedLedgerFactory}
              onSaveFactory={handleSaveFactory}
              onDeleteFactory={handleDeleteFactory}
              onAddLedgerEntry={handleAddLedgerEntry}
              onDeleteLedgerEntry={handleDeleteLedgerEntry}
              onUpdateLedgerEntry={handleUpdateLedgerEntry}
              onAddCustomLedger={handleAddCustomLedger}
              onOpenCustomLedgerDetail={cl => setSelectedCustomLedger(cl)}
            />
          )}

          {(activeView === 'paint_ledger' || activeView === 'paint') && (
            <PaintLedgerView
              painters={state.painters}
              language={state.language}
              companyName={state.companyName}
              onSavePainter={handleSavePainter}
              onDeletePainter={handleDeletePainter}
              onAddPaintEntry={handleAddPaintEntry}
              onDeletePaintEntry={handleDeletePaintEntry}
              onUpdatePaintEntry={handleUpdatePaintEntry}
              onToggleChequeStatus={handleToggleChequeStatus}
            />
          )}

          {(activeView === 'raw_material' || activeView === 'rawmaterial') && (
            <RawMaterialView
              suppliers={state.rawSuppliers}
              transactions={state.transactions}
              language={state.language}
              companyName={state.companyName}
              rawItemNames={state.rawStock.map(r => r.name)}
              onSaveSupplier={handleSaveSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              onAddRawEntry={handleAddRawEntry}
              onDeleteRawEntry={handleDeleteRawEntry}
              onUpdateRawEntry={handleUpdateRawEntry}
              onAttachGatePass={handleAttachRawGatePass}
            />
          )}

          {(activeView === 'labour_ledger' || activeView === 'labourledger') && (
            <LabourLedgerView
              workers={state.workers}
              language={state.language}
              companyName={state.companyName}
              onSaveWorker={handleSaveWorker}
              onDeleteWorker={handleDeleteWorker}
              onAddLabourEntry={handleAddLabourEntry}
              onDeleteLabourEntry={handleDeleteLabourEntry}
              onUpdateLabourEntry={handleUpdateLabourEntry}
              onBulkAttendance={handleBulkAttendance}
            />
          )}

          {activeView === 'scrapledger' && (
            <ScrapLedgerView
              buyers={state.scrapBuyers}
              language={state.language}
              companyName={state.companyName}
              onSaveBuyer={handleSaveScrapBuyer}
              onDeleteBuyer={handleDeleteScrapBuyer}
              onAddScrapEntry={handleAddScrapEntry}
              onDeleteScrapEntry={handleDeleteScrapEntry}
              onUpdateScrapEntry={handleUpdateScrapEntry}
            />
          )}

          {activeView === 'withdrawal' && (
            <WithdrawalView
              withdrawals={state.withdrawals}
              language={state.language}
              companyName={state.companyName}
              onAddWithdrawal={handleAddWithdrawal}
              onReverseWithdrawal={handleReverseWithdrawal}
              onUpdateWithdrawal={handleUpdateWithdrawal}
            />
          )}

          {activeView === 'stock' && (
            <StockView
              rawStock={state.rawStock}
              products={state.products}
              transactions={state.transactions}
              language={state.language}
              companyName={state.companyName}
              onUpdateRawStock={handleUpdateRawStock}
              onResetRawStock={handleResetRawStock}
              onAttachGatePass={handleAttachGatePass}
              onUpdateProductStock={handleUpdateProductStock}
            />
          )}

          {(activeView === 'returns' || activeView === 'productreturns') && (
            <ProductReturnsView
              returns={state.productReturns}
              factories={state.factories}
              products={state.products}
              language={state.language}
              companyName={state.companyName}
              onLogReturn={handleLogReturn}
              onResolveReturn={handleResolveReturn}
            />
          )}

          {activeView === 'expenses' && (
            <ExpensesView
              expenses={state.expenses}
              categories={state.expenseCategories}
              language={state.language}
              companyName={state.companyName}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              onUpdateExpense={handleUpdateExpense}
              onAddCategory={handleAddCategory}
            />
          )}

          {(activeView === 'visual_studio' || activeView === 'visualstudio' || activeView === 'settings' || activeView === 'printer') && (
            <SettingsView
              visualSettings={state.visualSettings}
              companyName={state.companyName}
              companyTagline={state.companyTagline}
              pin={state.pin || '321'}
              recoveryAnswer={state.recoveryAnswer || 'Umar'}
              language={state.language}
              initialTab={
                activeView === 'printer'
                  ? 'printer'
                  : activeView === 'visual_studio' || activeView === 'visualstudio'
                  ? 'visual_studio'
                  : settingsInitialTab
              }
              printerTabTrigger={printerTabTrigger}
              onUpdateVisualSettings={handleUpdateVisualSettings}
              onUpdateBranding={handleUpdateBranding}
              onUpdatePin={newPin => setState(prev => ({ ...prev, pin: newPin }))}
              onUpdateRecoveryAnswer={newAns => setState(prev => ({ ...prev, recoveryAnswer: newAns }))}
              onUpdateAutolock={sec => setState(prev => ({ ...prev, autolockSeconds: sec, autolockMinutes: Math.round(sec / 60) }))}
              onLockTerminal={() => setIsLocked(true)}
              appState={state}
              syncState={syncState}
              lastSyncTime={lastSyncTime}
              terminalId={terminalId}
              terminalName={terminalName}
              pendingQueueCount={pendingQueueCount}
              isOnline={isOnline}
              syncErrorMsg={syncErrorMsg}
              onForceSyncNow={forceSyncNow}
              onNavigateToBackup={(tab) => {
                if (tab) setBackupInitialTab(tab);
                setActiveView('backup');
              }}
            />
          )}

          {(activeView === 'gallery' || activeView === 'exports') && (
            <GalleryView
              products={state.products}
              language={state.language}
              companyName={state.companyName || 'Falcon Rod Maker'}
              initialTab={activeView === 'exports' ? 'exports' : 'catalog'}
              onAddToCart={handleAddToCart}
              onNavigateToPos={() => setActiveView('products')}
              onSaveProduct={handleSaveProduct}
            />
          )}

          {activeView === 'backup' && (
            <BackupView
              appState={state}
              language={state.language}
              initialTab={backupInitialTab}
              onRestoreState={handleRestoreState}
              onUpdateSignatures={handleUpdateSignatures}
              syncState={syncState}
              lastSyncTime={lastSyncTime}
              terminalId={terminalId}
              terminalName={terminalName}
              pendingQueueCount={pendingQueueCount}
              isOnline={isOnline}
              syncErrorMsg={syncErrorMsg}
              onForceSyncNow={forceSyncNow}
              onOpenRecycleBin={() => setIsRecycleBinOpen(true)}
              onOpenGmailVault={() => setIsGmailVaultOpen(true)}
              onNavigateToSettings={(tab) => {
                if (tab) setSettingsInitialTab(tab as any);
                setActiveView('settings');
              }}
            />
          )}

          {activeView === 'notifications' && (
            <NotificationsView
              inquiries={state.inquiries}
              rawStock={state.rawStock}
              transactions={state.transactions}
              language={state.language}
              onAddInquiry={handleAddInquiry}
              onResolveInquiry={handleResolveInquiry}
              onDeleteInquiry={handleDeleteInquiry}
            />
          )}
        </main>
      </div>

      {/* Floating Global Modals */}
      {isVoiceModalOpen && (
        <VoiceModal
          language={state.language}
          onClose={() => setIsVoiceModalOpen(false)}
          onNavigate={view => setActiveView(view)}
          onLock={() => setIsLocked(true)}
        />
      )}

      {isSearchModalOpen && (
        <GlobalSearchModal
          appState={state}
          onClose={() => setIsSearchModalOpen(false)}
          onNavigate={(view, id) => {
            setActiveView(view);
            if (view === 'factories' && id) setSelectedLedgerFactory(id);
          }}
        />
      )}

      {selectedCustomLedger && (
        <CustomLedgerDetailModal
          customLedger={selectedCustomLedger}
          language={state.language}
          companyName={state.companyName}
          onClose={() => setSelectedCustomLedger(null)}
          onAddEntry={handleAddCustomLedgerEntry}
          onDeleteEntry={handleDeleteCustomLedgerEntry}
          onUpdateEntry={handleUpdateCustomLedgerEntry}
          onUpdateSelfWeightStock={handleUpdateSelfWeightStock}
          onDeleteCustomLedger={handleDeleteCustomLedger}
        />
      )}

      {/* Multi-Terminal Cloud POS Sync Status & Configuration Modal */}
      <TerminalSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        syncState={syncState}
        lastSyncTime={lastSyncTime}
        terminalId={terminalId}
        terminalName={terminalName}
        onUpdateTerminalName={setTerminalName}
        onForceSync={forceSyncNow}
        language={state.language}
        syncErrorMsg={syncErrorMsg}
        pendingQueueCount={pendingQueueCount}
        isOnline={isOnline}
        onOpenWorkspaceSync={() => setIsWorkspaceModalOpen(true)}
      />

      {/* Google Sheets & Google Drive Live Sync Hub Modal */}
      <WorkspaceSyncModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        appState={state}
        sheetsConnected={workspaceSync.sheetsConnected}
        spreadsheetId={workspaceSync.spreadsheetId}
        spreadsheetTitle={workspaceSync.spreadsheetTitle}
        spreadsheetUrl={workspaceSync.spreadsheetUrl}
        lastSheetsSync={workspaceSync.lastSheetsSync}
        sheetsAutoSync={workspaceSync.sheetsAutoSync}
        isSyncingSheets={workspaceSync.isSyncingSheets}
        sheetsError={workspaceSync.sheetsError}
        sheetsSuccessMsg={workspaceSync.sheetsSuccessMsg}
        onSyncAllSheets={workspaceSync.syncAllSheets}
        onConnectSheets={workspaceSync.connectSheets}
        onDisconnectSheets={workspaceSync.disconnectSheets}
        onToggleSheetsAutoSync={workspaceSync.toggleSheetsAutoSync}
        driveConnected={workspaceSync.driveConnected}
        driveFolderId={workspaceSync.driveFolderId}
        lastDriveBackup={workspaceSync.lastDriveBackup}
        driveAutoBackup={workspaceSync.driveAutoBackup}
        driveAutoBackupInterval={workspaceSync.driveAutoBackupInterval}
        nextScheduledDriveBackup={workspaceSync.nextScheduledDriveBackup}
        driveBackupCountdown={workspaceSync.driveBackupCountdown}
        isUploadingDrive={workspaceSync.isUploadingDrive}
        driveError={workspaceSync.driveError}
        driveSuccessMsg={workspaceSync.driveSuccessMsg}
        driveBackupsCount={workspaceSync.driveBackupsCount}
        onBackupToDrive={workspaceSync.backupToDrive}
        onBackupAllFilesToDrive={workspaceSync.backupAllFilesToDrive}
        onConnectDrive={workspaceSync.connectDrive}
        onDisconnectDrive={workspaceSync.disconnectDrive}
        onToggleDriveAutoBackup={workspaceSync.toggleDriveAutoBackup}
        onChangeDriveAutoBackupInterval={workspaceSync.changeDriveAutoBackupInterval}
        onAutoSyncNow={workspaceSync.autoSyncNow}
        isAutoAuthenticating={workspaceSync.isAutoAuthenticating}
        onNavigateToBackupTab={tab => {
          setBackupInitialTab(tab);
          setActiveView('backup');
        }}
        syncState={syncState}
        pendingQueueCount={pendingQueueCount}
      />

      {/* Unified Gate Receipts Registry Modal (Factory Deliveries & Customer Sales) */}
      {isUnifiedGateReceiptsOpen && (
        <UnifiedGateReceiptsModal
          transactions={state.transactions}
          rawSuppliers={state.rawSuppliers}
          language={state.language}
          companyName={state.companyName}
          onClose={() => setIsUnifiedGateReceiptsOpen(false)}
          onOpenGatePassUploadForTxn={txn => {
            setIsUnifiedGateReceiptsOpen(false);
            setActiveView('transactions');
          }}
        />
      )}

      {/* Document Export Studio Modal (PDF & JPG with Full Customization) */}
      <ExportCustomizerModal
        isOpen={isGlobalExportOpen}
        onClose={() => {
          setIsGlobalExportOpen(false);
          setGlobalExportPayload(null);
        }}
        payload={globalExportPayload}
      />

      {/* Recycle Bin & Accidental Delete Recovery Modal */}
      <RecycleBinModal
        isOpen={isRecycleBinOpen}
        onClose={() => setIsRecycleBinOpen(false)}
        items={state.recycleBin || []}
        language={state.language}
        onRestoreItem={handleRestoreBinItem}
        onRestoreAll={handleRestoreAllBinItems}
        onPurgeItem={handlePurgeBinItem}
        onEmptyBin={handleEmptyBin}
      />

      {/* Gmail Cloud Vault & Multi-Phone Sync / Recovery Modal */}
      <GmailCloudVaultModal
        isOpen={isGmailVaultOpen}
        onClose={() => setIsGmailVaultOpen(false)}
        language={state.language}
        currentEmail="umarzaman7777777@gmail.com"
        syncState={syncState}
        lastSyncTime={lastSyncTime}
        pendingQueueCount={pendingQueueCount}
        isOnline={isOnline}
        onForceSyncNow={forceSyncNow}
        onRestoreFromVault={restoreFromGmailVault}
      />

      {/* Instant Accidental Delete Recovery Floating Toast */}
      {undoToast && (
        <div
          className="fixed bottom-5 right-5 z-[99] max-w-sm w-[90vw] sm:w-auto bg-slate-950/95 text-white border border-rose-500/40 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200"
          dir={state.language === 'ur' ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 size={16} />
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">{undoToast.message}</p>
              <p className="text-[10px] text-slate-400">
                {state.language === 'ur' ? 'کوڑا دان میں محفوظ کیا گیا' : 'Safely kept in Recycle Bin'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => handleRestoreBinItem(undoToast.binItem)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black flex items-center gap-1 transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>{state.language === 'ur' ? 'بحال کریں' : 'Undo'}</span>
            </button>
            <button
              onClick={() => {
                setUndoToast(null);
                setIsRecycleBinOpen(true);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              title="Open Recycle Bin"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
      {/* Global Export Download Toast Notification */}
      <ExportDownloadToast />
      {/* PWA Offline Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
};

export default App;
