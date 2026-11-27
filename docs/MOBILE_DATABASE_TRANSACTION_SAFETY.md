# Mobile database transaction safety

**Approved Task 5D.3B approach.** Keep the mobile authentication API disabled. Task 5D.3B.1 aligns the Prisma stack on the published `7.10.1` release to pick up the late-start rollback fix. Task 5D.3B.2 gives mobile authentication explicit connection ownership through a `pg` executor on a separate pool. Both clients access the same PostgreSQL database and shared `User` and `Account` rows. Task 5D.3B.3 requires separate authorization for transaction-safety verification. The web path can be verified independently for a separate production decision.

Task 5D.3A used read-only source and upstream release inspection. The reviewed Task 5D.2 commit is `66a665e7debddb890fd4cd3358be3485f9ee3baf` on `mobile-dev`. Lint and 308 regression tests passed before a type-only logout correction. The product owner confirmed the final typecheck passed on the corrected commit. Both mobile migrations remain unapplied. [Task 5D.2 verification](MOBILE_AUTH_API.md)

## Task 5D.3A version baseline

| Package or artifact | Committed lockfile | Installed or generated |
| --- | --- | --- |
| `prisma`, `@prisma/config`, `@prisma/engines` | `7.5.0` | `7.5.0` |
| `@prisma/client`, `@prisma/client-runtime-utils` | `7.7.0` | `7.7.0` |
| `@prisma/adapter-pg`, `@prisma/driver-adapter-utils` | `7.5.0` | `7.5.0` |
| `@prisma/debug`, `@prisma/get-platform` | `7.5.0` and `7.2.0` at different tree locations | Matches each locked location |
| `@prisma/dev`, its `@prisma/query-plan-executor` | `0.20.0`, `7.2.0` | `0.20.0`, `7.2.0` |
| `pg`, `pg-pool`, `pg-protocol` | `8.20.0`, `3.13.0`, `1.13.0` | `8.20.0`, `3.13.0`, `1.13.0` |
| `generated/prisma/internal/class.ts` | Ignored artifact | Generated version `7.5.0`, engine `280c870be64f457428992c43c1f6d557fab6e29e` |

The `prisma-client` generator writes to `generated/prisma`. Its generated class selects the PostgreSQL compiler and imports `@prisma/client/runtime/client`, so the transaction manager on this checkout is from `7.7.0` even though the generated metadata reports `7.5.0`. The CLI engine package also resolves to the `280c870…` engine. CLI config selects the migration target separately from `lib/db.ts`, which uses the runtime pooled URL. Source inspection did not resolve or read any actual connection value. [Schema](../prisma/schema.prisma) · [CLI config](../prisma.config.ts) · [Runtime client](../lib/db.ts) · [Committed lockfile](../package-lock.json)

