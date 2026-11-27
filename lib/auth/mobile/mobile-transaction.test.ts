import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { register } from "node:module";
import { test } from "node:test";

import type { MobileLease, MobileParameter, MobileTransaction } from "./mobile-transaction";

const fakePgUrl = "data:text/javascript," + encodeURIComponent(
  'import { EventEmitter } from "node:events";' +
  'export const pools = [];' +
  'class Pool extends EventEmitter {' +
  '  constructor(options) { super(); this.options = options; pools.push(this); }' +
  '  async connect() { throw Error("driver connection contained fictional-password"); }' +
  '}' +
  'export default { Pool };',
);
const resolver = "let pgUrl;" +
  "export function initialize(data) { pgUrl = data; }" +
  "export function resolve(s, c, next) {" +
  "  if (s === 'server-only') return { url: 'data:text/javascript,export%20%7B%7D', shortCircuit: true };" +
  "  if (s === 'pg') return { url: pgUrl, shortCircuit: true };" +
  "  if (s === '@/lib/db' || s === '@/generated/prisma/client') throw Error('Mobile persistence imported web Prisma');" +
  "  return next(s,c);" +
  "}";
register("data:text/javascript," + encodeURIComponent(resolver), { data: fakePgUrl });

const { createMobileTransactionExecutor } = await import("./mobile-transaction");
const { executeMobileDatabaseTransaction, readMobileDatabaseUrl } = await import("./mobile-pool");
const { pools } = await import(fakePgUrl) as { pools: (EventEmitter & { options: object })[] };

const begin = "BEGIN ISOLATION LEVEL READ COMMITTED";
const initialization = [
  begin,
  "SET LOCAL lock_timeout = '1500ms'",
  "SET LOCAL statement_timeout = '3000ms'",
  "SET LOCAL idle_in_transaction_session_timeout = '7000ms'",
];
const clockSql = "SELECT date_trunc('milliseconds', clock_timestamp()) AS \"now\"";
const fixtureTime = new Date("2035-01-02T12:14:15.123Z");

function deferred<T>() {
  return Promise.withResolvers<T>();
}

function barrier() {
  return new Promise<void>((done) => setImmediate(done));
}

function controlledClock() {
  let current = 0;
  const scheduled = new Map<() => void, number>();
  return {
    now: () => current,
    schedule(callback: () => void, delay: number) {
      scheduled.set(callback, current + delay);
      return () => { scheduled.delete(callback); };
    },
    forward(milliseconds: number) {
      current += milliseconds;
      for (const [callback, time] of Array.from(scheduled)) {
        if (time <= current && scheduled.delete(callback)) callback();
      }
    },
    skip(milliseconds: number) { current += milliseconds; },
  };
}

const acknowledgement = (command: string) => ({ command, rowCount: null, rows: [] });
type DriverResult = Awaited<ReturnType<MobileLease["query"]>>;

class Lease extends EventEmitter implements MobileLease {
  steps: string[] = [];
  dispositions: boolean[] = [];
  intercept = new Map<string, () => DriverResult | Promise<DriverResult>>();

  async query(sql: string, values: MobileParameter[] = []): Promise<DriverResult> {
    assert.equal(this.dispositions.length, 0, "No query after disposition");
    this.steps.push(sql);
    const special = this.intercept.get(sql);
    if (special) return special();
    if (sql === clockSql) {
      assert.deepEqual(values, []);
      return { command: "SELECT", rowCount: 1, rows: [{ now: fixtureTime }] };
    }
    assert.ok(initialization.includes(sql) || ["COMMIT", "ROLLBACK"].includes(sql));
    return acknowledgement(sql.split(" ")[0]);
  }

  release(destroy = false) {
    assert.equal(this.dispositions.length, 0, "Only one release per checkout");
    this.dispositions.push(destroy);
    assert.equal(this.listenerCount("error"), 0, "Remove checkout listener at release");
  }
}

function setup(start?: () => Promise<MobileLease>) {
  const clock = controlledClock();
  const lease = new Lease();
  let connectCalls = 0;
  const run = createMobileTransactionExecutor(() => ({
    connect() {
      connectCalls++;
      return start ? start() : Promise.resolve(lease);
    },
  }), clock);
  return { run, lease, clock, connectCalls: () => connectCalls };
}

