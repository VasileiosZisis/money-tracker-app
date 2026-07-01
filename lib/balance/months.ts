import type {
  BalanceAdjustmentLike,
  BalancePeriod,
  BalanceTransactionLike,
} from "@/lib/balance/types";

const YYYY_MM_REGEX = /^(\d{4})-(0[1-9]|1[0-2])$/;
const YYYY_MM_DD_REGEX =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function padNumber(value: number, length = 2) {
  return value.toString().padStart(length, "0");
}

function parseMonthKey(month: string) {
  const match = YYYY_MM_REGEX.exec(month);

  if (!match) {
    throw new Error("Invalid month format. Expected YYYY-MM.");
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
  };
}

function parseLocalDate(localDate: string) {
  const match = YYYY_MM_DD_REGEX.exec(localDate);

  if (!match) {
    throw new Error("Invalid local date format. Expected YYYY-MM-DD.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Invalid local date value. Expected YYYY-MM-DD.");
  }

  return { year, month, day };
}

export function shiftMonthKey(month: string, delta: number) {
  if (!Number.isInteger(delta)) {
    throw new Error("Month shift must be a whole number.");
  }

  const parsed = parseMonthKey(month);
  const absoluteMonth = parsed.year * 12 + parsed.month - 1 + delta;
  const shiftedYear = Math.floor(absoluteMonth / 12);
  const shiftedMonth = ((absoluteMonth % 12) + 12) % 12;

  if (shiftedYear < 0 || shiftedYear > 9999) {
    throw new Error("Shifted month is outside the supported range.");
  }

  return `${padNumber(shiftedYear, 4)}-${padNumber(shiftedMonth + 1)}`;
}

export function getMonthFromLocalDate(localDate: string) {
  parseLocalDate(localDate);
  return localDate.slice(0, 7);
}

export function getLatestCompletedMonth(referenceDate: string) {
  const parsed = parseLocalDate(referenceDate);
  const currentMonth = `${padNumber(parsed.year, 4)}-${padNumber(parsed.month)}`;

  return shiftMonthKey(currentMonth, -1);
}

export function listInclusiveMonths(startMonth: string, endMonth: string) {
  parseMonthKey(startMonth);
  parseMonthKey(endMonth);

  if (startMonth > endMonth) {
    throw new Error("Start month must be before or equal to end month.");
  }

  const months: string[] = [];
  let month = startMonth;

  while (true) {
    months.push(month);

    if (month === endMonth) {
      break;
    }

    month = shiftMonthKey(month, 1);
  }

  return months;
}

export function assertCompletedBalancePeriod(
  period: BalancePeriod,
  referenceDate: string,
) {
  listInclusiveMonths(period.startMonth, period.endMonth);
  const latestCompletedMonth = getLatestCompletedMonth(referenceDate);

  if (period.endMonth > latestCompletedMonth) {
    throw new Error("Balance period must include completed months only.");
  }

  return period;
}

export function findEarliestCompletedActivityMonth(params: {
  referenceDate: string;
  transactions: readonly BalanceTransactionLike[];
  adjustments: readonly BalanceAdjustmentLike[];
}) {
  const latestCompletedMonth = getLatestCompletedMonth(params.referenceDate);
  const completedMonths = [
    ...params.transactions.map((transaction) =>
      getMonthFromLocalDate(transaction.localDate),
    ),
    ...params.adjustments.map((adjustment) => {
      parseMonthKey(adjustment.effectiveMonth);
      return adjustment.effectiveMonth;
    }),
  ].filter((month) => month <= latestCompletedMonth);

  if (completedMonths.length === 0) {
    return null;
  }

  return completedMonths.reduce((earliest, month) =>
    month < earliest ? month : earliest,
  );
}
