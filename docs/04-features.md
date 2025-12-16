# PostNet CMS — Feature Specifications

**Document:** 04-features.md  
**Version:** 1.7  
**Last Updated:** December 13, 2025

---

## 6.1 Account Management

### Create Account

**Trigger:** Customer wants to rent a new mailbox

**Flow:**
1. Select available mailbox
2. Enter primary renter information:
   - Full name (first, last)
   - Date of birth
   - Phone number
   - Email address
   - ID information (type, issuing state/country, expiration date)
   - Proof of residence (type, date provided)
   - USPS Form 1583 signature date
3. Select renewal period (3-month, 6-month, or 12-month)
4. Record initial payment (first period + key deposit)
5. System calculates next renewal date
6. Account is created with status "Active"

**Validations:**
- Mailbox must be available
- All required fields must be completed
- ID expiration date must be in the future
- Form 1583 date is required

### View Account

**Information Displayed:**
- Mailbox number and size
- Account status (Active, Hold, Closed)
- Primary renter name and contact info
- All recipients with status indicators
- Current renewal period and rate
- Start date, last renewal, next renewal
- Last payment date and amount
- Key deposit amount
- Account memos (chronological list)

**Memos Section:**
- Displays all memos in reverse chronological order (newest first)
- Each memo shows: content, created by, created date
- If edited: shows "edited by [user] on [date]"
- Staff can add new memos
- Only managers can edit or delete existing memos

**Quick Actions:**
- Add memo (Staff + Manager)
- Edit/Delete memo (Manager only)
- Add recipient (Manager)
- Record payment (Manager)
- Print name tags
- View payment history
- View recipient history

### Edit Account

**Editable Fields (Manager Only):**
- Contact information (phone, email)
- Renewal period

**Memo Management (see Memos Section above):**
- Add memo: Staff + Manager
- Edit memo: Manager only
- Delete memo: Manager only

**Non-Editable Fields:**
- Mailbox number (requires new account)
- Start date
- Historical data

### Close Account

**Trigger:** Customer requests closure or account terminated for non-payment

**Flow:**
1. Manager initiates closure
2. System prompts for closure reason
3. System records deposit return status
4. All recipients marked as removed with closure date
5. Account status changed to "Closed"
6. Mailbox status changed to "Available"

**Closure Reasons:**
- Customer request
- Non-payment (after Hold period)
- Violation of terms
- Business relocation

---

## 6.2 Recipient Management

### Add Recipient

**Trigger:** Customer wants to add a person or business to their mailbox

**Step 1: Select Recipient Type**
- **Person** — An individual (adult or minor)
- **Business** — A business entity

**Validations:**
- Maximum 6 adult recipients per mailbox (persons aged 18+ and businesses combined)
- Minors (persons under 18) do not count toward adult limit
- Businesses count as 1 recipient toward the adult limit

---

**Adding a Person Recipient:**

| Field | Required | Description |
|-------|----------|-------------|
| First Name | Yes | Legal first name |
| Middle Name | No | Middle name |
| Last Name | Yes | Legal last name |
| Alias | No | Preferred display name (nickname, etc.) |
| Birthdate | Yes | Date of birth |
| Relationship to Primary | No | Family, employee, roommate, etc. |

**Documentation (required for adults, optional for minors):**
- ID type, state/country, expiration date
- Proof of residence type and date provided
- USPS Form 1583 signature date

**Contact Card:**
- One contact card per recipient
- Add one or more phone numbers with labels (Cell, Home, Work, etc.)
- Add one or more email addresses with labels (Personal, Work, Business, etc.)
- Mark mobile numbers for SMS capability
- Designate primary phone and primary email

**Minor-Specific Handling:**
- If birthdate indicates age < 18, recipient is flagged as a minor
- Minors do not require ID or proof of residence (parent/guardian responsible)
- System tracks 18th birthday via `requiresVerification()` method
- Dashboard alert appears 30 days before 18th birthday
- Upon turning 18, recipient must provide:
  - Valid government-issued ID
  - Proof of residence
  - New USPS Form 1583 with their signature
- If documentation not provided by 18th birthday, recipient is removed

---

**Adding a Business Recipient:**

