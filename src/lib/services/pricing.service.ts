import { RenewalPeriod, RecipientType, type Recipient } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db/prisma';
import { isMinor as checkIsMinor, get18thBirthday, getMonthsUntil18 } from '@/lib/utils/date';
import { PRICING } from '@/constants/app';
import type {
  PriceConfig,
  PriceCalculationInput,
  PriceBreakdown,
  RecipientAnalysis,
  SerializedPriceConfig,
  RenewalPriceBreakdown,
  MinorTransition,
  RecipientForRenewal,
} from '@/types/pricing';

/**
 * Convert Prisma Decimal to number
 */
function decimalToNumber(decimal: Decimal): number {
  return parseFloat(decimal.toString());
}

/**
 * Get the base rate for a specific renewal period
 */
function getBaseRateForPeriod(
  rates: PriceConfig,
  period: RenewalPeriod
): number {
  switch (period) {
    case 'THREE_MONTH':
      return decimalToNumber(rates.baseRate3mo);
    case 'SIX_MONTH':
      return decimalToNumber(rates.baseRate6mo);
    case 'TWELVE_MONTH':
      return decimalToNumber(rates.baseRate12mo);
    default:
      throw new Error(`Unknown renewal period: ${String(period)}`);
  }
}

/**
 * Get the number of months for a renewal period
 */
function getPeriodMonths(period: RenewalPeriod): number {
  switch (period) {
    case 'THREE_MONTH':
      return PRICING.PERIOD_MONTHS.THREE_MONTH;
    case 'SIX_MONTH':
      return PRICING.PERIOD_MONTHS.SIX_MONTH;
    case 'TWELVE_MONTH':
      return PRICING.PERIOD_MONTHS.TWELVE_MONTH;
    default:
      throw new Error(`Unknown renewal period: ${String(period)}`);
  }
}

/**
 * Calculate additional recipient fees (4th-7th adults)
 */
function calculateAdditionalRecipientFees(
  rates: PriceConfig,
  additionalAdultCount: number
): number {
  if (additionalAdultCount <= 0) return 0;

  let totalFee = 0;
  const recipientFees = getAdditionalAdultFees(rates);

  const count = Math.min(additionalAdultCount, recipientFees.length);
  for (let i = 0; i < count; i++) {
    const fee = recipientFees[i];
    if (fee !== undefined) {
      totalFee += fee;
    }
  }

  return totalFee;
}

/**
 * Get array of additional adult fees [4th, 5th, 6th, 7th]
 */
function getAdditionalAdultFees(rates: PriceConfig): number[] {
  return [
    decimalToNumber(rates.rate4thAdult),
    decimalToNumber(rates.rate5thAdult),
    decimalToNumber(rates.rate6thAdult),
    decimalToNumber(rates.rate7thAdult),
  ];
}

/**
 * Get the monthly fee for a specific adult position (4th=0, 5th=1, 6th=2, 7th=3)
 * Returns 0 if position is beyond 7th adult
 */
function getAdditionalAdultFeeForPosition(rates: PriceConfig, position: number): number {
  const fees = getAdditionalAdultFees(rates);
  return fees[position] ?? 0;
}

/**
 * Service for managing pricing and rate calculations
 */
