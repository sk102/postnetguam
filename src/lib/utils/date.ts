import {
  addDays,
  differenceInDays,
  differenceInYears,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
} from 'date-fns';
import { RENEWAL, VERIFICATION } from '@/constants/app';
import { RenewalPeriod } from '@prisma/client';

/**
 * Get today's date at start of day (midnight)
 */
export function getToday(): Date {
  return startOfDay(new Date());
}

/**
 * Calculate age in years from a birthdate
 */
export function calculateAge(birthdate: Date): number {
  return differenceInYears(getToday(), birthdate);
}

/**
 * Check if a person is a minor (under 18)
 */
export function isMinor(birthdate: Date): boolean {
  return calculateAge(birthdate) < 18;
}

/**
 * Get the 18th birthday date for a person
 */
export function get18thBirthday(birthdate: Date): Date {
  const eighteenthBirthday = new Date(birthdate);
  eighteenthBirthday.setFullYear(birthdate.getFullYear() + 18);
  return startOfDay(eighteenthBirthday);
}

/**
 * Check if a person is turning 18 within the verification window
 */
export function isTurning18Soon(birthdate: Date): boolean {
  const today = getToday();
  const age = calculateAge(birthdate);

  if (age >= 18) return false;

  // Calculate their 18th birthday
  const eighteenthBirthday = get18thBirthday(birthdate);
  const daysUntil18 = differenceInDays(eighteenthBirthday, today);

  return daysUntil18 >= 0 && daysUntil18 <= VERIFICATION.DAYS_BEFORE_18TH_BIRTHDAY;
}

/**
 * Calculate months until a minor turns 18 from a given start date
 * Returns null if already 18 or older
 */
export function getMonthsUntil18(birthdate: Date, fromDate: Date = new Date()): number | null {
  const from = startOfDay(fromDate);
  const eighteenthBirthday = get18thBirthday(birthdate);

  if (!isAfter(eighteenthBirthday, from)) {
    return null; // Already 18 or older
  }

  // Calculate months difference
  const yearDiff = eighteenthBirthday.getFullYear() - from.getFullYear();
  const monthDiff = eighteenthBirthday.getMonth() - from.getMonth();
  const dayDiff = eighteenthBirthday.getDate() - from.getDate();

  let months = yearDiff * 12 + monthDiff;
  if (dayDiff < 0) {
    months--; // Not a full month yet
  }

  return Math.max(0, months);
}

/**
 * Check if a date is expiring within the given number of days
 */
export function isExpiringSoon(expirationDate: Date, daysThreshold: number): boolean {
  const today = getToday();
  const daysUntilExpiry = differenceInDays(expirationDate, today);
  return daysUntilExpiry >= 0 && daysUntilExpiry <= daysThreshold;
}

/**
 * Check if ID is expiring soon (within verification window)
 */
export function isIdExpiringSoon(idExpirationDate: Date): boolean {
  return isExpiringSoon(idExpirationDate, VERIFICATION.DAYS_BEFORE_ID_EXPIRY);
}

/**
 * Check if business registration is expiring soon
 */
export function isBusinessRegExpiringSoon(validUntilDate: Date): boolean {
  return isExpiringSoon(validUntilDate, VERIFICATION.DAYS_BEFORE_BUSINESS_EXPIRY);
}

/**
 * Calculate the next renewal date based on payment date and period
 */
export function calculateNextRenewalDate(
  paymentDate: Date,
  period: RenewalPeriod
): Date {
  switch (period) {
    case 'THREE_MONTH':
      return addDays(paymentDate, RENEWAL.THREE_MONTH_DAYS);
    case 'SIX_MONTH':
      return addDays(paymentDate, RENEWAL.SIX_MONTH_DAYS);
    case 'TWELVE_MONTH':
      return addDays(paymentDate, RENEWAL.TWELVE_MONTH_DAYS);
    default:
      throw new Error(`Unknown renewal period: ${String(period)}`);
  }
}

/**
 * Get the payment status based on days until renewal
 */
export function getPaymentStatus(
  nextRenewalDate: Date
): 'CURRENT' | 'DUE_SOON' | 'DUE' | 'OVERDUE' {
  const today = getToday();
  const daysUntilRenewal = differenceInDays(nextRenewalDate, today);

  if (daysUntilRenewal < 0) return 'OVERDUE';
  if (daysUntilRenewal <= RENEWAL.DUE_DAYS) return 'DUE';
  if (daysUntilRenewal <= RENEWAL.DUE_SOON_DAYS) return 'DUE_SOON';
  return 'CURRENT';
}

/**
 * Check if account should be placed on hold
 */
export function shouldPlaceOnHold(nextRenewalDate: Date): boolean {
  const today = getToday();
  const daysOverdue = differenceInDays(today, nextRenewalDate);
  return daysOverdue >= RENEWAL.HOLD_DAYS_AFTER_OVERDUE;
}

/**
 * Check if account should be closed
 */
export function shouldCloseAccount(nextRenewalDate: Date): boolean {
  const today = getToday();
  const daysOverdue = differenceInDays(today, nextRenewalDate);
  return daysOverdue >= RENEWAL.CLOSE_DAYS_AFTER_OVERDUE;
}

/**
 * Format date for display (e.g., "Dec 15, 2025")
 */
export function formatDisplayDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM d, yyyy');
}

/**
 * Format date for form input (ISO format: "2025-12-15")
 */
export function formatInputDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd');
}

/**
 * Get days until a date (positive if future, negative if past)
 */
export function getDaysUntil(date: Date): number {
  return differenceInDays(date, getToday());
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
  return isBefore(date, getToday());
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date): boolean {
  return isAfter(date, getToday());
}
