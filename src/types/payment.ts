import type { PaymentMethod } from '@prisma/client';

/**
 * Serialized payment for API responses
 */
export interface SerializedPayment {
  id: string;
  accountId: string;
  invoiceId: string | null;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  periodStart: string;
  periodEnd: string;
  notes: string | null;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * User info for payment display
 */
export interface PaymentRecordedByUser {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Account info for payment display
 */
export interface PaymentAccountInfo {
  id: string;
  mailbox: {
    number: number;
  };
}

/**
 * Payment with related data for display
 */
export interface PaymentWithDetails extends SerializedPayment {
  recordedByUser: PaymentRecordedByUser;
  account?: PaymentAccountInfo | undefined;
}

/**
 * Input for creating a new payment
 */
export interface CreatePaymentInput {
  accountId: string;
  invoiceId?: string | undefined;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  periodStart: string;
  periodEnd: string;
  notes?: string | undefined;
  // Renewal fields - when present, account term data is updated
  isRenewal?: boolean | undefined;
  renewalPeriod?: 'THREE_MONTH' | 'SIX_MONTH' | 'TWELVE_MONTH' | undefined;
  newRate?: number | undefined;
}

/**
 * Result of creating a payment
 */
export interface CreatePaymentResult {
  payment: PaymentWithDetails;
  isFirstPayment: boolean;
  mailboxActivated: boolean;
  renewalProcessed: boolean;
}

/**
 * Paginated payment list response
 */
export interface PaginatedPaymentResponse {
  success: boolean;
  data: PaymentWithDetails[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
