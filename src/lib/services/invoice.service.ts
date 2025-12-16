import { prisma } from '@/lib/db/prisma';
import type { Prisma, InvoiceType, InvoiceStatus, RenewalPeriod } from '@prisma/client';
import type {
  InvoiceWithDetails,
  SerializedInvoice,
  SerializedInvoiceLineItem,
  SerializedInvoicePayment,
  CreateInvoiceInput,
  CreateInvoiceLineItemInput,
} from '@/types/invoice';
import type { PriceBreakdown } from '@/types/pricing';

/**
 * Convert Prisma Decimal to number
 */
function decimalToNumber(decimal: Prisma.Decimal): number {
  return parseFloat(decimal.toString());
}

/**
 * Format date to YYYY-MM-DD string
 */
function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0] ?? date.toISOString();
}

/**
 * Determine invoice status based on paid amount
 */
function calculateInvoiceStatus(totalAmount: number, paidAmount: number): InvoiceStatus {
  if (paidAmount <= 0) return 'PENDING';
  if (paidAmount >= totalAmount) return 'PAID';
  return 'PARTIAL';
}

/**
 * Service for managing invoices
 */
export const InvoiceService = {
  /**
   * Create an invoice with line items
   */
  async createInvoice(
    input: CreateInvoiceInput,
    userId: string | null
  ): Promise<SerializedInvoice> {
    // Calculate totals
    const lineItemsWithTotals = input.lineItems.map((item, index) => ({
      ...item,
      totalAmount: item.unitPrice * item.months * (item.quantity ?? 1),
      sortOrder: item.sortOrder ?? index,
    }));

    const subtotal = lineItemsWithTotals.reduce((sum, item) => sum + item.totalAmount, 0);
    const totalAmount = subtotal;

    const invoice = await prisma.invoice.create({
      data: {
        accountId: input.accountId,
        invoiceDate: input.invoiceDate,
        invoiceType: input.invoiceType,
        renewalPeriod: input.renewalPeriod,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        periodMonths: input.periodMonths,
        subtotal,
        totalAmount,
        paidAmount: 0,
        status: 'PENDING',
        createdById: userId,
        notes: input.notes ?? null,
        lineItems: {
          create: lineItemsWithTotals.map((item) => ({
            lineType: item.lineType,
            description: item.description,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice,
            months: item.months,
            totalAmount: item.totalAmount,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        payments: {
          include: {
            recordedByUser: {
              select: { id: true, username: true, firstName: true, lastName: true },
            },
          },
        },
        createdBy: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
    });

    return this.serializeInvoice(invoice);
  },

  /**
   * Create an invoice from a PriceBreakdown
   */
  async createInvoiceFromBreakdown(
    accountId: string,
    invoiceType: InvoiceType,
    breakdown: PriceBreakdown,
    periodInfo: {
      invoiceDate: Date;
      periodStart: Date;
      periodEnd: Date;
      renewalPeriod: RenewalPeriod;
    },
    rates: {
      baseRateMonthly: number;
      businessFeeMonthly: number;
      rate4thAdult: number;
      rate5thAdult: number;
      rate6thAdult: number;
      rate7thAdult: number;
      minorFeeMonthly: number;
    },
    recipientCounts: {
      adultCount: number;
      minorCount: number;
      hasBusinessRecipient: boolean;
    },
    userId: string | null
  ): Promise<SerializedInvoice> {
    const lineItems: CreateInvoiceLineItemInput[] = [];
    const months = breakdown.periodMonths;

    // Always add base rate
    lineItems.push({
      lineType: 'BASE_RATE',
      description: `Base Rate (${this.formatPeriodLabel(periodInfo.renewalPeriod)})`,
      unitPrice: rates.baseRateMonthly,
      months,
      sortOrder: 0,
    });

    // Add business fee if applicable
    if (recipientCounts.hasBusinessRecipient && breakdown.businessFee > 0) {
      lineItems.push({
        lineType: 'BUSINESS_FEE',
        description: 'Business Account Fee',
        unitPrice: rates.businessFeeMonthly,
        months,
        sortOrder: 1,
      });
    }

    // Add additional recipient fees (4th-7th)
    const additionalAdults = Math.max(0, recipientCounts.adultCount - 3);
    const additionalFees = [
      { type: 'ADDITIONAL_RECIPIENT_4TH' as const, rate: rates.rate4thAdult, label: '4th Recipient Fee' },
      { type: 'ADDITIONAL_RECIPIENT_5TH' as const, rate: rates.rate5thAdult, label: '5th Recipient Fee' },
      { type: 'ADDITIONAL_RECIPIENT_6TH' as const, rate: rates.rate6thAdult, label: '6th Recipient Fee' },
      { type: 'ADDITIONAL_RECIPIENT_7TH' as const, rate: rates.rate7thAdult, label: '7th Recipient Fee' },
    ];

    for (let i = 0; i < Math.min(additionalAdults, 4); i++) {
      const fee = additionalFees[i];
      if (fee && fee.rate > 0) {
        lineItems.push({
          lineType: fee.type,
          description: fee.label,
          unitPrice: fee.rate,
          months,
          sortOrder: 2 + i,
        });
      }
    }

    // Add minor fees if applicable
    if (recipientCounts.minorCount > 0 && breakdown.minorFees > 0) {
      lineItems.push({
        lineType: 'MINOR_FEE',
        description: `Minor Recipient Fee${recipientCounts.minorCount > 1 ? ` (${recipientCounts.minorCount})` : ''}`,
        quantity: recipientCounts.minorCount,
        unitPrice: rates.minorFeeMonthly,
        months,
        sortOrder: 10,
      });
    }

    return this.createInvoice(
      {
        accountId,
        invoiceDate: periodInfo.invoiceDate,
        invoiceType,
        renewalPeriod: periodInfo.renewalPeriod,
        periodStart: periodInfo.periodStart,
        periodEnd: periodInfo.periodEnd,
        periodMonths: months,
        lineItems,
      },
      userId
    );
  },

  /**
   * Create a prorated invoice when mid-term changes increase the rate
   * This creates itemized line items for each fee that was added
   */
  async createProrationInvoice(
    accountId: string,
    _periodStart: Date,
    periodEnd: Date,
    renewalPeriod: RenewalPeriod,
    addedFees: Array<{
      lineType: CreateInvoiceLineItemInput['lineType'];
      description: string;
      monthlyRate: number;
    }>,
    userId: string | null
  ): Promise<SerializedInvoice> {
    // Calculate prorated months remaining
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / msPerDay));
    const proratedMonths = Math.round((daysRemaining / 30) * 100) / 100; // Round to 2 decimal places

    const lineItems: CreateInvoiceLineItemInput[] = addedFees.map((fee, index) => ({
      lineType: fee.lineType,
      description: `${fee.description} (Prorated)`,
      unitPrice: fee.monthlyRate,
      months: proratedMonths,
      sortOrder: index,
    }));

    return this.createInvoice(
      {
        accountId,
        invoiceDate: now,
        invoiceType: 'PRORATION',
        renewalPeriod,
        periodStart: now,
        periodEnd,
        periodMonths: proratedMonths,
        lineItems,
        notes: `Prorated charges for ${daysRemaining} days remaining in term`,
      },
      userId
    );
  },

  /**
   * Get an invoice by ID with all details
   */
  async getInvoice(id: string): Promise<SerializedInvoice | null> {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        payments: {
          include: {
            recordedByUser: {
              select: { id: true, username: true, firstName: true, lastName: true },
            },
          },
          orderBy: { paymentDate: 'desc' },
        },
        createdBy: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
    });

    return invoice ? this.serializeInvoice(invoice) : null;
  },

  /**
   * Get invoices for an account
   */
  async getAccountInvoices(accountId: string): Promise<SerializedInvoice[]> {
    const invoices = await prisma.invoice.findMany({
      where: { accountId },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        payments: {
          include: {
            recordedByUser: {
              select: { id: true, username: true, firstName: true, lastName: true },
            },
          },
        },
        createdBy: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    return invoices.map((inv) => this.serializeInvoice(inv));
  },

  /**
   * Get the most recent unpaid or partially paid invoice for an account
   */
  async getUnpaidInvoice(accountId: string): Promise<SerializedInvoice | null> {
    const invoice = await prisma.invoice.findFirst({
      where: {
        accountId,
        status: { in: ['PENDING', 'PARTIAL'] },
      },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        payments: {
          include: {
            recordedByUser: {
              select: { id: true, username: true, firstName: true, lastName: true },
            },
          },
        },
        createdBy: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    return invoice ? this.serializeInvoice(invoice) : null;
  },

  /**
   * Update invoice paid amount and status after a payment is linked
   */
  async updateInvoicePayment(invoiceId: string): Promise<SerializedInvoice> {
    // Calculate total paid from linked payments
    const payments = await prisma.payment.findMany({
      where: { invoiceId },
      select: { amount: true },
    });

    const paidAmount = payments.reduce(
      (sum, p) => sum + decimalToNumber(p.amount),
      0
    );

    // Get invoice total
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { totalAmount: true },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const totalAmount = decimalToNumber(invoice.totalAmount);
    const status = calculateInvoiceStatus(totalAmount, paidAmount);

    // Update invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount, status },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        payments: {
          include: {
            recordedByUser: {
              select: { id: true, username: true, firstName: true, lastName: true },
            },
          },
        },
        createdBy: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
    });

    return this.serializeInvoice(updatedInvoice);
  },

  /**
   * Link a payment to an invoice
   */
  async linkPaymentToInvoice(paymentId: string, invoiceId: string): Promise<void> {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { invoiceId },
    });

    // Update invoice status
    await this.updateInvoicePayment(invoiceId);
  },

  /**
   * Format renewal period as a label
   */
  formatPeriodLabel(period: RenewalPeriod): string {
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
  },

  /**
   * Serialize invoice for API response
   */
  serializeInvoice(invoice: InvoiceWithDetails): SerializedInvoice {
    const totalAmount = decimalToNumber(invoice.totalAmount);
    const paidAmount = decimalToNumber(invoice.paidAmount);

    return {
      id: invoice.id,
      accountId: invoice.accountId,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: formatDateString(invoice.invoiceDate),
      invoiceType: invoice.invoiceType,
      status: invoice.status,
      renewalPeriod: invoice.renewalPeriod,
      periodStart: formatDateString(invoice.periodStart),
      periodEnd: formatDateString(invoice.periodEnd),
      periodMonths: invoice.periodMonths,
      subtotal: decimalToNumber(invoice.subtotal),
      totalAmount,
      paidAmount,
      balanceDue: Math.max(0, totalAmount - paidAmount),
      createdById: invoice.createdById,
      notes: invoice.notes,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      lineItems: invoice.lineItems.map((item) => this.serializeLineItem(item)),
      payments: invoice.payments.map((p) => this.serializePayment(p)),
      createdBy: invoice.createdBy,
    };
  },

  /**
   * Serialize line item for API response
   */
  serializeLineItem(item: {
    id: string;
    invoiceId: string;
    lineType: string;
    description: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    months: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    sortOrder: number;
  }): SerializedInvoiceLineItem {
    return {
      id: item.id,
      invoiceId: item.invoiceId,
      lineType: item.lineType as SerializedInvoiceLineItem['lineType'],
      description: item.description,
      quantity: item.quantity,
      unitPrice: decimalToNumber(item.unitPrice),
      months: decimalToNumber(item.months),
      totalAmount: decimalToNumber(item.totalAmount),
      sortOrder: item.sortOrder,
    };
  },

  /**
   * Serialize payment for invoice response
   */
  serializePayment(payment: {
    id: string;
    amount: Prisma.Decimal;
    paymentDate: Date;
    paymentMethod: string;
    notes: string | null;
    recordedByUser: {
      id: string;
      username: string;
      firstName: string | null;
      lastName: string | null;
    };
  }): SerializedInvoicePayment {
    return {
      id: payment.id,
      amount: decimalToNumber(payment.amount),
      paymentDate: formatDateString(payment.paymentDate),
      paymentMethod: payment.paymentMethod,
      notes: payment.notes,
      recordedBy: payment.recordedByUser,
    };
  },
};
