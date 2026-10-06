import { LayoutDashboard, ReceiptText, WalletCards, ChartNoAxesCombined } from "lucide-react";
import type { AppNavItem } from "@/components/app-shell/nav-items";
import { demoHref } from "@/lib/demo/selection";
import type { DemoSelection } from "@/lib/demo/types";

export function demoNavItems(selection: DemoSelection): Array<AppNavItem & { view: DemoSelection["view"] }> {
  return [
    { view: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { view: "transactions" as const, label: "Transactions", icon: ReceiptText },
    { view: "planned" as const, label: "Planned items", icon: WalletCards },
    { view: "insights" as const, label: "Insights", icon: ChartNoAxesCombined },
  ].map(item => ({ ...item, href: demoHref(selection, { view: item.view }), description: "" }));
}
