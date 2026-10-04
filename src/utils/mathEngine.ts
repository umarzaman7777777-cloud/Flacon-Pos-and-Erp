import {
  AppState,
  CustomerLedgerEntry,
  RawEntry,
  PaintEntry,
  LabourEntry,
  ScrapEntry,
  Worker,
  Product,
  RawStockItem,
  Transaction
} from '../types';

/**
 * Calculates detailed summary and running balances for a Customer / Factory Ledger.
 */
export interface LedgerRowWithBalance<T> {
  entry: T;
  runningBalance: number;
}

export function computeCustomerLedgerDetails(entries: CustomerLedgerEntry[] = []) {
  let totalDebit = 0;
  let totalCredit = 0;
  let running = 0;

  const rowsWithBalance: LedgerRowWithBalance<CustomerLedgerEntry>[] = entries.map(entry => {
    const d = Number(entry.debit) || 0;
    const c = Number(entry.credit) || 0;
    totalDebit += d;
    totalCredit += c;
    running += d - c;
    return {
      entry,
      runningBalance: running
    };
  });

  const netBalance = totalDebit - totalCredit;
  const status: 'owed' | 'advance' | 'settled' =
    netBalance > 0 ? 'owed' : netBalance < 0 ? 'advance' : 'settled';

  return {
    rowsWithBalance,
    entriesWithBalance: rowsWithBalance.map(r => ({ ...r.entry, runningBalance: r.runningBalance })),
    totalDebit,
    totalCredit,
    totalDebits: totalDebit,
    totalCredits: totalCredit,
    netBalance,
    status
  };
}

/**
 * Calculates detailed summary and running balances for a Raw Material Supplier.
 * Credit = Material received from supplier (we owe them)
 * Debit = Payment made to supplier (reduces debt)
 */
export function computeSupplierLedgerDetails(entries: RawEntry[] = []) {
  let totalPurchased = 0; // credits
  let totalPaid = 0; // debits
  let running = 0;

  const rowsWithBalance: LedgerRowWithBalance<RawEntry>[] = entries.map(entry => {
    const d = Number(entry.debit) || 0;
    const c = Number(entry.credit) || 0;
    totalPaid += d;
    totalPurchased += c;
    running += c - d; // positive running balance means workshop owes supplier
    return {
      entry,
      runningBalance: running
    };
  });

  const netPayable = totalPurchased - totalPaid;

  return {
    rowsWithBalance,
    entriesWithBalance: rowsWithBalance.map(r => ({ ...r.entry, runningBalance: r.runningBalance })),
    totalPurchased,
    totalPaid,
    totalDebits: totalPaid,
    totalCredits: totalPurchased,
    netPayable,
    netBalance: netPayable
  };
}

/**
 * Calculates detailed summary and running balances for a Painter Ledger.
 * Credit = Painting work done by painter (we owe painter)
 * Debit = Payment / Advance given to painter
 */
export function computePainterLedgerDetails(entries: PaintEntry[] = []) {
  let totalWork = 0; // credits
  let totalPaid = 0; // debits
  let running = 0;

  const rowsWithBalance: LedgerRowWithBalance<PaintEntry>[] = entries.map(entry => {
    const d = Number(entry.debit) || 0;
    const c = Number(entry.credit) || 0;
    totalPaid += d;
    totalWork += c;
    running += c - d;
    return {
      entry,
      runningBalance: running
    };
  });

  const netPayable = totalWork - totalPaid;

  return {
    rowsWithBalance,
    entriesWithBalance: rowsWithBalance.map(r => ({ ...r.entry, runningBalance: r.runningBalance })),
    totalWork,
    totalPaid,
    totalDebits: totalPaid,
    totalCredits: totalWork,
    netPayable,
    netBalance: netPayable
  };
}

/**
 * Calculates detailed summary and running balances for a Labour Worker.
 * Credit = Earned from daily attendance or piece-rate units
 * Debit = Wage payment, advance, loan, or penalty deduction
 */
