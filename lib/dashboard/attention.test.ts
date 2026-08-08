import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@/generated/prisma/client";

import {
  buildDashboardAttentionItems,
  type BuildDashboardAttentionItemsParams,
} from "@/lib/dashboard/attention";

const NOW = new Date("2026-08-10T12:00:00.000Z");

type PlannedBill = BuildDashboardAttentionItemsParams["plannedBills"][number];
type PlannedIncome = BuildDashboardAttentionItemsParams["plannedIncomes"][number];
type AttentionForecast = BuildDashboardAttentionItemsParams["forecast"];
type SpendingPace = AttentionForecast["spendingPace"];
type MakeParamsOverrides = Omit<
  Partial<BuildDashboardAttentionItemsParams>,
  "forecast"
> & {
  forecast?: Omit<Partial<AttentionForecast>, "monthContext"> & {
    monthContext?: Partial<AttentionForecast["monthContext"]>;
  };
};

function makeBill(overrides: Partial<PlannedBill> = {}): PlannedBill {
  return {
    name: "Rent",
    amount: new Prisma.Decimal("125.00"),
    dueDayOfMonth: 11,
    isActive: true,
    status: "upcoming",
    ...overrides,
  };
}

function makeIncome(overrides: Partial<PlannedIncome> = {}): PlannedIncome {
  return {
    name: "Salary",
    amount: new Prisma.Decimal("2000.00"),
    expectedDayOfMonth: 10,
    isActive: true,
    status: "due-today",
    ...overrides,
  };
}

function makeSpendingPace(overrides: Partial<SpendingPace> = {}): SpendingPace {
  return {
    currentDailyExpense: new Prisma.Decimal("10.00"),
    historicalDailyExpense: new Prisma.Decimal("10.00"),
    percentageDifference: new Prisma.Decimal(0),
    direction: "on-pace",
    monthsUsed: [
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
    ],
    ...overrides,
  };
}

function makeParams(
  overrides: MakeParamsOverrides = {},
): BuildDashboardAttentionItemsParams {
  const baseParams: BuildDashboardAttentionItemsParams = {
    currency: "USD",
    forecast: {
      monthContext: {
        monthRelation: "current",
        currentDayOfMonth: 10,
      },
      safeToSpend: new Prisma.Decimal("100.00"),
      pendingPlannedIncome: new Prisma.Decimal(0),
      forecastConfidence: "high",
      variableForecastSource: "trailing-history",
      variableForecastMonthsUsed: [
        "2026-02",
        "2026-03",
        "2026-04",
        "2026-05",
        "2026-06",
        "2026-07",
      ],
      spendingPace: makeSpendingPace(),
    },
    plannedBills: [],
    plannedIncomes: [],
    latestTransactionEntry: { createdAt: NOW },
    now: NOW,
  };
  const { forecast: forecastOverrides, ...paramOverrides } = overrides;

  return {
    ...baseParams,
    ...paramOverrides,
    forecast: {
      ...baseParams.forecast,
      ...forecastOverrides,
      monthContext: {
        ...baseParams.forecast.monthContext,
        ...forecastOverrides?.monthContext,
      },
    },
  };
}

test("creates ordered due-soon signals for bills due in one through three days", () => {
  const items = buildDashboardAttentionItems(
    makeParams({
      plannedBills: [
        makeBill({ name: "Water", dueDayOfMonth: 13 }),
        makeBill({ name: "Internet", dueDayOfMonth: 11 }),
        makeBill({ name: "Electricity", dueDayOfMonth: 12 }),
      ],
    }),
  );
  const expectedAmount = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(125);

  assert.deepEqual(
    items.map((item) => item.type),
    [
      "DUE_SOON_PLANNED_BILL",
      "DUE_SOON_PLANNED_BILL",
      "DUE_SOON_PLANNED_BILL",
    ],
  );
  assert.deepEqual(
    items.map((item) => item.title),
    [
      "Internet is due tomorrow",
      "Electricity is due in 2 days",
      "Water is due in 3 days",
    ],
  );
  assert.equal(items[0]?.description, `${expectedAmount} still reserved`);
  assert.equal(items[0]?.tone, "warning");
});

test("excludes bills that are not active, unhandled, and due in the next three days", () => {
  const items = buildDashboardAttentionItems(
    makeParams({
      plannedBills: [
        makeBill({ name: "Due today", dueDayOfMonth: 10, status: "due-today" }),
        makeBill({ name: "Overdue", dueDayOfMonth: 9, status: "overdue" }),
        makeBill({ name: "Paid", status: "paid" }),
        makeBill({ name: "Skipped", status: "skipped" }),
        makeBill({ name: "Inactive", isActive: false }),
        makeBill({ name: "Later", dueDayOfMonth: 14 }),
      ],
    }),
  );

  assert.equal(
    items.some((item) => item.type === "DUE_SOON_PLANNED_BILL"),
    false,
  );
});

