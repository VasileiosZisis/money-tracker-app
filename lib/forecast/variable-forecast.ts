import { Prisma } from "@/generated/prisma/client";
import { TransactionType } from "@/generated/prisma/enums";

import { filterTransactionsSoFar, type ForecastTransactionLike } from "@/lib/forecast/actuals";
import { roundMoney, sumDecimals, ZERO_DECIMAL } from "@/lib/forecast/decimal";
import type { ForecastMonthContext } from "@/lib/forecast/month-context";
import { getPlannedExpenseCategoryIds, type ForecastPlannedBillLike } from "@/lib/forecast/planned-bills";

export type VariableForecastSource = "trailing-history" | "current-month-run-rate" | "none";

export type VariableCategoryForecastResult = {
  amount: Prisma.Decimal;
  averageDailyExpense: Prisma.Decimal;
  monthsUsed: string[];
  source: VariableForecastSource;
  excludedCategoryIds: string[];
};

function getDaysInMonth(monthKey: string) {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function filterVariableExpenseTransactions(
  transactions: readonly ForecastTransactionLike[],
  excludedCategoryIds: readonly string[],
) {
  const excludedCategoryIdSet = new Set(excludedCategoryIds);

  return transactions.filter(
    (transaction) =>
      transaction.type === TransactionType.EXPENSE &&
      !excludedCategoryIdSet.has(transaction.categoryId),
  );
}

export function calculateVariableCategoryForecast(
  transactions: readonly ForecastTransactionLike[],
  plannedBills: readonly ForecastPlannedBillLike[],
  monthContext: ForecastMonthContext,
): VariableCategoryForecastResult {
  const excludedCategoryIds = getPlannedExpenseCategoryIds(plannedBills);

  if (monthContext.remainingDays <= 0) {
    return {
      amount: ZERO_DECIMAL,
      averageDailyExpense: ZERO_DECIMAL,
      monthsUsed: [],
      source: "none",
      excludedCategoryIds,
    };
  }

  const variableExpenseTransactions = filterVariableExpenseTransactions(
    transactions,
    excludedCategoryIds,
  );

  const historicalMonthsUsed = monthContext.trailingFullMonths.filter((monthKey) =>
    variableExpenseTransactions.some((transaction) => transaction.localDate.startsWith(monthKey)),
  );

  if (historicalMonthsUsed.length > 0) {
    const historicalMonthSet = new Set(historicalMonthsUsed);
    const historicalTransactions = variableExpenseTransactions.filter((transaction) =>
      historicalMonthSet.has(transaction.localDate.slice(0, 7)),
    );
    const totalHistoricalExpense = sumDecimals(
      historicalTransactions.map((transaction) => transaction.amount),
    );
    const totalHistoricalDays = historicalMonthsUsed.reduce(
      (totalDays, monthKey) => totalDays + getDaysInMonth(monthKey),
      0,
    );
    const averageDailyExpense = totalHistoricalExpense
      .dividedBy(totalHistoricalDays)
      .toDecimalPlaces(4);

    return {
      amount: roundMoney(averageDailyExpense.mul(monthContext.remainingDays)),
      averageDailyExpense,
      monthsUsed: historicalMonthsUsed,
      source: "trailing-history",
      excludedCategoryIds,
    };
  }

  if (monthContext.monthRelation === "current" && monthContext.elapsedDays > 0) {
    const currentMonthVariableExpense = sumDecimals(
      filterTransactionsSoFar(variableExpenseTransactions, monthContext).map(
        (transaction) => transaction.amount,
      ),
    );

    if (currentMonthVariableExpense.gt(0)) {
      const averageDailyExpense = currentMonthVariableExpense
        .dividedBy(monthContext.elapsedDays)
        .toDecimalPlaces(4);

      return {
        amount: roundMoney(averageDailyExpense.mul(monthContext.remainingDays)),
        averageDailyExpense,
        monthsUsed: [],
        source: "current-month-run-rate",
        excludedCategoryIds,
      };
    }
  }

  return {
    amount: ZERO_DECIMAL,
    averageDailyExpense: ZERO_DECIMAL,
    monthsUsed: [],
    source: "none",
    excludedCategoryIds,
  };
}