| Field | Required | Description |
|-------|----------|-------------|
| Business Name | Yes | Official registered business name |
| Business Alias | No | Trade name or DBA for display |
| Business Reg. Number | No | Business license or registration number |
| Valid Until Date | No | Expiration date of business registration |

**Documentation:**
- USPS Form 1583 signature date (signed by authorized representative)

**Contact Card:**
- One contact card per recipient
- Add one or more phone numbers with labels (Office, Cell, Fax, etc.)
- Add one or more email addresses with labels (Business, Work, etc.)
- Mark mobile numbers for SMS capability
- Designate primary phone and primary email

**Business-Specific Handling:**
- If `validUntilDate` is set, system tracks expiration via `requiresVerification()` method
- Dashboard alert appears 30 days before registration expires
- Upon expiration, must provide updated business registration
- Business counts as 1 recipient toward the 6-adult limit

---

**Contact Card Entry:**

Each recipient has one contact card that can contain multiple phone numbers and email addresses.

**Adding Phone Numbers:**
1. Enter the phone number — system converts to E.164 format for storage
2. Select a label — Cell, Home, Work, Office, Fax, or Other
3. Mark if mobile — enables SMS notifications to this number
4. Mark if primary — designates as the main contact number

| User Enters | Stored (E.164) | Displayed |
|-------------|----------------|-----------|
| `6461234` | +16716461234 | +1 671 646 1234 |
| `6716461234` | +16716461234 | +1 671 646 1234 |
| `8085551234` | +18085551234 | +1 808 555 1234 |
| `819012345678` | +819012345678 | +81 90 1234 5678 |

*Note: Only E.164 format is stored in the database. Human-readable format is generated at display/print time.*

**Adding Email Addresses:**
1. Enter the email address — system validates format and stores lowercase
2. Select a label — Personal, Work, Business, or Other
3. Mark if primary — designates as the main email address

**Example Contact Card:**
```
Phone Numbers:
  • Cell: +1 671 646 1234 (mobile, primary)
  • Work: +1 671 555 9876
  • Home: +1 671 555 4321

Email Addresses:
  • Personal: john.doe@gmail.com (primary)
  • Work: jdoe@company.com
```

**SMS Number Selection Priority:**
When sending SMS notifications, the system selects the number in this priority:
1. Primary + Mobile
2. Any Mobile
3. Primary (even if not mobile)
4. First number in list

**Email Selection:**
For email communications (future feature), the system uses the primary email address.

---

**Pricing Impact:**
- Recipients 1-3: Base rate
- Recipient 4: Additional fee applied
- Recipient 5: Additional fee applied
- Recipient 6: Additional fee applied

**Note:** Fee structure is applied at next renewal, not immediately.

### Remove Recipient

**Flow:**
1. Select recipient to remove
2. Enter removal reason
3. System records removal date
4. Recipient marked as inactive
5. Historical record preserved

**Removal Reasons (Person):**
- Customer request
- Turned 18 — did not provide new documentation
- Moved out
- Deceased
- Other (with notes)

**Removal Reasons (Business):**
- Customer request
- Business registration expired — not renewed
- Business closed/dissolved
- No longer associated with account
- Other (with notes)

### Recipient History

For each mailbox, the system maintains a complete history of all recipients:
- Recipient type (Person or Business)
- Display name (via `getDisplayName()`)
- Date added
- Date removed (if applicable)
- Removal reason (if applicable)
- For Persons: Birthdate, alias, ID information at time of addition
- For Businesses: Business reg. number, valid until date
- Contact cards at time of addition

---

## 6.3 Payment & Billing

### Record Payment

**Fields:**
- Payment date
- Amount
- Payment method (Cash, Card, Check)
- Period covered (auto-calculated based on renewal period)
- Notes (optional)

**System Actions:**
- Update last payment date on account
- Calculate and update next renewal date
- Clear any overdue flags
- Log in audit trail

### Payment History

View all payments for an account:
- Date
- Amount
- Method
- Period covered
- Recorded by (staff member)

### Pricing Structure

**Base Rates (example structure):**

| Period | Duration | Bonus |
|--------|----------|-------|
| 3-month | 3 months | — |
| 6-month | 6 months | — |
| 12-month | 12 months | +1 month free |

