import { PageHeader } from "@/components/app-shell/page-header";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <PageHeader
        title="Dashboard"
        description="Loading completed balance history and monthly cash flow."
      />

      <section className="flex flex-col gap-4" aria-label="Loading Total Balance">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 border-b border-border/70 pb-5">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="flex flex-col gap-7 p-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-32" />
            </div>
            <div className="grid gap-7 xl:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
              <div className="flex flex-col gap-5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-12 w-56" />
                <Skeleton className="h-16 w-full" />
              </div>
              <Skeleton className="h-[300px] w-full" />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4" aria-label="Loading Monthly Snapshot">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Skeleton className="h-36 w-full rounded-3xl" />
          <Skeleton className="h-36 w-full rounded-3xl" />
        </div>
      </section>
    </div>
  );
}
