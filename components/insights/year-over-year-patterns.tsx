import { CalendarRange } from "lucide-react";
import { Prisma } from "@/generated/prisma/client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMonthLabel } from "@/lib/dates/month";
import {
  formatLongTermChangePercent,
  type LongTermPatternMetric,
  type LongTermPatternsInsight,
} from "@/lib/insights/long-term-patterns";

function formatSignedMoney(formatter: Intl.NumberFormat, amount: string) {
  const decimalAmount = new Prisma.Decimal(amount);

  if (decimalAmount.eq(0)) {
    return formatter.format(0);
  }

  const prefix = decimalAmount.gt(0) ? "+" : "";
  return `${prefix}${formatter.format(Number(decimalAmount.toString()))}`;
}

function formatRange(startMonth: string, endMonth: string) {
  return `${formatMonthLabel(startMonth)} – ${formatMonthLabel(endMonth)}`;
}

function AnnualMetricPanel({
  title,
  metric,
  formatter,
  showPercentage,
}: {
  title: string;
  metric: LongTermPatternMetric;
  formatter: Intl.NumberFormat;
  showPercentage: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-border/70 bg-background/55 p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Previous</p>
          <p className="mt-1 font-mono text-base font-semibold text-foreground">
            {formatter.format(Number(metric.previousTotal))}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Recent</p>
          <p className="mt-1 font-mono text-base font-semibold text-foreground">
            {formatter.format(Number(metric.recentTotal))}
          </p>
        </div>
      </div>
      <div className="border-t border-border/60 pt-3">
        <p className="font-mono text-sm font-semibold text-foreground">
          {formatSignedMoney(formatter, metric.change)}
          {showPercentage ? (
            <span className="ml-2 text-sm font-medium text-muted-foreground">
              {metric.changePercent === null
                ? "Percentage unavailable"
                : formatLongTermChangePercent(metric.changePercent)}
            </span>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Annual change</p>
      </div>
    </div>
  );
}

export function YearOverYearPatterns({
  insight,
  currency,
}: {
  insight: LongTermPatternsInsight;
  currency: string;
}) {
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  });
  const maximumCategoryChange = insight.categories.reduce(
    (maximum, category) =>
      Math.max(maximum, Math.abs(Number(category.change))),
    0,
  );

  return (
    <Card>
      {insight.hasSufficientHistory ? (
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              Previous: {formatRange(
                insight.previousStartMonth,
                insight.previousEndMonth,
              )}
            </span>
            <span>
              Recent: {formatRange(
                insight.recentStartMonth,
                insight.recentEndMonth,
              )}
            </span>
          </div>
        </CardHeader>
      ) : null}
      <CardContent className="pt-4">
        {!insight.hasSufficientHistory ||
        !insight.income ||
        !insight.expenses ||
        !insight.result ? (
          <EmptyState
            icon={CalendarRange}
            title="Not enough completed history"
            description={`Complete ${insight.minimumHistoryMonthCount} tracked months to compare trailing years`}
          />
        ) : (
          <div className="grid gap-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <AnnualMetricPanel
                title="Income"
                metric={insight.income}
                formatter={formatter}
                showPercentage
              />
              <AnnualMetricPanel
                title="Spending"
                metric={insight.expenses}
                formatter={formatter}
                showPercentage
              />
              <AnnualMetricPanel
                title="Result"
                metric={insight.result}
                formatter={formatter}
                showPercentage={false}
              />
            </div>

            <div className="grid gap-3">
              <h3 className="text-sm font-semibold text-foreground">
                Category changes
              </h3>
              {insight.categories.length === 0 ? (
                <div className="rounded-xl border border-border/70 bg-background/55 p-4 text-sm text-muted-foreground">
                  Category spending was unchanged between the trailing years
                </div>
              ) : (
                <ol className="grid gap-5">
                  {insight.categories.map((category, index) => {
                    const change = Number(category.change);
                    const width =
                      maximumCategoryChange > 0
                        ? (Math.abs(change) / maximumCategoryChange) * 100
                        : 0;

                    return (
                      <li key={category.categoryId} className="grid gap-2">
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="w-5 shrink-0 text-right font-mono text-sm text-muted-foreground">
                              {index + 1}
                            </span>
                            <span className="truncate text-sm font-medium text-foreground">
                              {category.categoryName}
                            </span>
                            {category.isArchived ? (
                              <Badge variant="outline" className="text-sm">
                                Archived
                              </Badge>
                            ) : null}
                            {category.hasPartialHistory ? (
                              <Badge variant="outline" className="text-sm">
                                Partial history
                              </Badge>
                            ) : null}
                          </div>
                          <div className="ml-7 grid grid-cols-2 gap-5 sm:ml-0 sm:text-right">
                            <div>
                              <p className="font-mono text-sm font-semibold text-foreground">
                                {formatSignedMoney(formatter, category.change)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Change
                              </p>
                            </div>
                            <div>
                              <p className="font-mono text-sm font-semibold text-foreground">
                                {formatLongTermChangePercent(
                                  category.changePercent,
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Percentage
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="ml-7 grid grid-cols-2" aria-hidden="true">
                          <div className="flex h-2 justify-end border-r border-border bg-muted/60">
                            {change < 0 ? (
                              <div
                                className="h-full min-w-px rounded-l-full"
                                style={{
                                  width: `${width}%`,
                                  backgroundColor: "var(--chart-2)",
                                }}
                              />
                            ) : null}
                          </div>
                          <div className="h-2 bg-muted/60">
                            {change > 0 ? (
                              <div
                                className="h-full min-w-px rounded-r-full"
                                style={{
                                  width: `${width}%`,
                                  backgroundColor: "var(--chart-1)",
                                }}
                              />
                            ) : null}
                          </div>
                        </div>

                        <p className="ml-7 text-sm text-muted-foreground">
                          Annual spending: {formatter.format(
                            Number(category.previousTotal),
                          )} to {formatter.format(Number(category.recentTotal))}
                          {category.changePercent === null ? (
                            <span> · Percentage unavailable</span>
                          ) : null}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
