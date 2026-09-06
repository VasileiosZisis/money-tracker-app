import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@/generated/prisma/client";

import type { SpendingInsightTransaction } from "@/lib/insights/spending-history";
import {
  buildUnusualMonthTransactionsHref,
  buildUnusualMonthsInsight,
  type UnusualMonthMetric,
  type UnusualMonthCategorySource,
} from "@/lib/insights/unusual-months";

function transaction(
  input: Omit<SpendingInsightTransaction, "amount"> & { amount: string },
): SpendingInsightTransaction {
  return {
    ...input,
    amount: new Prisma.Decimal(input.amount),
  };
}

function monthKey(index: number) {
  return `2026-${String(index + 1).padStart(2, "0")}`;
}

test("requires six eligible completed months", () => {
  const fiveMonths = buildUnusualMonthsInsight({
    currentMonth: "2026-06",
    firstActivityMonth: "2026-01",
    period: 6,
    categories: [],
    transactions: [],
  });
  const selectedThreeMonths = buildUnusualMonthsInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2025-01",
    period: 3,
    categories: [],
    transactions: [],
  });
  const noHistory = buildUnusualMonthsInsight({
    currentMonth: "2026-06",
    firstActivityMonth: null,
    period: 12,
    categories: [],
    transactions: [],
  });

  assert.equal(fiveMonths.completedMonthCount, 5);
  assert.equal(fiveMonths.hasSufficientHistory, false);
  assert.equal(selectedThreeMonths.completedMonthCount, 3);
  assert.equal(selectedThreeMonths.hasSufficientHistory, false);
  assert.equal(noHistory.completedMonthCount, 0);
  assert.deepEqual(noHistory.months, []);
});

test("detects high and low spending plus low income and monthly result", () => {
  const transactions = Array.from({ length: 12 }, (_, index) => {
    const month = monthKey(index);
    const income = index === 2 ? "0.00" : "1000.00";
    const expenses = index === 0 ? "200.00" : index === 1 ? "0.00" : "100.00";

    return [
      transaction({
        type: "INCOME",
        amount: income,
        localDate: `${month}-01`,
        categoryId: "salary",
      }),
      transaction({
        type: "EXPENSE",
        amount: expenses,
        localDate: `${month}-02`,
        categoryId: "general",
      }),
    ];
  }).flat();
  transactions.push(
    transaction({
      type: "EXPENSE",
      amount: "9999.00",
      localDate: "2027-01-01",
      categoryId: "general",
    }),
  );

  const insight = buildUnusualMonthsInsight({
    currentMonth: "2027-01",
    firstActivityMonth: "2026-01",
    period: 12,
    categories: [],
    transactions,
  });
  const observations = insight.months.flatMap((month) => month.observations);

  assert.equal(insight.hasSufficientHistory, true);
  assert.deepEqual(
    insight.months.map((month) => month.month),
    ["2026-03", "2026-02", "2026-01"],
  );
  assert.deepEqual(
    observations.map((item) => [item.month, item.metric, item.direction]),
    [
      ["2026-03", "INCOME", "LOW"],
      ["2026-03", "MONTHLY_RESULT", "LOW"],
      ["2026-02", "TOTAL_EXPENSES", "LOW"],
      ["2026-01", "TOTAL_EXPENSES", "HIGH"],
    ],
  );
  assert.equal(observations[0]?.actual, "0.00");
  assert.equal(observations[0]?.typical, "1000.00");
  assert.equal(
    observations.some((item) => item.month === "2027-01"),
    false,
  );
});

