# Money Tracker

Money Tracker is a manual-first personal finance web app for recording everyday
income and expenses, understanding monthly cashflow, and planning the rest of
the month.

It is designed as a trustworthy replacement for a monthly spreadsheet: actual
totals always come from transactions, while planned bills, planned income, and
forecast estimates remain separate and explainable.

## What the app does

### Track actual money

- Sign in with Google and complete a required first-time setup.
- Choose one base currency for the account.
- Create, edit, and delete income and expense transactions.
- Organize transactions with categories and optional category-scoped
  subcategories.
- Archive and restore categories without breaking historical records.
- Filter transactions by month, type, category, and subcategory.

### Move data in and out

- Import CSV files through an explicit upload, preview, validation, mapping, and
  confirmation flow.
- Map unknown categories or create them during import.
- Export a selected month's transactions as CSV.
- Keep imported transactions subject to the same validation rules as manually
  entered transactions.

Only CSV import is supported currently. The app does not perform fuzzy
historical duplicate detection or overwrite existing transactions.

### Plan recurring monthly items

- Manage monthly planned bill and planned income templates in one `/planned`
  workspace.
- Assign each template a category, optional subcategory, amount, day of month,
  Source, and Note.
- Activate, deactivate, edit, or delete templates.
- For a selected month, mark a bill paid or income received, skip it, undo the
  occurrence, or link an existing transaction.
- Marking an item paid or received creates a normal transaction; linking an
  existing transaction does not create a duplicate.

Monthly occurrence actions are available from the dashboard. The app never
automatically matches a planned item to a transaction.

### Understand the month

The dashboard combines actual activity with conservative planning estimates:

- income, expenses, and net left now
- projected month-end net
- forecast remaining spend and forecast confidence
- safe to spend
- daily and weekly safe spend
- spending pace against up to six usable trailing months
- planned-income realization
- actual spending by category and subcategory
- recent transactions and pending planned items
- a deterministic Needs Attention panel for due, overdue, negative, stale, or
  low-confidence conditions

Forecasts are calculated on demand and are never stored. They are estimates,
not an account balance or a guarantee.

### Review completed history

Total Balance is a completed-month historical ledger built from actual
transactions and optional positive balance adjustments. It supports preset and
custom completed periods and shows starting balance, period change, ending
balance, and monthly history.

Balance adjustments are intended for opening balances or previously untracked
money. They affect Total Balance only; they do not count as transaction income
and do not change monthly totals, planned items, safe-to-spend, or forecasts.

Total Balance is not bank-synced and is not a reconciliation system.

## How planning works

Actual income and expense totals come only from transactions. Active planned
bills reserve future spend until they are paid or skipped. Pending planned
income improves the projected month-end result but is deliberately excluded
from safe-to-spend.

```text
netLeftNow = incomeSoFar - expenseSoFar
forecastRemainingSpend = unpaidPlannedBills + variableCategoryForecast
safeToSpend = netLeftNow - forecastRemainingSpend
dailySafeSpend = safeToSpend / remainingDaysIncludingToday
weeklySafeSpend = dailySafeSpend * min(7, remainingDaysIncludingToday)
projectedEndOfMonthNet = netLeftNow + pendingPlannedIncome - forecastRemainingSpend
```

Variable spending uses recent eligible expense history where available.
Categories covered by active planned bills are excluded from that calculation
to avoid double counting.

## Routes

| Route | Purpose |
| --- | --- |
| `/login` | Google sign-in |
| `/setup` | Required currency and optional default-category setup |
| `/dashboard` | Monthly snapshot, planning metrics, Total Balance, and monthly planned-item actions |
| `/transactions` | Transaction entry, filtering, editing, and deletion |
| `/categories` | Category and subcategory management |
| `/planned` | Planned bill and planned income template management |
| `/import` | CSV import preview and confirmation |
| `/export` | Selected-month CSV export |

`/planned-income` is retained as a protected compatibility redirect to the
income view of `/planned`.

All app routes require authentication. Setup must be completed before the main
app can be used.

## Product boundaries

Money Tracker is a personal, single-currency, web-first tool. It intentionally
does not include:

- bank syncing, multiple accounts, or bank reconciliation
- multi-currency transactions or FX conversion
- budgets, envelopes, rollover budgets, or sinking funds
- recurrence rules beyond monthly planned templates
- fuzzy or automatic transaction matching
- shared household workspaces
- paid plans or subscriptions
- native mobile apps
- AI categorization or AI forecasting
- background jobs, reminders, or notification delivery
- investment or net-worth tracking

Candidate future work lives in `docs/ROADMAP.md` and is not current product
scope until explicitly selected.

## Tech stack

- Next.js 16 App Router, React 19, and TypeScript
- Tailwind CSS 4 and shadcn-based UI components
- PostgreSQL and Prisma 7
- NextAuth with Google OAuth and a Prisma adapter
- Zod validation and server-side database access
- Recharts for dashboard visualizations

Money values are stored as PostgreSQL `numeric(14,2)` / Prisma `Decimal`.
Transaction dates are stored as local `YYYY-MM-DD` strings to avoid timezone
month-boundary errors. Every database operation is scoped to the authenticated
user.

## Local development

### Prerequisites

- Node.js and npm
- PostgreSQL
- Google OAuth credentials

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

Create `.env.local`:

```env
DATABASE_URL=postgresql://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### 3. Apply the database migrations

```bash
npm run prisma:generate
npx prisma migrate dev
```

### 4. Start the app

```bash
npm run dev
```

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Run the lint, typecheck, and production build sequence together with:

```bash
npm run check
```

## Deployment

Vercel Git deployments are opt-in. The ignored-build script skips a deployment
unless the commit message contains `[deploy]`:

```bash
git commit -m "Describe the change [deploy]"
```

## Project documentation

Use these sources in order for current product and implementation decisions:

1. `AGENTS.md`
2. `docs/DESIGN_SYSTEM.md`
3. `docs/TECH_DECISIONS.md`
4. `docs/PRODUCT_SPEC.md`
5. `docs/ROADMAP.md` for candidate future work

Historical specifications and completed implementation plans are retained under
`docs/archive/` for reference only.
