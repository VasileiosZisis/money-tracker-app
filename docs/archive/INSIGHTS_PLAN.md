# Insights Implementation Plan

## Status

Insights V1 and roadmap items 3 through 8 are implemented. The page provides
account-wide monthly result and break-even analysis, completed-period spending
composition, equal-window change drivers, income and spending consistency,
unusual-month investigation, year-over-year patterns, and optional
category-level monthly spending trends and comparisons.

This completed plan is archived as a record of the implemented Insights work.
It is no longer an active source of implementation scope; future additions must
be selected from the roadmap and documented in a new active plan when needed.

## Goal

Build a focused historical analysis workspace that helps users understand:

- what happened to their income, spending, and monthly result
- how those values changed over time
- which categories contributed to a change
- whether a month or category followed the user's usual pattern
- how large a recurring shortfall is before the user decides what to change

Insights remains descriptive. It explains past behavior without turning
historical spending into a budget, a recommendation, or an amount that is safe
to spend.

## Product boundary

Use this test when deciding whether a feature belongs on Insights:

- If it explains what happened, how it changed, or what contributed to it, it
  belongs on Insights.
- If it asks the user to choose what should happen next, it belongs in a future
  `Spending Plan` workspace.
- If it helps the user act during the current month, it generally belongs on
  the Dashboard.
- If it lets the user inspect or edit individual records, it belongs on
  Transactions.

Insights may later provide a contextual `Create a spending plan` action, but it
must not contain editable category targets, budget allocations, envelopes, or
automatic prescriptions. A historically low-spending month is evidence, not a
recommended target.

The intended product loop is:

```text
Observe -> Understand -> Decide -> Act -> Review
Insights                  Spending Plan   Dashboard   Insights
```

## Roadmap overview

1. Monthly spending trend - implemented
2. Category comparison - implemented
3. Monthly result and break-even analysis - implemented
4. Spending composition - implemented
5. Drivers of change - implemented
6. Income and spending consistency - implemented
7. Unusual months with transaction drill-down - implemented
8. Longer-term patterns when sufficient history exists - implemented

These are capabilities, not necessarily eight permanent page sections. Related
capabilities should share controls and visualizations where that produces a
clearer page. Contextual observations should only render when relevant.

## Implemented foundation

### 1. Monthly spending trend

- `/insights` is an authenticated, setup-gated App Router page.
- The page analyzes one user-owned expense category at a time, including
  archived categories that still provide historical context.
- URL parameters are `categoryId` and `period`. Supported periods are 3, 6, and
  12 completed months; 6 is the default.
- The selected period means the requested number of completed calendar months
  plus the current account-local month shown as an incomplete comparison.
- If `categoryId` is missing or invalid, keep the disabled `Select category`
  option selected and show a category-selection empty state.
- The chart shows actual selected-category spending by month. The current month
  is visually quieter and marked as in progress.

### 2. Category comparison

- Typical monthly spend is the median category spend across available completed
  months in the selected period.
- Months from the category's creation month onward count, including zero-spend
  months. The current month never contributes to the median.
- Fewer than three available completed months is labeled `Limited history`.
  One or two months still produce a transparent median; zero months make the
  typical comparison unavailable.
- Summary metrics show Typical month, This month, and Compared with typical.
- Monthly context shows selected-category spend, total actual expense, and
  actual net.
- Every monthly row links to `/transactions` with `month`, `type=EXPENSE`, and
  `categoryId` filters.

## Selected implementation milestones

### Roadmap item 3: Monthly result and break-even analysis - implemented

Purpose: show whether the user's overall monthly cashflow is usually positive
or negative and quantify a recurring shortfall without prescribing a solution.

Include:

- actual monthly income, expenses, and result
- positive-month and negative-month counts for the selected completed period
- a typical completed-month result
- a break-even gap when the typical result is negative
- the current month as clearly incomplete context, excluded from the completed-
  month baseline

The monthly result is actual income minus actual expense. The break-even gap is
the amount required to bring a negative typical monthly result to zero. It must
be presented as diagnostic context, not as a required spending cut and not as a
replacement for Safe to spend.

Data requirement: at least one completed month can produce a result. Fewer than
three completed months must retain limited-history context.

### Roadmap item 4: Spending composition - implemented

Purpose: answer where the user's money went during the selected period.

Include:

- expense totals by category
- each category's share of actual expenses
- a ranked but neutral presentation of the largest contributors
- archived categories when they contain activity in the selected period

Composition uses actual expense transactions only. It must not imply that a
large category is automatically problematic.

Data requirement: at least one expense transaction in the selected period.
Otherwise, show a focused empty state rather than a zero-filled chart.

Implemented behavior:

- composition uses the selected 3, 6, or 12 completed months and excludes the
  current incomplete month
- it remains visible without a category selection and is not filtered by the
  optional category control
