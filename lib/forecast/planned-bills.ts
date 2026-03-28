import { Prisma } from "@/generated/prisma/client";

import { sumDecimals, ZERO_DECIMAL } from "@/lib/forecast/decimal";
import type { ForecastMonthContext } from "@/lib/forecast/month-context";

export type ForecastPlannedBillLike = {
  amount: Prisma.Decimal;
  dueDayOfMonth: number;
  categoryId: string;
  isActive: boolean;
};

export function getPlannedExpenseCategoryIds(plannedBills: readonly ForecastPlannedBillLike[]) {
  return [...new Set(plannedBills.filter((bill) => bill.isActive).map((bill) => bill.categoryId))].sort();
}

export function calculateUnpaidPlannedBills(
  plannedBills: readonly ForecastPlannedBillLike[],
  monthContext: ForecastMonthContext,
) {
  const activeBills = plannedBills.filter((plannedBill) => plannedBill.isActive);

  if (activeBills.length === 0 || monthContext.monthRelation === "past") {
    return ZERO_DECIMAL;
  }

  const unpaidBills =
    monthContext.monthRelation === "future"
      ? activeBills
      : activeBills.filter(
          (plannedBill) => plannedBill.dueDayOfMonth >= (monthContext.currentDayOfMonth ?? 1),
        );

  return unpaidBills.length > 0
    ? sumDecimals(unpaidBills.map((plannedBill) => plannedBill.amount))
    : ZERO_DECIMAL;
}
