import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const CRON_SECRET = process.env.CRON_SECRET;

export function verifyCronSecret(authHeader: string | null): boolean {
  if (!CRON_SECRET || !authHeader) return false;
  const expected = `Bearer ${CRON_SECRET}`;
  if (authHeader.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export function assertCronSecret(authHeader: string | null): string | null {
  if (!CRON_SECRET) return "Server misconfiguration";
  if (!verifyCronSecret(authHeader)) return "Unauthorized";
  return null;
}

// USC-517: source of truth for cron cadence. Mirrors vercel.json. The crontab
// string is sent to Sentry on the in_progress check-in so Sentry can
// auto-create the monitor and detect missed runs natively. A Vitest guards
// against drift between this map and vercel.json.
export const CRON_SCHEDULES: Record<string, string> = {
  "expire-reservations": "* * * * *",
  "process-notifications": "*/5 * * * *",
  "accounting-sync": "*/15 * * * *",
  "subscription-billing": "0 9 * * *",
  "subscription-dunning": "0 19 * * *",
  "recurring-billing": "0 8 * * *",
  "holiday-announcements": "0 8 * * *",
  "sms-campaigns": "* * * * *",
  "holiday-reminders": "0 12 * * *",
  seasons: "0 5 * * *",
  "membership-renewal": "0 6 * * *",
  "pass-renewal": "0 6 * * *",
  cleanup: "0 3 * * 0",
  "payment-method-check": "0 14 * * 1",
  "registration-transitions": "0 8 * * *",
  "waitlist-payment-check": "0 * * * *",
};

// Opens a Sentry cron check-in for this run. Call once after auth. The
// returned id is fed into endCronMonitoring on success or failure so Sentry
// can pair the in_progress with the terminal status. Errors are swallowed —
// monitoring must never break a cron itself.
export function startCronMonitoring(cronName: string): string | undefined {
  const crontab = CRON_SCHEDULES[cronName];
  if (!crontab) {
    logger.warn("startCronMonitoring called with unknown cron name", { cronName });
    return undefined;
  }
  try {
    return Sentry.captureCheckIn(
      { monitorSlug: cronName, status: "in_progress" },
      {
        schedule: { type: "crontab", value: crontab },
        // Vercel cron jitter can exceed a few minutes on low-frequency
        // schedules; 15 min absorbs that without false-alerting on daily/
        // weekly crons. Sub-minute crons surface lag through Sentry's run
        // history rather than this margin.
        checkinMargin: 15,
        // Routes cap at maxDuration=300s; 10 min covers that with headroom
        // while still flagging genuinely-hung runs.
        maxRuntime: 10,
        timezone: "UTC",
      }
    );
  } catch (err) {
    logger.error("Failed to start Sentry cron check-in", {
      cronName,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

// Closes the Sentry check-in and (on "ok") upserts the CronHeartbeat row so
// "when did <cron> last succeed?" is answerable from the DB without going
// through Sentry. Both writes are best-effort: a Sentry/DB outage cannot
// break the cron itself.
export async function endCronMonitoring(
  cronName: string,
  checkInId: string | undefined,
  status: "ok" | "error"
): Promise<void> {
  if (checkInId) {
    try {
      Sentry.captureCheckIn({ checkInId, monitorSlug: cronName, status });
    } catch (err) {
      logger.error("Failed to end Sentry cron check-in", {
        cronName,
        status,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (status !== "ok") return;
  if (!CRON_SCHEDULES[cronName]) return;

  try {
    const now = new Date();
    await db.cronHeartbeat.upsert({
      where: { cronName },
      create: { cronName, lastSuccessAt: now },
      update: { lastSuccessAt: now },
    });
  } catch (err) {
    logger.error("Failed to record cron heartbeat", {
      cronName,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
