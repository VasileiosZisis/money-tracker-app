import { Prisma } from "@/generated/prisma/client";
import {
  ArrowRight,
  CalendarClock,
  CircleAlert,
  Download,
  FolderClock,
  Plus,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { getDashboardMonthData, type DashboardPlannedBillStatus } from "@/actions/dashboard";
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
import { formatMonthLabel } from "@/lib/dates/month";
import { cn } from "@/lib/utils";

type DashboardPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
  }>;
};

type DashboardData = Awaited<ReturnType<typeof getDashboardMonthData>>;
type ForecastData = DashboardData["forecast"];
type MetricTone = "default" | "success" | "warning" | "danger";

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

function getForecastState(forecast: ForecastData) {
  if (forecast.monthContext.monthRelation === "past") {
    if (forecast.projectedEndOfMonthNet.gt(0)) {
      return {
        badgeVariant: "success" as const,
        label: "Month closed positive",
        tone: "success" as MetricTone,
      };
    }

    if (forecast.projectedEndOfMonthNet.lt(0)) {
      return {
        badgeVariant: "destructive" as const,
        label: "Month closed negative",
        tone: "danger" as MetricTone,
      };
    }

    return {
      badgeVariant: "outline" as const,
      label: "Month complete",
      tone: "default" as MetricTone,
    };
  }

  if (forecast.safeToSpend.lt(0)) {
    return {
      badgeVariant: "destructive" as const,
      label: "Over-limit risk",
      tone: "danger" as MetricTone,
    };
  }

  if (
    forecast.safeToSpend.eq(0) ||
    forecast.variableForecastSource !== "trailing-history" ||
    forecast.monthContext.monthRelation === "future"
  ) {
    return {
      badgeVariant: "warning" as const,
      label: "Caution",
      tone: "warning" as MetricTone,
    };
  }

  return {
    badgeVariant: "success" as const,
    label: "Within range",
    tone: "success" as MetricTone,
  };
}

function getMonthRelationMeta(forecast: ForecastData) {
  if (forecast.monthContext.monthRelation === "past") {
    return {
      label: "Past month",
      badgeVariant: "outline" as const,
    };
  }

  if (forecast.monthContext.monthRelation === "future") {
    return {
      label: "Future month",
      badgeVariant: "warning" as const,
    };
  }

  return {
    label: "Current month",
    badgeVariant: "accent" as const,
  };
}

function getForecastExplainabilityText(forecast: ForecastData) {
  if (forecast.monthContext.monthRelation === "past") {
    return "This month is complete, so the forecast collapses to recorded results and no additional spend is projected.";
  }

  if (forecast.variableForecastSource === "trailing-history") {
    const monthCount = forecast.variableForecastMonthsUsed.length;
    return `Estimate based on upcoming bills and ${monthCount} recent full month${monthCount === 1 ? "" : "s"} of variable spending.`;
  }

  if (forecast.variableForecastSource === "current-month-run-rate") {
    return "Estimate based on upcoming bills and your current-month variable spending run rate because trailing history is limited.";
  }

  return "Estimate based on upcoming bills only because there is not enough variable spending history yet.";
}

function getNetLeftSummaryText(data: DashboardData) {
  if (data.forecast.monthContext.monthRelation === "past") {
    if (data.netLeft.gt(0)) {
      return "The selected month finished above water based on recorded income and expenses.";
    }

    if (data.netLeft.lt(0)) {
      return "The selected month finished negative based on recorded income and expenses.";
    }

    return "The selected month closed exactly even based on recorded entries.";
  }

  if (data.netLeft.gt(0)) {
    return "Recorded income currently stays ahead of recorded expenses for the selected month.";
  }

  if (data.netLeft.lt(0)) {
    return "Recorded expenses are already ahead of recorded income for the selected month.";
  }

  return "Recorded income and expenses are currently balanced for the selected month.";
}

function getForecastContextBadges(forecast: ForecastData) {
  const badges: Array<{ label: string; variant: "accent" | "warning" | "outline" }> = [];

  if (forecast.monthContext.monthRelation !== "past") {
    badges.push({ label: "Forecast estimate", variant: "accent" });
  }

  if (forecast.variableForecastSource === "trailing-history") {
    badges.push({
      label: `${forecast.variableForecastMonthsUsed.length} full month${
        forecast.variableForecastMonthsUsed.length === 1 ? "" : "s"
      } used`,
      variant: "outline",
    });
  } else if (forecast.variableForecastSource === "current-month-run-rate") {
    badges.push({ label: "Limited history", variant: "warning" });
  } else {
    badges.push({ label: "Bills only", variant: "warning" });
  }

  return badges;
}

