# Money Tracker — Agent Instructions

Read this guide before making changes. It defines agent workflow and critical
safeguards; detailed product behavior belongs in the canonical documents below.

## Sources of truth

Before making changes, read in this order:

1. `AGENTS.md` — execution rules, review requirements, and critical safeguards.
2. `docs/DESIGN_SYSTEM.md` — visual design, shared components, and interaction conventions.
3. `docs/TECH_DECISIONS.md` — locked architecture, data rules, and implementation patterns.
4. `docs/PRODUCT_SPEC.md` — current implemented product behavior and scope.
5. `docs/ROADMAP.md` when selecting or discussing future product work.
6. The relevant active plan under `docs/` when implementing selected feature work.
   There is currently no active implementation plan; completed plans are kept
   under `docs/archive/`.

Use each document for its stated responsibility. If requirements conflict,
critical safeguards and execution/review rules here win, followed by technical
decisions, the current product spec, and the selected active plan. The design
system governs visual decisions within those constraints. Surface unresolved
conflicts instead of silently inventing product behavior.

Roadmap candidates are not implementation scope until explicitly selected.
Active plans may describe selected work that is not yet implemented; follow the
requested milestone rather than implementing every remaining item. Documents
under `docs/archive/`, including the old MVP and next-phase specifications, are
historical references only.

When behavior or architecture changes, update the relevant canonical document.
Update this guide only when agent workflow, critical safeguards, or the code map
changes; do not duplicate detailed formulas, field lists, or screen specs here.

## Current product and boundaries

Money Tracker is a manual-first personal finance web app for recording actual
transactions, understanding history, and making explainable spending decisions.
Each personal account is isolated; “single-user” means no shared household or
collaborative workspace, not a single global user in the database.

The implemented baseline includes:

- Google OAuth, mandatory currency/time-zone setup, and protected app routes.
- Transactions CRUD, category/subcategory management, and URL-backed filters.
- Monthly planned bills and income with manual occurrence handling and linking.
- Monthly dashboard totals, forecasts, safe-to-spend, and Needs Attention.
- Total Balance over completed months, with separate positive balance adjustments.
- Insights for historical cashflow, typical results/spending, spending composition,
  and month-over-month change drivers.
- Settings for account time zone, CSV import/export, and light/dark theme.

Preserve these behaviors while implementing the selected task. CSV is the
implemented import baseline; optional Excel support is not an instruction to
add it during unrelated work.

Do not implement without an explicit product decision: bank sync, multiple
accounts/reconciliation, FX or multi-currency transactions, advanced recurrence,
automatic/fuzzy matching, budgets/envelopes/rollovers, reserve or sinking funds,
shared workspaces, billing/subscriptions/ads, native mobile apps, AI
categorization/forecasting/assistant features, background jobs or notification
delivery, investments/net worth, or subscription-cancellation workflows.
Do not redesign the app shell, replace authentication, or refactor unrelated
features as a side effect of a feature request.

## Implementation and documentation lookup

- Keep the existing Next.js App Router, React, TypeScript, Tailwind, PostgreSQL,
  Prisma, and NextAuth stack. Google OAuth remains the only sign-in provider.
- Check `package.json` and the lockfile for package versions; do not assume the
  project uses the latest framework or library API.
- Prefer project docs for product and architecture, installed Vercel Next.js
  and official Prisma skills for implementation guidance, and Context7 for
  library/API documentation, configuration, migrations, upgrades, and deprecations.
- Always use Context7 first for version-specific Next.js, React, Prisma,
  Tailwind, Zod, and NextAuth/Auth.js questions. If unavailable, fall back to
  local project documentation and then general reasoning. External guidance
  does not override locked project decisions.
- Default to server actions under `actions/` for mutations. Route handlers are
  allowed when a client workflow needs a server boundary, as with import.
- Keep database access and financial/domain calculations server-side. Validate
  mutation inputs with Zod under `lib/validators/`; client validation and dirty
  state are UX affordances, never authorization or validation boundaries.
- Reuse centralized auth, date, domain, and route helpers. Prefer deterministic
  utilities over implicit behavior and preserve existing URL/filter contracts.
- Session/preferences memoization is request-scoped only; never persist or share
  authenticated results across requests or users.

