import { Prisma } from "@/generated/prisma/client";

import { listInclusiveMonths, shiftMonthKey } from "@/lib/balance/months";

export type InsightsPeriod = 3 | 6 | 12;

export type SpendingInsightTransaction = {
  type: "INCOME" | "EXPENSE";
  amount: Prisma.Decimal;
  localDate: string;
  categoryId: string;
};

export type SpendingInsightMonth = {
  month: string;
  categorySpending: string;
  totalExpenses: string;
  actualNet: string;
  isCurrentMonth: boolean;
};

export type SpendingInsight = {
  months: SpendingInsightMonth[];
  typicalSpending: string | null;
  currentMonthSpending: string;
  differenceFromTypical: string | null;
  completedMonthCount: number;
  hasLimitedHistory: boolean;
  hasCategorySpending: boolean;
};

export type SpendingCompositionCategory = {
  categoryId: string;
  categoryName: string;
  isArchived: boolean;
  total: string;
  sharePercent: number;
};

export type SpendingCompositionInsight = {
  totalExpenses: string;
  categories: SpendingCompositionCategory[];
};

export type SpendingCompositionCategorySource = {
  id: string;
  name: string;
  isArchived: boolean;
};

export type MonthlyResultMonth = {
  month: string;
  totalIncome: string;
  totalExpenses: string;
  result: string;
  isCurrentMonth: boolean;
};

export type MonthlyResultInsight = {
  months: MonthlyResultMonth[];
  typicalMonthlyResult: string | null;
  breakEvenGap: string | null;
  positiveMonthCount: number;
  negativeMonthCount: number;
  breakEvenMonthCount: number;
  completedMonthCount: number;
  hasLimitedHistory: boolean;
};

type DecimalMonth = {
  month: string;
  categorySpending: Prisma.Decimal;
  totalIncome: Prisma.Decimal;
  totalExpenses: Prisma.Decimal;
};

function moneyString(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2).toFixed(2);
}

function median(values: Prisma.Decimal[]) {
  if (values.length === 0) {
    return null;
  }

  const ordered = [...values].sort((left, right) => left.comparedTo(right));
  const midpoint = Math.floor(ordered.length / 2);

  if (ordered.length % 2 === 1) {
    return ordered[midpoint] ?? null;
  }

  const lower = ordered[midpoint - 1];
  const upper = ordered[midpoint];

  if (!lower || !upper) {
    return null;
  }

  return lower.plus(upper).dividedBy(2);
}

export function buildSpendingCompositionInsight(params: {
  transactions: SpendingInsightTransaction[];
  categories: SpendingCompositionCategorySource[];
  currentMonth: string;
  period: InsightsPeriod;
}): SpendingCompositionInsight {
  const rangeStart = shiftMonthKey(params.currentMonth, -params.period);
  const categoryById = new Map(
    params.categories.map((category) => [category.id, category]),
  );
  const totalsByCategory = new Map<string, Prisma.Decimal>();

  for (const transaction of params.transactions) {
    const month = transaction.localDate.slice(0, 7);

    if (
      transaction.type !== "EXPENSE" ||
      month < rangeStart ||
      month >= params.currentMonth ||
      !categoryById.has(transaction.categoryId)
    ) {
      continue;
    }

    const currentTotal =
      totalsByCategory.get(transaction.categoryId) ?? new Prisma.Decimal(0);
    totalsByCategory.set(
      transaction.categoryId,
      currentTotal.plus(transaction.amount),
    );
  }

  const totalExpenses = Array.from(totalsByCategory.values()).reduce(
    (total, categoryTotal) => total.plus(categoryTotal),
    new Prisma.Decimal(0),
  );
  const categories = Array.from(totalsByCategory.entries())
    .map(([categoryId, total]) => {
      const category = categoryById.get(categoryId);

      if (!category) {
        return null;
      }

      return {
        categoryId,
        categoryName: category.name,
        isArchived: category.isArchived,
        total,
      };
    })
    .filter((category) => category !== null)
    .sort((left, right) => {
      const amountComparison = right.total.comparedTo(left.total);

      return amountComparison === 0
        ? left.categoryName.localeCompare(right.categoryName)
        : amountComparison;
    })
    .map((category) => ({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      isArchived: category.isArchived,
      total: moneyString(category.total),
      sharePercent: totalExpenses.gt(0)
        ? Number(
            category.total
              .dividedBy(totalExpenses)
              .times(100)
              .toDecimalPlaces(1)
              .toString(),
          )
        : 0,
    }));

  return {
    totalExpenses: moneyString(totalExpenses),
    categories,
  };
}

