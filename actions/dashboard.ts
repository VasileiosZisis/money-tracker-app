import { Prisma } from "@/generated/prisma/client";

import { getUserIdOrThrow } from "@/lib/auth/session";
import {
  computeTotalBalanceSummary,
  findEarliestCompletedActivityMonth,
  getLatestCompletedMonth,
  resolveBalancePeriod,
  type BalancePeriod,
  type TotalBalanceSummary,
} from "@/lib/balance";
import { getMonthRange } from "@/lib/dates/month";
import {
  buildSpendingByCategory,
  type DashboardSpendingCategory,
} from "@/lib/dashboard/spending-by-category";
import { db } from "@/lib/db";
import {
  buildForecastMonthContext,
  computeForecastSummary,
  getTodayLocalDate,
  type ForecastMonthRelation,
  type ForecastSummary,
} from "@/lib/forecast";
import type { SearchParamsShape } from "@/lib/routes/search-params";
import {
  createBalanceRangeQuerySchema,
  type BalancePeriodMode,
  type BalanceRangePreset,
  type BalanceRangeQuery,
} from "@/lib/validators/balance-adjustment";

export type DashboardPlannedBillStatus =
  | "paid"
  | "skipped"
  | "upcoming"
  | "due-today"
  | "overdue"
  | "passed";

export type DashboardPlannedIncomeStatus =
  | "received"
  | "skipped"
  | "upcoming"
  | "due-today"
  | "overdue"
  | "passed";

export type DashboardAttentionItemType =
  | "OVERDUE_PLANNED_BILL"
  | "OVERDUE_PLANNED_INCOME"
  | "DUE_TODAY_PLANNED_BILL"
  | "DUE_TODAY_PLANNED_INCOME"
  | "NEGATIVE_SAFE_TO_SPEND"
  | "NEGATIVE_SAFE_TO_SPEND_WITH_PENDING_INCOME"
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
  categoryId: string;
  subcategoryId: string | null;
  dueDayOfMonth: number;
  status: DashboardPlannedBillStatus;
  defaultPaymentLocalDate: string;
  occurrence: {
    id: string;
    status: "PAID" | "SKIPPED";
    paidAtLocalDate: string | null;
    transactionId: string | null;
    paymentSource: "GENERATED" | "LINKED" | null;
  } | null;
  category: {
    name: string;
    isArchived: boolean;
  };
  subcategory: {
    id: string;
    name: string;
  } | null;
  linkCandidates: DashboardPlannedBillLinkCandidate[];
};

type DashboardPlannedBillLinkCandidate = {
  id: string;
  localDate: string;
  amount: Prisma.Decimal;
  source: string | null;
  note: string | null;
  categoryId: string;
  subcategoryId: string | null;
  category: {
    name: string;
  };
  subcategory: {
    name: string;
  } | null;
};

type DashboardPlannedIncome = {
  id: string;
  name: string;
  amount: Prisma.Decimal;
  categoryId: string;
  subcategoryId: string | null;
  expectedDayOfMonth: number;
  status: DashboardPlannedIncomeStatus;
  defaultReceivedLocalDate: string;
  occurrence: {
    id: string;
    status: "RECEIVED" | "SKIPPED";
    receivedAtLocalDate: string | null;
    transactionId: string | null;
    paymentSource: "GENERATED" | "LINKED" | null;
  } | null;
  category: {
    name: string;
    isArchived: boolean;
  };
  subcategory: {
    id: string;
    name: string;
  } | null;
  linkCandidates: DashboardPlannedIncomeLinkCandidate[];
};

type DashboardPlannedIncomeLinkCandidate = {
  id: string;
  localDate: string;
  amount: Prisma.Decimal;
  source: string | null;
  note: string | null;
  categoryId: string;
  subcategoryId: string | null;
  category: {
    name: string;
  };
  subcategory: {
    name: string;
  } | null;
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
  spendingByCategory: DashboardSpendingCategory[];
  forecast: ForecastSummary;
  attentionItems: DashboardAttentionItem[];
  latestTransactionEntry: {
    createdAt: Date;
  } | null;
  plannedBills: DashboardPlannedBill[];
  plannedIncomes: DashboardPlannedIncome[];
  plannedIncomeSummary: {
    pendingTotal: Prisma.Decimal;
    receivedTotal: Prisma.Decimal;
    skippedCount: number;
    pendingCount: number;
    nextPendingIncome: {
      name: string;
      amount: Prisma.Decimal;
      expectedDayOfMonth: number;
      status: "upcoming" | "due-today" | "overdue";
    } | null;
  };
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
    subcategory: {
      name: string;
    } | null;
  }>;
};

