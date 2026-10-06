import type { SpendingChangeCategory } from "@/lib/insights/spending-history";
import { buildChangeBars, buildMoneyPresentation } from "@/lib/presentation/money";
import { SpendingChangeDriversView } from "./spending-change-drivers-view";
export function SpendingChangeDrivers({ categories, currency }: { categories: SpendingChangeCategory[]; currency: string }) {
  return <SpendingChangeDriversView categories={categories} display={buildMoneyPresentation(categories, currency, true)} bars={buildChangeBars(categories)} />;
}