## Critical safeguards

### Ownership and authentication

- Derive identity from `session.user.id`; never trust a client-provided `userId`.
- Scope every application read and mutation of user-owned data to that identity.
  User-record lookups use the authenticated user's ID. Verify ownership when
  reading, updating, deleting, or linking an entity by ID, including related entities.
- Protect all entry points on the server. Proxy/layout redirects do not replace
  authentication, setup enforcement, validation, and ownership checks at server
  actions and route handlers.
- Preserve NextAuth adapter authentication behavior; do not interpret application
  query-scoping rules as requiring an existing session before OAuth can create one.
- `proxy.ts` protects app and setup routes. `app/(app)/layout.tsx` redirects users
  lacking completed setup or a confirmed time zone to `/setup`.
- Setup lives outside the app layout under `app/(onboarding)/`. Its layout
  redirects users with completed setup and a confirmed time zone to `/dashboard`.
- `/planned-income` stays protected as a compatibility redirect to
  `/planned?type=INCOME`, preserving legacy edit-link translation.

### Money and dates

- Store money as PostgreSQL `numeric(14,2)` / Prisma `Decimal`. Never use
  floating-point arithmetic for financial calculations or persisted amounts.
- Serialize monetary values safely at client boundaries. Chart-only numeric
  conversions are allowed after server calculation; never feed those numbers
  back into financial calculations, validation, or persistence.
- Transaction amounts are positive; `INCOME`/`EXPENSE` determines their sign.
  Format currency with `Intl.NumberFormat` using the user's base currency.
- Validate `Transaction.localDate` as a real `YYYY-MM-DD` calendar date and use
  local-date string boundaries for month queries.
- Use the user's confirmed IANA time zone with centralized date helpers for
  today, current month, defaults, and date-sensitive validation. Never use the
  deployment server's local calendar for account data.
- Date helpers must accept an explicit time zone and be deterministic when given
  an instant. Preserve account-local midnight refresh behavior.

### Categories and planned items

- Categories have a financial type; transactions and planned items must use a
  compatible category owned by the same user. An optional subcategory must
  belong to the selected category.
- Archiving is allowed for used categories; existing relationships remain intact.
  Archived categories are hidden from new-entry flows by default.
- Preserve category/subcategory name normalization and scoped duplicate checks.
  Preserve Prisma's legacy `Tag`/`tagId` database mappings; a terminology change
  must not drop, recreate, or backfill classification data.
- Planned bills and income remain separate monthly templates, with due/expected
  days restricted to 1–28 and state stored on monthly occurrences.
- Templates do not directly change actual totals or automatically create
  transactions. Mark paid/received explicitly creates a normal transaction;
  linking uses an existing compatible transaction without duplication.
- Distinguish generated from linked transactions. Undo generated handling deletes
  the generated transaction; undo linked handling keeps the transaction and
  removes only the occurrence. Deleting the associated transaction makes the
  planned item unhandled again.
- Generated transactions inherit category, subcategory, Source, and Note.
  Template names remain template identity, not transaction Source.
- Active unhandled bills remain reserved until paid or skipped, even when overdue.
  No automatic or fuzzy matching; link hints are descriptive labels only.

### Forecast and historical analysis

- Forecasts are deterministic, explainable, computed on demand, and never persisted.
  Follow the canonical formulas, fallback/confidence rules, and month behavior.
- Actual income/expense totals come only from transactions. Pending planned income
  affects projected month-end net but never safe-to-spend or daily/weekly safe spend.
- Exclude active planned-bill categories from variable forecasting and spending
  pace inputs to prevent double counting. Preserve negative safe-spend values.
- Planned-income realization uses actual linked/generated received amounts over
  all active planned-income template amounts, including pending/skipped templates;
  results can exceed 100%.
- Balance adjustments are separate positive amounts for strict completed `YYYY-MM`
  months. Reject zero, negative, current-month, and future-month adjustments.
  They affect Total Balance only, never transaction totals, planned items, or forecasts.
- Total Balance excludes current/future months and incomplete years, includes
  earlier activity in starting balance, carries balances across inactive months,
  and preserves negative balances. Its range is independent of Monthly Snapshot.
