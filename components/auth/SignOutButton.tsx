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
          "h-auto w-full justify-start gap-3 rounded-2xl px-3.5 py-3 text-sidebar-foreground shadow-none",
          "hover:bg-sidebar-accent hover:text-foreground",
        )}
      >
        <span className="flex size-9 items-center justify-center rounded-xl border border-border/50 bg-background/60 text-muted-foreground">
          <LogOut className="size-[18px]" />
        </span>
        <span className="text-sm font-semibold">Sign Out</span>
      </Button>
    );
  }

  return (
    <Button
      onClick={handleSignOut}
      variant="outline"
      className="rounded-2xl border-border/70 bg-card/80"
    >
      <LogOut />
      Sign Out
    </Button>
  );
}
