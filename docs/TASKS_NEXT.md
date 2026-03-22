# Build Tasks (Next Phase) — Do in Order

## How to use this file

This file starts **after the original Free MVP is complete**.

Assumptions:

- Tasks 1–9 from `TASKS.md` are already done
- auth, setup, categories, transactions, dashboard totals, export, and polish already work
- this file adds the next planning-focused feature layer

Implement tasks sequentially. Each task should end with:

- `npm run lint` passing
- TypeScript typecheck passing (no errors)
- app runs with `npm run dev`
- basic manual verification of the feature

Do not refactor unrelated existing features unless required for this phase.

---

## Task 10 — Schema additions + foundational decisions

Goal: Add the minimum new data model and helper structure for the next phase.

Steps:

1. Add `PlannedBill` model to Prisma:
   - `id`
   - `userId`
   - `name`
   - `amount` Decimal numeric(14,2)
   - `dueDayOfMonth` Int
   - `categoryId`
   - `isActive`
   - timestamps
2. Add Prisma relations:
   - `User -> PlannedBill[]`
   - `Category -> PlannedBill[]`
3. Add constraints / indexes:
   - index on `(userId, isActive)`
   - index on `(userId, dueDayOfMonth)`
   - ensure planned bill category is expense-only at app validation level
4. Create helper folders:
   - `lib/forecast/`
   - `lib/import/`
   - `lib/validators/planned-bill.ts`
   - `lib/validators/import.ts`
5. Decide and document:
   - forecast is computed on demand, not stored
   - import preview is not persisted long-term in DB in this phase

Acceptance checks:

- Prisma migration succeeds
- Existing app still works after migration
- No existing category / transaction behavior breaks

---

## Task 11 — Planned bills CRUD (server actions + validation)

Goal: Add the backend logic for planned bills.

Steps:

1. Implement Zod validation in `lib/validators/planned-bill.ts`:
   - `name` required
   - `amount > 0`
   - `dueDayOfMonth` integer `1–28`
   - `categoryId` required
   - `isActive` boolean
2. Implement `actions/planned-bills.ts`:
   - `listPlannedBills()`
   - `createPlannedBill()`
   - `updatePlannedBill()`
   - `togglePlannedBillActive()`
   - `deletePlannedBill()` (recommended)
3. Enforce rules:
   - planned bills belong only to current user
   - referenced category must belong to current user
   - referenced category must be `EXPENSE`
4. Keep planned bills fully separate from transactions:
   - do not create actual transactions automatically
   - do not affect actual totals directly

Acceptance checks:

- Create / edit / deactivate / reactivate works
- Cannot create a planned bill with an income category
- User scoping enforced on every query/mutation

---

## Task 12 — Planned bills page + navigation

Goal: Add the UI for managing planned bills.

Steps:

1. Add route:
   - `app/(app)/planned/page.tsx`
2. Add authenticated navigation link:
   - Planned Bills
3. Build page UI:
   - list active planned bills
   - list inactive planned bills
   - create form
   - edit action
   - activate/deactivate action
   - delete action (if implemented)
4. Display fields:
   - name
   - amount
   - expense category
   - due day of month
   - active status
5. Add empty state:
   - explain that planned bills are expected monthly expenses used for forecasting

Acceptance checks:

- Page renders for authenticated users
- Active/inactive sections behave correctly
- Form validation messages are visible
- Responsive layout is acceptable on mobile width

---

## Task 13 — Import pipeline (CSV first)

Goal: Build the import backend flow for spreadsheet migration.

Steps:

1. Support CSV upload as required input
2. Build parsing helpers in `lib/import/`:
   - parse CSV rows
   - normalize headers
   - map columns to internal fields
   - validate rows
3. Required import fields:
   - `localDate`
   - `type`
   - `category`
   - `amount`
4. Optional fields:
   - `source`
   - `note`
5. Add row validation rules:
   - valid `YYYY-MM-DD`
   - type is `INCOME` or `EXPENSE` (allow normalized case-insensitive input if desired)
   - amount parses as positive decimal
   - category must be mapped before confirm
6. Implement import actions in `actions/import.ts`:
   - parse uploaded file
   - build preview result
   - report row-level errors
   - confirm import and create transactions
7. Duplicate safety:
   - do not overwrite any existing data
   - avoid duplicate creation inside the same confirmation flow
   - keep this simple; no fuzzy historical dedupe in this phase

Acceptance checks:

- CSV file parses successfully
- Invalid rows are reported clearly
- Confirmed valid rows create standard transactions
- Imported transactions belong only to current user

---

## Task 14 — Import page + preview / confirm flow

Goal: Add a usable spreadsheet-import UI.

Steps:

1. Add route:
   - `app/(app)/import/page.tsx`
2. Add authenticated navigation link:
   - Import
3. Build page flow:
   - upload file
   - preview parsed rows
   - show detected columns
   - map columns if needed
   - show validation errors
   - show category mapping / creation choices
   - confirm import
