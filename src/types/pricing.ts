import type { Decimal } from '@prisma/client/runtime/library';
import type { RenewalPeriod } from '@prisma/client';

/**
 * Price configuration from RateHistory model
 */
export interface PriceConfig {
  id: string;
  startDate: Date;
  endDate: Date | null; // null = current effective rate
  baseRate3mo: Decimal;
  baseRate6mo: Decimal;
  baseRate12mo: Decimal;
  rate4thAdult: Decimal;
  rate5thAdult: Decimal;
  rate6thAdult: Decimal;
  rate7thAdult: Decimal;
  businessAccountFee: Decimal;
  minorRecipientFee: Decimal;
  keyDeposit: Decimal;
  createdById: string | null;
  notes: string | null;
  createdAt: Date;
}

/**
 * Input for price calculation
 */
export interface PriceCalculationInput {
  renewalPeriod: RenewalPeriod;
  adultRecipientCount: number;
  minorRecipientCount: number;
  hasBusinessRecipient: boolean;
}

/**
 * Detailed price breakdown
 */
export interface PriceBreakdown {
  /** Base rate for the selected period */
  baseRate: number;
  /** Business account fee for the period (0 if no business recipient) */
  businessFee: number;
  /** Additional fees for 4th-7th recipients for the period */
  additionalRecipientFees: number;
  /** Fees for minor recipients for the period */
  minorFees: number;
  /** Total monthly rate */
  totalMonthly: number;
  /** Total for the entire renewal period */
  totalForPeriod: number;
  /** Number of months in the period */
  periodMonths: number;
}

/**
 * Input for creating a new price configuration
 */
export interface CreatePriceConfigInput {
  startDate: string;
  baseMonthlyRate: number;
  rate4thAdult: number;
  rate5thAdult: number;
  rate6thAdult: number;
  rate7thAdult: number;
  businessAccountFee: number;
  minorRecipientFee: number;
  keyDeposit: number;
  notes?: string;
}

/**
 * Serialized price config for API responses (Decimal converted to number)
 */
export interface SerializedPriceConfig {
  id: string;
  startDate: string;
  endDate: string | null; // null = current effective rate
  baseRate3mo: number;
  baseRate6mo: number;
  baseRate12mo: number;
  rate4thAdult: number;
  rate5thAdult: number;
  rate6thAdult: number;
  rate7thAdult: number;
  businessAccountFee: number;
  minorRecipientFee: number;
  keyDeposit: number;
  createdById: string | null;
  notes: string | null;
  createdAt: string;
}

/**
 * Recipient analysis result
 */
export interface RecipientAnalysis {
  adultCount: number;
  minorCount: number;
  hasBusinessRecipient: boolean;
  totalCount: number;
}

/**
 * Information about a minor turning 18 during the renewal period
 */
export interface MinorTransition {
  /** Recipient ID */
  recipientId: string;
  /** Recipient name for display */
  recipientName: string;
  /** Date when the minor turns 18 */
  turnsAdultDate: Date;
  /** Months as minor during renewal period */
  monthsAsMinor: number;
  /** Months as adult during renewal period */
  monthsAsAdult: number;
  /** Additional fee due to becoming an adult (if 4th+ adult) */
  additionalAdultFee: number;
}

/**
 * Extended price breakdown for renewal with prorated calculations
 */
export interface RenewalPriceBreakdown extends PriceBreakdown {
  /** Details about minors turning 18 during the period */
  minorTransitions: MinorTransition[];
  /** Additional fees from minors becoming adults (4th+ adult) */
  transitionFees: number;
  /** Adjusted total for period including transition fees */
  adjustedTotalForPeriod: number;
}

/**
 * Recipient info for renewal calculation
 */
export interface RecipientForRenewal {
  id: string;
  recipientType: 'PERSON' | 'BUSINESS';
  name: string;
  birthdate: Date | null;
}
