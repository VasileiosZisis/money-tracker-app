import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function SectionHeadingSkeleton() {
  return (
    <Skeleton className="h-10 w-64 max-w-full" />
  );
}

function SharedPeriodControlSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Skeleton
        className={wide ? "h-10 min-w-64 flex-1 sm:max-w-md" : "h-10 w-52"}
      />
      <Skeleton className="h-10 w-20" />
    </div>
  );
}

export default function InsightsLoading() {
  return (
    <div
      className="flex flex-col gap-5"
      aria-busy="true"
      aria-live="polite"
    >
      <section className="flex flex-col gap-4" aria-label="Loading monthly result">
        <SectionHeadingSkeleton />
        <SharedPeriodControlSkeleton />
        <Card>
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

      <section
        className="flex flex-col gap-4"
        aria-label="Loading spending composition"
      >
        <SectionHeadingSkeleton />
        <Card>
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

      <section className="flex flex-col gap-4" aria-label="Loading consistency">
        <SectionHeadingSkeleton />
        <Card>
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
        aria-label="Loading unusual months"
      >
        <SectionHeadingSkeleton />
        <Card>
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
        aria-label="Loading category spending trends"
      >
        <SectionHeadingSkeleton />
        <SharedPeriodControlSkeleton wide />
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="pt-4">
            <Skeleton className="h-[320px] w-full" />
          </CardContent>
        </Card>
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </section>

      <section
        className="flex flex-col gap-4"
        aria-label="Loading drivers of change"
      >
        <SectionHeadingSkeleton />
        <Card>
          <CardHeader className="gap-3 lg:flex-row lg:items-end">
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
        aria-label="Loading year-over-year patterns"
      >
        <SectionHeadingSkeleton />
        <Card>
          <CardHeader className="items-end">
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
    </div>
  );
}
