import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SpendingComposition } from "./spending-composition";
import type { SpendingCompositionInsight } from "@/lib/insights/spending-history";
import { displayFormatter, type MoneyPresentation } from "./display-money";
export function SpendingCompositionCard({ spendingComposition, currency, header, display }: {
  header?: ReactNode;
  spendingComposition: SpendingCompositionInsight; currency: string; display: MoneyPresentation;
}) {
  const formatter = displayFormatter(display);
  return (
        <Card>
          {header}
          {spendingComposition.categories.length > 0 ? (
            <CardHeader>
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-muted-foreground">
                  Total expenses
                </span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {formatter.format(Number(spendingComposition.totalExpenses))}
                </span>
              </div>
            </CardHeader>
          ) : null}
          <CardContent className="pt-4">
            {spendingComposition.categories.length > 0 ? (
              <SpendingComposition
                categories={spendingComposition.categories}
                currency={currency}
              />
            ) : (
              <EmptyState
                icon={BarChart3}
                title="No completed spending to break down"
                description="Expense transactions from completed months will appear here"
              />
            )}
          </CardContent>
        </Card>
  );
}
