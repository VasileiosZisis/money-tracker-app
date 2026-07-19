"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollText } from "lucide-react";

import { appNavItems } from "@/components/app-shell/nav-items";
import SignOutButton from "@/components/auth/SignOutButton";
import { ThemeToggle } from "@/components/theme/theme-toggle";
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
                          <Icon className="size-[18px]" />
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
            <div className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sidebar-foreground">
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userImage}
                  alt={displayName}
                  className="size-8 rounded-lg object-cover"
                />
              ) : (
                <div className="flex size-8 items-center justify-center rounded-lg border border-border/50 bg-background/60 font-semibold text-muted-foreground">
                  {initials}
                </div>
              )}
              <p className="text-sm font-semibold text-inherit">{displayName}</p>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SignOutButton variant="sidebar" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ThemeToggle variant="sidebar" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
