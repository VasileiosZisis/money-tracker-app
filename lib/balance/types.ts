import { Prisma } from "@/generated/prisma/client";

export type BalancePeriod = {
  startMonth: string;
  endMonth: string;
};

export type MonthlyEndingBalance = {
  month: string;
  endingBalance: Prisma.Decimal;
};

export type TotalBalanceSummary = {
  period: BalancePeriod;
  startingBalance: Prisma.Decimal;
  netChange: Prisma.Decimal;
  endingBalance: Prisma.Decimal;
  monthlyBalances: MonthlyEndingBalance[];
};

export type BalanceTransactionLike = {
  type: "INCOME" | "EXPENSE";
  amount: Prisma.Decimal;
  localDate: string;
};

export type BalanceAdjustmentLike = {
  amount: Prisma.Decimal;
  effectiveMonth: string;
};
