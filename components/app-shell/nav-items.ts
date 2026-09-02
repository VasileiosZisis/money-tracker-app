import type { LucideIcon } from "lucide-react";
import {
  ChartNoAxesCombined,
  LayoutDashboard,
  FolderKanban,
  ReceiptText,
  WalletCards,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const appNavItems: AppNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Monthly snapshot",
  },
  {
    href: "/transactions",
    label: "Transactions",
    icon: ReceiptText,
    description: "Add and review entries",
  },
  {
    href: "/insights",
    label: "Insights",
    icon: ChartNoAxesCombined,
    description: "Compare spending over time",
  },
  {
    href: "/categories",
    label: "Categories",
    icon: FolderKanban,
    description: "Organize income and expenses",
  },
  {
    href: "/planned",
    label: "Planned",
    icon: WalletCards,
    description: "Expected monthly bills and income",
  },
];
