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

export type DashboardPlannedBillStatus =
  | "paid"
  | "skipped"
  | "upcoming"
  | "due-today"
  | "overdue"
  | "passed";

export type DashboardAttentionItemType =
  | "OVERDUE_PLANNED_BILL"
  | "DUE_TODAY_PLANNED_BILL"
  | "NEGATIVE_SAFE_TO_SPEND"
  | "STALE_TRANSACTIONS"
  | "LOW_FORECAST_CONFIDENCE";

export type DashboardAttentionItemTone = "danger" | "warning" | "info" | "success";

export type DashboardAttentionItem = {
  type: DashboardAttentionItemType;
  title: string;
  description: string;
  tone: DashboardAttentionItemTone;
};

type DashboardPlannedBill = {
  id: string;
  name: string;
  amount: Prisma.Decimal;
  dueDayOfMonth: number;
  status: DashboardPlannedBillStatus;
  defaultPaymentLocalDate: string;
  occurrence: {
    id: string;
    status: "PAID" | "SKIPPED";
    paidAtLocalDate: string | null;
    transactionId: string | null;
  } | null;
  category: {
    name: string;
    isArchived: boolean;
  };
};

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
  attentionItems: DashboardAttentionItem[];
  latestTransactionEntry: {
    createdAt: Date;
  } | null;
  plannedBills: DashboardPlannedBill[];
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

const ATTENTION_ITEM_LIMIT = 5;
const STALE_TRANSACTION_DAYS = 3;
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

function getPlannedBillStatus(
  monthRelation: ForecastMonthRelation,
  currentDayOfMonth: number | null,
  dueDayOfMonth: number,
  occurrenceStatus?: "PAID" | "SKIPPED" | null,
): DashboardPlannedBillStatus {
  if (occurrenceStatus === "PAID") {
    return "paid";
  }

  if (occurrenceStatus === "SKIPPED") {
    return "skipped";
  }

  if (monthRelation === "past") {
    return "passed";
  }

  if (monthRelation === "future") {
    return "upcoming";
  }

  if (dueDayOfMonth < (currentDayOfMonth ?? 1)) {
    return "overdue";
  }

  if (dueDayOfMonth === currentDayOfMonth) {
    return "due-today";
  }

  return "upcoming";
}

function getDefaultPaymentLocalDate(params: {
  selectedMonth: string;
  monthRelation: ForecastMonthRelation;
  referenceDate: string;
  dueDayOfMonth: number;
}) {
  if (params.monthRelation === "current") {
    return params.referenceDate;
  }

  return `${params.selectedMonth}-${params.dueDayOfMonth
    .toString()
    .padStart(2, "0")}`;
}

function formatDashboardMoney(currency: string, amount: Prisma.Decimal) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(Number(amount.toString()));
}

function getDaysSinceDate(date: Date, now = new Date()) {
  return Math.floor((now.getTime() - date.getTime()) / ONE_DAY_IN_MS);
}

