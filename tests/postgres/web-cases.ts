import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../../generated/prisma/client";
import { PrismaAdapter } from "../../lib/auth/prisma-adapter";

import { bindWebFixture } from "./bridges";
import { waitCondition, type RunCase } from "./cases";
import { createFixturePool, fixtureIdentitySql, requireFixtureIdentity, withFixture, type Fixture, type FixtureIdentity } from "./fixture";
import { gate } from "./owned-pool";
import type { FixtureTarget } from "./target";

async function confirmPrisma(client: Prisma.TransactionClient, target: FixtureTarget) {
  return requireFixtureIdentity(await client.$queryRaw<FixtureIdentity[]>(Prisma.raw(fixtureIdentitySql)), target);
}

async function fixtureRecord(client: Prisma.TransactionClient, id: string) {
  return client.user.create({ data: { id, name: "Fictional fixture", currency: "USD", timeZone: "UTC" } });
}

async function exists(fixture: Fixture, id: string) {
  return (await fixture.observer.query('SELECT 1 FROM "User" WHERE "id" = $1', [id])).rowCount === 1;
}

async function remove(fixture: Fixture, ids: string[]) {
  await fixture.observer.query('DELETE FROM "User" WHERE "id" = ANY($1::text[])', [ids]);
}

function isStartupTimeout(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2028" && /unable to start a transaction/i.test(error.message);
}

async function closeWebClient(prisma: PrismaClient, pool?: Fixture["pool"]) {
  const outcomes = await Promise.allSettled([prisma.$disconnect(), pool?.end()]);
  if (outcomes.some((outcome) => outcome.status === "rejected")) {
    throw new Error("Fixture Prisma cleanup could not be confirmed");
  }
}

