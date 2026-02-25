import Link from "next/link";

interface SiteUnavailablePageProps {
  organizationName: string;
}

export function SiteUnavailablePage({ organizationName }: SiteUnavailablePageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="mx-auto max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Site Unavailable
          </h1>
          <p className="text-muted-foreground">
            The site for <strong>{organizationName}</strong> is currently
            unavailable. If you believe this is an error, please contact the
            organization directly.
          </p>
        </div>
        <div>
          <Link
            href="https://www.uplifterinc.com"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Go to Uplifter
          </Link>
        </div>
      </div>
    </div>
  );
}
