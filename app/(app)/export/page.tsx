import { Download, FileSpreadsheet, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAuthenticatedUserPreferences } from "@/lib/auth/session";
import { getCurrentMonthInTimeZone } from "@/lib/dates/time-zone";
import { redirect } from "next/navigation";

export default async function ExportPage() {
  const user = await getAuthenticatedUserPreferences();

  if (!user.timeZone) {
    redirect("/setup");
  }

  const defaultMonth = getCurrentMonthInTimeZone(user.timeZone);

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>CSV export</CardTitle>
          </CardHeader>
          <CardContent>
            <form action="/export/download" method="get" className="grid gap-4">
              <Input
                key={defaultMonth}
                id="month"
                aria-label="Month"
                type="month"
                name="month"
                defaultValue={defaultMonth}
                className="relative pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2"
              />

              <Button type="submit" className="w-full sm:w-fit">
                <Download />
                Download CSV
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What&apos;s included</CardTitle>
            <CardDescription>
              The export stays limited to tracked transaction fields for the selected month.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <FileSpreadsheet className="size-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Columns</p>
                  <p className="text-sm text-muted-foreground">
                    `localDate`, `type`, `category`, `subcategory`, `amount`, `source`, `note`
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
                  <p className="text-sm font-semibold text-foreground">Scope</p>
                  <p className="text-sm text-muted-foreground">
                    Export is generated only from your authenticated account and the month you
                    select.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
