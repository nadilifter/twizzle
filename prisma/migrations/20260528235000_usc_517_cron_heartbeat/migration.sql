-- USC-517: cron_heartbeat table — forensic record of cron-run timing.
-- Each cron upserts lastSuccessAt at the end of a successful run so we can
-- answer "when did <cron> last succeed?" without depending on Sentry.
-- Active alerting on missed runs is handled by Sentry cron monitoring.

CREATE TABLE "CronHeartbeat" (
    "cronName" TEXT NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronHeartbeat_pkey" PRIMARY KEY ("cronName")
);

-- Seed one row per known cron. lastSuccessAt is left NULL so the first real
-- successful run sets a true timestamp; any pre-deploy queries against this
-- table can distinguish "never seen" from "ran at <time>".
INSERT INTO "CronHeartbeat" ("cronName", "lastSuccessAt", "updatedAt") VALUES
    ('expire-reservations',       NULL, NOW()),
    ('process-notifications',     NULL, NOW()),
    ('accounting-sync',           NULL, NOW()),
    ('subscription-billing',      NULL, NOW()),
    ('subscription-dunning',      NULL, NOW()),
    ('recurring-billing',         NULL, NOW()),
    ('holiday-announcements',     NULL, NOW()),
    ('sms-campaigns',             NULL, NOW()),
    ('holiday-reminders',         NULL, NOW()),
    ('seasons',                   NULL, NOW()),
    ('membership-renewal',        NULL, NOW()),
    ('pass-renewal',              NULL, NOW()),
    ('cleanup',                   NULL, NOW()),
    ('payment-method-check',      NULL, NOW()),
    ('registration-transitions',  NULL, NOW()),
    ('waitlist-payment-check',    NULL, NOW());
