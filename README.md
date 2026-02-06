# Money Tracker (Free MVP)

A web app for manual money tracking (income and expenses) with a monthly view, built to replace a personal Excel workflow.

## Status

- Task 1 complete: Next.js App Router + TypeScript scaffold, Tailwind design tokens, route groups, base layouts.
- Task 2 complete: Prisma + PostgreSQL schema (NextAuth models + MVP domain models).
- Task 3 complete: NextAuth Google OAuth, protected routes with middleware, typed session user id.
- Task 4 complete: mandatory setup flow with onboarding route group, setup actions, validators, and setup enforcement redirects.

## Current behavior

- Unauthenticated access to `/setup`, `/dashboard`, `/transactions`, `/categories`, `/export` redirects to `/login`.
- Visiting `/login` while authenticated redirects:
  - to `/setup` if `hasCompletedSetup` is `false`
  - to `/dashboard` if `hasCompletedSetup` is `true`
- App routes (`/dashboard`, `/transactions`, `/categories`, `/export`) require completed setup.
- Onboarding route (`/setup`) redirects to `/dashboard` when setup is already complete.

## Route groups

- `app/(auth)` for public auth pages (`/login`)
- `app/(onboarding)` for setup onboarding (`/setup`)
- `app/(app)` for main authenticated pages (`/dashboard`, `/transactions`, `/categories`, `/export`)

## MVP scope

- Google sign-in (NextAuth)
- First-login setup flow:
  - choose base currency
  - optionally create default income/expense categories
  - complete setup
- Transaction CRUD (income/expense, amount, local date, category, source, note)
- Monthly dashboard totals (income, expense, net left)
- Transactions filters (month/type/category)
- Category archive/unarchive
- Monthly CSV export

## Tech stack

- Next.js App Router + React + TypeScript
- Tailwind CSS (token-based theme, light/dark mode)
- PostgreSQL + Prisma
- NextAuth (Google OAuth) + Prisma adapter

## Design system

UI follows `docs/DESIGN_SYSTEM.md`:

- token-based colors in components
- light/dark mode via `dark` class
- Inter for UI text, JetBrains Mono for numeric values

## Project docs

- `AGENTS.md`
- `docs/MVP_SPEC.md`
- `docs/TECH_DECISIONS.md`
- `docs/TASKS.md`
- `docs/DESIGN_SYSTEM.md`

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment (`.env.local`)

```env
DATABASE_URL=postgresql://...   # Neon pooled connection string
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### 3. Initialize Prisma

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Run the app

```bash
npm run dev
```
