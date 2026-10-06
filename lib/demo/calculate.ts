import { buildDashboardMetrics } from "@/lib/presentation/dashboard";
import { buildChangeBars, buildMoneyPresentation, formatDisplayMoney } from "@/lib/presentation/money";
import { Prisma } from "@/generated/prisma/client";

import { computeTotalBalanceSummary } from "@/lib/balance/compute-total-balance";
import { shiftMonthKey } from "@/lib/balance/months";
import { buildDashboardAttentionItems } from "@/lib/dashboard/attention";
import { calculatePlannedIncomeRealization } from "@/lib/dashboard/planned-income-realization";
import { buildSpendingByCategory } from "@/lib/dashboard/spending-by-category";
import { formatMonthLabel } from "@/lib/dates/month";
import { computeForecastSummary } from "@/lib/forecast/compute-forecast";
import { sumDecimals } from "@/lib/forecast/decimal";
import { buildLongTermPatternsInsight } from "@/lib/insights/long-term-patterns";
import { buildUnusualMonthsInsight } from "@/lib/insights/unusual-months";
import {
  buildIncomeSpendingConsistencyInsight, buildMonthlyResultInsight,
  buildSpendingChangeInsight, buildSpendingCompositionInsight, buildSpendingInsight,
} from "@/lib/insights/spending-history";
import { demoSnapshotSchema } from "@/lib/validators/demo";
import { DEMO_CURRENCY, DEMO_DATE, DEMO_INSTANT, DEMO_MONTH, DEMO_START_MONTH, demoCategories, demoTemplates } from "./fixtures";
import { normalizeDemoSelection } from "./selection";
import type { DemoSelection } from "./types";

