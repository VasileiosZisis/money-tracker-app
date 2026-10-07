import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "../generated/prisma/client";
import { transactionInputSchema } from "../lib/validators/transaction";
import { persistPreviewData } from "./preview-seed-persistence";
import { assertPreviewTarget, buildPreviewData, insertMissing, requireSeedAccount } from "./preview-seed";

const account = { id: "test-account", currency: "EUR", timeZone: "Europe/Chisinau", hasCompletedSetup: true };
const instant = new Date("2026-10-07T08:00:00Z");
const target = "postgresql://preview_owner:fake@ep-snowy-king-agmdfwbn-pooler.c-2.eu-central-1.aws.neon.tech/previewdb?sslmode=require";

test("reject unsafe targets and incomplete accounts", () => {
  assert.doesNotThrow(() => assertPreviewTarget(target));
  for (const url of [undefined, "invalid", target.replace("previewdb", "neondb"), target.replace("preview_owner", "owner"), target.replace("ep-snowy-king-agmdfwbn-pooler", "other-endpoint"), target + "&host=localhost"]) assert.throws(() => assertPreviewTarget(url));
  assert.throws(() => requireSeedAccount(null));
  assert.throws(() => requireSeedAccount({ ...account, hasCompletedSetup: false }));
  assert.throws(() => requireSeedAccount({ ...account, timeZone: "invalid" }));
});

test("deterministic account-specific history uses Decimal and valid local dates", () => {
  const data = buildPreviewData(account, instant);
  assert.deepEqual(data, buildPreviewData(account, instant));
  assert.equal(data.months[0], "2024-10");
  assert.equal(data.months.at(-1), "2026-10");
  assert.notEqual(data.categories[0].id, buildPreviewData({ ...account, id: "another-account" }, instant).categories[0].id);
  for (const row of data.transactions) {
    assert.ok(transactionInputSchema.safeParse({ ...row, amount: row.amount.toString() }).success);
    assert.ok(row.amount instanceof Prisma.Decimal && row.amount.gt(0));
    assert.equal(new Date(`${row.localDate}T12:00:00Z`).toISOString().slice(0, 10), row.localDate);
    assert.ok(row.localDate <= "2026-10-07");
    const category = data.categories.find(c => c.id === row.categoryId)!;
    assert.equal(row.type, category.type);
    assert.equal(category.userId, row.userId);
    assert.equal(data.subcategories.find(s => s.id === row.subcategoryId)!.categoryId, row.categoryId);
  }
  assert.ok(data.adjustments[0].amount.gt(0));
  assert.ok(data.adjustments[0].effectiveMonth < data.months.at(-1)!);
  assert.equal(data.adjustments[0].id, buildPreviewData(account, new Date("2026-11-07T08:00:00Z")).adjustments[0].id);
  const boundary = buildPreviewData(account, new Date("2026-09-30T22:00:00Z"));
  assert.equal(boundary.months.at(-1), "2026-10");
  assert.ok(boundary.transactions.every(r => r.localDate <= "2026-10-01"));
});

test("occurrences are compatible, generated metadata is inherited, pending items have no occurrences", () => {
  const data = buildPreviewData(account, instant);
  const linkedIds = new Set<string>();
  for (const row of [...data.billOccurrences, ...data.incomeOccurrences]) {
    if (row.status === "SKIPPED") {
      assert.equal(row.transactionId, null);
      assert.equal(row.paymentSource, null);
      continue;
    }
    const transaction = data.transactions.find(t => t.id === row.transactionId)!;
    assert.ok(transaction);
    assert.equal(transaction.userId, row.userId);
    assert.equal(transaction.localDate.slice(0, 7), row.month);
    assert.ok(!linkedIds.has(transaction.id));
    linkedIds.add(transaction.id);
    const template = "plannedBillId" in row ? data.bills.find(t => t.id === row.plannedBillId)! : data.incomes.find(t => t.id === row.plannedIncomeId)!;
    assert.equal(transaction.categoryId, template.categoryId);
    assert.equal(transaction.subcategoryId, template.subcategoryId);
    if (row.paymentSource === "GENERATED") {
      assert.equal(transaction.source, template.source);
      assert.equal(transaction.note, template.note);
    }
  }
  assert.ok(data.billOccurrences.some(r => r.paymentSource === "LINKED"));
  assert.ok(data.billOccurrences.some(r => r.paymentSource === "GENERATED"));
  assert.ok(data.billOccurrences.some(r => r.status === "SKIPPED"));
  assert.ok(!data.billOccurrences.some(r => r.month === "2026-10"));
  assert.ok(!data.incomeOccurrences.some(r => r.month === "2026-10" && r.plannedIncomeId === data.incomes[1].id));
});

