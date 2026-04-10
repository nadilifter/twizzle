/**
 * Dev-only: Trigger Trial Billing
 *
 * Replicates the core logic of /api/cron/subscription-billing scoped to a single org.
 * Used to test the free trial → billing flow locally without waiting for the monthly cron.
 *
 * Triggered automatically from the org signup review page (dev/local only) after org creation.
 * Returns 404 in staging and production.
 *
 * If the cron's orchestration logic changes, update this endpoint to match it.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentEnvironment } from "@/lib/env-domains";
import { generateMonthlyInvoices, processInvoicePayment } from "@/lib/subscription-billing";
import { db } from "@/lib/db"; // tenant-isolation-ok: dev-only endpoint (404 in production/staging), operates on a specific org by ID for local billing test automation

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const env = getCurrentEnvironment();
  if (env !== "local" && env !== "development") {
    return NextResponse.json(null, { status: 404 });
  }

  const body = await request.json();
  const { organizationId } = body;

  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  const subscription = await db.organizationSubscription.findFirst({
    where: { organizationId, status: "TRIALING" },
    include: { plan: true },
  });

  if (!subscription) {
    return NextResponse.json(
      { error: "No TRIALING subscription found for this organization" },
      { status: 404 }
    );
  }

  console.log("[dev/trigger-trial-billing] Starting billing test for org:", organizationId);

  const paymentMethods = await db.organizationPaymentMethod.findMany({
    where: { organizationId, isActive: true },
    select: {
      id: true,
      type: true,
      brand: true,
      lastFour: true,
      expiryMonth: true,
      expiryYear: true,
      isDefault: true,
      storedPaymentMethodId: true,
    },
  });
  if (paymentMethods.length === 0) {
    console.warn("[dev/trigger-trial-billing] No active payment methods on file for this org.");
  } else {
    console.log(`[dev/trigger-trial-billing] Payment methods on file (${paymentMethods.length}):`);
    paymentMethods.forEach((pm) => {
      console.log(
        `  - ${pm.brand ?? pm.type} **** ${pm.lastFour} exp ${pm.expiryMonth}/${pm.expiryYear} | default: ${pm.isDefault} | storedId: ${pm.storedPaymentMethodId}`
      );
    });
  }

  try {
    // Generate invoice scoped to this org only
    const invoiceResult = await generateMonthlyInvoices({ organizationId });
    console.log("[dev/trigger-trial-billing] Invoice generation result:", invoiceResult);

    // Find the pending invoice for this org
    const pendingInvoice = await db.subscriptionInvoice.findFirst({
      where: { organizationId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    if (!pendingInvoice) {
      console.warn(
        "[dev/trigger-trial-billing] No pending invoice found after generation. invoiceResult:",
        invoiceResult
      );
      return NextResponse.json(
        {
          success: false,
          invoiceResult,
          error:
            "No pending invoice found after generation — it may have been skipped (already exists for this period or trial has not ended yet)",
        },
        { status: 400 }
      );
    }

    console.log(
      "[dev/trigger-trial-billing] Processing payment for invoice:",
      pendingInvoice.id,
      "reference:",
      pendingInvoice.reference
    );
    await processInvoicePayment(pendingInvoice.id);

    // Fetch the final state of the invoice + all payment attempts
    const finalInvoice = await db.subscriptionInvoice.findUnique({
      where: { id: pendingInvoice.id },
      include: {
        paymentAttempts: {
          orderBy: { attemptNumber: "asc" },
          select: {
            attemptNumber: true,
            status: true,
            amount: true,
            currency: true,
            pspReference: true,
            failureReason: true,
            attemptedAt: true,
          },
        },
      },
    });

    const paid = finalInvoice?.status === "PAID";
    const attempts = finalInvoice?.paymentAttempts ?? [];

    console.log(
      "[dev/trigger-trial-billing] Final invoice status:",
      finalInvoice?.status,
      "| Payment attempts:",
      attempts.length
    );
    if (attempts.length > 0) {
      attempts.forEach((a) => {
        console.log(
          `  Attempt #${a.attemptNumber}: ${a.status}${a.failureReason ? ` — ${a.failureReason}` : ""}${a.pspReference ? ` (PSP: ${a.pspReference})` : ""}`
        );
      });
    }

    let diagnosis: string | undefined;
    if (!paid) {
      if (attempts.length === 0) {
        const orgPaymentMethods = await db.organizationPaymentMethod.findMany({
          where: { organizationId, isActive: true },
          select: { id: true },
        });
        if (orgPaymentMethods.length === 0) {
          diagnosis =
            "No active payment methods on file for this org. Add one via Adyen before testing.";
        } else {
          diagnosis =
            "Adyen is not configured in this environment — charges cannot be processed locally without valid Adyen credentials.";
        }
        console.warn("[dev/trigger-trial-billing] Payment not attempted.", diagnosis);
      } else {
        const lastAttempt = attempts[attempts.length - 1];
        diagnosis = `Payment attempted ${attempts.length} time(s). Last failure: ${lastAttempt.failureReason ?? "unknown reason"}`;
        console.warn("[dev/trigger-trial-billing]", diagnosis);
      }
    } else {
      console.log("[dev/trigger-trial-billing] Payment succeeded.");
    }

    return NextResponse.json({
      success: paid,
      invoice: {
        id: finalInvoice?.id,
        reference: finalInvoice?.reference,
        amount: finalInvoice?.amount,
        currency: finalInvoice?.currency,
        status: finalInvoice?.status,
        periodStart: finalInvoice?.periodStart,
        periodEnd: finalInvoice?.periodEnd,
        paidAt: finalInvoice?.paidAt,
        failedAt: finalInvoice?.failedAt,
      },
      paymentAttempts: attempts,
      ...(diagnosis ? { diagnosis } : {}),
    });
  } catch (err) {
    console.error("[dev/trigger-trial-billing] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