export function calculateDemo(snapshotInput: unknown, selectionInput: Partial<DemoSelection>) {
  const snapshot = demoSnapshotSchema.parse(snapshotInput);
  const selection = normalizeDemoSelection(selectionInput);
  const transactions = snapshot.transactions.map((row) => ({ ...row, amount: new Prisma.Decimal(row.amount) }));
  const monthly = transactions.filter((row) => row.localDate.startsWith(`${selection.month}-`));
  const planned = demoTemplates.map((template) => {
    const occurrence = snapshot.occurrences.find((row) => row.templateId === template.id && row.month === selection.month) ?? null;
    const status = occurrence ? occurrence.status === "SKIPPED" ? "skipped" as const : template.type === "EXPENSE" ? "paid" as const : "received" as const
      : selection.month < DEMO_MONTH ? "passed" as const : template.day < 15 ? "overdue" as const : template.day === 15 ? "due-today" as const : "upcoming" as const;
    const amount = new Prisma.Decimal(template.amount);
    const candidates = monthly.filter((row) => row.type === template.type && !snapshot.occurrences.some((item) => item.transactionId === row.id));
    return {
      ...template, status, occurrence, isActive: true, amount,
      defaultLocalDate: selection.month === DEMO_MONTH ? DEMO_DATE : `${selection.month}-${String(template.day).padStart(2, "0")}`,
      dueDayOfMonth: template.day, expectedDayOfMonth: template.day,
      candidates: candidates.map((row) => ({ id: row.id, localDate: row.localDate, amount: row.amount.toFixed(2), categoryName: demoCategories.find((item) => item.id === row.categoryId)!.name,
        hints: [row.amount.eq(amount) ? "Exact amount" : "", row.categoryId === template.categoryId ? "Same category" : "", row.subcategoryId && row.subcategoryId === template.subcategoryId ? "Same subcategory" : ""].filter(Boolean),
      })),
    };
  });
  const bills = planned.filter((item) => item.type === "EXPENSE");
  const incomes = planned.filter((item) => item.type === "INCOME");
  const forecast = computeForecastSummary({
    selectedMonth: selection.month, referenceDate: DEMO_DATE, transactions,
    plannedBills: bills.map((item) => ({ ...item, occurrenceStatus: item.occurrence?.status === "PAID" ? "PAID" : item.occurrence?.status === "SKIPPED" ? "SKIPPED" : null })),
    plannedIncomes: incomes.map((item) => ({ ...item, occurrenceStatus: item.occurrence?.status === "RECEIVED" ? "RECEIVED" : item.occurrence?.status === "SKIPPED" ? "SKIPPED" : null })),
  });
  const realization = calculatePlannedIncomeRealization({ monthRelation: forecast.monthContext.monthRelation, plannedIncomes: incomes.map((item) => ({
    plannedAmount: item.amount, isActive: true,
    occurrenceStatus: item.occurrence?.status === "RECEIVED" ? "RECEIVED" : item.occurrence?.status === "SKIPPED" ? "SKIPPED" : null,
    receivedTransactionAmount: transactions.find((row) => row.id === item.occurrence?.transactionId)?.amount ?? null,
  })) });
  const income = sumDecimals(monthly.filter((row) => row.type === "INCOME").map((row) => row.amount));
  const expense = sumDecimals(monthly.filter((row) => row.type === "EXPENSE").map((row) => row.amount));
  const endingMonth = "2026-08";
  const startMonth = selection.balanceMonths === "all" ? DEMO_START_MONTH : shiftMonthKey(DEMO_MONTH, -Number(selection.balanceMonths));
  const balance = computeTotalBalanceSummary({ period: { startMonth, endMonth: endingMonth }, transactions, adjustments: [{ effectiveMonth: DEMO_START_MONTH, amount: new Prisma.Decimal("1200.00") }] });
  const latestEntry = snapshot.transactions.map((row) => row.createdAt).sort().at(-1);
  const attention = buildDashboardAttentionItems({ currency: DEMO_CURRENCY, forecast,
    plannedBills: bills.map((item) => ({ ...item, status: item.status === "received" ? "paid" as const : item.status })),
    plannedIncomes: incomes.map((item) => ({ ...item, status: item.status === "paid" ? "received" as const : item.status })),
    latestTransactionEntry: latestEntry ? { createdAt: new Date(latestEntry) } : null, now: new Date(DEMO_INSTANT),
  });
  let cumulativeIncome = new Prisma.Decimal(0);
  let cumulativeExpense = new Prisma.Decimal(0);
  const chartSeries = Array.from({ length: forecast.monthContext.daysInMonth }, (_, index) => {
    const day = index + 1;
    const localDate = `${selection.month}-${String(day).padStart(2, "0")}`;
    for (const row of monthly.filter((item) => item.localDate === localDate)) {
      if (row.type === "INCOME") cumulativeIncome = cumulativeIncome.plus(row.amount);
      else cumulativeExpense = cumulativeExpense.plus(row.amount);
    }
    return { day, label: String(day), income: cumulativeIncome.toNumber(), expense: selection.month === DEMO_MONTH && day > 15 ? null : cumulativeExpense.toNumber() };
  });
  const monthlyRows = snapshot.transactions.filter((row) => row.localDate.startsWith(`${selection.month}-`)).sort((a, b) => b.localDate.localeCompare(a.localDate) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const firstActivityMonth = transactions.filter((row) => row.localDate <= DEMO_DATE).map((row) => row.localDate.slice(0, 7)).sort()[0] ?? null;
  const historical = transactions.filter((row) => row.localDate <= DEMO_DATE);
  const expenseCategories = demoCategories.filter((item) => item.type === "EXPENSE");
  const historicalCategories = expenseCategories.map((item) => ({ ...item, createdMonth: DEMO_START_MONTH }));
  const shared = { transactions: historical, firstActivityMonth, currentMonth: DEMO_MONTH, period: selection.period };
  const result = buildMonthlyResultInsight(shared);
  const categoryInsight = selection.categoryId ? buildSpendingInsight({ ...shared, categoryId: selection.categoryId, categoryCreatedMonth: DEMO_START_MONTH }) : null;
  const change = buildSpendingChangeInsight({ ...shared, categories: expenseCategories, requestedWindow: selection.changeWindow, requestedTargetMonth: selection.changeMonth });
  const data = {
    selection, snapshot,
    transactions: monthlyRows.filter((row) => (selection.type === "ALL" || row.type === selection.type) && (!selection.categoryId || row.categoryId === selection.categoryId) && (!selection.subcategoryId || row.subcategoryId === selection.subcategoryId)),
    recentTransactions: monthlyRows.slice(0, 5),
    planned: planned.map((item) => ({ ...item, amount: item.amount.toFixed(2) })),
    dashboard: {
      income: income.toFixed(2), expense: expense.toFixed(2), netLeft: income.minus(expense).toFixed(2),
      projectedNet: forecast.projectedEndOfMonthNet.toFixed(2), safeToSpend: forecast.safeToSpend.toFixed(2),
      forecastRemainingSpend: forecast.forecastRemainingSpend.toFixed(2), dailySafeSpend: forecast.dailySafeSpend.toFixed(2), weeklySafeSpend: forecast.weeklySafeSpend.toFixed(2),
      pendingIncome: forecast.pendingPlannedIncome.toFixed(2), confidence: forecast.forecastConfidence,
      pace: forecast.spendingPace.percentageDifference?.toFixed(1) ?? null,
      paceDirection: forecast.spendingPace.direction,
      realization: realization.percentage?.toFixed(1) ?? null, realizedAmount: realization.actualReceivedAmount.toFixed(2), plannedIncomeAmount: realization.totalPlannedAmount.toFixed(2),
      chartSeries, chartYAxisMax: Math.max(1, ...chartSeries.flatMap((row) => [row.income, row.expense ?? 0])),
      spending: buildSpendingByCategory(monthly.map((row) => {
        const category = demoCategories.find((item) => item.id === row.categoryId)!;
        return { ...row, category, subcategory: category.subcategories.find((item) => item.id === row.subcategoryId) ?? null };
      })), attention,
    },
    balance: {
      startMonth, endMonth: endingMonth, startingBalance: balance.startingBalance.toFixed(2), netChange: balance.netChange.toFixed(2), endingBalance: balance.endingBalance.toFixed(2),
      chart: balance.monthlyBalances.map((row, index) => ({ month: row.month, endingBalance: row.endingBalance.toNumber(), balanceChange: row.endingBalance.minus(index === 0 ? balance.startingBalance : balance.monthlyBalances[index - 1].endingBalance).toNumber() })),
    },
    insights: {
      result, category: categoryInsight,
      categoryChart: categoryInsight?.months.map((row) => ({
        month: row.month, shortLabel: formatMonthLabel(row.month), fullLabel: formatMonthLabel(row.month),
        categorySpending: Number(row.categorySpending), totalExpenses: Number(row.totalExpenses), actualNet: Number(row.actualNet), isCurrentMonth: row.isCurrentMonth,
      })) ?? [],
      chart: result.months.map((row) => ({ month: row.month, shortLabel: formatMonthLabel(row.month).replace(/ (\d{4})$/, (_, year: string) => ` '${year.slice(2)}`), fullLabel: formatMonthLabel(row.month), totalIncome: Number(row.totalIncome), totalExpenses: Number(row.totalExpenses), result: Number(row.result), isCurrentMonth: row.isCurrentMonth })),
      consistency: buildIncomeSpendingConsistencyInsight(shared),
      composition: buildSpendingCompositionInsight({ ...shared, categories: expenseCategories }),
      unusual: buildUnusualMonthsInsight({ ...shared, categories: historicalCategories }),
      change, longTerm: buildLongTermPatternsInsight({ ...shared, categories: historicalCategories }),
      periodLabel: `${formatMonthLabel(shiftMonthKey(DEMO_MONTH, -selection.period))} – August 2026`,
    },
  };
  const reservedBills = forecast.unpaidPlannedBills.toFixed(2);
  const display = buildMoneyPresentation({ ...data, reservedBills }, DEMO_CURRENCY, true);
  const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: DEMO_CURRENCY });
  const difference = categoryInsight?.differenceFromTypical;
  const comparison = difference === null || difference === undefined
    ? { value: '—', description: 'Complete a month to establish a comparison' }
    : { value: formatDisplayMoney(formatter, new Prisma.Decimal(difference).abs().toString()), description: new Prisma.Decimal(difference).eq(0) ? 'On your typical monthly spending' : new Prisma.Decimal(difference).gt(0) ? 'Above your typical monthly spending' : 'Below your typical monthly spending' };
  return { ...data, display, comparison, annualDisplay: buildMoneyPresentation(data.insights.longTerm, DEMO_CURRENCY), unusualDisplay: buildMoneyPresentation(data.insights.unusual, DEMO_CURRENCY),
    metrics: buildDashboardMetrics(forecast, realization, DEMO_CURRENCY),
    reservedBills,
    changeBars: buildChangeBars(change.categories), annualBars: buildChangeBars(data.insights.longTerm.categories),
  };
}

export type DemoData = ReturnType<typeof calculateDemo>;
