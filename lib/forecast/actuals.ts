import { Prisma } from "@/generated/prisma/client";
import { TransactionType } from "@/generated/prisma/enums";

import type { ForecastMonthContext } from "@/lib/forecast/month-context";
import { sumDecimals, ZERO_DECIMAL } from "@/lib/forecast/decimal";

export type ForecastTransactionLike = {
  type: TransactionType;
  amount: Prisma.Decimal;
  localDate: string;
  categoryId: string;
};

function isTransactionInSelectedMonth(
  transaction: Pick<ForecastTransactionLike, "localDate">,
  monthContext: ForecastMonthContext,
) {
  return (
    transaction.localDate >= monthContext.start &&
    transaction.localDate < monthContext.endExclusive
  );
}

function isTransactionInActualWindow(
  transaction: Pick<ForecastTransactionLike, "localDate">,
  monthContext: ForecastMonthContext,
) {
  if (!isTransactionInSelectedMonth(transaction, monthContext)) {
    return false;
  }

  if (monthContext.monthRelation === "past") {
    return true;
  }

  if (monthContext.monthRelation === "future") {
    return false;
  }

  return transaction.localDate <= monthContext.referenceDate;
}

export function filterTransactionsSoFar<T extends ForecastTransactionLike>(
  transactions: readonly T[],
  monthContext: ForecastMonthContext,
) {
  return transactions.filter((transaction) =>
    isTransactionInActualWindow(transaction, monthContext),
  );
}

function sumTransactionsByType(
  transactions: readonly ForecastTransactionLike[],
  type: TransactionType,
  monthContext: ForecastMonthContext,
) {
  const matchingAmounts = filterTransactionsSoFar(transactions, monthContext)
    .filter((transaction) => transaction.type === type)
    .map((transaction) => transaction.amount);

  return matchingAmounts.length > 0 ? sumDecimals(matchingAmounts) : ZERO_DECIMAL;
}

export function calculateIncomeSoFar(
  transactions: readonly ForecastTransactionLike[],
  monthContext: ForecastMonthContext,
) {
  return sumTransactionsByType(transactions, TransactionType.INCOME, monthContext);
}

export function calculateExpenseSoFar(
  transactions: readonly ForecastTransactionLike[],
  monthContext: ForecastMonthContext,
) {
  return sumTransactionsByType(transactions, TransactionType.EXPENSE, monthContext);
}

export function calculateNetLeftNow(incomeSoFar: Prisma.Decimal, expenseSoFar: Prisma.Decimal) {
  return incomeSoFar.minus(expenseSoFar).toDecimalPlaces(2);
}
