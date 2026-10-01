import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_CURRENCY, demoCategories } from "@/lib/demo/fixtures";
import type { DemoTransaction } from "@/lib/demo/types";

export function money(value: string | null) {
  return value === null ? "Unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: DEMO_CURRENCY }).format(Number(value));
}

export function DemoCard({ title, children }: { title: string; children: ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-4">{children}</CardContent></Card>;
}

export function DemoMetric({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return <div className="min-w-0"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 break-words font-mono text-xl font-semibold">{value}</p>{children}</div>;
}

export function TransactionSummary({ row }: { row: DemoTransaction }) {
  const category = demoCategories.find((item) => item.id === row.categoryId)!;
  const subcategory = category.subcategories.find((item) => item.id === row.subcategoryId)?.name;
  return <div className="flex items-start justify-between gap-3">
    <div className="min-w-0"><p className="text-sm font-semibold">{row.type === "INCOME" ? "↗" : "↘"} {category.name}</p>
      {subcategory || row.note ? <p className="mt-1 break-words text-sm text-muted-foreground">{[subcategory, row.note].filter(Boolean).join(" / ")}</p> : null}
      {row.source ? <p className="mt-1 break-words text-xs text-muted-foreground">{row.source}</p> : null}
    </div>
    <div className="shrink-0 text-right"><p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${row.localDate}T12:00:00Z`))}</p>
      <p className={`font-mono text-base font-semibold ${row.type === "INCOME" ? "text-success" : "text-destructive"}`}>{money(row.amount)}</p>
    </div>
  </div>;
}
