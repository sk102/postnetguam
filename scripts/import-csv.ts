/**
 * CSV Data Import Script for PostNet Customer Management System
 *
 * Imports customer data from ./data/customer.csv into the database.
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-csv.ts
 */

import { PrismaClient, RenewalPeriod, RecipientType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Business detection keywords
const BUSINESS_KEYWORDS = [
  'LLC',
  'Llc',
  'L L C',
  'Corp',
  'Inc',
  'Dba',
  'DBA',
  'Restaurant',
  'Church',
  'Enterprise',
  'Corporation',
  'Company',
  'Services',
  'Solutions',
  'Consulting',
  'Market',
  'Shop',
  'Store',
  'Spa',
  'Cafe',
  'Club',
  'Games',
  'Distributors',
  'Trading',
  'Travel',
  'Investments',
  'Construction',
  'Painting',
  'Flooring',
  'Exterminators',
  'Laundromart',
  'Fellowship',
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
  type: RecipientType;
  age: number | null;
  isPrimary: boolean;
  // Person fields
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  personAlias: string | null;
  // Business fields
  businessName: string | null;
  businessAlias: string | null;
}

/**
 * Parse a CSV line handling quoted fields
 */
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

/**
 * Parse date from M/D/YYYY format
 */
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

  // Handle 2-digit years
  if (year < 100) {
    year += year > 50 ? 1900 : 2000;
  }

  return new Date(year, month - 1, day);
}

/**
 * Extract age from name like "John (16)" or "Baby (1m)"
 */
function extractAge(name: string): { cleanName: string; age: number | null } {
  // Match patterns like (16), (6), (1m), (2)
  const ageMatch = name.match(/\((\d+)(m)?\)\s*$/);
  if (ageMatch) {
    const ageValue = parseInt(ageMatch[1] ?? '0', 10);
    const isMonths = ageMatch[2] === 'm';
    const age = isMonths ? 0 : ageValue; // Treat months as 0 years
    const cleanName = name.replace(/\s*\(\d+m?\)\s*$/, '').trim();
    return { cleanName, age };
  }
  return { cleanName: name.trim(), age: null };
}

/**
 * Split a single additional recipient field into multiple recipients.
 *
 * Handles these patterns:
 * - "Christian Ayap / Tyler (11)" → ["Christian Ayap", "Tyler (11)"]
 * - "Amiya Grace(8) Alric (8)" → ["Amiya Grace(8)", "Alric (8)"]
 * - "Liam (10) Cecilia Caroline (6)" → ["Liam (10)", "Cecilia Caroline (6)"]
 * - "Emanuel(6)peterson(4)" → ["Emanuel(6)", "peterson(4)"]
 */
function splitMultipleRecipients(field: string): string[] {
  if (!field || field.trim() === '') return [];

  const trimmed = field.trim();

  // First, split by "/" separator (most explicit)
  const slashParts = trimmed.split('/').map((p) => p.trim()).filter((p) => p !== '');

  const results: string[] = [];

  for (const part of slashParts) {
    // Check if this part contains multiple recipients indicated by age markers
    // Pattern: "Name1 (age1) Name2 (age2)" or "Name1(age1)Name2(age2)"
    // Regex explanation:
    // - \(\d+m?\) - matches age like (8), (10), (1m)
    // - (?:\s+(?=[A-Z])|(?=[a-zA-Z])) - followed by either:
    //   - whitespace then uppercase letter, OR
    //   - directly by any letter (handles "Emanuel(6)peterson(4)")
    const splitPattern = /(\(\d+m?\))(?:\s+(?=[A-Z])|(?=[a-zA-Z]))/g;

    // Check if the pattern exists in this part
    if (splitPattern.test(part)) {
      // Reset lastIndex since test() advances it
      splitPattern.lastIndex = 0;

      // Split by the pattern, keeping the age markers
      const subParts: string[] = [];
      let lastIndex = 0;
      let match;

      while ((match = splitPattern.exec(part)) !== null) {
        // Include up to and including the age marker
        // match[1] is guaranteed to exist since the regex has a capture group
        const ageMarker = match[1] ?? '';
        const endIndex = match.index + ageMarker.length;
        subParts.push(part.slice(lastIndex, endIndex).trim());
        lastIndex = endIndex;
      }

      // Add remaining text after the last match
      if (lastIndex < part.length) {
        const remaining = part.slice(lastIndex).trim();
        if (remaining) {
          subParts.push(remaining);
        }
      }

      results.push(...subParts.filter((p) => p !== ''));
    } else {
      // No age-based splitting needed, use the part as-is
      results.push(part);
    }
  }

  return results;
}

