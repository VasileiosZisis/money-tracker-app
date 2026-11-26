# Mobile session foundation

Task 5A adds the [Prisma models](../prisma/schema.prisma), an
[additive migration](../prisma/migrations/20261126120000_add_mobile_session_foundation/migration.sql),
and server-only [credential](../lib/auth/mobile/credentials.ts) and
[expiry](../lib/auth/mobile/expiry.ts) primitives. The migration is unexecuted
and requires verification against a separately authorized disposable
PostgreSQL target. The transaction rules below specify future services and
endpoints. See the [active mobile plan](MOBILE_IMPLEMENTATION_PLAN.md).

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

## Transaction and locking rules for Task 5C

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
connections and controlled lock barriers on disposable PostgreSQL. Unit tests
exercise credential parsing, hashing, and time arithmetic only.

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

## Deferred security and operations

- **5B** — Select and separately authorize a direct maintained root
  `google-auth-library` dependency. Set per-environment dedicated mobile
  Google audience and exact allowed presenters. The isolated verifier's
  dependency and development settings are separate.
- **5C** — Implement the PostgreSQL lifecycle and bounded cleanup using the
  transaction rules above. Define an administrative revocation procedure
  with operator authorization, redacted audit, and incident handling.
- **5D** — Add strict versioned JSON schemas and request-body limits before
  parsing. Configure trusted request-source identification and distributed
  rate limits across instances, including bucket expiry, bounded storage and
  cleanup, and failure behavior. Keep errors generic, responses uncached,
  and diagnostics redacted. Add bearer authentication and account setup
  enforcement before financial data access. Expose public auth endpoints
  only once their security controls are in place.
- **5E** — Verify the migration, transaction and API behavior on a separately
  authorized disposable PostgreSQL target. Confirm a non-production HTTPS
  origin and approved deployment access for enrolled devices while preserving
  preview protection and database isolation. Physical signed iOS verification
  remains a release gate.
