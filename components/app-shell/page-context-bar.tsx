"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { appNavItems } from "@/components/app-shell/nav-items";
import { SidebarTrigger } from "@/components/ui/sidebar";

type DateContext = {
  dateLabel: string;
  dateTime: string;
  daysLeftLabel: string;
};

function getPageLabel(pathname: string) {
  const navItem = appNavItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  if (navItem) {
    return navItem.label;
  }

  const segment = pathname.split("/").filter(Boolean).at(-1);

  if (!segment) {
    return "Dashboard";
  }

  return segment
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function getDateContext(): DateContext {
  const today = new Date();
  const lastDayOfMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();
  const daysLeft = lastDayOfMonth - today.getDate();
  const dateTime = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  return {
    dateLabel: new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(today),
    dateTime,
    daysLeftLabel: `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`,
  };
}

export function PageContextBar() {
  const pathname = usePathname();
  const pageLabel = getPageLabel(pathname);
  const [dateContext, setDateContext] = React.useState<DateContext | null>(null);

  React.useEffect(() => {
    setDateContext(getDateContext());
  }, []);

  return (
    <div className="-mx-3 grid h-18 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-sidebar-border bg-sidebar px-3 sm:-mx-5 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <SidebarTrigger className="lg:hidden" />
        <p
          className="truncate text-xl font-semibold tracking-tight text-foreground"
          aria-label={`Current page: ${pageLabel}`}
        >
          {pageLabel}
        </p>
      </div>

      <time
        className="justify-self-center text-center text-xl font-semibold text-foreground"
        dateTime={dateContext?.dateTime}
      >
        {dateContext?.dateLabel ?? "\u00A0"}
      </time>

      <p className="justify-self-end text-right text-xl font-semibold text-foreground">
        {dateContext?.daysLeftLabel ?? "\u00A0"}
      </p>
    </div>
  );
}
