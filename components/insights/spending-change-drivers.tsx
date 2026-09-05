import { Prisma } from "@/generated/prisma/client";

import { Badge } from "@/components/ui/badge";
import type { SpendingChangeCategory } from "@/lib/insights/spending-history";

function formatSignedPercent(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatSignedMoney(formatter: Intl.NumberFormat, amount: string) {
  const decimalAmount = new Prisma.Decimal(amount);

  if (decimalAmount.eq(0)) {
    return formatter.format(0);
  }

  const maximumFractionDigits =
    formatter.resolvedOptions().maximumFractionDigits;
  const roundedAbsoluteAmount = decimalAmount
    .abs()
    .toDecimalPlaces(maximumFractionDigits);

  if (roundedAbsoluteAmount.eq(0)) {
    const minimumDisplayUnit = new Prisma.Decimal(
      `1e-${maximumFractionDigits}`,
    );
    const sign = decimalAmount.gt(0) ? "+" : "−";

    return `${sign}<${formatter.format(Number(minimumDisplayUnit.toString()))}`;
  }

  const prefix = decimalAmount.gt(0) ? "+" : "";
  return `${prefix}${formatter.format(Number(decimalAmount.toString()))}`;
}

export function SpendingChangeDrivers({
  categories,
  currency,
}: {
  categories: SpendingChangeCategory[];
  currency: string;
}) {
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  });
  const maximumChange = categories.reduce(
    (maximum, category) =>
      Math.max(maximum, Math.abs(Number(category.change))),
    0,
  );

  return (
    <div className="grid gap-3">
      <div className="ml-7 grid grid-cols-2 text-xs text-muted-foreground">
        <span className="pr-2 text-right">Decrease</span>
        <span className="pl-2">Increase</span>
      </div>
      <ol className="grid gap-5">
        {categories.map((category, index) => {
          const change = Number(category.change);
          const width =
            maximumChange > 0 ? (Math.abs(change) / maximumChange) * 100 : 0;

          return (
            <li key={category.categoryId} className="grid gap-2">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="truncate text-sm font-medium text-foreground">
                    {category.categoryName}
                  </span>
                  {category.isArchived ? (
                    <Badge variant="outline" className="shrink-0">
                      Archived
                    </Badge>
                  ) : null}
                </div>

                <div className="ml-7 grid grid-cols-2 gap-5 sm:ml-0 sm:text-right">
                  <div>
                    <p className="font-mono text-sm font-semibold text-foreground">
                      {formatSignedMoney(formatter, category.change)}
                    </p>
                    <p className="text-xs text-muted-foreground">Change</p>
                  </div>
                  <div>
                    <p className="font-mono text-sm font-semibold text-foreground">
                      {formatSignedPercent(category.contributionPercent)}
                    </p>
                    <p className="text-xs text-muted-foreground">
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

              <p className="ml-7 text-xs text-muted-foreground">
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
