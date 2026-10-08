import { AppState, Product, Transaction, RawStockItem, RawSupplier, RecipeItem } from '../types';
import { parseDMY } from './helpers';

export interface ConsumingProductShare {
  productId: number;
  productName: string;
  qtyPerUnit: number;
  unit: string;
  historicalUnitsSold: number;
  totalConsumed: number;
  percentageShare: number;
}

export interface DailyTrajectoryPoint {
  dayOffset: number;
  dateStr: string;
  displayDate: string;
  stockLevel: number;
  simulatedStockLevel?: number;
  isPastReorder: boolean;
  isStockout: boolean;
  isSimulatedPastReorder?: boolean;
  isSimulatedStockout?: boolean;
}

export interface MaterialForecastItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  baselineReorderLevel: number;
  
  // Lead time & Buffers
  leadTimeDays: number;
  safetyBufferDays: number;
  safetyStockUnits: number;
  effectiveReorderPoint: number;
  
  // Consumption statistics
  totalConsumedHistory: number;
  averageDailyConsumption: number; // ADC
  peakDailyConsumption: number;
  consumptionStdDev: number;
  
  // Forecast predictions
  daysUntilReorderPoint: number;
  predictedReorderDate: string;
  predictedReorderDateTimestamp: number;
  daysUntilStockout: number;
  predictedStockoutDate: string;
  predictedStockoutDateTimestamp: number;
  
  // Urgency & Health
  urgencyStatus: 'critical' | 'reorder_soon' | 'healthy' | 'surplus';
  urgencyLabel: string;
  urgencyColor: string;
  
  // Recommendation & Supplier
  suggestedReorderQuantity: number;
  estimatedReorderCost: number;
  latestPurchaseRate: number;
  primarySupplierName: string;
  primarySupplierContact: string;
  primarySupplierLocation: string;
  
  // Breakdown
  consumingProducts: ConsumingProductShare[];
  trajectory: DailyTrajectoryPoint[];
}

export interface SalesPatternMetrics {
  totalTransactionsAnalyzed: number;
  totalFinishedUnitsSold: number;
  activeSalesDays: number;
  salesStartDate: string;
  salesEndDate: string;
  recent7DaysSalesUnits: number;
  prior7DaysSalesUnits: number;
  salesVelocityTrend: 'accelerating' | 'steady' | 'slowing';
  salesVelocityChangePct: number;
  averageDailySalesVolume: number;
}

export interface RecentRawMaterialBurnLogItem {
  txnId: string;
  date: string;
  factoryName: string;
  itemsSummary: string;
  finishedUnits: number;
  materialDeductions: Array<{
    materialName: string;
    amount: number;
    unit: string;
  }>;
}

export interface InventoryForecastResult {
  asOfDate: string;
  materials: MaterialForecastItem[];
  overallUrgencySummary: {
    criticalCount: number;
    reorderSoonCount: number;
    healthyCount: number;
    surplusCount: number;
    highestRiskMaterial?: MaterialForecastItem;
  };
  salesMetrics: SalesPatternMetrics;
  recentBurnLog: RecentRawMaterialBurnLogItem[];
  simulationParams: {
    demandMultiplier: number;
    activeHorizonDays: number;
  };
}

export interface ForecastOptions {
  demandMultiplier?: number; // e.g. 1.0 = baseline, 1.3 = +30% sales surge
  customLeadTimes?: Record<string, number>; // materialId or name -> days
  customSafetyBuffers?: Record<string, number>; // materialId or name -> days
  horizonDays?: number; // default 60 days
}

// Storage keys
const LEAD_TIME_STORAGE_KEY = 'falcon_inv_lead_times_v1';
const SAFETY_BUFFER_STORAGE_KEY = 'falcon_inv_safety_buffers_v1';

