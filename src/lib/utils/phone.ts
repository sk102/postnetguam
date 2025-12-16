/**
 * Phone number formatting utilities
 * Handles Guam-specific phone number formatting with +1 671 prefix
 */

const GUAM_AREA_CODE = '671';

/**
 * Formats a phone number for display
 * @param e164 - Phone number in E.164 format (e.g., +16714833824)
 * @returns Formatted phone number (e.g., +1 671 483 3824) or '-' if empty
 */
export function formatPhone(e164: string | null): string {
  if (!e164) return '-';
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return e164;
}

/**
 * Formats a phone number for input field display
 * - 7-digit numbers: assumed Guam local, prefixed with 671
 * - 10-digit numbers: formatted as +1 XXX XXX XXXX
 * - 11-digit numbers starting with 1: formatted as +1 XXX XXX XXXX
 * @param input - Raw phone number input
 * @returns Formatted phone number for display
 */
export function formatPhoneForInput(input: string): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  // 7-digit numbers: assume Guam, prefix with 671
  if (digits.length === 7) {
    return `+1 ${GUAM_AREA_CODE} ${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  // 10-digit numbers: format as +1 XXX XXX XXXX
  if (digits.length === 10) {
    return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  // 11-digit numbers starting with 1: format as +1 XXX XXX XXXX
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  // Return original if can't format
  return input;
}

/**
 * Parses a formatted phone number back to E.164 format for storage
 * @param formatted - Formatted phone number (e.g., +1 671 483 3824)
 * @returns E.164 format (e.g., +16714833824)
 */
export function parsePhoneToE164(formatted: string): string {
  if (!formatted) return '';
  const digits = formatted.replace(/\D/g, '');
  // 7 digits: assume Guam
  if (digits.length === 7) {
    return `+1${GUAM_AREA_CODE}${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return formatted;
}
