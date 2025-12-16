import type {
  Invoice,
  InvoiceLineItem,
  InvoiceType,
  InvoiceStatus,
  InvoiceLineType,
  RenewalPeriod,
  Payment,
  User,
} from '@prisma/client';

/**
 * Invoice with all related data
 */
export interface InvoiceWithDetails extends Invoice {
  lineItems: InvoiceLineItem[];
  payments: (Payment & {
    recordedByUser: Pick<User, 'id' | 'username' | 'firstName' | 'lastName'>;
  })[];
  createdBy: Pick<User, 'id' | 'username' | 'firstName' | 'lastName'> | null;
}

/**
 * Serialized invoice for API responses
 */
export interface SerializedInvoice {
  id: string;
  accountId: string;
  invoiceNumber: number;
  invoiceDate: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  renewalPeriod: RenewalPeriod;
  periodStart: string;
  periodEnd: string;
  periodMonths: number;
  subtotal: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  createdById: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: SerializedInvoiceLineItem[];
  payments?: SerializedInvoicePayment[];
  createdBy?: {
    id: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

/**
 * Serialized invoice line item
 */
export interface SerializedInvoiceLineItem {
  id: string;
  invoiceId: string;
  lineType: InvoiceLineType;
  description: string;
  quantity: number;
  unitPrice: number;
  months: number;
  totalAmount: number;
  sortOrder: number;
}

/**
 * Serialized payment for invoice response
 */
export interface SerializedInvoicePayment {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes: string | null;
  recordedBy: {
    id: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
  };
}

/**
 * Input for creating a line item
 */
export interface CreateInvoiceLineItemInput {
  lineType: InvoiceLineType;
  description: string;
  quantity?: number | undefined;
  unitPrice: number;
  months: number;
  sortOrder?: number | undefined;
}

/**
 * Input for creating an invoice
 */
export interface CreateInvoiceInput {
  accountId: string;
  invoiceDate: Date;
  invoiceType: InvoiceType;
  renewalPeriod: RenewalPeriod;
  periodStart: Date;
  periodEnd: Date;
  periodMonths: number;
  lineItems: CreateInvoiceLineItemInput[];
  notes?: string | undefined;
}

/**
 * Helper type for invoice list response
 */
export interface InvoiceListResponse {
  data: SerializedInvoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type {
  Invoice,
  InvoiceLineItem,
  InvoiceType,
  InvoiceStatus,
  InvoiceLineType,
};
