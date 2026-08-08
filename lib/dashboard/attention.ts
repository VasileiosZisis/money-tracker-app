import { Prisma } from "@/generated/prisma/client";

import type {
  ForecastConfidence,
  ForecastMonthRelation,
  SpendingPaceResult,
  VariableForecastSource,
} from "@/lib/forecast";

export type DashboardAttentionItemType =
  | "OVERDUE_PLANNED_BILL"
  | "OVERDUE_PLANNED_INCOME"
  | "DUE_TODAY_PLANNED_BILL"
  | "DUE_TODAY_PLANNED_INCOME"
  | "DUE_SOON_PLANNED_BILL"
  | "ABOVE_USUAL_SPENDING_PACE"
  | "NEGATIVE_SAFE_TO_SPEND"
  | "NEGATIVE_SAFE_TO_SPEND_WITH_PENDING_INCOME"
  | "STALE_TRANSACTIONS"
  | "LOW_FORECAST_CONFIDENCE";

export type DashboardAttentionItemTone =
  | "danger"
  | "warning"
  | "info"
  | "success";

export type DashboardAttentionItem = {
  type: DashboardAttentionItemType;
  title: string;
  description: string;
  tone: DashboardAttentionItemTone;
};

type AttentionPlannedBill = {
  name: string;
  amount: Prisma.Decimal;
  dueDayOfMonth: number;
  isActive: boolean;
  status: "paid" | "skipped" | "upcoming" | "due-today" | "overdue" | "passed";
};

type AttentionPlannedIncome = {
  name: string;
  amount: Prisma.Decimal;
  expectedDayOfMonth: number;
  isActive: boolean;
  status: "received" | "skipped" | "upcoming" | "due-today" | "overdue" | "passed";
};

export type BuildDashboardAttentionItemsParams = {
  currency: string;
  forecast: {
    monthContext: {
      monthRelation: ForecastMonthRelation;
      currentDayOfMonth: number | null;
    };
    safeToSpend: Prisma.Decimal;
    pendingPlannedIncome: Prisma.Decimal;
    forecastConfidence: ForecastConfidence;
    variableForecastSource: VariableForecastSource;
    variableForecastMonthsUsed: readonly string[];
    spendingPace: SpendingPaceResult;
  };
  plannedBills: readonly AttentionPlannedBill[];
  plannedIncomes: readonly AttentionPlannedIncome[];
  latestTransactionEntry: { createdAt: Date } | null;
  now?: Date;
};

const ATTENTION_ITEM_LIMIT = 6;
const DUE_SOON_DAYS = 3;
const STALE_TRANSACTION_DAYS = 3;
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

function formatDashboardMoney(currency: string, amount: Prisma.Decimal) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(Number(amount.toString()));
}

function getDaysSinceDate(date: Date, now: Date) {
  return Math.floor((now.getTime() - date.getTime()) / ONE_DAY_IN_MS);
}

