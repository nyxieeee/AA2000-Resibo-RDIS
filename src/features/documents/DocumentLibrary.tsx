import { useNavigate } from 'react-router-dom';
import { Search, Download, MoreHorizontal, Pencil, Trash2, FileSpreadsheet } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ExcelJS from 'exceljs';
import { useDateFilter, matchesFilter } from '../../hooks/useDateFilter';
import type { DateFilterState } from '../../hooks/useDateFilter';
import { DateRangeFilter } from '../../components/ui/DateRangeFilter';
import type { DocumentRecord } from '../../types/document';

import { getExportPeriodString, groupDocsByMonthYear } from '../../lib/exportUtils';
import { downloadBlob } from '../../lib/download';

// Accounting number format matching the template
const ACCOUNTING_FMT = '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)';

async function exportToExcel(docs: DocumentRecord[], filter: DateFilterState) {
  if (docs.length === 0) { alert('No documents to export.'); return; }
  const wb = new ExcelJS.Workbook();
  const period = getExportPeriodString(docs, filter);
  const grouped = groupDocsByMonthYear(docs);

  grouped.forEach(({ year, monthName, docs: rows }) => {
    const ws = wb.addWorksheet(`${monthName} ${year}`);

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
      null, null, null, null, null, null, null, null,
      'SUMMARY', null, null, 'TOTAL =',
      { formula: 'SUBTOTAL(109,M6:M99949)' },
      { formula: 'SUBTOTAL(109,N6:N99949)' },
      { formula: 'SUBTOTAL(109,O6:O99949)' },
      { formula: 'SUBTOTAL(109,P6:P99949)' },
    ]);
    row2.font = { bold: true };
    row2.getCell('I').alignment = { horizontal: 'center' };
    row2.getCell('L').alignment = { horizontal: 'center' };
    (['M', 'N', 'O', 'P'] as const).forEach(col => {
      row2.getCell(col).numFmt = ACCOUNTING_FMT;
      row2.getCell(col).alignment = { horizontal: 'center', wrapText: true };
    });
    ws.mergeCells('I2:K2');

    // Row 3 — blank
    ws.addRow([]);

    // Row 4 — header row 1 (with merged cells spanning rows 4-5 for most columns)
    const hdr1 = ws.addRow([
      null, 'DATE', '#', 'ACCOUNT TITLES', 'TIN', 'PARTICULARS',
      null, null, 'VOUCHER NO.', 'CHECK NO.', 'REFERENCE RECEIPT',
      'RECEIPT NUMBER', 'OPERATING EXPENSES', null, 'INPUT TAX', 'INVOICE AMOUNT',
    ]);
    hdr1.font = { bold: true };
    hdr1.eachCell(cell => {
      cell.alignment = { horizontal: 'center', wrapText: true };
      cell.numFmt = Number(cell.col) >= 13 ? ACCOUNTING_FMT : 'General';
    });

    // Row 5 — header row 2 (sub-headers under G and M/N)
    const hdr2 = ws.addRow([
      null, null, null, null, null, null,
      'REGISTERED NAME', 'REGISTERED ADDRESS',
      null, null, null, null, 'VAT', 'NON-VAT', null, null,
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
        doc.registeredAddress || '',       // H — REGISTERED ADDRESS
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
      (['E', 'F', 'G', 'H', 'K', 'L'] as const).forEach(col => {
        dataRow.getCell(col).alignment = { horizontal: 'center' };
      });
      (['D', 'F', 'M', 'N', 'O', 'P'] as const).forEach(col => {
        dataRow.getCell(col).numFmt = ACCOUNTING_FMT;
      });
    });
  });
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await downloadBlob(blob, `AA2000_Purchases_Journal_${period}.xlsx`);
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
        <div ref={menuRef} style={{
          position: 'fixed',
          top: menuPos.top,
          left: menuPos.left,
          zIndex: 9999,
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '0.5rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          width: '9rem',
        }}>
          <button onClick={() => { setOpen(false); navigate(`/documents/${docId}`); }}
            style={{ color: 'var(--text-secondary)' }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-raised">
            <Pencil className="h-4 w-4" style={{ color: 'var(--text-muted)' }} /> Edit
          </button>
          <button onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20">
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
  const { documents, deleteDocument } = useDocumentStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { filter, update, AVAILABLE_YEARS } = useDateFilter();



  const [activeTab, setActiveTab] = useState<'library' | 'drafts'>('library');
  const draftDocsCount = useMemo(() => documents.filter(d => d.status !== 'Submitted').length, [documents]);

  const filteredDocs = useMemo(() =>
    documents.filter(doc => {
      const basicMatch = matchesFilter(doc.date, filter) &&
        (doc.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.docNum.toLowerCase().includes(searchTerm.toLowerCase()));
      
      if (!basicMatch) return false;
      
      return activeTab === 'drafts' ? (doc.status !== 'Submitted') : (doc.status === 'Submitted');
    }), [documents, searchTerm, filter, activeTab]);

  const handleExport = async () => {
    setIsExporting(true);
    try { await exportToExcel(filteredDocs, filter); }
    catch (e: unknown) { alert(`Export failed: ${e instanceof Error ? e.message : 'Unknown error'}`); }
    finally { setIsExporting(false); }
  };

  const handleDelete = (id: string) => { deleteDocument(id); setDeleteConfirm(null); };

  return (
    <div className="space-y-4 md:space-y-6">
      {deleteConfirm && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          top: 0, left: 0, right: 0, bottom: 0,
          width: '100%',
          height: '100%',
          zIndex: 9999,
          backgroundColor: 'rgba(0,0,0,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 1rem',
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '0.75rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '24rem',
          }}>
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.125rem', marginBottom: '0.5rem' }}>Delete document?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-default)', backgroundColor: 'transparent', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={() => handleDelete(deleteConfirm!)}
                style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}
              >Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end sm:flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[--text-primary]">Document Library</h1>
          <p className="text-[--text-muted] text-sm mt-1 mb-4">Manage and review extracted records</p>
          
          <div className="flex items-center gap-1 bg-[--bg-raised] p-1 rounded-lg w-max border border-[--border-subtle]">
            <button
              onClick={() => setActiveTab('library')}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                activeTab === 'library' 
                  ? "bg-[--bg-surface] text-[--text-primary] shadow-sm border border-[--border-subtle]" 
                  : "text-[--text-secondary] hover:text-[--text-primary] border border-transparent"
              )}
            >
              Submitted
            </button>
            <button
              onClick={() => setActiveTab('drafts')}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                activeTab === 'drafts' 
                  ? "bg-[--bg-surface] text-amber-600 dark:text-amber-400 shadow-sm border border-[--border-subtle]" 
                  : "text-[--text-secondary] hover:text-[--text-primary] border border-transparent"
              )}
            >
              Drafts
              {draftDocsCount > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] fold-bold leading-none",
                  activeTab === 'drafts' 
                    ? "bg-amber-100 text-amber-700" 
                    : "bg-[--bg-surface] text-[--text-muted] border border-[--border-subtle]"
                )}>
                  {draftDocsCount}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="flex w-full sm:w-auto justify-between sm:justify-end gap-2 items-center">
          <DateRangeFilter filter={filter} availableYears={AVAILABLE_YEARS} onChange={update} />
          <button
            onClick={handleExport}
            disabled={isExporting || activeTab === 'drafts'}
            title={activeTab === 'drafts' ? "You cannot export drafts. Switch to the Submitted tab." : "Export to Excel"}
            className="flex items-center justify-center gap-2 bg-blue-600 border border-transparent p-2 md:px-4 md:py-2 rounded-lg text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <Download className="h-5 w-5 md:h-4 md:w-4 animate-bounce" />
            ) : (
              <>
                <Download className="h-5 w-5 md:hidden" />
                <FileSpreadsheet className="hidden md:block h-4 w-4" />
              </>
            )}
            <span className="hidden md:inline">{isExporting ? 'Exporting…' : 'Export Excel'}</span>
          </button>
        </div>
      </div>



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

        <div className="overflow-hidden w-full">
          <table className="w-full text-sm text-left table-fixed">
            <colgroup>
              <col className="w-full sm:w-[32%]" />
              <col className="hidden sm:table-column sm:w-[22%]" />
              <col className="w-24 sm:w-[15%]" />
              <col className="hidden sm:table-column sm:w-[10%]" />
              <col className="hidden sm:table-column sm:w-[17%]" />
              <col className="w-10 md:w-11" />
            </colgroup>
            <thead className="bg-[--bg-raised] text-[--text-secondary] font-medium border-b border-[--border-subtle]">
              <tr>
                <th className="px-3 md:px-4 py-3 font-semibold uppercase text-[11px] tracking-wider">Document</th>
                <th className="px-3 md:px-4 py-3 font-semibold uppercase text-[11px] tracking-wider hidden sm:table-cell">Vendor</th>
                <th className="px-2 md:px-4 py-3 font-semibold uppercase text-[11px] tracking-wider text-right">Amount</th>
                <th className="px-3 md:px-4 py-3 font-semibold uppercase text-[11px] tracking-wider hidden sm:table-cell text-center">Score</th>
                <th className="px-3 md:px-4 py-3 font-semibold uppercase text-[11px] tracking-wider hidden sm:table-cell text-center">Status</th>
                <th className="px-2 py-3"></th>
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
                  className="hover:bg-[--bg-raised] transition-all duration-300 cursor-pointer group hover:pl-2 relative overflow-hidden">
                  <td className="px-3 md:px-4 py-3 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-top duration-300" />
                    <div className="font-medium text-[--text-primary] text-xs md:text-sm truncate group-hover:translate-x-1 transition-transform duration-300">
                      <span className="sm:hidden">{doc.vendor}</span>
                      <span className="hidden sm:inline">{doc.name}</span>
                    </div>
                    <div className="text-[--text-muted] flex items-center gap-1 mt-0.5 flex-wrap group-hover:translate-x-1 transition-transform duration-300 delay-75">
                      <span className="bg-[--bg-raised] px-1 py-0.5 rounded text-[9px] md:text-[10px] uppercase font-bold text-[--text-secondary]">{doc.type}</span>
                      <span className="text-[9px] md:text-[10px]">{doc.date}</span>
                    </div>
                  </td>
                  <td className="px-3 md:px-4 py-3 hidden sm:table-cell">
                    <div className="font-medium text-[--text-primary] text-xs md:text-sm truncate">{doc.vendor}</div>
                    <div className="text-[--text-muted] text-[10px] hidden sm:block truncate">TIN: {doc.taxId}</div>
                  </td>
                  <td className="px-3 md:px-4 py-3 text-right">
                    <div className="font-semibold text-[--text-primary] text-xs md:text-sm truncate">₱{doc.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="text-[--text-muted] text-[10px] hidden sm:block truncate">{doc.category}</div>
                  </td>
                  <td className="px-3 md:px-4 py-3 hidden sm:table-cell text-center">
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-12 md:w-20 h-1 bg-[--bg-raised] rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full',
                          doc.confidence >= 90 ? 'bg-green-500' : doc.confidence >= 70 ? 'bg-amber-500' : 'bg-red-500'
                        )} style={{ width: `${doc.confidence}%` }} />
                      </div>
                      <span className="text-[10px] font-semibold text-[--text-secondary]">{doc.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-3 md:px-4 py-3 hidden sm:table-cell text-center">
                    <span className={cn('px-2 py-0.5 md:px-2 md:py-1 rounded-full text-[10px] md:text-xs font-semibold whitespace-nowrap inline-block',
                      doc.status === 'Submitted' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    )}>
                      {doc.status === 'Submitted' ? 'Submitted' : 'Draft'}
                    </span>
                  </td>

                  <td className="px-2 py-3 text-center">
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
