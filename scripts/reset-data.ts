/**
 * Reset Data Script for PostNet Customer Management System
 *
 * This script:
 * 1. Purges all data from the database
 * 2. Runs the seed logic (users, rates, store settings, mailboxes)
 * 3. Imports customer data from ./data/customer.csv
 *
 * Run with: npx tsx scripts/reset-data.ts
 */

import { PrismaClient, NoticeTypeCode } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { STORE } from '../src/constants/app';
import { DEFAULT_NOTICE_TYPES } from '../src/constants/notice';

const prisma = new PrismaClient();
const PASSWORD_ROUNDS = 12;

// ============================================================
// PURGE FUNCTIONS
// ============================================================

async function purgeDatabase(): Promise<void> {
  console.log('\n=== Purging Database ===\n');

  // Delete in order to respect foreign key constraints
  // Order matters: delete child tables before parent tables

  console.log('Deleting notice history...');
  await prisma.noticeHistory.deleteMany();

  console.log('Deleting notice types...');
  await prisma.noticeType.deleteMany();

  console.log('Deleting SMS logs...');
  await prisma.smsLog.deleteMany();

  console.log('Deleting reminders...');
  await prisma.reminder.deleteMany();

  console.log('Deleting payments...');
  await prisma.payment.deleteMany();

  console.log('Deleting memos...');
  await prisma.memo.deleteMany();

  console.log('Deleting phone numbers...');
  await prisma.phoneNumber.deleteMany();

  console.log('Deleting email addresses...');
  await prisma.emailAddress.deleteMany();

  console.log('Deleting contact cards...');
  await prisma.contactCard.deleteMany();

  console.log('Deleting recipients...');
  await prisma.recipient.deleteMany();

  console.log('Deleting accounts...');
  await prisma.account.deleteMany();

  console.log('Deleting audit logs...');
  await prisma.auditLog.deleteMany();

  console.log('Deleting user phone numbers...');
  await prisma.userPhoneNumber.deleteMany();

  console.log('Deleting user email addresses...');
  await prisma.userEmailAddress.deleteMany();

  console.log('Deleting rate history...');
  await prisma.rateHistory.deleteMany();

  console.log('Deleting store settings...');
  await prisma.storeSettings.deleteMany();

  console.log('Deleting mailboxes...');
  await prisma.mailbox.deleteMany();

  console.log('Deleting users...');
  await prisma.user.deleteMany();

  console.log('\nDatabase purged successfully!\n');
}

// ============================================================
// SEED FUNCTIONS
// ============================================================

async function seedDatabase(): Promise<string> {
  console.log('\n=== Seeding Database ===\n');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('ChangeMe123!', PASSWORD_ROUNDS);
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@postnetguam.com',
      passwordHash: adminPasswordHash,
      role: 'MANAGER',
      isActive: true,
    },
  });
  console.log('Created admin user:', admin.username);

  // Create staff user
  const staffPasswordHash = await bcrypt.hash('StaffPass123!', PASSWORD_ROUNDS);
  const staff = await prisma.user.create({
    data: {
      username: 'staff',
      email: 'staff@postnetguam.com',
      passwordHash: staffPasswordHash,
      role: 'STAFF',
      isActive: true,
    },
  });
  console.log('Created staff user:', staff.username);

  // Create initial rate history
  const rateHistory = await prisma.rateHistory.create({
    data: {
      startDate: new Date('2023-01-01'),
      endDate: null,
      baseRate3mo: 51.0,
      baseRate6mo: 102.0,
      baseRate12mo: 204.0,
      rate4thAdult: 2.0,
      rate5thAdult: 2.0,
      rate6thAdult: 2.0,
      rate7thAdult: 2.0,
      keyDeposit: 5.0,
      businessAccountFee: 4.0,
      minorRecipientFee: 0.0,
      createdById: admin.id,
      notes: 'Initial pricing configuration',
    },
  });
  console.log('Created rate history starting:', rateHistory.startDate.toISOString());

  // Create store settings
  const storeSettings = await prisma.storeSettings.create({
    data: {
      name: STORE.NAME,
      street1: STORE.STREET1,
      street2: STORE.STREET2,
      city: STORE.CITY,
      zip: STORE.ZIP,
      phone: STORE.PHONE,
      email: STORE.EMAIL,
      hours: STORE.HOURS,
      updatedById: admin.id,
    },
  });
  console.log('Created store settings:', storeSettings.name);

  // Create mailboxes 1-2000
  console.log('Creating mailboxes 1-2000...');
  const mailboxData = Array.from({ length: 2000 }, (_, i) => ({
    number: i + 1,
    status: 'AVAILABLE' as const,
  }));

  await prisma.mailbox.createMany({
    data: mailboxData,
  });
  console.log('Created 2000 mailboxes');

  // Create default notice types
  console.log('Creating default notice types...');
  for (const noticeType of DEFAULT_NOTICE_TYPES) {
    await prisma.noticeType.create({
      data: {
        code: noticeType.code as NoticeTypeCode,
        name: noticeType.name,
        description: noticeType.description,
        subject: noticeType.subject,
        template: noticeType.template,
        isSystem: noticeType.isSystem,
        isActive: true,
        createdById: admin.id,
      },
    });
  }
  console.log(`Created ${DEFAULT_NOTICE_TYPES.length} notice types`);

  console.log('\nSeeding completed!\n');

  return admin.id;
}

