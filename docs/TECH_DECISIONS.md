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
   - planned income
   - basic current-month forecast
- safe-to-spend
- daily safe spend
- weekly safe spend
- spending pace
   - needs-attention dashboard signals

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
- `/planned-income`
- `/import`

`/planned` is the canonical planned-items workspace. `/planned-income` remains
protected only as a compatibility redirect to `/planned?type=INCOME`, translating
legacy income edit parameters when present.

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
- optional `subcategoryId`
- `source`
- `note`

Rules:

- amount is positive
- type determines income vs expense
- optional subcategory must belong to the selected category
- imported transactions become normal transactions after confirmation
- imported transactions use the same validation rules as manual transactions

### Subcategories

Add a separate model:

- `Subcategory`

Compatibility mapping:

- Prisma exposes `Subcategory` and `subcategoryId`
- PostgreSQL retains the existing `"Tag"` table and `"tagId"` columns through `@@map` and `@map`
- this terminology change must not drop, recreate, or backfill existing classification data

Rules:

- subcategories belong to exactly one category
- subcategory names are unique within a category
- subcategories can classify transactions, planned bills, and planned income
- subcategories are optional
- when a category changes, an old subcategory is not preserved unless the submitted subcategory belongs to the new category
- deleting a subcategory sets related transaction/planned item `subcategoryId` to `null`

### Planned bills

Add a separate model:

- `PlannedBill`

Minimum fields:

- `id`
- `userId`
- `name`
- optional `source`
- optional `note`
- `amount`
- `dueDayOfMonth`
- `categoryId`
- optional `subcategoryId`
- `isActive`
- timestamps

Rules:

- planned bills are separate from transactions
- planned bills are expense-only
- planned bills must use a category owned by the same user
- planned bill category must be `EXPENSE`
- optional planned-bill subcategory must belong to the selected expense category
- `dueDayOfMonth` must be `1–28`
- planned bills do not automatically create transactions in this phase
- monthly paid/skipped state belongs in `PlannedBillOccurrence`, not on the reusable planned bill template
- forecasts must use explicit occurrence state rather than fuzzy matching to decide whether a planned bill is still unpaid for a month
- paid planned-bill occurrences must record whether the linked transaction was generated by the planned-bill action or linked from an existing transaction
- undoing a generated planned-bill payment deletes the generated transaction; undoing a linked existing transaction removes only the occurrence and keeps the transaction
- generated planned-bill payment transactions inherit the planned bill category,
  optional subcategory, optional source, and optional note; the planned bill
  name remains template identity only

Do not merge planned bills into the transaction table.

### Planned income

Add a separate reusable model:

- `PlannedIncome`

Minimum fields:

- `id`
- `userId`
- `name`
- optional `source`
- optional `note`
- `amount`
- `expectedDayOfMonth`
- `categoryId`
- optional `subcategoryId`
- `isActive`
- timestamps

Rules:

- planned income is separate from transactions
- planned income is income-only
- planned income must use a category owned by the same user
- planned income category must be `INCOME`
- optional planned-income subcategory must belong to the selected income category
- `expectedDayOfMonth` must be `1-28`
- planned income does not automatically create transactions
- monthly received/skipped state belongs in `PlannedIncomeOccurrence`, not on the reusable planned income template
- pending planned income affects projected month-end net
- pending planned income does not affect conservative safe-to-spend
- pending planned income can create dashboard attention signals when it is due, overdue, or important context for negative safe-to-spend
- paid/received planned-income occurrences must record whether the linked transaction was generated by the planned-income action or linked from an existing transaction
- undoing a generated planned-income receipt deletes the generated transaction; undoing a linked existing transaction removes only the occurrence and keeps the transaction
- planned-income transaction link hints are deterministic labels only; they must not auto-match or auto-link transactions
- generated planned-income transactions inherit the planned income category,
  optional subcategory, optional source, and optional note; the planned income
  name remains template identity only

Do not merge planned income into the transaction table.

### Balance adjustments

Use a separate user-owned `BalanceAdjustment` model for money that belongs in
historical balance without becoming transaction income.

Locked fields and storage:

- `userId` derived from the authenticated session
- positive `amount` stored as Prisma `Decimal` / Postgres `numeric(14,2)`
- `effectiveMonth` stored as a strict `YYYY-MM` completed-month string
- optional note and timestamps
- cascading deletion with the owning user
- index on `(userId, effectiveMonth)`

Rules:

- adjustments can be created, edited, and deleted
- create and update reject zero, negative, current-month, and future-month data
- every read and mutation is scoped to the authenticated `userId`
- adjustments affect Total Balance only
- adjustments never affect transaction income, expenses, planned items,
  safe-to-spend, or forecast calculations
- negative/debit adjustments and separate accounts are not part of V1

---

## Total Balance decisions

Total Balance is a calculated completed-month ledger view, not a bank balance or
reconciliation system.

Locked formulas:

- `endingBalance = balanceAdjustmentsToDate + incomeToDate - expensesToDate`
- `netChange = incomeInPeriod - expensesInPeriod + balanceAdjustmentsInPeriod`
- `endingBalance = startingBalance + netChange`

Period rules:

- current and future months are excluded
- custom month ranges are inclusive complete months
- custom year ranges expand to complete January-December years
- activity before the selected period remains in starting balance
- months without activity carry the previous ending balance forward
- negative balances remain visible

Dashboard rules:

- Total Balance renders before Monthly Snapshot
- Total Balance period parameters are independent from the Monthly Snapshot
  `month` parameter and are preserved across dashboard mutations
