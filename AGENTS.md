# Money Tracker (Free MVP) — Agent Instructions

## Purpose of this file

This file defines the project goal, scope, rules, and required structure.
Any coding agent (Codex) must read and follow this before making changes.

## Goal

Build the Free MVP of a personal money tracking web app (manual entry only) using:

- Next.js (App Router) + React + TypeScript
- Tailwind CSS + light/dark mode
- PostgreSQL
- Prisma
- NextAuth (Prisma adapter)
- Web app first

The MVP replaces a monthly Excel sheet: users enter income/expenses manually and see monthly totals + net left.

---

## Locked decisions (MVP)

- Authentication: Google OAuth only (NextAuth)
- Onboarding: first login redirects to /setup, which must be completed before using the app
- Currency: per-user base currency (choose from common list). No FX conversion and no currency toggles.
- Date handling: store Transaction.localDate as a string "YYYY-MM-DD"
- Categories: support archiving (isArchived). Archiving is allowed even if category is used.
- Transactions: include Create + Edit + Delete
- UI: must follow the design system in docs/DESIGN_SYSTEM.md

---

## Design system (must follow)

- Follow `docs/DESIGN_SYSTEM.md` for colors, typography, spacing, and dark mode.
- Implement theme tokens as CSS variables in `app/globals.css` with `.dark` overrides.
- Tailwind must map to these tokens (no hardcoded hex colors in components).
- Dark mode uses Tailwind `darkMode: "class"` and toggles the `dark` class on `<html>`.
- Use Inter for UI text and JetBrains Mono for numeric values.

---

## Scope (Free MVP)

Implement:

1. Auth (NextAuth) + route protection
2. Setup flow:
   - /setup page
   - user selects base currency
   - user can create default categories
   - user completes setup (hasCompletedSetup = true)
   - app routes redirect to /setup until setup is complete
3. Categories CRUD:
   - create, rename, archive/unarchive
   - archived categories hidden from "new transaction" dropdown by default
4. Transactions CRUD:
   - fields: type, amount, localDate, categoryId, source, note
5. Dashboard:
   - month selector
   - totals for selected month: income, expense, net left
   - optional recent transactions list
6. Transactions list:
   - filters: month, type, category
7. CSV export for a selected month

Do NOT implement:

- Bank syncing
- Forecasting, planned bills, recurring items, budgets, funds/sinking funds
- Multi-currency transactions or FX conversion
- Paid tiers / payments / subscriptions
- Ads
- Sharing / multi-user households

---

## Data rules

- Store money as Postgres `numeric(14,2)` and Prisma `Decimal`
- Transaction.amount is always positive; type determines INCOME vs EXPENSE
- Transaction.localDate must be "YYYY-MM-DD" (validate server-side)
- Every DB query MUST be scoped to the authenticated userId (session.user.id)
- Never use floats for money
- Categories can be archived; existing transactions keep their category relationship

---

## UX rules

- Web first, responsive
- Keep forms fast to use (few fields, sensible defaults)
- Provide empty states and basic validation messages
- /setup must be simple; completion is required before using the app

---

## Required folder structure

Use this structure:

money-tracker/
app/
(auth)/login/page.tsx
(auth)/\_components/...
(app)/layout.tsx
(app)/setup/page.tsx
(app)/dashboard/page.tsx
(app)/transactions/page.tsx
(app)/categories/page.tsx
(app)/export/page.tsx
api/auth/[...nextauth]/route.ts
actions/
setup.ts
categories.ts
transactions.ts
export.ts
lib/
db.ts
auth/options.ts
auth/session.ts
validators/
dates/
csv/
money/
prisma/
schema.prisma
migrations/
types/
next-auth.d.ts
middleware.ts

Route groups:

- `app/(auth)` for public pages
- `app/(app)` for authenticated pages

---

## Implementation approach

- Use server actions under /actions for mutations
- Keep DB access on the server only
- Use Zod validators under /lib/validators
- Month helpers under /lib/dates should work with localDate strings
- Currency formatting via Intl.NumberFormat using user.currency

---

## Redirect / protection requirements

- middleware.ts protects authenticated routes (requires session)
- In `app/(app)/layout.tsx` (server component), enforce setup:
  - If user.hasCompletedSetup is false and route is not /setup, redirect to /setup
  - After setup completion, redirect /setup -> /dashboard

---

## Execution rules (IMPORTANT — to avoid rate limits)

- Default to **edit-only** changes.
- Do NOT start long-running processes (e.g., `next dev`, `npm run dev`) as part of tasks.
- Do NOT create or run scripts that spawn dev servers and poll HTTP endpoints.
- Do NOT run loops to "wait for server" or "health check" pages.
- Only run commands if the user explicitly asks, and run them once.
- Prefer small, reviewable edits over repeated trial-and-error runs.

---

## Quality bar

- Code should be written so it passes:
  - `npm run lint`
  - TypeScript typecheck (e.g., `tsc --noEmit`)
  - `npm run dev`
- The user will run these commands manually unless explicitly requested.
- The agent must NOT start dev servers, run long-lived processes, or create HTTP polling scripts to “verify”.

---

## Git (if/when repo exists)

- Work in small, reviewable changes
- Avoid refactors unless requested
