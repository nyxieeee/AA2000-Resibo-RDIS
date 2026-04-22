import { FileText, AlertTriangle, Download } from 'lucide-react';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useMemo } from 'react';
import type { DocumentRecord } from '../../types/document';
import { downloadBlob } from '../../lib/download';

export function BirFiling() {
  const documents = useDocumentStore(state => state.documents);
  const updateDocument = useDocumentStore(state => state.updateDocument);
  const workspace = useWorkspaceStore(state => state.workspace);
  const addNotification = useNotificationStore(state => state.addNotification);
  const userId = useAuthStore((s) => s.user?.id ?? 'guest');

  const stats = useMemo(() => {
    let taxable = 0;
    let vat = 0;
    let exempt = 0;
    let zeroRated = 0;

    const warnings: DocumentRecord[] = [];

    documents.forEach(doc => {
      if (doc.status === 'Submitted') {
        const taxType = doc.taxType || 'VAT';
        if (taxType === 'VAT') {
          taxable += doc.vatableSales;
          vat += doc.vat;
        } else if (taxType === 'Zero-Rated') {
          zeroRated += doc.total;
        } else if (taxType === 'Exempt' || taxType === 'Amusement Tax') {
          exempt += doc.total;
        }

        if (!doc.taxId || doc.vendor.includes('Unknown')) {
          warnings.push(doc);
        }
      }
    });

    return { taxable, vat, exempt, zeroRated, warnings };
  }, [documents]);

  const handleGenerateDat = async () => {
    if (documents.length === 0) {
      alert("No data available to generate DAT file.");
      return;
    }
    
    // Simulate RMO 1-2019 formatting
    const validDocs = documents.filter(d => d.status === 'Submitted');
    const datLines = validDocs.map(doc => {
      // D, TIN, REGISTERED_NAME, ...
      const taxId = doc.taxId.replace(/-/g, '');
      const taxType = doc.taxType || 'VAT';
      const vatableAmt  = taxType === 'VAT' ? doc.vatableSales : 0;
      const zeroAmt     = taxType === 'Zero-Rated' ? doc.total : 0;
      const exemptAmt   = (taxType === 'Exempt' || taxType === 'Amusement Tax') ? doc.total : 0;
      const vatAmt      = taxType === 'VAT' ? doc.vat : 0;
      return `D,${taxId},"${doc.vendor}",${vatableAmt.toFixed(2)},${zeroAmt.toFixed(2)},${exemptAmt.toFixed(2)},${vatAmt.toFixed(2)}`;
    });

    const content = datLines.join('\r\n');
    const blob = new Blob([content], { type: 'text/plain' });
    
    try {
      await downloadBlob(blob, `111222333000P0426.DAT`);
    } catch (err) {
      console.error(err);
      return;
    }

    // Mark all filed documents so the Executive Dashboard pending count updates
    validDocs.forEach(doc => updateDocument(doc.id, { datGenerated: true }));

    addNotification(userId, {
      title: 'DAT Filed',
      message: `Generated SLSP format file for ${datLines.length} valid documents.`,
      type: 'success'
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 p-4 rounded-xl">
        <div className="bg-white dark:bg-[--bg-raised] p-2 rounded-lg shadow-sm h-10 w-10 shrink-0 flex items-center justify-center">
          <FileText className="text-blue-600 h-5 w-5" />
        </div>
        <div>
          <h2 className="font-bold">BIR SLSP Generation Module</h2>
          <p className="text-sm mt-0.5 opacity-80">Generate DAT files strictly compliant with BIR RMO 1-2019 formatting.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="md:col-span-1 space-y-4 md:space-y-6">
          <div className="bg-[--bg-surface] border border-[--border-subtle] rounded-xl p-5 md:p-6 shadow-sm">
            <h3 className="font-bold text-[--text-primary] mb-4 pb-2 border-b border-[--border-subtle]">Filing Period</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[--text-secondary] mb-1">Year</label>
                <select className="w-full border border-[--border-default] rounded-lg py-2 px-3 shadow-sm bg-[--bg-raised] text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>2026</option>
                  <option>2025</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[--text-secondary] mb-1">Quarter</label>
                <select className="w-full border border-[--border-default] rounded-lg py-2 px-3 shadow-sm bg-[--bg-raised] text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Q1 (Jan - Mar)</option>
                  <option>Q2 (Apr - Jun)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[--text-secondary] mb-1">Report Type</label>
                <select className="w-full border border-[--border-default] rounded-lg py-2 px-3 shadow-sm bg-[--bg-raised] text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Summary of Purchases</option>
                  <option>Summary of Sales</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-[--bg-surface] border border-emerald-500/30 rounded-xl p-4 md:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-[--text-primary]">Workspace Settings</h3>
              <span className="text-xs font-bold bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full">READY</span>
            </div>
            <div className="text-sm text-[--text-secondary] space-y-1">
              <p><strong>TIN:</strong> {workspace.birTin}</p>
              <p><strong>RDO:</strong> {workspace.birRdo}</p>
              <p><strong>VAT Reg:</strong> {workspace.vatRegistered ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-[--bg-surface] border border-[--border-subtle] rounded-xl p-4 md:p-6 shadow-sm flex flex-col">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4 md:mb-6">
            <h3 className="font-bold text-[--text-primary] text-lg">Purchases Summary</h3>
            <button onClick={handleGenerateDat} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition w-full sm:w-auto">
              <Download className="h-4 w-4" />
              Generate DAT File
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
            <div className="bg-[--bg-raised] border border-[--border-subtle] rounded-lg p-3">
              <div className="text-xs text-[--text-muted] font-medium uppercase leading-tight">Taxable Purchases</div>
              <div className="font-bold text-[--text-primary] mt-1 text-sm md:text-base">₱ {stats.taxable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-[--bg-raised] border border-[--border-subtle] rounded-lg p-3">
              <div className="text-xs text-[--text-muted] font-medium uppercase leading-tight">VAT (12%)</div>
              <div className="font-bold text-[--text-primary] mt-1 text-sm md:text-base">₱ {stats.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-[--bg-raised] border border-[--border-subtle] rounded-lg p-3">
              <div className="text-xs text-[--text-muted] font-medium uppercase leading-tight">Exempt</div>
              <div className="font-bold text-[--text-primary] mt-1 text-sm md:text-base">₱ {stats.exempt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-[--bg-raised] border border-[--border-subtle] rounded-lg p-3">
              <div className="text-xs text-[--text-muted] font-medium uppercase leading-tight">Zero-Rated</div>
              <div className="font-bold text-[--text-primary] mt-1 text-sm md:text-base">₱ {stats.zeroRated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div className="flex-1 border border-[--border-subtle] rounded-lg overflow-hidden">
            {stats.warnings.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900 flex gap-2 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p>Warning: {stats.warnings.length} vendors have missing or default TINs. Fix before filing.</p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[--bg-raised] font-medium text-[--text-muted] border-b border-[--border-subtle] text-xs sm:text-sm">
                  <tr>
                    <th className="px-2 sm:px-4 py-3">Vendor / TIN</th>
                    <th className="px-2 sm:px-4 py-3 text-right">Taxable</th>
                    <th className="px-2 sm:px-4 py-3 text-right">VAT</th>
                    <th className="px-2 sm:px-4 py-3 text-right">Exempt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--border-subtle] text-xs sm:text-sm">
                  {stats.warnings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-2 sm:px-4 py-8 text-center text-[--text-muted]">
                        {documents.length === 0 ? "No documents processed yet." : "No TIN warnings found!"}
                      </td>
                    </tr>
                  ) : stats.warnings.map((doc: DocumentRecord) => (
                    <tr key={doc.id} className="bg-rose-50/30 dark:bg-rose-950/10">
                      <td className="px-2 sm:px-4 py-3">
                        <span className="font-medium text-[--text-primary] line-clamp-1">{doc.vendor}</span>
                        <span className="text-[10px] sm:text-xs text-rose-600 font-bold border-b border-dashed border-rose-500">{doc.taxId === '000-000-000-000' ? 'MISSING TIN' : doc.taxId}</span>
                      </td>
                      <td className="px-2 sm:px-4 py-3">
                        <div className="text-right text-[--text-primary]">₱{(doc.taxType === 'VAT' || !doc.taxType ? doc.vatableSales : 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        {doc.taxType && doc.taxType !== 'VAT' && (
                          <div className="text-right mt-0.5">
                            <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">{doc.taxType}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-3 text-right text-[--text-primary]">₱{doc.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-2 sm:px-4 py-3 text-right text-[--text-primary]">₱{doc.zeroRatedSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
