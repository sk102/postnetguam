import { z } from 'zod';
import { PRICING } from '@/constants/app';

/**
 * Schema for creating a new pricing configuration
 */
export const createPricingSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  baseMonthlyRate: z
    .number()
    .min(PRICING.MIN_RATE, 'Rate must be non-negative')
    .max(PRICING.MAX_RATE, `Rate cannot exceed ${PRICING.MAX_RATE}`),
  rate4thAdult: z
    .number()
    .min(PRICING.MIN_RATE, 'Rate must be non-negative')
    .max(PRICING.MAX_RATE, `Rate cannot exceed ${PRICING.MAX_RATE}`),
  rate5thAdult: z
    .number()
    .min(PRICING.MIN_RATE, 'Rate must be non-negative')
    .max(PRICING.MAX_RATE, `Rate cannot exceed ${PRICING.MAX_RATE}`),
  rate6thAdult: z
    .number()
    .min(PRICING.MIN_RATE, 'Rate must be non-negative')
    .max(PRICING.MAX_RATE, `Rate cannot exceed ${PRICING.MAX_RATE}`),
  rate7thAdult: z
    .number()
    .min(PRICING.MIN_RATE, 'Rate must be non-negative')
    .max(PRICING.MAX_RATE, `Rate cannot exceed ${PRICING.MAX_RATE}`),
  businessAccountFee: z
    .number()
    .min(PRICING.MIN_RATE, 'Fee must be non-negative')
    .max(PRICING.MAX_RATE, `Fee cannot exceed ${PRICING.MAX_RATE}`),
  minorRecipientFee: z
    .number()
    .min(PRICING.MIN_RATE, 'Fee must be non-negative')
    .max(PRICING.MAX_RATE, `Fee cannot exceed ${PRICING.MAX_RATE}`),
  keyDeposit: z
    .number()
    .min(PRICING.MIN_RATE, 'Deposit must be non-negative')
    .max(PRICING.MAX_RATE, `Deposit cannot exceed ${PRICING.MAX_RATE}`),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
});

export type CreatePricingInput = z.infer<typeof createPricingSchema>;

/**
 * Schema for updating a pricing configuration (same fields as create)
 */
export const updatePricingSchema = createPricingSchema;

export type UpdatePricingInput = z.infer<typeof updatePricingSchema>;

/**
 * Schema for price calculation input
 */
export const calculatePricingSchema = z
  .object({
    renewalPeriod: z.enum(['THREE_MONTH', 'SIX_MONTH', 'TWELVE_MONTH']),
    adultRecipientCount: z
      .number()
      .int('Adult count must be an integer')
      .min(1, 'At least one adult recipient is required')
      .max(PRICING.MAX_RECIPIENTS, `Maximum ${PRICING.MAX_RECIPIENTS} recipients allowed`),
    minorRecipientCount: z
      .number()
      .int('Minor count must be an integer')
      .min(0, 'Minor count cannot be negative')
      .max(PRICING.MAX_RECIPIENTS, `Maximum ${PRICING.MAX_RECIPIENTS} recipients allowed`),
    hasBusinessRecipient: z.boolean(),
  })
  .refine(
    (data) => data.adultRecipientCount + data.minorRecipientCount <= PRICING.MAX_RECIPIENTS,
    {
      message: `Total recipients cannot exceed ${PRICING.MAX_RECIPIENTS}`,
      path: ['minorRecipientCount'],
    }
  );

export type CalculatePricingInput = z.infer<typeof calculatePricingSchema>;
