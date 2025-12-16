// Application-wide constants - no magic numbers/strings

export const APP_CONFIG = {
  NAME: 'PostNet Customer Management System',
  SHORT_NAME: 'PCMS',
  VERSION: '1.0.0',
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
} as const;

export const MAILBOX = {
  MAX_ADULT_RECIPIENTS: 6,
  DEFAULT_KEY_DEPOSIT: 5.0,
} as const;

export const RENEWAL = {
  THREE_MONTH_DAYS: 90,
  SIX_MONTH_DAYS: 180,
  TWELVE_MONTH_DAYS: 365 + 30, // Bonus month for 12-month plan
  REMINDER_DAYS_BEFORE: 30,
  DUE_SOON_DAYS: 30,
  DUE_DAYS: 7,
  HOLD_DAYS_AFTER_OVERDUE: 30,
  CLOSE_DAYS_AFTER_OVERDUE: 60,
} as const;

export const VERIFICATION = {
  DAYS_BEFORE_18TH_BIRTHDAY: 30,
  DAYS_BEFORE_ID_EXPIRY: 30,
  DAYS_BEFORE_BUSINESS_EXPIRY: 30,
} as const;

export const PASSWORD = {
  MIN_LENGTH: 12,
  BCRYPT_ROUNDS: 12,
} as const;

export const SESSION = {
  MAX_AGE_HOURS: 8,
  IDLE_TIMEOUT_MINUTES: 30,
} as const;

export const SMS = {
  MAX_REMINDERS_PER_RENEWAL: 1,
  MIN_DAYS_BETWEEN_REMINDERS: 25,
} as const;

export const PHONE = {
  GUAM_AREA_CODE: '671',
  DEFAULT_COUNTRY_CODE: '1',
} as const;

export const ID_TYPES = [
  "Driver's License",
  'State ID',
  'Passport',
  'Military ID',
  'Other',
] as const;

export const STORE = {
  NAME: 'PostNet',
  STREET1: '1270 N Marine Corps Dr',
  STREET2: 'Ste 101',
  CITY: 'Tamuning, Guam',
  ZIP: '96913',
  PHONE: '(671) 649-2917',
  EMAIL: 'gu101@postnet.com',
  HOURS: 'Mon-Fri 8am-6pm, Sat 9am-4pm, Sun Closed',
} as const;

export const PRICING = {
  // Default rates (monthly)
  DEFAULT_BASE_MONTHLY_RATE: 17.0,
  DEFAULT_BUSINESS_ACCOUNT_FEE: 4.0,
  DEFAULT_ADDITIONAL_RECIPIENT_FEE: 2.0,
  DEFAULT_MINOR_RECIPIENT_FEE: 0.0,
  DEFAULT_KEY_DEPOSIT: 5.0,

  // Recipient thresholds
  INCLUDED_RECIPIENTS: 3,
  MAX_RECIPIENTS: 7,

  // Period multipliers
  PERIOD_MONTHS: {
    THREE_MONTH: 3,
    SIX_MONTH: 6,
    TWELVE_MONTH: 12,
  },

  // Validation limits
  MIN_RATE: 0.0,
  MAX_RATE: 999.99,
} as const;
