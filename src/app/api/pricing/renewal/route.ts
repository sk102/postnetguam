import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/prisma';
import { PricingService } from '@/lib/services/pricing.service';
import { formatRecipientName } from '@/lib/utils/recipient';
import type { RenewalPeriod } from '@prisma/client';

/**
 * POST /api/pricing/renewal
 * Calculate prorated renewal price for an account
 * Takes into account minors turning 18 during the renewal period
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      accountId: string;
      renewalPeriod: RenewalPeriod;
      renewalStartDate?: string;
    };

    if (!body.accountId || !body.renewalPeriod) {
      return NextResponse.json(
        { error: 'accountId and renewalPeriod are required' },
        { status: 400 }
      );
    }

    const validPeriods: RenewalPeriod[] = ['THREE_MONTH', 'SIX_MONTH', 'TWELVE_MONTH'];
    if (!validPeriods.includes(body.renewalPeriod)) {
      return NextResponse.json(
        { error: 'Invalid renewal period' },
        { status: 400 }
      );
    }

    // Fetch account with recipients
    const account = await prisma.account.findUnique({
      where: { id: body.accountId },
      include: {
        recipients: {
          where: { removedDate: null },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Get current rates
    const rates = await PricingService.getCurrentRates();
    if (!rates) {
      return NextResponse.json(
        { error: 'No pricing configuration found' },
        { status: 500 }
      );
    }

    // Parse renewal start date (default to today)
    const renewalStartDate = body.renewalStartDate
      ? new Date(body.renewalStartDate)
      : new Date();

    // Map recipients for calculation
    const recipients = account.recipients.map((r) => ({
      id: r.id,
      recipientType: r.recipientType as 'PERSON' | 'BUSINESS',
      name: formatRecipientName(r),
      birthdate: r.birthdate,
    }));

    // Calculate prorated renewal price
    const breakdown = PricingService.calculateRenewalPriceBreakdown(
      rates,
      body.renewalPeriod,
      recipients,
      renewalStartDate
    );

    // Serialize the response
    return NextResponse.json({
      accountId: account.id,
      renewalPeriod: body.renewalPeriod,
      renewalStartDate: renewalStartDate.toISOString().split('T')[0],
      breakdown: {
        baseRate: breakdown.baseRate,
        businessFee: breakdown.businessFee,
        additionalRecipientFees: breakdown.additionalRecipientFees,
        minorFees: breakdown.minorFees,
        transitionFees: breakdown.transitionFees,
        totalForPeriod: breakdown.totalForPeriod,
        adjustedTotalForPeriod: breakdown.adjustedTotalForPeriod,
        totalMonthly: breakdown.totalMonthly,
        periodMonths: breakdown.periodMonths,
      },
      minorTransitions: breakdown.minorTransitions.map((t) => ({
        recipientId: t.recipientId,
        recipientName: t.recipientName,
        turnsAdultDate: t.turnsAdultDate.toISOString().split('T')[0],
        monthsAsMinor: t.monthsAsMinor,
        monthsAsAdult: t.monthsAsAdult,
        additionalAdultFee: t.additionalAdultFee,
      })),
    });
  } catch (error) {
    console.error('Renewal pricing API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
