import { TotalBalanceChart } from "@/components/dashboard/total-balance-chart";
import { MonthCashflowChart } from "@/components/dashboard/month-cashflow-chart";
import { SpendingByCategoryChart } from "@/components/dashboard/spending-by-category-chart";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { DemoData } from "@/lib/demo/calculate";
import { DEMO_CURRENCY, DEMO_MONTH } from "@/lib/demo/fixtures";
import { demoHref } from "@/lib/demo/selection";
import { formatMonthLabel } from "@/lib/dates/month";
import { DemoCard, DemoMetric, money, TransactionSummary } from "./shared";
import { DemoMonthControl, type DemoNavigate } from "./controls";

export function DemoDashboard({ data, busy, navigate }: { data: DemoData; busy: boolean; navigate: DemoNavigate }) {
  const metrics = data.dashboard;
  const isCurrent = data.selection.month === DEMO_MONTH;
  function navLink(view: "transactions" | "planned", label: string) {
    return <a href={demoHref(data.selection, { view, categoryId: "", subcategoryId: "", type: "ALL" })} className={buttonVariants({ variant: "outline" })} aria-disabled={busy} onClick={(event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); if (!busy) void navigate({ view, categoryId: "", subcategoryId: "", type: "ALL" });
    }}>{label}</a>;
  }
  return <div className="space-y-5">
    <div className="grid gap-5 md:grid-cols-2">
      <DemoCard title="Total Balance">
        <label className="grid gap-1.5 text-sm font-medium">Completed history<Select value={data.selection.balanceMonths} disabled={busy} onChange={(event) => void navigate({ balanceMonths: event.target.value as DemoData["selection"]["balanceMonths"] })}>
          <option value="all">All time</option><option value="3">Last 3 completed months</option><option value="6">Last 6 completed months</option><option value="12">Last 12 completed months</option>
        </Select></label>
        <p className="text-sm text-muted-foreground">{formatMonthLabel(data.balance.startMonth)} – {formatMonthLabel(data.balance.endMonth)}</p>
        <DemoMetric label="Ending balance" value={money(data.balance.endingBalance)} />
        <div className="grid gap-6 sm:grid-cols-2"><DemoMetric label="Starting balance" value={money(data.balance.startingBalance)} /><DemoMetric label="Net change" value={money(data.balance.netChange)} /></div>
        <TotalBalanceChart currency={DEMO_CURRENCY} data={data.balance.chart} />
        <p className="text-sm text-muted-foreground">Historical ledger with a €1,200 opening adjustment in September 2024. Excludes the example current month.</p>
      </DemoCard>
      <DemoCard title="Monthly Snapshot">
        <DemoMonthControl selection={data.selection} busy={busy} navigate={navigate} />
        <DemoMetric label="Net left now" value={money(metrics.netLeft)} />
        <div className="grid gap-6 sm:grid-cols-3"><DemoMetric label="Income total" value={money(metrics.income)} /><DemoMetric label="Expense total" value={money(metrics.expense)} /><DemoMetric label="Projected net left" value={money(metrics.projectedNet)} /></div>
        <MonthCashflowChart currency={DEMO_CURRENCY} data={metrics.chartSeries} yAxisMax={metrics.chartYAxisMax} />
      </DemoCard>
    </div>
    <DemoCard title="Spending by category"><SpendingByCategoryChart currency={DEMO_CURRENCY} data={metrics.spending} />{!metrics.spending.length ? <p className="text-sm text-muted-foreground">No expense transactions in this month.</p> : null}</DemoCard>
    <section aria-label="Planning estimates" className="grid gap-4 xl:grid-cols-2">
      <DemoCard title="Forecast remaining spend"><DemoMetric label="Estimate" value={money(metrics.forecastRemainingSpend)} />{isCurrent ? <Badge variant="outline">{metrics.confidence} confidence</Badge> : null}</DemoCard>
      <DemoCard title="Safe to spend"><DemoMetric label={isCurrent ? "Estimate" : "Completed month"} value={money(metrics.safeToSpend)} /></DemoCard>
      <DemoCard title="Daily safe spend"><DemoMetric label={isCurrent ? "Estimate per day" : "Completed month"} value={money(metrics.dailySafeSpend)} /></DemoCard>
      <DemoCard title="Weekly safe spend"><DemoMetric label={isCurrent ? "Estimate for next 7 days" : "Completed month"} value={money(metrics.weeklySafeSpend)} /></DemoCard>
      <DemoCard title="Spending pace"><DemoMetric label={metrics.paceDirection === "unavailable" ? "No historical baseline" : metrics.paceDirection === "on-pace" ? "On pace" : `${metrics.paceDirection === "above" ? "Above" : "Below"} usual`} value={metrics.pace === null ? "Unavailable" : `${metrics.pace}%`} /></DemoCard>
      <DemoCard title="Income realization"><DemoMetric label="Actual received vs planned" value={metrics.realization === null ? "Unavailable" : `${metrics.realization}%`} /><p className="text-sm text-muted-foreground">{money(metrics.realizedAmount)} / {money(metrics.plannedIncomeAmount)}</p></DemoCard>
    </section>
    <p className="text-sm text-muted-foreground">Safe-to-spend is an estimate based on recorded income and remaining spending. Pending income is included only in projected net left.</p>
    <DemoCard title="Needs Attention">{metrics.attention.length ? metrics.attention.map((item) => <div key={item.type + item.title} className={`rounded-xl border p-3 ${item.tone === "danger" ? "border-destructive/40" : item.tone === "warning" ? "border-warning/40" : "border-border"}`}><p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.description}</p></div>) : <p className="text-sm text-muted-foreground">Nothing needs attention in this month.</p>}</DemoCard>
    <div className="grid gap-5 xl:grid-cols-3">
      <DemoCard title="Recent Transactions">{data.recentTransactions.map((row) => <div key={row.id} className="border-b border-border pb-3"><TransactionSummary row={row} /></div>)}{!data.recentTransactions.length ? <p className="text-sm text-muted-foreground">No transactions in this month.</p> : null}{navLink("transactions", "View transactions")}</DemoCard>
      <div className="xl:col-span-2"><DemoCard title="Planned Items"><div className="grid gap-5 sm:grid-cols-2">{(["EXPENSE", "INCOME"] as const).map((type) => {
        const items = data.planned.filter((item) => item.type === type && !item.occurrence);
        return <div key={type} className="space-y-3"><h3 className="font-semibold">{type === "EXPENSE" ? "Planned Bills" : "Planned Income"}</h3>{items.map((item) => <div key={item.id} className="flex justify-between gap-3 rounded-lg border border-border p-3"><div><p className="text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">Day {item.day} · {item.status}</p></div><p className={`font-mono text-sm ${type === "INCOME" ? "text-success" : "text-destructive"}`}>{money(item.amount)}</p></div>)}{!items.length ? <p className="text-sm text-muted-foreground">All planned {type === "EXPENSE" ? "bills" : "income"} handled</p> : null}</div>;
      })}</div>{navLink("planned", "View all planned items")}</DemoCard></div>
    </div>
  </div>;
}
