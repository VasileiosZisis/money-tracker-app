import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@/generated/prisma/client";

import {
  buildMonthlyResultInsight,
  buildSpendingChangeInsight,
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

test("normalizes spending change windows and defaults to three months", () => {
  const defaultInsight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2025-07",
    categories: [],
    transactions: [],
  });
  const sixMonthInsight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2025-07",
    requestedWindow: "6",
    requestedTargetMonth: "2026-02",
    categories: [],
    transactions: [],
  });
  const oneMonthInsight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2025-07",
    requestedWindow: "1",
    categories: [],
    transactions: [],
  });
  const invalidInsight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2025-07",
    requestedWindow: "4",
    categories: [],
    transactions: [],
  });
  const fallbackInsight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-05",
    categories: [],
    transactions: [],
  });
  const elevenTrackedMonths = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2025-08",
    requestedWindow: 6,
    categories: [],
    transactions: [],
  });

  assert.deepEqual(defaultInsight.availableWindows, [1, 3, 6]);
  assert.equal(defaultInsight.window, 3);
  assert.equal(defaultInsight.selectedTargetMonth, null);
  assert.equal(sixMonthInsight.window, 6);
  assert.equal(sixMonthInsight.selectedTargetMonth, null);
  assert.equal(sixMonthInsight.previousStartMonth, "2025-07");
  assert.equal(sixMonthInsight.previousEndMonth, "2025-12");
  assert.equal(sixMonthInsight.recentStartMonth, "2026-01");
  assert.equal(sixMonthInsight.recentEndMonth, "2026-06");
  assert.equal(oneMonthInsight.window, 1);
  assert.equal(oneMonthInsight.selectedTargetMonth, "2026-06");
  assert.equal(oneMonthInsight.previousStartMonth, "2026-05");
  assert.equal(oneMonthInsight.previousEndMonth, "2026-05");
  assert.equal(oneMonthInsight.recentStartMonth, "2026-06");
  assert.equal(oneMonthInsight.recentEndMonth, "2026-06");
  assert.equal(invalidInsight.window, 3);
  assert.deepEqual(fallbackInsight.availableWindows, [1]);
  assert.equal(fallbackInsight.window, 1);
  assert.deepEqual(fallbackInsight.availableTargetMonths, ["2026-06"]);
  assert.deepEqual(elevenTrackedMonths.availableWindows, [1, 3]);
  assert.equal(elevenTrackedMonths.window, 3);
});

test("offers the latest eleven consecutive month targets newest first", () => {
  const insight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2020-01",
    requestedWindow: 1,
    categories: [],
    transactions: [],
  });

  assert.deepEqual(insight.availableTargetMonths, [
    "2026-06",
    "2026-05",
    "2026-04",
    "2026-03",
    "2026-02",
    "2026-01",
    "2025-12",
    "2025-11",
    "2025-10",
    "2025-09",
    "2025-08",
  ]);
  assert.equal(insight.selectedTargetMonth, "2026-06");
});

test("selects a historical consecutive pair and normalizes invalid targets", () => {
  const selectedInsight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-01",
    requestedWindow: 1,
    requestedTargetMonth: "2026-04",
    categories: [{ id: "food", name: "Food", isArchived: false }],
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "100.00",
        localDate: "2026-03-01",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "160.00",
        localDate: "2026-04-01",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "999.00",
        localDate: "2026-06-01",
        categoryId: "food",
      }),
    ],
  });
  const futureTarget = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-01",
    requestedWindow: 1,
    requestedTargetMonth: "2026-07",
    categories: [],
    transactions: [],
  });
  const beforeTrackingTarget = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-03",
    requestedWindow: 1,
    requestedTargetMonth: "2026-03",
    categories: [],
    transactions: [],
  });
  const outsideBoundedHistory = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2020-01",
    requestedWindow: 1,
    requestedTargetMonth: "2025-07",
    categories: [],
    transactions: [],
  });

  assert.equal(selectedInsight.selectedTargetMonth, "2026-04");
  assert.equal(selectedInsight.previousStartMonth, "2026-03");
  assert.equal(selectedInsight.previousEndMonth, "2026-03");
  assert.equal(selectedInsight.recentStartMonth, "2026-04");
  assert.equal(selectedInsight.recentEndMonth, "2026-04");
  assert.equal(selectedInsight.previousMonthlyAverage, "100.00");
  assert.equal(selectedInsight.recentMonthlyAverage, "160.00");
  assert.equal(selectedInsight.averageMonthlyChange, "60.00");
  assert.equal(futureTarget.selectedTargetMonth, "2026-06");
  assert.deepEqual(beforeTrackingTarget.availableTargetMonths, [
    "2026-06",
    "2026-05",
    "2026-04",
  ]);
  assert.equal(beforeTrackingTarget.selectedTargetMonth, "2026-06");
  assert.equal(outsideBoundedHistory.selectedTargetMonth, "2026-06");
  assert.equal(outsideBoundedHistory.previousStartMonth, "2026-05");
});