export function computeWorkerLedgerDetails(worker: Worker) {
  let totalEarned = 0;
  let totalPaid = 0;
  let running = 0;

  const entries = worker.entries || [];
  const rowsWithBalance: LedgerRowWithBalance<LabourEntry>[] = entries.map(entry => {
    const c = Number(entry.credit) || 0;
    const d = Number(entry.debit) || 0;
    totalEarned += c;
    totalPaid += d;
    running += c - d; // positive means workshop owes worker; negative means worker took advance
    return {
      entry,
      runningBalance: running
    };
  });

  const netPayable = totalEarned - totalPaid;

  return {
    rowsWithBalance,
    entriesWithBalance: rowsWithBalance.map(r => ({ ...r.entry, runningBalance: r.runningBalance })),
    totalEarned,
    totalPaid,
    totalDebits: totalPaid,
    totalCredits: totalEarned,
    netPayable,
    netBalance: netPayable
  };
}

/**
 * Calculates detailed summary and running balances for a Scrap Buyer.
 * Debit = Scrap taken by buyer (buyer owes us)
 * Credit = Payment received from buyer (cash/bank)
 */
export function computeScrapBuyerLedgerDetails(entries: ScrapEntry[] = []) {
  let totalSold = 0; // debits
  let totalReceived = 0; // credits
  let running = 0;

  const rowsWithBalance: LedgerRowWithBalance<ScrapEntry>[] = entries.map(entry => {
    const d = Number(entry.debit) || 0;
    const c = Number(entry.credit) || 0;
    totalSold += d;
    totalReceived += c;
    running += d - c;
    return {
      entry,
      runningBalance: running
    };
  });

  const netReceivable = totalSold - totalReceived;

  return {
    rowsWithBalance,
    entriesWithBalance: rowsWithBalance.map(r => ({ ...r.entry, runningBalance: r.runningBalance })),
    totalSold,
    totalReceived,
    totalDebits: totalSold,
    totalCredits: totalReceived,
    netReceivable,
    netBalance: netReceivable
  };
}

/**
 * Helper to match a date string against 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all'
 */
export function matchesPeriod(dateStr: string, period: string): boolean {
  if (!dateStr || period === 'all') return true;

  const now = new Date();
  let entryDate: Date;

  // Check if DD/MM/YYYY
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      entryDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    } else {
      entryDate = new Date(dateStr);
    }
  } else {
    entryDate = new Date(dateStr);
  }

  if (isNaN(entryDate.getTime())) return true;

  if (period === 'daily') {
    return (
      entryDate.getDate() === now.getDate() &&
      entryDate.getMonth() === now.getMonth() &&
      entryDate.getFullYear() === now.getFullYear()
    );
  }

  if (period === 'weekly') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return entryDate >= sevenDaysAgo && entryDate <= now;
  }

  if (period === 'monthly') {
    return (
      entryDate.getMonth() === now.getMonth() &&
      entryDate.getFullYear() === now.getFullYear()
    );
  }

  if (period === 'yearly') {
    return entryDate.getFullYear() === now.getFullYear();
  }

  return true;
}

/**
 * Calculates complete live mathematical figures for the whole ERP:
 * - Live Cash in Hand (Tijori Register)
 * - Receivables
 * - Payables
 * - Finished Goods Inventory Value
 * - Raw Material Inventory Value
 * - Total Workshop Asset Valuation
 * - Filtered Sales & Orders
 * - Filtered Expenses & Costs
 * - Gross & Net Profits
 */
