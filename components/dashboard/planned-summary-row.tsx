import { CalendarClock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PlannedSummaryRow({ type, category, subcategory, name, amount, dateLabel, statusLabel, statusVariant, archived, handledLabel, paymentSource }: {
  type: "INCOME" | "EXPENSE"; category: string; subcategory?: string | null; name: string; amount: string; dateLabel: string;
  statusLabel?: string; statusVariant?: "success" | "warning" | "destructive" | "outline" | "accent";
  archived?: boolean; handledLabel?: string; paymentSource?: "LINKED" | "GENERATED" | null;
}) {
  const income = type === "INCOME";
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
    <div className="flex min-w-0 items-start gap-3"><div className={cn("mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg", income ? "bg-success/10 text-success" : "bg-accent text-accent-foreground")}>
      {income ? <TrendingUp className="size-4.5" /> : <CalendarClock className="size-4.5" />}
    </div><div className="flex min-w-0 flex-col"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-foreground">{category}</h3>{income && subcategory ? <Badge variant="outline">{subcategory}</Badge> : null}{statusLabel ? <Badge variant={statusVariant}>{statusLabel}</Badge> : null}{archived ? <Badge variant="outline">Archived category</Badge> : null}</div>
      {income ? <p className="text-sm leading-6 text-muted-foreground">{name}</p> : subcategory ? <p className="truncate text-sm leading-6 text-muted-foreground">{subcategory}</p> : null}
      {handledLabel ? <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-medium text-muted-foreground">{handledLabel}</p>{paymentSource ? <Badge variant="outline">{paymentSource === "LINKED" ? "Linked existing transaction" : "Created transaction"}</Badge> : null}</div> : null}
    </div></div><div className="flex shrink-0 flex-col items-end"><p className="text-sm font-medium text-muted-foreground">{dateLabel}</p><p className={cn("font-mono text-base font-semibold tracking-tight", income ? "text-success" : "text-foreground")}>{amount}</p></div>
  </div>;
}
