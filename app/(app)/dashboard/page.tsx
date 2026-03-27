import { Prisma } from "@/generated/prisma/client";
import {
  ArrowRight,
  Download,
  FolderClock,
  Plus,
  ReceiptText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { getDashboardMonthData } from "@/actions/dashboard";
import { PageHeader } from "@/components/app-shell/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatMonthLabel } from "@/lib/dates/month";
import { cn } from "@/lib/utils";

type DashboardPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
  }>;
};

function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function normalizeMonthParam(monthParam: string | string[] | undefined): string {
  const raw = Array.isArray(monthParam) ? monthParam[0] : monthParam;

  if (!raw) {
    return getCurrentMonthKey();
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    return getCurrentMonthKey();
  }

  return raw;
}

function formatMoney(formatter: Intl.NumberFormat, amount: Prisma.Decimal) {
  return formatter.format(Number(amount.toString()));
}

function getNetTone(netLeft: Prisma.Decimal) {
  if (netLeft.gt(0)) {
    return {
      badgeVariant: "success" as const,
      label: "Positive month",
      textClassName: "text-success",
    };
  }

  if (netLeft.lt(0)) {
    return {
      badgeVariant: "destructive" as const,
      label: "Overspent",
      textClassName: "text-destructive",
    };
  }

  return {
    badgeVariant: "outline" as const,
    label: "Break-even",
    textClassName: "text-foreground",
  };
}

function getSourceOrNote(source: string | null, note: string | null) {
  if (source && source.trim().length > 0) {
    return source.trim();
  }

  if (note && note.trim().length > 0) {
    return note.trim();
  }

  return "No extra note";
}