test("repeat insertion preserves edits and rejects ownership/relationship collisions before writes", async () => {
  const rows = [{ id: "a", userId: "u", categoryId: "c", amount: "10.00" }];
  const stored: typeof rows = [];
  const read = async () => stored;
  const create = async (missing: typeof rows) => { stored.push(...missing); return { count: missing.length }; };
  assert.deepEqual(await insertMissing(rows, read, create), { inserted: 1, skipped: 0 });
  stored[0] = { ...stored[0], amount: "99.00" };
  assert.deepEqual(await insertMissing(rows, read, create), { inserted: 0, skipped: 1 });
  assert.equal(stored[0].amount, "99.00");
  for (const changed of [{ ...stored[0], userId: "other" }, { ...stored[0], categoryId: "other" }]) {
    await assert.rejects(insertMissing(rows, async () => [changed], async () => { assert.fail("must not write"); }));
  }
});

test("full persistence inserts each collection, skips repeat runs and inherits retained metadata", async () => {
  type Row = { id: string; userId?: string; categoryId?: string; transactionId?: string | null; source?: string | null; note?: string | null };
  const store: Record<string, Row[]> = {};
  const models = ["category", "subcategory", "plannedBill", "plannedIncome", "transaction", "plannedBillOccurrence", "plannedIncomeOccurrence", "balanceAdjustment"];
  const client: Record<string, unknown> = {};
  for (const model of models) {
    store[model] = [];
    client[model] = {
      findMany: async ({ where }: { where: { id: { in: string[] }; userId?: string } }) => store[model].filter(r => where.id.in.includes(r.id) && (!where.userId || r.userId === where.userId)),
      createMany: async ({ data }: { data: Row[] }) => {
        for (const row of data) {
          if (row.categoryId) assert.ok(store.category.some(c => c.id === row.categoryId));
          if (row.transactionId) assert.ok(store.transaction.some(t => t.id === row.transactionId));
        }
        store[model].push(...data.map(r => ({ ...r })));
        return { count: data.length };
      },
    };
  }
  const tx = client as unknown as Prisma.TransactionClient;
  const initial = await persistPreviewData(tx, buildPreviewData(account, instant), account.id);
  assert.ok(Object.values(initial).every(r => typeof r === "string" || r.inserted > 0));
  assert.ok(models.every(model => store[model].length > 0));
  const firstCounts = models.map(model => store[model].length);
  const repeated = await persistPreviewData(tx, buildPreviewData(account, instant), account.id);
  assert.ok(Object.values(repeated).every(r => typeof r === "string" || r.inserted === 0));
  assert.deepEqual(models.map(model => store[model].length), firstCounts);
  const rent = store.plannedBill[0];
  rent.source = "Edited landlord";
  rent.note = "Edited note";
  const next = buildPreviewData(account, new Date("2026-12-07T08:00:00Z"));
  await persistPreviewData(tx, next, account.id);
  const occurrence = next.billOccurrences.find(r => r.plannedBillId === rent.id && r.month === "2026-11")!;
  assert.equal(occurrence.paymentSource, "GENERATED");
  const newTransaction = store.transaction.find(r => r.id === occurrence.transactionId)!;
  assert.equal(newTransaction.source, rent.source);
  assert.equal(newTransaction.note, rent.note);
  assert.equal(store.balanceAdjustment.length, 1);
  const beforeConflict = models.map(model => store[model].length);
  store.category[0].userId = "different-user";
  await assert.rejects(persistPreviewData(tx, buildPreviewData(account, instant), account.id));
  assert.deepEqual(models.map(model => store[model].length), beforeConflict);
});
