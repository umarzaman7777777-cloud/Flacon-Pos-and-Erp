import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';
import {
  TrendingUp,
  CreditCard,
  Layers,
  ChevronDown,
  ChevronUp,
  Coins,
  BarChart3,
  PieChart,
  Calendar,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Boxes,
  Users
} from 'lucide-react';
import { AppState, AppLanguage } from '../types';
import { fmt, parseDMY } from '../utils/helpers';
import { computeSystemFinancials, computeCustomerLedgerDetails } from '../utils/mathEngine';

interface OverviewViewProps {
  state: AppState;
  language: AppLanguage;
  onNavigate: (view: any) => void;
  onOpenCustomerLedger: (factoryName: string) => void;
}

export type DateRangePreset = 
  | '30days'
  | '7days'
  | 'thisMonth'
  | 'currentQuarter'
  | 'lastQuarter'
  | 'thisYear'
  | 'custom';

export const OverviewView: React.FC<OverviewViewProps> = ({
  state,
  language,
  onNavigate,
  onOpenCustomerLedger
}) => {
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [salesPeriod, setSalesPeriod] = useState('monthly');
  const [summaryPeriod, setSummaryPeriod] = useState('monthly');
  const [chartMetricView, setChartMetricView] = useState<'weekly_sales' | 'monthly_profit'>('weekly_sales');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('30days');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [chartTimespan, setChartTimespan] = useState<'7days' | '30days'>('30days');
  const [monthlyRange, setMonthlyRange] = useState<'6months' | '12months'>('6months');
  const [activeChartBar, setActiveChartBar] = useState<number | null>(null);

  // Calendar Calculation
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDow = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;

  // Compute live mathematical financials using unified math engine
  const fin = computeSystemFinancials(state, salesPeriod, summaryPeriod);

  // Leaderboard of who owes the most (Receivables)
  const debtorFactories = useMemo(() => {
    return state.customerLedgers
      .map(cl => {
        const details = computeCustomerLedgerDetails(cl.entries);
        return { name: cl.name, balance: details.netBalance };
      })
      .filter(f => f.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 4);
  }, [state.customerLedgers]);

  // Recent activity log
  const recentActivities = useMemo(() => {
    return [
      ...state.transactions.slice(0, 4).map(t => ({
        id: `tx_${t.id}`,
        type: 'sale',
        title: `Order #${t.id} - ${t.factory || 'Walk-in'}`,
        titleUr: `آرڈر #${t.id} - ${t.factory || 'واک ان گاہک'}`,
        sub: `${t.date} · ${t.itemsSummary.replace(/\n/g, ', ')}`,
        amount: t.total,
        positive: t.paid
      })),
      ...state.expenses.slice(0, 4).map(e => ({
        id: `exp_${e.id}`,
        type: 'expense',
        title: `${e.category}: ${e.desc}`,
        titleUr: `خرچ: ${e.category} (${e.desc})`,
        sub: `${e.date} · ${e.method}`,
        amount: e.amount,
        positive: false
      }))
    ].slice(0, 6);
  }, [state.transactions, state.expenses]);

  // Robust date parser
  const parseDateRobust = (dStr: string | null | undefined): Date | null => {
    if (!dStr) return null;
    const p = parseDMY(dStr);
    if (p && !isNaN(p.getTime())) return p;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // Compute active date boundaries and label based on dateRangePreset
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let start = new Date(now);
    let end = new Date(now);
    let labelEn = 'Last 30 Days';
    let labelUr = 'آخری ۳۰ دن';

    if (dateRangePreset === '30days') {
      start = new Date(now);
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      labelEn = 'Last 30 Days';
      labelUr = 'آخری ۳۰ دن';
    } else if (dateRangePreset === '7days') {
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      labelEn = 'Last 7 Days';
      labelUr = 'آخری ۷ دن';
    } else if (dateRangePreset === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      labelEn = 'This Month';
      labelUr = 'موجودہ مہینہ';
    } else if (dateRangePreset === 'currentQuarter') {
      const qIndex = Math.floor(now.getMonth() / 3); // 0: Jan-Mar, 1: Apr-Jun, 2: Jul-Sep, 3: Oct-Dec
      start = new Date(now.getFullYear(), qIndex * 3, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), (qIndex + 1) * 3, 0, 23, 59, 59, 999);
      labelEn = `Current Quarter (Q${qIndex + 1} ${now.getFullYear()})`;
      labelUr = `موجودہ سہ ماہی (Q${qIndex + 1})`;
    } else if (dateRangePreset === 'lastQuarter') {
      const currentQ = Math.floor(now.getMonth() / 3);
      const prevQ = currentQ === 0 ? 3 : currentQ - 1;
      const year = currentQ === 0 ? now.getFullYear() - 1 : now.getFullYear();
      start = new Date(year, prevQ * 3, 1, 0, 0, 0, 0);
      end = new Date(year, (prevQ + 1) * 3, 0, 23, 59, 59, 999);
      labelEn = `Last Quarter (Q${prevQ + 1} ${year})`;
      labelUr = `گزشتہ سہ ماہی (Q${prevQ + 1})`;
    } else if (dateRangePreset === 'thisYear') {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      labelEn = `Current Year (${now.getFullYear()})`;
      labelUr = `موجودہ سال (${now.getFullYear()})`;
    } else if (dateRangePreset === 'custom') {
      if (customStartDate) {
        const parts = customStartDate.split('-').map(Number);
        start = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      }
      if (customEndDate) {
        const parts = customEndDate.split('-').map(Number);
        end = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
      }
      labelEn = 'Custom Range';
      labelUr = 'مخصوص مدت';
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const dateSpanText = `${pad(start.getDate())}/${pad(start.getMonth() + 1)} – ${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${end.getFullYear()}`;
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    return { start, end, labelEn, labelUr, dateSpanText, totalDays };
  }, [dateRangePreset, customStartDate, customEndDate]);

  // Build timeline data for the bilingual chart respecting the dateRangeBounds
  const chartData = useMemo(() => {
    const { start, end, totalDays } = dateRangeBounds;
    const days = [];
    const urduDays = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
    const engDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    if (totalDays <= 35) {
      // Day-by-day points for intervals <= 35 days
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const targetDate = new Date(d);
        const dayNum = targetDate.getDate();
        const monthNum = targetDate.getMonth() + 1;
        const dateKeyDMY = `${String(dayNum).padStart(2, '0')}/${String(monthNum).padStart(2, '0')}/${targetDate.getFullYear()}`;
        const dayOfWeek = targetDate.getDay();

        const dayTransactions = state.transactions.filter(t => {
          const tDate = parseDateRobust(t.date);
          if (!tDate) return false;
          return (
            tDate.getDate() === targetDate.getDate() &&
            tDate.getMonth() === targetDate.getMonth() &&
            tDate.getFullYear() === targetDate.getFullYear()
          );
        });

        const daySales = dayTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
        const ordersCount = dayTransactions.length;
        const cashReceived = dayTransactions.reduce((sum, t) => {
          const paidVal = typeof t.paid === 'number' ? t.paid : (t.paid === true ? (t.total || 0) : 0);
          return sum + paidVal;
        }, 0);
        const creditReceivable = Math.max(0, daySales - cashReceived);

        const itemsCount = dayTransactions.reduce((sum, t) => {
          const match = (t.itemsSummary || '').match(/(\d+)\s*(?:pcs|items|rods|عدد)/i);
          return sum + (match ? parseInt(match[1], 10) : 1);
        }, 0);

        const dayExpenseItems = state.expenses.filter(e => {
          const eDate = parseDateRobust(e.date);
          if (!eDate) return false;
          return (
            eDate.getDate() === targetDate.getDate() &&
            eDate.getMonth() === targetDate.getMonth() &&
            eDate.getFullYear() === targetDate.getFullYear()
          );
        });

        const dayExpenses = dayExpenseItems.reduce((sum, e) => sum + (e.amount || 0), 0);
        const expenseCount = dayExpenseItems.length;
        const netProfit = daySales - dayExpenses;
        const marginPct = daySales > 0 ? Math.round((netProfit / daySales) * 100) : 0;

        days.push({
          date: dateKeyDMY,
          dayLabel: `${dayNum}/${monthNum}`,
          engDay: totalDays <= 8 ? engDays[dayOfWeek] : `${dayNum}/${monthNum}`,
          urduDay: totalDays <= 8 ? urduDays[dayOfWeek] : `${dayNum}`,
          sales: daySales,
          expenses: dayExpenses,
          netProfit,
          ordersCount,
          itemsCount,
          cashReceived,
          creditReceivable,
          expenseCount,
          marginPct
        });
      }
    } else {
      // Grouping by weekly buckets for wider intervals (e.g. Current Quarter, Last Quarter, Year)
      const bucketSpanDays = totalDays > 120 ? 14 : 7;
      let weekIndex = 1;
      for (let cur = new Date(start); cur <= end; ) {
        const wStart = new Date(cur);
        const wEnd = new Date(cur);
        wEnd.setDate(wEnd.getDate() + bucketSpanDays - 1);
        if (wEnd > end) wEnd.setTime(end.getTime());

        const bucketTx = state.transactions.filter(t => {
          const td = parseDateRobust(t.date);
          if (!td) return false;
          return td >= wStart && td <= wEnd;
        });

        const bucketExp = state.expenses.filter(e => {
          const ed = parseDateRobust(e.date);
          if (!ed) return false;
          return ed >= wStart && ed <= wEnd;
        });

        const sales = bucketTx.reduce((sum, t) => sum + (t.total || 0), 0);
        const expenses = bucketExp.reduce((sum, e) => sum + (e.amount || 0), 0);
        const netProfit = sales - expenses;
        const marginPct = sales > 0 ? Math.round((netProfit / sales) * 100) : 0;
        const ordersCount = bucketTx.length;
        const expenseCount = bucketExp.length;

        const pad = (n: number) => String(n).padStart(2, '0');
        const spanLabel = `${pad(wStart.getDate())}/${pad(wStart.getMonth()+1)}–${pad(wEnd.getDate())}/${pad(wEnd.getMonth()+1)}`;

        days.push({
          date: `${spanLabel} (${wStart.getFullYear()})`,
          dayLabel: spanLabel,
          engDay: `W${weekIndex}`,
          urduDay: `ہفتہ ${weekIndex}`,
          sales,
          expenses,
          netProfit,
          ordersCount,
          itemsCount: bucketTx.reduce((sum, t) => {
            const match = (t.itemsSummary || '').match(/(\d+)\s*(?:pcs|items|rods|عدد)/i);
            return sum + (match ? parseInt(match[1], 10) : 1);
          }, 0),
          cashReceived: bucketTx.reduce((sum, t) => {
            const paidVal = typeof t.paid === 'number' ? t.paid : (t.paid === true ? (t.total || 0) : 0);
            return sum + paidVal;
          }, 0),
          creditReceivable: Math.max(0, sales - bucketTx.reduce((sum, t) => {
            const paidVal = typeof t.paid === 'number' ? t.paid : (t.paid === true ? (t.total || 0) : 0);
            return sum + paidVal;
          }, 0)),
          expenseCount,
          marginPct
        });

        weekIndex++;
        cur.setDate(cur.getDate() + bucketSpanDays);
      }
    }

    const maxVal = Math.max(...days.map(d => Math.max(d.sales, d.expenses)), 1000);

    return {
      days,
      maxVal,
      totalSales: days.reduce((acc, d) => acc + d.sales, 0),
      totalExpenses: days.reduce((acc, d) => acc + d.expenses, 0),
      totalNet: days.reduce((acc, d) => acc + d.netProfit, 0)
    };
  }, [state.transactions, state.expenses, dateRangeBounds]);

  // Build monthly financial profit analysis data matching date boundaries
  const monthlyProfitData = useMemo(() => {
    const { start, end } = dateRangeBounds;
    const urduMonths = [
      'جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 
      'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'
    ];
    const engMonths = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    let monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthEnd = new Date(end.getFullYear(), end.getMonth(), 1);

    const diffMonths = (monthEnd.getFullYear() - monthStart.getFullYear()) * 12 + (monthEnd.getMonth() - monthStart.getMonth()) + 1;
    if (diffMonths <= 2) {
      // If the selected interval is short, provide context by showing past 6 months ending at monthEnd
      monthStart = new Date(monthEnd.getFullYear(), monthEnd.getMonth() - 5, 1);
    }

    const months = [];
    for (let m = new Date(monthStart); m <= monthEnd; m.setMonth(m.getMonth() + 1)) {
      const targetYear = m.getFullYear();
      const targetMonth = m.getMonth();

      const monthTransactions = state.transactions.filter(t => {
        const td = parseDateRobust(t.date);
        if (!td) return false;
        return td.getFullYear() === targetYear && td.getMonth() === targetMonth;
      });

      const monthExpenseItems = state.expenses.filter(e => {
        const ed = parseDateRobust(e.date);
        if (!ed) return false;
        return ed.getFullYear() === targetYear && ed.getMonth() === targetMonth;
      });

      const monthSales = monthTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
      const monthExpenses = monthExpenseItems.reduce((sum, e) => sum + (e.amount || 0), 0);
      const netProfit = monthSales - monthExpenses;
      const marginPct = monthSales > 0 ? Math.round((netProfit / monthSales) * 100) : 0;
      const ordersCount = monthTransactions.length;
      const expenseCount = monthExpenseItems.length;

      const shortYear = String(targetYear).slice(2);
      const monthLabel = `${engMonths[targetMonth]} '${shortYear}`;
      const urduMonthLabel = `${urduMonths[targetMonth]}`;

      months.push({
        key: `${targetYear}-${targetMonth}`,
        monthLabel,
        engMonth: engMonths[targetMonth],
        urduMonth: urduMonthLabel,
        fullYear: targetYear,
        sales: monthSales,
        expenses: monthExpenses,
        netProfit,
        marginPct,
        ordersCount,
        expenseCount,
        isProfitable: netProfit >= 0
      });
    }

    const totalSales = months.reduce((acc, m) => acc + m.sales, 0);
    const totalExpenses = months.reduce((acc, m) => acc + m.expenses, 0);
    const totalNet = months.reduce((acc, m) => acc + m.netProfit, 0);
    const avgMonthlyProfit = Math.round(totalNet / (months.length || 1));
    const avgMargin = totalSales > 0 ? Math.round((totalNet / totalSales) * 100) : 0;
    const bestMonth = [...months].sort((a, b) => b.netProfit - a.netProfit)[0] || months[0];

    return {
      months,
      totalSales,
      totalExpenses,
      totalNet,
      avgMonthlyProfit,
      avgMargin,
      bestMonth
    };
  }, [state.transactions, state.expenses, dateRangeBounds]);

  // Product category breakdown (Ceiling vs Pedestal)
  const productMix = useMemo(() => {
    let ceilingStock = 0;
    let ceilingVal = 0;
    let pedestalStock = 0;
    let pedestalVal = 0;

    state.products.forEach(p => {
      const isPedestal = (p.cat || p.name || '').toLowerCase().includes('pedestal');
      const qty = p.stock || 0;
      const price = p.price || 0;
      if (isPedestal) {
        pedestalStock += qty;
        pedestalVal += qty * price;
      } else {
        ceilingStock += qty;
        ceilingVal += qty * price;
      }
    });

    const totalStock = ceilingStock + pedestalStock;
    const ceilingPct = totalStock > 0 ? Math.round((ceilingStock / totalStock) * 100) : 50;
    const pedestalPct = totalStock > 0 ? 100 - ceilingPct : 50;

    return {
      ceilingStock,
      ceilingVal,
      ceilingPct,
      pedestalStock,
      pedestalVal,
      pedestalPct,
      totalStock
    };
  }, [state.products]);

  // Helper for dual English + Urdu labels
  const renderBilingual = (en: string, ur: string, className = '', urClassName = '') => (
    <div className={`flex flex-col text-left ${className}`}>
      <span className="leading-tight">{en}</span>
      <span className={`text-[10.5px] font-serif opacity-80 leading-tight -mt-0.5 ${urClassName}`}>{ur}</span>
    </div>
  );

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden break-words">
      {/* Header with Bilingual Brand & Title */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-[var(--steel-line)] pb-4">
        <div className="flex items-center gap-3">
          <div className="relative group shrink-0 flex items-center justify-center p-1 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-[0_4px_20px_rgba(245,183,0,0.2)] hover:border-amber-400 transition-all">
            <div className="absolute inset-0 rounded-2xl bg-amber-500/20 blur-md pointer-events-none group-hover:bg-amber-500/35 transition-all" />
            <img
              src="/falcon-theme-rod-logo.svg"
              alt="Falcon Rod Maker"
              className="relative z-10 h-11 w-auto object-contain select-none drop-shadow-[0_2px_12px_rgba(245,183,0,0.45)] transition-transform duration-200 group-hover:scale-105 rounded-xl"
            />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="font-serif font-black text-2xl text-[var(--text)]">Business Overview</h2>
              <span className="font-serif text-lg font-bold text-[var(--yellow)]">کاروباری جائزہ</span>
            </div>
            <p className="text-xs text-[var(--text-dim)] mt-0.5 flex items-center gap-2">
              <span>Real-time Financial Analytics & POS Performance</span>
              <span className="opacity-40">|</span>
              <span className="font-serif text-[11px] opacity-80">براہِ راست مالیاتی تجزیہ اور ورکشاپ حسابات</span>
            </p>
          </div>
        </div>

        {/* Quick Jump Badges */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('sales')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--text)] transition cursor-pointer"
          >
            <TrendingUp size={14} className="text-[var(--yellow)]" />
            {renderBilingual('Sales POS', 'سیلز کاؤنٹر')}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('stock')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--steel-line)] bg-[var(--panel-raised)] hover:border-[var(--yellow)] text-xs font-semibold text-[var(--text)] transition cursor-pointer"
          >
            <Boxes size={14} className="text-emerald-400" />
            {renderBilingual('Stock Room', 'اسٹاک گودام')}
          </button>
        </div>
      </div>

      {/* Month Calendar Panel (Bilingual) */}
      <div
        onClick={() => setCalendarExpanded(!calendarExpanded)}
        className={`bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl p-4 cursor-pointer transition-all duration-300 ${
          calendarExpanded ? 'w-full shadow-lg' : 'w-fit'
        }`}
      >
        <div className="flex items-center gap-6">
          <div className="shrink-0">
            <div className="font-mono font-bold text-2xl text-[var(--text)] leading-none">
              {now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            <div className="font-mono text-xs uppercase tracking-wider text-[var(--yellow)] mt-1 font-semibold flex items-center gap-2">
              <span>{now.toLocaleDateString('en-GB', { weekday: 'long' })}</span>
              <span className="font-serif font-normal normal-case text-amber-300 text-xs">
                {['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'][now.getDay()]}
              </span>
            </div>
          </div>
          <div className="text-xs text-[var(--text-dim)] flex items-center gap-1.5 font-mono">
            <span>{calendarExpanded ? 'Collapse Calendar' : 'Expand Month'}</span>
            <span className="font-serif opacity-75">({calendarExpanded ? 'بند کریں' : 'کیلنڈر کھولیں'})</span>
            {calendarExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>

        {calendarExpanded && (
          <div className="mt-4 pt-4 border-t border-[var(--steel-line)]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-mono font-bold text-[var(--yellow)] uppercase tracking-wider">
                {now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </div>
              <span className="font-serif text-xs text-amber-300">
                ماہانہ کیلنڈر و تاریخ
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 max-w-sm text-center font-mono">
              {[
                { en: 'M', ur: 'پ' },
                { en: 'T', ur: 'م' },
                { en: 'W', ur: 'ب' },
                { en: 'T', ur: 'ج' },
                { en: 'F', ur: 'ج' },
                { en: 'S', ur: 'ہ' },
                { en: 'S', ur: 'ا' }
              ].map((d, idx) => (
                <div key={idx} className="text-[10px] text-[var(--text-dim)] py-0.5 font-bold flex flex-col items-center">
                  <span>{d.en}</span>
                  <span className="font-serif text-[9px] opacity-70 -mt-0.5">{d.ur}</span>
                </div>
              ))}
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`blank_${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const isToday = dayNum === today;
                return (
                  <div
                    key={dayNum}
                    className={`py-1 text-xs rounded transition-all ${
                      isToday ? 'bg-[var(--yellow)] text-black font-bold shadow-md scale-105' : 'text-[var(--text)] hover:bg-[var(--panel)]'
                    }`}
                  >
                    {dayNum}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION: BILINGUAL INTERACTIVE CHARTS & VISUAL ANALYTICS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Chart: Financial Performance & Sales vs Expenses Trend */}
        <div className="lg:col-span-2 bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            {/* Chart Header & Timespan / View Toggle */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold border transition-colors ${
                  chartMetricView === 'weekly_sales'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  {chartMetricView === 'weekly_sales' ? <BarChart3 size={18} /> : <TrendingUp size={18} />}
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-serif font-bold text-base text-[var(--text)]">
                      {chartMetricView === 'weekly_sales' ? 'Weekly Sales Trend' : 'Monthly Profit Analysis'}
                    </h3>
                    <span className={`font-serif text-sm font-semibold ${
                      chartMetricView === 'weekly_sales' ? 'text-[var(--yellow)]' : 'text-emerald-400'
                    }`}>
                      {chartMetricView === 'weekly_sales' ? 'ہفتہ وار سیلز کا رجحان' : 'ماہانہ منافع اور مارجن'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-dim)] font-mono">
                    {chartMetricView === 'weekly_sales'
                      ? 'Daily comparative revenue vs workshop operational costs'
                      : 'Monthly net workshop profit, gross revenue and margin trends'}
                  </p>
                </div>
              </div>

              {/* View & Period Switcher Controls */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Physical Interactive Toggle Switch: Weekly Sales <-> Monthly Profit */}
                <div className="flex items-center gap-2.5 bg-[var(--panel-raised)] border border-[var(--steel-line)] px-2.5 py-1 rounded-xl shadow-xs">
                  {/* Left Option Label: Weekly Sales */}
                  <button
                    type="button"
                    onClick={() => {
                      if (chartMetricView !== 'weekly_sales') {
                        setChartMetricView('weekly_sales');
                        setActiveChartBar(null);
                      }
                    }}
                    className={`flex items-center gap-1.5 text-xs font-mono font-bold transition-all duration-200 cursor-pointer select-none ${
                      chartMetricView === 'weekly_sales'
                        ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,183,0,0.5)] font-black scale-102'
                        : 'text-[var(--text-dim)] hover:text-[var(--text)] opacity-70 hover:opacity-100'
                    }`}
                    title="Switch to Weekly Sales visualization"
                  >
                    <BarChart3 size={13} className={chartMetricView === 'weekly_sales' ? 'text-amber-400' : 'text-slate-400'} />
                    <span>Weekly Sales</span>
                    <span className="font-serif text-[10px] font-normal opacity-80">(ہفتہ وار)</span>
                  </button>

                  {/* Physical Sliding Switch Track & Thumb */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={chartMetricView === 'monthly_profit'}
                    aria-label="Toggle between Weekly Sales and Monthly Profit"
                    onClick={() => {
                      setChartMetricView(prev => (prev === 'weekly_sales' ? 'monthly_profit' : 'weekly_sales'));
                      setActiveChartBar(null);
                    }}
                    className={`relative inline-flex h-5.5 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--steel-line)] transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-amber-400/40 ${
                      chartMetricView === 'monthly_profit'
                        ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                        : 'bg-amber-500 shadow-[0_0_10px_rgba(245,183,0,0.5)]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out my-auto ${
                        chartMetricView === 'monthly_profit' ? 'translate-x-5.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>

                  {/* Right Option Label: Monthly Profit */}
                  <button
                    type="button"
                    onClick={() => {
                      if (chartMetricView !== 'monthly_profit') {
                        setChartMetricView('monthly_profit');
                        setActiveChartBar(null);
                      }
                    }}
                    className={`flex items-center gap-1.5 text-xs font-mono font-bold transition-all duration-200 cursor-pointer select-none ${
                      chartMetricView === 'monthly_profit'
                        ? 'text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] font-black scale-102'
                        : 'text-[var(--text-dim)] hover:text-[var(--text)] opacity-70 hover:opacity-100'
                    }`}
                    title="Switch to Monthly Profit visualization"
                  >
                    <TrendingUp size={13} className={chartMetricView === 'monthly_profit' ? 'text-emerald-400' : 'text-slate-400'} />
                    <span>Monthly Profit</span>
                    <span className="font-serif text-[10px] font-normal opacity-80">(ماہانہ منافع)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* DATE RANGE PICKER: DYNAMIC FINANCIAL INTERVAL FILTER                     */}
            {/* ========================================================================= */}
            <div className="bg-[var(--panel-raised)]/90 border border-[var(--steel-line)] rounded-xl p-3 mb-4 shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-2.5">
                {/* Left: Active Date Range Label & Interval Summary */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold border border-amber-500/30">
                    <Calendar size={14} />
                  </div>
                  <div className="text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[var(--text)]">Interval:</span>
                      <span className="text-amber-300 font-bold">{dateRangeBounds.labelEn}</span>
                      <span className="font-serif text-[11px] text-[var(--yellow)] opacity-90">({dateRangeBounds.labelUr})</span>
                    </div>
                    <div className="text-[10.5px] text-[var(--text-dim)]">
                      {dateRangeBounds.dateSpanText} <span className="text-slate-400">({dateRangeBounds.totalDays} days)</span>
                    </div>
                  </div>
                </div>

                {/* Right: Date Range Preset Pills */}
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { id: '30days', labelEn: 'Last 30 Days', labelUr: '۳۰ دن' },
                    { id: '7days', labelEn: 'Last 7 Days', labelUr: '۷ دن' },
                    { id: 'thisMonth', labelEn: 'This Month', labelUr: 'موجودہ مہینہ' },
                    { id: 'currentQuarter', labelEn: 'Current Quarter', labelUr: 'موجودہ سہ ماہی' },
                    { id: 'lastQuarter', labelEn: 'Last Quarter', labelUr: 'گزشتہ سہ ماہی' },
                    { id: 'thisYear', labelEn: 'This Year', labelUr: 'سال' },
                    { id: 'custom', labelEn: 'Custom', labelUr: 'مخصوص' },
                  ].map(preset => {
                    const isActive = dateRangePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setDateRangePreset(preset.id as DateRangePreset);
                          setActiveChartBar(null);
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-mono transition cursor-pointer flex items-center gap-1 border ${
                          isActive
                            ? 'bg-amber-400 text-black border-amber-300 font-black shadow-xs'
                            : 'bg-[var(--panel)] text-[var(--text-dim)] hover:text-[var(--text)] border-[var(--steel-line)] hover:border-slate-500'
                        }`}
                      >
                        <span>{preset.labelEn}</span>
                        <span className="font-serif text-[10px] opacity-80">({preset.labelUr})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Date Range Selectors */}
              {dateRangePreset === 'custom' && (
                <div className="mt-2.5 pt-2.5 border-t border-[var(--steel-line)] flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-1.5 text-[var(--text-dim)]">
                      <span>From (شروع):</span>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={e => setCustomStartDate(e.target.value)}
                        className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-md px-2 py-0.5 text-white font-mono focus:border-amber-400 focus:outline-none"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[var(--text-dim)]">
                      <span>To (اختتام):</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={e => setCustomEndDate(e.target.value)}
                        className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-md px-2 py-0.5 text-white font-mono focus:border-amber-400 focus:outline-none"
                      />
                    </label>
                  </div>
                  <span className="text-[11px] text-amber-300">
                    Selected: {customStartDate} to {customEndDate}
                  </span>
                </div>
              )}
            </div>

            {/* Dynamic Bilingual Legend & Summary Bar */}
            <div className="flex items-center justify-between flex-wrap gap-4 py-2 px-3 rounded-lg bg-[var(--panel-raised)]/70 border border-[var(--steel-line)] mb-4 text-xs font-mono">
              {chartMetricView === 'weekly_sales' ? (
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Sales Legend */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-amber-400 shrink-0" />
                    <span className="font-semibold text-amber-300">Sales Turnover</span>
                    <span className="font-serif text-[11px] text-amber-200/80">(سیلز آمدن)</span>
                  </div>
                  {/* Expenses Legend */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-rose-500 shrink-0" />
                    <span className="font-semibold text-rose-300">Expenses</span>
                    <span className="font-serif text-[11px] text-rose-200/80">(اخراجات)</span>
                  </div>
                  {/* Net Profit Legend */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-emerald-400 shrink-0" />
                    <span className="font-semibold text-emerald-300">Net Flow</span>
                    <span className="font-serif text-[11px] text-emerald-200/80">(خالص کیش)</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Monthly Net Profit Legend */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                    <span className="font-bold text-emerald-300">Net Profit</span>
                    <span className="font-serif text-[11px] text-emerald-200/80">(خالص منافع)</span>
                  </div>
                  {/* Monthly Sales Legend */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-amber-400 shrink-0" />
                    <span className="font-semibold text-amber-300">Gross Sales</span>
                    <span className="font-serif text-[11px] text-amber-200/80">(کل سیلز)</span>
                  </div>
                  {/* Expenses Reference */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-rose-500 shrink-0" />
                    <span className="font-semibold text-rose-300">Expenses</span>
                    <span className="font-serif text-[11px] text-rose-200/80">(اخراجات)</span>
                  </div>
                </div>
              )}

              {/* Totals Pill */}
              <div className="text-[11px] font-bold text-[var(--text-dim)]">
                {chartMetricView === 'weekly_sales' ? (
                  <>
                    Net: <span className={chartData.totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {chartData.totalNet >= 0 ? '+' : ''}{fmt(chartData.totalNet)}
                    </span>
                  </>
                ) : (
                  <>
                    Period Profit: <span className={monthlyProfitData.totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {monthlyProfitData.totalNet >= 0 ? '+' : ''}{fmt(monthlyProfitData.totalNet)}
                    </span>
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {monthlyProfitData.avgMargin}% Margin
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Interactive Bilingual Recharts Bar Chart Area */}
            <div className="relative pt-2 pb-1 w-full min-h-[250px]">
              <ResponsiveContainer key={`resp-container-${chartMetricView}-${dateRangePreset}-${dateRangeBounds.dateSpanText}`} width="100%" height={250}>
                {chartMetricView === 'weekly_sales' ? (
                  /* ======================================================== */
                  /* VIEW 1: SALES TURNOVER VS OPERATIONAL EXPENSES           */
                  /* ======================================================== */
                  <BarChart
                    key={`barchart-weekly-sales-${dateRangePreset}-${dateRangeBounds.dateSpanText}`}
                    data={chartData.days}
                    margin={{ top: 12, right: 12, left: -16, bottom: 22 }}
                    barGap={4}
                    onMouseMove={(state: any) => {
                      if (state && typeof state.activeTooltipIndex === 'number') {
                        setActiveChartBar(state.activeTooltipIndex);
                      }
                    }}
                    onMouseLeave={() => setActiveChartBar(null)}
                  >
                    <defs>
                      <linearGradient id="falconGoldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FEF08A" stopOpacity={1} />
                        <stop offset="25%" stopColor="#F5B700" stopOpacity={1} />
                        <stop offset="70%" stopColor="#D97706" stopOpacity={0.94} />
                        <stop offset="100%" stopColor="#92400E" stopOpacity={0.88} />
                      </linearGradient>

                      <linearGradient id="falconGoldActiveGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
                        <stop offset="25%" stopColor="#FDE047" stopOpacity={1} />
                        <stop offset="70%" stopColor="#F59E0B" stopOpacity={1} />
                        <stop offset="100%" stopColor="#B45309" stopOpacity={0.96} />
                      </linearGradient>

                      <linearGradient id="falconRubyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FB7185" stopOpacity={0.92} />
                        <stop offset="45%" stopColor="#E11D48" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#881337" stopOpacity={0.72} />
                      </linearGradient>

                      <filter id="falconGoldGlow" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#F5B700" floodOpacity="0.45" />
                      </filter>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--steel-line)"
                      vertical={false}
                      opacity={0.35}
                    />

                    <XAxis
                      dataKey="engDay"
                      interval={0}
                      stroke="var(--steel-line)"
                      tick={(props: any) => {
                        const { x, y, payload } = props;
                        const item = chartData.days[payload.index] || chartData.days.find(d => d.engDay === payload.value || d.dayLabel === payload.value);
                        if (!item) return null;
                        const isHovered = activeChartBar === payload.index;
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text
                              x={0}
                              y={0}
                              dy={12}
                              textAnchor="middle"
                              fill={isHovered ? '#FDE047' : 'var(--text)'}
                              fontSize={11}
                              fontFamily="monospace"
                              fontWeight={isHovered ? 700 : 600}
                              style={{ transition: 'fill 0.2s ease' }}
                            >
                              {chartTimespan === '7days' ? item.engDay : item.dayLabel}
                            </text>
                            <text
                              x={0}
                              y={0}
                              dy={25}
                              textAnchor="middle"
                              fill={isHovered ? '#FEF08A' : 'var(--yellow)'}
                              fontSize={9.5}
                              fontFamily="Noto Nastaliq Urdu, serif"
                              opacity={isHovered ? 1 : 0.85}
                              style={{ transition: 'fill 0.2s ease, opacity 0.2s ease' }}
                            >
                              {item.urduDay}
                            </text>
                          </g>
                        );
                      }}
                    />

                    <YAxis
                      stroke="var(--steel-line)"
                      tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val: number) => {
                        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                        if (val >= 1000) return `${Math.round(val / 1000)}k`;
                        return `${val}`;
                      }}
                    />

                    <Tooltip
                      cursor={{
                        fill: 'rgba(245, 183, 0, 0.06)',
                        stroke: 'rgba(245, 183, 0, 0.22)',
                        strokeWidth: 1,
                        strokeDasharray: '3 3'
                      }}
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const isProfitable = data.netProfit >= 0;
                          return (
                            <div className="bg-[#0b1220]/95 backdrop-blur-xl text-white rounded-xl p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.85)] border border-amber-500/40 text-xs font-mono min-w-56 z-50">
                              <div className="border-b border-amber-500/20 pb-2 mb-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-amber-300 text-sm tracking-wide">
                                    {data.date}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    {data.engDay} · {data.urduDay}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between items-center bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/25">
                                  <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 inline-block shrink-0 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                                    <span>Daily Sales (سیلز):</span>
                                  </span>
                                  <span className="font-bold text-amber-200 text-sm">{fmt(data.sales)}</span>
                                </div>

                                <div className="flex justify-between items-center text-[11px] px-1 text-[var(--text-dim)]">
                                  <span>Orders Processed (آرڈرز):</span>
                                  <span className="font-bold text-white font-mono">{data.ordersCount} bills ({data.itemsCount} units)</span>
                                </div>

                                {data.sales > 0 && (
                                  <div className="flex justify-between items-center text-[10.5px] px-1 text-[var(--text-dim)]">
                                    <span>Cash vs Credit (کیش/ادھار):</span>
                                    <span className="font-mono text-emerald-400">
                                      {fmt(data.cashReceived)} <span className="text-[var(--text-dim)]">/</span> <span className="text-amber-400">{fmt(data.creditReceivable)}</span>
                                    </span>
                                  </div>
                                )}

                                <div className="flex justify-between items-center px-1 text-rose-300">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block shrink-0" />
                                    <span>Expenses ({data.expenseCount} اخراجات):</span>
                                  </span>
                                  <span className="font-bold text-rose-200">{fmt(data.expenses)}</span>
                                </div>

                                <div className={`flex justify-between items-center border-t border-slate-700/80 pt-2 px-1 font-semibold ${
                                  isProfitable ? 'text-emerald-400' : 'text-rose-400'
                                }`}>
                                  <div className="flex flex-col">
                                    <span>Net Cash Flow (خالص منافع):</span>
                                    <span className="text-[10px] opacity-75 font-normal">
                                      Margin: {data.marginPct}% ({isProfitable ? 'منافع بخش' : 'خسارہ'})
                                    </span>
                                  </div>
                                  <span className="text-sm font-bold">
                                    {isProfitable ? '+' : ''}{fmt(data.netProfit)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    {/* Daily Sales Bar */}
                    <Bar
                      dataKey="sales"
                      name="Daily Sales"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={chartTimespan === '7days' ? 34 : 14}
                      isAnimationActive={true}
                      animationDuration={950}
                      animationEasing="cubic-bezier(0.22, 1, 0.36, 1)"
                      animationBegin={40}
                    >
                      {chartData.days.map((_entry, index) => {
                        const isHovered = activeChartBar === index;
                        const hasActive = activeChartBar !== null;
                        return (
                          <Cell
                            key={`sales-cell-${index}`}
                            fill={isHovered ? 'url(#falconGoldActiveGrad)' : 'url(#falconGoldGrad)'}
                            filter={isHovered ? 'url(#falconGoldGlow)' : undefined}
                            stroke={isHovered ? '#FDE047' : '#D97706'}
                            strokeWidth={isHovered ? 1.5 : 0.5}
                            style={{
                              transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                              cursor: 'pointer',
                              opacity: hasActive && !isHovered ? 0.72 : 1
                            }}
                          />
                        );
                      })}
                    </Bar>

                    {/* Expenses Comparison Bar */}
                    <Bar
                      dataKey="expenses"
                      name="Expenses"
                      fill="url(#falconRubyGrad)"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={chartTimespan === '7days' ? 34 : 14}
                      isAnimationActive={true}
                      animationDuration={950}
                      animationEasing="cubic-bezier(0.22, 1, 0.36, 1)"
                      animationBegin={100}
                    >
                      {chartData.days.map((_entry, index) => {
                        const isHovered = activeChartBar === index;
                        const hasActive = activeChartBar !== null;
                        return (
                          <Cell
                            key={`exp-cell-${index}`}
                            stroke={isHovered ? '#FDA4AF' : 'transparent'}
                            strokeWidth={isHovered ? 1 : 0}
                            style={{
                              transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                              cursor: 'pointer',
                              opacity: hasActive && !isHovered ? 0.6 : 0.95
                            }}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                ) : (
                  /* ======================================================== */
                  /* VIEW 2: MONTHLY NET PROFIT & GROSS REVENUE ANALYSIS      */
                  /* ======================================================== */
                  <BarChart
                    key={`barchart-monthly-profit-${dateRangePreset}-${dateRangeBounds.dateSpanText}`}
                    data={monthlyProfitData.months}
                    margin={{ top: 12, right: 12, left: -16, bottom: 22 }}
                    barGap={6}
                    onMouseMove={(state: any) => {
                      if (state && typeof state.activeTooltipIndex === 'number') {
                        setActiveChartBar(state.activeTooltipIndex);
                      }
                    }}
                    onMouseLeave={() => setActiveChartBar(null)}
                  >
                    <defs>
                      {/* Emerald Net Profit Gradient */}
                      <linearGradient id="falconEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34D399" stopOpacity={1} />
                        <stop offset="30%" stopColor="#10B981" stopOpacity={1} />
                        <stop offset="70%" stopColor="#059669" stopOpacity={0.94} />
                        <stop offset="100%" stopColor="#064E3B" stopOpacity={0.88} />
                      </linearGradient>

                      {/* Active Radiant Emerald Glow */}
                      <linearGradient id="falconEmeraldActiveGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A7F3D0" stopOpacity={1} />
                        <stop offset="25%" stopColor="#6EE7B7" stopOpacity={1} />
                        <stop offset="70%" stopColor="#10B981" stopOpacity={1} />
                        <stop offset="100%" stopColor="#047857" stopOpacity={0.96} />
                      </linearGradient>

                      {/* Falcon Gold for Monthly Gross Revenue */}
                      <linearGradient id="falconGoldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FEF08A" stopOpacity={1} />
                        <stop offset="25%" stopColor="#F5B700" stopOpacity={1} />
                        <stop offset="70%" stopColor="#D97706" stopOpacity={0.94} />
                        <stop offset="100%" stopColor="#92400E" stopOpacity={0.88} />
                      </linearGradient>

                      <linearGradient id="falconGoldActiveGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
                        <stop offset="25%" stopColor="#FDE047" stopOpacity={1} />
                        <stop offset="70%" stopColor="#F59E0B" stopOpacity={1} />
                        <stop offset="100%" stopColor="#B45309" stopOpacity={0.96} />
                      </linearGradient>

                      <linearGradient id="falconRubyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FB7185" stopOpacity={0.92} />
                        <stop offset="45%" stopColor="#E11D48" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#881337" stopOpacity={0.72} />
                      </linearGradient>

                      <filter id="falconEmeraldGlow" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#10B981" floodOpacity="0.45" />
                      </filter>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--steel-line)"
                      vertical={false}
                      opacity={0.35}
                    />

                    <XAxis
                      dataKey="monthLabel"
                      interval={0}
                      stroke="var(--steel-line)"
                      tick={(props: any) => {
                        const { x, y, payload } = props;
                        const item = monthlyProfitData.months[payload.index] || monthlyProfitData.months.find(m => m.monthLabel === payload.value);
                        if (!item) return null;
                        const isHovered = activeChartBar === payload.index;
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text
                              x={0}
                              y={0}
                              dy={12}
                              textAnchor="middle"
                              fill={isHovered ? '#6EE7B7' : 'var(--text)'}
                              fontSize={11}
                              fontFamily="monospace"
                              fontWeight={isHovered ? 700 : 600}
                              style={{ transition: 'fill 0.2s ease' }}
                            >
                              {item.monthLabel}
                            </text>
                            <text
                              x={0}
                              y={0}
                              dy={25}
                              textAnchor="middle"
                              fill={isHovered ? '#A7F3D0' : '#10B981'}
                              fontSize={9.5}
                              fontFamily="Noto Nastaliq Urdu, serif"
                              opacity={isHovered ? 1 : 0.85}
                              style={{ transition: 'fill 0.2s ease, opacity 0.2s ease' }}
                            >
                              {item.urduMonth}
                            </text>
                          </g>
                        );
                      }}
                    />

                    <YAxis
                      stroke="var(--steel-line)"
                      tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val: number) => {
                        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                        if (val >= 1000) return `${Math.round(val / 1000)}k`;
                        return `${val}`;
                      }}
                    />

                    <Tooltip
                      cursor={{
                        fill: 'rgba(16, 185, 129, 0.06)',
                        stroke: 'rgba(16, 185, 129, 0.22)',
                        strokeWidth: 1,
                        strokeDasharray: '3 3'
                      }}
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const isProfitable = data.netProfit >= 0;
                          return (
                            <div className="bg-[#0b1420]/95 backdrop-blur-xl text-white rounded-xl p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.85)] border border-emerald-500/40 text-xs font-mono min-w-60 z-50">
                              {/* Header */}
                              <div className="border-b border-emerald-500/20 pb-2 mb-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-emerald-300 text-sm tracking-wide">
                                    {data.monthLabel}
                                  </span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                                    isProfitable
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                  }`}>
                                    {data.urduMonth} · {isProfitable ? 'منافع بخش' : 'خسارہ'}
                                  </span>
                                </div>
                              </div>

                              {/* Monthly Metric Breakdown */}
                              <div className="space-y-2">
                                {/* Primary Net Profit */}
                                <div className={`flex justify-between items-center px-2.5 py-1.5 rounded-lg border ${
                                  isProfitable
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
                                    : 'bg-rose-500/15 border-rose-500/30 text-rose-200'
                                }`}>
                                  <span className="flex items-center gap-1.5 font-bold">
                                    <span className={`w-2.5 h-2.5 rounded-xs inline-block shrink-0 ${
                                      isProfitable ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-rose-500'
                                    }`} />
                                    <span>Net Profit (خالص منافع):</span>
                                  </span>
                                  <span className="font-bold text-sm">
                                    {isProfitable ? '+' : ''}{fmt(data.netProfit)}
                                  </span>
                                </div>

                                {/* Gross Sales */}
                                <div className="flex justify-between items-center px-1 text-amber-300">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 inline-block shrink-0" />
                                    <span>Gross Sales (کل سیلز):</span>
                                  </span>
                                  <span className="font-bold font-mono text-amber-200">{fmt(data.sales)}</span>
                                </div>

                                {/* Total Expenses */}
                                <div className="flex justify-between items-center px-1 text-rose-300">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block shrink-0" />
                                    <span>Expenses ({data.expenseCount} اخراجات):</span>
                                  </span>
                                  <span className="font-bold font-mono text-rose-200">{fmt(data.expenses)}</span>
                                </div>

                                {/* Orders & Profit Margin */}
                                <div className="flex justify-between items-center border-t border-slate-700/80 pt-2 px-1 text-[11px] text-[var(--text-dim)]">
                                  <span>Orders: <strong className="text-white font-mono">{data.ordersCount}</strong></span>
                                  <span>
                                    Profit Margin: <strong className={isProfitable ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{data.marginPct}%</strong>
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    {/* Monthly Net Profit Bar (Spotlight) */}
                    <Bar
                      dataKey="netProfit"
                      name="Net Profit"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={monthlyRange === '6months' ? 36 : 18}
                      isAnimationActive={true}
                      animationDuration={950}
                      animationEasing="cubic-bezier(0.22, 1, 0.36, 1)"
                      animationBegin={40}
                    >
                      {monthlyProfitData.months.map((entry, index) => {
                        const isHovered = activeChartBar === index;
                        const hasActive = activeChartBar !== null;
                        const isProfitable = entry.netProfit >= 0;
                        return (
                          <Cell
                            key={`profit-cell-${index}`}
                            fill={
                              isProfitable
                                ? (isHovered ? 'url(#falconEmeraldActiveGrad)' : 'url(#falconEmeraldGrad)')
                                : 'url(#falconRubyGrad)'
                            }
                            filter={isHovered ? 'url(#falconEmeraldGlow)' : undefined}
                            stroke={isHovered ? '#6EE7B7' : (isProfitable ? '#059669' : '#E11D48')}
                            strokeWidth={isHovered ? 1.5 : 0.5}
                            style={{
                              transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                              cursor: 'pointer',
                              opacity: hasActive && !isHovered ? 0.72 : 1
                            }}
                          />
                        );
                      })}
                    </Bar>

                    {/* Gross Sales Comparison Bar */}
                    <Bar
                      dataKey="sales"
                      name="Gross Sales"
                      fill="url(#falconGoldGrad)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={monthlyRange === '6months' ? 36 : 18}
                      isAnimationActive={true}
                      animationDuration={950}
                      animationEasing="cubic-bezier(0.22, 1, 0.36, 1)"
                      animationBegin={100}
                    >
                      {monthlyProfitData.months.map((_entry, index) => {
                        const isHovered = activeChartBar === index;
                        const hasActive = activeChartBar !== null;
                        return (
                          <Cell
                            key={`month-sales-cell-${index}`}
                            stroke={isHovered ? '#FDE047' : 'transparent'}
                            strokeWidth={isHovered ? 1 : 0}
                            style={{
                              transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                              cursor: 'pointer',
                              opacity: hasActive && !isHovered ? 0.6 : 0.92
                            }}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart Footnote Details */}
          <div className="mt-3 pt-3 border-t border-[var(--steel-line)] flex items-center justify-between text-xs font-mono text-[var(--text-dim)] flex-wrap gap-2">
            {chartMetricView === 'weekly_sales' ? (
              <>
                <div className="flex items-center gap-1.5">
                  <Activity size={13} className="text-emerald-400" />
                  <span>
                    {dateRangeBounds.labelEn} Sales: <strong className="text-amber-400">{fmt(chartData.totalSales)}</strong>
                  </span>
                </div>
                <div className="font-serif text-[11px] text-amber-300/90">
                  کل فروخت ({dateRangeBounds.labelUr}): {fmt(chartData.totalSales)} | اخراجات: {fmt(chartData.totalExpenses)}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <TrendingUp size={13} className="text-emerald-400" />
                  <span>
                    {dateRangeBounds.labelEn} Profit: <strong className={monthlyProfitData.totalNet >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {monthlyProfitData.totalNet >= 0 ? '+' : ''}{fmt(monthlyProfitData.totalNet)}
                    </strong>
                    <span className="text-[var(--text-dim)] font-normal ml-1">· Avg: <span className="text-amber-300">{fmt(monthlyProfitData.avgMonthlyProfit)}</span>/mo</span>
                  </span>
                </div>
                <div className="font-serif text-[11px] text-emerald-300/90">
                  بہترین مہینہ: <strong className="text-amber-300">{monthlyProfitData.bestMonth.monthLabel}</strong> ({fmt(monthlyProfitData.bestMonth.netProfit)})
                </div>
              </>
            )}
          </div>
        </div>

        {/* Secondary Chart: Fan Rods Product Mix & Finished Inventory Breakdown */}
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold border border-teal-500/30">
                <PieChart size={18} />
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <h3 className="font-serif font-bold text-base text-[var(--text)]">Fan Rods Mix</h3>
                  <span className="font-serif text-sm font-semibold text-teal-300">پروڈکٹ کیٹلاگ تناسب</span>
                </div>
                <p className="text-[11px] text-[var(--text-dim)] font-mono">
                  Finished inventory allocation & stock value
                </p>
              </div>
            </div>

            {/* Visual Split Ratio Bar */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-amber-400 font-bold">
                  Ceiling Rods <span className="font-serif text-[11px] font-normal text-amber-300/80">(سیلنگ {productMix.ceilingPct}%)</span>
                </span>
                <span className="text-sky-400 font-bold">
                  Pedestal Rods <span className="font-serif text-[11px] font-normal text-sky-300/80">(پیڈسٹل {productMix.pedestalPct}%)</span>
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden flex p-0.5 border border-[var(--steel-line)]">
                <div
                  style={{ width: `${productMix.ceilingPct}%` }}
                  className="h-full bg-amber-400 rounded-l-full transition-all duration-500 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                />
                <div
                  style={{ width: `${productMix.pedestalPct}%` }}
                  className="h-full bg-sky-400 rounded-r-full transition-all duration-500 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                />
              </div>
            </div>

            {/* Bilingual Category Cards */}
            <div className="space-y-2.5 font-mono text-xs">
              {/* Ceiling Fan Rods */}
              <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-amber-500/30 flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="font-bold text-[var(--text)]">Ceiling Fan Rods</span>
                  </div>
                  <span className="font-serif text-[11px] text-amber-300 ml-4 block">سیلنگ فین راڈز</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-amber-400 text-sm">{productMix.ceilingStock} Pcs (عدد)</div>
                  <div className="text-[10px] text-[var(--text-dim)]">{fmt(productMix.ceilingVal)}</div>
                </div>
              </div>

              {/* Pedestal Fan Rods */}
              <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-sky-500/30 flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
                    <span className="font-bold text-[var(--text)]">Pedestal Fan Rods</span>
                  </div>
                  <span className="font-serif text-[11px] text-sky-300 ml-4 block">پیڈسٹل فین راڈز</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sky-400 text-sm">{productMix.pedestalStock} Pcs (عدد)</div>
                  <div className="text-[10px] text-[var(--text-dim)]">{fmt(productMix.pedestalVal)}</div>
                </div>
              </div>

              {/* Cash vs Receivables Gauge */}
              <div className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-1.5">
                <div className="flex justify-between items-baseline text-[11px]">
                  <span className="text-[var(--text-dim)]">Liquid Cash vs Market Owed</span>
                  <span className="font-serif text-emerald-400 text-[11px]">نقد کیش بنام بقایا</span>
                </div>
                <div className="flex justify-between items-baseline font-bold">
                  <span className="text-emerald-400">Cash (نقد): {fmt(fin.cashInHand)}</span>
                  <span className="text-rose-400">Owed (بقایا): {fmt(fin.totalReceivables)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--steel-line)]">
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="w-full py-2 rounded-lg bg-[var(--panel-raised)] hover:border-[var(--yellow)] border border-[var(--steel-line)] text-xs text-[var(--text)] hover:text-[var(--yellow)] transition text-center font-semibold"
            >
              Open Products Catalog (پروڈکٹ کیٹلاگ) →
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION: PRIMARY BENTO KPI MODULES (FULLY BILINGUAL) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Module 1: Live Cash In Hand (Tijori / Drawer) */}
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 bg-gradient-to-br from-emerald-500/20 via-transparent to-transparent border-b border-[var(--steel-line)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 text-black flex items-center justify-center font-bold">
                <Coins size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-[var(--text)]">Cash Register</h3>
                <span className="font-serif text-[11px] text-emerald-300 font-bold block -mt-0.5">تجوری و نقد رقم</span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
              Live Cash
            </span>
          </div>

          <div className="p-4 space-y-2.5 flex-1 font-mono text-xs">
            <div className="flex justify-between items-baseline">
              {renderBilingual('Total Cash Inflow', 'کل کیش آمد')}
              <span className="font-semibold text-[var(--green)]">+{fmt(fin.cashInflow)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              {renderBilingual('Total Cash Outflow', 'کل کیش اخراجات')}
              <span className="font-semibold text-[var(--red)]">-{fmt(fin.cashOutflow)}</span>
            </div>
            <div className="border-t border-[var(--steel-line)] pt-2 flex justify-between items-baseline">
              {renderBilingual('Cash In Hand', 'کل نقد (ہاتھ میں)', 'font-bold text-[var(--text)]')}
              <span
                className={`font-bold text-base ${
                  fin.cashInHand >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'
                }`}
              >
                {fmt(fin.cashInHand)}
              </span>
            </div>
            <div className="border-t border-[var(--steel-line)] pt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between items-baseline">
                {renderBilingual('Finished Stock Value', 'تیار راڈز مالیت')}
                <span className="text-[var(--yellow)] font-semibold">{fmt(fin.finishedGoodsValue)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                {renderBilingual('Raw Stock Value', 'خام مال مالیت')}
                <span className="text-[var(--text)] font-semibold">{fmt(fin.rawStockValue)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-1 border-t border-[var(--steel-line)]/50">
                {renderBilingual('Net Workshop Assets', 'کارخانہ کے کل اثاثے', 'font-bold text-[var(--text-dim)]')}
                <span className="font-bold text-emerald-400">{fmt(fin.totalAssetValuation)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Module 2: Business Summary Report */}
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 bg-gradient-to-br from-amber-500/20 via-transparent to-transparent border-b border-[var(--steel-line)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--yellow)] text-black flex items-center justify-center font-bold">
                <TrendingUp size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-[var(--text)]">Business Summary</h3>
                <span className="font-serif text-[11px] text-amber-300 font-bold block -mt-0.5">کاروباری خلاصہ</span>
              </div>
            </div>
            <select
              value={summaryPeriod}
              onChange={e => setSummaryPeriod(e.target.value)}
              className="bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[10px] font-mono rounded px-2 py-1 text-[var(--text)]"
            >
              <option value="daily">Daily (روزانہ)</option>
              <option value="weekly">Weekly (ہفتہ وار)</option>
              <option value="monthly">Monthly (ماہانہ)</option>
              <option value="yearly">Yearly (سالانہ)</option>
              <option value="all">All Time (مکمل)</option>
            </select>
          </div>

          <div className="p-4 space-y-2 flex-1 font-mono text-xs">
            <div className="flex justify-between items-baseline">
              {renderBilingual('Period Sales', 'مدت کی سیلز')}
              <span className="font-bold text-[var(--yellow)]">{fmt(fin.summarySalesTotal)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              {renderBilingual('Total Expenses', 'کل اخراجات')}
              <span className="font-bold text-[var(--red)]">{fmt(fin.periodExpensesTotal)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              {renderBilingual('Raw Material Cost', 'خام مال لاگت')}
              <span className="font-semibold">{fmt(fin.filteredMaterialPayments)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              {renderBilingual('Labour & Paint Cost', 'مزدوری و پینٹ لاگت')}
              <span className="font-semibold">{fmt(fin.filteredLabourPayments + fin.filteredPainterPayments)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              {renderBilingual('Owner Withdrawals', 'ذاتی نکاسی')}
              <span className="font-semibold text-amber-500">{fmt(fin.periodWithdrawalsTotal)}</span>
            </div>
            <div className="border-t border-[var(--steel-line)] pt-2 flex justify-between items-baseline">
              {renderBilingual('Net Profit', 'خالص منافع', 'font-bold text-[var(--text)]')}
              <span
                className={`font-bold text-sm ${
                  fin.periodNetProfit >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'
                }`}
              >
                {fmt(fin.periodNetProfit)}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-[11px] pt-1">
              {renderBilingual('Market Receivables', 'مارکیٹ سے وصولی')}
              <span className="text-[var(--green)] font-semibold">{fmt(fin.totalReceivables)}</span>
            </div>
            <div className="flex justify-between items-baseline text-[11px]">
              {renderBilingual('Supplier Payables', 'سپلائر کو واجب الادا')}
              <span className="text-[var(--red)] font-semibold">{fmt(fin.totalPayables)}</span>
            </div>
          </div>
        </div>

        {/* Module 3: Sales & Orders Module */}
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 bg-gradient-to-br from-cyan-500/20 via-transparent to-transparent border-b border-[var(--steel-line)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500 text-black flex items-center justify-center font-bold">
                <CreditCard size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-[var(--text)]">Sales & Orders</h3>
                <span className="font-serif text-[11px] text-cyan-300 font-bold block -mt-0.5">سیلز و آرڈرز</span>
              </div>
            </div>
            <select
              value={salesPeriod}
              onChange={e => setSalesPeriod(e.target.value)}
              className="bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[10px] font-mono rounded px-2 py-1 text-[var(--text)]"
            >
              <option value="daily">Daily (روزانہ)</option>
              <option value="weekly">Weekly (ہفتہ وار)</option>
              <option value="monthly">Monthly (ماہانہ)</option>
              <option value="yearly">Yearly (سالانہ)</option>
              <option value="all">All Time (مکمل)</option>
            </select>
          </div>

          <div className="p-4 space-y-2.5 flex-1 font-mono text-xs">
            <div className="flex justify-between items-baseline">
              {renderBilingual('Period Turnover', 'سیلز ٹرن اوور')}
              <span className="font-bold text-sm text-[var(--yellow)]">{fmt(fin.periodSalesTotal)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              {renderBilingual('Orders Completed', 'مکمل آرڈرز')}
              <span className="font-bold text-base text-[var(--text)]">{fin.periodOrdersCount}</span>
            </div>
            <div className="flex justify-between items-baseline">
              {renderBilingual('Total Rods Sold', 'فروخت شدہ راڈز')}
              <span className="font-bold text-base text-[var(--text)]">{fin.periodItemsSold}</span>
            </div>
            <div className="flex justify-between items-baseline">
              {renderBilingual('Average Sale Value', 'اوسط آرڈر رقم')}
              <span className="font-bold text-sm text-[var(--yellow)]">{fmt(fin.periodAvgSale)}</span>
            </div>
            <div className="border-t border-[var(--steel-line)] pt-3">
              <button
                type="button"
                onClick={() => onNavigate('transactions')}
                className="w-full py-2 rounded-lg bg-[var(--panel-raised)] hover:border-[var(--yellow)] border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition text-center"
              >
                View Booked Orders (بک شدہ آرڈرز) →
              </button>
            </div>
          </div>
        </div>

        {/* Module 4: Industrial Ledgers Summary */}
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 bg-gradient-to-br from-purple-500/20 via-transparent to-transparent border-b border-[var(--steel-line)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500 text-white flex items-center justify-center font-bold">
                <Layers size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-[var(--text)]">Industrial Ledgers</h3>
                <span className="font-serif text-[11px] text-purple-300 font-bold block -mt-0.5">کارخانہ کھاتہ جات</span>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-2 flex-1 font-mono text-xs">
            <div className="flex justify-between items-baseline">
              {renderBilingual('Active Customers (Factories)', 'کسٹمرز (فیکٹریاں)')}
              <span className="font-semibold">{state.customerLedgers.length}</span>
            </div>
            <div className="flex justify-between items-baseline">
              {renderBilingual('Raw Material Suppliers', 'خام مال سپلائرز')}
              <span className="font-semibold">{state.rawSuppliers.length}</span>
            </div>
            <div className="flex justify-between items-baseline">
              {renderBilingual('Painters (Colouring)', 'پینٹرز (رنگ والے)')}
              <span className="font-semibold">{state.painters.length}</span>
            </div>
            <div className="flex justify-between items-baseline">
              {renderBilingual('Labour Workers (Rod Makers)', 'مزدور و کاریگر')}
              <span className="font-semibold">{(state.workers || state.labourWorkers || []).length}</span>
            </div>
            <div className="flex justify-between items-baseline">
              {renderBilingual('Scrap Buyers (Kabaar)', 'سکریپ خریدار')}
              <span className="font-semibold">{state.scrapBuyers.length}</span>
            </div>
            <div className="border-t border-[var(--steel-line)] pt-3 space-y-2">
              <button
                type="button"
                onClick={() => onNavigate('stock')}
                className="w-full py-2 rounded-lg bg-[var(--panel-raised)] hover:border-[var(--yellow)] border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition text-center"
              >
                Check Stock Levels (اسٹاک چیک کریں) →
              </button>
              <button
                type="button"
                onClick={() => onNavigate('inventory_forecast')}
                className="w-full py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-bold text-amber-300 transition text-center flex items-center justify-center gap-1.5"
              >
                <span>Inventory Forecast & Reorder Prediction (پیش گوئی اسٹاک)</span>
                <span>⚡</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION: TWO-COLUMN LOWER GRID: LEADERBOARD & RECENT ACTIVITY */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outstanding Receivables Leaderboard */}
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="font-serif font-bold text-base text-[var(--text)]">
                  Who Owes The Most (Receivables)
                </h3>
                <span className="font-serif text-sm font-semibold text-rose-400">واجب الوصول کسٹمرز</span>
              </div>
              <p className="text-[11px] text-[var(--text-dim)] font-mono">
                Top customer outstanding debt across factories
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('factories')}
              className="text-xs text-[var(--yellow)] hover:underline font-mono"
            >
              All Factories (فیکٹریاں) →
            </button>
          </div>

          <div className="space-y-2.5">
            {debtorFactories.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)] font-mono py-4 text-center">
                All customer accounts are settled! (تمام کسٹمر کھاتے کلیئر ہیں)
              </p>
            ) : (
              debtorFactories.map(f => (
                <div
                  key={f.name}
                  onClick={() => onOpenCustomerLedger(f.name)}
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] cursor-pointer transition active:scale-[0.99]"
                >
                  <div>
                    <div className="font-semibold text-sm text-[var(--text)]">{f.name}</div>
                    <div className="text-[11px] text-[var(--text-dim)] font-mono mt-0.5 flex items-center gap-1.5">
                      <span>Tap to view account ledger</span>
                      <span className="font-serif text-amber-300/80">(کھاتہ تفصیل)</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-sm text-[var(--red)]">{fmt(f.balance)}</div>
                    <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-dim)] flex items-center justify-end gap-1">
                      <span>Owed</span>
                      <span className="font-serif text-rose-400/90">(بقایا)</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity Log */}
        <div className="bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="font-serif font-bold text-base text-[var(--text)]">Recent Workshop Activity</h3>
                <span className="font-serif text-sm font-semibold text-amber-300">حالیہ سرگرمیاں</span>
              </div>
              <p className="text-[11px] text-[var(--text-dim)] font-mono">
                Realtime transaction & expenditure logs
              </p>
            </div>
            <span className="text-xs text-[var(--text-dim)] font-mono flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Timeline</span>
            </span>
          </div>

          <div className="space-y-2.5">
            {recentActivities.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] font-mono text-xs"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="font-semibold text-[var(--text)] truncate">{item.title}</div>
                  <div className="text-[10px] text-[var(--text-dim)] truncate mt-0.5">{item.sub}</div>
                </div>
                <div
                  className={`font-bold shrink-0 text-sm ${
                    item.positive ? 'text-[var(--green)]' : 'text-[var(--red)]'
                  }`}
                >
                  {item.positive ? '+' : '-'} {fmt(item.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
