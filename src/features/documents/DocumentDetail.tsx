import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle2, XCircle, RotateCcw, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useState, useEffect } from 'react';
import type { DocumentRecord } from '../../types/document';

const OCR_SERVER_URL = 'http://localhost:5050';

export function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { documents, updateDocument } = useDocumentStore();

  const originalDoc = documents.find(d => d.id === id);
  const [formData, setFormData] = useState<DocumentRecord | null>(null);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState<string | null>(null);

  useEffect(() => {
    if (originalDoc) setFormData(originalDoc);
  }, [originalDoc]);

  if (!formData || !originalDoc) {
    return (
      <div className="h-full flex items-center justify-center -m-6 md:-m-8">
        <div className="text-slate-500">Document not found</div>
      </div>
    );
  }

  const handleChange = (field: keyof DocumentRecord, value: string | number) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSave = () => {
    updateDocument(formData.id, formData);
  };

  const handleApprove = () => {
    updateDocument(formData.id, { status: 'Approved' });
    setFormData({ ...formData, status: 'Approved' });
  };

  const handleDecline = () => {
    updateDocument(formData.id, { status: 'Declined' });
    setFormData({ ...formData, status: 'Declined' });
  };

  const handleReprocess = async () => {
    if (!formData.imageData || !formData.imageType) {
      setReprocessError('No image data available to reprocess. Please re-upload the document from ScanHub.');
      return;
    }
    setIsReprocessing(true);
    setReprocessError(null);
    try {
      const response = await fetch(`${OCR_SERVER_URL}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64: formData.imageData,
          mediaType: formData.imageType,
          filename: formData.name,
        }),
      });
      const extracted = await response.json();
      if (!response.ok) throw new Error(extracted?.error || 'OCR server error');

      const total = typeof extracted.totalAmount === 'number' ? extracted.totalAmount : formData.total;
      const vatableSales = typeof extracted.vatableSales === 'number' ? extracted.vatableSales : total / 1.12;
      const vat = typeof extracted.vat === 'number' ? extracted.vat : total - vatableSales;
      const confidence = typeof extracted.confidence === 'number' ? extracted.confidence : formData.confidence;

      const lineItems = Array.isArray(extracted.lineItems) && extracted.lineItems.length > 0
        ? extracted.lineItems.map((li: any, i: number) => ({
            id: String(i + 1),
            description: li.description || 'Item',
            qty: Number(li.qty) || 1,
            price: Number(li.price) || Number(li.net) || 0,
            net: Number(li.net) || Number(li.price) || 0,
          }))
        : formData.lineItems;

      const updated: Partial<DocumentRecord> = {
        vendor: extracted.vendor || formData.vendor,
        taxId: (extracted.taxId && extracted.taxId.replace(/[^0-9-]/g, '').length >= 9) ? extracted.taxId : formData.taxId,
        docNum: (extracted.documentNumber && extracted.documentNumber.length > 1) ? extracted.documentNumber : formData.docNum,
        date: (extracted.date && /^\d{4}-\d{2}-\d{2}$/.test(extracted.date)) ? extracted.date : formData.date,
        paymentMethod: extracted.paymentMethod || formData.paymentMethod,
        total,
        vatableSales: parseFloat(vatableSales.toFixed(2)),
        vat: parseFloat(vat.toFixed(2)),
        confidence,
        lineItems,
        reviewReason: `Reprocessed. OCR confidence at ${confidence}%. ${extracted.notes || ''}`,
        status: confidence >= 95 ? 'Auto OK' : confidence >= 85 ? 'Approved' : 'For Review',
      };

      updateDocument(formData.id, updated);
      setFormData({ ...formData, ...updated });
    } catch (err: any) {
      if (err.message?.includes('fetch') || err.message?.includes('Failed to fetch')) {
        setReprocessError('OCR server is not running. Start it with: cd ocr_server && python3 server.py');
      } else {
        setReprocessError(err.message || 'Reprocess failed.');
      }
    } finally {
      setIsReprocessing(false);
    }
  };

  // Build image src from stored base64
  const imageSrc = formData.imageData && formData.imageType
    ? `data:${formData.imageType};base64,${formData.imageData}`
    : null;

  return (
    <div className="h-full flex flex-col -m-6 md:-m-8">
      {/* Header Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/documents')}
            className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">{formData.name}</h1>
              <span className={cn(
                'px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider',
                formData.status === 'Auto OK' && 'bg-slate-100 text-slate-700',
                formData.status === 'For Review' && 'bg-amber-100 text-amber-700 ring-1 ring-amber-500/20',
                formData.status === 'Approved' && 'bg-green-100 text-green-700 ring-1 ring-green-500/20',
                formData.status === 'Declined' && 'bg-red-100 text-red-700 ring-1 ring-red-500/20',
              )}>{formData.status}</span>
            </div>
            <p className="text-sm text-slate-500">
              Record #{formData.id} • Processed {formData.date} • {formData.confidence}% AI Confidence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReprocess}
            disabled={isReprocessing}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isReprocessing
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RotateCcw className="h-4 w-4" />}
            {isReprocessing ? 'Reprocessing…' : 'Reprocess'}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-white font-medium hover:bg-blue-700 transition-colors"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Reprocess error banner */}
      {reprocessError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="font-semibold">Reprocess failed:</span> {reprocessError}
        </div>
      )}

      {/* Split Viewer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Viewer (Left) */}
        <div className="hidden lg:flex w-1/2 bg-slate-100 border-r border-slate-200 p-6 flex-col gap-2 relative">
          <div className="absolute top-4 right-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
            Document Viewer
          </div>
          <div className="flex-1 bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={formData.name}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="text-center text-slate-400 px-8">
                <p className="text-sm">No image preview available.</p>
                <p className="text-xs mt-1">Re-upload the document from ScanHub to enable preview and reprocessing.</p>
              </div>
            )}
          </div>
        </div>

        {/* Data Panel (Right) */}
        <div className="w-full lg:w-1/2 overflow-y-auto bg-white p-6 md:p-8 space-y-8">

          <section>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">Extracted Details</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Vendor Name" value={formData.vendor} confidence={formData.confidence} onChange={(v) => handleChange('vendor', v)} />
              <Field label="Tax ID (TIN)" value={formData.taxId} confidence={formData.confidence - 1} onChange={(v) => handleChange('taxId', v)} />
              <Field label="Document Number" value={formData.docNum} confidence={formData.confidence + 2} onChange={(v) => handleChange('docNum', v)} />
              <Field label="Transaction Date" value={formData.date} confidence={formData.confidence + 1} onChange={(v) => handleChange('date', v)} />
              <Field label="Expense Category" value={formData.category} confidence={formData.confidence - 5} type="select" options={['Expense', 'Revenue', 'Asset', 'Liability', 'Uncategorized', 'Utility / Communications', 'Travel', 'Meals', 'Supplies', 'Fuel']} onChange={(v) => handleChange('category', v)} />
              <Field label="Payment Method" value={formData.paymentMethod || ''} confidence={formData.confidence} type="select" options={['', 'Credit Card', 'Cash', 'Bank Transfer']} onChange={(v) => handleChange('paymentMethod', v)} />
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">Line Items</h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium text-slate-600">Description</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Qty</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Price</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {formData.lineItems.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-3"><input className="w-full focus:outline-none focus:bg-blue-50/50 rounded px-1" value={item.description} onChange={(e) => { const updated = formData.lineItems.map(li => li.id === item.id ? {...li, description: e.target.value} : li); setFormData({...formData, lineItems: updated}); }} /></td>
                      <td className="px-4 py-3 text-right"><input className="w-12 text-right focus:outline-none focus:bg-blue-50/50 rounded px-1" value={item.qty} onChange={(e) => { const updated = formData.lineItems.map(li => li.id === item.id ? {...li, qty: Number(e.target.value) || 1} : li); setFormData({...formData, lineItems: updated}); }} /></td>
                      <td className="px-4 py-3 text-right"><input className="w-20 text-right focus:outline-none focus:bg-blue-50/50 rounded px-1" value={item.price} onChange={(e) => { const v = Number(e.target.value) || 0; const updated = formData.lineItems.map(li => li.id === item.id ? {...li, price: v, net: v * li.qty} : li); setFormData({...formData, lineItems: updated}); }} /></td>
                      <td className="px-4 py-3 text-right font-medium">₱ {item.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="text-sm text-blue-600 font-medium mt-3 hover:text-blue-700">+ Add Line Item</button>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">Tax & Financial Summary</h3>
            <div className="bg-slate-50 rounded-lg p-5 border border-slate-100">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">VATable Sales</span>
                  <span className="font-medium text-slate-700">₱ {formData.vatableSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">VAT (12%)</span>
                  <span className="font-medium text-slate-700">₱ {formData.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Zero-Rated Sales</span>
                  <span className="font-medium text-slate-700">₱ {formData.zeroRatedSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="pt-3 border-t border-slate-200 flex justify-between font-bold text-lg mt-2">
                  <span className="text-slate-800">Total Amount</span>
                  <span className="text-blue-600">₱ {formData.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </section>

          {(formData.status === 'For Review' || formData.reviewReason) && (
            <section>
              <div className="bg-amber-50 rounded-lg p-5 border border-amber-200 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-amber-900">Review Required</h3>
                  <p className="text-sm text-amber-700 mt-1">{formData.reviewReason || 'Please review this extracted document.'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleApprove} className="p-2 bg-white text-green-600 rounded-md border border-green-200 shadow-sm hover:bg-green-50" title="Approve"><CheckCircle2 className="h-5 w-5" /></button>
                  <button onClick={handleDecline} className="p-2 bg-white text-red-600 rounded-md border border-red-200 shadow-sm hover:bg-red-50" title="Decline"><XCircle className="h-5 w-5" /></button>
                </div>
              </div>
            </section>
          )}

          {formData.status === 'Declined' && (
            <section>
              <div className="bg-red-50 rounded-lg p-5 border border-red-200 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-red-900">Document Declined</h3>
                  <p className="text-sm text-red-700 mt-1">This document has been rejected.</p>
                </div>
                <button onClick={handleApprove} className="p-2 bg-white text-slate-600 rounded-md border border-slate-200 shadow-sm hover:bg-slate-50" title="Restore"><RotateCcw className="h-5 w-5" /></button>
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}

function Field({ label, value, confidence, type = 'text', options = [], onChange }: any) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
        <div className="flex gap-0.5">
          <div className={cn('h-1.5 w-1.5 rounded-full',
            confidence >= 90 ? 'bg-green-500' : confidence >= 80 ? 'bg-amber-500' : 'bg-red-500'
          )}></div>
        </div>
      </div>
      {type === 'text' ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none py-1.5 text-sm font-medium text-slate-900 transition-colors bg-transparent"
        />
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none py-1.5 text-sm font-medium text-slate-900 transition-colors bg-transparent appearance-none cursor-pointer"
        >
          {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )}
    </div>
  );
}
