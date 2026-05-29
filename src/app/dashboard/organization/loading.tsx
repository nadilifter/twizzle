import { Skeleton } from "@/components/ui/skeleton";

export default function OrganizationLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              ))}
            </div>
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
