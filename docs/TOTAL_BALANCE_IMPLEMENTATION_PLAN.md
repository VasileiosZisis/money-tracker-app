# Total Balance Implementation Plan

## Summary

Add a `Total Balance` area to the dashboard before `Monthly Snapshot`.

The feature shows cumulative ending balances for completed months. It supports
predefined graph periods, custom full-month or full-year periods, and manually
adding money that should affect balance without being counted as income.

This feature is separate from the daily-decision feature plan. It introduces a
historical balance view, not a bank-synced account balance or reconciliation
system.

## Locked Implementation Decisions

- The dashboard page heading becomes `Dashboard`.
- `Total Balance` is the first dashboard section.
- The existing month-specific dashboard content is grouped under a separate
  `Monthly Snapshot` section after Total Balance.
- Total Balance period controls remain independent from the Monthly Snapshot
  month control, including across redirects after dashboard mutations.
- Balance-adjustment create, edit, and delete workflows follow the project's
  existing inline, query-parameter-driven CRUD pattern.
- V1 does not add a new dialog primitive solely for balance adjustments.
- Unit tests use Node's built-in test runner through the existing `tsx`
  dependency.
- Add an `npm test` script for the focused balance-helper tests; do not add a
  separate test framework dependency for V1.

## Product Definition

### Balance Formula

For any completed month:

```text
endingBalance = balanceAdjustmentsToDate + incomeToDate - expensesToDate
```

For a selected period:

```text
startingBalance = ending balance at the end of the month before the period
netChange = incomeInPeriod - expensesInPeriod + balanceAdjustmentsInPeriod
endingBalance = startingBalance + netChange
```

Rules:

- Actual income and expenses continue to come only from transactions.
- Balance adjustments affect Total Balance but do not affect monthly income,
  expense totals, planned income, safe-to-spend, or forecast calculations.
- Money calculations use Prisma `Decimal`; never use floating-point arithmetic.
- A month with no activity still produces a monthly graph point carrying the
  previous ending balance forward.
- Negative ending balances are valid and must remain visible.

### Completed-Period Rules

- Total Balance reports completed months only.
- The current month and future months are excluded.
- The latest possible cutoff is the final day of the previous month.
- A custom month period uses complete inclusive months.
  - Example: February 2026 through August 2026 means February 1 through August 31.
- A custom year period uses complete calendar years.
  - Example: 2024 through 2025 means January 2024 through December 2025.
- The current incomplete year cannot be selected as a complete custom year.
- If there are no completed months in the requested range, show an empty state
  rather than using partial current-month data.

### Selected-Period Summary

For every selected period, show:

- `Starting balance`
- `Net change`
- `Ending balance`
- monthly ending-balance graph points inside the selected period

The selected range controls the visible summary and graph. It does not reset
the cumulative balance at the beginning of the range. Activity before the
selected start month remains part of the starting balance.

## Graph And Period Controls

### Graph

- Y axis: cumulative ending balance.
- X axis: completed months.
- Default range: completed months in the current calendar year.
- Do not plot the current incomplete month.
- Plot one point per month, including months with no transactions or balance
  adjustments.
- Format axis values and tooltips with the user's configured currency.
- Tooltips should show month and ending balance.
- The chart must support positive, zero, and negative balances.

### Presets

Support these deterministic range presets:

- `Current year`
- `Last 3 months`
- `Last 6 months`
- `Last 9 months`
- `Last 12 months`
- `Previous 1 full year`
- `Previous 2 full years`
- `Previous 3 full years`
- `All time`
- `Custom`

Preset definitions:

- `Current year`: January through the latest completed month of the current year.
- `Last N months`: the latest N completed months, excluding the current month.
- `Previous N full years`: the previous N complete calendar years, excluding
  the current year.
- `All time`: the earliest transaction or balance-adjustment month through the
  latest completed month.

`Last 12 months` and `Previous 1 full year` are intentionally different:

- `Last 12 months` is a trailing completed-month window.
- `Previous 1 full year` is the previous complete January-December year.

### Custom Period

Provide a segmented period mode:

- `Months`
- `Years`

Month mode:

- start month input using `YYYY-MM`
- end month input using `YYYY-MM`
- inclusive boundaries
- end month cannot be current or future

Year mode:

- start year input
- end year input
- inclusive calendar-year boundaries
- only completed calendar years are valid

Validation:

- start must be before or equal to end
- invalid or unavailable periods show an actionable error
- changing Total Balance period must not change the dashboard Monthly Snapshot
  selected month

Use independent dashboard query parameters, for example:

```text
balanceRange=current-year
balanceStart=2026-02
balanceEnd=2026-08
balanceMode=months
```

## Balance Adjustments

### Purpose

