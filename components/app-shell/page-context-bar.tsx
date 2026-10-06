"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { appNavItems } from "@/components/app-shell/nav-items";
import {
  type AccountDateContext,
} from "@/lib/dates/time-zone";

import { ContextBarView } from "./context-bar-view";
import { watchWorkspaceDate } from "@/lib/dates/watch-workspace-date";

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
  pageLabel: explicitPageLabel,
  fixedCalendar = false,
}: {
  initialDateContext: AccountDateContext;
  timeZone: string;
  pageLabel?: string;
  fixedCalendar?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const pageLabel = explicitPageLabel ?? getPageLabel(pathname);
  const [dateContext, setDateContext] =
    React.useState<AccountDateContext>(initialDateContext);

  React.useEffect(() => watchWorkspaceDate({ fixedCalendar, initialDateContext, timeZone, scheduler: window,
    onDateChange(next) { setDateContext(next); React.startTransition(() => router.refresh()); }
  }), [fixedCalendar, initialDateContext, router, timeZone]);
  return <ContextBarView pageLabel={pageLabel} dateContext={fixedCalendar ? initialDateContext : dateContext} />;
}