function getPlannedBillStatusMeta(status: DashboardPlannedBillStatus) {
  switch (status) {
    case "due-today":
      return {
        label: "Due today",
        variant: "warning" as const,
      };
    case "passed":
      return {
        label: "Passed",
        variant: "outline" as const,
      };
    default:
      return {
        label: "Upcoming",
        variant: "accent" as const,
      };
  }
}

function getPlannedBillsDescription(forecast: ForecastData) {
  if (forecast.monthContext.monthRelation === "past") {
    return "These active monthly bill templates applied to the selected month. Current-month forecasting only uses upcoming items.";
  }

  if (forecast.monthContext.monthRelation === "future") {
    return "These active monthly bills shape the forward estimate for the selected month.";
  }

  return "Upcoming and due-today items flow directly into the current-month estimate.";
}

function sumPlannedBillAmounts(data: DashboardData["plannedBills"]) {
  return data.reduce((total, plannedBill) => total.plus(plannedBill.amount), new Prisma.Decimal(0));
}

function getToneStyles(tone: MetricTone) {
  if (tone === "success") {
    return {
      textClassName: "text-success",
      iconClassName: "bg-success/10 text-success",
    };
  }

  if (tone === "warning") {
    return {
      textClassName: "text-warning",
      iconClassName: "bg-warning/10 text-warning",
    };
  }

  if (tone === "danger") {
    return {
      textClassName: "text-destructive",
      iconClassName: "bg-destructive/10 text-destructive",
    };
  }

  return {
    textClassName: "text-foreground",
    iconClassName: "bg-accent text-accent-foreground",
  };
}

