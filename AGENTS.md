# Money Tracker — Agent Instructions

## Purpose of this file

This file defines the project goal, scope, rules, source-of-truth documents, and required implementation constraints.

Any coding agent must read and follow this before making changes.

---

## Source of truth (read in this order)

Before making changes, read:

1. `AGENTS.md`
2. `docs/DESIGN_SYSTEM.md`
3. `docs/TECH_DECISIONS.md`
4. `docs/MVP_SPEC.md`
5. `docs/TASKS.md`
6. `docs/NEXT_PHASE_SPEC.md`
7. `docs/TASKS_NEXT.md`

Interpretation rules:

- `MVP_SPEC.md` and `TASKS.md` define the **original shipped Free MVP baseline**
- `NEXT_PHASE_SPEC.md` and `TASKS_NEXT.md` define the **current implementation target after MVP**
- If there is a conflict:
  - `AGENTS.md` wins
  - then `TECH_DECISIONS.md`
  - then the currently relevant spec/task file for the active phase

Agents should not invent product scope beyond these files.

---

## Preferred external skills and MCPs

If available in the agent runtime, prefer these installed skills / MCPs:

- Vercel Next.js skills for Next.js / App Router work
- Prisma official skills for schema design, migrations, Prisma client patterns, and database setup
- Context7 MCP for up-to-date framework and library documentation lookups

Rules:

IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any Next.js, React, Prisma, Tailwind, Zod, NextAuth/Auth.js, and package-version-specific tasks.

- Prefer project docs first when they define product scope, product behavior, or architecture
- Prefer installed skills for implementation best practices
- For library/API documentation, setup, configuration, migrations, upgrades, deprecations, and version-specific framework behavior, always use Context7 first before relying on memory
- Use Context7 especially for:
  - Next.js App Router, route handlers, caching, Server Actions, metadata, and upgrade-related behavior
  - React 19 patterns and framework integration details
  - Prisma schema, migrations, generators, CLI usage, and version migrations
  - Tailwind CSS v4 setup and configuration
  - NextAuth/Auth.js setup patterns and migration guidance
  - Zod APIs and validation patterns
- If Context7 is unavailable, fall back to the local project docs and then general reasoning
- Do not assume external skills or MCPs override this repo’s locked decisions

---

## Product goal

Build and extend a **manual-first personal money tracking web app** using:

- Next.js (App Router) + React + TypeScript
- Tailwind CSS + light/dark mode
- PostgreSQL
- Prisma
- NextAuth (Prisma adapter)
- Web app first

The product replaces a monthly Excel sheet:
users enter income/expenses manually, track monthly totals, and now also get lightweight planning help for the current month.

---

## Current product phase

The original Free MVP is already the baseline.

The current implementation phase extends the MVP with:

1. CSV / Excel import
2. Planned bills (basic monthly planning)
3. Basic current-month forecast
4. Safe-to-spend indicator

This is still a **manual-first**, **single-user**, **web-first** app.
It is **not** yet a full budgeting suite, full subscription product, or bank-sync product.

---

## Locked product decisions

### Baseline MVP decisions

- Authentication: Google OAuth only (NextAuth)
- Onboarding: first login redirects to `/setup`, which must be completed before using the app
- Currency: per-user base currency (choose from a common list). No FX conversion.
- Date handling: store `Transaction.localDate` as a string `"YYYY-MM-DD"`
- Categories: support archiving (`isArchived`). Archiving is allowed even if category is used.
- Transactions: include Create + Edit + Delete
- UI: must follow the design system in `docs/DESIGN_SYSTEM.md`

### Current phase additions

- Import is manual and user-initiated only
- Planned bills are separate from actual transactions
- Forecast is computed on demand; it is not persisted
- Safe-to-spend is an estimate, not an account balance
- Forecasting must remain simple and explainable

---

## Design system (must follow)

- Follow `docs/DESIGN_SYSTEM.md` for colors, typography, spacing, dark mode, card hierarchy, and dashboard structure
- Implement theme tokens as CSS variables in `app/globals.css` with `.dark` overrides
- Tailwind must map to these tokens
- Do not hardcode arbitrary hex colors in components
- Dark mode uses Tailwind `darkMode: "class"` and toggles the `dark` class on `<html>`
- Use Inter for UI text and JetBrains Mono for numeric values
- New dashboard metrics and planning UI must still feel visually consistent with the existing monthly tracking experience

