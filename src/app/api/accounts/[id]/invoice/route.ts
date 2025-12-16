import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/authorize';
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { PricingService } from '@/lib/services/pricing.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Format renewal period as a label
 */
function formatPeriodLabel(period: string): string {
  switch (period) {
    case 'THREE_MONTH':
      return '3 Month';
    case 'SIX_MONTH':
      return '6 Month';
    case 'TWELVE_MONTH':
      return '12 Month';
    default:
      return '3 Month';
  }
}

/**
 * Calculate the end date for a renewal period
 */
function calculateRenewalEndDate(startDate: Date, renewalPeriod: string): Date {
  const endDate = new Date(startDate);
  switch (renewalPeriod) {
    case 'THREE_MONTH':
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    case 'SIX_MONTH':
      endDate.setMonth(endDate.getMonth() + 6);
      break;
    case 'TWELVE_MONTH':
      endDate.setMonth(endDate.getMonth() + 13); // 12 + 1 free month
      break;
    default:
      endDate.setMonth(endDate.getMonth() + 3);
  }
  return endDate;
}

/**
 * GET /api/accounts/[id]/invoice
 * Get invoice information for recording a payment
 * Query params:
 *   - renewal=true: Get invoice for renewal (next term with current pricing)
 *   - period=THREE_MONTH|SIX_MONTH|TWELVE_MONTH: Override renewal period (only for renewal mode)
 *   - paymentDate=YYYY-MM-DD: Date of payment (determines which rates apply for renewal)
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const isRenewal = searchParams.get('renewal') === 'true';
    const periodOverride = searchParams.get('period'); // Optional period override for renewal
    const paymentDateStr = searchParams.get('paymentDate'); // Optional payment date for rate lookup

    // Get account with mailbox and recipients
    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        mailbox: true,
        recipients: true,
      },
    });

    if (!account) {
      return notFoundResponse('Account not found');
    }

    // Get recipient name (primary recipient)
    const primaryRecipient = account.recipients.find(r => r.isPrimary);
    let recipientName = 'Unknown';
    if (primaryRecipient) {
      if (primaryRecipient.recipientType === 'BUSINESS') {
        recipientName = primaryRecipient.businessAlias ?? primaryRecipient.businessName ?? 'Unknown Business';
      } else {
        const nameParts = [
          primaryRecipient.firstName,
          primaryRecipient.middleName,
          primaryRecipient.lastName,
        ].filter(Boolean);
        recipientName = nameParts.join(' ') || 'Unknown Person';
      }
    }

    if (isRenewal) {
      // RENEWAL MODE: First check if there's an existing unpaid RENEWAL invoice
      const existingRenewalInvoice = await prisma.invoice.findFirst({
        where: {
          accountId: id,
          invoiceType: 'RENEWAL',
          status: { in: ['PENDING', 'PARTIAL'] },
        },
        include: {
          lineItems: { orderBy: { sortOrder: 'asc' } },
          payments: { select: { amount: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // If there's an existing unpaid renewal invoice and period matches (or no override), use it
      const periodMatches = !periodOverride || periodOverride === existingRenewalInvoice?.renewalPeriod;
      if (existingRenewalInvoice && periodMatches) {
        const totalPayments = existingRenewalInvoice.payments.reduce(
          (sum, p) => sum + Number(p.amount),
          0
        );

        const lineItems = existingRenewalInvoice.lineItems.map(item => ({
          description: item.description,
          unitPrice: Number(item.unitPrice),
          months: Number(item.months),
          total: Number(item.totalAmount),
        }));

        return successResponse({
          mailboxNumber: account.mailbox.number,
          recipientName,
          renewalPeriod: existingRenewalInvoice.renewalPeriod,
          currentRate: Number(existingRenewalInvoice.totalAmount) / existingRenewalInvoice.periodMonths,
          startDate: existingRenewalInvoice.periodStart.toISOString(),
          nextRenewalDate: existingRenewalInvoice.periodEnd.toISOString(),
          totalPayments,
          isRenewal: true,
          lineItems,
          invoiceId: existingRenewalInvoice.id,
        });
      }

      // No existing invoice or period is being changed - calculate new rates
      const renewalStartDate = account.nextRenewalDate;

      // Use period override if provided, otherwise use account's current period
      const validPeriods = ['THREE_MONTH', 'SIX_MONTH', 'TWELVE_MONTH'];
      const renewalPeriod = periodOverride && validPeriods.includes(periodOverride)
        ? periodOverride
        : account.renewalPeriod;

      const renewalEndDate = calculateRenewalEndDate(renewalStartDate, renewalPeriod);

      // Determine which date to use for rate lookup:
      // If payment date is provided, use it; otherwise use renewal start date
      const rateLookupDate = paymentDateStr
        ? new Date(paymentDateStr)
        : renewalStartDate;

      // Get rates that will be effective on the payment/renewal date
      const ratesForRenewal = await PricingService.getRatesForDate(rateLookupDate);
      if (!ratesForRenewal) {
        return internalErrorResponse('No pricing rates configured for renewal date');
      }

      // Analyze recipients to calculate fees
      const recipientAnalysis = PricingService.analyzeRecipients(account.recipients);

      // Calculate price breakdown with rates effective on renewal date
      const priceBreakdown = PricingService.calculatePriceBreakdown(ratesForRenewal, {
        renewalPeriod: renewalPeriod as 'THREE_MONTH' | 'SIX_MONTH' | 'TWELVE_MONTH',
        adultRecipientCount: recipientAnalysis.adultCount,
        minorRecipientCount: recipientAnalysis.minorCount,
        hasBusinessRecipient: recipientAnalysis.hasBusinessRecipient,
      });

      // Build line items for display
      const lineItems: Array<{ description: string; unitPrice: number; months: number; total: number }> = [];
      const months = priceBreakdown.periodMonths;
      const baseRateMonthly = priceBreakdown.baseRate / months;

      // Base rate
      lineItems.push({
        description: `Base Rate (${formatPeriodLabel(renewalPeriod)})`,
        unitPrice: baseRateMonthly,
        months,
        total: priceBreakdown.baseRate,
      });

      // Business fee
      if (priceBreakdown.businessFee > 0) {
        lineItems.push({
          description: 'Business Account Fee',
          unitPrice: Number(ratesForRenewal.businessAccountFee),
          months,
          total: priceBreakdown.businessFee,
        });
      }

      // Additional recipient fees (4th-7th)
      const additionalAdults = Math.max(0, recipientAnalysis.adultCount - 3);
      const additionalFees = [
        { label: '4th Recipient Fee', rate: Number(ratesForRenewal.rate4thAdult) },
        { label: '5th Recipient Fee', rate: Number(ratesForRenewal.rate5thAdult) },
        { label: '6th Recipient Fee', rate: Number(ratesForRenewal.rate6thAdult) },
        { label: '7th Recipient Fee', rate: Number(ratesForRenewal.rate7thAdult) },
      ];

      for (let i = 0; i < Math.min(additionalAdults, 4); i++) {
        const fee = additionalFees[i];
        if (fee && fee.rate > 0) {
          lineItems.push({
            description: fee.label,
            unitPrice: fee.rate,
            months,
            total: fee.rate * months,
          });
        }
      }

      // Minor fees
      if (priceBreakdown.minorFees > 0) {
        const minorFeeMonthly = Number(ratesForRenewal.minorRecipientFee);
        lineItems.push({
          description: `Minor Recipient Fee${recipientAnalysis.minorCount > 1 ? ` (×${recipientAnalysis.minorCount})` : ''}`,
          unitPrice: minorFeeMonthly * recipientAnalysis.minorCount,
          months,
          total: priceBreakdown.minorFees,
        });
      }

      // No payments for the renewal term yet
      const totalPayments = 0;

      return successResponse({
        mailboxNumber: account.mailbox.number,
        recipientName,
        renewalPeriod: renewalPeriod, // Return the selected period, not account's default
        currentRate: priceBreakdown.totalMonthly,
        startDate: renewalStartDate.toISOString(),
        nextRenewalDate: renewalEndDate.toISOString(),
        totalPayments,
        isRenewal: true,
        lineItems,
      });
    } else {
      // CURRENT TERM MODE: Use account's stored rate
      // Try to get line items from the existing NEW_ACCOUNT or RENEWAL invoice for this term
      const existingInvoice = await prisma.invoice.findFirst({
        where: {
          accountId: id,
          invoiceType: { in: ['NEW_ACCOUNT', 'RENEWAL'] },
          periodEnd: account.nextRenewalDate,
        },
        include: {
          lineItems: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Also fetch any unpaid PRORATION invoices for this term (limit to one per term)
      const prorationInvoice = await prisma.invoice.findFirst({
        where: {
          accountId: id,
          invoiceType: 'PRORATION',
          status: { in: ['PENDING', 'PARTIAL'] },
          periodEnd: account.nextRenewalDate,
        },
        include: {
          lineItems: { orderBy: { sortOrder: 'asc' } },
          payments: { select: { amount: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Calculate total payments for current term
      const paymentsInTerm = await prisma.payment.findMany({
        where: {
          accountId: id,
          periodStart: {
            gte: account.startDate,
          },
          periodEnd: {
            lte: account.nextRenewalDate,
          },
        },
        select: {
          amount: true,
        },
      });

      const totalPayments = paymentsInTerm.reduce(
        (sum: number, p: { amount: unknown }) => sum + Number(p.amount),
        0
      );

      // Build line items from existing invoice or create simple breakdown
      let lineItems: Array<{ description: string; unitPrice: number; months: number; total: number }> = [];

      if (existingInvoice && existingInvoice.lineItems.length > 0) {
        lineItems = existingInvoice.lineItems.map(item => ({
          description: item.description,
          unitPrice: Number(item.unitPrice),
          months: Number(item.months),
          total: Number(item.totalAmount),
        }));
      } else {
        // Fallback: simple breakdown using stored rate
        const months = account.renewalPeriod === 'THREE_MONTH' ? 3 : account.renewalPeriod === 'SIX_MONTH' ? 6 : 12;
        const rate = Number(account.currentRate);
        lineItems.push({
          description: `Monthly Rate (${formatPeriodLabel(account.renewalPeriod)})`,
          unitPrice: rate,
          months,
          total: rate * months,
        });
      }

      // Add proration line items and calculate proration payments
      let prorationPayments = 0;
      if (prorationInvoice) {
        // Add proration line items
        for (const item of prorationInvoice.lineItems) {
          lineItems.push({
            description: item.description,
            unitPrice: Number(item.unitPrice),
            months: Number(item.months),
            total: Number(item.totalAmount),
          });
        }
        // Sum payments made against proration invoice
        prorationPayments = prorationInvoice.payments.reduce(
          (sum, p) => sum + Number(p.amount),
          0
        );
      }

      // Total charge includes proration
      const totalCharge = lineItems.reduce((sum, item) => sum + item.total, 0);
      // Combined payments from term payments and proration payments
      const combinedPayments = totalPayments + prorationPayments;

      return successResponse({
        mailboxNumber: account.mailbox.number,
        recipientName,
        renewalPeriod: account.renewalPeriod,
        currentRate: totalCharge / (account.renewalPeriod === 'THREE_MONTH' ? 3 : account.renewalPeriod === 'SIX_MONTH' ? 6 : 12),
        startDate: account.startDate.toISOString(),
        nextRenewalDate: account.nextRenewalDate.toISOString(),
        totalPayments: combinedPayments,
        isRenewal: false,
        lineItems,
      });
    }
  } catch (error) {
    console.error('Failed to get account invoice:', error);
    return internalErrorResponse('Failed to get account invoice');
  }
}
