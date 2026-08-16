import assert from "node:assert/strict";
import test from "node:test";

import {
  getAccountDateContext,
  getCurrentMonthInTimeZone,
  getLocalDateInTimeZone,
  isValidTimeZone,
} from "@/lib/dates/time-zone";
import { setupSubmitSchema, timeZoneSchema } from "@/lib/validators/setup";

const UTC_INSTANT_BEFORE_EASTERN_EUROPE_MIDNIGHT = new Date(
  "2026-08-16T21:30:00.000Z",
);

test("resolves the same instant to the account time zone's calendar date", () => {
  assert.equal(
    getLocalDateInTimeZone(
      "Europe/Athens",
      UTC_INSTANT_BEFORE_EASTERN_EUROPE_MIDNIGHT,
    ),
    "2026-08-17",
  );
  assert.equal(
    getLocalDateInTimeZone(
      "UTC",
      UTC_INSTANT_BEFORE_EASTERN_EUROPE_MIDNIGHT,
    ),
    "2026-08-16",
  );
});

test("uses the account month at a UTC month boundary", () => {
  const instant = new Date("2026-08-31T21:30:00.000Z");

  assert.equal(getCurrentMonthInTimeZone("Europe/Athens", instant), "2026-09");
  assert.equal(getCurrentMonthInTimeZone("UTC", instant), "2026-08");
});

test("builds a complete account date context", () => {
  assert.deepEqual(
    getAccountDateContext(
      "Europe/Athens",
      UTC_INSTANT_BEFORE_EASTERN_EUROPE_MIDNIGHT,
    ),
    {
      localDate: "2026-08-17",
      currentMonth: "2026-08",
      dateLabel: "17 August 2026",
      daysLeft: 14,
      daysLeftLabel: "14 days left",
    },
  );
});

test("validates IANA time zone identifiers", () => {
  assert.equal(isValidTimeZone("Europe/Athens"), true);
  assert.equal(isValidTimeZone("UTC"), true);
  assert.equal(isValidTimeZone("Not/A_Time_Zone"), false);
  assert.equal(timeZoneSchema.safeParse("Europe/Athens").success, true);
  assert.equal(timeZoneSchema.safeParse("Not/A_Time_Zone").success, false);
});

test("requires a valid time zone when setup is submitted", () => {
  assert.equal(
    setupSubmitSchema.safeParse({
      currency: "EUR",
      timeZone: "Europe/Athens",
      createDefaults: true,
    }).success,
    true,
  );
  assert.equal(
    setupSubmitSchema.safeParse({
      currency: "EUR",
      timeZone: "",
      createDefaults: true,
    }).success,
    false,
  );
});
