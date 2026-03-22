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
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,1.1fr)_420px]">
        <Card className="overflow-hidden">
          <CardContent className="flex h-full flex-col justify-between gap-10 p-8 md:p-10">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-floating">
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
              <div className="rounded-[24px] border border-border/80 bg-background/60 p-4">
                <FolderKanban className="size-5 text-muted-foreground" />
                <p className="mt-4 text-sm font-semibold text-foreground">Organized entries</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Keep income and expense categories under control.
                </p>
              </div>
              <div className="rounded-[24px] border border-border/80 bg-background/60 p-4">
                <ArrowRight className="size-5 text-muted-foreground" />
                <p className="mt-4 text-sm font-semibold text-foreground">Monthly focus</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Review one month at a time with totals that stay readable.
                </p>
              </div>
              <div className="rounded-[24px] border border-border/80 bg-background/60 p-4">
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
          <CardContent className="space-y-6 pt-6">
            <div className="rounded-[24px] border border-border/80 bg-background/60 p-4">
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
