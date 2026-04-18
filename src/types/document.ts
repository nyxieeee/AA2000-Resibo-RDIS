export type DocumentStatus = 'Pending Review' | 'Auto OK' | 'For Review' | 'Approved' | 'Declined';

// VAT    = standard 12% VAT, vatableSales = total/1.12, vat = total - vatableSales
// Exempt = VAT-exempt (e.g. basic necessities), full amount goes to zeroRatedSales, vat = 0
// Zero   = zero-rated (e.g. exports), full amount to zeroRatedSales, vat = 0
// Amusement = subject to amusement tax (cinemas, etc.), not reclaimable input VAT, vat = 0, exempt = total
export type TaxType = 'VAT' | 'Exempt' | 'Zero-Rated' | 'Amusement Tax';

export interface LineItem {
  id: string;
  description: string;
  qty: number;
  price: number;
  net: number;
}

export interface DocumentRecord {
  id: string;
  name: string;
  type: string;
  vendor: string;
  taxId: string;
  category: string;
  docNum: string;
  total: number;
  confidence: number;
  status: DocumentStatus;
  date: string;
  lineItems: LineItem[];
  vatableSales: number;
  vat: number;
  zeroRatedSales: number;
  reviewReason?: string;
  datGenerated?: boolean;
  taxType?: TaxType;
  paymentMethod?: string;
  registeredAddress?: string;
  imageData?: string;     // base64 of original image for viewer + reprocess
  imageType?: string;     // e.g. "image/jpeg"
}
