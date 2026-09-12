import { Badge } from "@/components/ui/badge";
import type { SpendingCompositionCategory } from "@/lib/insights/spending-history";

export function SpendingComposition({
  categories,
  currency,
}: {
  categories: SpendingCompositionCategory[];
  currency: string;
}) {
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  });

  return (
    <ol className="grid gap-4">
      {categories.map((category, index) => (
        <li key={category.categoryId} className="grid gap-2">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
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
            <div className="ml-7 flex shrink-0 items-baseline gap-3 text-right sm:ml-0">
              <span className="font-mono text-sm font-semibold text-foreground">
                {formatter.format(Number(category.total))}
              </span>
              <span className="w-12 font-mono text-sm text-muted-foreground">
                {category.sharePercent.toFixed(1)}%
              </span>
            </div>
          </div>
          <div
            className="ml-7 h-2 overflow-hidden rounded-full bg-muted"
            aria-hidden="true"
          >
            <div
              className="h-full min-w-px rounded-full bg-primary"
              style={{ width: `${category.sharePercent}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
