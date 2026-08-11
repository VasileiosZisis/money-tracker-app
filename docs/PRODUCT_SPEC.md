# Money Tracker Product Spec

## Purpose

This document defines the current Money Tracker product behavior and scope.

It consolidates the relevant parts of the original Free MVP and next-phase
specifications into one current source of truth. Historical phase documents may
describe earlier implementation stages, but this document describes the product
as it exists now.

For implementation constraints and locked architecture decisions, use
`docs/TECH_DECISIONS.md`.

## Product Goal

Money Tracker is a manual-first personal finance web app that replaces a
monthly spreadsheet while adding lightweight, explainable planning support.

The app should help a user:

- record income and expenses manually
- understand monthly cashflow
- plan for expected bills and expected income
- estimate remaining monthly spending
- make safer daily spending decisions
- import and export transaction data

The app remains single-user, single-currency, web-first, and intentionally
simpler than a full accounting or budgeting suite.

## Product Principles

- Manual data is the source of truth.
- Actual totals come only from transactions.
- Planning metadata stays separate from actual transactions.
- Forecast calculations must be deterministic and explainable.
- Users explicitly control whether planned items are received, paid, skipped,
  or linked to transactions.
- Do not use fuzzy automatic matching.
- Forecast values are estimates, not bank balances or guarantees.
- Keep common workflows fast and understandable.

## Current Implemented Scope

### Authentication And Setup

- Google OAuth through NextAuth is the only authentication method.
- First login requires setup before the authenticated app can be used.
- Setup includes:
  - choosing a base currency
  - optionally creating default categories
  - marking setup complete
- Unauthenticated users are redirected to `/login`.
- Authenticated users without completed setup are redirected to `/setup`.
- Authenticated users with completed setup are redirected away from `/setup`
  to `/dashboard`.

### Currency And Dates

- Each user has one ISO 4217 base currency.
- All amounts are assumed to use that currency.
- No FX conversion is performed.
- Transaction dates use a local date string in `YYYY-MM-DD` format.
- Month filtering uses local-date string boundaries.

### Categories And Subcategories

- Categories are either `INCOME` or `EXPENSE`.
- Users can create and rename categories.
- Categories can be archived or restored.
- Archived categories remain attached to existing records but are hidden from
  new-entry forms by default.
- Subcategories belong to one category and provide optional finer classification.
- A transaction or planned item can only use a subcategory from its selected category.
- Newly created, renamed, or imported category and subcategory names use sentence
  case while preserving whitespace-delimited all-caps words.
- Category and subcategory duplicate checks ignore case within their existing
  uniqueness scopes. Existing stored names are not rewritten automatically.
- The Categories page keeps category creation in a left workspace column and
  shows one unified category list in the right column.
- The list defaults to all active categories, can be filtered by Income or
  Expense type, and can switch between Active and Inactive status.
- Category rows use the same income/expense icon language as transactions and
  show subcategory names on a secondary line separated by ` / `.
- A collapsed category exposes `View/Edit`. Its expanded editor stages category
  and subcategory renames, additions, and removals for one atomic save.
- Category editors open immediately in local client state, with only one editor
  open at a time and shallow URL synchronization for deep-link compatibility.
- Active categories expose Archive in the editor; inactive categories expose
  Restore. Category type cannot be changed during editing.

### Transactions

Transactions are the only source of actual income and expense totals.

Transaction fields:

- type: `INCOME` or `EXPENSE`
- positive decimal amount
- local date in `YYYY-MM-DD`
- category
- optional category-scoped subcategory
- optional source
- optional note

Users can:

- create transactions
- edit transactions
- delete transactions
- filter by month, type, category, and subcategory

Transaction-page interaction rules:

- Month selection is applied independently from the optional type, category,
  and subcategory filters.
- Resetting advanced filters preserves the selected month.
- Type limits the available categories, and category limits the available
  subcategories.
- A collapsed transaction exposes a `View/Edit` action; deletion remains
  available inside the expanded editor.
- Transaction editors open immediately in local client state, with only one
  editor open at a time and shallow URL synchronization for deep links.
