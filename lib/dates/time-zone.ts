export type AccountDateContext = {
  localDate: string;
  currentMonth: string;
  dateLabel: string;
  daysLeft: number;
  daysLeftLabel: string;
};

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function getLocalDatePartsInTimeZone(
  timeZone: string,
  instant: Date,
): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    calendar: "gregory",
    numberingSystem: "latn",
  }).formatToParts(instant);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, Number(part.value)]),
  );

  if (!values.year || !values.month || !values.day) {
    throw new Error("Could not resolve the local date for this time zone.");
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function getSupportedTimeZones() {
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];

  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

export function getLocalDateInTimeZone(
  timeZone: string,
  instant = new Date(),
) {
  const { year, month, day } = getLocalDatePartsInTimeZone(timeZone, instant);
  return `${year}-${padNumber(month)}-${padNumber(day)}`;
}

export function getCurrentMonthInTimeZone(
  timeZone: string,
  instant = new Date(),
) {
  return getLocalDateInTimeZone(timeZone, instant).slice(0, 7);
}

export function getAccountDateContext(
  timeZone: string,
  instant = new Date(),
): AccountDateContext {
  const { year, month, day } = getLocalDatePartsInTimeZone(timeZone, instant);
  const localDate = `${year}-${padNumber(month)}-${padNumber(day)}`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daysLeft = daysInMonth - day;

  return {
    localDate,
    currentMonth: localDate.slice(0, 7),
    dateLabel: new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(instant),
    daysLeft,
    daysLeftLabel: `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`,
  };
}
