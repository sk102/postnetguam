import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import type { RecipientType } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import { STORE } from '@/constants/app';
import { StoreSettingsService } from '@/lib/services/store-settings.service';
import {
  calculateAge as calculateAgeFromDate,
  getDaysUntil,
  get18thBirthday,
  getToday,
} from '@/lib/utils/date';
import type { TemplateVariableContext } from '@/types/notice';

/**
 * Store settings for template context
 */
interface StoreInfo {
  name: string;
  street1: string;
  street2: string | null;
  city: string;
  zip: string;
  phone: string;
  email: string;
  hours: string;
}

/**
 * Format store address from parts
 */
function formatStoreAddress(store: StoreInfo): string {
  const parts = [store.street1];
  if (store.street2) parts.push(store.street2);
  parts.push(`${store.city} ${store.zip}`);
  return parts.join(', ');
}

/**
 * Format a date as a readable string
 */
function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Format currency
 */
function formatCurrency(amount: number | Decimal): string {
  const num = typeof amount === 'number' ? amount : parseFloat(amount.toString());
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

/**
 * Format renewal period for display
 */
function formatRenewalPeriod(period: string): string {
  switch (period) {
    case 'THREE_MONTH':
      return '3 months';
    case 'SIX_MONTH':
      return '6 months';
    case 'TWELVE_MONTH':
      return '12 months';
    default:
      return period;
  }
}

/**
 * Calculate age in years from birthdate (null-safe wrapper)
 */
function calculateAge(birthdate: Date | null): number | null {
  if (!birthdate) return null;
  return calculateAgeFromDate(birthdate);
}

/**
 * Calculate days until a date (null-safe wrapper)
 */
function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  return getDaysUntil(date);
}

/**
 * Calculate days until 18th birthday
 */
function daysUntil18thBirthday(birthdate: Date | null): number | null {
  if (!birthdate) return null;
  const eighteenthBirthday = get18thBirthday(birthdate);
  if (eighteenthBirthday <= getToday()) return null; // Already 18 or older
  return getDaysUntil(eighteenthBirthday);
}

/**
 * Get display name for a recipient
 */
function getDisplayName(recipient: RecipientData | null): string {
  if (!recipient) return '';

  if (recipient.recipientType === 'BUSINESS') {
    return recipient.businessAlias || recipient.businessName || '';
  }

  const parts: string[] = [];
  if (recipient.firstName) parts.push(recipient.firstName);
  if (recipient.middleName) parts.push(recipient.middleName);
  if (recipient.personAlias) parts.push(`"${recipient.personAlias}"`);
  if (recipient.lastName) parts.push(recipient.lastName);

  return parts.join(' ');
}

/**
 * Phone number data
 */
interface PhoneData {
  e164Format: string;
  isPrimary: boolean;
  label: string | null;
}

/**
 * Email data
 */
interface EmailData {
  email: string;
  isPrimary: boolean;
  label: string | null;
}

/**
 * Contact card data
 */
interface ContactCardData {
  phoneNumbers: PhoneData[];
  emailAddresses: EmailData[];
}

/**
 * Recipient data for template context
 */
interface RecipientData {
  recipientType: RecipientType;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  personAlias: string | null;
  birthdate: Date | null;
  businessName: string | null;
  businessAlias: string | null;
  idType: string | null;
  idExpirationDate: Date | null;
  contactCard: ContactCardData | null;
}

/**
 * Account data for template context
 */
interface AccountData {
  status: string;
  renewalPeriod: string;
  currentRate: Decimal;
  nextRenewalDate: Date;
  startDate: Date;
  lastRenewalDate: Date | null;
  mailbox: {
    number: number;
  };
}

/**
 * Format phone number from E.164 format for display
 */
function formatPhoneForDisplay(e164: string): string {
  // Simple formatting for US numbers
  const cleaned = e164.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const area = cleaned.slice(1, 4);
    const first = cleaned.slice(4, 7);
    const last = cleaned.slice(7);
    return `(${area}) ${first}-${last}`;
  }
  return e164;
}

/**
 * Check if a recipient is an adult (18+) based on birthdate
 */
function isAdult(birthdate: Date | null): boolean {
  if (!birthdate) return true; // Assume adult if no birthdate
  const age = calculateAge(birthdate);
  return age !== null && age >= 18;
}

/**
 * Get list of adult recipients who are missing ID
 */
function getRecipientsMissingId(allRecipients: RecipientData[]): string[] {
  return allRecipients
    .filter((r) => isAdult(r.birthdate) && r.idType === null)
    .map((r) => getDisplayName(r))
    .filter((name) => name.length > 0);
}

/**
 * Build template variable context from account and recipient data
 * @param storeSettings - Optional store settings. If not provided, falls back to STORE constant.
 */
