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
      className="mt-4 h-10 w-full justify-center rounded-lg"
    >
      <LogIn />
      Continue with Google
    </Button>
  );
}
