import { NextRequest } from 'next/server';
import { requireAuth, requireManager, getCurrentUser } from '@/lib/auth/authorize';
import {
  successResponse,
  badRequestResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { PricingService } from '@/lib/services/pricing.service';
import { createPricingSchema } from '@/lib/validations/pricing';
import { PRICING } from '@/constants/app';

/**
 * GET /api/pricing
 * Get current effective pricing configuration
 */
export async function GET(): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const currentRates = await PricingService.getCurrentRates();

    if (!currentRates) {
      return notFoundResponse('Pricing configuration');
    }

    // Cache pricing for 5 minutes (rarely changes)
    return successResponse(
      PricingService.serializePriceConfig(currentRates),
      200,
      { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' }
    );
  } catch (error) {
    console.error('Pricing API GET error:', error);
    return internalErrorResponse('Failed to fetch pricing');
  }
}

/**
 * POST /api/pricing
 * Create a new pricing configuration (MANAGER only)
 */
export async function POST(request: NextRequest): Promise<Response> {
  const authError = await requireManager();
  if (authError) return authError;

  try {
    const user = await getCurrentUser();
    const body: unknown = await request.json();

    // Validate input
    const validationResult = createPricingSchema.safeParse(body);
    if (!validationResult.success) {
      return badRequestResponse(
        'Invalid pricing data',
        validationResult.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }))
      );
    }

    const input = validationResult.data;

    // Calculate period rates from monthly rate
    const baseMonthlyRate = input.baseMonthlyRate;
    const baseRate3mo = baseMonthlyRate * PRICING.PERIOD_MONTHS.THREE_MONTH;
    const baseRate6mo = baseMonthlyRate * PRICING.PERIOD_MONTHS.SIX_MONTH;
    const baseRate12mo = baseMonthlyRate * PRICING.PERIOD_MONTHS.TWELVE_MONTH;

    const newStartDate = new Date(input.startDate);

    // Close out the current rate by setting its endDate to the day before the new rate starts
    const currentRate = await prisma.rateHistory.findFirst({
      where: { endDate: null },
      orderBy: { startDate: 'desc' },
    });

    if (currentRate) {
      const endDate = new Date(newStartDate);
      endDate.setDate(endDate.getDate() - 1);
      await prisma.rateHistory.update({
        where: { id: currentRate.id },
        data: { endDate },
      });
    }

    // Create the new pricing configuration
    const newConfig = await prisma.rateHistory.create({
      data: {
        startDate: newStartDate,
        endDate: null, // Current effective rate
        baseRate3mo,
        baseRate6mo,
        baseRate12mo,
        rate4thAdult: input.rate4thAdult,
        rate5thAdult: input.rate5thAdult,
        rate6thAdult: input.rate6thAdult,
        rate7thAdult: input.rate7thAdult,
        businessAccountFee: input.businessAccountFee,
        minorRecipientFee: input.minorRecipientFee,
        keyDeposit: input.keyDeposit,
        notes: input.notes ?? null,
        createdById: user?.id ?? null,
      },
    });

    return successResponse(PricingService.serializePriceConfig(newConfig), 201);
  } catch (error) {
    console.error('Pricing API POST error:', error);
    return internalErrorResponse('Failed to create pricing configuration');
  }
}
