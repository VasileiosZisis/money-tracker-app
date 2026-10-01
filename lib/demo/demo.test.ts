import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@/generated/prisma/client";

import { updateDemo, resetDemo } from "@/actions/demo";
import { calculateDemo } from "./calculate";
import { createDemoSnapshot, DEMO_DATE, DEMO_MONTH } from "./fixtures";
import { defaultDemoSelection, demoHref, normalizeDemoSelection } from "./selection";
import { transitionDemo } from "./transitions";
import type { DemoSnapshot, DemoTransactionFields } from "./types";

const utility = "cdemoutilitytemplate";
const freelance = "cdemofreelancetemplate";
const fields: DemoTransactionFields = { type: "EXPENSE", amount: "0.10", localDate: DEMO_DATE, categoryId: "cdemofoodcategory", subcategoryId: null, source: null, note: null };
const calculate = (snapshot: DemoSnapshot) => calculateDemo(snapshot, defaultDemoSelection);

test("sample covers 24 completed months and uses exact actual amounts", () => {
  const data = calculate(createDemoSnapshot());
  assert.equal(data.dashboard.income, "2800.00");
  assert.equal(data.dashboard.expense, "1190.15");
  assert.equal(data.dashboard.netLeft, "1609.85");
  assert.equal(data.dashboard.pendingIncome, "450.00");
  assert.equal(data.dashboard.realization, "86.2");
  assert.equal(data.insights.longTerm.completedMonthCount, 24);
  assert.equal(data.insights.longTerm.hasSufficientHistory, true);
  assert.equal(data.balance.chart.length, 24);
  assert.equal(data.balance.chart.at(-1)?.month, "2026-08");
  assert.equal(data.dashboard.confidence, "high");
});

test("creating fractional expenses is Decimal-safe and visitors are isolated", () => {
  const original = createDemoSnapshot();
  let next = transitionDemo(original, { kind: "create", fields });
  next = transitionDemo(next, { kind: "create", fields: { ...fields, amount: "0.20" } });
  assert.equal(calculate(next).dashboard.expense, "1190.45");
  assert.equal(calculate(original).dashboard.expense, "1190.15");
  assert.equal(calculate(createDemoSnapshot()).dashboard.expense, "1190.15");
});

test("pending income affects projection only; receiving can exceed 100% realization", () => {
  const original = createDemoSnapshot();
  const before = calculate(original);
  assert.equal(new Prisma.Decimal(before.dashboard.projectedNet).minus(before.dashboard.safeToSpend).toFixed(2), "450.00");
  const skipped = calculate(transitionDemo(original, { kind: "skip", templateId: freelance, month: DEMO_MONTH }));
  assert.equal(skipped.dashboard.safeToSpend, before.dashboard.safeToSpend);
  assert.equal(skipped.dashboard.realization, before.dashboard.realization);
  const next = transitionDemo(original, { kind: "handle", templateId: freelance, month: DEMO_MONTH, amount: "700.00", localDate: DEMO_DATE, note: "" });
  const received = calculate(next);
  assert.equal(received.dashboard.income, "3500.00");
  assert.equal(received.dashboard.pendingIncome, "0.00");
  assert.equal(received.dashboard.realization, "107.7");
  assert.deepEqual(calculate(transitionDemo(next, { kind: "undo", templateId: freelance, month: DEMO_MONTH })).dashboard, before.dashboard);
});

test("generated bill inherits metadata; undo removes it; repeated handling is rejected", () => {
  const original = createDemoSnapshot();
  const next = transitionDemo(original, { kind: "handle", templateId: utility, month: DEMO_MONTH, amount: "85.00", localDate: DEMO_DATE, note: "" });
  const generated = next.transactions.find((row) => !original.transactions.some((item) => item.id === row.id))!;
  assert.equal(generated.source, "Electricity provider");
  assert.equal(generated.note, "Monthly electricity");
  assert.equal(generated.categoryId, "cdemoutilitiescategory");
  assert.equal(calculate(next).dashboard.expense, "1275.15");
  assert.throws(() => transitionDemo(next, { kind: "handle", templateId: utility, month: DEMO_MONTH, amount: "85.00", localDate: DEMO_DATE, note: "" }));
  assert.deepEqual(transitionDemo(next, { kind: "undo", templateId: utility, month: DEMO_MONTH }), original);
});

test("linking keeps actual totals unchanged; undo preserves linked transactions", () => {
  const original = createDemoSnapshot();
  const transactionId = "cdemo202609electricity";
  const next = transitionDemo(original, { kind: "link", templateId: utility, month: DEMO_MONTH, transactionId });
  assert.equal(calculate(next).dashboard.expense, calculate(original).dashboard.expense);
  assert.equal(new Prisma.Decimal(calculate(original).dashboard.forecastRemainingSpend).minus(calculate(next).dashboard.forecastRemainingSpend).toFixed(2), "85.00");
  assert.throws(() => transitionDemo(next, { kind: "link", templateId: "cdemointernettemplate", month: DEMO_MONTH, transactionId }));
  assert.deepEqual(transitionDemo(next, { kind: "undo", templateId: utility, month: DEMO_MONTH }), original);
});

