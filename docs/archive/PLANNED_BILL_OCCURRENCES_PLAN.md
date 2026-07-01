# Planned Bill Monthly State Implementation Plan

## Summary

Goal: fix planned-bill double counting by adding explicit month-level paid/skipped state.

Status: implemented, then extended with planned-bill tags and manual linking to
existing expense transactions.

A planned bill remains a reusable monthly template. A `PlannedBillOccurrence` record tracks whether that bill has been handled for a specific `YYYY-MM` month. Forecasts no longer rely only on due day to decide whether a planned bill is unpaid.

Default decisions:

- Do not use fuzzy automatic matching.
- Marking a planned bill as paid creates a real expense transaction and links it to the monthly occurrence.
- Skipping a planned bill excludes it from that month forecast without creating a transaction.
- Active planned bills reserve money until explicitly paid or skipped, even after the due date.
- Linking an existing expense transaction marks the selected-month occurrence paid without creating a duplicate transaction.
- Paid occurrences distinguish generated transactions from linked existing transactions.
- Planned bills can optionally store a tag from the selected expense category.

## Milestones And Tasks

### Milestone 1: Schema And Migration

- Add `PlannedBillOccurrenceStatus` enum with `PAID` and `SKIPPED`.
- Add `PlannedBillOccurrence` with `userId`, `plannedBillId`, `month`, `status`, optional `transactionId`, optional `paidAtLocalDate`, and timestamps.
- Add relations from `User`, `PlannedBill`, and `Transaction`.
- Add uniqueness and indexes for one occurrence per planned bill per month, selected-month dashboard loading, and status filtering.
- Use transaction cascade behavior so deleting a linked transaction does not leave a stale paid occurrence.
- Do not backfill existing planned bills.

### Milestone 2: Server Actions And Validation

- Add validators for occurrence month, mark paid, skip month, and undo occurrence.
- Add server actions:
  - `markPlannedBillPaid`
  - `skipPlannedBillForMonth`
  - `undoPlannedBillOccurrence`
- `markPlannedBillPaid` verifies user ownership, verifies the planned bill category is an expense category, creates an expense transaction, and links the paid occurrence atomically.
- `skipPlannedBillForMonth` creates or updates a skipped occurrence without creating a transaction.
- `undoPlannedBillOccurrence` removes the occurrence; if it is linked to a generated transaction, delete that transaction so actual totals stay consistent.

### Milestone 3: Forecast And Dashboard Data

- Load selected-month occurrences with planned bills on the dashboard.
- Treat active planned bills without `PAID` or `SKIPPED` occurrence as unpaid.
- Do not remove unpaid bills from the forecast just because their due date passed.
- Derive dashboard statuses: paid, skipped, upcoming, due today, overdue, and passed for historical months.
- Keep variable-spend forecasting from double-counting planned-bill categories.

### Milestone 4: UI Updates

- Show paid/skipped/upcoming/due/overdue planned-bill badges on the dashboard.
- Add dashboard controls for unhandled bills:
  - mark paid with editable payment date and amount
  - skip this month
- Add undo for paid/skipped occurrences.
- Keep `/planned` focused on template management.
- Update dashboard copy to explain that planned bills remain reserved until marked paid or skipped.

### Milestone 5: Verification

- Verify paid planned bills are excluded from unpaid planned bills.
- Verify skipped planned bills are excluded from unpaid planned bills.
- Verify overdue unpaid planned bills remain included.
- Verify mark paid creates one transaction and one occurrence.
- Verify undo restores the bill to forecast and removes the linked generated transaction.
- Verify user scoping on all occurrence actions.

Expected manual checks:

- `npx prisma migrate dev`
- `npx prisma generate`
- `npm run lint`
- `npx tsc --noEmit`
- Dashboard regression for rent due on day 2, paid on day 1/day 2, and unpaid after day 2.

## Implemented Extensions

### V2a: Planned Bill Tags

- `PlannedBill` has optional `tagId`.
- Planned-bill tags must belong to the selected expense category.
- `/planned` create/edit forms expose the category-scoped tag selector.
- Dashboard planned-bill rows show the tag when present.
- Generated paid transactions inherit the planned bill category and tag.
- Forecast remains category-level; tags are classification metadata in this version.

### V2b: Link Existing Transactions

- `PlannedBillOccurrence` has optional `paymentSource`:
  - `GENERATED`
  - `LINKED`
- `markPlannedBillPaid` sets `paymentSource = GENERATED`.
- `linkExistingTransactionToPlannedBill` sets `paymentSource = LINKED`.
- Link candidates are same-user, selected-month, unlinked expense transactions.
- Candidate labels include deterministic hints, such as exact amount, same category, and same tag.
- Hints are display-only and never auto-link transactions.
- Undo behavior:
  - generated payment: delete the generated transaction, which removes the occurrence through cascade
  - linked payment: delete only the occurrence and keep the existing transaction
