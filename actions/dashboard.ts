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
  chartSeries: Array<{
    day: number;
    label: string;
    income: number;
    expense: number | null;
  }>;
  chartYAxisMax: number;
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

function buildChartSeries(params: {
  monthContext: ForecastSummary["monthContext"];
  incomeSum: Prisma.Decimal;
  transactions: Array<{
    type: "INCOME" | "EXPENSE";
    amount: Prisma.Decimal;
    localDate: string;
  }>;
}) {
  const { monthContext, incomeSum, transactions } = params;

  if (monthContext.monthRelation === "future") {
    return {
      chartSeries: Array.from({ length: monthContext.daysInMonth }, (_, index) => ({
        day: index + 1,
        label: String(index + 1),
        income: 0,
        expense: 0,
      })),
      chartYAxisMax: 1,
    };
  }

  const incomeByDay = Array.from(
    { length: monthContext.daysInMonth },
    () => new Prisma.Decimal(0),
  );
  const expenseByDay = Array.from(
    { length: monthContext.daysInMonth },
    () => new Prisma.Decimal(0),
  );

  for (const transaction of transactions) {
    const dayIndex = Number(transaction.localDate.slice(8, 10)) - 1;

    if (dayIndex < 0 || dayIndex >= monthContext.daysInMonth) {
      continue;
    }

    if (transaction.type === "INCOME") {
      incomeByDay[dayIndex] = incomeByDay[dayIndex].plus(transaction.amount);
      continue;
    }

    expenseByDay[dayIndex] = expenseByDay[dayIndex].plus(transaction.amount);
  }

  let cumulativeIncome = new Prisma.Decimal(0);
  let cumulativeExpense = new Prisma.Decimal(0);
  const expenseStopDay =
    monthContext.monthRelation === "current"
      ? (monthContext.currentDayOfMonth ?? 0)
      : monthContext.daysInMonth;

  const chartSeries = Array.from({ length: monthContext.daysInMonth }, (_, index) => {
    const day = index + 1;

    cumulativeIncome = cumulativeIncome.plus(incomeByDay[index]);

    const shouldIncludeExpense = day <= expenseStopDay;

    if (shouldIncludeExpense) {
      cumulativeExpense = cumulativeExpense.plus(expenseByDay[index]);
    }

    return {
      day,
      label: String(day),
      income: Number(cumulativeIncome.toString()),
      expense: shouldIncludeExpense ? Number(cumulativeExpense.toString()) : null,
    };
  });

  const maxExpenseValue = chartSeries.reduce((maxValue, point) => {
    const expenseValue = point.expense ?? 0;
    return Math.max(maxValue, expenseValue);
  }, 0);
  const incomeCeiling = Number(incomeSum.mul(new Prisma.Decimal(1.1)).toString());

  return {
    chartSeries,
    chartYAxisMax: Math.max(1, incomeCeiling, maxExpenseValue),
  };
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
    monthlyChartTransactions,
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
      take: 5,
    }),
    db.transaction.findMany({
      where: {
        userId,
        localDate: {
          gte: start,
          lt: endExclusive,
        },
      },
      select: {
        type: true,
        amount: true,
        localDate: true,
      },
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
  const { chartSeries, chartYAxisMax } = buildChartSeries({
    monthContext: forecast.monthContext,
    incomeSum,
    transactions: monthlyChartTransactions,
  });

  return {
    month,
    currency: user?.currency ?? "USD",
    incomeSum,
    expenseSum,
    netLeft: incomeSum.minus(expenseSum),
    chartSeries,
    chartYAxisMax,
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
