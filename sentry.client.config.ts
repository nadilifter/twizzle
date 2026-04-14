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

  tracesSampleRate: environment === "production" ? 0.1 : 1.0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [Sentry.replayIntegration()],

  environment,
});
