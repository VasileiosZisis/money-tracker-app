import { PageHeader } from "@/components/app-shell/page-header";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function InsightsLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <PageHeader
        title="Insights"
        description="Loading your historical spending comparisons."
      />

      <Card>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-[minmax(220px,1fr)_minmax(190px,auto)_auto]">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-24" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-36" />
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

      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-36" />
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
    </div>
  );
}
