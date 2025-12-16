import { describe, it, expect } from 'vitest';
import {
  toE164,
  formatForDisplay,
  isValidE164,
  isValidPhoneInput,
  isGuamNumber,
  isNorthAmericanNumber,
} from '@/lib/utils/phone-format';

describe('Phone Format Utilities', () => {
  describe('toE164', () => {
    it('converts 7-digit Guam number to E.164', () => {
      expect(toE164('6461234')).toBe('+16716461234');
    });

    it('converts 10-digit Guam number to E.164', () => {
      expect(toE164('6716461234')).toBe('+16716461234');
    });

    it('converts 10-digit US number to E.164', () => {
      expect(toE164('8085551234')).toBe('+18085551234');
    });

    it('converts 11-digit number with country code to E.164', () => {
      expect(toE164('16716461234')).toBe('+16716461234');
    });

    it('handles input with dashes', () => {
      expect(toE164('671-646-1234')).toBe('+16716461234');
    });

    it('handles input with spaces', () => {
      expect(toE164('671 646 1234')).toBe('+16716461234');
    });

    it('handles input with parentheses', () => {
      expect(toE164('(671) 646-1234')).toBe('+16716461234');
    });

    it('handles international numbers', () => {
      expect(toE164('819012345678')).toBe('+819012345678');
    });
  });

  describe('formatForDisplay', () => {
    it('formats US number for display', () => {
      expect(formatForDisplay('+18085551234')).toBe('+1 808 555 1234');
    });

    it('formats Guam number for display', () => {
      expect(formatForDisplay('+16716461234')).toBe('+1 671 646 1234');
    });

    it('formats Japanese number for display', () => {
      expect(formatForDisplay('+819012345678')).toBe('+81 90 1234 5678');
    });

    it('returns input unchanged if not E.164', () => {
      expect(formatForDisplay('6461234')).toBe('6461234');
    });
  });

  describe('isValidE164', () => {
    it('returns true for valid E.164 format', () => {
      expect(isValidE164('+16716461234')).toBe(true);
      expect(isValidE164('+18085551234')).toBe(true);
      expect(isValidE164('+819012345678')).toBe(true);
    });

    it('returns false for invalid format', () => {
      expect(isValidE164('6716461234')).toBe(false);
      expect(isValidE164('+0123')).toBe(false);
      expect(isValidE164('phone')).toBe(false);
      expect(isValidE164('')).toBe(false);
    });
  });

  describe('isValidPhoneInput', () => {
    it('returns true for valid input lengths', () => {
      expect(isValidPhoneInput('6461234')).toBe(true); // 7 digits
      expect(isValidPhoneInput('6716461234')).toBe(true); // 10 digits
      expect(isValidPhoneInput('16716461234')).toBe(true); // 11 digits
    });

    it('returns false for invalid input', () => {
      expect(isValidPhoneInput('123')).toBe(false); // Too short
      expect(isValidPhoneInput('')).toBe(false); // Empty
    });
  });

  describe('isGuamNumber', () => {
    it('returns true for Guam numbers', () => {
      expect(isGuamNumber('+16716461234')).toBe(true);
      expect(isGuamNumber('+16715551234')).toBe(true);
    });

    it('returns false for non-Guam numbers', () => {
      expect(isGuamNumber('+18085551234')).toBe(false);
      expect(isGuamNumber('+819012345678')).toBe(false);
    });
  });

  describe('isNorthAmericanNumber', () => {
    it('returns true for North American numbers', () => {
      expect(isNorthAmericanNumber('+16716461234')).toBe(true);
      expect(isNorthAmericanNumber('+18085551234')).toBe(true);
    });

    it('returns false for non-North American numbers', () => {
      expect(isNorthAmericanNumber('+819012345678')).toBe(false);
    });
  });
});
