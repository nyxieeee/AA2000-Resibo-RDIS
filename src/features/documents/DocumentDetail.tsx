import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle2, RotateCcw, Loader2, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCw, X, Target, Send } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { DocumentRecord, TaxType, DocumentStatus } from '../../types/document';
import { apiFetch } from '../../lib/api';

function tryParseJsonLenient(text: string): Record<string, unknown> {
  const normalized = text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(normalized) as Record<string, unknown>;
}

function parseJsonObjectFromModelText(rawText: string): Record<string, unknown> {
  const text = rawText.replace(/```json\s*|```/gi, '').trim();

  try {
    return tryParseJsonLenient(text);
  } catch {
    // Fallback for cases where Gemini adds extra prose around JSON.
  }

  const start = text.indexOf('{');
  if (start === -1) throw new Error('Model returned invalid JSON. Please try again.');

  let inString = false;
  let escaped = false;
  let depth = 0;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return tryParseJsonLenient(candidate);
        } catch {
          break;
        }
      }
    }
  }

  throw new Error('Model returned invalid JSON. Please try again.');
}

function computeTax(total: number, taxType: TaxType = 'VAT') {
  switch (taxType) {
    case 'VAT': {
      const vatableSales = parseFloat((total / 1.12).toFixed(2));
      return { vatableSales, vat: parseFloat((total - vatableSales).toFixed(2)), zeroRatedSales: 0 };
    }
    case 'Amusement Tax':
    case 'Exempt':
      return { vatableSales: 0, vat: 0, zeroRatedSales: total };
    case 'Zero-Rated':
      return { vatableSales: 0, vat: 0, zeroRatedSales: total };
    default:
      return { vatableSales: 0, vat: 0, zeroRatedSales: total };
  }
}

