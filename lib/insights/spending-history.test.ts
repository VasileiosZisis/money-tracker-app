import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@/generated/prisma/client";

import {
  buildMonthlyResultInsight,
  buildSpendingCompositionInsight,
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

test("builds monthly results from first activity and counts inactive months after tracking begins", () => {
  const insight = buildMonthlyResultInsight({
    firstActivityMonth: "2026-02",
    currentMonth: "2026-07",
    period: 6,
    transactions: [
      transaction({
        type: "INCOME",
        amount: "100.00",
        localDate: "2026-02-01",
        categoryId: "salary",
      }),
      transaction({
        type: "EXPENSE",
        amount: "150.00",
        localDate: "2026-02-02",
        categoryId: "food",
      }),
      transaction({
        type: "INCOME",
        amount: "100.00",
        localDate: "2026-04-01",
        categoryId: "salary",
      }),
      transaction({
        type: "EXPENSE",
        amount: "50.00",
        localDate: "2026-04-02",
        categoryId: "food",
      }),
      transaction({
        type: "INCOME",
        amount: "100.00",
        localDate: "2026-05-01",
        categoryId: "salary",
      }),
      transaction({
        type: "EXPENSE",
        amount: "300.00",
        localDate: "2026-05-02",
        categoryId: "food",
      }),
      transaction({
        type: "INCOME",
        amount: "500.00",
        localDate: "2026-06-01",
        categoryId: "salary",
      }),
      transaction({
        type: "EXPENSE",
        amount: "100.00",
        localDate: "2026-06-02",
        categoryId: "food",
      }),
      transaction({
        type: "INCOME",
        amount: "1000.00",
        localDate: "2026-07-01",
        categoryId: "salary",
      }),
    ],
  });

  assert.deepEqual(
    insight.months.map((month) => [month.month, month.result]),
    [
      ["2026-02", "-50.00"],
      ["2026-03", "0.00"],
      ["2026-04", "50.00"],
      ["2026-05", "-200.00"],
      ["2026-06", "400.00"],
      ["2026-07", "1000.00"],
    ],
  );
  assert.equal(insight.typicalMonthlyResult, "0.00");
  assert.equal(insight.breakEvenGap, "0.00");
  assert.equal(insight.positiveMonthCount, 2);
  assert.equal(insight.negativeMonthCount, 2);
  assert.equal(insight.breakEvenMonthCount, 1);
  assert.equal(insight.completedMonthCount, 5);
  assert.equal(insight.hasLimitedHistory, false);
});

test("uses a Decimal-safe even median and derives the break-even gap from completed results", () => {
  const insight = buildMonthlyResultInsight({
    firstActivityMonth: "2026-03",
    currentMonth: "2026-07",
    period: 6,
    transactions: [
      transaction({
        type: "INCOME",
        amount: "0.10",
        localDate: "2026-03-01",
        categoryId: "salary",
      }),
      transaction({
        type: "EXPENSE",
        amount: "0.30",
        localDate: "2026-03-02",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "0.10",
        localDate: "2026-04-02",
        categoryId: "food",
      }),
      transaction({
        type: "INCOME",
        amount: "0.30",
        localDate: "2026-06-01",
        categoryId: "salary",
      }),
      transaction({
        type: "INCOME",
        amount: "99.00",
        localDate: "2026-07-01",
        categoryId: "salary",
      }),
    ],
  });

  assert.equal(insight.typicalMonthlyResult, "-0.05");
  assert.equal(insight.breakEvenGap, "0.05");
  assert.equal(insight.completedMonthCount, 4);
  assert.equal(insight.positiveMonthCount, 1);
  assert.equal(insight.negativeMonthCount, 2);
  assert.equal(insight.breakEvenMonthCount, 1);
});

test("returns a zero break-even gap for a positive typical result", () => {
  const insight = buildMonthlyResultInsight({
    firstActivityMonth: "2026-05",
    currentMonth: "2026-07",
    period: 3,
    transactions: [
      transaction({
        type: "INCOME",
        amount: "200.00",
        localDate: "2026-05-01",
        categoryId: "salary",
      }),
      transaction({
        type: "EXPENSE",
        amount: "100.00",
        localDate: "2026-05-02",
        categoryId: "food",
      }),
      transaction({
        type: "INCOME",
        amount: "300.00",
        localDate: "2026-06-01",
        categoryId: "salary",
      }),
      transaction({
        type: "EXPENSE",
        amount: "100.00",
        localDate: "2026-06-02",
        categoryId: "food",
      }),
    ],
  });

  assert.equal(insight.typicalMonthlyResult, "150.00");
  assert.equal(insight.breakEvenGap, "0.00");
  assert.equal(insight.hasLimitedHistory, true);
});

test("keeps baselines unavailable without completed activity", () => {
  const noActivity = buildMonthlyResultInsight({
    firstActivityMonth: null,
    currentMonth: "2026-07",
    period: 12,
    transactions: [],
  });
  const currentActivity = buildMonthlyResultInsight({
    firstActivityMonth: "2026-07",
    currentMonth: "2026-07",
    period: 12,
    transactions: [
      transaction({
        type: "INCOME",
        amount: "500.00",
        localDate: "2026-07-01",
        categoryId: "salary",
      }),
    ],
  });

  assert.deepEqual(noActivity.months, []);
  assert.equal(noActivity.typicalMonthlyResult, null);
  assert.equal(noActivity.breakEvenGap, null);
  assert.equal(noActivity.completedMonthCount, 0);
  assert.deepEqual(currentActivity.months, [
    {
      month: "2026-07",
      totalIncome: "500.00",
      totalExpenses: "0.00",
      result: "500.00",
      isCurrentMonth: true,
    },
  ]);
  assert.equal(currentActivity.typicalMonthlyResult, null);
  assert.equal(currentActivity.breakEvenGap, null);
  assert.equal(currentActivity.positiveMonthCount, 0);
});

test("builds Decimal-safe composition from completed expense months", () => {
  const insight = buildSpendingCompositionInsight({
    currentMonth: "2026-07",
    period: 3,
    categories: [
      { id: "food", name: "Food", isArchived: false },
      { id: "travel", name: "Travel", isArchived: true },
      { id: "unused", name: "Unused", isArchived: false },
    ],
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "0.10",
        localDate: "2026-04-01",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "0.20",
        localDate: "2026-05-01",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "0.70",
        localDate: "2026-06-01",
        categoryId: "travel",
      }),
      transaction({
        type: "INCOME",
        amount: "100.00",
        localDate: "2026-05-01",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "50.00",
        localDate: "2026-03-31",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "75.00",
        localDate: "2026-07-01",
        categoryId: "travel",
      }),
    ],
  });

  assert.equal(insight.totalExpenses, "1.00");
  assert.deepEqual(insight.categories, [
    {
      categoryId: "travel",
      categoryName: "Travel",
      isArchived: true,
      total: "0.70",
      sharePercent: 70,
    },
    {
      categoryId: "food",
      categoryName: "Food",
      isArchived: false,
      total: "0.30",
      sharePercent: 30,
    },
  ]);
});