test("limits due-soon signals to the current selected month", () => {
  for (const monthRelation of ["past", "future"] as const) {
    const items = buildDashboardAttentionItems(
      makeParams({
        forecast: {
          monthContext: {
            monthRelation,
            currentDayOfMonth: monthRelation === "future" ? null : 10,
          },
          safeToSpend: new Prisma.Decimal("100.00"),
          pendingPlannedIncome: new Prisma.Decimal(0),
          forecastConfidence: "high",
          variableForecastSource: "trailing-history",
          variableForecastMonthsUsed: [
            "2026-02",
            "2026-03",
            "2026-04",
            "2026-05",
            "2026-06",
            "2026-07",
          ],
        },
        plannedBills: [makeBill()],
      }),
    );

    assert.equal(
      items.some((item) => item.type === "DUE_SOON_PLANNED_BILL"),
      false,
    );
  }

  const monthEndItems = buildDashboardAttentionItems(
    makeParams({
      forecast: {
        monthContext: {
          monthRelation: "current",
          currentDayOfMonth: 28,
        },
        safeToSpend: new Prisma.Decimal("100.00"),
        pendingPlannedIncome: new Prisma.Decimal(0),
        forecastConfidence: "high",
        variableForecastSource: "trailing-history",
        variableForecastMonthsUsed: [
          "2026-02",
          "2026-03",
          "2026-04",
          "2026-05",
          "2026-06",
          "2026-07",
        ],
      },
      plannedBills: [makeBill({ dueDayOfMonth: 1 })],
    }),
  );

  assert.equal(
    monthEndItems.some((item) => item.type === "DUE_SOON_PLANNED_BILL"),
    false,
  );
});

test("orders signals by urgency and returns at most six", () => {
  const items = buildDashboardAttentionItems(
    makeParams({
      forecast: {
        monthContext: {
          monthRelation: "current",
          currentDayOfMonth: 10,
        },
        safeToSpend: new Prisma.Decimal("-50.00"),
        pendingPlannedIncome: new Prisma.Decimal("2000.00"),
        forecastConfidence: "low",
        variableForecastSource: "current-month-run-rate",
        variableForecastMonthsUsed: [],
        spendingPace: makeSpendingPace({
          currentDailyExpense: new Prisma.Decimal("20.00"),
          percentageDifference: new Prisma.Decimal("100.0"),
          direction: "above",
        }),
      },
      plannedBills: [
        makeBill({ name: "Overdue bill", dueDayOfMonth: 9, status: "overdue" }),
        makeBill({ name: "Bill today", dueDayOfMonth: 10, status: "due-today" }),
        makeBill({ name: "Bill tomorrow", dueDayOfMonth: 11 }),
      ],
      plannedIncomes: [
        makeIncome({
          name: "Overdue income",
          expectedDayOfMonth: 9,
          status: "overdue",
        }),
        makeIncome({ name: "Income today" }),
      ],
      latestTransactionEntry: null,
    }),
  );

  assert.deepEqual(
    items.map((item) => item.type),
    [
      "OVERDUE_PLANNED_BILL",
      "OVERDUE_PLANNED_INCOME",
      "NEGATIVE_SAFE_TO_SPEND",
      "DUE_TODAY_PLANNED_BILL",
      "DUE_TODAY_PLANNED_INCOME",
      "DUE_SOON_PLANNED_BILL",
    ],
  );
  assert.equal(items.length, 6);
});

test("adds above-usual current-month spending pace attention with baseline context", () => {
  const items = buildDashboardAttentionItems(
    makeParams({
      forecast: {
        spendingPace: makeSpendingPace({
          currentDailyExpense: new Prisma.Decimal("20.00"),
          historicalDailyExpense: new Prisma.Decimal("10.00"),
          percentageDifference: new Prisma.Decimal("100.0"),
          direction: "above",
        }),
      },
    }),
  );
  const currentPace = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(20);
  const historicalPace = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(10);

  assert.deepEqual(
    items.filter((item) => item.type === "ABOVE_USUAL_SPENDING_PACE"),
    [
      {
        type: "ABOVE_USUAL_SPENDING_PACE",
        title: "Spending pace is above usual",
        description: `Variable spending is ${currentPace}/day, 100.0% above the usual ${historicalPace}/day based on 6 historical months.`,
        tone: "warning",
      },
    ],
  );
});

