import { Prisma } from "@/generated/prisma/client";
import { TransactionType } from "@/generated/prisma/enums";

import {
  filterTransactionsSoFar,
  type ForecastTransactionLike,
} from "@/lib/forecast/actuals";
import { sumDecimals, ZERO_DECIMAL } from "@/lib/forecast/decimal";
import type { ForecastMonthContext } from "@/lib/forecast/month-context";
import {
  getPlannedExpenseCategoryIds,
  type ForecastPlannedBillLike,
} from "@/lib/forecast/planned-bills";

export type SpendingPaceDirection =
  | "above"
  | "below"
  | "on-pace"
  | "unavailable";

export type SpendingPaceResult = {
  currentDailyExpense: Prisma.Decimal;
  historicalDailyExpense: Prisma.Decimal;
  percentageDifference: Prisma.Decimal | null;
  direction: SpendingPaceDirection;
  monthsUsed: string[];
};

function getDaysInMonth(monthKey: string) {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));

  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function calculateSpendingPace(
  transactions: readonly ForecastTransactionLike[],
  plannedBills: readonly ForecastPlannedBillLike[],
  monthContext: ForecastMonthContext,
): SpendingPaceResult {
  const excludedCategoryIds = new Set(getPlannedExpenseCategoryIds(plannedBills));
  const variableExpenses = transactions.filter(
    (transaction) =>
      transaction.type === TransactionType.EXPENSE &&
      !excludedCategoryIds.has(transaction.categoryId),
  );

  if (monthContext.monthRelation === "future" || monthContext.elapsedDays <= 0) {
    return {
      currentDailyExpense: ZERO_DECIMAL,
      historicalDailyExpense: ZERO_DECIMAL,
      percentageDifference: null,
      direction: "unavailable",
      monthsUsed: [],
    };
  }

  const currentExpense = sumDecimals(
    filterTransactionsSoFar(variableExpenses, monthContext).map(
      (transaction) => transaction.amount,
    ),
  );
  const currentDailyExpense = currentExpense
    .dividedBy(monthContext.elapsedDays)
    .toDecimalPlaces(4);
  const monthsUsed = monthContext.trailingFullMonths.filter((monthKey) =>
    variableExpenses.some((transaction) => transaction.localDate.startsWith(monthKey)),
  );

  if (monthsUsed.length === 0) {
    return {
      currentDailyExpense,
      historicalDailyExpense: ZERO_DECIMAL,
      percentageDifference: null,
      direction: "unavailable",
      monthsUsed,
    };
  }

  const monthSet = new Set(monthsUsed);
  const historicalExpense = sumDecimals(
    variableExpenses
      .filter((transaction) => monthSet.has(transaction.localDate.slice(0, 7)))
      .map((transaction) => transaction.amount),
  );
  const historicalDays = monthsUsed.reduce(
    (total, monthKey) => total + getDaysInMonth(monthKey),
    0,
  );
  const historicalDailyExpense = historicalExpense
    .dividedBy(historicalDays)
    .toDecimalPlaces(4);
  const percentageDifference = currentDailyExpense
    .minus(historicalDailyExpense)
    .dividedBy(historicalDailyExpense)
    .mul(100)
    .toDecimalPlaces(1);
  const direction = percentageDifference.gt(0)
    ? "above"
    : percentageDifference.lt(0)
      ? "below"
      : "on-pace";

  return {
    currentDailyExpense,
    historicalDailyExpense,
    percentageDifference,
    direction,
    monthsUsed,
  };
}
