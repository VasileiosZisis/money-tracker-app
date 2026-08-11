import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@/generated/prisma/client";

import { calculatePlannedIncomeRealization } from "@/lib/dashboard/planned-income-realization";

function plannedIncome(params: {
  plannedAmount: string;
  actualAmount?: string | null;
  status?: "RECEIVED" | "SKIPPED" | null;
  isActive?: boolean;
}) {
  return {
    plannedAmount: new Prisma.Decimal(params.plannedAmount),
    receivedTransactionAmount:
      params.actualAmount === null || params.actualAmount === undefined
        ? null
        : new Prisma.Decimal(params.actualAmount),
    occurrenceStatus: params.status ?? null,
    isActive: params.isActive ?? true,
  };
}

test("uses actual amounts while pending and skipped plans remain in the denominator", () => {
  const result = calculatePlannedIncomeRealization({
    monthRelation: "current",
    plannedIncomes: [
      plannedIncome({
        plannedAmount: "100.00",
        actualAmount: "80.00",
        status: "RECEIVED",
      }),
      plannedIncome({ plannedAmount: "200.00" }),
      plannedIncome({ plannedAmount: "50.00", status: "SKIPPED" }),
      plannedIncome({
        plannedAmount: "1000.00",
        actualAmount: "1000.00",
        status: "RECEIVED",
        isActive: false,
      }),
    ],
  });

  assert.equal(result.actualReceivedAmount.toString(), "80");
  assert.equal(result.totalPlannedAmount.toString(), "350");
  assert.equal(result.percentage?.toString(), "22.9");
  assert.equal(result.status, "in-progress");
});

test("combines received transaction amounts and allows realization above 100 percent", () => {
  const result = calculatePlannedIncomeRealization({
    monthRelation: "current",
    plannedIncomes: [
      plannedIncome({
        plannedAmount: "100.00",
        actualAmount: "120.00",
        status: "RECEIVED",
      }),
      plannedIncome({
        plannedAmount: "100.00",
        actualAmount: "130.00",
        status: "RECEIVED",
      }),
    ],
  });

  assert.equal(result.actualReceivedAmount.toString(), "250");
  assert.equal(result.totalPlannedAmount.toString(), "200");
  assert.equal(result.percentage?.toString(), "125");
  assert.equal(result.status, "complete");
});

test("classifies exact completion and incomplete past months", () => {
  const complete = calculatePlannedIncomeRealization({
    monthRelation: "past",
    plannedIncomes: [
      plannedIncome({
        plannedAmount: "100.00",
        actualAmount: "100.00",
        status: "RECEIVED",
      }),
    ],
  });
  const incomplete = calculatePlannedIncomeRealization({
    monthRelation: "past",
    plannedIncomes: [
      plannedIncome({
        plannedAmount: "100.00",
        actualAmount: "75.00",
        status: "RECEIVED",
      }),
    ],
  });

  assert.equal(complete.percentage?.toString(), "100");
  assert.equal(complete.status, "complete");
  assert.equal(incomplete.percentage?.toString(), "75");
  assert.equal(incomplete.status, "under-realized");
});

test("returns not started for future months and unavailable without active plans", () => {
  const future = calculatePlannedIncomeRealization({
    monthRelation: "future",
    plannedIncomes: [plannedIncome({ plannedAmount: "500.00" })],
  });
  const unavailable = calculatePlannedIncomeRealization({
    monthRelation: "current",
    plannedIncomes: [
      plannedIncome({ plannedAmount: "500.00", isActive: false }),
    ],
  });

  assert.equal(future.percentage, null);
  assert.equal(future.totalPlannedAmount.toString(), "500");
  assert.equal(future.status, "not-started");
  assert.equal(unavailable.percentage, null);
  assert.equal(unavailable.totalPlannedAmount.toString(), "0");
  assert.equal(unavailable.status, "unavailable");
});

test("treats a received occurrence without a transaction as zero actual income", () => {
  const result = calculatePlannedIncomeRealization({
    monthRelation: "current",
    plannedIncomes: [
      plannedIncome({
        plannedAmount: "100.00",
        status: "RECEIVED",
        actualAmount: null,
      }),
    ],
  });

  assert.equal(result.actualReceivedAmount.toString(), "0");
  assert.equal(result.percentage?.toString(), "0");
  assert.equal(result.status, "in-progress");
});

test("rounds realization percentage to one decimal place", () => {
  const result = calculatePlannedIncomeRealization({
    monthRelation: "current",
    plannedIncomes: [
      plannedIncome({
        plannedAmount: "300.00",
        actualAmount: "100.00",
        status: "RECEIVED",
      }),
    ],
  });

  assert.equal(result.percentage?.toString(), "33.3");
});
