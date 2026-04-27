import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../../store/useDocumentStore';
import { Loader2, FileText, AlertCircle, Sparkles, Camera, X, ZoomIn, FlipHorizontal, RotateCcw } from 'lucide-react';
import { buildDocumentRecord } from './scanUtils';
import type { ExtractedData } from './scanUtils';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

async function preprocessImage(imageSource: File | Blob): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageSource);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Limit size for optimal AI processing while maintaining clarity
      const MAX_SIZE = 1600;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      // Contrast boost factor (1.2 = 20% increase)
      const contrast = 1.2;
      const intercept = 128 * (1 - contrast);

      for (let i = 0; i < data.length; i += 4) {
        // Luminosity-based grayscale
        let gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        
        // Basic contrast enhancement
        gray = gray * contrast + intercept;
        const final = Math.max(0, Math.min(255, gray));
        
        data[i] = final;
        data[i + 1] = final;
        data[i + 2] = final;
      }
      
      ctx.putImageData(imageData, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      resolve({ base64, mediaType: 'image/jpeg' });
    };
    img.onerror = () => reject(new Error('Failed to process image'));
    img.src = url;
  });
}

async function callGroqVision(apiKey: string, base64: string, mediaType: string): Promise<ExtractedData> {
  const prompt = `You are a precise OCR and data extraction AI. Analyze this Philippine receipt or invoice image and extract the following fields. Respond ONLY with a valid JSON object — no markdown, no explanation.\n\nRequired JSON structure:\n{\n  "vendor": "business name at the top of the document",\n  "registeredAddress": "full registered address of the vendor as printed on the document, or empty string if not found",\n  "taxId": "TIN in format 000-000-000-000, or empty string if not found",\n  "documentNumber": "OR/invoice number, or empty string",\n  "documentType": "Receipt | Invoice | Bill",\n  "date": "YYYY-MM-DD format, or empty string",\n  "category": "Expense category (Food, Transportation, Office Supplies, Utilities, etc.)",\n  "paymentMethod": "Cash | Credit Card | GCash | Maya | Bank Transfer | or empty string",\n  "taxType": "VAT | Zero-Rated | Exempt | Amusement Tax",\n  "totalAmount": 0,\n  "vatableSales": 0,\n  "vat": 0,\n  "zeroRatedSales": 0,\n  "lineItems": [\n    { "description": "item name", "qty": 1, "price": 0.00, "net": 0.00 }\n  ],\n  "confidence": 85,\n  "notes": "any relevant notes about document quality or ambiguous fields"\n}\n\nRules:\n- totalAmount, vatableSales, vat, zeroRatedSales must be plain numbers (no currency symbols)\n- If taxType is VAT: vatableSales = totalAmount / 1.12, vat = totalAmount - vatableSales, zeroRatedSales = 0\n- If taxType is Zero-Rated or Exempt: vatableSales = 0, vat = 0, zeroRatedSales = totalAmount\n- confidence: 95+ very clear, 80-94 readable, 60-79 uncertain fields, below 60 poor quality\n- lineItems: extract actual items if visible; otherwise use a single item with the total\n- documentType defaults to Receipt if unclear`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
        { type: 'text', text: prompt },
      ]}],
      max_tokens: 1024,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message || `Groq API error: ${response.status}`);
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  const rawText: string = data.choices?.[0]?.message?.content || '{}';
  const clean = rawText.replace(/```json\n?|\n?```/g, '').trim();
  try { return JSON.parse(clean) as ExtractedData; }
  catch { throw new Error('Model returned invalid JSON. Please try again.'); }
}

