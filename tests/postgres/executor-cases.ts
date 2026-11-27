import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { MobileTransaction } from "../../lib/auth/mobile/mobile-transaction";

import { waitCondition, type RunCase } from "./cases";
import { verifyFixtureIdentity, withFixture, type Fixture } from "./fixture";
import { gate, ownedPool } from "./owned-pool";
import type { FixtureTarget } from "./target";

const begin = "BEGIN ISOLATION LEVEL READ COMMITTED";
const statementLimit = "SET LOCAL statement_timeout = '3000ms'";

async function insert(tx: MobileTransaction, id: string) {
  const { rows: [row] } = await tx.query<{ now: Date }>("clock");
  assert.ok(row?.now instanceof Date);
  assert.equal((await tx.query("insertChallenge", [
    id, Buffer.alloc(32, 13), row.now, new Date(row.now.getTime() + 60_000),
  ])).rowCount, 1);
}

async function exists(fixture: Fixture, id: string) {
  return (await fixture.observer.query('SELECT 1 FROM "MobileAuthChallenge" WHERE "id" = $1', [id])).rowCount === 1;
}

type Owned = Awaited<ReturnType<typeof ownedPool>>;

async function independentWrites(fixture: Fixture, owned: Owned, priorId: string, committed: boolean) {
  await fixture.clean(owned.pids);
  assert.equal(await exists(fixture, priorId), committed);
  const follow = await ownedPool(fixture);
  const success = randomUUID();
  const rolledBack = randomUUID();
  try {
    assert.equal((await follow.execute(async (tx) => insert(tx, success))).status, "committed");
    assert.equal((await follow.execute(async (tx) => {
      await insert(tx, rolledBack);
      throw new Error("Fictional rollback");
    })).status, "failed");
    assert.equal(await exists(fixture, success), true);
    assert.equal(await exists(fixture, rolledBack), false);
    assert.equal(await exists(fixture, priorId), committed);
    assert.equal(follow.dispositions.every((record) => !record.destroyed), true);
    await fixture.clean(follow.pids);
  } finally {
    await fixture.observer.query('DELETE FROM "MobileAuthChallenge" WHERE "id" = ANY($1::text[])', [[success, rolledBack, priorId]]);
  }
}

