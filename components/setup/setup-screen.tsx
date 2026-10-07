import type { ReactNode } from "react";
import { CalendarClock, CircleCheck, Globe2, ScrollText, WalletCards } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageNotice } from "@/components/ui/page-notice";
import type { SetupVariant } from "@/lib/dev/setup-preview";

export function SetupScreen({ variant, errorMessage, form }: {
  variant: SetupVariant;
  errorMessage?: string;
  form: ReactNode;
}) {
  if (variant === "time-zone") {
    return (
      <section className="grid w-full gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(400px,0.85fr)]">
        <Card className="overflow-hidden">
          <CardContent className="flex h-full flex-col justify-between gap-6 p-4 md:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-floating">
                  <ScrollText className="size-5" />
                </div>
                <div>
                  <p className="text-base font-semibold tracking-tight text-foreground">
                    CashContour
                  </p>
                  <p className="text-sm text-muted-foreground">One-time update</p>
                </div>
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                  Confirm your account time zone.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  Your account time zone keeps transaction defaults, forecasts, and planned-item
                  statuses aligned with the same local day.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/80 bg-background/60 p-4">
                <Globe2 className="size-5 text-muted-foreground" />
                <p className="mt-4 text-sm font-semibold text-foreground">One account clock</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Every device uses the time zone you confirm here.
                </p>
              </div>
              <div className="rounded-xl border border-border/80 bg-background/60 p-4">
                <CalendarClock className="size-5 text-muted-foreground" />
                <p className="mt-4 text-sm font-semibold text-foreground">Consistent planning</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Day-sensitive calculations change together at local midnight.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit lg:my-auto">
          <CardHeader>
            <CardTitle>Set account time zone</CardTitle>
            <CardDescription>
              The detected device time zone is suggested, but you must confirm it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage ? (
              <div role="alert"><PageNotice variant="error" title="Time zone could not be saved" className="mb-6">
                {errorMessage}
              </PageNotice></div>
            ) : null}

            {form}
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="grid w-full gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(400px,0.85fr)]">
      <Card className="overflow-hidden">
        <CardContent className="flex h-full flex-col justify-between gap-6 p-4 md:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-floating">
                <ScrollText className="size-5" />
              </div>
              <div>
                <p className="text-base font-semibold tracking-tight text-foreground">
                  CashContour
                </p>
                <p className="text-sm text-muted-foreground">One-time setup</p>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                Set your financial calendar and start with a clean structure.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                Setup is intentionally short. Once it is complete, the app redirects you into the
                main workspace and keeps future entry simple.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
              <WalletCards className="size-5 text-muted-foreground" />
              <p className="mt-4 text-sm font-semibold text-foreground">Base currency</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Every transaction uses the same currency selected here.
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
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
            Choose the base currency, confirm the account time zone, and decide whether to create
            default categories.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <div role="alert"><PageNotice variant="error" title="Setup could not be completed" className="mb-6">
              {errorMessage}
            </PageNotice></div>
          ) : null}

          {form}
        </CardContent>
      </Card>
    </section>
  );
}

