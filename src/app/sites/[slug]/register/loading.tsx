export default function RegisterLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-12">
      <div className="mx-auto h-8 w-48 rounded bg-muted animate-pulse mb-8" />
      <div className="mx-auto h-5 w-80 rounded bg-muted animate-pulse mb-12" />

      {/* Filter bar skeleton */}
      <div className="flex flex-wrap gap-3 mb-8">
        <div className="h-9 w-32 rounded-md bg-muted animate-pulse" />
        <div className="h-9 w-28 rounded-md bg-muted animate-pulse" />
        <div className="h-9 w-36 rounded-md bg-muted animate-pulse" />
      </div>

      {/* Program cards skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
            <div className="h-5 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-muted animate-pulse" />
              <div className="h-3 w-5/6 rounded bg-muted animate-pulse" />
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
              <div className="h-6 w-20 rounded-full bg-muted animate-pulse" />
            </div>
            <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
