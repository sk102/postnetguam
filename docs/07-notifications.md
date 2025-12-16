# PostNet CMS — Notifications & Communications

**Document:** 07-notifications.md  
**Version:** 1.7  
**Last Updated:** December 13, 2025

---

## 9.1 Dashboard Notifications

All notifications appear on staff dashboard organized by urgency. Verification-related notifications are triggered by the `requiresVerification()` method on each recipient.

| Priority | Notification Type | Display |
|----------|-------------------|---------|
| High | Overdue accounts | Red indicator, top of list |
| High | Accounts on Hold | Orange indicator |
| Medium | Renewals due (7 days) | Yellow indicator |
| Medium | IDs expiring (30 days) | Yellow indicator |
| Medium | Person turning 18 (30 days) | Yellow indicator |
| Medium | Business registration expiring (30 days) | Yellow indicator |
| Low | Renewals due (30 days) | Blue indicator |

---

## 9.2 SMS Notifications

Automated SMS messages sent to primary account holder's phone (using contact card marked as primary and mobile).

### SMS Events

| Event | Timing | Message Template |
|-------|--------|------------------|
| Renewal Reminder | 30 days before | "Your PostNet mailbox #{box} renewal is due on {date}. Please visit us to renew. Questions? Call {branch_phone}." |
| Payment Overdue | 1 day after due | "Your PostNet mailbox #{box} payment was due {date}. Please pay promptly to avoid service interruption." |
| Hold Warning | When status → Hold | "NOTICE: Your PostNet mailbox #{box} is now on hold due to non-payment. Mail is being held. Please contact us at {branch_phone}." |
| ID Expiring | 30 days before | "The ID on file for your PostNet mailbox #{box} expires on {date}. Please bring a current ID on your next visit." |
| Person Turning 18 | 30 days before | "A recipient on your PostNet mailbox #{box} is turning 18 soon. New documentation (ID, proof of residence, Form 1583) is required to continue their mail service." |
| Business Reg. Expiring | 30 days before | "The business registration for {business_name} on your PostNet mailbox #{box} expires on {date}. Please bring updated registration on your next visit." |

*Note: "Person Turning 18" applies only to Person recipients. "Business Reg. Expiring" applies only to Business recipients with `validUntilDate` set.*

---

## 9.3 SMS Preferences

Per account settings:
- SMS enabled/disabled (opt-in required — customer must agree to receive SMS)
- SMS phone number (defaults to primary mobile from contact card)

### Opt-In Process
- Staff asks customer if they want to receive SMS notifications
- Customer consent recorded at account creation or update
- Disabled by default — must be explicitly enabled

---

## 9.4 Delivery Tracking

System logs all SMS messages:
- Message content
- Send timestamp
- Delivery status (sent, delivered, failed)
- Error details if failed

---

## Navigation

← [Business Rules](06-business-rules.md) | [Index](00-index.md) | [Reporting →](08-reporting.md)
