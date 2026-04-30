// POST /api/user/waitlist-pending-charge/retry — called after the athlete adds a new payment
// method via the in-app banner. Charges the most recently added card and, on success, finalizes
// the enrollment. Does not increment waitlistChargeAttempts since this is user-initiated.

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { checkApiRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import * as Sentry from "@sentry/nextjs";
import { chargeSubscription } from "@/lib/adyen";
import { calculateChargeAmounts } from "@/lib/recurring-billing-service";
import { finalizeWaitlistEnrollment } from "@/lib/waitlist-promotion";
import { executeNotificationByTrigger } from "@/lib/notification-service";
import { getTodayNoonUTC } from "@/lib/date-utils";
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await checkApiRateLimit(
      request,
      "waitlist-retry",
      RATE_LIMITS.sensitive
    );
    if (rateLimitResponse) return rateLimitResponse;

    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json().catch(() => ({}));
    const enrollmentId = typeof body?.enrollmentId === "string" ? body.enrollmentId : undefined;

    const enrollment = await db.enrollment.findFirst({
      where: {
        userId,
        status: "WAITLIST_PAYMENT_PENDING",
        waitlistPaymentDeadline: { not: null, gt: new Date() },
        ...(enrollmentId ? { id: enrollmentId } : {}),
      },
      orderBy: { waitlistPaymentDeadline: "asc" },
      select: {
        id: true,
        programId: true,
        athleteId: true,
        waitlistChargeAttempts: true,
        program: {
          select: {
            name: true,
            basePrice: true,
            perSessionPrice: true,
            pricingModel: true,
            organizationId: true,
          },
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: "No pending waitlist charge found" }, { status: 404 });
    }

    const { program } = enrollment;
    const organizationId = program.organizationId;
    const programName = program.name;
    const amount =
      program.pricingModel === "PER_SESSION"
        ? Number(program.perSessionPrice ?? 0)
        : Number(program.basePrice ?? 0);

    // Idempotency: if a PAID invoice already exists, just finalize and return success
    const existingPaidInvoice = await db.invoice.findFirst({
      where: {
        notes: { contains: `"waitlistEnrollmentId":"${enrollment.id}"` },
        status: "PAID",
      },
      select: { id: true },
    });
    if (existingPaidInvoice) {
      const txRecord = await db.transaction.findFirst({
        where: { payment: { invoiceId: existingPaidInvoice.id } },
        select: { pspReference: true },
      });
      if (!txRecord?.pspReference) {
        Sentry.captureMessage("PAID invoice has no transaction record — manual recovery required", {
          level: "fatal",
          extra: { invoiceId: existingPaidInvoice.id, enrollmentId: enrollment.id },
        });
        return NextResponse.json(
          { error: "Payment record inconsistency — please contact support" },
          { status: 500 }
        );
      }
      await finalizeWaitlistEnrollment({
        invoiceId: existingPaidInvoice.id,
        enrollmentId: enrollment.id,
        pspReference: txRecord.pspReference,
        programName,
      });
      return NextResponse.json({ success: true });
    }

    // Charge the most recently added card — user just added it specifically to resolve failure
    const [recentPm, orgPlatform, amounts] = await Promise.all([
      db.paymentMethod.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { adyenTokenId: true, shopperReference: true },
      }),
      db.organization.findUnique({
        where: { id: organizationId },
        select: { adyenPlatformAccount: { select: { storeReference: true } } },
      }),
      calculateChargeAmounts(amount, organizationId),
    ]);

    const storeReference = orgPlatform?.adyenPlatformAccount?.storeReference;
    if (!storeReference) {
      return NextResponse.json(
        { error: "Organization has no Adyen platform account configured" },
        { status: 500 }
      );
    }
    if (!recentPm?.adyenTokenId || !recentPm.shopperReference) {
      return NextResponse.json({ error: "No payment method found" }, { status: 400 });
    }

    const { chargeTotal, tax, processingFee } = amounts;

    // Lock the enrollment row to prevent concurrent charges from concurrent retry requests.
    // Hold the lock through the Adyen call so a second request waits and then sees ACTIVE.
    let chargeSucceeded = false;
    let pspReference: string | null = null;
    let chargeError = "Charge failed";
    let alreadyActive = false;
    let draftInvoiceId: string | null = null;

    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "Enrollment" WHERE id = ${enrollment.id} FOR UPDATE`
        );
        const fresh = await tx.enrollment.findUnique({
          where: { id: enrollment.id },
          select: { status: true },
        });
        if (fresh?.status === "ACTIVE") {
          alreadyActive = true;
          return;
        }

        // Reuse existing DRAFT invoice if present
        const existingDraft = await tx.invoice.findFirst({
          where: {
            notes: { contains: `"waitlistEnrollmentId":"${enrollment.id}"` },
            status: "DRAFT",
          },
          select: { id: true, reference: true },
        });

        const draftInvoice =
          existingDraft ??
          (await tx.invoice.create({
            data: {
              organizationId,
              userId,
              reference: `WL-${enrollment.id}-manual`,
              status: "DRAFT",
              dueDate: getTodayNoonUTC(),
              subtotal: amount,
              tax,
              processingFee,
              total: chargeTotal,
              notes: JSON.stringify({
                waitlistEnrollmentId: enrollment.id,
                programId: enrollment.programId,
                programName,
              }),
            },
          }));

        draftInvoiceId = draftInvoice.id;
        const reference = draftInvoice.id;

        try {
          const response = await chargeSubscription(
            recentPm.shopperReference!,
            recentPm.adyenTokenId!,
            chargeTotal,
            reference,
            `Waitlist promotion — ${programName}`,
            storeReference
          );
          chargeSucceeded = response.resultCode === "Authorised";
          if (chargeSucceeded) {
            pspReference = response.pspReference ?? null;
            // Mark invoice as PAID inside the lock so webhook deduplicates correctly
            await tx.invoice.update({
              where: { id: draftInvoice.id },
              data: { status: "PAID" },
            });
          } else {
            chargeError = response.refusalReason ?? `Payment ${response.resultCode}`;
          }
        } catch (err) {
          chargeError = err instanceof Error ? err.message : "Charge failed";
        }
      },
      { timeout: 10000 }
    );

    if (alreadyActive) return NextResponse.json({ success: true });

    if (chargeSucceeded && pspReference && draftInvoiceId) {
      await finalizeWaitlistEnrollment({
        invoiceId: draftInvoiceId,
        enrollmentId: enrollment.id,
        pspReference,
        programName,
      });

      try {
        await executeNotificationByTrigger({
          organizationId,
          triggerType: "WAITLIST_OPENING",
          userId,
          athleteId: enrollment.athleteId,
          context: { programName },
        });
      } catch {
        // Non-fatal
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: chargeError }, { status: 402 });
  } catch (error) {
    console.error("Error retrying waitlist charge:", error);
    return NextResponse.json({ error: "Failed to process charge" }, { status: 500 });
  }
}
