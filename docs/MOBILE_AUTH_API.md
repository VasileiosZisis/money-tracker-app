# Versioned mobile authentication API

Task 5D.2 implements four Node.js App Router handlers and a reusable mobile
bearer guard. The API is disabled by default. Only the exact server-side
value `true` for `MOBILE_AUTH_API_ENABLED` enables it. Leave it unset or set
it to `false` in automatic Vercel previews and any environment that has yet
to meet the enablement gates. The flag is resolved per request before
parsing, source identification or downstream work. It also protects the
bearer guard. Existing web sign-in continues through NextAuth.

## HTTP contract

Send POST requests with no query parameters and an `application/json` body.
An optional UTF-8 charset and identity content encoding are supported.
Application responses carry `Cache-Control: private, no-store` and a new
server-generated `X-Request-Id`. The API ignores incoming correlation IDs.
Success uses `{data: ...}`. Failures use
`{error: {code, message, requestId}}` with static messages. The current
validation errors omit optional field details. Logout success has no body.
The routes use `force-dynamic`. Explicit OPTIONS rejection returns the
application envelope and `Allow: POST` without CORS. Next.js supplies the
other unsupported-method responses. Unsupported methods are rejected
regardless of the flag. Task 5E must check their deployed headers and
confirm they reach none of the auth services.
[Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)

| Path under `/api/v1/auth/` | Request | Success |
| --- | --- | --- |
| `google/challenge` | `{}` | `200` with `challengeId`, `nonce`, and `expiresAt` |
| `google/exchange` | `{challengeId, idToken}` | `200` with `accessToken`, `accessTokenExpiresAt`, `refreshToken`, and `refreshTokenExpiresAt` |
| `refresh` | `{refreshToken}` | `200` with the same token contract as exchange |
| `logout` | `{refreshToken}` | `204` for committed revocation or an already terminal or absent session |

Expiry strings are ISO 8601 UTC. The parser enforces 16 KiB on declared and
received byte counts, cancels an oversized stream, and rejects invalid
lengths, mismatches, invalid UTF-8, malformed JSON and unsupported
representations. It rejects duplicate root object members, including
escaped spellings of the same name. The current schemas accept only an
empty object or string-valued fields and reject unknown keys, so nested
objects cannot enter auth. Future schemas that accept nested objects need a
duplicate-member policy for those objects. Credential values are used
exactly as supplied. The Google token length bound still applies, along with
the overall JSON byte limit.

| HTTP status and code | Condition |
| --- | --- |
| `400 INVALID_REQUEST` | Malformed JSON, structure, query or length, or a malformed logout credential |
| `401 GOOGLE_AUTH_FAILED` | Invalid proof, nonce, or invalid, expired or consumed challenge |
| `401 UNAUTHENTICATED` | Invalid bearer or refresh credential, including wrong-purpose credentials and refresh replay |
| `403 WEB_ACCOUNT_REQUIRED` | Verified Google identity has no existing linked account, after challenge consumption commits |
| `413 REQUEST_TOO_LARGE` | Declared or actual body exceeds 16 KiB |
| `415 UNSUPPORTED_MEDIA_TYPE` | Unsupported media type, charset, or content encoding |
| `429 RATE_LIMITED` | Source, challenge, or session limit reached, with a positive `Retry-After` |
| `500 INTERNAL_ERROR` | Required server configuration is invalid or the verifier encounters an unexpected internal failure |
| `503 TEMPORARILY_UNAVAILABLE` | API disabled, trusted source unavailable, PostgreSQL or Google unavailable, or rate-limit capacity exhausted. Capacity exhaustion sends `Retry-After: 5`. |

