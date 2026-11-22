import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  ConsistencyVariationLevel,
  IncomeSpendingConsistencyInsight,
  IncomeSpendingConsistencyMetric,
} from "@/lib/insights/spending-history";
import { cn } from "@/lib/utils";

function variationLabel(
  level: ConsistencyVariationLevel,
  subject: "income" | "spending",
) {
  switch (level) {
    case "LOW":
      return "Low variation";
    case "MODERATE":
      return "Moderate variation";
    case "HIGH":
      return "High variation";
    case "INTERMITTENT":
      return "Intermittent";
    case "NO_ACTIVITY":
      return `No recorded ${subject}`;
  }
}

function variationDescription(metric: IncomeSpendingConsistencyMetric) {
  if (metric.variationLevel === "NO_ACTIVITY") {
    return "No activity in the completed months shown";
  }

  if (metric.variationLevel === "INTERMITTENT") {
    return "The middle half of months was zero, with activity in other months";
  }

  if (metric.variationPercent === null) {
    return "Quartile variation unavailable";
  }

  const variationPercent = Number(metric.variationPercent);
  const roundedPercent = variationPercent.toFixed(1);

  if (metric.variationLevel === "MODERATE" && Number(roundedPercent) <= 10) {
    return ">10% quartile variation";
  }

  if (metric.variationLevel === "HIGH" && Number(roundedPercent) <= 25) {
    return ">25% quartile variation";
  }

  return `${roundedPercent}% quartile variation`;
}

function ConsistencyMetricPanel({
  title,
  subject,
  metric,
  formatter,
}: {
  title: string;
  subject: "income" | "spending";
  metric: IncomeSpendingConsistencyMetric;
  formatter: Intl.NumberFormat;
}) {
  const metricTone = subject === "income" ? "text-chart-1" : "text-chart-2";

  return (
    <div className="grid gap-4 rounded-xl border border-border/70 bg-background/55 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span aria-hidden="true" className={cn("size-2 rounded-full bg-current", metricTone)} />
          {title}
        </h3>
        <Badge variant="outline" className="text-sm">
          {variationLabel(metric.variationLevel, subject)}
        </Badge>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Typical monthly {subject}
        </p>
        <p className={cn("mt-1 wrap-anywhere font-mono text-2xl font-semibold tracking-tight", metricTone)}>
          {formatter.format(Number(metric.typical))}
        </p>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Observed range</dt>
          <dd className="mt-1 font-mono font-medium text-foreground">
            {formatter.format(Number(metric.minimum))} –{" "}
            {formatter.format(Number(metric.maximum))}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Middle 50%</dt>
          <dd className="mt-1 font-mono font-medium text-foreground">
            {formatter.format(Number(metric.lowerQuartile))} –{" "}
            {formatter.format(Number(metric.upperQuartile))}
          </dd>
        </div>
      </dl>

      <p className="text-sm text-muted-foreground">
        {variationDescription(metric)}
      </p>
    </div>
  );
}

export function IncomeSpendingConsistency({
  insight,
  currency,
  header,
}: {
  header?: ReactNode;
  insight: IncomeSpendingConsistencyInsight;
  currency: string;
}) {
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  });

  return (
    <Card>
      {header}
      <CardContent className="pt-4">
        {!insight.hasSufficientHistory ||
        !insight.income ||
        !insight.expenses ||
        !insight.negativeResults ? (
          <EmptyState
            icon={BarChart3}
            title="Not enough completed history"
            description="Complete at least three tracked months to compare income and spending consistency"
          />
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <ConsistencyMetricPanel
                title="Income"
                subject="income"
                metric={insight.income}
                formatter={formatter}
              />
              <ConsistencyMetricPanel
                title="Spending"
                subject="spending"
                metric={insight.expenses}
                formatter={formatter}
              />
            </div>

            <div className="grid gap-3 rounded-xl border border-border/70 bg-chart-3/10 p-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Negative-result context
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {insight.negativeResults.totalMonthCount === 0
                    ? "No negative-result months in this period"
                    : `${insight.negativeResults.totalMonthCount} negative-result ${
                        insight.negativeResults.totalMonthCount === 1
                          ? "month"
                          : "months"
                      } in this period`}
                </p>
              </div>

              {insight.negativeResults.totalMonthCount > 0 ? (
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      Below-typical income only
                    </dt>
                    <dd className="mt-1 font-mono text-xl font-semibold text-foreground">
                      {insight.negativeResults.belowTypicalIncomeOnlyCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      Above-typical spending only
                    </dt>
                    <dd className="mt-1 font-mono text-xl font-semibold text-foreground">
                      {insight.negativeResults.aboveTypicalSpendingOnlyCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      Both patterns
                    </dt>
                    <dd className="mt-1 font-mono text-xl font-semibold text-foreground">
                      {insight.negativeResults.bothCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      Neither pattern
                    </dt>
                    <dd className="mt-1 font-mono text-xl font-semibold text-foreground">
                      {insight.negativeResults.neitherCount}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
