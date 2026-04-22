import { CheckCircle2, AlertCircle, Clock, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDocumentStore } from '../../store/useDocumentStore';
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useDateFilter, matchesFilter } from '../../hooks/useDateFilter';
import { DateRangeFilter } from '../../components/ui/DateRangeFilter';

const STATUS_COLORS: Record<string, string> = {
  'Auto OK': '#22c55e',
  'Approved': '#3b82f6',
  'For Review': '#f59e0b',
  'Declined': '#ef4444',
};

export function Analytics() {
  const documents = useDocumentStore(state => state.documents);
  const { filter, update, AVAILABLE_YEARS } = useDateFilter();

  const filteredDocs = useMemo(
    () => documents.filter(d => d.status === 'Submitted' && matchesFilter(d.date, filter)),
    [documents, filter]
  );

  const stats = useMemo(() => {
    const totalDocs = filteredDocs.length;
    const failedCount = filteredDocs.filter(doc => doc.status === 'Declined').length;
    const successRate = totalDocs > 0 ? (((totalDocs - failedCount) / totalDocs) * 100).toFixed(1) : '0.0';
    return { totalProcessed: totalDocs, avgSpeed: totalDocs > 0 ? '~5' : '0', successRate, failedRuns: failedCount };
  }, [filteredDocs]);

  const confidenceData = useMemo(() => {
    const buckets = [
      { range: '0-59', count: 0 }, { range: '60-69', count: 0 },
      { range: '70-79', count: 0 }, { range: '80-89', count: 0 },
      { range: '90-94', count: 0 }, { range: '95-100', count: 0 },
    ];
    filteredDocs.forEach(doc => {
      const c = doc.confidence;
      if (c < 60) buckets[0].count++;
      else if (c < 70) buckets[1].count++;
      else if (c < 80) buckets[2].count++;
      else if (c < 90) buckets[3].count++;
      else if (c < 95) buckets[4].count++;
      else buckets[5].count++;
    });
    return buckets;
  }, [filteredDocs]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredDocs.forEach(doc => { counts[doc.status] = (counts[doc.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredDocs]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center sm:flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[--text-primary]">Analytics</h1>
          <p className="text-[--text-muted] text-sm mt-1">Platform performance and overall success rates</p>
        </div>
        <DateRangeFilter filter={filter} availableYears={AVAILABLE_YEARS} onChange={update} />
      </div>

      {filter.mode !== 'all' && (
        <div className="text-xs text-[--text-muted] font-medium bg-[--bg-raised] border border-[--border-subtle] rounded-lg px-3 py-2">
          Showing <span className="font-bold text-[--text-primary]">{filteredDocs.length}</span> of {documents.length} documents for the selected period
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <MetricCard label="Total Processed" value={stats.totalProcessed} unit="docs" icon={<Zap />} color="text-blue-600" bg="bg-blue-100 dark:bg-blue-950/30" />
        <MetricCard label="Avg Processing" value={stats.avgSpeed} unit="sec/doc" icon={<Clock />} color="text-amber-600" bg="bg-amber-100 dark:bg-amber-950/30" />
        <MetricCard label="Success Rate" value={stats.successRate} unit="%" icon={<CheckCircle2 />} color="text-green-600" bg="bg-green-100 dark:bg-green-950/30" />
        <MetricCard label="Failed Runs" value={stats.failedRuns} unit="docs" icon={<AlertCircle />} color="text-rose-600" bg="bg-rose-100 dark:bg-rose-950/30" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-[--bg-surface] border border-[--border-subtle] rounded-xl p-4 md:p-6 shadow-sm">
          <h3 className="font-semibold text-[--text-primary] mb-4">Confidence Score Distribution</h3>
          {filteredDocs.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-[--text-muted] text-sm">No documents for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={confidenceData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '12px' }} formatter={(v) => { const n = Number(v ?? 0); return [`${n} doc${n !== 1 ? 's' : ''}`, 'Count']; }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-[--bg-surface] border border-[--border-subtle] rounded-xl p-4 md:p-6 shadow-sm">
          <h3 className="font-semibold text-[--text-primary] mb-4">Document Status Breakdown</h3>
          {filteredDocs.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-[--text-muted] text-sm">No documents for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {statusData.map((entry) => <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{value}</span>} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '12px' }} formatter={(v, name) => { const n = Number(v ?? 0); return [`${n} doc${n !== 1 ? 's' : ''}`, name]; }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

function MetricCard({ label, value, unit, icon, color, bg }: MetricCardProps) {
  return (
    <div className="bg-[--bg-surface] border border-[--border-subtle] rounded-xl p-4 md:p-6 flex flex-col justify-between shadow-sm">
      <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
        <div className={cn('p-1.5 md:p-2 rounded-lg shrink-0', bg, color)}>{icon}</div>
        <h3 className="font-semibold text-[--text-secondary] text-xs md:text-sm truncate">{label}</h3>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl md:text-3xl font-bold text-[--text-primary]">{value}</span>
        <span className="text-xs md:text-sm font-medium text-[--text-muted]">{unit}</span>
      </div>
    </div>
  );
}
