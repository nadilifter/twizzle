// Hourly cron that drives the waitlist payment lifecycle. For each WAITLIST_PAYMENT_PENDING
// enrollment it handles three cases: expired deadline (cancel + promote next), no deadline
// (retry — enrollment was stuck before a deadline could be written), and active deadline with
// attempts remaining (retry). Sends notifications on expiry and successful promotion.

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { verifyCronSecret, startCronMonitoring, endCronMonitoring } from "@/lib/cron-utils";
import { logger } from "@/lib/logger";
import { executeNotificationByTrigger } from "@/lib/notification-service";
import {
  attemptWaitlistCharge,
  finalizeWaitlistEnrollment,
  promoteFromWaitlist,
} from "@/lib/waitlist-promotion";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  let checkInId: string | undefined;
  try {
    if (!process.env.CRON_SECRET) {
      logger.error("CRON_SECRET is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (!verifyCronSecret(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    checkInId = startCronMonitoring("waitlist-payment-check");

    const now = new Date();

    const enrollments = await db.enrollment.findMany({
      where: { status: "WAITLIST_PAYMENT_PENDING" },
      select: {
        id: true,
        userId: true,
        athleteId: true,
        programId: true,
        waitlistPaymentDeadline: true,
        waitlistChargeAttempts: true,
        createdAt: true,
        program: {
          select: {
            name: true,
            organizationId: true,
            basePrice: true,
            perSessionPrice: true,
            pricingModel: true,
          },
        },
      },
    });

    const summary = { processed: 0, cancelled: 0, retried: 0, skipped: 0, errors: 0 };

    for (const enrollment of enrollments) {
      try {
        const { program } = enrollment;
        const organizationId = program.organizationId;
        const programName = program.name;
        const deadline = enrollment.waitlistPaymentDeadline;

        // Case 1 — Expired: deadline passed → cancel and promote next
        if (deadline && deadline < now) {
          await db.$transaction(async (tx) => {
            await tx.enrollment.update({
              where: { id: enrollment.id },
              data: { status: "CANCELLED", waitlistPaymentDeadline: null },
            });
            await tx.instanceRegistration.updateMany({
              where: {
                athleteId: enrollment.athleteId,
                programInstance: { programId: enrollment.programId },
                status: { in: ["REGISTERED", "WAITLISTED"] },
              },
              data: { status: "CANCELLED" },
            });
          });

          if (enrollment.userId) {
            await executeNotificationByTrigger({
              organizationId,
              triggerType: "WAITLIST_PAYMENT_EXPIRED",
              userId: enrollment.userId,
              athleteId: enrollment.athleteId,
              context: { programName },
            }).catch((err) =>
              logger.error("Failed to send WAITLIST_PAYMENT_EXPIRED notification", { err })
            );
          }

          promoteFromWaitlist(enrollment.programId).catch((err) =>
            logger.error(
              "Waitlist promotion failed after expiry — slot may be stuck, manual re-trigger needed",
              {
                err: err instanceof Error ? err.message : String(err),
                programId: enrollment.programId,
                cancelledEnrollmentId: enrollment.id,
                athleteId: enrollment.athleteId,
              }
            )
          );

          summary.cancelled++;
          continue;
        }

        // Case 2 — Retry eligible: active deadline with attempts remaining, OR no deadline (stuck
        // due to a crash before the deadline could be written — always retry these)
        const hasActiveDeadline = deadline && deadline > now;
        const isStuck = !deadline;
        const attemptsRemaining = enrollment.waitlistChargeAttempts < 3;

        if ((hasActiveDeadline && attemptsRemaining) || isStuck) {
          const amount =
            program.pricingModel === "PER_SESSION"
              ? Number(program.perSessionPrice ?? 0)
              : Number(program.basePrice ?? 0);

          if (!enrollment.userId || amount === 0) {
            summary.skipped++;
            continue;
          }

          // Safety check: if a PAID invoice already exists, just finalize — don't charge again
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
              Sentry.captureMessage(
                "PAID invoice has no transaction record — manual recovery required",
                {
                  level: "fatal",
                  extra: { invoiceId: existingPaidInvoice.id, enrollmentId: enrollment.id },
                }
              );
              summary.errors++;
              continue;
            }
            await finalizeWaitlistEnrollment({
              invoiceId: existingPaidInvoice.id,
              enrollmentId: enrollment.id,
              pspReference: txRecord.pspReference,
              programName,
            });
            summary.processed++;
            continue;
          }

          const result = await attemptWaitlistCharge({
            enrollmentId: enrollment.id,
            userId: enrollment.userId,
            organizationId,
            amount,
            programName,
            athleteId: enrollment.athleteId,
            programId: enrollment.programId,
            currentAttempts: enrollment.waitlistChargeAttempts,
          });

          if (result.success) {
            if (!result.alreadyCharged) {
              await executeNotificationByTrigger({
                organizationId,
                triggerType: "WAITLIST_OPENING",
                userId: enrollment.userId,
                athleteId: enrollment.athleteId,
                context: { programName },
              }).catch((err) =>
                logger.error("Failed to send WAITLIST_OPENING notification", { err })
              );
            }
            summary.processed++;
          } else {
            // Charge failed — set/extend deadline if stuck (no deadline yet)
            if (isStuck) {
              await db.enrollment.update({
                where: { id: enrollment.id },
                data: { waitlistPaymentDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
              });
            }
            summary.retried++;
          }

          continue;
        }

        // Case 3 — Cap reached: active deadline but >= 3 attempts → skip, wait for expiry
        summary.skipped++;
      } catch (err) {
        logger.error("Error processing waitlist enrollment in cron", {
          err: err instanceof Error ? err.message : String(err),
          enrollmentId: enrollment.id,
        });
        summary.errors++;
      }
    }

    logger.info("waitlist-payment-check cron complete", summary);
    await endCronMonitoring("waitlist-payment-check", checkInId, "ok");
    return NextResponse.json(summary);
  } catch (error) {
    await endCronMonitoring("waitlist-payment-check", checkInId, "error");
    logger.error("waitlist-payment-check cron failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
