import { Skeleton } from "@/components/ui/skeleton";

export default function ActionItemsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3">
            <Skeleton className="h-5 w-5 rounded-md shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
