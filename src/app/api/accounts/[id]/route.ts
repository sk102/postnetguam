import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/prisma';
import { formatRecipientName } from '@/lib/utils/recipient';
import { PricingService } from '@/lib/services/pricing.service';

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

    const account = await prisma.account.findUnique({
      where: { id: params.id },
      include: {
        mailbox: true,
        recipients: {
          where: { removedDate: null },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          include: {
            contactCard: {
              include: {
                phoneNumbers: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
                emailAddresses: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
              },
            },
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Ensure all recipients have a contact card (create if missing)
    for (const r of account.recipients) {
      if (!r.contactCard) {
        const newCard = await prisma.contactCard.create({
          data: { recipientId: r.id },
        });
        r.contactCard = { ...newCard, phoneNumbers: [], emailAddresses: [] };
      }
    }

    const primaryRecipient = account.recipients.find((r) => r.isPrimary) ?? account.recipients[0];
    const phoneNumbers = primaryRecipient?.contactCard?.phoneNumbers ?? [];
    const emailAddresses = primaryRecipient?.contactCard?.emailAddresses ?? [];

    // Map all recipients with their contact info
    const recipients = account.recipients.map((r) => {
      const recipientPhones = r.contactCard?.phoneNumbers ?? [];
      const recipientEmails = r.contactCard?.emailAddresses ?? [];
      return {
        id: r.id,
        isPrimary: r.isPrimary,
        recipientType: r.recipientType,
        firstName: r.firstName,
        middleName: r.middleName,
        lastName: r.lastName,
        personAlias: r.personAlias,
        birthdate: r.birthdate?.toISOString().split('T')[0] ?? null,
        businessName: r.businessName,
        businessAlias: r.businessAlias,
        name: formatRecipientName(r),
        idType: r.idType,
        idStateCountry: r.idStateCountry,
        idExpirationDate: r.idExpirationDate?.toISOString().split('T')[0] ?? null,
        idVerifiedDate: r.idVerifiedDate?.toISOString().split('T')[0] ?? null,
        idVerifiedBy: r.idVerifiedBy,
        contactCardId: r.contactCard?.id ?? null,
        phoneNumbers: recipientPhones.map((p) => ({
          id: p.id,
          phone: p.e164Format,
          isMobile: p.isMobile,
          isPrimary: p.isPrimary,
          label: p.label,
        })),
        emailAddresses: recipientEmails.map((e) => ({
          id: e.id,
          email: e.email,
          isPrimary: e.isPrimary,
          label: e.label,
        })),
      };
    });

    return NextResponse.json({
      id: account.id,
      status: account.status,
      renewalPeriod: account.renewalPeriod,
      startDate: account.startDate.toISOString(),
      lastRenewalDate: account.lastRenewalDate?.toISOString() ?? null,
      nextRenewalDate: account.nextRenewalDate.toISOString(),
      currentRate: account.currentRate.toString(),
      depositPaid: account.depositPaid.toString(),
      depositReturned: account.depositReturned,
      smsEnabled: account.smsEnabled,
      emailEnabled: account.emailEnabled,
      closedAt: account.closedAt?.toISOString() ?? null,
      closureReason: account.closureReason,
      auditFlag: account.auditFlag,
      auditNote: account.auditNote,
      auditedAt: account.auditedAt?.toISOString() ?? null,
      mailbox: {
        id: account.mailbox.id,
        number: account.mailbox.number,
        status: account.mailbox.status,
        keyDeposit: account.mailbox.keyDeposit.toString(),
      },
      recipients,
      primaryRecipient: primaryRecipient
        ? {
            id: primaryRecipient.id,
            contactCardId: primaryRecipient.contactCard?.id ?? null,
            recipientType: primaryRecipient.recipientType,
            firstName: primaryRecipient.firstName,
            lastName: primaryRecipient.lastName,
            businessName: primaryRecipient.businessName,
          }
        : null,
      phoneNumbers: phoneNumbers.map((p) => ({
        id: p.id,
        phone: p.e164Format,
        isMobile: p.isMobile,
        isPrimary: p.isPrimary,
        label: p.label,
      })),
      emailAddresses: emailAddresses.map((e) => ({
        id: e.id,
        email: e.email,
        isPrimary: e.isPrimary,
        label: e.label,
      })),
    });
  } catch (error) {
    console.error('Account detail API error:', error);
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

    // Validate that account exists
    const existing = await prisma.account.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Build update data with only allowed fields
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) {
      const validStatuses = ['ACTIVE', 'HOLD', 'CLOSED'];
      if (!validStatuses.includes(body.status as string)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = body.status;

      // If closing account, set closedAt
      if (body.status === 'CLOSED' && existing.status !== 'CLOSED') {
        updateData.closedAt = new Date();
      }
      // If reopening account, clear closedAt
      if (body.status !== 'CLOSED' && existing.status === 'CLOSED') {
        updateData.closedAt = null;
        updateData.closureReason = null;
      }
    }

    if (body.renewalPeriod !== undefined) {
      const validPeriods = ['THREE_MONTH', 'SIX_MONTH', 'TWELVE_MONTH'];
      if (!validPeriods.includes(body.renewalPeriod as string)) {
        return NextResponse.json({ error: 'Invalid renewal period' }, { status: 400 });
      }
      updateData.renewalPeriod = body.renewalPeriod;
    }

    if (body.currentRate !== undefined) {
      const rate = parseFloat(body.currentRate as string);
      if (isNaN(rate) || rate < 0) {
        return NextResponse.json({ error: 'Invalid rate' }, { status: 400 });
      }
      updateData.currentRate = rate;
    }

    if (body.nextRenewalDate !== undefined) {
      const date = new Date(body.nextRenewalDate as string);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ error: 'Invalid next renewal date' }, { status: 400 });
      }
      updateData.nextRenewalDate = date;
    }

    if (body.smsEnabled !== undefined) {
      updateData.smsEnabled = Boolean(body.smsEnabled);
    }

    if (body.emailEnabled !== undefined) {
      updateData.emailEnabled = Boolean(body.emailEnabled);
    }

    if (body.closureReason !== undefined) {
      updateData.closureReason = body.closureReason || null;
    }

    // Handle mailbox reassignment
    if (body.mailboxId !== undefined && body.mailboxId !== existing.mailboxId) {
      const newMailbox = await prisma.mailbox.findUnique({
        where: { id: body.mailboxId as string },
      });

      if (!newMailbox) {
        return NextResponse.json({ error: 'New mailbox not found' }, { status: 404 });
      }

      if (newMailbox.status !== 'AVAILABLE') {
        return NextResponse.json({ error: 'New mailbox is not available' }, { status: 400 });
      }

      // Reassign mailbox in a transaction
      await prisma.$transaction([
        // Set old mailbox to AVAILABLE
        prisma.mailbox.update({
          where: { id: existing.mailboxId },
          data: { status: 'AVAILABLE' },
        }),
        // Set new mailbox to ACTIVE
        prisma.mailbox.update({
          where: { id: newMailbox.id },
          data: { status: 'ACTIVE' },
        }),
      ]);

      updateData.mailboxId = body.mailboxId;
    }

    const updated = await prisma.account.update({
      where: { id: params.id },
      data: updateData,
      include: {
        mailbox: true,
      },
    });

    // Handle phone number updates
    if (Array.isArray(body.phoneNumbers)) {
      for (const phone of body.phoneNumbers as Array<Record<string, unknown>>) {
        if (phone.id && phone._delete) {
          // Delete phone number
          await prisma.phoneNumber.delete({ where: { id: phone.id as string } });
        } else if (phone.id) {
          // Update existing phone number
          await prisma.phoneNumber.update({
            where: { id: phone.id as string },
            data: {
              e164Format: phone.phone as string,
              isMobile: Boolean(phone.isMobile),
              isPrimary: Boolean(phone.isPrimary),
              label: (phone.label as string) || null,
            },
          });
        } else if (phone.contactCardId && phone.phone) {
          // Create new phone number
          await prisma.phoneNumber.create({
            data: {
              contactCardId: phone.contactCardId as string,
              e164Format: phone.phone as string,
              isMobile: Boolean(phone.isMobile),
              isPrimary: Boolean(phone.isPrimary),
              label: (phone.label as string) || null,
            },
          });
        }
      }
    }

    // Handle email address updates
    if (Array.isArray(body.emailAddresses)) {
      for (const email of body.emailAddresses as Array<Record<string, unknown>>) {
        if (email.id && email._delete) {
          // Delete email address
          await prisma.emailAddress.delete({ where: { id: email.id as string } });
        } else if (email.id) {
          // Update existing email address
          await prisma.emailAddress.update({
            where: { id: email.id as string },
            data: {
              email: (email.email as string).toLowerCase(),
              isPrimary: Boolean(email.isPrimary),
              label: (email.label as string) || null,
            },
          });
        } else if (email.contactCardId && email.email) {
          // Create new email address
          await prisma.emailAddress.create({
            data: {
              contactCardId: email.contactCardId as string,
              email: (email.email as string).toLowerCase(),
              isPrimary: Boolean(email.isPrimary),
              label: (email.label as string) || null,
            },
          });
        }
      }
    }

    // Handle recipient updates
    if (Array.isArray(body.recipients)) {
      // First, check if any recipient is being promoted to primary
      for (const recipient of body.recipients as Array<Record<string, unknown>>) {
        if (recipient.isPrimary === true && recipient.id && !recipient._delete) {
          // Demote all other recipients for this account
          await prisma.recipient.updateMany({
            where: {
              accountId: params.id,
              id: { not: recipient.id as string },
              isPrimary: true,
            },
            data: { isPrimary: false },
          });
          break; // Only one can be primary, so we're done
        }
      }

      for (const recipient of body.recipients as Array<Record<string, unknown>>) {
        if (recipient.id && recipient._delete) {
          // Soft delete recipient by setting removedDate
          await prisma.recipient.update({
            where: { id: recipient.id as string },
            data: { removedDate: new Date() },
          });
        } else if (recipient.id) {
          // Update existing recipient
          const recipientType = recipient.recipientType as string;
          const birthdateValue = recipient.birthdate
            ? new Date(recipient.birthdate as string)
            : null;
          if (recipientType === 'BUSINESS') {
            await prisma.recipient.update({
              where: { id: recipient.id as string },
              data: {
                recipientType: 'BUSINESS',
                businessName: (recipient.businessName as string) || null,
                businessAlias: (recipient.businessAlias as string) || null,
                // Clear person fields when converting to business
                firstName: null,
                middleName: null,
                lastName: null,
                personAlias: null,
                birthdate: null,
                // Clear ID verification fields for business
                idType: null,
                idStateCountry: null,
                idExpirationDate: null,
                idVerifiedDate: null,
                idVerifiedBy: null,
                isPrimary: Boolean(recipient.isPrimary),
              },
            });
          } else {
            const idExpirationValue = recipient.idExpirationDate
              ? new Date(recipient.idExpirationDate as string)
              : null;
            const idVerifiedValue = recipient.idVerifiedDate
              ? new Date(recipient.idVerifiedDate as string)
              : null;
            await prisma.recipient.update({
              where: { id: recipient.id as string },
              data: {
                recipientType: 'PERSON',
                firstName: (recipient.firstName as string) || null,
                middleName: (recipient.middleName as string) || null,
                lastName: (recipient.lastName as string) || null,
                personAlias: (recipient.personAlias as string) || null,
                birthdate: birthdateValue,
                // ID verification fields
                idType: (recipient.idType as string) || null,
                idStateCountry: (recipient.idStateCountry as string) || null,
                idExpirationDate: idExpirationValue,
                idVerifiedDate: idVerifiedValue,
                idVerifiedBy: (recipient.idVerifiedBy as string) || null,
                // Clear business fields when converting to person
                businessName: null,
                businessAlias: null,
                isPrimary: Boolean(recipient.isPrimary),
              },
            });
          }
        } else if (recipient._isNew) {
          // Create new recipient with contact card
          const recipientType = (recipient.recipientType as string) || 'PERSON';
          const newBirthdateValue = recipientType === 'PERSON' && recipient.birthdate
            ? new Date(recipient.birthdate as string)
            : null;
          const newIdExpirationValue = recipientType === 'PERSON' && recipient.idExpirationDate
            ? new Date(recipient.idExpirationDate as string)
            : null;
          const newIdVerifiedValue = recipientType === 'PERSON' && recipient.idVerifiedDate
            ? new Date(recipient.idVerifiedDate as string)
            : null;
          const newRecipient = await prisma.recipient.create({
            data: {
              accountId: params.id,
              recipientType: recipientType as 'PERSON' | 'BUSINESS',
              isPrimary: Boolean(recipient.isPrimary),
              firstName: recipientType === 'PERSON' ? (recipient.firstName as string) || null : null,
              middleName: recipientType === 'PERSON' ? (recipient.middleName as string) || null : null,
              lastName: recipientType === 'PERSON' ? (recipient.lastName as string) || null : null,
              personAlias: recipientType === 'PERSON' ? (recipient.personAlias as string) || null : null,
              birthdate: newBirthdateValue,
              idType: recipientType === 'PERSON' ? (recipient.idType as string) || null : null,
              idStateCountry: recipientType === 'PERSON' ? (recipient.idStateCountry as string) || null : null,
              idExpirationDate: newIdExpirationValue,
              idVerifiedDate: newIdVerifiedValue,
              idVerifiedBy: recipientType === 'PERSON' ? (recipient.idVerifiedBy as string) || null : null,
              businessName: recipientType === 'BUSINESS' ? (recipient.businessName as string) || null : null,
              businessAlias: recipientType === 'BUSINESS' ? (recipient.businessAlias as string) || null : null,
            },
          });
          // Create contact card for the new recipient
          await prisma.contactCard.create({
            data: {
              recipientId: newRecipient.id,
            },
          });
        }
      }
    }

    // Recalculate expected rate and update audit flag based on discrepancy
    // This should run after any recipient changes or rate changes
    const recipientsChanged = Array.isArray(body.recipients) && body.recipients.length > 0;
    const rateChanged = body.currentRate !== undefined;

    if (recipientsChanged || rateChanged) {
      const accountAfterUpdate = await prisma.account.findUnique({
        where: { id: params.id },
        include: {
          recipients: {
            where: { removedDate: null },
          },
        },
      });

      if (accountAfterUpdate) {
        // Get the rate date - use lastRenewalDate if available, otherwise startDate
        const rateDate = accountAfterUpdate.lastRenewalDate ?? accountAfterUpdate.startDate;
        const rates = await PricingService.getRatesForDate(rateDate);

        if (rates) {
          const analysis = PricingService.analyzeRecipients(accountAfterUpdate.recipients);
          const breakdown = PricingService.calculatePriceBreakdown(rates, {
            renewalPeriod: accountAfterUpdate.renewalPeriod,
            adultRecipientCount: analysis.adultCount,
            minorRecipientCount: analysis.minorCount,
            hasBusinessRecipient: analysis.hasBusinessRecipient,
          });

          const currentRate = parseFloat(accountAfterUpdate.currentRate.toString());
          const expectedRate = breakdown.totalMonthly;
          const discrepancy = Math.abs(currentRate - expectedRate);

          if (discrepancy <= 0.01) {
            // If discrepancy is within tolerance, clear the audit flag
            await prisma.account.update({
              where: { id: params.id },
              data: {
                auditFlag: false,
                auditNote: null,
                auditedAt: null,
              },
            });
          } else {
            // If there's a discrepancy, set the audit flag
            const auditNote = `Expected: $${expectedRate.toFixed(2)}, Current: $${currentRate.toFixed(2)}. Difference: $${discrepancy.toFixed(2)}`;
            await prisma.account.update({
              where: { id: params.id },
              data: {
                auditFlag: true,
                auditNote,
                auditedAt: new Date(),
              },
            });
          }
        }
      }
    }

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      renewalPeriod: updated.renewalPeriod,
      currentRate: updated.currentRate.toString(),
      nextRenewalDate: updated.nextRenewalDate.toISOString(),
      smsEnabled: updated.smsEnabled,
      emailEnabled: updated.emailEnabled,
    });
  } catch (error) {
    console.error('Account update API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
