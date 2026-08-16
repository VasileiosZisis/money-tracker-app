import { z } from "zod";

import { isValidTimeZone } from "@/lib/dates/time-zone";

export const allowedCurrencies = [
  "EUR",
  "GBP",
  "USD",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "RON",
  "BGN",
  "TRY",
  "AUD",
  "CAD",
  "NZD",
  "JPY",
] as const;

export const currencySchema = z.enum(allowedCurrencies);

export const timeZoneSchema = z
  .string()
  .trim()
  .min(1, "Time zone is required.")
  .refine(isValidTimeZone, "Select a valid time zone.");

export const setupSubmitSchema = z.object({
  currency: currencySchema,
  timeZone: timeZoneSchema,
  createDefaults: z.boolean(),
});
