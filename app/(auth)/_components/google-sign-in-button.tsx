"use client";

import { LogIn } from "lucide-react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const handleSignIn = () => {
    void signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <Button
      onClick={handleSignIn}
      className="mt-6 h-11 w-full justify-center rounded-2xl"
    >
      <LogIn />
      Continue with Google
    </Button>
  );
}