test("linked income uses its actual amount and undo keeps the income", () => {
  const original = createDemoSnapshot();
  const manual = transitionDemo(original, { kind: "create", fields: { ...fields, type: "INCOME", categoryId: "cdemofreelancecategory", amount: "700.00" } });
  const transaction = manual.transactions.find((row) => !original.transactions.some((item) => item.id === row.id))!;
  const linked = transitionDemo(manual, { kind: "link", templateId: freelance, month: DEMO_MONTH, transactionId: transaction.id });
  assert.equal(calculate(linked).dashboard.income, "3500.00");
  assert.equal(calculate(linked).dashboard.realization, "107.7");
  assert.equal(calculate(linked).dashboard.pendingIncome, "0.00");
  assert.deepEqual(transitionDemo(linked, { kind: "undo", templateId: freelance, month: DEMO_MONTH }), manual);
  assert.throws(() => transitionDemo(original, { kind: "link", templateId: freelance, month: DEMO_MONTH, transactionId: "cdemo202609electricity" }));
  assert.throws(() => transitionDemo(original, { kind: "link", templateId: utility, month: DEMO_MONTH, transactionId: original.transactions.find((row) => row.type === "EXPENSE" && row.localDate.startsWith("2024-09"))!.id }));
});

test("deleting associated transactions makes plans unhandled; updates cannot break links", () => {
  const original = createDemoSnapshot();
  const next = transitionDemo(original, { kind: "link", templateId: utility, month: DEMO_MONTH, transactionId: "cdemo202609electricity" });
  const row = next.transactions.find((item) => item.id === "cdemo202609electricity")!;
  const { id: ignoredId, createdAt: ignoredDate, ...linkedFields } = row;
  void ignoredId; void ignoredDate;
  assert.throws(() => transitionDemo(next, { kind: "update", id: row.id, fields: { ...linkedFields, localDate: "2026-08-12" } }));
  assert.throws(() => transitionDemo(next, { kind: "update", id: row.id, fields: { ...linkedFields, type: "INCOME", categoryId: "cdemosalarycategory" } }));
  const removed = transitionDemo(next, { kind: "delete", id: row.id });
  assert.equal(calculate(removed).planned.find((item) => item.id === utility)?.status, "overdue");
  assert.equal(removed.occurrences.some((item) => item.transactionId === row.id), false);
});

test("skipping reserves no bill money and creates no actual transaction", () => {
  const original = createDemoSnapshot();
  const next = transitionDemo(original, { kind: "skip", templateId: utility, month: DEMO_MONTH });
  assert.deepEqual(next.transactions, original.transactions);
  assert.equal(new Prisma.Decimal(calculate(original).dashboard.safeToSpend).plus("85.00").toFixed(2), calculate(next).dashboard.safeToSpend);
  assert.deepEqual(transitionDemo(next, { kind: "undo", templateId: utility, month: DEMO_MONTH }), original);
});

test("incomplete month changes neither historical medians nor Total Balance", () => {
  const original = createDemoSnapshot();
  const next = transitionDemo(original, { kind: "create", fields: { ...fields, amount: "9999.99" } });
  assert.deepEqual(calculate(next).balance, calculate(original).balance);
  assert.equal(calculate(next).insights.result.typicalMonthlyResult, calculate(original).insights.result.typicalMonthlyResult);
  assert.deepEqual(calculate(next).insights.composition, calculate(original).insights.composition);
  assert.equal(new Prisma.Decimal(calculate(next).dashboard.safeToSpend).lt(0), true);
});

test("eligible empty completed months are retained and balances carry forward", () => {
  const original = createDemoSnapshot();
  const emptyMonth = "2026-07";
  const removedIds = new Set(original.transactions.filter((row) => row.localDate.startsWith(emptyMonth)).map((row) => row.id));
  const next: DemoSnapshot = { ...original, transactions: original.transactions.filter((row) => !removedIds.has(row.id)), occurrences: original.occurrences.filter((row) => row.month !== emptyMonth) };
  const data = calculate(next);
  assert.equal(data.insights.result.months.find((row) => row.month === emptyMonth)?.result, "0.00");
  const july = data.balance.chart.findIndex((row) => row.month === emptyMonth);
  assert.equal(data.balance.chart[july].endingBalance, data.balance.chart[july - 1].endingBalance);
  const past = calculateDemo(next, { ...defaultDemoSelection, month: emptyMonth });
  assert.equal(past.dashboard.forecastRemainingSpend, "0.00");
  assert.equal(past.dashboard.weeklySafeSpend, "0.00");
});

