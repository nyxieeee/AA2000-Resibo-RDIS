import { TrendingUp, TrendingDown, DollarSign, FileText, Settings, ArrowRight, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDateFilter, matchesFilter } from '../../hooks/useDateFilter';
import { DateRangeFilter } from '../../components/ui/DateRangeFilter';

export function MemberDashboard() {
  const documents = useDocumentStore(state => state.documents);
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

    let expenses = 0, tax = 0, forReview = 0, approved = 0, autoOk = 0, declined = 0;
    let thisMonthExpenses = 0, lastMonthExpenses = 0, thisMonthTax = 0, lastMonthTax = 0;

    filteredDocs.forEach(doc => {
      if (doc.status !== 'Declined') {
        expenses += doc.total;
        tax += doc.vat;
        if (doc.date.startsWith(thisMonthPrefix)) { thisMonthExpenses += doc.total; thisMonthTax += doc.vat; }
        if (doc.date.startsWith(lastMonthPrefix)) { lastMonthExpenses += doc.total; lastMonthTax += doc.vat; }
      }
      if (doc.status === 'For Review') forReview++;
      if (doc.status === 'Approved') approved++;
      if (doc.status === 'Auto OK') autoOk++;
      if (doc.status === 'Declined') declined++;
    });

    const calcTrend = (curr: number, prev: number) => prev === 0 ? null : ((curr - prev) / prev) * 100;
    return {
      expenses, tax,
      expenseTrend: calcTrend(thisMonthExpenses, lastMonthExpenses),
      taxTrend: calcTrend(thisMonthTax, lastMonthTax),
      forReview, approved, autoOk, declined,
      totalDocs: filteredDocs.length,
    };
  }, [filteredDocs]);

  // Bar chart data — last 14 days (or all days in range if filtered)
  const chartData = useMemo(() => {
    const days: { date: string; label: string; amount: number; docs: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayDocs = filteredDocs.filter(doc => doc.date === prefix && doc.status !== 'Declined');
      days.push({ date: prefix, label: `${d.getMonth() + 1}/${d.getDate()}`, amount: dayDocs.reduce((s, d) => s + d.total, 0), docs: dayDocs.length });
    }
    return days;
  }, [filteredDocs]);

  const hasChartData = chartData.some(d => d.docs > 0);

  const formatMoney = (amount: number) => {
    if (amount >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(2)}M`;
    if (amount >= 1_000) return `₱${(amount / 1_000).toFixed(1)}K`;
    return `₱${amount.toFixed(2)}`;
  };

  const formatTrend = (trend: number | null): { label: string; positive: boolean | null } => {
    if (trend === null) return { label: 'No prior month data', positive: null };
    const sign = trend >= 0 ? '+' : '';
    return { label: `${sign}${trend.toFixed(1)}% vs last month`, positive: trend >= 0 };
  };

  const expFmt = formatTrend(stats.expenseTrend);
  const taxFmt = formatTrend(stats.taxTrend);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center sm:flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[--text-primary]">Dashboard</h1>
          <p className="text-[--text-muted] text-sm mt-0.5">Financial overview and processing health</p>
        </div>
        <DateRangeFilter filter={filter} availableYears={AVAILABLE_YEARS} onChange={update} />
      </div>

      {filter.mode !== 'all' && (
        <div className="text-xs text-[--text-muted] font-medium bg-[--bg-raised] border border-[--border-subtle] rounded-lg px-3 py-2">
          Showing <span className="font-bold text-[--text-primary]">{stats.totalDocs}</span> of {documents.length} documents for the selected period
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <KpiCard title="Total Expenses Tracked" amount={formatMoney(stats.expenses)} trend={expFmt.label} positive={expFmt.positive} type="expense" />
        <KpiCard title="Total VAT Tracked" amount={formatMoney(stats.tax)} trend={taxFmt.label} positive={taxFmt.positive} type="tax" />
        <KpiCard title="Total Documents" amount={String(stats.totalDocs)} trend={`${stats.forReview} pending review`} positive={stats.forReview === 0 ? true : null} type="neutral" isCount />
      </div>

      {documents.length === 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
          <strong>No documents yet.</strong> Upload receipts and invoices via ScanHub to see your financial overview.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 bg-[--bg-surface] border border-[--border-subtle] rounded-xl p-4 md:p-6 shadow-sm flex flex-col">
          <h3 className="font-semibold text-[--text-primary] mb-1">Daily Document Expenses</h3>
          <p className="text-xs text-[--text-muted] mb-4">Last 14 days — based on scanned documents</p>
          {!hasChartData ? (
            <div className="flex-1 flex items-center justify-center text-[--text-muted] text-sm bg-[--bg-raised] rounded-lg min-h-40">
              Upload documents via ScanHub to see daily activity
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => v >= 1000 ? `₱${(v / 1000).toFixed(0)}K` : `₱${v}`} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', color: '#cbd5e1', fontSize: '12px' }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  formatter={(v, _name, props) => { const n = Number(v ?? 0); const d = (props as { payload?: { docs?: number } }).payload?.docs ?? 0; return [`₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, `${d} doc${d !== 1 ? 's' : ''}`]; }}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Bar dataKey="amount" fill="#3b82f6" fillOpacity={0.55} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-[--bg-surface] border border-[--border-subtle] rounded-xl p-4 md:p-6 shadow-sm">
          <h3 className="font-semibold text-[--text-primary] mb-4 md:mb-6">Review Status</h3>
          <div className="space-y-4">
            <StatusRow label="For Review" count={stats.forReview} color="bg-amber-500" total={Math.max(stats.totalDocs, 1)} />
            <StatusRow label="Approved" count={stats.approved} color="bg-green-500" total={Math.max(stats.totalDocs, 1)} />
            <StatusRow label="Auto OK" count={stats.autoOk} color="bg-slate-400" total={Math.max(stats.totalDocs, 1)} />
            <StatusRow label="Declined" count={stats.declined} color="bg-red-500" total={Math.max(stats.totalDocs, 1)} />
          </div>
        </div>
      </div>

      <div className="bg-[--bg-surface] border border-[--border-subtle] rounded-xl p-4 md:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="h-10 w-10 shrink-0 rounded-full bg-[--bg-raised] flex items-center justify-center text-[--text-muted]">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-[--text-primary]">Workspace Settings</h3>
            <p className="text-sm text-[--text-muted] mt-0.5">Configure BIR details, workspace info, and preferences.</p>
          </div>
        </div>
        <Link to="/settings" className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shrink-0 w-full sm:w-auto">
          Open Settings <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function KpiCard({ title, amount, trend, positive, type, isCount }: {
  title: string; amount: string; trend: string; positive: boolean | null; type: string; isCount?: boolean;
}) {
  return (
    <div className="bg-[--bg-surface] p-5 md:p-6 rounded-xl border border-[--border-subtle] shadow-sm flex flex-col justify-between min-h-36">
      <div className="flex justify-between items-start">
        <h3 className="text-sm font-medium text-[--text-muted] pr-2">{title}</h3>
        <div className={cn('h-8 w-8 shrink-0 rounded-full flex items-center justify-center',
          type === 'expense' && 'bg-red-100 dark:bg-red-950/30 text-red-600',
          type === 'tax' && 'bg-amber-100 dark:bg-amber-950/30 text-amber-600',
          type === 'neutral' && 'bg-blue-100 dark:bg-blue-950/30 text-blue-600')}>
          {type === 'neutral' ? <FileText className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
        </div>
      </div>
      <div>
        <h2 className={cn('font-bold text-[--text-primary] tracking-tight', isCount ? 'text-4xl' : 'text-3xl')}>{amount}</h2>
        <div className="flex items-center gap-1 mt-1">
          {positive === true && <TrendingUp className="h-4 w-4 text-emerald-500" />}
          {positive === false && <TrendingDown className="h-4 w-4 text-rose-500" />}
          {positive === null && <Minus className="h-4 w-4 text-[--text-muted]" />}
          <span className={cn('text-xs font-semibold',
            positive === true && 'text-emerald-600',
            positive === false && 'text-rose-600',
            positive === null && 'text-[--text-muted]')}>{trend}</span>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-[--text-secondary]">{label}</span>
        <span className="text-[--text-muted] font-medium">{count}</span>
      </div>
      <div className="h-2 w-full bg-[--bg-raised] rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${(count / total) * 100}%` }} />
      </div>
    </div>
  );
}