- all categories with spending are shown in descending total order, with
  alphabetical tie-breaking and no `Other` grouping
- totals use Decimal arithmetic and percentage shares are displayed to one
  decimal place
- archived categories with activity remain visible and categories without
  activity are omitted
- the presentation uses neutral horizontal bars with visible totals and shares

### Roadmap item 5: Drivers of change - implemented

Purpose: explain which categories contributed to an increase or decrease in
total spending between comparable periods.

Include:

- the total expense change between the two periods
- signed per-category change, ranked by absolute magnitude
- each category's contribution to the overall change
- clear handling of categories that appear in only one comparison period

The periods must be comparable and complete. Current partial-month data must not
be compared directly with a completed month unless the UI explicitly labels a
same-stage comparison. Initial implementation should prefer completed periods.

Data requirement: both consecutive equal-length periods must begin on or after
the user's first recorded activity. At least one period must contain actual
expense activity to show category drivers.

Implemented behavior:

- `changeWindow=1|3|6` compares the latest completed months with the
  immediately preceding equal-length period; 3 months is the default, with a
  fallback to 1 month when 3 months is not yet eligible
- in month-to-month mode, `changeMonth=YYYY-MM` selects the newer month and the
  prior calendar month is derived automatically; missing or invalid values
  default to the latest eligible pair
- the month-to-month selector exposes the latest eleven valid pairs from the
  bounded twelve-completed-month history, newest first; 3- and 6-month windows
  ignore `changeMonth` and remain pinned to the latest completed month
- 6 months becomes available only after twelve completed tracked months; the
  current incomplete month is always excluded
- Drivers is independent of the shared 3, 6, or 12-month Insights period; the
  shared user-scoped query covers the latest twenty-four completed months plus
  the current month, while Drivers applies its own twelve-month boundary
- comparisons begin only when both periods are on or after the user's first
  recorded activity; later zero-expense months remain part of the averages
- period totals are divided by the selected window length with Decimal
  arithmetic; signed category changes and contribution percentages compare
  average monthly expenses, and contribution is unavailable when the overall
  average change is zero
- changed categories are sorted by absolute change, categories present on only
  one side use zero for the other side, and archived categories remain visible
- the category-independent presentation shows both date ranges, compact
  monthly averages, and neutral zero-centered horizontal change bars

### Roadmap item 6: Income and spending consistency - implemented

Purpose: distinguish stable patterns from irregular income or expenses and help
explain whether negative results come from lower income, higher spending, or
both.

Include:

- typical income and typical total spending
- observed ranges across completed months
- neutral consistency or variability context
- category-level variability where it adds useful detail

Consistency must be deterministic, explainable, and robust to outliers. Labels
must describe variation without judging it as good or bad.

Data requirement: at least three completed months. With less history, keep the
section unavailable rather than assigning a stability label.

Implemented behavior:

- consistency uses the selected 3, 6, or 12 completed months, beginning no
  earlier than the user's first recorded activity and excluding the current
  incomplete month
- typical income and spending use Decimal-safe medians; the observed range and
  linearly interpolated lower and upper quartiles remain visible context
- quartile variation is `(Q3 - Q1) / (Q3 + Q1)`: at most 10% is Low, over 10%
  through 25% is Moderate, and above 25% is High
- a zero middle-half range with some activity is Intermittent; a history made
  entirely of zeroes is labeled as no recorded income or spending
- negative-result months are classified as below-typical income only,
  above-typical spending only, both patterns, or neither pattern
- the category-independent card uses neutral labels and reuses the existing
  user-scoped transaction result without another query
- category-level variability is deferred to later pattern analysis

### Roadmap item 7: Unusual months and investigation - implemented

Purpose: call attention to months that differ meaningfully from the user's own
history and make their cause easy to investigate.

Include contextual observations such as:

- an unusually high or low total-expense month
- an unusually high or low category month
- a month with an unusually low income or monthly result
- a restrained link to Transactions with the relevant month, type, category,
  and subcategory filters where applicable

Detection must use a documented deterministic rule. It must not use AI, hidden
scoring, or prescriptive language. The exact threshold and minimum sample size
must be locked in the implementation specification before coding.

Data requirement: enough completed history to establish the selected rule's
baseline. Until that threshold is met, omit unusual-month claims.

Implemented behavior:

- the card uses the shared 3, 6, or 12 completed-month period, begins no earlier
  than first account activity, excludes the current incomplete month, and stays
  independent of the optional category selection and Drivers controls
- detection requires at least six eligible completed months and uses strict
  Tukey fences at `Q1 - 1.5 x IQR` and `Q3 + 1.5 x IQR`, with linearly
  interpolated quartiles
- a fence-crossing value must also differ from its Decimal median by at least
  25%; when that median is zero, any non-zero fence-crossing difference is
  material
