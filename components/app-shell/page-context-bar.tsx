"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { appNavItems } from "@/components/app-shell/nav-items";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  getAccountDateContext,
  type AccountDateContext,
} from "@/lib/dates/time-zone";

const DATE_CHECK_INTERVAL_MS = 60 * 1000;

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

export function PageContextBar({
  initialDateContext,
  timeZone,
}: {
  initialDateContext: AccountDateContext;
  timeZone: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const pageLabel = getPageLabel(pathname);
  const [dateContext, setDateContext] =
    React.useState<AccountDateContext>(initialDateContext);

  React.useEffect(() => {
    let previousLocalDate = initialDateContext.localDate;

    function updateDateContext() {
      const nextDateContext = getAccountDateContext(timeZone);

      if (nextDateContext.localDate !== previousLocalDate) {
        previousLocalDate = nextDateContext.localDate;
        setDateContext(nextDateContext);
        React.startTransition(() => {
          router.refresh();
        });
      }
    }

    updateDateContext();
    const intervalId = window.setInterval(
      updateDateContext,
      DATE_CHECK_INTERVAL_MS,
    );

    return () => window.clearInterval(intervalId);
  }, [initialDateContext.localDate, router, timeZone]);

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
        dateTime={dateContext.localDate}
      >
        {dateContext.dateLabel}
      </time>

      <p className="justify-self-end text-right text-xl font-semibold text-foreground">
        {dateContext.daysLeftLabel}
      </p>
    </div>
  );
}
