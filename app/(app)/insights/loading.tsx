import { WorkspaceCardGroup } from "@/components/app-shell/workspace-card-group";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function SectionHeadingSkeleton() {
  return (
    <Skeleton className="h-5 w-52 max-w-full" />
  );
}

function PeriodControlSkeleton() {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Skeleton className="h-10 w-52 max-w-full" />
      <Skeleton className="h-10 w-20" />
    </div>
  );
}

export default function InsightsLoading() {
  return (
    <div
      className="flex flex-col gap-7"
      aria-busy="true"
      aria-live="polite"
    >
      <WorkspaceCardGroup id="loading-insights-cash-flow-group" title="Cash flow">
        <section className="flex flex-col gap-4" aria-label="Loading monthly result">
          <Card>
            <CardHeader className="items-start gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
              <SectionHeadingSkeleton />
              <PeriodControlSkeleton />
            </CardHeader>
            <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton className="h-5 w-72 max-w-full" />
              <Skeleton className="h-5 w-52" />
            </CardHeader>
            <CardContent className="pt-2">
              <Skeleton className="h-[200px] w-full" />
            </CardContent>
            <CardFooter className="grid gap-3 border-t border-border/70 py-3 sm:grid-cols-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </CardFooter>
          </Card>
        </section>
      </WorkspaceCardGroup>

      <WorkspaceCardGroup id="loading-insights-spending-habits-group" title="Spending habits">
        <section className="flex flex-col gap-4" aria-label="Loading consistency">
          <Card>
            <CardHeader><SectionHeadingSkeleton /></CardHeader>
            <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton className="h-5 w-72 max-w-full" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="grid gap-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-44 w-full" />
                <Skeleton className="h-44 w-full" />
              </div>
              <Skeleton className="h-28 w-full" />
            </CardContent>
          </Card>
        </section>

        <section
          className="flex flex-col gap-4"
          aria-label="Loading spending composition"
        >
          <Card>
            <CardHeader><SectionHeadingSkeleton /></CardHeader>
            <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton className="h-5 w-72 max-w-full" />
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent className="grid gap-4 pt-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </section>

        <section
          className="flex flex-col gap-4"
          aria-label="Loading category spending trends"
        >
          <Card>
            <CardHeader className="items-start gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
              <SectionHeadingSkeleton />
              <PeriodControlSkeleton />
            </CardHeader>
            <CardContent className="grid gap-4 pt-4">
              <Card inset>
                <CardHeader>
                  <Skeleton className="h-5 w-72 max-w-full" />
                </CardHeader>
                <CardContent className="pt-4">
                  <Skeleton className="h-[320px] w-full" />
                </CardContent>
              </Card>
              <div className="grid gap-3 md:grid-cols-3">
                <Skeleton className="h-36 w-full rounded-xl" />
                <Skeleton className="h-36 w-full rounded-xl" />
                <Skeleton className="h-36 w-full rounded-xl" />
              </div>
              <Skeleton className="h-72 w-full rounded-xl" />
            </CardContent>
          </Card>
        </section>
      </WorkspaceCardGroup>

      <WorkspaceCardGroup id="loading-insights-changes-over-time-group" title="Changes over time">
        <section
          className="flex flex-col gap-4"
          aria-label="Loading drivers of change"
        >
          <Card>
            <CardHeader className="items-start gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
              <SectionHeadingSkeleton />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-10 w-44" />
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-20" />
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 pt-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </CardContent>
          </Card>
        </section>

        <section
          className="flex flex-col gap-4"
          aria-label="Loading unusual months"
        >
          <Card>
            <CardHeader><SectionHeadingSkeleton /></CardHeader>
            <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton className="h-5 w-72 max-w-full" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="grid gap-3 pt-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </section>

        <section
          className="flex flex-col gap-4"
          aria-label="Loading year-over-year patterns"
        >
          <Card>
            <CardHeader><SectionHeadingSkeleton /></CardHeader>
            <CardHeader>
              <Skeleton className="h-4 w-80 max-w-full" />
            </CardHeader>
            <CardContent className="grid gap-5 pt-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <Skeleton className="h-36 w-full" />
                <Skeleton className="h-36 w-full" />
                <Skeleton className="h-36 w-full" />
              </div>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </CardContent>
          </Card>
        </section>
      </WorkspaceCardGroup>
    </div>
  );
}
