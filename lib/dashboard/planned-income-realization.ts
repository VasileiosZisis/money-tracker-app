import { Prisma } from "@/generated/prisma/client";

import type { ForecastMonthRelation } from "@/lib/forecast";
import { sumDecimals, ZERO_DECIMAL } from "@/lib/forecast/decimal";

export type PlannedIncomeRealizationStatus =
  | "unavailable"
  | "not-started"
  | "in-progress"
  | "under-realized"
  | "complete";

export type PlannedIncomeRealizationResult = {
  actualReceivedAmount: Prisma.Decimal;
  totalPlannedAmount: Prisma.Decimal;
  percentage: Prisma.Decimal | null;
  status: PlannedIncomeRealizationStatus;
};

export type PlannedIncomeRealizationItem = {
  plannedAmount: Prisma.Decimal;
  isActive: boolean;
  occurrenceStatus?: "RECEIVED" | "SKIPPED" | null;
  receivedTransactionAmount?: Prisma.Decimal | null;
};

export function calculatePlannedIncomeRealization(params: {
  monthRelation: ForecastMonthRelation;
  plannedIncomes: readonly PlannedIncomeRealizationItem[];
}): PlannedIncomeRealizationResult {
  const activePlannedIncomes = params.plannedIncomes.filter(
    (plannedIncome) => plannedIncome.isActive,
  );
  const totalPlannedAmount =
    activePlannedIncomes.length > 0
      ? sumDecimals(
          activePlannedIncomes.map((plannedIncome) => plannedIncome.plannedAmount),
        )
      : ZERO_DECIMAL;
  const receivedAmounts = activePlannedIncomes.flatMap((plannedIncome) =>
    plannedIncome.occurrenceStatus === "RECEIVED" &&
    plannedIncome.receivedTransactionAmount
      ? [plannedIncome.receivedTransactionAmount]
      : [],
  );
  const actualReceivedAmount =
    receivedAmounts.length > 0 ? sumDecimals(receivedAmounts) : ZERO_DECIMAL;

  if (totalPlannedAmount.eq(0)) {
    return {
      actualReceivedAmount,
      totalPlannedAmount,
      percentage: null,
      status: "unavailable",
    };
  }

  if (params.monthRelation === "future") {
    return {
      actualReceivedAmount,
      totalPlannedAmount,
      percentage: null,
      status: "not-started",
    };
  }

  const percentage = actualReceivedAmount
    .dividedBy(totalPlannedAmount)
    .mul(100)
    .toDecimalPlaces(1);

  if (percentage.gte(100)) {
    return {
      actualReceivedAmount,
      totalPlannedAmount,
      percentage,
      status: "complete",
    };
  }

  return {
    actualReceivedAmount,
    totalPlannedAmount,
    percentage,
    status: params.monthRelation === "past" ? "under-realized" : "in-progress",
  };
}
