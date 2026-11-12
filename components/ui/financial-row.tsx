import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function FinancialListItem({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-border/80 bg-background/60 p-3">
      {children}
    </div>
  );
}

export function FinancialRow({ type, category, secondary, dateLabel, amount, planned = false, truncateSecondary = false, archived = false, heading }: {
  type: "INCOME" | "EXPENSE"; category: string; secondary?: string | null; dateLabel: string; amount: string; planned?: boolean; truncateSecondary?: boolean; archived?: boolean; heading?: "p" | "h3";
}) {
  const income = type === "INCOME";
  const Heading = heading ?? (planned ? "h3" : "p");
  const categoryHeading = <Heading className="wrap-anywhere text-sm font-semibold tracking-tight text-foreground">{category}</Heading>;
  return <div className={planned ? "flex min-w-0 items-center justify-between gap-4" : "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"}>
    <div className={cn("flex min-w-0 gap-3", planned ? "items-center" : "items-start")}>
      <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", !planned && "mt-1", income ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
        {income ? <TrendingUp className="size-4.5" /> : <TrendingDown className="size-4.5" />}
      </div>
      <div className="flex min-w-0 flex-col">{archived ? <div className="flex flex-wrap items-center gap-2">{categoryHeading}<Badge variant="outline">Archived category</Badge></div> : categoryHeading}{secondary ? <p className={cn("text-sm leading-6 text-muted-foreground", truncateSecondary ? "truncate" : "wrap-anywhere")}>{secondary}</p> : null}</div>
    </div>
    <div className="flex shrink-0 flex-col items-end"><p className="text-sm font-medium text-muted-foreground">{dateLabel}</p><p className={cn("font-mono text-base font-semibold tracking-tight", income ? "text-success" : "text-destructive")}>{amount}</p></div>
  </div>;
}
