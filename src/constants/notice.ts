import type {
  NoticeTypeCode,
  NoticeDeliveryMethod,
  NoticeStatus,
} from '@prisma/client';
import type { TemplateVariable, TemplateVariableCategory } from '@/types/notice';
import { STORE } from './app';

/**
 * Labels for notice type codes
 */
export const NOTICE_TYPE_CODE_LABELS: Record<NoticeTypeCode, string> = {
  RENEWAL_NOTICE: 'Renewal Notice',
  UPCOMING_18TH_BIRTHDAY: 'Upcoming 18th Birthday',
  BIRTHDAY: 'Birthday',
  HOLD_NOTICE: 'Hold Notice',
  ID_VERIFICATION_REQUEST: 'ID Verification Request',
  MISSING_ID: 'Missing ID',
  CUSTOM: 'Custom',
} as const;

/**
 * Labels for delivery methods
 */
export const NOTICE_DELIVERY_METHOD_LABELS: Record<NoticeDeliveryMethod, string> = {
  PRINT: 'Print Only',
  EMAIL: 'Email Only',
  BOTH: 'Print & Email',
} as const;

/**
 * Labels for notice status
 */
export const NOTICE_STATUS_LABELS: Record<NoticeStatus, string> = {
  GENERATED: 'Generated',
  SENT: 'Sent',
  FAILED: 'Failed',
} as const;

/**
 * Color classes for notice status badges
 */
export const NOTICE_STATUS_COLORS: Record<NoticeStatus, string> = {
  GENERATED: 'bg-blue-100 text-blue-800',
  SENT: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
} as const;

/**
 * Variable category labels
 */
export const TEMPLATE_VARIABLE_CATEGORY_LABELS: Record<TemplateVariableCategory, string> = {
  account: 'Account',
  recipient: 'Recipient',
  contact: 'Contact',
  verification: 'Verification',
  computed: 'Computed',
  store: 'Store',
} as const;

/**
 * All available template variables
 */
export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // Account variables
  {
    name: 'mailboxNumber',
    description: 'Mailbox number (e.g., 123)',
    category: 'account',
    example: '123',
  },
  {
    name: 'accountStatus',
    description: 'Current account status',
    category: 'account',
    example: 'ACTIVE',
  },
  {
    name: 'renewalPeriod',
    description: 'Renewal period (3, 6, or 12 months)',
    category: 'account',
    example: 'THREE_MONTH',
  },
  {
    name: 'currentRate',
    description: 'Current monthly rate',
    category: 'account',
    example: '$17.00',
  },
  {
    name: 'nextRenewalDate',
    description: 'Next renewal date',
    category: 'account',
    example: 'January 15, 2025',
  },
  {
    name: 'startDate',
    description: 'Account start date',
    category: 'account',
    example: 'March 1, 2024',
  },
  {
    name: 'lastRenewalDate',
    description: 'Last renewal date (if any)',
    category: 'account',
    example: 'October 15, 2024',
  },

  // Recipient variables
  {
    name: 'firstName',
    description: 'Primary recipient first name',
    category: 'recipient',
    example: 'John',
  },
  {
    name: 'middleName',
    description: 'Primary recipient middle name',
    category: 'recipient',
    example: 'Michael',
  },
  {
    name: 'lastName',
    description: 'Primary recipient last name',
    category: 'recipient',
    example: 'Doe',
  },
  {
    name: 'displayName',
    description: 'Primary recipient display name',
    category: 'recipient',
    example: 'John Michael Doe',
  },
  {
    name: 'birthdate',
    description: 'Primary recipient birthdate',
    category: 'recipient',
    example: 'January 15, 2007',
  },
  {
    name: 'businessName',
    description: 'Business name (if business recipient)',
    category: 'recipient',
    example: 'Acme Corporation',
  },
  {
    name: 'businessAlias',
    description: 'Business alias/DBA name',
    category: 'recipient',
    example: 'Acme Corp',
  },

  // Contact variables
  {
    name: 'primaryPhone',
    description: 'Primary phone number',
    category: 'contact',
    example: '(671) 555-1234',
  },
  {
    name: 'primaryEmail',
    description: 'Primary email address',
    category: 'contact',
    example: 'john@example.com',
  },
  {
    name: 'allPhones',
    description: 'All phone numbers, comma-separated',
    category: 'contact',
    example: '(671) 555-1234, (671) 555-5678',
  },
  {
    name: 'allEmails',
    description: 'All email addresses, comma-separated',
    category: 'contact',
    example: 'john@example.com, john.work@example.com',
  },

  // Verification variables
  {
    name: 'idType',
    description: 'Type of ID on file',
    category: 'verification',
    example: "Driver's License",
  },
  {
    name: 'idExpirationDate',
    description: 'ID expiration date',
    category: 'verification',
    example: 'December 31, 2025',
  },
  {
    name: 'daysUntilIdExpiry',
    description: 'Days until ID expires',
    category: 'verification',
    example: '30',
  },
  {
    name: 'recipientsMissingId',
    description: 'List of adult recipients (18+) without ID on file',
    category: 'verification',
    example: 'John Doe, Jane Smith',
  },

  // Computed variables
  {
    name: 'age',
    description: 'Current age in years',
    category: 'computed',
    example: '25',
  },
  {
    name: 'daysUntilRenewal',
    description: 'Days until next renewal',
    category: 'computed',
    example: '15',
  },
  {
    name: 'daysUntil18thBirthday',
    description: 'Days until 18th birthday (for minors)',
    category: 'computed',
    example: '45',
  },
  {
    name: 'isMinor',
    description: 'Whether recipient is under 18',
    category: 'computed',
    example: 'true',
  },
  {
    name: 'currentDate',
    description: 'Current date',
    category: 'computed',
    example: 'December 15, 2024',
  },

  // Store variables (examples use actual store values from STORE constant)
  {
    name: 'storeName',
    description: 'Store name',
    category: 'store',
    example: STORE.NAME,
  },
  {
    name: 'storeAddress',
    description: 'Store address',
    category: 'store',
    example: `${STORE.STREET1}, ${STORE.STREET2}, ${STORE.CITY} ${STORE.ZIP}`,
  },
  {
    name: 'storePhone',
    description: 'Store phone number',
    category: 'store',
    example: STORE.PHONE,
  },
  {
    name: 'storeEmail',
    description: 'Store email address',
    category: 'store',
    example: STORE.EMAIL,
  },
  {
    name: 'storeHours',
    description: 'Store hours',
    category: 'store',
    example: STORE.HOURS,
  },
];