The bearer guard authorizes one canonical access token under the
case-insensitive Bearer scheme and returns only the trusted user and session
IDs plus a request ID. A failed authentication carries
`WWW-Authenticate: Bearer`; service errors use the infrastructure status.
The guard reads PostgreSQL anew for each token and has no web cookie
fallback. Upcoming account and financial routes will enforce setup
separately through the shared account preferences. The guard rejects
combined credentials visible in the Web Request. Node's HTTP adapter can
discard a repeated Authorization field before Next.js constructs that
Request. Before wiring a protected route, verify that the approved ingress
rejects duplicate field lines or preserves their ambiguity for the guard.
[Node.js HTTP header normalization](https://nodejs.org/api/http.html#messageheaders)

## Ordering and database limits

The trusted source policy for each route must commit before lifecycle work.
Exchange commits the challenge budget before Google verification. Refresh
locks the session and rereads credential history. It commits replay
revocation for a recognized consumed credential before any session budget
check and maps the result to the generic authentication rejection. For a
live current credential, it admits the session inside the existing refresh
transaction, samples PostgreSQL time again, and rotates only if both
deadlines remain live. If expiry passed after admission, the attempt stays
charged and the credential stays unconsumed. A failed rotation rolls back
its session admission together with its writes. Lock ordering is
session then bucket, or session then capacity then bucket. Source admission
and cleanup take no session locks.

The preliminary challenge lookup and bearer authentication each use one
fresh SQL statement in a short Read Committed transaction. The preliminary
read finishes before Google work starts. The
[mobile pg executor](MOBILE_DATABASE_TRANSACTION_SAFETY.md#task-5d3b2-mobile-transaction-owner)
uses two seconds for acquisition and setup, five seconds for callback work
and two seconds for terminal SQL, up to nine seconds per database operation.
PostgreSQL has transaction-local limits of 1.5 seconds for lock waits,
three seconds per statement and seven seconds idle in a transaction.
An ambiguous refresh commit discards its connection and returns a generic
service failure without credentials or an automatic retry. The future native
client must preserve the lost-response recovery policy, which can require
fresh Google sign-in. Keep the API disabled pending disposable PostgreSQL
and pooler verification in Task 5D.3B.3 and the deployment gates in Task 5E.

The code logs no credentials, request or response bodies, user or Google
claims, digests, raw source values, parameters, secrets or raw exceptions.
Before enablement, verify Vercel runtime and firewall logs, observability
integrations and database logging do not capture those values. Keep the web
Prisma adapter debug namespace `prisma:driver-adapter:pg` disabled,
including wildcard settings that would enable it. Restrict
operational diagnostics to route, request ID, safe category, timing and
aggregate counts. Vercel can record request paths, so clients must never
send credentials in URLs. [Vercel runtime logs](https://vercel.com/docs/logs/runtime)

## Pilot maintenance and enablement

Propose one scheduled invocation per minute on a separately approved
private operator host. Use a dedicated runner authorized only for the
reviewed non-production target, with an operator allowlist, scoped database
credential and a single-instance lock. Run one batch of each existing
cleanup service separately. The auth batch remains limited to 50 expired
challenges, 20 absolutely expired sessions and 200 refresh-history rows.
The limiter batch deletes at most 200 expired buckets. Challenges expire
after five minutes, and refresh history remains through each session's
absolute deadline except for user deletion.

Record aggregate deleted counts, elapsed time, safe failures and bucket
utilization without identity or credential data. Investigate repeated full
batches, capacity rejections or missed runs. For backlog, an operator can
authorize at most three additional batches per service in one run, with
the same single-instance control and cooldown before a repeat. A failed
batch rolls back, admission stays enforced, and expired auth remains
invalid. Escalate persistent saturation or failures by disabling ingress
and restoring the API flag to `false` across deployments before review.
Never delete active buckets to make room.

Vercel Cron Jobs target a project's production deployment, and Hobby
permits daily runs. Pro and Enterprise permit minutely runs. The newer
Vercel Schedules supports private functions in beta; target isolation,
feature approval and repeat-delivery behavior would need confirmation
before selecting it. The private operator proposal avoids a maintenance
HTTP endpoint and remains subject to separate approval. No scheduler is
installed here.
[Vercel Cron Jobs](https://vercel.com/docs/schedules/cron-jobs) ·
[Cron limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing) ·
[Vercel Schedules](https://vercel.com/docs/schedules)

Before enabling the pilot, verify both unapplied migrations on disposable
PostgreSQL, verify the mobile executor through the intended pooler,
approve the maintenance plan, and confirm Vercel ingress,
spoofing resistance, Node.js runtime, dedicated secrets and Google audience
and presenters. Verify live Google and deployment behavior under separate
authorization, and triage existing dependency advisories. Signed physical
iOS verification remains mandatory before iOS release. Use infrastructure
abuse protection independently of application admission. The 10,000-bucket
cap bounds limiter storage. Aggregate traffic and authentication challenge
and session storage need separate controls and monitoring.

## Task 5E HTTP and transaction verification

- Verify all route methods at the approved ingress, including automatic
  Next.js responses, generic failures, the bodyless logout response,
  cache headers, request IDs, retry hints, and absence of CORS or cookie
  authentication. Verify the disabled flag before any sensitive work.
- Send declared, streamed, chunked, encoded and ambiguous HTTP requests
  through the actual proxy and runtime. Check byte limits, cancellation,
  timeouts, header normalization, address spoofing and transport-level
  failures that may occur before an app handler runs. Verify that duplicate
  wire Authorization fields are rejected or reach the guard as ambiguous
  values before enabling bearer-protected routes.
- Use independent database connections and held locks to test source
  admission before session work, session budget races and rollover, replay
  despite saturation, both lock orders for refresh/logout, expiry during
  admission, capacity and cleanup, and rollback after a failed rotation.
  Interrupt a commit separately and inspect final state without assuming
  that the caller received credentials.
- Verify absence of request credentials and response tokens in deployed
  diagnostics, and exercise approved maintenance bounds, retention,
  access control and emergency disablement. Keep preview and production
  data and configuration isolated.

The [offline route tests](../lib/api/v1/mobile-auth.test.ts) exercise the
actual handlers, bearer guard, Google verification with synthetic signing
keys, and transaction-bound limiter against a database double. Root lint
and all 308 regression tests passed before the type-only logout correction.
The product owner confirmed that `npm run typecheck` passed with the
correction in `66a665e`. PostgreSQL and deployment behavior still require
the live verification above.
