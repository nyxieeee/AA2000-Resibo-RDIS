import { TrendingUp, TrendingDown, DollarSign, FileText, ArrowRight, UploadCloud, Download, Landmark, Settings, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useDateFilter, matchesFilter } from '../../hooks/useDateFilter';
import { DateRangeFilter } from '../../components/ui/DateRangeFilter';

export function ExecutiveDashboard() {
  const documents = useDocumentStore(state => state.documents);
  const user = useAuthStore(state => state.user);
  const { filter, update, AVAILABLE_YEARS } = useDateFilter();

  const filteredDocs = useMemo(
    () => documents.filter(d => matchesFilter(d.date, filter)),
    [documents, filter]
  );

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const validDocs = filteredDocs.filter(d => d.status !== 'Declined');
    const thisMonthDocs = validDocs.filter(d => d.date.startsWith(thisMonthPrefix));
    const lastMonthDocs = validDocs.filter(d => d.date.startsWith(lastMonthPrefix));

    const totalExpenses = validDocs.reduce((s, d) => s + d.total, 0);
    const thisMonthExpenses = thisMonthDocs.reduce((s, d) => s + d.total, 0);
    const lastMonthExpenses = lastMonthDocs.reduce((s, d) => s + d.total, 0);

    const totalVat = validDocs.reduce((s, d) => s + (d.vat || 0), 0);
    const thisMonthVat = thisMonthDocs.reduce((s, d) => s + (d.vat || 0), 0);
    const lastMonthVat = lastMonthDocs.reduce((s, d) => s + (d.vat || 0), 0);

    const calcTrend = (current: number, previous: number) =>
      previous === 0 ? null : ((current - previous) / previous) * 100;

    return {
      totalExpenses, totalVat,
      expenseTrend: calcTrend(thisMonthExpenses, lastMonthExpenses),
      vatTrend: calcTrend(thisMonthVat, lastMonthVat),
      documentsReadyForFiling: validDocs.filter(d => !d.datGenerated).length,
      totalDocs: filteredDocs.length,
      thisMonthCount: thisMonthDocs.length,
    };
  }, [filteredDocs]);

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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center sm:flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[--text-primary]">Executive Overview</h1>
          <p className="text-[--text-muted] text-sm mt-1">Welcome back, {user?.role} {user?.firstName}!</p>
        </div>
        <DateRangeFilter filter={filter} availableYears={AVAILABLE_YEARS} onChange={update} />
      </div>

      {filter.mode !== 'all' && (
        <div className="text-xs text-[--text-muted] font-medium bg-[--bg-raised] border border-[--border-subtle] rounded-lg px-3 py-2">
          Showing <span className="font-bold text-[--text-primary]">{stats.totalDocs}</span> of {documents.length} documents for the selected period
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          <strong>No documents yet.</strong> KPIs will populate once documents are scanned via ScanHub.
        </div>
      )}

      <div className="bg-slate-900 rounded-xl p-5 md:p-8 text-white relative overflow-hidden shadow-sm mt-4 md:mt-8">
        <div className="absolute top-0 right-0 p-6 md:p-12 opacity-10">
          <Landmark className="h-32 w-32 md:h-64 md:w-64 text-white" />
        </div>
        <div className="relative z-10 w-full">
          <h2 className="text-lg md:text-xl font-bold mb-2">Operations Center</h2>
          <p className="text-slate-400 text-sm mb-5 md:mb-8 max-w-lg">Manage your compliance, accelerate document processing, and export raw data directly from your dashboard.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Link to="/scanhub" className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 md:p-5 rounded-xl transition-colors flex flex-col group">
              <div className="bg-blue-500/20 text-blue-400 w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg mb-3 md:mb-4 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <UploadCloud className="h-4 w-4 md:h-5 md:w-5" />
              </div>
              <h3 className="font-semibold text-xs md:text-sm mb-1">Process Documents</h3>
              <p className="text-xs text-slate-400 mb-3 md:mb-4 hidden sm:block">Run AI on receipts &amp; invoices</p>
              <div className="flex items-center text-xs font-bold text-blue-400 mt-auto">ScanHub <ArrowRight className="h-3 w-3 ml-1" /></div>
            </Link>
            <Link to="/filing" className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 md:p-5 rounded-xl transition-colors flex flex-col group">
              <div className="bg-emerald-500/20 text-emerald-400 w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg mb-3 md:mb-4 group-hover:bg-emerald-500 group-hover:text-white transition-colors relative">
                <FileText className="h-4 w-4 md:h-5 md:w-5" />
                {stats.documentsReadyForFiling > 0 && <span className="absolute -top-1 -right-1 bg-red-500 h-3 w-3 rounded-full border-2 border-slate-800" />}
              </div>
              <h3 className="font-semibold text-xs md:text-sm mb-1">BIR Filing</h3>
              <p className="text-xs text-slate-400 mb-3 md:mb-4 hidden sm:block">{stats.documentsReadyForFiling} documents pending</p>
              <div className="flex items-center text-xs font-bold text-emerald-400 mt-auto">File <ArrowRight className="h-3 w-3 ml-1" /></div>
            </Link>
            <Link to="/exports" className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 md:p-5 rounded-xl transition-colors flex flex-col group">
              <div className="bg-amber-500/20 text-amber-400 w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg mb-3 md:mb-4 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <Download className="h-4 w-4 md:h-5 md:w-5" />
              </div>
              <h3 className="font-semibold text-xs md:text-sm mb-1">Data Export</h3>
              <p className="text-xs text-slate-400 mb-3 md:mb-4 hidden sm:block">Download CSV reports</p>
              <div className="flex items-center text-xs font-bold text-amber-400 mt-auto">Export <ArrowRight className="h-3 w-3 ml-1" /></div>
            </Link>
            <Link to="/settings" className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 md:p-5 rounded-xl transition-colors flex flex-col group">
              <div className="bg-slate-500/20 text-slate-400 w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg mb-3 md:mb-4 group-hover:bg-slate-400 group-hover:text-white transition-colors">
                <Settings className="h-4 w-4 md:h-5 md:w-5" />
              </div>
              <h3 className="font-semibold text-xs md:text-sm mb-1">Settings</h3>
              <p className="text-xs text-slate-400 mb-3 md:mb-4 hidden sm:block">Manage workspace</p>
              <div className="flex items-center text-xs font-bold text-slate-400 mt-auto">Open <ArrowRight className="h-3 w-3 ml-1" /></div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, amount, trend, trendPositive, type, subtitle, isCount }: {
  title: string; amount: string; trend: string; trendPositive: boolean | null; type: string; subtitle?: string; isCount?: boolean;
}) {
  return (
    <div className="bg-[--bg-surface] p-5 md:p-6 rounded-xl border border-[--border-subtle] shadow-sm relative overflow-hidden flex flex-col py-5 md:py-8 justify-between min-h-36">
      <div className="flex justify-between items-start mb-4 md:mb-6">
        <h3 className="text-xs md:text-sm font-semibold text-[--text-muted] uppercase tracking-wider pr-2">{title}</h3>
        <div className={cn('h-9 w-9 md:h-10 md:w-10 shrink-0 rounded-full flex items-center justify-center',
          type === 'revenue' && 'bg-green-100 dark:bg-green-950/30 text-green-600',
          type === 'expense' && 'bg-[--bg-raised] text-[--text-muted]',
          type === 'neutral' && 'bg-blue-100 dark:bg-blue-950/30 text-blue-600')}>
          <DollarSign className="h-4 w-4 md:h-5 md:w-5" />
        </div>
      </div>
      <div>
        <h2 className={cn('font-bold text-[--text-primary] tracking-tight', isCount ? 'text-4xl md:text-5xl' : 'text-3xl md:text-4xl')}>{amount}</h2>
        {subtitle && <p className="text-xs text-[--text-muted] mt-1">{subtitle}</p>}
        <div className="flex items-center gap-1 mt-2">
          {trendPositive === true && <TrendingUp className="h-4 w-4 text-emerald-500" />}
          {trendPositive === false && <TrendingDown className="h-4 w-4 text-rose-500" />}
          {trendPositive === null && <Minus className="h-4 w-4 text-[--text-muted]" />}
          <span className={cn('text-xs md:text-sm font-semibold',
            trendPositive === true && 'text-emerald-600',
            trendPositive === false && 'text-rose-600',
            trendPositive === null && 'text-[--text-muted]')}>{trend}</span>
        </div>
      </div>
    </div>
  );
}
