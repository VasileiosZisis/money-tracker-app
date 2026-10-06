"use client";

import Link from "next/link";
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
  useSidebar,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { WorkspaceSidebar } from "@/components/app-shell/workspace-sidebar";

type AppSidebarProps = { displayName: string; initials: string; userImage: string | null };
export function AppSidebar({ displayName, initials, userImage }: AppSidebarProps) {
  const pathname = usePathname();
  const settingsActive = pathname === "/settings" || pathname.startsWith("/settings/");
  // Navigation inside the authenticated footer closes the mobile drawer as before.
  const { isMobile, setOpenMobile } = useSidebar();
  function handleNavigate() { if (isMobile) setOpenMobile(false); }
  return <WorkspaceSidebar items={appNavItems} homeHref="/dashboard" footer={(
<>
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
</>
  )} />;
}