// ── Camera Modal ──────────────────────────────────────────────────────────────
function CameraModal({ onCapture, onClose }: { onCapture: (blob: Blob) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [captured, setCaptured] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsReady(true);
        };
      }
      setError(null);
    } catch (err: unknown) {
      const name = err instanceof Error ? (err as Error & { name: string }).name : '';
      setError(name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access in your browser settings.'
        : 'Camera not available on this device.');
    }
  }, []);

  // Start camera on mount
  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const handleClose = () => { stopCamera(); onClose(); };

  const handleFlip = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    setIsReady(false);
    setCaptured(null);
    startCamera(next);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setCapturedBlob(blob);
      setCaptured(canvas.toDataURL('image/jpeg', 0.92));
    }, 'image/jpeg', 0.92);
  };

  const handleRetake = () => { setCaptured(null); setCapturedBlob(null); };

  const handleUse = () => {
    if (capturedBlob) { stopCamera(); onCapture(capturedBlob); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm">
        <button onClick={handleClose} className="p-2 rounded-full text-white hover:bg-white/10">
          <X className="h-6 w-6" />
        </button>
        <span className="text-white font-semibold text-sm">Scan Receipt</span>
        <button onClick={handleFlip} className="p-2 rounded-full text-white hover:bg-white/10" title="Flip camera">
          <FlipHorizontal className="h-6 w-6" />
        </button>
      </div>

      {/* Camera / Preview */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {error ? (
          <div className="text-center p-8">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <p className="text-white text-sm">{error}</p>
            <button onClick={handleClose} className="mt-4 px-4 py-2 bg-white/20 text-white rounded-lg text-sm">Close</button>
          </div>
        ) : captured ? (
          <img src={captured} alt="Captured receipt" className="max-h-full max-w-full object-contain" />
        ) : (
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
        )}

        {/* Scan guide overlay */}
        {!captured && !error && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-4/5 max-w-sm aspect-[3/4] rounded-2xl border-2 border-white/40 relative">
              {(['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'] as const).map((pos, i) => (
                <div key={i} className={`absolute ${pos} h-8 w-8 border-white border-opacity-90 rounded-sm`} style={{
                  borderTopWidth: i < 2 ? 3 : 0, borderBottomWidth: i >= 2 ? 3 : 0,
                  borderLeftWidth: i % 2 === 0 ? 3 : 0, borderRightWidth: i % 2 === 1 ? 3 : 0,
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Bottom controls */}
      <div className="px-8 py-6 bg-black/60 backdrop-blur-sm flex items-center justify-center gap-8">
        {captured ? (
          <>
            <button onClick={handleRetake} className="flex flex-col items-center gap-1 text-white/70 hover:text-white">
              <div className="h-12 w-12 rounded-full border-2 border-white/40 flex items-center justify-center">
                <RotateCcw className="h-5 w-5" />
              </div>
              <span className="text-xs">Retake</span>
            </button>
            <button onClick={handleUse} className="flex flex-col items-center gap-1">
              <div className="h-16 w-16 rounded-full bg-blue-500 hover:bg-blue-400 flex items-center justify-center shadow-lg">
                <ZoomIn className="h-7 w-7 text-white" />
              </div>
              <span className="text-xs text-white font-semibold">Scan This</span>
            </button>
          </>
        ) : (
          <button
            onClick={handleCapture}
            disabled={!isReady}
            className="h-16 w-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 disabled:opacity-40 transition-all active:scale-95"
            title="Capture"
          >
            <span className="sr-only">Capture</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── ScanHub ──────────────────────────────────────────────────────────────────
export function ScanHub() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addDocument = useDocumentStore(state => state.addDocument);
  const navigate = useNavigate();

  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

  const handleProcessFile = async (file: File) => {
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!supportedTypes.includes(file.type)) {
      setError('Only JPG, PNG, WEBP, and GIF images are supported.');
      return;
    }
    if (!apiKey) {
      setError('No Groq API key found. Add VITE_GROQ_API_KEY=your_key to your .env file and restart.');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      setProcessingStep('Preprocessing image (Grayscale & Contrast)...');
      const { base64, mediaType } = await preprocessImage(file);
      setProcessingStep('Analyzing with Llama 4 Scout Vision...');
      const extracted = await callGroqVision(apiKey, base64, mediaType);
      setProcessingStep('Building document record...');
      const doc = buildDocumentRecord(file, extracted, base64, mediaType);
      await addDocument(doc);
      navigate(`/documents/${doc.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process document. Please try again.';
      setError(msg.includes('fetch') || msg.includes('NetworkError')
        ? 'Cannot reach Groq API. Please check your internet connection.'
        : msg);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const handleCameraCapture = async (blob: Blob) => {
    setShowCamera(false);
    if (!apiKey) {
      setError('No Groq API key found. Add VITE_GROQ_API_KEY=your_key to your .env file and restart.');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      setProcessingStep('Preprocessing captured image...');
      const { base64, mediaType } = await preprocessImage(blob);
      setProcessingStep('Analyzing with Llama 4 Scout Vision...');
      const extracted = await callGroqVision(apiKey, base64, mediaType);
      setProcessingStep('Building document record...');
      const doc = buildDocumentRecord(null, extracted, base64, mediaType, `scan-${Date.now().toString().slice(-5)}.jpg`);
      await addDocument(doc);
      navigate(`/documents/${doc.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process captured image. Please try again.';
      setError(msg.includes('fetch') || msg.includes('NetworkError')
        ? 'Cannot reach Groq API. Please check your internet connection.'
        : msg);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleProcessFile(e.dataTransfer.files[0]);
  };
  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleProcessFile(e.target.files[0]);
    e.target.value = '';
  };

  return (
    <>
      {showCamera && (
        <CameraModal onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      )}

      <div className="max-w-4xl mx-auto space-y-5">
        <div className="animate-page-in">
          <h1 className="text-xl md:text-2xl font-bold text-[--text-primary]">ScanHub</h1>
          <p className="text-[--text-secondary] flex items-center gap-2 mt-1 text-sm">
            Upload or photograph receipts — AI extracts vendor, amounts, VAT & line items instantly.
          </p>
        </div>

        {!apiKey && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Groq API Key Required</p>
              <p className="mt-0.5">Add <code className="bg-amber-100 px-1 rounded">VITE_GROQ_API_KEY=your_key</code> to your <code className="bg-amber-100 px-1 rounded">.env</code> file and restart. Get a free key at <strong>console.groq.com</strong>.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <button
            onClick={() => !isProcessing && apiKey && setShowCamera(true)}
            disabled={isProcessing || !apiKey}
            className={`flex flex-col items-center justify-center gap-3 p-5 md:p-8 rounded-2xl border transition-all text-center
              ${isProcessing || !apiKey
                ? 'border-transparent opacity-40 cursor-not-allowed'
                : 'border-slate-100 dark:border-slate-800/30 hover:border-blue-400/30 dark:hover:border-blue-500/30 hover:bg-blue-50/20 dark:hover:bg-blue-950/10 cursor-pointer active:scale-95'
              }`}
            style={{ backgroundColor: 'var(--bg-surface)' }}
          >
            <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Camera className="h-6 w-6 md:h-7 md:w-7" />
            </div>
            <div>
              <p className="font-semibold text-sm md:text-base text-[--text-primary]">Take Photo</p>
              <p className="text-xs text-[--text-muted] mt-0.5 hidden md:block">Use your camera to photograph a receipt</p>
            </div>
          </button>

          <button
            onClick={() => !isProcessing && apiKey && fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            disabled={isProcessing || !apiKey}
            className={`flex flex-col items-center justify-center gap-3 p-5 md:p-8 rounded-2xl border border-dashed transition-all text-center
              ${isProcessing || !apiKey
                ? 'border-transparent opacity-40 cursor-not-allowed'
                : isDragging
                  ? 'border-blue-400 bg-blue-500/10'
                  : 'border-slate-100 dark:border-slate-800/20 hover:border-blue-400/30 dark:hover:border-blue-500/30 hover:bg-blue-500/5 cursor-pointer active:scale-95'
              }`}
          >
            <div className={`h-12 w-12 md:h-14 md:w-14 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-blue-200 text-blue-700' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'}`}>
              <FileText className="h-6 w-6 md:h-7 md:w-7" />
            </div>
            <div>
              <p className="font-semibold text-sm md:text-base text-[--text-primary]">Upload File</p>
              <p className="text-xs text-[--text-muted] mt-0.5 hidden md:block">JPG, PNG, WEBP, or GIF (max 10MB)</p>
            </div>
          </button>
        </div>

        {isProcessing && (
          <div className="flex flex-col items-center gap-3 py-10 rounded-2xl" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
            <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
            <h3 className="text-base font-semibold text-[--text-primary]">Analyzing with Llama 4 Scout...</h3>
            <p className="text-[--text-secondary] text-sm">{processingStep}</p>
          </div>
        )}

        <input type="file" className="hidden" ref={fileInputRef} onChange={onFileInput} accept=".jpg,.jpeg,.png,.webp,.gif" />

        {error && (
          <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl p-4">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Processing Failed</p>
              <pre className="text-sm mt-0.5 whitespace-pre-wrap font-sans">{error}</pre>
            </div>
          </div>
        )}

        <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-blue-500" />
            <p className="font-semibold text-[--text-primary]">Powered by Llama 4 Scout via Groq (Free)</p>
          </div>
          <p className="text-[--text-muted] text-xs md:text-sm">
            Extracts vendor, TIN, OR number, date, amounts, VAT breakdown, and line items. Free tier: 1,000 scans/day. Get your key at <strong>console.groq.com</strong>.
          </p>
        </div>
      </div>
    </>
  );
}
