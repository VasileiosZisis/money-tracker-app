import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import type { MouseEvent } from "react";
import { displayFormatter, displaySignedMoney, type MoneyPresentation } from "./display-money";

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
import type {
  UnusualMonthObservation,
  UnusualMonthsInsight,
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

export function UnusualMonthsView({
  insight,
  display, transactionHrefs, onTransactionClick, disabled = false,
  historyPeriodLabel,
}: {
  insight: UnusualMonthsInsight;
  display: MoneyPresentation;
  transactionHrefs: Record<string, string>;
  onTransactionClick?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  disabled?: boolean;
  historyPeriodLabel: string;
}) {
  const formatter = displayFormatter(display);
  return (
    <Card>
      <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-muted-foreground">History Period:</span>
          <span>{historyPeriodLabel}</span>
        </CardTitle>
        {insight.completedMonthCount > 0 ? (
          <span className="text-sm text-muted-foreground">
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
                  <h3 className="text-sm font-semibold text-foreground">
                    {formatMonthLabel(month.month)}
                  </h3>
                </div>
                <ul className="divide-y divide-border/60">
                  {month.observations.map((observation) => {
                    const isMonthlyResult =
                      observation.metric === "MONTHLY_RESULT";
                    const href =
                      transactionHrefs[observation.id];

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
                            <Badge variant="outline" className="text-sm">
                              {observation.direction === "HIGH"
                                ? "Higher than usual"
                                : "Lower than usual"}
                            </Badge>
                            {observation.isArchivedCategory ? (
                              <Badge variant="outline" className="text-sm">
                                Archived
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Actual{" "}
                            <span className="font-mono font-medium text-foreground">
                              {(isMonthlyResult ? displaySignedMoney(display, observation.actual) : formatter.format(observation.actual))}
                            </span>{" "}
                            · Typical{" "}
                            <span className="font-mono font-medium text-foreground">
                              {(isMonthlyResult ? displaySignedMoney(display, observation.typical) : formatter.format(observation.typical))}
                            </span>
                          </p>
                        </div>
                        <Link
                          href={href}
                          aria-disabled={disabled}
                          onClick={onTransactionClick ? (event) => onTransactionClick(event, href) : undefined}
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