test("initializes before callback, executes sequential queries and waits for confirmed commit and release", async () => {
  const f = setup();
  const commit = deferred<DriverResult>();
  f.lease.intercept.set("COMMIT", () => commit.promise);
  let returned = false;
  const operation = f.run(async (tx) => {
    assert.deepEqual(f.lease.steps, initialization);
    assert.equal(Object.isFrozen(tx), true);
    assert.deepEqual(Object.keys(tx), ["query"]);
    const first = await tx.query<{ now: Date }>("clock");
    assert.deepEqual((await tx.query("clock")).rows, first.rows);
    return first.rows[0].now.toISOString();
  }).then((result) => { returned = true; return result; });
  await barrier();
  assert.equal(returned, false);
  assert.deepEqual(f.lease.steps, [...initialization, clockSql, clockSql, "COMMIT"]);
  assert.deepEqual(f.lease.dispositions, []);
  commit.resolve(acknowledgement("COMMIT"));
  assert.deepEqual(await operation, { status: "committed", value: fixtureTime.toISOString() });
  f.clock.forward(9_000);
  assert.deepEqual(f.lease.dispositions, [false]);
  assert.equal(f.connectCalls(), 1);
});

test("cap includes unresolved timed-out attempts and recovers after actual settlement", async () => {
  const timedOut = Array.from({ length: 4 }, () => deferred<MobileLease>());
  const fresh = new Lease();
  let attempt = 0;
  const f = setup(() => timedOut[attempt++]?.promise ?? Promise.resolve(fresh));
  let ran = false;
  const pending = timedOut.map(() => f.run(async () => { ran = true; }));
  assert.deepEqual(await f.run(async () => {}), { status: "failed", reason: "admission_full" });
  assert.equal(f.connectCalls(), 4);
  f.clock.forward(2_000);
  for (const op of pending) assert.deepEqual(await op, { status: "failed", reason: "startup_timeout" });
  assert.deepEqual(await f.run(async () => {}), { status: "failed", reason: "admission_full" });
  assert.equal(f.connectCalls(), 4);
  const late = new Lease();
  timedOut[0].resolve(late);
  for (const waiter of timedOut.slice(1)) waiter.reject(new Error("fictional late rejection"));
  await barrier();
  assert.equal(ran, false);
  assert.deepEqual(late.steps, []);
  assert.deepEqual(late.dispositions, [true]);
  assert.deepEqual(await f.run(async () => 42), { status: "committed", value: 42 });
  assert.equal(f.connectCalls(), 5);
});

test("failed driver checkout clears admission without retries or raw diagnostics", async () => {
  const f = setup(() => Promise.reject(new Error("fictional-connection-password")));
  for (let i = 0; i < 5; i++) {
    const result = await f.run(async () => assert.fail("unexpected callback"));
    assert.deepEqual(result, { status: "failed", reason: "acquisition_failed" });
    assert.doesNotMatch(JSON.stringify(result), /password/);
  }
  assert.equal(f.connectCalls(), 5);
});

test("checkout settlement at the startup deadline is discarded before BEGIN even before the timer runs", async () => {
  const checkout = deferred<MobileLease>();
  const f = setup(() => checkout.promise);
  const operation = f.run(async () => assert.fail("late callback"));
  f.clock.skip(2_000);
  checkout.resolve(f.lease);
  assert.deepEqual(await operation, { status: "failed", reason: "startup_timeout" });
  assert.deepEqual(f.lease.steps, []);
  assert.deepEqual(f.lease.dispositions, [true]);
});

