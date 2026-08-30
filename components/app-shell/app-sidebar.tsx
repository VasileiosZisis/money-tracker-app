"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollText, Settings2 } from "lucide-react";

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
  const { isMobile, setOpenMobile } = useSidebar();
  const settingsActive = isActivePath(pathname, "/settings");

  function handleNavigate() {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={handleNavigate}>
          <div className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-floating">
            <ScrollText className="size-5" />
          </div>
          <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
            Money Tracker
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
