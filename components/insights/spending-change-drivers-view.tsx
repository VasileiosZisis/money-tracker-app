import { displayFormatter, displaySignedMoney, type MoneyPresentation } from "./display-money";

import { Badge } from "@/components/ui/badge";
import type { SpendingChangeCategory } from "@/lib/insights/spending-history";

function formatSignedPercent(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function SpendingChangeDriversView({
  categories,
  display, bars,
}: {
  categories: SpendingChangeCategory[];
  display: MoneyPresentation;
  bars: Record<string, { direction: number; width: number }>;
}) {
  const formatter = displayFormatter(display);
  return (
    <div className="grid gap-3">
      <div className="ml-7 grid grid-cols-2 text-sm text-muted-foreground">
        <span className="pr-2 text-right">Decrease</span>
        <span className="pl-2">Increase</span>
      </div>
      <ol className="grid gap-5">
        {categories.map((category, index) => {
          const { direction: change, width } = bars[category.categoryId];
          return (
            <li key={category.categoryId} className="grid gap-2">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-right font-mono text-sm text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="truncate text-sm font-medium text-foreground">
                    {category.categoryName}
                  </span>
                  {category.isArchived ? (
                    <Badge variant="outline" className="shrink-0 text-sm">
                      Archived
                    </Badge>
                  ) : null}
                </div>

                <div className="ml-7 grid grid-cols-2 gap-5 sm:ml-0 sm:text-right">
                  <div>
                    <p className="font-mono text-sm font-semibold text-foreground">
                      {displaySignedMoney(display, category.change)}
                    </p>
                    <p className="text-sm text-muted-foreground">Change</p>
                  </div>
                  <div>
                    <p className="font-mono text-sm font-semibold text-foreground">
                      {formatSignedPercent(category.contributionPercent)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Contribution
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
                Monthly average: {formatter.format(
                  Number(category.previousMonthlyAverage),
                )} to {formatter.format(Number(category.recentMonthlyAverage))}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
