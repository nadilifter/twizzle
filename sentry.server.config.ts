import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // APP_ENVIRONMENT is injected at runtime by K8s (development | staging | production).
  // NODE_ENV is always "production" in Docker so we can't use it to distinguish envs.
  tracesSampleRate: process.env.APP_ENVIRONMENT === "production" ? 0.1 : 1.0,

  environment: process.env.APP_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,

  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],

  // Normalize UUIDs and numeric IDs in error messages before fingerprinting.
  // Without this, "User <uuid-A> not found" and "User <uuid-B> not found" each
  // become a separate Sentry issue. With it, both collapse into one.
  beforeSend(event) {
    const message = event.exception?.values?.[0]?.value;
    if (message) {
      const sanitized = message
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
        .replace(/\b\d+\b/g, "<id>");
      if (sanitized !== message) {
        event.fingerprint = [event.exception!.values![0].type ?? "Error", sanitized];
      }
    }
    return event;
  },
});
