import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite" aria-label="Loading Dashboard">
      <div className="grid items-start gap-4 md:grid-cols-2">
        {["Total Balance", "Monthly Snapshot"].map((title) => (
          <Card key={title} aria-label={`Loading ${title}`}>
            <CardHeader className="items-start gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-9 w-44 max-w-full" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4">
              <Skeleton className="h-14 w-40" />
              <Skeleton className="h-12 w-64 max-w-full" />
              <Skeleton className="h-52 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card aria-label="Loading Monthly Spendings">
        <CardHeader className="items-start gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-9 w-44 max-w-full" />
        </CardHeader>
        <CardContent className="pt-4">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>

      <Card aria-label="Loading Planning and Forecast">
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="grid gap-4 pt-4">
          <div className="grid gap-4 min-[1280px]:grid-cols-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-32 w-full rounded-xl" />
        </CardContent>
      </Card>

      <Card aria-label="Loading Transactions and Plans">
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="grid gap-4 pt-4 min-[1280px]:grid-cols-3">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl min-[1280px]:col-span-2" />
        </CardContent>
      </Card>
    </div>
  );
}
