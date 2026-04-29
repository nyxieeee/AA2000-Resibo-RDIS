import type { DocumentRecord, DocumentStatus, TaxType } from '../../types/document';

interface ExtractedLineItem {
  description?: string;
  qty?: number;
  price?: number;
  net?: number;
}

/** Groq vision system role: line-item descriptions must be literal OCR, not invented products. */
export const GROQ_RECEIPT_VISION_SYSTEM_PROMPT = `You are a receipt and invoice OCR engine. Output structured JSON when asked.

Line items (strict):
- Each lineItems[].description must be literal text visible on the document for that row — same words, not a paraphrase or "better" product name.
- Never invent retail products (meat cuts, snacks, drinks, sizes) you do not read on the paper. Wrong: outputting a specific burger or brand when the slip says "Assorted Items", "Miscellaneous", "Various", or similar.
- Sales invoices often have one handwritten or printed line under Particulars / Description / Items. If that is the only line, return exactly one lineItem and copy that line verbatim (including "Assorted Items").
- If a line is unreadable, use description "" and say so in notes — do not substitute a plausible product.

Philippine BIR-style sales invoice (table + footer):
- Columns like QUANTITY / PARTICULARS / UNIT PRICE / AMOUNT: when Quantity and Unit Price are empty but Particulars and Amount are handwritten, output one lineItem — description = only what is written under Particulars (verbatim), net = the handwritten Amount for that row (not invented line items).
- When the footer shows handwritten VATABLE SALES, VAT AMOUNT, and TOTAL PAYABLE (or the same idea with different label wording), copy those numbers into vatableSales, vat, and totalAmount. Do not replace them with total÷1.12 math when those lines are visible.
- taxId in JSON means the vendor's VAT REG. TIN printed in the header for the store — not the customer's TIN in the Sold To block unless no vendor TIN appears on the form.

Cursive and script handwriting:
- Read connected letters as shapes on the page; do not "correct" cursive into a different common word unless the strokes clearly match.
- When cursive is ambiguous, prefer a literal partial transcription plus a note (e.g. "sold-to name unclear") and lower confidence — never invent names, dates, or amounts.`;

