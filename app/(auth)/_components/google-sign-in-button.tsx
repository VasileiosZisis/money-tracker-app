"use client";

import { signIn } from "next-auth/react";

export function GoogleSignInButton() {
  const handleSignIn = () => {
    void signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <button
      type="button"
      onClick={handleSignIn}
      className="mt-6 w-full rounded-input bg-primary px-4 py-3 text-body-base font-semibold text-surface transition-colors hover:bg-primary-hover"
    >
      Continue with Google
    </button>
  );
}
