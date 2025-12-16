import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/authorize';
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/api/response';
import { PaymentService } from '@/lib/services/payment.service';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/accounts/[id]/payments
 * Get payment history for a specific account
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { id } = await params;

    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!account) {
      return notFoundResponse('Account');
    }

    const payments = await PaymentService.getAccountPayments(id);
    return successResponse(payments);
  } catch (error) {
    console.error('Account payments GET error:', error);
    return internalErrorResponse('Failed to fetch payment history');
  }
}
