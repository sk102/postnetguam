import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/authorize';
import {
  successResponse,
  badRequestResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api/response';
import { PricingService } from '@/lib/services/pricing.service';
import { calculatePricingSchema } from '@/lib/validations/pricing';

/**
 * POST /api/pricing/calculate
 * Calculate price breakdown for given parameters
 */
export async function POST(request: NextRequest): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body: unknown = await request.json();

    // Validate input
    const validationResult = calculatePricingSchema.safeParse(body);
    if (!validationResult.success) {
      return badRequestResponse(
        'Invalid calculation input',
        validationResult.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }))
      );
    }

    const input = validationResult.data;

    // Get current rates
    const currentRates = await PricingService.getCurrentRates();
    if (!currentRates) {
      return notFoundResponse('Pricing configuration');
    }

    // Calculate breakdown
    const breakdown = PricingService.calculatePriceBreakdown(currentRates, {
      renewalPeriod: input.renewalPeriod,
      adultRecipientCount: input.adultRecipientCount,
      minorRecipientCount: input.minorRecipientCount,
      hasBusinessRecipient: input.hasBusinessRecipient,
    });

    return successResponse(breakdown);
  } catch (error) {
    console.error('Pricing calculate API error:', error);
    return internalErrorResponse('Failed to calculate pricing');
  }
}
