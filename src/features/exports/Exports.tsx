import { Download } from 'lucide-react';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useState } from 'react';
import ExcelJS from 'exceljs';

// ─── Month helpers ────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

function getSheetName(monthIndex: number, year: number): string {
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

function deriveYear(docs: { date: string }[], fallback = new Date().getFullYear()): number {
  const years = docs.map(d => new Date(d.date).getFullYear()).filter(Boolean);
  return years.length ? Math.max(...years) : fallback;
}

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Build Purchases & Expenses Journal workbook ──────────────────────────────
async function buildPurchasesWorkbook(
  docs: ReturnType<typeof useDocumentStore>['documents'],
): Promise<Blob> {
  const wb = new ExcelJS.Workbook();

  const expenseDocs = docs.filter(d => d.category === 'Expense');
  const year = deriveYear(expenseDocs);

  const byMonth: Record<number, typeof expenseDocs> = {};
  expenseDocs.forEach(d => {
    const m = new Date(d.date).getMonth();
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(d);
  });

  MONTH_NAMES.forEach((_, mi) => {
    const rows = byMonth[mi] ?? [];
    const ws = wb.addWorksheet(getSheetName(mi, year));

    ws.columns = [
      { width: 4 },   // A
      { width: 12 },  // B — DATE
      { width: 5 },   // C — #
      { width: 18 },  // D — ACCOUNT TITLES
      { width: 20 },  // E — TIN
      { width: 14 },  // F — PARTICULARS
      { width: 32 },  // G — REGISTERED NAME
      { width: 45 },  // H — REGISTERED ADDRESS
      { width: 12 },  // I — VOUCHER NO.
      { width: 12 },  // J — CHECK NO.
      { width: 16 },  // K — REFERENCE RECEIPT
      { width: 18 },  // L — RECEIPT NUMBER
      { width: 16 },  // M — VAT
      { width: 16 },  // N — NON-VAT
      { width: 14 },  // O — INPUT TAX
      { width: 16 },  // P — INVOICE AMOUNT
    ];

    const lastRow = Math.max(99950, 5 + rows.length);

    // Row 1 — blank
    ws.addRow([]);

    // Row 2 — SUMMARY + SUBTOTAL formulas
    const row2 = ws.addRow([
      null, null, null, null, null, null, null, null,
      'SUMMARY', null, null, 'TOTAL =',
      { formula: `SUBTOTAL(109,M6:M${lastRow})` },
      { formula: `SUBTOTAL(109,N6:N${lastRow})` },
      { formula: `SUBTOTAL(109,O6:O${lastRow})` },
      { formula: `SUBTOTAL(109,P6:P${lastRow})` },
    ]);
    row2.font = { bold: true };

    // Row 3 — blank
    ws.addRow([]);

    // Row 4 — header line 1
    const hdr1 = ws.addRow([
      null, 'DATE', '#', 'ACCOUNT TITLES', 'TIN', 'PARTICULARS',
      null, null, 'VOUCHER NO.', 'CHECK NO.', 'REFERENCE RECEIPT',
      'RECEIPT NUMBER', 'OPERATING EXPENSES', null, 'INPUT TAX', 'INVOICE AMOUNT',
    ]);
    hdr1.font = { bold: true };
    hdr1.alignment = { horizontal: 'center', wrapText: true };

    // Row 5 — header line 2
    const hdr2 = ws.addRow([
      null, null, null, null, null, null,
      'REGISTERED NAME', 'REGISTERED ADDRESS',
      null, null, null, null, 'VAT', 'NON-VAT', null, null,
    ]);
    hdr2.font = { bold: true };
    hdr2.alignment = { horizontal: 'center', wrapText: true };

    // Data rows from row 6
    rows.forEach((doc, i) => {
      const rowNum = 6 + i;
      ws.addRow([
        null,
        doc.date,
        null,
        null,
        doc.taxId,
        doc.category,
        doc.vendor,
        null,
        null,
        null,
        'SALES INVOICE',
        doc.docNum,
        { formula: `(P${rowNum}-N${rowNum})/1.12` },
        null,
        { formula: `M${rowNum}*0.12` },
        doc.total,
      ]);
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ─── Build VAT Sales workbook ─────────────────────────────────────────────────
async function buildVatSalesWorkbook(
  docs: ReturnType<typeof useDocumentStore>['documents'],
): Promise<Blob> {
  const wb = new ExcelJS.Workbook();

  const revenueDocs = docs.filter(d => d.category === 'Revenue');
  const year = deriveYear(revenueDocs);

  const byMonth: Record<number, typeof revenueDocs> = {};
  revenueDocs.forEach(d => {
    const m = new Date(d.date).getMonth();
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(d);
  });

  MONTH_NAMES.forEach((_, mi) => {
    const rows = byMonth[mi] ?? [];
    const ws = wb.addWorksheet(getSheetName(mi, year));

    ws.columns = [
      { width: 4 },   // A
      { width: 12 },  // B — DATE
      { width: 35 },  // C — CLIENTS NAME
      { width: 22 },  // D — TIN
      { width: 40 },  // E — ADDRESS
      { width: 16 },  // F — KIND OF RECEIPT
      { width: 18 },  // G — RECEIPT NUMBER
      { width: 18 },  // H — VATABLE PURCHASE
      { width: 14 },  // I — INPUT VAT
      { width: 18 },  // J — INVOICE AMOUNT
      { width: 18 },  // K — WITHHOLDING TAX
      { width: 22 },  // L — FINAL WITHHOLDING VAT
      { width: 24 },  // M — RETENTION/OTHER DEDUCTIONS
      { width: 20 },  // N — AMOUNT COLLECTED
    ];

    const lastDataRow = Math.max(778, 9 + rows.length);
    const dateEncoded = new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    }).toUpperCase();

    ws.addRow([]);
    ws.addRow([null, 'Company Name']);
    ws.addRow([null, `${MONTH_NAMES[mi]} ${year}`]);
    ws.addRow([null, `FOR THE PERIOD : ${MONTH_NAMES[mi].charAt(0)}${MONTH_NAMES[mi].slice(1).toLowerCase()} ${year}`]);
    ws.addRow([null, `DATE ENCODED : ${dateEncoded}`]);
    ws.addRow([]);

    const totalRow = ws.addRow([
      null, null, null, null, null, null, 'TOTAL =',
      { formula: `SUBTOTAL(109,H10:H${lastDataRow})` },
      { formula: `SUBTOTAL(109,I10:I${lastDataRow})` },
      { formula: `SUBTOTAL(109,J10:J${lastDataRow})` },
      { formula: `SUBTOTAL(109,K10:K${lastDataRow})` },
      { formula: `SUBTOTAL(109,L10:L${lastDataRow})` },
      { formula: `SUBTOTAL(109,M10:M${lastDataRow})` },
      { formula: `SUBTOTAL(109,N10:N${lastDataRow})` },
    ]);
    totalRow.font = { bold: true };

    ws.addRow([]);

    const hdr = ws.addRow([
      null, 'DATE', 'CLIENTS NAME', 'TIN', 'ADDRESS',
      'KIND OF RECEIPT', 'RECEIPT NUMBER',
      'VATABLE PURCHASE', 'INPUT VAT', 'INVOICE AMOUNT',
      'WITHHOLDING TAX', 'FINAL WITHHOLDING VAT',
      'RETENTION/\nOTHER DEDUCTIONS', 'AMOUNT COLLECTED',
    ]);
    hdr.font = { bold: true };
    hdr.alignment = { horizontal: 'center', wrapText: true };

    rows.forEach((doc, i) => {
      const rowNum = 10 + i;
      ws.addRow([
        null,
        doc.date,
        doc.vendor,
        doc.taxId,
        null,
        'SALES INVOICE',
        doc.docNum,
        { formula: `J${rowNum}/1.12` },
        { formula: `H${rowNum}*0.12` },
        doc.total,
        null,
        null,
        null,
        { formula: `J${rowNum}-K${rowNum}-L${rowNum}-M${rowNum}` },
      ]);
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ─── Component ────────────────────────────────────────────────────────────────
export function Exports() {
  const documents = useDocumentStore(state => state.documents);
  const addNotification = useNotificationStore(state => state.addNotification);
  const [exportType, setExportType] = useState<'purchases' | 'vat' | 'csv'>('purchases');
  const [isExporting, setIsExporting] = useState(false);

  const expenseCount = documents.filter(d => d.category === 'Expense').length;
  const revenueCount = documents.filter(d => d.category === 'Revenue').length;
  const year = new Date().getFullYear();

  const handleExport = async () => {
    if (documents.length === 0) { alert('No documents to export.'); return; }
    setIsExporting(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      if (exportType === 'purchases') {
        if (expenseCount === 0) { alert('No expense documents found to export.'); return; }
        const blob = await buildPurchasesWorkbook(documents);
        await downloadBlob(blob, `PURCHASES_AND_EXPENSES_JOURNAL_${year}.xlsx`);
        addNotification({ title: 'Export Successful', message: `Downloaded Purchases & Expenses Journal with ${expenseCount} records.`, type: 'success' });

      } else if (exportType === 'vat') {
        if (revenueCount === 0) { alert('No revenue documents found to export.'); return; }
        const blob = await buildVatSalesWorkbook(documents);
        await downloadBlob(blob, `VAT_SALES_TO_BE_REPORTED_${year}.xlsx`);
        addNotification({ title: 'Export Successful', message: `Downloaded VAT Sales Journal with ${revenueCount} records.`, type: 'success' });

      } else {
        const fields = [
          'Document Name', 'Vendor Name', 'Document #', 'Transaction Date',
          'Total Amount', 'VATable Sales', 'VAT Amount', 'Zero-Rated Sales',
          'Category', 'Confidence', 'Status',
        ];
        const rows = documents.map(doc =>
          fields.map(col => {
            let val: any = '';
            switch (col) {
              case 'Document Name':    val = doc.name; break;
              case 'Vendor Name':      val = doc.vendor; break;
              case 'Document #':       val = doc.docNum; break;
              case 'Transaction Date': val = doc.date; break;
              case 'Total Amount':     val = doc.total; break;
              case 'VATable Sales':    val = doc.vatableSales; break;
              case 'VAT Amount':       val = doc.vat; break;
              case 'Zero-Rated Sales': val = doc.zeroRatedSales; break;
              case 'Category':         val = doc.category; break;
              case 'Confidence':       val = `${doc.confidence}%`; break;
              case 'Status':           val = doc.status; break;
            }
            if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          }).join(',')
        );
        const blob = new Blob([[fields.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        await downloadBlob(blob, `AA2000_Export_${today}.csv`);
        addNotification({ title: 'Export Successful', message: `Downloaded CSV with ${documents.length} records.`, type: 'success' });
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Export</h1>
          <p className="text-slate-500 mt-1">Export scanned documents into BIR-compliant Excel journals</p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 bg-blue-600 border border-transparent px-5 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Exporting…' : 'Download Excel'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-8">

        <section>
          <h3 className="font-semibold text-slate-800 mb-4">Export Format</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <label className={`flex flex-col gap-1 border rounded-xl p-4 cursor-pointer transition-all ${exportType === 'purchases' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400' : 'border-slate-200 hover:border-blue-300'}`}>
              <input type="radio" className="hidden" checked={exportType === 'purchases'} onChange={() => setExportType('purchases')} />
              <span className="font-semibold text-slate-900 text-sm">Purchases &amp; Expenses Journal</span>
              <span className="text-xs text-slate-500">BIR Purchases &amp; Input Tax format</span>
              <span className="mt-2 text-xs font-medium text-blue-700">{expenseCount} expense record{expenseCount !== 1 ? 's' : ''}</span>
            </label>

            <label className={`flex flex-col gap-1 border rounded-xl p-4 cursor-pointer transition-all ${exportType === 'vat' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400' : 'border-slate-200 hover:border-blue-300'}`}>
              <input type="radio" className="hidden" checked={exportType === 'vat'} onChange={() => setExportType('vat')} />
              <span className="font-semibold text-slate-900 text-sm">VAT Sales to be Reported</span>
              <span className="text-xs text-slate-500">BIR VAT Sales &amp; Output Tax format</span>
              <span className="mt-2 text-xs font-medium text-blue-700">{revenueCount} revenue record{revenueCount !== 1 ? 's' : ''}</span>
            </label>

            <label className={`flex flex-col gap-1 border rounded-xl p-4 cursor-pointer transition-all ${exportType === 'csv' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400' : 'border-slate-200 hover:border-blue-300'}`}>
              <input type="radio" className="hidden" checked={exportType === 'csv'} onChange={() => setExportType('csv')} />
              <span className="font-semibold text-slate-900 text-sm">Custom CSV</span>
              <span className="text-xs text-slate-500">All documents, flat CSV format</span>
              <span className="mt-2 text-xs font-medium text-blue-700">{documents.length} total record{documents.length !== 1 ? 's' : ''}</span>
            </label>

          </div>
        </section>

        {exportType === 'purchases' && (
          <section className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm">
            <p className="font-semibold text-slate-700 mb-2">Column Mapping — Purchases &amp; Expenses Journal</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-1 gap-x-4 text-xs text-slate-600">
              <span><b>B</b> → Date</span>
              <span><b>E</b> → TIN</span>
              <span><b>F</b> → Particulars</span>
              <span><b>G</b> → Registered Name</span>
              <span><b>K</b> → Receipt Type</span>
              <span><b>L</b> → Receipt Number</span>
              <span><b>M</b> → VAT Exp. (formula)</span>
              <span><b>O</b> → Input Tax (formula)</span>
              <span><b>P</b> → Invoice Amount</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">One sheet per month. Formulas M=(P-N)/1.12 and O=M×0.12 are preserved.</p>
          </section>
        )}

        {exportType === 'vat' && (
          <section className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm">
            <p className="font-semibold text-slate-700 mb-2">Column Mapping — VAT Sales Journal</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-1 gap-x-4 text-xs text-slate-600">
              <span><b>B</b> → Date</span>
              <span><b>C</b> → Client Name</span>
              <span><b>D</b> → TIN</span>
              <span><b>F</b> → Receipt Type</span>
              <span><b>G</b> → Receipt Number</span>
              <span><b>H</b> → Vatable (formula)</span>
              <span><b>I</b> → Input VAT (formula)</span>
              <span><b>J</b> → Invoice Amount</span>
              <span><b>N</b> → Amt Collected (formula)</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">One sheet per month. SUBTOTAL formulas for totals are preserved.</p>
          </section>
        )}

      </div>
    </div>
  );
}
