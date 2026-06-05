# Daily Decision Feature Ideas

## Purpose

The app goal is to help users understand their financial situation well enough to make better daily spending decisions.

The current dashboard already shows actual income, actual expenses, net left, forecast remaining spend, and safe to spend. However, some metrics are redundant or not actionable enough for daily use.

This document collects proposed improvements so they can be refined before implementation.

## Current Issue

`Safe to spend` and `Projected end-of-month net` currently use equivalent formulas:

```text
netLeftNow = incomeSoFar - expenseSoFar
safeToSpend = netLeftNow - forecastRemainingSpend
projectedEndOfMonthNet = incomeSoFar - (expenseSoFar + forecastRemainingSpend)
```

Because `netLeftNow` is `incomeSoFar - expenseSoFar`, both values resolve to the same number.

The labels are different:

- `Safe to spend` is a daily decision number.
- `Projected end-of-month net` is framed as the likely month-end result.

But under the current simple forecast model, showing both is redundant.

## Highest-Value Dashboard Updates

### 1. Replace the duplicate projected net card

Keep `Safe to spend` as the headline planning metric.

Decision: replace `Projected end-of-month net` with `Daily safe spend`.

Suggested dashboard metric set:

```text
Net left now
Safe to spend
Daily safe spend
Forecast remaining spend
```

`Forecast remaining spend` should show `Reserved planned bills` and `Variable spend estimate` as supporting breakdown values rather than separate top-level cards.

### 2. Add daily safe spend

Add a practical daily number:

```text
dailySafeSpend = safeToSpend / remainingDaysIncludingToday
```

Example:

```text
Safe to spend: €240
Days left: 12
Daily safe spend: €20/day
```

This helps the user translate the monthly forecast into a daily spending decision.

Rules:

- include today in the remaining-day count
- show negative values when safe-to-spend is negative
- show non-actionable completed-month copy for past months

### 3. Add a forecast breakdown

Make `Forecast remaining spend` explainable.

Show:

```text
Forecast remaining spend: €844.12
- Reserved planned bills: €143.99
- Estimated variable spending: €700.13
```

This helps the user understand whether the pressure comes from known upcoming bills or everyday variable spending.

### 4. Add a needs-attention section

Add a compact daily decision panel with items like:

- overdue planned bills
- planned bills due today
- safe-to-spend is negative
- unusually high category spending
- missing expected income
- no transactions entered for several days

This should be more useful than adding more metric cards.

### 5. Improve planned bill handling further

The current paid/skipped state prevents planned bills from being double-counted in forecast.

A next improvement should support users who already created a manual transaction:

- link an existing transaction to a planned bill
- show `Paid from transaction`
- show generated planned-bill transactions clearly
- help prevent accidental duplicate rent/payment entries

## Useful New Features

### 6. Category run-rate warnings

Show when a category is trending higher than usual.

Example:

```text
Food spending is 28% higher than your recent monthly average.
```

Rules:

- keep it deterministic
- keep it explainable
- avoid AI or fuzzy categorization

### 7. Month progress context

Compare month progress to spending progress.

Example:

```text
45% of the month passed
62% of expected spending used
```

This quickly tells the user if they are ahead or behind pace.

### 8. Manual expected income

Recurring income is currently out of scope, but a simple manual expected-income feature could be useful.

Possible behavior:

- user enters expected income for the selected month
- user can mark it received
- expected income affects planning only when explicitly entered
- received income should become or link to a normal income transaction

This would also make `Projected end-of-month net` meaningfully different from `Safe to spend`.

### 9. Month-end review

At the end of each month, show:

- actual income
- actual expenses
- planned bills paid/skipped/missed
- top spending categories
- variance from forecast

This helps the user build trust in the forecast and correct next-month planning inputs.

### 10. Data completeness indicator

Manual tracking depends on consistent data entry.

Show signals like:

```text
Last transaction entered: 4 days ago
Forecast may be less accurate
```

This helps prevent the user from over-trusting stale data.

## Recommended Priority Order

1. Replace duplicate `Projected end-of-month net` card with `Daily safe spend`.
2. Add forecast breakdown to `Forecast remaining spend`.
3. Add needs-attention panel.
4. Add link-existing-transaction for planned bills.
5. Add category run-rate warnings.
6. Add manual expected income.

## Product Direction

The app should remain:

- manual-first
- explainable
- single-user
- focused on daily decisions
- not a full budgeting suite yet

These ideas should improve the dashboard’s usefulness without adding bank sync, AI categorization, complex budgets, reserve funds, or background forecasting jobs.