export function buildMonthlyResultInsight(params: {
  transactions: SpendingInsightTransaction[];
  firstActivityMonth: string | null;
  currentMonth: string;
  period: InsightsPeriod;
}): MonthlyResultInsight {
  const rangeStart = shiftMonthKey(params.currentMonth, -params.period);
  const firstActivityMonth =
    params.firstActivityMonth && params.firstActivityMonth <= params.currentMonth
      ? params.firstActivityMonth
      : null;

  if (!firstActivityMonth) {
    return {
      months: [],
      typicalMonthlyResult: null,
      breakEvenGap: null,
      positiveMonthCount: 0,
      negativeMonthCount: 0,
      breakEvenMonthCount: 0,
      completedMonthCount: 0,
      hasLimitedHistory: true,
    };
  }

  const activityStartMonth =
    firstActivityMonth > rangeStart ? firstActivityMonth : rangeStart;
  const monthKeys = listInclusiveMonths(activityStartMonth, params.currentMonth);
  const monthMap = new Map<string, DecimalMonth>(
    monthKeys.map((month) => [
      month,
      {
        month,
        categorySpending: new Prisma.Decimal(0),
        totalIncome: new Prisma.Decimal(0),
        totalExpenses: new Prisma.Decimal(0),
      },
    ]),
  );

  for (const transaction of params.transactions) {
    const month = transaction.localDate.slice(0, 7);
    const bucket = monthMap.get(month);

    if (!bucket) {
      continue;
    }

    if (transaction.type === "INCOME") {
      bucket.totalIncome = bucket.totalIncome.plus(transaction.amount);
    } else {
      bucket.totalExpenses = bucket.totalExpenses.plus(transaction.amount);
    }
  }

  const decimalMonths = Array.from(monthMap.values());
  const completedMonths = decimalMonths.filter(
    (month) => month.month < params.currentMonth,
  );
  const completedResults = completedMonths.map((month) =>
    month.totalIncome.minus(month.totalExpenses),
  );
  const typicalMonthlyResult = median(completedResults);
  const breakEvenGap = typicalMonthlyResult
    ? typicalMonthlyResult.lt(0)
      ? typicalMonthlyResult.negated()
      : new Prisma.Decimal(0)
    : null;

  return {
    months: decimalMonths.map((month) => ({
      month: month.month,
      totalIncome: moneyString(month.totalIncome),
      totalExpenses: moneyString(month.totalExpenses),
      result: moneyString(month.totalIncome.minus(month.totalExpenses)),
      isCurrentMonth: month.month === params.currentMonth,
    })),
    typicalMonthlyResult: typicalMonthlyResult
      ? moneyString(typicalMonthlyResult)
      : null,
    breakEvenGap: breakEvenGap ? moneyString(breakEvenGap) : null,
    positiveMonthCount: completedResults.filter((result) => result.gt(0)).length,
    negativeMonthCount: completedResults.filter((result) => result.lt(0)).length,
    breakEvenMonthCount: completedResults.filter((result) => result.eq(0)).length,
    completedMonthCount: completedMonths.length,
    hasLimitedHistory: completedMonths.length < 3,
  };
}

export function buildSpendingInsight(params: {
  transactions: SpendingInsightTransaction[];
  categoryId: string;
  categoryCreatedMonth: string;
  currentMonth: string;
  period: InsightsPeriod;
}): SpendingInsight {
  const rangeStart = shiftMonthKey(params.currentMonth, -params.period);
  const monthKeys = listInclusiveMonths(rangeStart, params.currentMonth).filter(
    (month) => month >= params.categoryCreatedMonth,
  );
  const monthMap = new Map<string, DecimalMonth>(
    monthKeys.map((month) => [
      month,
      {
        month,
        categorySpending: new Prisma.Decimal(0),
        totalIncome: new Prisma.Decimal(0),
        totalExpenses: new Prisma.Decimal(0),
      },
    ]),
  );

  for (const transaction of params.transactions) {
    const month = transaction.localDate.slice(0, 7);
    const bucket = monthMap.get(month);

    if (!bucket) {
      continue;
    }

    if (transaction.type === "INCOME") {
      bucket.totalIncome = bucket.totalIncome.plus(transaction.amount);
      continue;
    }

    bucket.totalExpenses = bucket.totalExpenses.plus(transaction.amount);

    if (transaction.categoryId === params.categoryId) {
      bucket.categorySpending = bucket.categorySpending.plus(transaction.amount);
    }
  }

  const decimalMonths = Array.from(monthMap.values());
  const completedMonths = decimalMonths.filter(
    (month) => month.month < params.currentMonth,
  );
  const currentMonth = monthMap.get(params.currentMonth) ?? {
    month: params.currentMonth,
    categorySpending: new Prisma.Decimal(0),
    totalIncome: new Prisma.Decimal(0),
    totalExpenses: new Prisma.Decimal(0),
  };
  const typical = median(
    completedMonths.map((month) => month.categorySpending),
  );

  return {
    months: decimalMonths.map((month) => ({
      month: month.month,
      categorySpending: moneyString(month.categorySpending),
      totalExpenses: moneyString(month.totalExpenses),
      actualNet: moneyString(month.totalIncome.minus(month.totalExpenses)),
      isCurrentMonth: month.month === params.currentMonth,
    })),
    typicalSpending: typical ? moneyString(typical) : null,
    currentMonthSpending: moneyString(currentMonth.categorySpending),
    differenceFromTypical: typical
      ? moneyString(currentMonth.categorySpending.minus(typical))
      : null,
    completedMonthCount: completedMonths.length,
    hasLimitedHistory: completedMonths.length < 3,
    hasCategorySpending: decimalMonths.some((month) =>
      month.categorySpending.gt(0),
    ),
  };
}
