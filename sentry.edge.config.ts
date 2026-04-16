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
});