test("sorts equal composition totals alphabetically and rounds shares", () => {
  const insight = buildSpendingCompositionInsight({
    currentMonth: "2026-07",
    period: 6,
    categories: [
      { id: "travel", name: "Travel", isArchived: false },
      { id: "food", name: "Food", isArchived: false },
      { id: "housing", name: "Housing", isArchived: false },
    ],
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "1.00",
        localDate: "2026-06-01",
        categoryId: "travel",
      }),
      transaction({
        type: "EXPENSE",
        amount: "1.00",
        localDate: "2026-06-02",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "1.00",
        localDate: "2026-06-03",
        categoryId: "housing",
      }),
    ],
  });

  assert.deepEqual(
    insight.categories.map((category) => [
      category.categoryName,
      category.sharePercent,
    ]),
    [
      ["Food", 33.3],
      ["Housing", 33.3],
      ["Travel", 33.3],
    ],
  );
});

test("uses the selected completed-month boundary for every supported period", () => {
  for (const period of [3, 6, 12] as const) {
    const startMonth =
      period === 3 ? "2026-04" : period === 6 ? "2026-01" : "2025-07";
    const beforeStartMonth =
      period === 3 ? "2026-03" : period === 6 ? "2025-12" : "2025-06";
    const insight = buildSpendingCompositionInsight({
      currentMonth: "2026-07",
      period,
      categories: [{ id: "food", name: "Food", isArchived: false }],
      transactions: [
        transaction({
          type: "EXPENSE",
          amount: "10.00",
          localDate: `${startMonth}-01`,
          categoryId: "food",
        }),
        transaction({
          type: "EXPENSE",
          amount: "20.00",
          localDate: `${beforeStartMonth}-28`,
          categoryId: "food",
        }),
      ],
    });

    assert.equal(insight.totalExpenses, "10.00");
    assert.equal(insight.categories[0]?.sharePercent, 100);
  }
});

test("returns an empty composition without completed expense activity", () => {
  const noExpenses = buildSpendingCompositionInsight({
    currentMonth: "2026-07",
    period: 12,
    categories: [{ id: "food", name: "Food", isArchived: false }],
    transactions: [
      transaction({
        type: "INCOME",
        amount: "100.00",
        localDate: "2026-06-01",
        categoryId: "food",
      }),
    ],
  });
  const currentMonthOnly = buildSpendingCompositionInsight({
    currentMonth: "2026-07",
    period: 12,
    categories: [{ id: "food", name: "Food", isArchived: false }],
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "100.00",
        localDate: "2026-07-01",
        categoryId: "food",
      }),
    ],
  });

  assert.deepEqual(noExpenses, {
    totalExpenses: "0.00",
    categories: [],
  });
  assert.deepEqual(currentMonthOnly, {
    totalExpenses: "0.00",
    categories: [],
  });
});