async function ordinaryWeb(fixture: Fixture) {
  // Keep production pg pool sizing and timeout defaults, adding only fixture TLS and attestation.
  const pool = createFixturePool(fixture.target);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const id = randomUUID();
  try {
    await confirmPrisma(prisma, fixture.target);
    await fixtureRecord(prisma, id);
    bindWebFixture(prisma, id);
    const adapter = PrismaAdapter(prisma);
    const account = { userId: id, provider: "google", type: "oauth" as const, providerAccountId: "fictional-web-" + id };
    const sessionToken = "fictional-session-" + randomUUID();
    await adapter.linkAccount!(account);
    await adapter.createSession!({ userId: id, sessionToken, expires: new Date(Date.now() + 60_000) });
    assert.equal((await adapter.getUserByAccount!(account))?.id, id);
    assert.equal((await adapter.getSessionAndUser!(sessionToken))?.user.id, id);
    await adapter.deleteSession!(sessionToken);
    assert.equal(await adapter.getSessionAndUser!(sessionToken), null);

    const categories = await import("../../actions/categories");
    const bills = await import("../../actions/planned-bills");
    const income = await import("../../actions/planned-income");
    const imports = await import("../../lib/import/server");
    const expense = await prisma.category.create({ data: { name: "Fixture expense", type: "EXPENSE", userId: id } });
    const incomeCategory = await prisma.category.create({ data: { name: "Fixture income", type: "INCOME", userId: id } });
    assert.equal((await categories.updateCategoryDetails({
      id: expense.id, name: expense.name, existingSubcategories: [], deletedSubcategoryIds: [], newSubcategoryNames: ["Fixture subcategory"],
    })).ok, true);
    const tag = await prisma.subcategory.findFirstOrThrow({ where: { categoryId: expense.id } });
    assert.equal((await fixture.observer.query('SELECT 1 FROM "Tag" WHERE "id" = $1', [tag.id])).rowCount, 1);
    const bill = await prisma.plannedBill.create({
      data: { name: "Fixture bill", userId: id, dueDayOfMonth: 8, amount: "26.71", categoryId: expense.id, subcategoryId: tag.id },
    });
    const receipt = await prisma.plannedIncome.create({
      data: { name: "Fixture receipt", userId: id, expectedDayOfMonth: 8, amount: "11.03", categoryId: incomeCategory.id },
    });
    const localDate = new Date().toISOString().slice(0, 10);
    const month = localDate.slice(0, 7);
    assert.equal((await bills.markPlannedBillPaid({
      plannedBillId: bill.id, month, amount: "26.71", localDate,
    })).ok, true);
    assert.equal((await income.markPlannedIncomeReceived({
      plannedIncomeId: receipt.id, month, amount: "11.03", localDate,
    })).ok, true);
    const transactions = await prisma.transaction.findMany({ where: { userId: id }, orderBy: { amount: "desc" } });
    assert.deepEqual(transactions.map((entry) => ({
      amount: entry.amount.toFixed(2), type: entry.type, categoryId: entry.categoryId,
      subcategoryId: entry.subcategoryId, localDate: entry.localDate,
    })), [
      { amount: "26.71", type: "EXPENSE", categoryId: expense.id, subcategoryId: tag.id, localDate },
      { amount: "11.03", type: "INCOME", categoryId: incomeCategory.id, subcategoryId: null, localDate },
    ]);
    assert.equal((await fixture.observer.query('SELECT 1 FROM "Transaction" WHERE "id" = $1 AND "tagId" = $2',
      [transactions[0].id, tag.id])).rowCount, 1);
    assert.equal((await bills.undoPlannedBillOccurrence({ plannedBillId: bill.id, month })).ok, true);
    assert.equal((await income.undoPlannedIncomeOccurrence({ plannedIncomeId: receipt.id, month })).ok, true);
    assert.equal(await prisma.transaction.count({ where: { userId: id } }), 0);

    const csv = [
      "date,type,category,tag,amount",
      [localDate, "EXPENSE", expense.name, tag.name, "999999999999.99"].join(","),
      [localDate, "EXPENSE", expense.name, "", "0.01"].join(","),
    ].join("\n");
    const form = new FormData();
    form.set("file", new File([csv], "fixture.csv", { type: "text/csv" }));
    const preview = await imports.previewImportForUser(id, form);
    assert.ok(preview.ok);
    assert.equal(await prisma.transaction.count({ where: { userId: id } }), 0);
    const { rowsForConfirmation: rows, previewGeneratedAt, confirmationToken } = preview.data;
    assert.equal(rows[0]?.subcategoryName, tag.name);
    assert.equal(rows[0]?.resolvedCategoryId, expense.id);
    assert.equal((await imports.confirmImportForUser(id, {
      rows, previewGeneratedAt, confirmationToken, categoryResolutions: [],
    })).ok, true);
    const saved = await prisma.transaction.findMany({ where: { userId: id }, orderBy: { amount: "desc" } });
    assert.deepEqual(saved.map((row) => row.amount.toFixed(2)), ["999999999999.99", "0.01"]);
    assert.equal(saved[0].subcategoryId, tag.id);
    assert.equal(saved[0].amount.plus(saved[1].amount).toFixed(2), "1000000000000.00");
    const total = await fixture.observer.query<{ amount: string }>(
      'SELECT sum("amount")::text AS amount FROM "Transaction" WHERE "userId" = $1', [id],
    );
    assert.equal(total.rows[0].amount, "1000000000000.00");
  } finally {
    try {
      // Remove dependent records before the user cascade reaches the category restrict constraints.
      await fixture.observer.query('DELETE FROM "Transaction" WHERE "userId" = $1', [id]);
      await fixture.observer.query('DELETE FROM "PlannedBill" WHERE "userId" = $1', [id]);
      await fixture.observer.query('DELETE FROM "PlannedIncome" WHERE "userId" = $1', [id]);
      await remove(fixture, [id]);
    } finally {
      await closeWebClient(prisma, pool);
    }
  }
}

