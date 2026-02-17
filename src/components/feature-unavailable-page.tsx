import { FEATURE_LABELS, type FeatureKey } from "@/lib/feature-toggles"

/**
 * Server component that renders a full-page "Feature Unavailable" message.
 * Used in portal layouts (Events, POS) when the feature is disabled.
 */
export function FeatureUnavailablePage({ feature }: { feature: FeatureKey }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-8 text-center space-y-4">
        <div className="mx-auto rounded-full bg-muted p-6 w-fit">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            <path d="m14.5 9.5-5 5" />
            <path d="m9.5 9.5 5 5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">
          {FEATURE_LABELS[feature]} Not Available
        </h1>
        <p className="text-muted-foreground">
          This feature is not included in your organization&apos;s current plan.
          Please contact your administrator to upgrade.
        </p>
      </div>
    </div>
  )
}