test("delayed BEGIN and failed initialization discard their connection", async () => {
  const slow = setup();
  const beginResult = deferred<DriverResult>();
  slow.lease.intercept.set(begin, () => beginResult.promise);
  const deadline = slow.run(async () => assert.fail("callback before initialization"));
  await barrier();
  slow.clock.forward(2_000);
  assert.deepEqual(await deadline, { status: "failed", reason: "startup_timeout" });
  beginResult.resolve(acknowledgement("BEGIN"));
  await barrier();
  assert.deepEqual(slow.lease.steps, [begin]);
  assert.deepEqual(slow.lease.dispositions, [true]);

  const broken = setup();
  broken.lease.intercept.set(initialization[2], () => { throw new Error("fictional initialization error"); });
  assert.deepEqual(await broken.run(async () => assert.fail("unexpected callback")), {
    status: "failed", reason: "initialization_failed",
  });
  assert.deepEqual(broken.lease.steps, initialization.slice(0, 3));
  assert.deepEqual(broken.lease.dispositions, [true]);
});

test("failed application statement poisons its transaction even if the callback catches it", async () => {
  for (const swallow of [false, true]) {
    const f = setup();
    f.lease.intercept.set(clockSql, () => { throw new Error("fictional DB credential"); });
    const run = f.run(async (tx) => {
      const query = tx.query("clock");
      if (swallow) {
        await assert.rejects(query, { message: "Mobile transaction query failed" });
        await assert.rejects(tx.query("clock"), { message: "Mobile transaction query unavailable" });
        return "do not return";
      }
      return query;
    });
    assert.deepEqual(await run, { status: "failed", reason: "transaction_failed" });
    assert.deepEqual(f.lease.steps, [...initialization, clockSql, "ROLLBACK"]);
    assert.deepEqual(f.lease.dispositions, [false]);
  }
});

test("concurrent or unawaited statements fail closed and are never queued behind outstanding SQL", async () => {
  for (const concurrent of [false, true]) {
    const f = setup();
    const sql = deferred<DriverResult>();
    f.lease.intercept.set(clockSql, () => sql.promise);
    const result = await f.run(async (tx) => {
      void tx.query("clock");
      if (concurrent) await assert.rejects(tx.query("clock"));
      return "unconfirmed";
    });
    sql.reject(new Error("fictional late query error"));
    await barrier();
    assert.deepEqual(result, { status: "failed", reason: "transaction_failed" });
    assert.deepEqual(f.lease.steps, [...initialization, clockSql]);
    assert.deepEqual(f.lease.dispositions, [true]);
  }
});

test("arbitrary and inherited SQL names cannot run inside a callback", async () => {
  const f = setup();
  const result = await f.run(async (tx) => {
    await assert.rejects(tx.query("COMMIT" as never));
    await assert.rejects(tx.query("constructor" as never));
    return "invalid";
  });
  assert.deepEqual(result, { status: "failed", reason: "transaction_failed" });
  assert.deepEqual(f.lease.steps, [...initialization, "ROLLBACK"]);
});

test("runtime query result metadata must match the authorized statement", async () => {
  for (const result of [
    { command: "SELECT", rowCount: 1, rows: [] },
    { command: "UPDATE", rowCount: 1, rows: [{ now: fixtureTime }] },
  ]) {
    const f = setup();
    f.lease.intercept.set(clockSql, () => result);
    assert.deepEqual(await f.run(async (tx) => tx.query("clock")), {
      status: "failed", reason: "transaction_failed",
    });
    assert.deepEqual(f.lease.steps, [...initialization, clockSql, "ROLLBACK"]);
    assert.deepEqual(f.lease.dispositions, [false]);
  }
});

test("connection errors during initialization and active SQL cause safe disposal", async () => {
  for (const sql of [begin, clockSql]) {
    const f = setup();
    const blocked = deferred<DriverResult>();
    f.lease.intercept.set(sql, () => blocked.promise);
    const operation = f.run((tx) => tx.query("clock"));
    await barrier();
    assert.equal(f.lease.steps.at(-1), sql);
    f.lease.emit("error", new Error("fictional private connection details"));
    assert.deepEqual(await operation, { status: "failed", reason: "connection_lost" });
    blocked.reject(new Error("fictional late driver error"));
    await barrier();
    assert.deepEqual(f.lease.dispositions, [true]);
    assert.equal(f.lease.steps.at(-1), sql);
  }
});

