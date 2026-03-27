import { ArrowRight, CircleCheck, ScrollText, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";

import {
  completeSetup,
  createDefaultCategories,
  setCurrency,
} from "@/actions/setup";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageNotice } from "@/components/ui/page-notice";
import { Select } from "@/components/ui/select";
import { db } from "@/lib/db";
import { getUserIdOrThrow } from "@/lib/auth/session";
import {
  buildPathWithSearchParams,
  firstSearchParamValue,
  resolveSearchParams,
  type PageSearchParams,
} from "@/lib/routes/search-params";
import { allowedCurrencies, setupSubmitSchema } from "@/lib/validators/setup";

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

function buildSetupPageUrl(error?: string) {
  return buildPathWithSearchParams("/setup", { error });
}

async function finishSetupAction(formData: FormData) {
  "use server";

  const parsed = setupSubmitSchema.safeParse({
    currency: formData.get("currency"),
    createDefaults: formData.get("createDefaults") === "on",
  });

  if (!parsed.success) {
    redirect(buildSetupPageUrl(parsed.error.issues[0]?.message ?? "Invalid setup input."));
  }

  const currencyResult = await setCurrency(parsed.data.currency);

  if (!currencyResult.ok) {
    redirect(buildSetupPageUrl(currencyResult.error));
  }

  if (parsed.data.createDefaults) {
    const categoryResult = await createDefaultCategories();

    if (!categoryResult.ok) {
      redirect(buildSetupPageUrl(categoryResult.error));
    }
  }

  const completionResult = await completeSetup();

  if (!completionResult.ok) {
    redirect(buildSetupPageUrl(completionResult.error));
  }

  redirect("/dashboard");
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const resolvedParams = await resolveSearchParams(searchParams);
  const errorMessage = firstSearchParamValue(resolvedParams.error);
  const userId = await getUserIdOrThrow();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { currency: true },
  });

  const selectedCurrency = user?.currency ?? "EUR";

  return (
    <section className="grid w-full gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.85fr)]">
      <Card className="overflow-hidden">
        <CardContent className="flex h-full flex-col justify-between gap-10 p-8 md:p-10">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-floating">
                <ScrollText className="size-5" />
              </div>
              <div>
                <p className="text-base font-semibold tracking-tight text-foreground">
                  Money Tracker
                </p>
                <p className="text-sm text-muted-foreground">One-time setup</p>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                Set the base currency and start with a clean structure.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                Setup is intentionally short. Once it is complete, the app redirects you into the
                main workspace and keeps future entry simple.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-border/80 bg-background/60 p-4">
              <WalletCards className="size-5 text-muted-foreground" />
              <p className="mt-4 text-sm font-semibold text-foreground">Base currency</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Every transaction uses the same currency selected here.
              </p>
            </div>
            <div className="rounded-[24px] border border-border/80 bg-background/60 p-4">
              <CircleCheck className="size-5 text-muted-foreground" />
              <p className="mt-4 text-sm font-semibold text-foreground">Starter categories</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Optional defaults give you a usable category list on day one.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit lg:my-auto">
        <CardHeader>
          <CardTitle>Finish setup</CardTitle>
          <CardDescription>
            Choose the base currency and decide whether to create default categories.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <PageNotice variant="error" title="Setup could not be completed" className="mb-6">
              {errorMessage}
            </PageNotice>
          ) : null}

          <form action={finishSetupAction} className="grid gap-6">
            <div className="space-y-2">
              <label htmlFor="currency" className="text-sm font-medium text-foreground">
                Base currency
              </label>
              <Select id="currency" name="currency" defaultValue={selectedCurrency}>
                {allowedCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currencyLabels[currency]}
                  </option>
                ))}
              </Select>
              <p className="text-sm leading-6 text-muted-foreground">
                This currency is used throughout the dashboard, transaction list, and CSV export.
              </p>
            </div>

            <div className="rounded-[24px] border border-border/80 bg-background/60 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="createDefaults"
                  defaultChecked
                  className="mt-0.5 size-4 rounded border-input bg-background text-primary"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-semibold text-foreground">
                    Create default categories
                  </span>
                  <span className="block text-sm leading-6 text-muted-foreground">
                    Adds a starter set of income and expense categories. It is safe to use if you
                    want to begin with sensible defaults.
                  </span>
                </span>
              </label>
            </div>

            <Button type="submit" className="w-full justify-center">
              Finish setup
              <ArrowRight />
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
