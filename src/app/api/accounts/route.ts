import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { formatRecipientName, buildRecipientNameSearch } from '@/lib/utils/recipient';
import { RENEWAL_WARNING_DAYS, type DisplayAccountStatus } from '@/constants/status';

type SortField = 'mailboxNumber' | 'name' | 'status' | 'nextRenewalDate';

/**
 * Computes the display status for an account.
 * ACTIVE accounts with nextRenewalDate within RENEWAL_WARNING_DAYS days show as RENEWAL.
 */
function computeDisplayStatus(
  dbStatus: string,
  nextRenewalDate: Date,
  now: Date
): DisplayAccountStatus {
  if (dbStatus === 'ACTIVE') {
    const daysUntilRenewal = Math.ceil(
      (nextRenewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilRenewal > 0 && daysUntilRenewal <= RENEWAL_WARNING_DAYS) {
      return 'RENEWAL';
    }
  }
  return dbStatus as DisplayAccountStatus;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);
    const search = searchParams.get('search') ?? '';
    const status = searchParams.get('status') ?? '';
    const sortField = (searchParams.get('sortField') ?? 'mailboxNumber') as SortField;
    const sortOrder = (searchParams.get('sortOrder') ?? 'asc') as 'asc' | 'desc';

    const skip = (page - 1) * limit;

    // Build where clause
    const searchNum = parseInt(search, 10);
    const recipientNameSearch = buildRecipientNameSearch(search);
    const searchWhere: Prisma.AccountWhereInput = search
      ? {
          OR: [
            // Search by mailbox number
            ...(isNaN(searchNum) ? [] : [{ mailbox: { number: { equals: searchNum } } }]),
            // Search recipient names (supports full name search like "Amara Acosta")
            ...(recipientNameSearch ? [{ recipients: { some: recipientNameSearch } }] : []),
            // Search memos content
            { memos: { some: { content: { contains: search, mode: 'insensitive' as const }, deletedAt: null } } },
          ],
        }
      : {};

    // Handle status filtering - RENEWAL is a computed status for ACTIVE accounts
    // with nextRenewalDate within RENEWAL_WARNING_DAYS days
    const now = new Date();
    const renewalThreshold = new Date(now);
    renewalThreshold.setDate(renewalThreshold.getDate() + RENEWAL_WARNING_DAYS);

    let statusWhere: Prisma.AccountWhereInput = {};
    if (status === 'RENEWAL') {
      // RENEWAL: ACTIVE accounts with renewal date within threshold
      statusWhere = {
        status: 'ACTIVE',
        nextRenewalDate: {
          gt: now,
          lte: renewalThreshold,
        },
      };
    } else if (status === 'ACTIVE') {
      // ACTIVE: Exclude accounts that would show as RENEWAL
      statusWhere = {
        status: 'ACTIVE',
        nextRenewalDate: {
          gt: renewalThreshold,
        },
      };
    } else if (status) {
      statusWhere = { status: status as 'HOLD' | 'CLOSED' };
    }

    const where: Prisma.AccountWhereInput = {
      ...searchWhere,
      ...statusWhere,
    };

    // Build orderBy
    let orderBy: Prisma.AccountOrderByWithRelationInput;
    const needsInMemorySort = sortField === 'name';

    if (sortField === 'mailboxNumber') {
      orderBy = { mailbox: { number: sortOrder } };
    } else if (sortField === 'name') {
      // Name requires in-memory sort since it's computed from recipient
      orderBy = { mailbox: { number: 'asc' } };
    } else if (sortField === 'status') {
      orderBy = { status: sortOrder };
    } else if (sortField === 'nextRenewalDate') {
      orderBy = { nextRenewalDate: sortOrder };
    } else {
      orderBy = { mailbox: { number: 'asc' } };
    }

    const findManyArgs = {
      where,
      orderBy,
      include: {
        mailbox: true,
        recipients: {
          where: { removedDate: null },
        },
      },
    };

    const paginatedArgs = needsInMemorySort
      ? findManyArgs
      : { ...findManyArgs, skip, take: limit };

    const [accounts, total] = await Promise.all([
      prisma.account.findMany(paginatedArgs),
      prisma.account.count({ where }),
    ]);

    let data = accounts.map((account) => {
      const primary = account.recipients.find((r) => r.isPrimary) ?? account.recipients[0];
      const name = primary ? formatRecipientName(primary) : 'Unknown';
      // Account is "Business" type if ANY recipient is a business
      const hasBusiness = account.recipients.some((r) => r.recipientType === 'BUSINESS');

      // Check if any person recipient needs ID verification
      // (never verified or ID has expired)
      const needsIdUpdate = account.recipients.some((r) => {
        // Only check person recipients (businesses don't need ID verification)
        if (r.recipientType !== 'PERSON') {
          return false;
        }
        // Needs verification if never verified
        if (!r.idVerifiedDate) {
          return true;
        }
        // Needs verification if ID has expired
        if (r.idExpirationDate && r.idExpirationDate < now) {
          return true;
        }
        return false;
      });

      // Compute display status (ACTIVE within 30 days of renewal shows as RENEWAL)
      const displayStatus = computeDisplayStatus(
        account.status,
        account.nextRenewalDate,
        now
      );

      return {
        id: account.id,
        mailboxNumber: account.mailbox.number,
        name,
        status: displayStatus,
        renewalPeriod: account.renewalPeriod,
        nextRenewalDate: account.nextRenewalDate,
        currentRate: account.currentRate,
        recipientType: hasBusiness ? 'BUSINESS' : 'PERSON',
        recipientCount: account.recipients.length,
        auditFlag: account.auditFlag,
        needsIdUpdate,
      };
    });

    // Handle name sorting in memory
    if (needsInMemorySort) {
      data.sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return sortOrder === 'asc' ? comparison : -comparison;
      });
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
    console.error('Accounts API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

interface CreateAccountBody {
  mailboxId: string;
  renewalPeriod: 'THREE_MONTH' | 'SIX_MONTH' | 'TWELVE_MONTH';
  monthlyRate: number;
  startDate: string;
  depositPaid: number;
  smsEnabled: boolean;
  emailEnabled: boolean;
  recipient: {
    recipientType: 'PERSON' | 'BUSINESS';
    firstName?: string;
    middleName?: string;
    lastName?: string;
    personAlias?: string;
    birthdate?: string;
    businessName?: string;
    businessAlias?: string;
    phone?: string;
    email?: string;
  };
}

function calculateNextRenewalDate(startDate: Date, period: string): Date {
  const next = new Date(startDate);
  switch (period) {
    case 'THREE_MONTH':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'SIX_MONTH':
      next.setMonth(next.getMonth() + 6);
      break;
    case 'TWELVE_MONTH':
      next.setMonth(next.getMonth() + 13); // 13 months for 12-month term
      break;
  }
  return next;
}

function calculateTotalRate(monthlyRate: number, period: string): number {
  switch (period) {
    case 'THREE_MONTH':
      return monthlyRate * 3;
    case 'SIX_MONTH':
      return monthlyRate * 6;
    case 'TWELVE_MONTH':
      return monthlyRate * 12; // Pay for 12, get 13
    default:
      return monthlyRate * 3;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as CreateAccountBody;

    // Validate required fields
    if (!body.mailboxId) {
      return NextResponse.json({ error: 'Mailbox is required' }, { status: 400 });
    }
    if (!body.renewalPeriod) {
      return NextResponse.json({ error: 'Renewal period is required' }, { status: 400 });
    }
    if (body.monthlyRate === undefined || body.monthlyRate < 0) {
      return NextResponse.json({ error: 'Valid monthly rate is required' }, { status: 400 });
    }

    const validPeriods = ['THREE_MONTH', 'SIX_MONTH', 'TWELVE_MONTH'];
    if (!validPeriods.includes(body.renewalPeriod)) {
      return NextResponse.json({ error: 'Invalid renewal period' }, { status: 400 });
    }

    // Validate recipient
    const recipient = body.recipient;
    if (!recipient) {
      return NextResponse.json({ error: 'Primary recipient is required' }, { status: 400 });
    }
    if (recipient.recipientType === 'PERSON' && !recipient.firstName) {
      return NextResponse.json({ error: 'First name is required for person' }, { status: 400 });
    }
    if (recipient.recipientType === 'BUSINESS' && !recipient.businessName) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 });
    }

    // Check mailbox is available
    const mailbox = await prisma.mailbox.findUnique({
      where: { id: body.mailboxId },
    });
    if (!mailbox) {
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
    }
    if (mailbox.status !== 'AVAILABLE') {
      return NextResponse.json({ error: 'Mailbox is not available' }, { status: 400 });
    }

    // Calculate dates and rates
    const startDate = body.startDate ? new Date(body.startDate) : new Date();
    const nextRenewalDate = calculateNextRenewalDate(startDate, body.renewalPeriod);
    const currentRate = calculateTotalRate(body.monthlyRate, body.renewalPeriod);

    // Create account with recipient in a transaction
    const account = await prisma.$transaction(async (tx) => {
      // Create account
      const newAccount = await tx.account.create({
        data: {
          mailboxId: body.mailboxId,
          status: 'ACTIVE',
          renewalPeriod: body.renewalPeriod,
          startDate,
          nextRenewalDate,
          currentRate,
          depositPaid: body.depositPaid ?? 5.00,
          depositReturned: false,
          smsEnabled: body.smsEnabled ?? false,
          emailEnabled: body.emailEnabled ?? false,
        },
      });

      // Create primary recipient
      const birthdateValue = recipient.birthdate ? new Date(recipient.birthdate) : null;
      const newRecipient = await tx.recipient.create({
        data: {
          accountId: newAccount.id,
          recipientType: recipient.recipientType,
          isPrimary: true,
          firstName: recipient.recipientType === 'PERSON' ? recipient.firstName ?? null : null,
          middleName: recipient.recipientType === 'PERSON' ? recipient.middleName ?? null : null,
          lastName: recipient.recipientType === 'PERSON' ? recipient.lastName ?? null : null,
          personAlias: recipient.recipientType === 'PERSON' ? recipient.personAlias ?? null : null,
          birthdate: recipient.recipientType === 'PERSON' ? birthdateValue : null,
          businessName: recipient.recipientType === 'BUSINESS' ? recipient.businessName ?? null : null,
          businessAlias: recipient.recipientType === 'BUSINESS' ? recipient.businessAlias ?? null : null,
        },
      });

      // Create contact card for recipient
      const contactCard = await tx.contactCard.create({
        data: {
          recipientId: newRecipient.id,
        },
      });

      // Add phone if provided
      if (recipient.phone) {
        await tx.phoneNumber.create({
          data: {
            contactCardId: contactCard.id,
            e164Format: recipient.phone,
            isMobile: true,
            isPrimary: true,
          },
        });
      }

      // Add email if provided
      if (recipient.email) {
        await tx.emailAddress.create({
          data: {
            contactCardId: contactCard.id,
            email: recipient.email.toLowerCase(),
            isPrimary: true,
          },
        });
      }

      // Update mailbox status to ACTIVE
      await tx.mailbox.update({
        where: { id: body.mailboxId },
        data: { status: 'ACTIVE' },
      });

      return newAccount;
    });

    return NextResponse.json({
      id: account.id,
      mailboxNumber: mailbox.number,
    }, { status: 201 });

  } catch (error) {
    console.error('Create account API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
