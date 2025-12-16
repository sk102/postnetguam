import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/prisma';
import { RENEWAL_WARNING_DAYS } from '@/constants/status';

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const renewalThreshold = new Date(now);
    renewalThreshold.setDate(renewalThreshold.getDate() + RENEWAL_WARNING_DAYS);

    const [activeTotal, renewal, hold, closed, total, auditFlagged] = await Promise.all([
      // All ACTIVE accounts (includes those that will show as RENEWAL)
      prisma.account.count({ where: { status: 'ACTIVE' } }),
      // RENEWAL: ACTIVE accounts with renewal date within threshold
      prisma.account.count({
        where: {
          status: 'ACTIVE',
          nextRenewalDate: {
            gt: now,
            lte: renewalThreshold,
          },
        },
      }),
      prisma.account.count({ where: { status: 'HOLD' } }),
      prisma.account.count({ where: { status: 'CLOSED' } }),
      prisma.account.count(),
      prisma.account.count({ where: { auditFlag: true } }),
    ]);

    // Active count excludes those showing as RENEWAL
    const active = activeTotal - renewal;

    return NextResponse.json({
      active,
      renewal,
      hold,
      closed,
      total,
      auditFlagged,
    });
  } catch (error) {
    console.error('Account stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
