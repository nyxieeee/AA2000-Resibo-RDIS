import { useNavigate } from 'react-router-dom';
import { Search, Download, MoreHorizontal, Pencil, Trash2, FileSpreadsheet, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ExcelJS from 'exceljs';
import { useDateFilter, matchesFilter } from '../../hooks/useDateFilter';
import type { DateFilterState } from '../../hooks/useDateFilter';
import { DateRangeFilter } from '../../components/ui/DateRangeFilter';
import type { DocumentRecord } from '../../types/document';

// Sheet names match the actual template (FEB abbreviated, trailing space on JUNE removed internally)
const MONTH_NAMES = [
  'JANUARY','FEB','MARCH','APRIL','MAY','JUNE',
  'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER',
];

// Accounting number format matching the template
const ACCOUNTING_FMT = '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)';

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

async function exportToExcel(docs: DocumentRecord[], filter: DateFilterState) {
  if (docs.length === 0) { alert('No documents to export.'); return; }
  const wb = new ExcelJS.Workbook();
  const year =
    filter.mode === 'yearly' || filter.mode === 'quarterly'
      ? filter.year
      : filter.mode === 'custom' && filter.startDate
      ? new Date(filter.startDate + 'T00:00:00').getFullYear()
      : docs.map(d => new Date(d.date).getFullYear()).filter(Boolean).reduce((a, b) => Math.max(a, b), new Date().getFullYear() - 1);
  const byMonth: Record<number, typeof docs> = {};
  docs.forEach(d => {
    const m = new Date(d.date).getMonth();
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(d);
  });
  MONTH_NAMES.forEach((_, mi) => {
    const rows = byMonth[mi] ?? [];
    const ws = wb.addWorksheet(`${MONTH_NAMES[mi]} ${year}`);

    // Column widths matching the template exactly
    ws.columns = [
      { width: 2.43 },  // A
      { width: 10.57 }, // B  DATE
      { width: 6.14 },  // C  #
      { width: 28.86 }, // D  ACCOUNT TITLES
      { width: 20.29 }, // E  TIN
      { width: 24.43 }, // F  PARTICULARS
      { width: 47.57 }, // G  REGISTERED NAME
      { width: 62.29 }, // H  REGISTERED ADDRESS
      { width: 7.29 },  // I  VOUCHER NO.
      { width: 13.0 },  // J  CHECK NO.
      { width: 18.57 }, // K  REFERENCE RECEIPT
      { width: 16.29 }, // L  RECEIPT NUMBER
      { width: 14.0 },  // M  VAT
      { width: 12.57 }, // N  NON-VAT
      { width: 13.14 }, // O  INPUT TAX
      { width: 20.0 },  // P  INVOICE AMOUNT
    ];

    // Row 1 — blank
    ws.addRow([]);

    // Row 2 — SUMMARY / TOTAL
    const row2 = ws.addRow([
      null,null,null,null,null,null,null,null,
      'SUMMARY',null,null,'TOTAL =',
      { formula: 'SUBTOTAL(109,M6:M99949)' },
      { formula: 'SUBTOTAL(109,N6:N99949)' },
      { formula: 'SUBTOTAL(109,O6:O99949)' },
      { formula: 'SUBTOTAL(109,P6:P99949)' },
    ]);
    row2.font = { bold: true };
    row2.getCell('I').alignment = { horizontal: 'center' };
    row2.getCell('L').alignment = { horizontal: 'center' };
    (['M','N','O','P'] as const).forEach(col => {
      row2.getCell(col).numFmt = ACCOUNTING_FMT;
      row2.getCell(col).alignment = { horizontal: 'center', wrapText: true };
    });
    ws.mergeCells('I2:K2');

    // Row 3 — blank
    ws.addRow([]);

    // Row 4 — header row 1 (with merged cells spanning rows 4-5 for most columns)
    const hdr1 = ws.addRow([
      null,'DATE','#','ACCOUNT TITLES','TIN','PARTICULARS',
      null,null,'VOUCHER NO.','CHECK NO.','REFERENCE RECEIPT',
      'RECEIPT NUMBER','OPERATING EXPENSES',null,'INPUT TAX','INVOICE AMOUNT',
    ]);
    hdr1.font = { bold: true };
    hdr1.eachCell(cell => {
      cell.alignment = { horizontal: 'center', wrapText: true };
      cell.numFmt = Number(cell.col) >= 13 ? ACCOUNTING_FMT : 'General';
    });

    // Row 5 — header row 2 (sub-headers under G and M/N)
    const hdr2 = ws.addRow([
      null,null,null,null,null,null,
      'REGISTERED NAME','REGISTERED ADDRESS',
      null,null,null,null,'VAT','NON-VAT',null,null,
    ]);
    hdr2.font = { bold: true };
    hdr2.eachCell(cell => {
      cell.alignment = { horizontal: 'center', wrapText: true };
      cell.numFmt = Number(cell.col) >= 13 ? ACCOUNTING_FMT : 'General';
    });

    // Apply merged cells to match the template exactly
    // Single columns that span rows 4-5
    ws.mergeCells('B4:B5');
    ws.mergeCells('C4:C5');
    ws.mergeCells('D4:D5');
    ws.mergeCells('E4:E5');
    ws.mergeCells('F4:F5');
    ws.mergeCells('I4:I5');
    ws.mergeCells('J4:J5');
    ws.mergeCells('K4:K5');
    ws.mergeCells('L4:L5');
    ws.mergeCells('O4:O5');
    ws.mergeCells('P4:P5');
    // G4:H4 spans two columns (REGISTERED NAME + ADDRESS header)
    ws.mergeCells('G4:H4');
    // M4:N4 spans OPERATING EXPENSES over VAT + NON-VAT
    ws.mergeCells('M4:N4');

    // Data rows starting at row 6
    rows.forEach((doc, i) => {
      const rowNum = 6 + i;
      const dataRow = ws.addRow([
        null,
        new Date(doc.date + 'T00:00:00'), // B — DATE
        null,                              // C — #
        null,                              // D — ACCOUNT TITLES (blank)
        doc.taxId,                         // E — TIN
        doc.category,                      // F — PARTICULARS
        doc.vendor,                        // G — REGISTERED NAME
        null,                              // H — REGISTERED ADDRESS
        null,                              // I — VOUCHER NO. (blank)
        null,                              // J — CHECK NO. (blank)
        'SALES INVOICE',                   // K — REFERENCE RECEIPT
        doc.docNum,                        // L — RECEIPT NUMBER
        { formula: `(P${rowNum}-N${rowNum})/1.12` }, // M — VAT
        null,                              // N — NON-VAT
        { formula: `M${rowNum}*0.12` },    // O — INPUT TAX
        doc.total,                         // P — INVOICE AMOUNT
      ]);
      dataRow.getCell('B').numFmt = 'mm/dd/yyyy;@';
      dataRow.getCell('B').alignment = { horizontal: 'center' };
      (['E','F','G','H','K','L'] as const).forEach(col => {
        dataRow.getCell(col).alignment = { horizontal: 'center' };
      });
      (['D','F','M','N','O','P'] as const).forEach(col => {
        dataRow.getCell(col).numFmt = ACCOUNTING_FMT;
      });
    });
  });
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await downloadBlob(blob, `AA2000_Purchases_Journal_${year}.xlsx`);
}

// ── Three-dot dropdown ────────────────────────────────────────────────────────
function RowMenu({ docId, onDelete }: { docId: string; onDelete: () => void }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.right - 144 });
    setOpen(o => !o);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    document.addEventListener('scroll', () => setOpen(false), true);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('scroll', () => setOpen(false), true);
    };
  }, [open]);

  return (
    <div onClick={e => e.stopPropagation()}>
      <button ref={btnRef} onClick={openMenu} className="text-[--text-muted] hover:text-[--text-primary] transition-colors p-1 rounded hover:bg-[--bg-raised]">
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-36 bg-[--bg-surface] border border-[--border-subtle] rounded-lg shadow-lg overflow-hidden">
          <button onClick={() => { setOpen(false); navigate(`/documents/${docId}`); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[--text-secondary] hover:bg-[--bg-raised] transition-colors">
            <Pencil className="h-4 w-4 text-[--text-muted]" /> Edit
          </button>
          <button onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function DocumentLibrary() {
  const navigate = useNavigate();
  const { documents, deleteDocument, updateDocument } = useDocumentStore();
  const userRole = useAuthStore((s) => s.user?.role);
  const isAccountant = userRole === 'Accountant';
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { filter, update, AVAILABLE_YEARS } = useDateFilter();

  const pendingCount = useMemo(() => documents.filter(d => d.status === 'Pending Review').length, [documents]);

  const filteredDocs = useMemo(() =>
    documents.filter(doc =>
      matchesFilter(doc.date, filter) &&
      (doc.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
       doc.docNum.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [documents, searchTerm, filter]);

  const handleExport = async () => {
    setIsExporting(true);
    try { await exportToExcel(filteredDocs, filter); }
    catch (e: unknown) { alert(`Export failed: ${e instanceof Error ? e.message : 'Unknown error'}`); }
    finally { setIsExporting(false); }
  };

  const handleDelete = (id: string) => { deleteDocument(id); setDeleteConfirm(null); };

  return (
    <div className="space-y-4 md:space-y-6">
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-[--bg-surface] rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-[--text-primary] text-lg mb-2">Delete document?</h3>
            <p className="text-sm text-[--text-muted] mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-[--text-secondary] border border-[--border-default] rounded-lg hover:bg-[--bg-raised]">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm!)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center sm:flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[--text-primary]">Document Library</h1>
          <p className="text-[--text-muted] text-sm mt-1">Manage and review extracted records</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <DateRangeFilter filter={filter} availableYears={AVAILABLE_YEARS} onChange={update} />
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 bg-blue-600 border border-transparent px-3 md:px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? <Download className="h-4 w-4 animate-bounce" /> : <FileSpreadsheet className="h-4 w-4" />}
            {isExporting ? 'Exporting…' : 'Export Excel'}
          </button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3.5">
          <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{pendingCount} document{pendingCount > 1 ? 's' : ''} awaiting accountant review</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Approve or reject each AI-extracted document below to confirm accuracy before it counts in reports.</p>
          </div>
        </div>
      )}

      <div className="bg-[--bg-surface] rounded-xl border border-[--border-subtle] shadow-sm">
        <div className="p-3 md:p-4 border-b border-[--border-subtle] flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]" />
            <input
              type="text"
              placeholder="Search vendor, doc number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-[--bg-raised] border border-[--border-default] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-72 transition-all text-[--text-primary]"
            />
          </div>
          {filter.mode !== 'all' && (
            <span className="text-xs text-[--text-muted] font-medium shrink-0">{filteredDocs.length} of {documents.length}</span>
          )}
        </div>

        <div className="overflow-x-hidden w-full">
          <table className="w-full text-sm text-left table-fixed">
            <colgroup>
              <col className="w-[35%]" />
              <col className="w-[25%]" />
              <col className="w-[18%]" />
              <col className="hidden sm:table-column w-[10%]" />
              <col className="hidden sm:table-column w-[10%]" />
              <col className="w-[10%] sm:w-[2%]" />
            </colgroup>
            <thead className="bg-[--bg-raised] text-[--text-secondary] font-medium border-b border-[--border-subtle]">
              <tr>
                <th className="px-2 md:px-6 py-3 md:py-4 font-semibold uppercase text-[11px] tracking-wider">Document</th>
                <th className="px-2 md:px-6 py-3 md:py-4 font-semibold uppercase text-[11px] tracking-wider">Vendor</th>
                <th className="px-2 md:px-6 py-3 md:py-4 font-semibold uppercase text-[11px] tracking-wider">Amount</th>
                <th className="px-2 md:px-6 py-3 md:py-4 font-semibold uppercase text-[11px] tracking-wider hidden sm:table-cell">Score</th>
                <th className="px-2 md:px-6 py-3 md:py-4 font-semibold uppercase text-[11px] tracking-wider hidden sm:table-cell">Status</th>
                <th className="px-1 md:px-4 py-3 md:py-4 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border-subtle]">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[--text-muted]">
                    {documents.length === 0 ? 'No documents found. Head to ScanHub to upload one.' : 'No documents match your filters.'}
                  </td>
                </tr>
              ) : filteredDocs.map(doc => (
                <tr key={doc.id} onClick={() => navigate(`/documents/${doc.id}`)}
                  className={cn('hover:bg-[--bg-raised] transition-colors cursor-pointer group',
                    doc.status === 'Pending Review' && 'bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20')}>
                  <td className="px-2 md:px-6 py-3 md:py-4">
                    <div className="font-medium text-[--text-primary] truncate">{doc.name}</div>
                    <div className="text-[--text-muted] flex items-center gap-1 mt-0.5 flex-wrap">
                      <span className="bg-[--bg-raised] px-1 py-0.5 rounded text-[10px] uppercase font-bold text-[--text-secondary]">{doc.type}</span>
                      <span className="text-[10px]">{doc.date}</span>
                    </div>
                  </td>
                  <td className="px-2 md:px-6 py-3 md:py-4">
                    <div className="font-medium text-[--text-primary] truncate">{doc.vendor}</div>
                    <div className="text-[--text-muted] text-xs hidden sm:block">TIN: {doc.taxId}</div>
                  </td>
                  <td className="px-2 md:px-6 py-3 md:py-4">
                    <div className="font-semibold text-[--text-primary] text-xs md:text-sm truncate">₱{doc.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="text-[--text-muted] text-xs hidden sm:block">{doc.category}</div>
                  </td>
                  <td className="px-2 md:px-6 py-3 md:py-4 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-12 md:w-16 h-1.5 bg-[--bg-raised] rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full',
                          doc.confidence >= 90 ? 'bg-green-500' : doc.confidence >= 70 ? 'bg-amber-500' : 'bg-red-500'
                        )} style={{ width: `${doc.confidence}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-[--text-secondary]">{doc.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-2 md:px-6 py-3 md:py-4 hidden sm:table-cell">
                    <span className={cn('px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap',
                      doc.status === 'Pending Review' && 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ring-1 ring-amber-400/40',
                      doc.status === 'Auto OK' && 'bg-[--bg-raised] text-[--text-secondary]',
                      doc.status === 'For Review' && 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20',
                      doc.status === 'Approved' && 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 ring-1 ring-green-500/20',
                      doc.status === 'Declined' && 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 ring-1 ring-red-500/20',
                    )}>{doc.status}</span>
                  </td>

                  <td className="px-1 md:px-4 py-3 md:py-4">
                    <RowMenu docId={doc.id} onDelete={() => setDeleteConfirm(doc.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
