import { NextRequest } from 'next/server';
import { requireAuth, getCurrentUser } from '@/lib/auth/authorize';
import { successResponse, notFoundResponse, badRequestResponse, internalErrorResponse } from '@/lib/api/response';
import { InvoiceService } from '@/lib/services/invoice.service';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/accounts/[id]/invoices
 * Get all invoices for an account
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
      return notFoundResponse('Account not found');
    }

    const invoices = await InvoiceService.getAccountInvoices(id);

    return successResponse({ invoices });
  } catch (error) {
    console.error('Failed to get account invoices:', error);
    return internalErrorResponse('Failed to get account invoices');
  }
}

/**
 * POST /api/accounts/[id]/invoices
 * Create a new invoice for an account (manual creation)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { id: accountId } = await params;
    const user = await getCurrentUser();
    const userId = user?.id ?? null;

    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true },
    });

    if (!account) {
      return notFoundResponse('Account not found');
    }

    const body = await request.json() as {
      invoiceDate?: string;
      invoiceType?: string;
      renewalPeriod?: string;
      periodStart?: string;
      periodEnd?: string;
      periodMonths?: number;
      lineItems?: Array<{
        lineType: string;
        description: string;
        quantity?: number;
        unitPrice: number;
        months: number;
        sortOrder?: number;
      }>;
      notes?: string;
    };

    // Validate required fields
    if (!body.invoiceType || !body.renewalPeriod || !body.periodStart || !body.periodEnd || !body.lineItems) {
      return badRequestResponse('Missing required fields');
    }

    const validInvoiceTypes = ['NEW_ACCOUNT', 'RENEWAL', 'PRORATION'];
    if (!validInvoiceTypes.includes(body.invoiceType)) {
      return badRequestResponse('Invalid invoice type');
    }

    const validPeriods = ['THREE_MONTH', 'SIX_MONTH', 'TWELVE_MONTH'];
    if (!validPeriods.includes(body.renewalPeriod)) {
      return badRequestResponse('Invalid renewal period');
    }

    const invoice = await InvoiceService.createInvoice(
      {
        accountId,
        invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : new Date(),
        invoiceType: body.invoiceType as 'NEW_ACCOUNT' | 'RENEWAL' | 'PRORATION',
        renewalPeriod: body.renewalPeriod as 'THREE_MONTH' | 'SIX_MONTH' | 'TWELVE_MONTH',
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        periodMonths: body.periodMonths ?? 3,
        lineItems: body.lineItems.map((item) => ({
          lineType: item.lineType as 'BASE_RATE' | 'BUSINESS_FEE' | 'ADDITIONAL_RECIPIENT_4TH' | 'ADDITIONAL_RECIPIENT_5TH' | 'ADDITIONAL_RECIPIENT_6TH' | 'ADDITIONAL_RECIPIENT_7TH' | 'MINOR_FEE',
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          months: item.months,
          sortOrder: item.sortOrder,
        })),
        notes: body.notes,
      },
      userId
    );

    return successResponse({ invoice }, 201);
  } catch (error) {
    console.error('Failed to create invoice:', error);
    return internalErrorResponse('Failed to create invoice');
  }
}
