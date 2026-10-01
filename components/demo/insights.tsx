import { MonthlyResultChart } from "@/components/insights/monthly-result-chart";
import { SpendingTrendsChart } from "@/components/insights/spending-trends-chart";
import { IncomeSpendingConsistency } from "@/components/insights/income-spending-consistency";
import { SpendingComposition } from "@/components/insights/spending-composition";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { DemoData } from "@/lib/demo/calculate";
import { DEMO_CURRENCY, demoCategories } from "@/lib/demo/fixtures";
import { demoHref } from "@/lib/demo/selection";
import { formatMonthLabel } from "@/lib/dates/month";
import { DemoCard, DemoMetric, money } from "./shared";
import type { DemoNavigate } from "./controls";

export function DemoInsights({ data, busy, navigate }: { data: DemoData; busy: boolean; navigate: DemoNavigate }) {
  const insights = data.insights;
  const result = insights.result;
  const change = insights.change;
  const longTerm = insights.longTerm;
  const historyLabel = `History Period: ${insights.periodLabel}`;
  function transactionsLink(month: string, type: "ALL" | "INCOME" | "EXPENSE" = "ALL", categoryId = "") {
    const patch = { view: "transactions" as const, month, type, categoryId, subcategoryId: "" };
    return <a href={demoHref(data.selection, patch)} className={buttonVariants({ variant: "outline", size: "sm" })} aria-disabled={busy} onClick={(event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); if (!busy) void navigate(patch);
    }}>View transactions</a>;
  }
  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">Insights describes recorded history. September 2026 is incomplete and excluded from historical baselines.</p>
    <DemoCard title="Monthly result">
      <label className="grid max-w-xs gap-1.5 text-sm font-medium">History Period<Select value={data.selection.period} disabled={busy} onChange={(event) => void navigate({ period: Number(event.target.value) as 3 | 6 | 12 })}><option value="3">3 completed months</option><option value="6">6 completed months</option><option value="12">12 completed months</option></Select></label>
      <p className="text-sm font-semibold">{historyLabel}</p>
      <DemoMetric label="Typical monthly result" value={money(result.typicalMonthlyResult)} />
      {result.breakEvenGap ? <DemoMetric label="Typical break-even gap" value={money(result.breakEvenGap)} /> : null}
      <p className="text-sm text-muted-foreground">{result.completedMonthCount} completed months · {result.positiveMonthCount} positive · {result.negativeMonthCount} negative · {result.breakEvenMonthCount} break-even</p>
      <MonthlyResultChart currency={DEMO_CURRENCY} data={insights.chart} />
      <div className="space-y-3">{result.months.map((row) => <div key={row.month} className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><div><p className="text-sm font-medium">{formatMonthLabel(row.month)}{row.isCurrentMonth ? " · Incomplete" : ""}</p><p className="font-mono text-sm">Income {money(row.totalIncome)} · Expenses {money(row.totalExpenses)} · Result {money(row.result)}</p></div>{transactionsLink(row.month)}</div>)}</div>
    </DemoCard>
    <DemoCard title="Spending composition"><p className="text-sm font-semibold">{historyLabel}</p><DemoMetric label="Total expenses" value={money(insights.composition.totalExpenses)} /><SpendingComposition categories={insights.composition.categories} currency={DEMO_CURRENCY} />{!insights.composition.categories.length ? <p className="text-sm text-muted-foreground">No completed-period spending recorded.</p> : null}</DemoCard>
    <section aria-label="Income and spending consistency"><h2 className="mb-3 text-lg font-semibold">Income and spending consistency</h2><IncomeSpendingConsistency insight={insights.consistency} currency={DEMO_CURRENCY} historyPeriodLabel={insights.periodLabel} /></section>
    <DemoCard title="Unusual months"><p className="text-sm font-semibold">{historyLabel}</p>{!insights.unusual.hasSufficientHistory ? <p className="text-sm text-muted-foreground">At least six eligible completed months are needed.</p> : insights.unusual.months.length ? insights.unusual.months.map((group) => <div key={group.month} className="space-y-3"><h3 className="font-medium">{formatMonthLabel(group.month)}</h3>{group.observations.map((row) => <div key={row.id} className="flex flex-wrap justify-between gap-3 rounded-lg border border-border p-3"><div><p className="text-sm">{row.categoryName ?? (row.metric === "INCOME" ? "Income" : row.metric === "MONTHLY_RESULT" ? "Monthly result" : "Total spending")} · {row.direction === "HIGH" ? "Higher" : "Lower"} than usual</p><p className="text-sm text-muted-foreground">Actual {money(row.actual)} · Typical {money(row.typical)}</p></div>{transactionsLink(row.month, row.metric === "INCOME" ? "INCOME" : row.metric === "MONTHLY_RESULT" ? "ALL" : "EXPENSE", row.categoryId ?? "")}</div>)}</div>) : <p className="text-sm text-muted-foreground">No unusual completed months detected.</p>}</DemoCard>
    <DemoCard title="Category Spending Trends"><p className="text-sm font-semibold">{historyLabel}</p>
      <label className="grid max-w-xs gap-1.5 text-sm font-medium">Expense category<Select value={data.selection.categoryId} disabled={busy} onChange={(event) => void navigate({ categoryId: event.target.value, subcategoryId: "" })}><option value="">Choose a category</option>{demoCategories.filter((item) => item.type === "EXPENSE").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
      {insights.category ? <><div className="grid gap-4 sm:grid-cols-3"><DemoMetric label="Typical monthly spending" value={money(insights.category.typicalSpending)} /><DemoMetric label="Current incomplete month" value={money(insights.category.currentMonthSpending)} /><DemoMetric label="Difference from typical" value={money(insights.category.differenceFromTypical)} /></div><SpendingTrendsChart categoryName={demoCategories.find((item) => item.id === data.selection.categoryId)!.name} currency={DEMO_CURRENCY} data={insights.categoryChart} />{insights.category.months.map((row) => <div key={row.month} className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><p className="text-sm">{formatMonthLabel(row.month)}{row.isCurrentMonth ? " · Incomplete" : ""} · {money(row.categorySpending)}</p>{transactionsLink(row.month, "EXPENSE", data.selection.categoryId)}</div>)}</> : <p className="text-sm text-muted-foreground">Choose an expense category to explore its recorded spending.</p>}
    </DemoCard>
    <DemoCard title="Drivers of change">
      <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">Comparison<Select value={data.selection.changeWindow} disabled={busy} onChange={(event) => void navigate({ changeWindow: Number(event.target.value) as 1 | 3 | 6 })}><option value="1">Month to month</option><option value="3">Adjacent 3-month periods</option><option value="6">Adjacent 6-month periods</option></Select></label>
        {data.selection.changeWindow === 1 ? <label className="grid gap-1.5 text-sm font-medium">Newer completed month<Select value={change.selectedTargetMonth ?? ""} disabled={busy} onChange={(event) => void navigate({ changeMonth: event.target.value })}>{change.availableTargetMonths.map((month) => <option key={month} value={month}>{formatMonthLabel(month)}</option>)}</Select></label> : null}
      </div>
      {change.window ? <><p className="text-sm text-muted-foreground">{formatMonthLabel(change.previousStartMonth!)} – {formatMonthLabel(change.previousEndMonth!)} compared with {formatMonthLabel(change.recentStartMonth!)} – {formatMonthLabel(change.recentEndMonth!)}</p><div className="grid gap-4 sm:grid-cols-3"><DemoMetric label="Previous monthly average" value={money(change.previousMonthlyAverage)} /><DemoMetric label="Recent monthly average" value={money(change.recentMonthlyAverage)} /><DemoMetric label="Average monthly change" value={money(change.averageMonthlyChange)} /></div>{change.categories.map((row) => <div key={row.categoryId} className="flex flex-wrap justify-between gap-3 border-t border-border pt-3"><p className="text-sm">{row.categoryName}</p><p className="font-mono text-sm">{money(row.previousMonthlyAverage)} → {money(row.recentMonthlyAverage)} · Change {money(row.change)}</p></div>)}</> : <p className="text-sm text-muted-foreground">Not enough eligible completed history to compare periods.</p>}
    </DemoCard>
    <DemoCard title="Year-over-year patterns">
      <p className="text-sm text-muted-foreground">{formatMonthLabel(longTerm.previousStartMonth)} – {formatMonthLabel(longTerm.previousEndMonth)} compared with {formatMonthLabel(longTerm.recentStartMonth)} – {formatMonthLabel(longTerm.recentEndMonth)}</p>
      {longTerm.hasSufficientHistory ? <><div className="grid gap-4 sm:grid-cols-3">{(["income", "expenses", "result"] as const).map((key) => <DemoMetric key={key} label={`Annual ${key} change`} value={money(longTerm[key]?.change ?? null)}><p className="mt-1 text-sm text-muted-foreground">{money(longTerm[key]?.previousTotal ?? null)} → {money(longTerm[key]?.recentTotal ?? null)}</p></DemoMetric>)}</div>{longTerm.categories.map((row) => <div key={row.categoryId} className="flex flex-wrap justify-between gap-3 border-t border-border pt-3"><p className="text-sm">{row.categoryName}{row.hasPartialHistory ? " · Partial history" : ""}</p><p className="font-mono text-sm">{money(row.previousTotal)} → {money(row.recentTotal)} · Change {money(row.change)}</p></div>)}</> : <p className="text-sm text-muted-foreground">24 eligible completed months are needed for this comparison.</p>}
    </DemoCard>
    <Button variant="outline" disabled={busy} onClick={() => void navigate({ view: "transactions", categoryId: "", subcategoryId: "", type: "ALL" })}>Try adding a transaction</Button>
  </div>;
}
