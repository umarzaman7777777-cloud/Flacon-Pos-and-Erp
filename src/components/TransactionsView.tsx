import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  CreditCard,
  Check,
  Trash2,
  Search,
  Download,
  FileText,
  Printer,
  Image as ImageIcon,
  Eye,
  ShieldCheck,
  ShieldAlert,
  UploadCloud,
  Lock,
  List,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Package,
  DollarSign,
  Clock,
  ExternalLink,
  Info,
  Barcode,
  Copy,
  CheckCheck,
  Truck,
  Tag,
  Hash,
  Calculator,
  History,
  Boxes,
  Scale,
  ArrowRight,
  Calendar,
  Factory,
  AlertTriangle,
  TrendingUp,
  Layers,
  Sparkles,
  Milestone,
  CheckCircle2,
  ArrowUpRight,
  Filter,
  Zap,
  Activity
} from 'lucide-react';
import { Transaction, AppLanguage, CustomerPayment, GatePassData, RawSupplier, RawStockItem, Product } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { fmt, downloadCSV } from '../utils/helpers';
import { openExportModal } from '../utils/exportSettingsHelper';
import { TransactionPdfModal } from './TransactionPdfModal';
import { GatePassUploadModal } from './GatePassUploadModal';
import { GatePassViewerModal } from './GatePassViewerModal';
import { UnifiedGateReceiptsModal } from './UnifiedGateReceiptsModal';
import { OrderDetailsModal } from './OrderDetailsModal';
import { getNextGateSequence } from '../utils/gateSequenceManager';
import { printThermalReceiptDocument, parseTransactionItems } from '../utils/transactionPdf';
import { exportSingleTransactionJPG } from '../utils/exportManager';

interface TransactionsViewProps {
  transactions: Transaction[];
  customerPayments: CustomerPayment[];
  rawSuppliers?: RawSupplier[];
  rawStock?: RawStockItem[];
  products?: Product[];
  language: AppLanguage;
  companyName: string;
  onConfirmOrder: (id: string) => void;
  onRecordPayment: (txnId: string, amount: number, method: string, detail: string) => void;
  onAttachGatePass: (id: string, gatePass?: GatePassData) => void;
  onNilOrder: (id: string) => void;
  onDeleteTransaction: (id: string) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  customerPayments,
  rawSuppliers = [],
  rawStock = [],
  products = [],
  language,
  companyName,
  onConfirmOrder,
  onRecordPayment,
  onAttachGatePass,
  onNilOrder,
  onDeleteTransaction
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'orders' | 'batch_history'>('orders');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [batchSearchTerm, setBatchSearchTerm] = useState<string>('');
  const [trendMetricMode, setTrendMetricMode] = useState<'per_order' | 'cumulative'>('per_order');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'awaiting_gp' | 'with_gp' | 'unpaid' | 'paid'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [expandedBatchRowIds, setExpandedBatchRowIds] = useState<Set<string>>(new Set());
  const [copiedBatchText, setCopiedBatchText] = useState<{ id: string; field: string } | null>(null);
  
  // Modals state
  const [inspectOrderTxn, setInspectOrderTxn] = useState<Transaction | null>(null);
  const [paymentModalTxn, setPaymentModalTxn] = useState<Transaction | null>(null);
  const [selectedPdfTxn, setSelectedPdfTxn] = useState<Transaction | null>(null);
  const [uploadGatePassTxn, setUploadGatePassTxn] = useState<Transaction | null>(null);
  const [viewGatePassTxn, setViewGatePassTxn] = useState<Transaction | null>(null);
  const [isUnifiedReceiptsOpen, setIsUnifiedReceiptsOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payDetail, setPayDetail] = useState('');
  const [exportingJpgId, setExportingJpgId] = useState<string | null>(null);

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const getPaidInfo = (txn: Transaction) => {
    const pays = customerPayments.filter(p => p.txnId === txn.id);
    const amountPaid = pays.reduce((sum, p) => sum + p.amount, 0) + (txn.paid ? txn.total : 0);
    const due = Math.max(0, txn.total - amountPaid);
    const isPaid = due <= 0;
    const isPartial = amountPaid > 0 && due > 0;
    return {
      amountPaid,
      due,
      status: isPaid ? 'Paid' : isPartial ? 'Partial' : 'Unpaid'
    };
  };

