import type { ReactNode } from "react";
import { UnusualMonthsView } from "./unusual-months-view";
import { buildMoneyPresentation } from "@/lib/presentation/money";
import { buildUnusualMonthTransactionsHref, type UnusualMonthsInsight } from "@/lib/insights/unusual-months";
export function UnusualMonths({ insight, currency, header }: { insight: UnusualMonthsInsight; currency: string; header?: ReactNode }) {
  const transactionHrefs = Object.fromEntries(insight.months.flatMap(month => month.observations.map(row => [row.id, buildUnusualMonthTransactionsHref(row)])));
  return <UnusualMonthsView insight={insight} header={header} display={buildMoneyPresentation(insight, currency)} transactionHrefs={transactionHrefs} />;
}
