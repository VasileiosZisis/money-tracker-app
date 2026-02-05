# Money Tracker (Free MVP)

A simple web app for manual money tracking (income + expenses) with a clean monthly view — built to replace a personal Excel sheet.

## Status

✅ **Task 1 complete** — Next.js (App Router) bootstrapped with Tailwind, design tokens (light/dark), fonts, and placeholder routes/layouts.  
✅ **Task 2 complete** — Prisma + PostgreSQL schema set up (including NextAuth models + MVP domain models).

## What it will do (Free MVP scope)

- Sign in with Google (NextAuth)
- One-time setup on first login:
  - choose your base currency (common currencies supported)
  - create default income/expense categories
- Add, edit, and delete transactions (manual entry)
  - income/expense type
  - amount
  - date (`YYYY-MM-DD`)
  - category
  - source (where the money came from / payment detail)
  - note (optional)
- Monthly dashboard:
  - total income
  - total expenses
  - net left (income − expenses)
- Transactions list with filters (month/type/category)
- Categories management with archive/unarchive
- Export a month to CSV

## Tech stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS (design tokens + light/dark mode)
- PostgreSQL + Prisma
- NextAuth (Google OAuth)

## Design system

The UI follows `docs/DESIGN_SYSTEM.md`:

- Token-based colors (no random hex colors in components)
- Light + dark mode (`dark` class strategy)
- Inter for UI text, JetBrains Mono for numbers

## Project docs (important)

- `AGENTS.md` — agent/developer guardrails (scope, rules, folder structure)
- `docs/MVP_SPEC.md` — what the MVP must do
- `docs/TECH_DECISIONS.md` — locked technical decisions
- `docs/TASKS.md` — step-by-step build plan
- `docs/DESIGN_SYSTEM.md` — colors, typography, spacing

## Getting started (local dev)

### Install

```bash
npm install
npm run dev
```
