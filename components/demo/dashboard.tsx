import type { MouseEvent } from "react";
import { ArrowRight, CalendarClock, CalendarRange, CircleDollarSign, ChartNoAxesCombined, FolderClock, Gauge, ShieldAlert, ShieldCheck, TimerReset, TrendingDown, TrendingUp } from "lucide-react";
import { SectionHeading } from "@/components/app-shell/section-heading";
import { MetricCard, NeedsAttentionSection } from "@/components/dashboard/dashboard-cards";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { PlannedSummaryRow } from "@/components/dashboard/planned-summary-row";
import { TotalBalanceChart } from "@/components/dashboard/total-balance-chart";
import { MonthCashflowChart } from "@/components/dashboard/month-cashflow-chart";
import { SpendingByCategoryChart } from "@/components/dashboard/spending-by-category-chart";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { DemoData } from "@/lib/demo/calculate";
import { DEMO_CURRENCY, demoCategories } from "@/lib/demo/fixtures";
import { demoHref } from "@/lib/demo/selection";
import { TransactionSummary } from "./shared";
import { DemoPlannedHandling } from "./planned";
import { DemoMonthControl, type DemoNavigate } from "./controls";
import type { DemoRun } from "./transactions";

export function DemoDashboard({ data, busy, navigate, run }: { data: DemoData; busy: boolean; navigate: DemoNavigate; run: DemoRun }) {
  const metrics = data.dashboard;
  const money = (amount: string) => data.display.money[amount];
  const tone = (amount: string) => data.display.signs[amount] < 0 ? 'danger' as const : data.display.signs[amount] > 0 ? 'success' as const : 'default' as const;
  const icons = [TrendingDown, data.metrics[1].tone === 'danger' ? ShieldAlert : ShieldCheck, TimerReset, CalendarRange, Gauge, CircleDollarSign];
  function navLink(view: 'transactions' | 'planned') {
    const patch = { view, categoryId: '', subcategoryId: '', type: 'ALL' as const };
    return <a href={demoHref(data.selection, patch)} className={`${buttonVariants({ variant: 'ghost', size: 'sm' })} rounded-xl px-0 text-primary hover:bg-transparent`} aria-disabled={busy} onClick={(event: MouseEvent<HTMLAnchorElement>) => {
      if (busy) { event.preventDefault(); return; }
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); void navigate(patch);
    }}>View all<ArrowRight /></a>;
  }
  return <div className="flex flex-col gap-5">
    <div className="grid items-start gap-4 md:grid-cols-2">
      <section aria-labelledby="total-balance-heading" className="flex min-w-0 flex-col gap-4">
        <SectionHeading id="total-balance-heading" title="Total Balance" />
        <form onSubmit={event => { event.preventDefault(); void navigate({ balanceMonths: String(new FormData(event.currentTarget).get('balanceMonths')) as typeof data.selection.balanceMonths }); }}><fieldset disabled={busy} className="flex flex-wrap items-end gap-3"><Select aria-label="Total Balance period" name="balanceMonths" key={data.selection.balanceMonths} defaultValue={data.selection.balanceMonths} className="w-fit" wrapperClassName="w-fit"><option value="all">All time</option><option value="3">Last 3 months</option><option value="6">Last 6 months</option><option value="12">Last 12 months</option></Select><Button type="submit">Apply</Button></fieldset></form>
        <SummaryCard primary={{ label: 'Ending balance', value: money(data.balance.endingBalance), tone: tone(data.balance.endingBalance) === 'danger' ? 'danger' : 'default' }} secondary={[{ label: 'Starting balance', value: money(data.balance.startingBalance) }, { label: 'Net change', value: data.display.signedMoney[data.balance.netChange], tone: tone(data.balance.netChange) }]}><TotalBalanceChart currency={DEMO_CURRENCY} data={data.balance.chart} /></SummaryCard>
      </section>
      <section aria-labelledby="monthly-snapshot-heading" className="flex min-w-0 flex-col gap-4">
        <SectionHeading id="monthly-snapshot-heading" title="Monthly Snapshot" /><DemoMonthControl id="demo-monthly-snapshot" selection={data.selection} busy={busy} navigate={navigate} />
        <SummaryCard primary={{ label: 'Net left now', value: money(metrics.netLeft), tone: tone(metrics.netLeft) }} secondary={[{ label: 'Income total', value: money(metrics.income), tone: 'success' }, { label: 'Expense total', value: money(metrics.expense), tone: 'danger' }, { label: 'Projected net left', value: money(metrics.projectedNet), tone: tone(metrics.projectedNet) }]}><MonthCashflowChart currency={DEMO_CURRENCY} data={metrics.chartSeries} yAxisMax={metrics.chartYAxisMax} /></SummaryCard>
      </section>
    </div>
    <section aria-labelledby="spending-by-category-heading" className="flex flex-col gap-4"><SectionHeading id="spending-by-category-heading" title="Monthly Spendings" /><DemoMonthControl id="demo-monthly-spendings" selection={data.selection} busy={busy} navigate={navigate} /><Card><CardContent className="p-4">{metrics.spending.length ? <SpendingByCategoryChart currency={DEMO_CURRENCY} data={metrics.spending} /> : <EmptyState icon={ChartNoAxesCombined} title="No spending to break down" description="Add an expense transaction for this month to see category and subcategory spending here." />}</CardContent></Card></section>
    <section aria-labelledby="planning-forecast-heading" className="flex flex-col gap-4"><SectionHeading id="planning-forecast-heading" title="Planning & Forecast" /><div className="grid gap-4 min-[1280px]:grid-cols-2">{data.metrics.map((metric, index) => { const Icon = icons[index]; return <MetricCard key={metric.title} {...metric} icon={<Icon className="size-5" />} />; })}</div><NeedsAttentionSection items={metrics.attention} /></section>
    <section aria-labelledby="transactions-plans-heading" className="flex flex-col gap-4"><SectionHeading id="transactions-plans-heading" title="Transactions & Plans" />
      <div className="grid items-start gap-4 min-[1280px]:grid-cols-3">
        <Card className="overflow-hidden"><CardHeader className="flex flex-row items-end justify-between gap-4 pb-0"><CardTitle>Recent transactions</CardTitle>{navLink('transactions')}</CardHeader><CardContent className="px-3 pt-6">{data.recentTransactions.length ? <div className="flex flex-col gap-3">{data.recentTransactions.map(row => <div key={row.id} className="rounded-xl border border-border/80 bg-background/60 p-3"><TransactionSummary row={row} display={data.display} includeNote={false} /></div>)}</div> : <EmptyState icon={FolderClock} title="No transactions for this month" description="Once you record income or expenses, they'll appear here in reverse chronological order." action={navLink('transactions')} />}</CardContent></Card>
        <Card className="overflow-hidden min-[1280px]:col-span-2"><CardHeader className="flex flex-row items-end justify-between gap-4 border-b border-border/70 pb-4"><CardTitle>Planned items</CardTitle>{navLink('planned')}</CardHeader><CardContent className="grid p-0 min-[868px]:grid-cols-2">
          {(['EXPENSE', 'INCOME'] as const).map(type => {
            const items = data.planned.filter(item => item.type === type && !item.occurrence);
            return <section key={type} aria-label={type === 'EXPENSE' ? 'Planned bills' : 'Planned income'} className={`flex min-w-0 flex-col ${type === 'INCOME' ? 'border-t border-border/70 min-[868px]:border-l min-[868px]:border-t-0' : ''}`}>
              <div className="p-4"><CardTitle>{type === 'EXPENSE' ? 'Planned bills' : 'Planned income'}</CardTitle>{items.length ? <div className="flex flex-wrap gap-2 pt-1"><Badge variant="outline" className="text-base">{items.length}</Badge><Badge variant="outline" className="border-0 text-base">{type === 'EXPENSE' ? 'Reserved' : 'Pending'} {money(type === 'EXPENSE' ? data.reservedBills : metrics.pendingIncome)}</Badge></div> : null}</div>
              <div className="grid gap-4 p-3">{items.length ? items.map(item => {
                const category = demoCategories.find(category => category.id === item.categoryId)!;
                const status = item.status === 'overdue' ? { label: 'Overdue', variant: 'destructive' as const } : item.status === 'due-today' ? { label: 'Due today', variant: 'warning' as const } : item.status === 'passed' ? { label: 'Passed', variant: 'outline' as const } : { label: 'Upcoming', variant: 'accent' as const };
                const dateLabel = type === 'INCOME' ? `Expected day ${item.day}` : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${data.selection.month}-${String(item.day).padStart(2, '0')}T12:00:00Z`));
                return <div key={`${item.id}:${data.selection.month}`} className="flex flex-col gap-3 rounded-xl border border-border/80 bg-background/60 p-3"><PlannedSummaryRow type={type} category={category.name} subcategory={category.subcategories.find(row => row.id === item.subcategoryId)?.name} name={item.name} amount={money(item.amount)} dateLabel={dateLabel} statusLabel={type === 'EXPENSE' && item.status === 'upcoming' ? undefined : status.label} statusVariant={status.variant} /><DemoPlannedHandling item={item} month={data.selection.month} busy={busy} run={run} display={data.display} /></div>;
              }) : <EmptyState icon={type === 'EXPENSE' ? CalendarClock : TrendingUp} title={type === 'EXPENSE' ? 'All planned bills handled' : 'All planned income handled'} />}</div>
            </section>;
          })}
        </CardContent></Card>
      </div>
    </section>
  </div>;
}
