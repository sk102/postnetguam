import { NextRequest } from 'next/server';
import { requireManager } from '@/lib/auth/authorize';
import {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  internalErrorResponse,
} from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { updatePricingSchema } from '@/lib/validations/pricing';
import { PricingService } from '@/lib/services/pricing.service';
import { PRICING } from '@/constants/app';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/pricing/[id]
 * Delete a pricing configuration (MANAGER only, only if start date is in the future)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const authError = await requireManager();
  if (authError) return authError;

  try {
    const { id } = await params;

    // Find the pricing configuration
    const priceConfig = await prisma.rateHistory.findUnique({
      where: { id },
    });

    if (!priceConfig) {
      return notFoundResponse('Pricing configuration');
    }

    // Check if start date is in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(priceConfig.startDate);
    startDate.setHours(0, 0, 0, 0);

    if (startDate <= today) {
      return badRequestResponse(
        'Cannot delete pricing configuration that has already started or is current'
      );
    }

    // If this is the current rate (endDate is null), we need to restore the previous rate
    if (priceConfig.endDate === null) {
      // Find the previous rate that was closed out when this one was created
      const previousRate = await prisma.rateHistory.findFirst({
        where: {
          id: { not: id },
        },
        orderBy: { startDate: 'desc' },
      });

      if (previousRate) {
        // Re-open the previous rate by setting its endDate to null
        await prisma.rateHistory.update({
          where: { id: previousRate.id },
          data: { endDate: null },
        });
      }
    }

    // Delete the pricing configuration
    await prisma.rateHistory.delete({
      where: { id },
    });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('Pricing DELETE error:', error);
    return internalErrorResponse('Failed to delete pricing configuration');
  }
}

/**
 * PUT /api/pricing/[id]
 * Update a pricing configuration (MANAGER only, only if start date is in the future)
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const authError = await requireManager();
  if (authError) return authError;

  try {
    const { id } = await params;
    const body: unknown = await request.json();

    // Validate input
    const validationResult = updatePricingSchema.safeParse(body);
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

    // Find the pricing configuration
    const priceConfig = await prisma.rateHistory.findUnique({
      where: { id },
    });

    if (!priceConfig) {
      return notFoundResponse('Pricing configuration');
    }

    // Check if start date is in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(priceConfig.startDate);
    startDate.setHours(0, 0, 0, 0);

    if (startDate <= today) {
      return badRequestResponse(
        'Cannot edit pricing configuration that has already started or is current'
      );
    }

    // Calculate period rates from monthly rate
    const baseMonthlyRate = input.baseMonthlyRate;
    const baseRate3mo = baseMonthlyRate * PRICING.PERIOD_MONTHS.THREE_MONTH;
    const baseRate6mo = baseMonthlyRate * PRICING.PERIOD_MONTHS.SIX_MONTH;
    const baseRate12mo = baseMonthlyRate * PRICING.PERIOD_MONTHS.TWELVE_MONTH;

    const newStartDate = new Date(input.startDate);

    // Update the pricing configuration
    const updatedConfig = await prisma.rateHistory.update({
      where: { id },
      data: {
        startDate: newStartDate,
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
      },
    });

    return successResponse(PricingService.serializePriceConfig(updatedConfig));
  } catch (error) {
    console.error('Pricing PUT error:', error);
    return internalErrorResponse('Failed to update pricing configuration');
  }
}
