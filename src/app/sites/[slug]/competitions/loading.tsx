export default function CompetitionsLoading() {
  return (
    <div className="min-h-screen">
      {/* Header Section Skeleton */}
      <section className="relative py-16 bg-muted/60">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded bg-muted animate-pulse" />
            <div className="h-9 w-56 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-5 w-96 max-w-full rounded bg-muted animate-pulse" />
        </div>
      </section>

      {/* Competition Cards Skeleton */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
              <div className="h-5 w-3/4 rounded bg-muted animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                <div className="h-4 w-36 rounded bg-muted animate-pulse" />
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-20 rounded-full bg-muted animate-pulse" />
                <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
              </div>
              <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
