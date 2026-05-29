import { Skeleton } from "@/components/ui/skeleton";

export default function CompetitionsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-40" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <div className="mt-auto flex items-center justify-between border-t pt-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
