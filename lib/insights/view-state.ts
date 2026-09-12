import { shiftMonthKey } from "@/lib/balance/months";
import type {
  InsightsPeriod,
  SpendingChangeWindow,
} from "@/lib/insights/spending-history";

export type InsightsControlState = {
  period: InsightsPeriod;
  categoryId?: string;
  changeWindow?: SpendingChangeWindow;
  changeMonth?: string;
};

export type InsightsControlScope = "history" | "category" | "drivers";

export function getPreservedInsightsParams(
  state: InsightsControlState,
  changing: InsightsControlScope,
) {
  const params: Record<string, string> = {};

  if (changing !== "history") {
    params.period = String(state.period);
  }

  if (changing !== "category" && state.categoryId) {
    params.categoryId = state.categoryId;
  }

  if (changing !== "drivers" && state.changeWindow) {
    params.changeWindow = String(state.changeWindow);

    if (state.changeWindow === 1 && state.changeMonth) {
      params.changeMonth = state.changeMonth;
    }
  }

  return params;
}

export function getCompletedInsightsPeriodRange(
  currentMonth: string,
  period: InsightsPeriod,
) {
  return {
    startMonth: shiftMonthKey(currentMonth, -period),
    endMonth: shiftMonthKey(currentMonth, -1),
  };
}
