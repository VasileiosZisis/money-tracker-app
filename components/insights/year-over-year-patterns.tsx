import type { ReactNode } from "react";
import type { LongTermPatternsInsight } from "@/lib/insights/long-term-patterns";
import { buildChangeBars, buildMoneyPresentation } from "@/lib/presentation/money";
import { YearOverYearPatternsView } from "./year-over-year-patterns-view";
export function YearOverYearPatterns({ insight, currency, header }: { insight: LongTermPatternsInsight; currency: string; header?: ReactNode }) {
  return <YearOverYearPatternsView insight={insight} header={header} display={buildMoneyPresentation(insight, currency)} bars={buildChangeBars(insight.categories)} />;
}
