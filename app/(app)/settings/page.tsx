import { CalendarClock, Globe2 } from "lucide-react";
import { redirect } from "next/navigation";

import { updateAccountTimeZone } from "@/actions/settings";
import { TimeZoneSelect } from "@/components/settings/time-zone-select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToastFeedback } from "@/components/ui/toast-feedback";
import { getAuthenticatedUserPreferences } from "@/lib/auth/session";
import { getSupportedTimeZones } from "@/lib/dates/time-zone";
import {
  buildPathWithSearchParams,
  firstSearchParamValue,
  resolveSearchParams,
  type PageSearchParams,
} from "@/lib/routes/search-params";

function buildSettingsPageUrl(params: { error?: string; success?: string }) {
  return buildPathWithSearchParams("/settings", params);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const resolvedParams = await resolveSearchParams(searchParams);
  const errorMessage = firstSearchParamValue(resolvedParams.error);
  const successMessage = firstSearchParamValue(resolvedParams.success);
  const user = await getAuthenticatedUserPreferences();

  if (!user.timeZone) {
    redirect("/setup");
  }

  async function updateTimeZoneAction(formData: FormData) {
    "use server";

    const result = await updateAccountTimeZone(
      String(formData.get("timeZone") ?? ""),
    );

    if (!result.ok) {
      redirect(buildSettingsPageUrl({ error: result.error }));
    }

    redirect(buildSettingsPageUrl({ success: "Account time zone updated." }));
  }

  return (
    <div className="flex flex-col gap-5">
      <ToastFeedback error={errorMessage} success={successMessage} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(400px,0.65fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Date and time</CardTitle>
            <CardDescription>
              One account time zone controls the financial day on every device.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
              <Globe2 className="size-5 text-muted-foreground" />
              <p className="mt-4 text-sm font-semibold text-foreground">Account-wide</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                The selected time zone stays fixed until you change it here.
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
              <CalendarClock className="size-5 text-muted-foreground" />
              <p className="mt-4 text-sm font-semibold text-foreground">Day-sensitive data</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Transaction defaults, forecasts, planned items, and exports use this clock.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Account time zone</CardTitle>
            <CardDescription>
              Select the IANA time zone that should define today for this account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateTimeZoneAction} className="grid gap-4">
              <div className="space-y-2">
                <label htmlFor="settings-time-zone" className="text-sm font-medium text-foreground">
                  Time zone
                </label>
                <TimeZoneSelect
                  key={user.timeZone}
                  id="settings-time-zone"
                  initialTimeZone={user.timeZone}
                  timeZones={getSupportedTimeZones()}
                />
              </div>

              <div className="flex justify-end border-t border-border/70 pt-5">
                <Button type="submit">Save time zone</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
