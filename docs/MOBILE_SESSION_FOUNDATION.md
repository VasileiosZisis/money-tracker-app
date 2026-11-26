# Mobile session foundation

Task 5A adds the [Prisma models](../prisma/schema.prisma), an
[additive migration](../prisma/migrations/20261126120000_add_mobile_session_foundation/migration.sql),
and server-only [credential](../lib/auth/mobile/credentials.ts) and
[expiry](../lib/auth/mobile/expiry.ts) primitives. The migration is unexecuted
and requires verification against a separately authorized disposable
PostgreSQL target. See the [active mobile plan](MOBILE_IMPLEMENTATION_PLAN.md).

Task 5B adds server-only Google proof verification and existing-account
lookup. [Task 5B.1](#task-5b1-verification) closes its offline verification gate.
Task 5C implements the [internal lifecycle services](#task-5c-service-interfaces).
Public endpoints and live integration verification remain pending.

## Identity and storage

Web sign-in continues to use NextAuth v4 JWT cookies and its existing adapter.
Native sign-ins create independent sessions for the same internal `User.id`.
After verifying a signed Google proof, resolve the unique existing
`Account(provider = "google", providerAccountId = verified sub)` relationship.
Email equality must never resolve, link, or provision an account. An unknown
subject creates no user, account, or session. The standalone device verifier
and its in-memory state, development configuration, and subject allowlist
stay isolated from the application backend.

| Model | Authority and indexes |
| --- | --- |
| `MobileAuthChallenge` | Random primary key, expected nonce digest, creation and expiry instants, nullable consumption instant. An expiry/ID index supports ordered cleanup. |
| `MobileSession` | Internal primary key, cascading `User.id` foreign key, creation instant, unique current access digest and its expiry, fixed absolute deadline, nullable revocation instant. Owner and deadline/ID indexes support owner lookup, cascade, and cleanup. |
| `MobileRefreshCredential` | Refresh digest primary key, indexed cascading session foreign key, issuance and inactivity expiry, nullable consumption instant. Every rotation leaves the consumed credential associated with its original session. |

`consumedAt IS NULL` identifies the current refresh row, whose usability also
depends on its expiry and the parent session. A partial unique index on
`sessionId WHERE consumedAt IS NULL` enforces **at most one** current refresh
row per session in PostgreSQL. Creating a session and its first refresh row
in one transaction, then consuming and replacing the row in each rotation
transaction, provides **exactly one** for every usable session. This avoids a
second current-credential pointer or a trigger. The service must preserve
this invariant on every write. The parent revocation timestamp invalidates
all of its credentials together; a client-supplied device identifier grants
no authority. [PostgreSQL partial unique indexes](https://www.postgresql.org/docs/current/indexes-partial.html)

The migration keeps the partial index in SQL to avoid opting the root Prisma
generator into the pinned CLI's `partialIndexes` preview feature. SQL checks
enforce 32-byte digests, row-local timestamp ordering, and the cap on access
expiry. Refresh expiry capping references the parent session and is enforced
by the lifecycle service using the locked parent's deadline. Preserve the
SQL-only index and checks in future migrations and inspect the actual
constraints on disposable PostgreSQL. The foreign keys touch existing data
only by referencing `User.id`; the migration creates three tables, their
constraints and indexes, and changes no existing columns or records. It is
compatible by design with the deployed web code. The existing web deployment
uses none of the mobile tables. [Prisma partial-index preview](https://www.prisma.io/blog/prisma-orm-v7-4-query-caching-partial-indexes-and-major-performance-improvements) · [PostgreSQL check constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)

## Credential encoding and time

Generate 32 bytes of independent Node.js cryptographic randomness for each
access token, refresh token, challenge ID, and nonce. Access, refresh, and
challenge ID use `ma1.`, `mr1.`, and `mc1.` followed by 43 canonical unpadded
base64url characters. The nonce uses 64 lowercase hexadecimal characters,
the format exercised in signed Android proof. Decoding checks the purpose,
length and alphabet, and requires a base64url round trip to reject aliases
in the final character. For access, refresh, and nonce, hash the decoded
bytes with SHA-256 prefixed by the UTF-8 domain
`cashcontour:mobile:v1:<purpose>` and a zero byte. Store the 32-byte digest
as PostgreSQL `bytea`. With 256 random bits per value this requires no
server signing secret and uses neither web nor Google secrets. Keep the raw
nonce, application tokens, and Google ID token out of storage and diagnostics.
The challenge ID is a lookup key and requires the matching signed nonce.

| Pilot limit | Purpose |
| --- | --- |
| 5-minute challenge | Covers an interactive Google prompt and limits the time during which proof can be exchanged. |
| 10-minute access | Bounds the usable window of a leaked access token. Rotation replaces the access digest immediately. |
| 14-day refresh inactivity | Supports occasional tracking and expires unattended sessions. Successful rotation starts a new inactivity window. |
| 30-day absolute session | Requires periodic Google sign-in. Access and refresh expiries are capped at this original deadline on every issue or renewal. |

All auth times are UTC instants stored as `timestamptz(3)`. Expiry is
exclusive: validity requires `now < expiresAt`. Durations are elapsed time
and helpers take an explicit instant so arithmetic is deterministic across
calendar and time zone changes. Reassess these values during pilot recovery
and usage verification.

## Google identity verification

The root backend pins [Google's Node.js auth library 11.3.4](https://github.com/googleapis/google-cloud-node/releases/tag/google-auth-library-v11.3.4),
the same version used in the signed Android proof verifier. It requires
Node.js 22 or later and provides typed APIs for Google certificate retrieval,
caching, and JWT signature verification. Task 5B was checked on Node.js
24.15.0. Vercel supports Node.js 22 and 24. Confirm the actual project
runtime during integration. Use the Next.js Node.js runtime for mobile auth.
[Vercel Node.js runtime versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

Set the following server-only variables separately for each mobile API
environment. These values are fictional examples.

| Variable | Example and policy |
| --- | --- |
| `MOBILE_GOOGLE_AUDIENCE` | `100000000001-example-mobile.apps.googleusercontent.com`. Set exactly one dedicated mobile server OAuth client ID. |
| `MOBILE_GOOGLE_ALLOWED_PRESENTERS` | `100000000002-example-android.apps.googleusercontent.com,100000000003-example-ios.apps.googleusercontent.com`. Set a nonempty comma-separated list of distinct approved OAuth client IDs. Include the dedicated audience itself only if it is an approved presenter. |

IDs use the lowercase Google OAuth client-ID form. Configuration accepts
surrounding whitespace and rejects empty entries, duplicates, wildcards,
and invalid IDs. The mobile verifier resolves configuration when called.
It uses neither NextAuth nor proof-verifier variables and needs no OAuth
client secret or subject allowlist. The actual audience and permitted
presenters must be confirmed before non-production integration.

Require a bounded, three-segment, canonical unpadded base64url JWT with
`RS256` and a usable key ID. The header cannot select a key-fetch location
or enable unsupported critical extensions. Use a shared `OAuth2Client`
instance with `getFederatedSignonCertsAsync` and
`verifySignedJwtWithCertsAsync`. The library selects Google's fixed HTTPS
certificate endpoint and caches keys using Google's `Cache-Control`.
Refresh the cache on its normal expiry. Unknown keys are rejected against
the current key set. The transport uses a five-second deadline, zero
retries, no redirects, and uncached server fetches so the library owns
certificate caching. Preliminary decoding can reject invalid inputs
early. A successful proof comes only from the library-verified ticket.
[Google OpenID configuration](https://accounts.google.com/.well-known/openid-configuration) ·
[Google ID token claims](https://developers.google.com/identity/openid-connect/openid-connect#an-id-tokens-payload)

| Claim | Accepted condition |
| --- | --- |
| `iss` | Exactly `accounts.google.com` or `https://accounts.google.com`. |
| `aud` | A string exactly equal to the configured dedicated audience. All arrays are rejected, including singleton arrays. |
| `azp` | When present, a string exactly matching an allowed presenter. An absent claim is allowed with the configured single audience. Google describes this claim for cases where the requesting party differs from the audience. No presenter is inferred from client metadata. |
| `sub` | 1–255 visible ASCII characters. Preserve the exact case-sensitive value. |
| `exp` | Positive integer epoch seconds. Must be strictly after now and less than 24 hours in the future, even if the library would accept a recently expired token within its five-minute tolerance. |
| `iat` | Positive integer epoch seconds, strictly before expiration, and at most five minutes ahead of the server clock, matching the library's issued-at tolerance. |
| `nbf` | Optional. If present, positive integer epoch seconds at or before the current instant, with no tolerance. |
| `nonce` | A signed, canonical 64-character lowercase hexadecimal value whose 32-byte digest matches the independently provided challenge digest in constant time. The expected digest must itself be exactly 32 bytes. |

The internal proof exposes only the exact subject, expiration epoch
milliseconds, and a copy of the verified nonce digest. The verifier marks
the original immutable proof object as trusted for the account resolver.
The resolver takes that proof, selects only `userId` by the existing unique
`(provider, providerAccountId)` key for `("google", subject)`, and can
receive the Task 5C transaction client. It performs no writes or email
lookups. The resolver finds a candidate mapping. Task 5C must still pin the
user and mapping, then recheck the proof expiration and nonce digest against
the locked challenge before committing.

| Internal outcome | Planned Task 5D handling |
| --- | --- |
| Invalid proof (including bad signature) or missing, invalid, or mismatched signed nonce | Generic `401 GOOGLE_AUTH_FAILED`. |
| Missing or invalid mobile server configuration, malformed stored digest, or unclassified verifier exception | Generic `500 INTERNAL_ERROR`. |
| Google certificate retrieval failure, timeout, invalid certificate map or entry type, or unavailable database | Generic `503 TEMPORARILY_UNAVAILABLE`. |
| Verified Google subject without a linked account | `403 WEB_ACCOUNT_REQUIRED` after Task 5C commits challenge consumption. |

The library throws ordinary errors for cryptographic rejection, sometimes
including JWT data. The pinned version's exact negative-signature error for
the current input maps to invalid proof. Unexpected exceptions during
verification fail closed as internal errors. Certificate-stage failures
are classified separately from signature rejection. The verifier disables
the library's default request and response logging interceptors. Diagnostics
and outcome objects omit raw exceptions, tokens, subjects, nonces, and
digests. The successful proof stays internal.

### Task 5B.1 verification

The independently reviewed commit `5aa68443ef50945b02e04e5961e2e4881ade9629`
on `mobile-dev` passed root `npm run typecheck`, `npm run lint`, and `npm test`
(238 of 238). The tests exercised Google's actual RSA signature verification
using synthetic keys and an offline certificate transport.

- **Google integration** — The actual mobile OAuth audience and allowed
  presenters await confirmation. Live Google verification and certificate
  retrieval remain unverified.
- **Persistence at Task 5B.1** — Prisma client generation from the Task 5A
  schema was still unverified. Task 5C validated and generated the client
  offline. PostgreSQL migration and concurrency verification are pending.
- **Deployment** — The Vercel project's actual Node.js runtime remains
  unconfirmed.
- **Dependency security** — The Task 5B audit reported 47 findings on
  existing package entries and none on the new entries. The findings
  require separate security triage.
- **iOS release** — Signed physical iOS verification remains mandatory.

### Task 5C service interfaces

The [session services](../lib/auth/mobile/session-service.ts) and
[cleanup service](../lib/auth/mobile/cleanup-service.ts) run on the server.
The installed Prisma 7.5.0 CLI validated the schema and generated
`MobileAuthChallenge`, `MobileSession`, and `MobileRefreshCredential`
using a temporary config and fictional loopback URL. The config was removed.
The migration remains unapplied.

Root lint and all 261 regression tests passed, including 23 offline
lifecycle tests. The authorized typecheck flagged the grouped account
lookup result type. After the correction, the product owner confirmed that
`npm run typecheck` passed on reviewed commit
`4da611232d70f81638f1670234787b42bb2af227`.

| Internal operation | Successful result and rejection behavior |
| --- | --- |
| `issueMobileAuthChallenge()` | Returns the challenge ID, nonce and expiry after the digest row commits. |
| `exchangeMobileGoogleProof({ challengeId, idToken })` | Verifies Google proof outside the transaction, then consumes the locked challenge with either an initial token pair or a committed `account_not_linked` outcome. Rejected proof and nonce mismatches leave an unused challenge available. |
| `authenticateMobileAccess(accessToken)` | Uses one fresh SQL statement to check the current digest, both expiries, revocation and the associated user. Returns only `userId` and `sessionId` on success. |
| `rotateMobileRefresh(refreshToken)` | Atomically consumes the current credential, inserts its successor, and replaces access. A recognized predecessor presented again revokes only its session before returning `credential_reused`. |
| `logoutMobileSession(refreshToken)` | Revokes the session for a recognized current or rotated credential. A well-formed unknown credential or terminal session returns the same idempotent success. A malformed credential is distinguishable for API validation. |
| `revokeMobileSessionById(sessionId)` | Revokes one live session under the same parent lock and returns `no_change` for an absent or terminal session. This is a persistence operation for trusted callers. |
| `cleanupExpiredMobileAuthRecords()` | Returns committed deletion counts. One invocation locks at most 50 expired challenges and 20 absolutely expired sessions in deadline/ID order, and deletes at most 200 refresh rows across those parents. A parent is deleted only when its history is empty. |

Session mutations use Read Committed interactive transactions configured with
a two-second Prisma startup wait, a five-second transaction timeout, a
1.5-second PostgreSQL lock timeout and a three-second statement timeout.
The [installed adapter startup limitation](MOBILE_AUTH_API.md#ordering-and-database-limits)
blocks enablement. Final checks and writes use the same PostgreSQL wall-clock
sample after the locks. Access authentication uses one wall-clock sample
in its own statement. Tagged Prisma queries bind values separately from SQL.

Transaction or commit failures return `database_unavailable`. A changed
account mapping uses the same retryable service result. Operations never
return secrets on failure, and there is no automatic retry of an ambiguous
transaction. A caller that reuses a consumed refresh credential after a lost
response can be required to sign in again. Task 5D should serialize
`credential_reused` and other refresh rejections as the same generic
`401 UNAUTHENTICATED`, and handle database failures as
`503 TEMPORARILY_UNAVAILABLE`. Application credentials and nonces are
returned only after successful persistence. Raw database exceptions,
Google proofs, SQL parameters and credential digests are excluded from
service diagnostics.

Cleanup holds the selected parent locks until the child and empty-parent
deletes finish. It rechecks expiry after selection. A future caller can
invoke a single batch through an authorized maintenance operation or under
a bounded opportunistic rate limit. Keep it separate from token transactions
and independent of auth success. This task introduces no scheduler.

Before exposing an operator action, require an authenticated operator with
explicit revocation permission and resolve the target session through a
trusted lookup. Record a redacted incident reference, operator reference,
time, and committed outcome in a restricted audit trail. Exclude credentials,
digests, Google claims and raw database errors. After suspected credential
exposure, confirm revocation through the authorized process and direct the
affected device to fresh Google sign-in. This operational procedure remains
unimplemented and untested.

## Task 5C transaction and locking rules

Use short PostgreSQL Read Committed transactions. Perform Google verification
outside the transaction. Take the challenge row lock before final consumption.
For linked exchange, resolve the Google key, lock the matching user with
`FOR KEY SHARE`, then lock and recheck the exact Account mapping with
`FOR SHARE` before inserting the session. This orders user and account locks
with user deletion and keeps a verified mapping stable through commit. If a
previously found mapping disappears or changes before it can be pinned, abort
and re-evaluate from a fresh transaction or return a retryable service error.

For refresh and logout, first look up the digest to find a candidate session
ID. Lock that parent with `FOR UPDATE`, then reread the credential by its
digest and locked session ID in a separate statement, so a waiter sees any
rotation that just committed. Administrative revocation and cleanup take
the same parent lock before changing session state or history. After obtaining
the relevant locks, sample `date_trunc('milliseconds', clock_timestamp())`
once and use that instant for the final expiry checks and timestamp writes.
The transaction-start time can be stale after a lock wait.

The locked transition determines the order of competing writes and commit
publishes the result. A read of the current access digest begun after a
rotation or revocation commits sees the new state. An already authorized
request can be in flight when revocation commits. The unknown-account lookup
is authoritative at the read that finds no matching entry; a concurrent web
account link can then be used with a new challenge. Return raw credentials
only after a successful commit. Treat a database or provider failure as a
service error.
[PostgreSQL Read Committed](https://www.postgresql.org/docs/current/transaction-iso.html) · [PostgreSQL locking clauses](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)

### Transitions and future regression matrix

These cases require separately authorized integration tests with independent
connections and controlled lock barriers on disposable PostgreSQL. The
[offline lifecycle suite](../lib/auth/mobile/session-lifecycle.test.ts)
checks service outcomes, bound SQL values, statement order, and simulated
rollback and commit errors. PostgreSQL locking, isolation and rollback still
require live integration verification.

| Transition | Preconditions, ordering, and committed outcome | Rejection and future coverage |
| --- | --- | --- |
| Issue challenge | After API validation and rate checks, insert one row with a new ID, nonce digest, and expiry. Return the nonce and ID after commit. | Failed insert issues nothing. Test visibility on a second connection and rejection of duplicate IDs. |
| Linked Google exchange | Verify Google signature and claims first. In one transaction, lock the live unused challenge, pin the account mapping, and recheck challenge and signed proof expiry. Compare the signed nonce digest to the stored digest with a constant-time comparison. Consume the challenge and create the session plus its initial refresh row together. | A failed insert rolls back consumption. Test exact Google subject mapping, same-email different subjects, concurrent unlink or user deletion, and injected failures before commit. |
| Unknown Google subject | The same valid proof and locked challenge checks pass. An absent Google account mapping means commit consumption alone. | Return `WEB_ACCOUNT_REQUIRED` after commit. Test zero user/account/session inserts and rejection of a replay. |
| Invalid proof, expired challenge, and exchange race | Invalid signatures or claims leave a valid challenge available. A missing, expired, consumed, or nonce-mismatched challenge cannot transition. Competing valid exchanges serialize on the challenge row, then check its current state. | Test a bad attempt followed by valid proof, exact expiry including a lock wait across the deadline, mismatched nonces, and two simultaneous valid exchanges with exactly one committed consumption. |
| Rotate a current refresh credential | After the parent lock and reread, require an unrevoked, unexpired session and a live, unconsumed refresh credential. Set its consumption time, insert the successor with capped expiry, and update the parent access digest and expiry, all in one transaction. | Old access fails after commit. Test rollback at each write, the partial index under concurrent insert, and that renewal leaves the absolute deadline fixed. |
| Concurrent refresh, consumed-token reuse, or lost response | Check for consumed history on the locked, unrevoked session before the credential's own expiry. A second use revokes that entire session, even when the predecessor's individual inactivity expiry has passed. Commit the revocation by returning a rejection outcome from the transaction callback, then map it to an auth error outside that callback. | Throwing the auth error inside the transaction would roll back revocation. Test two requests using one credential, replay of multiple generations, replay after individual expiry, and a lost response followed by reuse. Verify the successor fails after revocation, another device still works, and no grace period accepts reuse. The client serializes refreshes and can require fresh Google sign-in after response loss. |
| Access, inactivity, and absolute expiry | Each access check reads the current digest, expiry, revocation, deadline, and associated user in a fresh DB query before deriving authority. For refresh, an expired unconsumed credential cannot rotate. At the absolute boundary no credential can authorize access or refresh, even if its row is retained. | Test one millisecond before, at, and after each deadline, a wait across the deadline, and expired/revoked/deleted users or sessions. An expired credential yields no replacement. |
| Logout with current or rotated credential | A recognized digest for a session before its absolute expiry can revoke that session regardless of the digest's own expiry or consumption. With the same locked parent and reread as refresh, set the timestamp once and commit. If refresh won the lock first, retained history lets logout revoke the successor. If logout won, refresh sees revocation. | Well-formed unknown, already revoked, or absolutely expired credentials get the same idempotent result. Test both lock orders, repeated logout, rotated logout after individual expiry, and isolation from other devices and web cookies. |
| Administrative revocation | A separately authorized operator targets a trusted internal session ID. Lock that session and commit its revocation timestamp once. Refresh uses the same lock and checks the resulting state, even if it acquired the lock first and already rotated. | Missing or terminal sessions require no change. Test permission, durable audit, repeat behavior, concurrent refresh, and the other sessions for the same user. |
| Delete user | The existing user deletion transaction cascades to all mobile sessions and refresh history. If deletion wins the race with exchange, no new session can point to the deleted user. If exchange wins first, deletion cascades to the new session as well. | Test referential constraints, exchange and refresh races with deletion, credential rejection after commit, and another user's isolation. |
| Bounded cleanup | In short transactions, select expired challenges or absolutely expired sessions in indexed deadline/ID order with a fixed limit and `FOR UPDATE SKIP LOCKED`. Delete selected expired challenge rows. For selected sessions, delete at most a fixed batch of refresh rows across those locked parents, then delete only parents with no history left. | Never prune refresh history based on individual expiry, consumption, or revocation; user deletion is the explicit cascade exception. Test concurrent workers, cutoffs, per-batch row limits including large histories, progress across batches, and preservation of replay/logout evidence through the session deadline. Expiry checks remain independent of cleanup. |

Before applying to a shared environment, also test migration replay on an
empty disposable database and on one populated under the preceding migration.
Inspect the live foreign keys, partial index, checks, and timestamps. Exercise
old web reads and writes, Google cookie sign-in and setup, and confirm
existing records survive. Use synthetic inputs for verification failure
cases and perform signed-device checks separately.

### Task 5E PostgreSQL integration procedure

Use only a disposable PostgreSQL target with independently acquired
connections, separate synthetic users and at least two sessions per user.
Apply the actual migration after separate authorization and verify the
partial unique index, both cascades and the timestamp checks. Use synthetic
Google signatures with offline certificate fixtures for lifecycle testing.

1. Hold the challenge, account, user or session row from one connection
   while invoking the service through another. Have a separate observer use
   `pg_blocking_pids` to confirm the waiter reached the expected lock before
   releasing the holder. Keep success barriers within the configured lock
   timeout. Use a separate case that exceeds the timeout and confirms a
   redacted service failure and no partial transition.
2. Race two exchanges for one challenge, including an unknown-account
   exchange. Verify exactly one commits consumption. Hold each relevant lock
   across a challenge or proof expiry boundary and verify rejection after
   the lock releases. Exercise user deletion and account unlink or remap
   between lookup and pinning.
3. Race two rotations with the same predecessor. Observe the second
   transaction reread consumed history and commit revocation, then query
   the successor from a fresh connection and verify it fails. Run both
   orderings for refresh against logout, administrative revocation and user
   deletion. Repeat logout with a rotated credential whose individual
   expiry has passed. Verify the other sessions remain usable.
4. Cause a write failure after challenge or refresh consumption and verify
   rollback from an independent connection. Exercise a duplicate digest and
   the partial unique index. Simulate a lost refresh response by discarding
   the successful pair, then submitting its predecessor. For connection loss
   at commit, assert the service returns no credentials, and inspect the
   final state separately to determine whether the commit happened.
5. Hold one expired parent or challenge lock during cleanup to exercise
   `SKIP LOCKED`. Run two cleanup invocations on separate connections with
   over-limit fixtures and large histories. Verify each invocation respects
   all three limits, parents with remaining history persist, and active or
   revoked pre-deadline sessions retain replay and logout evidence.

## Deferred security and operations

- **Google deployment configuration** — Confirm the per-environment dedicated
  audience, exact allowed presenters, and actual Node.js runtime before
  non-production integration. Keep the isolated verifier's configuration
  separate.
- **Revocation operations** — Approve and exercise operator authorization,
  redacted audit, and incident handling before exposing any operator action.
- **5D.1** — The [durable rate limiter](MOBILE_RATE_LIMITS.md) defines trusted
  source extraction, bounded storage and cleanup, and the refresh replay
  integration order. Task 5D.1.1 closed offline verification with 278 passing
  regressions, lint, and typecheck. Both mobile migrations remain unapplied.
- **5D.2** — The [mobile authentication API](MOBILE_AUTH_API.md) implements
  strict bounded JSON, the trusted source and budgets, and a reusable bearer
  guard. Refresh checks replay revocation before admitting a session
  rotation inside the same transaction. The preliminary challenge and
  bearer lookups use the transaction wrapper's PostgreSQL statement limits.
  Before enablement, resolve the adapter startup issue, approve maintenance
  for both cleanup services, and verify the database and deployment boundary.
  Account setup enforcement remains with the account milestone.
- **5E** — Verify the migration, transaction and API behavior on a separately
  authorized disposable PostgreSQL target, including limiter locking,
  capacity accounting and cross-instance enforcement. Verify actual Vercel
  ingress and forwarding-header spoofing resistance. Confirm a non-production
  HTTPS origin and approved deployment access for enrolled devices while
  preserving preview protection and database isolation. Physical signed
  iOS verification remains a release gate.
