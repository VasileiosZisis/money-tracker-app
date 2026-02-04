# Build Tasks (Free MVP) — Do in Order

## How to use this file

Implement tasks sequentially. Each task should end with:

- `npm run lint` passing
- TypeScript typecheck passing (no errors)
- app runs with `npm run dev`
- basic manual verification of the feature

---

## Task 1 — Bootstrap project + structure

Goal: Create the Next.js project and required folder structure.

Steps:

1. Create Next.js app (App Router) with TypeScript
2. Add minimal global layout + CSS
3. Create route groups and placeholder pages:
   - app/(auth)/login/page.tsx
   - app/(app)/setup/page.tsx
   - app/(app)/dashboard/page.tsx
   - app/(app)/transactions/page.tsx
   - app/(app)/categories/page.tsx
   - app/(app)/export/page.tsx
4. Add app shell layout for authenticated pages:
   - app/(app)/layout.tsx with basic nav
5. Add `/lib/db.ts` Prisma client singleton (placeholder until Prisma init)

Acceptance checks:

- All placeholder pages render
- Dev server runs

---

## Task 2 — Prisma setup + base schema (includes NextAuth models)

Goal: Connect Postgres, set up Prisma, and create the initial schema.

Steps:

1. Initialize Prisma
2. Create schema including NextAuth models:
   - User, Account, Session, VerificationToken
3. Add MVP user fields:
   - User.currency (default "EUR")
   - User.hasCompletedSetup (default false)
4. Add Category and Transaction models:
   - Category: name, type (INCOME/EXPENSE), isArchived
   - Transaction: type, amount Decimal numeric(14,2), localDate "YYYY-MM-DD", categoryId, source, note
5. Run migrations
6. Add indexes and constraints:
   - Unique category: (userId, name, type)
   - Indexes: transactions by (userId, localDate), categories by (userId)

Acceptance checks:

- `npx prisma migrate dev` succeeds
- Prisma Studio can open (optional)

---

## Task 3 — NextAuth (Google OAuth) + route protection

Goal: Add authentication, protect routes, and ensure session has user.id.

Steps:

1. Add NextAuth route handler:
   - app/api/auth/[...nextauth]/route.ts
2. Configure NextAuth:
   - Google provider only
   - Prisma adapter
   - session callback adds `session.user.id`
   - pages.signIn = "/login"
3. Add TS module augmentation:
   - types/next-auth.d.ts
4. Add middleware route protection:
   - middleware.ts protecting /setup, /dashboard, /transactions, /categories, /export
5. Build /login page:
   - Sign in with Google button

Acceptance checks:

- Can sign in with Google locally
- Protected routes redirect to /login when not signed in
- Session includes user.id

---

## Task 4 — Setup enforcement + /setup page

Goal: Require setup after first login and collect user currency + default categories.

Steps:

1. Setup enforcement in app/(app)/layout.tsx (server component):
   - If user.hasCompletedSetup is false and route != /setup -> redirect /setup
   - If user.hasCompletedSetup is true and route == /setup -> redirect /dashboard
2. Implement /setup page:
   - Currency dropdown (common currencies)
   - Button/checkbox to create default categories
   - Finish setup button sets hasCompletedSetup=true and redirects /dashboard
3. Add server actions:
   - actions/setup.ts
     - setCurrency(currencyCode)
     - createDefaultCategories()
     - completeSetup()
4. Ensure defaults are idempotent (no duplicates)

Acceptance checks:

- First login always lands in /setup
- Cannot access /dashboard until setup completed
- Setup completion redirects to /dashboard
- Currency saved to user

---

## Task 5 — Categories CRUD (with archiving)

Goal: Allow managing categories and archiving/unarchiving.

Steps:

1. Implement actions/categories.ts:
   - listCategories()
   - createCategory()
   - renameCategory()
   - archiveCategory()
   - unarchiveCategory()
2. Implement /categories UI:
   - show Income + Expense
   - show Active + Archived sections
   - archive/unarchive buttons
3. Ensure user scoping on every query/mutation.

Acceptance checks:

- Create, rename, archive, unarchive works
- Archived categories do not appear in "new transaction" dropdown later

---

## Task 6 — Transactions CRUD (create + edit + delete) + list + filters

Goal: Implement the core transaction entry and browsing.

Steps:

1. Implement actions/transactions.ts:
   - listTransactions({ month, type?, categoryId? })
   - createTransaction()
   - updateTransaction()
   - deleteTransaction()
2. Validation:
   - Zod schemas in lib/validators/transaction.ts
   - Validate localDate format "YYYY-MM-DD"
   - Validate amount > 0
3. Implement /transactions page:
   - Month selector
   - Filters: type, category
   - Table/list with edit + delete actions
   - Add transaction UI (modal or page)
4. Transaction form:
   - category dropdown excludes archived categories (unless editing an existing transaction that uses one)

Acceptance checks:

- Add/edit/delete works
- Filters work
- User scoping enforced

---

## Task 7 — Dashboard totals (month)

Goal: Show month summary: income, expense, net left.

Steps:

1. Implement monthly totals query (server-side):
   - incomeSum for month
   - expenseSum for month
   - netLeft = incomeSum - expenseSum
2. Implement /dashboard UI:
   - Month selector
   - Summary cards
   - Optional: recent transactions for that month

Acceptance checks:

- Totals correct for multiple months
- Uses localDate month range logic

---

## Task 8 — CSV export

Goal: Export a selected month’s transactions.

Steps:

1. Implement actions/export.ts:
   - buildCsvForMonth(month)
2. Implement /export page:
   - month selector
   - download button
3. CSV columns:
   - localDate,type,category,amount,source,note

Acceptance checks:

- CSV downloads and contains correct month data for current user only

---

## Task 9 — Polish + hardening

Goal: Make it feel shippable.

Steps:

- Empty states (no categories, no transactions)
- Loading states and basic error messages
- Prevent weird states:
  - cannot complete setup without currency selected
- Basic responsive styling
- Add a simple landing page redirect logic (optional)

Acceptance checks:

- Code compiles (no TS errors)
- Lint passes
- User verifies by running `npm run dev`

---