function MetricCard({
  title,
  value,
  helper,
  tone = "default",
  icon,
  badgeLabel,
  badgeVariant = "outline",
}: {
  title: string;
  value: string;
  helper: string;
  tone?: MetricTone;
  icon: React.ReactNode;
  badgeLabel?: string;
  badgeVariant?: "accent" | "success" | "warning" | "destructive" | "outline";
}) {
  const toneStyles = getToneStyles(tone);

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p
              className={cn(
                "font-mono text-2xl font-semibold tracking-tight",
                toneStyles.textClassName,
              )}
            >
              {value}
            </p>
          </div>
          <div
            className={cn(
              "flex size-11 items-center justify-center rounded-2xl",
              toneStyles.iconClassName,
            )}
          >
            {icon}
          </div>
        </div>
        {badgeLabel ? <Badge variant={badgeVariant}>{badgeLabel}</Badge> : null}
        <p className="mt-auto text-sm leading-6 text-muted-foreground">{helper}</p>
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

  const forecastState = getForecastState(data.forecast);
  const monthRelationMeta = getMonthRelationMeta(data.forecast);
  const netTone = getNetTone(data.netLeft);
  const expenseShare = getRatio(data.expenseSum, data.incomeSum);
  const latestTransaction = data.recentTransactions[0];
  const plannedBillsTotal = sumPlannedBillAmounts(data.plannedBills);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Monthly snapshot"
        description={`A planning-aware view of ${formatMonthLabel(
          selectedMonth,
        )}, combining recorded entries, upcoming bills, and simple recent-spending estimates.`}
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

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <Card className="overflow-hidden">
          <CardContent className="grid gap-8 p-6 md:grid-cols-[minmax(0,1.1fr)_280px] md:p-7">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={forecastState.badgeVariant}>{forecastState.label}</Badge>
                <Badge variant={monthRelationMeta.badgeVariant}>{monthRelationMeta.label}</Badge>
                <Badge variant={netTone.badgeVariant}>{netTone.label}</Badge>
                <Badge variant="outline">Currency {data.currency}</Badge>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Net left now</p>
                <p
                  className={cn(
                    "font-mono text-4xl font-semibold tracking-tight sm:text-5xl",
                    netTone.textClassName,
                  )}
                >
                  {formatMoney(formatter, data.netLeft)}
                </p>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {getNetLeftSummaryText(data)}
                </p>
              </div>

              <div className="rounded-[26px] border border-border/80 bg-background/60 p-5">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
                    Forecast basis
                  </p>
                  <p className="text-sm leading-6 text-foreground">
                    {getForecastExplainabilityText(data.forecast)}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Safe to spend is an estimate based on recent spending and upcoming bills,
                    not an account balance.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {getForecastContextBadges(data.forecast).map((badge) => (
                    <Badge key={badge.label} variant={badge.variant}>
                      {badge.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/transactions" className={cn(buttonVariants(), "rounded-2xl px-4")}>
                  <Plus />
                  Add transaction
                </Link>
                <Link
                  href="/planned"
                  className={cn(buttonVariants({ variant: "outline" }), "rounded-2xl px-4")}
                >
                  <CalendarClock />
                  Planned bills
                </Link>
                <Link
                  href="/export"
                  className={cn(buttonVariants({ variant: "outline" }), "rounded-2xl px-4")}
                >
                  <Download />
                  Export CSV
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[28px] border border-border/80 bg-[linear-gradient(160deg,rgba(229,241,241,0.88),rgba(255,255,255,0.6))] p-5 dark:bg-[linear-gradient(160deg,rgba(120,184,176,0.14),rgba(12,23,38,0.82))]">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Month context</p>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Keep the estimate explainable.
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Forecast values are server-computed from recorded transactions, active
                    planned bills, and simple recent-spending patterns.
                  </p>
                </div>
              </div>

              <div className="rounded-[24px] border border-border/80 bg-background/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
                  Latest activity
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
                    : "Start by adding the first income or expense for this month."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <MetricCard
            title="Safe to spend"
            value={formatMoney(formatter, data.forecast.safeToSpend)}
            helper="Estimated room left before expected spending would move the month beyond recorded income. Not an account balance."
            tone={forecastState.tone}
            badgeLabel="Estimated"
            badgeVariant={forecastState.badgeVariant}
            icon={
              forecastState.tone === "danger" ? (
                <ShieldAlert className="size-5" />
              ) : (
                <ShieldCheck className="size-5" />
              )
            }
          />
          <MetricCard
            title="Forecast remaining spend"
            value={formatMoney(formatter, data.forecast.forecastRemainingSpend)}
            helper="Upcoming planned bills plus the variable-spending estimate for the rest of the selected month."
            tone={data.forecast.forecastRemainingSpend.gt(0) ? "warning" : "default"}
            badgeLabel="Estimate"
            badgeVariant="warning"
            icon={<TrendingDown className="size-5" />}
          />
          <MetricCard
            title="Projected end-of-month net"
            value={formatMoney(formatter, data.forecast.projectedEndOfMonthNet)}
            helper="Where the selected month would likely land if the estimate holds through month-end."
            tone={forecastState.tone}
            badgeLabel={
              data.forecast.monthContext.monthRelation === "past" ? "Final result" : "Estimate"
            }
            badgeVariant={
              data.forecast.monthContext.monthRelation === "past"
                ? "outline"
                : forecastState.badgeVariant
            }
            icon={<TrendingUp className="size-5" />}
          />
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <MetricCard
          title="Income total"
          value={formatMoney(formatter, data.incomeSum)}
          helper="Recorded income for the selected month."
          tone="success"
          icon={<TrendingUp className="size-5" />}
        />
        <MetricCard
          title="Expense total"
          value={formatMoney(formatter, data.expenseSum)}
          helper={
            data.incomeSum.gt(0)
              ? `${expenseShare.toFixed(1)}% of recorded income`
              : "Expenses recorded before any income"
          }
          tone="danger"
          icon={<TrendingDown className="size-5" />}
        />
        <MetricCard
          title="Recent entries"
          value={String(data.recentTransactions.length)}
          helper={
            latestTransaction
              ? `Last logged ${formatLocalDate(latestTransaction.localDate)}`
              : "No transactions recorded for this month yet"
          }
          icon={<ReceiptText className="size-5" />}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
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

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle>Planned bills for {formatMonthLabel(selectedMonth)}</CardTitle>
                <CardDescription>{getPlannedBillsDescription(data.forecast)}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{data.plannedBills.length}</Badge>
                <Badge variant="outline">{formatMoney(formatter, plannedBillsTotal)}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-6">
            {data.plannedBills.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No active planned bills"
                description="Add expected monthly bills to make the forecast more grounded."
                action={
                  <Link
                    href="/planned"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "rounded-xl",
                    )}
                  >
                    <Plus />
                    Add planned bill
                  </Link>
                }
              />
            ) : (
              data.plannedBills.map((plannedBill) => {
                const statusMeta = getPlannedBillStatusMeta(plannedBill.status);

                return (
                  <div
                    key={plannedBill.id}
                    className="rounded-[24px] border border-border/80 bg-background/60 p-4"
                  >
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{plannedBill.name}</h3>
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                        <Badge variant="outline">Due day {plannedBill.dueDayOfMonth}</Badge>
                        {plannedBill.category.isArchived ? (
                          <Badge variant="outline">Archived category</Badge>
                        ) : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                            Category
                          </p>
                          <p className="mt-2 text-sm font-semibold text-foreground">
                            {plannedBill.category.name}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                            Amount
                          </p>
                          <p className="mt-2 font-mono text-base font-semibold tracking-tight text-foreground">
                            {formatMoney(formatter, plannedBill.amount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            <div className="rounded-[22px] border border-border/80 bg-background/60 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-9 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <CircleAlert className="size-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Planning note</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    In this phase, projected end-of-month net and safe to spend can match
                    because the forecast only adds expected remaining expenses.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
