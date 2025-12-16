import { prisma } from '@/lib/db/prisma';
import { PricingService } from './pricing.service';
import type { AccountStatus, AuditFlagType } from '@prisma/client';
import { PRICING } from '@/constants/app';
import { formatRecipientName } from '@/lib/utils/recipient';
import { calculateAge, isMinor } from '@/lib/utils/date';

export interface BusinessRecipient {
  name: string;
  alias: string | null;
}

export interface PersonRecipient {
  name: string;
  age: number | null;
  isMinor: boolean;
}

export interface AuditResult {
  accountId: string;
  mailboxId: string;
  mailboxNumber: number;
  accountName: string;
  personRecipients: PersonRecipient[];
  businessRecipients: BusinessRecipient[];
  currentRate: number;
  expectedRate: number;
  discrepancy: number;
  hasOverride: boolean;
  auditFlag: boolean;
  auditFlagType: AuditFlagType | null;
  auditNote: string | null;
  recipientCount: number;
}

export interface AuditSummary {
  totalAccounts: number;
  accountsAudited: number;
  accountsFlagged: number;
  accountsWithOverride: number;
  accountsOk: number;
  results: AuditResult[];
}

/**
 * Service for auditing account rates
 */
export const AuditService = {
  /**
   * Run an audit on all active/hold accounts
   * Returns accounts with rate discrepancies
   */
  async runRateAudit(statusFilter?: AccountStatus[]): Promise<AuditSummary> {
    // Default to auditing ACTIVE and HOLD accounts
    const statuses = statusFilter ?? ['ACTIVE', 'HOLD'];

    // Fetch all accounts with their recipients
    const accounts = await prisma.account.findMany({
      where: {
        status: { in: statuses },
      },
      include: {
        mailbox: true,
        recipients: {
          where: { removedDate: null },
        },
        rateOverrideBy: {
          select: { username: true },
        },
      },
      orderBy: { mailbox: { number: 'asc' } },
    });

    const results: AuditResult[] = [];
    let accountsFlagged = 0;
    let accountsWithOverride = 0;
    let accountsOk = 0;

    // Maximum allowed recipients (7 total)
    const MAX_RECIPIENTS = PRICING.MAX_RECIPIENTS;

    for (const account of accounts) {
      // Get the rate date - use lastRenewalDate if available, otherwise startDate
      const rateDate = account.lastRenewalDate ?? account.startDate;

      // Get rates effective at that date
      const rates = await PricingService.getRatesForDate(rateDate);

      // Analyze recipients for pricing calculation
      const analysis = PricingService.analyzeRecipients(account.recipients);
      // Only adults count toward the max recipient limit (minors don't count)
      const adultRecipientCount = analysis.adultCount;

      if (!rates) {
        // No rates found for this date - this is an error condition
        const { personRecipients, businessRecipients } = getRecipientLists(account.recipients);
        results.push({
          accountId: account.id,
          mailboxId: account.mailbox.id,
          mailboxNumber: account.mailbox.number,
          accountName: getAccountName(account.recipients),
          personRecipients,
          businessRecipients,
          currentRate: parseFloat(account.currentRate.toString()),
          expectedRate: 0,
          discrepancy: parseFloat(account.currentRate.toString()),
          hasOverride: account.rateOverride,
          auditFlag: true,
          auditFlagType: 'UNDERCHARGED',
          auditNote: `No pricing data found for rate date ${rateDate.toISOString().split('T')[0]}`,
          recipientCount: adultRecipientCount,
        });
        accountsFlagged++;

        await prisma.account.update({
          where: { id: account.id },
          data: {
            auditFlag: true,
            auditFlagType: 'UNDERCHARGED',
            auditNote: `No pricing data found for rate date ${rateDate.toISOString().split('T')[0]}`,
            auditedAt: new Date(),
          },
        });
        continue;
      }

      // Calculate expected rate
      const breakdown = PricingService.calculatePriceBreakdown(rates, {
        renewalPeriod: account.renewalPeriod,
        adultRecipientCount: analysis.adultCount,
        minorRecipientCount: analysis.minorCount,
        hasBusinessRecipient: analysis.hasBusinessRecipient,
      });

      const currentRate = parseFloat(account.currentRate.toString());
      const expectedRate = breakdown.totalMonthly;
      const discrepancy = Math.abs(currentRate - expectedRate);

      // Check for recipient overflow (more than MAX_RECIPIENTS adults)
      const hasRecipientOverflow = adultRecipientCount > MAX_RECIPIENTS;

      // Check if there's a significant discrepancy (more than $0.01 tolerance for rounding)
      const hasDiscrepancy = discrepancy > 0.01;

      let auditFlag = false;
      let auditFlagType: AuditFlagType | null = null;
      let auditNote: string | null = null;

      // Recipient overflow takes priority
      if (hasRecipientOverflow) {
        auditFlag = true;
        auditFlagType = 'RECIPIENT_OVERFLOW';
        accountsFlagged++;
        auditNote = `Account has ${adultRecipientCount} adult recipients (max ${MAX_RECIPIENTS}). Expected: $${expectedRate.toFixed(2)}, Current: $${currentRate.toFixed(2)}`;
      } else if (hasDiscrepancy) {
        if (account.rateOverride) {
          // Has manager override - no flag needed
          accountsWithOverride++;
          auditNote = `Rate overridden by ${account.rateOverrideBy?.username ?? 'unknown'}. Expected: $${expectedRate.toFixed(2)}, Current: $${currentRate.toFixed(2)}`;
        } else {
          // No override - flag this account
          auditFlag = true;
          accountsFlagged++;
          // Determine if undercharged or overcharged
          if (currentRate < expectedRate) {
            auditFlagType = 'UNDERCHARGED';
          } else {
            auditFlagType = 'OVERCHARGED';
          }
          auditNote = `Expected: $${expectedRate.toFixed(2)}, Current: $${currentRate.toFixed(2)}. Difference: $${discrepancy.toFixed(2)}`;
        }
      } else {
        accountsOk++;
      }

      const { personRecipients, businessRecipients } = getRecipientLists(account.recipients);
      results.push({
        accountId: account.id,
        mailboxId: account.mailbox.id,
        mailboxNumber: account.mailbox.number,
        accountName: getAccountName(account.recipients),
        personRecipients,
        businessRecipients,
        currentRate,
        expectedRate,
        discrepancy,
        hasOverride: account.rateOverride,
        auditFlag,
        auditFlagType,
        auditNote,
        recipientCount: adultRecipientCount,
      });

      // Update account audit fields in database
      await prisma.account.update({
        where: { id: account.id },
        data: {
          auditFlag,
          auditFlagType,
          auditNote,
          auditedAt: new Date(),
        },
      });
    }

    return {
      totalAccounts: accounts.length,
      accountsAudited: accounts.length,
      accountsFlagged,
      accountsWithOverride,
      accountsOk,
      results,
    };
  },

  /**
   * Get audit summary stats from database
   */
  async getSummary(): Promise<Omit<AuditSummary, 'results'>> {
    const [totalAccounts, accountsFlagged, accountsWithOverride, lastAuditedAccount] = await Promise.all([
      prisma.account.count({
        where: { status: { in: ['ACTIVE', 'HOLD'] } },
      }),
      prisma.account.count({
        where: { auditFlag: true },
      }),
      prisma.account.count({
        where: { rateOverride: true, status: { in: ['ACTIVE', 'HOLD'] } },
      }),
      prisma.account.findFirst({
        where: { auditedAt: { not: null } },
        orderBy: { auditedAt: 'desc' },
        select: { auditedAt: true },
      }),
    ]);

    // If there's no auditedAt timestamp, audit hasn't been run
    const hasBeenAudited = lastAuditedAccount !== null;
    const accountsAudited = hasBeenAudited ? totalAccounts : 0;
    const accountsOk = hasBeenAudited ? totalAccounts - accountsFlagged - accountsWithOverride : 0;

    return {
      totalAccounts,
      accountsAudited,
      accountsFlagged,
      accountsWithOverride,
      accountsOk,
    };
  },

  /**
   * Get all accounts with audit flags
   */
  async getFlaggedAccounts(): Promise<AuditResult[]> {
    const accounts = await prisma.account.findMany({
      where: {
        auditFlag: true,
      },
      include: {
        mailbox: true,
        recipients: {
          where: { removedDate: null },
        },
        rateOverrideBy: {
          select: { username: true },
        },
      },
      orderBy: { mailbox: { number: 'asc' } },
    });

    const results: AuditResult[] = [];

    for (const account of accounts) {
      const rateDate = account.lastRenewalDate ?? account.startDate;
      const rates = await PricingService.getRatesForDate(rateDate);

      let expectedRate = 0;
      let discrepancy = 0;

      const analysis = PricingService.analyzeRecipients(account.recipients);

      if (rates) {
        const breakdown = PricingService.calculatePriceBreakdown(rates, {
          renewalPeriod: account.renewalPeriod,
          adultRecipientCount: analysis.adultCount,
          minorRecipientCount: analysis.minorCount,
          hasBusinessRecipient: analysis.hasBusinessRecipient,
        });
        expectedRate = breakdown.totalMonthly;
        discrepancy = Math.abs(parseFloat(account.currentRate.toString()) - expectedRate);
      }

      const { personRecipients, businessRecipients } = getRecipientLists(account.recipients);
      results.push({
        accountId: account.id,
        mailboxId: account.mailbox.id,
        mailboxNumber: account.mailbox.number,
        accountName: getAccountName(account.recipients),
        personRecipients,
        businessRecipients,
        currentRate: parseFloat(account.currentRate.toString()),
        expectedRate,
        discrepancy,
        hasOverride: account.rateOverride,
        auditFlag: account.auditFlag,
        auditFlagType: account.auditFlagType,
        auditNote: account.auditNote,
        recipientCount: analysis.adultCount, // Only adults count toward limit
      });
    }

    return results;
  },

  /**
   * Get all accounts with rate overrides
   */
  async getAccountsWithOverride(): Promise<AuditResult[]> {
    const accounts = await prisma.account.findMany({
      where: {
        rateOverride: true,
        status: { in: ['ACTIVE', 'HOLD'] },
      },
      include: {
        mailbox: true,
        recipients: {
          where: { removedDate: null },
        },
        rateOverrideBy: {
          select: { username: true },
        },
      },
      orderBy: { mailbox: { number: 'asc' } },
    });

    const results: AuditResult[] = [];

    for (const account of accounts) {
      const rateDate = account.lastRenewalDate ?? account.startDate;
      const rates = await PricingService.getRatesForDate(rateDate);

      let expectedRate = 0;
      let discrepancy = 0;

      const analysis = PricingService.analyzeRecipients(account.recipients);

      if (rates) {
        const breakdown = PricingService.calculatePriceBreakdown(rates, {
          renewalPeriod: account.renewalPeriod,
          adultRecipientCount: analysis.adultCount,
          minorRecipientCount: analysis.minorCount,
          hasBusinessRecipient: analysis.hasBusinessRecipient,
        });
        expectedRate = breakdown.totalMonthly;
        discrepancy = Math.abs(parseFloat(account.currentRate.toString()) - expectedRate);
      }

      const { personRecipients, businessRecipients } = getRecipientLists(account.recipients);
      results.push({
        accountId: account.id,
        mailboxId: account.mailbox.id,
        mailboxNumber: account.mailbox.number,
        accountName: getAccountName(account.recipients),
        personRecipients,
        businessRecipients,
        currentRate: parseFloat(account.currentRate.toString()),
        expectedRate,
        discrepancy,
        hasOverride: true,
        auditFlag: account.auditFlag,
        auditFlagType: account.auditFlagType,
        auditNote: account.rateOverrideReason ?? `Override approved by ${account.rateOverrideBy?.username ?? 'unknown'}`,
        recipientCount: analysis.adultCount, // Only adults count toward limit
      });
    }

    return results;
  },

  /**
   * Set rate override for an account (manager approval)
   */
  async setRateOverride(
    accountId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    await prisma.account.update({
      where: { id: accountId },
      data: {
        rateOverride: true,
        rateOverrideById: userId,
        rateOverrideAt: new Date(),
        rateOverrideReason: reason,
        auditFlag: false, // Clear the audit flag
        auditFlagType: null,
        auditNote: null,
      },
    });
  },

  /**
   * Clear rate override for an account
   */
  async clearRateOverride(accountId: string): Promise<void> {
    await prisma.account.update({
      where: { id: accountId },
      data: {
        rateOverride: false,
        rateOverrideById: null,
        rateOverrideAt: null,
        rateOverrideReason: null,
      },
    });
  },

  /**
   * Clear audit flag for an account (without setting override)
   */
  async clearAuditFlag(accountId: string): Promise<void> {
    await prisma.account.update({
      where: { id: accountId },
      data: {
        auditFlag: false,
        auditFlagType: null,
        auditNote: null,
      },
    });
  },

  /**
   * Clear all audit data (flags, notes, timestamps)
   */
  async clearAllAuditData(): Promise<number> {
    const result = await prisma.account.updateMany({
      data: {
        auditFlag: false,
        auditFlagType: null,
        auditNote: null,
        auditedAt: null,
      },
    });
    return result.count;
  },

  /**
   * Recalculate rates for all active accounts
   * Updates currentRate based on current pricing and recipient composition
   * Returns accounts that were updated
   */
  async recalculateAccountRates(
    autoUpdate: boolean = false
  ): Promise<{
    accountsChecked: number;
    accountsNeedingUpdate: number;
    accountsUpdated: number;
    updates: Array<{
      accountId: string;
      mailboxNumber: number;
      accountName: string;
      oldRate: number;
      newRate: number;
      reason: string;
    }>;
  }> {
    // Fetch all active/hold accounts with their recipients
    const accounts = await prisma.account.findMany({
      where: {
        status: { in: ['ACTIVE', 'HOLD'] },
        rateOverride: false, // Don't touch overridden accounts
      },
      include: {
        mailbox: true,
        recipients: {
          where: { removedDate: null },
        },
      },
      orderBy: { mailbox: { number: 'asc' } },
    });

    const rates = await PricingService.getCurrentRates();
    if (!rates) {
      return {
        accountsChecked: 0,
        accountsNeedingUpdate: 0,
        accountsUpdated: 0,
        updates: [],
      };
    }

    const updates: Array<{
      accountId: string;
      mailboxNumber: number;
      accountName: string;
      oldRate: number;
      newRate: number;
      reason: string;
    }> = [];

    let accountsUpdated = 0;

    for (const account of accounts) {
      const analysis = PricingService.analyzeRecipients(account.recipients);
      const breakdown = PricingService.calculatePriceBreakdown(rates, {
        renewalPeriod: account.renewalPeriod,
        adultRecipientCount: analysis.adultCount,
        minorRecipientCount: analysis.minorCount,
        hasBusinessRecipient: analysis.hasBusinessRecipient,
      });

      const currentRate = parseFloat(account.currentRate.toString());
      const expectedRate = breakdown.totalMonthly;
      const discrepancy = Math.abs(currentRate - expectedRate);

      // Only consider updates where there's a significant difference
      if (discrepancy > 0.01) {
        const reason = currentRate < expectedRate
          ? 'Rate increase due to recipient changes (minor turned 18 or recipient added)'
          : 'Rate decrease due to recipient changes';

        updates.push({
          accountId: account.id,
          mailboxNumber: account.mailbox.number,
          accountName: getAccountName(account.recipients),
          oldRate: currentRate,
          newRate: expectedRate,
          reason,
        });

        if (autoUpdate) {
          await prisma.account.update({
            where: { id: account.id },
            data: {
              currentRate: expectedRate,
              auditNote: `Rate auto-updated from $${currentRate.toFixed(2)} to $${expectedRate.toFixed(2)}: ${reason}`,
              auditedAt: new Date(),
            },
          });
          accountsUpdated++;
        }
      }
    }

    return {
      accountsChecked: accounts.length,
      accountsNeedingUpdate: updates.length,
      accountsUpdated,
      updates,
    };
  },
};

