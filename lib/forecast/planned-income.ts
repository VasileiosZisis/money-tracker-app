import { Prisma } from "@/generated/prisma/client";

import { sumDecimals, ZERO_DECIMAL } from "@/lib/forecast/decimal";
import type { ForecastMonthContext } from "@/lib/forecast/month-context";

export type ForecastPlannedIncomeLike = {
  amount: Prisma.Decimal;
  expectedDayOfMonth: number;
  categoryId: string;
  isActive: boolean;
  occurrenceStatus?: "RECEIVED" | "SKIPPED" | null;
};

export function calculatePendingPlannedIncome(
  plannedIncomes: readonly ForecastPlannedIncomeLike[],
  monthContext: ForecastMonthContext,
) {
  const activeIncomes = plannedIncomes.filter(
    (plannedIncome) =>
      plannedIncome.isActive &&
      plannedIncome.occurrenceStatus !== "RECEIVED" &&
      plannedIncome.occurrenceStatus !== "SKIPPED",
  );

  if (activeIncomes.length === 0 || monthContext.monthRelation === "past") {
    return ZERO_DECIMAL;
  }

  return sumDecimals(activeIncomes.map((plannedIncome) => plannedIncome.amount));
}
