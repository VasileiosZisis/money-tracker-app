import { z } from "zod";

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

export const setupSubmitSchema = z.object({
  currency: currencySchema,
  createDefaults: z.boolean(),
});
