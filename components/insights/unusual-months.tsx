import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Prisma } from "@/generated/prisma/client";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMonthLabel } from "@/lib/dates/month";
import {
  buildUnusualMonthTransactionsHref,
  type UnusualMonthObservation,
  type UnusualMonthsInsight,
} from "@/lib/insights/unusual-months";
import { cn } from "@/lib/utils";

function metricLabel(observation: UnusualMonthObservation) {
  switch (observation.metric) {
    case "TOTAL_EXPENSES":
      return "Total spending";
    case "INCOME":
      return "Income";
    case "MONTHLY_RESULT":
      return "Monthly result";
    case "CATEGORY_EXPENSES":
      return `${observation.categoryName ?? "Category"} spending`;
  }
}

function investigationLabel(observation: UnusualMonthObservation) {
  switch (observation.metric) {
    case "TOTAL_EXPENSES":
      return "View expense transactions";
    case "INCOME":
      return "View income transactions";
    case "MONTHLY_RESULT":
      return "Review month";
    case "CATEGORY_EXPENSES":
      return `View ${observation.categoryName ?? "category"} transactions`;
  }
}

function formatMoney(
  formatter: Intl.NumberFormat,
  amount: string,
  signed: boolean,
) {
  const decimalAmount = new Prisma.Decimal(amount);

  if (!signed || decimalAmount.eq(0)) {
    return formatter.format(Number(decimalAmount.toString()));
  }

  const prefix = decimalAmount.gt(0) ? "+" : "";
  return `${prefix}${formatter.format(Number(decimalAmount.toString()))}`;
}

export function UnusualMonths({
  insight,
  currency,
}: {
  insight: UnusualMonthsInsight;
  currency: string;
}) {
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  });

  return (
    <Card>
      <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Unusual months</CardTitle>
        {insight.completedMonthCount > 0 ? (
          <span className="text-xs text-muted-foreground">
            {insight.completedMonthCount} completed{" "}
            {insight.completedMonthCount === 1 ? "month" : "months"}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="pt-4">
        {!insight.hasSufficientHistory ? (
          <EmptyState
            icon={Search}
            title="Not enough completed history"
            description={`Complete at least ${insight.minimumHistoryMonthCount} tracked months to identify unusual patterns`}
          />
        ) : insight.months.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No unusual completed months"
            description="Income, spending, and monthly results stayed within the detection range"
          />
        ) : (
          <ol className="grid gap-4">
            {insight.months.map((month) => (
              <li
                key={month.month}
                className="overflow-hidden rounded-xl border border-border/70 bg-background/55"
              >
                <div className="border-b border-border/70 px-4 py-3">
                  <h4 className="text-sm font-semibold text-foreground">
                    {formatMonthLabel(month.month)}
                  </h4>
                </div>
                <ul className="divide-y divide-border/60">
                  {month.observations.map((observation) => {
                    const isMonthlyResult =
                      observation.metric === "MONTHLY_RESULT";
                    const href =
                      buildUnusualMonthTransactionsHref(observation);

                    return (
                      <li
                        key={observation.id}
                        className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {metricLabel(observation)}
                            </p>
                            <Badge variant="outline">
                              {observation.direction === "HIGH"
                                ? "Higher than usual"
                                : "Lower than usual"}
                            </Badge>
                            {observation.isArchivedCategory ? (
                              <Badge variant="outline">Archived</Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Actual{" "}
                            <span className="font-mono font-medium text-foreground">
                              {formatMoney(
                                formatter,
                                observation.actual,
                                isMonthlyResult,
                              )}
                            </span>{" "}
                            · Typical{" "}
                            <span className="font-mono font-medium text-foreground">
                              {formatMoney(
                                formatter,
                                observation.typical,
                                isMonthlyResult,
                              )}
                            </span>
                          </p>
                        </div>
                        <Link
                          href={href}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "justify-self-start sm:justify-self-end",
                          )}
                        >
                          {investigationLabel(observation)}
                          <ArrowRight />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
