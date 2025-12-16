# PostNet Customer Management System
## Technical Specification

**Version:** 1.8  
**Date:** December 13, 2025  
**Status:** Draft  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Database Design](#4-database-design)
5. [API Design](#5-api-design)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [SMS Integration](#7-sms-integration)
8. [Backup & Recovery](#8-backup--recovery)
9. [Audit Logging](#9-audit-logging)
10. [Deployment](#10-deployment)
11. [Security](#11-security)
12. [Performance](#12-performance)
13. [Monitoring & Observability](#13-monitoring--observability)
14. [Development Guidelines](#14-development-guidelines)
15. [Migration Plan](#15-migration-plan)

---

## 1. System Overview

### 1.1 Purpose

The PostNet Customer Management System (PCMS) is a cloud-hosted web application for managing mailbox rentals, customer accounts, payments, and compliance documentation.

### 1.2 Scale Parameters

| Parameter | Value |
|-----------|-------|
| Total mailboxes | ~2,000 |
| Estimated recipients | ~4,000–6,000 |
| Concurrent users | 2–5 staff |
| Data growth rate | ~50–100 MB/year |
| SMS volume | ~500–2,000/month |

### 1.3 Requirements Summary

| Requirement | Specification |
|-------------|---------------|
| Availability | 99.5% uptime |
| Response time | < 500ms for reads, < 1s for writes |
| Data retention | Indefinite for core data, 7 years for audit logs |
| Backup | Daily incremental, weekly full |
| Recovery | Point-in-time recovery within 30 days |

---

## 2. Architecture

### 2.1 High-Level Architecture (VPS + Docker Compose)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
│         Browser (Desktop/Tablet)              Mobile Browser             │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ HTTPS
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE (CDN/WAF)                            │
│                    DDoS Protection, DNS, Caching                         │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      VPS (Hostinger / DigitalOcean)                     │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                       Docker Compose                               │  │
│  │                                                                    │  │
│  │  ┌─────────────┐  ┌─────────────────────────────────────────────┐ │  │
│  │  │   Nginx     │  │            Next.js App Container            │ │  │
│  │  │  (SSL/Proxy)│──│  ┌─────────┐ ┌─────────┐ ┌──────────────┐  │ │  │
│  │  └─────────────┘  │  │ React   │ │ API     │ │ Background   │  │ │  │
│  │                   │  │ Frontend│ │ Routes  │ │ Jobs (cron)  │  │ │  │
│  │                   │  └─────────┘ └─────────┘ └──────────────┘  │ │  │
│  │                   └─────────────────────────────────────────────┘ │  │
│  │                                      │                            │  │
│  │  ┌─────────────┐                     │                            │  │
│  │  │ PostgreSQL  │◄────────────────────┘                            │  │
│  │  │ Container   │                                                  │  │
│  │  └─────────────┘                                                  │  │
│  │                                                                    │  │
│  │  ┌─────────────┐                                                  │  │
│  │  │ Backup      │──────────────────────────────┐                   │  │
│  │  │ Container   │                              │                   │  │
│  │  └─────────────┘                              │                   │  │
│  └───────────────────────────────────────────────│───────────────────┘  │
└──────────────────────────────────────────────────│──────────────────────┘
                                                   │
        ┌──────────────────────────────────────────┼─────────────────┐
        │                                          │                 │
        ▼                                          ▼                 ▼
┌───────────────┐                         ┌───────────────┐  ┌───────────────┐
│    Twilio     │                         │ Backblaze B2  │  │ Let's Encrypt │
│   (SMS API)   │                         │  (Backups)    │  │  (SSL Certs)  │
└───────────────┘                         └───────────────┘  └───────────────┘
```

### 2.2 Container Overview

| Container | Image | Purpose |
|-----------|-------|---------|
| `pcms-nginx` | nginx:alpine | Reverse proxy, SSL termination, static caching |
| `pcms-app` | Custom (Next.js) | Application server, API, background jobs |
| `pcms-db` | postgres:16-alpine | Primary database |
| `pcms-backup` | postgres:16-alpine | Automated backups to Backblaze B2 |
| `pcms-certbot` | certbot/certbot | SSL certificate renewal |

### 2.3 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Nginx** | SSL termination, reverse proxy, gzip compression, static file caching |
| **Frontend** | React-based UI with server-side rendering |
| **API Layer** | RESTful endpoints for all operations |
| **Background Jobs** | Scheduled tasks for reminders, status updates |
| **Database** | Primary data store (PostgreSQL 16) |
| **SMS Service** | Customer notifications via Twilio |
| **Backup** | Automated database backups to Backblaze B2 |

### 2.4 Data Flow

#### Read Operation (View Account)
```
Browser → Nginx → Next.js → API Route → Prisma ORM → PostgreSQL
   ↑                                                       │
   └────────────────────── JSON Response ──────────────────┘
```

#### Write Operation (Record Payment)
```
Browser → Nginx → API Route → Validation → Prisma Transaction
                                                │
                    ┌───────────────────────────┼───────────────────────┐
                    ▼                           ▼                       ▼
              Update Account            Create Payment          Create Audit Log
                    │                           │                       │
                    └───────────────────────────┴───────────────────────┘
                                                │
                                         Commit Transaction
                                                │
                                         ▼
                              Return Success Response
```

---

## 3. Technology Stack

### 3.1 Core Technologies

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| **Language** | TypeScript | 5.x | Type safety, developer experience |
| **Runtime** | Node.js | 20.x LTS | Stable, long-term support |
| **Framework** | Next.js | 14.x | SSR, API routes, React integration |
| **UI Library** | React | 18.x | Component-based architecture |
| **Styling** | Tailwind CSS | 3.x | Utility-first, rapid development |
| **ORM** | Prisma | 5.x | Type-safe database access |
| **Database** | PostgreSQL | 16.x | Robust, feature-rich RDBMS |

### 3.2 Supporting Libraries

| Purpose | Library | Notes |
|---------|---------|-------|
| **Authentication** | NextAuth.js | Session-based auth |
| **Validation** | Zod | Schema validation |
| **Forms** | React Hook Form | Form state management |
| **Tables** | TanStack Table | Sorting, filtering, pagination |
| **Date Handling** | date-fns | Date manipulation |
| **SMS** | Twilio SDK | @twilio/node |
| **PDF Generation** | @react-pdf/renderer | For printable documents |
| **Scheduling** | node-cron | Background job scheduling |
| **Testing** | Vitest + Playwright | Unit and E2E testing |

### 3.3 Infrastructure

| Service | Provider Options | Recommended |
|---------|------------------|-------------|
| **Hosting** | VPS (Hostinger), Railway, DigitalOcean | VPS with Docker |
| **Database** | Neon, Supabase, Railway Postgres | Neon (serverless) |
| **SMS** | Twilio | Twilio |
| **Backup Storage** | AWS S3, Backblaze B2, Cloudflare R2 | Backblaze B2 |
| **CDN/WAF** | Cloudflare | Cloudflare (free tier) |
| **Monitoring** | Better Stack, Sentry | Sentry |

---

## 4. Database Design

### 4.1 Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│     mailboxes    │       │     accounts     │       │    recipients    │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │◄──────│ mailbox_id (FK)  │◄──────│ account_id (FK)  │
│ number           │       │ id (PK)          │       │ id (PK)          │
│ size             │       │ status           │       │ is_primary       │
│ status           │       │ renewal_period   │       │ first_name       │
│ created_at       │       │ start_date       │       │ last_name        │
│ updated_at       │       │ next_renewal     │       │ date_of_birth    │
└──────────────────┘       │ current_rate     │       │ phone            │
                           │ sms_enabled      │       │ email            │
                           │ sms_phone        │       │ id_type          │
                           │ memo             │       │ id_expiration    │
                           │ created_at       │       │ form_1583_date   │
                           │ updated_at       │       │ added_date       │
                           └────────┬─────────┘       │ removed_date     │
                                    │                 │ created_at       │
             ┌──────────────────────┼─────────────────│ updated_at       │
             │                      │                 └──────────────────┘
             ▼                      ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    payments      │       │    reminders     │       │    sms_logs      │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │       │ id (PK)          │
│ account_id (FK)  │       │ account_id (FK)  │       │ account_id (FK)  │
│ amount           │       │ recipient_id(FK) │       │ message_type     │
│ payment_date     │       │ type             │       │ recipient_phone  │
│ payment_method   │       │ trigger_date     │       │ message_body     │
│ period_start     │       │ message          │       │ twilio_sid       │
│ period_end       │       │ is_dismissed     │       │ status           │
│ notes            │       │ created_by (FK)  │       │ sent_at          │
│ recorded_by (FK) │       │ created_at       │       │ created_at       │
│ created_at       │       └──────────────────┘       └──────────────────┘
└──────────────────┘

┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│      users       │       │   audit_logs     │       │   rate_history   │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │       │ id (PK)          │
│ username         │       │ user_id (FK)     │       │ effective_date   │
│ email            │       │ action           │       │ base_rate_3mo    │
│ password_hash    │       │ entity_type      │       │ base_rate_6mo    │
│ role             │       │ entity_id        │       │ base_rate_12mo   │
│ is_active        │       │ changes (JSONB)  │       │ rate_4th_adult   │
│ last_login       │       │ ip_address       │       │ rate_5th_adult   │
│ created_at       │       │ user_agent       │       │ rate_6th_adult   │
│ updated_at       │       │ created_at       │       │ key_deposit      │
└──────────────────┘       └──────────────────┘       │ created_at       │
                                                      └──────────────────┘
```

### 4.2 Schema Definition (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// ENUMS
// ============================================================

enum MailboxSize {
  SMALL
  MEDIUM
  LARGE
}

enum MailboxStatus {
  AVAILABLE
  ACTIVE
  HOLD
  CLOSED
}

enum AccountStatus {
  ACTIVE
  HOLD
  CLOSED
}

enum RenewalPeriod {
  THREE_MONTH
  SIX_MONTH
  TWELVE_MONTH
}

enum PaymentMethod {
  CASH
  CARD
  CHECK
}

enum RecipientType {
  PERSON
  BUSINESS
}

enum ReminderType {
  RENEWAL
  OVERDUE
  AGE_18
  ID_EXPIRY
  BIRTHDAY
  CUSTOM
}

enum UserRole {
  STAFF
  MANAGER
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
}

enum SmsStatus {
  QUEUED
  SENT
  DELIVERED
  FAILED
}

// ============================================================
// MODELS
// ============================================================

model Mailbox {
  id          String        @id @default(uuid())
  number      String        @unique
  size        MailboxSize   @default(SMALL)
  status      MailboxStatus @default(AVAILABLE)
  keyDeposit  Decimal       @default(5.00) @db.Decimal(10, 2)
  createdAt   DateTime      @default(now()) @map("created_at")
  updatedAt   DateTime      @updatedAt @map("updated_at")

  account     Account?

  @@map("mailboxes")
}

model Account {
  id              String        @id @default(uuid())
  mailboxId       String        @unique @map("mailbox_id")
  status          AccountStatus @default(ACTIVE)
  renewalPeriod   RenewalPeriod @map("renewal_period")
  startDate       DateTime      @map("start_date") @db.Date
  lastRenewalDate DateTime?     @map("last_renewal_date") @db.Date
  nextRenewalDate DateTime      @map("next_renewal_date") @db.Date
  currentRate     Decimal       @map("current_rate") @db.Decimal(10, 2)
  depositPaid     Decimal       @map("deposit_paid") @db.Decimal(10, 2)
  depositReturned Boolean       @default(false) @map("deposit_returned")
  smsEnabled      Boolean       @default(false) @map("sms_enabled")  // Opt-in: customer must agree
  smsPhone        String?       @map("sms_phone")
  closedAt        DateTime?     @map("closed_at")
  closureReason   String?       @map("closure_reason")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  mailbox         Mailbox       @relation(fields: [mailboxId], references: [id])
  recipients      Recipient[]
  payments        Payment[]
  reminders       Reminder[]
  smsLogs         SmsLog[]
  memos           Memo[]

  @@index([status])
  @@index([nextRenewalDate])
  @@map("accounts")
}

model Recipient {
  id                  String        @id @default(uuid())
  accountId           String        @map("account_id")
  isPrimary           Boolean       @default(false) @map("is_primary")
  
  // Recipient Type (discriminator for Person vs Business)
  recipientType       RecipientType @default(PERSON) @map("recipient_type")
  
  // ============================================
  // Person Fields (used when recipientType = PERSON)
  // ============================================
  firstName           String?       @map("first_name")
  middleName          String?       @map("middle_name")
  lastName            String?       @map("last_name")
  personAlias         String?       @map("person_alias")
  birthdate           DateTime?     @map("birthdate") @db.Date
  
  // ============================================
  // Business Fields (used when recipientType = BUSINESS)
  // ============================================
  businessName        String?       @map("business_name")
  businessAlias       String?       @map("business_alias")
  businessRegNumber   String?       @map("business_reg_number")
  validUntilDate      DateTime?     @map("valid_until_date") @db.Date
  
  // ============================================
  // ID Document (primarily for Person recipients)
  // ============================================
  idType              String?       @map("id_type")
  idStateCountry      String?       @map("id_state_country")
  idExpirationDate    DateTime?     @map("id_expiration_date") @db.Date
  idVerifiedDate      DateTime?     @map("id_verified_date") @db.Date
  idVerifiedBy        String?       @map("id_verified_by")
  
  // ============================================
  // Proof of Residence (primarily for Person recipients)
  // ============================================
  porType             String?       @map("por_type")
  porDateProvided     DateTime?     @map("por_date_provided") @db.Date
  porVerifiedBy       String?       @map("por_verified_by")
  
  // USPS Form 1583
  form1583SignedDate  DateTime? @map("form_1583_signed_date") @db.Date
  form1583Notarized   Boolean   @default(false) @map("form_1583_notarized")
  
  // Status
  addedDate           DateTime  @default(now()) @map("added_date") @db.Date
  removedDate         DateTime? @map("removed_date") @db.Date
  removalReason       String?   @map("removal_reason")
  
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  account             Account   @relation(fields: [accountId], references: [id])
  contactCard         ContactCard?
  reminders           Reminder[]
  verifiedByUser      User?     @relation("IdVerifier", fields: [idVerifiedBy], references: [id])
  porVerifiedByUser   User?     @relation("PorVerifier", fields: [porVerifiedBy], references: [id])

  @@index([accountId])
  @@index([recipientType])
  @@index([lastName, firstName])
  @@index([businessName])
  @@index([idExpirationDate])
  @@index([birthdate])
  @@index([validUntilDate])
  @@map("recipients")
}

// ============================================================
// CONTACT CARD - Container for recipient's contact information
// ============================================================

model ContactCard {
  id            String         @id @default(uuid())
  recipientId   String         @unique @map("recipient_id")
  
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")

  recipient     Recipient      @relation(fields: [recipientId], references: [id], onDelete: Cascade)
  phoneNumbers  PhoneNumber[]
  emailAddresses EmailAddress[]

  @@map("contact_cards")
}

// ============================================================
// PHONE NUMBER - Individual phone entry (E.164 storage only)
// ============================================================

model PhoneNumber {
  id            String      @id @default(uuid())
  contactCardId String      @map("contact_card_id")
  
  // Phone number stored in E.164 format only (e.g., +16715551234)
  // Display formatting is done at runtime in the application layer
  e164Format    String      @map("e164_format")
  
  // Phone type and flags
  isMobile      Boolean     @default(false) @map("is_mobile")
  isPrimary     Boolean     @default(false) @map("is_primary")
  
  // Label (e.g., "Work", "Home", "Cell", "Office", "Fax")
  label         String?
  
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")

  contactCard   ContactCard @relation(fields: [contactCardId], references: [id], onDelete: Cascade)

  @@index([contactCardId])
  @@index([e164Format])
  @@map("phone_numbers")
}

// ============================================================
// EMAIL ADDRESS - Individual email entry with label
// ============================================================

model EmailAddress {
  id            String      @id @default(uuid())
  contactCardId String      @map("contact_card_id")
  
  // Email address (stored lowercase, validated format)
  email         String
  
  // Flags
  isPrimary     Boolean     @default(false) @map("is_primary")
  
  // Label (e.g., "Personal", "Work", "Business")
  label         String?
  
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")

  contactCard   ContactCard @relation(fields: [contactCardId], references: [id], onDelete: Cascade)

  @@index([contactCardId])
  @@index([email])
  @@map("email_addresses")
}

model Payment {
  id            String        @id @default(uuid())
  accountId     String        @map("account_id")
  amount        Decimal       @db.Decimal(10, 2)
  paymentDate   DateTime      @map("payment_date") @db.Date
  paymentMethod PaymentMethod @map("payment_method")
  periodStart   DateTime      @map("period_start") @db.Date
  periodEnd     DateTime      @map("period_end") @db.Date
  notes         String?       @db.Text
  recordedBy    String        @map("recorded_by")
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")

  account       Account       @relation(fields: [accountId], references: [id])
  recordedByUser User         @relation(fields: [recordedBy], references: [id])

  @@index([accountId])
  @@index([paymentDate])
  @@map("payments")
}

model Reminder {
  id          String        @id @default(uuid())
  accountId   String?       @map("account_id")
  recipientId String?       @map("recipient_id")
  type        ReminderType
  triggerDate DateTime      @map("trigger_date") @db.Date
  message     String        @db.Text
  isDismissed Boolean       @default(false) @map("is_dismissed")
  dismissedBy String?       @map("dismissed_by")
  dismissedAt DateTime?     @map("dismissed_at")
  createdBy   String?       @map("created_by")
  createdAt   DateTime      @default(now()) @map("created_at")
  updatedAt   DateTime      @updatedAt @map("updated_at")

  account     Account?      @relation(fields: [accountId], references: [id])
  recipient   Recipient?    @relation(fields: [recipientId], references: [id])
  creator     User?         @relation("ReminderCreator", fields: [createdBy], references: [id])
  dismisser   User?         @relation("ReminderDismisser", fields: [dismissedBy], references: [id])

  @@index([triggerDate])
  @@index([type])
  @@map("reminders")
}

model SmsLog {
  id             String    @id @default(uuid())
  accountId      String    @map("account_id")
  messageType    String    @map("message_type")
  recipientPhone String    @map("recipient_phone")
  messageBody    String    @map("message_body") @db.Text
  twilioSid      String?   @map("twilio_sid")
  status         SmsStatus @default(QUEUED)
  errorMessage   String?   @map("error_message")
  sentAt         DateTime? @map("sent_at")
  statusUpdated  DateTime? @map("status_updated")
  createdAt      DateTime  @default(now()) @map("created_at")

  account        Account   @relation(fields: [accountId], references: [id])

  @@index([accountId])
  @@index([status])
  @@map("sms_logs")
}

model User {
  id           String    @id @default(uuid())
  username     String    @unique
  email        String    @unique
  passwordHash String    @map("password_hash")
  role         UserRole  @default(STAFF)
  isActive     Boolean   @default(true) @map("is_active")
  lastLogin    DateTime? @map("last_login")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  payments          Payment[]
  auditLogs         AuditLog[]
  createdReminders  Reminder[] @relation("ReminderCreator")
  dismissedReminders Reminder[] @relation("ReminderDismisser")
  idVerifications   Recipient[] @relation("IdVerifier")
  porVerifications  Recipient[] @relation("PorVerifier")
  createdMemos      Memo[] @relation("MemoCreator")
  updatedMemos      Memo[] @relation("MemoUpdater")
  deletedMemos      Memo[] @relation("MemoDeleter")

  @@map("users")
}

model AuditLog {
  id          String      @id @default(uuid())
  userId      String?     @map("user_id")
  userName    String      @map("user_name")
  action      AuditAction
  entityType  String      @map("entity_type")
  entityId    String      @map("entity_id")
  changes     Json?       @db.JsonB
  ipAddress   String?     @map("ip_address")
  userAgent   String?     @map("user_agent") @db.Text
  createdAt   DateTime    @default(now()) @map("created_at")

  user        User?       @relation(fields: [userId], references: [id])

  @@index([entityType, entityId])
  @@index([createdAt])
  @@index([userId])
  @@map("audit_logs")
}

// ============================================================
// MEMO - Notes attached to accounts (manager-only edit/delete)
// ============================================================

model Memo {
  id          String    @id @default(uuid())
  accountId   String    @map("account_id")
  
  // Memo content
  content     String    @db.Text
  
  // Who created/modified this memo
  createdById String    @map("created_by_id")
  updatedById String?   @map("updated_by_id")
  
  // Timestamps
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  
  // Soft delete (only managers can delete)
  deletedAt   DateTime? @map("deleted_at")
  deletedById String?   @map("deleted_by_id")

  account     Account   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  createdBy   User      @relation("MemoCreator", fields: [createdById], references: [id])
  updatedBy   User?     @relation("MemoUpdater", fields: [updatedById], references: [id])
  deletedBy   User?     @relation("MemoDeleter", fields: [deletedById], references: [id])

  @@index([accountId])
  @@index([createdAt])
  @@map("memos")
}

model RateHistory {
  id            String   @id @default(uuid())
  effectiveDate DateTime @map("effective_date") @db.Date
  baseRate3mo   Decimal  @map("base_rate_3mo") @db.Decimal(10, 2)
  baseRate6mo   Decimal  @map("base_rate_6mo") @db.Decimal(10, 2)
  baseRate12mo  Decimal  @map("base_rate_12mo") @db.Decimal(10, 2)
  rate4thAdult  Decimal  @map("rate_4th_adult") @db.Decimal(10, 2)
  rate5thAdult  Decimal  @map("rate_5th_adult") @db.Decimal(10, 2)
  rate6thAdult  Decimal  @map("rate_6th_adult") @db.Decimal(10, 2)
  keyDeposit    Decimal  @map("key_deposit") @db.Decimal(10, 2)
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([effectiveDate])
  @@map("rate_history")
}
```

### 4.3 Database Indexes

Critical indexes for performance:

```sql
-- Account lookups
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_next_renewal ON accounts(next_renewal_date);

-- Recipient searches
CREATE INDEX idx_recipients_account ON recipients(account_id);
CREATE INDEX idx_recipients_type ON recipients(recipient_type);
CREATE INDEX idx_recipients_name ON recipients(last_name, first_name)
  WHERE recipient_type = 'PERSON';
CREATE INDEX idx_recipients_business ON recipients(business_name)
  WHERE recipient_type = 'BUSINESS';
CREATE INDEX idx_recipients_id_expiry ON recipients(id_expiration_date) 
  WHERE removed_date IS NULL;
CREATE INDEX idx_recipients_birthdate ON recipients(birthdate) 
  WHERE removed_date IS NULL AND recipient_type = 'PERSON';
CREATE INDEX idx_recipients_valid_until ON recipients(valid_until_date)
  WHERE removed_date IS NULL AND recipient_type = 'BUSINESS';

-- Contact card, phone number, and email searches
CREATE INDEX idx_contact_cards_recipient ON contact_cards(recipient_id);
CREATE INDEX idx_phone_numbers_contact_card ON phone_numbers(contact_card_id);
CREATE INDEX idx_phone_numbers_e164 ON phone_numbers(e164_format);
CREATE INDEX idx_phone_numbers_primary ON phone_numbers(contact_card_id) 
  WHERE is_primary = true;
CREATE INDEX idx_email_addresses_contact_card ON email_addresses(contact_card_id);
CREATE INDEX idx_email_addresses_email ON email_addresses(email);
CREATE INDEX idx_email_addresses_primary ON email_addresses(contact_card_id)
  WHERE is_primary = true;

-- Memo searches
CREATE INDEX idx_memos_account ON memos(account_id);
CREATE INDEX idx_memos_created_at ON memos(created_at);
CREATE INDEX idx_memos_active ON memos(account_id) 
  WHERE deleted_at IS NULL;

-- Payment history
CREATE INDEX idx_payments_account ON payments(account_id);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- Audit queries
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_timestamp ON audit_logs(created_at DESC);

-- Full-text search on recipient names (Person: names + alias, Business: name + alias)
CREATE INDEX idx_recipients_fulltext ON recipients 
  USING gin(to_tsvector('english', 
    COALESCE(first_name, '') || ' ' || 
    COALESCE(middle_name, '') || ' ' || 
    COALESCE(last_name, '') || ' ' || 
    COALESCE(person_alias, '') || ' ' || 
    COALESCE(business_name, '') || ' ' ||
    COALESCE(business_alias, '')));
```

### 4.4 Domain Models (TypeScript)

The following TypeScript models implement business logic for recipients and contact cards.

#### Recipient Base Interface

```typescript
// lib/models/recipient.ts

import { RecipientType } from '@prisma/client';

/**
 * Base interface for all recipient types
 */
export interface IRecipient {
  id: string;
  accountId: string;
  isPrimary: boolean;
  recipientType: RecipientType;
  
  /** Returns the display name for UI and printed materials */
  getDisplayName(): string;
  
  /** Returns true if verification is required within 30 days */
  requiresVerification(): boolean;
  
  /** Returns the date that triggers verification (birthday or valid_until) */
  getVerificationTriggerDate(): Date | null;
}
```

#### Person Recipient Class

```typescript
// lib/models/person-recipient.ts

import { IRecipient } from './recipient';
import { addDays, differenceInDays, differenceInYears } from 'date-fns';

export interface PersonData {
  id: string;
  accountId: string;
  isPrimary: boolean;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  personAlias?: string | null;
  birthdate: Date;
}

export class PersonRecipient implements IRecipient {
  readonly id: string;
  readonly accountId: string;
  readonly isPrimary: boolean;
  readonly recipientType = 'PERSON' as const;
  
  readonly firstName: string;
  readonly middleName: string | null;
  readonly lastName: string;
  readonly alias: string | null;
  readonly birthdate: Date;

  constructor(data: PersonData) {
    this.id = data.id;
    this.accountId = data.accountId;
    this.isPrimary = data.isPrimary;
    this.firstName = data.firstName;
    this.middleName = data.middleName ?? null;
    this.lastName = data.lastName;
    this.alias = data.personAlias ?? null;
    this.birthdate = new Date(data.birthdate);
  }

  /**
   * Returns formatted display name
   * Format with alias: "FirstName MiddleName "Alias" LastName"
   * Format without alias: "FirstName MiddleName LastName"
   * 
   * Examples:
   * - John Michael "Johnny" Smith
   * - Maria "Mari" Santos
   * - Robert James Lee (no alias)
   */
  getDisplayName(): string {
    const parts: string[] = [this.firstName];
    
    if (this.middleName) {
      parts.push(this.middleName);
    }
    
    if (this.alias) {
      parts.push(`"${this.alias}"`);
    }
    
    parts.push(this.lastName);
    
    return parts.join(' ');
  }

  /**
   * Returns the full legal name (without alias)
   */
  getLegalName(): string {
    const parts = [this.firstName];
    if (this.middleName) {
      parts.push(this.middleName);
    }
    parts.push(this.lastName);
    return parts.join(' ');
  }

  /**
   * Returns just the alias if set, otherwise null
   */
  getAlias(): string | null {
    return this.alias;
  }

  /**
   * Returns true if this person is currently a minor (under 18)
   */
  isMinor(): boolean {
    return this.getAge() < 18;
  }

  /**
   * Returns the person's current age in years
   */
  getAge(): number {
    return differenceInYears(new Date(), this.birthdate);
  }

  /**
   * Returns the date of the person's 18th birthday
   */
  get18thBirthday(): Date {
    const birthday = new Date(this.birthdate);
    birthday.setFullYear(birthday.getFullYear() + 18);
    return birthday;
  }

  /**
   * Returns true if verification is required within 30 days
   * For minors: verification required 30 days before 18th birthday
   */
  requiresVerification(): boolean {
    if (!this.isMinor()) {
      return false;
    }
    
    const daysUntil18 = differenceInDays(this.get18thBirthday(), new Date());
    return daysUntil18 >= 0 && daysUntil18 <= 30;
  }

  /**
   * Returns the verification trigger date (18th birthday for persons)
   */
  getVerificationTriggerDate(): Date | null {
    if (this.isMinor()) {
      return this.get18thBirthday();
    }
    return null;
  }

  /**
   * Returns days until 18th birthday (negative if already 18+)
   */
  getDaysUntil18(): number {
    return differenceInDays(this.get18thBirthday(), new Date());
  }
}
```

#### Business Recipient Class

```typescript
// lib/models/business-recipient.ts

import { IRecipient } from './recipient';
import { differenceInDays } from 'date-fns';

export interface BusinessData {
  id: string;
  accountId: string;
  isPrimary: boolean;
  businessName: string;
  businessAlias?: string | null;
  businessRegNumber?: string | null;
  validUntilDate?: Date | null;
}

export class BusinessRecipient implements IRecipient {
  readonly id: string;
  readonly accountId: string;
  readonly isPrimary: boolean;
  readonly recipientType = 'BUSINESS' as const;
  
  readonly businessName: string;
  readonly businessAlias: string | null;
  readonly businessRegNumber: string | null;
  readonly validUntilDate: Date | null;

  constructor(data: BusinessData) {
    this.id = data.id;
    this.accountId = data.accountId;
    this.isPrimary = data.isPrimary;
    this.businessName = data.businessName;
    this.businessAlias = data.businessAlias ?? null;
    this.businessRegNumber = data.businessRegNumber ?? null;
    this.validUntilDate = data.validUntilDate 
      ? new Date(data.validUntilDate) 
      : null;
  }

  /**
   * Returns formatted display name
   * Uses business alias if available, otherwise business name
   */
  getDisplayName(): string {
    return this.businessAlias ?? this.businessName;
  }

  /**
   * Returns the official business name (without alias substitution)
   */
  getOfficialName(): string {
    return this.businessName;
  }

  /**
   * Returns true if business registration is expired
   */
  isExpired(): boolean {
    if (!this.validUntilDate) {
      return false;
    }
    return this.validUntilDate < new Date();
  }

  /**
   * Returns true if verification is required within 30 days
   * For businesses: verification required 30 days before registration expires
   */
  requiresVerification(): boolean {
    if (!this.validUntilDate) {
      return false;
    }
    
    const daysUntilExpiry = differenceInDays(this.validUntilDate, new Date());
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  }

  /**
   * Returns the verification trigger date (validUntilDate for businesses)
   */
  getVerificationTriggerDate(): Date | null {
    return this.validUntilDate;
  }

  /**
   * Returns days until registration expires (negative if expired)
   */
  getDaysUntilExpiry(): number | null {
    if (!this.validUntilDate) {
      return null;
    }
    return differenceInDays(this.validUntilDate, new Date());
  }
}
```

#### Phone Number Utilities and Class

```typescript
// lib/utils/phone-format.ts

/**
 * Phone number formatting utilities
 * 
 * Storage: E.164 format only (e.g., +16715551234)
 * Display: Human-readable format generated at runtime
 */

/**
 * Converts user input to E.164 format for storage
 * 
 * Rules:
 * - 7 digits: Guam local → +1671NNNNNNN
 * - 10 digits: US/Canada → +1NNNNNNNNNN
 * - 11 digits starting with 1: US with country code → +1NNNNNNNNNN
 * - 11+ digits: International → +NNNNNNNNNNN
 */
export function toE164(input: string): string {
  // Remove all non-digit characters except leading +
  const hasPlus = input.startsWith('+');
  const digits = input.replace(/\D/g, '');
  
  if (digits.length === 7) {
    // Guam local number - add +1671
    return `+1671${digits}`;
  }
  
  if (digits.length === 10) {
    // US/Canada number - add +1
    return `+1${digits}`;
  }
  
  if (digits.length === 11 && digits.startsWith('1')) {
    // US number with country code
    return `+${digits}`;
  }
  
  if (digits.length >= 11) {
    // International number
    return `+${digits}`;
  }
  
  // Invalid/short number - return digits only (will fail validation)
  return digits;
}

/**
 * Converts E.164 format to human-readable display format
 * 
 * Examples:
 * - +16715551234 → +1 671 555 1234
 * - +18085551234 → +1 808 555 1234
 * - +819012345678 → +81 90 1234 5678
 */
export function formatForDisplay(e164: string): string {
  if (!e164 || !e164.startsWith('+')) {
    return e164; // Return as-is if not valid E.164
  }
  
  const digits = e164.slice(1); // Remove leading +
  
  // US/Canada/Guam numbers (+1)
  if (digits.startsWith('1') && digits.length === 11) {
    const areaCode = digits.slice(1, 4);
    const exchange = digits.slice(4, 7);
    const subscriber = digits.slice(7);
    return `+1 ${areaCode} ${exchange} ${subscriber}`;
  }
  
  // Japan (+81) - common format
  if (digits.startsWith('81') && digits.length >= 11) {
    return `+81 ${digits.slice(2, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
  }
  
  // Generic international format
  if (digits.length <= 11) {
    // Short international: +CC NNN NNN NNNN
    const cc = digits.slice(0, 2);
    const rest = digits.slice(2);
    return `+${cc} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`.trim();
  }
  
  // Long international: +CC NNN NNNN NNNN
  const cc = digits.slice(0, 2);
  const rest = digits.slice(2);
  return `+${cc} ${rest.slice(0, 3)} ${rest.slice(3, 7)} ${rest.slice(7)}`.trim();
}

/**
 * Validates if the input can be converted to a valid E.164 number
 */
export function isValidPhoneInput(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Validates if a string is a valid E.164 format
 */
export function isValidE164(e164: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(e164);
}

/**
 * Returns true if the E.164 number is a Guam number
 */
export function isGuamNumber(e164: string): boolean {
  return e164.startsWith('+1671');
}

/**
 * Returns true if the E.164 number is a US/Canada number
 */
export function isNorthAmericanNumber(e164: string): boolean {
  return e164.startsWith('+1');
}
```

#### Phone Number Class

```typescript
// lib/models/phone-number.ts

import { 
  toE164, 
  formatForDisplay, 
  isGuamNumber, 
  isNorthAmericanNumber 
} from '../utils/phone-format';

export interface PhoneNumberData {
  id: string;
  contactCardId: string;
  e164Format: string;     // Stored in database
  isMobile: boolean;
  isPrimary: boolean;
  label?: string | null;
}

export class PhoneNumber {
  readonly id: string;
  readonly contactCardId: string;
  readonly e164Format: string;
  readonly isMobile: boolean;
  readonly isPrimary: boolean;
  readonly label: string | null;

  constructor(data: PhoneNumberData) {
    this.id = data.id;
    this.contactCardId = data.contactCardId;
    this.e164Format = data.e164Format;
    this.isMobile = data.isMobile;
    this.isPrimary = data.isPrimary;
    this.label = data.label ?? null;
  }

  /**
   * Creates a PhoneNumber from user input (converts to E.164)
   */
  static fromUserInput(
    input: string,
    options: Omit<PhoneNumberData, 'e164Format'>
  ): PhoneNumber {
    return new PhoneNumber({
      ...options,
      e164Format: toE164(input),
    });
  }

  /**
   * Returns human-readable display format
   * e.g., +16715551234 → "+1 671 555 1234"
   */
  getDisplayFormat(): string {
    return formatForDisplay(this.e164Format);
  }

  /**
   * Returns formatted string with label for display
   * e.g., "Cell: +1 671 555 1234"
   */
  getDisplayWithLabel(): string {
    const display = this.getDisplayFormat();
    if (this.label) {
      return `${this.label}: ${display}`;
    }
    return display;
  }

  /**
   * Returns true if this is a Guam phone number
   */
  isGuamNumber(): boolean {
    return isGuamNumber(this.e164Format);
  }

  /**
   * Returns true if this is a US/Canada number (including Guam)
   */
  isNorthAmericanNumber(): boolean {
    return isNorthAmericanNumber(this.e164Format);
  }
}
```

#### Email Address Class

```typescript
// lib/models/email-address.ts

export interface EmailAddressData {
  id: string;
  contactCardId: string;
  email: string;
  isPrimary: boolean;
  label?: string | null;  // "Personal", "Work", "Business", etc.
}

export class EmailAddress {
  readonly id: string;
  readonly contactCardId: string;
  readonly email: string;
  readonly normalizedEmail: string;
  readonly isPrimary: boolean;
  readonly label: string | null;

  constructor(data: EmailAddressData) {
    this.id = data.id;
    this.contactCardId = data.contactCardId;
    this.email = data.email;
    this.normalizedEmail = EmailAddress.normalize(data.email);
    this.isPrimary = data.isPrimary;
    this.label = data.label ?? null;
  }

  /**
   * Normalizes email address (lowercase, trimmed)
   */
  static normalize(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Validates email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Returns formatted string with label for display
   * e.g., "Work: john@company.com" or "john@company.com"
   */
  getDisplayWithLabel(): string {
    if (this.label) {
      return `${this.label}: ${this.email}`;
    }
    return this.email;
  }

  /**
   * Returns the domain portion of the email
   */
  getDomain(): string {
    return this.normalizedEmail.split('@')[1] ?? '';
  }
}
```

#### Contact Card Class (Container for Phone Numbers and Emails)

```typescript
// lib/models/contact-card.ts

import { PhoneNumber, PhoneNumberData } from './phone-number';
import { EmailAddress, EmailAddressData } from './email-address';

export interface ContactCardData {
  id: string;
  recipientId: string;
  phoneNumbers: PhoneNumberData[];
  emailAddresses: EmailAddressData[];
}

export class ContactCard {
  readonly id: string;
  readonly recipientId: string;
  readonly phoneNumbers: PhoneNumber[];
  readonly emailAddresses: EmailAddress[];

  constructor(data: ContactCardData) {
    this.id = data.id;
    this.recipientId = data.recipientId;
    this.phoneNumbers = data.phoneNumbers.map(pn => new PhoneNumber({
      ...pn,
      contactCardId: data.id,
    }));
    this.emailAddresses = data.emailAddresses.map(ea => new EmailAddress({
      ...ea,
      contactCardId: data.id,
    }));
  }

  // ============================================
  // Phone Number Methods
  // ============================================

  /**
   * Returns the primary phone number, or the first one if none marked primary
   */
  getPrimaryPhone(): PhoneNumber | null {
    const primary = this.phoneNumbers.find(pn => pn.isPrimary);
    return primary ?? this.phoneNumbers[0] ?? null;
  }

  /**
   * Returns all mobile phone numbers (for SMS)
   */
  getMobileNumbers(): PhoneNumber[] {
    return this.phoneNumbers.filter(pn => pn.isMobile);
  }

  /**
   * Returns the primary mobile number for SMS
   * Prefers: primary + mobile > any mobile > primary > first
   */
  getSmsNumber(): PhoneNumber | null {
    // First choice: primary AND mobile
    const primaryMobile = this.phoneNumbers.find(pn => pn.isPrimary && pn.isMobile);
    if (primaryMobile) return primaryMobile;
    
    // Second choice: any mobile
    const anyMobile = this.phoneNumbers.find(pn => pn.isMobile);
    if (anyMobile) return anyMobile;
    
    // Fallback: primary or first
    return this.getPrimaryPhone();
  }

  /**
   * Returns phone numbers by label
   */
  getPhonesByLabel(label: string): PhoneNumber[] {
    return this.phoneNumbers.filter(
      pn => pn.label?.toLowerCase() === label.toLowerCase()
    );
  }

  /**
   * Returns true if this contact card has any phone numbers
   */
  hasPhoneNumbers(): boolean {
    return this.phoneNumbers.length > 0;
  }

  /**
   * Returns true if this contact card can receive SMS
   */
  canReceiveSms(): boolean {
    return this.phoneNumbers.some(pn => pn.isMobile);
  }

  /**
   * Returns all phone numbers formatted for display
   */
  getAllPhonesForDisplay(): string[] {
    return this.phoneNumbers.map(pn => pn.getDisplayWithLabel());
  }

  // ============================================
  // Email Address Methods
  // ============================================

  /**
   * Returns the primary email, or the first one if none marked primary
   */
  getPrimaryEmail(): EmailAddress | null {
    const primary = this.emailAddresses.find(ea => ea.isPrimary);
    return primary ?? this.emailAddresses[0] ?? null;
  }

  /**
   * Returns emails by label
   */
  getEmailsByLabel(label: string): EmailAddress[] {
    return this.emailAddresses.filter(
      ea => ea.label?.toLowerCase() === label.toLowerCase()
    );
  }

  /**
   * Returns true if this contact card has any email addresses
   */
  hasEmailAddresses(): boolean {
    return this.emailAddresses.length > 0;
  }

  /**
   * Returns all email addresses formatted for display
   */
  getAllEmailsForDisplay(): string[] {
    return this.emailAddresses.map(ea => ea.getDisplayWithLabel());
  }

  // ============================================
  // Combined Methods
  // ============================================

  /**
   * Returns true if contact card has any contact info
   */
  hasContactInfo(): boolean {
    return this.hasPhoneNumbers() || this.hasEmailAddresses();
  }

  /**
   * Returns summary of all contact info for display
   */
  getContactSummary(): { phones: string[]; emails: string[] } {
    return {
      phones: this.getAllPhonesForDisplay(),
      emails: this.getAllEmailsForDisplay(),
    };
  }
}
```

#### Common Labels

```typescript
// lib/models/contact-labels.ts

/**
 * Standard phone number labels
 */
export const PHONE_LABELS = {
  CELL: 'Cell',
  MOBILE: 'Mobile',
  HOME: 'Home',
  WORK: 'Work',
  OFFICE: 'Office',
  FAX: 'Fax',
  OTHER: 'Other',
} as const;

export type PhoneLabel = typeof PHONE_LABELS[keyof typeof PHONE_LABELS];

/**
 * Suggested phone labels for UI dropdowns
 */
export const SUGGESTED_PHONE_LABELS: PhoneLabel[] = [
  PHONE_LABELS.CELL,
  PHONE_LABELS.HOME,
  PHONE_LABELS.WORK,
  PHONE_LABELS.OFFICE,
  PHONE_LABELS.FAX,
  PHONE_LABELS.OTHER,
];

/**
 * Standard email address labels
 */
export const EMAIL_LABELS = {
  PERSONAL: 'Personal',
  WORK: 'Work',
  BUSINESS: 'Business',
  OTHER: 'Other',
} as const;

export type EmailLabel = typeof EMAIL_LABELS[keyof typeof EMAIL_LABELS];

/**
 * Suggested email labels for UI dropdowns
 */
export const SUGGESTED_EMAIL_LABELS: EmailLabel[] = [
  EMAIL_LABELS.PERSONAL,
  EMAIL_LABELS.WORK,
  EMAIL_LABELS.BUSINESS,
  EMAIL_LABELS.OTHER,
];
```

#### Factory Function for Creating Recipients

```typescript
// lib/models/recipient-factory.ts

import { PersonRecipient, PersonData } from './person-recipient';
import { BusinessRecipient, BusinessData } from './business-recipient';
import { IRecipient } from './recipient';

type RecipientRecord = {
  id: string;
  accountId: string;
  isPrimary: boolean;
  recipientType: 'PERSON' | 'BUSINESS';
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  personAlias?: string | null;
  birthdate?: Date | null;
  businessName?: string | null;
  businessAlias?: string | null;
  businessRegNumber?: string | null;
  validUntilDate?: Date | null;
};

/**
 * Factory function to create the appropriate recipient class
 * from a database record
 */
export function createRecipient(record: RecipientRecord): IRecipient {
  if (record.recipientType === 'PERSON') {
    if (!record.firstName || !record.lastName || !record.birthdate) {
      throw new Error('Person recipient requires firstName, lastName, and birthdate');
    }
    
    return new PersonRecipient({
      id: record.id,
      accountId: record.accountId,
      isPrimary: record.isPrimary,
      firstName: record.firstName,
      middleName: record.middleName,
      lastName: record.lastName,
      personAlias: record.personAlias,
      birthdate: record.birthdate,
    });
  }
  
  if (record.recipientType === 'BUSINESS') {
    if (!record.businessName) {
      throw new Error('Business recipient requires businessName');
    }
    
    return new BusinessRecipient({
      id: record.id,
      accountId: record.accountId,
      isPrimary: record.isPrimary,
      businessName: record.businessName,
      businessAlias: record.businessAlias,
      businessRegNumber: record.businessRegNumber,
      validUntilDate: record.validUntilDate,
    });
  }
  
  throw new Error(`Unknown recipient type: ${record.recipientType}`);
}

/**
 * Returns all recipients that require verification within 30 days
 */
export function getRecipientsRequiringVerification(
  recipients: IRecipient[]
): IRecipient[] {
  return recipients.filter(r => r.requiresVerification());
}
```

---

## 5. API Design

### 5.1 API Overview

RESTful API with JSON payloads. All endpoints prefixed with `/api/v1`.

### 5.2 Authentication

All endpoints require authentication except `/api/v1/auth/*`.

```
Authorization: Bearer <session_token>
```

### 5.3 Response Format

#### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

#### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalItems": 2000,
    "totalPages": 40
  }
}
```

### 5.4 Endpoint Reference

#### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/login` | User login | None |
| POST | `/auth/logout` | User logout | Required |
| GET | `/auth/session` | Get current session | Required |
| POST | `/auth/change-password` | Change password | Required |

#### Mailboxes

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/mailboxes` | List all mailboxes | Staff |
| GET | `/mailboxes/:id` | Get mailbox details | Staff |
| GET | `/mailboxes/available` | List available mailboxes | Staff |
| PATCH | `/mailboxes/:id` | Update mailbox | Manager |

#### Accounts

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/accounts` | List accounts (paginated) | Staff |
| GET | `/accounts/:id` | Get account details | Staff |
| POST | `/accounts` | Create new account | Manager |
| PATCH | `/accounts/:id` | Update account | Manager |
| POST | `/accounts/:id/close` | Close account | Manager |
| GET | `/accounts/:id/history` | Get account history | Staff |

#### Memos

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/accounts/:id/memos` | List memos for account | Staff |
| POST | `/accounts/:id/memos` | Add memo to account | Staff |
| PATCH | `/memos/:id` | Update memo | **Manager only** |
| DELETE | `/memos/:id` | Delete memo (soft delete) | **Manager only** |

#### Recipients

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/accounts/:id/recipients` | List recipients | Staff |
| POST | `/accounts/:id/recipients` | Add recipient | Manager |
| PATCH | `/recipients/:id` | Update recipient | Manager |
| POST | `/recipients/:id/remove` | Remove recipient | Manager |

#### Payments

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/accounts/:id/payments` | List payments | Staff |
| POST | `/accounts/:id/payments` | Record payment | Manager |
| GET | `/payments/:id` | Get payment details | Staff |

#### Reminders

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/reminders` | List active reminders | Staff |
| POST | `/reminders` | Create custom reminder | Manager |
| POST | `/reminders/:id/dismiss` | Dismiss reminder | Staff |

#### Reports

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/reports/renewals-due` | Accounts with upcoming renewals | Staff |
| GET | `/reports/overdue` | Overdue accounts | Staff |
| GET | `/reports/expiring-ids` | Recipients with expiring IDs | Staff |
| GET | `/reports/turning-18` | Recipients turning 18 soon | Staff |
| GET | `/reports/payment-summary` | Payment summary report | Manager |
| GET | `/reports/export` | Export data (CSV) | Manager |

#### Documents

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/documents/name-tags/:accountId` | Generate name tags PDF | Staff |
| GET | `/documents/payment-reminder/:accountId` | Generate reminder PDF | Staff |
| GET | `/documents/hold-notice/:accountId` | Generate hold notice PDF | Staff |
| POST | `/documents/batch-reminders` | Batch generate reminders | Manager |

#### Settings (Manager Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/settings/rates` | Get current rate schedule |
| POST | `/settings/rates` | Add new rate schedule |
| GET | `/settings/users` | List users |
| POST | `/settings/users` | Create user |
| PATCH | `/settings/users/:id` | Update user |
| GET | `/audit-logs` | Query audit logs |

### 5.5 Request/Response Examples

#### Create Account

**Request:**
```http
POST /api/v1/accounts
Content-Type: application/json

{
  "mailboxId": "mb_123",
  "renewalPeriod": "SIX_MONTH",
  "primaryRenter": {
    "firstName": "Maria",
    "lastName": "Johnson",
    "dateOfBirth": "1985-03-15",
    "phone": "6715551234",
    "email": "maria@email.com",
    "idType": "DRIVERS_LICENSE",
    "idStateCountry": "GU",
    "idExpirationDate": "2027-08-15",
    "porType": "UTILITY_BILL",
    "porDateProvided": "2025-12-10",
    "form1583SignedDate": "2025-12-10"
  },
  "initialPayment": {
    "amount": 275.00,
    "paymentMethod": "CASH"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "acc_456",
    "mailboxId": "mb_123",
    "mailboxNumber": "142",
    "status": "ACTIVE",
    "renewalPeriod": "SIX_MONTH",
    "startDate": "2025-12-12",
    "nextRenewalDate": "2026-06-12",
    "currentRate": 45.00,
    "depositPaid": 50.00,
    "primaryRenter": {
      "id": "rec_789",
      "firstName": "Maria",
      "lastName": "Johnson"
    },
    "createdAt": "2025-12-12T10:30:00Z"
  }
}
```

#### Search Accounts

**Request:**
```http
GET /api/v1/accounts?search=johnson&status=ACTIVE&page=1&pageSize=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "acc_456",
      "mailboxNumber": "142",
      "primaryRenter": {
        "firstName": "Maria",
        "lastName": "Johnson"
      },
      "status": "ACTIVE",
      "nextRenewalDate": "2026-06-12",
      "currentRate": 55.00,
      "recipientCount": 4
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

---

## 6. Authentication & Authorization

### 6.1 Authentication Flow

```
┌──────────┐      ┌──────────┐      ┌──────────┐
│  Client  │      │  Server  │      │ Database │
└────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                  │
     │  POST /login    │                  │
     │  {user, pass}   │                  │
     │────────────────►│                  │
     │                 │  Verify password │
     │                 │─────────────────►│
     │                 │◄─────────────────│
     │                 │                  │
     │                 │  Create session  │
     │                 │─────────────────►│
     │                 │◄─────────────────│
     │                 │                  │
     │  Set-Cookie:    │                  │
     │  session=xxx    │                  │
     │◄────────────────│                  │
     │                 │                  │
     │  GET /accounts  │                  │
     │  Cookie: xxx    │                  │
     │────────────────►│                  │
     │                 │  Validate session│
     │                 │─────────────────►│
     │                 │◄─────────────────│
     │                 │                  │
     │  200 OK         │                  │
     │◄────────────────│                  │
```

### 6.2 Session Management

- **Session storage:** Database-backed sessions via NextAuth.js
- **Session duration:** 8 hours (configurable)
- **Idle timeout:** 30 minutes of inactivity
- **Concurrent sessions:** Allowed (multiple devices)

### 6.3 Password Requirements

- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- Hashing: bcrypt with cost factor 12

### 6.4 Role Enforcement

```typescript
// middleware/authorize.ts
export function authorize(allowedRoles: UserRole[]) {
  return async (req: NextRequest) => {
    const session = await getSession(req);
    
    if (!session) {
      return Response.json(
        { success: false, error: { code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    
    if (!allowedRoles.includes(session.user.role)) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN' } },
        { status: 403 }
      );
    }
    
    return null; // Continue to handler
  };
}

// Usage in API route
export async function POST(req: NextRequest) {
  const authError = await authorize(['MANAGER'])(req);
  if (authError) return authError;
  
  // Handler logic...
}
```

---

## 7. SMS Integration

### 7.1 Twilio Configuration

```typescript
// lib/twilio.ts
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER;

export async function sendSms(
  to: string,
  body: string,
  accountId: string,
  messageType: string
): Promise<SmsLog> {
  // Create log entry first
  const log = await prisma.smsLog.create({
    data: {
      accountId,
      messageType,
      recipientPhone: to,
      messageBody: body,
      status: 'QUEUED',
    },
  });

  try {
    const message = await client.messages.create({
      to: formatPhoneNumber(to),
      from: FROM_NUMBER,
      body,
      statusCallback: `${process.env.APP_URL}/api/webhooks/twilio`,
    });

    // Update with Twilio SID
    return prisma.smsLog.update({
      where: { id: log.id },
      data: {
        twilioSid: message.sid,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  } catch (error) {
    // Log failure
    return prisma.smsLog.update({
      where: { id: log.id },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
      },
    });
  }
}
```

### 7.2 Message Templates

```typescript
// lib/sms-templates.ts
export const SMS_TEMPLATES = {
  RENEWAL_REMINDER: (boxNumber: string, dueDate: string, phone: string) =>
    `Your PostNet mailbox #${boxNumber} renewal is due on ${dueDate}. ` +
    `Please visit us to renew. Questions? Call ${phone}.`,

  PAYMENT_OVERDUE: (boxNumber: string, dueDate: string) =>
    `Your PostNet mailbox #${boxNumber} payment was due ${dueDate}. ` +
    `Please pay promptly to avoid service interruption.`,

  HOLD_WARNING: (boxNumber: string, phone: string) =>
    `NOTICE: Your PostNet mailbox #${boxNumber} is now on hold due to non-payment. ` +
    `Mail is being held. Please contact us at ${phone}.`,

  ID_EXPIRING: (boxNumber: string, expDate: string) =>
    `The ID on file for your PostNet mailbox #${boxNumber} expires on ${expDate}. ` +
    `Please bring a current ID on your next visit.`,

  AGE_18_NOTICE: (boxNumber: string) =>
    `A recipient on your PostNet mailbox #${boxNumber} is turning 18 soon. ` +
    `New documentation (ID, proof of residence, Form 1583) is required to continue their mail service.`,
};
```

### 7.3 Webhook Handler

```typescript
// app/api/webhooks/twilio/route.ts
export async function POST(req: NextRequest) {
  const body = await req.formData();
  const sid = body.get('MessageSid') as string;
  const status = body.get('MessageStatus') as string;

  // Map Twilio status to our status
  const statusMap: Record<string, SmsStatus> = {
    queued: 'QUEUED',
    sent: 'SENT',
    delivered: 'DELIVERED',
    failed: 'FAILED',
    undelivered: 'FAILED',
  };

  await prisma.smsLog.updateMany({
    where: { twilioSid: sid },
    data: {
      status: statusMap[status] || 'SENT',
      statusUpdated: new Date(),
    },
  });

  return new Response('OK', { status: 200 });
}
```

### 7.4 SMS Scheduler

```typescript
// jobs/sms-scheduler.ts
import cron from 'node-cron';

// Run daily at 9:00 AM
cron.schedule('0 9 * * *', async () => {
  await sendRenewalReminders();
  await sendIdExpiryReminders();
  await sendAge18Reminders();
});

async function sendRenewalReminders() {
  const thirtyDaysFromNow = addDays(new Date(), 30);
  
  const accounts = await prisma.account.findMany({
    where: {
      status: 'ACTIVE',
      smsEnabled: true,
      nextRenewalDate: {
        gte: startOfDay(new Date()),
        lte: endOfDay(thirtyDaysFromNow),
      },
    },
    include: {
      mailbox: true,
    },
  });

  for (const account of accounts) {
    // Check if we already sent a reminder for this renewal
    const existingReminder = await prisma.smsLog.findFirst({
      where: {
        accountId: account.id,
        messageType: 'RENEWAL_REMINDER',
        createdAt: {
          gte: subDays(new Date(), 25), // Don't send more than once per 25 days
        },
      },
    });

    if (!existingReminder && account.smsPhone) {
      await sendSms(
        account.smsPhone,
        SMS_TEMPLATES.RENEWAL_REMINDER(
          account.mailbox.number,
          format(account.nextRenewalDate, 'MMM d, yyyy'),
          BRANCH_PHONE
        ),
        account.id,
        'RENEWAL_REMINDER'
      );
    }
  }
}
```

---

## 8. Backup & Recovery

### 8.1 Backup Strategy

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| Full backup | Weekly (Sunday 2 AM) | 4 weeks | S3/B2 |
| Incremental (WAL) | Continuous | 30 days | S3/B2 |
| Transaction log | Continuous | 7 days | Local + S3 |

### 8.2 PostgreSQL WAL Archiving

```bash
# postgresql.conf
archive_mode = on
archive_command = 'aws s3 cp %p s3://pcms-backups/wal/%f'
archive_timeout = 300  # Archive every 5 minutes minimum
```

### 8.3 Backup Scripts

```bash
#!/bin/bash
# scripts/backup-full.sh

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="pcms_full_${TIMESTAMP}.sql.gz"
S3_BUCKET="s3://pcms-backups/full"

# Create compressed backup
pg_dump $DATABASE_URL | gzip > /tmp/$BACKUP_FILE

# Upload to S3
aws s3 cp /tmp/$BACKUP_FILE $S3_BUCKET/$BACKUP_FILE

# Clean up local file
rm /tmp/$BACKUP_FILE

# Remove backups older than 4 weeks
aws s3 ls $S3_BUCKET/ | while read -r line; do
  FILE_DATE=$(echo $line | awk '{print $1}')
  FILE_NAME=$(echo $line | awk '{print $4}')
  if [[ $(date -d "$FILE_DATE" +%s) -lt $(date -d "4 weeks ago" +%s) ]]; then
    aws s3 rm $S3_BUCKET/$FILE_NAME
  fi
done

echo "Backup completed: $BACKUP_FILE"
```

### 8.4 Recovery Procedures

#### Full Recovery

```bash
#!/bin/bash
# scripts/restore-full.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore-full.sh <backup_file>"
  exit 1
fi

# Download from S3
aws s3 cp s3://pcms-backups/full/$BACKUP_FILE /tmp/$BACKUP_FILE

# Stop application
docker stop pcms-app

# Restore database
gunzip -c /tmp/$BACKUP_FILE | psql $DATABASE_URL

# Restart application
docker start pcms-app

echo "Restore completed from: $BACKUP_FILE"
```

#### Point-in-Time Recovery

```bash
# Restore to specific timestamp using WAL
pg_restore --target-time="2025-12-12 14:30:00" \
  --recovery-target-action=promote \
  $DATABASE_URL
```

### 8.5 Backup Monitoring

```typescript
// jobs/backup-monitor.ts
cron.schedule('0 4 * * *', async () => {
  // Check that today's backup exists
  const today = format(new Date(), 'yyyyMMdd');
  
  const backupExists = await checkS3Object(
    'pcms-backups',
    `wal/${today}`
  );

  if (!backupExists) {
    await sendAlertEmail(
      'Backup Alert',
      `No WAL backup found for ${today}`
    );
  }
});
```

---

## 9. Audit Logging

### 9.1 Audit Log Structure

```typescript
interface AuditLogEntry {
  id: string;
  userId: string | null;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  changes: {
    [field: string]: {
      old: unknown;
      new: unknown;
    };
  } | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
```

### 9.2 Audit Middleware

```typescript
// lib/audit.ts
export async function createAuditLog(
  req: NextRequest,
  userId: string,
  userName: string,
  action: AuditAction,
  entityType: string,
  entityId: string,
  changes?: Record<string, { old: unknown; new: unknown }>
) {
  return prisma.auditLog.create({
    data: {
      userId,
      userName,
      action,
      entityType,
      entityId,
      changes: changes ?? Prisma.JsonNull,
      ipAddress: req.headers.get('x-forwarded-for') || req.ip,
      userAgent: req.headers.get('user-agent'),
    },
  });
}

// Helper to calculate changes
export function calculateChanges<T extends Record<string, unknown>>(
  oldData: T,
  newData: Partial<T>,
  trackedFields: (keyof T)[]
): Record<string, { old: unknown; new: unknown }> | null {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const field of trackedFields) {
    if (field in newData && oldData[field] !== newData[field]) {
      changes[field as string] = {
        old: oldData[field],
        new: newData[field],
      };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}
```

### 9.3 Usage Example

```typescript
// Updating an account
export async function updateAccount(
  req: NextRequest,
  accountId: string,
  updates: UpdateAccountInput,
  session: Session
) {
  const oldAccount = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
  });

  const changes = calculateChanges(
    oldAccount,
    updates,
    ['renewalPeriod', 'currentRate', 'smsEnabled', 'smsPhone', 'memo']
  );

  const updatedAccount = await prisma.account.update({
    where: { id: accountId },
    data: updates,
  });

  if (changes) {
    await createAuditLog(
      req,
      session.user.id,
      session.user.name,
      'UPDATE',
      'Account',
      accountId,
      changes
    );
  }

  return updatedAccount;
}
```

### 9.4 Audit Log Queries

```typescript
// Query audit logs with filters
export async function queryAuditLogs(filters: {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}) {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = filters.action;
  if (filters.startDate || filters.endDate) {
    where.createdAt = {
      ...(filters.startDate && { gte: filters.startDate }),
      ...(filters.endDate && { lte: filters.endDate }),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: ((filters.page || 1) - 1) * (filters.pageSize || 50),
      take: filters.pageSize || 50,
      include: { user: { select: { username: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}
```

---

## 10. Deployment

### 10.1 Container Configuration

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### 10.2 Docker Compose (Production VPS)

The application is deployed on a VPS using Docker Compose with the following services:

```yaml
# docker-compose.yml
version: '3.8'

services:
  # ===========================================
  # Nginx Reverse Proxy with SSL
  # ===========================================
  nginx:
    image: nginx:alpine
    container_name: pcms-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - pcms-network

  # ===========================================
  # SSL Certificate Management
  # ===========================================
  certbot:
    image: certbot/certbot
    container_name: pcms-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    restart: unless-stopped

  # ===========================================
  # Next.js Application
  # ===========================================
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: pcms-app
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
      - TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
      - TWILIO_PHONE_NUMBER=${TWILIO_PHONE_NUMBER}
      - APP_URL=${APP_URL}
      - BRANCH_PHONE=${BRANCH_PHONE}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - pcms-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # ===========================================
  # PostgreSQL Database
  # ===========================================
  db:
    image: postgres:16-alpine
    container_name: pcms-db
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    restart: unless-stopped
    networks:
      - pcms-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ===========================================
  # Automated Backup Service
  # ===========================================
  backup:
    image: postgres:16-alpine
    container_name: pcms-backup
    volumes:
      - ./scripts:/scripts:ro
      - backup_data:/backups
    environment:
      - POSTGRES_HOST=db
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
      - B2_APPLICATION_KEY_ID=${B2_APPLICATION_KEY_ID}
      - B2_APPLICATION_KEY=${B2_APPLICATION_KEY}
      - B2_BUCKET=${B2_BUCKET}
    entrypoint: ["/bin/sh", "/scripts/backup-cron.sh"]
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - pcms-network

# ===========================================
# Networks
# ===========================================
networks:
  pcms-network:
    driver: bridge

# ===========================================
# Volumes
# ===========================================
volumes:
  postgres_data:
    driver: local
  backup_data:
    driver: local
```

### 10.3 Nginx Configuration

```nginx
# nginx/conf.d/default.conf

upstream app {
    server app:3000;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name pcms.example.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name pcms.example.com;
    
    # SSL Certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/pcms.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pcms.example.com/privkey.pem;
    
    # SSL Configuration
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    # Modern TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    # Proxy to Next.js app
    location / {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Static files caching
    location /_next/static {
        proxy_pass http://app;
        proxy_cache_valid 200 60d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 10.4 Backup Script

```bash
#!/bin/bash
# scripts/backup-cron.sh

# Install b2 CLI
apk add --no-cache python3 py3-pip
pip3 install b2

# Backup function
backup() {
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="/backups/pcms_${TIMESTAMP}.sql.gz"
    
    echo "[$(date)] Starting backup..."
    
    # Create compressed backup
    PGPASSWORD=$POSTGRES_PASSWORD pg_dump \
        -h $POSTGRES_HOST \
        -U $POSTGRES_USER \
        -d $POSTGRES_DB \
        --no-owner \
        --no-privileges \
        | gzip > $BACKUP_FILE
    
    # Upload to Backblaze B2
    b2 authorize-account $B2_APPLICATION_KEY_ID $B2_APPLICATION_KEY
    b2 upload-file $B2_BUCKET $BACKUP_FILE "backups/$(basename $BACKUP_FILE)"
    
    echo "[$(date)] Backup completed: $BACKUP_FILE"
    
    # Clean up local backups older than 7 days
    find /backups -name "*.sql.gz" -mtime +7 -delete
    
    # Clean up remote backups older than 30 days (optional)
    # b2 delete-file-version ...
}

# Run backup immediately on start
backup

# Then run every 6 hours
while true; do
    sleep 21600  # 6 hours
    backup
done
```

### 10.5 Environment Variables

```bash
# .env.example

# ===========================================
# Database (PostgreSQL in Docker)
# ===========================================
POSTGRES_USER="pcms"
POSTGRES_PASSWORD="generate-strong-password-here"
POSTGRES_DB="pcms"

# ===========================================
# NextAuth.js
# ===========================================
NEXTAUTH_URL="https://pcms.postnetguam.com"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# ===========================================
# Twilio SMS
# ===========================================
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+16715551234"

# ===========================================
# Backblaze B2 (Backups)
# ===========================================
B2_APPLICATION_KEY_ID="..."
B2_APPLICATION_KEY="..."
B2_BUCKET="pcms-backups"

# ===========================================
# Application
# ===========================================
APP_URL="https://pcms.postnetguam.com"
BRANCH_PHONE="(671) 555-1234"
BRANCH_NAME="PostNet Guam"
```

### 10.6 VPS Initial Setup Guide

```bash
#!/bin/bash
# vps-setup.sh - Initial VPS configuration (run as root)

# ===========================================
# 1. Update system
# ===========================================
apt update && apt upgrade -y

# ===========================================
# 2. Install Docker
# ===========================================
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Install Docker Compose plugin
apt install docker-compose-plugin -y

# ===========================================
# 3. Create deploy user
# ===========================================
useradd -m -s /bin/bash deploy
usermod -aG docker deploy

# ===========================================
# 4. Configure firewall
# ===========================================
apt install ufw -y
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# ===========================================
# 5. Install fail2ban
# ===========================================
apt install fail2ban -y
systemctl enable fail2ban
systemctl start fail2ban

# ===========================================
# 6. Create application directory
# ===========================================
mkdir -p /opt/pcms
chown deploy:deploy /opt/pcms

# ===========================================
# 7. Set up automatic security updates
# ===========================================
apt install unattended-upgrades -y
dpkg-reconfigure -plow unattended-upgrades

echo "VPS setup complete! Next steps:"
echo "1. Copy SSH key for deploy user"
echo "2. Clone repository to /opt/pcms"
echo "3. Copy .env file with production values"
echo "4. Run: docker compose up -d"
echo "5. Set up SSL with: ./scripts/init-ssl.sh"
```

### 10.7 SSL Certificate Setup

```bash
#!/bin/bash
# scripts/init-ssl.sh - Initial SSL certificate setup

DOMAIN="pcms.postnetguam.com"
EMAIL="admin@postnetguam.com"

# Create required directories
mkdir -p ./certbot/conf
mkdir -p ./certbot/www

# Start nginx with temporary self-signed cert for initial setup
docker compose up -d nginx

# Get Let's Encrypt certificate
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# Restart nginx with real certificate
docker compose restart nginx

echo "SSL certificate installed for $DOMAIN"
echo "Certificate will auto-renew via certbot container"
```

### 10.8 Deployment Commands

```bash
# Common Docker Compose commands for VPS management

# Start all services
docker compose up -d

# View logs
docker compose logs -f
docker compose logs -f app      # Just the app
docker compose logs -f db       # Just the database

# Restart services
docker compose restart
docker compose restart app      # Just the app

# Stop all services
docker compose down

# Update application (after git pull)
docker compose build app
docker compose up -d app

# Database migrations
docker compose exec app npx prisma migrate deploy

# Access database shell
docker compose exec db psql -U pcms -d pcms

# Manual backup
docker compose exec backup /scripts/backup.sh

# View resource usage
docker stats

# Clean up old images
docker image prune -f
```

### 10.9 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build and push Docker image
        run: |
          docker build -t pcms:${{ github.sha }} .
          docker tag pcms:${{ github.sha }} registry.example.com/pcms:latest
          docker push registry.example.com/pcms:latest
      
      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/pcms
            docker compose pull
            docker compose up -d
            docker image prune -f

  migrate:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## 11. Security

### 11.1 Security Checklist

| Category | Measure | Status |
|----------|---------|--------|
| **Transport** | HTTPS only (TLS 1.3) | Required |
| **Authentication** | Session-based with secure cookies | Required |
| **Authorization** | Role-based access control | Required |
| **Input Validation** | Zod schema validation | Required |
| **SQL Injection** | Prisma ORM (parameterized queries) | Required |
| **XSS** | React auto-escaping, CSP headers | Required |
| **CSRF** | SameSite cookies, CSRF tokens | Required |
| **Rate Limiting** | API rate limiting | Required |
| **Secrets** | Environment variables, no hardcoding | Required |
| **Dependencies** | Regular security updates | Required |

### 11.2 Security Headers

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin',
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
  },
];
```

### 11.3 Rate Limiting

```typescript
// middleware/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
});

export async function rateLimitMiddleware(req: NextRequest) {
  const ip = req.ip ?? '127.0.0.1';
  const { success, remaining } = await ratelimit.limit(ip);

  if (!success) {
    return Response.json(
      { success: false, error: { code: 'RATE_LIMITED' } },
      { status: 429, headers: { 'X-RateLimit-Remaining': remaining.toString() } }
    );
  }

  return null;
}
```

### 11.4 Input Validation

```typescript
// lib/validations/account.ts
import { z } from 'zod';

export const createAccountSchema = z.object({
  mailboxId: z.string().uuid(),
  renewalPeriod: z.enum(['THREE_MONTH', 'SIX_MONTH', 'TWELVE_MONTH']),
  primaryRenter: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    phone: z.string().regex(/^\d{10,15}$/),
    email: z.string().email(),
    idType: z.string().min(1),
    idStateCountry: z.string().min(1),
    idExpirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    porType: z.string().min(1),
    porDateProvided: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    form1583SignedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  initialPayment: z.object({
    amount: z.number().positive(),
    paymentMethod: z.enum(['CASH', 'CARD', 'CHECK']),
  }),
});

// Usage in API route
const parsed = createAccountSchema.safeParse(await req.json());
if (!parsed.success) {
  return Response.json(
    { success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.errors } },
    { status: 400 }
  );
}
```

---

## 12. Performance

### 12.1 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to First Byte (TTFB) | < 200ms | Server response time |
| First Contentful Paint (FCP) | < 1.5s | Page load |
| API Response (read) | < 500ms | 95th percentile |
| API Response (write) | < 1s | 95th percentile |
| Database Query | < 100ms | 95th percentile |

### 12.2 Caching Strategy

```typescript
// API response caching for read-heavy endpoints
export async function GET(req: NextRequest) {
  const cacheKey = `accounts:${req.nextUrl.searchParams.toString()}`;
  
  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return Response.json(JSON.parse(cached), {
      headers: { 'X-Cache': 'HIT' },
    });
  }

  // Fetch from database
  const data = await fetchAccounts(/* params */);

  // Cache for 60 seconds
  await redis.setex(cacheKey, 60, JSON.stringify(data));

  return Response.json(data, {
    headers: { 'X-Cache': 'MISS' },
  });
}
```

### 12.3 Database Optimization

```typescript
// Efficient queries with proper includes
const account = await prisma.account.findUnique({
  where: { id: accountId },
  include: {
    mailbox: true,
    recipients: {
      where: { removedDate: null }, // Only active recipients
      orderBy: [
        { isPrimary: 'desc' },
        { lastName: 'asc' },
      ],
    },
    payments: {
      take: 5,
      orderBy: { paymentDate: 'desc' },
    },
  },
});

// Pagination for large lists
const accounts = await prisma.account.findMany({
  take: pageSize,
  skip: (page - 1) * pageSize,
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    status: true,
    nextRenewalDate: true,
    currentRate: true,
    mailbox: {
      select: { number: true },
    },
    recipients: {
      where: { isPrimary: true, removedDate: null },
      select: { firstName: true, lastName: true },
    },
  },
});
```

---

## 13. Monitoring & Observability

### 13.1 Logging

```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty' } 
    : undefined,
});

// Usage
logger.info({ accountId, action: 'payment_recorded' }, 'Payment recorded');
logger.error({ error, accountId }, 'Failed to record payment');
```

### 13.2 Error Tracking (Sentry)

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
});

// Error boundary
export function captureException(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context });
}
```

### 13.3 Health Check Endpoint

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    twilio: await checkTwilio(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  const healthy = checks.database && checks.twilio;

  return Response.json(
    { status: healthy ? 'healthy' : 'unhealthy', checks },
    { status: healthy ? 200 : 503 }
  );
}

async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkTwilio(): Promise<boolean> {
  try {
    await twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    return true;
  } catch {
    return false;
  }
}
```

### 13.4 Metrics Dashboard

Key metrics to monitor:

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Request rate | Requests per minute | > 1000/min |
| Error rate | 5xx responses | > 1% |
| Response time | P95 latency | > 2s |
| Database connections | Active connections | > 80% pool |
| SMS delivery rate | Delivered vs. sent | < 95% |
| Backup success | Daily backup status | Any failure |

---

## 14. Development Guidelines

### 14.1 Project Structure

```
pcms/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── accounts/
│   │   │   ├── [id]/
│   │   │   └── page.tsx
│   │   ├── mailboxes/
│   │   ├── reports/
│   │   ├── settings/
│   │   └── layout.tsx
│   ├── api/
│   │   ├── v1/
│   │   │   ├── accounts/
│   │   │   ├── auth/
│   │   │   ├── payments/
│   │   │   └── ...
│   │   └── webhooks/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/
│   ├── forms/
│   ├── tables/
│   └── ...
├── lib/
│   ├── api/
│   ├── auth/
│   ├── db/
│   ├── sms/
│   ├── validations/
│   └── utils/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── jobs/
│   └── ...
├── scripts/
│   └── ...
├── tests/
│   ├── unit/
│   └── e2e/
└── types/
    └── ...
```

### 14.2 Code Style

- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- Conventional commits for version control
- Pull request reviews required

### 14.3 Testing Strategy

| Type | Tool | Coverage Target |
|------|------|-----------------|
| Unit tests | Vitest | > 80% |
| Integration tests | Vitest + MSW | Critical paths |
| E2E tests | Playwright | Happy paths |

```typescript
// Example unit test
import { describe, it, expect } from 'vitest';
import { calculateRenewalDate } from '@/lib/utils';

describe('calculateRenewalDate', () => {
  it('adds 3 months for THREE_MONTH period', () => {
    const startDate = new Date('2025-01-15');
    const result = calculateRenewalDate(startDate, 'THREE_MONTH');
    expect(result).toEqual(new Date('2025-04-15'));
  });

  it('adds 13 months for TWELVE_MONTH period (bonus month)', () => {
    const startDate = new Date('2025-01-15');
    const result = calculateRenewalDate(startDate, 'TWELVE_MONTH');
    expect(result).toEqual(new Date('2026-02-15'));
  });
});
```

---

## 15. Migration Plan

### 15.1 Data Migration Steps

1. **Export existing data** from current system (CSV/Excel)
2. **Map fields** to new schema
3. **Create migration script** to transform and import data
4. **Validate imported data** against source
5. **Run parallel systems** for 1-2 weeks
6. **Cutover** to new system

### 15.2 Migration Script Structure

```typescript
// scripts/migrate-data.ts
import { parse } from 'csv-parse/sync';
import { prisma } from '@/lib/db';

async function migrateAccounts(csvPath: string) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, { columns: true });

  for (const record of records) {
    await prisma.$transaction(async (tx) => {
      // Create or find mailbox
      const mailbox = await tx.mailbox.upsert({
        where: { number: record.box_number },
        create: { number: record.box_number, status: 'ACTIVE' },
        update: {},
      });

      // Create account
      const account = await tx.account.create({
        data: {
          mailboxId: mailbox.id,
          status: mapStatus(record.status),
          renewalPeriod: mapPeriod(record.period),
          startDate: parseDate(record.start_date),
          nextRenewalDate: parseDate(record.next_renewal),
          currentRate: parseFloat(record.rate),
          depositPaid: parseFloat(record.deposit),
          memo: record.notes,
        },
      });

      // Create primary recipient
      await tx.recipient.create({
        data: {
          accountId: account.id,
          isPrimary: true,
          firstName: record.first_name,
          lastName: record.last_name,
          // ... other fields
        },
      });
    });
  }
}
```

### 15.3 Rollback Plan

- Maintain read-only access to old system for 30 days
- Daily backups of new system from day one
- Documented rollback procedure for each component

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 12, 2025 | — | Initial specification |
| 1.1 | Dec 12, 2025 | — | Added RecipientType enum (PERSON, COMPANY), company-specific fields, updated indexes |
| 1.2 | Dec 13, 2025 | — | Refined Recipient model (Person: firstName, middleName, lastName, alias, birthdate; Business: businessName, businessAlias, businessRegNumber, validUntilDate), added ContactCard model with phone formatting, added TypeScript domain models with getDisplayName() and requiresVerification() methods |
| 1.3 | Dec 13, 2025 | — | Restructured ContactCard (1:1 with Recipient) containing multiple PhoneNumbers; added PhoneNumber model with labels, SMS selection logic; added phone_numbers table |
| 1.4 | Dec 13, 2025 | — | Added EmailAddress model with labels; added email_addresses table; updated ContactCard to contain both PhoneNumbers and EmailAddresses |
| 1.5 | Dec 13, 2025 | — | Updated deployment strategy to VPS + Docker Compose; added Nginx, Certbot, backup containers; added VPS setup guide, SSL setup, deployment commands |
| 1.6 | Dec 13, 2025 | — | Updated Person.getDisplayName() to include alias within full name format: "First Middle "Alias" Last" |
| 1.7 | Dec 13, 2025 | — | Added Memo model (multiple memos per account); manager-only edit/delete; added memos API endpoints; updated User model with memo relations |
| 1.8 | Dec 13, 2025 | — | Simplified PhoneNumber to store e164Format only (removed displayFormat, rawInput); added phone-format utility functions; smsEnabled defaults to false (opt-in) |

---

*End of Technical Specification*
