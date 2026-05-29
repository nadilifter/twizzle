import { Skeleton } from "@/components/ui/skeleton";

export default function SuperadminLoading() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5">
            <Skeleton className="mb-2 h-4 w-32" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