4. Required UI summary:
   - total rows
   - valid rows
   - invalid rows
   - categories to create
5. Keep UX explicit:
   - user must confirm before DB write
   - errors must be visible before confirm
6. Imported rows should appear in Transactions page immediately after success

Acceptance checks:

- User can upload and preview a CSV before import
- User can confirm import only after required mapping is resolved
- Successful import shows imported rows in normal transactions flow
- Existing transactions UI works with imported rows exactly like manual rows

---

## Task 15 — Forecast helpers (basic current-month estimate)

Goal: Implement deterministic, testable forecast logic.

Steps:

1. Add forecast helpers in `lib/forecast/`
2. Implement required helper outputs:
   - `incomeSoFar`
   - `expenseSoFar`
   - `netLeftNow`
   - `unpaidPlannedBills`
   - `variableCategoryForecast`
   - `forecastRemainingSpend`
   - `projectedEndOfMonthNet`
   - `safeToSpend`
3. Basic formula:
   - `netLeftNow = incomeSoFar - expenseSoFar`
   - `forecastRemainingSpend = unpaidPlannedBills + variableCategoryForecast`
   - `projectedEndOfMonthNet = incomeSoFar - (expenseSoFar + forecastRemainingSpend)`
   - `safeToSpend = netLeftNow - forecastRemainingSpend`
4. Variable forecast logic:
   - use trailing 3 full months where available
   - compute average daily expense for variable categories
   - multiply by remaining days in selected month
5. Fallback behavior:
   - if limited history exists, use fewer months or current-month run rate
   - label lower-confidence results in UI later
6. Keep fixed known bills in planned-bill logic
7. Avoid obvious double counting between planned bills and variable estimate

Acceptance checks:

- Forecast helpers return deterministic numbers for known inputs
- Current-month calculations are correct for test scenarios
- Past/current/future month behavior does not crash the app

---

## Task 16 — Dashboard extension with forecast + safe-to-spend

Goal: Upgrade the dashboard from actual totals to planning-aware monthly insight.

Steps:

1. Extend `/dashboard` server-side data loading
2. Keep existing cards:
   - income
   - expenses
   - net left
3. Add new metrics:
   - forecast remaining spend
   - projected end-of-month net
   - safe-to-spend
   - upcoming planned bills for selected month
4. Recommended card order:
   - Net left now
   - Safe to spend
   - Forecast remaining spend
   - Projected end-of-month net
5. Add short explainability text:
   - based on recent spending and upcoming bills
   - forecast is an estimate
6. Add UI states:
   - positive / safe
   - caution
   - negative / over-limit risk
7. Keep current month as the primary target
8. Do not break existing month selector behavior

Acceptance checks:

- Dashboard still shows actual totals correctly
- Forecast values render correctly for current month
- Safe-to-spend is visible and clearly labeled as estimated
- Upcoming planned bills section shows the correct bills for the selected month

---

## Task 17 — Edge cases, fallback states, and polish

Goal: Make the new phase feel trustworthy and shippable.

Steps:

1. Add empty states:
   - no planned bills
   - no history for forecast
   - no import data
2. Add limited-history messaging:
   - forecast confidence is lower when there is not enough history
3. Add validation / weird-state guards:
   - cannot import unsupported file shape without clear errors
   - cannot create planned bill with invalid day or amount
   - cannot access another user's planned bills or imported rows
4. Ensure imported transactions and planned bills follow design system consistently
5. Review navigation / route protection:
   - `/planned`
   - `/import`
6. Run manual regression checks:
   - categories still work
   - transactions still work
   - dashboard totals still work
   - export still works

Acceptance checks:

- New routes are protected
- No user-scoping leaks
- Existing MVP features still work after new features are added
- Empty / error / limited-history states are acceptable

---

## Task 18 — Final verification for next phase

Goal: Verify the next phase is complete and stable.

Checklist:

### Import

- User can upload CSV
- User can preview rows before confirm
- Invalid rows are shown clearly
- Confirmed rows import correctly
- Imported rows appear in Transactions and Dashboard

### Planned Bills

- User can create planned bills
- User can edit planned bills
- User can activate/deactivate planned bills
- Planned bills show in the planned-bills page
- Planned bills appear in dashboard planning section

### Forecast

- Dashboard shows forecast remaining spend
- Dashboard shows projected end-of-month net
- Dashboard shows safe-to-spend
- Forecast is clearly labeled as estimated
- Forecast still works with limited history

### Regression

- Auth still works
- Setup still works
- Categories still work
- Transactions CRUD still works
- CSV export still works
- lint passes
- typecheck passes
- app runs with `npm run dev`

Definition of done:

- spreadsheet users can import historical transactions
- users can manage monthly planned bills
- dashboard shows explainable current-month forecast metrics
- safe-to-spend is visible and understandable
- app remains simple, fast, and trustworthy

---
