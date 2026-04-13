import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../../store/useDocumentStore';
import type { DocumentRecord, DocumentStatus } from '../../types/document';
import { Loader2, FileText, AlertCircle, Cpu } from 'lucide-react';

const OCR_SERVER_URL = 'http://localhost:5050';

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ base64: result.split(',')[1], mediaType: file.type });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function callOcrServer(base64: string, mediaType: string, filename: string): Promise<any> {
  const response = await fetch(`${OCR_SERVER_URL}/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mediaType, filename }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || `OCR server error: ${response.status}`);
  return data;
}

export function buildDocumentRecord(
  file: File,
  extracted: any,
  base64: string,
  mediaType: string
): DocumentRecord {
  const confidence: number = typeof extracted.confidence === 'number' ? extracted.confidence : 60;
  let status: DocumentStatus = 'For Review';
  if (confidence >= 95) status = 'Auto OK';
  else if (confidence >= 85) status = 'Approved';
  else if (confidence < 60) status = 'Declined';

  const total: number = typeof extracted.totalAmount === 'number' ? extracted.totalAmount : 0;
  const vatableSales = typeof extracted.vatableSales === 'number' ? extracted.vatableSales : total / 1.12;
  const vat = typeof extracted.vat === 'number' ? extracted.vat : total - vatableSales;

  const lineItems = Array.isArray(extracted.lineItems) && extracted.lineItems.length > 0
    ? extracted.lineItems.map((li: any, i: number) => ({
        id: String(i + 1),
        description: li.description || 'Item',
        qty: Number(li.qty) || 1,
        price: Number(li.price) || Number(li.net) || 0,
        net: Number(li.net) || Number(li.price) || 0,
      }))
    : [{ id: '1', description: 'Extracted Item', qty: 1, price: total, net: total }];

  return {
    id: Math.random().toString(36).substr(2, 9),
    name: file.name,
    type: extracted.documentType || 'Receipt',
    vendor: extracted.vendor || 'Unknown Vendor',
    taxId: (extracted.taxId && extracted.taxId.replace(/[^0-9-]/g, '').length >= 9) ? extracted.taxId : '',
    category: extracted.category || 'Expense',
    paymentMethod: extracted.paymentMethod || '',
    docNum: (extracted.documentNumber && extracted.documentNumber.length > 1) ? extracted.documentNumber : '',
    total,
    confidence,
    status,
    date: (extracted.date && /^\d{4}-\d{2}-\d{2}$/.test(extracted.date)) ? extracted.date : '',
    lineItems,
    vatableSales: parseFloat(vatableSales.toFixed(2)),
    vat: parseFloat(vat.toFixed(2)),
    zeroRatedSales: 0,
    reviewReason: status === 'For Review'
      ? `OCR confidence at ${confidence}%. ${extracted.notes || 'Manual review recommended.'}`
      : undefined,
    imageData: base64,
    imageType: mediaType,
  };
}

export function ScanHub() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addDocument = useDocumentStore(state => state.addDocument);
  const navigate = useNavigate();

  const handleProcessFile = async (file: File) => {
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!supportedTypes.includes(file.type)) {
      setError('Only JPG, PNG, and WEBP images are supported with the local OCR engine.');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      setProcessingStep('Reading image...');
      const { base64, mediaType } = await fileToBase64(file);
      setProcessingStep('Sending to local OCR engine...');
      const extracted = await callOcrServer(base64, mediaType, file.name);
      setProcessingStep('Building document record...');
      const doc = buildDocumentRecord(file, extracted, base64, mediaType);
      addDocument(doc);
      navigate(`/documents/${doc.id}`);
    } catch (err: any) {
      if (err.message?.includes('fetch') || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setError('Cannot reach the local OCR server. Make sure it is running:\n\ncd ocr_server && python3 server.py');
      } else {
        setError(err.message || 'Failed to process document. Please try again.');
      }
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleProcessFile(e.dataTransfer.files[0]);
  };
  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleProcessFile(e.target.files[0]);
    e.target.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ScanHub</h1>
        <p className="text-slate-500 flex items-center gap-2 mt-1">
          Upload and process financial documents using local Tesseract OCR — no API key required.
        </p>
      </div>
      <input type="file" className="hidden" ref={fileInputRef} onChange={onFileInput} accept=".jpg,.jpeg,.png,.webp" />
      <div
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-2xl h-80 flex flex-col items-center justify-center p-8 text-center transition-all
          ${isProcessing ? 'border-slate-300 dark:border-slate-600 cursor-not-allowed' :
            isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-blue-400/60 hover:border-blue-400 hover:bg-blue-500/5 cursor-pointer'}`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-slate-900">Processing with Tesseract OCR...</h3>
            <p className="text-slate-500 mt-2 max-w-sm text-sm">{processingStep}</p>
          </>
        ) : (
          <>
            <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-4 transition-colors ${isDragging ? 'bg-blue-200 text-blue-700' : 'bg-blue-100 text-blue-600'}`}>
              <FileText className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Click to upload or drag and drop</h3>
            <p className="text-slate-500 mt-2 max-w-sm">JPG, PNG, or WEBP (max. 10MB).</p>
            <p className="text-slate-400 mt-1 text-xs">Processed locally — no data leaves your machine.</p>
          </>
        )}
      </div>
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Processing Failed</p>
            <pre className="text-sm mt-0.5 whitespace-pre-wrap font-sans">{error}</pre>
          </div>
        </div>
      )}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
        <div className="flex items-center gap-2 mb-1">
          <Cpu className="h-4 w-4 text-slate-500" />
          <p className="font-semibold">Powered by Local Tesseract OCR</p>
        </div>
        <p className="text-slate-500">
          Documents are processed entirely on your machine. Start the server first:{' '}
          <code className="bg-slate-200 px-1 rounded text-xs">cd ocr_server &amp;&amp; python3 server.py</code>
        </p>
      </div>
    </div>
  );
}