The installed `@prisma/client` permits `prisma: "*"` as a peer and the adapter pins its own utilities without a client peer. Prisma's v7 upgrade guide updates the CLI and client together. The package metadata allows the observed combination, and the offline checks exercised the generated API surface. No official guarantee for this exact CLI, generator, client and adapter mix was located. The late-start failure is explained by the two components' actual behavior and also affects matching affected releases. Treat version alignment as a reproducibility and compatibility measure. [Prisma v7 upgrade guide](https://www.prisma.io/docs/orm/v7/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)

On November 26, 2026, the official releases page identified `7.10.1` as the latest stable release and listed `v8.0.0-rc.25` as a prerelease. [Official releases](https://github.com/prisma/orm/releases) · [7.10.1 release](https://github.com/prisma/orm/releases/tag/7.10.1)

## Task 5D.3B.1 aligned baseline

The working tree started on `mobile-dev` at reviewed commit `6d8af5acb229cd761e0289ddfb4978d44dedd085`. The three exact `7.10.1` Prisma packages were verified in the public npm registry against the official stable release before installation. The resulting lockfile URLs and integrity hashes for those packages match the registry records. The CLI and runtime support Node `^20.19`, `^22.12`, or `>=24.0`, with a TypeScript peer floor of `5.4`. Local Node `24.15.0`, Next.js `16.1.6` and TypeScript `5.9.3` meet the applicable requirements. The deployed Node version remains unverified. [Prisma v7 system requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements) · [7.10.1 release](https://github.com/prisma/orm/releases/tag/7.10.1) · [Manifest](../package.json) · [Lockfile](../package-lock.json)

| Package or artifact | Before | After |
| --- | --- | --- |
| `prisma`, `@prisma/adapter-pg` | `7.5.0` | `7.10.1` exact direct pins |
| `@prisma/client` | `7.7.0` | `7.10.1` exact direct pin |
| Client runtime and driver adapter utilities | `7.7.0` and `7.5.0` | Both `7.10.1` |
| `pg`, `pg-pool`, `pg-protocol` | `8.20.0`, `3.13.0`, `1.13.0` | Same resolved versions |
| Generated PostgreSQL client | `7.5.0` | `7.10.1`, engine `d1b3f377ca835d73fd50954a5e22128b9ebdd6b8` |

One root `npm install --ignore-scripts` ran with audit disabled for that process. Lifecycle scripts were skipped. One validation and one client generation succeeded using the installed CLI and a temporary configuration with the existing schema and a fictional loopback URL. The temporary file was removed. The `prisma-client` generator still writes to ignored `generated/prisma`, with all 12 web models and five mobile models. The schema, migrations and app code remain unchanged. Root lint, typecheck and all 308 regression tests passed on the aligned stack.

### Lockfile scope

The v3 lockfile added 51 package paths, removed 28, and changed 42 existing package entries plus the root manifest entry. The 42 include 40 version changes and two flag-only changes (`dotenv` and `@types/react-dom`). Every changed package entry belongs to the old or new Prisma dependency tree, including shared resolutions checked through the lockfile graph.

- The aligned Prisma family includes `@prisma/config`, `@prisma/debug`, `@prisma/engines`, `@prisma/fetch-engine`, nested `@prisma/get-platform`, and both utility packages. Stable `@prisma/engines@7.10.1` requires the exact internal `@prisma/engines-version@8.1.0-1.d1b3f377ca835d73fd50954a5e22128b9ebdd6b8` engine-build marker. It supplies the generated engine hash. The installed CLI, client and adapter are the approved stable v7 releases.
- The CLI updates `@prisma/dev` from `0.20.0` to `0.24.17` and `@prisma/studio-core` from `0.21.1` to `0.33.0`. The dev subtree updates the PGlite client, socket and tools packages, replaces its Hono and parser dependencies, and adds Streams Local, its validator tree, and the routing dependencies. The published Studio package adds its exact Radix, Visx (including upstream alpha-versioned chart dependencies), D3, Lodash, and layout dependencies. These are CLI transitives. The application's direct UI and chart dependencies did not change.
- Prisma config updates `c12` and its file-watching and config loader dependencies, along with `effect` and `deepmerge-ts`. The CLI's MySQL subtree updates `mysql2`, removes `denque`, `obuf`, `seq-queue` and `sqlstring`, and adds `sql-escaper`. The shared `iconv-lite` patch from `0.7.2` to `0.7.3` is required by the new MySQL version.
- `@types/pg` changes from `8.11.11` to `8.23.1`. The old top-level `pg-types@4.1.0` is displaced as the driver's existing `2.2.0` copy hoists. The effective parser and its `postgres-array`, `postgres-bytea`, `postgres-date`, and `postgres-interval` versions are identical before and after for `pg@8.20.0`. This is a dependency placement change. [Full lockfile](../package-lock.json)


<details>
<summary>Complete package-lock entry inventory</summary>

Paths are relative to root `node_modules`. A dash in a version column indicates an added or removed path. The root lock entry also records the three manifest pins.

| Package path | Before | After | Same-version metadata changes |
| --- | --- | --- | --- |
| `@chevrotain/cst-dts-gen` | `10.5.0` | — | — |
| `@chevrotain/gast` | `10.5.0` | — | — |
| `@chevrotain/types` | `10.5.0` | — | — |
| `@chevrotain/utils` | `10.5.0` | — | — |
| `@electric-sql/pglite` | `0.3.15` | `0.4.3` | — |
| `@electric-sql/pglite-socket` | `0.0.20` | `0.1.3` | — |
| `@electric-sql/pglite-tools` | `0.2.20` | `0.3.3` | — |
| `@mrleebo/prisma-ast` | `0.13.1` | — | — |
| `@prisma/adapter-pg` | `7.5.0` | `7.10.1` | — |
| `@prisma/client` | `7.7.0` | `7.10.1` | — |
| `@prisma/client-runtime-utils` | `7.7.0` | `7.10.1` | — |
| `@prisma/config` | `7.5.0` | `7.10.1` | — |
| `@prisma/debug` | `7.5.0` | `7.10.1` | — |
| `@prisma/dev` | `0.20.0` | `0.24.17` | — |
| `@prisma/dev/node_modules/@hono/node-server` | `1.19.9` | — | — |
| `@prisma/dev/node_modules/hono` | `4.11.4` | — | — |
| `@prisma/driver-adapter-utils` | `7.5.0` | `7.10.1` | — |
| `@prisma/engines` | `7.5.0` | `7.10.1` | — |
| `@prisma/engines-version` | `7.5.0-15.280c870be64f457428992c43c1f6d557fab6e29e` | `8.1.0-1.d1b3f377ca835d73fd50954a5e22128b9ebdd6b8` | — |
| `@prisma/engines/node_modules/@prisma/get-platform` | `7.5.0` | `7.10.1` | — |
| `@prisma/fetch-engine` | `7.5.0` | `7.10.1` | — |
| `@prisma/fetch-engine/node_modules/@prisma/get-platform` | `7.5.0` | `7.10.1` | — |
| `@prisma/streams-local` | — | `0.1.11` | — |
| `@prisma/streams-local/node_modules/ajv` | — | `8.20.0` | — |
| `@prisma/streams-local/node_modules/env-paths` | — | `3.0.0` | — |
| `@prisma/streams-local/node_modules/json-schema-traverse` | — | `1.0.0` | — |
| `@prisma/studio-core` | `0.21.1` | `0.33.0` | — |
| `@radix-ui/primitive` | — | `1.1.3` | — |
| `@radix-ui/react-compose-refs` | — | `1.1.2` | — |
| `@radix-ui/react-primitive` | — | `2.1.3` | — |
| `@radix-ui/react-slot` | — | `1.2.3` | — |
| `@radix-ui/react-toggle` | — | `1.1.10` | — |
| `@radix-ui/react-use-controllable-state` | — | `1.2.2` | — |
| `@radix-ui/react-use-effect-event` | — | `0.0.2` | — |
| `@radix-ui/react-use-layout-effect` | — | `1.1.1` | — |
| `@types/d3-delaunay` | — | `6.0.1` | — |
| `@types/d3-format` | — | `3.0.1` | — |
| `@types/d3-geo` | — | `3.1.0` | — |
| `@types/d3-time-format` | — | `2.1.0` | — |
| `@types/geojson` | — | `7946.0.16` | — |
| `@types/lodash` | — | `4.17.27` | — |
| `@types/pg` | `8.11.11` | `8.23.1` | — |
| `@types/react-dom` | `19.2.3` | `19.2.3` | `dev`, `devOptional` |
| `@visx/curve` | — | `4.0.1-alpha.0` | — |
| `@visx/event` | — | `4.0.1-alpha.0` | — |
| `@visx/grid` | — | `4.0.1-alpha.0` | — |
| `@visx/group` | — | `4.0.1-alpha.0` | — |
| `@visx/point` | — | `4.0.1-alpha.0` | — |
| `@visx/responsive` | — | `4.0.1-alpha.0` | — |
| `@visx/scale` | — | `4.0.1-alpha.0` | — |
| `@visx/shape` | — | `4.0.1-alpha.0` | — |
| `@visx/vendor` | — | `4.0.0-alpha.0` | — |
| `@visx/vendor/node_modules/@types/d3-array` | — | `3.0.3` | — |
| `@visx/vendor/node_modules/@types/d3-color` | — | `3.1.0` | — |
| `@visx/vendor/node_modules/@types/d3-interpolate` | — | `3.0.1` | — |
| `@visx/vendor/node_modules/@types/d3-scale` | — | `4.0.2` | — |
| `@visx/vendor/node_modules/@types/d3-shape` | — | `3.1.7` | — |
| `@visx/vendor/node_modules/@types/d3-time` | — | `3.0.0` | — |
| `@visx/vendor/node_modules/d3-array` | — | `3.2.1` | — |
| `@visx/vendor/node_modules/d3-format` | — | `3.1.0` | — |
| `better-result` | — | `2.10.0` | — |
| `c12` | `3.1.0` | `3.3.4` | — |
| `c12/node_modules/dotenv` | — | `17.4.2` | — |
| `chevrotain` | `10.5.0` | — | — |
| `chokidar` | `4.0.3` | `5.0.0` | — |
| `citty` | `0.1.6` | — | — |
| `classnames` | — | `2.5.1` | — |
| `consola` | `3.4.2` | — | — |
| `d3-delaunay` | — | `6.0.2` | — |
| `d3-geo` | — | `3.1.0` | — |
| `deepmerge-ts` | `7.1.5` | `8.0.2` | — |
| `defu` | `6.1.4` | `6.1.7` | — |
| `delaunator` | — | `5.1.0` | — |
| `denque` | `2.1.0` | — | — |
| `dotenv` | `16.6.1` | `16.6.1` | `dev`, `devOptional` |
| `effect` | `3.18.4` | `3.20.0` | — |
| `elkjs` | — | `0.11.1` | — |
| `exsolve` | `1.0.8` | `1.2.0` | — |
| `fast-decode-uri-component` | — | `1.0.1` | — |
| `fast-querystring` | — | `1.1.2` | — |
| `find-my-way` | — | `9.7.0` | — |
| `giget` | `2.0.0` | `3.3.1` | — |
| `grammex` | `3.1.12` | `3.1.13` | — |
| `http-status-codes` | `2.3.0` | — | — |
| `iconv-lite` | `0.7.2` | `0.7.3` | — |
| `lilconfig` | `2.1.0` | — | — |
| `lodash` | `4.17.21` | `4.18.1` | — |
| `lru.min` | `1.1.4` | `1.1.5` | — |
| `mysql2` | `3.15.3` | `3.24.4` | — |
| `node-fetch-native` | `1.6.7` | — | — |
| `nypm` | `0.6.5` | — | — |
| `nypm/node_modules/citty` | `0.2.1` | — | — |
| `obuf` | `1.1.2` | — | — |
| `ohash` | `2.0.11` | `2.0.12` | — |
| `perfect-debounce` | `1.0.0` | `2.1.0` | — |
| `pg-numeric` | `1.0.2` | — | — |
| `pg-types` | `4.1.0` | `2.2.0` | — |
| `pg-types/node_modules/postgres-array` | — | `2.0.0` | — |
| `pg/node_modules/pg-types` | `2.2.0` | — | — |
| `pg/node_modules/postgres-array` | `2.0.0` | — | — |
| `pg/node_modules/postgres-bytea` | `1.0.1` | — | — |
| `pg/node_modules/postgres-date` | `1.0.7` | — | — |
| `pg/node_modules/postgres-interval` | `1.2.0` | — | — |
| `pkg-types` | `2.3.0` | `2.4.0` | — |
| `pkg-types/node_modules/confbox` | — | `0.3.2` | — |
| `postgres-bytea` | `3.0.0` | `1.0.1` | — |
| `postgres-date` | `2.1.0` | `1.0.7` | — |
| `postgres-interval` | `3.0.0` | `1.2.0` | — |
| `postgres-range` | `1.1.4` | — | — |
| `prisma` | `7.5.0` | `7.10.1` | — |
| `rc9` | `2.1.2` | `3.1.0` | — |
| `readdirp` | `4.1.2` | `5.1.1` | — |
| `regexp-to-ast` | `0.5.0` | — | — |
| `ret` | — | `0.5.1` | — |
| `robust-predicates` | — | `3.0.3` | — |
| `safe-regex2` | — | `5.1.2` | — |
| `seq-queue` | `0.0.5` | — | — |
| `sql-escaper` | — | `1.9.1` | — |
| `sqlstring` | `2.3.3` | — | — |
| `tinyexec` | `1.0.4` | — | — |
| `valibot` | `1.2.0` | `1.4.2` | — |

</details>

### Selected advisory entries

| Previously identified dependency paths | Result on the resulting lockfile |
| --- | --- |
| Prisma dev `hono@4.11.4` and `@hono/node-server@1.19.9` | Nested affected copies removed. The MCP SDK still resolves its unchanged `hono@4.12.8` and `@hono/node-server@1.19.11`, above the ranges of the two specific advisories identified in 5D.3A. |
| Prisma config `effect@3.18.4` | Updated to `3.20.0`, the patched version for GHSA-38f7-945m-qr2g. |
| Prisma config `deepmerge-ts@7.1.5` | Updated to `8.0.2`, above the affected range for GHSA-ggr8-5vv4-36mx. |
| Prisma CLI `mysql2@3.15.3` | Updated to `3.24.4`, above the affected range for GHSA-3f6p-5ww8-9rcr. |
| Other copies and release-note dependencies | Root `fast-uri@3.1.0`, `source-map-js@1.2.1`, and NextAuth's `uuid@8.3.2` remain. Streams Local adds `ajv@8.20.0`; existing `ajv` copies remain on other paths. The earlier total of 47 findings is historical and broader triage is separate. |

[Hono advisory](https://github.com/advisories/GHSA-q5qw-h33p-qvwr) · [Hono server advisory](https://github.com/advisories/GHSA-wc8c-qw6v-h7f6) · [Effect advisory](https://github.com/advisories/GHSA-38f7-945m-qr2g) · [deepmerge-ts advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) · [MySQL advisory](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr)

### Installed runtime and compatibility

The installed 7.10.1 transaction manager sends SQL `ROLLBACK` for a late-started pg transaction before invoking its adapter hook. It drops the local transaction reference when delegating cleanup and handles timer-close errors. The adapter still releases in its terminal hooks with no discard signal. Failed late and ordinary SQL rollback execute the release hook anyway. Rejected SQL commit invokes the rollback hook without sending a compensating SQL command. `executeRaw` checks the row count without exposing the command tag. A missing commit acknowledgement leaves persistence uncertain, even if a socket error causes eventual removal.

`maxWait` still races startup without passing cancellation to `pool.connect()` or `BEGIN`. The app does not set a driver acquisition timeout or change pool policy. Queryable connections can still be returned after terminal failure. The installed runtime serializes transaction lifecycle operations without guaranteeing that outstanding SQL has drained before close. The published late-start fix and protective timeout handling improve the baseline while failed terminal SQL, in-flight work, connection disposal and bounded pool waiting remain release gates. [Installed stack trace baseline](#connection-and-transaction-ownership) · [Published runtime fixes](https://github.com/prisma/orm/releases/tag/7.10.0) · [Open cleanup report](https://github.com/prisma/orm/issues/31144)

Generated imports and the local NextAuth v4 adapter continue to target the same Prisma API. The generated client retains typed `Bytes`, `Decimal`, and `ReadCommitted`, the adapter passes raw SQL with separate parameters, and financial fields remain `numeric(14,2)` with `Tag` and `tagId` mappings. The runtime deserializes Decimal values from strings and now takes an independent copy for `Bytes`. Verify exact-cent aggregates, generated IDs, relation mappings, and real transactions on disposable PostgreSQL. Also verify the inherited `timestamptz` assumption that the session returns UTC offsets. Both adapter versions replace the output offset with `+00:00`, so a non-UTC session is a relevant compatibility case. The offline fixtures can validate service and handler contracts.

## Task 5D.3B.2 mobile transaction owner

The server-only pool is created on the first database operation. It validates
the runtime `DATABASE_URL`, defaults to verified TLS, preserves verified URL
settings, and rejects settings that weaken verification. An absent URL fails
before pool creation. The pool and executor are reused per runtime, including
local reloads. A module import or disabled API request opens no pool.
Both the idle pool and checked-out connection handle errors without logging
raw driver details. Web continues through its existing Prisma client.
[Mobile pool](../lib/auth/mobile/mobile-pool.ts) · [Web database client](../lib/db.ts)

| Limit | Value and behavior |
| --- | --- |
| Connections and operations | Two mobile pool clients and four admitted operations per runtime. Excess operations fail without an application queue. A timed-out checkout keeps its slot until the driver's promise settles and any late lease is discarded. |
| Driver checkout and idle retention | `connectionTimeoutMillis = 1500` bounds driver checkout waits and new connections. `idleTimeoutMillis = 10000` limits unused connection retention. Total connections across serverless instances still need a deployment budget. |
| Startup | Two seconds from admission through checkout, `BEGIN ISOLATION LEVEL READ COMMITTED`, and setup. Late checkouts are discarded before `BEGIN`. Failed or uncertain initialization discards the connection. |
| Active and terminal phases | Five seconds for callback work, up to two seconds for terminal SQL, and a nine-second absolute local deadline from admission. Deadlines use a monotonic clock and are subject to event-loop scheduling. The budget applies to each transaction. |
| PostgreSQL backstops | Transaction-local `lock_timeout = '1500ms'`, `statement_timeout = '3000ms'`, and `idle_in_transaction_session_timeout = '7000ms'`. Verify actual server version, pooler support, and backend lock release. PostgreSQL 17+ `transaction_timeout` remains a candidate for separately approved testing. |

The owner moves through acquisition, initialization, callback execution,
closing, and final disposition. The callback gets a frozen interface for
registered SQL statements with bound parameters. It can run one statement
at a time. The owner prevents commit after a swallowed statement error,
and rejects work after close starts. An execution timeout with SQL in
flight discards the lease. If the callback is idle, the owner can attempt
rollback within the remaining cleanup budget.

Reuse requires an acknowledged terminal SQL command with the expected
tag. The owner has one guarded disposition and uses `release(true)` if
completion cannot be confirmed. A rejected or unacknowledged commit is
classified internally as uncertain and never retried. An unexpected
`ROLLBACK` tag during commit returns no application result. All database
failures retain the existing generic service mapping. Driver disposal
prevents local reuse. PostgreSQL and pooler lock-release timing still
requires real verification.
[Executor](../lib/auth/mobile/mobile-transaction.ts) ·
[Driver pool](https://node-postgres.com/apis/pool) ·
[Command results](https://node-postgres.com/apis/result) ·
[PostgreSQL timeouts](https://www.postgresql.org/docs/current/runtime-config-client.html) ·
[Neon pooling](https://neon.com/docs/connect/connection-pooling)

The registered statements preserve account and device scope, lock order,
database-clock checks, and limiter semantics. Google lookup failures
reach the transaction owner. Session creation uses `crypto.randomUUID()`
in the existing opaque text column, alongside retained CUIDs. Security
writes check affected-row counts. Cleanup binds ID arrays and avoids
cascading refresh history. Digests stay binary and timestamp values stay
UTC instants at millisecond precision. Both migrations remain unapplied.
[Statements](../lib/auth/mobile/mobile-statements.ts) ·
[Session foundation](MOBILE_SESSION_FOUNDATION.md) ·
[Rate limits](MOBILE_RATE_LIMITS.md)

Offline verification on `mobile-dev` passed root lint, typecheck, and all
327 regression tests. The additional cases cover executor deadlines,
late acquisition, TLS configuration, statement and connection failures,
terminal command tags, confirmed commit and disposal, and account lookup
rollback. The migrated lifecycle, limiter, and HTTP doubles run the actual
executor against synthetic leases. Real checkout cancellation and backend
cleanup remain Task 5D.3B.3 verification gates.
[Executor tests](../lib/auth/mobile/mobile-transaction.test.ts)

## Connection and transaction ownership

Before the mobile conversion, `lib/db.ts` supplied the same Prisma client to web and mobile. These findings still inform the independent web remediation. The adapter holds the checked-out client, and Prisma directs transaction completion by issuing terminal SQL. With `usePhantomQuery: false`, the adapter's `commit()` and `rollback()` are release hooks. In an ordinary close Prisma sends SQL first. Calling the hook alone leaves the server transaction open. [App database client](../lib/db.ts) · [Prisma v7 transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)

The following pre-alignment paths were checked in Task 5D.3A against `@prisma/client/runtime/client.js.map` (`transaction-manager.ts`, `ClientEngine.ts`, `getPrismaClient.ts`), `@prisma/adapter-pg/dist/index.js`, `pg/lib/client.js` and `pg-pool/index.js`. See the aligned baseline above for the installed 7.10.1 findings.

| Path | Owner and effect in the installed stack |
| --- | --- |
| Pool acquisition and connect | The adapter calls `pool.connect()`. The app source supplies no driver `connectionTimeoutMillis`. The pool can retain a saturated waiter indefinitely and has no app-level cap on pending requests. Where configured, the driver's timeout removes an expired queued callback and bounds connection establishment. `max` limits clients only. |
| `BEGIN` and isolation | The adapter holds the checkout and awaits `BEGIN` and, if specified, `SET TRANSACTION ISOLATION LEVEL`. Its startup catch calls `release(error)`, and `pg-pool` removes that lease from circulation. Mobile `SET LOCAL` statements run after startup. |
| `maxWait` and late startup | Prisma races the whole adapter startup promise against its timer. It passes no cancellation signal to `pool.connect()` or `BEGIN`. A queued attempt can acquire a client and begin later, or an already-started `BEGIN` can complete late. The installed late cleanup invokes only the release hook. A queryable lease can therefore return idle **in the pool** with a transaction still open **on the server**. |
| Execution timeout | Prisma starts the execution timer once the transaction becomes active. The timer serializes close with other lifecycle operations for that transaction ID. It does not cancel an in-flight SQL statement or provide an independent time bound on a blocked finalization. PostgreSQL lock and statement timeouts are separate. A network stall can hold the checkout after the caller or timer has lost interest. No permanent leak was measured. |
| Statement error and normal rollback | A PostgreSQL error can leave the transaction aborted even though the connection remains queryable. On callback rejection or transaction expiry Prisma asks for SQL `ROLLBACK`, then runs the release hook in `finally`. An acknowledged rollback ordinarily clears the state. If rollback rejects while the connection is still queryable, the installed hook does not force discard. |
| Commit success or failure | Prisma sends SQL `COMMIT` and calls the release hook on success. If SQL commit rejects, it calls the rollback hook and preserves the error, without necessarily sending a second SQL command. The adapter uses row counts and does not establish from the command tag that an aborted transaction actually committed. A lost commit acknowledgement leaves the database outcome uncertain. |
| Socket and connection errors | The pg client marks a broken connection unqueryable and rejects pending work on a detected socket error. The pool removes unqueryable or errored releases and detects idle socket errors. With no detected disconnect, a local query timeout can reject a promise while SQL remains active, and a queued rollback can time out before being sent. The ordinary release path checks neither server transaction state nor pending SQL. |
| Release accounting | `pg-pool` installs a one-shot release function per checkout. A repeat on that checkout throws. The object may have a new release function after a subsequent checkout, so the check is no substitute for adapter ownership. The installed adapter hooks hold no per-transaction release guard. Prisma v7 serializes normal terminal lifecycle calls. The Prisma 6 commit race described upstream does not establish the same race in v7. |

The confirmed installed defect is late startup releasing an open transaction. The installed terminal paths also lack a fail-closed guarantee when terminal SQL rejects; whether that happens with the deployed transport needs controlled verification. Stock `lib/db.ts` does not configure `query_timeout`. The specific timed-out, unsent-rollback chain reported in #31144 is therefore a conditional risk, including if that setting is added as a proposed fix. A pending startup or stuck command can retain pool resources while it remains unresolved. Actual time-to-recovery, a permanent checkout leak, and the exact double-release sequence on this stack remain unproven. [pg pool contract](https://node-postgres.com/apis/pool) · [PostgreSQL timeout settings](https://www.postgresql.org/docs/current/runtime-config-client.html) · [Rollback report](https://github.com/prisma/orm/issues/31144)

## Upstream defect status

| Upstream evidence | Installed and proposed stable behavior |
| --- | --- |
| [#29719](https://github.com/prisma/orm/issues/29719), [#29727](https://github.com/prisma/orm/pull/29727) | Confirmed in the installed JS runtime and pg adapter. First documented in [7.9.0](https://github.com/prisma/orm/releases/tag/7.9.0). The [7.10.1 transaction manager](https://github.com/prisma/orm/blob/7.10.1/packages/client-engine-runtime/src/transaction-manager/transaction-manager.ts) attempts explicit `ROLLBACK` on late startup before invoking the hook. It still races the driver rather than cancelling `pool.connect()`, and its `finally` still calls the hook if SQL rollback fails. |
| [#29952](https://github.com/prisma/orm/issues/29952), [#29954](https://github.com/prisma/orm/pull/29954) | The original report is a Prisma 6 Rust engine commit-timeout race. Prisma 7 has a JS transaction manager and different close serialization. The related adapter hardening adds one-shot release, rejects queries after close, and discards on a still-running statement. It merged into `v7` on November 10 after `7.10.1` shipped. The [stable adapter](https://github.com/prisma/orm/blob/7.10.1/packages/adapter-pg/src/pg.ts) still has direct release hooks. |
| [#30995](https://github.com/prisma/orm/pull/30995) | Merged into `v7` on November 13 and absent from the latest stable tag. It improves in-flight statement and closing order. It cannot infer physical completion from a driver promise that timed out before its statement completed on the wire. |
| [#31144](https://github.com/prisma/orm/issues/31144), [#30915](https://github.com/prisma/orm/pull/30915) | Open report on `7.10.1` with `pg` `8.23.0` and `pg-pool` `3.14.0` when `query_timeout` is set. A timed-out rollback can leave a queryable connection in an open or aborted transaction. The installed `pg` has the relevant queued-query timeout behavior, though this app does not set it. The proposed adapter change to discard on unresolved terminal commands is open and unpublished. The reported rollback result is upstream evidence. Its COMMIT variant and exact behavior under the app's settings remain to be verified. |
| [7.10.1 nested transaction fix](https://github.com/prisma/orm/releases/tag/7.10.1) | Separate released fix for reuse of a mutated options object across nested and top-level calls. CashContour supplies a fresh options literal for mobile and does not use nested `$transaction` for refresh admission. |
| [7.10.0 cleanup changes](https://github.com/prisma/orm/releases/tag/7.10.0) | The stable candidate includes #28768 for disconnect-time startup cleanup and #29611 for suppressed unhandled rejections during timeout cleanup. The latter catches failure from the timer callback. It does not prove that terminal SQL completed. The release's MariaDB pool lifecycle fix applies to a different adapter. |

## CashContour exposure

| Caller | Transaction shape and relevant timeout path |
| --- | --- |
| Mobile challenge issue, preliminary challenge lookup, exchange, bearer lookup, refresh, logout, and internal revoke | Used the shared Prisma wrapper before 5D.3B.2. These operations now use the dedicated mobile executor. Google verification remains outside database transactions. |
| Mobile source and challenge limiter admission, rotation admission, auth cleanup and limiter cleanup | Standalone admission and both cleanup services use the mobile wrapper. Session admission uses the locked refresh transaction. The executor owns rollback when the transaction-bound account lookup fails. |
| Web category detail updates, planned bill and income mark/undo, CSV confirmation | Six direct interactive call sites. `lib/db.ts` leaves Prisma defaults at 2 s startup and 5 s execution; each also relies on the database's default isolation and timeout configuration. Each can encounter late startup independently of mobile. |
| Other web calls, including NextAuth | The app's local NextAuth v4 adapter, ordinary CRUD, reads, and compiled nested writes use the same module client in a loaded runtime. They can receive a contaminated checkout if that pool reuses one. A premature success can later disappear or a later operation can finalize another request's work. Affected operations depend on the query plan and actual reuse. The inventory found zero explicit array-form batch transactions. The installed engine starts a transaction with configured defaults for a compiled non-interactive multi-query batch, while query-plan internal transactions use the same adapter but skip Prisma's default timers. |
| Preview seed | Separate Prisma client and pool. Uses Serializable, 10 s startup and 60 s execution on its guarded preview-only path. No shared request pool. The same dependency-level startup and cleanup properties matter if the seed is run separately. |

[Mobile wrapper](../lib/auth/mobile/lifecycle-store.ts) · [Mobile lifecycle](../lib/auth/mobile/session-service.ts) · [Google account lookup](../lib/auth/mobile/google-account.ts) · [Limiter](../lib/auth/mobile/rate-limit.ts) · [Auth cleanup](../lib/auth/mobile/cleanup-service.ts) · [Categories](../actions/categories.ts) · [Planned bills](../actions/planned-bills.ts) · [Planned income](../actions/planned-income.ts) · [Import](../lib/import/server.ts) · [NextAuth adapter](../lib/auth/prisma-adapter.ts) · [Preview seed](../prisma/seed.ts)

The local `origin/main` tracking ref at `8af58bb` has the same shared client and web transaction call sites, and resolves the same relevant Prisma and pg versions. The deployment document maps `main` to production. The web source is susceptible even while the mobile flag is off. PostgreSQL treats a redundant `BEGIN` as a warning and leaves the current transaction in place, so a later default-isolation callback can operate in the stranded transaction. Which revision and runtime settings serve production, whether requests share a pool across Vercel functions, and whether an incident occurred were outside this review. No evidence of financial corruption, authorization bypass or cross-user access was collected. [Deployment topology](DEPLOYMENT.md) · [PostgreSQL BEGIN behavior](https://www.postgresql.org/docs/current/sql-begin.html#SQL-BEGIN-NOTES)

## Remediation options

| Option | Assessment |
| --- | --- |
| **A. Upgrade stable Prisma 7** | Pin CLI, client, and PostgreSQL adapter to `7.10.1` and regenerate. This repairs the missing late-start rollback in the shared web path and brings the published dependency fixes. The adapter still cannot guarantee disposal on failed terminal SQL or cancellation of queued startup. Retain the current adapter behavior only where acceptance tests establish the necessary safety or a separately reviewed web remedy closes the gap. |
| **B. Configure and own the pool under Prisma** | `PrismaPg` accepts an external `pg.Pool`. `max`, a finite `connectionTimeoutMillis`, and bounded admission can limit checkouts and waiting. Set a driver checkout deadline inside the app budget and independently bound startup commands. Connection establishment deadlines do not cover delayed `BEGIN`. The public Prisma `$transaction` callback has no lease handle or way to force disposal on uncertain completion. `maxUses: 1` would discard every released client, at the cost of reconnects, and leaves questions about blocked leases and duplicate release. A custom adapter could implement proper ownership using its public contract, but would add shared engine integration risk. Avoid monkey-patching hooks or depending on private client state. |
| **C. Isolate the mobile pool** | Prevents local checkout sharing between mobile and web. Keeps the database, account and identity model, durable limiter, and database locks shared. Isolation alone still allows contamination between mobile requests and adds connections per Vercel runtime. Use it with explicit disposal and confirm connection budgets and transaction-mode pooler behavior. |
| **D. Own mobile transactions with `pg`** | A small server-only executor can hold one `PoolClient`, enforce deadlines, send terminal SQL, and use public `release(true)` when the result is uncertain. No ORM operations may use the global Prisma client inside that transaction. Convert only the affected mobile persistence calls to parameterized SQL behind a narrow store boundary. This requires explicit ID generation, command-tag and row-count checks, data conversion and parity tests. Web stays on Prisma. |

[Stable adapter source](https://github.com/prisma/orm/blob/7.10.1/packages/adapter-pg/src/pg.ts) · [node-postgres pool and forced disposal](https://node-postgres.com/apis/pool) · [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)

### Implementation sequence

1. **Align the web baseline in a separate change.** Pin root dev dependency `prisma` and dependencies `@prisma/client` and `@prisma/adapter-pg` to `7.10.1`. Update only the required lock entries, and verify the new client, generator and adapter utility resolutions. Keep `pg` `8.20.0` and `pg-pool` `3.13.0` resolved for the initial comparison if the dependency ranges permit. The candidate adapter still declares `pg: ^8.16.3`. Record any resolution drift and repeat compatibility verification if the driver changes. Regenerate the ignored client with the matching CLI and check compilation and representative behavior with the current Next.js `16.1.6`, NextAuth `4.24.13` local adapter, and TypeScript `5.9.3`. Use Node `22.12+` in the supported 22 line or Node 24 and confirm the intended runtime separately. Keep the `prisma-client` generator, paths and schema. Check Prisma error handling, configured isolation, lock behavior, relation mappings, and exact `numeric(14,2)` / `Decimal` round trips, including generated IDs and legacy `Tag` mappings. Require web regression and disposable safety verification before approving that upgrade for release. If the stable shared adapter fails the web safety criteria, keep release approval pending and return for a supported fix or a separately scoped adapter ownership change. [Candidate adapter manifest](https://raw.githubusercontent.com/prisma/orm/7.10.1/packages/adapter-pg/package.json) · [Prisma system requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements) · [Local NextAuth adapter](../lib/auth/prisma-adapter.ts)

2. **Own mobile connections.** Task 5D.3B.2 implements the dedicated pool and one-owner transaction boundary. The exact states and budgets are documented above. [Mobile owner](#task-5d3b2-mobile-transaction-owner)

3. **Convert mobile persistence.** Task 5D.3B.2 preserves the database-clock checks, account and device scope, lock order, and limiter policy with bound SQL. Refresh admission and rotation use one connection. New UUIDs and legacy CUIDs use the same text column. [Session foundation](MOBILE_SESSION_FOUNDATION.md) · [Rate limits](MOBILE_RATE_LIMITS.md)

4. **Measure pooling and rollout prerequisites.** Size by runtime count and the sum of both pools' maxima, with headroom for maintenance and other clients. Test direct disposable PostgreSQL first, then an approved transaction-pooled fixture with the intended Neon-compatible topology. A client-level discard must leave no backend transaction or tenant state reusable through the pooler. Compare teardown, `SET LOCAL`, lock, statement and transaction behavior across both paths. Production and shared preview are outside the verification target. Keep the mobile flag disabled throughout and treat changes to web pool options or actual infrastructure as separate approval items. [Neon transaction pooling](https://neon.com/docs/connect/connection-pooling) · [Deployment isolation](DEPLOYMENT.md)

### Non-negotiable invariants

- One trusted connection and Read Committed transaction per transition. Preserve challenge and account locks, the session row lock and separate credential reread, and session → bucket or session → capacity → bucket ordering. Source admission and limiter cleanup acquire no session locks.
- Commit challenge consumption with session issuance, and refresh admission with rotation. Abort both parts on a failed write. Replay revocation must commit before returning the generic rejection and must precede session-budget admission. No token response before commit acknowledgement.
- Classify ambiguous commit as an uncertain service failure and never retry it automatically. A missing acknowledgement and a rolled-back transaction are distinct outcomes even when the HTTP response is the same.
- Bound connection acquisition, queued attempts, statements, transaction duration and terminal cleanup. A lease may reenter a pool only after confirmed terminal SQL and completed work. Uncertain state means disposal. Each checkout is finalized once.
- Preserve shared identity, account scoping, financial behavior, credential lifetimes, and mappings. Keep credentials, raw SQL values, DSNs, and exception details out of diagnostics. Record safe categories, timing, correlation IDs and aggregate counts only.

## Verification plan for 5D.3B.3

### Task 5D.3B.3A preparation

The [disposable PostgreSQL guide](MOBILE_POSTGRES_VERIFICATION.md) defines
the local PostgreSQL 17 target, private CA, exact provisioning and teardown,
and the separate migration, mobile and web entry points. The
[fixture runner](../tests/postgres/run.ts) requires explicit opt-in, a pinned
loopback endpoint, dedicated database and role names, and an independently
provisioned identity manifest. Each physical connection verifies TLS,
server identity, role and database before test writes. Offline target
guard regressions run without PostgreSQL.

The authorized first pass completed root typecheck and all 331 offline
regressions successfully. Root lint reported 27 React Hook errors for
the fixture's AsyncLocalStorage helper named use. The helper was renamed
to withMobileExecutor. The rename still needs an authorized lint rerun.

Task 5D.3B.3B awaits approval for the specific disposable instance, empty
and upgrade migration scenarios, mobile concurrency and cleanup cases,
and narrowly scoped teardown. Task 5D.3B.3C uses a separate web-only fixture
for the aligned Prisma path. Task 5D.3B.3D verifies the intended pooler via
its own approved target and independent observation. The direct harness
holds a PostgreSQL advisory lock for each stage invocation and separates
real SQL and backend termination from driver-boundary simulations.
Exact network loss during terminal commands remains an open verification
case. Both mobile migrations remain unapplied and the API stays disabled.

Use a disposable PostgreSQL database with fictional sentinels, both existing migrations only on that target, and a test pool of one checkout plus independent observer and blocker connections. Add barriers for acquisition, `BEGIN`, isolation/timeout initialization, statements and terminal commands. For lost acknowledgements, the harness must distinguish a command withheld from PostgreSQL from a response withheld after independent observation of the committed state. Use bounded barriers and a watchdog on the harness. Track opaque checkout IDs, safe event names, and aggregate counts. Use `pg_stat_activity` state, `xact_start`, wait-event categories, `pg_locks`, and a synthetic backend tag or PID for test correlation. Do not capture the `query` column, bound parameters or connection strings. Inspect durable state and lock release from a separate connection after each case.

| Cases | Required offline and disposable PostgreSQL evidence |
| --- | --- |
| Exhaustion, queued deadline, late acquisition, pool recovery | Hold the sole lease, burst above the admission cap, and measure peak admitted and waiting counts. Verify excess work is refused or times out without starting SQL. Delay checkout delivery around the deadline to confirm no late `BEGIN`. Check `waitingCount`, `idleCount`, `totalCount` and the checkout ledger converge. Include an intentionally delayed `BEGIN` on a lease obtained within budget and verify disposal if its state is uncertain. |
| Initialization failure after `BEGIN` | Fault the isolation or timeout setup step. Verify no callback work, and terminal cleanup confirmed or socket removed. Check that the following checkout is safe. |
| Statement timeout, lock timeout, execution timeout | Hold a row lock from the blocker and use a test statement that exceeds its bounded deadline. Test statement and lock timeout independently of transaction lifetime, then expire the whole transaction with work in flight and with the callback idle. Assert no later work, check aborted-state cleanup, and verify no remaining transaction or locks. |
| Commit and rollback failure or timeout, network interruption, ambiguity | Test definite rejection, a withheld command, and a lost response after PostgreSQL applied commit. Verify the caller gets no credentials, committed state matches independent observation, and no retry occurs. Repeat interruption during startup, execution and close. A connection cannot reenter the pool while a command or transaction remains unresolved. |
| Exactly-once release, discard, no leakage or unrelated writes | Assert one final disposition per checkout under concurrent expiry and completion. Verify late or uncertain leases are absent from the reusable pool. Follow every failure with an unrelated autocommit write and an interactive write in the same pool. The observer must see only each request's own committed sentinel, and rolling back a separate request must never change another request's rows. No idle-in-transaction sessions, queued work or checked-out clients may accumulate after the bounded cleanup window. |
| Mobile lifecycle and rate limiting | Reuse the existing offline suite. With independent database connections race challenge exchange, refresh, logout, cleanup and session admission. Verify replay commits while the bucket is saturated, source denial occurs before lifecycle work, failed rotation rolls back admission, and cleanup and rate-limit capacity accounting retain current lock order and bounds. Observe the committed challenge, session, credential and bucket state independently. |
| Web compatibility | Run representative category, planned bill and income, CSV confirmation, existing interactive paths, and an explicit synthetic Prisma batch on the aligned dependency stack. Check NextAuth custom adapter operations using fixture users, representative nested writes, exact money and legacy schema mappings. Include shared-pool timeout and finalization checks on the actual Prisma web path as a release criterion. |
| Intended transaction pooler | After direct database verification, repeat the ownership, stalled transport, and terminal-state cases on an approved disposable fixture using the intended pooler mode. Independently verify that discarded client leases do not leave backend transactions, locks or request-specific state available to later requests. Verify `SET LOCAL` resets and total connection use under representative concurrent runtime instances. |

Offline executor tests should use a controllable pool and lease with synthetic terminal results to assert one finalization, discard on unknown state, no SQL after close, original failure category, no automatic retry, bounded cleanup, and redacted diagnostics. Assertions about PostgreSQL state require the real observer and pooler tests. Existing lifecycle and limiter doubles deliberately do not model PostgreSQL isolation or lock timing. [Lifecycle double](../lib/auth/mobile/lifecycle-test-db.ts) · [Limiter tests](../lib/auth/mobile/rate-limit.test.ts) · [Task 5E integration matrix](MOBILE_AUTH_API.md#task-5e-http-and-transaction-verification)

## Independent web remediation release plan

1. Under separate authorization, prepare a candidate from the then-current production `main`. Apply only the reviewed Prisma pins and a lockfile resolved from main's existing lock, plus any separately reviewed compatibility fixes. Compare the candidate lockfile with both main and this alignment. Use main's existing schema and configuration to regenerate locally with synthetic settings. Exclude mobile routes, executor changes, and both unapplied migrations.
2. Run the authorized web lint, typecheck and regression checks on that exact candidate. Exercise NextAuth session and account operations, category and planned-item transactions, import, and exact financial Decimal and legacy mappings. Use disposable PostgreSQL with the production-equivalent web schema for transaction and pool fault tests. Verify normal commits, failed or late startup, lock and statement behavior, failed terminal SQL, ambiguous outcomes, and independence of subsequent writes under the intended pooler. Use fictional records and independent observers.
3. Require explicit approval for any release. If the stable adapter cannot meet the web safety criteria, require a separately reviewed connection termination and disposal remedy before release. If those gates pass, document deployment health checks, failure monitoring and rollback criteria. The dependency-only release needs no schema rollback. Reverting to the earlier package set reintroduces its known late-start defect, so include that tradeoff in the rollback decision. Web work can proceed on its own schedule while mobile enablement remains gated. [Deployment boundaries](DEPLOYMENT.md)

## Task 5D.3A advisory evidence and approvals

The previous audit recorded 47 findings in aggregate. Available repository documentation does not contain the advisory-by-advisory output, so this review compared known lock entries with official advisories. The locked CLI path through `@prisma/dev@0.20.0` brings Hono `4.11.4` and `@hono/node-server` `1.19.9`, within published affected ranges. Prisma 7.9.0 removed Hono from that CLI dependency path. Other dependency paths can still retain Hono. The locked CLI config uses `effect@3.18.4`, which is in the affected range for GHSA-38f7-945m-qr2g, and the 7.10.1 tag uses the patched `3.20.0`. The tagged 7.10.1 CLI upgrades `mysql2` from `3.15.3` to `3.24.4`, covering GHSA-3f6p-5ww8-9rcr. The tagged config upgrades `deepmerge-ts` from `7.1.5` to `8.0.2`, covering GHSA-ggr8-5vv4-36mx. MySQL Studio and CLI config advisories are distinct from PostgreSQL request handling. Allow these as specific candidate benefits and confirm resolution in the proposed lockfile. Keep the remaining findings in separate triage. [Prior audit summary](MOBILE_SESSION_FOUNDATION.md#task-5b1-verification) · [7.9.0 security notes](https://github.com/prisma/orm/releases/tag/7.9.0) · [Hono advisory](https://github.com/advisories/GHSA-q5qw-h33p-qvwr) · [Hono server advisory](https://github.com/advisories/GHSA-wc8c-qw6v-h7f6) · [Effect advisory](https://github.com/advisories/GHSA-38f7-945m-qr2g) · [Tagged Prisma config](https://raw.githubusercontent.com/prisma/orm/7.10.1/packages/config/package.json) · [Tagged Prisma CLI](https://raw.githubusercontent.com/prisma/orm/7.10.1/packages/cli/package.json) · [MySQL advisory](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr) · [deepmerge-ts advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)

**Proposed authorization for Task 5D.3B.** Approve the scoped package alignment and lockfile change, matching local client generation, mobile store and executor source changes, offline tests, and project-specific read-only reviewers. Separately identify and approve a disposable PostgreSQL target, fictional fixtures, application of the existing migrations there, the bounded fault harness, and teardown. Approve root lint, typecheck, regression and focused integration commands on the reviewed candidate. Any Next.js build, pooled cloud fixture, deployment, production or shared-preview operation, secret inspection, broader audit, new migration, or API enablement needs separate approval. Task 5D.3A establishes the source-level failure. It leaves fault behavior on real PostgreSQL and the intended pooler, runtime compatibility, and deployment readiness open.