test("detects category-specific high and low months without mislabeling totals", () => {
  const category: UnusualMonthCategorySource = {
    id: "food",
    name: "Food",
    isArchived: true,
    createdMonth: "2026-01",
  };
  const transactions = Array.from({ length: 12 }, (_, index) => {
    const month = monthKey(index);
    const food = index === 0 ? "200.00" : index === 1 ? "0.00" : "100.00";
    const other = index === 0 ? "800.00" : index === 1 ? "1000.00" : "900.00";

    return [
      transaction({
        type: "INCOME",
        amount: "1000.00",
        localDate: `${month}-01`,
        categoryId: "salary",
      }),
      transaction({
        type: "EXPENSE",
        amount: food,
        localDate: `${month}-02`,
        categoryId: "food",
      }),
      transaction({
        type: "EXPENSE",
        amount: other,
        localDate: `${month}-03`,
        categoryId: "other",
      }),
    ];
  }).flat();
  const insight = buildUnusualMonthsInsight({
    currentMonth: "2027-01",
    firstActivityMonth: "2026-01",
    period: 12,
    categories: [category],
    transactions,
  });
  const observations = insight.months.flatMap((month) => month.observations);

  assert.deepEqual(
    observations.map((item) => [item.month, item.metric, item.direction]),
    [
      ["2026-02", "CATEGORY_EXPENSES", "LOW"],
      ["2026-01", "CATEGORY_EXPENSES", "HIGH"],
    ],
  );
  assert.equal(observations[0]?.categoryName, "Food");
  assert.equal(observations[0]?.isArchivedCategory, true);
});

test("does not extend category history before its creation month", () => {
  const category: UnusualMonthCategorySource = {
    id: "food",
    name: "Food",
    isArchived: false,
    createdMonth: "2026-08",
  };
  const transactions = [
    ...["01", "02", "03", "04", "05", "06"].map((month) =>
      transaction({
        type: "EXPENSE",
        amount: "100.00",
        localDate: `2026-${month}-01`,
        categoryId: "food",
      }),
    ),
    ...["08", "09", "10", "11"].map((month) =>
      transaction({
        type: "EXPENSE",
        amount: "100.00",
        localDate: `2026-${month}-01`,
        categoryId: "food",
      }),
    ),
    transaction({
      type: "EXPENSE",
      amount: "200.00",
      localDate: "2026-12-01",
      categoryId: "food",
    }),
  ];
  const insight = buildUnusualMonthsInsight({
    currentMonth: "2027-01",
    firstActivityMonth: "2026-01",
    period: 12,
    categories: [category],
    transactions,
  });
  const categoryObservations = insight.months
    .flatMap((month) => month.observations)
    .filter((item) => item.metric === "CATEGORY_EXPENSES");

  assert.deepEqual(categoryObservations, []);
});

test("requires category history and activity before making category claims", () => {
  const categories: UnusualMonthCategorySource[] = [
    {
      id: "new",
      name: "New category",
      isArchived: false,
      createdMonth: "2026-08",
    },
    {
      id: "sparse",
      name: "Sparse category",
      isArchived: false,
      createdMonth: "2026-01",
    },
  ];
  const transactions = [
    transaction({
      type: "EXPENSE",
      amount: "100.00",
      localDate: "2026-01-01",
      categoryId: "sparse",
    }),
    transaction({
      type: "EXPENSE",
      amount: "300.00",
      localDate: "2026-12-01",
      categoryId: "sparse",
    }),
    transaction({
      type: "EXPENSE",
      amount: "100.00",
      localDate: "2026-08-01",
      categoryId: "new",
    }),
    transaction({
      type: "EXPENSE",
      amount: "200.00",
      localDate: "2026-12-02",
      categoryId: "new",
    }),
  ];
  const insight = buildUnusualMonthsInsight({
    currentMonth: "2027-01",
    firstActivityMonth: "2026-01",
    period: 12,
    categories,
    transactions,
  });

  assert.equal(
    insight.months
      .flatMap((month) => month.observations)
      .some((item) => item.metric === "CATEGORY_EXPENSES"),
    false,
  );
});

