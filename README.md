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
- Confirm one account time zone for transaction defaults and planning calculations.
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

### Analyze completed history

The Insights workspace explains historical income, spending, and monthly
results using actual transactions. It includes:

- monthly result and break-even analysis
- spending composition by category
- income and spending consistency
- unusual-month investigation with links to filtered transactions
- category-specific spending trends and monthly history
- configurable change drivers and trailing year-over-year patterns

The shared history period covers 3, 6, or 12 completed months. Category
selection affects only the category-specific analysis, while Drivers of change
and Year-over-year patterns use their own comparison periods. Insights remains
descriptive and does not create budgets or replace safe-to-spend.

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
| `/setup` | Required currency, account time zone, and optional default-category setup |
| `/dashboard` | Monthly snapshot, planning metrics, Total Balance, and monthly planned-item actions |
| `/transactions` | Transaction entry, filtering, editing, and deletion |
| `/insights` | Historical cashflow, spending patterns, and category analysis |
| `/categories` | Category and subcategory management |
| `/planned` | Planned bill and planned income template management |
| `/import` | CSV import preview and confirmation |
| `/export` | Selected-month CSV export |
| `/settings` | Account time-zone settings |

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
month-boundary errors. A confirmed IANA account time zone defines today and the
current month for every server calculation, independent of the deployment
server's clock. Every database operation is scoped to the authenticated user.

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
DATABASE_URL_UNPOOLED=postgresql://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### 3. Apply the database migrations

```bash
npm run prisma:generate
npx prisma migrate deploy
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

Vercel deploys automatically on Git pushes. `main` is the Production branch;
all other branches use Preview. Local commits do not deploy, and commit messages
do not require a deployment marker. Keep the Ignored Build Step set to Automatic.

### Environment separation

| Setting | Production | Preview / Development |
| --- | --- | --- |
| Neon branch and database | `production` / `neondb` | `preview` / `previewdb` |
| `DATABASE_URL` | Production pooled URL, Production only | Preview pooled URL, all preview branches and Development |
| `NEXTAUTH_SECRET` | Existing production secret | Separate non-production secret |
| Google OAuth credentials | Existing Google client | Same client with preview callback registered |

All preview deployments and local development share the persistent preview
database. It starts without production records and uses the preview-only
`preview_owner` role. Never put production database credentials in Preview,
Development, or local `.env.local`. Keep `.env.test.local` separate.

Create Neon's `preview` branch using Schema only, with auto-deletion disabled.
Create the `preview_owner` role and a fresh `previewdb` database on that branch.
Leave the copied `neondb` unused: its tables exist but its migration-history rows
were not copied, so it cannot be initialized by replaying migrations normally.
Do not install automatic per-deployment Neon branching for this shared setup.

### Manual migrations

`DATABASE_URL` is the pooled application connection. Prisma CLI prefers the
optional direct `DATABASE_URL_UNPOOLED`, falling back to `DATABASE_URL`.
Exported variables take precedence over dotenv files; `.env.local` takes
precedence over `.env`. In `APP_ENV=test`, Prisma uses `.env.test.local`'s
`DATABASE_URL` or an explicitly exported test `DATABASE_URL`, never a non-test
direct URL or an implicit local/default database.

Before each migration, verify the endpoint, database, and role. Use the direct
preview connection to initialize `previewdb` and test committed migrations:

```powershell
$env:DATABASE_URL_UNPOOLED = '<direct preview/previewdb connection string>'
npx prisma migrate deploy
Remove-Item Env:\DATABASE_URL_UNPOOLED
```

When changing migration targets, explicitly set `DATABASE_URL_UNPOOLED`; setting
only `DATABASE_URL` does not override a configured direct URL. Apply tested,
backward-compatible migrations to production before merging dependent code.
The build command does not apply migrations. Do not use `migrate dev`, `db push`,
or reset commands against production or the shared preview database; author new
migrations against a disposable development database instead. Never copy preview
records into production. Vercel rollbacks do not roll back database migrations.

### Preview authentication and release

Keep `NEXTAUTH_URL` unset on Vercel with system environment variables enabled.
Locally, keep `NEXTAUTH_URL=http://localhost:3000`. Use the stable branch domain
shown in the deployment's Domains, not a commit-specific domain. Register its
exact `https://<branch-host>/api/auth/callback/google` URL in the existing Google
OAuth client without removing production or localhost callbacks. Other branches
need their own callback registration to test Google login. Keep Vercel's preview
login protection enabled.

Use the long-lived `codex/preview` branch for a reusable authenticated preview.
Verify login, setup, and fictional transactions there, then merge to `main` for
a new Production build with Production variables. Do not promote an existing
preview artifact as the release path. Environment changes affect new deployments
only. Coordinate schema changes because all preview branches share one database.

## Project documentation

Use these sources in order for current product and implementation decisions:

1. `AGENTS.md`
2. `docs/DESIGN_SYSTEM.md`
3. `docs/TECH_DECISIONS.md`
4. `docs/PRODUCT_SPEC.md`
5. `docs/ROADMAP.md` for candidate future work

Historical specifications and completed implementation plans are retained under
`docs/archive/` for reference only.
