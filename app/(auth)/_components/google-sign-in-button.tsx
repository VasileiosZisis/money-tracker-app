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
      className="login-google-button"
    >
      <LogIn aria-hidden="true" />
      Continue with Google
    </Button>
  );
}