export function buildTemplateContext(
  account: AccountData,
  recipient: RecipientData | null,
  allRecipients?: RecipientData[],
  storeSettings?: StoreInfo
): TemplateVariableContext {
  // Get contact info
  const contactCard = recipient?.contactCard;
  const phones = contactCard?.phoneNumbers ?? [];
  const emails = contactCard?.emailAddresses ?? [];

  const primaryPhone = phones.find((p) => p.isPrimary) ?? phones[0];
  const primaryEmail = emails.find((e) => e.isPrimary) ?? emails[0];

  const birthdate = recipient?.birthdate ?? null;
  const age = calculateAge(birthdate);
  const isMinor = age !== null && age < 18;

  // Calculate recipients missing ID
  const recipientsMissingIdList = allRecipients
    ? getRecipientsMissingId(allRecipients)
    : recipient && isAdult(recipient.birthdate) && recipient.idType === null
      ? [getDisplayName(recipient)]
      : [];

  // Use provided store settings or fall back to constants
  const store = storeSettings ?? {
    name: STORE.NAME,
    street1: STORE.STREET1,
    street2: STORE.STREET2,
    city: STORE.CITY,
    zip: STORE.ZIP,
    phone: STORE.PHONE,
    email: STORE.EMAIL,
    hours: STORE.HOURS,
  };

  return {
    // Account info
    mailboxNumber: account.mailbox.number,
    accountStatus: account.status,
    renewalPeriod: formatRenewalPeriod(account.renewalPeriod),
    currentRate: formatCurrency(account.currentRate),
    nextRenewalDate: formatDate(account.nextRenewalDate),
    startDate: formatDate(account.startDate),
    lastRenewalDate: account.lastRenewalDate ? formatDate(account.lastRenewalDate) : null,

    // Primary recipient info
    firstName: recipient?.firstName ?? null,
    middleName: recipient?.middleName ?? null,
    lastName: recipient?.lastName ?? null,
    displayName: getDisplayName(recipient),
    birthdate: birthdate ? formatDate(birthdate) : null,
    businessName: recipient?.businessName ?? null,
    businessAlias: recipient?.businessAlias ?? null,

    // Contact info
    primaryPhone: primaryPhone ? formatPhoneForDisplay(primaryPhone.e164Format) : null,
    primaryEmail: primaryEmail?.email ?? null,
    allPhones: phones.map((p) => formatPhoneForDisplay(p.e164Format)).join(', '),
    allEmails: emails.map((e) => e.email).join(', '),

    // Verification info
    idType: recipient?.idType ?? null,
    idExpirationDate: recipient?.idExpirationDate
      ? formatDate(recipient.idExpirationDate)
      : null,
    daysUntilIdExpiry: daysUntil(recipient?.idExpirationDate),
    recipientsMissingId: recipientsMissingIdList.join(', '),

    // Computed values
    age,
    daysUntilRenewal: daysUntil(account.nextRenewalDate) ?? 0,
    daysUntil18thBirthday: birthdate ? daysUntil18thBirthday(birthdate) : null,
    isMinor,

    // Store info
    storeName: store.name,
    storeAddress: formatStoreAddress(store),
    storePhone: store.phone,
    storeEmail: store.email,
    storeHours: store.hours,

    // Current date
    currentDate: formatDate(new Date()),
  };
}

/**
 * Build template variable context with store settings fetched from database
 * This is the async version that should be used when generating notices
 */
export async function buildTemplateContextAsync(
  account: AccountData,
  recipient: RecipientData | null,
  allRecipients?: RecipientData[]
): Promise<TemplateVariableContext> {
  const storeSettings = await StoreSettingsService.getSettings();
  return buildTemplateContext(account, recipient, allRecipients, storeSettings);
}

/**
 * Replace template variables in text
 * Uses {{variableName}} syntax
 */
export function replaceTemplateVariables(
  template: string,
  context: TemplateVariableContext
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, variableName: string) => {
    const value = context[variableName as keyof TemplateVariableContext];

    if (value === null || value === undefined) {
      return ''; // Return empty string for null/undefined values
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return String(value);
  });
}

/**
 * Render markdown to HTML
 */
export function renderMarkdownToHtml(markdown: string): string {
  // Configure marked for safe rendering
  marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert \n to <br>
  });

  const html = marked.parse(markdown);

  // Sanitize the HTML to prevent XSS
  return DOMPurify.sanitize(html as string, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'strong', 'em', 'b', 'i', 'u',
      'a', 'blockquote', 'pre', 'code',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

/**
 * Render a notice template with context
 * Returns both the rendered markdown and HTML
 */
export function renderNoticeTemplate(
  template: string,
  context: TemplateVariableContext
): { markdown: string; html: string } {
  const markdown = replaceTemplateVariables(template, context);
  const html = renderMarkdownToHtml(markdown);
  return { markdown, html };
}

/**
 * Render subject line with context
 */
export function renderSubject(
  subject: string | null,
  context: TemplateVariableContext
): string | null {
  if (!subject) return null;
  return replaceTemplateVariables(subject, context);
}

/**
 * Get list of variables used in a template
 */
export function getUsedVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) ?? [];
  const variables = matches.map((m) => m.replace(/\{\{|\}\}/g, ''));
  return Array.from(new Set(variables)); // Remove duplicates
}

/**
 * Validate that all variables in template are known
 */
export function validateTemplateVariables(
  template: string,
  knownVariables: string[]
): { valid: boolean; unknownVariables: string[] } {
  const usedVariables = getUsedVariables(template);
  const unknownVariables = usedVariables.filter(
    (v) => !knownVariables.includes(v)
  );
  return {
    valid: unknownVariables.length === 0,
    unknownVariables,
  };
}