---

## Scope

## In scope now

### Original MVP baseline

Keep working/supporting:

1. Auth (NextAuth) + route protection
2. Setup flow:
   - `/setup`
   - user selects base currency
   - user can create default categories
   - user completes setup (`hasCompletedSetup = true`)
   - app routes redirect to `/setup` until setup is complete
3. Categories CRUD:
   - create, rename, archive/unarchive
   - archived categories hidden from “new transaction” dropdown by default
4. Transactions CRUD:
   - fields: `type`, `amount`, `localDate`, `categoryId`, `source`, `note`
5. Dashboard:
   - month selector
   - totals for selected month: income, expense, net left
6. Transactions list:
   - filters: month, type, category
7. CSV export for a selected month

### Current next-phase scope

Implement/support:

1. Import from spreadsheet files

   - CSV required
   - `.xlsx` optional in this phase if straightforward
   - preview before commit
   - row validation
   - category mapping / creation
   - import creates normal transactions

2. Planned bills

   - create, edit, activate/deactivate, list
   - monthly-only pattern for now
   - fields:
     - `name`
     - `amount`
     - `categoryId`
     - `dueDayOfMonth`
     - `isActive`
   - planned bills are expense-only
   - planned bills do not automatically create actual transactions

3. Basic current-month forecast

   - `forecastRemainingSpend`
   - `projectedEndOfMonthNet`

4. Safe-to-spend indicator

   - `safeToSpend = netLeftNow - forecastRemainingSpend`

5. Dashboard extension
   - show planning-aware metrics
   - show upcoming planned bills
   - explain that forecast values are estimates

---

## Explicitly out of scope

Do NOT implement unless explicitly requested later:

- Bank syncing
- Advanced recurring rules
- Recurring income in this phase
- Budget envelopes / category budgets
- Rollover budgets
- Sinking funds / reserve funds / “money on the side” fund tracking
- Multi-currency transactions or FX conversion
- Paid tiers / payments / subscriptions
- Ads
- Shared / household / multi-user collaboration
- Native mobile apps
- AI categorization
- Fuzzy automatic bill matching
- Background jobs / cron-based forecast pipelines
- Net worth / investments / subscription-cancel workflows

---

## Data rules

### Global rules

- Store money as Postgres `numeric(14,2)` and Prisma `Decimal`
- Never use floats for money
- Every DB query MUST be scoped to the authenticated `userId` (`session.user.id`)
- Never trust client-provided `userId`
- If an entity is accessed by ID, verify it belongs to the authenticated user before reading/updating/deleting

### Transactions

- `Transaction.amount` is always positive
- `Transaction.type` determines INCOME vs EXPENSE
- `Transaction.localDate` must be `"YYYY-MM-DD"` (validate server-side)
- Imported rows become standard transactions after confirmation
- Imported transactions must follow the same validation rules as manual entries

### Categories

- Categories can be archived
- Existing transactions keep their category relationship
- Archived categories are hidden in new-transaction flows by default
- During import, unknown categories may be mapped to an existing category or created as a new one

### Planned bills

- Planned bills belong to a single user
- Planned bills must use an EXPENSE category
- `dueDayOfMonth` must be an integer from `1` to `28`
- Planned bills do not affect actual totals directly
- Planned bills are used for planning/forecast logic only in this phase

### Forecast

- Forecast results must **not** be stored in the database in this phase
- Forecast must be computed from:
  - actual transactions
  - active planned bills
  - month/date helpers
  - forecast helper utilities
- Forecast must be deterministic and explainable

---

## UX rules

- Web first, responsive
- Keep forms fast and simple
- Provide empty states and validation messages
- `/setup` must remain simple and mandatory
- Import flow must be explicit:
  - upload
  - parse
  - preview
  - validate
  - confirm
- Forecast UI must be understandable:
  - show that values are estimates
  - do not make the user guess where numbers came from
- Safe-to-spend must be visually useful but must not be presented as a bank/account balance

---

## Required folder structure

Use this structure unless the user explicitly requests otherwise:

