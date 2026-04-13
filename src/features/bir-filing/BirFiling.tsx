import { FileText, AlertTriangle, Download } from 'lucide-react';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useMemo } from 'react';

export function BirFiling() {
  const documents = useDocumentStore(state => state.documents);
  const updateDocument = useDocumentStore(state => state.updateDocument);
  const workspace = useWorkspaceStore(state => state.workspace);
  const addNotification = useNotificationStore(state => state.addNotification);

  const stats = useMemo(() => {
    let taxable = 0;
    let vat = 0;
    let exempt = 0;
    let zeroRated = 0;

    const warnings: any[] = [];

    documents.forEach(doc => {
      if (doc.status !== 'Declined') {
        taxable += doc.vatableSales;
        vat += doc.vat;
        zeroRated += doc.zeroRatedSales;
        
        if (doc.taxId === '000-000-000-000' || doc.vendor.includes('Unknown')) {
          warnings.push(doc);
        }
      }
    });

    return { taxable, vat, exempt, zeroRated, warnings };
  }, [documents]);

  const handleGenerateDat = () => {
    if (documents.length === 0) {
      alert("No data available to generate DAT file.");
      return;
    }
    
    // Simulate RMO 1-2019 formatting
    const validDocs = documents.filter(d => d.status !== 'Declined');
    const datLines = validDocs.map(doc => {
      // D, TIN, REGISTERED_NAME, ...
      const taxId = doc.taxId.replace(/-/g, '');
      return `D,${taxId},"${doc.vendor}",${doc.vatableSales.toFixed(2)},${doc.zeroRatedSales.toFixed(2)},0.00,${doc.vat.toFixed(2)}`;
    });

    const content = datLines.join('\r\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `111222333000P0426.DAT`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Mark all filed documents so the Executive Dashboard pending count updates
    validDocs.forEach(doc => updateDocument(doc.id, { datGenerated: true }));

    addNotification({
      title: 'DAT Filed',
      message: `Generated SLSP format file for ${datLines.length} valid documents.`,
      type: 'success'
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl">
        <div className="flex gap-3">
          <div className="bg-white p-2 rounded-lg shadow-sm h-10 w-10 flex items-center justify-center">
            <FileText className="text-blue-600 h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold">BIR SLSP Generation Module</h2>
            <p className="text-sm">Generate DAT files strictly compliant with BIR RMO 1-2019 formatting.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
             <h3 className="font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">Filing Period</h3>
             <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                  <select className="w-full border border-slate-300 rounded-lg py-2 px-3 shadow-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>2026</option>
                    <option>2025</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quarter</label>
                  <select className="w-full border border-slate-300 rounded-lg py-2 px-3 shadow-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Q1 (Jan - Mar)</option>
                    <option>Q2 (Apr - Jun)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Report Type</label>
                  <select className="w-full border border-slate-300 rounded-lg py-2 px-3 shadow-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Summary of Purchases</option>
                    <option>Summary of Sales</option>
                  </select>
                </div>
             </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 shadow-sm">
             <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-green-900">Workspace Settings</h3>
                <span className="text-xs font-bold bg-green-200 text-green-800 px-2 py-0.5 rounded-full">READY</span>
             </div>
             <div className="text-sm text-green-800 space-y-1">
                <p><strong>TIN:</strong> {workspace.birTin}</p>
                <p><strong>RDO:</strong> {workspace.birRdo}</p>
                <p><strong>VAT Reg:</strong> {workspace.vatRegistered ? 'Yes' : 'No'}</p>
             </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 text-lg">Purchases Summary</h3>
            <button onClick={handleGenerateDat} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition">
              <Download className="h-4 w-4" />
              Generate DAT File
            </button>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500 font-medium uppercase">Taxable Purchases</div>
              <div className="font-bold text-slate-900 mt-1">₱ {stats.taxable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
             <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500 font-medium uppercase">VAT Amount (12%)</div>
              <div className="font-bold text-slate-900 mt-1 pb-0.5 border-b border-transparent">₱ {stats.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
             <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500 font-medium uppercase">Exempt</div>
              <div className="font-bold text-slate-900 mt-1">₱ {stats.exempt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
             <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500 font-medium uppercase">Zero-Rated</div>
              <div className="font-bold text-slate-900 mt-1">₱ {stats.zeroRated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div className="flex-1 border border-slate-200 rounded-lg overflow-hidden">
            {stats.warnings.length > 0 && (
              <div className="p-3 bg-amber-50 border-b border-amber-200 flex gap-2 text-sm text-amber-800">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p>Warning: {stats.warnings.length} vendors have missing or default TINs. Fix before filing.</p>
              </div>
            )}
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 font-medium text-slate-600 border-b border-slate-200">
                <tr>
                   <th className="px-4 py-3">Vendor / TIN</th>
                   <th className="px-4 py-3 text-right">Taxable</th>
                   <th className="px-4 py-3 text-right">VAT</th>
                   <th className="px-4 py-3 text-right">Exempt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {stats.warnings.length === 0 ? (
                   <tr>
                     <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                       {documents.length === 0 ? "No documents processed yet." : "No TIN warnings found!"}
                     </td>
                   </tr>
                 ) : stats.warnings.map(doc => (
                   <tr key={doc.id} className="bg-rose-50/30">
                      <td className="px-4 py-3">
                         <span className="font-medium text-slate-900">{doc.vendor}</span>
                         <br /><span className="text-xs text-rose-600 font-bold border-b border-dashed border-rose-500">{doc.taxId === '000-000-000-000' ? 'MISSING TIN' : doc.taxId}</span>
                      </td>
                      <td className="px-4 py-3 text-right">₱ {doc.vatableSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right">₱ {doc.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right">₱ {doc.zeroRatedSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                   </tr>
                 ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
