"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export default function SignOutButton() {
  const handleSignOut = () => {
    void signOut({ callbackUrl: "/login" });
  };

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
