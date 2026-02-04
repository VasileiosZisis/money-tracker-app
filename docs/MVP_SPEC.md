# Free MVP Spec — Money Tracker

## Purpose

This document defines the functional requirements of the Free MVP.
Engineers (and coding agents) should implement exactly what is described here.
Anything not listed is out of scope unless explicitly added later.

---

## User story

As a user, I want to:

- sign in with Google
- complete a short setup (currency + default categories)
- manually enter my income and expenses with details (category + source)
- see month totals (income, expenses, net left)
- review and edit my transactions
- archive categories I no longer use
- export a month to CSV

---

## Core concepts

### Single-currency per user

- Each user selects a base currency during setup (e.g., EUR/GBP/USD).
- All transaction amounts are assumed to be in that currency.
- No FX conversion and no currency toggles in MVP.

### Month-based tracking

- The app is organized around months (like a spreadsheet tab per month).
- Transaction dates are stored as a local date string: `localDate = "YYYY-MM-DD"`.
- Month queries use string range comparisons:
  - `localDate >= YYYY-MM-01` and `< first day of next month`

---

## Entities

### User

- currency: ISO 4217 code (e.g., "EUR", "GBP", "USD")
- hasCompletedSetup: boolean

### Category

- name: string
- type: INCOME or EXPENSE
- isArchived: boolean
- Notes:
  - Archiving is allowed even if a category is already used by transactions.
  - Archived categories should not appear in the "new transaction" dropdown by default.
  - Existing transactions keep their category even if archived.

### Transaction

- type: INCOME or EXPENSE
- amount: positive decimal (money stored precisely, not float)
- localDate: string "YYYY-MM-DD"
- categoryId
- source: string (free text; where money came from / payment detail)
- note: optional string

---

## Pages / Routes

### Public

#### /login

- Google sign-in via NextAuth
- After successful login:
  - If setup not completed -> redirect to /setup
  - Else -> redirect to /dashboard

### Authenticated (requires login)

> All routes below require authentication.

#### /setup

Setup is mandatory on first login.

- Step 1: Choose base currency from a common list (store on user)
- Step 2: Create default categories (button or checkbox)
- Step 3: Finish setup:
  - sets user.hasCompletedSetup = true
  - redirects to /dashboard

Constraints:

- Users cannot access /dashboard, /transactions, /categories, /export until setup is completed.
- If user tries to access app routes before setup is complete, redirect them to /setup.

#### /dashboard

- Month selector (default: current month)
- Cards:
  - income total for selected month
  - expense total for selected month
  - net left = income - expense
- Optional:
  - recent transactions list for selected month

#### /transactions

- List transactions for the selected month
- Filters:
  - month
  - type (all / income / expense)
  - category
- Actions:
  - add transaction
  - edit transaction
  - delete transaction

#### /categories

- List categories grouped by type (income, expense)
- Show Active and Archived sections
- Actions:
  - create category
  - rename category
  - archive/unarchive category
- Rules:
  - archiving allowed even if used
  - archived categories hidden from new transaction dropdown (but still show on edit if already selected)

#### /export

- Select month
- Download CSV containing that month’s transactions
- CSV columns:
  - localDate,type,category,amount,source,note

---

## Acceptance criteria (must be true)

- All authenticated pages are protected (unauthenticated users cannot access).
- Setup enforcement works:
  - logged-in users without hasCompletedSetup are redirected to /setup.
- Data isolation:
  - every DB query is scoped to the authenticated userId.
- Money precision:
  - amount stored with correct decimal precision (Postgres numeric + Prisma Decimal).
- Dashboard totals are correct for any selected month.
- Transaction edit updates are reflected everywhere.
- Export contains only the user’s data for the chosen month.

---

## Out of scope (explicit)

- Bank sync
- Forecasting, planned bills, budgets, funds/sinking funds
- Recurring transactions
- Multi-currency transactions and FX conversion
- Paid plans, payments, subscriptions
- Ads
- Shared accounts / multi-user households