/**
 * Properly capitalize a name, handling special prefixes like Mc, Mac, O'
 */
function capitalizeName(name: string): string {
  if (!name) return name;

  // Handle each word separately for hyphenated or multi-word names
  return name.split(/(\s+|-)/).map((part) => {
    if (part.match(/^\s+$/) || part === '-') return part;

    const lower = part.toLowerCase();

    // Handle "Mc" prefix (McMurray, McDonald, etc.)
    if (lower.startsWith('mc') && lower.length > 2) {
      return 'Mc' + lower.charAt(2).toUpperCase() + lower.slice(3);
    }

    // Handle "Mac" prefix but not common words/names
    const macExceptions = ['mace', 'machine', 'macro', 'mach', 'mack'];
    if (lower.startsWith('mac') && lower.length > 3 && !macExceptions.some((e) => lower === e || lower.startsWith(e + 's'))) {
      return 'Mac' + lower.charAt(3).toUpperCase() + lower.slice(4);
    }

    // Handle "O'" prefix (O'Brien, O'Connor, etc.)
    if (lower.startsWith("o'") && lower.length > 2) {
      return "O'" + lower.charAt(2).toUpperCase() + lower.slice(3);
    }

    // Standard capitalization
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join('');
}

/**
 * Detect if a name represents a business
 * Uses word boundary matching to avoid false positives (e.g., "Corpuz" matching "Corp")
 */
function isBusiness(name: string): boolean {
  const upperName = name.toUpperCase();
  return BUSINESS_KEYWORDS.some((keyword) => {
    const upperKeyword = keyword.toUpperCase();
    // Use word boundary regex to match whole words only
    const regex = new RegExp(`\\b${upperKeyword}\\b`);
    return regex.test(upperName);
  });
}

/**
 * Parse a person's name into components
 */
function parsePersonName(fullName: string): {
  firstName: string;
  middleName: string | null;
  lastName: string;
  personAlias: string | null;
} {
  // Remove any trailing parenthetical content (already extracted age)
  let name = fullName.replace(/\s*\(\d+m?\)\s*$/, '').trim();

  // Check for alias in parentheses like "Lonny (Ron) P"
  let personAlias: string | null = null;
  const aliasMatch = name.match(/\(([^)]+)\)/);
  if (aliasMatch && aliasMatch[1] && !aliasMatch[1].match(/^\d+m?$/)) {
    // Apply proper capitalization to the alias
    personAlias = capitalizeName(aliasMatch[1].trim());
    name = name.replace(/\s*\([^)]+\)\s*/, ' ').trim();
  }

  // Split by spaces
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

  // 3 or more parts: first, middle(s), last
  const firstName = capitalizeName(parts[0] ?? '');
  const lastName = capitalizeName(parts[parts.length - 1] ?? '');
  const middleName = parts.slice(1, -1).map((p) => capitalizeName(p)).join(' ');

  return { firstName, middleName: middleName || null, lastName, personAlias };
}

/**
 * Parse a business name, extracting DBA if present
 */
function parseBusinessName(name: string): { businessName: string; businessAlias: string | null } {
  // Check for DBA patterns
  const dbaMatch = name.match(/^(.+?)\s*(?:Dba|DBA|dba)[:\s]*(.+)$/i);
  if (dbaMatch) {
    return {
      businessName: dbaMatch[1]?.trim() ?? name,
      businessAlias: dbaMatch[2]?.trim() ?? null,
    };
  }

  return { businessName: name.trim(), businessAlias: null };
}

/**
 * Parse recipient string into structured data
 */
function parseRecipient(name: string, isPrimary: boolean): ParsedRecipient | null {
  if (!name || name.trim() === '') return null;

  const { cleanName, age } = extractAge(name);
  if (!cleanName) return null;

  const type: RecipientType = isBusiness(cleanName) ? 'BUSINESS' : 'PERSON';

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

/**
 * Convert phone number to E.164 format
 */
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

  return null; // Invalid phone number
}

/**
 * Calculate birthdate from age and reference date
 */
function calculateBirthdate(age: number, referenceDate: Date): Date {
  const birthYear = referenceDate.getFullYear() - age;
  return new Date(birthYear, 0, 1); // January 1st of birth year (approximate)
}

/**
 * Determine renewal period based on date difference
 */