export function normalizeLineItemDescription(input?: string): string {
  const raw = (input || '').trim();
  if (!raw) return 'Item';
  const preserveCase = (replacement: string) => (match: string) =>
    match === match.toUpperCase()
      ? replacement.toUpperCase()
      : match[0] === match[0].toUpperCase()
        ? replacement[0].toUpperCase() + replacement.slice(1)
        : replacement;
  return raw
    // Ensure SKU code is separated from product text.
    .replace(/^(\d{5,7})([A-Za-z])/, '$1 $2')
    // Split letters/numbers boundaries: TrixPods160g -> Trix Pods 160 g
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    // Split uppercase acronym runs when next token starts as a word.
    .replace(/([A-Z]{2,})([A-Z][a-z])/g, '$1 $2')
    // Split lower-to-upper boundaries: CacaoPudr -> Cacao Pudr
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Normalize common size units
    .replace(/\b(\d+)\s*(g|kg|mg|ml|l|oz|pcs?|pc|ct)\b/gi, '$1 $2')
    // Keep decimal quantities together
    .replace(/(\d)\s+\.\s+(\d)/g, '$1.$2')
    // Product-specific OCR corrections observed in receipts
    .replace(/\btrix\b/gi, preserveCase('twix'))
    .replace(/\bpudr\b/gi, preserveCase('pwdr'))
    // Normalize whitespace
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export interface ExtractedData {
  confidence?: number;
  taxType?: string;
  category?: string;
  vendor?: string;
  registeredAddress?: string;
  lineItems?: ExtractedLineItem[];
  totalAmount?: number;
  vatableSales?: number;
  vat?: number;
  documentType?: string;
  taxId?: string;
  paymentMethod?: string;
  documentNumber?: string;
  date?: string;
  notes?: string;
}

function computeTaxFromTotal(total: number, taxType: TaxType) {
  if (taxType === 'VAT') {
    const vatableSales = parseFloat((total / 1.12).toFixed(2));
    return { vatableSales, vat: parseFloat((total - vatableSales).toFixed(2)), zeroRatedSales: 0 };
  }
  return { vatableSales: 0, vat: 0, zeroRatedSales: total };
}

interface FinancialResolution {
  total: number;
  vatableSales: number;
  vat: number;
  zeroRatedSales: number;
  lineItemTotal: number;
  mismatchNote?: string;
}

/**
 * Global numeric reconciliation for scan/reprocess:
 * prefer explicit VAT footer breakdown when present, then explicit total, then line sum.
 */
export function reconcileFinancialResolution(
  extracted: ExtractedData,
  taxType: TaxType,
  fallbackTotal = 0,
): FinancialResolution {
  const aiTotal =
    typeof extracted.totalAmount === 'number' && Number.isFinite(extracted.totalAmount) && extracted.totalAmount > 0
      ? extracted.totalAmount
      : 0;
  const lineItemTotal = Array.isArray(extracted.lineItems)
    ? parseFloat(
        extracted.lineItems
          .reduce((sum, li) => sum + (Number(li.net) || Number(li.price) || 0), 0)
          .toFixed(2),
      )
    : 0;
  const hasBreakdown =
    typeof extracted.vatableSales === 'number' &&
    typeof extracted.vat === 'number' &&
    typeof extracted.zeroRatedSales === 'number' &&
    extracted.vatableSales >= 0 &&
    extracted.vat >= 0 &&
    extracted.zeroRatedSales >= 0;
  const breakdownTotal = hasBreakdown
    ? parseFloat(((extracted.vatableSales as number) + (extracted.vat as number) + (extracted.zeroRatedSales as number)).toFixed(2))
    : 0;

  let total = aiTotal > 0 ? aiTotal : lineItemTotal > 0 ? lineItemTotal : fallbackTotal;
  if (hasBreakdown && breakdownTotal > 0) {
    const maxT = Math.max(aiTotal, breakdownTotal);
    const drift = maxT > 0 ? Math.abs(aiTotal - breakdownTotal) / maxT : 0;
    if (aiTotal <= 0 || drift > 0.03) total = breakdownTotal;
  }

  const tax = hasBreakdown
    ? {
        vatableSales: extracted.vatableSales as number,
        vat: extracted.vat as number,
        zeroRatedSales: extracted.zeroRatedSales as number,
      }
    : computeTaxFromTotal(total, taxType);

  let mismatchNote: string | undefined;
  if (total > 0 && lineItemTotal > 0) {
    const maxT = Math.max(total, lineItemTotal);
    if (maxT > 0 && Math.abs(total - lineItemTotal) / maxT > 0.05) {
      mismatchNote = `Line item nets sum to ${lineItemTotal} but resolved total is ${total}; verify line items against the image.`;
    }
  }

  return {
    total,
    vatableSales: parseFloat(tax.vatableSales.toFixed(2)),
    vat: parseFloat(tax.vat.toFixed(2)),
    zeroRatedSales: parseFloat(tax.zeroRatedSales.toFixed(2)),
    lineItemTotal,
    mismatchNote,
  };
}

function detectTaxType(category?: string, vendor?: string): TaxType {
  const text = `${category ?? ''} ${vendor ?? ''}`.toLowerCase();
  if (/cinema|movie|amusement|entertainment|theatre|theater/.test(text)) return 'Amusement Tax';
  if (/zero.rated|export|overseas/.test(text)) return 'Zero-Rated';
  // Do not treat generic "food"/"grocery" category as tax-exempt — many VAT receipts use Food.
  if (/\bexempt\b|vat.?exempt|medicine|pharma|hospital|senior|pwd|person w\/ disability/i.test(text)) return 'Exempt';
  return 'VAT';
}

export function buildDocumentRecord(
  file: File | null,
  extracted: ExtractedData,
  base64: string,
  mediaType: string,
  fileName?: string,
): DocumentRecord {
  const confidence: number =
    typeof extracted.confidence === 'number' ? extracted.confidence : 60;
  const status: DocumentStatus = 'Auto OK';
  const taxType: TaxType =
    (extracted.taxType as TaxType) || detectTaxType(extracted.category, extracted.vendor);
  const rawLineItems =
    Array.isArray(extracted.lineItems) && extracted.lineItems.length > 0
      ? extracted.lineItems
      : null;
  const resolved = reconcileFinancialResolution(extracted, taxType);
  const total = resolved.total;

  const lineItems = rawLineItems
    ? rawLineItems.map((li: ExtractedLineItem, i: number) => ({
        id: String(i + 1),
        description: normalizeLineItemDescription(li.description),
        qty: Number(li.qty) || 1,
        price: Number(li.price) || Number(li.net) || 0,
        net: Number(li.net) || Number(li.price) || 0,
      }))
    : [{ id: '1', description: 'Extracted Item', qty: 1, price: total, net: total }];
  const lineItemsAligned = (() => {
    if (lineItems.length !== 1 || total <= 0) return lineItems;
    const only = lineItems[0];
    const isGeneric = /\b(assorted|misc|miscellaneous|various|items?)\b/i.test(only.description || '');
    const net = Number(only.net) || Number(only.price) || 0;
    if (!isGeneric || net <= 0) return lineItems;
    const maxT = Math.max(net, total);
    if (maxT > 0 && Math.abs(net - total) / maxT > 0.05) {
      return [{ ...only, qty: 1, price: total, net: total }];
    }
    return lineItems;
  })();

  return {
    id: Math.random().toString(36).substr(2, 9),
    name: file?.name ?? fileName ?? 'camera-capture.jpg',
    type: extracted.documentType || 'Receipt',
    vendor: extracted.vendor || 'Unknown Vendor',
    registeredAddress: extracted.registeredAddress || '',
    taxId:
      extracted.taxId && extracted.taxId.replace(/[^0-9-]/g, '').length >= 9
        ? extracted.taxId
        : '',
    category: extracted.category || 'Expense',
    paymentMethod: extracted.paymentMethod || '',
    taxType,
    docNum:
      extracted.documentNumber && extracted.documentNumber.length > 1
        ? extracted.documentNumber
        : '',
    total,
    confidence,
    status,
    date:
      extracted.date && /^\d{4}-\d{2}-\d{2}$/.test(extracted.date) ? extracted.date : '',
    lineItems: lineItemsAligned,
    vatableSales: resolved.vatableSales,
    vat: resolved.vat,
    zeroRatedSales: resolved.zeroRatedSales,
    reviewReason: (() => {
      const parts: string[] = [];
      if (confidence < 80) {
        parts.push(`Confidence at ${confidence}%. ${extracted.notes || 'Manual review recommended.'}`);
      } else if (extracted.notes) {
        parts.push(extracted.notes);
      }
      if (resolved.mismatchNote) parts.push(resolved.mismatchNote);
      return parts.length ? parts.join(' ') : undefined;
    })(),
    imageData: base64,
    imageType: mediaType,
  };
}

/** Mild Laplacian sharpen on grayscale RGBA (helps thin pen and cursive strokes). */
function sharpenGray4Connected(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number,
): void {
  const w = width;
  const h = height;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = data[i * 4];
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        out[idx] = gray[idx];
        continue;
      }
      const c = gray[idx];
      const lap = 4 * c - gray[idx - 1] - gray[idx + 1] - gray[idx - w] - gray[idx + w];
      out[idx] = Math.max(0, Math.min(255, c + strength * lap));
    }
  }
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(out[i]);
    const k = i * 4;
    data[k] = data[k + 1] = data[k + 2] = v;
  }
}

