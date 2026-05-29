import { Skeleton } from "@/components/ui/skeleton";

export default function AthletesLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
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
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-4 px-4 py-3">
              <div className="col-span-3 flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
              <Skeleton className="col-span-2 h-4" />
              <Skeleton className="col-span-2 h-4" />
              <Skeleton className="col-span-2 h-5 w-16 rounded-full" />
              <Skeleton className="col-span-3 h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
