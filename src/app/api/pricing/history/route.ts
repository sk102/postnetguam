import { NextRequest } from 'next/server';
import { requireManager } from '@/lib/auth/authorize';
import { paginatedResponse, internalErrorResponse } from '@/lib/api/response';
import { PricingService } from '@/lib/services/pricing.service';
import { PAGINATION } from '@/constants/app';

/**
 * GET /api/pricing/history
 * Get paginated pricing history (MANAGER only)
 */
export async function GET(request: NextRequest): Promise<Response> {
  const authError = await requireManager();
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(
      PAGINATION.MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('limit') ?? String(PAGINATION.DEFAULT_PAGE_SIZE), 10))
    );

    const { data, total } = await PricingService.getRateHistory(page, limit);

    const serializedData = data.map((config) => PricingService.serializePriceConfig(config));

    return paginatedResponse(serializedData, {
      page,
      pageSize: limit,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Pricing history API error:', error);
    return internalErrorResponse('Failed to fetch pricing history');
  }
}