test("uses strict linearly interpolated Tukey fences", () => {
  const buildInsight = (lastAmount: string) =>
    buildUnusualMonthsInsight({
      currentMonth: "2026-09",
      firstActivityMonth: "2026-01",
      period: 12,
      categories: [],
      transactions: ["0", "10", "20", "30", "40", "50", "60", lastAmount].map(
        (amount, index) =>
          transaction({
            type: "EXPENSE",
            amount,
            localDate: `${monthKey(index)}-01`,
            categoryId: "general",
          }),
      ),
    });
  const insideFence = buildInsight("104");
  const outsideFence = buildInsight("130");

  assert.equal(
    insideFence.months
      .flatMap((month) => month.observations)
      .some((item) => item.metric === "TOTAL_EXPENSES"),
    false,
  );
  assert.equal(
    outsideFence.months
      .flatMap((month) => month.observations)
      .some(
        (item) =>
          item.metric === "TOTAL_EXPENSES" && item.direction === "HIGH",
      ),
    true,
  );
});

test("does not flag values on Tukey fences and flags values just beyond them", () => {
  const buildExpenseInsight = (lastAmount: string) =>
    buildUnusualMonthsInsight({
      currentMonth: "2026-09",
      firstActivityMonth: "2026-01",
      period: 12,
      categories: [],
      transactions: [
        "50",
        "100",
        "100",
        "140",
        "160",
        "200",
        "200",
        lastAmount,
      ].map((amount, index) =>
        transaction({
          type: "EXPENSE",
          amount,
          localDate: `${monthKey(index)}-01`,
          categoryId: "general",
        }),
      ),
    });
  const buildResultInsight = (firstResult: string) => {
    const results = [
      firstResult,
      "100",
      "100",
      "140",
      "160",
      "200",
      "200",
      "300",
    ];

    return buildUnusualMonthsInsight({
      currentMonth: "2026-09",
      firstActivityMonth: "2026-01",
      period: 12,
      categories: [],
      transactions: results.flatMap((result, index) => [
        transaction({
          type: "INCOME",
          amount: "500",
          localDate: `${monthKey(index)}-01`,
          categoryId: "salary",
        }),
        transaction({
          type: "EXPENSE",
          amount: new Prisma.Decimal(500).minus(result).toString(),
          localDate: `${monthKey(index)}-02`,
          categoryId: "general",
        }),
      ]),
    });
  };
  const onUpperFence = buildExpenseInsight("350");
  const aboveUpperFence = buildExpenseInsight("350.01");
  const onLowerFence = buildResultInsight("-50");
  const belowLowerFence = buildResultInsight("-50.01");

  assert.equal(
    onUpperFence.months
      .flatMap((month) => month.observations)
      .some((item) => item.metric === "TOTAL_EXPENSES"),
    false,
  );
  assert.equal(
    aboveUpperFence.months
      .flatMap((month) => month.observations)
      .some((item) => item.metric === "TOTAL_EXPENSES"),
    true,
  );
  assert.equal(
    onLowerFence.months
      .flatMap((month) => month.observations)
      .some((item) => item.metric === "MONTHLY_RESULT"),
    false,
  );
  assert.equal(
    belowLowerFence.months
      .flatMap((month) => month.observations)
      .some((item) => item.metric === "MONTHLY_RESULT"),
    true,
  );
});

test("preserves fractional Decimal quartiles and fences", () => {
  const buildInsight = (lastAmount: string) =>
    buildUnusualMonthsInsight({
      currentMonth: "2026-09",
      firstActivityMonth: "2026-01",
      period: 12,
      categories: [],
      transactions: [
        "10.01",
        "20.02",
        "30.03",
        "40.04",
        "50.05",
        "60.06",
        "70.07",
        lastAmount,
      ].map((amount, index) =>
        transaction({
          type: "EXPENSE",
          amount,
          localDate: `${monthKey(index)}-01`,
          categoryId: "general",
        }),
      ),
    });
  const insideFence = buildInsight("115.11");
  const outsideFence = buildInsight("115.12");
  const outsideObservation = outsideFence.months
    .flatMap((month) => month.observations)
    .find((item) => item.metric === "TOTAL_EXPENSES");

  assert.equal(
    insideFence.months
      .flatMap((month) => month.observations)
      .some((item) => item.metric === "TOTAL_EXPENSES"),
    false,
  );
  assert.equal(outsideObservation?.actual, "115.12");
  assert.equal(outsideObservation?.typical, "45.045");
});

