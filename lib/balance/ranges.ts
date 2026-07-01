import {
  assertCompletedBalancePeriod,
  getLatestCompletedMonth,
  shiftMonthKey,
} from "@/lib/balance/months";
import type { BalancePeriod } from "@/lib/balance/types";
import type { BalanceRangeQuery } from "@/lib/validators/balance-adjustment";

const TRAILING_MONTH_COUNTS = {
  "last-3-months": 3,
  "last-6-months": 6,
  "last-9-months": 9,
  "last-12-months": 12,
} as const;

const PREVIOUS_YEAR_COUNTS = {
  "previous-1-year": 1,
  "previous-2-years": 2,
  "previous-3-years": 3,
} as const;

function assertCustomSelection(
  selection: BalanceRangeQuery,
): asserts selection is Extract<BalanceRangeQuery, { balanceRange: "custom" }> {
  if (
    selection.balanceRange !== "custom" ||
    (selection.balanceMode !== "months" && selection.balanceMode !== "years") ||
    !selection.balanceStart ||
    !selection.balanceEnd
  ) {
    throw new Error("Custom balance period is incomplete.");
  }
}

export function resolveBalancePeriod(params: {
  selection: BalanceRangeQuery;
  referenceDate: string;
  earliestActivityMonth?: string | null;
}): BalancePeriod | null {
  const { selection, referenceDate } = params;
  const latestCompletedMonth = getLatestCompletedMonth(referenceDate);
  const currentYear = referenceDate.slice(0, 4);
  let period: BalancePeriod | null;

  if (selection.balanceRange === "current-year") {
    if (!latestCompletedMonth.startsWith(currentYear)) {
      return null;
    }

    period = {
      startMonth: `${currentYear}-01`,
      endMonth: latestCompletedMonth,
    };
  } else if (selection.balanceRange in TRAILING_MONTH_COUNTS) {
    const count =
      TRAILING_MONTH_COUNTS[
        selection.balanceRange as keyof typeof TRAILING_MONTH_COUNTS
      ];
    period = {
      startMonth: shiftMonthKey(latestCompletedMonth, -(count - 1)),
      endMonth: latestCompletedMonth,
    };
  } else if (selection.balanceRange in PREVIOUS_YEAR_COUNTS) {
    const count =
      PREVIOUS_YEAR_COUNTS[
        selection.balanceRange as keyof typeof PREVIOUS_YEAR_COUNTS
      ];
    const currentYearStart = `${currentYear}-01`;
    period = {
      startMonth: shiftMonthKey(currentYearStart, -12 * count),
      endMonth: shiftMonthKey(currentYearStart, -1),
    };
  } else if (selection.balanceRange === "all-time") {
    if (!params.earliestActivityMonth) {
      return null;
    }

    period = {
      startMonth: params.earliestActivityMonth,
      endMonth: latestCompletedMonth,
    };
  } else {
    assertCustomSelection(selection);

    period =
      selection.balanceMode === "years"
        ? {
            startMonth: `${selection.balanceStart}-01`,
            endMonth: `${selection.balanceEnd}-12`,
          }
        : {
            startMonth: selection.balanceStart,
            endMonth: selection.balanceEnd,
          };
  }

  return assertCompletedBalancePeriod(period, referenceDate);
}
