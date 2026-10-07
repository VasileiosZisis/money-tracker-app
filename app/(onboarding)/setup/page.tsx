import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site/metadata";
import { ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";

import {
  completeSetup,
  createDefaultCategories,
  setCurrency,
  setTimeZone,
} from "@/actions/setup";
import { Button } from "@/components/ui/button";
import { SetupScreen } from "@/components/setup/setup-screen";
import { SetupFields } from "@/components/setup/setup-fields";
import { getSupportedTimeZones } from "@/lib/dates/time-zone";
import { getAuthenticatedUserPreferences } from "@/lib/auth/session";
import {
  buildPathWithSearchParams,
  firstSearchParamValue,
  resolveSearchParams,
  type PageSearchParams,
} from "@/lib/routes/search-params";
import {
  setupSubmitSchema,
  timeZoneSchema,
} from "@/lib/validators/setup";

export const metadata: Metadata = pageMetadata.setup;

function buildSetupPageUrl(error?: string) {
  return buildPathWithSearchParams("/setup", { error });
}

async function finishSetupAction(formData: FormData) {
  "use server";

  const parsed = setupSubmitSchema.safeParse({
    currency: formData.get("currency"),
    timeZone: formData.get("timeZone"),
    createDefaults: formData.get("createDefaults") === "on",
  });

  if (!parsed.success) {
    redirect(buildSetupPageUrl(parsed.error.issues[0]?.message ?? "Invalid setup input."));
  }

  const currencyResult = await setCurrency(parsed.data.currency);

  if (!currencyResult.ok) {
    redirect(buildSetupPageUrl(currencyResult.error));
  }

  const timeZoneResult = await setTimeZone(parsed.data.timeZone);

  if (!timeZoneResult.ok) {
    redirect(buildSetupPageUrl(timeZoneResult.error));
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

async function finishTimeZoneSetupAction(formData: FormData) {
  "use server";

  const parsed = timeZoneSchema.safeParse(formData.get("timeZone"));

  if (!parsed.success) {
    redirect(buildSetupPageUrl(parsed.error.issues[0]?.message ?? "Invalid time zone."));
  }

  const result = await setTimeZone(parsed.data);

  if (!result.ok) {
    redirect(buildSetupPageUrl(result.error));
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
  const user = await getAuthenticatedUserPreferences();
  const selectedCurrency = user.currency;
  const timeZones = getSupportedTimeZones();
  const isTimeZoneCompletion = user.hasCompletedSetup && !user.timeZone;

  const variant = isTimeZoneCompletion ? "time-zone" : "first-time";

  return (
    <SetupScreen
      variant={variant}
      errorMessage={errorMessage}
      form={
        <form action={isTimeZoneCompletion ? finishTimeZoneSetupAction : finishSetupAction} className="grid gap-4">
          <SetupFields variant={variant} selectedCurrency={selectedCurrency} initialTimeZone={user.timeZone} timeZones={timeZones} />
          <Button type="submit" className="w-full justify-center">
            {isTimeZoneCompletion ? "Save and continue" : "Finish setup"}
            <ArrowRight />
          </Button>
        </form>
      }
    />
  );
}