test("execution deadline disposes an outstanding query and invalidates the callback interface", async () => {
  const f = setup();
  const sql = deferred<DriverResult>();
  f.lease.intercept.set(clockSql, () => sql.promise);
  let scope: MobileTransaction | undefined;
  const operation = f.run(async (tx) => {
    scope = tx;
    await tx.query("clock");
    return "late";
  });
  await barrier();
  f.clock.forward(5_000);
  assert.deepEqual(await operation, { status: "failed", reason: "execution_timeout" });
  assert.ok(scope);
  await assert.rejects(scope.query("clock"));
  sql.resolve({ command: "SELECT", rows: [{ now: fixtureTime }], rowCount: 1 });
  await barrier();
  assert.deepEqual(f.lease.steps, [...initialization, clockSql]);
  assert.deepEqual(f.lease.dispositions, [true]);
});

test("idle callback expiry rolls back, and later callback resolution or rejection cannot change the result", async () => {
  for (const rejectCallback of [false, true]) {
    const f = setup();
    const callback = deferred<void>();
    let lateWork: Promise<unknown> | undefined;
    const operation = f.run(async (tx) => {
      await callback.promise;
      lateWork = tx.query("clock");
      return lateWork;
    });
    await barrier();
    f.clock.forward(5_000);
    assert.deepEqual(await operation, { status: "failed", reason: "execution_timeout" });
    if (rejectCallback) callback.reject(new Error("fictional late callback"));
    else callback.resolve();
    await barrier();
    if (!rejectCallback) { assert.ok(lateWork); await assert.rejects(lateWork); }
    assert.deepEqual(f.lease.steps, [...initialization, "ROLLBACK"]);
    assert.deepEqual(f.lease.dispositions, [false]);
  }
});

test("callback failure reuses a lease only after a confirmed rollback", async () => {
  for (const rollback of ["confirmed", "failed", "delayed", "wrong-tag"] as const) {
    const f = setup();
    const terminal = deferred<DriverResult>();
    if (rollback === "failed") f.lease.intercept.set("ROLLBACK", () => { throw new Error("fictional rollback failure"); });
    if (rollback === "delayed") f.lease.intercept.set("ROLLBACK", () => terminal.promise);
    if (rollback === "wrong-tag") f.lease.intercept.set("ROLLBACK", () => acknowledgement("COMMIT"));
    const operation = f.run(async () => { throw new Error("fictional callback failure"); });
    await barrier();
    f.clock.forward(2_000);
    assert.deepEqual(await operation, { status: "failed", reason: rollback === "confirmed" ? "transaction_failed" : "rollback_unconfirmed" });
    if (rollback === "delayed") terminal.resolve(acknowledgement("ROLLBACK"));
    await barrier();
    assert.deepEqual(f.lease.steps, [...initialization, "ROLLBACK"]);
    assert.deepEqual(f.lease.dispositions, [rollback !== "confirmed"]);
  }
});

test("a COMMIT that produces a ROLLBACK tag yields no result and discards its connection", async () => {
  const f = setup();
  f.lease.intercept.set("COMMIT", () => acknowledgement("ROLLBACK"));
  assert.deepEqual(await f.run(async () => "fictional successor"), { status: "failed", reason: "invalid_commit" });
  assert.deepEqual(f.lease.dispositions, [true]);
  assert.equal(f.connectCalls(), 1);
});

test("failed or timed-out commit and terminal transport errors never retry or return credentials", async () => {
  for (const failure of ["rejected", "deadline", "error-event"] as const) {
    const f = setup();
    const terminal = deferred<DriverResult>();
    f.lease.intercept.set("COMMIT", () => {
      if (failure === "rejected") throw new Error("fictional commit exception");
      return terminal.promise;
    });
    const operation = f.run(async () => "fictional successor");
    await barrier();
    if (failure === "deadline") f.clock.forward(2_000);
    if (failure === "error-event") f.lease.emit("error", new Error("fictional transport error"));
    assert.deepEqual(await operation, { status: "failed", reason: "uncertain_commit" });
    if (failure !== "rejected") terminal.reject(new Error("fictional late terminal error"));
    await barrier();
    assert.deepEqual(f.lease.steps, [...initialization, "COMMIT"]);
    assert.deepEqual(f.lease.dispositions, [true]);
    assert.equal(f.connectCalls(), 1);
  }
});