  const filteredTxns = transactions.filter(txn => {
    // Search query
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matches =
        txn.id.toLowerCase().includes(q) ||
        (txn.factory && txn.factory.toLowerCase().includes(q)) ||
        txn.itemsSummary.toLowerCase().includes(q) ||
        (txn.sizes && txn.sizes.toLowerCase().includes(q)) ||
        (txn.gateSequenceNo && txn.gateSequenceNo.toLowerCase().includes(q)) ||
        (txn.batchId && txn.batchId.toLowerCase().includes(q)) ||
        (txn.trackingNumber && txn.trackingNumber.toLowerCase().includes(q)) ||
        (txn.itemBatches && txn.itemBatches.toLowerCase().includes(q)) ||
        (txn.itemTrackingNumbers && txn.itemTrackingNumbers.toLowerCase().includes(q));
      if (!matches) return false;
    }

    // Status filter
    if (statusFilter === 'awaiting_gp') {
      return !txn.receiptUrl;
    }
    if (statusFilter === 'with_gp') {
      return !!txn.receiptUrl;
    }
    if (statusFilter === 'unpaid') {
      const info = getPaidInfo(txn);
      return info.due > 0;
    }
    if (statusFilter === 'paid') {
      const info = getPaidInfo(txn);
      return info.status === 'Paid';
    }

    return true;
  });

  // Summary Metrics (All transactions)
  const totalBookedCount = transactions.length;
  const totalBookedValue = transactions.reduce((sum, t) => sum + t.total, 0);
  const awaitingCount = transactions.filter(t => !t.receiptUrl).length;
  const awaitingValue = transactions.filter(t => !t.receiptUrl).reduce((sum, t) => sum + t.total, 0);
  const verifiedCount = transactions.filter(t => !!t.receiptUrl).length;
  const totalDueValue = transactions.reduce((sum, t) => sum + getPaidInfo(t).due, 0);
  const unpaidCount = transactions.filter(t => getPaidInfo(t).due > 0).length;

  // Dynamic metrics for the summary row (dynamically calculated from currently filtered transactions)
  const dynamicSummary = useMemo(() => {
    let totalQty = 0;
    let aggregateValue = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let deliveredCount = 0;
    let pendingPassCount = 0;

    for (const txn of filteredTxns) {
      aggregateValue += (txn.total || 0);
      totalQty += (txn.itemCount || 1);
      const paidInfo = getPaidInfo(txn);
      totalPaid += paidInfo.amountPaid;
      totalDue += paidInfo.due;
      if (txn.receiptUrl) {
        deliveredCount++;
      } else {
        pendingPassCount++;
      }
    }

    return {
      totalOrders: filteredTxns.length,
      isFiltered: filteredTxns.length !== transactions.length,
      allOrdersCount: transactions.length,
      totalQty,
      aggregateValue,
      totalPaid,
      totalDue,
      deliveredCount,
      pendingPassCount
    };
  }, [filteredTxns, transactions.length, customerPayments]);

  const handleOpenPayModal = (txn: Transaction) => {
    const info = getPaidInfo(txn);
    setPaymentModalTxn(txn);
    setPayAmount(String(info.due));
    setPayMethod('Cash');
    setPayDetail('');
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalTxn) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    onRecordPayment(paymentModalTxn.id, amt, payMethod, payDetail);
    setPaymentModalTxn(null);
  };

  const handleExportCSV = () => {
    const headers = ['Order ID', 'Date', 'Time', 'Customer/Factory', 'Items', 'Total (Rs)', 'Status', 'Due (Rs)', 'Gate Pass'];
    const rows = filteredTxns.map(t => {
      const info = getPaidInfo(t);
      return [
        t.id,
        t.date,
        t.time,
        t.factory || 'Walk-in',
        t.itemsSummary.replace(/\n/g, '; '),
        t.total,
        info.status,
        info.due,
        t.receiptUrl ? 'Verified & In Sales' : 'Awaiting Gate Pass'
      ];
    });
    downloadCSV('Orders_Booked_Ledger', headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['ID', 'Date', 'Factory', 'Items', 'Total', 'Due', 'Gate Pass'];
    const rows = filteredTxns.map(t => {
      const info = getPaidInfo(t);
      return [
        t.id,
        t.date,
        t.factory || 'Walk-in',
        t.itemsSummary.replace(/\n/g, ' '),
        fmt(t.total),
        fmt(info.due),
        t.receiptUrl ? 'Verified' : 'Awaiting'
      ];
    });
    openExportModal({
      title: 'Order Booked Report',
      headers,
      rows,
      filename: 'Order_Booked_Report',
      companyName,
      subtitle: 'Authorized Sales & Order Ledger',
      defaultFormat: 'pdf',
      initialOrientation: 'landscape'
    });
  };

  const handleExportJPG = () => {
    const headers = ['ID', 'Date', 'Factory', 'Items Summary', 'Total (PKR)', 'Due (PKR)', 'Gate Pass'];
    const rows = filteredTxns.map(t => {
      const info = getPaidInfo(t);
      return [
        t.id,
        t.date,
        t.factory || 'Walk-in',
        t.itemsSummary.replace(/\n/g, ' '),
        fmt(t.total),
        fmt(info.due),
        t.receiptUrl ? 'Verified' : 'Awaiting'
      ];
    });
    openExportModal({
      title: 'Order Booked Report',
      headers,
      rows,
      filename: 'Order_Booked_Report',
      companyName,
      subtitle: 'Authorized Sales & Order Ledger',
      defaultFormat: 'jpg',
      initialOrientation: 'landscape'
    });
  };

  const toggleRowExpand = (id: string) => {
    setExpandedRowId(prev => (prev === id ? null : id));
  };

  const toggleBatchDetails = (id: string) => {
    setExpandedBatchRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopyBatchText = (text: string, id: string, field: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopiedBatchText({ id, field });
    setTimeout(() => {
      setCopiedBatchText(prev => (prev?.id === id && prev?.field === field ? null : prev));
    }, 2000);
  };

  const getBatchInfo = (txn: Transaction) => {
    const cleanDate = (txn.date || '').replace(/[^0-9]/g, '').slice(2, 8) || '261025';
    const cleanId = (txn.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '0001';
    const effectiveBatchId = txn.batchId || `BAT-${cleanDate}-${cleanId}`;
    const trackingPrefix = (txn.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'ORD';
    const effectiveTrackingNumber = txn.trackingNumber || `TRK-${trackingPrefix}-${txn.gateSequence ? 'G' + txn.gateSequence : 'LOG'}`;
    const parsedItems = parseTransactionItems(txn);
    const itemsWithBatch = parsedItems.map((it, idx) => {
      const lineBatchId = it.batchId || `${effectiveBatchId}-L${idx + 1}`;
      const lineTrackingNumber = it.trackingNumber || `${effectiveTrackingNumber}-${String(idx + 1).padStart(2, '0')}`;
      return {
        ...it,
        lineBatchId,
        lineTrackingNumber,
      };
    });
    return {
      effectiveBatchId,
      effectiveTrackingNumber,
      itemsWithBatch,
    };
  };

  const jumpToBatchHistory = (bId: string) => {
    setSelectedBatchId(bId);
    setActiveMainTab('batch_history');
  };

  // Group all transactions by production lot / batch ID
  const { batchList, batchMap } = useMemo(() => {
    const map = new Map<string, {
      batchId: string;
      transactions: Transaction[];
      totalRods: number;
      totalValue: number;
      startDate: string;
      endDate: string;
      factories: Set<string>;
      materialsSummary: Record<string, { weightKg: number; pieces: number; unit: string }>;
    }>();

    for (const txn of transactions) {
      const bInfo = getBatchInfo(txn);
      const bId = txn.batchId || bInfo.effectiveBatchId;
      if (!bId) continue;

      if (!map.has(bId)) {
        map.set(bId, {
          batchId: bId,
          transactions: [],
          totalRods: 0,
          totalValue: 0,
          startDate: txn.date,
          endDate: txn.date,
          factories: new Set(),
          materialsSummary: {},
        });
      }

      const bEntry = map.get(bId)!;
      bEntry.transactions.push(txn);
      bEntry.totalValue += (txn.total || 0);
      if (txn.factory) bEntry.factories.add(txn.factory);

      const parsedItems = parseTransactionItems(txn);
      for (const item of parsedItems) {
        const qty = item.qty || 1;
        bEntry.totalRods += qty;

        const matchedProduct = products.find(p =>
          p.name.toLowerCase() === item.name.toLowerCase() ||
          item.name.toLowerCase().includes(p.name.toLowerCase()) ||
          p.name.toLowerCase().includes(item.name.toLowerCase())
        );

        if (matchedProduct && matchedProduct.recipe && matchedProduct.recipe.length > 0) {
          for (const rec of matchedProduct.recipe) {
            const mat = rec.material;
            if (!bEntry.materialsSummary[mat]) {
              bEntry.materialsSummary[mat] = { weightKg: 0, pieces: 0, unit: rec.weightPerUnit ? 'kg' : 'pcs' };
            }
            if (rec.weightPerUnit) {
              bEntry.materialsSummary[mat].weightKg += rec.weightPerUnit * qty;
              bEntry.materialsSummary[mat].unit = 'kg';
            }
            if (rec.itemsPerUnit) {
              bEntry.materialsSummary[mat].pieces += rec.itemsPerUnit * qty;
              if (!rec.weightPerUnit) bEntry.materialsSummary[mat].unit = 'pcs';
            }
          }
        } else {
          const lower = (item.name + ' ' + (item.size || txn.sizes || '')).toLowerCase();
          let pipeKg = 0.85;
          if (lower.includes('12"') || lower.includes('12 inch') || lower.includes('12-heavy')) pipeKg = 0.6;
          else if (lower.includes('18"') || lower.includes('18 inch') || lower.includes('18-deluxe')) pipeKg = 0.8;
          else if (lower.includes('24"') || lower.includes('24 inch') || lower.includes('24-standard')) pipeKg = 1.1;
          else if (lower.includes('30"') || lower.includes('30 inch')) pipeKg = 1.4;
          else if (lower.includes('36"') || lower.includes('36 inch') || lower.includes('36-industrial')) pipeKg = 1.8;
          else if (lower.includes('48"') || lower.includes('48 inch')) pipeKg = 2.4;
          else if (lower.includes('pedestal')) pipeKg = 1.25;

          const pipeMat = lower.includes('heavy') ? 'M.S. Heavy Pipe' : 'M.S. Steel Pipe';
          if (!bEntry.materialsSummary[pipeMat]) {
            bEntry.materialsSummary[pipeMat] = { weightKg: 0, pieces: 0, unit: 'kg' };
          }
          bEntry.materialsSummary[pipeMat].weightKg += pipeKg * qty;

          const boltMat = 'Safety Bolt & Cotter Pin';
          if (!bEntry.materialsSummary[boltMat]) {
            bEntry.materialsSummary[boltMat] = { weightKg: 0, pieces: 0, unit: 'pcs' };
          }
          bEntry.materialsSummary[boltMat].pieces += 1 * qty;

          const bushingMat = 'Rubber Bushing';
          if (!bEntry.materialsSummary[bushingMat]) {
            bEntry.materialsSummary[bushingMat] = { weightKg: 0, pieces: 0, unit: 'pcs' };
          }
          bEntry.materialsSummary[bushingMat].pieces += 1 * qty;
        }
      }
    }

    for (const entry of map.values()) {
      entry.transactions.sort((a, b) => {
        const parseD = (dStr: string) => {
          if (!dStr) return 0;
          if (dStr.includes('/')) {
            const [d, m, y] = dStr.split('/').map(Number);
            return new Date(y, m - 1, d).getTime();
          }
          return new Date(dStr).getTime();
        };
        const timeA = parseD(a.date);
        const timeB = parseD(b.date);
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });
      if (entry.transactions.length > 0) {
        entry.startDate = entry.transactions[0].date;
        entry.endDate = entry.transactions[entry.transactions.length - 1].date;
      }
    }

    const list = Array.from(map.values());
    return { batchList: list, batchMap: map };
  }, [transactions, products]);

  // Selected batch object
  const currentBatch = useMemo(() => {
    if (!selectedBatchId && batchList.length > 0) {
      return batchList[0];
    }
    return batchMap.get(selectedBatchId) || batchList[0] || null;
  }, [selectedBatchId, batchList, batchMap]);

  // Timeline progression with step-by-step cumulative tracking
  const timelineMilestones = useMemo(() => {
    if (!currentBatch) return [];

    let cumRods = 0;
    let cumValue = 0;
    const cumMaterials: Record<string, { weightKg: number; pieces: number; unit: string }> = {};

    return currentBatch.transactions.map((txn, idx) => {
      const parsed = parseTransactionItems(txn);
      let orderRods = 0;
      const orderMaterials: Record<string, { weightKg: number; pieces: number; unit: string }> = {};

      for (const item of parsed) {
        const qty = item.qty || 1;
        orderRods += qty;

        const matchedProduct = products.find(p =>
          p.name.toLowerCase() === item.name.toLowerCase() ||
          item.name.toLowerCase().includes(p.name.toLowerCase()) ||
          p.name.toLowerCase().includes(item.name.toLowerCase())
        );

        if (matchedProduct && matchedProduct.recipe && matchedProduct.recipe.length > 0) {
          for (const rec of matchedProduct.recipe) {
            const mat = rec.material;
            if (!orderMaterials[mat]) orderMaterials[mat] = { weightKg: 0, pieces: 0, unit: rec.weightPerUnit ? 'kg' : 'pcs' };
            if (!cumMaterials[mat]) cumMaterials[mat] = { weightKg: 0, pieces: 0, unit: rec.weightPerUnit ? 'kg' : 'pcs' };

            if (rec.weightPerUnit) {
              const w = rec.weightPerUnit * qty;
              orderMaterials[mat].weightKg += w;
              orderMaterials[mat].unit = 'kg';
              cumMaterials[mat].weightKg += w;
              cumMaterials[mat].unit = 'kg';
            }
            if (rec.itemsPerUnit) {
              const pcs = rec.itemsPerUnit * qty;
              orderMaterials[mat].pieces += pcs;
              cumMaterials[mat].pieces += pcs;
              if (!rec.weightPerUnit) {
                orderMaterials[mat].unit = 'pcs';
                cumMaterials[mat].unit = 'pcs';
              }
            }
          }
        } else {
          const lower = (item.name + ' ' + (item.size || txn.sizes || '')).toLowerCase();
          let pipeKg = 0.85;
          if (lower.includes('12"') || lower.includes('12 inch') || lower.includes('12-heavy')) pipeKg = 0.6;
          else if (lower.includes('18"') || lower.includes('18 inch') || lower.includes('18-deluxe')) pipeKg = 0.8;
          else if (lower.includes('24"') || lower.includes('24 inch') || lower.includes('24-standard')) pipeKg = 1.1;
          else if (lower.includes('30"') || lower.includes('30 inch')) pipeKg = 1.4;
          else if (lower.includes('36"') || lower.includes('36 inch') || lower.includes('36-industrial')) pipeKg = 1.8;
          else if (lower.includes('48"') || lower.includes('48 inch')) pipeKg = 2.4;
          else if (lower.includes('pedestal')) pipeKg = 1.25;

          const pipeMat = lower.includes('heavy') ? 'M.S. Heavy Pipe' : 'M.S. Steel Pipe';
          if (!orderMaterials[pipeMat]) orderMaterials[pipeMat] = { weightKg: 0, pieces: 0, unit: 'kg' };
          if (!cumMaterials[pipeMat]) cumMaterials[pipeMat] = { weightKg: 0, pieces: 0, unit: 'kg' };
          orderMaterials[pipeMat].weightKg += pipeKg * qty;
          cumMaterials[pipeMat].weightKg += pipeKg * qty;

          const boltMat = 'Safety Bolt & Cotter Pin';
          if (!orderMaterials[boltMat]) orderMaterials[boltMat] = { weightKg: 0, pieces: 0, unit: 'pcs' };
          if (!cumMaterials[boltMat]) cumMaterials[boltMat] = { weightKg: 0, pieces: 0, unit: 'pcs' };
          orderMaterials[boltMat].pieces += 1 * qty;
          cumMaterials[boltMat].pieces += 1 * qty;

          const bushingMat = 'Rubber Bushing';
          if (!orderMaterials[bushingMat]) orderMaterials[bushingMat] = { weightKg: 0, pieces: 0, unit: 'pcs' };
          if (!cumMaterials[bushingMat]) cumMaterials[bushingMat] = { weightKg: 0, pieces: 0, unit: 'pcs' };
          orderMaterials[bushingMat].pieces += 1 * qty;
          cumMaterials[bushingMat].pieces += 1 * qty;
        }
      }

      cumRods += orderRods;
      cumValue += (txn.total || 0);

      const snapshotCumMaterials = JSON.parse(JSON.stringify(cumMaterials));

      return {
        milestoneIndex: idx + 1,
        transaction: txn,
        parsedItems: parsed,
        orderRods,
        orderMaterials,
        cumulativeRods: cumRods,
        cumulativeValue: cumValue,
        cumulativeMaterials: snapshotCumMaterials,
      };
    });
  }, [currentBatch, products]);

  // Compare batch materials against live rawStock
  const rawStockComparison = useMemo(() => {
    if (!currentBatch) return [];

    const result = [];
    const matKeys = Object.keys(currentBatch.materialsSummary);

    for (const matKey of matKeys) {
      const usage = currentBatch.materialsSummary[matKey];
      const stockItem = rawStock.find(r => {
        const rName = r.name.toLowerCase();
        const mName = matKey.toLowerCase();
        return rName.includes(mName) || mName.includes(rName.split(' ')[0]);
      });

      const isWeight = usage.unit === 'kg';
      const consumedAmount = isWeight ? usage.weightKg : usage.pieces;
      const liveStock = stockItem
        ? (isWeight ? (stockItem.weight ?? 0) : ((stockItem as any).quantity ?? stockItem.items ?? 0))
        : 0;

      const totalPool = liveStock + consumedAmount;
      const utilizationRate = totalPool > 0 ? (consumedAmount / totalPool) * 100 : 0;
      const remainingAfterBatch = Math.max(0, liveStock);

      result.push({
        materialName: matKey,
        unit: usage.unit,
        consumed: consumedAmount,
        liveStock,
        remainingAfterBatch,
        utilizationRate,
        reorderLevel: stockItem?.reorderLevel || (isWeight ? 100 : 150),
        stockCategory: stockItem?.category || (isWeight ? 'Raw Material' : 'Fittings'),
      });
    }

    return result;
  }, [currentBatch, rawStock]);

  const filteredBatches = useMemo(() => {
    if (!batchSearchTerm.trim()) return batchList;
    const q = batchSearchTerm.toLowerCase();
    return batchList.filter(b => {
      const matchesId = b.batchId.toLowerCase().includes(q);
      const matchesFactory = Array.from(b.factories).some(f => f.toLowerCase().includes(q));
      const matchesOrders = b.transactions.some(t => t.id.toLowerCase().includes(q) || t.itemsSummary.toLowerCase().includes(q));
      return matchesId || matchesFactory || matchesOrders;
    });
  }, [batchList, batchSearchTerm]);

  // Recharts Line Chart Trend Data: Material usage progression across orders in the batch
  const materialTrendChartData = useMemo(() => {
    if (!timelineMilestones || timelineMilestones.length === 0) return [];

    return timelineMilestones.map(m => {
      const txn = m.transaction;
      let pipeKg = 0;
      let bolts = 0;
      let bushings = 0;

      for (const [matName, usage] of Object.entries(m.orderMaterials)) {
        const lower = matName.toLowerCase();
        if (lower.includes('pipe') || usage.unit === 'kg') {
          pipeKg += usage.weightKg;
        } else if (lower.includes('bolt') || lower.includes('cotter')) {
          bolts += usage.pieces;
        } else if (lower.includes('bushing') || lower.includes('rubber')) {
          bushings += usage.pieces;
        }
      }

      let cumPipeKg = 0;
      let cumBolts = 0;
      let cumBushings = 0;

      for (const [cMatName, cUsage] of Object.entries(m.cumulativeMaterials)) {
        const lower = cMatName.toLowerCase();
        const u = cUsage as { weightKg: number; pieces: number; unit: string };
        if (lower.includes('pipe') || u.unit === 'kg') {
          cumPipeKg += u.weightKg;
        } else if (lower.includes('bolt') || lower.includes('cotter')) {
          cumBolts += u.pieces;
        } else if (lower.includes('bushing') || lower.includes('rubber')) {
          cumBushings += u.pieces;
        }
      }

      const pipePerRod = m.orderRods > 0 ? Number((pipeKg / m.orderRods).toFixed(2)) : 0;

      return {
        orderId: `#${txn.id}`,
        milestone: `M${m.milestoneIndex}`,
        label: `M#${m.milestoneIndex} (${txn.id})`,
        customer: txn.factory || 'Walk-in Customer',
        date: txn.date,
        time: txn.time,
        rods: m.orderRods,
        pipeKg: Number(pipeKg.toFixed(1)),
        boltsPcs: bolts,
        bushingsPcs: bushings,
        cumPipeKg: Number(cumPipeKg.toFixed(1)),
        cumBoltsPcs: cumBolts,
        cumBushingsPcs: cumBushings,
        pipePerRod,
      };
    });
  }, [timelineMilestones]);

  // Spike detection and consumption analysis
  const spikeAnalysis = useMemo(() => {
    if (materialTrendChartData.length === 0) return null;

    const maxPipeOrder = [...materialTrendChartData].sort((a, b) => b.pipeKg - a.pipeKg)[0];
    const avgPipe = materialTrendChartData.reduce((sum, d) => sum + d.pipeKg, 0) / materialTrendChartData.length;
    const maxIntensityOrder = [...materialTrendChartData].sort((a, b) => b.pipePerRod - a.pipePerRod)[0];

    const hasSpike = materialTrendChartData.some(d => d.pipeKg > avgPipe * 1.15 && materialTrendChartData.length > 1);

    return {
      maxPipeOrder,
      avgPipe: Number(avgPipe.toFixed(1)),
      maxIntensityOrder,
      hasSpike,
    };
  }, [materialTrendChartData]);

  const handleExportBatchReport = () => {
    if (!currentBatch) return;

    const headers = [
      'Record Type',
      'Ref / Step',
      'Date / Spec',
      'Entity / Material',
      'Warehouse / Qty',
      'Consumption Drawn',
      'Cumulative Lot Tally',
      'Status / Total (PKR)'
    ];

    const rows: (string | number)[][] = [];

    // Part 1: Cumulative Raw Material Consumption & Live Stock Reconciliation
    rows.push([
      '=== PART 1: RAW MATERIAL USAGE ===',
      'RAW MATERIAL RECONCILIATION',
      'Unit',
      'Warehouse Category',
      'Live Available Stock',
      'Batch Draw (Consumed)',
      'Remaining Balance (Draw %)',
      'Stock Deduction Status'
    ]);

    for (const m of rawStockComparison) {
      const isWeight = m.unit === 'kg';
      const liveStr = isWeight ? `${m.liveStock.toFixed(1)} kg` : `${m.liveStock} pcs`;
      const consumedStr = isWeight ? `${m.consumed.toFixed(1)} kg` : `${m.consumed} pcs`;
      const remainStr = isWeight ? `${m.remainingAfterBatch.toFixed(1)} kg` : `${m.remainingAfterBatch} pcs`;

      rows.push([
        '[RAW MATERIAL]',
        m.materialName,
        m.unit,
        m.stockCategory,
        liveStr,
        `-${consumedStr}`,
        `${remainStr} (${m.utilizationRate.toFixed(1)}% lot draw)`,
        'Verified In Stock'
      ]);
    }

    // Part 2: Chronological Batch Orders Timeline
    rows.push([
      '=== PART 2: ORDER TIMELINE ===',
      'CHRONOLOGICAL PRODUCTION SEQUENCE',
      'Date & Time',
      'Factory / Workshop',
      'Finished Down Rods',
      'Order Material Draw',
      'Running Milestone Total',
      'Order Amount & Gate Pass'
    ]);

    for (const m of timelineMilestones) {
      const txn = m.transaction;
      const paidInfo = getPaidInfo(txn);
      const isDelivered = !!txn.receiptUrl;

      const orderMatStr = Object.entries(m.orderMaterials)
        .map(([k, v]) => {
          const shortName = k.replace('M.S. ', '').replace(' & Cotter Pin', '').replace(' & Canopy Rings', '');
          return `${shortName}: +${v.unit === 'kg' ? v.weightKg.toFixed(1) + 'kg' : v.pieces + 'pcs'}`;
        })
        .join(', ');

      const cumMatStr = Object.entries(m.cumulativeMaterials)
        .map(([k, v]) => {
          const u = v as { weightKg: number; pieces: number; unit: string };
          const shortName = k.replace('M.S. ', '').replace(' & Cotter Pin', '').replace(' & Canopy Rings', '');
          return `${shortName}: ${u.unit === 'kg' ? u.weightKg.toFixed(1) + 'kg' : u.pieces + 'pcs'}`;
        })
        .join(', ');

      rows.push([
        `Milestone #${m.milestoneIndex}`,
        `Order #${txn.id}`,
        `${txn.date} ${txn.time}`,
        txn.factory || 'Walk-in Customer',
        `${m.orderRods} rods (${txn.itemsSummary.replace(/\n/g, '; ')})`,
        `+${orderMatStr}`,
        `Cum: ${m.cumulativeRods} rods | ${cumMatStr}`,
        `${fmt(txn.total)} (${paidInfo.status} · ${isDelivered ? 'Pass Verified' : 'Awaiting Pass'})`
      ]);
    }

    const totalSteelPipe = currentBatch.materialsSummary['M.S. Steel Pipe']
      ? `${currentBatch.materialsSummary['M.S. Steel Pipe'].weightKg.toFixed(1)} kg`
      : `${(currentBatch.totalRods * 0.9).toFixed(1)} kg`;

    const summaryFooter = `BATCH PRODUCTION SUMMARY: Batch ${currentBatch.batchId} | ${currentBatch.totalRods} Total Down Rods | Aggregate Value: ${fmt(currentBatch.totalValue)} | Total Raw Steel Consumed: ${totalSteelPipe} | Orders Processed: ${currentBatch.transactions.length} | Workshops Served: ${Array.from(currentBatch.factories).join(', ') || 'Direct Factory Work'}`;

    openExportModal({
      title: `Batch Production & Material Usage Report — ${currentBatch.batchId}`,
      headers,
      rows,
      filename: `Batch_${currentBatch.batchId}_Material_and_Timeline_Report`,
      companyName,
      subtitle: `Production Lot ${currentBatch.batchId} • Cumulative Raw Stock Reconciliation & Chronological Order Timeline`,
      balanceFooterText: summaryFooter,
      defaultFormat: 'pdf',
      initialOrientation: 'landscape'
    });
  };

  const renderBatchDetailsSection = (txn: Transaction, isDelivered: boolean) => {
    const batchInfo = getBatchInfo(txn);
    const masterBatchCopied = copiedBatchText?.id === txn.id && copiedBatchText?.field === 'master_batch';
    const masterTrackingCopied = copiedBatchText?.id === txn.id && copiedBatchText?.field === 'master_tracking';
    const allCodesCopied = copiedBatchText?.id === txn.id && copiedBatchText?.field === 'all_codes';

    return (
      <div className="space-y-3.5 p-4 rounded-xl border border-amber-500/35 bg-[var(--panel-raised)]/95 shadow-sm font-mono text-xs">
        {/* Dossier Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--steel-line)] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Barcode size={16} />
            </div>
            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
                <span>Batch & Logistics Tracking Dossier</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Order #{txn.id}
                </span>
              </div>
              <div className="text-[10px] text-[var(--text-dim)]">
                Production Lot Serialization, Dispatch Tracking & Quality Clearance
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => jumpToBatchHistory(batchInfo.effectiveBatchId)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/50 text-[10px] font-bold transition cursor-pointer shadow-xs"
              title="Open full Batch History timeline & cumulative raw material usage"
            >
              <History size={11} />
              <span>Timeline & Material Usage</span>
              <ArrowRight size={11} />
            </button>
            <button
              type="button"
              onClick={() => {
                const text = `Order #${txn.id} | Batch: ${batchInfo.effectiveBatchId} | Tracking: ${batchInfo.effectiveTrackingNumber}`;
                handleCopyBatchText(text, txn.id, 'all_codes');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] hover:border-amber-500/50 text-[10px] text-[var(--text-dim)] hover:text-amber-300 transition cursor-pointer"
              title="Copy Master Batch & Tracking IDs"
            >
              {allCodesCopied ? (
                <>
                  <CheckCheck size={11} className="text-emerald-400" />
                  <span className="text-emerald-400 font-bold">All Copied</span>
                </>
              ) : (
                <>
                  <Copy size={11} />
                  <span>Copy Summary</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => toggleBatchDetails(txn.id)}
              className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition cursor-pointer"
              title="Hide Batch Details"
            >
              <ChevronUp size={14} />
            </button>
          </div>
        </div>

        {/* Highlight Key Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {/* Master Batch Card */}
          <div className="p-3 rounded-lg border border-amber-500/30 bg-[var(--panel)] shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)]">
              <span className="flex items-center gap-1 font-bold uppercase tracking-wider text-amber-400">
                <Tag size={12} />
                <span>Production Batch ID</span>
              </span>
              <button
                type="button"
                onClick={() => jumpToBatchHistory(batchInfo.effectiveBatchId)}
                className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 hover:bg-amber-500 hover:text-black text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1 transition cursor-pointer"
                title="View in Batch History Timeline"
              >
                <span>Timeline</span>
                <ArrowRight size={9} />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-bold text-sm text-[var(--yellow)] tracking-wider truncate">
                {batchInfo.effectiveBatchId}
              </span>
              <button
                type="button"
                onClick={() => handleCopyBatchText(batchInfo.effectiveBatchId, txn.id, 'master_batch')}
                className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--panel-raised)] hover:bg-amber-500/20 border border-[var(--steel-line)] hover:border-amber-500/40 text-[10px] text-[var(--text)] transition cursor-pointer shrink-0"
                title="Copy Batch ID"
              >
                {masterBatchCopied ? (
                  <>
                    <CheckCheck size={11} className="text-emerald-400" />
                    <span className="text-emerald-400 font-bold text-[9px]">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span className="text-[9px]">Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-[9px] text-[var(--text-dim)] flex items-center justify-between pt-0.5 border-t border-[var(--steel-line)]/40">
              <span>QA Spec: Industrial Down Rod</span>
              <span className="text-emerald-400 font-bold">✓ Tolerance OK</span>
            </div>
          </div>

          {/* Master Tracking Card */}
          <div className="p-3 rounded-lg border border-purple-500/30 bg-[var(--panel)] shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)]">
              <span className="flex items-center gap-1 font-bold uppercase tracking-wider text-purple-300">
                <Truck size={12} />
                <span>Logistics Tracking Number</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                Dispatch Ref
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-bold text-sm text-purple-200 tracking-wider truncate">
                {batchInfo.effectiveTrackingNumber}
              </span>
              <button
                type="button"
                onClick={() => handleCopyBatchText(batchInfo.effectiveTrackingNumber, txn.id, 'master_tracking')}
                className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--panel-raised)] hover:bg-purple-500/20 border border-[var(--steel-line)] hover:border-purple-500/40 text-[10px] text-[var(--text)] transition cursor-pointer shrink-0"
                title="Copy Tracking Number"
              >
                {masterTrackingCopied ? (
                  <>
                    <CheckCheck size={11} className="text-emerald-400" />
                    <span className="text-emerald-400 font-bold text-[9px]">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span className="text-[9px]">Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-[9px] text-[var(--text-dim)] flex items-center justify-between pt-0.5 border-t border-[var(--steel-line)]/40">
              <span>Vehicle: {txn.gatePass?.vehicleNo || 'Internal Fleet'}</span>
              <span className="text-purple-300 font-bold">{txn.gatePass?.driverName ? `Driver: ${txn.gatePass.driverName}` : 'Driver Assigned'}</span>
            </div>
          </div>

          {/* Clearance & Gate Pass Info */}
          <div className="p-3 rounded-lg border border-[var(--steel-line)] bg-[var(--panel)] shadow-xs space-y-1.5 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)]">
              <span className="flex items-center gap-1 font-bold uppercase tracking-wider text-[var(--text)]">
                <ShieldCheck size={12} className={isDelivered ? 'text-emerald-400' : 'text-amber-400'} />
                <span>Gate Clearance Status</span>
              </span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                isDelivered
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}>
                {isDelivered ? 'Cleared' : 'Awaiting'}
              </span>
            </div>
            <div className="text-xs font-bold text-[var(--text)] truncate">
              {txn.gateSequenceNo || txn.gatePass?.gateSequenceNo || (isDelivered ? 'Verified Gate Pass' : 'Pending Pass Upload')}
            </div>
            <div className="text-[9px] text-[var(--text-dim)] flex items-center justify-between pt-0.5 border-t border-[var(--steel-line)]/40">
              <span>Post: {txn.gatePost || 'Main Factory Gate 1'}</span>
              <span>Date: {txn.date}</span>
            </div>
          </div>
        </div>

        {/* Item-by-Item Breakdown Table with Line Batches & Tracking */}
        <div className="rounded-lg border border-[var(--steel-line)] bg-[var(--panel)] overflow-hidden">
          <div className="px-3 py-2 bg-[var(--panel-raised)] border-b border-[var(--steel-line)] flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] flex items-center gap-1.5">
              <Hash size={11} className="text-amber-400" />
              <span>Line Items Serialized Allocation ({batchInfo.itemsWithBatch.length} items)</span>
            </span>
            <span className="text-[10px] text-[var(--text-dim)]">
              Total Qty: <strong className="text-[var(--text)]">{txn.itemCount || 1} pcs</strong>
            </span>
          </div>
          <div className="overflow-x-auto max-w-full ledger-scroll-container">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead className="bg-[var(--panel-raised)]/60 text-[10px] uppercase text-[var(--text-dim)] border-b border-[var(--steel-line)]">
                <tr>
                  <th className="px-3 py-1.5 w-8">#</th>
                  <th className="px-3 py-1.5">Product & Specs</th>
                  <th className="px-3 py-1.5">Item Batch ID</th>
                  <th className="px-3 py-1.5">Item Tracking #</th>
                  <th className="px-3 py-1.5 text-right">Qty</th>
                  <th className="px-3 py-1.5 text-center">QC Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--steel-line)]/40">
                {batchInfo.itemsWithBatch.map((it, idx) => {
                  const lineBatchKey = `line_batch_${idx}`;
                  const lineTrkKey = `line_trk_${idx}`;
                  const isLineBatchCopied = copiedBatchText?.id === txn.id && copiedBatchText?.field === lineBatchKey;
                  const isLineTrkCopied = copiedBatchText?.id === txn.id && copiedBatchText?.field === lineTrkKey;

                  return (
                    <tr key={idx} className="hover:bg-[var(--panel-raised)]/40 transition">
                      <td className="px-3 py-2 text-[var(--text-dim)] text-[10px]">{idx + 1}</td>
                      <td className="px-3 py-2 font-bold text-[var(--text)] font-sans">
                        <div>{it.name}</div>
                        <div className="text-[10px] text-[var(--text-dim)] font-mono font-normal">
                          {[it.size || txn.sizes, it.color || txn.colors].filter(Boolean).join(' · ') || 'Standard spec'}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-mono">
                            {it.lineBatchId}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyBatchText(it.lineBatchId, txn.id, lineBatchKey)}
                            className="p-1 rounded text-[var(--text-dim)] hover:text-amber-300 hover:bg-[var(--panel-raised)] transition cursor-pointer"
                            title="Copy line batch ID"
                          >
                            {isLineBatchCopied ? (
                              <CheckCheck size={11} className="text-emerald-400" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-mono">
                            {it.lineTrackingNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyBatchText(it.lineTrackingNumber, txn.id, lineTrkKey)}
                            className="p-1 rounded text-[var(--text-dim)] hover:text-purple-300 hover:bg-[var(--panel-raised)] transition cursor-pointer"
                            title="Copy line tracking number"
                          >
                            {isLineTrkCopied ? (
                              <CheckCheck size={11} className="text-emerald-400" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-[var(--text)]">
                        {it.qty} pcs
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          PASS · VERIFIED
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 font-mono max-w-full overflow-x-clip">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3 font-sans">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif font-black text-xl text-[var(--text)] tracking-tight">
              {t('transactions_title')}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--yellow)]">
              {transactions.length} Total
            </span>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            Industrial Sales Orders, Production Booking & Gate Pass Dispatch Ledger
          </p>
        </div>

        {/* Global Toolbar & Export Controls */}
        <div className="flex items-center gap-2 flex-wrap font-mono">
          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)]">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[var(--yellow)] text-black shadow-xs'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
              title="Clean Structured Table View"
            >
              <List size={13} />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-[var(--yellow)] text-black shadow-xs'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
              title="Visual Cards View"
            >
              <LayoutGrid size={13} />
              <span>Cards</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsUnifiedReceiptsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-xs font-bold text-amber-400 hover:bg-amber-500 hover:text-black transition cursor-pointer shadow-xs"
            title="View Unified Gate Receipts & Sequential Registry"
          >
            <ShieldCheck size={13} />
            <span>Gate Registry</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--yellow)] transition cursor-pointer"
            title="Download CSV Spreadsheet"
          >
            <Download size={13} />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--yellow)] transition cursor-pointer"
            title="Download PDF Ledger"
          >
            <FileText size={13} />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportJPG}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--yellow)] transition cursor-pointer"
            title="Download High-Res JPG"
          >
            <ImageIcon size={13} />
            <span>JPG</span>
          </button>
        </div>
      </div>

      {/* Primary Tab Navigation: Orders Ledger vs Batch History */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-2 font-mono">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
          <button
            type="button"
            onClick={() => setActiveMainTab('orders')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold font-sans transition cursor-pointer ${
              activeMainTab === 'orders'
                ? 'bg-[var(--yellow)] text-black shadow-xs font-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <FileText size={14} />
            <span>Orders Ledger (آرڈرز رجسٹر)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeMainTab === 'orders' ? 'bg-black/20 text-black font-black' : 'bg-[var(--panel)] text-[var(--text-dim)]'
            }`}>
              {transactions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMainTab('batch_history');
              if (!selectedBatchId && batchList.length > 0) {
                setSelectedBatchId(batchList[0].batchId);
              }
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold font-sans transition cursor-pointer ${
              activeMainTab === 'batch_history'
                ? 'bg-[var(--yellow)] text-black shadow-xs font-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <History size={14} />
            <span>Batch History & Timeline (بیچ ہسٹری)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeMainTab === 'batch_history' ? 'bg-black/20 text-black font-black' : 'bg-amber-500/20 text-amber-400 font-bold'
            }`}>
              {batchList.length} Lots
            </span>
          </button>
        </div>

        {activeMainTab === 'batch_history' && currentBatch && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-[var(--text-dim)] text-[11px] hidden sm:inline">Active Production Batch:</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-400 font-bold">
              {currentBatch.batchId}
            </span>
            <span className="text-[var(--text-dim)]">
              ({currentBatch.transactions.length} {currentBatch.transactions.length === 1 ? 'order' : 'orders'} · {currentBatch.totalRods} rods)
            </span>
          </div>
        )}
      </div>

      {activeMainTab === 'orders' ? (
        <>
          {/* KPI Overview Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono">
        <div className="p-3 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-[var(--text-dim)]">Total Orders Booked</div>
            <div className="text-base font-bold text-[var(--text)] font-sans mt-0.5">
              {totalBookedCount} <span className="text-xs text-[var(--text-dim)] font-mono">orders</span>
            </div>
            <div className="text-[11px] text-[var(--yellow)] font-bold mt-0.5">{fmt(totalBookedValue)}</div>
          </div>
          <div className="p-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text-dim)]">
            <Package size={18} />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--panel)] border border-amber-500/30 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-amber-400">Awaiting Gate Pass</div>
            <div className="text-base font-bold text-amber-400 font-sans mt-0.5">
              {awaitingCount} <span className="text-xs text-[var(--text-dim)] font-mono">pending</span>
            </div>
            <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{fmt(awaitingValue)}</div>
          </div>
          <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <ShieldAlert size={18} />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--panel)] border border-red-500/30 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-red-400">Outstanding Balance</div>
            <div className="text-base font-bold text-red-400 font-sans mt-0.5">
              {fmt(totalDueValue)}
            </div>
            <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{unpaidCount} orders due</div>
          </div>
          <div className="p-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400">
            <DollarSign size={18} />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--panel)] border border-emerald-500/30 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-emerald-400">Gate Pass Cleared</div>
            <div className="text-base font-bold text-emerald-400 font-sans mt-0.5">
              {verifiedCount} <span className="text-xs text-[var(--text-dim)] font-mono">in sales</span>
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-0.5">Physical receipts verified</div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck size={18} />
          </div>
        </div>
      </div>

      {/* Professional Notification Strip for Pending Gate Passes */}
      {awaitingCount > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs font-sans">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              <Info size={15} />
            </div>
            <div>
              <span className="font-bold text-amber-400">Dispatch Audit Requirement: </span>
              <span className="text-[var(--text)] text-xs">
                {awaitingCount} {awaitingCount === 1 ? 'order requires' : 'orders require'} an uploaded delivery receipt (PDF/JPG) before final confirmation into sales.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'awaiting_gp' ? 'all' : 'awaiting_gp')}
            className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer bg-amber-500 text-black hover:bg-amber-400"
          >
            <span>{statusFilter === 'awaiting_gp' ? 'Show All Orders' : `Filter Pending (${awaitingCount})`}</span>
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        {/* Filter Pills */}
        <div className="flex items-center p-1 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[var(--yellow)] text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            All ({transactions.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('awaiting_gp')}
            className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'awaiting_gp'
                ? 'bg-amber-500 text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <Lock size={11} />
            <span>Awaiting Gate Pass</span>
            {awaitingCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusFilter === 'awaiting_gp' ? 'bg-black text-amber-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {awaitingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('with_gp')}
            className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'with_gp'
                ? 'bg-emerald-500 text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <ShieldCheck size={11} />
            <span>Gate Pass Solved</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              statusFilter === 'with_gp' ? 'bg-black text-emerald-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {verifiedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('unpaid')}
            className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
              statusFilter === 'unpaid'
                ? 'bg-[var(--yellow)] text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            Due / Unpaid ({unpaidCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('paid')}
            className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
              statusFilter === 'paid'
                ? 'bg-emerald-500 text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            Fully Paid
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t('search_orders') || 'Search order #, customer, item...'}
            className="pl-9 pr-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)] text-xs font-mono text-[var(--text)] focus:border-[var(--yellow)] focus:outline-none w-full sm:w-72"
          />
        </div>
      </div>

      {/* Main List / Table Content */}
      {filteredTxns.length === 0 ? (
        <div className="p-10 text-center text-[var(--text-dim)] bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl text-xs space-y-2">
          <Package size={28} className="mx-auto text-[var(--text-dim)] opacity-50 mb-1" />
          <div className="font-bold text-[var(--text)]">{t('no_orders_found')}</div>
          <div className="text-[11px]">No orders match the current search query or filter selection.</div>
        </div>
      ) : viewMode === 'table' ? (
        /* ==================== CLEAN STRUCTURED TABLE VIEW ==================== */
        <div className="space-y-1">
          {/* Mobile swipe hint */}
          <div className="sm:hidden flex items-center justify-between text-[10px] text-[var(--text-dim)] py-0.5 px-1">
            <span>← Swipe sideways to view full order ledger →</span>
          </div>
          <div className="rounded-xl border border-[var(--steel-line)] overflow-hidden bg-[var(--panel)] shadow-sm">
            <div className="overflow-x-auto max-w-full ledger-scroll-container">
              <table className="w-full text-left text-xs divide-y divide-[var(--steel-line)] font-mono min-w-[1100px]">
              <thead className="bg-[var(--panel-raised)] text-[10px] uppercase font-bold text-[var(--text-dim)] tracking-wider">
                <tr>
                  <th className="px-3 py-3 w-8 text-center shrink-0"></th>
                  <th className="px-3 py-3 whitespace-nowrap w-24">Order ID</th>
                  <th className="px-3 py-3 whitespace-nowrap w-28">Date & Time</th>
                  <th className="px-3 py-3 min-w-[190px]">Customer / Workshop</th>
                  <th className="px-3 py-3 min-w-[280px]">Items Booked</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap w-28">Total Amount</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap w-24">Payment</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap w-32">Gate Pass</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap min-w-[220px]">Actions & Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--steel-line)]/60">
                {filteredTxns.map(txn => {
                  const info = getPaidInfo(txn);
                  const isDelivered = !!txn.receiptUrl;
                  const isPdf =
                    txn.gatePass?.fileType === 'pdf' ||
                    txn.receiptUrl?.startsWith('data:application/pdf') ||
                    txn.gatePass?.fileName?.toLowerCase().endsWith('.pdf');
                  const isExpanded = expandedRowId === txn.id;
                  const isBatchExpanded = expandedBatchRowIds.has(txn.id);
                  const parsedItems = parseTransactionItems(txn);

                  return (
                    <React.Fragment key={txn.id}>
                      <tr className={`hover:bg-[var(--panel-raised)]/70 transition ${
                        isExpanded || isBatchExpanded ? 'bg-[var(--panel-raised)]/50' : ''
                      }`}>
                        {/* Expand toggle */}
                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleRowExpand(txn.id)}
                            className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer"
                            title="Toggle quick item breakdown"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>

                        {/* Order ID */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setInspectOrderTxn(txn)}
                            className="font-bold text-[var(--yellow)] hover:underline flex items-center gap-1 cursor-pointer"
                            title="Click to check all details"
                          >
                            <span>#{txn.id}</span>
                            {txn.confirmed && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Confirmed in sales" />
                            )}
                          </button>
                        </td>

                        {/* Date & Time */}
                        <td className="px-3 py-3 whitespace-nowrap text-[var(--text-dim)] text-[11px]">
                          <div>{txn.date}</div>
                          <div className="text-[10px] opacity-75">{txn.time}</div>
                        </td>

                        {/* Customer / Workshop */}
                        <td className="px-3 py-3 min-w-[190px]">
                          <div className="flex flex-col justify-center gap-0.5 min-w-0">
                            <div className="font-bold text-xs text-[var(--text)] font-sans truncate max-w-[190px]" title={txn.factory || 'Walk-in Customer'}>
                              {txn.factory || 'Walk-in Customer'}
                            </div>
                            {(() => {
                              const specChips = [
                                txn.sizes?.split(/[,;]/).map(s => s.trim()).filter(s => s && s !== '-' && s !== '—').join(', '),
                                txn.colors?.split(/[,;]/).map(s => s.trim()).filter(s => s && s !== '-' && s !== '—').join(', ')
                              ].filter(Boolean);
                              return specChips.length > 0 ? (
                                <div className="text-[10px] text-[var(--text-dim)] truncate max-w-[200px]">
                                  {specChips.join(' · ')}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </td>

                        {/* Items Booked */}
                        <td className="px-3 py-3 min-w-[280px]">
                          <div className="txn-item-summary-container max-w-[340px]">
                            <div className="txn-item-summary-text text-xs" title={txn.itemsSummary}>
                              {txn.itemsSummary}
                            </div>
                            <div className="txn-item-summary-meta">
                              <span className="shrink-0 font-medium">
                                {parsedItems.length} {parsedItems.length === 1 ? 'item' : 'items'} ({txn.itemCount || 1} pcs)
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleBatchDetails(txn.id);
                                }}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer border whitespace-nowrap shrink-0 ${
                                  isBatchExpanded
                                    ? 'bg-amber-500/25 text-amber-300 border-amber-500/60 shadow-xs'
                                    : 'bg-[var(--panel-raised)] text-[var(--text-dim)] hover:text-amber-300 hover:border-amber-500/40 border-[var(--steel-line)]'
                                }`}
                                title="Expand Batch Details & Logistics Tracking"
                              >
                                <Barcode size={11} className={isBatchExpanded ? 'text-amber-400' : 'text-[var(--text-dim)]'} />
                                <span className="whitespace-nowrap">{isBatchExpanded ? 'Hide Batch' : 'Batch Details'}</span>
                                {isBatchExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const bId = txn.batchId || getBatchInfo(txn).effectiveBatchId;
                                  jumpToBatchHistory(bId);
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer border whitespace-nowrap shrink-0 bg-amber-500/15 text-amber-300 hover:bg-amber-500 hover:text-black border-amber-500/40"
                                title="Open this batch in Batch History Timeline"
                              >
                                <History size={10} />
                                <span className="whitespace-nowrap">Timeline</span>
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Total Amount */}
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="font-bold text-[var(--yellow)]">{fmt(txn.total)}</div>
                          {info.due > 0 && (
                            <div className="text-[10px] text-red-400 font-bold">Due: {fmt(info.due)}</div>
                          )}
                        </td>

                        {/* Payment Status */}
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            <span className={`txn-status-badge ${
                              info.status === 'Paid'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : info.status === 'Partial'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-red-500/15 text-red-400 border-red-500/30'
                            }`}>
                              {info.status}
                            </span>
                          </div>
                        </td>

                        {/* Gate Pass Status */}
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            {isDelivered ? (
                              <div className="txn-status-badge txn-status-badge-lg bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                                <ShieldCheck size={11} strokeWidth={2.5} className="shrink-0" />
                                <span className="truncate max-w-[80px]" title={txn.gateSequenceNo || txn.gatePass?.gateSequenceNo || 'Verified'}>
                                  {txn.gateSequenceNo || txn.gatePass?.gateSequenceNo || 'Verified'}
                                </span>
                              </div>
                            ) : (
                              <span className="txn-status-badge txn-status-badge-lg bg-amber-500/15 text-amber-400 border-amber-500/30">
                                <Lock size={10} className="shrink-0" />
                                <span>Awaiting Pass</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions & Dossier */}
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Primary workflow button */}
                            {!isDelivered ? (
                              <button
                                type="button"
                                onClick={() => setUploadGatePassTxn(txn)}
                                className="px-2.5 py-1 rounded bg-amber-500 text-black font-bold text-[10px] uppercase hover:bg-amber-400 transition cursor-pointer flex items-center gap-1 shadow-xs"
                                title="Upload Gate Pass receipt"
                              >
                                <UploadCloud size={11} strokeWidth={2.5} />
                                <span>Pass</span>
                              </button>
                            ) : !txn.confirmed ? (
                              <button
                                type="button"
                                onClick={() => onConfirmOrder(txn.id)}
                                className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold text-[10px] uppercase hover:bg-emerald-500 hover:text-black transition cursor-pointer flex items-center gap-1"
                                title="Confirm into sales ledger"
                              >
                                <Check size={11} strokeWidth={2.5} />
                                <span>Confirm</span>
                              </button>
                            ) : null}

                            {/* Pay button if due */}
                            {info.due > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenPayModal(txn)}
                                className="px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] uppercase hover:bg-emerald-500 hover:text-black transition cursor-pointer flex items-center gap-1"
                                title={`Record Payment (Due: ${fmt(info.due)})`}
                              >
                                <CreditCard size={11} />
                                <span>Pay</span>
                              </button>
                            )}

                            {/* Check All Details button */}
                            <button
                              type="button"
                              onClick={() => setInspectOrderTxn(txn)}
                              className="px-2 py-1 rounded bg-[var(--yellow)]/15 border border-[var(--yellow)] text-[var(--yellow)] font-bold text-[10px] uppercase hover:bg-[var(--yellow)] hover:text-black transition cursor-pointer flex items-center gap-1"
                              title="Check complete order details dossier"
                            >
                              <Eye size={11} />
                              <span>Details</span>
                            </button>

                            {/* Print / Export Icons Group */}
                            <div className="flex items-center border border-[var(--steel-line)] rounded bg-[var(--panel-raised)] overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setSelectedPdfTxn(txn)}
                                className="p-1 hover:bg-[var(--panel)] text-[var(--text-dim)] hover:text-[var(--text)] transition"
                                title="Invoice PDF"
                              >
                                <FileText size={11} />
                              </button>
                              <button
                                type="button"
                                disabled={exportingJpgId === txn.id}
                                onClick={async () => {
                                  try {
                                    setExportingJpgId(txn.id);
                                    await exportSingleTransactionJPG({
                                      transaction: txn,
                                      customerPayments,
                                      companyName
                                    });
                                  } catch (err) {
                                    console.error('Failed to export JPG invoice', err);
                                  } finally {
                                    setExportingJpgId(null);
                                  }
                                }}
                                className="p-1 hover:bg-[var(--panel)] text-[var(--text-dim)] hover:text-[var(--text)] transition disabled:opacity-50"
                                title="Invoice JPG"
                              >
                                <ImageIcon size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => printThermalReceiptDocument({ transaction: txn, customerPayments, companyName })}
                                className="p-1 hover:bg-[var(--panel)] text-[var(--text-dim)] hover:text-[var(--text)] transition"
                                title="Thermal Print"
                              >
                                <Printer size={11} />
                              </button>
                            </div>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => onDeleteTransaction(txn.id)}
                              className="p-1 rounded text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 transition"
                              title="Delete transaction"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Dedicated Expand Batch Details Row */}
                      {isBatchExpanded && (
                        <tr className="bg-[var(--panel-raised)]/60">
                          <td colSpan={9} className="px-4 py-3 border-b border-[var(--steel-line)] border-l-4 border-l-amber-500">
                            {renderBatchDetailsSection(txn, isDelivered)}
                          </td>
                        </tr>
                      )}

                      {/* Expandable Row Content: Quick breakdown */}
                      {isExpanded && (
                        <tr className="bg-[var(--panel-raised)]/40">
                          <td colSpan={9} className="px-6 py-4 border-b border-[var(--steel-line)]">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--steel-line)]/50 pb-2">
                                <span className="font-bold text-xs uppercase text-[var(--text)] flex items-center gap-2">
                                  <Package size={13} className="text-[var(--yellow)]" />
                                  <span>Order #{txn.id} — Full Items Breakdown</span>
                                </span>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleBatchDetails(txn.id)}
                                    className={`text-xs font-bold flex items-center gap-1 cursor-pointer transition ${
                                      isBatchExpanded ? 'text-amber-300' : 'text-amber-400/90 hover:text-amber-300'
                                    }`}
                                  >
                                    <Barcode size={12} />
                                    <span>{isBatchExpanded ? 'Hide Batch Details' : 'Expand Batch Details'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setInspectOrderTxn(txn)}
                                    className="text-xs font-bold text-[var(--yellow)] hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>Open Comprehensive Dossier</span>
                                    <ExternalLink size={12} />
                                  </button>
                                </div>
                              </div>

                              {/* Nested items table */}
                              <div className="rounded-lg border border-[var(--steel-line)] bg-[var(--panel)] overflow-x-auto max-w-full ledger-scroll-container">
                                <table className="w-full text-left text-xs min-w-[480px]">
                                  <thead className="bg-[var(--panel-raised)] text-[10px] uppercase text-[var(--text-dim)] border-b border-[var(--steel-line)]">
                                    <tr>
                                      <th className="px-3 py-1.5">Item</th>
                                      <th className="px-3 py-1.5">Specs (Size / Color)</th>
                                      <th className="px-3 py-1.5 text-right">Quantity</th>
                                      <th className="px-3 py-1.5 text-right">Rate</th>
                                      <th className="px-3 py-1.5 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[var(--steel-line)]/40">
                                    {parsedItems.map((it, idx) => (
                                      <tr key={idx}>
                                        <td className="px-3 py-1.5 font-bold text-[var(--text)] font-sans">
                                          <div>{it.name}</div>
                                          {(it.batchId || it.trackingNumber) && (
                                            <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-mono font-normal">
                                              {it.batchId && (
                                                <span className="px-1 py-0.2 rounded bg-[var(--yellow)]/10 text-[var(--yellow)] border border-[var(--yellow)]/20">
                                                  Batch: {it.batchId}
                                                </span>
                                              )}
                                              {it.trackingNumber && (
                                                <span className="px-1 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                                  Trk: {it.trackingNumber}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-3 py-1.5 text-[var(--text-dim)]">
                                          {[it.size || txn.sizes, it.color || txn.colors].filter(Boolean).join(' · ') || '—'}
                                        </td>
                                        <td className="px-3 py-1.5 text-right text-[var(--text)]">{it.qty} pcs</td>
                                        <td className="px-3 py-1.5 text-right text-[var(--text-dim)]">{fmt(it.rate)}</td>
                                        <td className="px-3 py-1.5 text-right font-bold text-[var(--yellow)]">{fmt(it.total)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* Footer details row */}
                              <div className="flex flex-wrap items-center justify-between text-[11px] text-[var(--text-dim)] pt-1">
                                <div className="flex items-center gap-3">
                                  <span>Customer: <strong className="text-[var(--text)]">{txn.factory || 'Walk-in'}</strong></span>
                                  <span>·</span>
                                  <span>Total Paid: <strong className="text-emerald-400">{fmt(info.amountPaid)}</strong></span>
                                  <span>·</span>
                                  <span>Due: <strong className={info.due > 0 ? 'text-red-400' : 'text-emerald-400'}>{fmt(info.due)}</strong></span>
                                </div>
                                {isDelivered && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-emerald-400 font-bold">Gate Pass: {txn.gateSequenceNo || 'Verified'}</span>
                                    <button
                                      type="button"
                                      onClick={() => setViewGatePassTxn(txn)}
                                      className="text-[10px] text-[var(--yellow)] underline hover:opacity-80 cursor-pointer"
                                    >
                                      View Document
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-[var(--panel-raised)] font-bold text-xs divide-y divide-[var(--steel-line)] border-t-2 border-[var(--yellow)]">
                <tr className="bg-[var(--panel-raised)] text-[var(--text)]">
                  <td className="px-2 py-3 text-center text-[var(--yellow)] font-bold text-sm">Σ</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="font-black text-[var(--yellow)] text-xs">
                      {dynamicSummary.totalOrders} {dynamicSummary.totalOrders === 1 ? 'Order' : 'Orders'}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-[10px] text-[var(--text-dim)] font-normal">
                    {dynamicSummary.isFiltered ? `Filtered (${dynamicSummary.allOrdersCount} total)` : 'All Records'}
                  </td>
                  <td className="px-3 py-3 text-[11px] text-[var(--text-dim)] font-semibold truncate max-w-[190px]">
                    Ledger Aggregate
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="font-bold text-[var(--text)] text-xs">
                      {dynamicSummary.totalQty.toLocaleString()} pcs
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap text-sm font-black text-[var(--yellow)]">
                    {fmt(dynamicSummary.aggregateValue)}
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <div className="flex flex-col items-center justify-center text-[10px] leading-tight">
                      <span className="text-emerald-400 font-bold">Paid: {fmt(dynamicSummary.totalPaid)}</span>
                      {dynamicSummary.totalDue > 0 ? (
                        <span className="text-red-400 font-bold">Due: {fmt(dynamicSummary.totalDue)}</span>
                      ) : (
                        <span className="text-emerald-400/70 text-[9px]">Fully Settled</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap text-[10px]">
                    <span className="text-emerald-400 font-bold">{dynamicSummary.deliveredCount} Cleared</span>
                    {dynamicSummary.pendingPassCount > 0 && (
                      <span className="text-amber-400 font-bold block text-[9px]">{dynamicSummary.pendingPassCount} Pass Pending</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap text-[10px] text-[var(--text-dim)]">
                    Aggregate Ledger
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    ) : (
        /* ==================== REFINED VISUAL CARDS VIEW ==================== */
        <div className="space-y-3 font-mono">
          {filteredTxns.map(txn => {
            const info = getPaidInfo(txn);
            const isDelivered = !!txn.receiptUrl;
            const isPdf =
              txn.gatePass?.fileType === 'pdf' ||
              txn.receiptUrl?.startsWith('data:application/pdf') ||
              txn.gatePass?.fileName?.toLowerCase().endsWith('.pdf');
            const isBatchExpanded = expandedBatchRowIds.has(txn.id);
            const parsedItems = parseTransactionItems(txn);

            return (
              <div
                key={txn.id}
                id={`txn-card-${txn.id}`}
                className={`p-4 rounded-xl transition space-y-3 text-xs bg-[var(--panel)] border ${
                  !isDelivered
                    ? 'border-amber-500/40 hover:border-amber-400/80 shadow-xs'
                    : 'border-[var(--steel-line)] hover:border-[var(--yellow)]'
                }`}
              >
                {/* Card Top Row: Order ID, Date, Status Chips */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--steel-line)]/60 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setInspectOrderTxn(txn)}
                      className="font-black text-base text-[var(--yellow)] hover:underline cursor-pointer flex items-center gap-1"
                      title="Inspect complete order details"
                    >
                      <span>#{txn.id}</span>
                    </button>
                    <span className="text-[var(--text-dim)] text-[11px] flex items-center gap-1.5">
                      <Clock size={11} />
                      <span>{txn.date} · {txn.time}</span>
                    </span>
                    {txn.confirmed ? (
                      <span className="txn-status-badge bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                        <Check size={10} strokeWidth={2.5} /> In Sales
                      </span>
                    ) : (
                      <span className="txn-status-badge bg-amber-500/15 text-amber-400 border-amber-500/30">
                        Pending
                      </span>
                    )}
                  </div>

                  {/* Dispatch / Gate Pass Status Pill */}
                  <div>
                    {isDelivered ? (
                      <div className="flex items-center gap-1.5">
                        <span className="txn-status-badge txn-status-badge-lg bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                          <ShieldCheck size={11} strokeWidth={2.5} />
                          <span className="truncate max-w-[90px]" title={txn.gateSequenceNo || txn.gatePass?.gateSequenceNo || 'Verified'}>
                            {txn.gateSequenceNo || txn.gatePass?.gateSequenceNo || 'Verified'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setViewGatePassTxn(txn)}
                          className="px-2 h-6 inline-flex items-center justify-center rounded text-[10px] font-bold uppercase border bg-[var(--panel-raised)] text-[var(--text)] hover:border-[var(--yellow)] transition cursor-pointer shrink-0"
                          title="View attached gate pass"
                        >
                          {isPdf ? 'PDF' : 'JPG'}
                        </button>
                      </div>
                    ) : (
                      <span className="txn-status-badge txn-status-badge-lg bg-amber-500/15 text-amber-400 border-amber-500/30">
                        <Lock size={10} />
                        <span>Awaiting Pass</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Middle: Customer, Items Summary, Pricing */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-start md:items-center gap-3">
                  {/* Left: Customer & Items */}
                  <div className="txn-item-summary-container">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[var(--text)] font-sans truncate max-w-[280px]">
                        {txn.factory || 'Walk-in Customer'}
                      </span>
                      {txn.factory && (
                        <span className="px-1.5 py-0.5 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--yellow)] text-[10px] font-bold shrink-0">
                          Workshop
                        </span>
                      )}
                    </div>
                    <div className="txn-item-summary-text text-xs" title={txn.itemsSummary}>
                      {txn.itemsSummary}
                    </div>
                    <div className="txn-item-summary-meta">
                      <span className="shrink-0 font-medium">
                        {parsedItems.length} {parsedItems.length === 1 ? 'item' : 'items'} ({txn.itemCount || 1} pcs)
                      </span>
                      {(() => {
                        const cleanSizes = txn.sizes?.split(/[,;]/).map(s => s.trim()).filter(s => s && s !== '-' && s !== '—').join(', ');
                        const cleanColors = txn.colors?.split(/[,;]/).map(s => s.trim()).filter(s => s && s !== '-' && s !== '—').join(', ');
                        const specChips = [cleanSizes && `Size: ${cleanSizes}`, cleanColors && `Color: ${cleanColors}`].filter(Boolean);
                        return specChips.length > 0 ? (
                          <>
                            <span>·</span>
                            <span className="truncate">{specChips.join(' | ')}</span>
                          </>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* Right: Total & Balance Due */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-[var(--steel-line)]/40">
                    <div className="font-black text-lg text-[var(--yellow)] whitespace-nowrap">{fmt(txn.total)}</div>
                    <div className="flex items-center gap-1.5">
                      <span className={`txn-status-badge min-w-[95px] ${
                        info.status === 'Paid'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : info.status === 'Partial'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-red-500/15 text-red-400 border-red-500/30'
                      }`}>
                        {info.status === 'Paid' ? 'Paid in Full' : info.status === 'Partial' ? `Partial (${fmt(info.due)})` : `Due: ${fmt(info.due)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Clean Structured Actions Group */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--steel-line)]/50">
                  {/* Left: Details and Batch Toggle */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setInspectOrderTxn(txn)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--yellow)]/15 border border-[var(--yellow)] text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-black font-bold text-xs uppercase transition cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>Check All Details</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleBatchDetails(txn.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold uppercase transition cursor-pointer ${
                        isBatchExpanded
                          ? 'bg-amber-500/25 border-amber-500/70 text-amber-300 shadow-xs'
                          : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-amber-300 hover:border-amber-500/40'
                      }`}
                      title="Expand Batch Details & Tracking Info"
                    >
                      <Barcode size={13} className={isBatchExpanded ? 'text-amber-400' : 'text-[var(--text-dim)]'} />
                      <span>{isBatchExpanded ? 'Hide Batch' : 'Expand Batch Details'}</span>
                      {isBatchExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const bId = txn.batchId || getBatchInfo(txn).effectiveBatchId;
                        jumpToBatchHistory(bId);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold uppercase transition cursor-pointer bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500 hover:text-black"
                      title="Open this batch in Batch History Timeline"
                    >
                      <History size={13} />
                      <span>Timeline</span>
                    </button>
                  </div>

                  {/* Right: Operational Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Gate Pass action */}
                    {!isDelivered ? (
                      <button
                        type="button"
                        onClick={() => setUploadGatePassTxn(txn)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 text-black font-black text-[10px] uppercase hover:bg-amber-400 transition cursor-pointer shadow-xs"
                        title="Upload Gate Pass receipt"
                      >
                        <UploadCloud size={12} strokeWidth={2.5} />
                        <span>Upload Pass</span>
                      </button>
                    ) : !txn.confirmed ? (
                      <button
                        type="button"
                        onClick={() => onConfirmOrder(txn.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500 font-bold text-[10px] uppercase hover:bg-emerald-500 hover:text-black transition cursor-pointer"
                      >
                        <Check size={11} strokeWidth={2.5} />
                        <span>Confirm Order</span>
                      </button>
                    ) : null}

                    {/* Pay button */}
                    {info.due > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenPayModal(txn)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500 text-emerald-400 font-bold text-[10px] uppercase hover:bg-emerald-500 hover:text-black transition cursor-pointer"
                      >
                        <CreditCard size={11} />
                        <span>Pay</span>
                      </button>
                    )}

                    {/* Docs Group */}
                    <div className="flex items-center border border-[var(--steel-line)] rounded-lg bg-[var(--panel-raised)] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setSelectedPdfTxn(txn)}
                        className="px-2 py-1.5 text-[10px] font-bold text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition flex items-center gap-1"
                        title="Invoice PDF"
                      >
                        <FileText size={11} />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        disabled={exportingJpgId === txn.id}
                        onClick={async () => {
                          try {
                            setExportingJpgId(txn.id);
                            await exportSingleTransactionJPG({
                              transaction: txn,
                              customerPayments,
                              companyName
                            });
                          } catch (err) {
                            console.error('Failed to export JPG invoice', err);
                          } finally {
                            setExportingJpgId(null);
                          }
                        }}
                        className="px-2 py-1.5 text-[10px] font-bold text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition flex items-center gap-1 disabled:opacity-50"
                        title="Invoice JPG"
                      >
                        <ImageIcon size={11} />
                        <span>JPG</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => printThermalReceiptDocument({ transaction: txn, customerPayments, companyName })}
                        className="p-1.5 text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition"
                        title="Thermal Print"
                      >
                        <Printer size={12} />
                      </button>
                    </div>

                    {/* Nil button if due */}
                    {info.due > 0 && (
                      <button
                        type="button"
                        onClick={() => onNilOrder(txn.id)}
                        className="px-2 py-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-red-400 text-[10px] font-bold uppercase transition"
                        title="Write off balance"
                      >
                        Nil
                      </button>
                    )}

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => onDeleteTransaction(txn.id)}
                      className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-red-400 hover:border-red-400 transition"
                      title="Delete order"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Expand Batch Details Section for Card View */}
                {isBatchExpanded && (
                  <div className="pt-2 border-t border-[var(--steel-line)]/50">
                    {renderBatchDetailsSection(txn, isDelivered)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* STICKY BOTTOM SUMMARY ROW — Dynamically calculates Total Orders and Aggregate Value */}
      {filteredTxns.length > 0 && (
        <div className="sticky bottom-2 z-20 mt-3 pt-1">
          <div className="rounded-xl border-2 border-[var(--yellow)]/60 bg-[var(--panel-raised)]/95 backdrop-blur-md shadow-2xl p-3 sm:px-4 sm:py-3 transition-all duration-200">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
              {/* Left: Total Orders & Pieces Breakdown */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-[var(--yellow)] text-black font-black flex items-center justify-center shrink-0 shadow-sm">
                  <Calculator size={18} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs uppercase text-[var(--text-dim)] tracking-wider">
                      Ledger Summary
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--panel)] border border-[var(--steel-line)] text-xs font-bold text-[var(--text)]">
                      {dynamicSummary.totalOrders} {dynamicSummary.totalOrders === 1 ? 'Order' : 'Orders'}
                    </span>
                    {dynamicSummary.isFiltered && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Filtered ({dynamicSummary.allOrdersCount} total)
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)] mt-0.5 flex items-center gap-2">
                    <span>Total Quantity: <strong className="text-[var(--text)]">{dynamicSummary.totalQty.toLocaleString()} pcs</strong></span>
                    <span>·</span>
                    <span className="text-emerald-400 font-semibold">{dynamicSummary.deliveredCount} Cleared</span>
                    {dynamicSummary.pendingPassCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-amber-400 font-semibold">{dynamicSummary.pendingPassCount} Pass Pending</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Aggregate Value & Financial Balance Badges */}
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--steel-line)]/50">
                {/* Collected / Paid */}
                <div className="text-left sm:text-right">
                  <div className="text-[10px] uppercase font-bold text-[var(--text-dim)]">Collected</div>
                  <div className="text-xs sm:text-sm font-bold text-emerald-400">{fmt(dynamicSummary.totalPaid)}</div>
                </div>

                {/* Balance Due */}
                <div className="text-left sm:text-right">
                  <div className="text-[10px] uppercase font-bold text-[var(--text-dim)]">Balance Due</div>
                  <div className={`text-xs sm:text-sm font-bold ${dynamicSummary.totalDue > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {fmt(dynamicSummary.totalDue)}
                  </div>
                </div>

                {/* Aggregate Value (Primary Highlight) */}
                <div className="pl-3 border-l border-[var(--steel-line)] text-right">
                  <div className="text-[10px] uppercase font-black tracking-wider text-[var(--yellow)]">Aggregate Value</div>
                  <div className="text-base sm:text-lg font-black text-[var(--yellow)] tracking-tight">
                    {fmt(dynamicSummary.aggregateValue)}
                  </div>
                </div>

                {/* Reset filter shortcut if filtered */}
                {dynamicSummary.isFiltered && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                    }}
                    className="hidden lg:flex items-center gap-1 px-2 py-1 rounded bg-[var(--panel)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[10px] font-bold text-[var(--text-dim)] hover:text-[var(--yellow)] transition cursor-pointer"
                    title="Reset search and filters to view all orders"
                  >
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </>
    ) : (
      /* DEDICATED BATCH HISTORY & PRODUCTION LOT TIMELINE TAB */
      <div className="space-y-4">
        {/* Batch Selector & Filter Carousel Bar */}
        <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] space-y-3 font-mono">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Boxes size={18} />
              </div>
              <div>
                <h3 className="font-serif font-bold text-sm text-[var(--text)] flex items-center gap-2 font-sans">
                  <span>Select Production Batch / Lot</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                    {filteredBatches.length} of {batchList.length} Lots
                  </span>
                </h3>
                <p className="text-[11px] text-[var(--text-dim)] font-mono">
                  Audit production sequence, factory dispatches, and cumulative raw material impact
                </p>
              </div>
            </div>

            {/* Batch Search Input */}
            <div className="relative w-full sm:w-64">
              <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--text-dim)]" />
              <input
                type="text"
                placeholder="Filter by Batch ID, Workshop..."
                value={batchSearchTerm}
                onChange={e => setBatchSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {/* Batch Chips Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
            {filteredBatches.length === 0 ? (
              <div className="text-xs text-[var(--text-dim)] py-2 italic">
                No batches found matching "{batchSearchTerm}".
              </div>
            ) : (
              filteredBatches.map(b => {
                const isSelected = (currentBatch?.batchId === b.batchId);
                return (
                  <button
                    key={b.batchId}
                    type="button"
                    onClick={() => setSelectedBatchId(b.batchId)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-mono transition cursor-pointer shrink-0 border ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm ring-1 ring-amber-500/50'
                        : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-amber-500/40'
                    }`}
                  >
                    <Tag size={13} className={isSelected ? 'text-amber-400' : 'text-[var(--text-dim)]'} />
                    <div className="text-left">
                      <div className="font-bold tracking-wider">{b.batchId}</div>
                      <div className="text-[10px] opacity-80 flex items-center gap-1.5">
                        <span>{b.transactions.length} {b.transactions.length === 1 ? 'order' : 'orders'}</span>
                        <span>•</span>
                        <span>{b.totalRods} rods</span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check size={12} className="text-amber-400 ml-1 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {currentBatch ? (
          <div className="space-y-4">
            {/* Batch Master Dossier Banner */}
            <div className="p-4 sm:p-5 rounded-xl bg-[var(--panel)] border border-amber-500/40 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--steel-line)] pb-3.5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase tracking-wider">
                      Production Lot Dossier
                    </span>
                    <h2 className="font-mono font-black text-lg sm:text-xl text-[var(--yellow)] tracking-wider">
                      {currentBatch.batchId}
                    </h2>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase">
                      <CheckCircle2 size={11} />
                      <span>Quality Cleared</span>
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-dim)] flex items-center gap-2 flex-wrap font-sans">
                    <span className="flex items-center gap-1">
                      <Calendar size={13} />
                      <span>Lot Period: <strong className="text-[var(--text)] font-mono">{currentBatch.startDate}</strong> {currentBatch.startDate !== currentBatch.endDate && <>to <strong className="text-[var(--text)] font-mono">{currentBatch.endDate}</strong></>}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Factory size={13} />
                      <span>Workshops: <strong className="text-[var(--text)]">{Array.from(currentBatch.factories).join(', ') || 'Direct Factory Work'}</strong></span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono flex-wrap">
                  <button
                    type="button"
                    onClick={handleExportBatchReport}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--yellow)] hover:bg-[var(--yellow)]/90 text-black font-bold text-xs uppercase transition cursor-pointer shadow-xs"
                    title="Generate PDF summary of batch material usage and order timeline using the Export Studio"
                  >
                    <Download size={13} strokeWidth={2.5} />
                    <span>Export Batch Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMainTab('orders')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer"
                    title="Return to Orders Ledger"
                  >
                    <FileText size={13} />
                    <span>View Orders Ledger</span>
                  </button>
                </div>
              </div>

              {/* Batch High-Impact KPI Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
                <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                  <div className="text-[10px] uppercase text-[var(--text-dim)] flex items-center justify-between">
                    <span>Orders Processed</span>
                    <Package size={13} className="text-amber-400" />
                  </div>
                  <div className="text-lg font-bold text-[var(--text)] font-sans">
                    {currentBatch.transactions.length} <span className="text-xs text-[var(--text-dim)] font-mono">orders</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)]">
                    {currentBatch.transactions.filter(t => !!t.receiptUrl).length} cleared with Gate Pass
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-amber-500/30 space-y-1">
                  <div className="text-[10px] uppercase text-amber-400 flex items-center justify-between">
                    <span>Total Down Rods</span>
                    <Layers size={13} className="text-amber-400" />
                  </div>
                  <div className="text-lg font-bold text-amber-400 font-sans">
                    {currentBatch.totalRods} <span className="text-xs text-[var(--text-dim)] font-mono">pcs</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)]">
                    Precision cut & punched output
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1">
                  <div className="text-[10px] uppercase text-[var(--text-dim)] flex items-center justify-between">
                    <span>Aggregate Lot Value</span>
                    <DollarSign size={13} className="text-[var(--yellow)]" />
                  </div>
                  <div className="text-lg font-bold text-[var(--yellow)] font-mono">
                    {fmt(currentBatch.totalValue)}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)]">
                    Avg {fmt(Math.round(currentBatch.totalValue / (currentBatch.totalRods || 1)))}/rod
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-blue-500/30 space-y-1">
                  <div className="text-[10px] uppercase text-blue-400 flex items-center justify-between">
                    <span>Raw Steel Consumed</span>
                    <Scale size={13} className="text-blue-400" />
                  </div>
                  <div className="text-lg font-bold text-blue-300 font-mono">
                    {currentBatch.materialsSummary['M.S. Steel Pipe']
                      ? `${currentBatch.materialsSummary['M.S. Steel Pipe'].weightKg.toFixed(1)} kg`
                      : `${(currentBatch.totalRods * 0.9).toFixed(1)} kg`}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)]">
                    Drawn from Gujranwala M.S. coil stock
                  </div>
                </div>
              </div>
            </div>

            {/* CORE SECTION: Cumulative Material Usage from Raw Stock */}
            <div className="p-4 sm:p-5 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] space-y-4 font-mono">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--steel-line)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
                    <Scale size={18} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-[var(--text)] flex items-center gap-2 font-sans">
                      <span>Cumulative Material Usage from Raw Stock</span>
                      <span className="text-xs font-normal text-amber-400/90 font-serif">
                        (خام مال کی کل کھپت و دستیاب بیلنس)
                      </span>
                    </h3>
                    <p className="text-xs text-[var(--text-dim)] font-sans">
                      Dynamic reconciliation between recipe requirements for batch <strong>{currentBatch.batchId}</strong> and live raw inventory.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleExportBatchReport}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-500/50 text-[11px] font-bold text-amber-300 hover:text-amber-200 transition cursor-pointer shadow-xs"
                    title="Export PDF summary of batch material usage and order timeline"
                  >
                    <Download size={12} />
                    <span>Export Batch Report</span>
                  </button>
                  <div className="text-xs text-[var(--text-dim)] flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="hidden sm:inline">Live Raw Warehouse Sync</span>
                  </div>
                </div>
              </div>

              {/* Material Progress & Gauge Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {rawStockComparison.map((m, idx) => {
                  const isPipe = m.materialName.toLowerCase().includes('pipe') || m.unit === 'kg';
                  const isFittings = m.materialName.toLowerCase().includes('bolt') || m.materialName.toLowerCase().includes('cotter');

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-500/40 transition space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg border text-xs ${
                            isPipe ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
                            isFittings ? 'bg-purple-500/15 border-purple-500/30 text-purple-300' :
                            'bg-blue-500/15 border-blue-500/30 text-blue-300'
                          }`}>
                            {isPipe ? <Scale size={14} /> : isFittings ? <Tag size={14} /> : <Boxes size={14} />}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-[var(--text)] truncate max-w-[170px]" title={m.materialName}>
                              {m.materialName}
                            </div>
                            <div className="text-[10px] text-[var(--text-dim)]">{m.stockCategory}</div>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          In Stock
                        </span>
                      </div>

                      {/* Usage Metrics */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[var(--steel-line)]/40">
                        <div>
                          <div className="text-[10px] uppercase text-[var(--text-dim)]">Batch Consumed</div>
                          <div className="text-base font-bold text-[var(--yellow)] mt-0.5">
                            {m.unit === 'kg' ? `${m.consumed.toFixed(1)} kg` : `${m.consumed} pcs`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase text-[var(--text-dim)]">Live Raw Stock</div>
                          <div className="text-base font-bold text-[var(--text)] mt-0.5">
                            {m.unit === 'kg' ? `${m.liveStock.toFixed(0)} kg` : `${m.liveStock} pcs`}
                          </div>
                        </div>
                      </div>

                      {/* Utilization Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)]">
                          <span>Batch Share of Inventory:</span>
                          <span className="font-bold text-[var(--text)]">{m.utilizationRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[var(--panel)] border border-[var(--steel-line)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isPipe ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                              isFittings ? 'bg-gradient-to-r from-purple-500 to-indigo-400' :
                              'bg-gradient-to-r from-blue-500 to-cyan-400'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, m.utilizationRate))}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] pt-0.5">
                          <span>Remaining after lot:</span>
                          <span className="font-mono text-[var(--text)] font-semibold">
                            {m.unit === 'kg' ? `${m.remainingAfterBatch.toFixed(1)} kg` : `${m.remainingAfterBatch} pcs`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed Cumulative Breakdown Table */}
              <div className="overflow-x-auto border border-[var(--steel-line)] rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[var(--panel-raised)] text-[var(--text-dim)] uppercase text-[10px] border-b border-[var(--steel-line)] font-mono">
                    <tr>
                      <th className="px-3 py-2.5">Raw Material Description</th>
                      <th className="px-3 py-2.5">Inventory Category</th>
                      <th className="px-3 py-2.5 text-right">Batch Consumed</th>
                      <th className="px-3 py-2.5 text-right">Live Stock Balance</th>
                      <th className="px-3 py-2.5 text-right">Lot Draw Impact</th>
                      <th className="px-3 py-2.5 text-center">Warehouse Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--steel-line)]/50">
                    {rawStockComparison.map((m, idx) => (
                      <tr key={idx} className="hover:bg-[var(--panel-raised)]/40 transition">
                        <td className="px-3 py-2.5 font-bold text-[var(--text)]">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>{m.materialName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[var(--text-dim)]">{m.stockCategory}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-[var(--yellow)]">
                          {m.unit === 'kg' ? `${m.consumed.toFixed(1)} kg` : `${m.consumed} pcs`}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[var(--text)]">
                          {m.unit === 'kg' ? `${m.liveStock.toFixed(0)} kg` : `${m.liveStock} pcs`}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[var(--text-dim)]">
                          <span className="px-1.5 py-0.5 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-[10px]">
                            {m.utilizationRate.toFixed(1)}% of pool
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            ✓ Verified Deducted
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MATERIAL USAGE TREND & CONSUMPTION SPIKE DETECTION (RECHARTS LINE CHART) */}
            <div className="p-4 sm:p-5 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] space-y-4 font-mono">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-[var(--text)] flex items-center gap-2 font-sans">
                      <span>Material Usage Trend & Spike Detection</span>
                      <span className="text-xs font-normal text-amber-400/90 font-serif">
                        (میٹریل کھپت ٹرینڈ چارٹ)
                      </span>
                    </h3>
                    <p className="text-xs text-[var(--text-dim)] font-sans">
                      Order-by-order material consumption dynamics across batch <strong>{currentBatch.batchId}</strong>. Detects draw surges, heavy-gauge rods, and material allocation spikes.
                    </p>
                  </div>
                </div>

                {/* Metric Display Mode Switcher */}
                <div className="flex items-center p-0.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs font-sans">
                  <button
                    type="button"
                    onClick={() => setTrendMetricMode('per_order')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                      trendMetricMode === 'per_order'
                        ? 'bg-[var(--yellow)] text-black shadow-xs font-bold'
                        : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Zap size={12} />
                    <span>Per-Order Draw (Spike Analysis)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendMetricMode('cumulative')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                      trendMetricMode === 'cumulative'
                        ? 'bg-[var(--yellow)] text-black shadow-xs font-bold'
                        : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Activity size={12} />
                    <span>Cumulative Growth Curve</span>
                  </button>
                </div>
              </div>

              {/* Spike Detection Diagnostics Strip */}
              {spikeAnalysis && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-0.5">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Peak Single Order Draw</div>
                    <div className="text-sm font-bold text-amber-400">
                      {spikeAnalysis.maxPipeOrder.pipeKg} kg <span className="text-[10px] text-[var(--text-dim)] font-normal font-sans">M.S. Pipe</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)] truncate" title={spikeAnalysis.maxPipeOrder.customer}>
                      {spikeAnalysis.maxPipeOrder.orderId} · {spikeAnalysis.maxPipeOrder.customer}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-0.5">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Batch Average Draw</div>
                    <div className="text-sm font-bold text-[var(--text)]">
                      {spikeAnalysis.avgPipe} kg <span className="text-[10px] text-[var(--text-dim)] font-normal font-sans">/ order</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)]">
                      Across {materialTrendChartData.length} batch orders
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-0.5">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Max Rod Intensity</div>
                    <div className="text-sm font-bold text-blue-300">
                      {spikeAnalysis.maxIntensityOrder.pipePerRod} kg <span className="text-[10px] text-[var(--text-dim)] font-normal font-sans">/ rod</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)] truncate">
                      {spikeAnalysis.maxIntensityOrder.orderId} (Heavy Spec)
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-0.5">
                    <div className="text-[10px] uppercase text-[var(--text-dim)]">Spike Diagnostic</div>
                    {spikeAnalysis.hasSpike ? (
                      <div className="text-xs font-bold text-amber-400 flex items-center gap-1 mt-0.5">
                        <AlertTriangle size={13} />
                        <span>Consumption Spike Detected</span>
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 size={13} />
                        <span>Balanced Consumption Rate</span>
                      </div>
                    )}
                    <div className="text-[10px] text-[var(--text-dim)]">
                      {spikeAnalysis.hasSpike ? 'Draw exceeded batch baseline by >15%' : 'Consistent draw across orders'}
                    </div>
                  </div>
                </div>
              )}

              {/* The Recharts Line Chart Container */}
              <div className="w-full h-72 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={materialTrendChartData}
                    margin={{ top: 10, right: 25, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="var(--text-dim)"
                      tick={{ fontSize: 11, fill: 'var(--text-dim)' }}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="var(--text-dim)"
                      tick={{ fontSize: 11, fill: 'var(--text-dim)' }}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const isSpike = spikeAnalysis?.avgPipe && data.pipeKg > spikeAnalysis.avgPipe * 1.15;
                          return (
                            <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-amber-500/50 shadow-2xl font-mono text-xs space-y-1.5 z-50">
                              <div className="flex items-center justify-between gap-3 border-b border-[var(--steel-line)] pb-1">
                                <span className="font-bold text-[var(--yellow)]">{data.orderId} · {data.label}</span>
                                <span className="text-[10px] text-[var(--text-dim)]">{data.date}</span>
                              </div>
                              <div className="text-[11px] text-[var(--text-dim)] truncate max-w-[220px]">
                                Customer: <strong className="text-[var(--text)]">{data.customer}</strong>
                              </div>
                              <div className="space-y-0.5 pt-1 text-[11px]">
                                <div className="flex justify-between gap-4 text-amber-400">
                                  <span>M.S. Steel Pipe:</span>
                                  <strong>{trendMetricMode === 'cumulative' ? `${data.cumPipeKg} kg` : `${data.pipeKg} kg`}</strong>
                                </div>
                                <div className="flex justify-between gap-4 text-purple-300">
                                  <span>Safety Bolts & Pins:</span>
                                  <strong>{trendMetricMode === 'cumulative' ? `${data.cumBoltsPcs} pcs` : `${data.boltsPcs} pcs`}</strong>
                                </div>
                                <div className="flex justify-between gap-4 text-blue-300">
                                  <span>Rubber Bushings:</span>
                                  <strong>{trendMetricMode === 'cumulative' ? `${data.cumBushingsPcs} pcs` : `${data.bushingsPcs} pcs`}</strong>
                                </div>
                                <div className="flex justify-between gap-4 text-[var(--text)] border-t border-[var(--steel-line)]/50 pt-1">
                                  <span>Finished Output:</span>
                                  <strong>{data.rods} rods ({data.pipePerRod} kg/rod)</strong>
                                </div>
                              </div>
                              {isSpike && (
                                <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                                  <AlertTriangle size={11} />
                                  <span>Draw Spike: &gt;15% above batch average</span>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

                    {trendMetricMode === 'per_order' && spikeAnalysis && (
                      <ReferenceLine
                        y={spikeAnalysis.avgPipe}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        label={{ value: `Avg Pipe (${spikeAnalysis.avgPipe}kg)`, fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
                      />
                    )}

                    {trendMetricMode === 'per_order' ? (
                      <>
                        <Line
                          type="monotone"
                          dataKey="pipeKg"
                          name="M.S. Steel Pipe (kg)"
                          stroke="#f5b700"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#f5b700', strokeWidth: 1 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="boltsPcs"
                          name="Safety Bolts & Pins (pcs)"
                          stroke="#c084fc"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#c084fc' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="bushingsPcs"
                          name="Rubber Bushings (pcs)"
                          stroke="#38bdf8"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#38bdf8' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="rods"
                          name="Down Rods Volume (pcs)"
                          stroke="#34d399"
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          dot={{ r: 3, fill: '#34d399' }}
                        />
                      </>
                    ) : (
                      <>
                        <Line
                          type="monotone"
                          dataKey="cumPipeKg"
                          name="Cumulative Steel Pipe (kg)"
                          stroke="#f5b700"
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#f5b700' }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="cumBoltsPcs"
                          name="Cumulative Safety Bolts (pcs)"
                          stroke="#c084fc"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#c084fc' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="cumBushingsPcs"
                          name="Cumulative Bushings (pcs)"
                          stroke="#38bdf8"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#38bdf8' }}
                        />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Explanatory Footnote */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-[var(--steel-line)]/40 text-[11px] text-[var(--text-dim)]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Spike Threshold: Consumption &gt; 15% above batch order average ({spikeAnalysis?.avgPipe} kg).</span>
                </div>
                <div>
                  Correlates finished down rod specs with raw material inventory deductions.
                </div>
              </div>
            </div>

            {/* CHRONOLOGICAL ORDERS TIMELINE WITHIN THIS BATCH */}
            <div className="p-4 sm:p-5 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] space-y-4 font-mono">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--steel-line)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
                    <Milestone size={18} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-[var(--text)] flex items-center gap-2 font-sans">
                      <span>Chronological Batch Orders Timeline</span>
                      <span className="text-xs font-normal text-amber-400/90 font-serif">
                        (ترتیب وار آرڈرز ٹائم لائن)
                      </span>
                    </h3>
                    <p className="text-xs text-[var(--text-dim)] font-sans">
                      Chronological sequence of all orders processed under lot <strong>{currentBatch.batchId}</strong>, displaying individual material draws and progressive cumulative tallies.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleExportBatchReport}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500 hover:text-black border border-amber-500/40 text-[11px] font-bold text-amber-300 transition cursor-pointer shadow-xs"
                    title="Export PDF summary of batch material usage and order timeline"
                  >
                    <Download size={12} />
                    <span>Export Batch Report</span>
                  </button>
                  <span className="text-xs text-amber-400 font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    {timelineMilestones.length} Milestone {timelineMilestones.length === 1 ? 'Stage' : 'Stages'}
                  </span>
                </div>
              </div>

              {/* Vertical Timeline Tree */}
              <div className="relative pl-6 sm:pl-8 space-y-6 before:content-[''] before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-amber-500 before:via-amber-500/40 before:to-emerald-500">
                {timelineMilestones.map((m) => {
                  const txn = m.transaction;
                  const paidInfo = getPaidInfo(txn);
                  const isDelivered = !!txn.receiptUrl;
                  const isLastMilestone = (m.milestoneIndex === timelineMilestones.length);

                  return (
                    <div key={txn.id} className="relative group">
                      {/* Milestone Connector Node */}
                      <div className="absolute -left-6 sm:-left-8 top-1 flex items-center justify-center">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[var(--panel)] border-2 border-amber-500 text-amber-400 flex items-center justify-center font-bold text-[11px] shadow-sm group-hover:scale-110 transition">
                          {m.milestoneIndex}
                        </div>
                      </div>

                      {/* Milestone Card */}
                      <div className="p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-500/50 transition shadow-sm space-y-3">
                        {/* Card Top: Order ID, Date, Customer & Status */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--steel-line)]/40 pb-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs">
                              Milestone #{m.milestoneIndex}
                            </span>
                            <button
                              type="button"
                              onClick={() => setInspectOrderTxn(txn)}
                              className="font-bold text-sm text-[var(--yellow)] hover:underline flex items-center gap-1 cursor-pointer"
                              title="Inspect Order Details"
                            >
                              <span>Order #{txn.id}</span>
                              <ArrowUpRight size={12} />
                            </button>
                            <span className="text-[var(--text-dim)] text-xs flex items-center gap-1">
                              <Calendar size={12} />
                              <span>{txn.date} {txn.time}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Gate Pass Badge */}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border flex items-center gap-1 ${
                              isDelivered
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}>
                              {isDelivered ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                              <span>{isDelivered ? 'Pass Verified' : 'Awaiting Pass'}</span>
                            </span>

                            {/* Payment Badge */}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              paidInfo.status === 'Paid'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-red-500/15 text-red-400 border-red-500/30'
                            }`}>
                              {paidInfo.status}
                            </span>
                          </div>
                        </div>

                        {/* Customer & Items booked */}
                        <div className="space-y-1">
                          <div className="font-bold text-sm text-[var(--text)] font-sans flex items-center gap-1.5">
                            <Factory size={14} className="text-amber-400" />
                            <span>{txn.factory || 'Walk-in Workshop Customer'}</span>
                          </div>
                          <div className="text-xs text-[var(--text-dim)] font-mono">
                            {txn.itemsSummary}
                            {txn.sizes && <span className="ml-1 text-[var(--text)]">· Spec: {txn.sizes}</span>}
                          </div>
                        </div>

                        {/* Order-Specific Material Draw */}
                        <div className="p-3 rounded-lg bg-[var(--panel)] border border-[var(--steel-line)]/50 space-y-2">
                          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] flex items-center justify-between">
                            <span className="font-bold text-amber-400/90 flex items-center gap-1">
                              <Scale size={11} />
                              <span>Materials Consumed in this Order</span>
                            </span>
                            <span className="text-[var(--text)] font-bold">
                              {m.orderRods} Down Rods ({fmt(txn.total)})
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {Object.entries(m.orderMaterials).map(([matName, usage], idx2) => (
                              <span
                                key={idx2}
                                className="px-2 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[var(--text)] text-[11px] font-mono flex items-center gap-1"
                              >
                                <span className="text-[var(--text-dim)]">{matName}:</span>
                                <strong className="text-amber-300 font-bold">
                                  +{usage.unit === 'kg' ? `${usage.weightKg.toFixed(1)} kg` : `${usage.pieces} pcs`}
                                </strong>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* PROGRESSIVE CUMULATIVE MILESTONE TALLY BANNER */}
                        <div className="p-3 rounded-lg bg-gradient-to-r from-amber-500/10 via-[var(--panel)] to-amber-500/10 border border-amber-500/30 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-amber-300 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                              <TrendingUp size={13} className="text-amber-400" />
                              <span>Running Cumulative Batch Total up to Milestone #{m.milestoneIndex}:</span>
                            </span>
                            <span className="font-mono font-black text-xs text-[var(--yellow)]">
                              {fmt(m.cumulativeValue)} ({m.cumulativeRods} Rods)
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs pt-1 border-t border-amber-500/20 font-mono">
                            {Object.entries(m.cumulativeMaterials).map(([cMat, cUsage], idx3) => {
                              const u = cUsage as { weightKg: number; pieces: number; unit: string };
                              return (
                                <div key={idx3} className="flex items-center gap-1">
                                  <span className="text-[var(--text-dim)] text-[11px]">{cMat}:</span>
                                  <span className="font-bold text-[var(--text)]">
                                    {u.unit === 'kg' ? `${u.weightKg.toFixed(1)} kg` : `${u.pieces} pcs`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                          <div className="text-[10px] text-[var(--text-dim)] font-mono">
                            Batch: {txn.batchId || getBatchInfo(txn).effectiveBatchId} · Tracking: {txn.trackingNumber || getBatchInfo(txn).effectiveTrackingNumber}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedPdfTxn(txn)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--panel)] border border-[var(--steel-line)] text-[10px] text-[var(--text-dim)] hover:text-[var(--yellow)] transition cursor-pointer"
                              title="View Thermal / Invoice"
                            >
                              <FileText size={11} />
                              <span>Invoice</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setInspectOrderTxn(txn)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500 hover:text-black border border-amber-500/40 text-[10px] font-bold text-amber-300 transition cursor-pointer"
                              title="Inspect Full Order Details"
                            >
                              <Eye size={11} />
                              <span>Details</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Milestone Step Indicator when Batch ends */}
                      {isLastMilestone && (
                        <div className="pt-3 flex items-center gap-2 text-xs text-emerald-400 font-mono">
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                          <span className="font-bold">Lot Milestone Complete: All {currentBatch.totalRods} Down Rods Accounted from Raw Stock</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] text-center space-y-2">
            <Boxes size={32} className="mx-auto text-[var(--text-dim)] opacity-50" />
            <div className="text-base font-bold text-[var(--text)]">No Production Batches Available</div>
            <p className="text-xs text-[var(--text-dim)]">
              Orders with production batch identifiers will automatically appear here.
            </p>
          </div>
        )}
      </div>
    )}

      {/* COMPREHENSIVE ORDER DETAILS MODAL (Check all details) */}
      {inspectOrderTxn && (
        <OrderDetailsModal
          transaction={inspectOrderTxn}
          customerPayments={customerPayments}
          language={language}
          companyName={companyName}
          onClose={() => setInspectOrderTxn(null)}
          onOpenPayModal={txn => {
            setInspectOrderTxn(null);
            handleOpenPayModal(txn);
          }}
          onOpenGatePassUpload={txn => {
            setInspectOrderTxn(null);
            setUploadGatePassTxn(txn);
          }}
          onOpenGatePassView={txn => {
            setViewGatePassTxn(txn);
          }}
          onOpenInvoicePdf={txn => {
            setInspectOrderTxn(null);
            setSelectedPdfTxn(txn);
          }}
          onConfirmOrder={id => {
            onConfirmOrder(id);
            setInspectOrderTxn(prev => (prev?.id === id ? { ...prev, confirmed: true } : prev));
          }}
          onNilOrder={id => {
            onNilOrder(id);
            setInspectOrderTxn(prev => (prev?.id === id ? { ...prev, paid: true } : prev));
          }}
        />
      )}

      {/* Record Payment Modal */}
      {paymentModalTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono">
          <div className="w-full max-w-sm max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-2xl">
            <h3 className="font-serif font-bold text-base text-[var(--text)] mb-1 font-sans">
              {t('record_payment')} #{paymentModalTxn.id}
            </h3>
            <p className="text-xs text-[var(--text-dim)] mb-3">
              {paymentModalTxn.factory || 'Walk-in'} · {paymentModalTxn.itemsSummary}
            </p>

            <form onSubmit={handleSavePayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--text-dim)] uppercase mb-1">{t('amount_pkr')}</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--yellow)]"
                />
              </div>

              <div>
                <label className="block text-[var(--text-dim)] uppercase mb-1">{t('payment_method')}</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="Online">Online / Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-[var(--text-dim)] uppercase mb-1">Payment Reference / Note</label>
                <input
                  type="text"
                  value={payDetail}
                  onChange={e => setPayDetail(e.target.value)}
                  placeholder="e.g. Received at shop / Online slip #3819"
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPaymentModalTxn(null)}
                  className="flex-1 py-2 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)] cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-[var(--yellow)] text-black font-bold uppercase shadow cursor-pointer"
                >
                  {t('record_payment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction PDF & Formatted Invoice Modal */}
      {selectedPdfTxn && (
        <TransactionPdfModal
          transaction={selectedPdfTxn}
          customerPayments={customerPayments}
          companyName={companyName}
          language={language}
          onClose={() => setSelectedPdfTxn(null)}
          onRecordPayment={txn => {
            handleOpenPayModal(txn);
          }}
        />
      )}

      {/* Strict Gate Pass Upload Modal */}
      {uploadGatePassTxn && (
        <GatePassUploadModal
          transaction={uploadGatePassTxn}
          language={language}
          companyName={companyName}
          nextGateSequence={getNextGateSequence(transactions, rawSuppliers)}
          onClose={() => setUploadGatePassTxn(null)}
          onConfirmUpload={(id, gp) => {
            onAttachGatePass(id, gp);
            setUploadGatePassTxn(null);
          }}
        />
      )}

      {/* Gate Pass Document Viewer Modal */}
      {viewGatePassTxn && (
        <GatePassViewerModal
          transaction={viewGatePassTxn}
          onClose={() => setViewGatePassTxn(null)}
        />
      )}

      {/* Unified Gate Receipts Registry Modal */}
      {isUnifiedReceiptsOpen && (
        <UnifiedGateReceiptsModal
          transactions={transactions}
          rawSuppliers={rawSuppliers}
          language={language}
          companyName={companyName}
          onClose={() => setIsUnifiedReceiptsOpen(false)}
          onOpenGatePassUploadForTxn={txn => {
            setIsUnifiedReceiptsOpen(false);
            setUploadGatePassTxn(txn);
          }}
        />
      )}
    </div>
  );
};