- Insights uses actual transactions only. Exclude the incomplete current month
  from historical medians, completed-period composition, and change comparisons.
  Preserve the documented account/category history eligibility and zero-activity
  month rules; do not silently drop eligible empty months or treat pre-tracking
  months as recorded zeroes.
- Insights is descriptive history, not a budget or spending recommendation.
  Safe-to-spend is an estimate; Total Balance is a historical ledger, not a
  bank-synced balance or reconciliation system.

### Import and export

- Keep import explicit: upload, parse, preview, validate/map, then confirm.
  Do not write transactions before confirmation; show invalid rows clearly.
- Imported rows follow manual-entry validation and ownership rules. Resolve
  category/subcategory mappings within the user's account before confirmation.
- Never overwrite existing transactions. Prevent duplicate creation within one
  confirmation flow; do not add fuzzy historical deduplication.
- Preserve legacy CSV `tag`/`tags` aliases for `subcategory`.
- Export only the authenticated user's selected-month transactions.

## UI conventions

Follow `docs/DESIGN_SYSTEM.md` for layout, interaction, and visual details.
Reuse the shell and shared UI primitives; keep forms fast, responsive, and
accessible, with actionable validation and appropriate empty states.

Use CSS-variable theme tokens in `app/globals.css`, mapped through Tailwind,
with `.dark` overrides and the `dark` class on `<html>`. Do not hardcode new hex
colors in components. Use Inter for UI text and JetBrains Mono for numeric
emphasis. Preserve the compact combined Forecast remaining spend presentation
without a reserved-bill/variable-spending breakdown beneath the metric.

## Code map

Paths are relative to the repository root. Follow the existing structure rather
than creating parallel feature implementations.

| Area | Location |
| --- | --- |
| Login and OAuth | `app/(auth)/login/page.tsx`, `app/api/auth/[...nextauth]/route.ts` |
| Setup and onboarding redirects | `app/(onboarding)/setup/page.tsx`, `app/(onboarding)/layout.tsx` |
| App shell and setup gate | `app/(app)/layout.tsx`, `components/app-shell/`, `proxy.ts` |
| App workspaces | `app/(app)/dashboard/`, `app/(app)/transactions/`, `app/(app)/insights/`, `app/(app)/categories/`, `app/(app)/planned/`, `app/(app)/settings/` |
| Income compatibility route | `app/(app)/planned-income/page.tsx` |
| Import endpoints and CSV download | `app/api/import/preview/route.ts`, `app/api/import/confirm/route.ts`, `app/(app)/settings/export/download/route.ts` |
| Mutations | `actions/`, including `actions/balance-adjustments.ts` |
| Database, auth, and validation | `lib/db.ts`, `lib/auth/`, `lib/validators/`, `types/next-auth.d.ts` |
| Financial/date helpers | `lib/dates/`, `lib/forecast/`, `lib/dashboard/`, `lib/balance/`, `lib/insights/` |
| Import/export and view-state helpers | `lib/import/`, `lib/export/`, `lib/routes/` |
| Shared UI and feature components | `components/ui/`, `components/dashboard/`, `components/insights/`, `components/settings/`, `components/theme/` |
| Theme configuration | `app/globals.css`, `tailwind.config.ts` |
| Schema and migrations | `prisma/schema.prisma`, `prisma/migrations/` |
| Independent reviewers | `.codex/agents/` |

Import/export have no standalone user-facing pages; Settings hosts both workflows.

## Execution and validation

- Default to edit-only work. Read-only file searches, file reads, and Git
  status/diff inspection are allowed without a separate request.
- Tests, lint, typechecks, builds, dependency installs, code generation, database
  commands/migrations, and development/production servers require explicit user
  authorization. A request to edit code alone does not authorize these commands.
- Run authorized commands once; do not repeatedly retry checks without explicit
  authorization. Do not start long-running processes unless explicitly requested.
- Do not create scripts that spawn dev servers and poll HTTP endpoints. Do not
  run wait-for-server loops or page health-check polling.
- Make small, reviewable edits. Preserve existing uncommitted work and do not
  rewrite Git history or refactor unrelated features.
- Add/update meaningful regression tests for relevant behavior changes, but leave
  execution to the user unless authorized. Report exactly what was and was not run.

Available scripts in `package.json` (reference only, not execution permission):