test("uses the twelfth completed month as the oldest pair baseline", () => {
  const insight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2020-01",
    requestedWindow: 1,
    requestedTargetMonth: "2025-08",
    categories: [{ id: "food", name: "Food", isArchived: false }],
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "80.00",
        localDate: "2025-07-01",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "100.00",
        localDate: "2025-08-01",
        categoryId: "food",
      }),
    ],
  });

  assert.equal(insight.selectedTargetMonth, "2025-08");
  assert.equal(insight.previousStartMonth, "2025-07");
  assert.equal(insight.recentStartMonth, "2025-08");
  assert.equal(insight.previousMonthlyAverage, "80.00");
  assert.equal(insight.recentMonthlyAverage, "100.00");
  assert.equal(insight.averageMonthlyChange, "20.00");
});

test("keeps an eligible historical zero-expense month in its selected pair", () => {
  const insight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-01",
    requestedWindow: 1,
    requestedTargetMonth: "2026-05",
    categories: [{ id: "food", name: "Food", isArchived: false }],
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "100.00",
        localDate: "2026-04-01",
        categoryId: "food",
      }),
    ],
  });

  assert.equal(insight.previousStartMonth, "2026-04");
  assert.equal(insight.recentStartMonth, "2026-05");
  assert.equal(insight.previousMonthlyAverage, "100.00");
  assert.equal(insight.recentMonthlyAverage, "0.00");
  assert.equal(insight.averageMonthlyChange, "-100.00");
  assert.equal(insight.hasExpenseActivity, true);
});

test("uses exact consecutive period boundaries and excludes the current month", () => {
  const insight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-01",
    requestedWindow: 3,
    categories: [{ id: "food", name: "Food", isArchived: false }],
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "60.00",
        localDate: "2026-01-01",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "30.00",
        localDate: "2026-04-01",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "999.00",
        localDate: "2026-07-01",
        categoryId: "food",
      }),
    ],
  });

  assert.equal(insight.previousStartMonth, "2026-01");
  assert.equal(insight.previousEndMonth, "2026-03");
  assert.equal(insight.recentStartMonth, "2026-04");
  assert.equal(insight.recentEndMonth, "2026-06");
  assert.equal(insight.previousMonthlyAverage, "20.00");
  assert.equal(insight.recentMonthlyAverage, "10.00");
  assert.equal(insight.averageMonthlyChange, "-10.00");
});

test("calculates Decimal-safe category drivers and contribution offsets", () => {
  const insight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-01",
    requestedWindow: 3,
    categories: [
      { id: "food", name: "Food", isArchived: false },
      { id: "travel", name: "Travel", isArchived: true },
      { id: "unused", name: "Unused", isArchived: false },
    ],
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "0.10",
        localDate: "2026-01-01",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "0.20",
        localDate: "2026-01-02",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "6.00",
        localDate: "2026-03-03",
        categoryId: "travel",
      }),
      transaction({
        type: "EXPENSE",
        amount: "3.90",
        localDate: "2026-06-01",
        categoryId: "food",
      }),
      transaction({
        type: "INCOME",
        amount: "500.00",
        localDate: "2026-06-01",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "99.00",
        localDate: "2026-07-01",
        categoryId: "travel",
      }),
    ],
  });

  assert.equal(insight.previousMonthlyAverage, "2.10");
  assert.equal(insight.recentMonthlyAverage, "1.30");
  assert.equal(insight.averageMonthlyChange, "-0.80");
  assert.equal(insight.hasExpenseActivity, true);
  assert.deepEqual(insight.categories, [
    {
      categoryId: "travel",
      categoryName: "Travel",
      isArchived: true,
      previousMonthlyAverage: "2.00",
      recentMonthlyAverage: "0.00",
      change: "-2.00",
      contributionPercent: 250,
    },
    {
      categoryId: "food",
      categoryName: "Food",
      isArchived: false,
      previousMonthlyAverage: "0.10",
      recentMonthlyAverage: "1.30",
      change: "1.20",
      contributionPercent: -150,
    },
  ]);
});

test("rounds spending change contribution percentages to one decimal", () => {
  const insight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-01",
    requestedWindow: 1,
    categories: [
      { id: "food", name: "Food", isArchived: false },
      { id: "housing", name: "Housing", isArchived: false },
    ],
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "1.00",
        localDate: "2026-06-01",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "2.00",
        localDate: "2026-06-02",
        categoryId: "housing",
      }),
    ],
  });

  assert.deepEqual(
    insight.categories.map((category) => [
      category.categoryName,
      category.contributionPercent,
    ]),
    [
      ["Housing", 66.7],
      ["Food", 33.3],
    ],
  );
});

