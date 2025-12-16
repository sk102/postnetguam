import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PricingService } from '@/lib/services/pricing.service';
import { prisma } from '@/lib/db/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import type { PriceConfig } from '@/types/pricing';
import { RecipientType } from '@prisma/client';

// Helper to create mock Decimal
function mockDecimal(value: number): Decimal {
  return {
    toString: () => value.toString(),
  } as Decimal;
}

// Mock rate configuration for tests
const mockRateConfig: PriceConfig = {
  id: 'test-rate-id',
  startDate: new Date('2024-01-01'),
  endDate: null, // Current effective rate
  baseRate3mo: mockDecimal(51), // $17/month * 3
  baseRate6mo: mockDecimal(102), // $17/month * 6
  baseRate12mo: mockDecimal(204), // $17/month * 12
  rate4thAdult: mockDecimal(2),
  rate5thAdult: mockDecimal(2),
  rate6thAdult: mockDecimal(2),
  rate7thAdult: mockDecimal(2),
  businessAccountFee: mockDecimal(4),
  minorRecipientFee: mockDecimal(0),
  keyDeposit: mockDecimal(5),
  createdById: 'admin-id',
  notes: 'Test rates',
  createdAt: new Date('2024-01-01'),
};

describe('PricingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculatePriceBreakdown', () => {
    it('calculates base rate only for 1-3 adult recipients without business', () => {
      const breakdown = PricingService.calculatePriceBreakdown(mockRateConfig, {
        renewalPeriod: 'THREE_MONTH',
        adultRecipientCount: 3,
        minorRecipientCount: 0,
        hasBusinessRecipient: false,
      });

      expect(breakdown.baseRate).toBe(51);
      expect(breakdown.businessFee).toBe(0);
      expect(breakdown.additionalRecipientFees).toBe(0);
      expect(breakdown.minorFees).toBe(0);
      expect(breakdown.totalForPeriod).toBe(51);
      expect(breakdown.totalMonthly).toBe(17);
      expect(breakdown.periodMonths).toBe(3);
    });

    it('adds business fee when hasBusinessRecipient is true', () => {
      const breakdown = PricingService.calculatePriceBreakdown(mockRateConfig, {
        renewalPeriod: 'THREE_MONTH',
        adultRecipientCount: 1,
        minorRecipientCount: 0,
        hasBusinessRecipient: true,
      });

      expect(breakdown.baseRate).toBe(51);
      expect(breakdown.businessFee).toBe(12); // $4/month * 3 months
      expect(breakdown.totalForPeriod).toBe(63); // 51 + 12
    });

    it('calculates additional recipient fees for 4th-7th recipients', () => {
      const breakdown = PricingService.calculatePriceBreakdown(mockRateConfig, {
        renewalPeriod: 'THREE_MONTH',
        adultRecipientCount: 5, // 2 additional (4th and 5th)
        minorRecipientCount: 0,
        hasBusinessRecipient: false,
      });

      // Additional fees: $2 + $2 = $4/month * 3 months = $12
      expect(breakdown.additionalRecipientFees).toBe(12);
      expect(breakdown.totalForPeriod).toBe(63); // 51 + 12
    });

    it('calculates fees for all 7 recipients (4 additional)', () => {
      const breakdown = PricingService.calculatePriceBreakdown(mockRateConfig, {
        renewalPeriod: 'THREE_MONTH',
        adultRecipientCount: 7, // 4 additional
        minorRecipientCount: 0,
        hasBusinessRecipient: false,
      });

      // Additional fees: 4 * $2/month * 3 months = $24
      expect(breakdown.additionalRecipientFees).toBe(24);
      expect(breakdown.totalForPeriod).toBe(75); // 51 + 24
    });

    it('calculates minor fees per minor recipient', () => {
      // Create config with non-zero minor fee
      const configWithMinorFee: PriceConfig = {
        ...mockRateConfig,
        minorRecipientFee: mockDecimal(1), // $1/month per minor
      };

      const breakdown = PricingService.calculatePriceBreakdown(configWithMinorFee, {
        renewalPeriod: 'THREE_MONTH',
        adultRecipientCount: 1,
        minorRecipientCount: 2,
        hasBusinessRecipient: false,
      });

      // Minor fees: 2 minors * $1/month * 3 months = $6
      expect(breakdown.minorFees).toBe(6);
      expect(breakdown.totalForPeriod).toBe(57); // 51 + 6
    });

    it('calculates zero minor fees when fee is $0', () => {
      const breakdown = PricingService.calculatePriceBreakdown(mockRateConfig, {
        renewalPeriod: 'THREE_MONTH',
        adultRecipientCount: 1,
        minorRecipientCount: 3,
        hasBusinessRecipient: false,
      });

      expect(breakdown.minorFees).toBe(0);
    });

    it('applies correct period multipliers for 6-month period', () => {
      const breakdown = PricingService.calculatePriceBreakdown(mockRateConfig, {
        renewalPeriod: 'SIX_MONTH',
        adultRecipientCount: 1,
        minorRecipientCount: 0,
        hasBusinessRecipient: true,
      });

      expect(breakdown.baseRate).toBe(102); // $17 * 6
      expect(breakdown.businessFee).toBe(24); // $4 * 6
      expect(breakdown.periodMonths).toBe(6);
      expect(breakdown.totalForPeriod).toBe(126);
      expect(breakdown.totalMonthly).toBe(21); // $17 + $4
    });

    it('applies correct period multipliers for 12-month period', () => {
      const breakdown = PricingService.calculatePriceBreakdown(mockRateConfig, {
        renewalPeriod: 'TWELVE_MONTH',
        adultRecipientCount: 1,
        minorRecipientCount: 0,
        hasBusinessRecipient: false,
      });

      expect(breakdown.baseRate).toBe(204); // $17 * 12
      expect(breakdown.periodMonths).toBe(12);
      expect(breakdown.totalForPeriod).toBe(204);
      expect(breakdown.totalMonthly).toBe(17);
    });

    it('combines all fee types correctly', () => {
      const configWithMinorFee: PriceConfig = {
        ...mockRateConfig,
        minorRecipientFee: mockDecimal(1),
      };

      const breakdown = PricingService.calculatePriceBreakdown(configWithMinorFee, {
        renewalPeriod: 'THREE_MONTH',
        adultRecipientCount: 5, // 2 additional
        minorRecipientCount: 2,
        hasBusinessRecipient: true,
      });

      // Base: $51
      // Business: $4 * 3 = $12
      // Additional: 2 * $2 * 3 = $12
      // Minors: 2 * $1 * 3 = $6
      // Total: $81
      expect(breakdown.baseRate).toBe(51);
      expect(breakdown.businessFee).toBe(12);
      expect(breakdown.additionalRecipientFees).toBe(12);
      expect(breakdown.minorFees).toBe(6);
      expect(breakdown.totalForPeriod).toBe(81);
    });
  });

  describe('analyzeRecipients', () => {
    it('counts adults correctly for PERSON recipients', () => {
      const recipients = [
        { recipientType: RecipientType.PERSON, birthdate: new Date('1990-01-01') },
        { recipientType: RecipientType.PERSON, birthdate: new Date('1985-06-15') },
      ];

      const analysis = PricingService.analyzeRecipients(recipients);

      expect(analysis.adultCount).toBe(2);
      expect(analysis.minorCount).toBe(0);
      expect(analysis.hasBusinessRecipient).toBe(false);
      expect(analysis.totalCount).toBe(2);
    });

    it('counts minors correctly based on birthdate', () => {
      const today = new Date();
      const minorBirthdate = new Date(today.getFullYear() - 10, 0, 1); // 10 years old

      const recipients = [
        { recipientType: RecipientType.PERSON, birthdate: new Date('1990-01-01') },
        { recipientType: RecipientType.PERSON, birthdate: minorBirthdate },
      ];

      const analysis = PricingService.analyzeRecipients(recipients);

      expect(analysis.adultCount).toBe(1);
      expect(analysis.minorCount).toBe(1);
    });

    it('identifies business recipients - first business does not count toward recipient total', () => {
      const recipients = [
        { recipientType: RecipientType.PERSON, birthdate: new Date('1990-01-01') },
        { recipientType: RecipientType.BUSINESS, birthdate: null },
      ];

      const analysis = PricingService.analyzeRecipients(recipients);

      expect(analysis.hasBusinessRecipient).toBe(true);
      // First business recipient only determines business account status, does not count toward total
      expect(analysis.adultCount).toBe(1);
      expect(analysis.totalCount).toBe(1);
    });

    it('counts additional business recipients as adults', () => {
      const recipients = [
        { recipientType: RecipientType.PERSON, birthdate: new Date('1990-01-01') },
        { recipientType: RecipientType.BUSINESS, birthdate: null }, // First business - does not count
        { recipientType: RecipientType.BUSINESS, birthdate: null }, // Second business - counts as adult
      ];

      const analysis = PricingService.analyzeRecipients(recipients);

      expect(analysis.hasBusinessRecipient).toBe(true);
      // 1 person + 1 additional business (2nd business counts as adult)
      expect(analysis.adultCount).toBe(2);
      expect(analysis.totalCount).toBe(2);
    });

    it('handles empty recipient list', () => {
      const analysis = PricingService.analyzeRecipients([]);

      expect(analysis.adultCount).toBe(0);
      expect(analysis.minorCount).toBe(0);
      expect(analysis.hasBusinessRecipient).toBe(false);
      expect(analysis.totalCount).toBe(0);
    });

    it('treats PERSON without birthdate as adult', () => {
      const recipients = [
        { recipientType: RecipientType.PERSON, birthdate: null },
      ];

      const analysis = PricingService.analyzeRecipients(recipients);

      expect(analysis.adultCount).toBe(1);
      expect(analysis.minorCount).toBe(0);
    });
  });

  describe('getCurrentRates', () => {
    it('returns rate with null endDate (current effective rate)', async () => {
      vi.mocked(prisma.rateHistory.findFirst).mockResolvedValue(mockRateConfig);

      const rates = await PricingService.getCurrentRates();

      expect(rates).toEqual(mockRateConfig);
      expect(prisma.rateHistory.findFirst).toHaveBeenCalledWith({
        where: {
          endDate: null,
        },
        orderBy: {
          startDate: 'desc',
        },
      });
    });

    it('returns null when no rates exist', async () => {
      vi.mocked(prisma.rateHistory.findFirst).mockResolvedValue(null);

      const rates = await PricingService.getCurrentRates();

      expect(rates).toBeNull();
    });
  });

  describe('getRatesForDate', () => {
    it('returns rates effective at the specified date using date range', async () => {
      vi.mocked(prisma.rateHistory.findFirst).mockResolvedValue(mockRateConfig);

      const targetDate = new Date('2024-06-15');
      const rates = await PricingService.getRatesForDate(targetDate);

      expect(rates).toEqual(mockRateConfig);
      expect(prisma.rateHistory.findFirst).toHaveBeenCalledWith({
        where: {
          startDate: {
            lte: expect.any(Date),
          },
          OR: [
            { endDate: null },
            { endDate: { gte: expect.any(Date) } },
          ],
        },
        orderBy: {
          startDate: 'desc',
        },
      });
    });
  });

  describe('serializePriceConfig', () => {
    it('converts Decimal fields to numbers', () => {
      const serialized = PricingService.serializePriceConfig(mockRateConfig);

      expect(serialized.baseRate3mo).toBe(51);
      expect(serialized.baseRate6mo).toBe(102);
      expect(serialized.baseRate12mo).toBe(204);
      expect(serialized.rate4thAdult).toBe(2);
      expect(serialized.rate5thAdult).toBe(2);
      expect(serialized.rate6thAdult).toBe(2);
      expect(serialized.rate7thAdult).toBe(2);
      expect(serialized.businessAccountFee).toBe(4);
      expect(serialized.minorRecipientFee).toBe(0);
      expect(serialized.keyDeposit).toBe(5);
    });

    it('formats dates as ISO strings', () => {
      const serialized = PricingService.serializePriceConfig(mockRateConfig);

      expect(serialized.startDate).toBe('2024-01-01');
      expect(serialized.endDate).toBeNull();
      expect(serialized.createdAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('formats endDate when present', () => {
      const configWithEndDate = {
        ...mockRateConfig,
        endDate: new Date('2024-12-31'),
      };
      const serialized = PricingService.serializePriceConfig(configWithEndDate);

      expect(serialized.startDate).toBe('2024-01-01');
      expect(serialized.endDate).toBe('2024-12-31');
    });

    it('preserves string fields', () => {
      const serialized = PricingService.serializePriceConfig(mockRateConfig);

      expect(serialized.id).toBe('test-rate-id');
      expect(serialized.createdById).toBe('admin-id');
      expect(serialized.notes).toBe('Test rates');
    });
  });
});