/**
 * Resize, grayscale, contrast/gamma for faint ink, mild sharpen for cursive — balances OCR vs API payload.
 */
export async function preprocessImageForVisionOcr(
  imageSource: File | Blob,
): Promise<{ base64: string; mediaType: string }> {
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

      const MAX_SIZE = 2048;
      const MIN_SIZE = 1680;
      let width = img.width;
      let height = img.height;

      const longest = Math.max(width, height);
      let scale = 1;
      if (longest > MAX_SIZE) scale = MAX_SIZE / longest;
      else if (longest < MIN_SIZE) scale = MIN_SIZE / longest;
      if (scale !== 1) {
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Slightly stronger than before — helps light pen and cursive on white paper.
      const contrast = 1.34;
      const gamma = 0.88;
      const intercept = 128 * (1 - contrast);

      for (let i = 0; i < data.length; i += 4) {
        let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        gray = gray * contrast + intercept;
        gray = Math.pow(Math.max(0, gray) / 255, gamma) * 255;
        const final = Math.max(0, Math.min(255, gray));
        data[i] = final;
        data[i + 1] = final;
        data[i + 2] = final;
      }

      sharpenGray4Connected(data, width, height, 0.22);

      ctx.putImageData(imageData, 0, 0);

      const JPEG_QUALITY = 0.93;
      let q = JPEG_QUALITY;
      let dataUrl = canvas.toDataURL('image/jpeg', q);
      const MAX_BASE64_CHARS = 3_200_000;
      let base64 = '';
      while (q > 0.5) {
        dataUrl = canvas.toDataURL('image/jpeg', q);
        base64 = dataUrl.split(',')[1] ?? '';
        if (base64.length <= MAX_BASE64_CHARS) break;
        q -= 0.07;
      }
      resolve({ base64, mediaType: 'image/jpeg' });
    };
    img.onerror = () => reject(new Error('Failed to process image'));
    img.src = url;
  });
}
