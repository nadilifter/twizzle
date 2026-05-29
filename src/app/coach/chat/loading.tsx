import { Skeleton } from "@/components/ui/skeleton";

export default function CoachChatLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border bg-card">
      {/* Sidebar */}
      <div className="w-72 border-r flex flex-col gap-3 p-3">
        <Skeleton className="h-9 w-full rounded-md" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg p-2">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col p-4 gap-3">
        <div className="border-b pb-3">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex-1 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`flex gap-3 ${i % 2 === 1 ? "justify-end" : ""}`}>
              {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
              <Skeleton className={`h-12 rounded-xl ${i % 2 === 1 ? "w-48" : "w-64"}`} />
            </div>
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    </div>
  );
}
