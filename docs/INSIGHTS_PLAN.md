# Insights V1 Implementation Plan

## Goal

Add a focused historical spending workspace that helps users compare one
expense category with its own recent completed-month behavior. Insights remains
descriptive: it explains what happened without creating a category budget or
claiming that historical headroom is safe to spend.

## Locked behavior

- `/insights` is an authenticated, setup-gated App Router page.
- The page analyzes one user-owned expense category at a time, including
  archived categories that still provide historical context.
- URL parameters are `categoryId` and `period`. Supported periods are 3, 6, and
  12 completed months; 6 is the default.
- The selected period means the requested number of completed calendar months
  plus the current account-local month shown as an incomplete comparison.
- If `categoryId` is missing or invalid, keep the disabled `Select category`
  option selected and show a category-selection empty state. Do not calculate
  or display insights until the user chooses a valid category.
- Typical monthly spend is the median category spend across available completed
  months in the selected period. Months from the category's creation month
  onward count, including zero-spend months. The current month never contributes
  to the median.
- Fewer than three available completed months is labeled `Limited history`;
  one or two months still produce a transparent median, while zero months make
  the typical comparison unavailable.
- Monthly values use actual transactions only. All aggregation uses Prisma
  `Decimal`; numeric conversion is restricted to chart display data.
- Each monthly row shows selected-category spend, total actual expense, and
  actual net. The current row is labeled `In progress`; completed rows use
  `Month-end net` context.
- Every monthly row links to `/transactions` with `month`, `type=EXPENSE`, and
  `categoryId` filters.

## Page composition

1. `Insights` heading.
2. Compact GET controls for category and comparison period.
3. `Spending trends` card with a monthly bar chart; the current month is visibly
   incomplete.
4. Three metrics: Typical month, This month, and Compared with typical.
5. Responsive monthly-history table/cards with transaction drill-down links.

## Out of scope

- Category budgets or allocations
- Forecasted category spending or category run-rate warnings
- Prescriptive recommendations
- Arbitrary side-by-side month comparison
- Cross-category rankings, typical ranges, or income insights
