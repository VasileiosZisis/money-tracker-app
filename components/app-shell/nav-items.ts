import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FolderKanban,
  FileDown,
  ReceiptText,
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
    href: "/categories",
    label: "Categories",
    icon: FolderKanban,
    description: "Organize income and expenses",
  },
  {
    href: "/export",
    label: "Export",
    icon: FileDown,
    description: "Download monthly CSV",
  },
];
