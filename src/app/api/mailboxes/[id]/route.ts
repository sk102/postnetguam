import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/prisma';
import { formatRecipientName } from '@/lib/utils/recipient';

interface RouteParams {
  params: { id: string };
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mailbox = await prisma.mailbox.findUnique({
      where: { id: params.id },
      include: {
        accounts: {
          include: {
            recipients: {
              where: { removedDate: null },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            },
          },
          orderBy: { startDate: 'desc' },
        },
      },
    });

    if (!mailbox) {
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
    }

    // Find the current (non-closed) account
    const currentAccount = mailbox.accounts.find((a) => a.status !== 'CLOSED');
    const primaryRecipient = currentAccount?.recipients.find((r) => r.isPrimary) ?? currentAccount?.recipients[0];
    const holderName = primaryRecipient ? formatRecipientName(primaryRecipient) : null;

    // Get recipients from current account
    const recipients = currentAccount?.recipients.map((r) => ({
      id: r.id,
      name: formatRecipientName(r),
      recipientType: r.recipientType,
      isPrimary: r.isPrimary,
    })) ?? [];

    // Build account history (all accounts with dates)
    const accountHistory = mailbox.accounts.map((account) => {
      const primary = account.recipients.find((r) => r.isPrimary) ?? account.recipients[0];
      return {
        id: account.id,
        status: account.status,
        holderName: primary ? formatRecipientName(primary) : 'Unknown',
        startDate: account.startDate.toISOString(),
        endDate: account.closedAt?.toISOString() ?? null,
        nextRenewalDate: account.nextRenewalDate.toISOString(),
      };
    });

    return NextResponse.json({
      id: mailbox.id,
      number: mailbox.number,
      status: mailbox.status,
      keyDeposit: mailbox.keyDeposit.toString(),
      createdAt: mailbox.createdAt.toISOString(),
      updatedAt: mailbox.updatedAt.toISOString(),
      account: currentAccount
        ? {
            id: currentAccount.id,
            status: currentAccount.status,
            holderName: holderName ?? 'Unknown',
            nextRenewalDate: currentAccount.nextRenewalDate.toISOString(),
          }
        : null,
      recipients,
      accountHistory,
    });
  } catch (error) {
    console.error('Mailbox detail API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as Record<string, unknown>;

    // Validate that mailbox exists
    const existing = await prisma.mailbox.findUnique({
      where: { id: params.id },
      include: { accounts: { where: { status: { not: 'CLOSED' } } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
    }

    // Check if there's an active (non-closed) account
    const hasActiveAccount = existing.accounts.length > 0;

    // Build update data with only allowed fields
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) {
      const validStatuses = ['AVAILABLE', 'ACTIVE', 'RESERVED', 'MAINTENANCE'];
      if (!validStatuses.includes(body.status as string)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }

      // Cannot set to AVAILABLE if has an active account
      if (body.status === 'AVAILABLE' && hasActiveAccount) {
        return NextResponse.json(
          { error: 'Cannot set mailbox to AVAILABLE while it has an account' },
          { status: 400 }
        );
      }

      updateData.status = body.status;
    }

    if (body.keyDeposit !== undefined) {
      const deposit = parseFloat(body.keyDeposit as string);
      if (isNaN(deposit) || deposit < 0) {
        return NextResponse.json({ error: 'Invalid key deposit' }, { status: 400 });
      }
      updateData.keyDeposit = deposit;
    }

    const updated = await prisma.mailbox.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      number: updated.number,
      status: updated.status,
      keyDeposit: updated.keyDeposit.toString(),
    });
  } catch (error) {
    console.error('Mailbox update API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
