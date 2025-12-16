# PostNet CMS - Quick Start

## Login Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `ChangeMe123!` | Manager |
| `staff` | `StaffPass123!` | Staff |

**Change these passwords immediately in production.**

---

## Development Setup

```bash
# 1. Start database
docker compose up -d

# 2. Push schema & seed data
npm run db:push
npm run db:seed

# 3. (Optional) Import CSV data
npm run db:import

# 4. Start dev server
npm run dev
```

Open http://localhost:3000/login

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Run unit tests |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed users & rate history |
| `npm run db:import` | Import CSV data |
| `npm run db:studio` | Database GUI |

---

## Database Access

```bash
# Direct psql
docker exec -it pcms-db psql -U pcms -d pcms

# Prisma Studio (GUI)
npm run db:studio
```

---

## Create Additional Users

```bash
npm run db:create-admin
```
