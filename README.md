# CashContour

CashContour is a manual-first personal finance app for recording income and
expenses, understanding cashflow, and planning the rest of the month. Actual
transactions, expected bills and income, and forecast estimates stay separate
so users can understand where each number comes from.

[Live website](https://www.cashcontour.com) ·
[Try the interactive demo](https://www.cashcontour.com/demo) ·
[Architecture decisions](docs/TECH_DECISIONS.md) ·
[AI-assisted development workflow](#ai-assisted-development-workflow)

The project brings together responsive UI, authenticated server workflows,
relational data modeling, financial calculations, regression tests, and
production deployment. I develop it with AI assistance under documented
constraints and independent agent review, while retaining responsibility for
product scope, technical decisions, and accepting changes.

## Explore the app

The public demo needs no sign-in. It includes fictional EUR records covering
24 completed months and a fixed example date. You can:

- create, edit, delete, and filter transactions
- pay or receive planned items, skip them, link existing transactions, and undo handling
- see Dashboard, Total Balance, and Insights recalculate after your changes

Edits stay in the current tab's session. Reset restores the sample; closing the
tab ends its session. Demo validation and financial calculations run on the
server without reading or writing account records. Categories, templates, and
account settings are fixed in the demo; CSV workflows require an account.

<details>
<summary>View a screenshot of the deployed public demo</summary>

![CashContour public demo Dashboard showing fictional EUR balances, monthly cashflow, spending estimates, and attention signals](docs/assets/demo-dashboard.jpg)

Captured from the public deployment with fictional sample data. The deployed
interface may differ from changes in the current checkout.

</details>

## Implemented features

| Area | What users can do |
| --- | --- |
| Authentication and setup | Sign in with Google, choose one base currency, and confirm an IANA account time zone before using the app. Each personal account has isolated records. |
| Transactions | Create, edit, and delete income and expenses with a local date, category, optional subcategory, Source, and Note. Filter by month, type, category, and subcategory through URL-backed controls. |
| Categories | Manage income/expense categories and category-scoped subcategories. Archive and restore categories while preserving historical relationships. |
| Monthly planning | Create bill and income templates with due/expected days from 1–28. Explicitly pay, receive, skip, undo, or link compatible transactions for a selected month. |
| Dashboard | Review actual income, expenses, and net; projected month-end net; remaining-spend forecasts and confidence; daily/weekly safe spend; spending pace; planned-income realization; spending breakdowns; and Needs Attention signals. |
| Total Balance | Review a completed-month ledger with preset/custom ranges, starting and ending balances, monthly carry-forward, and separate positive adjustments for opening balances or previously untracked money. |
| Insights | Explore monthly results and break-even gaps, spending composition, income/spending consistency, unusual months, category trends, expense change drivers, and trailing year-over-year comparisons when enough history exists. |
| CSV and settings | Preview, validate, and map imported CSV rows before confirmation; export a selected month's transactions; update the account time zone; and switch between light and dark themes. |

Actual income and expense totals come only from transactions. Balance
adjustments affect Total Balance only. Insights uses actual history and excludes
the incomplete current month from historical baselines and completed-period
comparisons; eligible empty months remain part of that history.

CSV is the supported import format. Import creates new transactions and never
overwrites existing ones; duplicate prevention is limited to one confirmation
flow, without fuzzy historical matching.

## Architecture

| Layer | Implementation |
| --- | --- |
| UI and routing | Next.js 16 App Router, React 19, and TypeScript; server-rendered account pages with client components for interactive forms, charts, and browser state. |
| Components and styling | Tailwind CSS 4, shadcn-based shared primitives, CSS-variable light/dark themes, and Recharts visualizations. |
| Server boundaries | Server actions for application mutations; route handlers for CSV preview/confirmation, export downloads, and NextAuth. Zod schemas validate mutation inputs on the server. |
| Identity and ownership | NextAuth 4 with Google OAuth, JWT sessions, and a local Prisma adapter. Application identity comes from `session.user.id`; user-owned entity and relationship access is checked on the server. |
| Persistence | PostgreSQL with Prisma 7 and the PostgreSQL driver adapter. Committed migrations define the relational schema. |
| Domain and presentation | Server-side modules calculate forecasts, balances, and historical analysis. Presentation helpers serialize money and prepare display data for the UI. |
| Hosting | Vercel for the web app and Neon for PostgreSQL, with separate production and non-production database targets. |

For authenticated workflows, pages and server endpoints resolve account identity,
read or mutate owned records through Prisma, and calculate domain results on the
server. Clients receive serialized data. Route redirects provide navigation
and setup gates; server authentication and ownership checks protect data access.
Session and preference memoization is scoped to one server request.

### Engineering decisions

- **Exact money arithmetic.** PostgreSQL `numeric(14,2)` and Prisma `Decimal`
  preserve monetary precision. Money crosses client boundaries as strings;
  numeric chart conversions are for display only. Currency labels use
  `Intl.NumberFormat` with the account's base currency.
- **An explicit financial calendar.** Transactions store real `YYYY-MM-DD`
  local dates. A confirmed account time zone defines today and the current
  month, avoiding dependence on the deployment server's calendar. The app
  refreshes date-sensitive views at account-local midnight.
- **Separate plans from actual records.** Reusable monthly templates have
  separate occurrence state. Marking paid/received explicitly creates a normal
  transaction; linking uses an existing compatible transaction. Undo deletes
  generated transactions but preserves manually linked ones.
- **Explainable forecasts.** Calculations run on demand and are not persisted.
  Active unhandled bills stay reserved, including overdue bills. Their
  categories are excluded from variable-spend estimates to avoid double counting.
  Pending income affects projected net but does not increase safe-to-spend.
- **Comparable historical periods.** Insights distinguishes months before
  tracking began from eligible months with no activity. Completed-month
  comparisons and category-history eligibility prevent misleading baselines.
- **A demo with a separate data boundary.** Public actions validate fictional
  snapshots and reuse server-side financial helpers. Per-tab browser storage
  holds accepted demo state; the demo has no database access or guest-account
  fallback. Shared presentation components keep the demo and account UI aligned.

For the current month, the core planning relationships are:

```text
netLeftNow = actualIncome - actualExpenses
forecastRemainingSpend = unpaidPlannedBills + variableSpendingEstimate
safeToSpend = netLeftNow - forecastRemainingSpend
projectedEndOfMonthNet = safeToSpend + pendingPlannedIncome
```

Variable spending uses up to six usable completed months, with explicit
fallbacks and confidence rules. Safe-spend estimates preserve negative values;
they are planning estimates, not bank balances or guarantees. Detailed formulas
and month behavior live in [technical decisions](docs/TECH_DECISIONS.md#forecast-decisions).

### Code map

| Location | Responsibility |
| --- | --- |
| [`app/`](app/) | Public pages, authenticated workspaces, onboarding layouts, and route handlers. |
| [`actions/`](actions/) | Server actions for transactions, categories, planned items, adjustments, setup, and the separate public demo. |
| [`lib/auth/`](lib/auth/) and [`lib/validators/`](lib/validators/) | Account identity, preferences, OAuth adapter, and server input schemas. |
| [`lib/forecast/`](lib/forecast/), [`lib/balance/`](lib/balance/), [`lib/insights/`](lib/insights/), and [`lib/dates/`](lib/dates/) | Financial calculations, historical eligibility, and account-local dates. |
| [`lib/import/`](lib/import/) and [`lib/export/`](lib/export/) | CSV parsing, validation, mapping, confirmation, and serialization. |
| [`lib/demo/`](lib/demo/) and [`lib/presentation/`](lib/presentation/) | Fictional snapshots/transitions and server-prepared display models. |
| [`components/`](components/) | Shared primitives, app shell, and feature UI. |
| [`prisma/`](prisma/) | Database schema and committed migrations. |

## AI-assisted development workflow

I use AI to assist with implementation, code exploration, and review. The
workflow makes requirements, constraints, and review criteria explicit so that
suggestions can be evaluated against the app's actual behavior.

- **Repository instructions:** [AGENTS.md](AGENTS.md) defines execution rules,
  ownership safeguards, money/date invariants, scope boundaries, and review
  requirements. It also requires preserving unrelated work and reporting
  exactly which checks were run.
- **Canonical documentation:** [Design System](docs/DESIGN_SYSTEM.md),
  [Technical Decisions](docs/TECH_DECISIONS.md), and
  [Product Spec](docs/PRODUCT_SPEC.md) give agents and developers a shared
  reference. Behavior and architecture changes require updates to the relevant
  document; roadmap ideas become implementation scope only when selected.
- **Version-aware guidance:** Installed dependencies and the lockfile establish
  the versions in use. Project instructions prioritize Context7 for
  version-specific library questions and relevant implementation skills,
  subject to the project's locked decisions.
- **Independent review agents:** The repository defines read-only reviewers
  under [.codex/agents/](.codex/agents/). Relevant behavior changes receive
  review after implementation, with multiple reviewers running in parallel
  when their domains apply.

| Review agent | Focus |
| --- | --- |
| [`reviewer`](.codex/agents/reviewer.toml) | Concrete correctness issues, regressions, error handling, and maintainability risks. |
| [`money_integrity`](.codex/agents/money-integrity.toml) | Decimal arithmetic, actual-versus-planned behavior, forecasts, dates, and historical calculations. |
| [`data_isolation`](.codex/agents/data-isolation.toml) | Authentication, authorization, ownership, related IDs, and cross-user access. |
| [`test_auditor`](.codex/agents/test-auditor.toml) | Meaningful regression and edge-case test gaps. |

The implementing agent must independently verify reported findings against the
code and project rules, consolidate duplicates, discard unsupported findings,
and resolve valid issues. Material logic fixes receive a final relevant review.
Tests and checks provide evidence when executed; agent approval alone is not
proof of correctness. I retain responsibility for deciding scope, reviewing
tradeoffs, and accepting the result. Commands that run tests, builds, servers,
or database operations require explicit authorization under the project workflow.

## Testing and verification

`npm test` runs the targeted regression suite using Node's test runner through
`tsx`. Its focus includes:

- Decimal-safe forecasting, confidence, negative safe spend, spending pace,
  planned-income realization, and balance carry-forward
- account-local dates and UTC month boundaries
- historical medians, category eligibility, valid zero-activity months,
  unusual-month detection, and year-over-year comparisons
- planned-item validators and lifecycle helpers; demo generated/link/skip/undo
  transitions and their effects on financial summaries
- demo validation, storage recovery, and stale-response handling
- URL/editor state, form selections, presentation contracts, public metadata,
  and selected UI behavior

These are targeted domain and contract tests. OAuth, real-account database
workflows, and complete browser journeys also need integration or manual
verification; the package scripts do not include a browser end-to-end suite.

| Command | Purpose |
| --- | --- |
| `npm test` | Targeted regression suite. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript without emitting files. |
| `npm run build` | Prisma generation followed by the Next.js production build; does not apply migrations. |
| `npm run check` | Lint, typecheck, and build in sequence; does not include tests. |

## Local development

### Prerequisites

- Node.js 22.x, version 22.12 or newer, and npm (compatible with the locked dependencies)
- a PostgreSQL development database
- Google OAuth credentials for authenticated workflows

### 1. Configure the environment

Create `.env.local` before installing dependencies: the install hook generates
Prisma Client and loads the database configuration.

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=YOUR_RANDOM_SECRET
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
```

Optionally set `DATABASE_URL_UNPOOLED` to a direct connection for Prisma CLI
commands; otherwise they use `DATABASE_URL`. For a new contributor's checkout,
use your own non-production database and Google OAuth client. Register
`http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
The maintained deployment's shared preview setup is described in the
[deployment guide](docs/DEPLOYMENT.md).

### 2. Install the locked dependencies

```bash
npm ci
```

The install hook generates Prisma Client. After schema changes, regenerate it
with `npm run prisma:generate`.

### 3. Apply committed migrations

Confirm the database target in `.env.local` and any exported environment
variables, then apply the committed migrations to your development database:

```bash
npx prisma migrate deploy
```

The CLI prefers `DATABASE_URL_UNPOOLED` when configured. Exported environment
variables take precedence over dotenv files; `.env.local` takes precedence over
`.env`. Author new migrations against a disposable development database, as
described in the deployment guide.

### 4. Start the app

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000) to explore the public demo, or sign
in with Google and complete currency/time-zone setup for an account.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Public product introduction. |
| `/demo` | Public interactive demo with fictional per-tab data. |
| `/login` | Google sign-in. |
| `/setup` | Required currency, time zone, and optional default-category setup. |
| `/dashboard` | Monthly Snapshot, planning estimates, Total Balance, and planned-item handling. |
| `/transactions` | Transaction entry, filtering, editing, and deletion. |
| `/insights` | Historical cashflow, spending patterns, and comparisons. |
| `/categories` | Category and subcategory management. |
| `/planned` | Monthly planned bill and income template management. |
| `/settings` | Account time zone, CSV import/export, and theme. |

Account workspaces require authentication and completed setup.
`/planned-income` remains a protected compatibility redirect to
`/planned?type=INCOME`. Import/export have no standalone workspace routes:
Settings hosts both workflows, with `/api/import/preview`, `/api/import/confirm`,
and `/settings/export/download` providing their server endpoints.

## Deployment and scope

The maintained deployment uses Vercel and Neon. Pushes to `main` create
Production deployments; other branches create Previews. Production and
non-production use separate database targets and NextAuth secrets. Migrations
are applied manually, separately from builds. Releases create a new Production
build from `main`; a code rollback does not roll back database migrations.

See [Deployment and Public Discovery](docs/DEPLOYMENT.md) for environment
separation, migration procedures, preview OAuth, release steps, and indexing.

CashContour supports multiple isolated personal users, each with one base
currency. Its scope is manual tracking and explainable monthly planning. Bank
sync, multiple financial accounts/reconciliation, FX, budgets/envelopes,
advanced recurrence, shared workspaces, billing, native mobile apps, investment
tracking, and background notifications are outside the implemented scope.
The app has no AI categorization or forecasting features; AI assistance is part
of the development workflow.

## Project documentation

| Document | Responsibility |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Execution workflow, critical safeguards, and independent review policy. |
| [Design System](docs/DESIGN_SYSTEM.md) | Visual language, shared components, and interaction conventions. |
| [Technical Decisions](docs/TECH_DECISIONS.md) | Architecture, data rules, formulas, and implementation constraints. |
| [Product Spec](docs/PRODUCT_SPEC.md) | Current implemented behavior and scope. |
| [Roadmap](docs/ROADMAP.md) | Candidate future work, not automatically selected implementation scope. |
| [Deployment Guide](docs/DEPLOYMENT.md) | Operational procedures for the maintained deployment. |

Historical specifications and completed plans remain in [docs/archive/](docs/archive/).
