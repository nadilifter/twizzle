import { Skeleton } from "@/components/ui/skeleton";

export default function BulkUploadLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="h-32 rounded-xl border-2 border-dashed flex items-center justify-center">
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  );
}