| Command | Purpose |
| --- | --- |
| `npm test` | Existing targeted regression suite |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript without emit |
| `npm run build` | Prisma generation followed by Next.js build |
| `npm run check` | Lint, typecheck, and build; does not include tests |
| `npm run dev` | Long-running development server |

Code should pass the relevant checks and function in the app. Documentation-only
edits need path/reference and diff inspection, not application execution.

## Subagent review policy (IMPORTANT)

Use the project-specific Codex subagents under `.codex/agents/` as independent, read-only reviewers when their domain is relevant.

Available review subagents:

- `reviewer` — general correctness, regressions, maintainability, error handling, and meaningful missing tests
- `money_integrity` — financial math, Decimal usage, forecast semantics, planned-vs-actual behavior, dates/time zones, and category financial semantics
- `data_isolation` — authentication, authorization, ownership checks, Prisma query scoping, IDOR/BOLA risks, and cross-user data access
- `test_auditor` — important regression and edge-case test gaps without chasing coverage for its own sake

### When to use each subagent

Use `reviewer` after non-trivial changes that alter application behavior, data flow, server logic, shared utilities, or multiple files.

Use `money_integrity` after changes that affect or could affect:

- transactions, balances, balance adjustments, income, expenses, or money formatting/calculation
- Total Balance ranges/carry-forward and Insights historical baselines, medians, or comparisons
- planned bills or planned income
- forecasts, safe-to-spend, daily/weekly safe spend, spending pace, or planned-income realization
- Prisma `Decimal` / Postgres `numeric` handling
- transaction dates, selected-month logic, current-month logic, or user time-zone behavior
- category/subcategory rules that affect financial semantics
- imports that create or transform financial records

Use `data_isolation` after changes that affect or could affect:

- Prisma/database reads or writes
- server actions or route handlers
- authentication, authorization, route protection, or setup enforcement
- entity lookup/update/delete by ID
- transactions, categories, subcategories, planned bills, planned income, or occurrences
- linking existing transactions to planned items
- imports, exports, dashboard queries, Insights queries, balance adjustments, or any user-owned data

Use `test_auditor` after non-trivial behavior changes, bug fixes, domain-logic changes, security-sensitive changes, or changes where a regression could be subtle or expensive.

Do not spawn review subagents for trivial changes such as comments, copy-only edits, formatting, or isolated visual tweaks unless the change touches one of the domains above.

### Review workflow

For a non-trivial change:

1. Complete the implementation first.
2. Select only the subagents whose domains are relevant.
3. When multiple subagents are relevant, spawn them in parallel.
4. Keep review subagents read-only. They must inspect the current change and relevant surrounding code, not edit files.
5. Wait for all requested subagents to finish before considering the implementation review complete.
6. The parent agent must independently validate every reported issue against the code and project rules. Do not blindly apply subagent recommendations.
7. Consolidate duplicate findings and discard speculative, unsupported, style-only, or out-of-scope findings.
8. Fix valid in-scope findings when the task requires code changes.
9. Add or update meaningful tests when needed, but do not execute test/lint/typecheck/dev commands unless the user explicitly asks, consistent with the execution rules above.
10. If fixes materially change reviewed logic, re-run the relevant subagent review once on the final diff. Avoid review loops when no substantive logic changed.

### Review priorities

Subagents should prioritize findings in this order:

1. cross-user data access, authorization, or destructive-data risks
2. incorrect money calculations or financial-state corruption
3. incorrect planned-vs-actual or forecast behavior
4. date, month-boundary, or time-zone correctness issues
5. regressions in existing product behavior
6. missing validation or meaningful regression tests
7. maintainability issues only when they create a concrete correctness or future-regression risk

Subagents should not manufacture findings just to produce output. `No important findings` is an acceptable result.

### Parent-agent completion rule

For changes that trigger this policy, do not declare the task complete until the required subagent reviews have finished and their findings have been validated and resolved or explicitly reported to the user.

---

## Completion criteria

The selected task is implemented without changing unrelated scope; existing
tracking, planning, Insights, and Total Balance behavior remains intact. Data
stays isolated, money/date calculations remain correct, and affected canonical
docs and meaningful tests are updated. Required reviews are complete and their
findings resolved or explicitly reported. State verification limits honestly.
