import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { verifyCronSecret } from "@/lib/cron-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Registration Transitions Cron
 *
 * Daily transitions for program registration status:
 * - SCHEDULED → OPEN  when registrationStartDate has passed
 * - OPEN → CLOSED     when registrationEndDate has passed
 *
 * DRAFT, CLOSED, and ARCHIVED programs are never touched by this job.
 *
 * Schedule: Daily at 8:00 AM UTC ("0 8 * * *")
 */
export async function GET(request: NextRequest) {
  try {
    if (!process.env.CRON_SECRET) {
      logger.error("CRON_SECRET is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (!verifyCronSecret(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    const [opened, regClosed, programCompleted] = await Promise.all([
      // SCHEDULED → OPEN: registration start date has passed (program stays ACTIVE)
      db.program.updateMany({
        where: {
          status: "ACTIVE",
          registrationStatus: "SCHEDULED",
          registrationStartDate: { lte: now },
        },
        data: { registrationStatus: "OPEN" },
      }),
      // OPEN → CLOSED: registration end date has passed (program stays ACTIVE)
      db.program.updateMany({
        where: {
          status: "ACTIVE",
          registrationStatus: "OPEN",
          registrationEndDate: { not: null, lte: now },
        },
        data: { registrationStatus: "CLOSED" },
      }),
      // ACTIVE → COMPLETE: program's own endDate has passed
      db.program.updateMany({
        where: {
          status: "ACTIVE",
          endDate: { not: null, lte: now },
        },
        data: { status: "COMPLETE", registrationStatus: "CLOSED" },
      }),
    ]);

    logger.info("registration-transitions cron complete", {
      opened: opened.count,
      regClosed: regClosed.count,
      programCompleted: programCompleted.count,
    });

    Sentry.captureMessage("Registration transitions cron completed", {
      level: "info",
      extra: {
        opened: opened.count,
        regClosed: regClosed.count,
        programCompleted: programCompleted.count,
        timestamp: now.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      opened: opened.count,
      regClosed: regClosed.count,
      programCompleted: programCompleted.count,
    });
  } catch (error) {
    logger.error("registration-transitions cron failed", { error: String(error) });
    Sentry.captureMessage(
      "CRITICAL: Registration transitions cron failed — programs may not have opened or closed correctly",
      {
        level: "fatal",
        extra: {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
          message:
            "SCHEDULED programs may not have transitioned to OPEN, and OPEN programs may not have closed. " +
            "Check the database and run the cron manually if needed.",
        },
      }
    );
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
