import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/authorize';
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/api/response';
import { InvoiceService } from '@/lib/services/invoice.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/invoices/[id]
 * Get invoice details with line items and payments
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { id } = await params;

    const invoice = await InvoiceService.getInvoice(id);

    if (!invoice) {
      return notFoundResponse('Invoice not found');
    }

    return successResponse(invoice);
  } catch (error) {
    console.error('Failed to get invoice:', error);
    return internalErrorResponse('Failed to get invoice');
  }
}
