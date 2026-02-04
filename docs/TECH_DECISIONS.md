# Tech Decisions (Locked for Free MVP)

## Purpose

This document locks key technical decisions for the Free MVP to keep the codebase consistent.
Agents/engineers should follow this and avoid introducing alternative patterns unless explicitly requested.

---

## Stack

- Next.js App Router + React + TypeScript
- PostgreSQL
- Prisma ORM
- NextAuth with Prisma adapter
- Web app first

---

## Authentication

- NextAuth Google OAuth only
- NextAuth route handler at: `app/api/auth/[...nextauth]/route.ts`
- Sign-in page: `/login` (NextAuth `pages.signIn = "/login"`)
- Session must include `session.user.id`
  - Use NextAuth callbacks to attach `user.id` to session
  - Add TypeScript module augmentation in `types/next-auth.d.ts`

---

## Route protection + setup enforcement

Two layers:

1. Auth protection

- Use `middleware.ts` with `next-auth/middleware`
- Protect these routes:
  - `/dashboard`, `/transactions`, `/categories`, `/export`, `/setup`

2. Setup enforcement (best pattern)

- In `app/(app)/layout.tsx` (server component):
  - Query the authenticated user record
  - If `hasCompletedSetup` is false AND current route is not `/setup`, redirect to `/setup`
  - If user visits `/setup` and hasCompletedSetup is true, redirect to `/dashboard`

---

## Database + Money types

- Money stored in Postgres as `numeric(14,2)`
- Prisma uses `Decimal` (never float)
- Transaction.amount is always positive; sign is implied by transaction `type`:
  - INCOME adds, EXPENSE subtracts
- Currency:
  - Per-user base currency (ISO 4217 code string on User, e.g., "EUR", "GBP")
  - No conversion or toggles in MVP

---

## Dates and month boundaries

- Store transaction date as a local date string:
  - `Transaction.localDate` = "YYYY-MM-DD"
- Month queries use string ranges:
  - `localDate >= "${YYYY}-${MM}-01"` and `< first day of next month`
- Avoid DateTime month boundary logic in MVP to prevent timezone/DST issues.

---

## Data model decisions

- Categories:

  - `isArchived: boolean`
  - Archiving allowed even if category has transactions
  - Archived categories hidden in "new transaction" dropdown by default
  - Existing transactions keep their category reference

- Users:
  - `hasCompletedSetup: boolean`
  - `currency: string`

---

## Mutations and validation

- Use server actions in `/actions/*` for mutations (create/update/delete)
- Validate all inputs on the server using Zod schemas in `/lib/validators/*`
- All DB access must be server-side; no direct client DB access.

---

## Query scoping (security rule)

- Every query MUST be scoped by `userId = session.user.id`
- Never trust client-provided userId
- If an entity is accessed by ID (categoryId/transactionId), verify it belongs to the user before reading/updating/deleting.

---

## UI / Forms

- Minimal UI (responsive)
- Transaction form fields:
  - type, amount, localDate, categoryId, source, note
- Edit transaction supported in MVP.

---

## Deployment assumptions (can change)

- Target: Vercel for hosting
- Postgres provider: Neon or Supabase
- Use pooled connection string if needed (serverless friendly)

## Agent execution

- Prefer edit-only changes.
- Avoid dev-server polling/loops; user runs commands manually.

---