Balance adjustments represent money that should be included in the user's
historical balance without being reported as transaction income. The primary
V1 use case is adding an opening balance or previously untracked money.

The dashboard command can be labeled `Add money`, while the underlying domain
model remains `BalanceAdjustment`.

### Data Model

Add a Prisma model:

```prisma
model BalanceAdjustment {
  id             String   @id @default(cuid())
  userId         String
  amount         Decimal  @db.Decimal(14, 2)
  effectiveMonth String   // YYYY-MM
  note           String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, effectiveMonth])
}
```

Add:

```prisma
User.balanceAdjustments BalanceAdjustment[]
```

V1 rules:

- `amount` must be positive.
- `effectiveMonth` must be valid `YYYY-MM`.
- Add Money uses completed months only so its effect is visible in the
  completed-month balance history.
- `note` is optional.
- Adjustments are user-owned and every query/mutation is scoped to the
  authenticated `userId`.
- Adjustments can be edited or deleted so users can correct mistakes.
- Negative/debit adjustments are not part of V1 and require an explicit future
  product decision.

### Server Actions And Validation

Add validators under `lib/validators/balance-adjustment.ts` for:

- create adjustment
- update adjustment
- delete adjustment
- balance range/query parameters

Add server actions under `actions/balance-adjustments.ts`:

- `listBalanceAdjustments`
- `createBalanceAdjustment`
- `updateBalanceAdjustment`
- `deleteBalanceAdjustment`

Rules:

- derive `userId` from the authenticated session
- never accept client-provided ownership
- validate money as a positive decimal string
- validate completed-month boundaries server-side
- verify ownership before update or delete
- revalidate `/dashboard` after successful mutations

## Balance Calculation Layer

Add focused helpers under `lib/balance/`.

Recommended interfaces:

```ts
type BalanceRangePreset =
  | "current-year"
  | "last-3-months"
  | "last-6-months"
  | "last-9-months"
  | "last-12-months"
  | "previous-1-year"
  | "previous-2-years"
  | "previous-3-years"
  | "all-time"
  | "custom"

type BalancePeriod = {
  startMonth: string
  endMonth: string
}

type MonthlyEndingBalance = {
  month: string
  endingBalance: Prisma.Decimal
}

type TotalBalanceSummary = {
  period: BalancePeriod
  startingBalance: Prisma.Decimal
  netChange: Prisma.Decimal
  endingBalance: Prisma.Decimal
  monthlyBalances: MonthlyEndingBalance[]
}
```

Calculation responsibilities:

- resolve presets into inclusive completed-month ranges
- resolve custom month/year input into a `BalancePeriod`
- determine the earliest all-time month from transactions and adjustments
- calculate the cumulative starting balance before the selected range
- aggregate income, expenses, and adjustments by month
- carry balances across months with no activity
- round monetary outputs consistently to two decimal places
- return deterministic output independent of dashboard rendering

The implementation should favor explainable server-side aggregation. If raw SQL
is used for grouped monthly sums, parameters must remain user-scoped and money
must remain numeric/Decimal-safe.

## Dashboard Data

Extend dashboard loading with a separate Total Balance query path.

Requirements:

- Total Balance period selection is independent from the existing Monthly
  Snapshot selected month.
- Load only the authenticated user's transactions and balance adjustments.
- Return `TotalBalanceSummary` and the resolved range/preset to the page.
- Preserve existing dashboard forecast, planned bill, planned income, and
  attention-item behavior.
- A balance adjustment must not be included in dashboard transaction totals or
  forecast inputs.

## Dashboard UI

Place the new `Total Balance` section immediately before `Monthly Snapshot`.

Recommended composition:

- Page heading: `Dashboard`
- Section heading: `Total Balance`
- Primary value: selected-period ending balance
- Supporting values:
  - starting balance
  - net change
- Period preset control
- Custom period controls when `Custom` is selected
- Ending-balance line chart
- `Add money` command
- adjustment management access for edit/delete

After the Total Balance section, render a distinct `Monthly Snapshot` heading
with its existing month selector and dashboard content. Changing either
section's period must preserve the other section's query parameters.

Empty states:

- No historical activity:
  - title: `No completed balance history yet`
  - explain that completed transactions or an opening balance will create the
    first monthly balance point
- Current year has no completed month:
  - show a completed-period empty state without plotting current-month data
- No activity in the visible period:
  - still show carried monthly ending balances if a starting balance exists

Add Money form:

- amount
- effective month
- optional note
- default effective month: latest completed month
- show that the amount affects Total Balance but is not counted as income

Interaction pattern:

- use inline create, edit, and delete forms consistent with the existing
  planned-item pages
- use query parameters to open or close adjustment editing state
- preserve the selected Total Balance period and Monthly Snapshot month while
  opening, submitting, or closing adjustment forms