- The expanded editor disables Save changes until at least one submitted field
  differs from the stored transaction.

All transaction operations are scoped to the authenticated user.

### CSV Import

The import flow is manual and explicit:

1. Upload CSV.
2. Parse rows.
3. Preview results.
4. Validate rows and resolve categories/subcategories.
5. Confirm import.

Required CSV fields:

- `localDate`
- `type`
- `category`
- `amount`

Optional fields:

- `subcategory`
- `source`
- `note`

Legacy CSV files using a `tag` or `tags` header remain import-compatible; new
exports and user-facing terminology use `subcategory`.

Rules:

- Invalid rows must be shown clearly.
- Unknown categories can be mapped or created before confirmation.
- Imported rows become normal transactions.
- Import does not overwrite existing transactions.
- Duplicate prevention is limited to the current confirmation flow.
- No fuzzy historical deduplication is performed.

### CSV Export

- Users can select a month and download its transactions as CSV.
- Export includes only the authenticated user's records.
- Exported transaction data includes date, type, category, amount, source, and
  note, with additional supported classification fields where applicable.

### Planned Items Workspace

`/planned` is the canonical workspace for both planned bills and planned income.
It uses a 300px creation column beside one filterable planned-items list. The
creation card has Add bill and Add income tabs, with Add bill selected by
default. New templates are always active.

The list supports All, Bill, and Income type views plus Active or Inactive
status. All active items are shown by default; bills appear before income while
each type retains its own day/name ordering. Only one item editor can be open at
a time; it opens immediately in local client state and shallowly synchronizes
its composite edit value to the URL. Rows show the category and optional subcategory beside a red bill or
green income icon, with the due or expected day above the amount at the far
right. Planned-item names and active/inactive labels are omitted from collapsed
rows. Collapsed rows expose only View/Edit; expanded editors keep Name editable
and provide Delete plus Activate or Deactivate. `/planned-income` remains a
protected compatibility route and redirects to `/planned?type=INCOME`,
including translation of legacy edit links.

### Planned Bills

A planned bill is a reusable monthly expense template.

Template fields:

- name
- optional source for generated transactions
- optional note for generated transactions
- positive decimal amount
- expense category
- optional subcategory from that category
- due day from 1 through 28
- active state

Users can create, edit, activate/deactivate, and delete templates in the unified
`/planned` workspace.

Monthly state belongs to `PlannedBillOccurrence`:

- `PAID`
- `SKIPPED`

Rules:

- An active unhandled bill remains reserved in the selected-month forecast,
  even after its due date.
- Mark paid creates a normal expense transaction and records the occurrence as
  generated.
- Link existing transaction records the occurrence as paid without creating a
  duplicate transaction.
- Skip excludes the bill from that month's forecast without creating a
  transaction.
- Undo generated payment deletes the generated transaction.
- Undo linked payment keeps the existing transaction and removes only the
  occurrence.
- Deleting a linked transaction makes the planned bill unhandled again.
- Generated transactions inherit the planned bill category, optional subcategory,
  Source, and Note. The planned bill name remains the template identity and is
  not copied into transaction Source.
- No automatic transaction matching is performed.

### Planned Income

Planned income is a reusable monthly expected-income template.

Template fields:

- name
- optional source for generated transactions
- optional note for generated transactions
- positive decimal amount
- income category
- optional subcategory from that category
- expected day from 1 through 28
- active state

Users can create, edit, activate/deactivate, and delete templates in the unified
`/planned` workspace. `/planned?type=INCOME` opens the income-only list view.

Monthly state belongs to `PlannedIncomeOccurrence`:

- `RECEIVED`
- `SKIPPED`

Rules:

- Active unhandled planned income remains pending for the selected month.
- Mark received creates a normal income transaction and records the occurrence
  as generated.
- Link existing transaction records the occurrence as received without
  creating a duplicate transaction.
- Skip excludes the item from pending planned income without creating a
  transaction.
- Undo generated receipt deletes the generated transaction.
- Undo linked receipt keeps the existing transaction and removes only the
  occurrence.
