import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMonthLabel } from "@/lib/dates/month";
import type { SpendingChangeInsight } from "@/lib/insights/spending-history";
import { SpendingChangeDriversView } from "./spending-change-drivers-view";
import { displayFormatter, displaySignedMoney, type MoneyPresentation } from "./display-money";
const formatCompletedMonthRange = (start: string, end: string) => `${formatMonthLabel(start)} – ${formatMonthLabel(end)}`;
export function SpendingChangeCard({ spendingChange, display, bars, controls }: {
  spendingChange: SpendingChangeInsight; display: MoneyPresentation; bars: Record<string, { direction: number; width: number }>; controls: ReactNode;
}) {
  const formatter = displayFormatter(display);
  const isNegative = (amount: string) => display.signs[amount] < 0;
  const isPositive = (amount: string) => display.signs[amount] > 0;
  return (
        <Card>
          <CardHeader className="gap-3 lg:flex-row lg:items-end">
            {controls}
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
                      {displaySignedMoney(
                        display,
                        spendingChange.averageMonthlyChange,
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isPositive(spendingChange.averageMonthlyChange)
                        ? "Increase in monthly expenses"
                        : isNegative(spendingChange.averageMonthlyChange)
                          ? "Decrease in monthly expenses"
                          : "No change in monthly expenses"}
                    </p>
                  </div>
                </div>

                {spendingChange.categories.length > 0 ? (
                  <div className="grid gap-3">
                    <SpendingChangeDriversView
                      categories={spendingChange.categories}
                      display={display}
                      bars={bars}
                    />
                    {!isPositive(spendingChange.averageMonthlyChange) &&
                    !isNegative(spendingChange.averageMonthlyChange) ? (
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
  );
}
