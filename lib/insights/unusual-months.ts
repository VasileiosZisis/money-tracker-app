import { Prisma } from "@/generated/prisma/client";

import { listInclusiveMonths, shiftMonthKey } from "@/lib/balance/months";
import type {
  InsightsPeriod,
  SpendingInsightTransaction,
} from "@/lib/insights/spending-history";
import { buildPathWithSearchParams } from "@/lib/routes/search-params";

export const UNUSUAL_MONTH_MIN_HISTORY = 6;
const MINIMUM_MEDIAN_DIFFERENCE_PERCENT = new Prisma.Decimal(25);
const TUKEY_IQR_MULTIPLIER = new Prisma.Decimal("1.5");

export type UnusualMonthDirection = "HIGH" | "LOW";
export type UnusualMonthMetric =
  | "TOTAL_EXPENSES"
  | "INCOME"
  | "MONTHLY_RESULT"
  | "CATEGORY_EXPENSES";

export type UnusualMonthCategorySource = {
  id: string;
  name: string;
  isArchived: boolean;
  createdMonth: string;
};

export type UnusualMonthObservation = {
  id: string;
  month: string;
  metric: UnusualMonthMetric;
  direction: UnusualMonthDirection;
  actual: string;
  typical: string;
  categoryId: string | null;
  categoryName: string | null;
  isArchivedCategory: boolean;
};

export type UnusualMonthGroup = {
  month: string;
  observations: UnusualMonthObservation[];
};

export type UnusualMonthsInsight = {
  completedMonthCount: number;
  minimumHistoryMonthCount: number;
  hasSufficientHistory: boolean;
  months: UnusualMonthGroup[];
};

export function buildUnusualMonthTransactionsHref(
  observation: Pick<
    UnusualMonthObservation,
    "month" | "metric" | "categoryId"
  >,
) {
  return buildPathWithSearchParams("/transactions", {
    month: observation.month,
    type:
      observation.metric === "INCOME"
        ? "INCOME"
        : observation.metric === "MONTHLY_RESULT"
          ? undefined
          : "EXPENSE",
    categoryId: observation.categoryId ?? undefined,
  });
}

type MonthlyTotals = {
  month: string;
  income: Prisma.Decimal;
  expenses: Prisma.Decimal;
};

type SeriesValue = {
  month: string;
  value: Prisma.Decimal;
};

function preciseMoneyString(value: Prisma.Decimal) {
  return value.decimalPlaces() <= 2 ? value.toFixed(2) : value.toString();
}

function percentile(values: Prisma.Decimal[], percentileQuarter: 1 | 2 | 3) {
  if (values.length === 0) {
    return null;
  }

  const ordered = [...values].sort((left, right) => left.comparedTo(right));
  const scaledIndex = (ordered.length - 1) * percentileQuarter;
  const lowerIndex = Math.floor(scaledIndex / 4);
  const remainder = scaledIndex % 4;
  const lower = ordered[lowerIndex];
  const upper = ordered[Math.ceil(scaledIndex / 4)];

  if (!lower || !upper) {
    return null;
  }

  if (remainder === 0) {
    return lower;
  }

  return lower.plus(upper.minus(lower).times(remainder).dividedBy(4));
}

