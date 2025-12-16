# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: PostNet Guam Customer Management System (PCMS)

A cloud-hosted web application for managing mailbox rentals (~2,000 mailboxes), customer accounts, payments, recipients, and compliance documentation for a PostNet branch.

## Build & Test Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Run all tests
npm test

# Run single test file
npm test -- path/to/test.ts

# Run tests in watch mode
npm test -- --watch

# E2E tests
npm run test:e2e

# Linting and formatting
npm run lint
npm run format

# Database commands
npx prisma generate    # Generate Prisma client
npx prisma migrate dev # Run migrations in development
npx prisma studio      # Open Prisma database GUI
```

## Architecture Overview

- **Framework**: Next.js 14 with TypeScript (SSR + API routes)
- **UI**: React 18 with Tailwind CSS
- **State**: Zustand (client), React Query (server)
- **ORM**: Prisma 5.x with PostgreSQL 16
- **Auth**: NextAuth.js (session-based, two roles: STAFF, MANAGER)
- **Validation**: Zod schemas
- **SMS**: Twilio (opt-in only)
- **PDF**: @react-pdf/renderer
- **Testing**: Vitest (unit), Playwright (E2E)

## Key Domain Concepts

**Recipient Types** — Two distinct types with different fields:
- `Person`: firstName, middleName, lastName, personAlias, birthdate
- `Business`: businessName, businessAlias, businessRegNumber, validUntilDate

**Contact System** — One ContactCard per recipient containing:
- Multiple PhoneNumbers (E.164 format storage, display formatted at runtime)
- Multiple EmailAddresses (stored lowercase)

**Display Name Logic**:
- Person with alias: `"FirstName MiddleName \"Alias\" LastName"`
- Business: businessAlias if set, otherwise businessName

**Verification Rules** (`requiresVerification()`):
- Person: true if minor AND 18th birthday within 30 days
- Business: true if validUntilDate is set AND within 30 days of expiration

**Account States**: ACTIVE → OVERDUE (1-30 days) → HOLD (31-60 days) → CLOSED (61+ days)

## Core Coding Principles

**IMPORTANT**: Whenever you write code, it MUST follow SOLID design principles. Never write code that violates these principles. If you do, you will be asked to refactor it.

1. **No `any` type** — Use `unknown` with type guards if truly unknown
2. **No magic numbers/strings** — Use named constants
3. **No swallowed errors** — Always handle or rethrow with context
4. **No sensitive data in logs** — Mask emails, never log passwords/tokens
5. **No string concatenation for SQL** — Use Prisma parameterized queries only

## Development Workflow

1. Write comprehensive tests for all new functionality
2. Compile code and run all tests before committing
3. Write detailed commit messages explaining the changes and rationale

## File Organization

```
src/
├── components/[feature]/[ComponentName].tsx
├── pages/[route].tsx
├── pages/api/[resource]/[...].ts
├── lib/
│   ├── models/          # Domain models (PersonRecipient, BusinessRecipient)
│   ├── services/        # Business logic services
│   └── utils/           # Utilities (phone formatting, date helpers)
├── types/[domain].ts
└── prisma/schema.prisma
docs/                    # Specifications
```

## Code Standards

- Use TypeScript for all new code with strict type checking
- Follow the existing component structure in `/src/components`
- API routes follow RESTful conventions in `/src/pages/api`
- Use Prisma schema definitions for all database operations
- CSS classes should use Tailwind utilities; custom CSS only when necessary

## Quality Gates

- All code must compile without warnings
- Test coverage must remain above 80%
- All tests must pass before committing
- ESLint and Prettier must pass without errors