function determineRenewalPeriod(
  startDate: Date | null,
  renewalDate: Date | null
): RenewalPeriod {
  if (startDate && renewalDate) {
    const months = Math.round(
      (renewalDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    if (months >= 11 && months <= 14) return 'TWELVE_MONTH';
    if (months >= 5 && months <= 7) return 'SIX_MONTH';
  }
  return 'THREE_MONTH';
}

/**
 * Parse CSV row into structured data
 */
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

/**
 * Main import function
 */
async function importData(): Promise<void> {
  const csvPath = path.join(__dirname, '..', 'data', 'customer.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter((line) => line.trim() !== '');

  // Skip header
  const dataLines = lines.slice(1);

  console.log(`Found ${dataLines.length.toString()} accounts to import`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (!line) continue;

    try {
      const fields = parseCsvLine(line);
      const row = parseRow(fields);

      // Skip if no mailbox number
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

      // Create or get mailbox
      let mailbox = await prisma.mailbox.findUnique({
        where: { number: mailboxNumber },
        include: { accounts: { where: { status: { not: 'CLOSED' } } } },
      });

      if (!mailbox) {
        mailbox = await prisma.mailbox.create({
          data: {
            number: mailboxNumber,
            status: 'ACTIVE',
          },
          include: { accounts: { where: { status: { not: 'CLOSED' } } } },
        });
      } else if (mailbox.accounts && mailbox.accounts.length > 0) {
        // Mailbox already has an active account, skip
        console.log(`  Mailbox ${mailboxNumber.toString()}: Already has account, skipping`);
        skippedCount++;
        continue;
      } else {
        // Update mailbox status to ACTIVE
        mailbox = await prisma.mailbox.update({
          where: { id: mailbox.id },
          data: { status: 'ACTIVE' },
          include: { accounts: { where: { status: { not: 'CLOSED' } } } },
        });
      }

      // Parse primary renter (main renter)
      const primaryName = `${row.firstName} ${row.lastName}`.trim();
      const primaryRecipient = parseRecipient(primaryName, true);

      if (!primaryRecipient) {
        errors.push(`Row ${(i + 2).toString()}: Cannot parse primary renter name: ${primaryName}`);
        errorCount++;
        continue;
      }

      // Debug: Log parsed name components for verification
      if (primaryRecipient.type === 'PERSON' && primaryRecipient.middleName) {
        console.log(`  Mailbox ${mailboxNumber.toString()}: "${row.firstName}" + "${row.lastName}" → first="${primaryRecipient.firstName ?? ''}", middle="${primaryRecipient.middleName}", last="${primaryRecipient.lastName ?? ''}"${primaryRecipient.personAlias ? `, alias="${primaryRecipient.personAlias}"` : ''}`);
      }

      // Parse additional recipients
      // Each field may contain multiple recipients separated by "/" or age markers
      const additionalRecipients: ParsedRecipient[] = [];
      for (const recipientField of row.additionalRecipients) {
        // Split field into individual recipient names
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

      // Determine account status based on renewal date
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
          smsEnabled: false, // SMS is opt-in
        },
      });

      // Create recipients
      for (const recipient of allRecipients) {
        let birthdate: Date | null = null;

        // Calculate birthdate for recipients with age indicated (e.g., "Alice (4)")
        // The age in parenthesis indicates how old they were when the account was opened
        // or when the recipient was added. Use startDate as reference, fallback to today.
        if (recipient.type === 'PERSON' && recipient.age !== null) {
          const referenceDate = startDate ?? new Date();
          birthdate = calculateBirthdate(recipient.age, referenceDate);
          const isMinor = recipient.age < 18;
          console.log(`  Recipient "${recipient.name}": age ${recipient.age.toString()} → birthdate ${birthdate.toISOString().split('T')[0]}${isMinor ? ' (minor)' : ''}`);
        }

        const recipientData = await prisma.recipient.create({
          data: {
            accountId: account.id,
            isPrimary: recipient.isPrimary,
            recipientType: recipient.type,
            // Person fields
            firstName: recipient.firstName,
            middleName: recipient.middleName,
            lastName: recipient.lastName,
            personAlias: recipient.personAlias,
            // Birthdate: calculated from age if provided, null otherwise (needs to be entered later)
            birthdate,
            // Business fields
            businessName: recipient.businessName,
            businessAlias: recipient.businessAlias,
            // Form 1583 (required but we don't have dates)
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

          // Add phone numbers
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

      // Progress indicator
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
  console.log(`Skipped (already exists): ${skippedCount.toString()}`);
  console.log(`Errors: ${errorCount.toString()}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.slice(0, 20).forEach((e) => console.log(`  - ${e}`));
    if (errors.length > 20) {
      console.log(`  ... and ${(errors.length - 20).toString()} more errors`);
    }
  }
}

// Run import
importData()
  .then(() => {
    console.log('\nImport completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
