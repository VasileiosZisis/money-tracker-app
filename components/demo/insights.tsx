import type { MouseEvent } from "react";
import { BarChart3 } from "lucide-react";
import { SectionHeading } from "@/components/app-shell/section-heading";
import { MonthlyResultCard } from "@/components/insights/monthly-result-card";
import { CategoryTrendDetails } from "@/components/insights/category-trend-details";
import { SpendingCompositionCard } from "@/components/insights/spending-composition-card";
import { SpendingChangeCard } from "@/components/insights/spending-change-card";
import { IncomeSpendingConsistency } from "@/components/insights/income-spending-consistency";
import { UnusualMonthsView } from "@/components/insights/unusual-months-view";
import { YearOverYearPatternsView } from "@/components/insights/year-over-year-patterns-view";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { DemoData } from "@/lib/demo/calculate";
import { DEMO_CURRENCY, DEMO_MONTH, demoCategories } from "@/lib/demo/fixtures";
import { demoHref } from "@/lib/demo/selection";
import { formatMonthLabel } from "@/lib/dates/month";
import { normalizeDemoSelection } from "@/lib/demo/selection";
import { shiftMonthKey } from "@/lib/balance/months";
import type { DemoNavigate } from "./controls";

export function DemoInsights({ data, busy, navigate }: { data: DemoData; busy: boolean; navigate: DemoNavigate }) {
  const insights = data.insights;
  const category = demoCategories.find(row => row.id === data.selection.categoryId);
  const change = insights.change;
  const transactionHref = (month: string, type: 'ALL' | 'INCOME' | 'EXPENSE' = 'ALL', categoryId = '') => demoHref(data.selection, { view: 'transactions', month, type, categoryId, subcategoryId: '' });
  function follow(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (busy) { event.preventDefault(); return; }
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); void navigate(normalizeDemoSelection(Object.fromEntries(new URLSearchParams(href.split('?')[1] ?? ''))));
  }
  const unusualHrefs = Object.fromEntries(insights.unusual.months.flatMap(month => month.observations.map(row => [row.id, transactionHref(row.month, row.metric === 'INCOME' ? 'INCOME' : row.metric === 'MONTHLY_RESULT' ? 'ALL' : 'EXPENSE', row.categoryId ?? '')])));
  return <div className="flex flex-col gap-5">
    <section aria-labelledby="monthly-result-heading" className="flex flex-col gap-4"><SectionHeading id="monthly-result-heading" title="Monthly result" />
      <form onSubmit={event => { event.preventDefault(); void navigate({ period: Number(new FormData(event.currentTarget).get('period')) as 3 | 6 | 12 }); }}><fieldset disabled={busy} className="flex flex-wrap items-end gap-3"><label className="flex flex-col text-sm font-medium"><span className="sr-only">History Period</span><Select name="period" key={data.selection.period} defaultValue={data.selection.period}><option value="3">Last 3 months</option><option value="6">Last 6 months</option><option value="12">Last 12 months</option></Select></label><Button type="submit" variant="outline">Apply</Button></fieldset></form>
      <MonthlyResultCard monthlyResultInsight={insights.result} monthlyResultChartData={insights.chart} completedPeriodLabel={insights.periodLabel} currency={DEMO_CURRENCY} display={data.display} transactionsHref={transactionHref(DEMO_MONTH)} disabled={busy} onTransactionClick={event => follow(event, transactionHref(DEMO_MONTH))} />
    </section>
    <section aria-labelledby="spending-composition-heading" className="flex flex-col gap-4"><SectionHeading id="spending-composition-heading" title="Spending composition" /><SpendingCompositionCard spendingComposition={insights.composition} completedPeriodLabel={insights.periodLabel} currency={DEMO_CURRENCY} display={data.display} /></section>
    <section aria-labelledby="income-spending-consistency-heading" className="flex flex-col gap-4"><SectionHeading id="income-spending-consistency-heading" title="Income and spending consistency" /><IncomeSpendingConsistency insight={insights.consistency} currency={DEMO_CURRENCY} historyPeriodLabel={insights.periodLabel} /></section>
    <section aria-labelledby="unusual-months-heading" className="flex flex-col gap-4"><SectionHeading id="unusual-months-heading" title="Unusual months" /><UnusualMonthsView insight={insights.unusual} display={data.unusualDisplay} historyPeriodLabel={insights.periodLabel} transactionHrefs={unusualHrefs} disabled={busy} onTransactionClick={follow} /></section>
    <section aria-labelledby="category-spending-heading" className="flex flex-col gap-4"><SectionHeading id="category-spending-heading" title="Category Spending Trends" />
      <form onSubmit={event => { event.preventDefault(); void navigate({ categoryId: String(new FormData(event.currentTarget).get('categoryId') ?? ''), subcategoryId: '' }); }}><fieldset disabled={busy} className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium sm:max-w-md">Expense category<Select name="categoryId" key={data.selection.categoryId} defaultValue={data.selection.categoryId}><option value="">Select a category</option>{demoCategories.filter(row => row.type === 'EXPENSE').map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</Select></label><Button type="submit" variant="outline">Apply</Button></fieldset></form>
      {category && insights.category ? <CategoryTrendDetails insight={insights.category} comparison={data.comparison} selectedCategory={category} completedPeriodLabel={insights.periodLabel} chartData={insights.categoryChart} historyRows={[...insights.category.months].reverse()} currency={DEMO_CURRENCY} display={data.display} currentTransactionsHref={transactionHref(DEMO_MONTH, 'EXPENSE', category.id)} transactionHrefs={Object.fromEntries(insights.category.months.map(row => [row.month, transactionHref(row.month, 'EXPENSE', category.id)]))} disabled={busy} onTransactionClick={follow} /> : <Card><CardHeader><CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-muted-foreground">History Period:</span><span>{insights.periodLabel}</span></CardTitle></CardHeader><CardContent className="pt-4"><EmptyState icon={BarChart3} title="Select an expense category" description="Choose a category to view its monthly spending history" /></CardContent></Card>}
    </section>
    <section aria-labelledby="drivers-of-change-heading" className="flex flex-col gap-4"><SectionHeading id="drivers-of-change-heading" title="Drivers of change" /><SpendingChangeCard spendingChange={change} display={data.display} bars={data.changeBars} controls={change.window ? <form key={`${change.window}:${change.selectedTargetMonth}`} className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={event => { event.preventDefault(); const values = new FormData(event.currentTarget); void navigate({ changeWindow: Number(values.get('changeWindow')) as 1 | 3 | 6, changeMonth: String(values.get('changeMonth') ?? '') }); }}><fieldset disabled={busy} className="contents"><label className="flex flex-col text-sm font-medium"><span className="sr-only">Comparison length</span><Select name="changeWindow" defaultValue={change.window}>{change.availableWindows.map(window => <option key={window} value={window}>{window === 1 ? 'Month to month' : `${window}-month periods`}</option>)}</Select></label>{change.window === 1 && change.selectedTargetMonth ? <label className="flex flex-col text-sm font-medium"><span className="sr-only">Compare</span><Select name="changeMonth" defaultValue={change.selectedTargetMonth}>{change.availableTargetMonths.map(month => <option key={month} value={month}>{formatMonthLabel(month)} vs {formatMonthLabel(shiftMonthKey(month, -1))}</option>)}</Select></label> : null}<Button type="submit" variant="outline">Apply</Button></fieldset></form> : null} /></section>
    <section aria-labelledby="year-over-year-patterns-heading" className="flex flex-col gap-4"><SectionHeading id="year-over-year-patterns-heading" title="Year-over-year patterns" /><YearOverYearPatternsView insight={insights.longTerm} display={data.annualDisplay} bars={data.annualBars} /></section>
  </div>;
}
