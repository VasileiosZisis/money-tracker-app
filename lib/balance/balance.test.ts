import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@/generated/prisma/client";

import {
  computeTotalBalanceSummary,
  findEarliestCompletedActivityMonth,
  getLatestCompletedMonth,
  listInclusiveMonths,
  resolveBalancePeriod,
  type BalanceAdjustmentLike,
  type BalanceTransactionLike,
} from "@/lib/balance";
import type { BalanceRangeQuery } from "@/lib/validators/balance-adjustment";

const REFERENCE_DATE = "2026-07-01";

function money(value: string) {
  return new Prisma.Decimal(value);
}

function resolve(selection: BalanceRangeQuery, earliestActivityMonth?: string | null) {
  return resolveBalancePeriod({
    selection,
    referenceDate: REFERENCE_DATE,
    earliestActivityMonth,
  });
}

test("completed-month utilities work across year boundaries", () => {
  assert.equal(getLatestCompletedMonth("2026-01-15"), "2025-12");
  assert.deepEqual(listInclusiveMonths("2025-11", "2026-02"), [
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
  ]);
  assert.throws(() => listInclusiveMonths("2026-02", "2026-01"));
  assert.throws(() => listInclusiveMonths("2026-13", "2026-13"));
});

test("current-year and trailing presets resolve to completed months", () => {
  const expected = new Map<string, [string, string]>([
    ["current-year", ["2026-01", "2026-06"]],
    ["last-3-months", ["2026-04", "2026-06"]],
    ["last-6-months", ["2026-01", "2026-06"]],
    ["last-9-months", ["2025-10", "2026-06"]],
    ["last-12-months", ["2025-07", "2026-06"]],
  ]);

  for (const [balanceRange, [startMonth, endMonth]] of expected) {
    assert.deepEqual(resolve({ balanceRange } as BalanceRangeQuery), {
      startMonth,
      endMonth,
    });
  }
});

test("previous full-year presets use calendar-year boundaries", () => {
  assert.deepEqual(resolve({ balanceRange: "previous-1-year" }), {
    startMonth: "2025-01",
    endMonth: "2025-12",
  });
  assert.deepEqual(resolve({ balanceRange: "previous-2-years" }), {
    startMonth: "2024-01",
    endMonth: "2025-12",
  });
  assert.deepEqual(resolve({ balanceRange: "previous-3-years" }), {
    startMonth: "2023-01",
    endMonth: "2025-12",
  });
});

test("all-time and January empty periods resolve deterministically", () => {
  assert.deepEqual(resolve({ balanceRange: "all-time" }, "2024-08"), {
    startMonth: "2024-08",
    endMonth: "2026-06",
  });
  assert.equal(resolve({ balanceRange: "all-time" }), null);
  assert.equal(
    resolveBalancePeriod({
      selection: { balanceRange: "current-year" },
      referenceDate: "2026-01-15",
    }),
    null,
  );
});

test("custom month and year periods are inclusive and completed", () => {
  assert.deepEqual(
    resolve({
      balanceRange: "custom",
      balanceMode: "months",
      balanceStart: "2026-02",
      balanceEnd: "2026-06",
    }),
    { startMonth: "2026-02", endMonth: "2026-06" },
  );
  assert.deepEqual(
    resolve({
      balanceRange: "custom",
      balanceMode: "years",
      balanceStart: "2024",
      balanceEnd: "2025",
    }),
    { startMonth: "2024-01", endMonth: "2025-12" },
  );
});

test("invalid custom periods are rejected", () => {
  assert.throws(() =>
    resolve({
      balanceRange: "custom",
      balanceMode: "months",
      balanceStart: "2026-06",
      balanceEnd: "2026-02",
    }),
  );
  assert.throws(() =>
    resolve({
      balanceRange: "custom",
      balanceMode: "months",
      balanceStart: "2026-06",
      balanceEnd: "2026-07",
    }),
  );
  assert.throws(() =>
    resolve({
      balanceRange: "custom",
      balanceMode: "years",
      balanceStart: "2025",
      balanceEnd: "2026",
    }),
  );
});

test("earliest activity uses completed transactions and adjustments only", () => {
  const transactions: BalanceTransactionLike[] = [
    { type: "INCOME", amount: money("10"), localDate: "2025-03-10" },
    { type: "EXPENSE", amount: money("2"), localDate: "2026-07-01" },
  ];
  const adjustments: BalanceAdjustmentLike[] = [
    { amount: money("100"), effectiveMonth: "2024-11" },
    { amount: money("50"), effectiveMonth: "2026-08" },
  ];

  assert.equal(
    findEarliestCompletedActivityMonth({
      referenceDate: REFERENCE_DATE,
      transactions,
      adjustments,
    }),
    "2024-11",
  );
});

test("summary calculates starting balance, monthly change, carry, and ending balance", () => {
  const summary = computeTotalBalanceSummary({
    period: { startMonth: "2026-02", endMonth: "2026-04" },
    transactions: [
      { type: "INCOME", amount: money("500"), localDate: "2026-01-05" },
      { type: "EXPENSE", amount: money("200"), localDate: "2026-01-10" },
      { type: "INCOME", amount: money("100"), localDate: "2026-02-05" },
      { type: "EXPENSE", amount: money("50"), localDate: "2026-02-06" },
      { type: "EXPENSE", amount: money("200"), localDate: "2026-04-02" },
      { type: "INCOME", amount: money("999"), localDate: "2026-07-01" },
    ],
    adjustments: [
      { amount: money("1000"), effectiveMonth: "2025-12" },
      { amount: money("25"), effectiveMonth: "2026-02" },
      { amount: money("999"), effectiveMonth: "2026-08" },
    ],
  });

  assert.equal(summary.startingBalance.toFixed(2), "1300.00");
  assert.equal(summary.netChange.toFixed(2), "-125.00");
  assert.equal(summary.endingBalance.toFixed(2), "1175.00");
  assert.deepEqual(
    summary.monthlyBalances.map(({ month, endingBalance }) => [
      month,
      endingBalance.toFixed(2),
    ]),
    [
      ["2026-02", "1375.00"],
      ["2026-03", "1375.00"],
      ["2026-04", "1175.00"],
    ],
  );
  assert(summary.endingBalance.eq(summary.startingBalance.plus(summary.netChange)));
});

test("summary rounds monthly values and preserves negative balances", () => {
  const summary = computeTotalBalanceSummary({
    period: { startMonth: "2026-01", endMonth: "2026-02" },
    transactions: [
      { type: "EXPENSE", amount: money("10.005"), localDate: "2025-12-10" },
      { type: "EXPENSE", amount: money("2.005"), localDate: "2026-01-10" },
    ],
    adjustments: [],
  });

  assert.equal(summary.startingBalance.toFixed(2), "-10.01");
  assert.equal(summary.netChange.toFixed(2), "-2.01");
  assert.equal(summary.endingBalance.toFixed(2), "-12.02");
  assert.equal(summary.monthlyBalances[1]?.endingBalance.toFixed(2), "-12.02");
});
