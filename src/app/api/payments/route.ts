import { NextRequest } from 'next/server';
import { requireAuth, getCurrentUser } from '@/lib/auth/authorize';
import {
  successResponse,
  badRequestResponse,
  internalErrorResponse,
  paginatedResponse,
} from '@/lib/api/response';
import { PaymentService } from '@/lib/services/payment.service';
import { InvoiceService } from '@/lib/services/invoice.service';
import { PricingService } from '@/lib/services/pricing.service';
import { createPaymentSchema, paymentListQuerySchema } from '@/lib/validations/payment';
import { prisma } from '@/lib/db/prisma';
import type { RenewalPeriod } from '@prisma/client';

/**
 * GET /api/payments
 * List payments with filtering and pagination
 */
export async function GET(request: NextRequest): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const queryResult = paymentListQuerySchema.safeParse({
      accountId: searchParams.get('accountId') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      paymentMethod: searchParams.get('paymentMethod') ?? undefined,
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
      sortField: searchParams.get('sortField') ?? 'paymentDate',
      sortOrder: searchParams.get('sortOrder') ?? 'desc',
    });

    if (!queryResult.success) {
      return badRequestResponse(
        'Invalid query parameters',
        queryResult.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }))
      );
    }

    const result = await PaymentService.getPayments(queryResult.data);
    return paginatedResponse(result.data, result.pagination);
  } catch (error) {
    console.error('Payments GET error:', error);
    return internalErrorResponse('Failed to fetch payments');
  }
}

/**
 * POST /api/payments
 * Record a new payment
 */
export async function POST(request: NextRequest): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return badRequestResponse('User not found');
    }

    const body: unknown = await request.json();
    const validationResult = createPaymentSchema.safeParse(body);

    if (!validationResult.success) {
      return badRequestResponse(
        'Invalid payment data',
        validationResult.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }))
      );
    }

    const paymentData = validationResult.data;

    // For renewal payments without an invoiceId, create a RENEWAL invoice
    if (paymentData.isRenewal && !paymentData.invoiceId && paymentData.renewalPeriod && paymentData.newRate !== undefined) {
      const account = await prisma.account.findUnique({
        where: { id: paymentData.accountId },
        include: {
          recipients: {
            where: { removedDate: null },
            select: { recipientType: true, birthdate: true },
          },
        },
      });

      if (account) {
        const paymentDate = new Date(paymentData.paymentDate);
        const rates = await PricingService.getRatesForDate(paymentDate);

        if (rates) {
          // Analyze recipients to get counts
          const recipientAnalysis = PricingService.analyzeRecipients(account.recipients);

          // Calculate price breakdown
          const priceBreakdown = PricingService.calculatePriceBreakdown(rates, {
            renewalPeriod: paymentData.renewalPeriod as RenewalPeriod,
            adultRecipientCount: recipientAnalysis.adultCount,
            minorRecipientCount: recipientAnalysis.minorCount,
            hasBusinessRecipient: recipientAnalysis.hasBusinessRecipient,
          });

          // Create the RENEWAL invoice
          const invoice = await InvoiceService.createInvoiceFromBreakdown(
            paymentData.accountId,
            'RENEWAL',
            priceBreakdown,
            {
              invoiceDate: paymentDate,
              periodStart: new Date(paymentData.periodStart),
              periodEnd: new Date(paymentData.periodEnd),
              renewalPeriod: paymentData.renewalPeriod as RenewalPeriod,
            },
            {
              baseRateMonthly: paymentData.newRate,
              businessFeeMonthly: Number(rates.businessAccountFee),
              rate4thAdult: Number(rates.rate4thAdult),
              rate5thAdult: Number(rates.rate5thAdult),
              rate6thAdult: Number(rates.rate6thAdult),
              rate7thAdult: Number(rates.rate7thAdult),
              minorFeeMonthly: Number(rates.minorRecipientFee),
            },
            recipientAnalysis,
            user.id
          );

          // Link the payment to the invoice
          paymentData.invoiceId = invoice.id;
        }
      }
    }

    const result = await PaymentService.createPayment(paymentData, user.id);
    return successResponse(result, 201);
  } catch (error) {
    console.error('Payments POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create payment';
    return internalErrorResponse(message);
  }
}
