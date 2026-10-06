import { SpendingCompositionCard } from "@/components/insights/spending-composition-card";
import { SpendingChangeCard } from "@/components/insights/spending-change-card";
import { SectionHeading } from "@/components/app-shell/section-heading";
import { MonthlyResultCard } from "@/components/insights/monthly-result-card";
import { CategoryTrendDetails } from "@/components/insights/category-trend-details";
import { buildMoneyPresentation, buildChangeBars } from "@/lib/presentation/money";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site/metadata";
import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import {
  BarChart3,
  FolderOpen,
} from "lucide-react";

import {
  type SpendingTrendChartPoint,
} from "@/components/insights/spending-trends-chart";
import {
  type MonthlyResultChartPoint,
} from "@/components/insights/monthly-result-chart";
import { IncomeSpendingConsistency } from "@/components/insights/income-spending-consistency";
import { UnusualMonths } from "@/components/insights/unusual-months";
import { YearOverYearPatterns } from "@/components/insights/year-over-year-patterns";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { getMonthRange, formatMonthLabel } from "@/lib/dates/month";
import { getLocalDateInTimeZone } from "@/lib/dates/time-zone";
import { shiftMonthKey } from "@/lib/balance/months";
import { getAuthenticatedUserPreferences } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buildLongTermPatternsInsight } from "@/lib/insights/long-term-patterns";
import {
  buildIncomeSpendingConsistencyInsight,
  buildMonthlyResultInsight,
  buildSpendingChangeInsight,
  buildSpendingCompositionInsight,
  buildSpendingInsight,
  type InsightsPeriod,
  type SpendingChangeWindow,
} from "@/lib/insights/spending-history";
import { buildUnusualMonthsInsight } from "@/lib/insights/unusual-months";
import {
  getCompletedInsightsPeriodRange,
  getPreservedInsightsParams,
  type InsightsControlScope,
} from "@/lib/insights/view-state";
import {
  buildPathWithSearchParams,
  firstSearchParamValue,
  resolveSearchParams,
  type PageSearchParams,
} from "@/lib/routes/search-params";

export const metadata: Metadata = pageMetadata.insights;

const SUPPORTED_PERIODS = new Set([3, 6, 12]);

function normalizePeriod(value: string | undefined): InsightsPeriod {
  const parsed = Number(value);
  return SUPPORTED_PERIODS.has(parsed) ? (parsed as InsightsPeriod) : 6;
}

function formatShortMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, (monthNumber ?? 1) - 1, 1)));
}

function formatCompletedMonthRange(startMonth: string, endMonth: string) {
  return startMonth === endMonth
    ? formatMonthLabel(startMonth)
    : `${formatMonthLabel(startMonth)} – ${formatMonthLabel(endMonth)}`;
}

function formatChangeWindow(window: SpendingChangeWindow) {
  if (window === 1) {
    return "Month to month";
  }

  return `${window} months vs previous ${window}`;
}

function formatMonthPair(targetMonth: string) {
  return `${formatMonthLabel(targetMonth)} vs ${formatMonthLabel(
    shiftMonthKey(targetMonth, -1),
  )}`;
}

function comparisonCopy(
  formatter: Intl.NumberFormat,
  difference: string | null,
) {
  if (difference === null) {
    return {
      value: "—",
      description: "Complete a month to establish a comparison",
    };
  }

  const decimalDifference = new Prisma.Decimal(difference);

  if (decimalDifference.eq(0)) {
    return {
      value: formatter.format(0),
      description: "On your typical monthly spending",
    };
  }

  return {
    value: formatter.format(Number(decimalDifference.abs().toString())),
    description:
      decimalDifference.gt(0)
        ? "Above your typical monthly spending"
        : "Below your typical monthly spending",
  };
}

type ExpenseCategoryOption = {
  id: string;
  name: string;
  isArchived: boolean;
};

