import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DateFilterState, FilterMode } from '../../hooks/useDateFilter';
import { filterLabel } from '../../hooks/useDateFilter';

interface Props {
  filter: DateFilterState;
  availableYears: number[];
  onChange: (patch: Partial<DateFilterState>) => void;
  /** compact = icon-only trigger for tight toolbars */
  compact?: boolean;
}

const QUARTERS = [
  { value: 1, label: 'Q1 (Jan–Mar)' },
  { value: 2, label: 'Q2 (Apr–Jun)' },
  { value: 3, label: 'Q3 (Jul–Sep)' },
  { value: 4, label: 'Q4 (Oct–Dec)' },
] as const;

export function DateRangeFilter({ filter, availableYears, onChange, compact }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const label = filterLabel(filter);
  const isActive = filter.mode !== 'all';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 border rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
        )}
      >
        <Calendar className="h-4 w-4 shrink-0" />
        {!compact && <span className="max-w-[160px] truncate">{label}</span>}
        {isActive && !compact && (
          <X
            className="h-3.5 w-3.5 text-blue-500 hover:text-blue-800"
            onClick={(e) => { e.stopPropagation(); onChange({ mode: 'all' }); setOpen(false); }}
          />
        )}
        {!isActive && <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 space-y-4"
        >
          {/* Mode tabs */}
          <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg">
            {(['all', 'yearly', 'quarterly', 'custom'] as FilterMode[]).map(m => (
              <button
                key={m}
                onClick={() => onChange({ mode: m })}
                className={cn(
                  'py-1 text-xs font-semibold rounded-md capitalize transition-colors',
                  filter.mode === m
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {m === 'all' ? 'All' : m === 'yearly' ? 'Year' : m === 'quarterly' ? 'Qtr' : 'Range'}
              </button>
            ))}
          </div>

          {/* Yearly */}
          {filter.mode === 'yearly' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Fiscal Year</label>
              <div className="grid grid-cols-3 gap-2">
                {availableYears.map(y => (
                  <button
                    key={y}
                    onClick={() => onChange({ year: y })}
                    className={cn(
                      'py-2 text-sm font-semibold rounded-lg border transition-colors',
                      filter.year === y
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quarterly */}
          {filter.mode === 'quarterly' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Year</label>
                <select
                  value={filter.year}
                  onChange={e => onChange({ year: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Quarter</label>
                <div className="grid grid-cols-2 gap-2">
                  {QUARTERS.map(q => (
                    <button
                      key={q.value}
                      onClick={() => onChange({ quarter: q.value })}
                      className={cn(
                        'py-2 px-3 text-xs font-semibold rounded-lg border transition-colors text-left',
                        filter.quarter === q.value
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                      )}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Custom range */}
          {filter.mode === 'custom' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">From</label>
                <input
                  type="date"
                  value={filter.startDate}
                  onChange={e => onChange({ startDate: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">To</label>
                <input
                  type="date"
                  value={filter.endDate}
                  min={filter.startDate || undefined}
                  onChange={e => onChange({ endDate: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {filter.mode !== 'all' && (
            <button
              onClick={() => { onChange({ mode: 'all' }); setOpen(false); }}
              className="w-full text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
            >
              Clear filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}