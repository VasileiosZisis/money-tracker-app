import { redirect } from "next/navigation";
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
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-6xl p-4">{children}</main>
    </div>
  );
}
