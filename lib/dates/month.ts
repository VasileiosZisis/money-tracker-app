const YYYY_MM_REGEX = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function getMonthRange(yyyyMm: string): {
  start: string;
  endExclusive: string;
} {
  const match = YYYY_MM_REGEX.exec(yyyyMm);

  if (!match) {
    throw new Error("Invalid month format. Expected YYYY-MM.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  const start = `${match[1]}-${match[2]}-01`;
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const endExclusive = `${nextMonthYear.toString().padStart(4, "0")}-${nextMonth
    .toString()
    .padStart(2, "0")}-01`;

  return { start, endExclusive };
}

export function formatMonthLabel(yyyyMm: string, locale = "en-US"): string {
  const match = YYYY_MM_REGEX.exec(yyyyMm);

  if (!match) {
    return yyyyMm;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = new Date(Date.UTC(year, month - 1, 1));

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