test("commit acknowledgement beyond its absolute deadline cannot win a delayed timer race", async () => {
  const f = setup();
  const beginResult = deferred<DriverResult>();
  f.lease.intercept.set(begin, () => beginResult.promise);
  const active = deferred<void>();
  const commit = deferred<DriverResult>();
  f.lease.intercept.set("COMMIT", () => commit.promise);
  const operation = f.run(async () => { await active.promise; return "fictional secret"; });
  await barrier();
  f.clock.forward(1_999);
  beginResult.resolve(acknowledgement("BEGIN"));
  await barrier();
  f.clock.forward(4_999);
  active.resolve();
  await barrier();
  f.clock.skip(2_000);
  commit.resolve(acknowledgement("COMMIT"));
  assert.deepEqual(await operation, { status: "failed", reason: "uncertain_commit" });
  assert.equal(f.clock.now(), 8_998);
  assert.deepEqual(f.lease.dispositions, [true]);
});

test("a later request cannot execute SQL through the previous callback interface", async () => {
  const a = new Lease();
  const b = new Lease();
  const leases = [a, b];
  const f = setup(async () => leases.shift() ?? assert.fail("unexpected checkout"));
  const first = await f.run(async (tx) => tx);
  assert.ok(first.status === "committed");
  assert.deepEqual(await f.run(async (tx) => {
    await assert.rejects(first.value.query("clock"));
    await tx.query("clock");
  }), { status: "committed", value: undefined });
  assert.deepEqual(a.steps, [...initialization, "COMMIT"]);
  assert.deepEqual(b.steps, [...initialization, clockSql, "COMMIT"]);
  assert.deepEqual(a.dispositions, [false]);
  assert.deepEqual(b.dispositions, [false]);
});

test("URL configuration fails closed, pool construction is lazy and reusable, and pool errors stay redacted", async (t) => {
  assert.equal(pools.length, 0);
  const log = t.mock.method(console, "log", () => {});
  const warn = t.mock.method(console, "warn", () => {});
  const error = t.mock.method(console, "error", () => {});
  delete process.env.DATABASE_URL;
  assert.deepEqual(await executeMobileDatabaseTransaction(async () => assert.fail("unexpected transaction")), {
    status: "failed", reason: "acquisition_failed",
  });
  assert.equal(pools.length, 0);
  for (const invalid of [
    "", "fictional-password", "postgresql:///fixture", "postgresql://fixture@localhost",
    "postgresql://localhost/fixture", "postgresql://fixture@localhost/fixture?host=untrusted",
    "postgresql://fixture@localhost/fixture?sslmode=no-verify",
    "postgresql://fixture@localhost/fixture?sslmode=disable",
    "postgresql://fixture@localhost/fixture?ssl=0",
    "postgresql://fixture@localhost/fixture?ssl=false",
    "postgresql://fixture@localhost/fixture?sslmode=require&uselibpqcompat=false&uselibpqcompat=true",
    "postgresql://fixture@localhost/fixture?sslmode=prefer&uselibpqcompat=true",
  ]) {
    assert.throws(() => readMobileDatabaseUrl(invalid), { message: "Invalid mobile database configuration" });
  }
  const url = "postgresql://fictional:fictional@127.0.0.1:1/fictional?sslmode=verify-full";
  assert.equal(readMobileDatabaseUrl(url), url);
  assert.equal(readMobileDatabaseUrl(url + "&uselibpqcompat=true"), url + "&uselibpqcompat=true");
  process.env.DATABASE_URL = url;
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(await executeMobileDatabaseTransaction(async () => assert.fail("unexpected transaction")), {
      status: "failed", reason: "acquisition_failed",
    });
  }
  assert.equal(pools.length, 1);
  assert.deepEqual(pools[0].options, {
    connectionString: url, ssl: { rejectUnauthorized: true }, max: 2,
    connectionTimeoutMillis: 1_500, idleTimeoutMillis: 10_000,
  });
  pools[0].emit("error", new Error("fictional raw idle error"));
  assert.equal(log.mock.callCount() + warn.mock.callCount() + error.mock.callCount(), 0);
});
