import { Prisma } from "@/generated/prisma/client";

import { getUserIdOrThrow } from "@/lib/auth/session";
import { getMonthRange } from "@/lib/dates/month";
import { db } from "@/lib/db";
import {
  buildForecastMonthContext,
  computeForecastSummary,
  getTodayLocalDate,
  type ForecastMonthRelation,
  type ForecastSummary,
} from "@/lib/forecast";

export type DashboardPlannedBillStatus = "upcoming" | "due-today" | "passed";

export type DashboardMonthData = {
  month: string;
  currency: string;
  incomeSum: Prisma.Decimal;
  expenseSum: Prisma.Decimal;
  netLeft: Prisma.Decimal;
  forecast: ForecastSummary;
  plannedBills: Array<{
    id: string;
    name: string;
    amount: Prisma.Decimal;
    dueDayOfMonth: number;
    status: DashboardPlannedBillStatus;
    category: {
      name: string;
      isArchived: boolean;
    };
  }>;
  recentTransactions: Array<{
    id: string;
    localDate: string;
    type: "INCOME" | "EXPENSE";
    amount: Prisma.Decimal;
    source: string | null;
    note: string | null;
    category: {
      name: string;
      type: "INCOME" | "EXPENSE";
    };
  }>;
};

function getPlannedBillStatus(
  monthRelation: ForecastMonthRelation,
  currentDayOfMonth: number | null,
  dueDayOfMonth: number,
): DashboardPlannedBillStatus {
  if (monthRelation === "past") {
    return "passed";
  }

  if (monthRelation === "future") {
    return "upcoming";
  }

  if (dueDayOfMonth < (currentDayOfMonth ?? 1)) {
    return "passed";
  }

  if (dueDayOfMonth === currentDayOfMonth) {
    return "due-today";
  }

  return "upcoming";
}

export async function getDashboardMonthData(month: string): Promise<DashboardMonthData> {
  const userId = await getUserIdOrThrow();
  const referenceDate = getTodayLocalDate();
  const forecastMonthContext = buildForecastMonthContext({
    selectedMonth: month,
    referenceDate,
  });
  const { start, endExclusive } = getMonthRange(month);
  const earliestHistoryMonth =
    forecastMonthContext.trailingFullMonths[0] ?? forecastMonthContext.selectedMonth;
  const historyStart = getMonthRange(earliestHistoryMonth).start;

  const [
    incomeAggregate,
    expenseAggregate,
    recentTransactions,
    forecastTransactions,
    plannedBills,
    user,
  ] = await Promise.all([
    db.transaction.aggregate({
      where: {
        userId,
        type: "INCOME",
        localDate: {
          gte: start,
          lt: endExclusive,
        },
      },
      _sum: {
        amount: true,
      },
    }),
    db.transaction.aggregate({
      where: {
        userId,
        type: "EXPENSE",
        localDate: {
          gte: start,
          lt: endExclusive,
        },
      },
      _sum: {
        amount: true,
      },
    }),
    db.transaction.findMany({
      where: {
        userId,
        localDate: {
          gte: start,
          lt: endExclusive,
        },
      },
      include: {
        category: {
          select: {
            name: true,
            type: true,
          },
        },
      },
      orderBy: [{ localDate: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
    db.transaction.findMany({
      where: {
        userId,
        localDate: {
          gte: historyStart,
          lt: endExclusive,
        },
      },
      select: {
        type: true,
        amount: true,
        localDate: true,
        categoryId: true,
      },
    }),
    db.plannedBill.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: [{ dueDayOfMonth: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        amount: true,
        dueDayOfMonth: true,
        categoryId: true,
        isActive: true,
        category: {
          select: {
            name: true,
            isArchived: true,
          },
        },
      },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    }),
  ]);

  const incomeSum = incomeAggregate._sum.amount ?? new Prisma.Decimal(0);
  const expenseSum = expenseAggregate._sum.amount ?? new Prisma.Decimal(0);
  const forecast = computeForecastSummary({
    selectedMonth: month,
    referenceDate,
    transactions: forecastTransactions,
    plannedBills,
  });

  return {
    month,
    currency: user?.currency ?? "USD",
    incomeSum,
    expenseSum,
    netLeft: incomeSum.minus(expenseSum),
    forecast,
    plannedBills: plannedBills.map((plannedBill) => ({
      id: plannedBill.id,
      name: plannedBill.name,
      amount: plannedBill.amount,
      dueDayOfMonth: plannedBill.dueDayOfMonth,
      status: getPlannedBillStatus(
        forecast.monthContext.monthRelation,
        forecast.monthContext.currentDayOfMonth,
        plannedBill.dueDayOfMonth,
      ),
      category: {
        name: plannedBill.category.name,
        isArchived: plannedBill.category.isArchived,
      },
    })),
    recentTransactions: recentTransactions.map((transaction) => ({
      id: transaction.id,
      localDate: transaction.localDate,
      type: transaction.type,
      amount: transaction.amount,
      source: transaction.source,
      note: transaction.note,
      category: {
        name: transaction.category.name,
        type: transaction.category.type,
      },
    })),
  };
}