async function webFaultCases(target: FixtureTarget, run: RunCase) {
  const cases = ["startup", "statement", "lock", "commit-rejection", "commit-delivery", "rollback-disconnect"] as const;
  for (const name of cases) {
    await run("Prisma small-pool experiment: " + name, () => withFixture(target, async (fixture) => {
      const id = randomUUID();
      const unrelated = randomUUID();
      const gateStart = gate();
      const pids = new Set<number>();
      let terminalInvocations = 0;
      let lateStarts = 0;
      let startupCallbacks = 0;
      let armed = false;
      class FixtureAdapter extends PrismaPg {
        override async connect() {
          const driver = await super.connect();
          const start = driver.startTransaction.bind(driver);
          driver.startTransaction = async (isolation) => {
            if (armed && name === "startup") await gateStart.wait();
            const tx = await start(isolation);
            if (!armed && name !== "startup") return tx;
            const result = await tx.queryRaw({ sql: "SELECT pg_backend_pid()", args: [], argTypes: [] });
            const pid = Number(result.rows[0][0]);
            assert.ok(Number.isInteger(pid));
            pids.add(pid);
            if (name === "startup") lateStarts++;
            const execute = tx.executeRaw.bind(tx);
            tx.executeRaw = async (query) => {
              if (armed && name === "rollback-disconnect" && query.sql === "ROLLBACK") {
                terminalInvocations++;
                await fixture.terminate(pid);
              }
              if (armed && name === "commit-rejection" && query.sql === "COMMIT") {
                terminalInvocations++;
                // Produce a real deferred constraint failure at COMMIT.
                await execute({ sql: "SET CONSTRAINTS ALL DEFERRED", args: [], argTypes: [] });
              }
              const resultCount = await execute(query);
              if (armed && name === "commit-delivery" && query.sql === "COMMIT") {
                terminalInvocations++;
                assert.equal(await exists(fixture, id), true);
                throw new Error("Synthetic loss at Prisma adapter delivery boundary");
              }
              return resultCount;
            };
            return tx;
          };
          return driver;
        }
      }
      const prisma = new PrismaClient({ adapter: new FixtureAdapter(fixture.pool) });
      try {
        pids.add(await confirmPrisma(prisma, target));
        if (name === "lock") {
          await fixture.blocker.query("BEGIN");
          await fixture.blocker.query('LOCK TABLE "User" IN ACCESS EXCLUSIVE MODE');
        }
        armed = true;
        const outcome = prisma.$transaction(async (tx) => {
          if (name === "startup") {
            startupCallbacks++;
            return;
          }
          if (name === "lock") await tx.$executeRaw`SET LOCAL lock_timeout = '150ms'`;
          if (name === "statement") {
            await tx.$executeRaw`SET LOCAL statement_timeout = '150ms'`;
            await tx.$queryRaw`SELECT pg_sleep(1)`;
          }
          await fixtureRecord(tx, id);
          if (name === "rollback-disconnect") throw new Error("Synthetic rollback request");
          if (name === "commit-rejection") {
            await tx.$executeRaw`CREATE TEMP TABLE fixture_parent (id text PRIMARY KEY) ON COMMIT DROP`;
            await tx.$executeRaw`CREATE TEMP TABLE fixture_fk (
              id text REFERENCES fixture_parent(id) DEFERRABLE INITIALLY DEFERRED
            ) ON COMMIT DROP`;
            await tx.$executeRaw`INSERT INTO fixture_fk VALUES ('fictional-missing-user')`;
          }
        }, { maxWait: name === "startup" ? 200 : 2_000, timeout: 5_000 });
        void outcome.catch(() => {});
        try {
          if (name === "startup") {
            await gateStart.entered;
            await assert.rejects(outcome, isStartupTimeout);
          } else {
            await assert.rejects(outcome);
          }
        }
        finally { gateStart.open(); }
        if (name === "startup") {
          await waitCondition(() => lateStarts === 1 && fixture.pool.totalCount === fixture.pool.idleCount, 4_000);
          assert.equal(startupCallbacks, 0);
        }
        if (name === "lock") await fixture.blocker.query("ROLLBACK");
        armed = false;
        await fixture.clean(pids);
        assert.equal(await exists(fixture, id), name === "commit-delivery");
        await prisma.$transaction(async (tx) => {
          await confirmPrisma(tx, target);
          await fixtureRecord(tx, unrelated);
        });
        await assert.rejects(prisma.$transaction(async (tx) => {
          await tx.user.update({ where: { id: unrelated }, data: { name: "uncommitted" } });
          throw new Error("Synthetic rollback");
        }));
        const nameAfter = await fixture.observer.query<{ name: string }>('SELECT "name" FROM "User" WHERE "id" = $1', [unrelated]);
        assert.equal(nameAfter.rows[0]?.name, "Fictional fixture");
        assert.equal(terminalInvocations, ["commit-delivery", "commit-rejection", "rollback-disconnect"].includes(name) ? 1 : 0);
      } finally {
        armed = false;
        gateStart.open();
        if (name === "lock") await fixture.blocker.query("ROLLBACK").catch(() => {});
        try { await remove(fixture, [id, unrelated]); }
        finally { await closeWebClient(prisma); }
      }
    }), 26_000);
  }
}

