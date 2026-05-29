import { Skeleton } from "@/components/ui/skeleton";

export default function CoachMediaLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border bg-card overflow-hidden">
            <Skeleton className="h-40 w-full rounded-none" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
