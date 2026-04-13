import { CheckCircle2, AlertCircle, Clock, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  'Auto OK': '#22c55e',
  'Approved': '#3b82f6',
  'For Review': '#f59e0b',
  'Declined': '#ef4444',
};

export function Analytics() {
  const documents = useDocumentStore(state => state.documents);

  const stats = useMemo(() => {
    const totalDocs = documents.length;
    let failedCount = 0;
    documents.forEach(doc => { if (doc.status === 'Declined') failedCount++; });
    const successRate = totalDocs > 0 ? (((totalDocs - failedCount) / totalDocs) * 100).toFixed(1) : '0.0';
    return { totalProcessed: totalDocs, avgSpeed: totalDocs > 0 ? '~5' : '0', successRate, failedRuns: failedCount };
  }, [documents]);

  // Confidence distribution buckets
  const confidenceData = useMemo(() => {
    const buckets = [
      { range: '0-59', count: 0 },
      { range: '60-69', count: 0 },
      { range: '70-79', count: 0 },
      { range: '80-89', count: 0 },
      { range: '90-94', count: 0 },
      { range: '95-100', count: 0 },
    ];
    documents.forEach(doc => {
      const c = doc.confidence;
      if (c < 60) buckets[0].count++;
      else if (c < 70) buckets[1].count++;
      else if (c < 80) buckets[2].count++;
      else if (c < 90) buckets[3].count++;
      else if (c < 95) buckets[4].count++;
      else buckets[5].count++;
    });
    return buckets;
  }, [documents]);

  // Status breakdown for pie chart
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach(doc => {
      counts[doc.status] = (counts[doc.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [documents]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 mt-1">Platform performance and overall success rates</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard label="Total Processed" value={stats.totalProcessed} unit="docs" icon={<Zap />} color="text-blue-600" bg="bg-blue-100" />
        <MetricCard label="Avg Processing" value={stats.avgSpeed} unit="sec/doc" icon={<Clock />} color="text-amber-600" bg="bg-amber-100" />
        <MetricCard label="Success Rate" value={stats.successRate} unit="%" icon={<CheckCircle2 />} color="text-green-600" bg="bg-green-100" />
        <MetricCard label="Failed Runs" value={stats.failedRuns} unit="docs" icon={<AlertCircle />} color="text-rose-600" bg="bg-rose-100" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Confidence Distribution Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Confidence Score Distribution</h3>
          {documents.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No documents yet — upload via ScanHub</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={confidenceData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  formatter={(v: any) => [`${v} doc${v !== 1 ? 's' : ''}`, 'Count']}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status Breakdown Pie Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Document Status Breakdown</h3>
          {documents.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No documents yet — upload via ScanHub</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ fontSize: 12, color: '#475569' }}>{value}</span>}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  formatter={(v: any, name: any) => [`${v} doc${v !== 1 ? 's' : ''}`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, icon, color, bg }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn('p-2 rounded-lg', bg, color)}>{icon}</div>
        <h3 className="font-semibold text-slate-600 truncate">{label}</h3>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-slate-900">{value}</span>
        <span className="text-sm font-medium text-slate-500">{unit}</span>
      </div>
    </div>
  );
}
