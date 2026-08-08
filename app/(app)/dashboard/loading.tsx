import { PageHeader } from "@/components/app-shell/page-header";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <PageHeader
        title="Dashboard"
        description="Loading completed balance history and monthly cash flow."
      />

      <div className="grid items-start gap-4 md:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-4" aria-label="Loading Total Balance">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-col gap-3 border-b border-border/70 pb-4">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-5 p-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-32" />
              </div>
              <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
                <div className="flex flex-col gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-12 w-56" />
                  <Skeleton className="h-16 w-full" />
                </div>
                <Skeleton className="h-[300px] w-full" />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="flex min-w-0 flex-col gap-4" aria-label="Loading Monthly Snapshot">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[300px] w-full rounded-2xl" />
        </section>
      </div>

      <section className="flex flex-col gap-4" aria-label="Loading Planning and Forecast">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 min-[1280px]:grid-cols-2">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
        <Card aria-label="Loading needs attention">
          <CardHeader className="border-b border-border/70 pb-4">
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="grid gap-4 p-3 md:grid-cols-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3" aria-label="Loading dashboard activity">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </section>
    </div>
  );
}
