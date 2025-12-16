import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/prisma';
import { MailboxStatus, Prisma, AccountStatus } from '@prisma/client';
import { formatRecipientName, buildRecipientNameSearch } from '@/lib/utils/recipient';

type SortField = 'number' | 'status' | 'accountName';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '25', 10);
    const status = searchParams.get('status') as MailboxStatus | null;
    const search = searchParams.get('search') ?? '';
    const sortField = (searchParams.get('sortField') ?? 'number') as SortField;
    const sortOrder = (searchParams.get('sortOrder') ?? 'asc') as 'asc' | 'desc';

    const skip = (page - 1) * limit;

    // Build where clause
    const conditions: Prisma.MailboxWhereInput[] = [];
    if (status) {
      conditions.push({ status });
    }
    if (search) {
      const searchNum = parseInt(search, 10);
      const recipientNameSearch = buildRecipientNameSearch(search);
      conditions.push({
        OR: [
          ...(isNaN(searchNum) ? [] : [{ number: { equals: searchNum } }]),
          // Search recipient names (supports full name search like "Amara Acosta")
          ...(recipientNameSearch ? [{
            accounts: {
              some: {
                status: { not: AccountStatus.CLOSED },
                recipients: {
                  some: recipientNameSearch,
                },
              },
            },
          }] : []),
        ],
      });
    }

    const where: Prisma.MailboxWhereInput = conditions.length > 0 ? { AND: conditions } : {};

    // Build orderBy - handle accountName specially since it's a relation
    let orderBy: Prisma.MailboxOrderByWithRelationInput;
    if (sortField === 'accountName') {
      // Sort by account holder name requires raw query or post-fetch sort
      // For simplicity, we'll sort in memory after fetching
      orderBy = { number: 'asc' };
    } else {
      orderBy = { [sortField]: sortOrder };
    }

    const findManyArgs = {
      where,
      orderBy,
      include: {
        accounts: {
          where: { status: { not: AccountStatus.CLOSED } },
          include: {
            recipients: {
              where: { removedDate: null },
            },
          },
          take: 1, // Only need current active account
        },
      },
    };

    // Add pagination only if not sorting by accountName
    const paginatedArgs = sortField === 'accountName'
      ? findManyArgs
      : { ...findManyArgs, skip, take: limit };

    const [mailboxes, total] = await Promise.all([
      prisma.mailbox.findMany(paginatedArgs),
      prisma.mailbox.count({ where }),
    ]);

    let data = mailboxes.map((mailbox) => {
      const currentAccount = mailbox.accounts[0];
      const recipients = currentAccount?.recipients ?? [];

      // Split recipients by type
      const personRecipients = recipients
        .filter((r) => r.recipientType === 'PERSON')
        .map((r) => formatRecipientName(r));
      const businessRecipients = recipients
        .filter((r) => r.recipientType === 'BUSINESS')
        .map((r) => ({
          name: r.businessName ?? 'Unknown Business',
          alias: r.businessAlias ?? null,
        }));

      // For sorting, use primary recipient name
      const primary = recipients.find((r) => r.isPrimary) ?? recipients[0];
      const accountName = primary ? formatRecipientName(primary) : null;

      return {
        id: mailbox.id,
        number: mailbox.number,
        status: mailbox.status,
        accountName, // Keep for sorting
        personRecipients,
        businessRecipients,
        recipientCount: recipients.length,
        auditFlag: currentAccount?.auditFlag ?? false,
        accountStatus: currentAccount?.status ?? null,
      };
    });

    // Handle accountName sorting in memory
    if (sortField === 'accountName') {
      data.sort((a, b) => {
        // Active mailboxes (with account holders) first
        const aHasAccount = a.accountName !== null;
        const bHasAccount = b.accountName !== null;
        if (aHasAccount !== bHasAccount) {
          return aHasAccount ? -1 : 1;
        }
        // Then sort by name
        const aName = a.accountName ?? '';
        const bName = b.accountName ?? '';
        const comparison = aName.localeCompare(bName);
        return sortOrder === 'asc' ? comparison : -comparison;
      });
      // Apply pagination after sorting
      data = data.slice(skip, skip + limit);
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Mailboxes API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
