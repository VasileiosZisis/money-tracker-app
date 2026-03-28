import { getMonthRange } from "@/lib/dates/month";

export type ForecastMonthRelation = "past" | "current" | "future";

export type ForecastMonthContext = {
  selectedMonth: string;
  monthRelation: ForecastMonthRelation;
  referenceDate: string;
  currentDayOfMonth: number | null;
  start: string;
  endExclusive: string;
  daysInMonth: number;
  elapsedDays: number;
  remainingDays: number;
  trailingFullMonths: string[];
};

const YYYY_MM_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const YYYY_MM_DD_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function padNumber(value: number) {
  return value.toString().padStart(2, "0");
}

function parseMonthKey(month: string) {
  const match = YYYY_MM_REGEX.exec(month);

  if (!match) {
    throw new Error("Invalid month format. Expected YYYY-MM.");
  }

  return {
    year: Number(month.slice(0, 4)),
    month: Number(month.slice(5, 7)),
  };
}

function parseLocalDate(localDate: string) {
  if (!YYYY_MM_DD_REGEX.test(localDate)) {
    throw new Error("Invalid local date format. Expected YYYY-MM-DD.");
  }

  const year = Number(localDate.slice(0, 4));
  const month = Number(localDate.slice(5, 7));
  const day = Number(localDate.slice(8, 10));
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Invalid local date value. Expected YYYY-MM-DD.");
  }

  return { year, month, day };
}

function shiftMonthKey(month: string, delta: number) {
  const parsed = parseMonthKey(month);
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1 + delta, 1));

  return `${shifted.getUTCFullYear()}-${padNumber(shifted.getUTCMonth() + 1)}`;
}

function getDaysInMonth(month: string) {
  const parsed = parseMonthKey(month);
  return new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
}

export function getTodayLocalDate(now = new Date()) {
  return `${now.getFullYear()}-${padNumber(now.getMonth() + 1)}-${padNumber(now.getDate())}`;
}

export function buildForecastMonthContext(params: {
  selectedMonth: string;
  referenceDate: string;
  trailingMonthCount?: number;
}): ForecastMonthContext {
  const trailingMonthCount = params.trailingMonthCount ?? 3;

  parseMonthKey(params.selectedMonth);
  const referenceDate = parseLocalDate(params.referenceDate);
  const referenceMonth = params.referenceDate.slice(0, 7);
  const { start, endExclusive } = getMonthRange(params.selectedMonth);
  const daysInMonth = getDaysInMonth(params.selectedMonth);

  let monthRelation: ForecastMonthRelation = "current";

  if (params.selectedMonth < referenceMonth) {
    monthRelation = "past";
  } else if (params.selectedMonth > referenceMonth) {
    monthRelation = "future";
  }

  const currentDayOfMonth =
    monthRelation === "current" ? Math.min(referenceDate.day, daysInMonth) : null;

  const elapsedDays =
    monthRelation === "past" ? daysInMonth : monthRelation === "future" ? 0 : currentDayOfMonth ?? 0;

  const remainingDays =
    monthRelation === "past"
      ? 0
      : monthRelation === "future"
        ? daysInMonth
        : Math.max(daysInMonth - (currentDayOfMonth ?? 0), 0);

  const trailingFullMonths = Array.from({ length: trailingMonthCount }, (_, index) =>
    shiftMonthKey(params.selectedMonth, -(trailingMonthCount - index)),
  );

  return {
    selectedMonth: params.selectedMonth,
    monthRelation,
    referenceDate: params.referenceDate,
    currentDayOfMonth,
    start,
    endExclusive,
    daysInMonth,
    elapsedDays,
    remainingDays,
    trailingFullMonths,
  };
}
