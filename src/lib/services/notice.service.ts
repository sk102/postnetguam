import type {
  NoticeTypeCode,
  NoticeDeliveryMethod,
  NoticeStatus,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  buildTemplateContextAsync,
  renderNoticeTemplate,
  renderSubject,
} from './notice-template.service';
import type {
  CreateNoticeTypeInput,
  UpdateNoticeTypeInput,
  SerializedNoticeType,
  SerializedNoticeHistory,
  NoticeGenerationRequest,
  NoticeGenerationResult,
  NoticeGenerationResponse,
  NoticePreviewRequest,
  NoticePreviewResponse,
  NoticeHistoryFilter,
  AccountForNotice,
} from '@/types/notice';
import { DEFAULT_NOTICE_TYPES } from '@/constants/notice';

/**
 * Serialize a NoticeType for API response
 */
function serializeNoticeType(noticeType: {
  id: string;
  code: NoticeTypeCode;
  name: string;
  description: string | null;
  template: string;
  subject: string | null;
  isActive: boolean;
  isSystem: boolean;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SerializedNoticeType {
  return {
    id: noticeType.id,
    code: noticeType.code,
    name: noticeType.name,
    description: noticeType.description,
    template: noticeType.template,
    subject: noticeType.subject,
    isActive: noticeType.isActive,
    isSystem: noticeType.isSystem,
    createdById: noticeType.createdById,
    updatedById: noticeType.updatedById,
    createdAt: noticeType.createdAt.toISOString(),
    updatedAt: noticeType.updatedAt.toISOString(),
  };
}

// ============================================================
// NOTICE TYPE CRUD
// ============================================================

/**
 * Get all notice types
 */
export async function getAllNoticeTypes(
  includeInactive = false
): Promise<SerializedNoticeType[]> {
  const noticeTypes = await prisma.noticeType.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });

  return noticeTypes.map(serializeNoticeType);
}

/**
 * Get a notice type by ID
 */
export async function getNoticeTypeById(
  id: string
): Promise<SerializedNoticeType | null> {
  const noticeType = await prisma.noticeType.findUnique({
    where: { id },
  });

  return noticeType ? serializeNoticeType(noticeType) : null;
}

/**
 * Get a notice type by code
 */
export async function getNoticeTypeByCode(
  code: NoticeTypeCode
): Promise<SerializedNoticeType | null> {
  const noticeType = await prisma.noticeType.findUnique({
    where: { code },
  });

  return noticeType ? serializeNoticeType(noticeType) : null;
}

/**
 * Create a new notice type
 */
export async function createNoticeType(
  input: CreateNoticeTypeInput,
  userId: string
): Promise<SerializedNoticeType> {
  const noticeType = await prisma.noticeType.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      template: input.template,
      subject: input.subject ?? null,
      isActive: input.isActive ?? true,
      isSystem: input.isSystem ?? false,
      createdById: userId,
    },
  });

  return serializeNoticeType(noticeType);
}

/**
 * Update a notice type
 */
export async function updateNoticeType(
  id: string,
  input: UpdateNoticeTypeInput,
  userId: string
): Promise<SerializedNoticeType> {
  // Check if notice type exists and is not a system type
  const existing = await prisma.noticeType.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Notice type not found');
  }

  // Build update data with only defined values
  const updateData: {
    name?: string;
    description?: string;
    template?: string;
    subject?: string;
    isActive?: boolean;
    updatedById: string;
  } = { updatedById: userId };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.template !== undefined) updateData.template = input.template;
  if (input.subject !== undefined) updateData.subject = input.subject;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const noticeType = await prisma.noticeType.update({
    where: { id },
    data: updateData,
  });

  return serializeNoticeType(noticeType);
}

/**
 * Delete a notice type (only non-system types)
 */
export async function deleteNoticeType(id: string): Promise<void> {
  const existing = await prisma.noticeType.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Notice type not found');
  }

  if (existing.isSystem) {
    throw new Error('Cannot delete system notice types');
  }

  // Check if there are any history records
  const historyCount = await prisma.noticeHistory.count({
    where: { noticeTypeId: id },
  });

  if (historyCount > 0) {
    // Soft delete by marking as inactive instead
    await prisma.noticeType.update({
      where: { id },
      data: { isActive: false },
    });
  } else {
    await prisma.noticeType.delete({
      where: { id },
    });
  }
}

// ============================================================
// NOTICE GENERATION
// ============================================================

/**
 * Generate a notice for a single account
 */
