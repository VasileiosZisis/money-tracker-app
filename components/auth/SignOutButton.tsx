"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

type SignOutButtonProps = {
  variant?: "default" | "menu";
};

export default function SignOutButton({
  variant = "default",
}: SignOutButtonProps) {
  const handleSignOut = () => {
    void signOut({ callbackUrl: "/login" });
  };

  if (variant === "menu") {
    return (
      <DropdownMenuItem onClick={handleSignOut}>
        <LogOut />
        Sign out
      </DropdownMenuItem>
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