function findUnusualValues(
  values: SeriesValue[],
  supportedDirections: UnusualMonthDirection[],
) {
  if (values.length < UNUSUAL_MONTH_MIN_HISTORY) {
    return [];
  }

  const decimalValues = values.map((entry) => entry.value);
  const lowerQuartile = percentile(decimalValues, 1);
  const median = percentile(decimalValues, 2);
  const upperQuartile = percentile(decimalValues, 3);

  if (!lowerQuartile || !median || !upperQuartile) {
    return [];
  }

  const interquartileRange = upperQuartile.minus(lowerQuartile);
  const lowerFence = lowerQuartile.minus(
    interquartileRange.times(TUKEY_IQR_MULTIPLIER),
  );
  const upperFence = upperQuartile.plus(
    interquartileRange.times(TUKEY_IQR_MULTIPLIER),
  );

  return values.flatMap((entry) => {
    const direction: UnusualMonthDirection | null = entry.value.lt(lowerFence)
      ? "LOW"
      : entry.value.gt(upperFence)
        ? "HIGH"
        : null;

    if (!direction || !supportedDirections.includes(direction)) {
      return [];
    }

    const absoluteDifference = entry.value.minus(median).abs();
    const isMaterialDifference = median.eq(0)
      ? absoluteDifference.gt(0)
      : absoluteDifference
          .dividedBy(median.abs())
          .times(100)
          .gte(MINIMUM_MEDIAN_DIFFERENCE_PERCENT);

    return isMaterialDifference
      ? [{ month: entry.month, value: entry.value, median, direction }]
      : [];
  });
}

function observation(params: {
  month: string;
  metric: UnusualMonthMetric;
  direction: UnusualMonthDirection;
  actual: Prisma.Decimal;
  typical: Prisma.Decimal;
  category?: UnusualMonthCategorySource;
}): UnusualMonthObservation {
  return {
    id: [params.month, params.metric, params.category?.id ?? "overall"].join(
      ":",
    ),
    month: params.month,
    metric: params.metric,
    direction: params.direction,
    actual: preciseMoneyString(params.actual),
    typical: preciseMoneyString(params.typical),
    categoryId: params.category?.id ?? null,
    categoryName: params.category?.name ?? null,
    isArchivedCategory: params.category?.isArchived ?? false,
  };
}

