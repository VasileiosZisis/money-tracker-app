import { Prisma } from "@/generated/prisma/client";

import {
  calculateExpenseSoFar,
  calculateIncomeSoFar,
  calculateNetLeftNow,
  type ForecastTransactionLike,
} from "@/lib/forecast/actuals";
import { roundMoney, ZERO_DECIMAL } from "@/lib/forecast/decimal";
import {
  buildForecastMonthContext,
  getTodayLocalDate,
  type ForecastMonthContext,
} from "@/lib/forecast/month-context";
import {
  calculateUnpaidPlannedBills,
  getPlannedExpenseCategoryIds,
  type ForecastPlannedBillLike,
} from "@/lib/forecast/planned-bills";
import {
  calculatePendingPlannedIncome,
  type ForecastPlannedIncomeLike,
} from "@/lib/forecast/planned-income";
import {
  calculateVariableCategoryForecast,
  type VariableForecastSource,
} from "@/lib/forecast/variable-forecast";

export type ForecastInputTransaction = ForecastTransactionLike;
export type ForecastInputPlannedBill = ForecastPlannedBillLike;
export type ForecastInputPlannedIncome = ForecastPlannedIncomeLike;

export type ForecastSummary = {
  monthContext: ForecastMonthContext;
  incomeSoFar: Prisma.Decimal;
  expenseSoFar: Prisma.Decimal;
  netLeftNow: Prisma.Decimal;
  unpaidPlannedBills: Prisma.Decimal;
  pendingPlannedIncome: Prisma.Decimal;
  variableCategoryForecast: Prisma.Decimal;
  forecastRemainingSpend: Prisma.Decimal;
  projectedEndOfMonthNet: Prisma.Decimal;
  safeToSpend: Prisma.Decimal;
  dailySafeSpend: Prisma.Decimal;
  dailySafeSpendDays: number;
  variableForecastSource: VariableForecastSource;
  variableForecastMonthsUsed: string[];
  variableForecastAverageDailyExpense: Prisma.Decimal;
  plannedExpenseCategoryIds: string[];
};

export function calculateForecastRemainingSpend(
  unpaidPlannedBills: Prisma.Decimal,
  variableCategoryForecast: Prisma.Decimal,
) {
  return roundMoney(unpaidPlannedBills.plus(variableCategoryForecast));
}

export function calculateProjectedEndOfMonthNet(
  netLeftNow: Prisma.Decimal,
  pendingPlannedIncome: Prisma.Decimal,
  forecastRemainingSpend: Prisma.Decimal,
) {
  return roundMoney(netLeftNow.plus(pendingPlannedIncome).minus(forecastRemainingSpend));
}

export function calculateSafeToSpend(
  netLeftNow: Prisma.Decimal,
  forecastRemainingSpend: Prisma.Decimal,
) {
  return roundMoney(netLeftNow.minus(forecastRemainingSpend));
}

export function calculateDailySafeSpendDays(monthContext: ForecastMonthContext) {
  if (monthContext.monthRelation === "past") {
    return 0;
  }

  if (monthContext.monthRelation === "future") {
    return monthContext.daysInMonth;
  }

  return Math.max(monthContext.remainingDays + 1, 1);
}

export function calculateDailySafeSpend(safeToSpend: Prisma.Decimal, days: number) {
  if (days <= 0) {
    return ZERO_DECIMAL;
  }

  return roundMoney(safeToSpend.div(days));
}

export function computeForecastSummary(params: {
  selectedMonth: string;
  referenceDate?: string;
  transactions: readonly ForecastInputTransaction[];
  plannedBills: readonly ForecastInputPlannedBill[];
  plannedIncomes?: readonly ForecastInputPlannedIncome[];
}) {
  const monthContext = buildForecastMonthContext({
    selectedMonth: params.selectedMonth,
    referenceDate: params.referenceDate ?? getTodayLocalDate(),
  });
  const incomeSoFar = calculateIncomeSoFar(params.transactions, monthContext);
  const expenseSoFar = calculateExpenseSoFar(params.transactions, monthContext);
  const netLeftNow = calculateNetLeftNow(incomeSoFar, expenseSoFar);
  const unpaidPlannedBills = calculateUnpaidPlannedBills(params.plannedBills, monthContext);
  const pendingPlannedIncome = calculatePendingPlannedIncome(
    params.plannedIncomes ?? [],
    monthContext,
  );
  const variableForecast = calculateVariableCategoryForecast(
    params.transactions,
    params.plannedBills,
    monthContext,
  );
  const forecastRemainingSpend = calculateForecastRemainingSpend(
    unpaidPlannedBills,
    variableForecast.amount,
  );
  const projectedEndOfMonthNet = calculateProjectedEndOfMonthNet(
    netLeftNow,
    pendingPlannedIncome,
    forecastRemainingSpend,
  );
  const safeToSpend = calculateSafeToSpend(netLeftNow, forecastRemainingSpend);
  const dailySafeSpendDays = calculateDailySafeSpendDays(monthContext);
  const dailySafeSpend = calculateDailySafeSpend(safeToSpend, dailySafeSpendDays);

  return {
    monthContext,
    incomeSoFar,
    expenseSoFar,
    netLeftNow,
    unpaidPlannedBills,
    pendingPlannedIncome,
    variableCategoryForecast: variableForecast.amount,
    forecastRemainingSpend,
    projectedEndOfMonthNet,
    safeToSpend,
    dailySafeSpend,
    dailySafeSpendDays,
    variableForecastSource: variableForecast.source,
    variableForecastMonthsUsed: variableForecast.monthsUsed,
    variableForecastAverageDailyExpense: variableForecast.averageDailyExpense,
    plannedExpenseCategoryIds: getPlannedExpenseCategoryIds(params.plannedBills),
  } satisfies ForecastSummary;
}