money-tracker/
app/
(auth)/login/page.tsx
(auth)/\_components/...
(app)/layout.tsx
(app)/setup/page.tsx
(app)/dashboard/page.tsx
(app)/transactions/page.tsx
(app)/categories/page.tsx
(app)/planned/page.tsx
(app)/import/page.tsx
(app)/export/page.tsx
api/auth/[...nextauth]/route.ts
actions/
setup.ts
categories.ts
transactions.ts
planned-bills.ts
import.ts
lib/
db.ts
auth/options.ts
auth/session.ts
validators/
planned-bill.ts
import.ts
transaction.ts
dates/
csv/
forecast/
export/
money/
prisma/
schema.prisma
migrations/
types/
next-auth.d.ts
proxy.ts

Route groups:

- `app/(auth)` for public pages
- `app/(app)` for authenticated pages

---

## Implementation approach

- Use server actions under `/actions` as the default for app mutations
- Route handlers under `app/api/*/route.ts` are allowed when an interactive client workflow needs a server boundary, such as the Import preview/confirm flow
- Keep DB access on the server only
- Use Zod validators under `/lib/validators`
- Month helpers under `/lib/dates` should work with `localDate` strings
- Currency formatting via `Intl.NumberFormat` using `user.currency`
- Forecast logic should live under `/lib/forecast`
- Import parsing/mapping helpers should live under `/lib/import`
- Prefer deterministic utility functions over clever implicit behavior

---

## Forecast rules (important)

When implementing forecast logic:

- Keep it simple
- Keep it testable
- Keep it explainable

Baseline formulas:

- `netLeftNow = incomeSoFar - expenseSoFar`
- `forecastRemainingSpend = unpaidPlannedBills + variableCategoryForecast`
- `projectedEndOfMonthNet = incomeSoFar - (expenseSoFar + forecastRemainingSpend)`
- `safeToSpend = netLeftNow - forecastRemainingSpend`

Recommended approach for variable forecast:

- use trailing 3 full months where available
- compute average daily expense for variable categories
- multiply by remaining days in selected month

Fallback behavior:

- if limited history exists, use fewer months or current-month run rate
- UI should indicate lower-confidence estimates when appropriate

Do not over-engineer the forecast in this phase.

---

## Import rules (important)

- CSV support is required
- `.xlsx` support is optional if simple to add cleanly
- Import must allow preview before writing to DB
- Invalid rows must be shown clearly
- Import must not overwrite existing transactions
- Avoid duplicate creation inside the same import confirmation flow
- Keep duplicate prevention simple in this phase
- Do not implement fuzzy historical dedupe

Required minimum import fields:

- `localDate`
- `type`
- `category`
- `amount`

Optional fields:

- `source`
- `note`

---

## Redirect / protection requirements

- `proxy.ts` protects authenticated routes
- In `app/(app)/layout.tsx` (server component), enforce setup:
  - if `user.hasCompletedSetup` is false and route is not `/setup`, redirect to `/setup`
  - after setup completion, redirect `/setup` -> `/dashboard`
- New authenticated routes such as `/planned` and `/import` must also be protected

---

## Execution rules (IMPORTANT — to avoid rate limits / noisy work)

- Default to **edit-only** changes
- Do NOT start long-running processes (`next dev`, `npm run dev`) unless the user explicitly asks
- Do NOT create or run scripts that spawn dev servers and poll HTTP endpoints
- Do NOT run loops to “wait for server” or “health check” pages
- Only run commands if the user explicitly asks, and run them once
- Prefer small, reviewable edits over repeated trial-and-error runs
- Do not refactor unrelated features unless the task requires it

---

## Quality bar

Code should be written so it passes:

- `npm run lint`
- TypeScript typecheck (for example `tsc --noEmit`)
- `npm run dev`

The user will run these commands manually unless explicitly requested.

The agent must NOT start dev servers, run long-lived processes, or create HTTP polling scripts to “verify”.

---

## Git rules

- Work in small, reviewable changes
- Avoid broad refactors unless explicitly requested
- Preserve existing working behavior while adding new phase features
- Do not rewrite the original MVP history; extend it cleanly

---

## What agents should not do

Agents should **not** use the new planning scope as a reason to:

- redesign the full app shell
- replace the auth stack
- move DB access to the client
- introduce background job infrastructure
- add billing/subscription code
- add mobile-native architecture
- implement full budgeting/funds systems
- add “AI assistant” features
- overcomplicate the domain model beyond the current phase

---

## Definition of success for current work

Agent work is successful when:

- the original MVP remains stable
- users can import spreadsheet data
- users can manage planned bills
- the dashboard shows explainable forecast metrics
- safe-to-spend is visible and understandable
- the app remains simple, fast, and trustworthy
