// Status-related constants

export const ACCOUNT_STATUS_LABELS = {
  ACTIVE: 'Active',
  RENEWAL: 'Renewal',
  HOLD: 'Hold',
  CLOSED: 'Closed',
} as const;

// Display status includes computed statuses like RENEWAL
export type DisplayAccountStatus = 'ACTIVE' | 'RENEWAL' | 'HOLD' | 'CLOSED';

// Days before renewal date when account shows as RENEWAL status
export const RENEWAL_WARNING_DAYS = 30;

export const MAILBOX_STATUS_LABELS = {
  AVAILABLE: 'Available',
  ACTIVE: 'Active',
  HOLD: 'Hold',
  CLOSED: 'Closed',
} as const;

export const PAYMENT_STATUS_LABELS = {
  CURRENT: 'Current',
  DUE_SOON: 'Due Soon',
  DUE: 'Due',
  OVERDUE: 'Overdue',
} as const;

export const RENEWAL_PERIOD_LABELS = {
  THREE_MONTH: '3 Month',
  SIX_MONTH: '6 Month',
  TWELVE_MONTH: '12 Month',
} as const;

export const PAYMENT_METHOD_LABELS = {
  CASH: 'Cash',
  CARD: 'Card',
  CHECK: 'Check',
} as const;

export const RECIPIENT_TYPE_LABELS = {
  PERSON: 'Person',
  BUSINESS: 'Business',
} as const;

export const USER_ROLE_LABELS = {
  STAFF: 'Staff',
  MANAGER: 'Manager',
} as const;

export const PHONE_LABELS = ['Cell', 'Home', 'Work', 'Office', 'Fax', 'Other'] as const;

export const EMAIL_LABELS = ['Personal', 'Work', 'Business', 'Other'] as const;

export const ID_TYPES = [
  'Driver\'s License',
  'State ID',
  'Passport',
  'Military ID',
  'Other',
] as const;

export const PROOF_OF_RESIDENCE_TYPES = [
  'Utility Bill',
  'Bank Statement',
  'Lease Agreement',
  'Mortgage Statement',
  'Government Correspondence',
  'Other',
] as const;

export const CLOSURE_REASONS = [
  'Customer Request',
  'Non-Payment',
  'Violation of Terms',
  'Business Relocation',
  'Other',
] as const;

export const PERSON_REMOVAL_REASONS = [
  'Customer Request',
  'Turned 18 - No Documentation',
  'Moved Out',
  'Deceased',
  'Other',
] as const;

export const BUSINESS_REMOVAL_REASONS = [
  'Customer Request',
  'Registration Expired - Not Renewed',
  'Business Closed/Dissolved',
  'No Longer Associated',
  'Other',
] as const;