/**
 * Get variables by category
 */
export function getVariablesByCategory(
  category: TemplateVariableCategory
): readonly TemplateVariable[] {
  return TEMPLATE_VARIABLES.filter((v) => v.category === category);
}

/**
 * Default notice types with sample templates
 */
export const DEFAULT_NOTICE_TYPES: Array<{
  code: NoticeTypeCode;
  name: string;
  description: string;
  subject: string;
  template: string;
  isSystem: boolean;
}> = [
  {
    code: 'RENEWAL_NOTICE',
    name: 'Renewal Notice',
    description: 'Sent to accounts approaching their renewal date',
    subject: 'Mailbox {{mailboxNumber}} - Renewal Notice',
    isSystem: true,
    template: `# Mailbox Renewal Notice

Dear {{displayName}},

Your mailbox rental for **Mailbox #{{mailboxNumber}}** is due for renewal on **{{nextRenewalDate}}**.

## Account Details

| | |
|---|---|
| **Mailbox Number** | {{mailboxNumber}} |
| **Current Rate** | {{currentRate}}/month |
| **Renewal Period** | {{renewalPeriod}} |
| **Renewal Due** | {{nextRenewalDate}} |
| **Days Until Due** | {{daysUntilRenewal}} |

## How to Renew

Please visit our store or contact us to process your renewal payment before the due date to avoid any interruption in service.

**{{storeName}}**
{{storeAddress}}
Phone: {{storePhone}}
Email: {{storeEmail}}
Hours: {{storeHours}}

Thank you for your continued business!

---
*Notice generated on {{currentDate}}*`,
  },
  {
    code: 'UPCOMING_18TH_BIRTHDAY',
    name: 'Upcoming 18th Birthday',
    description: 'Notification for minors turning 18 requiring ID verification',
    subject: 'Mailbox {{mailboxNumber}} - ID Verification Required',
    isSystem: true,
    template: `# Upcoming 18th Birthday - ID Verification Required

Dear {{displayName}},

We are writing to inform you that **{{firstName}}** will be turning 18 years old on **{{birthdate}}** (in approximately **{{daysUntil18thBirthday}} days**).

## What This Means

When a recipient on a mailbox account turns 18, they are required by USPS regulations to:

1. Present a valid government-issued photo ID
2. Sign a new USPS Form 1583 (Delivery Instructions)
3. Provide proof of current address

## Required Documents

Please bring the following documents to our store:

- Valid government-issued photo ID (Driver's License, State ID, or Passport)
- Proof of current residential address (utility bill, bank statement, etc.)

## Action Required

Please visit our store **before or shortly after {{firstName}}'s birthday** to complete the required verification process.

**{{storeName}}**
{{storeAddress}}
Phone: {{storePhone}}
Hours: {{storeHours}}

Thank you for your attention to this matter.

---
*Notice generated on {{currentDate}}*`,
  },
  {
    code: 'BIRTHDAY',
    name: 'Birthday',
    description: 'Birthday greeting for account holders',
    subject: 'Happy Birthday from {{storeName}}!',
    isSystem: true,
    template: `# Happy Birthday, {{firstName}}!

From all of us at **{{storeName}}**, we want to wish you a very **Happy Birthday**!

We truly appreciate your business and hope you have a wonderful day filled with joy and celebration.

Thank you for being a valued customer!

Warm regards,
**{{storeName}}**
{{storeAddress}}
{{storePhone}}

---
*Sent with warm wishes on {{currentDate}}*`,
  },
  {
    code: 'HOLD_NOTICE',
    name: 'Hold Notice',
    description: 'Notification that account has been placed on hold',
    subject: 'Mailbox {{mailboxNumber}} - Account On Hold',
    isSystem: true,
    template: `# Account Hold Notice

Dear {{displayName}},

This notice is to inform you that your mailbox account has been placed on **HOLD** status.

## Account Information

| | |
|---|---|
| **Mailbox Number** | {{mailboxNumber}} |
| **Account Status** | HOLD |
| **Renewal Was Due** | {{nextRenewalDate}} |

## What This Means

While your account is on hold:
- We will continue to accept mail on your behalf
- Mail will be held at our store
- You will not be able to receive packages or pick up mail until the account is brought current

## To Restore Your Account

Please visit our store to pay the outstanding balance and restore your account to active status.

**{{storeName}}**
{{storeAddress}}
Phone: {{storePhone}}
Email: {{storeEmail}}
Hours: {{storeHours}}

If you no longer need mailbox services, please contact us to properly close your account and arrange for mail forwarding.

---
*Notice generated on {{currentDate}}*`,
  },
  {
    code: 'ID_VERIFICATION_REQUEST',
    name: 'ID Verification Request',
    description: 'Request for ID verification when ID is expiring',
    subject: 'Mailbox {{mailboxNumber}} - ID Verification Required',
    isSystem: true,
    template: `# ID Verification Request

Dear {{displayName}},

Our records indicate that the identification document on file for your mailbox account will expire soon or has already expired.

## Current ID Information

| | |
|---|---|
| **Mailbox Number** | {{mailboxNumber}} |
| **ID Type** | {{idType}} |
| **Expiration Date** | {{idExpirationDate}} |
| **Days Until Expiry** | {{daysUntilIdExpiry}} |

## What You Need to Do

Please visit our store with your **current, valid government-issued photo ID** to update your records.

Acceptable forms of ID include:
- Driver's License
- State-issued ID card
- Passport
- Military ID

## Why This Is Important

USPS regulations require that we maintain current identification information for all mailbox recipients. Failure to update your ID may result in interruption of mail services.

**{{storeName}}**
{{storeAddress}}
Phone: {{storePhone}}
Hours: {{storeHours}}

Thank you for your prompt attention to this matter.

---
*Notice generated on {{currentDate}}*`,
  },
  {
    code: 'MISSING_ID',
    name: 'Missing ID',
    description: 'Request for ID when no ID is on file for an adult recipient',
    subject: 'Mailbox {{mailboxNumber}} - ID Required',
    isSystem: true,
    template: `# Identification Required

Dear {{displayName}},

Our records indicate that we do not have a valid government-issued photo ID on file for one or more adult recipients on your mailbox account.

## Account Information

| | |
|---|---|
| **Mailbox Number** | {{mailboxNumber}} |
| **Account Status** | {{accountStatus}} |

## Recipients Requiring ID

The following recipient(s) need to provide valid ID:

**{{recipientsMissingId}}**

## What You Need to Do

Please visit our store with a **valid government-issued photo ID** for each person listed above.

Acceptable forms of ID include:
- Driver's License
- State-issued ID card
- Passport
- Military ID

## Why This Is Important

USPS regulations require that we maintain current identification information for all adult mailbox recipients. Each adult listed on a mailbox account must have a valid ID on file and must sign a USPS Form 1583 (Delivery Instructions).

**Failure to provide valid ID may result in interruption of mail services.**

**{{storeName}}**
{{storeAddress}}
Phone: {{storePhone}}
Email: {{storeEmail}}
Hours: {{storeHours}}

Please visit us at your earliest convenience to update your records.

---
*Notice generated on {{currentDate}}*`,
  },
  {
    code: 'CUSTOM',
    name: 'Custom Notice',
    description: 'A blank template for custom notices',
    subject: 'Notice from {{storeName}}',
    isSystem: false,
    template: `# Notice

Dear {{displayName}},

[Your message here]

**{{storeName}}**
{{storeAddress}}
Phone: {{storePhone}}

---
*Notice generated on {{currentDate}}*`,
  },
] as const;
