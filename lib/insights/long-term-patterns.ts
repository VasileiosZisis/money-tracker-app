import { Prisma } from "@/generated/prisma/client";

import { listInclusiveMonths, shiftMonthKey } from "@/lib/balance/months";
import type { SpendingInsightTransaction } from "@/lib/insights/spending-history";

export const LONG_TERM_PATTERN_MONTH_COUNT = 24;

export type LongTermPatternCategorySource = {
  id: string;
  name: string;
  isArchived: boolean;
  createdMonth: string;
};

export type LongTermPatternMetric = {
  previousTotal: string;
  recentTotal: string;
  change: string;
  changePercent: string | null;
};

export type LongTermCategoryPattern = {
  categoryId: string;
  categoryName: string;
  isArchived: boolean;
  hasPartialHistory: boolean;
  previousTotal: string;
  recentTotal: string;
  change: string;
  changePercent: string | null;
};

export type LongTermPatternsInsight = {
  completedMonthCount: number;
  minimumHistoryMonthCount: number;
  hasSufficientHistory: boolean;
  previousStartMonth: string;
  previousEndMonth: string;
  recentStartMonth: string;
  recentEndMonth: string;
  income: LongTermPatternMetric | null;
  expenses: LongTermPatternMetric | null;
  result: LongTermPatternMetric | null;
  categories: LongTermCategoryPattern[];
};

export function formatLongTermChangePercent(value: string | null) {
  if (value === null) {
    return "—";
  }

  const percentage = new Prisma.Decimal(value);

  if (percentage.eq(0)) {
    return "0.0%";
  }

  const sign = percentage.gt(0) ? "+" : "−";

  if (percentage.abs().toDecimalPlaces(1).eq(0)) {
    return `${sign}<0.1%`;
  }

  return `${sign}${Number(percentage.abs().toString()).toFixed(1)}%`;
}

type AnnualTotals = {
  income: Prisma.Decimal;
  expenses: Prisma.Decimal;
};

function preciseMoneyString(value: Prisma.Decimal) {
  return value.decimalPlaces() <= 2 ? value.toFixed(2) : value.toString();
}

function percentageChange(
  previousTotal: Prisma.Decimal,
  change: Prisma.Decimal,
) {
  return previousTotal.eq(0)
    ? null
    : change.dividedBy(previousTotal).times(100).toString();
}

function metric(
  previousTotal: Prisma.Decimal,
  recentTotal: Prisma.Decimal,
  includePercentage: boolean,
): LongTermPatternMetric {
  const change = recentTotal.minus(previousTotal);

  return {
    previousTotal: preciseMoneyString(previousTotal),
    recentTotal: preciseMoneyString(recentTotal),
    change: preciseMoneyString(change),
    changePercent: includePercentage
      ? percentageChange(previousTotal, change)
      : null,
  };
}

export function buildLongTermPatternsInsight(params: {
  transactions: SpendingInsightTransaction[];
  categories: LongTermPatternCategorySource[];
  firstActivityMonth: string | null;
  currentMonth: string;
}): LongTermPatternsInsight {
  const previousStartMonth = shiftMonthKey(params.currentMonth, -24);
  const previousEndMonth = shiftMonthKey(params.currentMonth, -13);
  const recentStartMonth = shiftMonthKey(params.currentMonth, -12);
  const recentEndMonth = shiftMonthKey(params.currentMonth, -1);
  const firstActivityMonth =
    params.firstActivityMonth && params.firstActivityMonth < params.currentMonth
      ? params.firstActivityMonth
      : null;
  const eligibleStartMonth = firstActivityMonth
    ? firstActivityMonth > previousStartMonth
      ? firstActivityMonth
      : previousStartMonth
    : null;
  const completedMonthCount = eligibleStartMonth
    ? Math.min(
        LONG_TERM_PATTERN_MONTH_COUNT,
        listInclusiveMonths(eligibleStartMonth, recentEndMonth).length,
      )
    : 0;
  const hasSufficientHistory =
    completedMonthCount === LONG_TERM_PATTERN_MONTH_COUNT;
  const unavailableResult: LongTermPatternsInsight = {
    completedMonthCount,
    minimumHistoryMonthCount: LONG_TERM_PATTERN_MONTH_COUNT,
    hasSufficientHistory,
    previousStartMonth,
    previousEndMonth,
    recentStartMonth,
    recentEndMonth,
    income: null,
    expenses: null,
    result: null,
    categories: [],
  };

  if (!hasSufficientHistory) {
    return unavailableResult;
  }

  const previousTotals: AnnualTotals = {
    income: new Prisma.Decimal(0),
    expenses: new Prisma.Decimal(0),
  };
  const recentTotals: AnnualTotals = {
    income: new Prisma.Decimal(0),
    expenses: new Prisma.Decimal(0),
  };
  const previousCategoryTotals = new Map<string, Prisma.Decimal>();
  const recentCategoryTotals = new Map<string, Prisma.Decimal>();
  const categoryMap = new Map(
    params.categories.map((category) => [category.id, category]),
  );

  for (const transaction of params.transactions) {
    const month = transaction.localDate.slice(0, 7);
    const annualTotals =
      month >= previousStartMonth && month <= previousEndMonth
        ? previousTotals
        : month >= recentStartMonth && month <= recentEndMonth
          ? recentTotals
          : null;

    if (!annualTotals) {
      continue;
    }

    if (transaction.type === "INCOME") {
      annualTotals.income = annualTotals.income.plus(transaction.amount);
      continue;
    }

    annualTotals.expenses = annualTotals.expenses.plus(transaction.amount);
    const category = categoryMap.get(transaction.categoryId);

    if (!category || month < category.createdMonth) {
      continue;
    }

    const categoryTotals =
      annualTotals === previousTotals
        ? previousCategoryTotals
        : recentCategoryTotals;
    categoryTotals.set(
      category.id,
      (categoryTotals.get(category.id) ?? new Prisma.Decimal(0)).plus(
        transaction.amount,
      ),
    );
  }

  const categories = params.categories
    .map((category): LongTermCategoryPattern | null => {
      const previousTotal =
        previousCategoryTotals.get(category.id) ?? new Prisma.Decimal(0);
      const recentTotal =
        recentCategoryTotals.get(category.id) ?? new Prisma.Decimal(0);
      const change = recentTotal.minus(previousTotal);

      if (change.eq(0)) {
        return null;
      }

      const hasPartialHistory = category.createdMonth > previousStartMonth;

      return {
        categoryId: category.id,
        categoryName: category.name,
        isArchived: category.isArchived,
        hasPartialHistory,
        previousTotal: preciseMoneyString(previousTotal),
        recentTotal: preciseMoneyString(recentTotal),
        change: preciseMoneyString(change),
        changePercent: hasPartialHistory
          ? null
          : percentageChange(previousTotal, change),
      };
    })
    .filter((category): category is LongTermCategoryPattern => category !== null)
    .sort((left, right) => {
      const magnitudeComparison = new Prisma.Decimal(right.change)
        .abs()
        .comparedTo(new Prisma.Decimal(left.change).abs());

      return (
        magnitudeComparison || left.categoryName.localeCompare(right.categoryName)
      );
    });
  const previousResult = previousTotals.income.minus(previousTotals.expenses);
  const recentResult = recentTotals.income.minus(recentTotals.expenses);

  return {
    ...unavailableResult,
    income: metric(previousTotals.income, recentTotals.income, true),
    expenses: metric(previousTotals.expenses, recentTotals.expenses, true),
    result: metric(previousResult, recentResult, false),
    categories,
  };
}