export function buildDashboardAttentionItems(
  params: BuildDashboardAttentionItemsParams,
): DashboardAttentionItem[] {
  const isCurrentMonth = params.forecast.monthContext.monthRelation === "current";
  const currentDayOfMonth = params.forecast.monthContext.currentDayOfMonth;
  const now = params.now ?? new Date();
  const overdueBillItems = params.plannedBills
    .filter((plannedBill) => plannedBill.isActive && plannedBill.status === "overdue")
    .map(
      (plannedBill): DashboardAttentionItem => ({
        type: "OVERDUE_PLANNED_BILL",
        title: `${plannedBill.name} is overdue`,
        description: `Due day ${plannedBill.dueDayOfMonth} · ${formatDashboardMoney(
          params.currency,
          plannedBill.amount,
        )} still reserved`,
        tone: "danger",
      }),
    );
  const overdueIncomeItems = isCurrentMonth
    ? params.plannedIncomes
        .filter(
          (plannedIncome) =>
            plannedIncome.isActive && plannedIncome.status === "overdue",
        )
        .map(
          (plannedIncome): DashboardAttentionItem => ({
            type: "OVERDUE_PLANNED_INCOME",
            title: `${plannedIncome.name} is overdue`,
            description: `Expected day ${plannedIncome.expectedDayOfMonth} · ${formatDashboardMoney(
              params.currency,
              plannedIncome.amount,
            )} still pending`,
            tone: "danger",
          }),
        )
    : [];
  const negativeSafeToSpendItems =
    isCurrentMonth && params.forecast.safeToSpend.lt(0)
      ? [
          {
            type: "NEGATIVE_SAFE_TO_SPEND" as const,
            title: "Safe to spend is negative",
            description: `Forecast is ${formatDashboardMoney(
              params.currency,
              params.forecast.safeToSpend.abs(),
            )} above current recorded income.`,
            tone: "danger" as const,
          },
        ]
      : [];
  const dueTodayBillItems = params.plannedBills
    .filter(
      (plannedBill) => plannedBill.isActive && plannedBill.status === "due-today",
    )
    .map(
      (plannedBill): DashboardAttentionItem => ({
        type: "DUE_TODAY_PLANNED_BILL",
        title: `${plannedBill.name} is due today`,
        description: `${formatDashboardMoney(
          params.currency,
          plannedBill.amount,
        )} reserved`,
        tone: "warning",
      }),
    );
  const dueTodayIncomeItems = isCurrentMonth
    ? params.plannedIncomes
        .filter(
          (plannedIncome) =>
            plannedIncome.isActive && plannedIncome.status === "due-today",
        )
        .map(
          (plannedIncome): DashboardAttentionItem => ({
            type: "DUE_TODAY_PLANNED_INCOME",
            title: `${plannedIncome.name} is expected today`,
            description: `${formatDashboardMoney(
              params.currency,
              plannedIncome.amount,
            )} pending`,
            tone: "warning",
          }),
        )
    : [];
  const dueSoonBillItems =
    isCurrentMonth && currentDayOfMonth !== null
      ? params.plannedBills
          .filter((plannedBill) => {
            const daysUntilDue = plannedBill.dueDayOfMonth - currentDayOfMonth;

            return (
              plannedBill.isActive &&
              plannedBill.status === "upcoming" &&
              daysUntilDue >= 1 &&
              daysUntilDue <= DUE_SOON_DAYS
            );
          })
          .sort(
            (left, right) =>
              left.dueDayOfMonth - right.dueDayOfMonth ||
              left.name.localeCompare(right.name),
          )
          .map((plannedBill): DashboardAttentionItem => {
            const daysUntilDue = plannedBill.dueDayOfMonth - currentDayOfMonth;

            return {
              type: "DUE_SOON_PLANNED_BILL",
              title:
                daysUntilDue === 1
                  ? `${plannedBill.name} is due tomorrow`
                  : `${plannedBill.name} is due in ${daysUntilDue} days`,
              description: `${formatDashboardMoney(
                params.currency,
                plannedBill.amount,
              )} still reserved`,
              tone: "warning",
            };
          })
      : [];
  const pendingIncomeContextItems =
    isCurrentMonth &&
    params.forecast.safeToSpend.lt(0) &&
    params.forecast.pendingPlannedIncome.gt(0)
      ? [
          {
            type: "NEGATIVE_SAFE_TO_SPEND_WITH_PENDING_INCOME" as const,
            title: "Safe to spend is negative before pending income",
            description: `${formatDashboardMoney(
              params.currency,
              params.forecast.pendingPlannedIncome,
            )} is still expected, but not counted as safe to spend until received.`,
            tone: "warning" as const,
          },
        ]
      : [];
  const spendingPace = params.forecast.spendingPace;
  const aboveUsualSpendingPaceItems: DashboardAttentionItem[] =
    isCurrentMonth &&
    spendingPace.direction === "above" &&
    spendingPace.percentageDifference !== null &&
    spendingPace.historicalDailyExpense.gt(0) &&
    spendingPace.monthsUsed.length > 0
      ? [
          {
            type: "ABOVE_USUAL_SPENDING_PACE",
            title: "Spending pace is above usual",
            description: `Variable spending is ${formatDashboardMoney(
              params.currency,
              spendingPace.currentDailyExpense,
            )}/day, ${spendingPace.percentageDifference
              .abs()
              .toFixed(1)}% above the usual ${formatDashboardMoney(
              params.currency,
              spendingPace.historicalDailyExpense,
            )}/day based on ${spendingPace.monthsUsed.length} historical ${
              spendingPace.monthsUsed.length === 1 ? "month" : "months"
            }.`,
            tone: "warning",
          },
        ]
      : [];
  const staleTransactionItems: DashboardAttentionItem[] = [];

  if (isCurrentMonth) {
    if (!params.latestTransactionEntry) {
      staleTransactionItems.push({
        type: "STALE_TRANSACTIONS",
        title: "No transactions entered yet",
        description:
          "Manual data may be incomplete until current income or expenses are recorded.",
        tone: "warning",
      });
    } else {
      const daysSinceLatestEntry = getDaysSinceDate(
        params.latestTransactionEntry.createdAt,
        now,
      );

      if (daysSinceLatestEntry >= STALE_TRANSACTION_DAYS) {
        staleTransactionItems.push({
          type: "STALE_TRANSACTIONS",
          title: `No transactions entered in ${daysSinceLatestEntry} days`,
          description:
            "Forecast may be less accurate if recent manual spending is missing.",
          tone: "warning",
        });
      }
    }
  }

  const historyMonthCount = params.forecast.variableForecastMonthsUsed.length;
  const lowConfidenceDescription =
    params.forecast.variableForecastSource === "current-month-run-rate"
      ? "Variable spending is based only on current-month activity."
      : historyMonthCount === 0
        ? "There is not enough variable-spending history to estimate confidently."
        : `Variable spending is based on ${historyMonthCount} full ${
            historyMonthCount === 1 ? "month" : "months"
          }; 3 are needed for medium confidence.`;
  const lowConfidenceItems: DashboardAttentionItem[] =
    isCurrentMonth && params.forecast.forecastConfidence === "low"
      ? [
          {
            type: "LOW_FORECAST_CONFIDENCE",
            title: "Forecast confidence is low",
            description: lowConfidenceDescription,
            tone: "warning",
          },
        ]
      : [];

  return [
    ...overdueBillItems,
    ...overdueIncomeItems,
    ...negativeSafeToSpendItems,
    ...dueTodayBillItems,
    ...dueTodayIncomeItems,
    ...dueSoonBillItems,
    ...aboveUsualSpendingPaceItems,
    ...pendingIncomeContextItems,
    ...staleTransactionItems,
    ...lowConfidenceItems,
  ].slice(0, ATTENTION_ITEM_LIMIT);
}
