# PostNet Customer Management System
## Product Specification

**Version:** 1.7  
**Date:** December 13, 2025  
**Status:** Draft  

---

## Document Index

This specification is organized into the following documents:

| # | Document | Description |
|---|----------|-------------|
| 01 | [Overview](01-overview.md) | Executive summary, problem statement, goals & objectives |
| 02 | [User Personas](02-user-personas.md) | Staff and manager roles and responsibilities |
| 03 | [Core Concepts](03-core-concepts.md) | Entity definitions, relationships, and data model |
| 04 | [Features](04-features.md) | Feature specifications and workflows |
| 05 | [User Interface](05-user-interface.md) | Screen layouts and navigation |
| 06 | [Business Rules](06-business-rules.md) | Validation rules, calculations, and constraints |
| 07 | [Notifications](07-notifications.md) | Dashboard alerts and SMS communications |
| 08 | [Reporting](08-reporting.md) | Printable documents and reports |
| 09 | [Security](09-security.md) | Access control and audit logging |
| 10 | [Metrics & Future](10-metrics-future.md) | Success metrics and future considerations |

---

## Quick Reference

### Key Capabilities

- **Account Management:** Complete lifecycle management from opening to closure
- **Recipient Tracking:** Manage up to 6 recipients per mailbox with full documentation
- **Payment & Renewal:** Automated tracking of payments, renewals, and delinquencies
- **Compliance:** ID verification, USPS Form 1583 tracking, and expiration monitoring
- **Notifications:** Dashboard alerts and SMS reminders to customers
- **Reporting:** Filterable views, printable documents, and operational reports

### Entity Relationships

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

### User Roles

| Role | Primary Responsibilities |
|------|-------------------------|
| **Staff** | Day-to-day operations, customer service, viewing accounts |
| **Manager** | Account creation/closure, recipient management, payments, full access |

---

## Related Documents

- [Technical Specification](../postnet-technical-spec.md) — Database schema, API design, deployment
- [Cost Analysis](../postnet-cost-analysis.md) — Hosting and operational costs
- [Hosting Comparison](../postnet-hosting-comparison.md) — Infrastructure options

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 12, 2025 | Initial specification |
| 1.1 | Dec 12, 2025 | Added recipient types (Person and Company) |
| 1.2 | Dec 13, 2025 | Refined entity model with Person/Business classes |
| 1.3 | Dec 13, 2025 | Restructured ContactCard with multiple PhoneNumbers |
| 1.4 | Dec 13, 2025 | Added multiple EmailAddresses to ContactCard |
| 1.5 | Dec 13, 2025 | Updated Person display name format with alias |
| 1.6 | Dec 13, 2025 | Changed Memo to multiple per account; manager-only edit/delete |
| 1.7 | Dec 13, 2025 | Phone numbers E.164 only; SMS opt-in; on-demand reports |