test("builds the exact Transactions drill-down filters for each metric", () => {
  const hrefFor = (
    metric: UnusualMonthMetric,
    categoryId: string | null = null,
  ) =>
    buildUnusualMonthTransactionsHref({
      month: "2026-08",
      metric,
      categoryId,
    });

  assert.equal(
    hrefFor("TOTAL_EXPENSES"),
    "/transactions?month=2026-08&type=EXPENSE",
  );
  assert.equal(
    hrefFor("INCOME"),
    "/transactions?month=2026-08&type=INCOME",
  );
  assert.equal(hrefFor("MONTHLY_RESULT"), "/transactions?month=2026-08");
  assert.equal(
    hrefFor("CATEGORY_EXPENSES", "food"),
    "/transactions?month=2026-08&type=EXPENSE&categoryId=food",
  );
});

test("uses a 25 percent materiality guard for flat histories", () => {
  const belowMateriality = buildUnusualMonthsInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-01",
    period: 6,
    categories: [],
    transactions: ["100", "100", "100", "100", "100", "120"].map(
      (amount, index) =>
        transaction({
          type: "EXPENSE",
          amount,
          localDate: `${monthKey(index)}-01`,
          categoryId: "general",
        }),
    ),
  });
  const atMateriality = buildUnusualMonthsInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-01",
    period: 6,
    categories: [],
    transactions: ["100", "100", "100", "100", "100", "125"].map(
      (amount, index) =>
        transaction({
          type: "EXPENSE",
          amount,
          localDate: `${monthKey(index)}-01`,
          categoryId: "general",
        }),
    ),
  });

  assert.equal(
    belowMateriality.months
      .flatMap((month) => month.observations)
      .some((item) => item.metric === "TOTAL_EXPENSES"),
    false,
  );
  assert.equal(
    atMateriality.months
      .flatMap((month) => month.observations)
      .some(
        (item) =>
          item.metric === "TOTAL_EXPENSES" && item.direction === "HIGH",
      ),
    true,
  );
});

test("truncates at first activity, includes later zero months, and excludes current activity", () => {
  const insight = buildUnusualMonthsInsight({
    currentMonth: "2026-10",
    firstActivityMonth: "2026-04",
    period: 12,
    categories: [],
    transactions: [
      transaction({
        type: "EXPENSE",
        amount: "999.99",
        localDate: "2026-03-01",
        categoryId: "general",
      }),
      transaction({
        type: "EXPENSE",
        amount: "100.01",
        localDate: "2026-04-01",
        categoryId: "general",
      }),
      transaction({
        type: "EXPENSE",
        amount: "9999.99",
        localDate: "2026-10-01",
        categoryId: "general",
      }),
    ],
  });
  const observations = insight.months.flatMap((month) => month.observations);

  assert.equal(insight.completedMonthCount, 6);
  assert.equal(insight.hasSufficientHistory, true);
  assert.deepEqual(
    observations.map((item) => [item.month, item.metric, item.direction]),
    [
      ["2026-04", "TOTAL_EXPENSES", "HIGH"],
      ["2026-04", "MONTHLY_RESULT", "LOW"],
    ],
  );
  assert.equal(observations[0]?.actual, "100.01");
  assert.equal(observations[0]?.typical, "0.00");
});

test("returns a neutral empty result when completed values stay within range", () => {
  const insight = buildUnusualMonthsInsight({
    currentMonth: "2026-07",
    firstActivityMonth: "2026-01",
    period: 6,
    categories: [],
    transactions: Array.from({ length: 6 }, (_, index) => [
      transaction({
        type: "INCOME",
        amount: "200.00",
        localDate: `${monthKey(index)}-01`,
        categoryId: "salary",
      }),
      transaction({
        type: "EXPENSE",
        amount: "100.00",
        localDate: `${monthKey(index)}-02`,
        categoryId: "general",
      }),
    ]).flat(),
  });

  assert.equal(insight.hasSufficientHistory, true);
  assert.deepEqual(insight.months, []);
});
