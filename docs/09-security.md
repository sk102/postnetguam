# PostNet CMS — Security & Access Control

**Document:** 09-security.md  
**Version:** 1.7  
**Last Updated:** December 13, 2025

---

## 11.1 Role-Based Permissions

### Staff Role

| Feature | Access Level |
|---------|--------------|
| Dashboard | View |
| Search accounts | Full |
| View account details | Full |
| Add memos | Full |
| Edit/delete memos | None |
| View payment history | Full |
| View recipient history | Full |
| Add/edit recipients | None |
| Record payments | None |
| Close accounts | None |
| Print documents | Full |
| View reports | Limited |
| System settings | None |
| Audit log | None |

---

### Manager Role

| Feature | Access Level |
|---------|--------------|
| All Staff permissions | Full |
| Add memos | Full |
| Edit/delete memos | Full |
| Add/edit recipients | Full |
| Record payments | Full |
| Edit account details | Full |
| Close accounts | Full |
| All reports | Full |
| System settings | Full |
| User management | Full |
| Audit log | Full |
| Rate schedule management | Full |

---

## 11.2 Audit Trail

All changes logged with:
- Timestamp
- User who made change
- Action type (create, update, delete)
- Entity affected
- Before/after values
- IP address

**Retention:** Audit logs retained indefinitely

**Access:** Manager role only

---

## Navigation

← [Reporting](08-reporting.md) | [Index](00-index.md) | [Metrics & Future →](10-metrics-future.md)
