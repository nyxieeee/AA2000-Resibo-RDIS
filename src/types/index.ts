export type DocumentCategory = 'Expense' | 'Revenue' | 'Asset' | 'Liability';
export type PaymentMethod = 'Cash' | 'Debit Card' | 'Credit Card' | 'GCash' | 'Check' | 'Other';
export type ATPStatus = 'Valid' | 'Expired' | 'Unknown';
export type ReviewStatus = 'Auto OK' | 'For Review' | 'Approved' | 'Declined' | 'Human Edited';
export type ProcessingTier = 'Tier 1' | 'Tier 2';
export type DocumentType = 'Receipt' | 'Invoice' | 'Bill' | 'Other';

export interface LineItem {
  id: string; // Add internal ID for list rendering
  description: string;
  qty: number;
  price: number;
  gross: number;
  disc: number;
  net: number;
}

export interface FinancialDocument {
  id: string;
  workspaceId: string;
  fileUrl: string;
  documentType: DocumentType;
  
  // Section 11 Blueprint Fields
  vendorName: string;
  vendorAddress: string;
  vendorTaxId: string;
  documentNumber: string;
  transactionDate: string; // ISO 8601 string
  
  totalAmount: number;
  grossAmount: number;
  netAmount: number;
  taxAmount: number;
  
  vatableSales: number;
  vatExemptSales: number;
  zeroRatedSales: number;
  vatAmount12: number;
  
  withholdingTax: number;
  whtAtcCode: string;
  scPwdDiscount: number;
  currency: string;
  
  category: DocumentCategory;
  expenseCategory: string; // 'Cost of Sales', 'Travel', 'Meals', 'Bank Charges', etc.
  birCategory: string;
  paymentMethod: PaymentMethod;
  atpStatus: ATPStatus;
  
  lineItems: LineItem[];
  
  confidenceScore: number;
  reviewStatus: ReviewStatus;
  notes: string;
  labels: string[];
  
  aiModel: string;
  processingTier: ProcessingTier;
  createdAt: string; // ISO 8601 Date
}

export interface User {
  id: string;
  email: string;
  role: 'CEO' | 'President' | 'General Manager' | 'Accountant' | 'Viewer';
  firstName: string;
  lastName: string;
}

export interface Workspace {
  id: string;
  name: string;
  birTin: string;
  birRdo: string;
  vatRegistered: boolean;
}
