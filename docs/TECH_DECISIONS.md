# Tech Decisions (Locked for MVP + Next Phase)

## Purpose

This document locks key technical decisions for the project so the codebase stays consistent.

Use this file to lock:

- architecture choices
- security/scoping rules
- data-shape rules
- validation patterns
- important implementation constraints

This is **not** the product spec.
Agents/engineers should follow this and avoid introducing alternative patterns unless explicitly requested.

---

## Phase model

The project now has two layers:

1. **Original Free MVP baseline**

   - auth
   - setup
   - categories CRUD
   - transactions CRUD
   - dashboard totals
   - transactions list + filters
   - CSV export
   - polish/hardening

2. **Current next phase**
   - CSV / Excel import
   - planned bills
   - basic current-month forecast
   - safe-to-spend

Technical decisions in this file apply across both layers unless explicitly stated otherwise.

---

## Stack

Locked stack:

- Next.js App Router + React + TypeScript
- PostgreSQL
- Prisma ORM
- NextAuth with Prisma adapter
- Tailwind CSS
- Web app first

Do not replace the stack unless explicitly requested.

---

## Authentication

Locked decisions:

- NextAuth Google OAuth only
- NextAuth route handler at:
  - `app/api/auth/[...nextauth]/route.ts`
- Sign-in page:
  - `/login`
- Session must include `session.user.id`
  - use NextAuth callbacks to attach `user.id` to session
  - add TypeScript module augmentation in `types/next-auth.d.ts`

Do not introduce:

- email/password auth
- magic links
- alternative auth providers
  unless explicitly requested later.

---

## Route protection + setup enforcement

Two layers are required.

### 1. Auth protection

Use:

- `proxy.ts` with `next-auth/middleware`

Protected authenticated routes include:

- `/dashboard`
- `/transactions`
- `/categories`
- `/export`
- `/setup`
- `/planned`
- `/import`

### 2. Setup enforcement

Use the app layout server-side for setup gating.

In `app/(app)/layout.tsx`:

- query the authenticated user record
- if `hasCompletedSetup` is false and current route is not `/setup`, redirect to `/setup`
- if user visits `/setup` and `hasCompletedSetup` is true, redirect to `/dashboard`

Do not move setup enforcement fully to the client.

---

## Database + money types

Locked decisions:

- money stored in Postgres as `numeric(14,2)`
- Prisma uses `Decimal`
- never use float for money
- `Transaction.amount` is always positive
- transaction sign is implied by `Transaction.type`:
  - `INCOME`
  - `EXPENSE`

Currency rules:

- per-user base currency stored on `User.currency`
- store ISO 4217 code string, for example:
  - `EUR`
  - `GBP`
  - `USD`
- no FX conversion
- no multi-currency transaction support in this phase

---

## Dates and month boundaries

Locked date strategy:

- store transaction date as a local date string:
  - `Transaction.localDate = "YYYY-MM-DD"`
- month queries use local-date string ranges
- avoid DateTime month-boundary logic for transactions to prevent timezone / DST bugs

Recommended month query pattern:

- `localDate >= "${YYYY}-${MM}-01"`
- `localDate < first day of next month`

This same local-date approach should drive:

- dashboard month filters
- export ranges
- import validation
- forecast month boundaries

---

## Data model decisions

### Users

Keep:

- `hasCompletedSetup: boolean`
- `currency: string`

### Categories

Keep:

- `isArchived: boolean`

Rules:

- archiving is allowed even if category already has transactions
- archived categories are hidden in new-transaction dropdowns by default
- existing transactions keep their category relationship
- category ownership must always be verified by `userId`

### Transactions

Transaction fields remain:

- `type`
- `amount`
- `localDate`
- `categoryId`
- `source`
- `note`

Rules:

- amount is positive
- type determines income vs expense
- imported transactions become normal transactions after confirmation
- imported transactions use the same validation rules as manual transactions

### Planned bills

Add a separate model:

- `PlannedBill`

Minimum fields:

- `id`
- `userId`
- `name`
- `amount`
- `dueDayOfMonth`
- `categoryId`
- `isActive`
- timestamps

Rules:

- planned bills are separate from transactions
- planned bills are expense-only
- planned bills must use a category owned by the same user
- planned bill category must be `EXPENSE`
- `dueDayOfMonth` must be `1–28`
- planned bills do not automatically create transactions in this phase

Do not merge planned bills into the transaction table.

---

## Forecast decisions

Forecast is intentionally lightweight in this phase.

Locked decisions:

- forecast is computed on demand
- forecast results are **not persisted**
- forecast is derived from:
  - actual transactions
  - active planned bills
  - month/date helpers
  - forecast helper utilities

