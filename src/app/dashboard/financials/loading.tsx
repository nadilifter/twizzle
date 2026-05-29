import { Skeleton } from "@/components/ui/skeleton";

export default function FinancialsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
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
              <Skeleton className="col-span-2 h-5 w-16 rounded-full" />
              <Skeleton className="col-span-3 h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
