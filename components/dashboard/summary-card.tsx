import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SummaryValue = { label: string; value: string; tone?: "default" | "success" | "danger" };
export function SummaryCard({ primary, secondary, children, footer }: {
  primary: SummaryValue; secondary: SummaryValue[]; children: ReactNode; footer?: ReactNode;
}) {
  return <Card className="overflow-hidden"><CardContent className="flex flex-col gap-5 p-4"><SummaryValues primary={primary} secondary={secondary} />{children}{footer}</CardContent></Card>;
}

export function SummaryValues({ primary, secondary }: { primary: SummaryValue; secondary: SummaryValue[] }) {
  const color = (tone: SummaryValue["tone"]) => tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : "text-foreground";
  return <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3"><p className="text-sm font-medium text-muted-foreground">{primary.label}</p><p className={cn("font-mono text-4xl font-semibold tracking-tight", color(primary.tone))}>{primary.value}</p></div>
      <div className="flex flex-row flex-wrap items-start gap-6">{secondary.map(value => <div key={value.label} className="flex flex-col"><p className="text-sm font-medium text-muted-foreground">{value.label}</p><p className={cn("font-mono text-xl font-semibold tracking-tight", color(value.tone))}>{value.value}</p></div>)}</div>
    </div>;
}
