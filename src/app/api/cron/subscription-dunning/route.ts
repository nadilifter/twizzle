import { NextRequest, NextResponse } from "next/server";
import {
  processDunningEmails,
  deactivateExpiredOrgs,
  recoverAndRetryStaleInvoices,
} from "@/lib/subscription-billing";
import { verifyCronSecret, startCronMonitoring, endCronMonitoring } from "@/lib/cron-utils";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Subscription Dunning Cron
 *
 * Daily maintenance for subscription billing:
 * 1. Recover stuck invoices (PROCESSING > 1hr -> reset to PENDING, then retry)
 * 2. Retry any PENDING invoices left from a previous failed billing run
 * 3. Send warning emails to orgs approaching deactivation (30d, 7d, 1d)
 * 4. Deactivate orgs that have passed their grace period
 *
 * Schedule: Daily at 7pm UTC ("0 19 * * *")
 *
 * Trigger methods:
 * - Local: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/subscription-dunning
 * - Vercel: Configured in vercel.json
 * - AWS: EventBridge scheduled rule
 */

export async function GET(request: NextRequest) {
  let checkInId: string | undefined;
  try {
    if (!process.env.CRON_SECRET) {
      console.error("CRON_SECRET is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (!verifyCronSecret(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") === "true";

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: "Dry run mode - no emails sent or orgs deactivated",
        timestamp: new Date().toISOString(),
      });
    }

    checkInId = startCronMonitoring("subscription-dunning");

    const recoveryResult = await recoverAndRetryStaleInvoices();
    const dunningResult = await processDunningEmails();
    const deactivationResult = await deactivateExpiredOrgs();

    const allErrors = [
      ...recoveryResult.errors,
      ...dunningResult.errors,
      ...deactivationResult.errors,
    ];

    await endCronMonitoring("subscription-dunning", checkInId, "ok");

    return NextResponse.json({
      success: true,
      summary: {
        stuckInvoicesRecovered: recoveryResult.recovered,
        staleInvoicesRetried: recoveryResult.retried,
        staleInvoicesPaid: recoveryResult.retriedPaid,
        warningEmailsSent: dunningResult.sent,
        organizationsDeactivated: deactivationResult.deactivated,
      },
      errors: allErrors.length > 0 ? allErrors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await endCronMonitoring("subscription-dunning", checkInId, "error");
    logger.error("Subscription dunning cron failed", {
      err: error instanceof Error ? error.message : String(error),
    });
    Sentry.captureMessage(
      "Subscription dunning cron crashed — stale invoices not retried, orgs not deactivated",
      {
        level: "fatal",
        extra: { reason: error instanceof Error ? error.message : String(error) },
      }
    );
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process subscription dunning",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