export const PricingService = {
  /**
   * Get the current effective rates (rate with endDate = null, or most recent startDate <= now)
   */
  async getCurrentRates(): Promise<PriceConfig | null> {
    // First try to find the current rate (endDate is null)
    const currentRate = await prisma.rateHistory.findFirst({
      where: {
        endDate: null,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    if (currentRate) return currentRate;

    // Fallback: find most recent rate where startDate <= now
    const now = new Date();
    const rate = await prisma.rateHistory.findFirst({
      where: {
        startDate: {
          lte: now,
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return rate;
  },

  /**
   * Get rates effective at a specific date
   */
  async getRatesForDate(date: Date): Promise<PriceConfig | null> {
    // Set to end of day to include rates effective on that date
    const targetDate = new Date(date);
    targetDate.setHours(23, 59, 59, 999);

    // Find rate where startDate <= targetDate AND (endDate is null OR endDate >= targetDate)
    const rate = await prisma.rateHistory.findFirst({
      where: {
        startDate: {
          lte: targetDate,
        },
        OR: [
          { endDate: null },
          { endDate: { gte: targetDate } },
        ],
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return rate;
  },

  /**
   * Get all rate history entries (for manager view)
   */
  async getRateHistory(
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: PriceConfig[]; total: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.rateHistory.findMany({
        orderBy: { startDate: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      }),
      prisma.rateHistory.count(),
    ]);

    return { data, total };
  },

  /**
   * Calculate a detailed price breakdown
   */
  calculatePriceBreakdown(
    rates: PriceConfig,
    input: PriceCalculationInput
  ): PriceBreakdown {
    const periodMonths = getPeriodMonths(input.renewalPeriod);

    // Base rate for the period
    const baseRate = getBaseRateForPeriod(rates, input.renewalPeriod);

    // Business account fee (monthly * period)
    const businessFeeMonthly = input.hasBusinessRecipient
      ? decimalToNumber(rates.businessAccountFee)
      : 0;
    const businessFee = businessFeeMonthly * periodMonths;

    // Additional recipient fees (4th-7th adults, monthly * period)
    const additionalAdultCount = Math.max(
      0,
      input.adultRecipientCount - PRICING.INCLUDED_RECIPIENTS
    );
    const additionalRecipientFeesMonthly = calculateAdditionalRecipientFees(
      rates,
      additionalAdultCount
    );
    const additionalRecipientFees = additionalRecipientFeesMonthly * periodMonths;

    // Minor fees (per minor, monthly * period)
    const minorFeeMonthly = decimalToNumber(rates.minorRecipientFee);
    const minorFees = minorFeeMonthly * input.minorRecipientCount * periodMonths;

    // Calculate totals
    const totalForPeriod = baseRate + businessFee + additionalRecipientFees + minorFees;
    const totalMonthly = totalForPeriod / periodMonths;

    return {
      baseRate,
      businessFee,
      additionalRecipientFees,
      minorFees,
      totalMonthly,
      totalForPeriod,
      periodMonths,
    };
  },

  /**
   * Analyze recipients to get counts for pricing calculation
   *
   * Business recipient rules:
   * - First business recipient: determines business account status, does NOT count toward recipient total
   * - Additional business recipients (2nd+): count as adult recipients
   */
  analyzeRecipients(recipients: Pick<Recipient, 'recipientType' | 'birthdate'>[]): RecipientAnalysis {
    let adultCount = 0;
    let minorCount = 0;
    let businessRecipientCount = 0;

    for (const recipient of recipients) {
      if (recipient.recipientType === RecipientType.BUSINESS) {
        businessRecipientCount++;
        // Only 2nd+ business recipients count as adults
        if (businessRecipientCount > 1) {
          adultCount++;
        }
      } else if (recipient.recipientType === RecipientType.PERSON) {
        if (recipient.birthdate && checkIsMinor(recipient.birthdate)) {
          minorCount++;
        } else {
          adultCount++;
        }
      }
    }

    return {
      adultCount,
      minorCount,
      hasBusinessRecipient: businessRecipientCount > 0,
      totalCount: adultCount + minorCount,
    };
  },

  /**
   * Calculate prorated renewal price breakdown accounting for minors turning 18
   * @param rates - Current pricing configuration
   * @param renewalPeriod - The renewal period (3, 6, or 12 months)
   * @param recipients - List of recipients with their details
   * @param renewalStartDate - When the renewal period starts (defaults to today)
   */
  calculateRenewalPriceBreakdown(
    rates: PriceConfig,
    renewalPeriod: RenewalPeriod,
    recipients: RecipientForRenewal[],
    renewalStartDate: Date = new Date()
  ): RenewalPriceBreakdown {
    const periodMonths = getPeriodMonths(renewalPeriod);
    const baseRate = getBaseRateForPeriod(rates, renewalPeriod);
    const minorFeeMonthly = decimalToNumber(rates.minorRecipientFee);
    const businessFeeMonthly = decimalToNumber(rates.businessAccountFee);

    // Separate recipients by type
    // Business recipient rules:
    // - First business: determines business account status, does NOT count toward recipient total
    // - Additional businesses (2nd+): count as adult recipients
    let businessRecipientCount = 0;
    const adults: RecipientForRenewal[] = [];
    const minors: RecipientForRenewal[] = [];

    for (const recipient of recipients) {
      if (recipient.recipientType === 'BUSINESS') {
        businessRecipientCount++;
        // Only 2nd+ business recipients count as adults
        if (businessRecipientCount > 1) {
          adults.push(recipient);
        }
      } else if (recipient.recipientType === 'PERSON') {
        if (recipient.birthdate && checkIsMinor(recipient.birthdate)) {
          minors.push(recipient);
        } else {
          adults.push(recipient);
        }
      }
    }

    const hasBusinessRecipient = businessRecipientCount > 0;

    // Calculate which minors turn 18 during the renewal period
    const minorTransitions: MinorTransition[] = [];
    let transitionFees = 0;

    for (const minor of minors) {
      if (!minor.birthdate) continue;

      const monthsUntil18 = getMonthsUntil18(minor.birthdate, renewalStartDate);

      // If they turn 18 during the renewal period
      if (monthsUntil18 !== null && monthsUntil18 < periodMonths) {
        const monthsAsMinor = monthsUntil18;
        const monthsAsAdult = periodMonths - monthsUntil18;
        const turnsAdultDate = get18thBirthday(minor.birthdate);

        // Calculate if this minor becoming an adult makes them the 4th, 5th, 6th, or 7th adult
        // We need to track the order in which minors become adults
        minorTransitions.push({
          recipientId: minor.id,
          recipientName: minor.name,
          turnsAdultDate,
          monthsAsMinor,
          monthsAsAdult,
          additionalAdultFee: 0, // Will be calculated below
        });
      }
    }

    // Sort transitions by date (earliest first)
    minorTransitions.sort((a, b) => a.turnsAdultDate.getTime() - b.turnsAdultDate.getTime());

    // Calculate additional adult fees for each transition
    // Starting adult count (excluding minors who will transition)
    const startingAdultCount = adults.length;

    for (let i = 0; i < minorTransitions.length; i++) {
      const transition = minorTransitions[i];
      if (!transition) continue;

      // After this transition, how many adults are there?
      // Adults at start + number of minors who have already turned 18 (including this one)
      const adultsAfterTransition = startingAdultCount + i + 1;

      // If this makes them the 4th, 5th, 6th, or 7th adult, calculate the fee
      if (adultsAfterTransition > PRICING.INCLUDED_RECIPIENTS) {
        const additionalPosition = adultsAfterTransition - PRICING.INCLUDED_RECIPIENTS - 1;
        const monthlyFee = getAdditionalAdultFeeForPosition(rates, additionalPosition);
        transition.additionalAdultFee = monthlyFee * transition.monthsAsAdult;
        transitionFees += transition.additionalAdultFee;
      }
    }

    // Calculate base fees (without transitions)
    // Business fee for the full period
    const businessFee = hasBusinessRecipient ? businessFeeMonthly * periodMonths : 0;

    // Additional recipient fees for adults who are already 4th+ at the start
    const additionalAdultCount = Math.max(0, startingAdultCount - PRICING.INCLUDED_RECIPIENTS);
    const additionalRecipientFeesMonthly = calculateAdditionalRecipientFees(rates, additionalAdultCount);
    const additionalRecipientFees = additionalRecipientFeesMonthly * periodMonths;

    // Minor fees: calculate based on actual months as minor for each
    let minorFees = 0;
    for (const minor of minors) {
      if (!minor.birthdate) continue;

      const transition = minorTransitions.find((t) => t.recipientId === minor.id);
      if (transition) {
        // Prorated minor fee for months they're still a minor
        minorFees += minorFeeMonthly * transition.monthsAsMinor;
      } else {
        // Full period as minor
        minorFees += minorFeeMonthly * periodMonths;
      }
    }

    // Calculate totals
    const totalForPeriod = baseRate + businessFee + additionalRecipientFees + minorFees;
    const adjustedTotalForPeriod = totalForPeriod + transitionFees;
    const totalMonthly = adjustedTotalForPeriod / periodMonths;

    return {
      baseRate,
      businessFee,
      additionalRecipientFees,
      minorFees,
      totalMonthly,
      totalForPeriod,
      periodMonths,
      minorTransitions,
      transitionFees,
      adjustedTotalForPeriod,
    };
  },

  /**
   * Serialize PriceConfig for API response (convert Decimals to numbers)
   */
  serializePriceConfig(config: PriceConfig): SerializedPriceConfig {
    const startDateParts = config.startDate.toISOString().split('T');
    const startDateStr = startDateParts[0] ?? config.startDate.toISOString();
    const endDateStr = config.endDate
      ? (config.endDate.toISOString().split('T')[0] ?? config.endDate.toISOString())
      : null;
    return {
      id: config.id,
      startDate: startDateStr,
      endDate: endDateStr,
      baseRate3mo: decimalToNumber(config.baseRate3mo),
      baseRate6mo: decimalToNumber(config.baseRate6mo),
      baseRate12mo: decimalToNumber(config.baseRate12mo),
      rate4thAdult: decimalToNumber(config.rate4thAdult),
      rate5thAdult: decimalToNumber(config.rate5thAdult),
      rate6thAdult: decimalToNumber(config.rate6thAdult),
      rate7thAdult: decimalToNumber(config.rate7thAdult),
      businessAccountFee: decimalToNumber(config.businessAccountFee),
      minorRecipientFee: decimalToNumber(config.minorRecipientFee),
      keyDeposit: decimalToNumber(config.keyDeposit),
      createdById: config.createdById,
      notes: config.notes,
      createdAt: config.createdAt.toISOString(),
    };
  },
};

export type { PriceConfig, PriceBreakdown, PriceCalculationInput, RecipientAnalysis, RenewalPriceBreakdown, MinorTransition, RecipientForRenewal };
