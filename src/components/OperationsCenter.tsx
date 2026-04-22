import { FileText, ArrowRight, UploadCloud, Download, Landmark, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDocumentStore } from '../store/useDocumentStore';
import { useMemo } from 'react';

export function OperationsCenter({ hideFiling = false }: { hideFiling?: boolean } = {}) {
  const documents = useDocumentStore(state => state.documents);

  const documentsReadyForFiling = useMemo(() => {
    return documents.filter(d => d.status === 'Submitted' && !d.datGenerated).length;
  }, [documents]);

  return (
    <div className="bg-slate-900 rounded-xl p-5 md:p-8 text-white relative overflow-hidden shadow-sm mt-4 md:mt-8">
      <div className="absolute top-0 right-0 p-6 md:p-12 opacity-10">
        <Landmark className="h-32 w-32 md:h-64 md:w-64 text-white" />
      </div>
      <div className="relative z-10 w-full">
        <h2 className="text-lg md:text-xl font-bold mb-2">Operations Center</h2>
        <p className="text-slate-400 text-sm mb-5 md:mb-8 max-w-lg">Manage your compliance, accelerate document processing, and export raw data directly from your dashboard.</p>
        <div className={`grid grid-cols-2 ${hideFiling ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-3 md:gap-4`}>
          <Link to="/scanhub" className="bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/50 p-4 md:p-5 rounded-xl transition-all duration-300 flex flex-col group hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/10 active:scale-[0.98]">
            <div className="bg-blue-500/20 text-blue-400 w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg mb-3 md:mb-4 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 group-hover:scale-110">
              <UploadCloud className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <h3 className="font-semibold text-xs md:text-sm mb-1">Process Documents</h3>
            <p className="text-xs text-slate-400 mb-3 md:mb-4 hidden sm:block">Run AI on receipts &amp; invoices</p>
            <div className="flex items-center text-xs font-bold text-blue-400 mt-auto">ScanHub <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" /></div>
          </Link>
          {!hideFiling && (
            <Link to="/filing" className="bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-emerald-500/50 p-4 md:p-5 rounded-xl transition-all duration-300 flex flex-col group hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/10 active:scale-[0.98]">
              <div className="bg-emerald-500/20 text-emerald-400 w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg mb-3 md:mb-4 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 group-hover:scale-110 relative">
                <FileText className="h-4 w-4 md:h-5 md:w-5" />
                {documentsReadyForFiling > 0 && <span className="absolute -top-1 -right-1 bg-red-500 h-3 w-3 rounded-full border-2 border-slate-800 transition-transform group-hover:scale-125" />}
              </div>
              <h3 className="font-semibold text-xs md:text-sm mb-1">BIR Filing</h3>
              <p className="text-xs text-slate-400 mb-3 md:mb-4 hidden sm:block">{documentsReadyForFiling} documents ready for filing</p>
              <div className="flex items-center text-xs font-bold text-emerald-400 mt-auto">File <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" /></div>
            </Link>
          )}
          <Link to="/exports" className="bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-amber-500/50 p-4 md:p-5 rounded-xl transition-all duration-300 flex flex-col group hover:scale-[1.02] hover:shadow-xl hover:shadow-amber-500/10 active:scale-[0.98]">
            <div className="bg-amber-500/20 text-amber-400 w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg mb-3 md:mb-4 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300 group-hover:scale-110">
              <Download className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <h3 className="font-semibold text-xs md:text-sm mb-1">Data Export</h3>
            <p className="text-xs text-slate-400 mb-3 md:mb-4 hidden sm:block">Download CSV reports</p>
            <div className="flex items-center text-xs font-bold text-amber-400 mt-auto">Export <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" /></div>
          </Link>
          <Link to="/settings" className="bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-500/50 p-4 md:p-5 rounded-xl transition-all duration-300 flex flex-col group hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-500/10 active:scale-[0.98]">
            <div className="bg-slate-500/20 text-slate-400 w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg mb-3 md:mb-4 group-hover:bg-slate-400 group-hover:text-white transition-all duration-300 group-hover:scale-110">
              <Settings className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <h3 className="font-semibold text-xs md:text-sm mb-1">Settings</h3>
            <p className="text-xs text-slate-400 mb-3 md:mb-4 hidden sm:block">Manage workspace</p>
            <div className="flex items-center text-xs font-bold text-slate-400 mt-auto">Open <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" /></div>
          </Link>
        </div>
      </div>
    </div>
  );
}