export function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { documents, updateDocument } = useDocumentStore();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? 'guest';

  const [isSaved, setIsSaved] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const panStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const touchStartDist = useRef<number | null>(null);
  const touchStartZoom = useRef<number>(1);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(5, Math.max(0.5, z - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); setRotation(0); };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDist.current = dist;
      touchStartZoom.current = zoom;
    } else if (e.touches.length === 1) {
      setIsPanning(true);
      panStart.current = {
        mx: e.touches[0].clientX,
        my: e.touches[0].clientY,
        px: pan.x,
        py: pan.y
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchStartDist.current;
      setZoom(Math.min(5, Math.max(0.5, touchStartZoom.current * ratio)));
    } else if (e.touches.length === 1 && panStart.current) {
      setPan({
        x: panStart.current.px + e.touches[0].clientX - panStart.current.mx,
        y: panStart.current.py + e.touches[0].clientY - panStart.current.my
      });
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    panStart.current = null;
    touchStartDist.current = null;
  };

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
        <div className="text-[--text-muted]">Document not found</div>
      </div>
    );
  }

  const handleChange = (field: keyof DocumentRecord, value: string | number) => {
    setFormData({ ...formData, [field]: value });
  };

  // Derived totals — always computed live from line items + tax type
  const derivedTotal = parseFloat(formData.lineItems.reduce((sum, li) => sum + li.net, 0).toFixed(2));
  const { vatableSales: derivedVatableSales, vat: derivedVat, zeroRatedSales: derivedZeroRated } = computeTax(derivedTotal, formData.taxType);

  const handleSave = async () => {
    try {
      const updatedStatus: DocumentStatus = 'Submitted';

      // Convert base64 to Blob
      let imageBlob: Blob | null = null;
      if (formData.imageData && formData.imageType) {
        try {
          const byteCharacters = atob(formData.imageData);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          imageBlob = new Blob([byteArray], { type: formData.imageType });
        } catch (e) {
          console.error("Failed to convert image data to Blob:", e);
        }
      }

      // Map products
      const products = formData.lineItems.map(item => ({
        productName: item.description,
        qty: item.qty,
        unitPrice: item.price,
        netAmount: item.net
      }));

      const apiFormData = new FormData();
      apiFormData.append('vendorName', formData.vendor || '');
      apiFormData.append('registeredAddress', formData.registeredAddress || '');
      apiFormData.append('taxIdTin', formData.taxId || '');
      apiFormData.append('transactionDate', formData.date || '');
      apiFormData.append('expensesCategory', formData.category || '');
      apiFormData.append('paymentMethod', formData.paymentMethod || '');
      apiFormData.append('taxType', formData.taxType || '');
      apiFormData.append('documentsRef', formData.docNum || '');
      apiFormData.append('notes', formData.reviewReason || '');
      apiFormData.append('products', JSON.stringify(products));

      if (imageBlob) {
        const ext = (formData.imageType?.split('/')?.[1]) || 'jpeg';
        apiFormData.append('receiptImage', imageBlob, `receipt.${ext}`);
      }

      await apiFetch('/project/save/rdis', {
        method: 'POST',
        body: apiFormData
      });
      
      // apiFetch returns json by default and throws on non-ok status
      
      // Update Local State & Store (hits the standard API)
      const { imageData, imageType, ...localPayload } = formData;
      await updateDocument(formData.id, {
        ...localPayload,
        status: updatedStatus,
        total: derivedTotal,
        vatableSales: derivedVatableSales,
        vat: derivedVat,
        zeroRatedSales: derivedZeroRated,
      });

      setFormData({ ...formData, status: updatedStatus });
      addNotification(userId, { 
        title: 'Document Submitted', 
        message: `"${formData.name}" successfully synced with RDIS backend.`, 
        type: 'success' 
      });
      
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);

    } catch (err) {
      console.error('Submission Error:', err);
      addNotification(userId, { 
        title: 'Submission Failed', 
        message: err instanceof Error ? err.message : 'Could not reach the RDIS server.', 
        type: 'error' 
      });
    }
  };



  const handleReprocess = async () => {
    if (!formData.imageData || !formData.imageType) {
      setReprocessError('No image data available to reprocess. Please re-upload the document from ScanHub.');
      return;
    }
    const groqKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!groqKey) {
      setReprocessError('VITE_GROQ_API_KEY is not set. Add it to your .env file and restart the dev server.');
      return;
    }
    setIsReprocessing(true);
    setReprocessError(null);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${formData.imageType};base64,${formData.imageData}` },
                },
                {
                  type: 'text',
                  text: `You are a Philippine BIR receipt parser. Extract all fields from this receipt or invoice image and return ONLY a valid JSON object — no prose, no markdown fences. Use this exact shape:
{
  "vendor": "string",
  "registeredAddress": "full registered address of the vendor as printed on the document, or empty string",
  "taxId": "NNN-NNN-NNN-NNNNN or empty string",
  "documentNumber": "string",
  "documentType": "Receipt | Invoice | Bill | Other",
  "date": "YYYY-MM-DD",
  "paymentMethod": "Cash | Debit Card | GCash | Check | Other",
  "totalAmount": number,
  "vatableSales": number,
  "vat": number,
  "zeroRatedSales": number,
  "lineItems": [{ "description": "string", "qty": number, "price": number, "net": number }],
  "confidence": number (0-100),
  "notes": "string"
}
Rules:
- vatableSales = totalAmount / 1.12 (for VAT receipts), vat = totalAmount - vatableSales
- confidence: 90+ if all major fields found, 75-89 if some missing, below 75 if image is unclear
- If a field cannot be determined, use an empty string or 0
- handwriting-aware parsing:
  - resolve likely OCR confusions (0/O, 1/I/l, 5/S, 8/B) only when context strongly supports it
  - if the same handwritten value appears multiple times, prefer the clearest repeat
  - do not guess unclear handwriting; keep empty string/0 and mention ambiguity in notes`,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody?.error?.message || `Groq API error ${response.status}`);
      }

      const groqData = await response.json() as { choices?: { message?: { content?: string } }[] };
      const rawText = groqData.choices?.[0]?.message?.content ?? '';
      const extracted = parseJsonObjectFromModelText(rawText);

      const total = typeof extracted.totalAmount === 'number' ? extracted.totalAmount : formData.total;
      const vatableSales = typeof extracted.vatableSales === 'number' ? extracted.vatableSales : total / 1.12;
      const vat = typeof extracted.vat === 'number' ? extracted.vat : total - vatableSales;
      const confidence = typeof extracted.confidence === 'number' ? Math.min(100, Math.max(0, extracted.confidence)) : formData.confidence;

      const lineItems = Array.isArray(extracted.lineItems) && extracted.lineItems.length > 0
        ? (extracted.lineItems as { description?: string; qty?: number; price?: number; net?: number }[]).map((li, i: number) => ({
          id: String(i + 1),
          description: li.description || 'Item',
          qty: Number(li.qty) || 1,
          price: Number(li.price) || Number(li.net) || 0,
          net: Number(li.net) || Number(li.price) || 0,
          gross: Number(li.price) || Number(li.net) || 0,
          disc: 0,
        }))
        : formData.lineItems;

      const updated: Partial<DocumentRecord> = {
        vendor: extracted.vendor || formData.vendor,
        registeredAddress: (extracted.registeredAddress as string) || formData.registeredAddress || '',
        taxId: (extracted.taxId && extracted.taxId.replace(/[^0-9-]/g, '').length >= 9) ? extracted.taxId : formData.taxId,
        docNum: (extracted.documentNumber && extracted.documentNumber.length > 1) ? extracted.documentNumber : formData.docNum,
        date: (extracted.date && /^\d{4}-\d{2}-\d{2}$/.test(extracted.date)) ? extracted.date : formData.date,
        paymentMethod: (extracted.paymentMethod as string) || formData.paymentMethod,
        total,
        vatableSales: parseFloat(vatableSales.toFixed(2)),
        vat: parseFloat(vat.toFixed(2)),
        zeroRatedSales: typeof extracted.zeroRatedSales === 'number' ? extracted.zeroRatedSales : 0,
        confidence,
        lineItems,
        reviewReason: `Reprocessed via Groq Vision AI. Confidence: ${confidence}%. ${extracted.notes || ''}`,
        status: 'Auto OK',
      };

      await updateDocument(formData.id, updated);
      setFormData({ ...formData, ...updated });
      addNotification(userId, {
        title: 'Reprocess Complete',
        message: `"${formData.name}" re-extracted by Groq Vision. Confidence: ${confidence}%.`,
        type: confidence >= 85 ? 'success' : 'warning',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reprocess failed.';
      setReprocessError(msg);
      addNotification(userId, { title: 'Reprocess Failed', message: msg, type: 'error' });
    } finally {
      setIsReprocessing(false);
    }
  };

  // Build image src from stored base64
  const imageSrc = formData.imageData && formData.imageType
    ? `data:${formData.imageType};base64,${formData.imageData}`
    : null;

  const isDark = user?.darkMode ?? false;

  return (
    <div className="flex flex-col lg:h-full -mx-4 md:-mx-8 -mt-4 md:-mt-8 overflow-x-hidden">
      {/* Header Toolbar */}
      <div className="bg-[--bg-surface] border-b border-[--border-default] px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <button
            onClick={() => navigate('/documents')}
            className="p-2 -ml-1 md:-ml-2 rounded-lg text-[--text-muted] hover:bg-[--bg-raised] transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base md:text-xl font-bold text-[--text-primary] truncate">{formData.name}</h1>
              <span className={cn(
                'hidden md:inline-flex px-2 py-0.5 rounded text-[10px] md:text-xs font-bold uppercase tracking-wider shrink-0',
                formData.status === 'Submitted' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              )}>
                {formData.status === 'Submitted' ? 'Submitted' : 'Draft'}
              </span>
            </div>
            <p className="text-xs md:text-sm text-[--text-muted] truncate">
              Record #{formData.id} • Processed {formData.date} • {formData.confidence}% AI Confidence
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0 justify-center">
          <span className={cn(
            'md:hidden px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0',
            formData.status === 'Submitted' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          )}>
            {formData.status === 'Submitted' ? 'Submitted' : 'Draft'}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleReprocess}
              disabled={isReprocessing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 md:px-4 md:py-2 border border-[--border-default] rounded-lg text-[--text-secondary] text-sm font-medium hover:bg-[--bg-raised] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReprocessing
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RotateCcw className="h-4 w-4" />}
              <span className="hidden sm:inline">{isReprocessing ? 'Reprocessing…' : 'Reprocess'}</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaved}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 md:px-4 md:py-2 text-sm border border-transparent rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isSaved ? 'bg-green-600 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSaved 
                ? <CheckCircle2 className="h-4 w-4" /> 
                : (formData.status === 'Submitted' ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4 -ml-0.5" />)
              }
              <span className="hidden sm:inline">
                {isSaved 
                  ? (formData.status === 'Submitted' && originalDoc?.status === 'Submitted' ? 'Updated!' : 'Submitted!') 
                  : (formData.status === 'Submitted' ? 'Update Document' : 'Submit Document')}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Reprocess error banner */}
      {reprocessError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="font-semibold">Reprocess failed:</span> {reprocessError}
        </div>
      )}

      {/* Mobile Image Preview (visible below lg) */}
      {imageSrc && (
        <div className="lg:hidden shrink-0">
          {/* Toggle header */}
          <button
            onClick={() => setShowMobilePreview(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 transition-colors"
            style={{
              background: showMobilePreview
                ? isDark ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
                : isDark ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #f1f5f9 0%, #f8fafc 100%)',
              borderBottom: `1px solid ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(0,0,0,0.05)'}`,
            }}
          >
            <div className="flex items-center gap-2">
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#22d3ee)', boxShadow: isDark ? '0 0 8px #6366f180' : 'none' }} />
              <span style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Document Preview</span>
            </div>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
              color: showMobilePreview ? (isDark ? '#22d3ee' : '#3b82f6') : (isDark ? '#6366f1' : '#64748b'),
              background: showMobilePreview ? (isDark ? 'rgba(34,211,238,0.1)' : 'rgba(59,130,246,0.1)') : (isDark ? 'rgba(99,102,241,0.1)' : 'rgba(0,0,0,0.05)'),
              border: `1px solid ${showMobilePreview ? (isDark ? 'rgba(34,211,238,0.3)' : 'rgba(59,130,246,0.3)') : (isDark ? 'rgba(99,102,241,0.3)' : 'rgba(0,0,0,0.1)')}`,
              borderRadius: '999px', padding: '0.2rem 0.6rem',
            }}>{showMobilePreview ? '▲ HIDE' : '▼ SHOW'}</span>
          </button>

          {showMobilePreview && (
            <div
              className="relative flex items-center justify-center overflow-hidden touch-none"
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse' && zoom > 1) {
                  setIsPanning(true);
                  panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
                }
              }}
              onPointerMove={(e) => {
                if (e.pointerType === 'mouse' && isPanning && panStart.current) {
                  setPan({ x: panStart.current.px + e.clientX - panStart.current.mx, y: panStart.current.py + e.clientY - panStart.current.my });
                }
              }}
              onPointerUp={() => { if (panStart.current) { setIsPanning(false); panStart.current = null; } }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                minHeight: 300,
                maxHeight: '85vw',
                background: isDark ? 'linear-gradient(160deg, #0a0f1e 0%, #111827 60%, #0a1628 100%)' : 'linear-gradient(160deg, #f8fafc 0%, #f1f5f9 60%, #e2e8f0 100%)',
                borderBottom: `1px solid ${isDark ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.05)'}`,
                cursor: zoom > 1 ? 'grab' : 'default'
              }}
            >
              {/* Subtle grid pattern */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage: isDark
                  ? 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)'
                  : 'linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.08) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }} />

              <img
                src={imageSrc}
                alt={formData.name}
                draggable={false}
                style={{
                  maxWidth: '92%',
                  maxHeight: '66vw',
                  objectFit: 'contain',
                  transformOrigin: 'center center',
                  transition: isPanning ? 'none' : 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  borderRadius: '4px',
                  boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)' : '0 8px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)',
                }}
              />

              {/* Frosted pill controls */}
              <div style={{
                position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                background: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(12px)',
                border: `1px solid ${isDark ? 'rgba(99,102,241,0.25)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: '999px',
                padding: '0.3rem 0.6rem',
                boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.1)',
                whiteSpace: 'nowrap',
              }}>
                <button onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}
                  style={{ background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(59,130,246,0.1)', border: 'none', borderRadius: '999px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#a5b4fc' : '#2563eb', cursor: 'pointer' }}
                  title="Zoom in"><ZoomIn style={{ width: 14, height: 14 }} /></button>

                <span style={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700, minWidth: 32, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>

                <button onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))}
                  style={{ background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(59,130,246,0.1)', border: 'none', borderRadius: '999px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#a5b4fc' : '#2563eb', cursor: 'pointer' }}
                  title="Zoom out"><ZoomOut style={{ width: 14, height: 14 }} /></button>

                <div style={{ width: 1, height: 16, background: isDark ? 'rgba(99,102,241,0.3)' : 'rgba(0,0,0,0.1)', margin: '0 0.1rem' }} />

                <button onClick={() => setRotation(r => (r + 90) % 360)}
                  style={{ background: isDark ? 'rgba(34,211,238,0.15)' : 'rgba(16,185,129,0.1)', border: 'none', borderRadius: '999px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#67e8f9' : '#059669', cursor: 'pointer' }}
                  title="Rotate"><RotateCw style={{ width: 14, height: 14 }} /></button>

                <button onClick={() => setShowFullscreen(true)}
                  style={{ background: isDark ? 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(34,211,238,0.4))' : 'linear-gradient(135deg, #3b82f6, #60a5fa)', border: 'none', borderRadius: '999px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
                  title="Fullscreen"><Maximize2 style={{ width: 14, height: 14 }} /></button>
                <button onClick={resetView}
                  style={{ background: isDark ? 'rgba(79,70,229,0.15)' : 'rgba(79,70,229,0.1)', border: 'none', borderRadius: '999px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#a5b4fc' : '#4f46e5', cursor: 'pointer' }}
                  title="Recenter"><Target style={{ width: 14, height: 14 }} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile Fullscreen Image Overlay */}
      {showFullscreen && imageSrc && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          width: '100%', height: '100%', zIndex: 99999,
          backgroundColor: '#000',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', backgroundColor: 'rgba(0,0,0,0.7)', flexShrink: 0 }}>
            <span style={{ color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%' }}>{formData.name}</span>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button onClick={() => setZoom(z => Math.min(6, +(z + 0.5).toFixed(2)))} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '0.375rem', padding: '0.5rem', color: '#fff', cursor: 'pointer', display: 'flex' }}><ZoomIn style={{ width: 18, height: 18 }} /></button>
              <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontFamily: 'monospace', minWidth: 34, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.max(0.25, +(z - 0.5).toFixed(2)))} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '0.375rem', padding: '0.5rem', color: '#fff', cursor: 'pointer', display: 'flex' }}><ZoomOut style={{ width: 18, height: 18 }} /></button>
              <button onClick={() => setRotation(r => (r + 90) % 360)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '0.375rem', padding: '0.5rem', color: '#fff', cursor: 'pointer', display: 'flex' }}><RotateCw style={{ width: 18, height: 18 }} /></button>
              <button onClick={() => { setZoom(1); setRotation(0); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '0.375rem', padding: '0.5rem', color: '#fff', cursor: 'pointer', display: 'flex' }}><Minimize2 style={{ width: 18, height: 18 }} /></button>
              <button onClick={() => { setShowFullscreen(false); setZoom(1); setRotation(0); }} style={{ background: 'rgba(239,68,68,0.8)', border: 'none', borderRadius: '0.375rem', padding: '0.5rem', color: '#fff', cursor: 'pointer', display: 'flex', marginLeft: '0.25rem' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
          </div>
          {/* Image */}
          <div 
            className="flex-1 overflow-hidden flex items-center justify-center relative p-4 touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && zoom > 1) {
                setIsPanning(true);
                panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
              }
            }}
            onPointerMove={(e) => {
              if (e.pointerType === 'mouse' && isPanning && panStart.current) {
                setPan({ x: panStart.current.px + e.clientX - panStart.current.mx, y: panStart.current.py + e.clientY - panStart.current.my });
              }
            }}
            onPointerUp={() => { if (panStart.current) { setIsPanning(false); panStart.current = null; } }}
          >
            <img
              src={imageSrc}
              alt={formData.name}
              draggable={false}
              style={{
                maxWidth: '100%',
                objectFit: 'contain',
                transformOrigin: 'center center',
                transition: isPanning ? 'none' : 'transform 0.2s ease',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              }}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Split Viewer */}
      <div className="flex-1 flex lg:overflow-hidden">
        {/* Document Viewer (Left) */}
        <div className="hidden lg:flex w-1/2 border-r border-[--border-default] flex-col relative overflow-hidden" 
             style={{ background: isDark ? 'linear-gradient(160deg, #0a0f1e 0%, #111827 60%, #0a1628 100%)' : 'linear-gradient(160deg, #f8fafc 0%, #f1f5f9 60%, #e2e8f0 100%)' }}>
          {/* Subtle grid pattern */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: isDark 
              ? 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)'
              : 'linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.08) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }} />

          {/* Premium Header Accent */}
          <div className={`flex items-center justify-between px-6 py-3 border-b shrink-0 backdrop-blur-md relative z-10 font-sans ${isDark ? 'border-white/5 bg-black/20' : 'border-black/5 bg-white/20'}`}>
            <div className="flex items-center gap-2">
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#22d3ee)', boxShadow: isDark ? '0 0 10px #6366f1' : 'none' }} />
              <span className={`text-[10px] uppercase font-bold tracking-[0.2em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>High-Fidelity Preview</span>
            </div>
          </div>

          {/* Viewer canvas */}
          <div
            ref={viewerRef}
            className="flex-1 overflow-hidden flex items-center justify-center relative select-none touch-none"
            style={{ cursor: isPanning ? 'grabbing' : zoom > 1 ? 'grab' : 'default' }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={(e) => {
              if (!imageSrc || zoom <= 1) return;
              setIsPanning(true);
              panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
            }}
            onMouseMove={(e) => {
              // Pan
              if (isPanning && panStart.current) {
                setPan({ x: panStart.current.px + e.clientX - panStart.current.mx, y: panStart.current.py + e.clientY - panStart.current.my });
              }
              // Hover magnifier
              if (viewerRef.current && imageSrc) {
                const rect = viewerRef.current.getBoundingClientRect();
                setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              }
            }}
            onMouseLeave={() => { setIsPanning(false); setHoverPos(null); panStart.current = null; }}
            onMouseUp={() => { setIsPanning(false); panStart.current = null; }}
          >
            {imageSrc ? (
              <>
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt={formData.name}
                  draggable={false}
                  className={`rounded-sm border transition-shadow ${isDark ? 'shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-white/10' : 'shadow-[0_20px_50px_rgba(0,0,0,0.15)] border-black/5'}`}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    maxHeight: '90%',
                    maxWidth: '90%',
                    objectFit: 'contain',
                  }}
                />
                {/* Hover magnifier lens */}
                {hoverPos && zoom < 3 && (() => {
                  const img = imgRef.current;
                  if (!img) return null;
                  const ir = img.getBoundingClientRect();
                  const vr = viewerRef.current!.getBoundingClientRect();
                  const imgLeft = ir.left - vr.left;
                  const imgTop = ir.top - vr.top;
                  const LENS = 200;
                  const MAG = 3.5;
                  const cx = hoverPos.x - imgLeft;
                  const cy = hoverPos.y - imgTop;
                  const bgW = ir.width * MAG;
                  const bgH = ir.height * MAG;
                  const bgX = -(cx * MAG - LENS / 2);
                  const bgY = -(cy * MAG - LENS / 2);
                  const viewerW = vr.width;
                  const viewerH = vr.height;
                  const clampedLeft = Math.max(0, Math.min(hoverPos.x - LENS / 2, viewerW - LENS));
                  const clampedTop = Math.max(0, Math.min(hoverPos.y - LENS / 2, viewerH - LENS));
                  return (
                    <div
                      className={`pointer-events-none absolute rounded-full border-2 overflow-hidden ring-4 z-20 ${isDark ? 'border-blue-400/50 shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-white/5' : 'border-blue-500/50 shadow-[0_0_50px_rgba(0,0,0,0.1)] ring-black/5'}`}
                      style={{
                        width: LENS, height: LENS,
                        left: clampedLeft,
                        top: clampedTop,
                        backgroundImage: `url(${imageSrc})`,
                        backgroundSize: `${bgW}px ${bgH}px`,
                        backgroundPosition: `${bgX}px ${bgY}px`,
                        backgroundRepeat: 'no-repeat',
                        backdropFilter: 'blur(4px)',
                      }}
                    />
                  );
                })()}
              </>
            ) : (
              <div className={`text-center px-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <p className="text-sm">No image preview available.</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>Re-upload the document from ScanHub to enable preview and reprocessing.</p>
              </div>
            )}
          </div>

          {/* Floating Glassmorphism Controls (Desktop) */}
          <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1.5 rounded-full backdrop-blur-xl border transition-all hover:scale-[1.02] ${isDark ? 'bg-slate-900/60 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]' : 'bg-white/80 border-black/5 shadow-[0_8px_32px_rgba(0,0,0,0.1)]'}`}>
            <button
              onClick={() => setZoom(z => Math.min(5, +(z + 0.25).toFixed(2)))}
              className={`p-2.5 rounded-full transition-all active:scale-90 ${isDark ? 'bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white' : 'bg-black/5 hover:bg-black/10 text-slate-600 hover:text-slate-900'}`}
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="min-w-[48px] text-center">
              <span className={`text-[11px] font-mono font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{Math.round(zoom * 100)}%</span>
            </div>
            <button
              onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
              className={`p-2.5 rounded-full transition-all active:scale-90 ${isDark ? 'bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white' : 'bg-black/5 hover:bg-black/10 text-slate-600 hover:text-slate-900'}`}
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <div className={`w-px h-5 mx-1 ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
            <button
              onClick={() => setRotation(r => (r + 90) % 360)}
              className={`p-2.5 rounded-full transition-all active:scale-90 ${isDark ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700'}`}
              title="Rotate"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowFullscreen(true)}
              className={`p-2.5 rounded-full transition-all active:scale-90 ${isDark ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300' : 'bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700'}`}
              title="Fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              onClick={resetView}
              className={`p-2.5 rounded-full transition-all active:scale-90 ${isDark ? 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-white' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700'}`}
              title="Recenter view"
            >
              <Target className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Data Panel (Right) */}
        <div className="w-full lg:w-1/2 lg:overflow-y-auto bg-[--bg-surface] px-6 pt-6 pb-8 md:px-8 md:pt-8 md:pb-10 space-y-6">

          <section>
            <h3 className="text-lg font-semibold text-[--text-primary] mb-4 pb-2 border-b border-[--border-subtle]">Extracted Details</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Vendor Name" value={formData.vendor} confidence={formData.confidence} onChange={(v) => handleChange('vendor', v)} />
              <Field label="Tax ID (TIN)" value={formData.taxId} confidence={formData.confidence - 1} onChange={(v) => handleChange('taxId', v)} />
              <Field label="Document Number" value={formData.docNum} confidence={formData.confidence + 2} onChange={(v) => handleChange('docNum', v)} />
              <Field label="Transaction Date" value={formData.date} confidence={formData.confidence + 1} onChange={(v) => handleChange('date', v)} />
              <Field label="Expense Category" value={formData.category} confidence={formData.confidence - 5} type="select" options={['Expense', 'Revenue', 'Asset', 'Liability', 'Uncategorized', 'Utility / Communications', 'Travel', 'Meals', 'Supplies', 'Fuel']} onChange={(v) => handleChange('category', v)} />
              <Field label="Payment Method" value={formData.paymentMethod || 'Debit Card'} confidence={formData.confidence} type="select" options={['Debit Card', 'Cash', 'Bank Transfer']} onChange={(v) => handleChange('paymentMethod', v)} />
              <Field label="Tax Type" value={formData.taxType || 'VAT'} confidence={formData.confidence} type="select" options={['VAT', 'Exempt', 'Zero-Rated', 'Amusement Tax']} onChange={(v) => handleChange('taxType', v as TaxType)} />
              <div className="col-span-2">
                <Field label="Registered Address" value={formData.registeredAddress || ''} confidence={formData.confidence - 2} onChange={(v) => handleChange('registeredAddress', v)} />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-[--text-primary] mb-4 pb-2 border-b border-[--border-subtle]">Line Items</h3>
            <div className="border border-[--border-default] rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[--bg-raised] border-b border-[--border-default] text-left">
                  <tr>
                    <th className="px-2 sm:px-4 py-3 font-medium text-[--text-secondary]">Description</th>
                    <th className="px-1 sm:px-4 py-3 font-medium text-[--text-secondary] text-right w-14 sm:w-20">Qty</th>
                    <th className="px-1 sm:px-4 py-3 font-medium text-[--text-secondary] text-right w-20 sm:w-28">Price</th>
                    <th className="px-2 sm:px-4 py-3 font-medium text-[--text-secondary] text-right w-24 sm:w-32">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--border-subtle]">
                  {formData.lineItems.map(item => (
                    <tr key={item.id} className="hover:bg-[--bg-raised]/40 transition-colors">
                      <td className="px-1 sm:px-3 py-2.5">
                        <input className="w-full bg-[--bg-raised] border border-[--border-default] rounded-md px-2 sm:px-3 py-2 text-xs sm:text-sm text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" value={item.description} onChange={(e) => { const updated = formData.lineItems.map(li => li.id === item.id ? { ...li, description: e.target.value } : li); setFormData({ ...formData, lineItems: updated }); }} />
                      </td>
                      <td className="px-1 sm:px-3 py-2.5 w-14 sm:w-20">
                        <input className="w-full bg-[--bg-raised] border border-[--border-default] rounded-md px-1 sm:px-3 py-2 text-xs sm:text-sm text-center sm:text-right text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" value={item.qty} onChange={(e) => { const q = Number(e.target.value) || 1; const updated = formData.lineItems.map(li => li.id === item.id ? { ...li, qty: q, net: li.price * q } : li); setFormData({ ...formData, lineItems: updated }); }} />
                      </td>
                      <td className="px-1 sm:px-3 py-2.5 w-20 sm:w-28">
                        <input className="w-full bg-[--bg-raised] border border-[--border-default] rounded-md px-1 sm:px-3 py-2 text-xs sm:text-sm text-right text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" value={item.price} onChange={(e) => { const v = Number(e.target.value) || 0; const updated = formData.lineItems.map(li => li.id === item.id ? { ...li, price: v, net: v * li.qty } : li); setFormData({ ...formData, lineItems: updated }); }} />
                      </td>
                      <td className="px-2 sm:px-4 py-2.5 w-24 sm:w-32 text-right font-semibold text-[--text-primary] text-xs sm:text-sm whitespace-nowrap">₱{item.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => { const newItem = { id: String(Date.now()), description: '', qty: 1, price: 0, net: 0 }; setFormData({ ...formData, lineItems: [...formData.lineItems, newItem] }); }} className="text-sm text-blue-600 font-medium mt-3 hover:text-blue-700">+ Add Line Item</button>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-[--text-primary] mb-4 pb-2 border-b border-[--border-subtle] flex items-center gap-3">
              Tax & Financial Summary
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${formData.taxType === 'VAT' || !formData.taxType ? 'bg-blue-100 text-blue-700' :
                  formData.taxType === 'Amusement Tax' ? 'bg-purple-100 text-purple-700' :
                    'bg-[--bg-raised] text-[--text-secondary]'
                }`}>{formData.taxType || 'VAT'}</span>
            </h3>
            <div className="bg-[--bg-raised] rounded-lg p-5 border border-[--border-subtle]">
              <div className="space-y-3">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-[--text-muted] min-w-0 truncate">VATable Sales</span>
                  <span className="font-medium text-[--text-primary] whitespace-nowrap shrink-0">₱ {derivedVatableSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-[--text-muted] min-w-0 truncate">VAT (12%)</span>
                  <span className="font-medium text-[--text-primary] whitespace-nowrap shrink-0">₱ {derivedVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-[--text-muted] min-w-0 truncate">Zero-Rated Sales</span>
                  <span className="font-medium text-[--text-primary] whitespace-nowrap shrink-0">₱ {derivedZeroRated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="pt-3 border-t border-[--border-default] flex justify-between gap-4 font-bold text-lg mt-2">
                  <span className="text-[--text-primary] min-w-0 truncate">Total Amount</span>
                  <span className="text-blue-600 whitespace-nowrap shrink-0">₱ {derivedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </section>







        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  confidence: number;
  type?: 'text' | 'select';
  options?: string[];
  onChange: (val: string) => void;
}

function Field({ label, value, confidence, type = 'text', options = [], onChange }: FieldProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="block text-xs font-semibold text-[--text-muted] uppercase tracking-wider">{label}</label>
        <div className="flex gap-0.5">
          <div className={cn('h-1.5 w-1.5 rounded-full',
            confidence >= 90 ? 'bg-blue-500/50' : 'bg-slate-300'
          )}></div>
        </div>
      </div>
      {type === 'text' ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border-b border-transparent hover:border-[--border-default] focus:border-blue-500 focus:outline-none py-1.5 text-sm font-medium text-[--text-primary] transition-colors bg-transparent"
        />
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border-b border-transparent hover:border-[--border-default] focus:border-blue-500 focus:outline-none py-1.5 text-sm font-medium text-[--text-primary] transition-colors bg-[--bg-surface] cursor-pointer"
        >
          {options.map((opt: string) => <option key={opt} value={opt} className="bg-[--bg-surface] text-[--text-primary]">{opt}</option>)}
        </select>
      )}
    </div>
  );
}
