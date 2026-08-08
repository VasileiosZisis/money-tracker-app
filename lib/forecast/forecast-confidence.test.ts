import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@/generated/prisma/client";
import { TransactionType } from "@/generated/prisma/enums";

import {
  buildForecastMonthContext,
  calculateForecastConfidence,
  calculateVariableCategoryForecast,
  computeForecastSummary,
} from "@/lib/forecast";

test("uses six trailing full months by default", () => {
  const context = buildForecastMonthContext({
    selectedMonth: "2026-08",
    referenceDate: "2026-08-10",
  });

  assert.deepEqual(context.trailingFullMonths, [
    "2026-02",
    "2026-03",
    "2026-04",
    "2026-05",
    "2026-06",
    "2026-07",
  ]);
});

test("maps usable history months to low, medium, and high confidence", () => {
  for (const monthsUsed of [0, 1, 2]) {
    assert.equal(calculateForecastConfidence(monthsUsed), "low");
  }

  for (const monthsUsed of [3, 4, 5]) {
    assert.equal(calculateForecastConfidence(monthsUsed), "medium");
  }

  for (const monthsUsed of [6, 7]) {
    assert.equal(calculateForecastConfidence(monthsUsed), "high");
  }
});

test("averages all six usable months and excludes planned-bill categories", () => {
  const context = buildForecastMonthContext({
    selectedMonth: "2026-08",
    referenceDate: "2026-08-10",
  });
  const historicalVariableExpenses = [
    ["2026-02-01", "280.00"],
    ["2026-03-01", "310.00"],
    ["2026-04-01", "300.00"],
    ["2026-05-01", "310.00"],
    ["2026-06-01", "300.00"],
    ["2026-07-01", "310.00"],
  ].map(([localDate, amount]) => ({
    type: TransactionType.EXPENSE,
    amount: new Prisma.Decimal(amount),
    localDate,
    categoryId: "variable",
  }));
  const excludedFixedExpenses = context.trailingFullMonths.map((month) => ({
    type: TransactionType.EXPENSE,
    amount: new Prisma.Decimal("10000.00"),
    localDate: `${month}-02`,
    categoryId: "fixed",
  }));
  const plannedBills = [
    {
      amount: new Prisma.Decimal("100.00"),
      dueDayOfMonth: 15,
      categoryId: "fixed",
      isActive: true,
      occurrenceStatus: null,
    },
  ];
  const result = calculateVariableCategoryForecast(
    [...historicalVariableExpenses, ...excludedFixedExpenses],
    plannedBills,
    context,
  );
  const summary = computeForecastSummary({
    selectedMonth: "2026-08",
    referenceDate: "2026-08-10",
    transactions: [...historicalVariableExpenses, ...excludedFixedExpenses],
    plannedBills,
  });

  assert.equal(result.source, "trailing-history");
  assert.deepEqual(result.monthsUsed, context.trailingFullMonths);
  assert.equal(result.averageDailyExpense.toString(), "10");
  assert.equal(result.amount.toString(), "210");
  assert.deepEqual(result.excludedCategoryIds, ["fixed"]);
  assert.equal(calculateForecastConfidence(result.monthsUsed.length), "high");
  assert.equal(summary.forecastConfidence, "high");
  assert.deepEqual(summary.variableForecastMonthsUsed, context.trailingFullMonths);
});

test("current-month run rate and no-data fallbacks have low confidence", () => {
  const context = buildForecastMonthContext({
    selectedMonth: "2026-08",
    referenceDate: "2026-08-10",
  });
  const runRateResult = calculateVariableCategoryForecast(
    [
      {
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal("100.00"),
        localDate: "2026-08-05",
        categoryId: "variable",
      },
    ],
    [],
    context,
  );
  const noDataResult = calculateVariableCategoryForecast([], [], context);

  assert.equal(runRateResult.source, "current-month-run-rate");
  assert.equal(calculateForecastConfidence(runRateResult.monthsUsed.length), "low");
  assert.equal(noDataResult.source, "none");
  assert.equal(calculateForecastConfidence(noDataResult.monthsUsed.length), "low");
});
