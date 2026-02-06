import { GoogleSignInButton } from "../_components/google-sign-in-button";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function LoginPage() {
  const session = await getSession();

  if (session?.user?.id) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { hasCompletedSetup: true },
    });

    if (user?.hasCompletedSetup) {
      redirect("/dashboard");
    }

    if (user && !user.hasCompletedSetup) {
      redirect("/setup");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <section className="w-full max-w-md rounded-card border border-border bg-surface p-6">
        <h1 className="text-title-page text-text-primary">Money Tracker</h1>
        <p className="mt-2 text-body-base text-text-secondary">
          Sign in with Google to continue.
        </p>
        <GoogleSignInButton />
      </section>
    </main>
  );
}