**Additional Recipient Fees:**

| Recipients | Fee Structure |
|------------|---------------|
| 1-3 adults | Base rate only |
| 4th adult | Base + additional fee |
| 5th adult | Base + additional fee × 2 |
| 6th adult | Base + additional fee × 3 |

**Rate Changes:**
- New rates apply only at next renewal
- Current agreements honor locked-in rate
- Rate history is tracked for reference

---

## 6.4 Renewal Management

### Renewal Periods

| Period | Duration | Next Renewal Calculation |
|--------|----------|--------------------------|
| 3-month | 3 months | Last renewal + 3 months |
| 6-month | 6 months | Last renewal + 6 months |
| 12-month | 13 months | Last renewal + 13 months (bonus) |

### Renewal Tracking

**Automatic Calculations:**
- Next renewal date based on last payment and period
- Days until renewal
- Days overdue (if applicable)

**Status Indicators:**

| Status | Definition | Visual |
|--------|------------|--------|
| Current | Next renewal > 30 days away | Green |
| Due Soon | Next renewal within 30 days | Yellow |
| Due | Next renewal within 7 days | Orange |
| Overdue | Past renewal date | Red |

---

## 6.5 Delinquency Management

### Timeline

```
Renewal Date ──→ +1 month ──→ +2 months
     │              │              │
     ▼              ▼              ▼
  Overdue     Mail on Hold    Account Closed
```

### Status Transitions

| From | To | Trigger | Actions |
|------|-----|---------|---------|
| Active | Active (Overdue) | Renewal date passes without payment | Flag account, send SMS |
| Active (Overdue) | Hold | 1 month past due | Hold mail, send Hold notice, send SMS |
| Hold | Closed | 2 months past due | Close account, release mailbox |
| Any Overdue | Active | Payment received | Clear flags, update renewal date |

### Hold Status

When an account is on Hold:
- Mail and packages are held (not delivered to box)
- Customer notified via SMS
- "Hold Mail" notice generated
- Customer can still pay to restore service
- After 1 additional month, account closes

---

## 6.6 Document & Compliance Tracking

### ID Verification

**Required for each recipient:**
- ID type (Driver's License, Passport, State ID, Military ID, etc.)
- Issuing state or country
- Expiration date
- Date verified by staff
- Staff member who verified

**Expiration Monitoring:**
- System flags IDs expiring within 30 days
- Appears on dashboard task list
- SMS reminder sent to account holder
- After expiration: appears as "Action Required"

### Proof of Residence

**Acceptable Documents:**
- Utility bill (electric, gas, water)
- Bank statement
- Lease agreement
- Mortgage statement
- Government correspondence

**Tracking:**
- Document type provided
- Date provided
- Verified by (staff member)

**Note:** Proof of residence is one-time verification; no expiration tracking required.

### USPS Form 1583

**Requirements:**
- Must be signed by each recipient
- Must be witnessed/notarized
- Kept on file

**Tracking:**
- Signature date
- Notarized (yes/no)

---

## 6.7 Search & Filtering

### Quick Search

Search across all accounts by:
- Mailbox number
- Recipient name (first or last)
- Phone number
- Email address

**Behavior:**
- Partial match supported
- Results ranked by relevance
- Shows account status indicator

### Advanced Filters

| Filter | Options |
|--------|---------|
| Account Status | Active, Hold, Closed, All |
| Payment Status | Current, Due Soon, Overdue |
| Renewal Month | Any month |
| Has Expiring ID | Within 30/60/90 days |
| Has Minor Turning 18 | Within 30/60/90 days |
| Mailbox Size | Small, Medium, Large |
| Rate Range | Min-Max |

### Sorting

| Sort By | Order |
|---------|-------|
| Mailbox Number | Ascending/Descending |
| Last Name | A-Z / Z-A |
| First Name | A-Z / Z-A |
| Renewal Date | Nearest first / Furthest first |
| Rate | Low-High / High-Low |
| Last Payment | Recent first / Oldest first |

---

## Navigation

← [Core Concepts](03-core-concepts.md) | [Index](00-index.md) | [User Interface →](05-user-interface.md)
