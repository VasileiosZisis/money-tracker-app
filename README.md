# Money Tracker

A manual-first personal money tracking web app for monthly cashflow planning.

The app started as an Excel replacement for income and expense tracking, then
grew into a lightweight monthly planner with CSV import, planned bills,
forecasting, and a safe-to-spend estimate.

## Status

Implemented through the current next-phase polish work:

- Free MVP baseline:
  - Google sign-in with NextAuth
  - mandatory setup flow
  - categories CRUD with archiving
  - transactions CRUD with month/type/category filters
  - monthly dashboard totals
  - CSV export
- Next phase:
  - CSV import with preview, row validation, category mapping, and confirm flow
  - planned bills CRUD
  - current-month forecast helpers and dashboard metrics
  - safe-to-spend indicator
  - empty/error/limited-history polish for import, planned bills, and dashboard

## Current behavior

- Unauthenticated access to `/setup`, `/dashboard`, `/transactions`, `/categories`, `/planned`, `/import`, and `/export` redirects to `/login`.
- Visiting `/login` while authenticated redirects:
  - to `/setup` if `hasCompletedSetup` is `false`
  - to `/dashboard` if `hasCompletedSetup` is `true`
- App routes under the authenticated shell require completed setup.
- `/transactions` supports month/type/category filters plus create, edit, and delete.
- `/dashboard` supports month selection (`?month=YYYY-MM`) and shows:
  - income total
  - expense total
  - net left now
  - forecast remaining spend
  - projected end-of-month net
  - safe to spend
  - planned bills for the selected month
  - recent monthly transactions
- `/planned` supports create, edit, activate/deactivate, and delete for monthly planned bills.
- `/import` supports CSV upload, preview, validation, category resolution, and explicit confirm.
- `/export` downloads a CSV for the selected month via `/export/download`.

## Product scope

### In scope today

- Single-user web app
- Google OAuth only
- Per-user base currency
- Manual transaction entry
- Month-based tracking using `localDate = "YYYY-MM-DD"`
- Planned monthly expense templates
- Simple explainable forecasting
- Safe-to-spend planning indicator
- CSV import and CSV export

### Explicitly out of scope

- Bank sync
- multi-currency transactions or FX conversion
- recurring income systems
- advanced recurring rules
- budgets / envelopes / rollover systems
- paid subscriptions or billing
- shared household accounts
- native mobile apps
- AI categorization or AI forecasting

## Route groups

- `app/(auth)` for public auth pages (`/login`)
- `app/(onboarding)` for setup onboarding (`/setup`)
- `app/(app)` for authenticated app pages:
  - `/dashboard`
  - `/transactions`
  - `/categories`
  - `/planned`
  - `/import`
  - `/export`

## Tech stack

- Next.js App Router + React + TypeScript
- Tailwind CSS with token-based theming and dark mode
- PostgreSQL + Prisma
- NextAuth (Google OAuth) + Prisma adapter

## Design system

UI follows `docs/DESIGN_SYSTEM.md`:

- token-based colors in components
- light/dark mode via `dark` class
- Inter for UI text
- JetBrains Mono for numeric values

## Project docs

Read these in order for product and implementation rules:

1. `AGENTS.md`
2. `docs/DESIGN_SYSTEM.md`
3. `docs/TECH_DECISIONS.md`
4. `docs/MVP_SPEC.md`
5. `docs/TASKS.md`
6. `docs/NEXT_PHASE_SPEC.md`
7. `docs/TASKS_NEXT.md`

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
npx prisma migrate dev
```

### 4. Run the app

```bash
npm run dev
```

## Verification

Typical manual verification commands:

```bash
npm run lint
npx tsc --noEmit
npm run dev
```
