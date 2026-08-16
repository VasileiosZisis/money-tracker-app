import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getAuthenticatedUserPreferences } from "@/lib/auth/session";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUserPreferences();

  if (user.hasCompletedSetup && user.timeZone) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen px-4 py-5 sm:px-5">
      <div className="absolute right-4 top-4 sm:right-5 sm:top-5">
        <ThemeToggle />
      </div>
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        {children}
      </main>
    </div>
  );
}
