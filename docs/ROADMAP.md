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
- unusually high spending in user-selected categories (future opt-in idea)
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

### 6. Opt-in run-rate warnings for selected categories

Let users choose which expense categories they want to monitor for spending
that is running above its usual pace during the current month. Warnings are
opt-in per category; no category is monitored by default, and users can turn
monitoring off.

Category history is not equally useful for every spending pattern. Regular
groceries may support a meaningful pace comparison, while travel or
entertainment may have many zero-spend months followed by intentional large
purchases. Even recurring utilities can arrive as single monthly payments.
Users decide where pace warnings would be useful rather than the app applying
them universally.

Example:

```text
Food spending is ahead of your usual pace for this point in the month.
```

Rules:

- keep it deterministic
- keep it explainable, showing actual spending and the historical comparison
- warn only for categories the user explicitly selects
- describe recorded spending pace without treating historical spending as a budget
- avoid AI or fuzzy categorization

This remains a roadmap candidate. The selection UI, historical baseline,
minimum history, warning thresholds, and dashboard placement need to be defined
when the feature is selected for implementation.

### 7. Make spending pace easier to understand with month-to-date comparison context

Implemented: the existing above-usual Spending pace warning in Needs Attention
compares actual variable spending so far this month with the approximate amount
at the historical daily pace for the same number of elapsed days including
today. The Spending pace metric stays compact.

Example:

```text
Spending pace is above usual
By day 15, variable spending is €600 versus approximately €450 at your historical pace—33.3% above usual, based on 6 historical months. Active planned-bill categories are excluded.
```

The explanation uses the existing metric's historical baseline,
variable-expense exclusions, percentage difference, and account-local elapsed-day
calculation. It appears only for an above-usual current-month pace and preserves
the warning's urgency order and the six-item attention limit. Historical pace
is descriptive context, not a budget or spending limit. The authenticated
dashboard and fictional public demo use the same explanation.

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
- the dashboard shows planned-income realization using actual received
  transaction amounts against all active planned income for the selected month

### 9. Month-end review

Provide a compact review of a selected completed month that answers: how did
the month finish, what explains the result, and is anything left to record?

Proposed scope:

- actual income, actual expenses, and the recorded monthly surplus or shortfall
- comparison with the previous month, including the category changes that
  explain the difference in expenses and any change in income
- planned bills summarized as paid, skipped, or unhandled, and planned income
  summarized as received, skipped, or unhandled
- unresolved planned items with links into existing record, link-transaction,
  and skip workflows
- links to the selected month's Transactions, Planned Items, and Insights

Illustrative fictional example:

```text
September review
Income: €3,200 | Expenses: €2,750 | Recorded surplus: €450
The surplus fell €180 from August. Income stayed the same.
Expenses increased €180: Travel +€250, Groceries +€50,
Shopping -€70, Utilities -€50; all other categories were unchanged.

Bills: 6 paid, 1 skipped, 1 unhandled
Income: 2 received, 0 skipped, 1 unhandled
Review: Internet €40 due September 12; reimbursement €150 expected September 22.
Record payment/receipt, link an existing transaction, or skip.
```

Rules and boundaries:

- use actual transactions for income and expense totals; unhandled planned
  amounts do not themselves contribute to actual totals, while existing
  transactions count even if they have not been linked to a planned item
- call unresolved items `unhandled`, not `missed` or `unpaid`; the app cannot
  infer whether the user forgot to record a real payment or receipt
- describe changes neutrally, including intentional irregular spending such as
  travel, without treating historical spending as a budget
- let the review reflect later record corrections; a completed calendar month
  does not certify complete tracking or require a formal close-month action
- use existing manual workflows without automatic corrections or matching
- exclude forecast-accuracy reporting from this scope: forecasts are computed
  on demand and not persisted, so a later recalculation cannot establish what
  the user saw earlier in the month

This remains a roadmap candidate, not an active implementation plan. Placement,
comparison eligibility and empty states, and historical planned-item rules for
templates later edited, deactivated, or deleted need to be defined when selected
for implementation. The review requires no notifications or background jobs.

## Recommended Priority Order

Implemented:

1. Replace duplicate `Projected end-of-month net` card with `Daily safe spend`.
2. Keep `Forecast remaining spend` as a compact combined estimate with confidence.
3. Add needs-attention panel.
4. Add link-existing-transaction for planned bills.
5. Add planned income templates and dashboard polish.
6. Add weekly safe-to-spend for the next seven days or the rest of the month.
7. Add overall spending pace against up to six usable historical months.
8. Add planned-income realization with actual-versus-planned amounts.
9. Make spending pace easier to understand with month-to-date comparison context in Needs Attention.

Still open:

1. Add opt-in run-rate warnings for user-selected expense categories.
2. Add month-end review with recorded results, spending-change explanations, and unresolved planned items.

## Product Direction

The app should remain:

- manual-first
- explainable
- single-user
- focused on daily decisions
- not a full budgeting suite yet

These ideas should improve the dashboard’s usefulness without adding bank sync, AI categorization, complex budgets, reserve funds, or background forecasting jobs.
