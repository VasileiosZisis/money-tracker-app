# CashContour Mobile Implementation Plan

**Status** — Approved architecture and active implementation plan. Task 4A
establishes the [native app foundation](../mobile/README.md). Task 4B prepares
the [Google sign-in device proof](../mobile/README.md#native-google-sign-in-proof).
Task 4B.1 adds the [standalone proof verifier](../tools/google-proof-verifier/README.md).
Task 4B.2 adds [local test-account enrollment](../tools/google-proof-verifier/README.md#enroll-a-test-account-on-windows).
Task 4B.3 prepares the [private Caddy and Tailscale Serve route](../tools/google-proof-verifier/README.md#dedicated-https-origin).
Task 4B.4A requires a [fresh EAS archive safety check](../mobile/README.md#inspect-the-eas-upload-archive) before cloud builds.
Task 4B.5 records the [successful signed Android device proof](../mobile/README.md#signed-android-verification).
Task 4B.6 closes Android authentication verification after all required
automated checks passed. Android is the primary MVP development and
verification platform. Task 5A adds the
[mobile session foundation](MOBILE_SESSION_FOUNDATION.md) in source. Its
migration awaits verification on a disposable PostgreSQL target. Task 5B adds
[Google proof verification and existing-account resolution](MOBILE_SESSION_FOUNDATION.md#google-identity-verification).
Task 5B.1 closes the
[offline verification gate](MOBILE_SESSION_FOUNDATION.md#task-5b1-verification)
after root typecheck, lint, and all 238 regression tests passed.
Task 5C adds the [internal session lifecycle services](MOBILE_SESSION_FOUNDATION.md#task-5c-service-interfaces).
The schema was validated and the client generated locally. Migration and
concurrency verification remain pending on disposable PostgreSQL. The
product owner confirmed the final Task 5C typecheck passed on `4da6112`.
Task 5D.1 adds the [distributed rate-limiting foundation](MOBILE_RATE_LIMITS.md).
Task 5D.1.1 closes its [offline verification](MOBILE_RATE_LIMITS.md#task-5d11-verification)
after all 278 regression tests, root lint, and root typecheck passed.
Task 5D.2 implements the [disabled-by-default authentication API](MOBILE_AUTH_API.md).
Root lint and all 308 regression tests passed, and the product owner
confirmed the final typecheck passed on `66a665e`. Task 5D.3A records the
[transaction and pool safety findings](MOBILE_DATABASE_TRANSACTION_SAFETY.md).
Task 5D.3B.1 pins the [stable Prisma 7.10.1 baseline](MOBILE_DATABASE_TRANSACTION_SAFETY.md#task-5d3b1-aligned-baseline).
Schema validation, client generation, root lint, typecheck, and all 308
regression tests passed on that baseline. Task 5D.3B.2 adds the
[dedicated mobile pg executor](MOBILE_DATABASE_TRANSACTION_SAFETY.md#task-5d3b2-mobile-transaction-owner).
Root lint, typecheck, and all 327 regression tests passed on Task 5D.3B.2.
Task 5D.3B.3A prepares the [disposable PostgreSQL fixture and integration
harness](MOBILE_POSTGRES_VERIFICATION.md). Task 5D.3B.3B covers direct
PostgreSQL mobile verification, 5D.3B.3C covers independent web Prisma
verification, and 5D.3B.3D covers the intended transaction pooler.
Task 5D.3B.3A.1 passes root lint, typecheck, all 331 offline regressions,
and the Git diff check on the reviewed harness. The local Docker Linux
engine is available. The official PostgreSQL 17 image is present locally
and its [immutable digest](MOBILE_POSTGRES_VERIFICATION.md#available-local-infrastructure)
has been verified. Approval for the pinned image and fixture provisioning
remains pending.
Each live stage requires separate approval. Both mobile migrations
remain unapplied and the mobile authentication API stays disabled.
Task 5E covers live PostgreSQL and deployment verification. Keep the API
disabled pending the fix and the remaining enablement gates.
Signed physical iOS verification remains mandatory before iOS release.

## Architecture And Scope

The Next.js App Router application stays at the repository root and serves both
the web application and the versioned mobile API. React Native, Expo, TypeScript,
and Expo Router are the native client baseline for iOS and Android. Keep the
client under `mobile/`, use Expo-supported dependency versions, and use EAS for
device builds and future distribution.

Both clients use the same PostgreSQL database, Prisma-managed schema, internal user
identities, and server-side financial rules. The web retains NextAuth, its
existing Google sign-in and setup flows, and its Server Action interfaces.
Native clients call JSON Route Handlers under `/api/v1/`. Each transport resolves
a trusted user before calling shared server-only operations. Prisma, database
credentials, date-sensitive business rules, and financial calculations stay on
the server. Forecast functions remain available there for future milestones.

The implementation details below are recommended defaults. The selected native
authentication package, signed build behavior, Google Console settings, and
device test origin require verification during implementation. Product scope and
locked safeguards live in the [Product Spec](PRODUCT_SPEC.md) and
[Tech Decisions](TECH_DECISIONS.md).

### Milestone Order

1. **Complete.** Close Android authentication verification after the
   signed-device proof, 14 automated proof tests, mobile lint, and typecheck pass.
2. Implement the shared mobile authentication backend and account/setup gate,
   then the shared financial read and write APIs.
3. Deliver the shared app's dashboard, transactions, and expense flow and
   verify the internal MVP on Android.
4. When a physical iPhone and Apple Developer Program access are available,
   complete signed iOS authentication verification and repeat the device
   acceptance journey before an iOS release. Resolve public App Store login
   requirements separately before submission.

Keep the existing iOS sign-in implementation, OAuth client configuration,
and callback support. Isolate platform-specific authentication at the client
boundary. Shared session management and financial APIs apply the same
verification, setup, ownership, data isolation, and financial rules on each
platform. Shared implementation proceeds on the Android verification schedule
while physical iOS testing is deferred. Signed iOS verification gates iOS release.

### Existing Code And Extraction Boundaries

| Area | Verified baseline and planned seam |
| --- | --- |
| Identity | [Auth options](../lib/auth/options.ts) configure NextAuth v4 Google and JWT cookies. The [local adapter](../lib/auth/prisma-adapter.ts) resolves `(provider, providerAccountId)`. The [Prisma schema](../prisma/schema.prisma) keeps financial ownership on `User.id`. Reuse that relationship and give mobile sessions separate persistence. |
| Preferences | [Session helpers](../lib/auth/session.ts) currently combine web-session resolution and the preferences lookup. Extract the lookup by trusted internal ID. Keep request-scoped web memoization and the existing [app setup gate](../app/%28app%29/layout.tsx). |
| Transactions and categories | [Transaction actions](../actions/transactions.ts) own validation, category and subcategory checks, listing, and creation. [Category actions](../actions/categories.ts) and transaction form metadata read owned categories with nested subcategories. Extract the query and create logic. Keep web redirects, validation messages, ordering, legacy filter links, archive behavior, action return shapes, and path invalidation. |
| Dashboard | [Dashboard loader](../actions/dashboard.ts) aggregates the Monthly Snapshot over the entire selected local month. Extract its actual totals for both clients. [Forecast actuals](../lib/forecast/actuals.ts) use an account-local as-of cutoff, so those figures do not define this endpoint. |
| Dates and validation | Reuse [month ranges](../lib/dates/month.ts), [time-zone helpers](../lib/dates/time-zone.ts), [transaction validation](../lib/validators/transaction.ts), and existing category ID validation. The transaction Zod schema constructs Prisma Decimal values and stays server-side. |

## Repository And Native Application Structure

Proposed paths. File names inside each area may follow the selected Expo SDK.

```text
app/api/v1/                   Next.js handlers for mobile
actions/                      existing web entry points
lib/server/                   shared operations by domain
lib/auth/                     web auth and separate native session code
lib/validators/               authoritative server validation
prisma/                       existing schema and future additive migrations
tools/google-proof-verifier/  isolated single-instance verifier for device tests
mobile/
  src/app/                    Expo Router root, sign-in, setup handoff, app routes
    (app)/                    snapshot, transactions, add expense, account
  src/features/               screens, form logic, and domain-specific components
  src/components/ui/          native buttons, fields, feedback, and list rows
  src/api/                    HTTP client, v1 types, errors, and request helpers
  src/auth/                   Google adapter, credential storage, session state
  src/query/                  query client and account-scoped query keys
  src/theme/                  CashContour semantic colors and typography
  tests/                      native unit and component tests
  app.json                    Expo configuration and development identifiers
  app.config.js               optional development OAuth and verifier configuration
  eas.json                    build profiles
  package.json                isolated scripts and SDK-matched dependencies
  package-lock.json           mobile lockfile
  tsconfig.json               Expo TypeScript settings
```

Keep installs, scripts, React resolution, and test tooling isolated by app. The
root TypeScript globs and ESLint config must exclude `mobile/` when it is added.
Keep the Vercel project root, Prisma generation, and root lockfile on the
existing web path. Run EAS from `mobile/`. Start with typed JSON DTOs and contract
fixtures. Promote a shared dependency-free contract only if actual consumers
benefit. Native code must never import Next.js, generated Prisma, Server Actions,
or server environment modules. [Expo SDK compatibility](https://docs.expo.dev/versions/latest/) · [EAS app directory guidance](https://docs.expo.dev/build-reference/build-with-monorepos/)

Use **TanStack Query** for account data, focus refresh, pagination, and mutation
invalidation. It fits the four related read surfaces and avoids hand-maintaining
cached pages. Put session bootstrap and authentication state in one context with
a small state machine. Keep filters and the expense draft in route or component
state. Use a fresh in-memory QueryClient per authenticated session lifecycle,
including when the user switches accounts. Gate screens until SecureStore
hydration and `/me` resolve. Cancel requests, clear cached data, and fence late
results on logout or account switch. Revalidate on foreground and user refresh.
While in the foreground, detect the account-local date changing using the saved
zone and refetch server preferences and month-sensitive data. Preserve a
user-edited date when rolling over the untouched form default. Keep successful
reads available in memory during a refresh error. [TanStack Query on React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)

Use CashContour's semantic color roles, light/dark hierarchy, Inter for UI text,
and JetBrains Mono for financial emphasis. Use native navigation, accessible
touch targets, a virtualized list, date and category pickers, and keyboard-safe
entry. Give loading, empty, failure, and saved states distinct feedback. Show
server field errors next to the matching controls and retain the draft during
recoverable errors. [Design System](DESIGN_SYSTEM.md)

## Authentication Strategy

### Google Sign-In For The First Milestone

**Recommended flow** — Use native Google sign-in to exchange a Google ID token
for a CashContour mobile session. It lets users sign into their existing
accounts and keeps NextAuth and its callback unchanged. Native sign-in adds
platform credentials, build configuration, and a separate session lifecycle.
The system-browser fallback uses a dedicated server-owned Google authorization
flow with the same existing-account lookup. It preserves the NextAuth browser
flows and can use a first-party HTTPS Google callback. The backend issues a
single-use app handoff code bound to app state and an S256 PKCE verifier. Use
provider state and nonce for Google verification, and a registered app link
and fixed callback allowlist for the return to the app. The app redeems the
handoff code for a mobile session through HTTPS. Browser auth adds cross-app
return handling and handoff state. Account provisioning still goes through the
separate web flow. [Expo Google authentication](https://docs.expo.dev/guides/google-authentication/) · [OAuth for Native Apps](https://www.rfc-editor.org/rfc/rfc8252)

**Verified on Android, provisional on iOS** — Task 4B pins
`react-native-nitro-google-signin@2.3.1`. The signed Android development
build proved that a fresh server nonce reaches the signed ID token, including
after cancellation and a second attempt. The tagged source passes the
configured nonce to iOS GoogleSignIn's interactive API. The silent restore
path can return a cached token and is unsuitable for a fresh exchange.
Verify nonce binding on a signed physical iPhone before iOS release.
Allow one interactive attempt at a time so each nonce stays paired with its
challenge. If the iOS combination cannot prove that binding, verify the
documented nonce-capable Universal Sign-In option and its licensing or use
the browser handoff. Keep nonce validation mandatory on every exchange.
[Tagged iOS source](https://github.com/react-native-nitro-google-sign-in/google-signin/blob/v2.3.1/ios/HybridNitroGoogleSignin.swift#L212) · [Tagged Android source](https://github.com/react-native-nitro-google-sign-in/google-signin/blob/v2.3.1/android/src/main/java/com/nitrogooglesignin/GoogleSignInController.kt#L318) · [Universal Sign-In nonce support](https://react-native-google-signin.github.io/docs/security)

- **iOS.** Register the intended bundle ID and iOS OAuth client, configure its
  reversed client-ID callback scheme and Google SDK configuration, and use an
  EAS development build signed for registered iPhones. Confirm the configured
  backend audience and signing team. [Google Sign-In for iOS](https://developers.google.com/identity/sign-in/ios/start-integrating)
- **Android.** Register the package name and SHA-1 of the certificate that
  signs each installed variant. Include the Play App Signing fingerprint for
  a later Play build. Use a Credential Manager-compatible SDK and a Google
  Play Services device or emulator image for development. [Android Credential Manager](https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation) · [Google OAuth client setup](https://support.google.com/cloud/answer/6158849)
- **Backend.** Configure a dedicated mobile server client ID per environment
  where supported and pin the expected audience and permitted presenter for
  that environment. Verify Google signing keys, issuer, audience, expiration,
  expected signed nonce, and a nonempty subject. Validate `azp` where applicable
  against the actual platform registrations. Use Google's maintained server
  verifier and explicitly enforce the remaining claim checks. Use only the
  ID token for the exchange. Google API scopes and offline Google grants are
  unnecessary for the pilot. Native OAuth client IDs and the API origin are
  public configuration. Server secrets remain in the backend. [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) · [Google backend verification](https://developers.google.com/identity/sign-in/ios/backend-auth)

Issue a cryptographically random challenge ID and nonce with a recommended
five-minute lifetime. Store the expected nonce digest and expiry durably across
instances. After verification, consume the challenge atomically with session
creation, or consume it on a verified exchange with no linked account. Resolve
the user through `Account(provider="google", providerAccountId=verified sub)`.
NextAuth v4 maps the Google profile ID from `sub`. A valid subject with no account
can open the official web sign-in flow and try native sign-in again afterward.
After sign-in, `/me` directs incomplete accounts to the environment's fixed
web `/setup` URL in the system browser. The browser uses its own web session.
On return, re-read `/me` with the existing native session. Authentication tokens
never travel through setup links. [NextAuth Google provider at 4.24.13](https://github.com/nextauthjs/next-auth/blob/next-auth%404.24.13/packages/next-auth/src/providers/google.ts)

### Mobile Session Lifecycle

- Issue per-device **opaque random tokens** with at least 256 bits of
  randomness. Store only digests and expiry/revocation metadata on the server.
  A database lookup per protected request is acceptable for the pilot and
  lets logout or administrative revocation take effect on the next request.
  Use token-purpose separation and environment-specific configuration.
- Start with **10-minute access**, **14-day refresh inactivity**, and a
  **30-day absolute session limit**. The access limit bounds use of a leaked
  access credential. The inactivity window supports occasional tracking and
  expires abandoned sessions. The absolute limit requires periodic Google
  sign-in. Cap each credential's expiry at the session deadline. These are
  initial pilot values to review against recovery and usage.
- Verify the access digest, current expiry, session state, and associated
  user on every protected request. A refresh rotates the pair atomically and
  invalidates the previous access token. A conditional update or transaction
  serializes concurrent refreshes. Retain consumed refresh digests until the
  session deadline. Reuse revokes the associated session and its credentials.
  Inspect expired-row cleanup with the migration. Bounded cleanup can run
  opportunistically without introducing a background job. [OAuth Security BCP](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14)
- Keep the access token in memory and the refresh token in `expo-secure-store`
  in a device-only slot scoped to the app environment. Configure Android
  backup exclusion and handle iOS Keychain persistence across reinstall.
  Attempt one serialized refresh on cold start or a protected request's
  `401`, then replay that request at most once. Keep the same idempotency key for
  a replayed write. Persist the new refresh token before exposing the successful
  session. Definitive refresh rejection clears auth and prompts for Google.
  A network error leaves credentials intact and offers retry. If a refresh
  response is lost after rotation, replay detection can require new sign-in.
  [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- Sign out on the current device, revoke its session using the refresh
  credential, and clear SecureStore, memory credentials and queries. Coordinate
  sign-out with in-flight refresh so its response cannot restore local state.
  Clear local state even when the network is unavailable. If the server cannot
  confirm revocation, tell the user that the device signed out locally and
  remote revocation could not be confirmed. Other devices and the web session
  retain independent credentials. A recognized rotated token may revoke its own
  session at logout, including in a refresh/logout race.

### Future Passwordless Identity And Distribution

Keep one stable internal `User.id` and attach verified provider identities
using their issuer/provider namespace and stable subject. Store contact email
separately from proof of identity. A future link starts from an authenticated
CashContour session, requires recent proof of control of the existing account
and fresh proof of the new method, and asks for explicit consent. Bind pending
link intent to that session, use uniqueness to reject a credential already
linked elsewhere, and preserve existing NextAuth relationships and financial
rows. Route an ambiguous match into an explicit recovery process. Email
equality alone never authorizes linking, including Apple's relay addresses.

The approved product sequence is Google first, then email magic links on web
and mobile, Sign in with Apple, and potentially Facebook Login. Future magic
links need single-use, expiring proof and a separate verified identity
association. Future Apple and Facebook flows use provider subjects. Bring
the compliant iOS option forward if App Review requires it. Password-based
registration, storage, reset, and sign-in are excluded. [Authentication roadmap](ROADMAP.md#authentication-roadmap)

The internal MVP uses an EAS development build on Android. Signed iOS device
verification is a separate release gate. Before public iOS submission,
resolve App Review Guideline 4.8 for CashContour's primary account login.
Evaluate Sign in with Apple, an equivalent login that meets the guideline's
privacy and consent conditions, and any documented exception. The public login
choice remains open. External TestFlight has its own review and distribution
path. For public releases, validate privacy policy,
data disclosures, and reviewer access. Reassess account deletion if either app
offers account creation or links users into a signup flow. Apple requires
in-app initiation when the app supports account creation. Google Play requires
an in-app path and a web request resource when its account deletion rule applies.
[Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Apple account deletion](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/) · [TestFlight](https://developer.apple.com/testflight/) · [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) · [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)

## Version 1 API Contract

Use Node.js App Router Route Handlers, HTTPS, JSON bodies with
`Content-Type: application/json`, and `Cache-Control: private, no-store` on
successes and errors. Implement schema validation at the route boundary and
reuse the domain validators. Reject unknown JSON fields, duplicated singleton
query params, unsupported filters, and malformed inputs. Treat IDs as opaque
strings on the client. Give each request an opaque correlation ID. Keep
financial payloads, authorization headers, Google claims, and credential
bodies out of logs, analytics, and crash reports.

```ts
type Success<T> = { data: T }
type Failure = {
  error: { code: string; message: string; fieldErrors?: Record<string, string[]>; requestId: string }
}
type Tokens = {
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
  refreshTokenExpiresAt: string
}
type TransactionType = "INCOME" | "EXPENSE"
type CategoryRef = { id: string; name: string; type: TransactionType; isArchived: boolean }
type SubcategoryRef = { id: string; name: string }
type Transaction = {
  id: string
  type: TransactionType
  amount: string
  localDate: string
  category: CategoryRef
  subcategory: SubcategoryRef | null
  source: string | null
  note: string | null
}
type AccountPreferences = {
  currency: string
  timeZone: string | null
  hasCompletedSetup: boolean
  setupStatus: "SETUP_REQUIRED" | "TIME_ZONE_REQUIRED" | "COMPLETE"
  localDate: string | null
  currentMonth: string | null
}
type Dashboard = {
  month: string
  localDate: string
  currency: string
  actualIncome: string
  actualExpense: string
  netLeft: string
}
type TransactionPage = {
  month: string
  currency: string
  items: Transaction[]
  nextCursor: string | null
}
type CreateTransaction = {
  type: TransactionType
  amount: string
  localDate: string
  categoryId: string
  subcategoryId?: string | null
  source?: string | null
  note?: string | null
}
```

All timestamps named `expiresAt` or ending in `ExpiresAt` are ISO 8601 UTC
instants. Local dates are `YYYY-MM-DD` and months are `YYYY-MM`. Response
schemas below describe the `data` value. The logout response has an empty body.

| Endpoint | Authentication and request | Success |
| --- | --- | --- |
| `POST /api/v1/auth/google/challenge` | Public. Empty JSON object. | `200 {challengeId, nonce, expiresAt}` |
| `POST /api/v1/auth/google/exchange` | Public. JSON `{challengeId, idToken}`, both nonempty, bounded strings. Verify the provider token and consume the challenge once. | `200 Tokens` |
| `POST /api/v1/auth/refresh` | JSON `{refreshToken}` is the credential. Accept only the server-issued opaque format. | `200 Tokens` with the rotated pair |
| `POST /api/v1/auth/logout` | JSON `{refreshToken}` is the credential. Revoke only the matching session and make repeat requests safe. | `204` for a well-formed token whether the session is already absent or was revoked |
| `GET /api/v1/me` | Mobile bearer. Available before setup. | `200 AccountPreferences` |
| `GET /api/v1/dashboard` | Mobile bearer and complete setup. Current account month, with an empty query. | `200 Dashboard` |
| `GET /api/v1/transactions` | Mobile bearer and complete setup. Optional `month`, `type`, `categoryId`, `subcategoryId`, `limit`, `cursor`. | `200 TransactionPage` |
| `POST /api/v1/transactions` | Mobile bearer and complete setup. Require a UUIDv4 `Idempotency-Key` header and a `CreateTransaction` JSON body. | `201 {id}` for both the first successful operation and a matching retry |
| `GET /api/v1/categories` | Mobile bearer and complete setup. Optional `type` and `includeArchived=true\|false` (default false). | `200 {items: Array<CategoryRef & {subcategories: SubcategoryRef[]}>}` |

**Setup and ownership.** Resolve `Authorization: Bearer <accessToken>` into a
server-trusted internal user for each data request. Web cookies are not an
alternative credential on these endpoints. `/me` returns the persisted
`hasCompletedSetup` flag and a derived `setupStatus`. Use `SETUP_REQUIRED`
when setup is incomplete, `TIME_ZONE_REQUIRED` when completed setup lacks a
valid confirmed time zone, and `COMPLETE` otherwise. Return nullable `timeZone`,
`localDate`, and `currentMonth` when the zone is unavailable. Financial routes
require `COMPLETE` independently of the app's screens. Look up every category,
subcategory, and transaction within that user's scope, with subcategory
ownership inherited from the parent category. A cross-account ID and an
unknown ID yield the same field error.

**Lists.** A first request with no month uses the server's current account
month. Filter within the half-open local date range and allow type, category,
and subcategory independently. Validate supplied IDs within the user's scope
and reject incompatible type/category or category/subcategory combinations.
Use 25 rows by default and require a limit from 1 through 100. Order by
`(localDate, createdAt, id)` descending. Use a signed, opaque, versioned cursor
bound to the internal account and normalized filters. Use a strict tuple
comparison so deleting the cursor row does not break the next request.
Return the resolved month and require clients to carry it on continuation,
including across midnight. Return `nextCursor: null` on the last page. A
malformed or mismatched cursor returns the same `INVALID_CURSOR`. Pages are
live reads with stable ordering. Refresh from page one after external edits
or a filter change. Use historical category data where needed for filters or
rows. Category results use type/name/ID order and subcategory name/ID order.

**Creates and money.** Use the existing Zod date, type, classification, and
text rules. Accept a positive plain decimal string with at most two
fractional digits and a value at most `999999999999.99`. Validate the amount
before writing so invalid precision gets a field error. Apply the API
string-only and range checks at the boundary while preserving the web
action interface. Represent all persisted amounts and totals as Prisma
`Decimal`, including negative net results. Serialize to fixed two-place
strings, including `"0.00"`. Format amounts with the account currency at
display time, with device tests for rounding and large or signed values.
Compute dates with the confirmed account time zone. Store the chosen calendar
date as provided after validation and use the server date as the form default.
The category must be owned by the current user and match the transaction type.
The optional subcategory must belong to that category. New-entry pickers list
active categories. Preserve the web create behavior for a valid category that
becomes archived before save. An archive status restriction on the write
requires a separate product decision. Trim optional text and normalize blank
values with the same rules as web. [Transaction validator](../lib/validators/transaction.ts) · [Month range helper](../lib/dates/month.ts)

**Dashboard totals.** Share the existing selected-month aggregation using
actual transactions only. Use one account date context per response. Reuse
the full-month filter, which can count a future-dated transaction in the
current month. Subtract Decimal expenses from Decimal income. Planned templates
and Total Balance adjustments have no effect on these totals. A paid or
received plan already represented by an actual transaction contributes through
that row once. A mobile expense creates an ordinary transaction, leaving
planned occurrence state untouched. [Monthly Snapshot loader](../actions/dashboard.ts)

**Idempotency.** Reserve a unique receipt by `(userId, operation, key)` in the
same database transaction as classification validation and the transaction
insert. Store a digest of the canonical validated request and the original
transaction ID. Normalize Decimal strings, optional nulls, and trimmed fields
consistently. After an already committed receipt, return the stored result
before rechecking mutable category state. For a concurrent uniqueness conflict,
read the committed receipt after rolling back the losing transaction and
compare the digest. Return `409` for a different payload with the same key.
Validation failures roll back the receipt. Distinct keys can record identical
legitimate transactions. Start with account-lifetime retention for these
minimal receipts, without a cascading relation from the transaction, so retries
after edit or deletion cannot insert a second row.

Generate one key per submission. Keep the draft and key together in memory for
an ambiguous timeout. Disable parallel save and reuse the key only when
retrying that submission. When the request outcome is unknown and the draft
changes, require the user to reconcile the previous save in the transaction
list before starting a new submission. Persist no offline write queue. If the
app was interrupted after dispatch, keep a pending marker with the affected
month and request key in the same SecureStore session slot, without amounts or
notes. Carry it through token rotation and clear it on an account switch.
On restart, ask the user to refresh and check that month's list before
creating a replacement. Never automatically dispatch a pending write.

**Response and error policy.**

| HTTP | Codes and behavior |
| --- | --- |
| `400` | `INVALID_REQUEST` for bad JSON, unsupported fields, invalid query syntax, or a missing or malformed idempotency key. `INVALID_CURSOR` for unacceptable continuations. |
| `401` | `UNAUTHENTICATED` for missing, expired, revoked, or invalid access/refresh credentials. `GOOGLE_AUTH_FAILED` for invalid Google proof or an expired/replayed challenge. Protected data responses include `WWW-Authenticate: Bearer`. Give generic messages without claim or session details. |
| `403` | `WEB_ACCOUNT_REQUIRED` for a fully verified Google subject without an existing account. `SETUP_REQUIRED` for financial requests from an incomplete account. Use `/me` to determine the next screen. |
| `409` | `IDEMPOTENCY_CONFLICT` for a previously committed key with a different canonical payload. |
| `415` | `UNSUPPORTED_MEDIA_TYPE` for a JSON endpoint with an unsupported request content type. |
| `422` | `VALIDATION_FAILED` with safe field messages for invalid dates, amounts, categories, incompatible filters, and other domain values. |
| `429` | `RATE_LIMITED` with `Retry-After`. |
| `500` / `503` | `INTERNAL_ERROR` or `TEMPORARILY_UNAVAILABLE`. Keep details in redacted server diagnostics and show a retry action for recoverable failures. |

Bound JSON sizes before parsing, with a proposed 16 KiB limit on these small
bodies and `413 REQUEST_TOO_LARGE` above it. Apply the
[shared pilot rate-limit policies](MOBILE_RATE_LIMITS.md#pilot-policies),
including the full challenge-lifetime budget. Tune thresholds with pilot
traffic and validate shared-network behavior.
Authentication and validation failures map to their own errors. Provider
outages and database failures return service errors. Keep access checks
effective when the limiter or database is unavailable.

## First Milestone Acceptance

Verify this journey on Android for the internal MVP. Repeat physical device
acceptance on a signed iPhone before iOS release.

1. Install the internal signed Android development build. Existing
   fictional-data web accounts can sign in and resolve to the same internal
   user as on the web. A canceled Google attempt is recoverable. Invalid
   proof fails without account information.
2. An unknown Google subject creates no user, account, or mobile session.
   Incomplete setup and legacy unconfirmed time zones open the existing web
   setup flow. Financial reads and writes are gated until setup completes.
3. An expired access credential renews once with an active refresh token.
   A revoked or expired session returns to sign-in. Online logout revokes the
   current mobile session. A second mobile device and the browser remain
   usable. A subsequent account sees only its own data.
4. The current month's income, expenses, and net match the web Monthly
   Snapshot. A date boundary follows the account time zone even when the
   device uses another zone. The list supports filters, stable pagination,
   and archived history.
5. Submit a valid expense with an active compatible category and optional
   owned subcategory. Show save feedback, refresh dashboard and list, and
   find the same transaction on a fresh web request. The exact expense value
   increases the expense total and reduces net. Wrong-type or foreign IDs
   fail without writing. Network retries and duplicate taps commit one row.
6. Empty, loading, initial error, retry, stale refresh, and in-flight save
   states are verifiable. A failed save keeps the draft, and a success
   remains visible even if a downstream refresh needs retry. The existing
   web login, setup, transaction actions, financial sections, and deployment
   pass their regression checks with fictional and isolated test data.

**Deferred scope.** Native account registration and onboarding, email magic
links, Apple and Facebook sign-in, native editing/deletion, offline writes,
bank synchronization, push notifications, the full forecasting dashboard,
Insights, planned bill and income management, CSV import/export, subscriptions,
and monetization. Public store distribution is separate from this milestone.

## Implementation Tasks

### 1. Extract The Shared Account Preferences Read

- **Objective and dependency** — Smallest first coding task, with no
  dependency on Expo or Google Console. Separate the existing Prisma
  preferences query from web cookie resolution.
- **Files and required behavior** — Extract a server-only
  `loadAccountPreferences(userId)` under `lib/server/` and call it from
  `lib/auth/session.ts`. Keep the current wrapper shape, missing-user
  behavior, and request-scoped memoization.
- **Invariants** — Resolve the trusted web identity before loading preferences.
  Keep setup, time-zone, redirect, and financial behavior intact.
- **Tests and acceptance** — Verify correct fields for two users and existing
  missing-user handling. Check that a completed account reaches the app and a
  legacy or incomplete account reaches setup through the current web entry
  points. Scope the diff to the loader, web wrapper, and targeted coverage.
- **Risk** — A cache outside the request scope or a changed exception could
  leak preferences or break routing. Review the existing wrapper's callers.

### 2. Isolate The Expo Project And Verify Google On Devices

Task 4A establishes the isolated Expo SDK 58 foundation and welcome screen.
Task 4B adds the development-only native Google proof and its configuration.
The proof requires dedicated OAuth clients and the standalone non-production
verifier deployed behind a restricted HTTPS origin. Its in-memory challenge
store is for one test instance.

**Android device proof passed on 2026-11-25.** An internal EAS development APK
for `com.cashcontour.dev` used the EAS-managed development signing certificate.
The APK signer matched the development OAuth registration. The verifier
accepted a fresh sign-in, and the device recovered from cancellation with a
successful new attempt. The tested stack was Expo SDK 58.0.26, React 19.3.0,
React Native 0.88.1, Nitro Google Sign-In 2.3.1, and Nitro Modules 0.37.2.
**Android authentication verification is complete.** In Task 4B.6, all 14 proof
regression tests, mobile lint, and mobile typecheck passed.
**Signed iOS verification is deferred and required before iOS release.**

- **Objective and dependency** — Prove the selected Expo, React Native, and
  native Google SDK combination with non-production credentials. Requires
  approved development identifiers, signing access, and a test origin or
  local verifier. Can proceed independently of task 1.
- **Files and required behavior** — Create the future `mobile/` package and
  tooling, root TypeScript/ESLint exclusions, a development EAS profile,
  and a minimal interactive sign-in verification screen or fixture. Verify
  Google claims without printing tokens or financial data.
- **Invariants** — Use fictional-data test accounts, dedicated non-production
  configuration, and SDK-compatible native modules. Keep the root dependency
  tree, Vercel root, and web OAuth registrations stable.
- **Tests and acceptance** — Verify expected issuer, audience, subject
  resolution, and signed nonce on the exact signed Android development
  build. Exercise cancellation, reuse of an old challenge, and a new sign-in
  after cancellation. Apply these criteria to the signed physical iOS proof
  before iOS release. Record tested versions, app IDs, signing variants, and
  the chosen integration or fallback. Keep web checks isolated from mobile.
- **Risk** — Platform client IDs, signing fingerprints, callback schemes, nonce
  behavior, or Play Services can differ between development and store builds.
  Capture the verification evidence for each build type before distributing it.

### 3. Implement The Mobile Session Store And Auth Endpoints

Task 5A defines persistence, credential primitives, and transaction rules.
Task 5B implements Google identity verification and existing-account lookup.
Task 5B.1 verified the reviewed implementation offline. The
[mobile session foundation](MOBILE_SESSION_FOUNDATION.md#task-5b1-verification)
records the results, pending integration checks, and separate security triage.
Task 5C implements internal atomic lifecycle services. Task 5D.1 implements
the [durable limiter and trusted source module](MOBILE_RATE_LIMITS.md).
Task 5D.1.1 verified it offline. Task 5D.2 wires the limiter and lifecycle
services into [versioned HTTP endpoints](MOBILE_AUTH_API.md) and adds the
reusable bearer guard. Task 5D.3A confirmed the installed late-start
transaction leak. Task 5D.3B.1 aligns Prisma on `7.10.1` with the released
late-start rollback fix. Task 5D.3B.2 adds the separate mobile executor,
and Task 5D.3B.3 verifies database and pool safety. The
[independent web remediation plan](MOBILE_DATABASE_TRANSACTION_SAFETY.md#independent-web-remediation-release-plan)
keeps production authorization separate from mobile work.
Task 5E covers PostgreSQL integration and security verification. Keep the API
disabled until its operational gates are met.

- **Objective and dependency** — Add shared Google identity exchange and
  device credentials after the preferences seam and Android proof closure.
- **Files and required behavior** — Add additive migrations, validators under
  `lib/validators/`, mobile services under `lib/auth/`, and
  `app/api/v1/auth/` handlers. Implement challenge, exchange, refresh,
  logout, expiry, and account matching. Add a shared bearer-auth guard and
  v1 error serialization.
- **Invariants** — Existing web auth continues through NextAuth. Challenge
  use and token rotation are atomic. Only verified Google subjects linked
  to existing users can start sessions. Token digests and safe diagnostics
  stay on the server.
- **Tests and acceptance** — Reject bad signature, issuer, audience, expiry,
  presenter, subject, and nonce. Cover reused challenges, concurrent
  exchanges and refreshes, stolen refresh reuse, revoked credentials,
  offline/lost-response recovery semantics, and two devices with independent
  logout. Google account identity and web cookie login must still resolve to
  the existing web user.
- **Risk** — Rotation and logout races, provider misconfiguration, and migration
  order can invalidate sessions or allow unintended auth. Review state
  transitions and run integration tests on PostgreSQL.

### 4. Add The Account Endpoint And Native Session Gate

- **Objective and dependency** — Connect the Expo session bootstrap to the
  approved Google flow and shared preferences. Depends on tasks 1–3.
- **Files and required behavior** — Add `app/api/v1/me/route.ts`, shared setup
  guard, native auth and HTTP modules, and Router sign-in/setup/account
  screens. Implement SecureStore hydration, single-flight renewal, the
  official web setup handoff, and logout.
- **Invariants** — Route protection runs server-side. Browser setup uses its
  own authenticated session. Expired or switched accounts must stop displaying
  the previous account's data immediately.
- **Tests and acceptance** — Cover cold start, rejected or failed refresh,
  refresh/logout race, late response on account switch, legacy time zone,
  completing web setup, and wrong or unknown Google account. Verify routing
  and recovery from temporary connectivity losses on Android for the MVP
  and on signed iOS before its release.
- **Risk** — A delayed refresh, cached profile, or app link can bypass UI
  gating if treated as authorization. Validate state again on each API call.

### 5. Add Shared Reads And Versioned Data Routes

- **Objective and dependency** — Expose the actuals summary, categories, and
  filtered transaction list after the setup guard is available.
- **Files and required behavior** — Extract read operations from
  `actions/dashboard.ts`, `actions/transactions.ts`, and relevant category
  reads. Add `app/api/v1/dashboard/`, `categories/`, and `transactions/`
  GET handlers. Add serializers and pagination without changing web list
  contracts.
- **Invariants** — Every read uses trusted ownership. The same account-local
  month query and Decimal totals feed both clients. Archived history remains
  visible. Plans and adjustments cannot inflate actuals.
- **Tests and acceptance** — Verify zero and negative totals, current-month
  future dates, DST and month boundaries, filters and archive flags, repeated
  timestamps, deletion of a cursor row, and cross-account cursors/IDs.
  Compare web and API output for the same fixture.
- **Risk** — Pulling forecast queries or browser-specific DTOs into the API
  can change semantics or make the payload expensive.

### 6. Add Shared Transaction Creation And Durable Idempotency

- **Objective and dependency** — Create one ordinary transaction through the
  native write route. Depends on a working mobile guard, chosen receipt
  design, and shared transaction data contracts.
- **Files and required behavior** — Extract transaction create validation and
  write logic from `actions/transactions.ts`. Add the additive receipt
  migration, a POST handler beside the transactions GET, and web revalidation
  after commit. Preserve the web wrapper's validation and action results.
- **Invariants** — Verify owner, category type, subcategory parent, and exact
  amount before writing. Commit the new row and receipt together. Preserve
  the archive behavior and keep planned occurrences untouched.
- **Tests and acceptance** — Cover a valid expense and income, maximum precision,
  malformed values, foreign or incompatible IDs, concurrent identical keys,
  conflicting payloads, a failed write, response loss, retry after deletion,
  and a separate legitimate identical purchase. Confirm a fresh web read
  shows exactly one matching row.
- **Risk** — A receipt outside the write transaction, inappropriate retry after
  an error, or post-commit revalidation failure can lead to duplicate writes.
  Make the committed receipt the authority after an ambiguous response.

### 7. Build Native Dashboard And Transaction Views

- **Objective and dependency** — Show setup-gated account data after tasks 4–5.
- **Files and required behavior** — Add dashboard and transactions routes,
  native financial rows, filter controls, query hooks, and theme tokens.
  Expose account currency, local month, and current-month actual totals.
- **Invariants** — Presentation uses server values. Per-session QueryClient
  and request cancellation prevent cross-account display.
- **Tests and acceptance** — Cover loading, empty, error/retry, pull-to-refresh,
  pagination, type and category filters, local-midnight refetch, large and
  signed money display, and switching accounts. Check readability, touch
  controls, and screen-reader labels on Android for the MVP. Repeat those
  device checks on iOS before its release.
- **Risk** — Query keys that omit filters or account scope can display stale
  rows. Device locale/presentation code can accidentally alter dates or
  precision.

### 8. Build The Expense Form And Complete The Device Pilot

- **Objective and dependency** — Finish the end-to-end milestone after the
  write route and read screens are available.
- **Files and required behavior** — Add native expense entry, validation
  feedback, retry state, account-scoped invalidation, and device acceptance
  coverage. Preserve the draft during a failed submit, confirm the committed
  result once, then refresh the visible dashboard and list.
- **Invariants** — Use the server-provided date, active expense choices, and
  exact amount strings. Preserve key reuse for online retries. Prevent
  duplicate taps, automatic offline replay, and stale post-sign-out UI.
- **Tests and acceptance** — Execute the first milestone acceptance journey
  on Android with fictional records and repeat it before iOS release. Include
  zero active expense categories, a bad subcategory response, an interrupted
  save, and a visible web read with the same expense ID. Test logout and web
  regressions again.
- **Risk** — A save can succeed while the follow-up refetch fails. Show the
  save result and offer a data refresh without resubmitting the expense.

## Testing, Deployment, And Rollback

- **Web regression.** Use the existing targeted regression suite and
  authorized lint, typecheck, and build checks. Verify Google sign-in, both
  setup variants, transaction CRUD and filters, forecast, Total Balance,
  Insights, planned links, and existing CSV workflows. New targeted tests
  need inclusion in the root test script, which lists test paths explicitly.
  Apply the relevant independent reviewer roles in [AGENTS.md](../AGENTS.md)
  for each implementation diff.
- **Server and API.** Use unit tests for validation, serialization, dates,
  and cursor logic, with fixed instants across DST, year rollover, and
  different device zones. Use contract tests for methods, envelopes, statuses,
  cache headers, and setup state. Use a disposable PostgreSQL test target
  for unique constraints, transactional retries, rotation, revocation, and
  two-user authorization checks. Exercise exact cent boundaries, overflow,
  signed net, and months with planned activity and balance adjustments.
  Fixture tokens can cover negative cases. Real Google proof belongs in
  the small signed-device exercise with dedicated test accounts.
- **Devices and EAS.** Put EAS profiles under `mobile/`. For the pilot use
  `developmentClient: true`, `distribution: internal`, a test API origin,
  and development app/package IDs. Distribute an internal Android APK for
  the MVP. Register an iPhone for ad hoc provisioning when signed iOS
  verification resumes. Test release-style internal builds separately if
  adding a preview profile. Inspect a fresh
  archive and pass the [archive safety check](../mobile/README.md#inspect-the-eas-upload-archive)
  before every EAS cloud build.
  Keep signing credentials under their existing secure management and reserve
  a store profile for separately authorized distribution. [EAS profiles](https://docs.expo.dev/build/eas-json/) · [Internal distribution](https://docs.expo.dev/build/internal-distribution/) · [EAS upload exclusions](https://docs.expo.dev/build-reference/easignore/)
- **Non-production API.** Prefer a stable, trusted HTTPS origin reachable
  from enrolled test phones on a private tester network, serving the same
  Next.js app against the existing non-production database. Use the
  documented authenticated preview in the system browser for setup and web
  parity. If the existing protected Vercel preview must be the phone API,
  use an approved test-only gateway restricted to the tester network and
  `/api/v1/`, with any Vercel access credential held by that gateway.
  Confirm the origin before the device exercise. Preserve Vercel deployment
  protection and production/preview database isolation. Use fictional seed
  data only. Production database credentials, Google client secrets,
  NextAuth and mobile server secrets, and Vercel bypass values never enter
  app configuration. [Repository deployment guide](DEPLOYMENT.md) · [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)
- **Release order.** Review additive migrations on a disposable database and
  apply them to the non-production target before dependent Vercel code.
  Enable mobile auth and writes for the internal environment first. Check
  health with redacted request IDs, error rates, and replay/conflict counts.
  Publish the signed test build only after backend availability is verified.
  For a later production release, keep v1 response and retry contracts
  compatible with installed builds and follow the existing merge-to-main
  and manual migration process. A server-side route gate can disable native
  access or writes during an incident while the existing web remains
  available. Leave additive tables in place during app rollback, including
  idempotency receipts. A Vercel rollback does not roll back schema changes.
  [Repository deployment guide](DEPLOYMENT.md)

## Open Decisions And Verification Gates

| Gate | Recommendation and evidence required |
| --- | --- |
| Signed iOS verification | The same library is provisional on iOS. When device and signing access are available, confirm the bundle ID, OAuth callback, signed nonce, verifier acceptance, and device acceptance journey before iOS release. |
| Device API origin | Select the private HTTPS test origin and confirm browser setup and phone API requests reach the same non-production data target. The repository does not establish current external access configuration. |
| Session and idempotency operations | Review the proposed lifetimes, receipt retention, distributed rate constraints, cleanup, redacted diagnostics, and revocation procedure. Exercise lost-response and interrupted-app recovery on devices. |
| Public release and identity expansion | Confirm the iOS equivalent login option, Google Play and Apple privacy and deletion obligations, and approved linking/recovery policy before public submission. Keep those decisions separate from the internal pilot. |
