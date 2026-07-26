import { GoogleSignInButton } from "../_components/google-sign-in-button";
import { redirect } from "next/navigation";
import { ArrowRight, FileSpreadsheet, FolderKanban, ScrollText } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function getAuthErrorMessage(error: string | undefined) {
  if (error === "OAuthCallback") {
    return "Google sign-in could not complete. Check the deployed auth host, Google redirect URI, and auth cookies.";
  }

  return "Sign-in could not complete. Please try again.";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();
  const { error } = await searchParams;

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
    <main className="relative flex min-h-screen items-center justify-center px-4 py-5 sm:px-5">
      <div className="absolute right-4 top-4 sm:right-5 sm:top-5">
        <ThemeToggle />
      </div>

      <div className="grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1.1fr)_400px]">
        <Card className="overflow-hidden">
          <CardContent className="flex h-full flex-col justify-between gap-6 p-4 md:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-floating">
                  <ScrollText className="size-5" />
                </div>
                <div>
                  <p className="text-base font-semibold tracking-tight text-foreground">
                    Money Tracker
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Personal monthly cash flow
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Badge variant="accent" className="w-fit">
                  Manual tracking, calmer by design
                </Badge>
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                  Replace the spreadsheet routine with a cleaner monthly workspace.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  Track income and expenses, organize categories, review monthly totals, and
                  export your records when needed.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border/80 bg-background/60 p-4">
                <FolderKanban className="size-5 text-muted-foreground" />
                <p className="mt-4 text-sm font-semibold text-foreground">Organized entries</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Keep income and expense categories under control.
                </p>
              </div>
              <div className="rounded-xl border border-border/80 bg-background/60 p-4">
                <ArrowRight className="size-5 text-muted-foreground" />
                <p className="mt-4 text-sm font-semibold text-foreground">Monthly focus</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Review one month at a time with totals that stay readable.
                </p>
              </div>
              <div className="rounded-xl border border-border/80 bg-background/60 p-4">
                <FileSpreadsheet className="size-5 text-muted-foreground" />
                <p className="mt-4 text-sm font-semibold text-foreground">Clean exports</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Download a CSV whenever you want a portable monthly record.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit lg:my-auto">
          <CardHeader className="pb-0">
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Use Google authentication to access your personal tracker.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-foreground">
                {getAuthErrorMessage(error)}
              </div>
            ) : null}
            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
              <p className="text-sm font-medium text-muted-foreground">What happens next</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                After sign-in, first-time users are redirected to setup to choose a base currency
                and optionally create starter categories.
              </p>
            </div>
            <GoogleSignInButton />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