test("keeps new recent-period categories and sorts equal changes alphabetically", () => {
  const insight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-01",
    requestedWindow: 1,
    categories: [
      { id: "beta", name: "Beta", isArchived: false },
      { id: "alpha", name: "Alpha", isArchived: false },
    ],
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "10.00",
        localDate: "2026-06-01",
        categoryId: "beta",
      }),
      transaction({
        type: "EXPENSE",
        amount: "10.00",
        localDate: "2026-06-02",
        categoryId: "alpha",
      }),
    ],
  });

  assert.deepEqual(insight.categories, [
    {
      categoryId: "alpha",
      categoryName: "Alpha",
      isArchived: false,
      previousMonthlyAverage: "0.00",
      recentMonthlyAverage: "10.00",
      change: "10.00",
      contributionPercent: 50,
    },
    {
      categoryId: "beta",
      categoryName: "Beta",
      isArchived: false,
      previousMonthlyAverage: "0.00",
      recentMonthlyAverage: "10.00",
      change: "10.00",
      contributionPercent: 50,
    },
  ]);
});

test("preserves positive and negative sub-cent average monthly changes", () => {
  const category = [{ id: "food", name: "Food", isArchived: false }];
  const positiveInsight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-01",
    requestedWindow: 3,
    categories: category,
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "300.00",
        localDate: "2026-01-01",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "300.01",
        localDate: "2026-04-01",
        categoryId: "food",
      }),
    ],
  });
  const negativeInsight = buildSpendingChangeInsight({
    currentMonth: "2027-01",
    firstActivityMonth: "2026-01",
    requestedWindow: 6,
    categories: category,
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "600.01",
        localDate: "2026-01-01",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "600.00",
        localDate: "2026-07-01",
        categoryId: "food",
      }),
    ],
  });
  const expectedPositiveChange = new Prisma.Decimal("0.01").dividedBy(3);
  const expectedNegativeChange = new Prisma.Decimal("-0.01").dividedBy(6);

  assert.equal(
    new Prisma.Decimal(positiveInsight.averageMonthlyChange ?? 0).eq(
      expectedPositiveChange,
    ),
    true,
  );
  assert.equal(positiveInsight.categories[0]?.contributionPercent, 100);
  assert.equal(
    new Prisma.Decimal(positiveInsight.categories[0]?.change ?? 0).eq(
      expectedPositiveChange,
    ),
    true,
  );
  assert.equal(
    new Prisma.Decimal(negativeInsight.averageMonthlyChange ?? 0).eq(
      expectedNegativeChange,
    ),
    true,
  );
  assert.equal(negativeInsight.categories[0]?.contributionPercent, 100);
  assert.equal(
    new Prisma.Decimal(negativeInsight.categories[0]?.change ?? 0).eq(
      expectedNegativeChange,
    ),
    true,
  );
});

test("keeps offsetting category changes when the total is unchanged", () => {
  const insight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-01",
    requestedWindow: 1,
    categories: [
      { id: "travel", name: "Travel", isArchived: false },
      { id: "food", name: "Food", isArchived: false },
      { id: "housing", name: "Housing", isArchived: false },
    ],
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "100.00",
        localDate: "2026-05-01",
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: "50.00",
        localDate: "2026-05-02",
        categoryId: "housing",
      }),
      transaction({
        type: "EXPENSE",
        amount: "100.00",
        localDate: "2026-06-01",
        categoryId: "travel",
      }),
      transaction({
        type: "EXPENSE",
        amount: "50.00",
        localDate: "2026-06-02",
        categoryId: "housing",
      }),
    ],
  });

  assert.equal(insight.averageMonthlyChange, "0.00");
  assert.deepEqual(
    insight.categories.map((category) => [
      category.categoryName,
      category.change,
      category.contributionPercent,
    ]),
    [
      ["Food", "-100.00", null],
      ["Travel", "100.00", null],
    ],
  );
});

test("treats tracked zero-expense months as valid comparisons", () => {
  const insight = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-01",
    requestedWindow: 3,
    categories: [{ id: "food", name: "Food", isArchived: false }],
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "300.00",
        localDate: "2026-01-01",
        categoryId: "food",
      }),
    ],
  });

  assert.equal(insight.recentMonthlyAverage, "0.00");
  assert.equal(insight.averageMonthlyChange, "-100.00");
  assert.equal(insight.hasExpenseActivity, true);
  assert.equal(insight.categories[0]?.recentMonthlyAverage, "0.00");
});

test("returns explicit empty and insufficient-history change states", () => {
  const noExpenses = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-01",
    categories: [{ id: "food", name: "Food", isArchived: false }],
    transactions: [],
  });
  const insufficientHistory = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-06",
    categories: [],
    transactions: [],
  });
  const currentMonthOnly = buildSpendingChangeInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-07",
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

  assert.equal(noExpenses.hasExpenseActivity, false);
  assert.equal(noExpenses.previousMonthlyAverage, "0.00");
  assert.equal(noExpenses.recentMonthlyAverage, "0.00");
  assert.deepEqual(noExpenses.categories, []);
  assert.equal(insufficientHistory.window, null);
  assert.equal(insufficientHistory.previousStartMonth, null);
  assert.equal(insufficientHistory.averageMonthlyChange, null);
  assert.deepEqual(insufficientHistory.availableWindows, []);
  assert.equal(currentMonthOnly.window, null);
  assert.equal(currentMonthOnly.hasExpenseActivity, false);
});
