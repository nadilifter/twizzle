import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  transitionExpiredTrials,
  generateDueInvoices,
  processInvoicePayment,
} from "@/lib/subscription-billing";
import { db } from "@/lib/db";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Subscription Billing Cron
 *
 * Generates invoices for all active paid subscriptions and processes payments.
 *
 * Schedule: Daily at 9am UTC ("0 9 * * *")
 *
 * Trigger methods:
 * - Local: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/subscription-billing
 * - Vercel: Configured in vercel.json
 * - AWS: EventBridge scheduled rule
 */

const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronSecret(authHeader: string | null): boolean {
  if (!CRON_SECRET || !authHeader) return false;
  const expected = `Bearer ${CRON_SECRET}`;
  if (authHeader.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  try {
    if (!CRON_SECRET) {
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
        message: "Dry run mode - no invoices generated or payments processed",
        timestamp: new Date().toISOString(),
      });
    }

    const trialResult = await transitionExpiredTrials();
    const invoiceResult = await generateDueInvoices();

    const pendingInvoices = await db.subscriptionInvoice.findMany({
      where: { status: "PENDING" },
      select: { id: true },
    });

    let paid = 0;
    let failed = 0;
    const paymentErrors: string[] = [];

    for (const invoice of pendingInvoices) {
      try {
        const success = await processInvoicePayment(invoice.id);
        if (success) {
          paid++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        paymentErrors.push(
          `Invoice ${invoice.id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    const allErrors = [...trialResult.errors, ...invoiceResult.errors, ...paymentErrors];

    const totalPaymentsAttempted = paid + failed;
    const errorRate = totalPaymentsAttempted > 0 ? failed / totalPaymentsAttempted : 0;
    const errorRatePct = Math.round(errorRate * 100);

    const summary = {
      trialsTransitioned: trialResult.transitioned,
      invoicesGenerated: invoiceResult.generated,
      invoicesSkipped: invoiceResult.skipped,
      paymentsPaid: paid,
      paymentsFailed: failed,
      errorRatePct,
    };

    // Always log a daily summary to Sentry so we have a record of every run.
    Sentry.captureMessage("Subscription billing cron completed", {
      level: allErrors.length > 0 ? "warning" : "info",
      extra: {
        summary,
        errors: allErrors,
        timestamp: new Date().toISOString(),
      },
    });

    // If payment failures exceed 0% of invoices attempted, fire a critical alert. To start, will just always fire if any fail
    if (totalPaymentsAttempted > 0 && errorRate > 0) {
      Sentry.captureMessage(
        `CRITICAL: Subscription billing failure rate is ${errorRatePct}% — immediate action required`,
        {
          level: "fatal",
          extra: {
            summary,
            errors: allErrors,
            message:
              "At least 1 of the subscription payments failed this billing run. " +
              "Check Adyen, payment methods, and invoice logs immediately.",
            timestamp: new Date().toISOString(),
          },
        }
      );
    }

    return NextResponse.json({
      success: true,
      summary,
      errors: allErrors.length > 0 ? allErrors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in subscription-billing cron:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process subscription billing",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