async function generateNoticeForAccount(
  noticeTypeId: string,
  accountId: string,
  deliveryMethod: NoticeDeliveryMethod,
  userId: string,
  recipientId?: string
): Promise<NoticeGenerationResult> {
  try {
    // Fetch account with mailbox and ALL recipients (needed for recipientsMissingId)
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        mailbox: true,
        recipients: {
          where: { removedDate: null },
          include: {
            contactCard: {
              include: {
                phoneNumbers: true,
                emailAddresses: true,
              },
            },
          },
        },
      },
    });

    if (!account) {
      return {
        accountId,
        mailboxNumber: 0,
        success: false,
        error: 'Account not found',
      };
    }

    // Get the notice type
    const noticeType = await prisma.noticeType.findUnique({
      where: { id: noticeTypeId },
    });

    if (!noticeType) {
      return {
        accountId,
        mailboxNumber: account.mailbox.number,
        success: false,
        error: 'Notice type not found',
      };
    }

    // Get the specific recipient or primary recipient for the notice
    const recipient = recipientId
      ? account.recipients.find((r) => r.id === recipientId) ?? null
      : account.recipients.find((r) => r.isPrimary) ?? account.recipients[0] ?? null;

    // Build recipient data for template context
    const recipientData = recipient
      ? {
          recipientType: recipient.recipientType,
          firstName: recipient.firstName,
          middleName: recipient.middleName,
          lastName: recipient.lastName,
          personAlias: recipient.personAlias,
          birthdate: recipient.birthdate,
          businessName: recipient.businessName,
          businessAlias: recipient.businessAlias,
          idType: recipient.idType,
          idExpirationDate: recipient.idExpirationDate,
          contactCard: recipient.contactCard,
        }
      : null;

    // Build all recipients data for missing ID calculation
    const allRecipientsData = account.recipients.map((r) => ({
      recipientType: r.recipientType,
      firstName: r.firstName,
      middleName: r.middleName,
      lastName: r.lastName,
      personAlias: r.personAlias,
      birthdate: r.birthdate,
      businessName: r.businessName,
      businessAlias: r.businessAlias,
      idType: r.idType,
      idExpirationDate: r.idExpirationDate,
      contactCard: r.contactCard,
    }));

    // Build template context with all recipients for missing ID list
    const context = await buildTemplateContextAsync(
      {
        status: account.status,
        renewalPeriod: account.renewalPeriod,
        currentRate: account.currentRate,
        nextRenewalDate: account.nextRenewalDate,
        startDate: account.startDate,
        lastRenewalDate: account.lastRenewalDate,
        mailbox: { number: account.mailbox.number },
      },
      recipientData,
      allRecipientsData
    );

    // Render template
    const { markdown: renderedMarkdown, html: renderedContent } = renderNoticeTemplate(
      noticeType.template,
      context
    );
    const renderedSubject = renderSubject(noticeType.subject, context);

    // Get email address for delivery
    const primaryEmail =
      recipient?.contactCard?.emailAddresses.find((e) => e.isPrimary) ??
      recipient?.contactCard?.emailAddresses[0];

    // Create history record with markdown stored in variableSnapshot for PDF generation
    const noticeHistory = await prisma.noticeHistory.create({
      data: {
        noticeTypeId,
        accountId,
        recipientId: recipient?.id ?? null,
        renderedSubject,
        renderedContent,
        deliveryMethod,
        status: 'GENERATED',
        emailAddress:
          deliveryMethod !== 'PRINT' ? primaryEmail?.email ?? null : null,
        variableSnapshot: {
          ...(context as unknown as Record<string, unknown>),
          renderedMarkdown, // Store markdown for PDF generation
        },
        generatedById: userId,
      },
    });

    return {
      accountId,
      mailboxNumber: account.mailbox.number,
      success: true,
      noticeHistoryId: noticeHistory.id,
    };
  } catch (error) {
    return {
      accountId,
      mailboxNumber: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate notices for multiple accounts
 */
export async function generateNotices(
  request: NoticeGenerationRequest,
  userId: string
): Promise<NoticeGenerationResponse> {
  // Generate notices in parallel for better performance
  const promises = request.accountIds
    .filter((accountId): accountId is string => !!accountId)
    .map((accountId, i) => {
      const recipientId = request.recipientIds?.[i];
      return generateNoticeForAccount(
        request.noticeTypeId,
        accountId,
        request.deliveryMethod,
        userId,
        recipientId
      );
    });

  const results = await Promise.all(promises);
  const successful = results.filter((r) => r.success).length;

  return {
    totalRequested: request.accountIds.length,
    successful,
    failed: request.accountIds.length - successful,
    results,
  };
}

/**
 * Preview a notice template with sample data
 */
export async function previewNotice(
  request: NoticePreviewRequest
): Promise<NoticePreviewResponse> {
  // Fetch account with ALL recipients (needed for recipientsMissingId)
  const account = await prisma.account.findUnique({
    where: { id: request.accountId },
    include: {
      mailbox: true,
      recipients: {
        where: { removedDate: null },
        include: {
          contactCard: {
            include: {
              phoneNumbers: true,
              emailAddresses: true,
            },
          },
        },
      },
    },
  });

  if (!account) {
    throw new Error('Account not found');
  }

  // Get the specific recipient or primary recipient
  const recipient = request.recipientId
    ? account.recipients.find((r) => r.id === request.recipientId) ?? null
    : account.recipients.find((r) => r.isPrimary) ?? account.recipients[0] ?? null;

  // Build recipient data for template context
  const recipientData = recipient
    ? {
        recipientType: recipient.recipientType,
        firstName: recipient.firstName,
        middleName: recipient.middleName,
        lastName: recipient.lastName,
        personAlias: recipient.personAlias,
        birthdate: recipient.birthdate,
        businessName: recipient.businessName,
        businessAlias: recipient.businessAlias,
        idType: recipient.idType,
        idExpirationDate: recipient.idExpirationDate,
        contactCard: recipient.contactCard,
      }
    : null;

  // Build all recipients data for missing ID calculation
  const allRecipientsData = account.recipients.map((r) => ({
    recipientType: r.recipientType,
    firstName: r.firstName,
    middleName: r.middleName,
    lastName: r.lastName,
    personAlias: r.personAlias,
    birthdate: r.birthdate,
    businessName: r.businessName,
    businessAlias: r.businessAlias,
    idType: r.idType,
    idExpirationDate: r.idExpirationDate,
    contactCard: r.contactCard,
  }));

  // Build template context with all recipients for missing ID list
  const context = await buildTemplateContextAsync(
    {
      status: account.status,
      renewalPeriod: account.renewalPeriod,
      currentRate: account.currentRate,
      nextRenewalDate: account.nextRenewalDate,
      startDate: account.startDate,
      lastRenewalDate: account.lastRenewalDate,
      mailbox: { number: account.mailbox.number },
    },
    recipientData,
    allRecipientsData
  );

  // Render template
  const { html: renderedContent } = renderNoticeTemplate(
    request.template,
    context
  );
  const renderedSubject = request.subject
    ? renderSubject(request.subject, context)
    : null;

  return {
    renderedContent,
    renderedSubject,
    variables: context as unknown as Record<string, unknown>,
  };
}

// ============================================================
// NOTICE HISTORY
// ============================================================

/**
 * Get notice history with filtering
 */
export async function getNoticeHistory(
  filter: NoticeHistoryFilter,
  page = 1,
  pageSize = 50
): Promise<{ notices: SerializedNoticeHistory[]; total: number }> {
  const where: Record<string, unknown> = {};

  if (filter.noticeTypeId) {
    where.noticeTypeId = filter.noticeTypeId;
  }
  if (filter.accountId) {
    where.accountId = filter.accountId;
  }
  if (filter.status) {
    where.status = filter.status;
  }
  if (filter.deliveryMethod) {
    where.deliveryMethod = filter.deliveryMethod;
  }
  if (filter.dateFrom || filter.dateTo) {
    where.generatedAt = {
      ...(filter.dateFrom && { gte: new Date(filter.dateFrom) }),
      ...(filter.dateTo && { lte: new Date(filter.dateTo) }),
    };
  }

  const [notices, total] = await Promise.all([
    prisma.noticeHistory.findMany({
      where,
      include: {
        noticeType: {
          select: { code: true, name: true },
        },
        account: {
          select: {
            id: true,
            mailbox: { select: { number: true } },
          },
        },
        recipient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            businessName: true,
          },
        },
        generatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
      orderBy: { generatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.noticeHistory.count({ where }),
  ]);

  return {
    notices: notices.map((n) => ({
      id: n.id,
      noticeTypeId: n.noticeTypeId,
      accountId: n.accountId,
      recipientId: n.recipientId,
      renderedSubject: n.renderedSubject,
      renderedContent: n.renderedContent,
      deliveryMethod: n.deliveryMethod,
      status: n.status,
      emailAddress: n.emailAddress,
      sentAt: n.sentAt?.toISOString() ?? null,
      errorMessage: n.errorMessage,
      variableSnapshot: n.variableSnapshot as Record<string, unknown> | null,
      generatedById: n.generatedById,
      generatedAt: n.generatedAt.toISOString(),
      noticeType: n.noticeType,
      account: n.account,
      recipient: n.recipient,
      generatedBy: n.generatedBy,
    })),
    total,
  };
}

/**
 * Get a single notice history record
 */
export async function getNoticeHistoryById(
  id: string
): Promise<SerializedNoticeHistory | null> {
  const notice = await prisma.noticeHistory.findUnique({
    where: { id },
    include: {
      noticeType: {
        select: { code: true, name: true },
      },
      account: {
        select: {
          id: true,
          mailbox: { select: { number: true } },
        },
      },
      recipient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
      generatedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
        },
      },
    },
  });

  if (!notice) return null;

  return {
    id: notice.id,
    noticeTypeId: notice.noticeTypeId,
    accountId: notice.accountId,
    recipientId: notice.recipientId,
    renderedSubject: notice.renderedSubject,
    renderedContent: notice.renderedContent,
    deliveryMethod: notice.deliveryMethod,
    status: notice.status,
    emailAddress: notice.emailAddress,
    sentAt: notice.sentAt?.toISOString() ?? null,
    errorMessage: notice.errorMessage,
    variableSnapshot: notice.variableSnapshot as Record<string, unknown> | null,
    generatedById: notice.generatedById,
    generatedAt: notice.generatedAt.toISOString(),
    noticeType: notice.noticeType,
    account: notice.account,
    recipient: notice.recipient,
    generatedBy: notice.generatedBy,
  };
}

/**
 * Update notice status (e.g., after sending email)
 */
export async function updateNoticeStatus(
  id: string,
  status: NoticeStatus,
  errorMessage?: string
): Promise<void> {
  const updateData: {
    status: NoticeStatus;
    errorMessage?: string;
    sentAt?: Date;
  } = { status };

  if (errorMessage !== undefined) updateData.errorMessage = errorMessage;
  if (status === 'SENT') updateData.sentAt = new Date();

  await prisma.noticeHistory.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Delete a notice history record
 */
export async function deleteNoticeHistory(id: string): Promise<void> {
  await prisma.noticeHistory.delete({
    where: { id },
  });
}

// ============================================================
// ACCOUNT SELECTION
// ============================================================

/**
 * Check if a birthdate's month/day falls within the next N days
 */
function isBirthdayWithinDays(birthdate: Date, days: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Create this year's birthday
  const thisYearBirthday = new Date(
    today.getFullYear(),
    birthdate.getMonth(),
    birthdate.getDate()
  );

  // If this year's birthday has passed, check next year's
  const nextBirthday =
    thisYearBirthday < today
      ? new Date(
          today.getFullYear() + 1,
          birthdate.getMonth(),
          birthdate.getDate()
        )
      : thisYearBirthday;

  const diffTime = nextBirthday.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= days;
}

/**
 * Check if a minor is turning 18 within N days
 */
function isTurning18WithinDays(birthdate: Date, days: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate 18th birthday
  const eighteenthBirthday = new Date(birthdate);
  eighteenthBirthday.setFullYear(birthdate.getFullYear() + 18);
  eighteenthBirthday.setHours(0, 0, 0, 0);

  // If already 18 or older, return false
  if (eighteenthBirthday <= today) return false;

  const diffTime = eighteenthBirthday.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= days;
}

/**
 * Check if ID is expiring within N days
 */
function isIdExpiringWithinDays(
  idExpirationDate: Date | null,
  days: number
): boolean {
  if (!idExpirationDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expDate = new Date(idExpirationDate);
  expDate.setHours(0, 0, 0, 0);

  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Include expired IDs (negative days) and those expiring soon
  return diffDays <= days;
}

/**
 * Check if a recipient is an adult (18+) without ID on file
 */
function isAdultWithoutId(birthdate: Date | null, idType: string | null): boolean {
  // If no birthdate, assume adult for safety
  if (!birthdate) {
    return idType === null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate age
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  // Adult (18+) without ID
  return age >= 18 && idType === null;
}

/**
 * Get accounts for notice generation selection
 * Filters accounts based on notice type code for smart defaults
 */
export async function getAccountsForNoticeSelection(
  filter?: {
    status?: string;
    renewalDueSoon?: boolean;
    search?: string;
    noticeTypeCode?: NoticeTypeCode;
  },
  page = 1,
  pageSize = 50,
  idsOnly = false
): Promise<{ accounts: AccountForNotice[]; total: number }> {
  // Build base query - we'll do additional filtering in memory for complex date logic
  const where: Record<string, unknown> = {};

  // Apply status filter based on notice type code
  if (filter?.noticeTypeCode === 'HOLD_NOTICE') {
    where.status = 'HOLD';
  } else if (filter?.noticeTypeCode === 'RENEWAL_NOTICE') {
    // RENEWAL status means ACTIVE accounts with renewal within 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    where.status = 'ACTIVE';
    where.nextRenewalDate = { lte: thirtyDaysFromNow };
  } else if (filter?.status) {
    where.status = filter.status;
  }

  if (filter?.renewalDueSoon && !filter?.noticeTypeCode) {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    where.nextRenewalDate = {
      lte: thirtyDaysFromNow,
    };
    where.status = 'ACTIVE';
  }

  if (filter?.search) {
    const search = filter.search;
    where.OR = [
      { mailbox: { number: { equals: parseInt(search) || -1 } } },
      {
        recipients: {
          some: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { businessName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
  }

  // Fetch accounts with recipients
  const allAccounts = await prisma.account.findMany({
    where,
    include: {
      mailbox: { select: { number: true } },
      recipients: {
        where: { removedDate: null },
        include: {
          contactCard: {
            include: {
              emailAddresses: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
        },
      },
    },
    orderBy: { mailbox: { number: 'asc' } },
  });

  // Filter accounts based on notice type code
  let filteredAccounts = allAccounts;

  if (filter?.noticeTypeCode === 'BIRTHDAY') {
    // Filter to accounts with any recipient having birthday within 30 days
    filteredAccounts = allAccounts.filter((account) =>
      account.recipients.some(
        (r) => r.birthdate && isBirthdayWithinDays(r.birthdate, 30)
      )
    );
  } else if (filter?.noticeTypeCode === 'UPCOMING_18TH_BIRTHDAY') {
    // Filter to accounts with minor recipients turning 18 within 30 days
    filteredAccounts = allAccounts.filter((account) =>
      account.recipients.some(
        (r) => r.birthdate && isTurning18WithinDays(r.birthdate, 30)
      )
    );
  } else if (filter?.noticeTypeCode === 'ID_VERIFICATION_REQUEST') {
    // Filter to accounts with at least one recipient with expiring/expired ID
    filteredAccounts = allAccounts.filter((account) =>
      account.recipients.some((r) =>
        isIdExpiringWithinDays(r.idExpirationDate, 30)
      )
    );
  } else if (filter?.noticeTypeCode === 'MISSING_ID') {
    // Filter to accounts with at least one adult recipient without ID on file
    filteredAccounts = allAccounts.filter((account) =>
      account.recipients.some((r) => isAdultWithoutId(r.birthdate, r.idType))
    );
  }

  // Calculate total and apply pagination
  const total = filteredAccounts.length;
  const paginatedAccounts = filteredAccounts.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // For idsOnly mode, return minimal data (just id) for efficiency
  if (idsOnly) {
    return {
      accounts: paginatedAccounts.map((a) => ({
        id: a.id,
        mailboxNumber: a.mailbox.number,
        status: a.status,
        nextRenewalDate: a.nextRenewalDate.toISOString(),
        primaryRecipient: null,
      })),
      total,
    };
  }

  return {
    accounts: paginatedAccounts.map((a) => {
      // Get primary recipient or first recipient
      const recipient =
        a.recipients.find((r) => r.isPrimary) ?? a.recipients[0];
      const displayName = recipient
        ? recipient.recipientType === 'BUSINESS'
          ? recipient.businessName ?? ''
          : [recipient.firstName, recipient.lastName].filter(Boolean).join(' ')
        : '';
      const email = recipient?.contactCard?.emailAddresses[0]?.email ?? null;

      return {
        id: a.id,
        mailboxNumber: a.mailbox.number,
        status: a.status,
        nextRenewalDate: a.nextRenewalDate.toISOString(),
        primaryRecipient: recipient
          ? {
              id: recipient.id,
              displayName,
              email,
            }
          : null,
      };
    }),
    total,
  };
}

// ============================================================
// SEED DEFAULT TEMPLATES
// ============================================================

/**
 * Seed default notice types if they don't exist
 */
export async function seedDefaultNoticeTypes(userId?: string): Promise<void> {
  for (const defaultType of DEFAULT_NOTICE_TYPES) {
    const existing = await prisma.noticeType.findUnique({
      where: { code: defaultType.code },
    });

    if (!existing) {
      await prisma.noticeType.create({
        data: {
          code: defaultType.code,
          name: defaultType.name,
          description: defaultType.description,
          template: defaultType.template,
          subject: defaultType.subject,
          isSystem: defaultType.isSystem,
          isActive: true,
          createdById: userId ?? null,
        },
      });
    }
  }
}
