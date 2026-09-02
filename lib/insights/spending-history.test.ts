import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@/generated/prisma/client";

import {
  buildSpendingInsight,
  type SpendingInsightTransaction,
} from "@/lib/insights/spending-history";

function transaction(
  input: Omit<SpendingInsightTransaction, "amount"> & { amount: string },
): SpendingInsightTransaction {
  return {
    ...input,
    amount: new Prisma.Decimal(input.amount),
  };
}

test("builds completed history plus the current month and excludes current spending from the median", () => {
  const insight = buildSpendingInsight({
    categoryId: "groceries",
    categoryCreatedMonth: "2026-01",
    currentMonth: "2026-07",
    period: 3,
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "100.00",
        localDate: "2026-04-04",
        categoryId: "groceries",
      }),
      transaction({
        type: "EXPENSE",
        amount: "300.00",
        localDate: "2026-06-12",
        categoryId: "groceries",
      }),
      transaction({
        type: "EXPENSE",
        amount: "900.00",
        localDate: "2026-07-09",
        categoryId: "groceries",
      }),
    ],
  });

  assert.deepEqual(
    insight.months.map((month) => [month.month, month.categorySpending]),
    [
      ["2026-04", "100.00"],
      ["2026-05", "0.00"],
      ["2026-06", "300.00"],
      ["2026-07", "900.00"],
    ],
  );
  assert.equal(insight.typicalSpending, "100.00");
  assert.equal(insight.differenceFromTypical, "800.00");
  assert.equal(insight.completedMonthCount, 3);
  assert.equal(insight.hasLimitedHistory, false);
});

test("uses Decimal arithmetic for an even-month median and monthly net context", () => {
  const insight = buildSpendingInsight({
    categoryId: "food",
    categoryCreatedMonth: "2026-05",
    currentMonth: "2026-07",
    period: 6,
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "0.10",
        localDate: "2026-05-10",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "0.20",
        localDate: "2026-06-10",
        categoryId: "food",
      }),
      transaction({
        type: "INCOME",
        amount: "10.00",
        localDate: "2026-06-01",
        categoryId: "salary",
      }),
      transaction({
        type: "EXPENSE",
        amount: "2.55",
        localDate: "2026-06-11",
        categoryId: "travel",
      }),
    ],
  });

  assert.equal(insight.typicalSpending, "0.15");
  assert.equal(insight.completedMonthCount, 2);
  assert.equal(insight.hasLimitedHistory, true);
  assert.deepEqual(insight.months[1], {
    month: "2026-06",
    categorySpending: "0.20",
    totalExpenses: "2.75",
    actualNet: "7.25",
    isCurrentMonth: false,
  });
});

test("omits months before category creation and returns an unavailable comparison without completed history", () => {
  const insight = buildSpendingInsight({
    categoryId: "new-category",
    categoryCreatedMonth: "2026-07",
    currentMonth: "2026-07",
    period: 12,
    transactions: [],
  });

  assert.deepEqual(insight.months.map((month) => month.month), ["2026-07"]);
  assert.equal(insight.typicalSpending, null);
  assert.equal(insight.differenceFromTypical, null);
  assert.equal(insight.currentMonthSpending, "0.00");
  assert.equal(insight.hasCategorySpending, false);
});