export function buildUnusualMonthsInsight(params: {
  transactions: SpendingInsightTransaction[];
  categories: UnusualMonthCategorySource[];
  firstActivityMonth: string | null;
  currentMonth: string;
  period: InsightsPeriod;
}): UnusualMonthsInsight {
  const rangeStart = shiftMonthKey(params.currentMonth, -params.period);
  const firstActivityMonth =
    params.firstActivityMonth && params.firstActivityMonth < params.currentMonth
      ? params.firstActivityMonth
      : null;

  if (!firstActivityMonth) {
    return {
      completedMonthCount: 0,
      minimumHistoryMonthCount: UNUSUAL_MONTH_MIN_HISTORY,
      hasSufficientHistory: false,
      months: [],
    };
  }

  const activityStartMonth =
    firstActivityMonth > rangeStart ? firstActivityMonth : rangeStart;
  const completedEndMonth = shiftMonthKey(params.currentMonth, -1);
  const monthKeys = listInclusiveMonths(
    activityStartMonth,
    completedEndMonth,
  );
  const monthMap = new Map<string, MonthlyTotals>(
    monthKeys.map((month) => [
      month,
      {
        month,
        income: new Prisma.Decimal(0),
        expenses: new Prisma.Decimal(0),
      },
    ]),
  );
  const categoryMonthTotals = new Map<string, Map<string, Prisma.Decimal>>();

  for (const transaction of params.transactions) {
    const month = transaction.localDate.slice(0, 7);
    const totals = monthMap.get(month);

    if (!totals) {
      continue;
    }

    if (transaction.type === "INCOME") {
      totals.income = totals.income.plus(transaction.amount);
      continue;
    }

    totals.expenses = totals.expenses.plus(transaction.amount);
    const existingCategoryMonthTotals =
      categoryMonthTotals.get(transaction.categoryId) ?? new Map();
    existingCategoryMonthTotals.set(
      month,
      (existingCategoryMonthTotals.get(month) ?? new Prisma.Decimal(0)).plus(
        transaction.amount,
      ),
    );
    categoryMonthTotals.set(transaction.categoryId, existingCategoryMonthTotals);
  }

  const completedMonths = Array.from(monthMap.values());

  if (completedMonths.length < UNUSUAL_MONTH_MIN_HISTORY) {
    return {
      completedMonthCount: completedMonths.length,
      minimumHistoryMonthCount: UNUSUAL_MONTH_MIN_HISTORY,
      hasSufficientHistory: false,
      months: [],
    };
  }

  const observations: UnusualMonthObservation[] = [];
  const overallSeries = completedMonths.map((month) => ({
    month: month.month,
    income: month.income,
    expenses: month.expenses,
    result: month.income.minus(month.expenses),
  }));

  for (const unusualValue of findUnusualValues(
    overallSeries.map((month) => ({
      month: month.month,
      value: month.expenses,
    })),
    ["HIGH", "LOW"],
  )) {
    observations.push(
      observation({
        month: unusualValue.month,
        metric: "TOTAL_EXPENSES",
        direction: unusualValue.direction,
        actual: unusualValue.value,
        typical: unusualValue.median,
      }),
    );
  }

  for (const unusualValue of findUnusualValues(
    overallSeries.map((month) => ({
      month: month.month,
      value: month.income,
    })),
    ["LOW"],
  )) {
    observations.push(
      observation({
        month: unusualValue.month,
        metric: "INCOME",
        direction: unusualValue.direction,
        actual: unusualValue.value,
        typical: unusualValue.median,
      }),
    );
  }

  for (const unusualValue of findUnusualValues(
    overallSeries.map((month) => ({
      month: month.month,
      value: month.result,
    })),
    ["LOW"],
  )) {
    observations.push(
      observation({
        month: unusualValue.month,
        metric: "MONTHLY_RESULT",
        direction: unusualValue.direction,
        actual: unusualValue.value,
        typical: unusualValue.median,
      }),
    );
  }

  for (const category of params.categories) {
    const totalsByMonth = categoryMonthTotals.get(category.id);

    if (!totalsByMonth) {
      continue;
    }

    const categoryStartMonth = [
      rangeStart,
      firstActivityMonth,
      category.createdMonth,
    ].sort().at(-1);

    if (!categoryStartMonth || categoryStartMonth >= params.currentMonth) {
      continue;
    }

    const categoryMonths = listInclusiveMonths(
      categoryStartMonth,
      completedEndMonth,
    ).map((month) => ({
      month,
      value: totalsByMonth.get(month) ?? new Prisma.Decimal(0),
    }));
    const activeMonthCount = categoryMonths.filter((month) =>
      month.value.gt(0),
    ).length;

    if (
      categoryMonths.length < UNUSUAL_MONTH_MIN_HISTORY ||
      activeMonthCount < 3
    ) {
      continue;
    }

    for (const unusualValue of findUnusualValues(categoryMonths, [
      "HIGH",
      "LOW",
    ])) {
      observations.push(
        observation({
          month: unusualValue.month,
          metric: "CATEGORY_EXPENSES",
          direction: unusualValue.direction,
          actual: unusualValue.value,
          typical: unusualValue.median,
          category,
        }),
      );
    }
  }

  const metricPriority: Record<UnusualMonthMetric, number> = {
    TOTAL_EXPENSES: 0,
    INCOME: 1,
    MONTHLY_RESULT: 2,
    CATEGORY_EXPENSES: 3,
  };
  observations.sort(
    (left, right) =>
      right.month.localeCompare(left.month) ||
      metricPriority[left.metric] - metricPriority[right.metric] ||
      (left.categoryName ?? "").localeCompare(right.categoryName ?? ""),
  );

  const groupedMonths = new Map<string, UnusualMonthObservation[]>();
  for (const item of observations) {
    const monthObservations = groupedMonths.get(item.month) ?? [];
    monthObservations.push(item);
    groupedMonths.set(item.month, monthObservations);
  }

  return {
    completedMonthCount: completedMonths.length,
    minimumHistoryMonthCount: UNUSUAL_MONTH_MIN_HISTORY,
    hasSufficientHistory: true,
    months: Array.from(groupedMonths, ([month, monthObservations]) => ({
      month,
      observations: monthObservations,
    })),
  };
}