export async function executorCases(target: FixtureTarget, run: RunCase) {
  await run("commit, rollback, exactly-once normal reuse and SET LOCAL reset", () => withFixture(target, async (fixture) => {
    const id = randomUUID();
    const owned = await ownedPool(fixture);
    const settings = "SELECT current_setting('lock_timeout'), current_setting('statement_timeout'), current_setting('idle_in_transaction_session_timeout')";
    const raw = await fixture.pool.connect();
    let before: unknown;
    let same: number;
    try {
      same = await verifyFixtureIdentity(raw, target);
      before = (await raw.query({ text: settings, rowMode: "array" })).rows;
    } finally { raw.release(); }
    try {
      assert.equal((await owned.execute((tx) => insert(tx, id))).status, "committed");
      const after = await fixture.pool.connect();
      try {
        assert.equal(await verifyFixtureIdentity(after, target), same);
        assert.deepEqual((await after.query({ text: settings, rowMode: "array" })).rows, before);
      } finally { after.release(); }
      assert.deepEqual(owned.dispositions, [{ pid: same, destroyed: false }]);
      await independentWrites(fixture, owned, id, true);
    } finally { await fixture.observer.query('DELETE FROM "MobileAuthChallenge" WHERE "id" = $1', [id]); }
  }));

  await run("pool exhaustion, driver wait removal and recovery", () => withFixture(target, async (fixture) => {
    const held = await fixture.pool.connect();
    const owned = await ownedPool(fixture);
    try {
      await verifyFixtureIdentity(held, target);
      const pending = Array.from({ length: 4 }, () => owned.execute(async () => assert.fail()));
      await waitCondition(() => fixture.pool.waitingCount === 4, 1_000);
      assert.deepEqual(await owned.execute(async () => assert.fail()), { status: "failed", reason: "admission_full" });
      for (const operation of pending) {
        assert.deepEqual(await operation, { status: "failed", reason: "acquisition_failed" });
      }
      assert.equal(fixture.pool.waitingCount, 0);
    } finally { held.release(); }
    assert.equal(owned.attempts(), 4);
    await independentWrites(fixture, owned, randomUUID(), false);
  }));

  await run("late checkout delivery discards without BEGIN", () => withFixture(target, async (fixture) => {
    const checkout = gate();
    const owned = await ownedPool(fixture, { checkout: checkout.wait });
    const operation = owned.execute(async () => assert.fail());
    try {
      await checkout.entered;
      assert.deepEqual(await operation, { status: "failed", reason: "startup_timeout" });
    } finally { checkout.open(); }
    await waitCondition(() => owned.dispositions.length === 1, 2_000);
    assert.deepEqual(owned.events, []);
    assert.equal(owned.dispositions[0].destroyed, true);
    await independentWrites(fixture, owned, randomUUID(), false);
  }));

  const cases = [
    "delayed BEGIN", "initialization failure", "statement timeout", "lock timeout", "idle deadline",
    "outstanding SQL deadline", "caught statement failure", "active disconnect", "commit withheld",
    "commit acknowledgement lost", "rollback withheld", "disconnect during commit attempt",
    "disconnect during rollback attempt", "rollback rejected", "commit rejected", "actual ROLLBACK tag from COMMIT",
  ] as const;
  for (const name of cases) await run(name, () => withFixture(target, async (fixture) => {
    const id = randomUUID();
    const latch = gate();
    let scope: MobileTransaction | undefined;
    let sqlState: string | undefined;
    const absentOnFailure = name !== "commit acknowledgement lost";
    const owned = await ownedPool(fixture, { async query(text, pid, forward) {
      if (name === "delayed BEGIN" && text === begin) await latch.wait();
      if (name === "initialization failure" && text === statementLimit) return forward("SET LOCAL statement_timeout = 'invalid'");
      if (name === "outstanding SQL deadline" && text === statementLimit) return forward("SET LOCAL statement_timeout = '8500ms'");
      if (text === "COMMIT" && name === "commit withheld") await latch.wait();
      if (text === "ROLLBACK" && name === "rollback withheld") await latch.wait();
      if (text === "ROLLBACK" && name === "rollback rejected") return forward("ROLLBACK INVALID_FIXTURE_OPTION");
      if (text === "COMMIT" && name === "commit rejected") {
        await forward("CREATE TEMP TABLE cc_case_parent (id text PRIMARY KEY) ON COMMIT DROP");
        await forward("CREATE TEMP TABLE cc_case_ref (id text REFERENCES cc_case_parent(id) DEFERRABLE INITIALLY DEFERRED) ON COMMIT DROP");
        await forward("INSERT INTO cc_case_ref VALUES ('fictional-missing-parent')");
      }
      if ((text === "COMMIT" && name === "disconnect during commit attempt") ||
        (text === "ROLLBACK" && name === "disconnect during rollback attempt")) await fixture.terminate(pid);
      if (text === "COMMIT" && name === "actual ROLLBACK tag from COMMIT") {
        await forward("SELECT 1 / 0").catch(() => {});
      }
      if (text === "COMMIT" && name === "commit acknowledgement lost") {
        const result = await forward();
        assert.equal(result.command, "COMMIT");
        assert.equal(await exists(fixture, id), true);
        throw new Error("Synthetic loss at driver delivery boundary");
      }
      if (text.trimStart().startsWith("SELECT date_trunc") && name === "active disconnect") await fixture.terminate(pid);
      try {
        if (text.trimStart().startsWith("SELECT date_trunc") && name === "statement timeout") return await forward("SELECT pg_sleep(4)");
        if (text.trimStart().startsWith("SELECT date_trunc") && name === "outstanding SQL deadline") return await forward("SELECT pg_sleep(8)");
        if (text.trimStart().startsWith("SELECT date_trunc") && name === "caught statement failure") return await forward("SELECT 1 / 0");
        return await forward();
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error) sqlState = String(error.code);
        throw error;
      }
    } });
    if (name === "lock timeout") {
      await fixture.blocker.query('BEGIN');
      await fixture.blocker.query('LOCK TABLE "MobileAuthChallenge" IN ACCESS EXCLUSIVE MODE');
    }
    try {
      const operation = owned.execute(async (tx) => {
        scope = tx;
        if (name === "idle deadline") await latch.wait();
        if (name === "caught statement failure") {
          await tx.query("clock").catch(() => {});
          return "Fictional callback result";
        }
        await insert(tx, id);
        if (name === "rollback withheld" || name === "rollback rejected" || name === "disconnect during rollback attempt") {
          throw new Error("Synthetic callback abort");
        }
        return "Fictional callback result";
      });
      const result = await operation;
      assert.equal(result.status, "failed");
      assert.equal(owned.dispositions.length, 1);
      if (name === "lock timeout") assert.equal(sqlState, "55P03");
      if (name === "statement timeout") assert.equal(sqlState, "57014");
      if (name === "commit acknowledgement lost" || name === "commit withheld" || name === "commit rejected" ||
        name === "disconnect during commit attempt") {
        assert.deepEqual(result, { status: "failed", reason: "uncertain_commit" });
      }
      if (name === "actual ROLLBACK tag from COMMIT") assert.deepEqual(result, { status: "failed", reason: "invalid_commit" });
      if (name === "rollback withheld" || name === "rollback rejected") {
        assert.deepEqual(result, { status: "failed", reason: "rollback_unconfirmed" });
      }
      if (scope) await assert.rejects(scope.query("clock"));
    } finally {
      latch.open();
      if (name === "lock timeout") await fixture.blocker.query("ROLLBACK");
    }
    await independentWrites(fixture, owned, id, !absentOnFailure);
  }), 25_000);
}
