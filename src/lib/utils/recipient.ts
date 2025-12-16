/**
 * Recipient name formatting utilities
 */

import { Prisma } from '@prisma/client';

interface RecipientNameFields {
  recipientType: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  personAlias?: string | null;
  businessName?: string | null;
  businessAlias?: string | null;
}

/**
 * Formats a recipient's display name
 * Person format: {firstName} {middleName} "{alias}" {lastName}
 * Business format: {businessName} (DBA: {businessAlias})
 */
export function formatRecipientName(recipient: RecipientNameFields): string {
  if (recipient.recipientType === 'BUSINESS') {
    if (!recipient.businessName) return 'Unknown Business';
    if (recipient.businessAlias) {
      return `${recipient.businessName} (DBA: ${recipient.businessAlias})`;
    }
    return recipient.businessName;
  }

  // Person
  const parts: string[] = [];

  if (recipient.firstName) {
    parts.push(recipient.firstName);
  }

  if (recipient.middleName) {
    parts.push(recipient.middleName);
  }

  if (recipient.personAlias) {
    parts.push(`"${recipient.personAlias}"`);
  }

  if (recipient.lastName) {
    parts.push(recipient.lastName);
  }

  return parts.join(' ') || 'Unknown';
}

/**
 * Builds a Prisma where clause for searching recipient names.
 * Supports full name search by splitting the search term into words
 * and requiring all words to match on the same recipient.
 *
 * Example: "Amara Acosta" will match a recipient with firstName="Amara" and lastName="Acosta"
 */
export function buildRecipientNameSearch(search: string): Prisma.RecipientWhereInput | null {
  if (!search.trim()) return null;

  // Split search into words, filtering out empty strings
  const searchWords = search.trim().split(/\s+/).filter(word => word.length > 0);

  if (searchWords.length === 0) return null;

  // For each word, create an OR condition matching any name field
  const wordConditions: Prisma.RecipientWhereInput[] = searchWords.map(word => ({
    OR: [
      { firstName: { contains: word, mode: 'insensitive' as const } },
      { middleName: { contains: word, mode: 'insensitive' as const } },
      { lastName: { contains: word, mode: 'insensitive' as const } },
      { personAlias: { contains: word, mode: 'insensitive' as const } },
      { businessName: { contains: word, mode: 'insensitive' as const } },
      { businessAlias: { contains: word, mode: 'insensitive' as const } },
    ],
  }));

  // All words must match on the same recipient
  return { AND: wordConditions };
}
