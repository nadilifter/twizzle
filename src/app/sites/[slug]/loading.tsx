export default function SiteHomeLoading() {
  return (
    <div className="min-h-screen">
      {/* Hero Section Skeleton */}
      <section className="relative py-20 bg-muted/60">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <div className="mx-auto h-6 w-40 rounded-full bg-muted animate-pulse" />
            <div className="space-y-3">
              <div className="mx-auto h-12 w-3/4 rounded-lg bg-muted animate-pulse" />
              <div className="mx-auto h-12 w-1/2 rounded-lg bg-muted animate-pulse" />
            </div>
            <div className="mx-auto h-5 w-2/3 rounded bg-muted animate-pulse" />
            <div className="flex justify-center gap-4">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-4 w-28 rounded bg-muted animate-pulse" />
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            </div>
            <div className="mx-auto h-11 w-36 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
      </section>

      {/* Programs Section Skeleton */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8">
        <div className="mb-12 text-center space-y-4">
          <div className="mx-auto h-8 w-64 rounded bg-muted animate-pulse" />
          <div className="mx-auto h-5 w-96 rounded bg-muted animate-pulse" />
        </div>
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
      </section>
    </div>
  );
}
