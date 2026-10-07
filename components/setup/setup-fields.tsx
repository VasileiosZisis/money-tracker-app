import { TimeZoneSelect } from "@/components/settings/time-zone-select";
import { Select } from "@/components/ui/select";
import { allowedCurrencies } from "@/lib/validators/setup";
import type { SetupVariant } from "@/lib/dev/setup-preview";
const currencyLabels: Record<(typeof allowedCurrencies)[number], string> = {
  EUR: "EUR - Euro",
  GBP: "GBP - British Pound",
  USD: "USD - US Dollar",
  CHF: "CHF - Swiss Franc",
  SEK: "SEK - Swedish Krona",
  NOK: "NOK - Norwegian Krone",
  DKK: "DKK - Danish Krone",
  PLN: "PLN - Polish Zloty",
  CZK: "CZK - Czech Koruna",
  HUF: "HUF - Hungarian Forint",
  RON: "RON - Romanian Leu",
  BGN: "BGN - Bulgarian Lev",
  TRY: "TRY - Turkish Lira",
  AUD: "AUD - Australian Dollar",
  CAD: "CAD - Canadian Dollar",
  NZD: "NZD - New Zealand Dollar",
  JPY: "JPY - Japanese Yen",
};

export function SetupFields({ variant, selectedCurrency, initialTimeZone, timeZones }: {
  variant: SetupVariant;
  selectedCurrency: string;
  initialTimeZone?: string | null;
  timeZones: string[];
}) {
  return (
    <>
      {variant === "first-time" ? (
        <div className="space-y-2">
          <label htmlFor="currency" className="text-sm font-medium text-foreground">Base currency</label>
          <Select id="currency" name="currency" defaultValue={selectedCurrency}>
            {allowedCurrencies.map((currency) => (
              <option key={currency} value={currency}>{currencyLabels[currency]}</option>
            ))}
          </Select>
          <p className="text-sm leading-6 text-muted-foreground">
            This currency is used throughout the dashboard, transaction list, and CSV export.
          </p>
        </div>
      ) : null}
      <div className="space-y-2">
        <label htmlFor="timeZone" className="text-sm font-medium text-foreground">Account time zone</label>
        <TimeZoneSelect id="timeZone" initialTimeZone={initialTimeZone} timeZones={timeZones} />
      </div>
      {variant === "first-time" ? (
        <div className="rounded-xl border border-border/80 bg-background/60 p-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="createDefaults" defaultChecked className="mt-0.5 size-4 rounded border-input bg-background text-primary" />
            <span className="space-y-1">
              <span className="block text-sm font-semibold text-foreground">Create default categories</span>
              <span className="block text-sm leading-6 text-muted-foreground">
                Adds a starter set of income and expense categories. It is safe to use if you
                want to begin with sensible defaults.
              </span>
            </span>
          </label>
        </div>
      ) : null}
    </>
  );
}
