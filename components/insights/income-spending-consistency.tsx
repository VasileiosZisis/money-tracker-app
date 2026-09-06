import { BarChart3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  ConsistencyVariationLevel,
  IncomeSpendingConsistencyInsight,
  IncomeSpendingConsistencyMetric,
} from "@/lib/insights/spending-history";

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
  return (
    <div className="grid gap-4 rounded-xl border border-border/70 bg-background/55 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <Badge variant="outline">
          {variationLabel(metric.variationLevel, subject)}
        </Badge>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Typical monthly {subject}
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-foreground">
          {formatter.format(Number(metric.typical))}
        </p>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Observed range</dt>
          <dd className="mt-1 font-mono font-medium text-foreground">
            {formatter.format(Number(metric.minimum))} –{" "}
            {formatter.format(Number(metric.maximum))}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Middle 50%</dt>
          <dd className="mt-1 font-mono font-medium text-foreground">
            {formatter.format(Number(metric.lowerQuartile))} –{" "}
            {formatter.format(Number(metric.upperQuartile))}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">
        {variationDescription(metric)}
      </p>
    </div>
  );
}

export function IncomeSpendingConsistency({
  insight,
  currency,
}: {
  insight: IncomeSpendingConsistencyInsight;
  currency: string;
}) {
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  });

  return (
    <Card>
      <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Income and spending consistency</CardTitle>
        {insight.completedMonthCount > 0 ? (
          <span className="text-xs text-muted-foreground">
            {insight.completedMonthCount} completed{" "}
            {insight.completedMonthCount === 1 ? "month" : "months"}
          </span>
        ) : null}
      </CardHeader>
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

            <div className="grid gap-3 rounded-xl border border-border/70 bg-background/55 p-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Negative-result context
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
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
                    <dt className="text-xs text-muted-foreground">
                      Below-typical income only
                    </dt>
                    <dd className="mt-1 font-mono text-xl font-semibold text-foreground">
                      {insight.negativeResults.belowTypicalIncomeOnlyCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Above-typical spending only
                    </dt>
                    <dd className="mt-1 font-mono text-xl font-semibold text-foreground">
                      {insight.negativeResults.aboveTypicalSpendingOnlyCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Both patterns
                    </dt>
                    <dd className="mt-1 font-mono text-xl font-semibold text-foreground">
                      {insight.negativeResults.bothCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
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