export function loadSavedLeadTimes(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LEAD_TIME_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLeadTimes(settings: Record<string, number>): void {
  try {
    localStorage.setItem(LEAD_TIME_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function loadSavedSafetyBuffers(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SAFETY_BUFFER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSafetyBuffers(settings: Record<string, number>): void {
  try {
    localStorage.setItem(SAFETY_BUFFER_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

// Helper to normalize material names for matching
function normalizeMaterialKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Fuzzy matches a recipe material name to a raw stock item name
 */
export function matchMaterialToStock(
  recipeMaterialName: string,
  rawStockList: RawStockItem[]
): RawStockItem | undefined {
  const normRecipe = normalizeMaterialKey(recipeMaterialName);

  // 1. Direct key equality or inclusion
  for (const stock of rawStockList) {
    const normStock = normalizeMaterialKey(stock.name);
    if (normStock === normRecipe) return stock;
    if (normStock.includes(normRecipe) || normRecipe.includes(normStock)) return stock;
  }

  // 2. Specific domain synonyms
  if (normRecipe.includes('steelpipe') || normRecipe.includes('mspi')) {
    const match = rawStockList.find(s => normalizeMaterialKey(s.name).includes('steelpipe') || normalizeMaterialKey(s.name).includes('mssteel'));
    if (match) return match;
  }
  if (normRecipe.includes('heavypipe') || normRecipe.includes('1dia') || normRecipe.includes('14g')) {
    const match = rawStockList.find(s => normalizeMaterialKey(s.name).includes('heavypipe'));
    if (match) return match;
  }
  if (normRecipe.includes('bolt') || normRecipe.includes('cotter') || normRecipe.includes('fitting')) {
    const match = rawStockList.find(s => normalizeMaterialKey(s.name).includes('bolt') || normalizeMaterialKey(s.name).includes('cotter'));
    if (match) return match;
  }
  if (normRecipe.includes('bush') || normRecipe.includes('rubber') || normRecipe.includes('ring')) {
    const match = rawStockList.find(s => normalizeMaterialKey(s.name).includes('bush') || normalizeMaterialKey(s.name).includes('rubber'));
    if (match) return match;
  }

  return undefined;
}

/**
 * Format a Date to readable string like "18 Oct 2026"
 */
function formatFutureDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Parses individual finished items and quantities sold from a transaction
 */
export function parseTransactionFinishedItems(
  txn: Transaction,
  products: Product[]
): Array<{ product: Product; qty: number }> {
  const results: Array<{ product: Product; qty: number }> = [];

  // If itemProductIds is available (e.g., "101,102")
  if (txn.itemProductIds) {
    const pids = txn.itemProductIds.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    const counts = (txn.itemCounts || '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    
    if (pids.length > 0) {
      pids.forEach((pid, idx) => {
        const prod = products.find(p => p.id === pid);
        if (prod) {
          const qty = counts[idx] !== undefined && counts[idx] > 0 ? counts[idx] : Math.max(1, Math.round(txn.itemCount / pids.length));
          results.push({ product: prod, qty });
        }
      });
      if (results.length > 0) return results;
    }
  }

  // Parse from itemsSummary by checking product names or size mentions
  const summary = txn.itemsSummary || '';
  for (const prod of products) {
    // Check if product name appears in summary
    if (summary.includes(prod.name)) {
      results.push({ product: prod, qty: txn.itemCount || 1 });
      return results;
    }
  }

  // Check matching by category/size (e.g. 18", 24", 12", 36", 48")
  for (const prod of products) {
    if (prod.size && summary.includes(prod.size)) {
      results.push({ product: prod, qty: txn.itemCount || 1 });
      return results;
    }
  }

  // If no match found, fallback to first matching product or generic
  if (products.length > 0) {
    results.push({ product: products[0], qty: txn.itemCount || 1 });
  }

  return results;
}

/**
 * Main Forecast Analysis Engine
 */
export function calculateInventoryForecast(
  state: AppState,
  options: ForecastOptions = {}
): InventoryForecastResult {
  const demandMultiplier = Math.max(0.1, Math.min(5.0, options.demandMultiplier ?? 1.0));
  const horizonDays = Math.max(15, Math.min(180, options.horizonDays ?? 60));
  const customLeadTimes = { ...loadSavedLeadTimes(), ...(options.customLeadTimes || {}) };
  const customSafetyBuffers = { ...loadSavedSafetyBuffers(), ...(options.customSafetyBuffers || {}) };

  const products = state.products || [];
  const transactions = state.transactions || [];
  const rawStock = state.rawStock || [];
  const rawSuppliers = state.rawSuppliers || [];

  // 1. Analyze historical transactions to establish sales velocity & date range
  const sortedTxns = [...transactions].sort((a, b) => {
    const da = parseDMY(a.date)?.getTime() || 0;
    const db = parseDMY(b.date)?.getTime() || 0;
    return da - db;
  });

  const parsedTxnDates: number[] = [];
  let totalFinishedUnits = 0;
  sortedTxns.forEach(t => {
    const d = parseDMY(t.date);
    if (d) parsedTxnDates.push(d.getTime());
    totalFinishedUnits += t.itemCount || 1;
  });

  const minDateMs = parsedTxnDates.length > 0 ? Math.min(...parsedTxnDates) : Date.now() - 30 * 86400000;
  const maxDateMs = parsedTxnDates.length > 0 ? Math.max(...parsedTxnDates) : Date.now();
  const activeDaysSpan = Math.max(1, Math.ceil((maxDateMs - minDateMs) / (1000 * 60 * 60 * 24)) + 1);

  // Velocity comparison: Last 7 days vs Previous 7 days
  const sevenDaysMs = 7 * 86400000;
  let recent7DaysUnits = 0;
  let prior7DaysUnits = 0;
  sortedTxns.forEach(t => {
    const d = parseDMY(t.date)?.getTime() || 0;
    if (d >= maxDateMs - sevenDaysMs) {
      recent7DaysUnits += t.itemCount || 1;
    } else if (d >= maxDateMs - 2 * sevenDaysMs && d < maxDateMs - sevenDaysMs) {
      prior7DaysUnits += t.itemCount || 1;
    }
  });

  const velocityDiff = recent7DaysUnits - prior7DaysUnits;
  const velocityChangePct = prior7DaysUnits > 0 ? Math.round((velocityDiff / prior7DaysUnits) * 100) : 0;
  let salesTrend: 'accelerating' | 'steady' | 'slowing' = 'steady';
  if (velocityChangePct > 10) salesTrend = 'accelerating';
  else if (velocityChangePct < -10) salesTrend = 'slowing';

  const salesMetrics: SalesPatternMetrics = {
    totalTransactionsAnalyzed: sortedTxns.length,
    totalFinishedUnitsSold: totalFinishedUnits,
    activeSalesDays: activeDaysSpan,
    salesStartDate: formatFutureDate(new Date(minDateMs)),
    salesEndDate: formatFutureDate(new Date(maxDateMs)),
    recent7DaysSalesUnits: recent7DaysUnits,
    prior7DaysSalesUnits: prior7DaysUnits,
    salesVelocityTrend: salesTrend,
    salesVelocityChangePct: velocityChangePct,
    averageDailySalesVolume: Number((totalFinishedUnits / activeDaysSpan).toFixed(2))
  };

  // 2. Map consumption history per raw material from sales transactions + recipes
  // Key: material name / id
  interface MaterialUsageAccumulator {
    rawStockItem: RawStockItem;
    totalAmountConsumed: number;
    dailyUsageMap: Map<string, number>; // dateStr -> amount
    productShareMap: Map<number, { product: Product; qtyPerUnit: number; totalConsumed: number; unitsSold: number }>;
  }

  const materialAccumulators = new Map<string, MaterialUsageAccumulator>();

  // Initialize accumulators for each raw stock item
  rawStock.forEach(stock => {
    materialAccumulators.set(stock.name, {
      rawStockItem: stock,
      totalAmountConsumed: 0,
      dailyUsageMap: new Map(),
      productShareMap: new Map()
    });
  });

  // Recent burn log entries for audit trail
  const recentBurnLog: RecentRawMaterialBurnLogItem[] = [];

  // Iterate over transactions and extract material consumption
  sortedTxns.forEach(txn => {
    const finishedItems = parseTransactionFinishedItems(txn, products);
    const txnDeductions: Array<{ materialName: string; amount: number; unit: string }> = [];

    finishedItems.forEach(({ product, qty }) => {
      const recipe = product.recipe || [];
      recipe.forEach(recipeItem => {
        // Find matching raw stock item
        const matchedStock = matchMaterialToStock(recipeItem.material, rawStock);
        if (matchedStock) {
          const acc = materialAccumulators.get(matchedStock.name);
          if (acc) {
            const unitRate = recipeItem.weightPerUnit || recipeItem.itemsPerUnit || 1;
            const consumed = unitRate * qty;
            acc.totalAmountConsumed += consumed;

            // Daily tracking
            const dayKey = txn.date || 'unknown';
            const curDay = acc.dailyUsageMap.get(dayKey) || 0;
            acc.dailyUsageMap.set(dayKey, curDay + consumed);

            // Product share tracking
            const curShare = acc.productShareMap.get(product.id) || {
              product,
              qtyPerUnit: unitRate,
              totalConsumed: 0,
              unitsSold: 0
            };
            curShare.totalConsumed += consumed;
            curShare.unitsSold += qty;
            acc.productShareMap.set(product.id, curShare);

            txnDeductions.push({
              materialName: matchedStock.name,
              amount: Number(consumed.toFixed(2)),
              unit: matchedStock.unit || (recipeItem.weightPerUnit ? 'kg' : 'pcs')
            });
          }
        }
      });
    });

    if (txnDeductions.length > 0) {
      recentBurnLog.push({
        txnId: txn.id,
        date: txn.date,
        factoryName: txn.factory || 'Walk-in Workshop',
        itemsSummary: txn.itemsSummary,
        finishedUnits: txn.itemCount || 1,
        materialDeductions: txnDeductions
      });
    }
  });

  // 3. For each raw material, compute statistics, reorder points, lead times & trajectory
  const today = new Date();
  const materialForecastItems: MaterialForecastItem[] = [];

  rawStock.forEach(stock => {
    const acc = materialAccumulators.get(stock.name);
    const totalConsumed = acc ? acc.totalAmountConsumed : 0;
    const isWeight = (stock.unit || '').toLowerCase().includes('kg') || (stock.weight !== undefined && stock.weight > 0);
    const currentStock = isWeight ? (stock.weight || 0) : (stock.quantity || stock.items || 0);

    // Compute baseline ADC (Average Daily Consumption)
    let baselineADC = 0;
    if (totalConsumed > 0 && activeDaysSpan > 0) {
      baselineADC = totalConsumed / activeDaysSpan;
    } else {
      // Fallback sensible engineering estimate based on stock velocity
      baselineADC = isWeight ? 15.0 : 45.0;
    }

    // Apply demand multiplier (simulation)
    const effectiveADC = Math.max(0.01, baselineADC * demandMultiplier);

    // Peak day consumption and standard deviation
    let peakDaily = effectiveADC * 1.5;
    let variance = 0;
    if (acc && acc.dailyUsageMap.size > 0) {
      const dailyVals = Array.from(acc.dailyUsageMap.values());
      const maxVal = Math.max(...dailyVals);
      if (maxVal > 0) peakDaily = maxVal * demandMultiplier;
      
      const sumSqDiff = dailyVals.reduce((sum, v) => sum + Math.pow((v * demandMultiplier) - effectiveADC, 2), 0);
      variance = sumSqDiff / dailyVals.length;
    }
    const stdDev = Math.sqrt(variance) || (effectiveADC * 0.25);

    // Lead Time (default 7 days for steel mills / fittings, customizable per material)
    const defaultLeadTime = stock.name.toLowerCase().includes('pipe') ? 6 : 5;
    const leadTimeDays = customLeadTimes[stock.id || stock.name] ?? customLeadTimes[stock.name] ?? defaultLeadTime;

    // Safety buffer days (default 5 days)
    const defaultSafetyDays = 5;
    const safetyBufferDays = customSafetyBuffers[stock.id || stock.name] ?? customSafetyBuffers[stock.name] ?? defaultSafetyDays;

    // Statistical Safety Stock formula:
    // SS = (SafetyBufferDays * ADC) + (0.5 * stdDev * sqrt(LeadTime))
    const safetyStockUnits = Math.round((safetyBufferDays * effectiveADC) + (stdDev * Math.sqrt(leadTimeDays) * 0.5));

    // Reorder Point (ROP) = (ADC * LeadTime) + SafetyStock
    const calculatedROP = Math.round((effectiveADC * leadTimeDays) + safetyStockUnits);
    const baselineReorderLevel = stock.reorderLevel || stock.lowStockThreshold || Math.round(calculatedROP * 0.8);
    const effectiveReorderPoint = Math.max(baselineReorderLevel, calculatedROP);

    // Forecast Days until Reorder Point & Depletion
    let daysUntilROP = 0;
    if (currentStock > effectiveReorderPoint) {
      daysUntilROP = Math.max(0, Math.floor((currentStock - effectiveReorderPoint) / effectiveADC));
    } else {
      daysUntilROP = 0; // Already reached or breached!
    }

    const daysUntilStockout = Math.max(0, Math.floor(currentStock / effectiveADC));

    // Calculate dates
    const reorderDate = new Date(today.getTime() + daysUntilROP * 86400000);
    const stockoutDate = new Date(today.getTime() + daysUntilStockout * 86400000);

    // Determine urgency status
    let urgencyStatus: 'critical' | 'reorder_soon' | 'healthy' | 'surplus' = 'healthy';
    let urgencyLabel = 'Healthy Stock';
    let urgencyColor = 'emerald';

    if (currentStock <= effectiveReorderPoint) {
      urgencyStatus = 'critical';
      urgencyLabel = 'REORDER NOW (Breached)';
      urgencyColor = 'rose';
    } else if (daysUntilROP <= leadTimeDays) {
      urgencyStatus = 'reorder_soon';
      urgencyLabel = `Reorder Soon (in ${daysUntilROP} days)`;
      urgencyColor = 'amber';
    } else if (daysUntilStockout > 90) {
      urgencyStatus = 'surplus';
      urgencyLabel = 'Surplus Stock';
      urgencyColor = 'cyan';
    } else {
      urgencyStatus = 'healthy';
      urgencyLabel = `Safe (${daysUntilROP} days to ROP)`;
      urgencyColor = 'emerald';
    }

    // Suggested Reorder Quantity: (30-day target supply cycle + Safety Stock - Current Stock)
    const targetCycleDays = 30;
    const rawSuggested = Math.max(
      Math.round(effectiveADC * targetCycleDays),
      Math.round((effectiveADC * targetCycleDays) + safetyStockUnits - currentStock)
    );
    // Round to clean industrial batch sizes (e.g. multiples of 25kg or 50 pcs)
    const batchStep = isWeight ? 25 : 50;
    const suggestedReorderQuantity = Math.max(batchStep, Math.ceil(rawSuggested / batchStep) * batchStep);

    // Find supplier from rawSuppliers
    let primarySupplierName = 'Ittefaq Steel Mills Gujranwala';
    let primarySupplierContact = '0300-9874561';
    let primarySupplierLocation = 'Small Estate, Gujrat';
    let latestRate = isWeight ? 290 : 15;

    for (const sup of rawSuppliers) {
      const matchEntry = sup.entries.find(e => 
        (e.stockName && stock.name.toLowerCase().includes(e.stockName.toLowerCase())) ||
        (e.desc && stock.name.toLowerCase().includes(e.desc.toLowerCase()))
      );
      if (matchEntry) {
        primarySupplierName = sup.name;
        if (matchEntry.rate && matchEntry.rate > 0) latestRate = matchEntry.rate;
        break;
      }
    }
    const estimatedCost = suggestedReorderQuantity * latestRate;

    // Consuming Products breakdown
    const consumingProducts: ConsumingProductShare[] = [];
    if (acc) {
      acc.productShareMap.forEach(share => {
        const pct = totalConsumed > 0 ? Math.round((share.totalConsumed / totalConsumed) * 100) : 0;
        consumingProducts.push({
          productId: share.product.id,
          productName: share.product.name,
          qtyPerUnit: share.qtyPerUnit,
          unit: stock.unit || (isWeight ? 'kg' : 'pcs'),
          historicalUnitsSold: share.unitsSold,
          totalConsumed: Number(share.totalConsumed.toFixed(2)),
          percentageShare: pct
        });
      });
    }
    // Sort consuming products by share descending
    consumingProducts.sort((a, b) => b.totalConsumed - a.totalConsumed);

    // Build trajectory points for day 0 to horizonDays
    const trajectory: DailyTrajectoryPoint[] = [];
    for (let day = 0; day <= horizonDays; day += 2) {
      const ptDate = new Date(today.getTime() + day * 86400000);
      const remainingBaseline = Math.max(0, Number((currentStock - (baselineADC * day)).toFixed(1)));
      const remainingSimulated = Math.max(0, Number((currentStock - (effectiveADC * day)).toFixed(1)));

      trajectory.push({
        dayOffset: day,
        dateStr: ptDate.toISOString().slice(0, 10),
        displayDate: `${ptDate.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][ptDate.getMonth()]}`,
        stockLevel: remainingBaseline,
        simulatedStockLevel: remainingSimulated,
        isPastReorder: remainingBaseline <= effectiveReorderPoint,
        isStockout: remainingBaseline <= 0,
        isSimulatedPastReorder: remainingSimulated <= effectiveReorderPoint,
        isSimulatedStockout: remainingSimulated <= 0
      });
    }

    materialForecastItems.push({
      id: stock.id || stock.name,
      name: stock.name,
      category: stock.category || 'Raw Material',
      unit: stock.unit || (isWeight ? 'kg' : 'pcs'),
      currentStock: Number(currentStock.toFixed(1)),
      baselineReorderLevel,
      leadTimeDays,
      safetyBufferDays,
      safetyStockUnits,
      effectiveReorderPoint,
      totalConsumedHistory: Number(totalConsumed.toFixed(1)),
      averageDailyConsumption: Number(effectiveADC.toFixed(2)),
      peakDailyConsumption: Number(peakDaily.toFixed(2)),
      consumptionStdDev: Number(stdDev.toFixed(2)),
      daysUntilReorderPoint: daysUntilROP,
      predictedReorderDate: formatFutureDate(reorderDate),
      predictedReorderDateTimestamp: reorderDate.getTime(),
      daysUntilStockout,
      predictedStockoutDate: formatFutureDate(stockoutDate),
      predictedStockoutDateTimestamp: stockoutDate.getTime(),
      urgencyStatus,
      urgencyLabel,
      urgencyColor,
      suggestedReorderQuantity,
      estimatedReorderCost: Math.round(estimatedCost),
      latestPurchaseRate: latestRate,
      primarySupplierName,
      primarySupplierContact,
      primarySupplierLocation,
      consumingProducts,
      trajectory
    });
  });

  // Sort materials by urgency (critical first, then reorder_soon, then healthy)
  const urgencyWeight: Record<string, number> = { critical: 0, reorder_soon: 1, healthy: 2, surplus: 3 };
  materialForecastItems.sort((a, b) => {
    const diff = urgencyWeight[a.urgencyStatus] - urgencyWeight[b.urgencyStatus];
    if (diff !== 0) return diff;
    return a.daysUntilReorderPoint - b.daysUntilReorderPoint;
  });

  // Summary counts
  const criticalCount = materialForecastItems.filter(m => m.urgencyStatus === 'critical').length;
  const reorderSoonCount = materialForecastItems.filter(m => m.urgencyStatus === 'reorder_soon').length;
  const healthyCount = materialForecastItems.filter(m => m.urgencyStatus === 'healthy').length;
  const surplusCount = materialForecastItems.filter(m => m.urgencyStatus === 'surplus').length;

  return {
    asOfDate: formatFutureDate(today),
    materials: materialForecastItems,
    overallUrgencySummary: {
      criticalCount,
      reorderSoonCount,
      healthyCount,
      surplusCount,
      highestRiskMaterial: materialForecastItems[0]
    },
    salesMetrics,
    recentBurnLog: recentBurnLog.slice(-15).reverse(),
    simulationParams: {
      demandMultiplier,
      activeHorizonDays: horizonDays
    }
  };
}
