# PostNet CMS — Reporting & Documents

**Document:** 08-reporting.md  
**Version:** 1.7  
**Last Updated:** December 13, 2025

---

## 10.1 Printable Documents

**Printing Access:** Any logged-in user can print documents to any available shared printer. No dedicated print station required.

### Name Tags

**Purpose:** Labels for mailbox showing authorized recipients

**Content:**
- Mailbox number
- All active recipient names
- Optional: Start date

**Generation:** On-demand per account or batch for multiple accounts

---

### Payment Reminder Notice

**Purpose:** Printed notice for customers due next month

**Content:**
- Customer name and mailbox number
- Current renewal date
- Amount due
- Payment methods accepted
- Branch contact information

**Generation:** Batch generate for all accounts due in specified month

---

### Hold Mail Notice

**Purpose:** Notice for customers with held mail

**Content:**
- Customer name and mailbox number
- Date mail was placed on hold
- Amount owed
- Instructions to restore service
- Account closure warning date
- Branch contact information

**Generation:** Batch generate for all accounts in Hold status

---

### Account Summary

**Purpose:** Complete account information printout for customer

**Content:**
- All account details
- All recipients
- Payment history (last 12 months)
- Upcoming renewal information

**Generation:** On-demand per account

---

## 10.2 Reports

All reports are generated on-demand (no scheduled reports). Users can generate and export reports as needed.

### Payment Summary Report

**Filters:**
- Date range
- Payment method
- Account status

**Content:**
- Total payments received
- Breakdown by period
- Breakdown by method

---

### Renewal Calendar

**View:** Month or week view

**Content:**
- All renewals by date
- Payment status indicator
- Click to view account

---

### Data Export

**Formats:** CSV, Excel

**Available Exports:**
- All accounts (with filters)
- All payments (date range)
- All recipients
- Audit log (date range)

---

## Navigation

← [Notifications](07-notifications.md) | [Index](00-index.md) | [Security →](09-security.md)