- Deleting a linked transaction makes the planned income unhandled again.
- Generated transactions inherit the planned income category, optional
  subcategory, Source, and Note. The planned income name remains the template
  identity and is not copied into transaction Source.
- No automatic transaction matching is performed.

### Forecast

Forecast results are computed on demand and are not stored.

Core formulas:

```text
netLeftNow = incomeSoFar - expenseSoFar
forecastRemainingSpend = unpaidPlannedBills + variableCategoryForecast
safeToSpend = netLeftNow - forecastRemainingSpend
dailySafeSpend = safeToSpend / remainingDaysIncludingToday
weeklySafeSpendDays = min(7, remainingDaysIncludingToday)
weeklySafeSpend = safeToSpend / remainingDaysIncludingToday * weeklySafeSpendDays
projectedEndOfMonthNet = netLeftNow + pendingPlannedIncome - forecastRemainingSpend
currentDailyPace = selectedMonthVariableExpensesSoFar / elapsedDays
historicalDailyPace = trailingUsableMonthVariableExpenses / trailingUsableMonthCalendarDays
spendingPacePercentage = (currentDailyPace - historicalDailyPace) / historicalDailyPace * 100
plannedIncomeRealization = actualReceivedPlannedIncome / totalActivePlannedIncome * 100
```

Rules:

- Safe to spend excludes pending planned income.
- Projected month-end net includes pending planned income.
- Variable spending uses up to six recent full usable months where available.
- A historical month is usable when it contains at least one eligible variable
  expense transaction.
- Planned-bill categories are excluded from variable forecasting to avoid
  category-level double counting.
- Forecast confidence is Low for 0-2 usable months, Medium for 3-5, and High for
  6 or more; current-month run rate and no-data fallbacks are Low.
- Past months use completed-month behavior.
- Current month is the primary planning context.
- Negative safe-to-spend and daily-safe-spend values remain visible.
- Weekly safe-to-spend uses up to the next seven remaining days, preserves
  negative values, and returns zero after a month is complete.
- Spending pace compares actual variable expense per elapsed day with actual
  variable expense per calendar day across up to six usable trailing full
  months. Active planned-bill categories are excluded from both inputs.
- Spending pace is available for current and completed past months. Future
  months and months without a usable historical baseline are unavailable.
- Spending pace direction is above, below, or on pace after rounding the
  percentage difference to one decimal place.
- Planned-income realization uses actual transaction amounts from received
  linked/generated occurrences over every active planned-income template amount
  for the selected month. Pending and skipped templates remain in the denominator.
- Realization can exceed 100% and is rounded to one decimal. It is shown for
  current and completed past months; future months are Not started and months
  without active planned income are Unavailable.

### Total Balance

Total Balance is a completed-month historical ledger shown before Monthly
Snapshot. It is calculated from actual transactions and positive balance
adjustments; it is not a bank-synced balance or reconciliation system.

For a selected completed period, it shows:

- starting balance from all earlier activity
- net change inside the period
- ending balance
- one monthly ending-balance point for every month, including inactive months

Supported periods are current year, trailing 3/6/9/12 completed months,
previous 1/2/3 full years, all time, and custom inclusive month or full-year
ranges. All time is the default. Current and future months and incomplete years
are rejected. Total Balance selection remains independent from the Monthly
Snapshot month.

Users can add positive money adjustments for completed months, then review,
edit, or delete them inline. Add, management, and edit disclosures switch
immediately through one mutually exclusive local client state while shallowly
synchronizing their URL value. Adjustments are useful for opening balances and
previously untracked money. They affect Total Balance only and never increase
transaction income or alter monthly totals, planned items, safe-to-spend, or
forecast calculations. Add money, adjustment management, and adjustment editing
are mutually exclusive disclosures so only one workflow is open at a time.

Empty states distinguish no completed history from a current-year range with no
completed month. A selected period with no new activity still shows carried
balances when earlier activity exists.

### Dashboard

The dashboard contains independent Total Balance and Monthly Snapshot sections.
Monthly Snapshot supports a selected month and includes:

