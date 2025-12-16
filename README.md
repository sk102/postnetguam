# PostNet Customer Management System (PCMS)

A cloud-hosted web application for managing mailbox rentals, customer accounts, payments, recipients, and compliance documentation for PostNet Guam.

## Features

- **Mailbox Management** - Track 2,000+ mailboxes with availability status
- **Account Lifecycle** - Complete management from opening to closure (ACTIVE → OVERDUE → HOLD → CLOSED)
- **Recipient Tracking** - Manage up to 6 recipients per mailbox (Person or Business types)
- **Notice Generation** - PDF notices with official PostNet branding
- **Payment & Renewal** - Automated tracking with configurable rates
- **Compliance** - ID verification, expiration monitoring
- **SMS Notifications** - Opt-in reminders via Twilio
- **Role-Based Access** - Staff and Manager roles with appropriate permissions

## Tech Stack

- **Framework:** Next.js 14 with TypeScript
- **UI:** React 18 with Tailwind CSS
- **Database:** PostgreSQL 16 with Prisma ORM
- **Authentication:** NextAuth.js (session-based)
- **PDF Generation:** @react-pdf/renderer
- **Testing:** Vitest (unit), Playwright (E2E)

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)

### Setup

```bash
# Install dependencies
npm install

# Start database
docker compose up -d

# Push schema & seed data
npx prisma db push
npx prisma db seed

# Start dev server
npm run dev
```

Open http://localhost:3000/login

### Default Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `ChangeMe123!` | Manager |
| `staff` | `StaffPass123!` | Staff |

**Change these passwords immediately in production.**

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint check |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run E2E tests |
| `npx prisma studio` | Database GUI |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── (auth)/            # Authentication pages
│   ├── accounts/          # Account management
│   ├── mailboxes/         # Mailbox management
│   ├── settings/          # Admin settings
│   └── api/               # API endpoints
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── accounts/         # Account-specific components
│   ├── notices/          # Notice management
│   └── pricing/          # Pricing components
├── lib/
│   ├── services/         # Business logic
│   ├── utils/            # Utility functions
│   └── validations/      # Zod schemas
├── constants/            # Application constants
└── types/                # TypeScript types

prisma/
├── schema.prisma         # Database schema
└── seed.ts              # Database seeding

scripts/
├── reset-data.ts        # Reset and reseed database
├── import-csv.ts        # Import customer data from CSV
└── create-admin.ts      # Create admin user
```

## Documentation

Detailed documentation is available in the [`docs/`](docs/) directory:

| Document | Description |
|----------|-------------|
| [Index](docs/00-index.md) | Document overview and quick reference |
| [Overview](docs/01-overview.md) | Executive summary and goals |
| [User Personas](docs/02-user-personas.md) | Staff and manager roles |
| [Core Concepts](docs/03-core-concepts.md) | Entity definitions and data model |
| [Features](docs/04-features.md) | Feature specifications and workflows |
| [User Interface](docs/05-user-interface.md) | Screen layouts and navigation |
| [Business Rules](docs/06-business-rules.md) | Validation rules and calculations |
| [Notifications](docs/07-notifications.md) | Dashboard alerts and SMS |
| [Reporting](docs/08-reporting.md) | Printable documents and reports |
| [Security](docs/09-security.md) | Access control and audit logging |
| [Metrics & Future](docs/10-metrics-future.md) | Success metrics and roadmap |
| [Quick Start](docs/QUICKSTART.md) | Getting started guide |
| [Coding Standard](docs/CODING_STANDARD.md) | Development guidelines |

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL="postgresql://pcms:pcms@localhost:5432/pcms"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Twilio (optional, for SMS)
TWILIO_ACCOUNT_SID="your-account-sid"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_PHONE_NUMBER="+1234567890"
```

## License

Proprietary - PostNet Guam
