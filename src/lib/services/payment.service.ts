import { prisma } from '@/lib/db/prisma';
import type { Prisma, PaymentMethod } from '@prisma/client';
import type { PaymentListQuery } from '@/lib/validations/payment';
import type {
  PaymentWithDetails,
  CreatePaymentInput,
  CreatePaymentResult,
} from '@/types/payment';

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
 * Service for managing payments
 */
export const PaymentService = {
  /**
   * Get payments with pagination and filtering
   */
  async getPayments(query: PaymentListQuery): Promise<{
    data: PaymentWithDetails[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  }> {
    const { accountId, startDate, endDate, paymentMethod, page, limit, sortField, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {};

    if (accountId) {
      where.accountId = accountId;
    }

    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) {
        where.paymentDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.paymentDate.lte = new Date(endDate);
      }
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          recordedByUser: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          account: {
            select: {
              id: true,
              mailbox: {
                select: { number: true },
              },
            },
          },
        },
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      data: payments.map((p) => this.serializePayment(p)),
      pagination: {
        page,
        pageSize: limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get a single payment by ID
   */
  async getPaymentById(id: string): Promise<PaymentWithDetails | null> {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        recordedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        account: {
          select: {
            id: true,
            mailbox: {
              select: { number: true },
            },
          },
        },
      },
    });

    return payment ? this.serializePayment(payment) : null;
  },

  /**
   * Create a new payment and activate mailbox when fully paid
   * If isRenewal is true, also updates the account's term data
   */
  async createPayment(input: CreatePaymentInput, userId: string): Promise<CreatePaymentResult> {
    return prisma.$transaction(async (tx) => {
      // Get the account with mailbox info
      let account = await tx.account.findUnique({
        where: { id: input.accountId },
        include: { mailbox: true },
      });

      if (!account) {
        throw new Error('Account not found');
      }

      // Check if this is the first payment
      const existingPaymentCount = await tx.payment.count({
        where: { accountId: input.accountId },
      });

      const isFirstPayment = existingPaymentCount === 0;

      // For renewals, we'll process the renewal AFTER checking if fully paid
      let renewalProcessed = false;
      const isRenewalPayment = input.isRenewal && input.renewalPeriod && input.newRate !== undefined;

      // Create the payment
      const payment = await tx.payment.create({
        data: {
          accountId: input.accountId,
          invoiceId: input.invoiceId ?? null,
          amount: input.amount,
          paymentDate: new Date(input.paymentDate),
          paymentMethod: input.paymentMethod as PaymentMethod,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          notes: input.notes ?? null,
          recordedBy: userId,
        },
        include: {
          recordedByUser: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          account: {
            select: {
              id: true,
              mailbox: {
                select: { number: true },
              },
            },
          },
        },
      });

      // Check if mailbox should be activated (only if RESERVED and fully paid)
      let mailboxActivated = false;
      if (account.mailbox.status === 'RESERVED') {
        // Calculate total charge for the term
        const months = this.getTermMonths(account.renewalPeriod);
        const totalCharge = decimalToNumber(account.currentRate) * months;

        // Get total payments including the one we just created
        const allPayments = await tx.payment.findMany({
          where: {
            accountId: input.accountId,
            periodStart: { gte: account.startDate },
            periodEnd: { lte: account.nextRenewalDate },
          },
          select: { amount: true },
        });

        const totalPaid = allPayments.reduce(
          (sum, p) => sum + decimalToNumber(p.amount),
          0
        );

        // Activate if fully paid (balance due <= 0)
        if (totalPaid >= totalCharge) {
          await tx.mailbox.update({
            where: { id: account.mailboxId },
            data: { status: 'ACTIVE' },
          });
          mailboxActivated = true;
        }
      }

      // Update invoice paid amount and status if linked
      if (input.invoiceId) {
        // Calculate total paid from linked payments
        const invoicePayments = await tx.payment.findMany({
          where: { invoiceId: input.invoiceId },
          select: { amount: true },
        });

        const paidAmount = invoicePayments.reduce(
          (sum, p) => sum + decimalToNumber(p.amount),
          0
        );

        // Get invoice total
        const invoice = await tx.invoice.findUnique({
          where: { id: input.invoiceId },
          select: { totalAmount: true },
        });

        if (invoice) {
          const totalAmount = decimalToNumber(invoice.totalAmount);
          let status: 'PENDING' | 'PARTIAL' | 'PAID' = 'PENDING';
          if (paidAmount > 0 && paidAmount < totalAmount) {
            status = 'PARTIAL';
          } else if (paidAmount >= totalAmount) {
            status = 'PAID';
          }

          await tx.invoice.update({
            where: { id: input.invoiceId },
            data: { paidAmount, status },
          });

          // If invoice is now fully paid and this is a renewal, apply the renewal
          if (status === 'PAID' && isRenewalPayment && input.renewalPeriod && input.newRate !== undefined) {
            account = await tx.account.update({
              where: { id: input.accountId },
              data: {
                renewalPeriod: input.renewalPeriod,
                currentRate: input.newRate,
                startDate: new Date(input.periodStart),
                nextRenewalDate: new Date(input.periodEnd),
                // If account was HOLD, move back to ACTIVE
                status: account.status === 'HOLD' ? 'ACTIVE' : account.status,
              },
              include: { mailbox: true },
            });
            renewalProcessed = true;
          }
        }
      }

      return {
        payment: this.serializePayment(payment),
        isFirstPayment,
        mailboxActivated,
        renewalProcessed,
      };
    });
  },

  /**
   * Get number of months for a renewal period (for billing calculation)
   */
  getTermMonths(renewalPeriod: string): number {
    switch (renewalPeriod) {
      case 'THREE_MONTH':
        return 3;
      case 'SIX_MONTH':
        return 6;
      case 'TWELVE_MONTH':
        return 12;
      default:
        return 3;
    }
  },

  /**
   * Get payment history for an account
   */
  async getAccountPayments(accountId: string): Promise<PaymentWithDetails[]> {
    const payments = await prisma.payment.findMany({
      where: { accountId },
      include: {
        recordedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        account: {
          select: {
            id: true,
            mailbox: {
              select: { number: true },
            },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    return payments.map((p) => this.serializePayment(p));
  },

  /**
   * Serialize payment for API response
   */
  serializePayment(payment: {
    id: string;
    accountId: string;
    invoiceId: string | null;
    amount: Prisma.Decimal;
    paymentDate: Date;
    paymentMethod: PaymentMethod;
    periodStart: Date;
    periodEnd: Date;
    notes: string | null;
    recordedBy: string;
    createdAt: Date;
    updatedAt: Date;
    recordedByUser: {
      id: string;
      username: string;
      firstName: string | null;
      lastName: string | null;
    };
    account?: {
      id: string;
      mailbox: {
        number: number;
      };
    };
  }): PaymentWithDetails {
    return {
      id: payment.id,
      accountId: payment.accountId,
      invoiceId: payment.invoiceId,
      amount: decimalToNumber(payment.amount),
      paymentDate: formatDateString(payment.paymentDate),
      paymentMethod: payment.paymentMethod,
      periodStart: formatDateString(payment.periodStart),
      periodEnd: formatDateString(payment.periodEnd),
      notes: payment.notes,
      recordedBy: payment.recordedBy,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
      recordedByUser: payment.recordedByUser,
      account: payment.account,
    };
  },
};