function PreservedInsightsFields({
  changing,
  period,
  selectedCategoryId,
  selectedChangeWindow,
  selectedChangeMonth,
}: {
  changing: InsightsControlScope;
  period: InsightsPeriod;
  selectedCategoryId?: string;
  selectedChangeWindow?: SpendingChangeWindow;
  selectedChangeMonth?: string;
}) {
  const params = getPreservedInsightsParams(
    {
      period,
      categoryId: selectedCategoryId,
      changeWindow: selectedChangeWindow,
      changeMonth: selectedChangeMonth,
    },
    changing,
  );

  return (
    <>
      {Object.entries(params).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

function HistoryPeriodControl({
  period,
  selectedCategoryId,
  selectedChangeWindow,
  selectedChangeMonth,
}: {
  period: InsightsPeriod;
  selectedCategoryId?: string;
  selectedChangeWindow?: SpendingChangeWindow;
  selectedChangeMonth?: string;
}) {
  return (
    <form
      action="/insights"
      method="get"
      className="flex flex-wrap items-end gap-3"
    >
      <PreservedInsightsFields
        changing="history"
        period={period}
        selectedCategoryId={selectedCategoryId}
        selectedChangeWindow={selectedChangeWindow}
        selectedChangeMonth={selectedChangeMonth}
      />
      <label className="grid text-sm font-medium text-foreground">
        <span className="sr-only">History Period:</span>
        <Select
          name="period"
          defaultValue={String(period)}
          wrapperClassName="min-w-52"
        >
          <option value="3">3 completed months</option>
          <option value="6">6 completed months</option>
          <option value="12">12 completed months</option>
        </Select>
      </label>
      <Button type="submit">Apply</Button>
    </form>
  );
}

function ExpenseCategoryControl({
  categories,
  period,
  selectedCategoryId,
  selectedChangeWindow,
  selectedChangeMonth,
}: {
  categories: ExpenseCategoryOption[];
  period: InsightsPeriod;
  selectedCategoryId?: string;
  selectedChangeWindow?: SpendingChangeWindow;
  selectedChangeMonth?: string;
}) {
  const activeCategories = categories.filter((category) => !category.isArchived);
  const archivedCategories = categories.filter((category) => category.isArchived);

  return (
    <form
      action="/insights"
      method="get"
      className="flex flex-wrap items-end gap-3"
    >
      <PreservedInsightsFields
        changing="category"
        period={period}
        selectedCategoryId={selectedCategoryId}
        selectedChangeWindow={selectedChangeWindow}
        selectedChangeMonth={selectedChangeMonth}
      />
      <label className="grid min-w-0 flex-1 gap-1.5 text-sm font-medium text-foreground sm:max-w-md">
        Expense category
        <Select name="categoryId" defaultValue={selectedCategoryId ?? ""}>
          <option value="" disabled>
            Select category
          </option>
          {activeCategories.length > 0 ? (
            <optgroup label="Active categories">
              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {archivedCategories.length > 0 ? (
            <optgroup label="Archived categories">
              {archivedCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} (Archived)
                </option>
              ))}
            </optgroup>
          ) : null}
        </Select>
      </label>
      <Button type="submit">Apply</Button>
    </form>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const [resolvedSearchParams, user] = await Promise.all([
    resolveSearchParams(searchParams),
    getAuthenticatedUserPreferences(),
  ]);

  if (!user.timeZone) {
    throw new Error("Account time zone is not configured");
  }

  const accountTimeZone = user.timeZone;
  const currentLocalDate = getLocalDateInTimeZone(accountTimeZone);
  const currentMonth = currentLocalDate.slice(0, 7);
  const period = normalizePeriod(
    firstSearchParamValue(resolvedSearchParams.period),
  );
  const requestedCategoryId = firstSearchParamValue(
    resolvedSearchParams.categoryId,
  );
  const requestedChangeWindow = firstSearchParamValue(
    resolvedSearchParams.changeWindow,
  );
  const requestedChangeMonth = firstSearchParamValue(
    resolvedSearchParams.changeMonth,
  );
  const rangeStartMonth = shiftMonthKey(currentMonth, -24);
  const rangeStart = getMonthRange(rangeStartMonth).start;

  const [categories, firstActivityTransaction, transactions] = await Promise.all([
    db.category.findMany({
      where: {
        userId: user.userId,
        type: "EXPENSE",
      },
      select: {
        id: true,
        name: true,
        isArchived: true,
        createdAt: true,
      },
      orderBy: [{ isArchived: "asc" }, { name: "asc" }],
    }),
    db.transaction.findFirst({
      where: {
        userId: user.userId,
        localDate: {
          lte: currentLocalDate,
        },
      },
      select: {
        localDate: true,
      },
      orderBy: {
        localDate: "asc",
      },
    }),
    db.transaction.findMany({
      where: {
        userId: user.userId,
        localDate: {
          gte: rangeStart,
          lte: currentLocalDate,
        },
      },
      select: {
        type: true,
        amount: true,
        localDate: true,
        categoryId: true,
      },
    }),
  ]);

  const historicalCategorySources = categories.map((category) => ({
    id: category.id,
    name: category.name,
    isArchived: category.isArchived,
    createdMonth: getLocalDateInTimeZone(
      accountTimeZone,
      category.createdAt,
    ).slice(0, 7),
  }));
  const selectedCategory = categories.find(
    (category) => category.id === requestedCategoryId,
  );
  const monthlyResultInsight = buildMonthlyResultInsight({
    transactions,
    firstActivityMonth: firstActivityTransaction?.localDate.slice(0, 7) ?? null,
    currentMonth,
    period,
  });
  const incomeSpendingConsistency = buildIncomeSpendingConsistencyInsight({
    transactions,
    firstActivityMonth: firstActivityTransaction?.localDate.slice(0, 7) ?? null,
    currentMonth,
    period,
  });
  const unusualMonths = buildUnusualMonthsInsight({
    transactions,
    categories: historicalCategorySources,
    firstActivityMonth: firstActivityTransaction?.localDate.slice(0, 7) ?? null,
    currentMonth,
    period,
  });
  const longTermPatterns = buildLongTermPatternsInsight({
    transactions,
    categories: historicalCategorySources,
    firstActivityMonth: firstActivityTransaction?.localDate.slice(0, 7) ?? null,
    currentMonth,
  });
  const spendingComposition = buildSpendingCompositionInsight({
    transactions,
    categories,
    currentMonth,
    period,
  });
  const spendingChange = buildSpendingChangeInsight({
    transactions,
    categories,
    firstActivityMonth: firstActivityTransaction?.localDate.slice(0, 7) ?? null,
    currentMonth,
    requestedWindow: requestedChangeWindow,
    requestedTargetMonth: requestedChangeMonth,
  });
  const insight = selectedCategory
    ? buildSpendingInsight({
        transactions,
        categoryId: selectedCategory.id,
        categoryCreatedMonth: getLocalDateInTimeZone(
          accountTimeZone,
          selectedCategory.createdAt,
        ).slice(0, 7),
        currentMonth,
        period,
      })
    : null;
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: user.currency,
  });
  const monthlyResultChartData: MonthlyResultChartPoint[] =
    monthlyResultInsight.months.map((month) => ({
      month: month.month,
      shortLabel: formatShortMonth(month.month),
      fullLabel: formatMonthLabel(month.month),
      totalIncome: Number(month.totalIncome),
      totalExpenses: Number(month.totalExpenses),
      result: Number(month.result),
      isCurrentMonth: month.isCurrentMonth,
    }));
  const comparison = insight
    ? comparisonCopy(formatter, insight.differenceFromTypical)
    : null;
  const chartData: SpendingTrendChartPoint[] =
    insight?.months.map((month) => ({
      month: month.month,
      shortLabel: formatShortMonth(month.month),
      fullLabel: formatMonthLabel(month.month),
      categorySpending: Number(month.categorySpending),
      totalExpenses: Number(month.totalExpenses),
      actualNet: Number(month.actualNet),
      isCurrentMonth: month.isCurrentMonth,
    })) ?? [];
  const historyRows = insight ? [...insight.months].reverse() : [];
  const completedPeriodRange = getCompletedInsightsPeriodRange(
    currentMonth,
    period,
  );
  const completedPeriodLabel = formatCompletedMonthRange(
    completedPeriodRange.startMonth,
    completedPeriodRange.endMonth,
  );

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Insights</h1>
      <section
        aria-labelledby="monthly-result-heading"
        className="flex flex-col gap-4"
      >
        <SectionHeading
          id="monthly-result-heading"
          title="Monthly result"
        />
        <HistoryPeriodControl
          period={period}
          selectedCategoryId={selectedCategory?.id}
          selectedChangeWindow={spendingChange.window ?? undefined}
          selectedChangeMonth={spendingChange.selectedTargetMonth ?? undefined}
        />

        <MonthlyResultCard monthlyResultInsight={monthlyResultInsight} monthlyResultChartData={monthlyResultChartData} completedPeriodLabel={completedPeriodLabel} currency={user.currency} display={buildMoneyPresentation(monthlyResultInsight, user.currency, true)} transactionsHref={buildPathWithSearchParams('/transactions', { month: currentMonth })} />
      </section>

      <section
        aria-labelledby="spending-composition-heading"
        className="flex flex-col gap-4"
      >
        <SectionHeading
          id="spending-composition-heading"
          title="Spending composition"
        />
        <SpendingCompositionCard spendingComposition={spendingComposition} completedPeriodLabel={completedPeriodLabel} currency={user.currency} display={buildMoneyPresentation(spendingComposition, user.currency)} />
      </section>

      <section
        aria-labelledby="income-spending-consistency-heading"
        className="flex flex-col gap-4"
      >
        <SectionHeading
          id="income-spending-consistency-heading"
          title="Income and spending consistency"
        />
        <IncomeSpendingConsistency
          insight={incomeSpendingConsistency}
          currency={user.currency}
          historyPeriodLabel={completedPeriodLabel}
        />
      </section>

      <section
        aria-labelledby="unusual-months-heading"
        className="flex flex-col gap-4"
      >
        <SectionHeading
          id="unusual-months-heading"
          title="Unusual months"
        />
        <UnusualMonths
          insight={unusualMonths}
          currency={user.currency}
          historyPeriodLabel={completedPeriodLabel}
        />
      </section>

      <section
        aria-labelledby="category-spending-heading"
        className="flex flex-col gap-4"
      >
        <SectionHeading
          id="category-spending-heading"
          title="Category Spending Trends"
        />
        {categories.length > 0 ? (
          <ExpenseCategoryControl
            categories={categories}
            period={period}
            selectedCategoryId={selectedCategory?.id}
            selectedChangeWindow={spendingChange.window ?? undefined}
            selectedChangeMonth={spendingChange.selectedTargetMonth ?? undefined}
          />
        ) : null}

        {categories.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-muted-foreground">History Period:</span>
              <span>{completedPeriodLabel}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <EmptyState
              icon={FolderOpen}
              title="Create an expense category first"
              description="Category insights compare actual expense transactions within a category"
              action={(
                <Link
                  href="/categories"
                  className={buttonVariants({ variant: "default" })}
                >
                  Manage categories
                </Link>
              )}
            />
          </CardContent>
        </Card>
      ) : !selectedCategory ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-muted-foreground">History Period:</span>
              <span>{completedPeriodLabel}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <EmptyState
              icon={BarChart3}
              title="Select an expense category"
              description="Choose a category to view its monthly spending history"
            />
          </CardContent>
        </Card>
      ) : insight && comparison ? (
        <>
        <CategoryTrendDetails insight={insight} comparison={comparison} selectedCategory={selectedCategory} completedPeriodLabel={completedPeriodLabel} chartData={chartData} historyRows={historyRows} currency={user.currency} display={buildMoneyPresentation(insight, user.currency, true)} currentTransactionsHref={buildPathWithSearchParams('/transactions', { month: currentMonth, type: 'EXPENSE', categoryId: selectedCategory.id })} transactionHrefs={Object.fromEntries(historyRows.map(row => [row.month, buildPathWithSearchParams('/transactions', { month: row.month, type: 'EXPENSE', categoryId: selectedCategory.id })]))} />
        </>
        ) : null}
      </section>

      <section
        aria-labelledby="drivers-of-change-heading"
        className="flex flex-col gap-4"
      >
        <SectionHeading
          id="drivers-of-change-heading"
          title="Drivers of change"
        />

        <SpendingChangeCard spendingChange={spendingChange} display={buildMoneyPresentation(spendingChange, user.currency, true)} bars={buildChangeBars(spendingChange.categories)} controls={(
            {spendingChange.window ? (
              <form
                action="/insights"
                method="get"
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
              >
                <PreservedInsightsFields
                  changing="drivers"
                  period={period}
                  selectedCategoryId={selectedCategory?.id}
                  selectedChangeWindow={spendingChange.window ?? undefined}
                  selectedChangeMonth={spendingChange.selectedTargetMonth ?? undefined}
                />
                <label className="grid text-sm font-medium text-foreground">
                  <span className="sr-only">Comparison length</span>
                  <Select
                    name="changeWindow"
                    defaultValue={String(spendingChange.window)}
                  >
                    {spendingChange.availableWindows.map((window) => (
                      <option key={window} value={window}>
                        {formatChangeWindow(window)}
                      </option>
                    ))}
                  </Select>
                </label>
                {spendingChange.window === 1 &&
                spendingChange.selectedTargetMonth ? (
                  <label className="grid text-sm font-medium text-foreground">
                    <span className="sr-only">Compare</span>
                    <Select
                      name="changeMonth"
                      defaultValue={spendingChange.selectedTargetMonth}
                    >
                      {spendingChange.availableTargetMonths.map((month) => (
                        <option key={month} value={month}>
                          {formatMonthPair(month)}
                        </option>
                      ))}
                    </Select>
                  </label>
                ) : null}
                <Button type="submit" variant="outline">
                  Apply
                </Button>
              </form>
            ) : null}
        )} />
      </section>

      <section
        aria-labelledby="year-over-year-patterns-heading"
        className="flex flex-col gap-4"
      >
        <SectionHeading
          id="year-over-year-patterns-heading"
          title="Year-over-year patterns"
        />
        <YearOverYearPatterns
          insight={longTermPatterns}
          currency={user.currency}
        />
      </section>

    </div>
  );
}