Required derived metrics:

- `netLeftNow`
- `forecastRemainingSpend`
- `projectedEndOfMonthNet`
- `safeToSpend`

Locked formulas:

- `netLeftNow = incomeSoFar - expenseSoFar`
- `forecastRemainingSpend = unpaidPlannedBills + variableCategoryForecast`
- `projectedEndOfMonthNet = incomeSoFar - (expenseSoFar + forecastRemainingSpend)`
- `safeToSpend = netLeftNow - forecastRemainingSpend`

Forecast rules:

- forecast targets the selected month, with current month as the priority
- forecast must stay deterministic and explainable
- use trailing recent history for variable spend where possible
- if there is limited history, use a simpler fallback rather than inventing confidence

Do not introduce:

- ML/AI forecasting
- background jobs
- persisted forecast snapshots
- hidden “smart” adjustments the user cannot understand

---

## Import decisions

Import is a manual, user-triggered flow.

Locked decisions:

- CSV support is required
- `.xlsx` support is optional if straightforward to add cleanly
- import must provide preview before DB write
- import must validate row-by-row
- import must never overwrite existing transactions
- import creates new transaction rows only

Minimum supported import fields:

- `localDate`
- `type`
- `category`
- `amount`

Optional fields:

- `source`
- `note`

Validation rules:

- date must be valid `YYYY-MM-DD`
- amount must parse to positive decimal
- type must map to supported values
- category must be mapped before confirm

Category handling rules:

- during import, unknown categories may be:
  - mapped to an existing category, or
  - created as new categories
- category creation must still be scoped to the authenticated user

Duplicate handling rules:

- avoid duplicate creation within the same import confirmation flow
- do not implement fuzzy historical dedupe in this phase

Import persistence rule:

- do not build a complex import-history system in this phase
- preview state can be temporary / lightweight
- simplest safe implementation is preferred

---

## Mutations and validation

Locked implementation pattern:

- use server actions in `/actions/*` as the default for app mutations
- route handlers in `app/api/*/route.ts` are allowed for interactive client-side workflows that need a server boundary, such as import preview/confirm
- validate all inputs on the server using Zod schemas in `/lib/validators/*`
- all DB access must be server-side
- no direct client DB access

This applies to:

- setup
- categories
- transactions
- planned bills
- import validation and confirmation

---

## Query scoping (security rule)

This is mandatory.

- every query MUST be scoped by `userId = session.user.id`
- never trust client-provided `userId`
- if an entity is accessed by ID:
  - verify it belongs to the authenticated user before read/update/delete

This rule applies to:

- categories
- transactions
- planned bills
- imports
- dashboard data
- export data
- forecast inputs

---

## UI / forms

Locked UI/form approach:

- minimal UI
- responsive
- no unnecessary wizard complexity outside setup/import
- validation messages must be visible and actionable

Transaction form fields remain:

- `type`
- `amount`
- `localDate`
- `categoryId`
- `source`
- `note`

Planned bill form fields:

- `name`
- `amount`
- `categoryId`
- `dueDayOfMonth`
- `isActive`

Import flow should be explicit:

1. upload
2. parse
3. preview
4. validate / map
5. confirm

Forecast UI rules:

- clearly label forecast metrics as estimates
- safe-to-spend must not be shown as an account balance
- explainability matters more than cleverness

---

## Formatting + currency display

Locked decision:

- use `Intl.NumberFormat` with `user.currency` for display formatting

Do not store formatted money strings in the database.

---

## Folder / implementation conventions

Preferred structure:

- server actions in `/actions`
- route handlers in `app/api/*/route.ts` when a client workflow needs a server transport boundary
- validators in `/lib/validators`
- auth helpers in `/lib/auth`
- month/date helpers in `/lib/dates`
- forecast helpers in `/lib/forecast`
- import helpers in `/lib/import`

Do not move business logic into large client components.

---

## Deployment assumptions (can change later)

Current assumptions:

- target hosting: Vercel
- Postgres provider: Neon or Supabase
- use pooled connection string if needed for serverless compatibility

This is an operational assumption, not a permanent product rule.

---

## Agent execution

Locked execution preferences:

- prefer edit-only changes
- avoid dev-server polling / loops
- user runs commands manually unless explicitly requested otherwise
- do not introduce alternative patterns without a clear reason
- prefer small, reviewable changes over broad refactors

---

## Explicit non-decisions / not locked yet

The following are intentionally **not** committed in this file yet:

- bank sync provider choice
- paid billing provider
- mobile-native architecture
- shared household architecture
- budget / rollover model
- sinking fund model
- notification infrastructure
- background job infrastructure

These can be decided later if and when those features enter scope.

---
