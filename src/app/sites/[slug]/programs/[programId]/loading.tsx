export default function ProgramDetailLoading() {
  return (
    <div className="min-h-screen">
      {/* Hero Section Skeleton */}
      <section className="relative py-12 md:py-16 bg-muted/60">
        <div className="mx-auto w-full max-w-4xl px-4 md:px-8 space-y-6">
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-muted animate-pulse" />
            <div className="h-9 w-64 rounded bg-muted animate-pulse" />
          </div>
          <div className="space-y-2 max-w-2xl">
            <div className="h-4 w-full rounded bg-muted animate-pulse" />
            <div className="h-4 w-4/5 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="h-4 w-36 rounded bg-muted animate-pulse" />
            <div className="h-4 w-28 rounded bg-muted animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </section>

      {/* Registration Flow Skeleton */}
      <section className="mx-auto w-full max-w-4xl px-4 py-12 md:px-8">
        <div className="rounded-xl border bg-card p-6 md:p-8 space-y-6">
          <div className="h-6 w-48 rounded bg-muted animate-pulse" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
                <div className="h-5 w-5 rounded bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                </div>
                <div className="h-4 w-16 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
          <div className="h-11 w-full rounded-md bg-muted animate-pulse" />
        </div>
      </section>
    </div>
  );
}
