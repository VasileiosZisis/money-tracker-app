import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChartNoAxesCombined, ScrollText } from "lucide-react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "CashContour — Personal money tracking",
  description:
    "Record income and expenses, plan monthly bills, and understand your spending history in one calm workspace.",
};

const features = [
  {
    icon: ScrollText,
    title: "Keep your records in order",
    description:
      "Record income and expenses, organize them with categories and subcategories, or bring in your transactions from a CSV.",
  },
  {
    icon: CalendarDays,
    title: "See what’s still ahead",
    description:
      "Plan monthly bills and expected income. Review an explainable safe-to-spend estimate, then mark items paid or received yourself.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Understand your patterns",
    description:
      "Explore monthly cash flow, spending by category, and changes over time with Insights grounded in your recorded transactions.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-5 sm:px-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="CashContour home"
          className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
        >
          <span className="w-10 shrink-0">
            <Image src="/branding/cashcontour-symbol-light.svg" alt="" width={1502} height={920} unoptimized className="block h-auto w-full dark:hidden" />
            <Image src="/branding/cashcontour-symbol-dark.svg" alt="" width={1502} height={920} unoptimized className="hidden h-auto w-full dark:block" />
          </span>
          <span className="w-36 sm:w-40">
            <Image src="/branding/cashcontour-wordmark-light.svg" alt="" width={1973} height={249} unoptimized className="block h-auto w-full dark:hidden" />
            <Image src="/branding/cashcontour-wordmark-dark.svg" alt="" width={1973} height={249} unoptimized className="hidden h-auto w-full dark:block" />
          </span>
        </Link>
        <nav aria-label="Account" className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" prefetch={false} className={buttonVariants({ variant: "outline" })}>
            Sign in
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-6">
        <Card>
          <CardContent className="grid gap-6 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-center md:p-6">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Personal money tracking
              </p>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                A clearer picture of your money, month by month.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                Bring your income, spending, and upcoming bills together in one
                calm workspace. Keep track of what happened and make sense of
                what’s ahead.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/login" prefetch={false} className={buttonVariants({ size: "lg" })}>
                  Get started <ArrowRight aria-hidden="true" />
                </Link>
                <Link href="/demo" className={buttonVariants({ size: "lg", variant: "outline" })}>
                  Try demo
                </Link>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Sign in with Google, then choose your currency and confirm your time zone.
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
              <h2 className="text-lg font-semibold tracking-tight">Your month, in focus</h2>
              <ul className="mt-4 space-y-4">
                <li>
                  <p className="text-sm font-semibold">What came in and went out</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Monthly totals based on the transactions you record.
                  </p>
                </li>
                <li>
                  <p className="text-sm font-semibold">What’s coming up</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Planned bills and income, with handling you control.
                  </p>
                </li>
                <li>
                  <p className="text-sm font-semibold">What you could spend</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    A safe-to-spend estimate that accounts for remaining spending
                    and keeps pending income separate.
                  </p>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <section aria-labelledby="features-heading" className="space-y-4">
          <h2 id="features-heading" className="text-xl font-semibold tracking-tight">
            From everyday entries to the bigger picture
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon aria-hidden="true" className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
        <p>Manual tracking. Your records, your decisions.</p>
        <p>Import and export CSV from Settings.</p>
      </footer>
    </div>
  );
}
