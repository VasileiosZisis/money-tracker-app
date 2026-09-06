import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@/generated/prisma/client";

import type { SpendingInsightTransaction } from "@/lib/insights/spending-history";
import {
  buildLongTermPatternsInsight,
  formatLongTermChangePercent,
  type LongTermPatternCategorySource,
} from "@/lib/insights/long-term-patterns";

function transaction(
  input: Omit<SpendingInsightTransaction, "amount"> & { amount: string },
): SpendingInsightTransaction {
  return {
    ...input,
    amount: new Prisma.Decimal(input.amount),
  };
}

test("requires 24 completed tracked months", () => {
  const eligible = buildLongTermPatternsInsight({
    currentMonth: "2027-01",
    firstActivityMonth: "2025-01",
    categories: [],
    transactions: [],
  });
  const twentyThreeMonths = buildLongTermPatternsInsight({
    currentMonth: "2027-01",
    firstActivityMonth: "2025-02",
    categories: [],
    transactions: [],
  });
  const noHistory = buildLongTermPatternsInsight({
    currentMonth: "2027-01",
    firstActivityMonth: null,
    categories: [],
    transactions: [],
  });
  const currentMonthOnly = buildLongTermPatternsInsight({
    currentMonth: "2027-01",
    firstActivityMonth: "2027-01",
    categories: [],
    transactions: [],
  });

  assert.equal(eligible.completedMonthCount, 24);
  assert.equal(eligible.hasSufficientHistory, true);
  assert.equal(twentyThreeMonths.completedMonthCount, 23);
  assert.equal(twentyThreeMonths.hasSufficientHistory, false);
  assert.equal(twentyThreeMonths.income, null);
  assert.equal(noHistory.completedMonthCount, 0);
  assert.equal(currentMonthOnly.completedMonthCount, 0);
});

test("uses exact trailing-year boundaries and excludes the current month", () => {
  const insight = buildLongTermPatternsInsight({
    currentMonth: "2027-01",
    firstActivityMonth: "2025-01",
    categories: [],
    transactions: [
      transaction({
        type: "INCOME",
        amount: "999.99",
        localDate: "2024-12-31",
        categoryId: "income",
      }),
      transaction({
        type: "INCOME",
        amount: "100.10",
        localDate: "2025-01-01",
        categoryId: "income",
      }),
      transaction({
        type: "EXPENSE",
        amount: "120.20",
        localDate: "2025-12-31",
        categoryId: "expense",
      }),
      transaction({
        type: "INCOME",
        amount: "150.15",
        localDate: "2026-01-01",
        categoryId: "income",
      }),
      transaction({
        type: "EXPENSE",
        amount: "100.10",
        localDate: "2026-12-31",
        categoryId: "expense",
      }),
      transaction({
        type: "INCOME",
        amount: "9999.99",
        localDate: "2027-01-01",
        categoryId: "income",
      }),
    ],
  });

  assert.equal(insight.previousStartMonth, "2025-01");
  assert.equal(insight.previousEndMonth, "2025-12");
  assert.equal(insight.recentStartMonth, "2026-01");
  assert.equal(insight.recentEndMonth, "2026-12");
  assert.deepEqual(insight.income, {
    previousTotal: "100.10",
    recentTotal: "150.15",
    change: "50.05",
    changePercent: "50",
  });
  assert.equal(insight.expenses?.previousTotal, "120.20");
  assert.equal(insight.expenses?.recentTotal, "100.10");
  assert.equal(insight.expenses?.change, "-20.10");
  assert.equal(
    new Prisma.Decimal(insight.expenses?.changePercent ?? 0).eq(
      new Prisma.Decimal("-20.10").dividedBy("120.20").times(100),
    ),
    true,
  );
  assert.deepEqual(insight.result, {
    previousTotal: "-20.10",
    recentTotal: "50.05",
    change: "70.15",
    changePercent: null,
  });
});

test("keeps percentage changes unavailable when the previous total is zero", () => {
  const insight = buildLongTermPatternsInsight({
    currentMonth: "2027-01",
    firstActivityMonth: "2025-01",
    categories: [],
    transactions: [
      transaction({
        type: "INCOME",
        amount: "100.00",
        localDate: "2026-01-01",
        categoryId: "income",
      }),
      transaction({
        type: "EXPENSE",
        amount: "50.00",
        localDate: "2026-01-02",
        categoryId: "expense",
      }),
    ],
  });

  assert.equal(insight.income?.previousTotal, "0.00");
  assert.equal(insight.income?.changePercent, null);
  assert.equal(insight.expenses?.previousTotal, "0.00");
  assert.equal(insight.expenses?.changePercent, null);
});