// ============================================================
// CSV IMPORT FUNCTIONS (from import-csv.ts)
// ============================================================

const BUSINESS_KEYWORDS = [
  'LLC', 'Llc', 'L L C', 'Corp', 'Inc', 'Dba', 'DBA', 'Restaurant', 'Church',
  'Enterprise', 'Corporation', 'Company', 'Services', 'Solutions', 'Consulting',
  'Market', 'Shop', 'Store', 'Spa', 'Cafe', 'Club', 'Games', 'Distributors',
  'Trading', 'Travel', 'Investments', 'Construction', 'Painting', 'Flooring',
  'Exterminators', 'Laundromart', 'Fellowship',
];

interface CsvRow {
  additionalRecipients: string[];
  contactNo: string;
  dateRenewed: string;
  firstName: string;
  initial: string;
  comment: string;
  lastName: string;
  mailboxNo: string;
  noNeed: string;
  monthlyRate: string;
  renewalDate: string;
  startDate: string;
  workNo: string;
}

interface ParsedRecipient {
  name: string;
  type: 'PERSON' | 'BUSINESS';
  age: number | null;
  isPrimary: boolean;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  personAlias: string | null;
  businessName: string | null;
  businessAlias: string | null;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === '00/00' || dateStr === '00/00/0000' || dateStr === '00/00/00') {
    return null;
  }

  const parts = dateStr.split('/');
  if (parts.length < 3) return null;

  const month = parseInt(parts[0] ?? '0', 10);
  const day = parseInt(parts[1] ?? '0', 10);
  let year = parseInt(parts[2] ?? '0', 10);

  if (month === 0 || day === 0 || year === 0) return null;

  if (year < 100) {
    year += year > 50 ? 1900 : 2000;
  }

  return new Date(year, month - 1, day);
}

function extractAge(name: string): { cleanName: string; age: number | null } {
  const ageMatch = name.match(/\((\d+)(m)?\)\s*$/);
  if (ageMatch) {
    const ageValue = parseInt(ageMatch[1] ?? '0', 10);
    const isMonths = ageMatch[2] === 'm';
    const age = isMonths ? 0 : ageValue;
    const cleanName = name.replace(/\s*\(\d+m?\)\s*$/, '').trim();
    return { cleanName, age };
  }
  return { cleanName: name.trim(), age: null };
}

