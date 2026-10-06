import type { ComponentProps, MouseEventHandler } from "react";
import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MonthlyResultChart } from "./monthly-result-chart";
import type { MonthlyResultInsight } from "@/lib/insights/spending-history";
import { displayFormatter, displaySignedMoney, type MoneyPresentation } from "./display-money";

export function MonthlyResultCard({ monthlyResultInsight, monthlyResultChartData, completedPeriodLabel, currency, display, transactionsHref, onTransactionClick, disabled = false }: {
  monthlyResultInsight: MonthlyResultInsight;
  monthlyResultChartData: ComponentProps<typeof MonthlyResultChart>["data"];
  completedPeriodLabel: string; currency: string; display: MoneyPresentation; transactionsHref: string;
  onTransactionClick?: MouseEventHandler<HTMLAnchorElement>; disabled?: boolean;
}) {
  const formatter = displayFormatter(display);
  const isNegative = (amount: string) => display.signs[amount] < 0;
  const isPositive = (amount: string) => display.signs[amount] > 0;
  return (
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
              currency={currency}
              data={monthlyResultChartData}
            />
          ) : (
            <EmptyState
              icon={BarChart3}
              title="No monthly activity yet"
              description="Add income or expense transactions to establish a monthly result history"
              action={(
                <Link
                  href={transactionsHref}
                  onClick={onTransactionClick}
                  aria-disabled={disabled}
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
                    isNegative(monthlyResultInsight.typicalMonthlyResult)
                    ? "text-destructive"
                    : monthlyResultInsight.typicalMonthlyResult !== null &&
                        isPositive(
                          monthlyResultInsight.typicalMonthlyResult,
                        )
                      ? "text-success"
                      : "text-foreground",
                )}
              >
                {monthlyResultInsight.typicalMonthlyResult === null
                  ? "—"
                  : displaySignedMoney(
                      display,
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
                  : formatter.format(monthlyResultInsight.breakEvenGap)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {monthlyResultInsight.breakEvenGap === null
                  ? "Complete a month to establish a baseline"
                  : isPositive(monthlyResultInsight.breakEvenGap)
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
  );
}
