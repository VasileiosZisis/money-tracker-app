"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { appNavItems } from "@/components/app-shell/nav-items";
import { cn } from "@/lib/utils";

export type AppNavigationProps = {
  orientation: "desktop" | "mobile";
};

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation({ orientation }: AppNavigationProps) {
  const pathname = usePathname();

  if (orientation === "desktop") {
    return (
      <nav className="flex flex-col gap-1.5">
        {appNavItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-start gap-3 rounded-2xl px-3.5 py-3 transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-floating"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-9 items-center justify-center rounded-xl border transition-colors",
                  active
                    ? "border-white/15 bg-white/10"
                    : "border-border/50 bg-background/60 text-muted-foreground group-hover:text-foreground",
                )}
              >
                <Icon className="size-[18px]" />
              </span>
              <span className="space-y-0.5">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span
                  className={cn(
                    "block text-xs",
                    active
                      ? "text-sidebar-primary-foreground/75"
                      : "text-muted-foreground",
                  )}
                >
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {appNavItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex min-w-fit items-center gap-2 rounded-full border px-3.5 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary/15 bg-accent text-accent-foreground"
                : "border-border bg-background/70 text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