export type DashboardBalanceQueryParams = {
  balanceRange: BalanceRangePreset;
  balanceMode?: BalancePeriodMode;
  balanceStart?: string;
  balanceEnd?: string;
};

export type DashboardTotalBalanceEmptyReason =
  | "NO_COMPLETED_HISTORY"
  | "NO_COMPLETED_PERIOD";

export type DashboardBalanceAdjustment = {
  id: string;
  amount: string;
  effectiveMonth: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DashboardTotalBalanceData = {
  selection: BalanceRangeQuery;
  queryParams: DashboardBalanceQueryParams;
  adjustments: DashboardBalanceAdjustment[];
  period: BalancePeriod | null;
  summary: TotalBalanceSummary | null;
  earliestActivityMonth: string | null;
  latestCompletedMonth: string;
  validationError: string | null;
  emptyReason: DashboardTotalBalanceEmptyReason | null;
};

export type DashboardData = {
  monthData: DashboardMonthData;
  totalBalance: DashboardTotalBalanceData;
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

function getPlannedIncomeStatus(
  monthRelation: ForecastMonthRelation,
  currentDayOfMonth: number | null,
  expectedDayOfMonth: number,
  occurrenceStatus?: "RECEIVED" | "SKIPPED" | null,
): DashboardPlannedIncomeStatus {
  if (occurrenceStatus === "RECEIVED") {
    return "received";
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

  if (expectedDayOfMonth < (currentDayOfMonth ?? 1)) {
    return "overdue";
  }

  if (expectedDayOfMonth === currentDayOfMonth) {
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

function getDefaultReceivedLocalDate(params: {
  selectedMonth: string;
  monthRelation: ForecastMonthRelation;
  referenceDate: string;
  expectedDayOfMonth: number;
}) {
  if (params.monthRelation === "current") {
    return params.referenceDate;
  }

  return `${params.selectedMonth}-${params.expectedDayOfMonth
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
  plannedIncomes: DashboardPlannedIncome[];
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

  if (isCurrentMonth) {
    for (const plannedIncome of params.plannedIncomes) {
      if (plannedIncome.status !== "overdue") {
        continue;
      }

      attentionItems.push({
        type: "OVERDUE_PLANNED_INCOME",
        title: `${plannedIncome.name} is overdue`,
        description: `Expected day ${plannedIncome.expectedDayOfMonth} · ${formatDashboardMoney(
          params.currency,
          plannedIncome.amount,
        )} still pending`,
        tone: "danger",
      });
    }
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

  if (isCurrentMonth) {
    for (const plannedIncome of params.plannedIncomes) {
      if (plannedIncome.status !== "due-today") {
        continue;
      }

      attentionItems.push({
        type: "DUE_TODAY_PLANNED_INCOME",
        title: `${plannedIncome.name} is expected today`,
        description: `${formatDashboardMoney(params.currency, plannedIncome.amount)} pending`,
        tone: "warning",
      });
    }
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

  if (
    isCurrentMonth &&
    params.forecast.safeToSpend.lt(0) &&
    params.forecast.pendingPlannedIncome.gt(0)
  ) {
    attentionItems.push({
      type: "NEGATIVE_SAFE_TO_SPEND_WITH_PENDING_INCOME",
      title: "Safe to spend is negative before pending income",
      description: `${formatDashboardMoney(
        params.currency,
        params.forecast.pendingPlannedIncome,
      )} is still expected, but not counted as safe to spend until received.`,
      tone: "warning",
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

function sumDashboardAmounts<T extends { amount: Prisma.Decimal }>(items: readonly T[]) {
  return items.reduce(
    (total, item) => total.plus(item.amount),
    new Prisma.Decimal(0),
  );
}

function buildPlannedIncomeSummary(plannedIncomes: DashboardPlannedIncome[]) {
  const pendingIncomes = plannedIncomes.filter(
    (
      plannedIncome,
    ): plannedIncome is DashboardPlannedIncome & {
      status: "upcoming" | "due-today" | "overdue";
    } =>
      plannedIncome.status === "upcoming" ||
      plannedIncome.status === "due-today" ||
      plannedIncome.status === "overdue",
  );
  const receivedIncomes = plannedIncomes.filter(
    (plannedIncome) => plannedIncome.status === "received",
  );
  const skippedIncomes = plannedIncomes.filter(
    (plannedIncome) => plannedIncome.status === "skipped",
  );

  const nextPendingIncome = pendingIncomes[0]
    ? {
        name: pendingIncomes[0].name,
        amount: pendingIncomes[0].amount,
        expectedDayOfMonth: pendingIncomes[0].expectedDayOfMonth,
        status: pendingIncomes[0].status,
      }
    : null;

  return {
    pendingTotal: sumDashboardAmounts(pendingIncomes),
    receivedTotal: sumDashboardAmounts(receivedIncomes),
    skippedCount: skippedIncomes.length,
    pendingCount: pendingIncomes.length,
    nextPendingIncome,
  };
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

function getBalanceQueryParams(
  selection: BalanceRangeQuery,
): DashboardBalanceQueryParams {
  if (selection.balanceRange !== "custom") {
    return { balanceRange: selection.balanceRange };
  }

  return {
    balanceRange: selection.balanceRange,
    balanceMode: selection.balanceMode,
    balanceStart: selection.balanceStart,
    balanceEnd: selection.balanceEnd,
  };
}

async function loadDashboardTotalBalanceData(params: {
  userId: string;
  referenceDate: string;
  searchParams: SearchParamsShape;
}): Promise<DashboardTotalBalanceData> {
  const rangeSchema = createBalanceRangeQuerySchema(params.referenceDate);
  const parsedRange = rangeSchema.safeParse(params.searchParams);
  const selection = parsedRange.success ? parsedRange.data : rangeSchema.parse({});
  const validationError = parsedRange.success
    ? null
    : (parsedRange.error.issues[0]?.message ?? "Invalid Total Balance period.");
  const latestCompletedMonth = getLatestCompletedMonth(params.referenceDate);
  const currentMonthStart = `${params.referenceDate.slice(0, 7)}-01`;

  const [earliestTransaction, earliestAdjustment, adjustmentList] =
    await Promise.all([
      db.transaction.findFirst({
        where: {
          userId: params.userId,
          localDate: {
            lt: currentMonthStart,
          },
        },
        select: {
          type: true,
          amount: true,
          localDate: true,
        },
        orderBy: {
          localDate: "asc",
        },
      }),
      db.balanceAdjustment.findFirst({
        where: {
          userId: params.userId,
          effectiveMonth: {
            lte: latestCompletedMonth,
          },
        },
        select: {
          amount: true,
          effectiveMonth: true,
        },
        orderBy: {
          effectiveMonth: "asc",
        },
      }),
      db.balanceAdjustment.findMany({
        where: {
          userId: params.userId,
        },
        select: {
          id: true,
          amount: true,
          effectiveMonth: true,
          note: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ effectiveMonth: "desc" }, { createdAt: "desc" }],
      }),
    ]);

  const earliestActivityMonth = findEarliestCompletedActivityMonth({
    referenceDate: params.referenceDate,
    transactions: earliestTransaction ? [earliestTransaction] : [],
    adjustments: earliestAdjustment ? [earliestAdjustment] : [],
  });
  const period = resolveBalancePeriod({
    selection,
    referenceDate: params.referenceDate,
    earliestActivityMonth,
  });
  const baseResult = {
    selection,
    queryParams: getBalanceQueryParams(selection),
    adjustments: adjustmentList.map((adjustment) => ({
      ...adjustment,
      amount: adjustment.amount.toString(),
    })),
    period,
    earliestActivityMonth,
    latestCompletedMonth,
    validationError,
  };

  if (!earliestActivityMonth) {
    return {
      ...baseResult,
      summary: null,
      emptyReason: "NO_COMPLETED_HISTORY",
    };
  }

  if (!period) {
    return {
      ...baseResult,
      summary: null,
      emptyReason: "NO_COMPLETED_PERIOD",
    };
  }

  const periodEndExclusive = getMonthRange(period.endMonth).endExclusive;
  const [transactions, adjustments] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId: params.userId,
        localDate: {
          lt: periodEndExclusive,
        },
      },
      select: {
        type: true,
        amount: true,
        localDate: true,
      },
    }),
    db.balanceAdjustment.findMany({
      where: {
        userId: params.userId,
        effectiveMonth: {
          lte: period.endMonth,
        },
      },
      select: {
        amount: true,
        effectiveMonth: true,
      },
    }),
  ]);

  return {
    ...baseResult,
    summary: computeTotalBalanceSummary({
      period,
      transactions,
      adjustments,
    }),
    emptyReason: null,
  };
}

async function loadDashboardMonthData(
  month: string,
  userId: string,
  referenceDate: string,
): Promise<DashboardMonthData> {
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
    plannedIncomes,
    linkCandidateTransactions,
    plannedIncomeLinkCandidateTransactions,
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
        subcategory: {
          select: {
            name: true,
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
        categoryId: true,
        subcategoryId: true,
        category: {
          select: {
            name: true,
          },
        },
        subcategory: {
          select: {
            name: true,
          },
        },
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
        subcategoryId: true,
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
            paymentSource: true,
          },
          take: 1,
        },
        category: {
          select: {
            name: true,
            isArchived: true,
          },
        },
        subcategory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    db.plannedIncome.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: [{ expectedDayOfMonth: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        amount: true,
        expectedDayOfMonth: true,
        categoryId: true,
        subcategoryId: true,
        isActive: true,
        occurrences: {
          where: {
            month,
          },
          select: {
            id: true,
            status: true,
            receivedAtLocalDate: true,
            transactionId: true,
            paymentSource: true,
          },
          take: 1,
        },
        category: {
          select: {
            name: true,
            isArchived: true,
          },
        },
        subcategory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    db.transaction.findMany({
      where: {
        userId,
        type: "EXPENSE",
        localDate: {
          gte: start,
          lt: endExclusive,
        },
        plannedBillOccurrence: null,
      },
      select: {
        id: true,
        localDate: true,
        amount: true,
        source: true,
        note: true,
        categoryId: true,
        subcategoryId: true,
        category: {
          select: {
            name: true,
          },
        },
        subcategory: {
          select: {
            name: true,
          },
        },
      },
    }),
    db.transaction.findMany({
      where: {
        userId,
        type: "INCOME",
        localDate: {
          gte: start,
          lt: endExclusive,
        },
        plannedIncomeOccurrence: null,
      },
      select: {
        id: true,
        localDate: true,
        amount: true,
        source: true,
        note: true,
        categoryId: true,
        subcategoryId: true,
        category: {
          select: {
            name: true,
          },
        },
        subcategory: {
          select: {
            name: true,
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
  const forecastPlannedIncomes = plannedIncomes.map((plannedIncome) => ({
    amount: plannedIncome.amount,
    expectedDayOfMonth: plannedIncome.expectedDayOfMonth,
    categoryId: plannedIncome.categoryId,
    isActive: plannedIncome.isActive,
    occurrenceStatus: plannedIncome.occurrences[0]?.status ?? null,
  }));
  const forecast = computeForecastSummary({
    selectedMonth: month,
    referenceDate,
    transactions: forecastTransactions,
    plannedBills: forecastPlannedBills,
    plannedIncomes: forecastPlannedIncomes,
  });
  const { chartSeries, chartYAxisMax } = buildChartSeries({
    monthContext: forecast.monthContext,
    incomeSum,
    transactions: monthlyChartTransactions,
  });
  const spendingByCategory = buildSpendingByCategory(monthlyChartTransactions);
  const currency = user?.currency ?? "USD";
  const getLinkCandidatesForPlannedBill = (plannedBill: {
    amount: Prisma.Decimal;
    categoryId: string;
    subcategoryId: string | null;
  }) =>
    [...linkCandidateTransactions].sort((left, right) => {
      const leftSameCategory = left.categoryId === plannedBill.categoryId ? 1 : 0;
      const rightSameCategory = right.categoryId === plannedBill.categoryId ? 1 : 0;

      if (leftSameCategory !== rightSameCategory) {
        return rightSameCategory - leftSameCategory;
      }

      const leftSameSubcategory =
        plannedBill.subcategoryId && left.subcategoryId === plannedBill.subcategoryId ? 1 : 0;
      const rightSameSubcategory =
        plannedBill.subcategoryId && right.subcategoryId === plannedBill.subcategoryId ? 1 : 0;

      if (leftSameSubcategory !== rightSameSubcategory) {
        return rightSameSubcategory - leftSameSubcategory;
      }

      const leftSameAmount = left.amount.eq(plannedBill.amount) ? 1 : 0;
      const rightSameAmount = right.amount.eq(plannedBill.amount) ? 1 : 0;

      if (leftSameAmount !== rightSameAmount) {
        return rightSameAmount - leftSameAmount;
      }

      return right.localDate.localeCompare(left.localDate);
    });
  const getLinkCandidatesForPlannedIncome = (plannedIncome: {
    amount: Prisma.Decimal;
    categoryId: string;
    subcategoryId: string | null;
  }) =>
    [...plannedIncomeLinkCandidateTransactions].sort((left, right) => {
      const leftSameCategory = left.categoryId === plannedIncome.categoryId ? 1 : 0;
      const rightSameCategory = right.categoryId === plannedIncome.categoryId ? 1 : 0;

      if (leftSameCategory !== rightSameCategory) {
        return rightSameCategory - leftSameCategory;
      }

      const leftSameSubcategory =
        plannedIncome.subcategoryId && left.subcategoryId === plannedIncome.subcategoryId ? 1 : 0;
      const rightSameSubcategory =
        plannedIncome.subcategoryId && right.subcategoryId === plannedIncome.subcategoryId ? 1 : 0;

      if (leftSameSubcategory !== rightSameSubcategory) {
        return rightSameSubcategory - leftSameSubcategory;
      }

      const leftSameAmount = left.amount.eq(plannedIncome.amount) ? 1 : 0;
      const rightSameAmount = right.amount.eq(plannedIncome.amount) ? 1 : 0;

      if (leftSameAmount !== rightSameAmount) {
        return rightSameAmount - leftSameAmount;
      }

      return right.localDate.localeCompare(left.localDate);
    });
  const dashboardPlannedBills = plannedBills.map((plannedBill) => ({
    id: plannedBill.id,
    name: plannedBill.name,
    amount: plannedBill.amount,
    categoryId: plannedBill.categoryId,
    subcategoryId: plannedBill.subcategoryId,
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
          paymentSource: plannedBill.occurrences[0].paymentSource,
        }
      : null,
    category: {
      name: plannedBill.category.name,
      isArchived: plannedBill.category.isArchived,
    },
    subcategory: plannedBill.subcategory,
    linkCandidates: getLinkCandidatesForPlannedBill(plannedBill),
  }));
  const dashboardPlannedIncomes = plannedIncomes.map((plannedIncome) => ({
    id: plannedIncome.id,
    name: plannedIncome.name,
    amount: plannedIncome.amount,
    categoryId: plannedIncome.categoryId,
    subcategoryId: plannedIncome.subcategoryId,
    expectedDayOfMonth: plannedIncome.expectedDayOfMonth,
    status: getPlannedIncomeStatus(
      forecast.monthContext.monthRelation,
      forecast.monthContext.currentDayOfMonth,
      plannedIncome.expectedDayOfMonth,
      plannedIncome.occurrences[0]?.status ?? null,
    ),
    defaultReceivedLocalDate: getDefaultReceivedLocalDate({
      selectedMonth: month,
      monthRelation: forecast.monthContext.monthRelation,
      referenceDate,
      expectedDayOfMonth: plannedIncome.expectedDayOfMonth,
    }),
    occurrence: plannedIncome.occurrences[0]
      ? {
          id: plannedIncome.occurrences[0].id,
          status: plannedIncome.occurrences[0].status,
          receivedAtLocalDate: plannedIncome.occurrences[0].receivedAtLocalDate,
          transactionId: plannedIncome.occurrences[0].transactionId,
          paymentSource: plannedIncome.occurrences[0].paymentSource,
        }
      : null,
    category: {
      name: plannedIncome.category.name,
      isArchived: plannedIncome.category.isArchived,
    },
    subcategory: plannedIncome.subcategory,
    linkCandidates: getLinkCandidatesForPlannedIncome(plannedIncome),
  }));
  const plannedIncomeSummary = buildPlannedIncomeSummary(dashboardPlannedIncomes);

  return {
    month,
    currency,
    incomeSum,
    expenseSum,
    netLeft: incomeSum.minus(expenseSum),
    chartSeries,
    chartYAxisMax,
    spendingByCategory,
    forecast,
    attentionItems: buildAttentionItems({
      currency,
      forecast,
      plannedBills: dashboardPlannedBills,
      plannedIncomes: dashboardPlannedIncomes,
      latestTransactionEntry,
    }),
    latestTransactionEntry,
    plannedBills: dashboardPlannedBills,
    plannedIncomes: dashboardPlannedIncomes,
    plannedIncomeSummary,
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
      subcategory: transaction.subcategory
        ? {
            name: transaction.subcategory.name,
          }
        : null,
    })),
  };
}

export async function getDashboardMonthData(
  month: string,
): Promise<DashboardMonthData> {
  const userId = await getUserIdOrThrow();
  const referenceDate = getTodayLocalDate();

  return loadDashboardMonthData(month, userId, referenceDate);
}

export async function getDashboardData(
  month: string,
  searchParams: SearchParamsShape,
): Promise<DashboardData> {
  const userId = await getUserIdOrThrow();
  const referenceDate = getTodayLocalDate();
  const [monthData, totalBalance] = await Promise.all([
    loadDashboardMonthData(month, userId, referenceDate),
    loadDashboardTotalBalanceData({
      userId,
      referenceDate,
      searchParams,
    }),
  ]);

  return { monthData, totalBalance };
}
