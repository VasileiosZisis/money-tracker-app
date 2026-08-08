import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@/generated/prisma/client";
import { TransactionType } from "@/generated/prisma/enums";

import {
  buildForecastMonthContext,
  calculateSpendingPace,
  calculateWeeklySafeSpend,
  calculateWeeklySafeSpendDays,
  computeForecastSummary,
} from "@/lib/forecast";

const trailingMonths = [
  ["2026-02", 28],
  ["2026-03", 31],
  ["2026-04", 30],
  ["2026-05", 31],
  ["2026-06", 30],
  ["2026-07", 31],
] as const;

function variableExpense(localDate: string, amount: string, categoryId = "variable") {
  return {
    type: TransactionType.EXPENSE,
    amount: new Prisma.Decimal(amount),
    localDate,
    categoryId,
  };
}

function historicalExpensesAtTenPerDay() {
  return trailingMonths.map(([month, days]) =>
    variableExpense(`${month}-01`, String(days * 10)),
  );
}

test("calculates weekly safe-to-spend for full and partial weeks", () => {
  assert.equal(calculateWeeklySafeSpendDays(20), 7);
  for (let remainingDays = 1; remainingDays <= 6; remainingDays += 1) {
    assert.equal(calculateWeeklySafeSpendDays(remainingDays), remainingDays);
    assert.equal(
      calculateWeeklySafeSpend(
        new Prisma.Decimal("100.00"),
        remainingDays,
      ).toString(),
      "100",
    );
  }
  assert.equal(calculateWeeklySafeSpendDays(0), 0);

  assert.equal(
    calculateWeeklySafeSpend(new Prisma.Decimal("100.00"), 10).toString(),
    "70",
  );
  assert.equal(
    calculateWeeklySafeSpend(new Prisma.Decimal("100.00"), 6).toString(),
    "100",
  );
  assert.equal(
    calculateWeeklySafeSpend(new Prisma.Decimal("-100.00"), 10).toString(),
    "-70",
  );
  assert.equal(
    calculateWeeklySafeSpend(new Prisma.Decimal("100.00"), 9).toString(),
    "77.78",
  );
  assert.equal(
    calculateWeeklySafeSpend(new Prisma.Decimal("100.00"), 0).toString(),
    "0",
  );
});

test("exposes weekly safe-to-spend for current, future, and completed months", () => {
  const current = computeForecastSummary({
    selectedMonth: "2026-08",
    referenceDate: "2026-08-25",
    transactions: [
      {
        type: TransactionType.INCOME,
        amount: new Prisma.Decimal("600.00"),
        localDate: "2026-08-01",
        categoryId: "income",
      },
    ],
    plannedBills: [],
  });
  const future = computeForecastSummary({
    selectedMonth: "2026-09",
    referenceDate: "2026-08-25",
    transactions: [],
    plannedBills: [
      {
        amount: new Prisma.Decimal("300.00"),
        dueDayOfMonth: 15,
        categoryId: "fixed",
        isActive: true,
        occurrenceStatus: null,
      },
    ],
  });
  const completed = computeForecastSummary({
    selectedMonth: "2026-07",
    referenceDate: "2026-08-25",
    transactions: [],
    plannedBills: [],
  });

  assert.equal(current.weeklySafeSpendDays, 7);
  assert.equal(current.weeklySafeSpend.toString(), "600");
  assert.equal(future.weeklySafeSpendDays, 7);
  assert.equal(future.weeklySafeSpend.toString(), "-70");
  assert.equal(completed.weeklySafeSpendDays, 0);
  assert.equal(completed.weeklySafeSpend.toString(), "0");
});

test("calculates current spending pace against six usable historical months", () => {
  const context = buildForecastMonthContext({
    selectedMonth: "2026-08",
    referenceDate: "2026-08-10",
  });
  const result = calculateSpendingPace(
    [
      ...historicalExpensesAtTenPerDay(),
      variableExpense("2026-08-05", "200.00"),
    ],
    [],
    context,
  );

  assert.equal(result.currentDailyExpense.toString(), "20");
  assert.equal(result.historicalDailyExpense.toString(), "10");
  assert.equal(result.percentageDifference?.toString(), "100");
  assert.equal(result.direction, "above");
  assert.deepEqual(result.monthsUsed, trailingMonths.map(([month]) => month));
});

test("uses full calendar days for past-month pace and classifies exact matches", () => {
  const context = buildForecastMonthContext({
    selectedMonth: "2026-08",
    referenceDate: "2026-09-10",
  });
  const result = calculateSpendingPace(
    [
      ...historicalExpensesAtTenPerDay(),
      variableExpense("2026-08-31", "310.00"),
    ],
    [],
    context,
  );

  assert.equal(context.elapsedDays, 31);
  assert.equal(result.currentDailyExpense.toString(), "10");
  assert.equal(result.percentageDifference?.toString(), "0");
  assert.equal(result.direction, "on-pace");
});

test("excludes active planned-bill categories from current and historical pace", () => {
  const context = buildForecastMonthContext({
    selectedMonth: "2026-08",
    referenceDate: "2026-08-10",
  });
  const plannedBills = [
    {
      amount: new Prisma.Decimal("100.00"),
      dueDayOfMonth: 15,
      categoryId: "fixed",
      isActive: true,
      occurrenceStatus: null,
    },
  ];
  const fixedExpenses = [
    ...trailingMonths.map(([month]) =>
      variableExpense(`${month}-02`, "10000.00", "fixed"),
    ),
    variableExpense("2026-08-02", "10000.00", "fixed"),
  ];
  const result = calculateSpendingPace(
    [
      ...historicalExpensesAtTenPerDay(),
      ...fixedExpenses,
      variableExpense("2026-08-05", "50.00"),
    ],
    plannedBills,
    context,
  );

  assert.equal(result.currentDailyExpense.toString(), "5");
  assert.equal(result.historicalDailyExpense.toString(), "10");
  assert.equal(result.percentageDifference?.toString(), "-50");
  assert.equal(result.direction, "below");
});

test("returns unavailable without history and for future months", () => {
  const noHistory = calculateSpendingPace(
    [variableExpense("2026-08-05", "50.00")],
    [],
    buildForecastMonthContext({
      selectedMonth: "2026-08",
      referenceDate: "2026-08-10",
    }),
  );
  const future = calculateSpendingPace(
    historicalExpensesAtTenPerDay(),
    [],
    buildForecastMonthContext({
      selectedMonth: "2026-09",
      referenceDate: "2026-08-10",
    }),
  );

  assert.equal(noHistory.currentDailyExpense.toString(), "5");
  assert.equal(noHistory.direction, "unavailable");
  assert.equal(noHistory.percentageDifference, null);
  assert.equal(future.currentDailyExpense.toString(), "0");
  assert.equal(future.direction, "unavailable");
});

test("forecast summary exposes spending pace", () => {
  const summary = computeForecastSummary({
    selectedMonth: "2026-08",
    referenceDate: "2026-08-10",
    transactions: [
      ...historicalExpensesAtTenPerDay(),
      variableExpense("2026-08-05", "100.00"),
    ],
    plannedBills: [],
  });

  assert.equal(summary.spendingPace.currentDailyExpense.toString(), "10");
  assert.equal(summary.spendingPace.direction, "on-pace");
  assert.equal(summary.spendingPace.monthsUsed.length, 6);
});
