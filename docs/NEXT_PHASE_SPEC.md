# Next Phase Spec — Money Tracker

## Purpose

This document defines the **next implementation phase after the original Free MVP**.

The original MVP remains the baseline:

- auth
- setup
- categories CRUD
- transactions CRUD
- monthly dashboard totals
- transactions list + filters
- CSV export
- polish/hardening

This document adds the **next recommended feature layer** to make the product more competitive and more useful for real monthly decision-making.

Engineers and coding agents should implement only what is described here.
Anything not listed is out of scope unless explicitly added later.

---

## Phase goal

Upgrade the app from a clean spreadsheet replacement into a **manual-first monthly cashflow planner**.

This phase should help users answer:

- What bills are still coming this month?
- Based on my past spending, how much will I probably still spend before month-end?
- How much is actually safe to spend right now?

The app should still stay:

- manual-entry first
- single-user
- web-first
- simple and explainable
- free-tier oriented

---

## Relationship to the original MVP

This phase assumes the original MVP is already working.

Do **not** remove or weaken existing behavior from the MVP.
Instead, extend it with:

1. CSV / Excel import
2. Planned bills (basic)
3. Current-month forecast (basic)
4. Safe-to-spend indicator

This is **not** the full Pro feature set.
This is the lightweight planning layer that should still fit the product’s manual-first identity.

---

## User stories

As a user, I want to:

- import my existing spreadsheet data so I do not have to start from zero
- define the bills I expect each month, even if they are not paid yet
- see what is still likely to be spent before the month ends
- understand whether I am on track to stay within this month’s income
- see a simple “safe to spend” number that helps me make better decisions

---

## Product principles for this phase

- Keep the app explainable: users should understand where forecast numbers come from.
- Prefer simple rules over “smart but mysterious” analytics.
- Preserve trust: never invent unsupported financial data.
- Manual data remains the source of truth.
- Forecasts should be clearly labeled as estimates.
- Planned bills and forecast features should improve decisions, not turn the app into full accounting software.

---

## Scope

Implement the following.

### 1. Import from spreadsheet files

Add a basic import flow so users can migrate from Excel / CSV.

Supported goals:

- import historical transactions from a spreadsheet
- map spreadsheet columns to app transaction fields
- preview import before confirming
- skip invalid rows and show row-level errors
- avoid silent duplicates during a single import

Supported fields:

- `localDate`
- `type`
- `category`
- `amount`
- `source`
- `note`

Import behavior:

- import creates normal transactions owned by the current user
- if a category in the file does not exist:
  - allow user to map it to an existing category, or
  - create a new category during import
- amount must be positive
- type must determine INCOME vs EXPENSE
- imported rows must follow the same validation rules as manual entries

File support:

- CSV is required
- Excel `.xlsx` support is recommended in this phase if straightforward to implement
- if `.xlsx` support is added, convert it into the same import pipeline as CSV

### 2. Planned bills (basic monthly planning)

Add a simple planned-bills feature for expected monthly expenses.

A planned bill is:

- an expected expense
- tied to an expense category
- usually repeats monthly
- used for planning, not yet counted as an actual transaction until paid

Required fields:

- name
- amount
- categoryId
- dueDayOfMonth
- isActive

Rules:

- `dueDayOfMonth` must be 1–28 for simplicity
- planned bills are expense-only
- planned bills do not create actual transactions automatically in this phase
- planned bills should appear in current-month planning if:
  - they are active, and
  - their due day is within the selected month
- bills already “covered” by an existing actual transaction should be marked as paid only if the user explicitly marks them as paid, or if you implement a safe and simple manual link flow
- do **not** use fuzzy automatic matching in this phase

This feature is intentionally simple:

- no reminders
- no notification system
- no custom recurrence rules
- monthly-only pattern for now

### 3. Current-month forecast (basic)

Add a basic forecast for the selected month.

The forecast should estimate:

- `forecastRemainingSpend`
- `projectedEndOfMonthNet`

Definitions:

- `netLeftNow = incomeSoFar - expenseSoFar`
- `forecastRemainingSpend = unpaidPlannedBills + variableCategoryForecast`
- `projectedEndOfMonthNet = incomeSoFar - (expenseSoFar + forecastRemainingSpend)`

Forecast rules:

- forecast is only for the **selected month**
- forecast should use current data plus recent history
- forecast must be explainable in UI

Recommended variable forecast logic:

- use the trailing **3 full months** of expense history
- calculate an average daily spend for variable expense categories
- multiply that by the remaining days in the selected month

To keep the logic clean:

- categories attached to active planned bills should not also be double-counted as variable forecast if that causes obvious duplication
- fixed known bills should come from planned bills
- variable spending categories (such as food, transport, fuel) should be forecast from historical spend

If there is not enough history:

- show a reduced-confidence fallback
- use current-month run rate or zero where appropriate
- never hide the fact that the estimate is weaker

