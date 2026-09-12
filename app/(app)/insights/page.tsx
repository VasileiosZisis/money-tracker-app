import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import {
  ArrowRight,
  BarChart3,
  FolderOpen,
} from "lucide-react";

import {
  SpendingTrendsChart,
  type SpendingTrendChartPoint,
} from "@/components/insights/spending-trends-chart";
import {
  MonthlyResultChart,
  type MonthlyResultChartPoint,
} from "@/components/insights/monthly-result-chart";
import { IncomeSpendingConsistency } from "@/components/insights/income-spending-consistency";
import { SpendingChangeDrivers } from "@/components/insights/spending-change-drivers";
import { SpendingComposition } from "@/components/insights/spending-composition";
import { UnusualMonths } from "@/components/insights/unusual-months";
import { YearOverYearPatterns } from "@/components/insights/year-over-year-patterns";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
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
import { cn } from "@/lib/utils";

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

function formatSignedMoney(formatter: Intl.NumberFormat, amount: string) {
  const decimalAmount = new Prisma.Decimal(amount);

  if (decimalAmount.eq(0)) {
    return formatter.format(0);
  }

  const maximumFractionDigits =
    formatter.resolvedOptions().maximumFractionDigits;
  const roundedAbsoluteAmount = decimalAmount
    .abs()
    .toDecimalPlaces(maximumFractionDigits);

  if (roundedAbsoluteAmount.eq(0)) {
    const minimumDisplayUnit = new Prisma.Decimal(
      `1e-${maximumFractionDigits}`,
    );
    const sign = decimalAmount.gt(0) ? "+" : "−";

    return `${sign}<${formatter.format(Number(minimumDisplayUnit.toString()))}`;
  }

  const prefix = decimalAmount.gt(0) ? "+" : "";
  return `${prefix}${formatter.format(Number(decimalAmount.toString()))}`;
}

function isNegativeMoney(amount: string) {
  return new Prisma.Decimal(amount).lt(0);
}