export function computeSystemFinancials(
  state: AppState,
  salesPeriod: string = 'monthly',
  summaryPeriod: string = 'monthly'
) {
  // 1. ALL-TIME CASH IN HAND (Exact physical cash register in workshop)
  let cashInflow = 0;
  let cashOutflow = 0;

  // Direct cash sales from transactions that were paid at POS
  state.transactions.forEach(t => {
    if (t.paid && (!t.method || t.method.toLowerCase().includes('cash'))) {
      cashInflow += t.total;
    }
  });

  // Recorded customer payments
  state.customerPayments.forEach(p => {
    if (!p.method || p.method.toLowerCase().includes('cash')) {
      cashInflow += p.amount;
    }
  });

  // Scrap sales cash received
  state.scrapBuyers.forEach(b => {
    b.entries.forEach(e => {
      if (e.credit && (!e.method || e.method.toLowerCase().includes('cash'))) {
        cashInflow += e.credit;
      }
    });
  });

  // Overhead expenses paid in cash
  state.expenses.forEach(e => {
    if (!e.method || e.method.toLowerCase().includes('cash')) {
      cashOutflow += e.amount;
    }
  });

  // Raw material supplier payments in cash
  state.rawSuppliers.forEach(s => {
    s.entries.forEach(e => {
      if (e.debit && (!e.method || e.method.toLowerCase().includes('cash'))) {
        cashOutflow += e.debit;
      }
    });
  });

  // Painter payments in cash
  state.painters.forEach(p => {
    p.entries.forEach(e => {
      if (e.debit && (!e.method || e.method.toLowerCase().includes('cash'))) {
        cashOutflow += e.debit;
      }
    });
  });

  // Labour wage payments in cash
  (state.workers || state.labourWorkers || []).forEach(w => {
    w.entries.forEach(e => {
      if (e.debit && (!e.method || e.method.toLowerCase().includes('cash'))) {
        cashOutflow += e.debit;
      }
    });
  });

  // Custom Job-Work ledger cash payments received
  (state.customLedgersList || []).forEach(cl => {
    cl.entries.forEach(e => {
      if (e.credit && (!e.desc?.toLowerCase().includes('bank') && !e.desc?.toLowerCase().includes('cheque'))) {
        cashInflow += e.credit;
      }
    });
  });

  // Withdrawals in cash
  state.withdrawals.forEach(w => {
    if (!w.isReversed && (!w.method || w.method.toLowerCase().includes('cash'))) {
      cashOutflow += w.amount;
    }
  });

  const cashInHand = cashInflow - cashOutflow;

  // 2. RECEIVABLES & PAYABLES
  const factoryReceivables = state.customerLedgers.reduce((acc, cl) => {
    const details = computeCustomerLedgerDetails(cl.entries);
    return details.netBalance > 0 ? acc + details.netBalance : acc;
  }, 0);

  const customLedgerReceivables = (state.customLedgersList || []).reduce((acc, cl) => {
    const debit = cl.entries.reduce((s, e) => s + (e.debit || 0), 0);
    const credit = cl.entries.reduce((s, e) => s + (e.credit || 0), 0);
    const bal = debit - credit;
    return bal > 0 ? acc + bal : acc;
  }, 0);

  const totalReceivables = factoryReceivables + customLedgerReceivables;

  const factoryAdvances = state.customerLedgers.reduce((acc, cl) => {
    const details = computeCustomerLedgerDetails(cl.entries);
    return details.netBalance < 0 ? acc + Math.abs(details.netBalance) : acc;
  }, 0);

  const customLedgerAdvances = (state.customLedgersList || []).reduce((acc, cl) => {
    const debit = cl.entries.reduce((s, e) => s + (e.debit || 0), 0);
    const credit = cl.entries.reduce((s, e) => s + (e.credit || 0), 0);
    const bal = debit - credit;
    return bal < 0 ? acc + Math.abs(bal) : acc;
  }, 0);

  const totalCustomerAdvances = factoryAdvances + customLedgerAdvances;

  const supplierPayables = state.rawSuppliers.reduce((acc, s) => {
    const details = computeSupplierLedgerDetails(s.entries);
    return details.netPayable > 0 ? acc + details.netPayable : acc;
  }, 0);

  const painterPayables = state.painters.reduce((acc, p) => {
    const details = computePainterLedgerDetails(p.entries);
    return details.netPayable > 0 ? acc + details.netPayable : acc;
  }, 0);

  const labourPayables = (state.workers || state.labourWorkers || []).reduce((acc, w) => {
    const details = computeWorkerLedgerDetails(w);
    return details.netPayable > 0 ? acc + details.netPayable : acc;
  }, 0);

  const totalPayables = supplierPayables + painterPayables + labourPayables + totalCustomerAdvances;

  // 3. INVENTORY & ASSET VALUATIONS
  const finishedGoodsValue = state.products.reduce((acc, p) => {
    return acc + (p.stock || 0) * (p.price || 0);
  }, 0);

  const rawStockValue = state.rawStock.reduce((acc, item) => {
    const w = item.weight !== undefined ? item.weight : (item.initialWeight || 0);
    const q = item.quantity !== undefined ? item.quantity : (item.items !== undefined ? item.items : (item.initialQuantity || item.initialItems || 0));
    // Average raw steel price 290 Rs/kg, fittings 15 Rs/pc
    const wVal = w * 290;
    const qVal = q * 15;
    return acc + wVal + qVal;
  }, 0);

  const totalAssetValuation = cashInHand + totalReceivables + finishedGoodsValue + rawStockValue - totalPayables;

  // 4. PERIOD-FILTERED SALES & ORDERS
  const filteredSalesTxns = state.transactions.filter(t => matchesPeriod(t.date, salesPeriod));
  const periodSalesTotal = filteredSalesTxns.reduce((s, t) => s + t.total, 0);
  const periodOrdersCount = filteredSalesTxns.length;
  const periodItemsSold = filteredSalesTxns.reduce((s, t) => s + (t.itemCount || 0), 0);
  const periodAvgSale = periodOrdersCount > 0 ? periodSalesTotal / periodOrdersCount : 0;

  // 5. PERIOD-FILTERED EXPENSES & COST OF GOODS
  const filteredExpenses = state.expenses.filter(e => matchesPeriod(e.date, summaryPeriod));
  const periodExpensesTotal = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  const filteredMaterialPayments = state.rawSuppliers.reduce((acc, s) => {
    return (
      acc +
      s.entries
        .filter(e => matchesPeriod(e.date, summaryPeriod))
        .reduce((sum, e) => sum + (e.debit || 0), 0)
    );
  }, 0);

  const filteredLabourPayments = (state.workers || state.labourWorkers || []).reduce((acc, w) => {
    return (
      acc +
      w.entries
        .filter(e => matchesPeriod(e.date, summaryPeriod))
        .reduce((sum, e) => sum + (e.debit || 0), 0)
    );
  }, 0);

  const filteredPainterPayments = state.painters.reduce((acc, p) => {
    return (
      acc +
      p.entries
        .filter(e => matchesPeriod(e.date, summaryPeriod))
        .reduce((sum, e) => sum + (e.debit || 0), 0)
    );
  }, 0);

  const filteredWithdrawals = state.withdrawals.filter(w => !w.isReversed && matchesPeriod(w.date, summaryPeriod));
  const periodWithdrawalsTotal = filteredWithdrawals.reduce((s, w) => s + w.amount, 0);

  const summarySalesTxns = state.transactions.filter(t => matchesPeriod(t.date, summaryPeriod));
  const summarySalesTotal = summarySalesTxns.reduce((s, t) => s + t.total, 0);

  const periodGrossProfit =
    summarySalesTotal - (filteredMaterialPayments + filteredLabourPayments + filteredPainterPayments);
  const periodNetProfit =
    summarySalesTotal -
    periodExpensesTotal -
    (filteredMaterialPayments + filteredLabourPayments + filteredPainterPayments) -
    periodWithdrawalsTotal;

  return {
    cashInHand,
    cashInflow,
    cashOutflow,
    totalReceivables,
    totalPayables,
    supplierPayables,
    painterPayables,
    labourPayables,
    finishedGoodsValue,
    rawStockValue,
    totalAssetValuation,
    // Sales module
    periodSalesTotal,
    periodOrdersCount,
    periodItemsSold,
    periodAvgSale,
    // Summary module
    summarySalesTotal,
    periodExpensesTotal,
    filteredMaterialPayments,
    filteredLabourPayments,
    filteredPainterPayments,
    periodWithdrawalsTotal,
    periodGrossProfit,
    periodNetProfit
  };
}