function formatLocalDate(localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getRatio(value: Prisma.Decimal, total: Prisma.Decimal) {
  if (total.lte(0)) {
    return 0;
  }

  return Number(value.dividedBy(total).mul(100).toDecimalPlaces(1).toString());
}

function StatCard({
  title,
  value,
  helper,
  tone = "default",
  progressValue,
  progressClassName,
  icon,
}: {
  title: string;
  value: string;
  helper: string;
  tone?: "default" | "success" | "danger";
  progressValue?: number;
  progressClassName?: string;
  icon: React.ReactNode;
}) {
  const toneClassName =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-destructive"
        : "text-foreground";

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn("font-mono text-2xl font-semibold tracking-tight", toneClassName)}>
              {value}
            </p>
          </div>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            {icon}
          </div>
        </div>
        {typeof progressValue === "number" ? (
          <div className="space-y-2">
            <Progress value={progressValue} indicatorClassName={progressClassName} />
            <p className="text-sm leading-6 text-muted-foreground">{helper}</p>
          </div>
        ) : (
          <p className="mt-auto text-sm leading-6 text-muted-foreground">{helper}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedMonth = normalizeMonthParam(resolvedSearchParams?.month);
  const data = await getDashboardMonthData(selectedMonth);

  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: data.currency,
  });

  const netTone = getNetTone(data.netLeft);
  const expenseShare = getRatio(data.expenseSum, data.incomeSum);
  const savingsRate = getRatio(
    data.netLeft.gt(0) ? data.netLeft : new Prisma.Decimal(0),
    data.incomeSum,
  );
  const latestTransaction = data.recentTransactions[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Monthly snapshot"
        description={`A calmer view of ${formatMonthLabel(
          selectedMonth,
        )}, centered on how much came in, how much went out, and what remains.`}
        actions={
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="space-y-1.5">
              <label htmlFor="month" className="text-sm font-medium text-foreground">
                Month
              </label>
              <Input id="month" type="month" name="month" defaultValue={selectedMonth} />
            </div>
            <button className={buttonVariants({ size: "default" })} type="submit">
              Apply
            </button>
          </form>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
        <Card className="overflow-hidden">
          <CardContent className="grid gap-8 p-6 md:grid-cols-[minmax(0,1.15fr)_280px] md:p-7">
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={netTone.badgeVariant}>{netTone.label}</Badge>
                  <Badge variant="outline">{formatMonthLabel(selectedMonth)}</Badge>
                  <Badge variant="outline">Currency {data.currency}</Badge>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Net left</p>
                  <div className="space-y-2">
                    <p
                      className={cn(
                        "font-mono text-4xl font-semibold tracking-tight sm:text-5xl",
                        netTone.textClassName,
                      )}
                    >
                      {formatMoney(formatter, data.netLeft)}
                    </p>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      {data.netLeft.gt(0)
                        ? "Income currently covers spending for the selected month."
                        : data.netLeft.lt(0)
                          ? "Expenses currently exceed income for the selected month."
                          : "Income and expenses are currently balanced."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-border/80 bg-background/65 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Expense load</p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                        {data.incomeSum.gt(0) ? `${expenseShare.toFixed(1)}%` : "0%"}
                      </p>
                    </div>
                    <TrendingDown className="size-5 text-muted-foreground" />
                  </div>
                  <Progress
                    value={expenseShare}
                    className="mt-4"
                    indicatorClassName="bg-destructive"
                  />
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    The share of this month&apos;s income already consumed by expenses.
                  </p>
                </div>

                <div className="rounded-[24px] border border-border/80 bg-background/65 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Savings rate</p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                        {data.incomeSum.gt(0) ? `${savingsRate.toFixed(1)}%` : "0%"}
                      </p>
                    </div>
                    <TrendingUp className="size-5 text-muted-foreground" />
                  </div>
                  <Progress
                    value={savingsRate}
                    className="mt-4"
                    indicatorClassName="bg-success"
                  />
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    The portion of monthly income that still remains after expenses.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/transactions" className={cn(buttonVariants(), "rounded-2xl px-4")}>
                  <Plus />
                  Add transaction
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
              </div>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-[28px] border border-border/80 bg-[linear-gradient(160deg,rgba(229,241,241,0.88),rgba(255,255,255,0.6))] p-5 dark:bg-[linear-gradient(160deg,rgba(120,184,176,0.14),rgba(12,23,38,0.82))]">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Month context</p>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  Keep the essentials visible.
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  This dashboard stays focused on real MVP data: totals, current month health,
                  and recent manual entries.
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-border/80 bg-card/85 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
                    Recent activity
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {latestTransaction
                      ? `Latest entry on ${formatLocalDate(latestTransaction.localDate)}`
                      : "No activity recorded yet"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {latestTransaction
                      ? `${latestTransaction.category.name} / ${getSourceOrNote(
                          latestTransaction.source,
                          latestTransaction.note,
                        )}`
                      : "Start by adding the first transaction for this month."}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/80 bg-card/85 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
                    Entry window
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    Showing the latest {data.recentTransactions.length} transaction
                    {data.recentTransactions.length === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Open the transactions page to view the full list, filter by category, or
                    edit existing entries.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <StatCard
            title="Income total"
            value={formatMoney(formatter, data.incomeSum)}
            helper="All income recorded for the selected month."
            tone="success"
            progressValue={100}
            progressClassName="bg-success"
            icon={<TrendingUp className="size-5" />}
          />
          <StatCard
            title="Expense total"
            value={formatMoney(formatter, data.expenseSum)}
            helper={
              data.incomeSum.gt(0)
                ? `${expenseShare.toFixed(1)}% of recorded income`
                : "Expenses recorded before any income"
            }
            tone="danger"
            progressValue={expenseShare}
            progressClassName="bg-destructive"
            icon={<TrendingDown className="size-5" />}
          />
          <StatCard
            title="Recent entries"
            value={String(data.recentTransactions.length)}
            helper={
              latestTransaction
                ? `Last logged ${formatLocalDate(latestTransaction.localDate)}`
                : "No transactions recorded for this month yet"
            }
            icon={<ReceiptText className="size-5" />}
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-end justify-between gap-4 pb-0">
            <div className="space-y-1.5">
              <CardTitle>Recent transactions</CardTitle>
              <CardDescription>
                The latest entries recorded for {formatMonthLabel(selectedMonth)}.
              </CardDescription>
            </div>
            <Link
              href="/transactions"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "rounded-xl px-0 text-primary hover:bg-transparent",
              )}
            >
              View all
              <ArrowRight />
            </Link>
          </CardHeader>
          <CardContent className="pt-6">
            {data.recentTransactions.length === 0 ? (
              <EmptyState
                icon={FolderClock}
                title="No transactions for this month"
                description="Once you record income or expenses, they'll appear here in reverse chronological order."
                action={
                  <Link href="/transactions" className={buttonVariants({ size: "sm" })}>
                    <Plus />
                    Add transaction
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {data.recentTransactions.map((transaction) => {
                  const amountTone =
                    transaction.type === "INCOME" ? "text-success" : "text-destructive";

                  return (
                    <div
                      key={transaction.id}
                      className="flex flex-col gap-4 rounded-[24px] border border-border/80 bg-background/60 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className={cn(
                            "mt-1 flex size-10 items-center justify-center rounded-2xl",
                            transaction.type === "INCOME"
                              ? "bg-success/10 text-success"
                              : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {transaction.type === "INCOME" ? (
                            <TrendingUp className="size-[18px]" />
                          ) : (
                            <TrendingDown className="size-[18px]" />
                          )}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              {transaction.category.name}
                            </p>
                            <Badge
                              variant={
                                transaction.type === "INCOME" ? "success" : "destructive"
                              }
                            >
                              {transaction.type === "INCOME" ? "Income" : "Expense"}
                            </Badge>
                          </div>
                          <p className="truncate text-sm leading-6 text-muted-foreground">
                            {getSourceOrNote(transaction.source, transaction.note)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
                        <p className="text-sm font-medium text-muted-foreground">
                          {formatLocalDate(transaction.localDate)}
                        </p>
                        <p className={cn("font-mono text-base font-semibold", amountTone)}>
                          {formatMoney(formatter, transaction.amount)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash flow notes</CardTitle>
            <CardDescription>
              Derived from the selected month&apos;s totals and recent activity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[22px] border border-border/80 bg-background/60 p-4">
              <p className="text-sm font-medium text-muted-foreground">Current balance trend</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {data.netLeft.gt(0)
                  ? "You still have money left after recorded expenses."
                  : data.netLeft.lt(0)
                    ? "Recorded expenses have moved the month into a negative position."
                    : "The month is exactly balanced so far."}
              </p>
            </div>

            <div className="rounded-[22px] border border-border/80 bg-background/60 p-4">
              <p className="text-sm font-medium text-muted-foreground">Income coverage</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {data.incomeSum.gt(0)
                  ? `${expenseShare.toFixed(1)}% of the month's income has already been spent.`
                  : "Income has not been recorded yet, so coverage cannot be calculated."}
              </p>
            </div>

            <div className="rounded-[22px] border border-border/80 bg-background/60 p-4">
              <p className="text-sm font-medium text-muted-foreground">Latest recorded detail</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {latestTransaction
                  ? `${formatLocalDate(latestTransaction.localDate)} / ${latestTransaction.category.name} / ${formatMoney(
                      formatter,
                      latestTransaction.amount,
                    )}`
                  : "No transaction details are available for the selected month."}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
