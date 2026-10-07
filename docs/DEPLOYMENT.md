# Deployment and public discovery

Operational details for the maintained CashContour deployment. For a local
checkout, start with the [README](../README.md#local-development). Architecture
and environment decisions are recorded in [TECH_DECISIONS.md](TECH_DECISIONS.md).

## Deployment

Vercel deploys automatically on Git pushes. `main` is the Production branch;
all other branches use Preview. Local commits do not deploy, and commit messages
do not require a deployment marker. Keep the Ignored Build Step set to Automatic.

### Environment separation

| Setting | Production | Preview / Development |
| --- | --- | --- |
| Neon branch and database | `production` / `neondb` | `preview` / `previewdb` |
| `DATABASE_URL` | Production pooled URL, Production only | Preview pooled URL, all preview branches and Development |
| `NEXTAUTH_SECRET` | Existing production secret | Separate non-production secret |
| Google OAuth credentials | Existing Google client | Same client with preview callback registered |

All preview deployments and local development share the persistent preview
database. It starts without production records and uses the preview-only
`preview_owner` role. Never put production database credentials in Preview,
Development, or local `.env.local`. Keep `.env.test.local` separate.

Create Neon's `preview` branch using Schema only, with auto-deletion disabled.
Create the `preview_owner` role and a fresh `previewdb` database on that branch.
Leave the copied `neondb` unused: its tables exist but its migration-history rows
were not copied, so it cannot be initialized by replaying migrations normally.
Do not install automatic per-deployment Neon branching for this shared setup.

### Fictional preview sample data

After signing in through Google on the preview app and completing currency and
time-zone setup, populate that existing account explicitly:

```powershell
npx tsx prisma/seed.ts goneaway182@gmail.com
```

The seed requires the known Neon preview endpoint, `previewdb`, and the
`preview_owner` role. It uses `.env.local` unless `DATABASE_URL` is already
exported. It refuses other targets and never creates a user or changes setup.
Local development and Preview deployments share these sample records.

It adds labeled fictional categories, 24 completed months plus current-month
transactions, monthly planned items and occurrences, and one opening balance
adjustment, using the account's currency and time zone. Stable account-specific
IDs prevent duplicates. Repeating the seed adds missing records and preserves
existing records; incompatible ownership or relationship changes abort the
entire transaction. It can recreate deleted sample records when run again.
New generated transactions inherit the saved template Source and Note, including
edits made after an earlier seed run.
An opening adjustment keeps its original month on later runs. No migrations
are applied. Success prints inserted/skipped counts after relationship checks.

Targeted regression checks: `npx tsx --test prisma/preview-seed.test.ts`.

### Manual migrations

`DATABASE_URL` is the pooled application connection. Prisma CLI prefers the
optional direct `DATABASE_URL_UNPOOLED`, falling back to `DATABASE_URL`.
Exported variables take precedence over dotenv files; `.env.local` takes
precedence over `.env`. In `APP_ENV=test`, Prisma uses `.env.test.local`'s
`DATABASE_URL` or an explicitly exported test `DATABASE_URL`, never a non-test
direct URL or an implicit local/default database.

Before each migration, verify the endpoint, database, and role. Use the direct
preview connection to initialize `previewdb` and test committed migrations:

```powershell
$env:DATABASE_URL_UNPOOLED = '<direct preview/previewdb connection string>'
npx prisma migrate deploy
Remove-Item Env:\DATABASE_URL_UNPOOLED
```

When changing migration targets, explicitly set `DATABASE_URL_UNPOOLED`; setting
only `DATABASE_URL` does not override a configured direct URL. Apply tested,
backward-compatible migrations to production before merging dependent code.
The build command does not apply migrations. Do not use `migrate dev`, `db push`,
or reset commands against production or the shared preview database; author new
migrations against a disposable development database instead. Never copy preview
records into production. Vercel rollbacks do not roll back database migrations.

### Preview authentication and release

The production Google OAuth callback is
`https://www.cashcontour.com/api/auth/callback/google`. Keep it registered on the
existing Google OAuth client alongside the localhost and stable preview callbacks.
Google consent-screen branding should use CashContour, homepage
`https://www.cashcontour.com`, and authorized domain `cashcontour.com`; these
provider settings are maintained outside this repository.

Keep `NEXTAUTH_URL` unset on Vercel with system environment variables enabled.
Locally, keep `NEXTAUTH_URL=http://localhost:3000`. Use the stable branch domain
shown in the deployment's Domains, not a commit-specific domain. Register its
exact `https://<branch-host>/api/auth/callback/google` URL in the existing Google
OAuth client without removing production or localhost callbacks. Other branches
need their own callback registration to test Google login. Keep Vercel's preview
login protection enabled.

Use the long-lived `codex/preview` branch for a reusable authenticated preview.
Verify login, setup, and fictional transactions there, then merge to `main` for
a new Production build with Production variables. Do not promote an existing
preview artifact as the release path. Environment changes affect new deployments
only. Coordinate schema changes because all preview branches share one database.

## Public metadata and indexing

- The official metadata base is `https://www.cashcontour.com`; the homepage and
  public demo have their own query-free canonical URLs and branded sharing cards.
- Only Vercel Production (`VERCEL_ENV=production`) permits indexing. Preview,
  Development, and local environments use `noindex`, block crawling through
  `robots.txt`, and publish an empty sitemap. Preserve Vercel preview protection.
- The production sitemap contains only `/` and `/demo`. Login, onboarding,
  and authenticated workspaces use `noindex, follow`; authentication remains
  the access-control boundary. Production robots rules exclude `/api/` and
  allow crawling login so its `noindex` can be read.
- Browser titles use CashContour with individual workspace titles. The existing
  favicon and browser-mode manifest remain unchanged.