- total expenses may be identified as unusually high or low; income and monthly
  result only produce low findings; expense categories may produce high or low
  findings after at least six eligible months and three months with activity
- category history starts no earlier than account tracking and the category's
  account-local creation month, retains later zero-spend months, and includes
  archived categories with qualifying activity
- findings are grouped newest first, show actual and typical amounts with
  neutral labels, and link to the applicable Transactions month, type, and
  category filters
- insufficient history and a sufficient history with no findings use distinct
  focused empty states; no AI scoring, prescriptions, persistence, extra query,
  route handler, or client-side fetch is added

### Roadmap item 8: Longer-term patterns - implemented

Purpose: reveal durable changes that are difficult to see in a short monthly
window.

Potential supported comparisons include:

- recent year versus the previous year
- sustained category increases or decreases across several successive windows
- recurring seasonal patterns across comparable years

Only show a comparison when both sides contain sufficient completed history.
Seasonal or year-over-year claims require at least two comparable annual periods.
Shorter histories should use the existing Drivers equal-window comparison and
3, 6, and 12-month views without extrapolating a long-term pattern.

Implemented behavior:

- the first long-term comparison uses the latest twelve completed months versus
  the immediately preceding twelve completed months; it is independent of the
  shared period, optional category, and Drivers controls
- both complete trailing years must begin on or after first account activity;
  later zero-activity months remain included and the current month is excluded
- annual income, expenses, and result use actual transactions and Decimal
  totals; income and spending include signed amount and percentage changes,
  while result uses a signed amount only
- percentage change is unavailable when the previous total is zero
- every category with a non-zero tracked annual spending change is ranked by
  absolute change with alphabetical tie-breaking; archived and one-sided
  categories remain visible
- category totals begin at the account-local creation month; categories without
  two full tracked years are labeled `Partial history` and omit percentage
  change without hiding their recorded contribution
- the presentation uses compact annual summary panels followed by neutral
  zero-centered category bars; insufficient account history and unchanged
  category totals have distinct states
- the existing authenticated query expands to twenty-four completed months plus
  current, with no schema, persistence, route handler, Server Action, or client
  fetch changes

Sustained successive-window and seasonal pattern detection remain future
enhancements rather than part of this first longer-term implementation.

## Shared data and calculation rules

- Use actual transactions only unless a future milestone explicitly states
  otherwise.
- Scope every query to the authenticated user.
- Use the user's IANA time zone for current-month and completed-month boundaries.
- Aggregate money with Prisma `Decimal`; convert to JavaScript numbers only for
  serialized chart display data.
- Keep the current incomplete month visually and mathematically distinct from
  completed-month baselines.
- Include archived categories when they contain relevant historical activity.
- Do not turn missing data into a zero unless a zero-spend month is valid under
  the specific metric's documented rules.
- Prefer medians or another explicitly documented robust baseline when a
  `typical` value could be distorted by outliers.
- Label limited history and unavailable comparisons directly.
- Every claim shown to the user must be reproducible from visible data and a
  deterministic calculation.

## Page composition

The contextual app bar provides the page identity. The content uses peer,
Dashboard-style analysis sections without a repeated page title or duplicated
card titles, while retaining a visually hidden `Insights` level-one heading for
assistive navigation:

1. Monthly result
2. Spending composition
3. Income and spending consistency
4. Unusual months
5. Category Spending Trends
6. Drivers of change
7. Year-over-year patterns

The URL-backed History Period control sits directly below Monthly result and
applies to the first four sections plus Category Spending Trends. Each affected
shared-period card shows its exact completed-month range immediately beside a
left-aligned `History Period:` label with the same card-title styling. The range
is not repeated outside the card, and the header remains on the same row as its
legend, total, or completed-month count. Drivers and Year-over-year omit that shared-
period label because their comparison periods are independent. The Expense
category control sits directly below Category Spending Trends and affects only
its trend, three comparison metrics, and monthly history. Drivers keeps its own
comparison controls, and Year-over-year keeps its fixed trailing-year ranges.
Every form preserves the other effective Insights selections.

Responsive behavior, card hierarchy, chart colors, money typography, and empty
states continue to follow `docs/DESIGN_SYSTEM.md`.

## Explicitly outside the Insights page

- Category budgets, limits, allocations, or envelopes
- Editable spending targets
- Automatically selecting targets from historical lows
- Prescriptive recommendations about what the user should cut
- Safe-to-spend or forecast calculations
- Transaction creation, editing, or deletion
- Category management
- AI-generated explanations or anomaly detection

Those boundaries do not prevent Insights from describing a break-even gap or
linking to a future Spending Plan. They prevent the analysis workspace from
becoming the planning or execution workspace itself.

## Implementation status

The selected Insights roadmap is implemented through item 8. Future additions
should be selected as new milestones and retain deterministic calculation tests,
server-side user scoping, limited-data states, and responsive presentation.
