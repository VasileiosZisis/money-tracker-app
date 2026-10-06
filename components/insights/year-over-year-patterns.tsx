import type { LongTermPatternsInsight } from "@/lib/insights/long-term-patterns";
import { buildChangeBars, buildMoneyPresentation } from "@/lib/presentation/money";
import { YearOverYearPatternsView } from "./year-over-year-patterns-view";
export function YearOverYearPatterns({ insight, currency }: { insight: LongTermPatternsInsight; currency: string }) {
  return <YearOverYearPatternsView insight={insight} display={buildMoneyPresentation(insight, currency)} bars={buildChangeBars(insight.categories)} />;
}
