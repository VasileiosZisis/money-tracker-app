import type { ForecastSummary } from "@/lib/forecast/compute-forecast";
import type { PlannedIncomeRealizationResult } from "@/lib/dashboard/planned-income-realization";
import { formatDisplayMoney } from "./money";
type MetricTone = 'default' | 'success' | 'warning' | 'danger';
export type DashboardMetricDisplay = { title: string; value: string; tone: MetricTone; badgeLabel?: string; badgeVariant?: 'accent' | 'success' | 'warning' | 'destructive' | 'outline'; badgePlacement?: 'below' | 'title' };
export function getForecastState (forecast: ForecastSummary) {
  if (forecast.monthContext.monthRelation === 'past') {
    if (forecast.safeToSpend.gt(0)) {
      return {
        badgeVariant: 'success' as const,
        label: 'Month closed positive',
        tone: 'success' as MetricTone
      }
    }

    if (forecast.safeToSpend.lt(0)) {
      return {
        badgeVariant: 'destructive' as const,
        label: 'Month closed negative',
        tone: 'danger' as MetricTone
      }
    }

    return {
      badgeVariant: 'outline' as const,
      label: 'Month complete',
      tone: 'default' as MetricTone
    }
  }

  if (forecast.safeToSpend.lt(0)) {
    return {
      badgeVariant: 'destructive' as const,
      label: 'Over-limit risk',
      tone: 'danger' as MetricTone
    }
  }

  if (
    forecast.safeToSpend.eq(0) ||
    forecast.variableForecastSource !== 'trailing-history' ||
    forecast.monthContext.monthRelation === 'future'
  ) {
    return {
      badgeVariant: 'warning' as const,
      label: 'Caution',
      tone: 'warning' as MetricTone
    }
  }

  return {
    badgeVariant: 'success' as const,
    label: 'Within range',
    tone: 'success' as MetricTone
  }
}

export function getForecastConfidenceMeta (
  confidence: ForecastSummary['forecastConfidence']
) {
  if (confidence === 'high') {
    return {
      label: 'High confidence',
      badgeVariant: 'success' as const
    }
  }

  if (confidence === 'medium') {
    return {
      label: 'Medium confidence',
      badgeVariant: 'warning' as const
    }
  }

  return {
    label: 'Low confidence',
    badgeVariant: 'destructive' as const
  }
}

export function getSpendingPaceMeta (forecast: ForecastSummary) {
  const pace = forecast.spendingPace

  if (pace.direction === 'unavailable') {
    return {
      label:
        forecast.monthContext.monthRelation === 'future'
          ? 'Unavailable'
          : 'No baseline',
      badgeVariant: 'outline' as const,
      tone: 'default' as MetricTone
    }
  }

  const percentage = pace.percentageDifference?.abs().toFixed(1) ?? '0.0'

  if (pace.direction === 'above') {
    return {
      label: `${percentage}% above usual`,
      badgeVariant: 'warning' as const,
      tone: 'warning' as MetricTone
    }
  }

  if (pace.direction === 'below') {
    return {
      label: `${percentage}% below usual`,
      badgeVariant: 'success' as const,
      tone: 'success' as MetricTone
    }
  }

  return {
    label: 'On usual pace',
    badgeVariant: 'accent' as const,
    tone: 'default' as MetricTone
  }
}

export function getIncomeRealizationMeta (
  realization: PlannedIncomeRealizationResult
) {
  if (realization.status === 'complete') {
    return {
      tone: 'success' as MetricTone,
      badgeVariant: 'success' as const
    }
  }

  if (realization.status === 'under-realized') {
    return {
      tone: 'warning' as MetricTone,
      badgeVariant: 'warning' as const
    }
  }

  if (realization.status === 'in-progress') {
    return {
      tone: 'default' as MetricTone,
      badgeVariant: 'accent' as const
    }
  }

  return {
    tone: 'default' as MetricTone,
    badgeVariant: 'outline' as const
  }
}


export function buildDashboardMetrics(forecast: ForecastSummary, realization: PlannedIncomeRealizationResult, currency: string): DashboardMetricDisplay[] {
  const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency });
  const money = (value: { toString(): string }) => formatDisplayMoney(formatter, value.toString());
  const past = forecast.monthContext.monthRelation === 'past';
  const current = forecast.monthContext.monthRelation === 'current';
  const safe = getForecastState(forecast);
  const confidence = getForecastConfidenceMeta(forecast.forecastConfidence);
  const pace = getSpendingPaceMeta(forecast);
  const income = getIncomeRealizationMeta(realization);
  return [
    { title: 'Forecast remaining spend', value: money(forecast.forecastRemainingSpend), tone: forecast.forecastRemainingSpend.gt(0) ? 'warning' : 'default', badgePlacement: 'title', badgeLabel: current ? confidence.label : undefined, badgeVariant: confidence.badgeVariant },
    { title: 'Safe to spend', value: money(forecast.safeToSpend), tone: safe.tone },
    { title: 'Daily safe spend', value: `${money(forecast.dailySafeSpend)}/day`, tone: safe.tone, badgeLabel: past ? 'Month complete' : undefined, badgeVariant: 'outline' },
    { title: 'Weekly safe spend', value: money(forecast.weeklySafeSpend), tone: safe.tone, badgePlacement: 'title', badgeLabel: past ? 'Month complete' : forecast.weeklySafeSpendDays < 7 ? 'Rest of month' : undefined, badgeVariant: 'outline' },
    { title: 'Spending pace', value: forecast.monthContext.monthRelation === 'future' ? 'Unavailable' : `${money(forecast.spendingPace.currentDailyExpense)}/day`, tone: pace.tone, badgeLabel: pace.label, badgeVariant: pace.badgeVariant, badgePlacement: 'title' },
    { title: 'Income realization', value: realization.percentage !== null ? `${realization.percentage.toFixed(1)}%` : realization.status === 'not-started' ? 'Not started' : 'Unavailable', tone: income.tone, badgePlacement: 'title', badgeVariant: income.badgeVariant, badgeLabel: realization.status === 'unavailable' ? 'No planned income' : realization.status === 'not-started' ? `${money(realization.totalPlannedAmount)} planned` : `${money(realization.actualReceivedAmount)} of ${money(realization.totalPlannedAmount)} received` }
  ];
}
