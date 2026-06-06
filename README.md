# Money Tracker

A manual-first personal money tracking web app for monthly cashflow planning.

The app started as an Excel replacement for income and expense tracking. It now
adds lightweight planning around expected bills, expected income, import/export,
forecasting, and daily safe-spend decisions.

## Status

Implemented through the current planning polish work:

- Free MVP baseline:
  - Google sign-in with NextAuth
  - mandatory setup flow
  - categories and category tags
  - transactions CRUD with month/type/category/tag filters
  - monthly dashboard totals
  - CSV export
- Next phase:
  - CSV import with preview, row validation, category/tag handling, and confirm flow
  - planned bills with optional tags
  - planned-bill monthly paid/skipped state
  - mark planned bill paid, skip, undo, or link an existing expense transaction
  - planned income templates with optional tags
  - planned-income monthly received/skipped state
  - mark planned income received, skip, undo, or link an existing income transaction
  - dashboard forecast, safe-to-spend, daily safe spend, and needs-attention signals

## Current Behavior

- Unauthenticated access to `/setup`, `/dashboard`, `/transactions`, `/categories`, `/planned`, `/planned-income`, `/import`, and `/export` redirects to `/login`.
- Visiting `/login` while authenticated redirects:
  - to `/setup` if `hasCompletedSetup` is `false`
  - to `/dashboard` if `hasCompletedSetup` is `true`
- App routes under the authenticated shell require completed setup.
- `/transactions` supports month/type/category/tag filters plus create, edit, and delete.
- `/categories` manages income and expense categories, category archiving, and category-scoped tags.
- `/dashboard` supports month selection (`?month=YYYY-MM`) and shows:
  - actual income and expense totals
  - net left now
  - safe to spend
  - daily safe spend
  - forecast remaining spend
  - forecast breakdown: reserved planned bills, variable spend estimate, pending planned income, and projected month-end net
  - needs-attention signals
  - planned income for the selected month
  - planned bills for the selected month
  - recent monthly transactions
- `/planned` manages reusable monthly planned-bill templates.
- `/planned-income` manages reusable monthly planned-income templates.
- `/import` supports CSV upload, preview, validation, category/tag resolution, and explicit confirm.
- `/export` downloads a CSV for the selected month via `/export/download`.

## Product Scope

### In scope today

- Single-user web app
- Google OAuth only
- Per-user base currency
- Manual transaction entry
- Month-based tracking using `localDate = "YYYY-MM-DD"`
- Category-scoped tags for transaction classification
- Planned monthly expense templates
- Planned monthly income templates
- Explicit monthly occurrence state for planned bills and planned income
- Manual linking from planned items to existing transactions
- Simple explainable forecasting
- Safe-to-spend and daily-safe-spend planning indicators
- CSV import and CSV export

### Explicitly out of scope

- Bank sync
- multi-currency transactions or FX conversion
- advanced recurring rules beyond monthly templates
- automatic or fuzzy transaction matching
- budgets / envelopes / rollover systems
- paid subscriptions or billing
- shared household accounts
- native mobile apps
- AI categorization or AI forecasting
- background jobs or notification systems

## Route Groups

- `app/(auth)` for public auth pages (`/login`)
- `app/(onboarding)` for setup onboarding (`/setup`)
- `app/(app)` for authenticated app pages:
  - `/dashboard`
  - `/transactions`
  - `/categories`
  - `/planned`
  - `/planned-income`
  - `/import`
  - `/export`

## Tech Stack

- Next.js App Router + React + TypeScript
- Tailwind CSS with token-based theming and dark mode
- PostgreSQL + Prisma
- NextAuth (Google OAuth) + Prisma adapter

## Planning Model

- Actual income and expense totals come only from transactions.
- Planned bills reserve forecasted spend until the selected-month occurrence is paid or skipped.
- Planned income is planning metadata until received, skipped, or linked to a transaction.
- `Safe to spend` stays conservative and excludes pending planned income.
- `Projected month-end net` includes pending planned income:

```text
netLeftNow = incomeSoFar - expenseSoFar
forecastRemainingSpend = unpaidPlannedBills + variableCategoryForecast
safeToSpend = netLeftNow - forecastRemainingSpend
dailySafeSpend = safeToSpend / remainingDaysIncludingToday
projectedEndOfMonthNet = netLeftNow + pendingPlannedIncome - forecastRemainingSpend
```

## Deployment

Vercel Git deployments are opt-in for this repo. The ignored build step in
`vercel.json` skips builds by default.

To deploy a commit, include `[deploy]` in the commit message:

```bash
git commit -m "Update dashboard forecast [deploy]"
```

## Design System

UI follows `docs/DESIGN_SYSTEM.md`:

- token-based colors in components
- light/dark mode via `dark` class
- Inter for UI text
- JetBrains Mono for numeric values

## Project Docs

Read these in order for product and implementation rules:

1. `AGENTS.md`
2. `docs/DESIGN_SYSTEM.md`
3. `docs/TECH_DECISIONS.md`
4. `docs/MVP_SPEC.md`
5. `docs/TASKS.md`
6. `docs/NEXT_PHASE_SPEC.md`
7. `docs/TASKS_NEXT.md`

Additional planning notes:

- `docs/PLANNED_BILL_OCCURRENCES_PLAN.md`
- `docs/DAILY_DECISION_FEATURE_IDEAS.md`

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment (`.env.local`)

```env
DATABASE_URL=postgresql://...
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
