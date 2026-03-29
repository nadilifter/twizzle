import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server";
import {
  processAllOrganizations,
  cleanupOldDeduplicationRecords,
} from "@/lib/notification-scheduler";
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronSecret(authHeader: string | null): boolean {
  if (!CRON_SECRET || !authHeader) return false
  const expected = `Bearer ${CRON_SECRET}`
  if (authHeader.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
}

export async function GET(request: NextRequest) {
  try {
    if (!CRON_SECRET) {
      logger.error("CRON_SECRET is not configured");
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    if (!verifyCronSecret(request.headers.get("authorization"))) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check for dry-run mode (for testing)
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") === "true";
    const cleanup = searchParams.get("cleanup") === "true";

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: "Dry run mode - no notifications sent",
        timestamp: new Date().toISOString(),
      });
    }

    // Process all organizations' notification rules
    const result = await processAllOrganizations();

    // Cleanup old deduplication records once per day (on the first run after midnight UTC)
    // Also runs when explicitly requested via ?cleanup=true
    const currentHour = new Date().getUTCHours();
    const currentMinute = new Date().getUTCMinutes();
    const isFirstRunOfDay = currentHour === 0 && currentMinute < 5;
    let cleanedUp = 0;
    if (cleanup || isFirstRunOfDay) {
      cleanedUp = await cleanupOldDeduplicationRecords();
    }

    return NextResponse.json({
      success: result.success,
      summary: {
        organizationsProcessed: result.organizationsProcessed,
        rulesEvaluated: result.rulesEvaluated,
        notificationsSent: result.notificationsSent,
        notificationsSkipped: result.notificationsSkipped,
        notificationsFailed: result.notificationsFailed,
        durationMs: result.durationMs,
        cleanedUpRecords: cleanedUp,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in process-notifications cron", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process notifications",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility (some orchestrators prefer POST)
export async function POST(request: NextRequest) {
  return GET(request);
}
