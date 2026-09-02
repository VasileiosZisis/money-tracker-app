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
import { PageHeader } from "@/components/app-shell/page-header";
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
import {
  buildMonthlyResultInsight,
  buildSpendingInsight,
  type InsightsPeriod,
} from "@/lib/insights/spending-history";
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

function formatSignedMoney(formatter: Intl.NumberFormat, amount: string) {
  const decimalAmount = new Prisma.Decimal(amount);
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
      description: "Complete a month to establish a comparison.",
    };
  }

  const decimalDifference = new Prisma.Decimal(difference);

  if (decimalDifference.eq(0)) {
    return {
      value: formatter.format(0),
      description: "On your typical monthly spending.",
    };
  }

  return {
    value: formatter.format(Number(decimalDifference.abs().toString())),
    description:
      decimalDifference.gt(0)
        ? "Above your typical monthly spending."
        : "Below your typical monthly spending.",
  };
}

type ExpenseCategoryOption = {
  id: string;
  name: string;
  isArchived: boolean;
};

function InsightsControls({
  categories,
  period,
  selectedCategoryId,
}: {
  categories: ExpenseCategoryOption[];
  period: InsightsPeriod;
  selectedCategoryId?: string;
}) {
  const activeCategories = categories.filter((category) => !category.isArchived);
  const archivedCategories = categories.filter((category) => category.isArchived);

  return (
    <Card>
      <CardContent className="pt-4">
        <form
          action="/insights"
          method="get"
          className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_minmax(190px,auto)_auto] sm:items-end"
        >
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Expense category
            <Select
              name="categoryId"
              defaultValue={selectedCategoryId ?? ""}
            >
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

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Comparison period
            <Select name="period" defaultValue={String(period)}>
              <option value="3">3 completed months</option>
              <option value="6">6 completed months</option>
              <option value="12">12 completed months</option>
            </Select>
          </label>

          <Button type="submit" size="lg">
            Apply
          </Button>
        </form>
      </CardContent>
    </Card>
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
    throw new Error("Account time zone is not configured.");
  }

  const currentLocalDate = getLocalDateInTimeZone(user.timeZone);
  const currentMonth = currentLocalDate.slice(0, 7);
  const period = normalizePeriod(
    firstSearchParamValue(resolvedSearchParams.period),
  );
  const requestedCategoryId = firstSearchParamValue(
    resolvedSearchParams.categoryId,
  );
  const rangeStartMonth = shiftMonthKey(currentMonth, -period);
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

  const selectedCategory = categories.find(
    (category) => category.id === requestedCategoryId,
  );
  const monthlyResultInsight = buildMonthlyResultInsight({
    transactions,
    firstActivityMonth: firstActivityTransaction?.localDate.slice(0, 7) ?? null,
    currentMonth,
    period,
  });
  const insight = selectedCategory
    ? buildSpendingInsight({
        transactions,
        categoryId: selectedCategory.id,
        categoryCreatedMonth: getLocalDateInTimeZone(
          user.timeZone,
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

  return (
    <section className="flex flex-col gap-5">
      <PageHeader title="Insights" />

      <InsightsControls
        categories={categories}
        period={period}
        selectedCategoryId={selectedCategory?.id}
      />

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Monthly result</CardTitle>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-success" />
              Income
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-destructive" />
              Expenses
            </span>
            <Badge variant="outline">Current month in progress</Badge>
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
              description="Add income or expense transactions to establish a monthly result history."
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
                <Badge variant="warning">Limited history</Badge>
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
                  ? "Complete a month to establish a baseline."
                  : `Median of ${monthlyResultInsight.completedMonthCount} completed ${
                      monthlyResultInsight.completedMonthCount === 1
                        ? "month"
                        : "months"
                    }.`}
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
                  ? "Complete a month to establish a baseline."
                  : isPositiveMoney(monthlyResultInsight.breakEvenGap)
                    ? "Amount needed to bring the typical monthly result to zero."
                    : "No typical shortfall in the selected period."}
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
                  ? "No completed months in this baseline."
                  : monthlyResultInsight.breakEvenMonthCount > 0
                    ? `${monthlyResultInsight.breakEvenMonthCount} ${
                        monthlyResultInsight.breakEvenMonthCount === 1
                          ? "month"
                          : "months"
                      } at break-even.`
                    : `${monthlyResultInsight.completedMonthCount} completed ${
                        monthlyResultInsight.completedMonthCount === 1
                          ? "month"
                          : "months"
                      }.`}
              </p>
            </div>
          </div>
        </CardFooter>
      </Card>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="pt-4">
            <EmptyState
              icon={FolderOpen}
              title="Create an expense category first"
              description="Category insights compare actual expense transactions within a category."
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
          <CardContent className="pt-4">
            <EmptyState
              icon={BarChart3}
              title="Select an expense category"
              description="Choose a category to view its monthly spending history."
            />
          </CardContent>
        </Card>
      ) : insight && comparison ? (
        <>
      <Card>
        <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Spending trends</CardTitle>
          </div>
          <Badge variant="outline">Current month in progress</Badge>
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
              description="The monthly context below remains available, and new transactions will appear here automatically."
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
                <Badge variant="warning">Limited history</Badge>
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
                {insight.completedMonthCount === 1 ? "month" : "months"}.
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
                Actual spending recorded so far.
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
                <tr className="border-b border-border/80 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
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
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
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
                      <p className="text-xs text-muted-foreground">In progress</p>
                    ) : null}
                  </div>
                  <p className="font-mono text-base font-semibold text-foreground">
                    {formatter.format(Number(month.categorySpending))}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Total expenses</p>
                    <p className="font-mono font-semibold text-foreground">
                      {formatter.format(Number(month.totalExpenses))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
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
  );
}
