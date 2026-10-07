"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";


import { type AppNavItem } from "@/components/app-shell/nav-items";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";


export type WorkspaceSidebarProps = {
  items: AppNavItem[];
  homeHref: string;
  activeHref?: string;
  footer?: ReactNode;
  extraContent?: ReactNode;
  disabled?: boolean;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceSidebar({ items, homeHref, activeHref, footer, extraContent, disabled = false, onNavigate }: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const { isMobile, open, openMobile, setOpenMobile } = useSidebar();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const expanded = isMobile ? openMobile : open;
  const previousSidebarState = useRef({ isMobile, expanded });

  useEffect(() => {
    const previous = previousSidebarState.current;
    if (previous.isMobile === isMobile && !previous.expanded && expanded) {
      triggerRef.current?.focus({ preventScroll: true });
    }
    previousSidebarState.current = { isMobile, expanded };
  }, [expanded, isMobile]);

  function handleNavigate(event: MouseEvent<HTMLAnchorElement>) {
    if (disabled) { event.preventDefault(); return; }
    onNavigate?.(event, event.currentTarget.getAttribute("href") ?? homeHref);
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader className="flex h-18 shrink-0 items-center gap-2 py-0">
        <SidebarTrigger ref={triggerRef} className="shrink-0" />
        <Link
          href={homeHref}
          aria-label="CashContour home"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
          onClick={handleNavigate}
        >
          <span className="w-[43.2px] shrink-0">
            <Image src="/branding/cashcontour-symbol-light.svg" alt="" width={1502} height={920} unoptimized className="block h-auto w-full dark:hidden" />
            <Image src="/branding/cashcontour-symbol-dark.svg" alt="" width={1502} height={920} unoptimized className="hidden h-auto w-full dark:block" />
          </span>
          <span className="min-w-0 max-w-[165.6px] flex-1">
            <Image src="/branding/cashcontour-wordmark-light.svg" alt="" width={1973} height={249} unoptimized className="block h-auto w-full dark:hidden" />
            <Image src="/branding/cashcontour-wordmark-dark.svg" alt="" width={1973} height={249} unoptimized className="hidden h-auto w-full dark:block" />
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="mt-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = activeHref ? activeHref === item.href : isActivePath(pathname, item.href);
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link href={item.href} onClick={handleNavigate} aria-current={active ? "page" : undefined} aria-disabled={disabled} tabIndex={disabled ? -1 : undefined}>
                        <span
                          className={
                            active
                              ? "flex size-8 items-center justify-center rounded-lg border border-white/15 bg-white/10"
                              : "flex size-8 items-center justify-center rounded-lg border border-border/50 bg-background/60 text-muted-foreground"
                          }
                        >
                          <Icon className="size-4.5" />
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {extraContent}
      </SidebarContent>

      {footer ? <SidebarFooter>{footer}</SidebarFooter> : null}
    </Sidebar>
  );
}