function buildAttentionItems(params: {
  currency: string;
  forecast: ForecastSummary;
  plannedBills: DashboardPlannedBill[];
  latestTransactionEntry: { createdAt: Date } | null;
}): DashboardAttentionItem[] {
  const attentionItems: DashboardAttentionItem[] = [];
  const isCurrentMonth = params.forecast.monthContext.monthRelation === "current";

  for (const plannedBill of params.plannedBills) {
    if (plannedBill.status !== "overdue") {
      continue;
    }

    attentionItems.push({
      type: "OVERDUE_PLANNED_BILL",
      title: `${plannedBill.name} is overdue`,
      description: `Due day ${plannedBill.dueDayOfMonth} · ${formatDashboardMoney(
        params.currency,
        plannedBill.amount,
      )} still reserved`,
      tone: "danger",
    });
  }

  for (const plannedBill of params.plannedBills) {
    if (plannedBill.status !== "due-today") {
      continue;
    }

    attentionItems.push({
      type: "DUE_TODAY_PLANNED_BILL",
      title: `${plannedBill.name} is due today`,
      description: `${formatDashboardMoney(params.currency, plannedBill.amount)} reserved`,
      tone: "warning",
    });
  }

  if (isCurrentMonth && params.forecast.safeToSpend.lt(0)) {
    attentionItems.push({
      type: "NEGATIVE_SAFE_TO_SPEND",
      title: "Safe to spend is negative",
      description: `Forecast is ${formatDashboardMoney(
        params.currency,
        params.forecast.safeToSpend.abs(),
      )} above current recorded income.`,
      tone: "danger",
    });
  }

  if (isCurrentMonth) {
    if (!params.latestTransactionEntry) {
      attentionItems.push({
        type: "STALE_TRANSACTIONS",
        title: "No transactions entered yet",
        description:
          "Manual data may be incomplete until current income or expenses are recorded.",
        tone: "warning",
      });
    } else {
      const daysSinceLatestEntry = getDaysSinceDate(params.latestTransactionEntry.createdAt);

      if (daysSinceLatestEntry >= STALE_TRANSACTION_DAYS) {
        attentionItems.push({
          type: "STALE_TRANSACTIONS",
          title: `No transactions entered in ${daysSinceLatestEntry} days`,
          description:
            "Forecast may be less accurate if recent manual spending is missing.",
          tone: "warning",
        });
      }
    }
  }

  if (
    isCurrentMonth &&
    params.forecast.variableForecastSource !== "trailing-history"
  ) {
    attentionItems.push({
      type: "LOW_FORECAST_CONFIDENCE",
      title: "Forecast confidence is lower",
      description:
        "There is limited recent history, so variable spend uses a fallback.",
      tone: "warning",
    });
  }

  return attentionItems.slice(0, ATTENTION_ITEM_LIMIT);
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
    latestTransactionEntry,
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
        occurrences: {
          where: {
            month,
          },
          select: {
            id: true,
            status: true,
            paidAtLocalDate: true,
            transactionId: true,
          },
          take: 1,
        },
        category: {
          select: {
            name: true,
            isArchived: true,
          },
        },
      },
    }),
    db.transaction.findFirst({
      where: {
        userId,
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    }),
  ]);

  const incomeSum = incomeAggregate._sum.amount ?? new Prisma.Decimal(0);
  const expenseSum = expenseAggregate._sum.amount ?? new Prisma.Decimal(0);
  const forecastPlannedBills = plannedBills.map((plannedBill) => ({
    amount: plannedBill.amount,
    dueDayOfMonth: plannedBill.dueDayOfMonth,
    categoryId: plannedBill.categoryId,
    isActive: plannedBill.isActive,
    occurrenceStatus: plannedBill.occurrences[0]?.status ?? null,
  }));
  const forecast = computeForecastSummary({
    selectedMonth: month,
    referenceDate,
    transactions: forecastTransactions,
    plannedBills: forecastPlannedBills,
  });
  const { chartSeries, chartYAxisMax } = buildChartSeries({
    monthContext: forecast.monthContext,
    incomeSum,
    transactions: monthlyChartTransactions,
  });
  const currency = user?.currency ?? "USD";
  const dashboardPlannedBills = plannedBills.map((plannedBill) => ({
    id: plannedBill.id,
    name: plannedBill.name,
    amount: plannedBill.amount,
    dueDayOfMonth: plannedBill.dueDayOfMonth,
    status: getPlannedBillStatus(
      forecast.monthContext.monthRelation,
      forecast.monthContext.currentDayOfMonth,
      plannedBill.dueDayOfMonth,
      plannedBill.occurrences[0]?.status ?? null,
    ),
    defaultPaymentLocalDate: getDefaultPaymentLocalDate({
      selectedMonth: month,
      monthRelation: forecast.monthContext.monthRelation,
      referenceDate,
      dueDayOfMonth: plannedBill.dueDayOfMonth,
    }),
    occurrence: plannedBill.occurrences[0]
      ? {
          id: plannedBill.occurrences[0].id,
          status: plannedBill.occurrences[0].status,
          paidAtLocalDate: plannedBill.occurrences[0].paidAtLocalDate,
          transactionId: plannedBill.occurrences[0].transactionId,
        }
      : null,
    category: {
      name: plannedBill.category.name,
      isArchived: plannedBill.category.isArchived,
    },
  }));

  return {
    month,
    currency,
    incomeSum,
    expenseSum,
    netLeft: incomeSum.minus(expenseSum),
    chartSeries,
    chartYAxisMax,
    forecast,
    attentionItems: buildAttentionItems({
      currency,
      forecast,
      plannedBills: dashboardPlannedBills,
      latestTransactionEntry,
    }),
    latestTransactionEntry,
    plannedBills: dashboardPlannedBills,
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
