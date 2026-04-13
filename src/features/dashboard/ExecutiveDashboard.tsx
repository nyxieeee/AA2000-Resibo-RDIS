import { TrendingUp, TrendingDown, DollarSign, FileText, ArrowRight, UploadCloud, Download, Landmark, Settings, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

export function ExecutiveDashboard() {
  const documents = useDocumentStore(state => state.documents);
  const user = useAuthStore(state => state.user);

  const stats = useMemo(() => {
    const now = new Date();

    // Current month prefix e.g. "2026-04"
    const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Last month prefix
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const validDocs = documents.filter(d => d.status !== 'Declined');
    const thisMonthDocs = validDocs.filter(d => d.date.startsWith(thisMonthPrefix));
    const lastMonthDocs = validDocs.filter(d => d.date.startsWith(lastMonthPrefix));

    // Total expenses = sum of all valid document totals
    const totalExpenses = validDocs.reduce((s, d) => s + d.total, 0);
    const thisMonthExpenses = thisMonthDocs.reduce((s, d) => s + d.total, 0);
    const lastMonthExpenses = lastMonthDocs.reduce((s, d) => s + d.total, 0);

    // Total VAT tracked
    const totalVat = validDocs.reduce((s, d) => s + (d.vat || 0), 0);
    const thisMonthVat = thisMonthDocs.reduce((s, d) => s + (d.vat || 0), 0);
    const lastMonthVat = lastMonthDocs.reduce((s, d) => s + (d.vat || 0), 0);

    // MoM trend calculation
    const calcTrend = (current: number, previous: number) => {
      if (previous === 0) return null; // no prior data
      return ((current - previous) / previous) * 100;
    };

    const expenseTrend = calcTrend(thisMonthExpenses, lastMonthExpenses);
    const vatTrend = calcTrend(thisMonthVat, lastMonthVat);

    return {
      totalExpenses,
      totalVat,
      expenseTrend,
      vatTrend,
      documentsReadyForFiling: validDocs.filter(d => !d.datGenerated).length,
      totalDocs: documents.length,
      thisMonthCount: thisMonthDocs.length,
    };
  }, [documents]);

  const formatMoney = (amount: number) => {
    if (amount >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(2)}M`;
    if (amount >= 1_000) return `₱${(amount / 1_000).toFixed(1)}K`;
    return `₱${amount.toFixed(2)}`;
  };

  const formatTrend = (trend: number | null) => {
    if (trend === null) return { label: 'No prior data', positive: null };
    const sign = trend >= 0 ? '+' : '';
    return { label: `${sign}${trend.toFixed(1)}% vs last month`, positive: trend >= 0 };
  };

  const expenseTrendFmt = formatTrend(stats.expenseTrend);
  const vatTrendFmt = formatTrend(stats.vatTrend);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Executive Overview</h1>
          <p className="text-slate-500 mt-1">Welcome back, {user?.role} {user?.firstName}!</p>
        </div>
      </div>

      {/* Primary KPI Row — all derived from real document data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KpiCard
          title="Total Tracked Expenses"
          amount={formatMoney(stats.totalExpenses)}
          trend={expenseTrendFmt.label}
          trendPositive={expenseTrendFmt.positive}
          type="expense"
          subtitle={`${stats.totalDocs} document${stats.totalDocs !== 1 ? 's' : ''} total`}
        />
        <KpiCard
          title="Total VAT Tracked"
          amount={formatMoney(stats.totalVat)}
          trend={vatTrendFmt.label}
          trendPositive={vatTrendFmt.positive}
          type="neutral"
          subtitle="Across all valid documents"
        />
        <KpiCard
          title="Pending BIR Filing"
          amount={String(stats.documentsReadyForFiling)}
          trend={stats.thisMonthCount > 0 ? `${stats.thisMonthCount} new this month` : 'No new docs this month'}
          trendPositive={null}
          type="revenue"
          subtitle="Documents not yet filed"
          isCount
        />
      </div>

      {documents.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>No documents yet.</strong> KPIs will populate once documents are scanned via ScanHub.
        </div>
      )}

      {/* Quick Action Operations */}
      <div className="bg-slate-900 rounded-xl p-8 text-white relative overflow-hidden shadow-sm mt-8">
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <Landmark className="h-64 w-64 text-white" />
        </div>
        <div className="relative z-10 w-full md:w-2/3">
          <h2 className="text-xl font-bold mb-2">Operations Center</h2>
          <p className="text-slate-400 mb-8 max-w-lg">
            Manage your compliance, accelerate document processing, and export raw data directly from your dashboard.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/scanhub" className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-5 rounded-xl transition-colors flex flex-col group">
              <div className="bg-blue-500/20 text-blue-400 w-10 h-10 flex items-center justify-center rounded-lg mb-4 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <UploadCloud className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-sm mb-1">Process Documents</h3>
              <p className="text-xs text-slate-400 mb-4">Run Claude AI on receipts & invoices</p>
              <div className="flex items-center text-xs font-bold text-blue-400 mt-auto">
                Go to ScanHub <ArrowRight className="h-3 w-3 ml-1" />
              </div>
            </Link>

            <Link to="/filing" className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-5 rounded-xl transition-colors flex flex-col group">
              <div className="bg-emerald-500/20 text-emerald-400 w-10 h-10 flex items-center justify-center rounded-lg mb-4 group-hover:bg-emerald-500 group-hover:text-white transition-colors relative">
                <FileText className="h-5 w-5" />
                {stats.documentsReadyForFiling > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 h-3 w-3 rounded-full border-2 border-slate-800"></span>
                )}
              </div>
              <h3 className="font-semibold text-sm mb-1">BIR Filing</h3>
              <p className="text-xs text-slate-400 mb-4">{stats.documentsReadyForFiling} documents pending DAT generation</p>
              <div className="flex items-center text-xs font-bold text-emerald-400 mt-auto">
                Generate Relief <ArrowRight className="h-3 w-3 ml-1" />
              </div>
            </Link>

            <Link to="/exports" className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-5 rounded-xl transition-colors flex flex-col group">
              <div className="bg-amber-500/20 text-amber-400 w-10 h-10 flex items-center justify-center rounded-lg mb-4 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <Download className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-sm mb-1">Data Export</h3>
              <p className="text-xs text-slate-400 mb-4">Download CSV reports for analysis</p>
              <div className="flex items-center text-xs font-bold text-amber-400 mt-auto">
                Export Data <ArrowRight className="h-3 w-3 ml-1" />
              </div>
            </Link>

            <Link to="/settings" className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-5 rounded-xl transition-colors flex flex-col group">
              <div className="bg-slate-500/20 text-slate-400 w-10 h-10 flex items-center justify-center rounded-lg mb-4 group-hover:bg-slate-400 group-hover:text-white transition-colors">
                <Settings className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-sm mb-1">Settings</h3>
              <p className="text-xs text-slate-400 mb-4">Manage workspace &amp; BIR configuration</p>
              <div className="flex items-center text-xs font-bold text-slate-400 mt-auto">
                Open Settings <ArrowRight className="h-3 w-3 ml-1" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, amount, trend, trendPositive, type, subtitle, isCount }: {
  title: string;
  amount: string;
  trend: string;
  trendPositive: boolean | null;
  type: string;
  subtitle?: string;
  isCount?: boolean;
}) {
  const isRevenue = type === 'revenue';
  const isExpense = type === 'expense';

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col py-8 justify-between">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
        <div className={cn(
          'h-10 w-10 rounded-full flex items-center justify-center',
          isRevenue && 'bg-green-100 text-green-600',
          isExpense && 'bg-slate-100 text-slate-600',
          type === 'neutral' && 'bg-blue-100 text-blue-600'
        )}>
          <DollarSign className="h-5 w-5" />
        </div>
      </div>
      <div>
        <h2 className={cn('font-bold text-slate-900 tracking-tight', isCount ? 'text-5xl' : 'text-4xl')}>{amount}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        <div className="flex items-center gap-1 mt-2">
          {trendPositive === true && <TrendingUp className="h-4 w-4 text-emerald-500" />}
          {trendPositive === false && <TrendingDown className="h-4 w-4 text-rose-500" />}
          {trendPositive === null && <Minus className="h-4 w-4 text-slate-400" />}
          <span className={cn(
            'text-sm font-semibold',
            trendPositive === true && 'text-emerald-600',
            trendPositive === false && 'text-rose-600',
            trendPositive === null && 'text-slate-400'
          )}>
            {trend}
          </span>
        </div>
      </div>
    </div>
  );
}