function splitMultipleRecipients(field: string): string[] {
  if (!field || field.trim() === '') return [];

  const trimmed = field.trim();
  const slashParts = trimmed.split('/').map((p) => p.trim()).filter((p) => p !== '');
  const results: string[] = [];

  for (const part of slashParts) {
    // Pattern handles both "Name(6) Name2(4)" and "Name(6)name2(4)" (no space, lowercase)
    const splitPattern = /(\(\d+m?\))(?:\s+(?=[A-Z])|(?=[a-zA-Z]))/g;

    if (splitPattern.test(part)) {
      splitPattern.lastIndex = 0;
      const subParts: string[] = [];
      let lastIndex = 0;
      let match;

      while ((match = splitPattern.exec(part)) !== null) {
        const ageMarker = match[1] ?? '';
        const endIndex = match.index + ageMarker.length;
        subParts.push(part.slice(lastIndex, endIndex).trim());
        lastIndex = endIndex;
      }

      if (lastIndex < part.length) {
        const remaining = part.slice(lastIndex).trim();
        if (remaining) {
          subParts.push(remaining);
        }
      }

      results.push(...subParts.filter((p) => p !== ''));
    } else {
      results.push(part);
    }
  }

  return results;
}

function capitalizeName(name: string): string {
  if (!name) return name;

  return name.split(/(\s+|-)/).map((part) => {
    if (part.match(/^\s+$/) || part === '-') return part;

    const lower = part.toLowerCase();

    if (lower.startsWith('mc') && lower.length > 2) {
      return 'Mc' + lower.charAt(2).toUpperCase() + lower.slice(3);
    }

    const macExceptions = ['mace', 'machine', 'macro', 'mach', 'mack'];
    if (lower.startsWith('mac') && lower.length > 3 && !macExceptions.some((e) => lower === e || lower.startsWith(e + 's'))) {
      return 'Mac' + lower.charAt(3).toUpperCase() + lower.slice(4);
    }

    if (lower.startsWith("o'") && lower.length > 2) {
      return "O'" + lower.charAt(2).toUpperCase() + lower.slice(3);
    }

    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join('');
}

function isBusiness(name: string): boolean {
  const upperName = name.toUpperCase();
  return BUSINESS_KEYWORDS.some((keyword) => {
    const upperKeyword = keyword.toUpperCase();
    const regex = new RegExp(`\\b${upperKeyword}\\b`);
    return regex.test(upperName);
  });
}

function parsePersonName(fullName: string): {
  firstName: string;
  middleName: string | null;
  lastName: string;
  personAlias: string | null;
} {
  let name = fullName.replace(/\s*\(\d+m?\)\s*$/, '').trim();

  let personAlias: string | null = null;
  const aliasMatch = name.match(/\(([^)]+)\)/);
  if (aliasMatch && aliasMatch[1] && !aliasMatch[1].match(/^\d+m?$/)) {
    personAlias = capitalizeName(aliasMatch[1].trim());
    name = name.replace(/\s*\([^)]+\)\s*/, ' ').trim();
  }

  const parts = name.split(/\s+/).filter((p) => p.length > 0);

  if (parts.length === 0) {
    return { firstName: '', middleName: null, lastName: '', personAlias };
  }

  if (parts.length === 1) {
    return { firstName: capitalizeName(parts[0] ?? ''), middleName: null, lastName: '', personAlias };
  }

  if (parts.length === 2) {
    return {
      firstName: capitalizeName(parts[0] ?? ''),
      middleName: null,
      lastName: capitalizeName(parts[1] ?? ''),
      personAlias,
    };
  }

  const firstName = capitalizeName(parts[0] ?? '');
  const lastName = capitalizeName(parts[parts.length - 1] ?? '');
  const middleName = parts.slice(1, -1).map((p) => capitalizeName(p)).join(' ');

  return { firstName, middleName: middleName || null, lastName, personAlias };
}

function parseBusinessName(name: string): { businessName: string; businessAlias: string | null } {
  const dbaMatch = name.match(/^(.+?)\s*(?:Dba|DBA|dba)[:\s]*(.+)$/i);
  if (dbaMatch) {
    return {
      businessName: dbaMatch[1]?.trim() ?? name,
      businessAlias: dbaMatch[2]?.trim() ?? null,
    };
  }

  return { businessName: name.trim(), businessAlias: null };
}

