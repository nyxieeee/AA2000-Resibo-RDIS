export type DocumentStatus = 'Auto OK' | 'For Review' | 'Approved' | 'Declined';

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
  paymentMethod?: string;
  imageData?: string;     // base64 of original image for viewer + reprocess
  imageType?: string;     // e.g. "image/jpeg"
}
