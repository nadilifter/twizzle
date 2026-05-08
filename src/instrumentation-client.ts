import * as Sentry from "@sentry/nextjs";

// NEXT_PUBLIC_APP_ENVIRONMENT is baked into the bundle at build time, so it
// won't reflect the actual runtime environment when a staging image is promoted
// to production. Detect from hostname at runtime instead, using the build-time
// var only as a fallback (e.g. local dev where there's no real hostname).
function detectEnvironment(): string {
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") return "local";
    if (hostname.endsWith("uplifter.app")) return "production";
    if (hostname.endsWith("upliftergymnastics.com")) return "staging";
    if (hostname.endsWith("upliftergymnastics-dev.com")) return "development";
  }
  return process.env.NEXT_PUBLIC_APP_ENVIRONMENT || process.env.NODE_ENV || "unknown";
}

const environment = detectEnvironment();

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: environment === "production" ? 0.1 : 0.25,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  environment,
  release: process.env.NEXT_PUBLIC_APP_VERSION,

  // Lazy-load the Replay integration (~50 KB gzipped) only after the first
  // exception fires, so it stays out of the first-paint client bundle.
  async beforeSend(event) {
    if (event.exception) {
      const replay = await Sentry.lazyLoadIntegration("replayIntegration");
      Sentry.addIntegration(replay());

      // Normalize UUIDs and numeric IDs in error messages before fingerprinting.
      // Without this, "User <uuid-A> not found" and "User <uuid-B> not found" each
      // become a separate Sentry issue. With it, both collapse into one.
      const message = event.exception.values?.[0]?.value;
      if (message) {
        const sanitized = message
          .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
          .replace(/\b\d+\b/g, "<id>");
        if (sanitized !== message) {
          event.fingerprint = [event.exception.values![0].type ?? "Error", sanitized];
        }
      }
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