function parseRecipient(name: string, isPrimary: boolean): ParsedRecipient | null {
  if (!name || name.trim() === '') return null;

  const { cleanName, age } = extractAge(name);
  if (!cleanName) return null;

  const type = isBusiness(cleanName) ? 'BUSINESS' : 'PERSON';

  if (type === 'BUSINESS') {
    const { businessName, businessAlias } = parseBusinessName(cleanName);
    return {
      name: cleanName,
      type,
      age: null,
      isPrimary,
      firstName: null,
      middleName: null,
      lastName: null,
      personAlias: null,
      businessName,
      businessAlias,
    };
  } else {
    const { firstName, middleName, lastName, personAlias } = parsePersonName(cleanName);
    return {
      name: cleanName,
      type,
      age,
      isPrimary,
      firstName,
      middleName,
      lastName,
      personAlias,
      businessName: null,
      businessAlias: null,
    };
  }
}

function toE164(input: string): string | null {
  if (!input || input.trim() === '') return null;

  const digits = input.replace(/\D/g, '');

  if (digits.length === 7) {
    return `+1671${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (digits.length > 10) {
    return `+${digits}`;
  }

  return null;
}

function calculateBirthdate(age: number, referenceDate: Date): Date {
  const birthYear = referenceDate.getFullYear() - age;
  return new Date(birthYear, 0, 1);
}

function determineRenewalPeriod(
  startDate: Date | null,
  renewalDate: Date | null
): 'THREE_MONTH' | 'SIX_MONTH' | 'TWELVE_MONTH' {
  if (startDate && renewalDate) {
    const months = Math.round(
      (renewalDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    if (months >= 11 && months <= 14) return 'TWELVE_MONTH';
    if (months >= 5 && months <= 7) return 'SIX_MONTH';
  }
  return 'THREE_MONTH';
}

function parseRow(fields: string[]): CsvRow {
  return {
    additionalRecipients: [
      fields[0] ?? '',
      fields[1] ?? '',
      fields[2] ?? '',
      fields[3] ?? '',
      fields[4] ?? '',
    ].filter((r) => r.trim() !== ''),
    contactNo: fields[5] ?? '',
    dateRenewed: fields[6] ?? '',
    firstName: fields[7] ?? '',
    initial: fields[8] ?? '',
    comment: fields[9] ?? '',
    lastName: fields[10] ?? '',
    mailboxNo: fields[11] ?? '',
    noNeed: fields[12] ?? '',
    monthlyRate: fields[14] ?? '',
    renewalDate: fields[15] ?? '',
    startDate: fields[16] ?? '',
    workNo: fields[17] ?? '',
  };
}

async function importCsvData(): Promise<void> {
  console.log('\n=== Importing CSV Data ===\n');

  const csvPath = path.join(__dirname, '..', 'data', 'customer.csv');

  if (!fs.existsSync(csvPath)) {
    console.log('CSV file not found at:', csvPath);
    console.log('Skipping CSV import.');
    return;
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter((line) => line.trim() !== '');

  const dataLines = lines.slice(1);

  console.log(`Found ${dataLines.length.toString()} accounts to import`);

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (!line) continue;

    try {
      const fields = parseCsvLine(line);
      const row = parseRow(fields);

      if (!row.mailboxNo || row.mailboxNo.trim() === '') {
        errors.push(`Row ${(i + 2).toString()}: Missing mailbox number`);
        errorCount++;
        continue;
      }

      const mailboxNumber = parseInt(row.mailboxNo.trim(), 10);
      if (isNaN(mailboxNumber)) {
        errors.push(`Row ${(i + 2).toString()}: Invalid mailbox number: ${row.mailboxNo}`);
        errorCount++;
        continue;
      }

      const startDate = parseDate(row.startDate);
      const renewalDate = parseDate(row.renewalDate);
      const dateRenewed = parseDate(row.dateRenewed);
      const monthlyRate = parseFloat(row.monthlyRate) || 0;

      // Get mailbox (should exist from seeding)
      const mailbox = await prisma.mailbox.findUnique({
        where: { number: mailboxNumber },
      });

      if (!mailbox) {
        errors.push(`Row ${(i + 2).toString()}: Mailbox ${mailboxNumber.toString()} not found`);
        errorCount++;
        continue;
      }

      // Update mailbox status to ACTIVE
      await prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { status: 'ACTIVE' },
      });

      // Parse primary renter
      const primaryName = `${row.firstName} ${row.lastName}`.trim();
      const primaryRecipient = parseRecipient(primaryName, true);

      if (!primaryRecipient) {
        errors.push(`Row ${(i + 2).toString()}: Cannot parse primary renter name: ${primaryName}`);
        errorCount++;
        continue;
      }

      // Parse additional recipients
      const additionalRecipients: ParsedRecipient[] = [];
      for (const recipientField of row.additionalRecipients) {
        const individualNames = splitMultipleRecipients(recipientField);
        for (const recipientName of individualNames) {
          const parsed = parseRecipient(recipientName, false);
          if (parsed) {
            additionalRecipients.push(parsed);
          }
        }
      }

      const allRecipients = [primaryRecipient, ...additionalRecipients];

      // Determine renewal period
      const renewalPeriod = determineRenewalPeriod(startDate, renewalDate);

      // Determine account status
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue = renewalDate && renewalDate < today;
      const accountStatus = isOverdue ? 'HOLD' : 'ACTIVE';

      // Create account
      const account = await prisma.account.create({
        data: {
          mailboxId: mailbox.id,
          status: accountStatus,
          renewalPeriod,
          startDate: startDate ?? new Date(),
          lastRenewalDate: dateRenewed,
          nextRenewalDate: renewalDate ?? new Date(),
          currentRate: monthlyRate,
          depositPaid: 5.0,
          smsEnabled: false,
        },
      });

      // Create recipients
      for (const recipient of allRecipients) {
        let birthdate: Date | null = null;

        if (recipient.type === 'PERSON' && recipient.age !== null) {
          const referenceDate = startDate ?? new Date();
          birthdate = calculateBirthdate(recipient.age, referenceDate);
        }

        const recipientData = await prisma.recipient.create({
          data: {
            accountId: account.id,
            isPrimary: recipient.isPrimary,
            recipientType: recipient.type,
            firstName: recipient.firstName,
            middleName: recipient.middleName,
            lastName: recipient.lastName,
            personAlias: recipient.personAlias,
            birthdate,
            businessName: recipient.businessName,
            businessAlias: recipient.businessAlias,
            form1583SignedDate: startDate,
            addedDate: startDate ?? new Date(),
          },
        });

        // Create contact card for primary recipient
        if (recipient.isPrimary) {
          const contactCard = await prisma.contactCard.create({
            data: {
              recipientId: recipientData.id,
            },
          });

          const contactPhone = toE164(row.contactNo);
          const workPhone = toE164(row.workNo);

          if (contactPhone) {
            await prisma.phoneNumber.create({
              data: {
                contactCardId: contactCard.id,
                e164Format: contactPhone,
                isMobile: true,
                isPrimary: true,
                label: 'Cell',
              },
            });
          }

          if (workPhone && workPhone !== contactPhone) {
            await prisma.phoneNumber.create({
              data: {
                contactCardId: contactCard.id,
                e164Format: workPhone,
                isMobile: false,
                isPrimary: contactPhone === null,
                label: 'Work',
              },
            });
          }
        }
      }

      successCount++;

      if ((i + 1) % 100 === 0) {
        console.log(`Processed ${(i + 1).toString()}/${dataLines.length.toString()} rows...`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Row ${(i + 2).toString()}: ${message}`);
      errorCount++;
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`Successful: ${successCount.toString()}`);
  console.log(`Errors: ${errorCount.toString()}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.slice(0, 20).forEach((e) => console.log(`  - ${e}`));
    if (errors.length > 20) {
      console.log(`  ... and ${(errors.length - 20).toString()} more errors`);
    }
  }
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         PostNet Database Reset Script                      ║');
  console.log('║  This will PURGE ALL DATA and reload from scratch          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Step 1: Purge
  await purgeDatabase();

  // Step 2: Seed
  await seedDatabase();

  // Step 3: Import CSV
  await importCsvData();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         Reset Complete!                                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Reset failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
