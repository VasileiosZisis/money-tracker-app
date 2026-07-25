import { Download, FileSpreadsheet, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export default function ExportPage() {
  const defaultMonth = getCurrentMonth();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Records"
        title="Export"
        description="Download a clean CSV for any month already tracked in the app."
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(300px,0.7fr)]">
        <Card>
          <CardHeader>
            <CardTitle>CSV export</CardTitle>
            <CardDescription>
              Generate a file from the selected month using the current transaction records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/export/download" method="get" className="grid gap-4">
              <div className="space-y-2">
                <label htmlFor="month" className="text-sm font-medium text-foreground">
                  Month
                </label>
                <Input id="month" type="month" name="month" defaultValue={defaultMonth} />
              </div>

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
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <FileSpreadsheet className="size-4.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Columns</p>
                  <p className="text-sm text-muted-foreground">
                    `localDate`, `type`, `category`, `subcategory`, `amount`, `source`, `note`
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <ShieldCheck className="size-4.5" />
                </div>
                <div>
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
