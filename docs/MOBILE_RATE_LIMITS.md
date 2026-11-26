# Mobile rate limits

Task 5D.1 implements the server-only [admission and cleanup service](../lib/auth/mobile/rate-limit.ts),
[trusted request source](../lib/auth/mobile/request-source.ts), and
[key derivation](../lib/auth/mobile/rate-limit-keys.ts). It uses the existing
PostgreSQL database and Prisma transaction settings. HTTP wiring belongs to
Task 5D.2. The [additive migration](../prisma/migrations/20261126130000_add_mobile_rate_limits/migration.sql)
remains unapplied. Cross-instance enforcement and the deployed source
boundary await Task 5E verification.

The installed Prisma CLI validated the schema and generated both rate-limit
models with a temporary config and fictional loopback URL. Root lint and
typecheck passed. The authorized test run passed 277 of 278 tests. The
remaining test used a database double that returned an extra field missing
from the real SQL projection. The fixture was corrected after that run.
Verification of the corrected fixture awaits a separately authorized run.

## Trusted source and bucket keys

The supported boundary is direct Vercel ingress on a deployment with its
system `VERCEL=1` and `VERCEL_ENV=preview` or `production` values exposed.
The server reads only Vercel's `x-vercel-forwarded-for` header and requires a
single bare IP address. It rejects missing, malformed and multi-value input
and ignores ordinary forwarding headers, device IDs and user agents.
The deployment environment is read from server configuration. Requests
cannot supply it. No local source fallback exists. Local development would
require a separately approved boundary that strips incoming address headers
and authenticates the trusted ingress before passing it to the application.
[Vercel request headers](https://vercel.com/docs/headers/request-headers) ·
[Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)

IPv4 uses canonical dotted decimal. IPv4-mapped IPv6 uses its underlying
IPv4 address. Other IPv6 addresses normalize and group by the first 64 bits
to reduce rotation within one prefix. Clients behind one IPv4 NAT or one
IPv6 prefix share their source budget. A gateway in front of Vercel can make
users share the gateway's egress budget. Confirm the actual test and
production ingress before enabling the HTTP routes. Treat an alternate
proxy boundary as a separate deployment decision.
[Vercel proxy behavior](https://vercel.com/kb/guide/can-i-use-a-proxy-on-top-of-vercel-deployment)

`MOBILE_RATE_LIMIT_KEY_SECRET` is a dedicated server-only secret per
environment. Provision 32 cryptographically random bytes encoded as exactly
43 canonical, unpadded base64url characters. The parser checks width and
canonical encoding on admission. Existing web authentication does not load
it. Missing or invalid configuration fails closed for mobile admission.
The service uses HMAC-SHA-256 with a versioned label, scope and policy, then
the scoped identity as input. The separate source, challenge, session and
account domains keep the same textual value from sharing a bucket across
scopes. Persistence holds a 32-byte digest and window state. Raw source
addresses, tokens, challenges, subjects and internal IDs stay out of bucket
persistence and diagnostics.

Changing the secret gives future requests new bucket identities. For planned
rotation, pause protected mobile operations, drain in-flight requests, wait
at least five minutes after those requests finish, and move all
instances to the new secret before reopening. This preserves outstanding
challenge budgets and avoids splitting enforcement across two keys. The
old buckets still occupy capacity until their expiry and cleanup. Maintain
separate secrets and coordinated rotation for each environment.

## Pilot policies

| Policy | Scope | Admissions |
| --- | --- | --- |
| `challenge_source` | Trusted source | 10 per UTC minute |
| `exchange_source` | Trusted source | 20 per UTC minute |
| `exchange_challenge` | Existing challenge | 5 across that challenge's actual lifetime |
| `refresh_source` | Trusted source | 30 per UTC minute |
| `refresh_session` | Trusted stable mobile session ID | 10 per UTC minute |
| `logout_source` | Trusted source | 30 per UTC minute |
| `financial_write_account` | Authenticated internal `User.id` | 60 per UTC minute |

These provisional limits live in a server-owned registry and the migration's
count constraint. Keep both in sync when changing a pilot policy. Fixed
minute windows permit up to twice a minute's limit in a short burst
straddling a boundary. Admission at the deadline belongs to the next
window. The challenge scope reads the existing challenge before allocation
and follows the stored creation and expiry for up to five minutes. It
rejects an expired, malformed, missing or consumed challenge and never
rolls its five attempts into a new window. If consumption races the
preliminary read, the authentication transaction remains authoritative.
The session key follows the stable session through credential rotations.
The account policy is a foundation for later writes.

## Admission, capacity and cleanup

`MobileRateLimitBucket` has a composite primary key on policy and digest,
an expiry/policy/digest index, finite window timestamps, and policy-specific
counter constraints. A bucket reaches its limit and stops incrementing.
`MobileRateLimitCapacity` has one row initialized by the migration and a
`0..10000` count check. The ledger counts all stored buckets, including
expired rows awaiting cleanup.

Admission locks an existing bucket, samples PostgreSQL wall time at
millisecond precision, and applies the limit or rolls an expired minute
bucket forward in place. If the first read misses, admission acquires the
capacity lock, rereads and locks the bucket under Read Committed, then
allocates only if still missing and capacity is available. Bucket creation
and the ledger increment commit together. Existing bucket admission never
acquires the capacity lock after it locks a bucket. A backward clock
movement does not reset a bucket whose stored expiry is still ahead.
Committed denials use a positive ceiling of the remaining seconds.
[PostgreSQL Read Committed](https://www.postgresql.org/docs/current/transaction-iso.html)

The cap is **10,000 total bucket rows** across all policies and instances,
plus the singleton ledger. At capacity, new scopes receive a temporary
rejection with a five-second retry hint. Existing scopes still follow their
own windows. New allocations and cleanup contend on the ledger. Abuse or
delayed cleanup can temporarily block legitimate new scopes. The minute
and challenge windows expire logically at their recorded deadlines.
Expired rows remain until reclaimed, and delayed maintenance cannot grow
the table past its allocation budget. Never evict active state to free
space. Application limiting is one layer of abuse protection.

Cleanup takes the capacity lock, samples the database clock, and deletes
up to **200 expired rows** in indexed order with `FOR UPDATE SKIP LOCKED`.
The delete rechecks expiry and returns capacity in the same transaction.
It skips rows under contention. Keep rate-limit cleanup and the existing
authentication-record cleanup in separate bounded transactions. A future
authorized maintenance caller can run single batches, measure deleted
counts and capacity rejections, and schedule follow-up batches if needed.
No scheduler is installed. Failure or delay keeps the limiter in force.
[PostgreSQL locking clauses](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)

Both services use the existing Read Committed wrapper with two-second
acquisition, five-second transaction, 1.5-second lock and three-second
statement limits. SQL parameters are bound. A failed or ambiguous commit
returns `database_unavailable` without automatic retry or authorization.

| Result | Future HTTP behavior |
| --- | --- |
| `rate_limited` | `429 RATE_LIMITED` with a positive `Retry-After`. |
| `configuration_error` | `500 INTERNAL_ERROR`. |
| `source_unavailable`, `database_unavailable` | `503 TEMPORARILY_UNAVAILABLE`. |
| `capacity_unavailable` | `503 TEMPORARILY_UNAVAILABLE` with a five-second retry hint. |
| `scope_unavailable` | For exchange, generic `401 GOOGLE_AUTH_FAILED`. An unexpected invalid trusted session or account identifier is an internal failure. |

Serializers must keep bucket identities, source addresses, account IDs,
credentials, SQL parameters and raw errors private.

## HTTP integration and refresh replay

1. Validate request shape and size, then identify the source through the
   trusted boundary. Commit source admission before Google verification or
   credential/session work. Apply the challenge budget before verifying a
   proof and let the lifecycle service recheck the authoritative challenge
   state. Requests with an unknown challenge or refresh credential create
   no challenge or session bucket.
2. After refresh source admission, resolve the credential digest, lock its
   parent session and reread credential history. Reject terminal sessions.
   A recognized consumed credential revokes that live session and commits
   before the generic `401 UNAUTHENTICATED` response. This transition runs
   before any session rotation budget check, including when that budget is
   exhausted. Source-level rejection occurs before this work.
3. For a live current credential, apply the stable session budget inside
   the same transaction before issuing successors. Reuse the limiter's
   transaction-bound implementation in Task 5D.2. Keep the lock order
   `session → existing bucket` or `session → capacity → bucket`. Limiter
   cleanup and source admission take no session locks. Resample the
   database wall clock after limiter waits and recheck session and refresh
   expiry before rotating. Limiter failures issue no successor credentials.
4. Commit the logout source budget before invoking logout. Derive any
   future account-write key from authenticated internal identity.

## Task 5E verification

The [offline tests](../lib/auth/mobile/rate-limit.test.ts) exercise the
actual service, HMAC and source parser with a transaction double. Use
separately authorized disposable PostgreSQL with the actual migrations and
independent connections for the following cases.

- Race both existing and missing buckets. Assert exact admission totals
  and saturated counters across connections. Hold one row across the
  minute rollover and challenge expiry to verify the post-lock database
  time and retry rounding.
- Race allocation at 9,999 rows with competing new scopes and duplicate
  scopes. Verify no more than 10,000 rows, exact ledger counts, in-place
  rollover when full, and atomic rollback after a failed increment or
  deletion. Inspect the state independently if a commit is ambiguous.
- Hold an expired bucket while cleanup runs, then race cleanup against an
  admission that rolls that bucket forward. Verify skipped rows, active
  state retention, the 200-row batch bound and accurate capacity.
- On the approved Vercel origin, send spoofed forwarding values, duplicate
  header values and chained values through representative ingress paths.
  Verify which platform value arrives and prove caller input cannot choose
  its source budget. Confirm NAT, IPv6 and any gateway behavior.
- Exhaust session rotation admission while preserving source admission,
  then replay a consumed refresh token. Verify revocation commits and
  the external response remains generic. Race refresh, logout and cleanup
  using controlled lock barriers. Confirm a source rejection does not run
  the lifecycle and infrastructure failure never emits a credential pair.