- Total Balance defaults to all time
- invalid balance ranges normalize to all time and return an actionable error
- Add Money opens its inline form immediately with local client state; its query parameter remains available for validation-error recovery, while adjustment management stays query-parameter-driven. Add, manage, and edit disclosures are mutually exclusive: opening Add clears manage/edit URL state, and opening Manage closes Add.
- calculations stay Decimal-safe on the server; chart numbers are display-only

---

## Forecast decisions

Forecast is intentionally lightweight in this phase.

Locked decisions:

- forecast is computed on demand
- forecast results are **not persisted**
- forecast is derived from:
  - actual transactions
  - active planned bills
  - active planned income
  - month/date helpers
  - forecast helper utilities

Required derived metrics:

- `netLeftNow`
- `forecastRemainingSpend`
- `projectedEndOfMonthNet`
- `safeToSpend`
- `dailySafeSpend`
- `weeklySafeSpend`
- `spendingPace`
- `pendingPlannedIncome`

Locked formulas:

- `netLeftNow = incomeSoFar - expenseSoFar`
- `forecastRemainingSpend = unpaidPlannedBills + variableCategoryForecast`
- `projectedEndOfMonthNet = netLeftNow + pendingPlannedIncome - forecastRemainingSpend`
- `safeToSpend = netLeftNow - forecastRemainingSpend`
- `dailySafeSpend = safeToSpend / remainingDaysIncludingToday`
- `weeklySafeSpendDays = min(7, remainingDaysIncludingToday)`
- `weeklySafeSpend = safeToSpend / remainingDaysIncludingToday * weeklySafeSpendDays`
- `currentDailyPace = selectedMonthVariableExpensesSoFar / elapsedDays`
- `historicalDailyPace = trailingUsableMonthVariableExpenses / trailingUsableMonthCalendarDays`
- `spendingPacePercentage = (currentDailyPace - historicalDailyPace) / historicalDailyPace * 100`

Forecast rules:

- forecast targets the selected month, with current month as the priority
- forecast must stay deterministic and explainable
- use up to six trailing full usable months for variable spend where possible
- a usable history month contains at least one eligible variable expense
- confidence is deterministic: Low for 0-2 usable months, Medium for 3-5, and
  High for 6 or more
- current-month run rate and no-data fallbacks have Low confidence
- weekly safe spend preserves negative values and returns zero for completed months
- spending pace uses actual variable expenses only and excludes every active
  planned-bill category from both current and historical inputs
- spending pace uses elapsed days for the current month, the full selected-month
  calendar for a completed past month, and up to six usable trailing full months
  for its historical baseline
- spending pace is unavailable for future months and when no usable historical
  baseline exists; direction is based on the percentage rounded to one decimal
- the Spending pace metric stays compact; only an above-usual current-month pace
  creates a warning attention signal, ordered after due-soon planned bills

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
- `subcategory`

Legacy CSV headers `tag` and `tags` remain accepted as aliases for `subcategory`.

Validation rules:

- date must be valid `YYYY-MM-DD`
- amount must parse to positive decimal
- type must map to supported values
- category must be mapped before confirm
- optional subcategory must resolve inside the selected category before confirm

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
- subcategories
- transactions
- planned bills
- planned income
- balance adjustments
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
- subcategories
- transactions
- planned bills
- planned income
- balance adjustments
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
- optional `subcategoryId`
- `source`
- `note`

Transaction-page interaction rules:

- month, type, category, and subcategory filters use URL search parameters and
  GET navigation so filtered views remain addressable
- the month control preserves applied advanced filters, while advanced-filter
  Reset preserves the selected month
- a small client component may own advanced-filter disclosure and cascading
  draft selections; transaction reads and effective filter normalization remain
  server-side
- a client edit-form wrapper may compare current serialized field values with
  the original transaction to disable Save changes until the form is dirty
- update and delete operations remain server actions with the existing
  server-side validation and ownership checks; client dirty-state detection is
  a UX affordance, not a validation or authorization boundary

Planned bill form fields:

- `name`
- optional `source`
- optional `note`
- `amount`
- `categoryId`
- optional `subcategoryId`
- `dueDayOfMonth`
- `isActive`

Planned income form fields:

- `name`
- optional `source`
- optional `note`
- `amount`
- `categoryId`
- optional `subcategoryId`
- `expectedDayOfMonth`
- `isActive`

Planned-workspace interaction rules:

- keep planned-bill and planned-income models, validators, actions, and ownership
  checks separate; the unified list uses an internal `BILL`/`INCOME`
  discriminant only
- use URL-backed `type=BILL|INCOME`, `status=inactive`, and composite
  `edit=bill:<id>|income:<id>` state; omitted type means All and omitted status
  means Active
- render Add bill and Add income as tabs in one content-height creation card;
  creation forms omit `isActive` and the server boundary always creates Active
  templates
- fetch both datasets server-side, filter them for the selected view, and render
  bills before income in All views while preserving each type's ordering
- render compact category/subcategory rows with semantic bill/income icons and
  right-aligned due-or-expected day and amount; omit name and status from the
  collapsed presentation and expose lifecycle actions only inside View/Edit
- preserve the selected type/status view across edit, activate/deactivate,
  delete, close, and save redirects
- keep the two persistence mutation paths separate; unifying the page does not
  merge database models or validator interfaces

Import flow should be explicit:

1. upload
2. parse
3. preview
4. validate / map
5. confirm

Forecast UI rules:

- clearly label forecast metrics as estimates
- safe-to-spend must not be shown as an account balance
- show Forecast remaining spend as one combined amount without displaying its
  reserved-bill and variable-spending component amounts beneath the metric
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
