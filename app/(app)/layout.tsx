import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, ReceiptText, ScrollText } from "lucide-react";

import { AppNavigation } from "@/components/app-shell/app-navigation";
import SignOutButton from "@/components/auth/SignOutButton";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";

function getDisplayName(name: string | null | undefined, email: string | null | undefined) {
  if (name && name.trim().length > 0) {
    return name.trim();
  }

  if (email && email.trim().length > 0) {
    return email.trim();
  }

  return "Money Tracker";
}

function getFirstName(name: string) {
  return name.split(" ")[0] ?? name;
}

function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "MT";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      hasCompletedSetup: true,
      currency: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  if (!user.hasCompletedSetup) {
    redirect("/setup");
  }

  const displayName = getDisplayName(session?.user?.name, session?.user?.email);
  const firstName = getFirstName(displayName);
  const initials = getInitials(displayName);
  const userImage = session?.user?.image ?? null;
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-4 px-4 py-4 sm:px-6 lg:gap-6 lg:px-6 lg:py-6">
        <aside className="hidden w-[292px] shrink-0 lg:block">
          <div
            data-surface="glass"
            className="sticky top-6 flex h-[calc(100vh-3rem)] flex-col rounded-[32px] border border-sidebar-border bg-sidebar/90 p-5 text-sidebar-foreground shadow-surface backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground shadow-floating">
                <ScrollText className="size-5" />
              </div>
              <div className="space-y-0.5">
                <Link href="/dashboard" className="text-base font-semibold tracking-tight">
                  Money Tracker
                </Link>
                <p className="text-sm text-muted-foreground">
                  Personal monthly cash flow
                </p>
              </div>
            </div>

            <div className="mt-8">
              <AppNavigation orientation="desktop" />
            </div>

            <div className="mt-auto space-y-4">
              <div className="rounded-[26px] border border-sidebar-border bg-background/65 p-4">
                <Badge variant="accent" className="w-fit">
                  Base currency
                </Badge>
                <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-foreground">
                  {user.currency}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Designed for fast manual entry and clear month-by-month reviews.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/transactions"
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      "rounded-xl px-3.5",
                    )}
                  >
                    <ReceiptText />
                    New entry
                  </Link>
                  <Link
                    href="/export"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "rounded-xl px-3.5",
                    )}
                  >
                    <Download />
                    Export
                  </Link>
                </div>
              </div>

              <SignOutButton />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-6">
          <header
            data-surface="glass"
            className="rounded-[28px] border border-border/80 bg-card/90 p-4 shadow-surface backdrop-blur-xl sm:p-5"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 lg:hidden">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-floating">
                    <ScrollText className="size-5" />
                  </div>
                  <div className="space-y-0.5">
                    <Link href="/dashboard" className="text-base font-semibold tracking-tight">
                      Money Tracker
                    </Link>
                    <p className="text-sm text-muted-foreground">Personal monthly cash flow</p>
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-2 lg:hidden">
                  <ThemeToggle />
                  <SignOutButton />
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
                    Personal Ledger
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                      Welcome back, {firstName}
                    </h2>
                    <Badge variant="outline">{todayLabel}</Badge>
                  </div>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    Review your monthly position, keep entries organized, and export clean
                    records when needed.
                  </p>
                </div>

                <div className="hidden flex-wrap items-center gap-3 lg:flex">
                  <Link
                    href="/transactions"
                    className={cn(buttonVariants(), "rounded-2xl px-4")}
                  >
                    <ReceiptText />
                    New transaction
                  </Link>
                  <Link
                    href="/export"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "rounded-2xl px-4",
                    )}
                  >
                    <Download />
                    Export CSV
                  </Link>
                  <ThemeToggle />
                  <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/75 px-3 py-2">
                    {userImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={userImage}
                        alt={displayName}
                        className="size-10 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-accent font-semibold text-accent-foreground">
                        {initials}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">{displayName}</p>
                      <p className="text-xs text-muted-foreground">Currency {user.currency}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:hidden">
                <AppNavigation orientation="mobile" />
              </div>
            </div>
          </header>

          <main className="flex-1 pb-6">
            <div className="mx-auto w-full max-w-[1240px] space-y-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
