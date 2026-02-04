import { NextRequest, NextResponse } from "next/server";
import {
  processAllOrganizations,
  cleanupOldDeduplicationRecords,
} from "@/lib/notification-scheduler";

/**
 * Notification Scheduler Cron Endpoint
 * 
 * This endpoint is called by a cron job (Vercel Cron, AWS EventBridge, etc.)
 * to process all scheduled notifications.
 * 
 * Schedule: Every 5 minutes
 * 
 * Environment-specific trigger methods:
 * - Local: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/process-notifications
 * - Vercel: Configured in vercel.json
 * - AWS: EventBridge scheduled rule or Lambda
 * - Kubernetes: CronJob resource
 */

// Simple secret verification for cron jobs
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional but recommended)
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
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

    // Optionally cleanup old deduplication records (can be run daily)
    let cleanedUp = 0;
    if (cleanup) {
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
  } catch (error: any) {
    console.error("Error in process-notifications cron:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process notifications",
        message: error.message,
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
