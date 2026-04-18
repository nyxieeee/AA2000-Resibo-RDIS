import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle2, XCircle, RotateCcw, Loader2, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCw, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { DocumentRecord, TaxType } from '../../types/document';

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
  const isAccountant = user?.role === 'Accountant';
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

  const handleSave = () => {
    updateDocument(formData.id, {
      ...formData,
      total: derivedTotal,
      vatableSales: derivedVatableSales,
      vat: derivedVat,
      zeroRatedSales: derivedZeroRated,
    });
    addNotification(userId, { title: 'Changes Saved', message: `Document "${formData.name}" has been updated.`, type: 'success' });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
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
- If a field cannot be determined, use an empty string or 0`,
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

      const groqData = await response.json();
      const rawText = groqData.choices?.[0]?.message?.content ?? '';
      // Strip optional markdown fences before parsing
      const jsonText = rawText.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
      const extracted = JSON.parse(jsonText);

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
        status: confidence >= 95 ? 'Auto OK' : confidence >= 85 ? 'Approved' : 'For Review',
      };

      updateDocument(formData.id, updated);
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

  return (
    <div className="flex flex-col lg:h-full -m-6 md:-m-8">
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
                'px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider shrink-0',
                formData.status === 'Auto OK' && 'bg-slate-100 text-slate-700',
                formData.status === 'Pending Review' && 'bg-amber-100 text-amber-700 ring-1 ring-amber-500/20',
                formData.status === 'For Review' && 'bg-amber-100 text-amber-700 ring-1 ring-amber-500/20',
                formData.status === 'Approved' && 'bg-green-100 text-green-700 ring-1 ring-green-500/20',
                formData.status === 'Declined' && 'bg-red-100 text-red-700 ring-1 ring-red-500/20',
              )}>{formData.status}</span>
            </div>
            <p className="text-xs md:text-sm text-[--text-muted] truncate">
              Record #{formData.id} • Processed {formData.date} • {formData.confidence}% AI Confidence
            </p>
          </div>
        </div>

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
            className={`flex items-center gap-1.5 px-2.5 py-1.5 md:px-4 md:py-2 text-sm border border-transparent rounded-lg text-white font-medium transition-all ${isSaved ? 'bg-green-600 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isSaved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            <span className="hidden sm:inline">{isSaved ? 'Saved!' : 'Save Changes'}</span>
          </button>
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
                ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
                : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              borderBottom: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            <div className="flex items-center gap-2">
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#22d3ee)', boxShadow: '0 0 8px #6366f180' }} />
              <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Document Preview</span>
            </div>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
              color: showMobilePreview ? '#22d3ee' : '#6366f1',
              background: showMobilePreview ? 'rgba(34,211,238,0.1)' : 'rgba(99,102,241,0.1)',
              border: `1px solid ${showMobilePreview ? 'rgba(34,211,238,0.3)' : 'rgba(99,102,241,0.3)'}`,
              borderRadius: '999px', padding: '0.2rem 0.6rem',
            }}>{showMobilePreview ? '▲ HIDE' : '▼ SHOW'}</span>
          </button>

          {showMobilePreview && (
            <div
              className="relative flex items-center justify-center overflow-hidden"
              style={{
                minHeight: 200,
                maxHeight: '72vw',
                background: 'linear-gradient(160deg, #0a0f1e 0%, #111827 60%, #0a1628 100%)',
                borderBottom: '1px solid rgba(99,102,241,0.15)',
              }}
            >
              {/* Subtle grid pattern */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
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
                  transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  borderRadius: '4px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
                }}
              />

              {/* Frosted pill controls */}
              <div style={{
                position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                background: 'rgba(15,23,42,0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: '999px',
                padding: '0.3rem 0.6rem',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                whiteSpace: 'nowrap',
              }}>
                <button onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}
                  style={{ background: 'rgba(99,102,241,0.2)', border: 'none', borderRadius: '999px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a5b4fc', cursor: 'pointer' }}
                  title="Zoom in"><ZoomIn style={{ width: 14, height: 14 }} /></button>

                <span style={{ color: '#64748b', fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700, minWidth: 32, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>

                <button onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))}
                  style={{ background: 'rgba(99,102,241,0.2)', border: 'none', borderRadius: '999px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a5b4fc', cursor: 'pointer' }}
                  title="Zoom out"><ZoomOut style={{ width: 14, height: 14 }} /></button>

                <div style={{ width: 1, height: 16, background: 'rgba(99,102,241,0.3)', margin: '0 0.1rem' }} />

                <button onClick={() => setRotation(r => (r + 90) % 360)}
                  style={{ background: 'rgba(34,211,238,0.15)', border: 'none', borderRadius: '999px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#67e8f9', cursor: 'pointer' }}
                  title="Rotate"><RotateCw style={{ width: 14, height: 14 }} /></button>

                <button onClick={() => setShowFullscreen(true)}
                  style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(34,211,238,0.4))', border: 'none', borderRadius: '999px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e0e7ff', cursor: 'pointer' }}
                  title="Fullscreen"><Maximize2 style={{ width: 14, height: 14 }} /></button>
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
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <img
              src={imageSrc}
              alt={formData.name}
              draggable={false}
              style={{
                maxWidth: '100%',
                objectFit: 'contain',
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease',
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Split Viewer */}
      <div className="flex-1 flex lg:overflow-hidden">
        {/* Document Viewer (Left) */}
        <div className="hidden lg:flex w-1/2 border-r border-[--border-default] flex-col relative bg-[--bg-raised]">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[--border-default] shrink-0 bg-[--bg-surface]">
            <span className="text-xs font-bold text-[--text-muted] uppercase tracking-widest">Document Viewer</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setZoom(z => Math.min(5, +(z + 0.25).toFixed(2)))} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors" title="Zoom in"><ZoomIn className="h-4 w-4" /></button>
              <span className="text-xs font-mono text-[--text-muted] w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors" title="Zoom out"><ZoomOut className="h-4 w-4" /></button>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
              <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors" title="Rotate"><RotateCw className="h-4 w-4" /></button>
              <button onClick={resetView} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors" title="Reset view"><Maximize2 className="h-4 w-4" /></button>
            </div>
          </div>

          {/* Viewer canvas */}
          <div
            ref={viewerRef}
            className="flex-1 overflow-hidden flex items-center justify-center relative select-none"
            style={{ cursor: isPanning ? 'grabbing' : zoom > 1 ? 'grab' : 'default' }}
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
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 0.15s ease',
                    maxHeight: '100%',
                    maxWidth: '100%',
                    objectFit: 'contain',
                  }}
                />
                {/* Hover magnifier lens */}
                {hoverPos && zoom < 3 && (() => {
                  const img = imgRef.current;
                  if (!img) return null;
                  const ir = img.getBoundingClientRect();
                  const vr = viewerRef.current!.getBoundingClientRect();
                  // position of image within viewer
                  const imgLeft = ir.left - vr.left;
                  const imgTop = ir.top - vr.top;
                  const LENS = 160;
                  const MAG = 3;
                  // cursor relative to image
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
                      className="pointer-events-none absolute rounded-full border-2 border-blue-400/70 shadow-2xl overflow-hidden ring-1 ring-white/20"
                      style={{
                        width: LENS, height: LENS,
                        left: clampedLeft,
                        top: clampedTop,
                        backgroundImage: `url(${imageSrc})`,
                        backgroundSize: `${bgW}px ${bgH}px`,
                        backgroundPosition: `${bgX}px ${bgY}px`,
                        backgroundRepeat: 'no-repeat',
                      }}
                    />
                  );
                })()}
              </>
            ) : (
              <div className="text-center text-[--text-muted] px-8">
                <p className="text-sm">No image preview available.</p>
                <p className="text-xs mt-1">Re-upload the document from ScanHub to enable preview and reprocessing.</p>
              </div>
            )}
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
            <div className="border border-[--border-default] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[--bg-raised] border-b border-[--border-default] text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-[--text-secondary]">Description</th>
                    <th className="px-4 py-3 font-medium text-[--text-secondary] text-right w-20">Qty</th>
                    <th className="px-4 py-3 font-medium text-[--text-secondary] text-right w-28">Price</th>
                    <th className="px-4 py-3 font-medium text-[--text-secondary] text-right w-32">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--border-subtle]">
                  {formData.lineItems.map(item => (
                    <tr key={item.id} className="hover:bg-[--bg-raised]/40 transition-colors">
                      <td className="px-3 py-2.5">
                        <input className="w-full bg-[--bg-raised] border border-[--border-default] rounded-md px-3 py-2 text-sm text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" value={item.description} onChange={(e) => { const updated = formData.lineItems.map(li => li.id === item.id ? { ...li, description: e.target.value } : li); setFormData({ ...formData, lineItems: updated }); }} />
                      </td>
                      <td className="px-3 py-2.5 w-20">
                        <input className="w-full bg-[--bg-raised] border border-[--border-default] rounded-md px-3 py-2 text-sm text-right text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" value={item.qty} onChange={(e) => { const q = Number(e.target.value) || 1; const updated = formData.lineItems.map(li => li.id === item.id ? { ...li, qty: q, net: li.price * q } : li); setFormData({ ...formData, lineItems: updated }); }} />
                      </td>
                      <td className="px-3 py-2.5 w-28">
                        <input className="w-full bg-[--bg-raised] border border-[--border-default] rounded-md px-3 py-2 text-sm text-right text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" value={item.price} onChange={(e) => { const v = Number(e.target.value) || 0; const updated = formData.lineItems.map(li => li.id === item.id ? { ...li, price: v, net: v * li.qty } : li); setFormData({ ...formData, lineItems: updated }); }} />
                      </td>
                      <td className="px-4 py-2.5 w-32 text-right font-semibold text-[--text-primary] whitespace-nowrap">₱{item.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
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

          {(formData.status === 'Pending Review' || formData.status === 'For Review' || formData.reviewReason) && (
            <section>
              <div className="bg-amber-50 rounded-lg p-5 border border-amber-200 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-amber-900">Accountant Review Required</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    {formData.status === 'Pending Review'
                      ? `Please verify the AI-extracted data against the original receipt before approving. AI confidence: ${formData.confidence}%.`
                      : formData.reviewReason || 'Please review this extracted document.'}
                  </p>
                </div>
                {isAccountant && (
                  <div className="flex gap-2">
                    <button onClick={handleApprove} className="p-2 bg-[--bg-surface] text-green-600 rounded-md border border-green-200 shadow-sm hover:bg-green-50 dark:hover:bg-green-950/30" title="Approve"><CheckCircle2 className="h-5 w-5" /></button>
                    <button onClick={handleDecline} className="p-2 bg-[--bg-surface] text-red-600 rounded-md border border-red-200 shadow-sm hover:bg-red-50 dark:hover:bg-red-950/30" title="Decline"><XCircle className="h-5 w-5" /></button>
                  </div>
                )}
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
                {isAccountant && (
                  <button onClick={handleApprove} className="p-2 bg-[--bg-surface] text-[--text-secondary] rounded-md border border-[--border-default] shadow-sm hover:bg-[--bg-raised]" title="Restore"><RotateCcw className="h-5 w-5" /></button>
                )}
              </div>
            </section>
          )}

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
            confidence >= 90 ? 'bg-green-500' : confidence >= 80 ? 'bg-amber-500' : 'bg-red-500'
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
          className="w-full border-b border-transparent hover:border-[--border-default] focus:border-blue-500 focus:outline-none py-1.5 text-sm font-medium text-[--text-primary] transition-colors bg-transparent appearance-none cursor-pointer"
        >
          {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )}
    </div>
  );
}
