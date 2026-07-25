"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  variant?: "default" | "sidebar";
};

export default function SignOutButton({
  variant = "default",
}: SignOutButtonProps) {
  const handleSignOut = () => {
    void signOut({ callbackUrl: "/login" });
  };

  if (variant === "sidebar") {
    return (
      <Button
        onClick={handleSignOut}
        variant="ghost"
        className={cn(
          "group/menu-button h-auto w-full justify-start gap-2.5 rounded-lg px-3 py-1.5 text-sidebar-foreground shadow-none",
          "hover:bg-sidebar-accent hover:text-foreground",
        )}
      >
        <span className="flex size-8 items-center justify-center rounded-lg border border-border/50 bg-background/60 text-muted-foreground transition-colors group-hover/menu-button:text-foreground">
          <LogOut className="size-4.5" />
        </span>
        <span className="text-sm font-semibold">Sign Out</span>
      </Button>
    );
  }

  return (
    <Button
      onClick={handleSignOut}
      variant="outline"
      className="rounded-lg border-border/70 bg-card/80"
    >
      <LogOut />
      Sign Out
    </Button>
  );
}