test("includes, labels, and sorts every changed category", () => {
  const categories: LongTermPatternCategorySource[] = [
    {
      id: "archived",
      name: "Archived",
      isArchived: true,
      createdMonth: "2024-01",
    },
    {
      id: "groceries",
      name: "Groceries",
      isArchived: false,
      createdMonth: "2024-01",
    },
    {
      id: "new",
      name: "New category",
      isArchived: false,
      createdMonth: "2026-01",
    },
    {
      id: "alpha",
      name: "Alpha",
      isArchived: false,
      createdMonth: "2024-01",
    },
    {
      id: "beta",
      name: "Beta",
      isArchived: false,
      createdMonth: "2024-01",
    },
    {
      id: "partial",
      name: "Partial",
      isArchived: false,
      createdMonth: "2025-07",
    },
    {
      id: "boundary",
      name: "Boundary",
      isArchived: false,
      createdMonth: "2025-01",
    },
    {
      id: "unchanged",
      name: "Unchanged",
      isArchived: false,
      createdMonth: "2024-01",
    },
  ];
  const expense = (
    categoryId: string,
    amount: string,
    localDate: string,
  ) =>
    transaction({
      type: "EXPENSE",
      amount,
      localDate,
      categoryId,
    });
  const insight = buildLongTermPatternsInsight({
    currentMonth: "2027-01",
    firstActivityMonth: "2025-01",
    categories,
    transactions: [
      expense("archived", "200", "2025-01-01"),
      expense("groceries", "100", "2025-01-02"),
      expense("groceries", "200", "2026-01-02"),
      expense("new", "999", "2025-12-01"),
      expense("new", "75", "2026-01-03"),
      expense("alpha", "50", "2026-01-04"),
      expense("beta", "100", "2025-01-05"),
      expense("beta", "150", "2026-01-05"),
      expense("partial", "999", "2025-06-01"),
      expense("partial", "10", "2025-08-01"),
      expense("partial", "30", "2026-08-01"),
      expense("boundary", "40", "2025-01-07"),
      expense("boundary", "60", "2026-01-07"),
      expense("unchanged", "20", "2025-01-06"),
      expense("unchanged", "20", "2026-01-06"),
    ],
  });

  assert.deepEqual(
    insight.categories.map((category) => category.categoryName),
    [
      "Archived",
      "Groceries",
      "New category",
      "Alpha",
      "Beta",
      "Boundary",
      "Partial",
    ],
  );
  assert.deepEqual(insight.categories[0], {
    categoryId: "archived",
    categoryName: "Archived",
    isArchived: true,
    hasPartialHistory: false,
    previousTotal: "200.00",
    recentTotal: "0.00",
    change: "-200.00",
    changePercent: "-100",
  });
  assert.equal(insight.categories[2]?.previousTotal, "0.00");
  assert.equal(insight.categories[2]?.recentTotal, "75.00");
  assert.equal(insight.categories[2]?.hasPartialHistory, true);
  assert.equal(insight.categories[2]?.changePercent, null);
  assert.equal(insight.categories[3]?.changePercent, null);
  assert.equal(insight.categories[4]?.changePercent, "50");
  assert.equal(insight.categories[5]?.hasPartialHistory, false);
  assert.equal(insight.categories[5]?.changePercent, "50");
  assert.equal(insight.categories[6]?.previousTotal, "10.00");
  assert.equal(insight.categories[6]?.hasPartialHistory, true);
  assert.equal(insight.categories[6]?.changePercent, null);
  assert.equal(
    insight.categories.some((category) => category.categoryName === "Unchanged"),
    false,
  );
});

test("returns zero spending and no category changes without inventing activity", () => {
  const insight = buildLongTermPatternsInsight({
    currentMonth: "2027-01",
    firstActivityMonth: "2025-01",
    categories: [],
    transactions: [
      transaction({
        type: "INCOME",
        amount: "100.00",
        localDate: "2025-01-01",
        categoryId: "income",
      }),
    ],
  });

  assert.equal(insight.expenses?.previousTotal, "0.00");
  assert.equal(insight.expenses?.recentTotal, "0.00");
  assert.equal(insight.expenses?.change, "0.00");
  assert.deepEqual(insight.categories, []);
});

test("formats signed and unavailable percentage changes without losing magnitude", () => {
  assert.equal(formatLongTermChangePercent("12.34"), "+12.3%");
  assert.equal(formatLongTermChangePercent("-12.34"), "−12.3%");
  assert.equal(formatLongTermChangePercent("0.04"), "+<0.1%");
  assert.equal(formatLongTermChangePercent("-0.04"), "−<0.1%");
  assert.equal(formatLongTermChangePercent("0"), "0.0%");
  assert.equal(formatLongTermChangePercent(null), "—");
});