interface RecipientData {
  isPrimary: boolean;
  firstName: string | null;
  middleName?: string | null;
  lastName: string | null;
  personAlias?: string | null;
  birthdate: Date | null;
  businessName: string | null;
  businessAlias?: string | null;
  recipientType: string;
}

/**
 * Helper to get account holder name from recipients
 */
function getAccountName(recipients: RecipientData[]): string {
  const primary = recipients.find((r) => r.isPrimary) ?? recipients[0];
  if (!primary) return 'Unknown';

  if (primary.recipientType === 'BUSINESS') {
    return primary.businessName ?? 'Unknown Business';
  }

  return [primary.firstName, primary.lastName].filter(Boolean).join(' ') || 'Unknown';
}

/**
 * Helper to get recipient lists for display
 */
function getRecipientLists(recipients: RecipientData[]): {
  personRecipients: PersonRecipient[];
  businessRecipients: BusinessRecipient[];
} {
  const personRecipients = recipients
    .filter((r) => r.recipientType === 'PERSON')
    .map((r) => ({
      name: formatRecipientName(r),
      age: r.birthdate ? calculateAge(r.birthdate) : null,
      isMinor: r.birthdate ? isMinor(r.birthdate) : false,
    }));

  const businessRecipients = recipients
    .filter((r) => r.recipientType === 'BUSINESS')
    .map((r) => ({
      name: r.businessName ?? 'Unknown Business',
      alias: r.businessAlias ?? null,
    }));

  return { personRecipients, businessRecipients };
}
