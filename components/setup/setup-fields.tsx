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
        <div className="setup-field">
          <label htmlFor="currency">Base currency</label>
          <Select id="currency" name="currency" defaultValue={selectedCurrency} className="setup-select" aria-describedby="currency-description">
            {allowedCurrencies.map((currency) => (
              <option key={currency} value={currency}>{currencyLabels[currency]}</option>
            ))}
          </Select>
          <p id="currency-description" className="setup-helper">
            Used for all your transactions and reports
          </p>
        </div>
      ) : null}
      <div className="setup-field">
        <label htmlFor="timeZone">Account time zone</label>
        <TimeZoneSelect id="timeZone" initialTimeZone={initialTimeZone} timeZones={timeZones} appearance="setup" />
      </div>
      {variant === "first-time" ? (
        <div className="setup-defaults">
          <label className="setup-checkbox-label">
            <input type="checkbox" name="createDefaults" defaultChecked aria-describedby="defaults-description" />
            <span>
              <span className="setup-checkbox-title">Create starter categories</span>
              <span id="defaults-description" className="setup-helper">
                Start with common income and expense categories
              </span>
            </span>
          </label>
        </div>
      ) : null}
    </>
  );
}
