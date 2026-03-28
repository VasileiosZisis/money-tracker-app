import { Prisma } from "@/generated/prisma/client";

import {
  calculateExpenseSoFar,
  calculateIncomeSoFar,
  calculateNetLeftNow,
  type ForecastTransactionLike,
} from "@/lib/forecast/actuals";
import { roundMoney } from "@/lib/forecast/decimal";
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
  calculateVariableCategoryForecast,
  type VariableForecastSource,
} from "@/lib/forecast/variable-forecast";

export type ForecastInputTransaction = ForecastTransactionLike;
export type ForecastInputPlannedBill = ForecastPlannedBillLike;

export type ForecastSummary = {
  monthContext: ForecastMonthContext;
  incomeSoFar: Prisma.Decimal;
  expenseSoFar: Prisma.Decimal;
  netLeftNow: Prisma.Decimal;
  unpaidPlannedBills: Prisma.Decimal;
  variableCategoryForecast: Prisma.Decimal;
  forecastRemainingSpend: Prisma.Decimal;
  projectedEndOfMonthNet: Prisma.Decimal;
  safeToSpend: Prisma.Decimal;
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
  incomeSoFar: Prisma.Decimal,
  expenseSoFar: Prisma.Decimal,
  forecastRemainingSpend: Prisma.Decimal,
) {
  return roundMoney(incomeSoFar.minus(expenseSoFar.plus(forecastRemainingSpend)));
}

export function calculateSafeToSpend(
  netLeftNow: Prisma.Decimal,
  forecastRemainingSpend: Prisma.Decimal,
) {
  return roundMoney(netLeftNow.minus(forecastRemainingSpend));
}

export function computeForecastSummary(params: {
  selectedMonth: string;
  referenceDate?: string;
  transactions: readonly ForecastInputTransaction[];
  plannedBills: readonly ForecastInputPlannedBill[];
}) {
  const monthContext = buildForecastMonthContext({
    selectedMonth: params.selectedMonth,
    referenceDate: params.referenceDate ?? getTodayLocalDate(),
  });
  const incomeSoFar = calculateIncomeSoFar(params.transactions, monthContext);
  const expenseSoFar = calculateExpenseSoFar(params.transactions, monthContext);
  const netLeftNow = calculateNetLeftNow(incomeSoFar, expenseSoFar);
  const unpaidPlannedBills = calculateUnpaidPlannedBills(params.plannedBills, monthContext);
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
    incomeSoFar,
    expenseSoFar,
    forecastRemainingSpend,
  );
  const safeToSpend = calculateSafeToSpend(netLeftNow, forecastRemainingSpend);

  return {
    monthContext,
    incomeSoFar,
    expenseSoFar,
    netLeftNow,
    unpaidPlannedBills,
    variableCategoryForecast: variableForecast.amount,
    forecastRemainingSpend,
    projectedEndOfMonthNet,
    safeToSpend,
    variableForecastSource: variableForecast.source,
    variableForecastMonthsUsed: variableForecast.monthsUsed,
    variableForecastAverageDailyExpense: variableForecast.averageDailyExpense,
    plannedExpenseCategoryIds: getPlannedExpenseCategoryIds(params.plannedBills),
  } satisfies ForecastSummary;
}
