# PostNet CMS — Core Concepts

**Document:** 03-core-concepts.md  
**Version:** 1.7  
**Last Updated:** December 13, 2025

---

## Entity Definitions

### Mailbox
A physical mailbox unit available for rent. Each mailbox has a unique number, size category, and associated rental rate.

### Account
A rental agreement that associates a customer with a mailbox. An account tracks the rental period, payment status, and all associated recipients.

---

## Recipient (Base Entity)

A recipient is any entity authorized to receive mail at a mailbox. All recipients share these common attributes and behaviors:

| Attribute/Method | Description |
|------------------|-------------|
| `id` | Unique identifier |
| `getDisplayName()` | Returns the name for display on screen and print (name tags, notices) |
| `requiresVerification()` | Returns true if verification is needed within required period |

**Recipient Types:**

Recipients are either a **Person** or a **Business**, each with specific fields and verification rules.

---

### Person (extends Recipient)

An individual authorized to receive mail. Can be an adult (18+) or minor (under 18).

| Field | Required | Description |
|-------|----------|-------------|
| `firstName` | Yes | Legal first name |
| `middleName` | No | Middle name |
| `lastName` | Yes | Legal last name |
| `alias` | No | Alternate name for display (e.g., nickname, preferred name) |
| `birthdate` | Yes | Date of birth (used for age calculation and 18th birthday alerts) |

**Display Name Logic (`getDisplayName()`):**
- If `alias` is set → `"FirstName MiddleName "Alias" LastName"`
- If no alias → `"FirstName MiddleName LastName"`

**Examples:**
- John Michael Smith with alias "Johnny" → `John Michael "Johnny" Smith`
- Maria Santos with alias "Mari" → `Maria "Mari" Santos`
- Robert James Lee (no alias) → `Robert James Lee`
- Anna Kim (no middle name, no alias) → `Anna Kim`

**Verification Rules:**
- `requiresVerification()` returns `true` if person is a minor AND their 18th birthday is within 30 days
- System alerts 30 days before 18th birthday
- Upon turning 18, must provide: valid ID, proof of residence, new Form 1583

---

### Business (extends Recipient)

A business entity authorized to receive mail.

| Field | Required | Description |
|-------|----------|-------------|
| `businessName` | Yes | Official registered business name |
| `businessAlias` | No | Trade name or DBA for display |
| `businessRegNumber` | No | Business license/registration number |
| `validUntilDate` | No | Expiration date of business registration (triggers verification alerts) |

**Display Name Logic:**
- If `businessAlias` is set → display alias
- Otherwise → display `businessName`

**Verification Rules:**
- `requiresVerification()` returns `true` if `validUntilDate` is set AND within 30 days of expiration
- System alerts 30 days before registration expires
- Upon expiration, must provide updated business registration

---

## Contact Card

A container for a recipient's contact information. Each recipient has one contact card that can hold multiple phone numbers and email addresses.

| Field | Required | Description |
|-------|----------|-------------|
| `recipientId` | Yes | Link to the recipient (one-to-one) |
| `phoneNumbers` | No | One or more phone number entries |
| `emailAddresses` | No | One or more email address entries |

---

### Phone Number

An individual phone entry within a contact card. Phone numbers are stored in E.164 format and converted to human-readable format at display time.

| Field | Required | Description |
|-------|----------|-------------|
| `e164Format` | Yes | Phone number in E.164 format (e.g., +16715551234) |
| `isMobile` | Yes | Whether this is a mobile number (for SMS) |
| `isPrimary` | No | Primary contact number |
| `label` | No | Label such as "Cell", "Home", "Work", "Office", "Fax" |

**Input Conversion to E.164:**

| User Input | Stored (E.164) |
|------------|----------------|
| `6461234` | +16716461234 |
| `6716461234` | +16716461234 |
| `8085551234` | +18085551234 |
| `819012345678` | +819012345678 |

**Display Formatting (at runtime):**

| Stored (E.164) | Displayed |
|----------------|-----------|
| +16716461234 | +1 671 646 1234 |
| +18085551234 | +1 808 555 1234 |
| +819012345678 | +81 90 1234 5678 |

**Phone Labels:** Cell, Mobile, Home, Work, Office, Fax, Other

---

### Email Address

An individual email entry within a contact card.

| Field | Required | Description |
|-------|----------|-------------|
| `email` | Yes | Email address (stored lowercase) |
| `isPrimary` | No | Primary email address |
| `label` | No | Label such as "Personal", "Work", "Business" |

**Email Labels:** Personal, Work, Business, Other

---

## Other Entities

### Primary Renter
The main account holder responsible for payments and account management. Every account must have exactly one primary renter.

### Payment
A recorded transaction for mailbox rental. Tracks amount, date, method, and period covered.

### Reminder
A system-generated or custom notification about upcoming events or required actions.

### Memo

A note attached to an account. Multiple memos can be associated with a single account.

| Field | Required | Description |
|-------|----------|-------------|
| `accountId` | Yes | Link to the account |
| `content` | Yes | Memo text content |
| `createdBy` | Yes | User who created the memo |
| `createdAt` | Auto | When the memo was created |
| `updatedBy` | Auto | User who last updated the memo (if edited) |
| `updatedAt` | Auto | When the memo was last updated |

**Access Rules:**
- **Create:** Any staff member can add a memo
- **Read:** All staff members can view memos
- **Update:** Only managers can edit memos (after creation)
- **Delete:** Only managers can delete memos (soft delete)

---

## Entity Relationships

```
Mailbox (1) ←──── (1) Account (1) ────→ (many) Recipients
                        │                      │
                        ├────→ (many) Payments │
                        │                      ├── Person (adult or minor)
                        ├────→ (many) Reminders├── Business
                        │                      │
                        └────→ (many) Memos    └──→ (1) ContactCard
                                                        ├──→ (many) PhoneNumbers
                                                        └──→ (many) EmailAddresses
```

---

## Navigation

← [User Personas](02-user-personas.md) | [Index](00-index.md) | [Features →](04-features.md)
