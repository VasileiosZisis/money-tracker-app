import { Prisma } from "@/generated/prisma/client";

import {
  getMonthFromLocalDate,
  listInclusiveMonths,
} from "@/lib/balance/months";
import type {
  BalanceAdjustmentLike,
  BalancePeriod,
  BalanceTransactionLike,
  TotalBalanceSummary,
} from "@/lib/balance/types";

function roundMoney(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2);
}

function addMonthlyChange(
  changes: Map<string, Prisma.Decimal>,
  month: string,
  amount: Prisma.Decimal,
) {
  changes.set(month, (changes.get(month) ?? new Prisma.Decimal(0)).plus(amount));
}

export function computeTotalBalanceSummary(params: {
  period: BalancePeriod;
  transactions: readonly BalanceTransactionLike[];
  adjustments: readonly BalanceAdjustmentLike[];
}): TotalBalanceSummary {
  const months = listInclusiveMonths(
    params.period.startMonth,
    params.period.endMonth,
  );
  let startingBalance = new Prisma.Decimal(0);
  const monthlyChanges = new Map<string, Prisma.Decimal>();

  for (const transaction of params.transactions) {
    const month = getMonthFromLocalDate(transaction.localDate);
    const signedAmount =
      transaction.type === "INCOME"
        ? transaction.amount
        : transaction.amount.negated();

    if (month < params.period.startMonth) {
      startingBalance = startingBalance.plus(signedAmount);
    } else if (month <= params.period.endMonth) {
      addMonthlyChange(monthlyChanges, month, signedAmount);
    }
  }

  for (const adjustment of params.adjustments) {
    listInclusiveMonths(adjustment.effectiveMonth, adjustment.effectiveMonth);

    if (adjustment.effectiveMonth < params.period.startMonth) {
      startingBalance = startingBalance.plus(adjustment.amount);
    } else if (adjustment.effectiveMonth <= params.period.endMonth) {
      addMonthlyChange(
        monthlyChanges,
        adjustment.effectiveMonth,
        adjustment.amount,
      );
    }
  }

  startingBalance = roundMoney(startingBalance);
  let runningBalance = startingBalance;
  let netChange = new Prisma.Decimal(0);
  const monthlyBalances = months.map((month) => {
    const monthlyChange = roundMoney(
      monthlyChanges.get(month) ?? new Prisma.Decimal(0),
    );
    netChange = netChange.plus(monthlyChange);
    runningBalance = roundMoney(runningBalance.plus(monthlyChange));

    return {
      month,
      endingBalance: runningBalance,
    };
  });

  netChange = roundMoney(netChange);
  const endingBalance = roundMoney(startingBalance.plus(netChange));

  return {
    period: params.period,
    startingBalance,
    netChange,
    endingBalance,
    monthlyBalances,
  };
}
