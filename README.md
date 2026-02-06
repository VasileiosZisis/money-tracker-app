# Money Tracker (Free MVP)

A web app for manual money tracking (income + expenses) with a monthly view, built to replace a personal Excel workflow.

## Status

- Task 1 complete: Next.js (App Router) + TypeScript scaffold, Tailwind tokens, route groups, base layouts.
- Task 2 complete: Prisma + PostgreSQL schema (NextAuth models + MVP domain models).
- Task 3 complete: NextAuth Google OAuth, protected routes via middleware, session typing with `session.user.id`.

## MVP scope

- Google sign-in (NextAuth)
- First-login setup flow (currency + default categories)
- Transaction CRUD (income/expense, amount, date, category, source, note)
- Monthly dashboard totals (income, expense, net left)
- Transactions filters (month/type/category)
- Category archive/unarchive
- Monthly CSV export

## Tech stack

- Next.js App Router + React + TypeScript
- Tailwind CSS (token-based theme, light/dark mode)
- PostgreSQL + Prisma
- NextAuth (Google OAuth)

## Design system

The UI follows `docs/DESIGN_SYSTEM.md`:

- Token-based colors (no hardcoded hex in components)
- Light/dark mode using `dark` class
- Inter for UI text, JetBrains Mono for numeric values

## Project docs

- `AGENTS.md`
- `docs/MVP_SPEC.md`
- `docs/TECH_DECISIONS.md`
- `docs/TASKS.md`
- `docs/DESIGN_SYSTEM.md`

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment (`.env.local`)

Set these variables:

```env
DATABASE_URL=postgresql://...   # Neon pooled connection string
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### 3. Initialize Prisma

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Run the app

```bash
npm run dev
```
