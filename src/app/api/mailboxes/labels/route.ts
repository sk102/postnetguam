import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/prisma';
import { AccountStatus } from '@prisma/client';
import { formatRecipientName } from '@/lib/utils/recipient';
import { calculateAge } from '@/lib/utils/date';

interface LabelRecipient {
  displayName: string;
  type: 'PERSON' | 'BUSINESS';
  age: number | null;
  isAdult: boolean;
  isPrimary: boolean;
}

interface MailboxLabel {
  mailboxId: string;
  mailboxNumber: number;
  primaryRecipient: string | null;
  recipients: LabelRecipient[];
}

/**
 * POST /api/mailboxes/labels - Fetch label data for selected mailboxes
 * Body: { mailboxIds: string[] }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { mailboxIds?: string[] };
    const mailboxIds = body.mailboxIds;

    if (!mailboxIds || !Array.isArray(mailboxIds) || mailboxIds.length === 0) {
      return NextResponse.json(
        { error: 'mailboxIds array is required' },
        { status: 400 }
      );
    }

    // Fetch mailboxes with their accounts and recipients
    const mailboxes = await prisma.mailbox.findMany({
      where: {
        id: { in: mailboxIds },
      },
      include: {
        accounts: {
          where: { status: { not: AccountStatus.CLOSED } },
          include: {
            recipients: {
              where: { removedDate: null },
              orderBy: [
                { isPrimary: 'desc' },
                { addedDate: 'asc' },
              ],
            },
          },
          take: 1,
        },
      },
      orderBy: { number: 'asc' },
    });

    const labels: MailboxLabel[] = mailboxes.map((mailbox) => {
      const currentAccount = mailbox.accounts[0];
      const allRecipients = currentAccount?.recipients ?? [];

      // Find primary recipient (account holder)
      const primaryRecipient = allRecipients.find((r) => r.isPrimary);
      const primaryName = primaryRecipient
        ? formatRecipientName(primaryRecipient)
        : null;

      // Process all recipients for display
      const recipients: LabelRecipient[] = allRecipients.map((r) => {
        const age = r.recipientType === 'PERSON' && r.birthdate
          ? calculateAge(r.birthdate)
          : null;
        const isAdult = age === null || age >= 18;

        let displayName: string;
        if (r.recipientType === 'BUSINESS') {
          displayName = r.businessAlias ?? r.businessName ?? 'Unknown Business';
        } else {
          displayName = formatRecipientName(r);
        }

        return {
          displayName,
          type: r.recipientType,
          age,
          isAdult,
          isPrimary: r.isPrimary,
        };
      });

      // Sort recipients: businesses first, then persons, alphabetically within each group
      recipients.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'BUSINESS' ? -1 : 1;
        }
        return a.displayName.localeCompare(b.displayName);
      });

      return {
        mailboxId: mailbox.id,
        mailboxNumber: mailbox.number,
        primaryRecipient: primaryName,
        recipients,
      };
    });

    return NextResponse.json({ data: labels });
  } catch (error) {
    console.error('Mailbox labels API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