### 4. Safe-to-spend indicator

Add a single headline number:

- `safeToSpend`

Definition:

- `safeToSpend = netLeftNow - forecastRemainingSpend`

Meaning:

- how much the user can likely spend before month-end without exceeding current month income, based on current information

Rules:

- clearly label this as an estimate
- if the number is negative, show a warning state
- do not represent this as account balance
- this is a planning metric, not a bank reconciliation metric

---

## Out of scope for this phase

Do **not** implement:

- bank syncing
- recurring income
- advanced recurring rules (weekly, custom intervals, end dates, pause/resume)
- notification delivery (email, push, SMS)
- budgets by category
- rollover budgets
- sinking funds / reserve funds
- “money on the side” fund tracking
- multi-currency transactions or FX conversion
- shared households / multi-user collaboration
- paid plans, subscriptions, billing
- mobile native apps
- AI categorization
- automatic bill matching using fuzzy rules
- background jobs / cron-based forecasting pipelines
- investment, net worth, or subscription-cancel workflows

---

## Core concepts introduced in this phase

### Import

Import is a one-time or occasional migration / bulk-entry tool.
Imported rows become standard transactions after confirmation.

### Planned bill

A planned bill is an expected expense template for the month.
It is not the same as an actual transaction.

### Forecast

Forecast is an estimate derived from:

- current-month actual transactions
- active planned bills
- recent historical spending patterns

### Safe to spend

Safe to spend is a planning number, not a balance number.

---

## Data model additions

These are the minimum new concepts needed.

### PlannedBill

Add a new entity:

- `name: string`
- `amount: Decimal`
- `dueDayOfMonth: Int`
- `categoryId: string`
- `isActive: boolean`
- `userId: string`
- timestamps

Rules:

- amount is positive
- category must belong to the current user
- category must be an EXPENSE category
- dueDayOfMonth must be 1–28
- every query must be scoped to `userId`

### Import session / temporary parsing

You may implement import preview using either:

- temporary server-side parsed rows stored in memory for the request/session, or
- a lightweight persisted import table

For this phase, the simplest safe approach is acceptable.
Do not over-engineer import history unless explicitly needed.

### Forecast persistence

Do **not** persist forecast results in the database in this phase.
Compute them on demand from:

- transactions
- planned bills
- month helpers
- forecast helper utilities

---

## Pages / Routes

### Existing routes to extend

#### `/dashboard`

Extend the dashboard.

Current dashboard already shows:

- income total
- expense total
- net left

Add:

- forecast remaining spend
- projected end-of-month net
- safe-to-spend
- upcoming planned bills for the selected month
- a short explanation of how forecast is derived

Recommended card/order:

1. Net left now
2. Safe to spend
3. Forecast remaining spend
4. Projected end-of-month net

Optional support sections:

- upcoming planned bills
- recent transactions
- category forecast summary

#### `/transactions`

No major route change required, but the page should remain compatible with imported transactions.
Imported transactions must behave like manually created transactions.

### New routes

#### `/import`

Add an import page.

Required flow:

1. Upload file
2. Parse rows
3. Map columns
4. Preview results
5. Show validation errors and unknown categories
6. Confirm import

Required UX:

- clear instructions for required/optional columns
- preview of first rows
- count of valid / invalid rows
- explicit confirmation before writing to DB

#### `/planned`

Add a planned-bills management page.

Required actions:

- list planned bills
- create planned bill
- edit planned bill
- deactivate/reactivate planned bill
- delete planned bill (optional but recommended)

Display:

- active and inactive sections
- due day
- category
- amount
- next use in current selected month

---

## Navigation

Add navigation entries for:

- Import
- Planned Bills

Do not remove the existing core app sections.

Suggested authenticated nav:

- Dashboard
- Transactions
- Categories
- Planned Bills
- Import
- Export

---

## Dashboard behavior in this phase

For a selected month:

### Required metrics

- `incomeSoFar`
- `expenseSoFar`
- `netLeftNow`
- `unpaidPlannedBills`
- `forecastRemainingSpend`
- `projectedEndOfMonthNet`
- `safeToSpend`

### Required rules

- selected month defaults to current month
- all calculations use the user’s base currency
- all calculations use local-date month boundaries
- forecast logic must be deterministic and testable
- if a month is in the past:
  - forecast can be hidden, or
  - forecast can collapse to actual completed results
- if a month is in the future:
  - keep support minimal in this phase; current month is the priority

### Explainability requirement

The dashboard should include enough context for the user to understand that:

- net left is based on actual entries
- forecast remaining spend is based on planned bills + historical spending estimate
- safe to spend is estimated, not guaranteed

---

## Import requirements

### Minimum supported import format

Required columns:

- `localDate`
- `type`
- `category`
- `amount`

Optional columns:

- `source`
- `note`

Accepted conventions:

- type values like `INCOME` / `EXPENSE`
- optionally accept case-insensitive variants if normalized server-side

### Validation rules

- date must be valid `YYYY-MM-DD`
- amount must parse to positive decimal
- type must be supported
- category must be mapped before confirm
- invalid rows must not be silently imported

### UX requirements

- preview before commit
- clear error reporting
- summary counts:
  - total rows
  - valid rows
  - invalid rows
  - new categories to create
- explicit final confirmation

### Safety requirements

- all imports are scoped to the authenticated user
- no import should overwrite existing transactions
- import creates new rows only
- avoid duplicate row creation inside the same confirmation flow

---

## Planned-bills requirements

### Create / edit form fields

- name
- amount
- category
- due day of month
- active toggle

### Validation

- amount > 0
- due day 1–28
- category exists and belongs to current user
- category type must be EXPENSE

### Display logic

For the selected month, each bill should show:

- name
- amount
- category
- due day
- status:
  - upcoming
  - due today
  - passed
  - inactive

Optional:

- paid marker if you implement a manual mark-as-paid action

### Data rules

- planned bills do not affect actual totals until converted into real expense transactions
- planning metrics may use them in forecast logic even when they are not actual transactions yet

---

## Forecast logic requirements

### Baseline

Forecast should be simple and documented in code.

Required helper outputs:

- remaining days in selected month
- trailing historical months used
- variable category estimate
- unpaid planned-bill total
- final safe-to-spend result

### Suggested algorithm

For current month:

1. Calculate actuals so far:

   - income so far
   - expense so far
   - net left now

2. Calculate unpaid planned bills for the rest of the month:

   - active planned bills with due day >= today (or >= selected day context)
   - if manual paid state exists, exclude paid ones

3. Calculate variable spend estimate:

   - look at trailing 3 full months
   - for variable categories, compute average daily spend
   - multiply by remaining days in month

4. Sum:

   - forecast remaining spend = unpaid planned bills + variable estimate

5. Derive:
   - projected end-of-month net
   - safe to spend

### Fallback behavior

If there are fewer than 3 full months of history:

- use fewer months
- or use current-month run rate
- or show reduced-confidence messaging

The UI should not pretend the estimate is equally strong in all cases.

---

## UX / UI rules for this phase

- Reuse the existing design system
- Keep dashboard hierarchy centered on the month and the main money numbers
- Do not add noisy analytics widgets
- Keep forms lightweight and fast
- Tables should remain readable on desktop and degrade cleanly on mobile
- Use semantic states for forecast outcomes:
  - positive / safe
  - caution
  - negative / over-limit risk

Recommended messaging examples:

- “Estimated”
- “Based on your recent spending and upcoming bills”
- “Forecast confidence is lower because there is limited history”

---

## Acceptance criteria (must be true)

### Import

- User can upload a CSV and preview rows before import
- Valid rows import successfully as standard transactions
- Invalid rows are reported clearly
- Imported rows belong only to the authenticated user
- Import does not overwrite existing data

### Planned bills

- User can create, edit, activate/deactivate, and list planned bills
- Planned bills are scoped to the authenticated user
- Planned bills appear on the dashboard for the selected month
- Planned bills do not automatically become actual transactions

### Forecast

- Dashboard shows forecast remaining spend
- Dashboard shows projected end-of-month net
- Dashboard shows safe-to-spend
- Forecast numbers are computed consistently from actuals + planned bills + simple history
- Forecast is labeled as estimated

### Product quality

- Existing MVP features continue to work
- TypeScript typecheck passes
- lint passes
- UI remains responsive
- no user data leaks across accounts
- all new queries and mutations are user-scoped

---

## Implementation notes

- Keep DB access server-side only
- Use server actions for mutations
- Use Zod validators for all new forms and import parsing
- Reuse local-date month helpers
- Keep forecast logic in dedicated helper functions so it can be tested independently
- Prefer small, reviewable changes over large refactors
- Avoid background job infrastructure in this phase

---

## Suggested folder additions

These are suggested additions, not a forced full refactor.

- `app/(app)/planned/page.tsx`
- `app/(app)/import/page.tsx`
- `actions/planned-bills.ts`
- `actions/import.ts`
- `lib/validators/planned-bill.ts`
- `lib/validators/import.ts`
- `lib/forecast/*`
- `lib/import/*`

---

## Non-goals for coding agents

Agents should **not** use this phase as a reason to:

- redesign the whole app shell
- refactor all data fetching patterns
- replace the current auth stack
- introduce client-side DB access
- add subscription/payment code
- add “AI finance assistant” features
- overcomplicate forecasting beyond the documented basic model

---

## Definition of done for this phase

This phase is complete when:

- spreadsheet users can import historical data
- users can define monthly planned bills
- the dashboard shows explainable current-month forecast metrics
- safe-to-spend is visible and understandable
- the app still feels simple, fast, and trustworthy