function isPositiveMoney(amount: string) {
  return new Prisma.Decimal(amount).gt(0);
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

function InsightsSectionHeading({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  return (
    <h2
      id={id}
      className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
    >
      {title}
    </h2>
  );
}

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
        <InsightsSectionHeading
          id="monthly-result-heading"
          title="Monthly result"
        />
        <HistoryPeriodControl
          period={period}
          selectedCategoryId={selectedCategory?.id}
          selectedChangeWindow={spendingChange.window ?? undefined}
          selectedChangeMonth={spendingChange.selectedTargetMonth ?? undefined}
        />

        <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-muted-foreground">History Period:</span>
            <span>{completedPeriodLabel}</span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-success" />
              Income
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-destructive" />
              Expenses
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {monthlyResultChartData.length > 0 ? (
            <MonthlyResultChart
              currency={user.currency}
              data={monthlyResultChartData}
            />
          ) : (
            <EmptyState
              icon={BarChart3}
              title="No monthly activity yet"
              description="Add income or expense transactions to establish a monthly result history"
              action={(
                <Link
                  href={buildPathWithSearchParams("/transactions", {
                    month: currentMonth,
                  })}
                  className={buttonVariants({ variant: "outline" })}
                >
                  View transactions
                </Link>
              )}
            />
          )}
        </CardContent>
        <CardFooter className="grid items-stretch gap-0 border-t border-border/70 px-4 pb-0 sm:grid-cols-3">
          <div className="flex flex-col justify-between gap-3 py-3 sm:pr-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">
                Typical monthly result
              </p>
              {monthlyResultInsight.hasLimitedHistory ? (
                <Badge variant="warning" className="text-sm">
                  Limited history
                </Badge>
              ) : null}
            </div>
            <div>
              <p
                className={cn(
                  "font-mono text-3xl font-semibold tracking-tight",
                  monthlyResultInsight.typicalMonthlyResult !== null &&
                    isNegativeMoney(monthlyResultInsight.typicalMonthlyResult)
                    ? "text-destructive"
                    : monthlyResultInsight.typicalMonthlyResult !== null &&
                        isPositiveMoney(
                          monthlyResultInsight.typicalMonthlyResult,
                        )
                      ? "text-success"
                      : "text-foreground",
                )}
              >
                {monthlyResultInsight.typicalMonthlyResult === null
                  ? "—"
                  : formatSignedMoney(
                      formatter,
                      monthlyResultInsight.typicalMonthlyResult,
                    )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {monthlyResultInsight.completedMonthCount === 0
                  ? "Complete a month to establish a baseline"
                  : `Median of ${monthlyResultInsight.completedMonthCount} completed ${
                      monthlyResultInsight.completedMonthCount === 1
                        ? "month"
                        : "months"
                    }`}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-border/70 py-3 sm:border-l sm:border-t-0 sm:px-4">
            <p className="text-sm font-medium text-muted-foreground">
              Break-even gap
            </p>
            <div>
              <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
                {monthlyResultInsight.breakEvenGap === null
                  ? "—"
                  : formatter.format(Number(monthlyResultInsight.breakEvenGap))}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {monthlyResultInsight.breakEvenGap === null
                  ? "Complete a month to establish a baseline"
                  : isPositiveMoney(monthlyResultInsight.breakEvenGap)
                    ? "Amount needed to bring the typical monthly result to zero"
                    : "No typical shortfall in the selected period"}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-border/70 py-3 sm:border-l sm:border-t-0 sm:pl-4">
            <p className="text-sm font-medium text-muted-foreground">
              Month outcomes
            </p>
            <div>
              <p className="font-mono text-2xl font-semibold tracking-tight">
                <span className="text-success">
                  {monthlyResultInsight.positiveMonthCount} positive
                </span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-destructive">
                  {monthlyResultInsight.negativeMonthCount} negative
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {monthlyResultInsight.completedMonthCount === 0
                  ? "No completed months in this baseline"
                  : monthlyResultInsight.breakEvenMonthCount > 0
                    ? `${monthlyResultInsight.breakEvenMonthCount} ${
                        monthlyResultInsight.breakEvenMonthCount === 1
                          ? "month"
                          : "months"
                      } at break-even`
                    : `${monthlyResultInsight.completedMonthCount} completed ${
                        monthlyResultInsight.completedMonthCount === 1
                          ? "month"
                          : "months"
                      }`}
              </p>
            </div>
          </div>
        </CardFooter>
        </Card>
      </section>

      <section
        aria-labelledby="spending-composition-heading"
        className="flex flex-col gap-4"
      >
        <InsightsSectionHeading
          id="spending-composition-heading"
          title="Spending composition"
        />
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-muted-foreground">History Period:</span>
              <span>{completedPeriodLabel}</span>
            </CardTitle>
            {spendingComposition.categories.length > 0 ? (
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-muted-foreground">
                  Total expenses
                </span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {formatter.format(Number(spendingComposition.totalExpenses))}
                </span>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="pt-4">
            {spendingComposition.categories.length > 0 ? (
              <SpendingComposition
                categories={spendingComposition.categories}
                currency={user.currency}
              />
            ) : (
              <EmptyState
                icon={BarChart3}
                title="No completed spending to break down"
                description="Expense transactions from completed months will appear here"
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section
        aria-labelledby="income-spending-consistency-heading"
        className="flex flex-col gap-4"
      >
        <InsightsSectionHeading
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
        <InsightsSectionHeading
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
        <InsightsSectionHeading
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
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-muted-foreground">History Period:</span>
            <span>{completedPeriodLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {insight.hasCategorySpending ? (
            <SpendingTrendsChart
              categoryName={selectedCategory.name}
              currency={user.currency}
              data={chartData}
            />
          ) : (
            <EmptyState
              icon={BarChart3}
              title={`No ${selectedCategory.name} spending in this period`}
              description="The monthly context below remains available, and new transactions will appear here automatically"
              action={(
                <Link
                  href={buildPathWithSearchParams("/transactions", {
                    month: currentMonth,
                    type: "EXPENSE",
                    categoryId: selectedCategory.id,
                  })}
                  className={buttonVariants({ variant: "outline" })}
                >
                  View transactions
                </Link>
              )}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="flex min-h-36 flex-col justify-between gap-4 pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">
                Typical month
              </p>
              {insight.hasLimitedHistory ? (
                <Badge variant="warning" className="text-sm">
                  Limited history
                </Badge>
              ) : null}
            </div>
            <div>
              <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
                {insight.typicalSpending === null
                  ? "—"
                  : formatter.format(Number(insight.typicalSpending))}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Median of {insight.completedMonthCount} completed {" "}
                {insight.completedMonthCount === 1 ? "month" : "months"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex min-h-36 flex-col justify-between gap-4 pt-4">
            <p className="text-sm font-medium text-muted-foreground">
              This month
            </p>
            <div>
              <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
                {formatter.format(Number(insight.currentMonthSpending))}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Actual spending recorded so far
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex min-h-36 flex-col justify-between gap-4 pt-4">
            <p className="text-sm font-medium text-muted-foreground">
              Compared with typical
            </p>
            <div>
              <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
                {comparison.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {comparison.description}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly history</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/80 text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="px-3 py-3">Month</th>
                  <th className="px-3 py-3">{selectedCategory.name}</th>
                  <th className="px-3 py-3">Total expenses</th>
                  <th className="px-3 py-3">Actual net</th>
                  <th className="px-3 py-3 text-right">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((month) => {
                  const transactionsHref = buildPathWithSearchParams(
                    "/transactions",
                    {
                      month: month.month,
                      type: "EXPENSE",
                      categoryId: selectedCategory.id,
                    },
                  );

                  return (
                    <tr
                      key={month.month}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/35"
                    >
                      <td className="px-3 py-3.5 font-medium text-foreground">
                        {formatMonthLabel(month.month)}
                        {month.isCurrentMonth ? (
                          <span className="ml-2 text-sm font-normal text-muted-foreground">
                            In progress
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3.5 font-mono font-semibold text-foreground">
                        {formatter.format(Number(month.categorySpending))}
                      </td>
                      <td className="px-3 py-3.5 font-mono text-foreground">
                        {formatter.format(Number(month.totalExpenses))}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-3.5 font-mono font-semibold",
                          isNegativeMoney(month.actualNet)
                            ? "text-destructive"
                            : "text-foreground",
                        )}
                      >
                        {formatSignedMoney(formatter, month.actualNet)}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <Link
                          href={transactionsHref}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          View
                          <ArrowRight />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {historyRows.map((month) => (
              <div
                key={month.month}
                className="grid gap-3 rounded-xl border border-border/70 bg-background/55 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {formatMonthLabel(month.month)}
                    </p>
                    {month.isCurrentMonth ? (
                      <p className="text-sm text-muted-foreground">In progress</p>
                    ) : null}
                  </div>
                  <p className="font-mono text-base font-semibold text-foreground">
                    {formatter.format(Number(month.categorySpending))}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-sm">
                  <div>
                    <p className="text-sm text-muted-foreground">Total expenses</p>
                    <p className="font-mono font-semibold text-foreground">
                      {formatter.format(Number(month.totalExpenses))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {month.isCurrentMonth ? "Current net" : "Month-end net"}
                    </p>
                    <p
                      className={cn(
                        "font-mono font-semibold",
                        isNegativeMoney(month.actualNet)
                          ? "text-destructive"
                          : "text-foreground",
                      )}
                    >
                      {formatSignedMoney(formatter, month.actualNet)}
                    </p>
                  </div>
                </div>
                <Link
                  href={buildPathWithSearchParams("/transactions", {
                    month: month.month,
                    type: "EXPENSE",
                    categoryId: selectedCategory.id,
                  })}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "justify-self-start",
                  )}
                >
                  View transactions
                  <ArrowRight />
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

        </>
        ) : null}
      </section>

      <section
        aria-labelledby="drivers-of-change-heading"
        className="flex flex-col gap-4"
      >
        <InsightsSectionHeading
          id="drivers-of-change-heading"
          title="Drivers of change"
        />

        <Card>
          <CardHeader className="gap-3 lg:flex-row lg:items-end">
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
          </CardHeader>
          <CardContent className="pt-4">
            {!spendingChange.window ||
            !spendingChange.previousStartMonth ||
            !spendingChange.previousEndMonth ||
            !spendingChange.recentStartMonth ||
            !spendingChange.recentEndMonth ||
            spendingChange.previousMonthlyAverage === null ||
            spendingChange.recentMonthlyAverage === null ||
            spendingChange.averageMonthlyChange === null ? (
              <EmptyState
                icon={BarChart3}
                title="Not enough completed history"
                description="Complete two consecutive tracked months to compare spending changes"
              />
            ) : !spendingChange.hasExpenseActivity ? (
              <EmptyState
                icon={BarChart3}
                title="No spending in either period"
                description="Expense transactions in completed months will appear here"
              />
            ) : (
              <div className="grid gap-5">
                <div className="grid overflow-hidden rounded-xl border border-border/70 sm:grid-cols-3">
                  <div className="grid gap-1 p-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      {formatCompletedMonthRange(
                        spendingChange.previousStartMonth,
                        spendingChange.previousEndMonth,
                      )}
                    </p>
                    <p className="font-mono text-xl font-semibold text-foreground">
                      {formatter.format(
                        Number(spendingChange.previousMonthlyAverage),
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Previous period monthly average
                    </p>
                  </div>
                  <div className="grid gap-1 border-t border-border/70 p-3 sm:border-l sm:border-t-0">
                    <p className="text-sm font-medium text-muted-foreground">
                      {formatCompletedMonthRange(
                        spendingChange.recentStartMonth,
                        spendingChange.recentEndMonth,
                      )}
                    </p>
                    <p className="font-mono text-xl font-semibold text-foreground">
                      {formatter.format(
                        Number(spendingChange.recentMonthlyAverage),
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Recent period monthly average
                    </p>
                  </div>
                  <div className="grid gap-1 border-t border-border/70 p-3 sm:border-l sm:border-t-0">
                    <p className="text-sm font-medium text-muted-foreground">
                      Average monthly change
                    </p>
                    <p className="font-mono text-xl font-semibold text-foreground">
                      {formatSignedMoney(
                        formatter,
                        spendingChange.averageMonthlyChange,
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isPositiveMoney(spendingChange.averageMonthlyChange)
                        ? "Increase in monthly expenses"
                        : isNegativeMoney(spendingChange.averageMonthlyChange)
                          ? "Decrease in monthly expenses"
                          : "No change in monthly expenses"}
                    </p>
                  </div>
                </div>

                {spendingChange.categories.length > 0 ? (
                  <div className="grid gap-3">
                    <SpendingChangeDrivers
                      categories={spendingChange.categories}
                      currency={user.currency}
                    />
                    {!isPositiveMoney(spendingChange.averageMonthlyChange) &&
                    !isNegativeMoney(spendingChange.averageMonthlyChange) ? (
                      <p className="text-sm text-muted-foreground">
                        Contribution percentages are unavailable when average
                        monthly expenses are unchanged
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/70 bg-background/55 p-4 text-sm text-muted-foreground">
                    Category spending was unchanged
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section
        aria-labelledby="year-over-year-patterns-heading"
        className="flex flex-col gap-4"
      >
        <InsightsSectionHeading
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
