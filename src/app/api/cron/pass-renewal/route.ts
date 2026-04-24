import { NextRequest, NextResponse } from "next/server";
import { processAthletePassRenewals, expireAthletePasses } from "@/lib/services/pass-renewal";
import { logger } from "@/lib/logger";
import { verifyCronSecret } from "@/lib/cron-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Pass Renewal Cron
 *
 * Daily maintenance for pass lifecycle:
 * 1. Renew athlete passes that have expired with autoRenew enabled
 * 2. Expire athlete passes past their end date where autoRenew is disabled
 *
 * Schedule: Daily at 6:00 AM UTC ("0 6 * * *")
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

    const [renewals, expired] = await Promise.all([
      processAthletePassRenewals(),
      expireAthletePasses(),
    ]);

    const summary = {
      passRenewals: renewals.length,
      expiredPasses: expired.expiredCount,
    };

    logger.info("Pass renewal cron completed", summary);
    return NextResponse.json({ success: true, summary, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error("Pass renewal cron failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process pass renewals",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
