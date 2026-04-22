import { Download } from 'lucide-react';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { useDateFilter, matchesFilter } from '../../hooks/useDateFilter';
import { DateRangeFilter } from '../../components/ui/DateRangeFilter';
import type { DocumentRecord } from '../../types/document';

import { getExportPeriodString, groupDocsByMonthYear } from '../../lib/exportUtils';
import { downloadBlob } from '../../lib/download';

// ─── Build Purchases & Expenses Journal workbook ──────────────────────────────
async function buildPurchasesWorkbook(
  docs: DocumentRecord[]
): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const expenseDocs = docs.filter(d => d.category !== 'Revenue');
  const grouped = groupDocsByMonthYear(expenseDocs);

  grouped.forEach(({ year, monthName, docs: rows }) => {
    const ws = wb.addWorksheet(`${monthName} ${year}`);
    ws.columns = [
      { width: 4 }, { width: 12 }, { width: 5 }, { width: 18 }, { width: 20 },
      { width: 14 }, { width: 32 }, { width: 45 }, { width: 12 }, { width: 12 },
      { width: 16 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 16 },
    ];
    const lastRow = Math.max(99950, 5 + rows.length);
    ws.addRow([]);
    const row2 = ws.addRow([
      null, null, null, null, null, null, null, null,
      'SUMMARY', null, null, 'TOTAL =',
      { formula: `SUBTOTAL(109,M6:M${lastRow})` },
      { formula: `SUBTOTAL(109,N6:N${lastRow})` },
      { formula: `SUBTOTAL(109,O6:O${lastRow})` },
      { formula: `SUBTOTAL(109,P6:P${lastRow})` },
    ]);
    row2.font = { bold: true };
    ws.addRow([]);
    const hdr1 = ws.addRow([
      null, 'DATE', '#', 'ACCOUNT TITLES', 'TIN', 'PARTICULARS',
      null, null, 'VOUCHER NO.', 'CHECK NO.', 'REFERENCE RECEIPT',
      'RECEIPT NUMBER', 'OPERATING EXPENSES', null, 'INPUT TAX', 'INVOICE AMOUNT',
    ]);
    hdr1.font = { bold: true };
    hdr1.alignment = { horizontal: 'center', wrapText: true };
    const hdr2 = ws.addRow([
      null, null, null, null, null, null,
      'REGISTERED NAME', 'REGISTERED ADDRESS',
      null, null, null, null, 'VAT', 'NON-VAT', null, null,
    ]);
    hdr2.font = { bold: true };
    hdr2.alignment = { horizontal: 'center', wrapText: true };
    rows.forEach((doc, i) => {
      const rowNum = 6 + i;
      ws.addRow([
        null, doc.date, null, null, doc.taxId, doc.category,
        doc.vendor, doc.registeredAddress || '', null, null, 'SALES INVOICE', doc.docNum,
        { formula: `(P${rowNum}-N${rowNum})/1.12` }, null,
        { formula: `M${rowNum}*0.12` }, doc.total,
      ]);
    });
  });
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ─── Build VAT Sales workbook ─────────────────────────────────────────────────
async function buildVatSalesWorkbook(
  docs: DocumentRecord[]
): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const revenueDocs = docs.filter(d => d.category === 'Revenue');
  const grouped = groupDocsByMonthYear(revenueDocs);

  grouped.forEach(({ year, monthName, docs: rows }) => {
    const ws = wb.addWorksheet(`${monthName} ${year}`);
    ws.columns = [
      { width: 4 }, { width: 12 }, { width: 35 }, { width: 22 }, { width: 40 },
      { width: 16 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 18 },
      { width: 18 }, { width: 22 }, { width: 24 }, { width: 20 },
    ];
    const lastDataRow = Math.max(778, 9 + rows.length);
    const dateEncoded = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
    ws.addRow([]);
    ws.addRow([null, 'Company Name']);
    ws.addRow([null, `${monthName} ${year}`]);
    ws.addRow([null, `FOR THE PERIOD : ${monthName.charAt(0)}${monthName.slice(1).toLowerCase()} ${year}`]);
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
        null, doc.date, doc.vendor, doc.taxId, doc.registeredAddress || '',
        'SALES INVOICE', doc.docNum,
        { formula: `J${rowNum}/1.12` }, { formula: `H${rowNum}*0.12` },
        doc.total, null, null, null,
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
  const userId = useAuthStore((s) => s.user?.id ?? 'guest');
  const [exportType, setExportType] = useState<'purchases' | 'vat' | 'csv'>('purchases');
  const [isExporting, setIsExporting] = useState(false);
  const { filter, update, AVAILABLE_YEARS } = useDateFilter();

  const filteredDocs = useMemo(
    () => documents.filter(d => d.status === 'Submitted' && matchesFilter(d.date, filter)),
    [documents, filter]
  );

  const expenseCount  = filteredDocs.filter(d => d.category !== 'Revenue').length;
  const revenueCount  = filteredDocs.filter(d => d.category === 'Revenue').length;

  // Determine period for filename
  const period = getExportPeriodString(filteredDocs, filter);

  const handleExport = async () => {
    if (filteredDocs.length === 0) { alert('No documents match the selected date range.'); return; }
    setIsExporting(true);
    const today = new Date().toISOString().split('T')[0];
    try {
      if (exportType === 'purchases') {
        if (expenseCount === 0) { alert('No expense documents in selected range.'); return; }
        const blob = await buildPurchasesWorkbook(filteredDocs);
        await downloadBlob(blob, `PURCHASES_AND_EXPENSES_JOURNAL_${period}.xlsx`);
        addNotification(userId, { title: 'Export Successful', message: `Downloaded Purchases & Expenses Journal with ${expenseCount} records.`, type: 'success' });
      } else if (exportType === 'vat') {
        if (revenueCount === 0) { alert('No revenue documents in selected range.'); return; }
        const blob = await buildVatSalesWorkbook(filteredDocs);
        await downloadBlob(blob, `VAT_SALES_TO_BE_REPORTED_${period}.xlsx`);
        addNotification(userId, { title: 'Export Successful', message: `Downloaded VAT Sales Journal with ${revenueCount} records.`, type: 'success' });
      } else {
        const fields = [
          'Document Name', 'Vendor Name', 'Registered Address', 'Document #', 'Transaction Date',
          'Total Amount', 'VATable Sales', 'VAT Amount', 'Zero-Rated Sales',
          'Category', 'Confidence', 'Status',
        ];
        const rows = filteredDocs.map(doc =>
          fields.map(col => {
            let val: string | number = '';
            switch (col) {
              case 'Document Name':       val = doc.name; break;
              case 'Vendor Name':        val = doc.vendor; break;
              case 'Registered Address': val = doc.registeredAddress || ''; break;
              case 'Document #':         val = doc.docNum; break;
              case 'Transaction Date':   val = doc.date; break;
              case 'Total Amount':       val = doc.total; break;
              case 'VATable Sales':      val = doc.vatableSales; break;
              case 'VAT Amount':         val = doc.vat; break;
              case 'Zero-Rated Sales':   val = doc.zeroRatedSales; break;
              case 'Category':           val = doc.category; break;
              case 'Confidence':         val = `${doc.confidence}%`; break;
              case 'Status':             val = doc.status; break;
            }
            if (typeof val === 'string' && (val.includes(',') || val.includes('"')))
              return `"${val.replace(/"/g, '""')}"`;
            return val;
          }).join(',')
        );
        const blob = new Blob([[fields.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        await downloadBlob(blob, `AA2000_Export_${today}.csv`);
        addNotification(userId, { title: 'Export Successful', message: `Downloaded CSV with ${filteredDocs.length} records.`, type: 'success' });
      }
    } catch (err: unknown) {
      alert(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center sm:flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[--text-primary]">Export</h1>
          <p className="text-[--text-muted] text-sm mt-1">Export scanned documents into BIR-compliant Excel journals</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter filter={filter} availableYears={AVAILABLE_YEARS} onChange={update} />
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 bg-blue-600 border border-transparent px-4 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Exporting…' : 'Download Excel'}
          </button>
        </div>
      </div>

      {filter.mode !== 'all' && (
        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl px-4 py-2.5 text-sm text-blue-800 dark:text-blue-300">
          <span className="font-semibold">{filteredDocs.length}</span> of {documents.filter(d => d.status === 'Submitted').length} submitted documents match the selected period.
        </div>
      )}

      <div className="bg-[--bg-surface] rounded-xl border border-[--border-subtle] shadow-sm p-4 md:p-6 space-y-6 md:space-y-8">
        <section>
          <h3 className="font-semibold text-[--text-primary] mb-3 md:mb-4">Export Format</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <label className={`flex flex-col gap-1 border rounded-xl p-4 cursor-pointer transition-all ${exportType === 'purchases' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 ring-1 ring-blue-400' : 'border-[--border-default] hover:border-blue-300'}`}>
              <input type="radio" className="hidden" checked={exportType === 'purchases'} onChange={() => setExportType('purchases')} />
              <span className="font-semibold text-[--text-primary] text-sm">Purchases &amp; Expenses Journal</span>
              <span className="text-xs text-[--text-muted]">BIR Purchases &amp; Input Tax format</span>
              <span className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-400">{expenseCount} expense record{expenseCount !== 1 ? 's' : ''}</span>
            </label>
            <label className={`flex flex-col gap-1 border rounded-xl p-4 cursor-pointer transition-all ${exportType === 'vat' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 ring-1 ring-blue-400' : 'border-[--border-default] hover:border-blue-300'}`}>
              <input type="radio" className="hidden" checked={exportType === 'vat'} onChange={() => setExportType('vat')} />
              <span className="font-semibold text-[--text-primary] text-sm">VAT Sales to be Reported</span>
              <span className="text-xs text-[--text-muted]">BIR VAT Sales &amp; Output Tax format</span>
              <span className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-400">{revenueCount} revenue record{revenueCount !== 1 ? 's' : ''}</span>
            </label>
            <label className={`flex flex-col gap-1 border rounded-xl p-4 cursor-pointer transition-all ${exportType === 'csv' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 ring-1 ring-blue-400' : 'border-[--border-default] hover:border-blue-300'}`}>
              <input type="radio" className="hidden" checked={exportType === 'csv'} onChange={() => setExportType('csv')} />
              <span className="font-semibold text-[--text-primary] text-sm">Custom CSV</span>
              <span className="text-xs text-[--text-muted]">All submitted documents, flat CSV format</span>
              <span className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-400">{filteredDocs.length} submitted record{filteredDocs.length !== 1 ? 's' : ''}</span>
            </label>
          </div>
        </section>

        {exportType === 'purchases' && (
          <section className="bg-[--bg-raised] rounded-xl border border-[--border-subtle] p-4 text-sm">
            <p className="font-semibold text-[--text-secondary] mb-2">Column Mapping — Purchases &amp; Expenses Journal</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-1 gap-x-4 text-xs text-[--text-muted]">
              <span><b>B</b> → Date</span><span><b>E</b> → TIN</span>
              <span><b>F</b> → Particulars</span><span><b>G</b> → Registered Name</span>
              <span><b>K</b> → Receipt Type</span><span><b>L</b> → Receipt Number</span>
              <span><b>M</b> → VAT Exp. (formula)</span><span><b>O</b> → Input Tax (formula)</span>
              <span><b>P</b> → Invoice Amount</span>
            </div>
            <p className="text-xs text-[--text-muted] mt-2">One sheet per month. Formulas M=(P-N)/1.12 and O=M×0.12 are preserved.</p>
          </section>
        )}
        {exportType === 'vat' && (
          <section className="bg-[--bg-raised] rounded-xl border border-[--border-subtle] p-4 text-sm">
            <p className="font-semibold text-[--text-secondary] mb-2">Column Mapping — VAT Sales Journal</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-1 gap-x-4 text-xs text-[--text-muted]">
              <span><b>B</b> → Date</span><span><b>C</b> → Client Name</span>
              <span><b>D</b> → TIN</span><span><b>F</b> → Receipt Type</span>
              <span><b>G</b> → Receipt Number</span><span><b>H</b> → Vatable (formula)</span>
              <span><b>I</b> → Input VAT (formula)</span><span><b>J</b> → Invoice Amount</span>
              <span><b>N</b> → Amt Collected (formula)</span>
            </div>
            <p className="text-xs text-[--text-muted] mt-2">One sheet per month. SUBTOTAL formulas for totals are preserved.</p>
          </section>
        )}
      </div>
    </div>
  );
}