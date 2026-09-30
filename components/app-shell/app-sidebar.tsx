"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Settings2 } from "lucide-react";

import { appNavItems } from "@/components/app-shell/nav-items";
import SignOutButton from "@/components/auth/SignOutButton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  displayName: string;
  initials: string;
  userImage: string | null;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ displayName, initials, userImage }: AppSidebarProps) {
  const pathname = usePathname();
  const { isMobile, open, openMobile, setOpenMobile } = useSidebar();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const expanded = isMobile ? openMobile : open;
  const previousSidebarState = useRef({ isMobile, expanded });
  const settingsActive = isActivePath(pathname, "/settings");

  useEffect(() => {
    const previous = previousSidebarState.current;
    if (previous.isMobile === isMobile && !previous.expanded && expanded) {
      triggerRef.current?.focus({ preventScroll: true });
    }
    previousSidebarState.current = { isMobile, expanded };
  }, [expanded, isMobile]);

  function handleNavigate() {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader className="flex h-18 shrink-0 items-center gap-2 py-0">
        <SidebarTrigger ref={triggerRef} className="shrink-0" />
        <Link
          href="/dashboard"
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
              {appNavItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link href={item.href} onClick={handleNavigate}>
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
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    aria-label="Open account menu"
                    className="focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 data-popup-open:bg-sidebar-accent data-popup-open:text-foreground"
                  />
                }
              >
                <Avatar className="rounded-lg after:rounded-lg">
                  {userImage ? (
                    <AvatarImage
                      src={userImage}
                      alt={displayName}
                      className="rounded-lg"
                    />
                  ) : null}
                  <AvatarFallback className="rounded-lg font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{displayName}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" sideOffset={8}>
                <DropdownMenuGroup>
                  <SignOutButton variant="menu" />
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={settingsActive}>
              <Link href="/settings" onClick={handleNavigate}>
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg border",
                    settingsActive
                      ? "border-white/15 bg-white/10"
                      : "border-border/50 bg-background/60 text-muted-foreground",
                  )}
                >
                  <Settings2 className="size-4.5" />
                </span>
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem aria-hidden="true" className="h-11" />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
