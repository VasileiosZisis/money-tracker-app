import {
  CalendarClock,
  Download,
  FileSpreadsheet,
  Globe2,
  MoonStar,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { redirect } from "next/navigation";

import { updateAccountTimeZone } from "@/actions/settings";
import { ImportWorkspace } from "@/components/settings/import-workspace";
import { ThemeSettings } from "@/components/settings/theme-settings";
import { TimeZoneSelect } from "@/components/settings/time-zone-select";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ToastFeedback } from "@/components/ui/toast-feedback";
import { getAuthenticatedUserPreferences } from "@/lib/auth/session";
import {
  getCurrentMonthInTimeZone,
  getSupportedTimeZones,
} from "@/lib/dates/time-zone";
import {
  buildPathWithSearchParams,
  firstSearchParamValue,
  resolveSearchParams,
  type PageSearchParams,
} from "@/lib/routes/search-params";

const settingsSections = [
  {
    href: "#account-time-zone",
    label: "Account time zone",
    icon: CalendarClock,
  },
  { href: "#import", label: "Import", icon: Upload },
  { href: "#export", label: "Export", icon: Download },
  { href: "#theme", label: "Theme", icon: MoonStar },
];

function buildSettingsPageUrl(params: { error?: string; success?: string }) {
  return `${buildPathWithSearchParams("/settings", params)}#account-time-zone`;
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

  const currentMonth = getCurrentMonthInTimeZone(user.timeZone);

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
    <div className="flex flex-col gap-6">
      <ToastFeedback error={errorMessage} success={successMessage} />

      <Card>
        <CardContent className="p-3">
          <nav
            aria-label="Settings sections"
            className="flex flex-wrap gap-2"
          >
            {settingsSections.map((section) => {
              const Icon = section.icon;

              return (
                <a
                  key={section.href}
                  href={section.href}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Icon />
                  {section.label}
                </a>
              );
            })}
          </nav>
        </CardContent>
      </Card>

      <section
        id="account-time-zone"
        aria-labelledby="account-time-zone-heading"
        className="flex scroll-mt-5 flex-col gap-4"
      >
        <h2
          id="account-time-zone-heading"
          className="text-lg font-semibold text-foreground"
        >
          Account time zone
        </h2>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(400px,0.65fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Date and time</CardTitle>
              <CardDescription>
                One account time zone controls the financial day on every
                device.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/80 bg-background/60 p-4">
                <Globe2 className="size-5 text-muted-foreground" />
                <p className="mt-4 text-sm font-semibold text-foreground">
                  Account-wide
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  The selected time zone stays fixed until you change it here.
                </p>
              </div>
              <div className="rounded-xl border border-border/80 bg-background/60 p-4">
                <CalendarClock className="size-5 text-muted-foreground" />
                <p className="mt-4 text-sm font-semibold text-foreground">
                  Day-sensitive data
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Transaction defaults, forecasts, planned items, and exports
                  use this clock.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Account time zone</CardTitle>
              <CardDescription>
                Select the IANA time zone that should define today for this
                account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                action={updateTimeZoneAction}
                className="flex flex-col gap-4"
              >
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel htmlFor="settings-time-zone">
                      Time zone
                    </FieldLabel>
                    <TimeZoneSelect
                      key={user.timeZone}
                      id="settings-time-zone"
                      initialTimeZone={user.timeZone}
                      timeZones={getSupportedTimeZones()}
                    />
                  </Field>
                </FieldGroup>

                <Separator />
                <div className="flex justify-end pt-1">
                  <Button type="submit">Save time zone</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section
        id="import"
        aria-labelledby="import-heading"
        className="flex scroll-mt-5 flex-col gap-4"
      >
        <h2 id="import-heading" className="text-lg font-semibold text-foreground">
          Import
        </h2>
        <ImportWorkspace currentMonth={currentMonth} />
      </section>

      <section
        id="export"
        aria-labelledby="export-heading"
        className="flex scroll-mt-5 flex-col gap-4"
      >
        <h2 id="export-heading" className="text-lg font-semibold text-foreground">
          Export
        </h2>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>CSV export</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action="/settings/export/download"
                method="get"
                className="flex flex-col gap-4"
              >
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel htmlFor="export-month">Month</FieldLabel>
                    <Input
                      key={currentMonth}
                      id="export-month"
                      type="month"
                      name="month"
                      defaultValue={currentMonth}
                      className="relative pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2"
                    />
                  </Field>
                </FieldGroup>

                <Button type="submit" className="w-full sm:w-fit">
                  <Download data-icon="inline-start" />
                  Download CSV
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What&apos;s included</CardTitle>
              <CardDescription>
                The export stays limited to tracked transaction fields for the
                selected month.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4">
              <div className="rounded-xl border border-border/80 bg-background/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <FileSpreadsheet className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      Columns
                    </p>
                    <p className="text-sm text-muted-foreground">
                      `localDate`, `type`, `category`, `subcategory`, `amount`,
                      `source`, `note`
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/80 bg-background/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <ShieldCheck className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      Scope
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Export is generated only from your authenticated account
                      and the month you select.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section
        id="theme"
        aria-labelledby="theme-heading"
        className="flex scroll-mt-5 flex-col gap-4"
      >
        <h2 id="theme-heading" className="text-lg font-semibold text-foreground">
          Theme
        </h2>

        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ThemeSettings />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
