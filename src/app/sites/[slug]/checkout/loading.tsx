export default function CheckoutLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 md:px-8 py-12">
      {/* Step indicator skeleton */}
      <div className="flex items-center justify-center gap-2 mb-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            <div className="hidden sm:block h-3 w-16 rounded bg-muted animate-pulse" />
            {i < 3 && <div className="h-px w-8 bg-muted animate-pulse" />}
          </div>
        ))}
      </div>

      {/* Cart summary skeleton */}
      <div className="rounded-xl border bg-card p-6 md:p-8 space-y-6 mb-8">
        <div className="h-6 w-32 rounded bg-muted animate-pulse" />
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
              <div className="space-y-2">
                <div className="h-4 w-48 rounded bg-muted animate-pulse" />
                <div className="h-3 w-32 rounded bg-muted animate-pulse" />
              </div>
              <div className="h-5 w-16 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
        <div className="flex justify-between pt-4 border-t">
          <div className="h-5 w-20 rounded bg-muted animate-pulse" />
          <div className="h-5 w-24 rounded bg-muted animate-pulse" />
        </div>
      </div>

      {/* Form skeleton */}
      <div className="rounded-xl border bg-card p-6 md:p-8 space-y-6">
        <div className="h-6 w-44 rounded bg-muted animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
            </div>
          ))}
        </div>
        <div className="h-11 w-full rounded-md bg-muted animate-pulse" />
      </div>
    </div>
  );
}
