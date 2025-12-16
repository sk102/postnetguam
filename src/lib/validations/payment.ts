import { z } from 'zod';

/**
 * Schema for creating a new payment
 */
export const createPaymentSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  invoiceId: z.string().uuid('Invalid invoice ID').optional(),
  amount: z
    .number()
    .positive('Amount must be positive')
    .max(10000, 'Amount exceeds maximum'),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  paymentMethod: z.enum(['CASH', 'CARD', 'CHECK']),
  periodStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  periodEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  // Renewal fields - when present, account term data is updated
  isRenewal: z.boolean().optional(),
  renewalPeriod: z.enum(['THREE_MONTH', 'SIX_MONTH', 'TWELVE_MONTH']).optional(),
  newRate: z.number().nonnegative().optional(),
});

export type CreatePaymentSchemaInput = z.infer<typeof createPaymentSchema>;

/**
 * Schema for payment list query params
 */
export const paymentListQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'CHECK']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortField: z.enum(['paymentDate', 'amount', 'createdAt']).default('paymentDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;
