# PostNet CMS — Business Rules

**Document:** 06-business-rules.md  
**Version:** 1.7  
**Last Updated:** December 13, 2025

---

## 8.1 Pricing Rules

### Renewal Period Calculation

| Selected Period | Actual Duration | Renewal Date Calculation |
|-----------------|-----------------|--------------------------|
| 3-month | 3 months | Payment date + 3 months |
| 6-month | 6 months | Payment date + 6 months |
| 12-month | 13 months | Payment date + 13 months |

### Recipient Pricing

```
Total Rate = Base Rate + Additional Recipient Fees

Where:
- Adults 1-3: No additional fee
- Adult 4: + 4th adult fee
- Adult 5: + 5th adult fee  
- Adult 6: + 6th adult fee
- Minors: Do not count toward adult total until turning 18
```

### Rate Change Policy

- Rate changes are configured in the system with an effective date
- Existing accounts continue at their locked rate until next renewal
- New rate applies automatically at renewal
- Historical rates are preserved for reference

---

## 8.2 Age Calculation Rules (Person Recipients Only)

*Note: These rules apply only to Person recipients, not Company recipients.*

### Minor Definition
- Any person recipient under 18 years of age
- Calculated daily based on date of birth
- Companies are not subject to age calculations

### Turning 18 Transition

**30 days before 18th birthday:**
- Recipient flagged in system
- Appears on dashboard
- SMS sent to primary account holder

**On 18th birthday:**
- Recipient status changes to "Documentation Required"
- Cannot receive mail until documentation provided

**Required documentation:**
- Valid government-issued ID
- Proof of residence
- Signed USPS Form 1583

**If not provided within grace period:**
- Recipient removed from account
- Removal reason: "Turned 18 - no documentation"

---

## 8.3 Delinquency Rules

### Grace Period
- No formal grace period after renewal date
- Account immediately flagged as overdue

### Escalation Timeline

| Days Past Due | Status | System Actions |
|---------------|--------|----------------|
| 1-30 | Overdue | Flag account, SMS reminder |
| 31-60 | Hold | Hold mail, SMS notice, generate Hold notice |
| 61+ | Closed | Close account, release mailbox |

### Payment Restoration
- Payment at any point before closure restores Active status
- New renewal date calculated from payment date
- Hold status cleared immediately upon payment

---

## 8.4 Validation Rules

### Account Creation
- Mailbox must have status "Available"
- Primary renter must provide all required fields
- ID expiration must be future date
- Form 1583 date required

### Recipient Addition

**General Rules:**
- Maximum 6 adult recipients (persons 18+ and businesses combined)
- Minor persons (under 18) do not count toward adult limit
- All documentation required before activation

**Person Recipient Validation:**
- First name required
- Last name required
- Birthdate required
- Middle name optional
- Alias optional
- If adult (18+): ID and proof of residence required
- If minor (under 18): ID and proof of residence optional
- Form 1583 signature date required
- At least one contact card recommended

**Business Recipient Validation:**
- Business name required
- Business alias optional
- Business registration number optional
- Valid until date optional (but recommended for tracking)
- Form 1583 signature date required
- At least one contact card recommended

**Verification Trigger Calculation:**
- `requiresVerification()` checked daily for all recipients
- For persons: returns true if minor AND 18th birthday within 30 days
- For businesses: returns true if `validUntilDate` set AND within 30 days of expiration

### Payment Recording
- Amount must be positive
- Date cannot be in future
- Must select payment method

---

## Navigation

← [User Interface](05-user-interface.md) | [Index](00-index.md) | [Notifications →](07-notifications.md)