- actual income total
- actual expense total
- net left now
- safe to spend
- daily safe spend
- weekly safe spend
- spending pace amount and direction
- planned-income realization percentage with actual-versus-planned amounts
- forecast remaining spend
- current-month forecast confidence
- planned income status and actions
- planned bill status and actions
- recent transactions
- monthly cashflow context
- selected-month actual spending by category and subcategory

The spending breakdown uses actual expense transactions only. Planned bills
appear in the breakdown only after they are represented by a normal transaction.

The dashboard uses one Planned Items card with Planned Bills on the left and
Planned Income on the right, plus one View all action linking to `/planned`. At
widths below 1280px, the card moves below Recent Transactions and takes the full
row; its two sections stack with bills first on small screens.

The Planned Bills section lists only active, unhandled bills. Paid and skipped
occurrences remain available on `/planned` and are omitted from the dashboard
list. The Planned Income section lists only active, unhandled income. Received
and skipped occurrences remain available on `/planned?type=INCOME` and are
omitted from the dashboard list and section summary. When active income exists
but every item is handled, the section shows an `All planned income handled`
empty state.

Planned item statuses include applicable states such as:

- upcoming
- due today
- overdue
- paid/received
- skipped
- passed for completed historical months

### Needs Attention

The dashboard includes a read-only Needs Attention panel. It shows up to six
deterministic signals ordered by urgency.

Implemented signals include:

- overdue planned bills
- overdue planned income
- planned bills due today
- active, unhandled planned bills due within the next three days of the selected
  current month
- planned income expected today
- negative safe to spend
- negative safe to spend while income remains pending
- current-month spending pace above its usable historical baseline
- stale transaction entry
- low forecast confidence

The panel does not perform automatic corrections or matching.

## Routes

### Public

- `/login`

### Setup

- `/setup`

### Authenticated App

- `/dashboard`
- `/transactions`
- `/categories`
- `/planned`
- `/import`
- `/export`

`/planned-income` remains an authenticated compatibility redirect to the income
view of `/planned`; it is not a separate workspace.

All authenticated routes require login and completed setup, except `/setup`
during onboarding.

## Open Roadmap

Open product ideas are maintained in `docs/ROADMAP.md`.

Current candidates include:

- category run-rate warnings
- month progress context
- month-end review
- richer data-completeness context

Roadmap ideas are not implementation requirements until explicitly selected.

## Explicitly Out Of Scope

Do not implement without an explicit product decision:

- bank syncing
- multiple accounts or bank reconciliation
- multi-currency transactions or FX conversion
- advanced recurrence beyond monthly planned templates
- fuzzy or automatic transaction matching
- category budgets, envelopes, or rollover budgets
- sinking funds or reserve-fund accounting
- shared household or multi-user collaboration
- paid plans, billing, or subscriptions
- native mobile applications
- AI categorization or AI forecasting
- background jobs, reminders, or notification delivery
- investment, net-worth, or subscription-cancellation workflows

## Data And Security Requirements

- Store money using Postgres `numeric(14,2)` and Prisma `Decimal`.
- Never use floating-point arithmetic for money.
- Derive `userId` from the authenticated session.
- Never trust a client-provided `userId`.
- Every database query and mutation must be scoped to the authenticated user.
- Verify ownership before reading, updating, linking, or deleting an entity by
  ID.
- Keep database access server-side.
- Validate mutations server-side using Zod.

## Product Acceptance Criteria

- Authentication and setup enforcement work for every protected route.
- Users cannot access another user's data.
- Category and subcategory relationships remain valid.
- Transaction totals are correct for any selected month.
- Imported rows behave like manually created transactions.
- Planned bills do not double-count paid or skipped monthly occurrences.
- Planned income changes projection without inflating actual income before it
  is received.
- Linked existing transactions do not create duplicates.
- Forecast values are deterministic and explainable.
- Total Balance includes completed activity and carries balances across inactive
  months without changing transaction totals or forecasts.
- Balance-adjustment reads and mutations are scoped to the authenticated user.
- Safe to spend is clearly presented as an estimate, not an account balance.
- Currency formatting follows the user's configured currency.
- The app remains responsive and follows `docs/DESIGN_SYSTEM.md`.
