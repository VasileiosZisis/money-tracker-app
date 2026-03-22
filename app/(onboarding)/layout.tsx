import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getUserIdOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getUserIdOrThrow();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { hasCompletedSetup: true },
  });

  if (!user) {
    redirect("/login");
  }

  if (user.hasCompletedSetup) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        {children}
      </main>
    </div>
  );
}
