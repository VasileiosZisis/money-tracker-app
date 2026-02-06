import { redirect } from "next/navigation";
import {
  completeSetup,
  createDefaultCategories,
  setCurrency,
} from "@/actions/setup";
import { db } from "@/lib/db";
import { getUserIdOrThrow } from "@/lib/auth/session";
import {
  allowedCurrencies,
  setupSubmitSchema,
} from "@/lib/validators/setup";

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

async function finishSetupAction(formData: FormData) {
  "use server";

  const parsed = setupSubmitSchema.parse({
    currency: formData.get("currency"),
    createDefaults: formData.get("createDefaults") === "on",
  });

  await setCurrency(parsed.currency);

  if (parsed.createDefaults) {
    await createDefaultCategories();
  }

  await completeSetup();
  redirect("/dashboard");
}

export default async function SetupPage() {
  const userId = await getUserIdOrThrow();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { currency: true },
  });

  const selectedCurrency = user?.currency ?? "EUR";

  return (
    <section className="mx-auto w-full max-w-2xl rounded-card border border-border bg-surface p-4 sm:p-6">
      <h1 className="text-title-page text-text-primary">Setup</h1>
      <p className="mt-2 text-body-base text-text-secondary">
        Choose your base currency and optional default categories before using
        the app.
      </p>

      <form action={finishSetupAction} className="mt-6 space-y-6">
        <div>
          <label
            htmlFor="currency"
            className="block text-title-section text-text-primary"
          >
            Base currency
          </label>
          <p className="mt-1 text-meta text-text-secondary">
            All transactions will use this currency.
          </p>
          <select
            id="currency"
            name="currency"
            defaultValue={selectedCurrency}
            className="mt-3 w-full rounded-input border border-border bg-background px-3 py-3 text-body-base text-text-primary focus:border-primary focus:outline-none"
          >
            {allowedCurrencies.map((currency) => (
              <option key={currency} value={currency}>
                {currencyLabels[currency]}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-input border border-border bg-background p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="createDefaults"
              defaultChecked
              className="mt-1 h-4 w-4 rounded border-border bg-surface text-primary"
            />
            <span>
              <span className="block text-body-base text-text-primary">
                Create default categories
              </span>
              <span className="block text-meta text-text-secondary">
                Adds a starter set of Income and Expense categories. Safe to run
                multiple times.
              </span>
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="w-full rounded-input bg-primary px-4 py-3 text-body-base font-semibold text-surface transition-colors hover:bg-primary-hover"
        >
          Finish setup
        </button>
      </form>
    </section>
  );
}
