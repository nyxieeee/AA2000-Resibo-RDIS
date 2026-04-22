import type { DocumentRecord, DocumentStatus, TaxType } from '../../types/document';

interface ExtractedLineItem {
  description?: string;
  qty?: number;
  price?: number;
  net?: number;
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

function detectTaxType(category?: string, vendor?: string): TaxType {
  const text = `${category ?? ''} ${vendor ?? ''}`.toLowerCase();
  if (/cinema|movie|amusement|entertainment|theatre|theater/.test(text)) return 'Amusement Tax';
  if (/zero.rated|export|overseas/.test(text)) return 'Zero-Rated';
  if (/exempt|medicine|drug|pharma|grocery|food|vat.exempt/.test(text)) return 'Exempt';
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
  const isVatable = taxType === 'VAT';

  const rawLineItems =
    Array.isArray(extracted.lineItems) && extracted.lineItems.length > 0
      ? extracted.lineItems
      : null;
  const aiTotal: number =
    typeof extracted.totalAmount === 'number' ? extracted.totalAmount : 0;
  const lineItemTotal = rawLineItems
    ? parseFloat(
        rawLineItems
          .reduce(
            (sum: number, li: ExtractedLineItem) =>
              sum + (Number(li.net) || Number(li.price) || 0),
            0,
          )
          .toFixed(2),
      )
    : 0;
  const total: number = lineItemTotal > 0 ? lineItemTotal : aiTotal;

  const lineItems = rawLineItems
    ? rawLineItems.map((li: ExtractedLineItem, i: number) => ({
        id: String(i + 1),
        description: li.description || 'Item',
        qty: Number(li.qty) || 1,
        price: Number(li.price) || Number(li.net) || 0,
        net: Number(li.net) || Number(li.price) || 0,
      }))
    : [{ id: '1', description: 'Extracted Item', qty: 1, price: total, net: total }];

  const vatableSales = isVatable
    ? typeof extracted.vatableSales === 'number'
      ? extracted.vatableSales
      : parseFloat((total / 1.12).toFixed(2))
    : 0;
  const vat = isVatable
    ? typeof extracted.vat === 'number'
      ? extracted.vat
      : parseFloat((total - vatableSales).toFixed(2))
    : 0;
  const zeroRatedSales = !isVatable ? total : 0;

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
    lineItems,
    vatableSales: parseFloat(vatableSales.toFixed(2)),
    vat: parseFloat(vat.toFixed(2)),
    zeroRatedSales: parseFloat(zeroRatedSales.toFixed(2)),
    reviewReason:
      confidence < 80
        ? `Confidence at ${confidence}%. ${extracted.notes || 'Manual review recommended.'}`
        : undefined,
    imageData: base64,
    imageType: mediaType,
  };
}