test("excludes non-actionable spending pace states from attention", () => {
  for (const direction of ["below", "on-pace", "unavailable"] as const) {
    const items = buildDashboardAttentionItems(
      makeParams({
        forecast: {
          spendingPace: makeSpendingPace({
            direction,
            percentageDifference:
              direction === "unavailable"
                ? null
                : new Prisma.Decimal(direction === "below" ? "-25.0" : 0),
          }),
        },
      }),
    );

    assert.equal(
      items.some((item) => item.type === "ABOVE_USUAL_SPENDING_PACE"),
      false,
    );
  }

  for (const monthRelation of ["past", "future"] as const) {
    const items = buildDashboardAttentionItems(
      makeParams({
        forecast: {
          monthContext: {
            monthRelation,
            currentDayOfMonth: null,
          },
          spendingPace: makeSpendingPace({
            currentDailyExpense: new Prisma.Decimal("20.00"),
            percentageDifference: new Prisma.Decimal("100.0"),
            direction: "above",
          }),
        },
      }),
    );

    assert.equal(
      items.some((item) => item.type === "ABOVE_USUAL_SPENDING_PACE"),
      false,
    );
  }

  const noBaselineItems = buildDashboardAttentionItems(
    makeParams({
      forecast: {
        spendingPace: makeSpendingPace({
          historicalDailyExpense: new Prisma.Decimal(0),
          percentageDifference: new Prisma.Decimal("100.0"),
          direction: "above",
          monthsUsed: [],
        }),
      },
    }),
  );

  assert.equal(
    noBaselineItems.some((item) => item.type === "ABOVE_USUAL_SPENDING_PACE"),
    false,
  );
});

test("orders above-usual pace after due-soon bills and before context signals", () => {
  const items = buildDashboardAttentionItems(
    makeParams({
      forecast: {
        safeToSpend: new Prisma.Decimal("-50.00"),
        pendingPlannedIncome: new Prisma.Decimal("2000.00"),
        forecastConfidence: "low",
        variableForecastSource: "trailing-history",
        variableForecastMonthsUsed: ["2026-07"],
        spendingPace: makeSpendingPace({
          currentDailyExpense: new Prisma.Decimal("15.00"),
          percentageDifference: new Prisma.Decimal("50.0"),
          direction: "above",
        }),
      },
      plannedBills: [makeBill({ name: "Bill tomorrow", dueDayOfMonth: 11 })],
      latestTransactionEntry: null,
    }),
  );

  assert.deepEqual(
    items.map((item) => item.type),
    [
      "NEGATIVE_SAFE_TO_SPEND",
      "DUE_SOON_PLANNED_BILL",
      "ABOVE_USUAL_SPENDING_PACE",
      "NEGATIVE_SAFE_TO_SPEND_WITH_PENDING_INCOME",
      "STALE_TRANSACTIONS",
      "LOW_FORECAST_CONFIDENCE",
    ],
  );
});

test("adds attention only for low current-month forecast confidence", () => {
  const lowItems = buildDashboardAttentionItems(
    makeParams({
      forecast: {
        monthContext: {
          monthRelation: "current",
          currentDayOfMonth: 10,
        },
        safeToSpend: new Prisma.Decimal("100.00"),
        pendingPlannedIncome: new Prisma.Decimal(0),
        forecastConfidence: "low",
        variableForecastSource: "trailing-history",
        variableForecastMonthsUsed: ["2026-06", "2026-07"],
      },
    }),
  );

  assert.deepEqual(
    lowItems.filter((item) => item.type === "LOW_FORECAST_CONFIDENCE"),
    [
      {
        type: "LOW_FORECAST_CONFIDENCE",
        title: "Forecast confidence is low",
        description:
          "Variable spending is based on 2 full months; 3 are needed for medium confidence.",
        tone: "warning",
      },
    ],
  );

  for (const forecastConfidence of ["medium", "high"] as const) {
    const items = buildDashboardAttentionItems(
      makeParams({
        forecast: {
          monthContext: {
            monthRelation: "current",
            currentDayOfMonth: 10,
          },
          safeToSpend: new Prisma.Decimal("100.00"),
          pendingPlannedIncome: new Prisma.Decimal(0),
          forecastConfidence,
          variableForecastSource: "trailing-history",
          variableForecastMonthsUsed:
            forecastConfidence === "medium"
              ? ["2026-05", "2026-06", "2026-07"]
              : [
                  "2026-02",
                  "2026-03",
                  "2026-04",
                  "2026-05",
                  "2026-06",
                  "2026-07",
                ],
        },
      }),
    );

    assert.equal(
      items.some((item) => item.type === "LOW_FORECAST_CONFIDENCE"),
      false,
    );
  }
});
