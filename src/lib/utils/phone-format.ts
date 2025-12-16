import { PHONE } from '@/constants/app';

/**
 * Strips all non-digit characters from a phone number
 */
function stripNonDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Converts user input to E.164 format
 *
 * Examples:
 * - "6461234" → "+16716461234" (7-digit Guam number)
 * - "6716461234" → "+16716461234" (10-digit with Guam area code)
 * - "8085551234" → "+18085551234" (10-digit US number)
 * - "16716461234" → "+16716461234" (11-digit with country code)
 * - "819012345678" → "+819012345678" (international)
 */
export function toE164(input: string): string {
  const digits = stripNonDigits(input);

  // 7-digit Guam local number
  if (digits.length === 7) {
    return `+${PHONE.DEFAULT_COUNTRY_CODE}${PHONE.GUAM_AREA_CODE}${digits}`;
  }

  // 10-digit US/Canada number
  if (digits.length === 10) {
    return `+${PHONE.DEFAULT_COUNTRY_CODE}${digits}`;
  }

  // 11-digit with country code 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // International (assume already complete)
  if (digits.length > 10) {
    return `+${digits}`;
  }

  // Return as-is if we can't parse (will fail validation)
  return digits;
}

/**
 * Formats E.164 number for display
 *
 * Examples:
 * - "+16716461234" → "+1 671 646 1234"
 * - "+18085551234" → "+1 808 555 1234"
 * - "+819012345678" → "+81 90 1234 5678"
 */
export function formatForDisplay(e164: string): string {
  if (!e164.startsWith('+')) {
    return e164;
  }

  const digits = e164.slice(1);

  // North American Numbering Plan (country code 1)
  if (digits.startsWith('1') && digits.length === 11) {
    const areaCode = digits.slice(1, 4);
    const exchange = digits.slice(4, 7);
    const subscriber = digits.slice(7);
    return `+1 ${areaCode} ${exchange} ${subscriber}`;
  }

  // Japan (country code 81)
  if (digits.startsWith('81') && digits.length >= 11) {
    const cc = digits.slice(0, 2);
    const mobile = digits.slice(2, 4);
    const part1 = digits.slice(4, 8);
    const part2 = digits.slice(8);
    return `+${cc} ${mobile} ${part1} ${part2}`;
  }

  // Fallback: add space after country code
  return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
}

/**
 * Validates if a string is valid E.164 format
 */
export function isValidE164(value: string): boolean {
  // E.164: starts with +, followed by 7-15 digits
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  return e164Regex.test(value);
}

/**
 * Validates if user input can be converted to a valid phone number
 */
export function isValidPhoneInput(input: string): boolean {
  const digits = stripNonDigits(input);
  // Accept 7 (Guam local), 10 (US), 11 (with country code), or 12+ (international)
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Checks if an E.164 number is a Guam number
 */
export function isGuamNumber(e164: string): boolean {
  return e164.startsWith(`+${PHONE.DEFAULT_COUNTRY_CODE}${PHONE.GUAM_AREA_CODE}`);
}

/**
 * Checks if an E.164 number is a North American number
 */
export function isNorthAmericanNumber(e164: string): boolean {
  return e164.startsWith(`+${PHONE.DEFAULT_COUNTRY_CODE}`) && e164.length === 12;
}
