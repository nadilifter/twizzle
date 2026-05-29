import { Skeleton } from "@/components/ui/skeleton";

export default function EventsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <div className="grid grid-cols-12 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="col-span-2 h-4" />
            ))}
          </div>
        </div>
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-4 px-4 py-3">
              <Skeleton className="col-span-3 h-4" />
              <Skeleton className="col-span-2 h-4" />
              <Skeleton className="col-span-2 h-4" />
              <Skeleton className="col-span-2 h-4" />
              <Skeleton className="col-span-3 h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
