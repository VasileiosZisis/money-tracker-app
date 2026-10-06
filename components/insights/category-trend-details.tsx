import type { ComponentProps, MouseEvent } from "react";
import Link from "next/link";
import { BarChart3, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { formatMonthLabel } from "@/lib/dates/month";
import { cn } from "@/lib/utils";
import type { SpendingInsight } from "@/lib/insights/spending-history";
import { SpendingTrendsChart } from "./spending-trends-chart";
import { displayFormatter, displaySignedMoney, type MoneyPresentation } from "./display-money";

export function CategoryTrendDetails({ insight, comparison, selectedCategory, completedPeriodLabel, chartData, historyRows, currency, display, currentTransactionsHref, transactionHrefs, onTransactionClick, disabled = false }: {
  insight: SpendingInsight; comparison: { value: string; description: string }; selectedCategory: { id: string; name: string };
  completedPeriodLabel: string; chartData: ComponentProps<typeof SpendingTrendsChart>["data"]; historyRows: SpendingInsight["months"];
  currency: string; display: MoneyPresentation; currentTransactionsHref: string; transactionHrefs: Record<string, string>;
  onTransactionClick?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void; disabled?: boolean;
}) {
  const formatter = displayFormatter(display);
  const isNegative = (amount: string) => display.signs[amount] < 0;
  return <>
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
              currency={currency}
              data={chartData}
            />
          ) : (
            <EmptyState
              icon={BarChart3}
              title={`No ${selectedCategory.name} spending in this period`}
              description="The monthly context below remains available, and new transactions will appear here automatically"
              action={(
                <Link
                  aria-disabled={disabled}
                  onClick={onTransactionClick ? (event) => onTransactionClick(event, event.currentTarget.getAttribute("href") ?? currentTransactionsHref) : undefined}
                  href={currentTransactionsHref}
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
                  const transactionsHref = transactionHrefs[month.month];

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
                          isNegative(month.actualNet)
                            ? "text-destructive"
                            : "text-foreground",
                        )}
                      >
                        {displaySignedMoney(display, month.actualNet)}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <Link
                  aria-disabled={disabled}
                  onClick={onTransactionClick ? (event) => onTransactionClick(event, event.currentTarget.getAttribute("href") ?? currentTransactionsHref) : undefined}
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
                        isNegative(month.actualNet)
                          ? "text-destructive"
                          : "text-foreground",
                      )}
                    >
                      {displaySignedMoney(display, month.actualNet)}
                    </p>
                  </div>
                </div>
                <Link
                  aria-disabled={disabled}
                  onClick={onTransactionClick ? (event) => onTransactionClick(event, event.currentTarget.getAttribute("href") ?? currentTransactionsHref) : undefined}
                  href={transactionHrefs[month.month]}
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


  </>;
}
