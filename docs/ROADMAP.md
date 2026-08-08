# Daily Decision Feature Ideas

## Purpose

The app goal is to help users understand their financial situation well enough to make better daily spending decisions.

The current dashboard shows actual income, actual expenses, net left, safe to spend, daily and weekly safe spend, spending pace, forecast remaining spend, planned bills, planned income, and needs-attention signals.

This document records the daily-decision improvements that guided the current dashboard and the next ideas that remain open.

## Historical Issue

`Safe to spend` and `Projected end-of-month net` used to rely on equivalent formulas:

```text
netLeftNow = incomeSoFar - expenseSoFar
safeToSpend = netLeftNow - forecastRemainingSpend
projectedEndOfMonthNet = incomeSoFar - (expenseSoFar + forecastRemainingSpend)
```

Before planned income existed, `netLeftNow` was `incomeSoFar - expenseSoFar`, so both values resolved to the same number.

The labels are different:

- `Safe to spend` is a daily decision number.
- `Projected end-of-month net` is framed as the likely month-end result.

Under that older forecast model, showing both as top-level cards was redundant. The dashboard now keeps `Safe to spend` as the conservative decision metric and shows `Projected net left` as secondary Monthly Snapshot context because pending planned income makes it meaningfully different.

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

`Forecast remaining spend` is shown as one combined amount with current-month confidence. Its reserved-bill and variable-spending component amounts are not displayed beneath the metric.

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

### 3. Keep forecast remaining spend compact

Decision changed: show `Forecast remaining spend` as one combined estimate with
its confidence badge. Do not display reserved planned bills or estimated
variable spending as supporting breakdown amounts beneath the metric.

### 4. Add a needs-attention section

Add a compact daily decision panel with items like:

- overdue planned bills
- planned bills due today
- safe-to-spend is negative
- unusually high category spending
- missing expected income
- no transactions entered for several days

This should be more useful than adding more metric cards.

Decision: V1 is a read-only dashboard panel placed after the planning metric
cards. It shows up to six deterministic signals in urgency order:

- overdue planned bills
- planned bills due today
- negative safe-to-spend
- current-month spending pace above its historical baseline
- stale transaction entry history
- low forecast confidence

Planned-bill actions stay in the existing planned bills panel for now.

Forecast confidence is deterministic and based on the usable full months that
feed the variable-spending estimate: Low for 0-2 months, Medium for 3-5, and
High for 6 or more. Only Low confidence creates a Needs Attention signal.

### 5. Improve planned bill handling further

The current paid/skipped state prevents planned bills from being double-counted in forecast.

A next improvement should support users who already created a manual transaction:

- link an existing transaction to a planned bill
- show `Paid from transaction`
- show generated planned-bill transactions clearly
- help prevent accidental duplicate rent/payment entries

Decision: V2b adds explicit manual linking from a monthly planned-bill
occurrence to an existing expense transaction. The user chooses the transaction;
the app does not auto-match. Paid planned bills distinguish app-created
transactions from linked existing transactions so undo behavior can keep totals
consistent.

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

### 8. Planned income templates

Decision: add planned income as the income-side equivalent of planned bills.

Planned income should use reusable monthly templates plus selected-month
occurrence state:

- user creates expected income once, such as salary
- active planned income appears each month as pending until received or skipped
- user can mark planned income received, which creates a normal income transaction
- user can link an existing income transaction instead of creating a duplicate
- pending planned income affects projection only, not actual totals
- pending planned income does not increase conservative safe-to-spend

This makes `Projected end-of-month net` meaningfully different from `Safe to spend`:

```text
projectedEndOfMonthNet = netLeftNow + pendingPlannedIncome - forecastRemainingSpend
safeToSpend = netLeftNow - forecastRemainingSpend
```

V1b dashboard polish:

- overdue planned income appears in Needs attention
- planned income expected today appears in Needs attention
- if safe-to-spend is negative while income is still pending, the dashboard explains that pending income is not counted as safe-to-spend until received
- planned income summary shows pending total, received total, skipped count, and next pending income
- link transaction options show deterministic hints such as exact amount, same category, and same subcategory
- link hints are labels only; they do not auto-match or auto-link transactions

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

Implemented:

1. Replace duplicate `Projected end-of-month net` card with `Daily safe spend`.
2. Keep `Forecast remaining spend` as a compact combined estimate with confidence.
3. Add needs-attention panel.
4. Add link-existing-transaction for planned bills.
5. Add planned income templates and dashboard polish.
6. Add weekly safe-to-spend for the next seven days or the rest of the month.
7. Add overall spending pace against up to six usable historical months.

Still open:

1. Add category run-rate warnings.
2. Add month progress context.
3. Add month-end review.
4. Add a richer data completeness indicator if the current stale-entry signal is not enough.

## Product Direction

The app should remain:

- manual-first
- explainable
- single-user
- focused on daily decisions
- not a full budgeting suite yet

These ideas should improve the dashboard’s usefulness without adding bank sync, AI categorization, complex budgets, reserve funds, or background forecasting jobs.
