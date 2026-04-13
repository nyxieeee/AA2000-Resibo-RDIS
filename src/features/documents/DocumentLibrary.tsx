import { useNavigate } from 'react-router-dom';
import { Search, Filter, Download, MoreHorizontal, Pencil, Trash2, FileSpreadsheet } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ExcelJS from 'exceljs';

// ── Excel export helpers (same logic as Exports.tsx) ─────────────────────────

const MONTH_NAMES = [
  'JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
  'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER',
];

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

async function exportToExcel(docs: ReturnType<typeof useDocumentStore>['documents']) {
  if (docs.length === 0) { alert('No documents to export.'); return; }

  const wb = new ExcelJS.Workbook();
  const year = Math.max(...docs.map(d => new Date(d.date).getFullYear()).filter(Boolean), new Date().getFullYear());

  const byMonth: Record<number, typeof docs> = {};
  docs.forEach(d => {
    const m = new Date(d.date).getMonth();
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(d);
  });

  MONTH_NAMES.forEach((_, mi) => {
    const rows = byMonth[mi] ?? [];
    const ws = wb.addWorksheet(`${MONTH_NAMES[mi]} ${year}`);

    ws.columns = [
      { width: 4 }, { width: 12 }, { width: 5 }, { width: 18 }, { width: 20 },
      { width: 14 }, { width: 32 }, { width: 45 }, { width: 12 }, { width: 12 },
      { width: 16 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 16 },
    ];

    const lastRow = Math.max(99950, 5 + rows.length);
    ws.addRow([]);

    const row2 = ws.addRow([
      null,null,null,null,null,null,null,null,
      'SUMMARY',null,null,'TOTAL =',
      { formula: `SUBTOTAL(109,M6:M${lastRow})` },
      { formula: `SUBTOTAL(109,N6:N${lastRow})` },
      { formula: `SUBTOTAL(109,O6:O${lastRow})` },
      { formula: `SUBTOTAL(109,P6:P${lastRow})` },
    ]);
    row2.font = { bold: true };
    ws.addRow([]);

    const hdr1 = ws.addRow([
      null,'DATE','#','ACCOUNT TITLES','TIN','PARTICULARS',
      null,null,'VOUCHER NO.','CHECK NO.','REFERENCE RECEIPT',
      'RECEIPT NUMBER','OPERATING EXPENSES',null,'INPUT TAX','INVOICE AMOUNT',
    ]);
    hdr1.font = { bold: true };
    hdr1.alignment = { horizontal: 'center', wrapText: true };

    const hdr2 = ws.addRow([
      null,null,null,null,null,null,
      'REGISTERED NAME','REGISTERED ADDRESS',
      null,null,null,null,'VAT','NON-VAT',null,null,
    ]);
    hdr2.font = { bold: true };
    hdr2.alignment = { horizontal: 'center', wrapText: true };

    rows.forEach((doc, i) => {
      const rowNum = 6 + i;
      ws.addRow([
        null, doc.date, null, null, doc.taxId, doc.category,
        doc.vendor, null, null, null, 'SALES INVOICE', doc.docNum,
        { formula: `(P${rowNum}-N${rowNum})/1.12` },
        null,
        { formula: `M${rowNum}*0.12` },
        doc.total,
      ]);
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

  // Close on outside click or scroll
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
      <button
        ref={btnRef}
        onClick={openMenu}
        className="text-slate-400 hover:text-slate-900 transition-colors p-1 rounded hover:bg-slate-100"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-36 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
        >
          <button
            onClick={() => { setOpen(false); navigate(`/documents/${docId}`); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Pencil className="h-4 w-4 text-slate-400" />
            Edit
          </button>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete
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

  const filteredDocs = useMemo(() =>
    documents.filter(doc =>
      doc.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.docNum.toLowerCase().includes(searchTerm.toLowerCase())
    ), [documents, searchTerm]);

  const handleExport = async () => {
    setIsExporting(true);
    try { await exportToExcel(documents); }
    catch (e: any) { alert(`Export failed: ${e.message}`); }
    finally { setIsExporting(false); }
  };

  const handleDelete = (id: string) => {
    deleteDocument(id);
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-6">
      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="font-bold text-slate-900 text-lg mb-2">Delete document?</h3>
            <p className="text-sm text-slate-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Document Library</h1>
          <p className="text-slate-500 mt-1">Manage and review extracted records</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-slate-50">
            <Filter className="h-4 w-4 text-slate-500" />
            Filters
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 bg-blue-600 border border-transparent px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting
              ? <Download className="h-4 w-4 animate-bounce" />
              : <FileSpreadsheet className="h-4 w-4" />}
            {isExporting ? 'Exporting…' : 'Export Excel'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search vendor, doc number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white w-80 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase text-[11px] tracking-wider">Document / Type</th>
                <th className="px-6 py-4 font-semibold uppercase text-[11px] tracking-wider">Vendor Details</th>
                <th className="px-6 py-4 font-semibold uppercase text-[11px] tracking-wider">Amount</th>
                <th className="px-6 py-4 font-semibold uppercase text-[11px] tracking-wider">Confidence</th>
                <th className="px-6 py-4 font-semibold uppercase text-[11px] tracking-wider">Status</th>
                <th className="px-6 py-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No documents found. Head to ScanHub to upload one.
                  </td>
                </tr>
              ) : filteredDocs.map(doc => (
                <tr
                  key={doc.id}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 line-clamp-1 w-48">{doc.name}</div>
                    <div className="text-slate-500 flex items-center gap-2 mt-0.5">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-slate-600">{doc.type}</span>
                      <span>{doc.date}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{doc.vendor}</div>
                    <div className="text-slate-500 text-xs">TIN: {doc.taxId}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">₱ {doc.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="text-slate-500 text-xs">{doc.category}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full',
                          doc.confidence >= 90 ? 'bg-green-500' : doc.confidence >= 70 ? 'bg-amber-500' : 'bg-red-500'
                        )} style={{ width: `${doc.confidence}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-600">{doc.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap',
                      doc.status === 'Auto OK' && 'bg-slate-100 text-slate-700',
                      doc.status === 'For Review' && 'bg-amber-100 text-amber-700 ring-1 ring-amber-500/20',
                      doc.status === 'Approved' && 'bg-green-100 text-green-700 ring-1 ring-green-500/20',
                      doc.status === 'Declined' && 'bg-red-100 text-red-700 ring-1 ring-red-500/20',
                    )}>{doc.status}</span>
                  </td>
                  <td className="px-6 py-4">
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
