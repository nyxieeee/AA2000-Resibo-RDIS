import type { DocumentRecord } from '../types/document';
import type { DateFilterState } from '../hooks/useDateFilter';

export const MONTH_NAMES = [
  'JANUARY', 'FEB', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

export function getExportPeriodString(docs: DocumentRecord[], filter: DateFilterState): string {
  if (filter.mode === 'yearly') {
    return `${filter.year}`;
  }
  
  if (filter.mode === 'quarterly') {
    return `Q${filter.quarter}_${filter.year}`;
  }

  // For 'all' or 'custom', we derive from the actual documents
  const years = Array.from(new Set(docs.map(d => new Date(d.date).getFullYear()))).filter(Boolean).sort((a, b) => a - b);
  
  if (years.length === 0) {
    return `${new Date().getFullYear()}`;
  }

  return years.join('-');
}

export interface GroupedDocuments {
  year: number;
  monthIndex: number;
  monthName: string;
  docs: DocumentRecord[];
}

export function groupDocsByMonthYear(docs: DocumentRecord[]): GroupedDocuments[] {
  const groups: Record<string, { year: number; monthIndex: number; docs: DocumentRecord[] }> = {};

  docs.forEach(doc => {
    const d = new Date(doc.date);
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${m}`;
    
    if (!groups[key]) {
      groups[key] = { year: y, monthIndex: m, docs: [] };
    }
    groups[key].docs.push(doc);
  });

  return Object.values(groups)
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthIndex - b.monthIndex;
    })
    .map(g => ({
      ...g,
      monthName: MONTH_NAMES[g.monthIndex]
    }));
}