test("strict validation rejects bad money, dates, categories, snapshots, and command IDs", () => {
  const original = createDemoSnapshot();
  for (const amount of ["0", "-1", "1.001", "1000000000000.00", "NaN", "Infinity", "1e3"]) assert.throws(() => transitionDemo(original, { kind: "create", fields: { ...fields, amount } }));
  for (const localDate of ["2026-02-30", "2026-09-16", "2026-10-01", "2024-08-31", "2026-9-15"]) assert.throws(() => transitionDemo(original, { kind: "create", fields: { ...fields, localDate } }));
  assert.throws(() => transitionDemo(original, { kind: "create", fields: { ...fields, categoryId: "cdemosalarycategory" } }));
  assert.throws(() => transitionDemo(original, { kind: "create", fields: { ...fields, subcategoryId: "cdemogroceriessubcategory", categoryId: "cdemotransportcategory" } }));
  assert.throws(() => transitionDemo({ ...original, version: 2 }, { kind: "calculate" }));
  assert.throws(() => transitionDemo({ ...original, userId: "real-user" }, { kind: "calculate" }));
  assert.throws(() => transitionDemo(original, { kind: "delete", id: "cliveaccounttransaction" }));
  assert.throws(() => transitionDemo(original, { kind: "create", fields: { ...fields, userId: "real-user" } }));
  assert.throws(() => transitionDemo(original, { kind: "handle", templateId: utility, month: DEMO_MONTH, localDate: "2026-08-12", amount: "10.00", note: "" }));
});

test("manual and generated records stop at the fixed example date", () => {
  const original = createDemoSnapshot();
  assert.doesNotThrow(() => transitionDemo(original, { kind: "create", fields: { ...fields, localDate: DEMO_DATE } }));
  assert.doesNotThrow(() => transitionDemo(original, { kind: "handle", templateId: utility, month: DEMO_MONTH, localDate: DEMO_DATE, amount: "85.00", note: "" }));
  assert.throws(() => transitionDemo(original, { kind: "create", fields: { ...fields, localDate: "2026-09-16" } }));
  assert.throws(() => transitionDemo(original, { kind: "update", id: "cdemo202609electricity", fields: { ...fields, localDate: "2026-09-16" } }));
  assert.throws(() => transitionDemo(original, { kind: "handle", templateId: utility, month: DEMO_MONTH, localDate: "2026-09-16", amount: "85.00", note: "" }));
});

test("snapshot limits and occurrence relationships reject malformed inputs", () => {
  const original = createDemoSnapshot();
  assert.throws(() => transitionDemo({ ...original, transactions: [...original.transactions, original.transactions[0]] }, { kind: "calculate" }));
  assert.throws(() => transitionDemo({ ...original, transactions: Array.from({ length: 501 }, (_, index) => ({ ...original.transactions[0], id: `cdemolimit${index}` })) }, { kind: "calculate" }));
  assert.throws(() => transitionDemo({ ...original, occurrences: [...original.occurrences, original.occurrences[0]] }, { kind: "calculate" }));
  assert.throws(() => transitionDemo({ ...original, occurrences: [{ templateId: utility, month: DEMO_MONTH, status: "PAID", transactionId: "cmissingtransaction", paymentSource: "LINKED" }] }, { kind: "calculate" }));
  assert.throws(() => transitionDemo({ ...original, occurrences: [{ templateId: utility, month: DEMO_MONTH, status: "SKIPPED", transactionId: original.transactions[0].id, paymentSource: "GENERATED" }] }, { kind: "calculate" }));
});

test("public actions return plain display data and reject account identity", async () => {
  const result = await updateDemo(createDemoSnapshot(), defaultDemoSelection, { kind: "calculate" });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(JSON.parse(JSON.stringify(result.data)), result.data);
  const rejected = await updateDemo(createDemoSnapshot(), { ...defaultDemoSelection, userId: "real-user" }, { kind: "calculate" });
  assert.equal(rejected.ok, false);
  const reset = await resetDemo();
  assert.deepEqual(reset.snapshot, createDemoSnapshot());
  assert.deepEqual(reset.selection, defaultDemoSelection);
});

test("demo destinations normalize filters and retain month independently", () => {
  assert.equal(normalizeDemoSelection({ month: "2026-10", categoryId: "clivecategory" }).month, DEMO_MONTH);
  const filtered = normalizeDemoSelection({ view: "transactions", month: "2026-08", type: "EXPENSE", categoryId: "cdemofoodcategory", subcategoryId: "cdemogroceriessubcategory" });
  assert.equal(filtered.subcategoryId, "cdemogroceriessubcategory");
  assert.equal(normalizeDemoSelection({ ...filtered, type: "INCOME" }).categoryId, "");
  assert.equal(demoHref(filtered, { type: "ALL", categoryId: "", subcategoryId: "" }), "/demo?view=transactions&month=2026-08");
});
