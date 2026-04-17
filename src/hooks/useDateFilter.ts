import { useState } from 'react';

export type FilterMode = 'all' | 'yearly' | 'quarterly' | 'custom';

export interface DateFilterState {
  mode: FilterMode;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  startDate: string;
  endDate: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

export function useDateFilter() {
  const [filter, setFilter] = useState<DateFilterState>({
    mode: 'all',
    year: CURRENT_YEAR,
    quarter: Math.ceil((new Date().getMonth() + 1) / 3) as 1 | 2 | 3 | 4,
    startDate: '',
    endDate: '',
  });

  const update = (patch: Partial<DateFilterState>) =>
    setFilter(f => ({ ...f, ...patch }));

  return { filter, update, AVAILABLE_YEARS };
}

/** Returns true if an ISO date string (YYYY-MM-DD) falls within the active filter */
export function matchesFilter(date: string, filter: DateFilterState): boolean {
  if (filter.mode === 'all') return true;

  const d = new Date(date + 'T00:00:00');
  if (isNaN(d.getTime())) return false;

  if (filter.mode === 'yearly') {
    return d.getFullYear() === filter.year;
  }

  if (filter.mode === 'quarterly') {
    const q = Math.ceil((d.getMonth() + 1) / 3);
    return d.getFullYear() === filter.year && q === filter.quarter;
  }

  if (filter.mode === 'custom') {
    const start = filter.startDate ? new Date(filter.startDate + 'T00:00:00') : null;
    const end   = filter.endDate   ? new Date(filter.endDate   + 'T23:59:59') : null;
    if (start && d < start) return false;
    if (end   && d > end)   return false;
    return true;
  }

  return true;
}

export function filterLabel(filter: DateFilterState): string {
  if (filter.mode === 'all')       return 'All Time';
  if (filter.mode === 'yearly')    return `FY ${filter.year}`;
  if (filter.mode === 'quarterly') return `Q${filter.quarter} ${filter.year}`;
  if (filter.mode === 'custom') {
    if (filter.startDate && filter.endDate) return `${filter.startDate} → ${filter.endDate}`;
    if (filter.startDate) return `From ${filter.startDate}`;
    if (filter.endDate)   return `Until ${filter.endDate}`;
    return 'Custom Range';
  }
  return '';
}