export async function webCases(target: FixtureTarget, run: RunCase) {
  await run("Prisma production-style adapter: NextAuth, category, plans, import and exact cents",
    () => withFixture(target, ordinaryWeb), 25_000);
  await run("Prisma production-style adapter: batch commit and rollback", () => withFixture(target, async (fixture) => {
    const pool = createFixturePool(target);
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    const ids = Array.from({ length: 3 }, () => randomUUID());
    const create = (id: string) => prisma.user.create({ data: { id, name: "Fictional fixture" } });
    try {
      await confirmPrisma(prisma, target);
      await prisma.$transaction([create(ids[0]), create(ids[1])]);
      assert.equal(await exists(fixture, ids[0]), true);
      assert.equal(await exists(fixture, ids[1]), true);
      await assert.rejects(prisma.$transaction([create(ids[2]), create(ids[0])]), (error: unknown) =>
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002");
      assert.equal(await exists(fixture, ids[2]), false);
      assert.equal(await exists(fixture, ids[0]), true);
      assert.equal(await exists(fixture, ids[1]), true);
    } finally {
      try { await remove(fixture, ids); }
      finally { await closeWebClient(prisma, pool); }
    }
  }), 25_000);
  await run("Prisma production-style adapter: default acquisition timeout and independent recovery", () => withFixture(target, async (fixture) => {
    const pool = createFixturePool(target);
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    const id = randomUUID();
    const holders = Array.from({ length: 10 }, () => gate());
    const pending: Promise<void>[] = [];
    const pids = new Set<number>();
    try {
      pids.add(await confirmPrisma(prisma, target));
      for (const holder of holders) {
        const operation = prisma.$transaction(async (tx) => {
          pids.add(await confirmPrisma(tx, target));
          await holder.wait();
        });
        void operation.catch(() => {});
        pending.push(operation);
      }
      await Promise.all(holders.map((holder) => holder.entered));
      await assert.rejects(prisma.$transaction(async () => {
        throw new Error("Unexpected acquisition");
      }), isStartupTimeout);
      for (const holder of holders) holder.open();
      await Promise.all(pending);
      await fixture.clean(pids, 8_000, pool);
      await prisma.$transaction(async (tx) => { await fixtureRecord(tx, id); });
      assert.equal(await exists(fixture, id), true);
    } finally {
      for (const holder of holders) holder.open();
      await Promise.allSettled(pending);
      try { await remove(fixture, [id]); }
      finally { await closeWebClient(prisma, pool); }
    }
  }), 23_000);
  await webFaultCases(target, run);
}
