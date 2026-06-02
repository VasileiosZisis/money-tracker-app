import { Prisma } from "@/generated/prisma/client";

import { sumDecimals, ZERO_DECIMAL } from "@/lib/forecast/decimal";
import type { ForecastMonthContext } from "@/lib/forecast/month-context";

export type ForecastPlannedBillLike = {
  amount: Prisma.Decimal;
  dueDayOfMonth: number;
  categoryId: string;
  isActive: boolean;
  occurrenceStatus?: "PAID" | "SKIPPED" | null;
};

export function getPlannedExpenseCategoryIds(plannedBills: readonly ForecastPlannedBillLike[]) {
  return [...new Set(plannedBills.filter((bill) => bill.isActive).map((bill) => bill.categoryId))].sort();
}

export function calculateUnpaidPlannedBills(
  plannedBills: readonly ForecastPlannedBillLike[],
  monthContext: ForecastMonthContext,
) {
  const activeBills = plannedBills.filter(
    (plannedBill) =>
      plannedBill.isActive &&
      plannedBill.occurrenceStatus !== "PAID" &&
      plannedBill.occurrenceStatus !== "SKIPPED",
  );

  if (activeBills.length === 0 || monthContext.monthRelation === "past") {
    return ZERO_DECIMAL;
  }

  return activeBills.length > 0
    ? sumDecimals(activeBills.map((plannedBill) => plannedBill.amount))
    : ZERO_DECIMAL;
}