- do not introduce a dialog component solely for this feature

Use existing dashboard cards, inputs, selects, dialogs, buttons, chart patterns,
currency formatting, and design tokens. Do not create a second visual system.

## Milestones And Tasks

### Milestone 1: Domain And Schema

- Lock the balance and selected-period formulas.
- Add `BalanceAdjustment` and the `User` relation.
- Add migration and regenerate Prisma Client.
- Add Zod validators for adjustments and periods.

### Milestone 2: Server Actions

- Implement list/create/update/delete adjustment actions.
- Enforce authentication, ownership, completed-month validation, and Decimal
  handling.
- Revalidate dashboard data after mutations.

### Milestone 3: Balance Helpers

- Implement completed-month utilities.
- Implement preset and custom-period resolution.
- Implement cumulative monthly balance aggregation.
- Implement starting balance, net change, and ending balance calculations.
- Add focused unit tests before connecting the dashboard.

### Milestone 4: Dashboard Data

- Parse independent Total Balance query parameters.
- Load balance inputs and compute `TotalBalanceSummary` server-side.
- Keep Monthly Snapshot and forecast selection behavior unchanged.

### Milestone 5: Dashboard UI

- Rename the page heading to `Dashboard`.
- Add Total Balance before Monthly Snapshot.
- Add a distinct `Monthly Snapshot` section heading around the existing
  month-specific dashboard content.
- Render summary values and the monthly ending-balance chart.
- Add preset and custom month/year controls.
- Add empty, invalid-period, loading, and negative-balance states.

### Milestone 6: Add Money And Adjustment Management

- Add the inline Add Money form.
- Add inline, query-parameter-driven edit and delete controls for existing
  adjustments.
- Explain that adjustments affect balance without becoming income.

### Milestone 7: Documentation And Verification

- Update `README.md`.
- Update `docs/TECH_DECISIONS.md` with the locked balance model.
- Update relevant route/dashboard documentation.
- Run automated and manual verification.

## Public Interfaces And Types

- New Prisma model: `BalanceAdjustment`.
- New user relation: `User.balanceAdjustments`.
- New server actions for balance-adjustment CRUD.
- New validators for adjustments and completed-period filters.
- New `lib/balance` helpers and summary types.
- Dashboard data gains a Total Balance summary and resolved period metadata.
- Dashboard query parameters gain independent balance-range controls.

## Test Plan

### Unit Tests

Use Node's built-in test runner through `tsx`. Add a project `npm test` script
that runs the focused balance-helper tests without introducing another test
framework dependency.

- ending balance equals cumulative adjustments plus income minus expenses
- starting balance includes all activity before the selected period
- net change includes only activity inside the selected period
- ending balance equals starting balance plus net change
- current month is excluded
- future months are excluded
- last 3/6/9/12 month presets resolve correctly across year boundaries
- previous 1/2/3 full-year presets resolve correctly
- current-year preset stops at the latest completed month
- custom month ranges are inclusive
- custom year ranges use January-December boundaries
- invalid reversed ranges are rejected
- months without activity carry the previous balance forward
- negative balances remain negative
- all-time starts at the earliest transaction or adjustment month

### Server Action Tests Or Manual Verification

- create a positive balance adjustment
- reject zero or negative adjustments
- reject malformed or current/future effective months
- edit adjustment amount, month, and note
- delete an adjustment
- reject access to another user's adjustment
- adjustment changes Total Balance
- adjustment does not change income total, expense total, safe-to-spend,
  planned income, or forecast remaining spend

### Dashboard Scenarios

- Total Balance renders before Monthly Snapshot
- default graph shows completed current-year months
- current month is absent from the graph
- all presets show the correct boundaries
- custom February-August range uses complete inclusive months
- custom full-year range uses complete calendar years
- summary shows starting balance, net change, and ending balance
- graph includes zero-activity months
- graph renders positive and negative balances
- currency formatting follows the user's configured currency
- Add Money creates a visible balance change for its effective completed month
- Monthly Snapshot month selection remains independent

### Expected Project Checks

```powershell
cmd /c npx prisma migrate dev --name add_balance_adjustments
cmd /c npx prisma generate
cmd /c npm test
cmd /c npx tsc --noEmit --pretty false
cmd /c npm run lint
```

## Assumptions

- Total Balance is a calculated ledger view, not a bank-synced balance.
- The app has one combined balance per user, not separate bank accounts.
- Only completed months are reportable in V1.
- Balance adjustments are separate from transactions and forecasts.
- Add Money creates positive adjustments only in V1.
- The chart is monthly; daily balance reporting is out of scope.
- Transfers, reconciliation, separate accounts, liabilities, and negative/debit
  adjustments are out of scope unless explicitly requested later.
