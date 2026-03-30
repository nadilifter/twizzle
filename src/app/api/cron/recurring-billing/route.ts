import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { addMonths, addYears } from "date-fns";
import { db } from "@/lib/db";
import { normalizeToNoonUTC } from "@/lib/date-utils";
import {
  executeRecurringCharge,
  extendEntitlement,
  suspendEntitlement,
  shouldTerminateCharge,
} from "@/lib/recurring-billing-service";
import { executeNotificationByTrigger } from "@/lib/notification-service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_RETRIES = 3;
const REMINDER_DAYS_AHEAD = 3;
const MIN_RETRY_INTERVAL_MS = 20 * 60 * 60 * 1000; // 20 hours

function verifyCronSecret(authHeader: string | null): boolean {
  if (!CRON_SECRET || !authHeader) return false;
  const expected = `Bearer ${CRON_SECRET}`;
  if (authHeader.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  try {
    if (!CRON_SECRET) {
      logger.error("CRON_SECRET is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (!verifyCronSecret(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const summary = {
      remindersSent: 0,
      processed: 0,
      failed: 0,
      skipped: 0,
      terminated: 0,
      errors: [] as string[],
    };

    // ========================================
    // Phase 1: Pre-charge reminders (3 days out)
    // ========================================
    try {
      const reminderStart = new Date(now);
      reminderStart.setDate(reminderStart.getDate() + REMINDER_DAYS_AHEAD);
      reminderStart.setHours(0, 0, 0, 0);
      const reminderEnd = new Date(reminderStart);
      reminderEnd.setHours(23, 59, 59, 999);

      const upcomingCharges = await db.recurringCharge.findMany({
        where: {
          status: "ACTIVE",
          nextChargeDate: { gte: reminderStart, lte: reminderEnd },
          organization: { isActive: true },
          paymentMethodId: { not: null },
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
          paymentMethod: { select: { last4: true, brand: true } },
          organization: { select: { id: true, name: true } },
        },
      });

      for (const charge of upcomingCharges) {
        try {
          await executeNotificationByTrigger({
            organizationId: charge.organizationId,
            triggerType: "RECURRING_CHARGE_UPCOMING",
            userId: charge.userId ?? undefined,
            context: {
              chargeDescription: charge.description,
              chargeAmount: Number(charge.amount).toFixed(2),
              chargeDate: charge.nextChargeDate.toISOString().split("T")[0],
              cardLast4: charge.paymentMethod?.last4 ?? "****",
              cardBrand: charge.paymentMethod?.brand ?? "Card",
            },
          });
          summary.remindersSent++;
        } catch (err) {
          logger.error("Failed to send recurring charge reminder", {
            chargeId: charge.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      const msg = `Phase 1 (reminders) error: ${err instanceof Error ? err.message : String(err)}`;
      summary.errors.push(msg);
      logger.error(msg);
    }

    // ========================================
    // Phase 2: Process due charges
    // ========================================
    const dueCharges = await db.recurringCharge.findMany({
      where: {
        status: "ACTIVE",
        nextChargeDate: { lte: todayEnd },
        organization: { isActive: true },
        frequency: { not: "SESSION" },
      },
      include: {
        paymentMethod: {
          select: {
            id: true,
            type: true,
            last4: true,
            brand: true,
            adyenTokenId: true,
            shopperReference: true,
          },
        },
        organization: { select: { id: true, name: true } },
      },
    });

    for (const charge of dueCharges) {
      // Check if a product-linked charge should be terminated
      if (charge.enrollmentId || charge.athletePassId || charge.athleteMembershipId) {
        const terminate = await shouldTerminateCharge(charge);
        if (terminate) {
          await db.recurringCharge.update({
            where: { id: charge.id },
            data: { status: "CANCELLED" },
          });
          summary.terminated++;
          continue;
        }
      }

      // Skip if no payment method or missing Adyen token
      if (!charge.paymentMethodId || !charge.paymentMethod) {
        summary.skipped++;
        continue;
      }
      if (!charge.paymentMethod.adyenTokenId) {
        summary.skipped++;
        continue;
      }

      // Enforce minimum retry interval to prevent double-charging
      if (charge.lastAttemptAt) {
        const timeSinceLastAttempt = now.getTime() - charge.lastAttemptAt.getTime();
        if (timeSinceLastAttempt < MIN_RETRY_INTERVAL_MS) {
          summary.skipped++;
          continue;
        }
      }

      try {
        // Mark attempt timestamp before charging
        await db.recurringCharge.update({
          where: { id: charge.id },
          data: { lastAttemptAt: now },
        });

        const result = await executeRecurringCharge(charge, charge.organizationId);

        if (result.success) {
          // Advance next charge date using date-fns for safe month-edge handling
          let nextDate: Date;
          if (charge.frequency === "MONTHLY") {
            nextDate = normalizeToNoonUTC(addMonths(charge.nextChargeDate, 1))!;
          } else if (charge.frequency === "YEARLY") {
            nextDate = normalizeToNoonUTC(addYears(charge.nextChargeDate, 1))!;
          } else {
            nextDate = normalizeToNoonUTC(addMonths(charge.nextChargeDate, 1))!;
          }

          await db.recurringCharge.update({
            where: { id: charge.id },
            data: {
              nextChargeDate: nextDate,
              lastChargedAt: now,
              failureCount: 0,
            },
          });

          // Extend entitlement for product-linked charges
          await extendEntitlement(charge);

          summary.processed++;

          // Fire success notification
          try {
            const actualAmount = result.chargedTotal ?? Number(charge.amount);
            await executeNotificationByTrigger({
              organizationId: charge.organizationId,
              triggerType: "RECURRING_CHARGE_SUCCEEDED",
              userId: charge.userId ?? undefined,
              context: {
                chargeDescription: charge.description,
                chargeAmount: actualAmount.toFixed(2),
                nextChargeDate: nextDate.toISOString().split("T")[0],
                cardLast4: charge.paymentMethod?.last4 ?? "****",
              },
            });
          } catch {
            // Non-fatal: charge succeeded even if notification fails
          }
        } else {
          const newFailureCount = charge.failureCount + 1;

          if (newFailureCount >= MAX_RETRIES) {
            await db.recurringCharge.update({
              where: { id: charge.id },
              data: { failureCount: newFailureCount, status: "FAILED" },
            });

            // Suspend linked entitlement
            await suspendEntitlement(charge);

            // Fire suspended notification
            try {
              await executeNotificationByTrigger({
                organizationId: charge.organizationId,
                triggerType: "RECURRING_CHARGE_SUSPENDED",
                userId: charge.userId ?? undefined,
                context: {
                  chargeDescription: charge.description,
                  chargeAmount: Number(charge.amount).toFixed(2),
                  failureReason: result.error ?? "Payment declined",
                },
              });
            } catch {
              // Non-fatal
            }
          } else {
            await db.recurringCharge.update({
              where: { id: charge.id },
              data: { failureCount: newFailureCount },
            });

            // Fire failed notification (will retry)
            try {
              await executeNotificationByTrigger({
                organizationId: charge.organizationId,
                triggerType: "RECURRING_CHARGE_FAILED",
                userId: charge.userId ?? undefined,
                context: {
                  chargeDescription: charge.description,
                  chargeAmount: Number(charge.amount).toFixed(2),
                  failureReason: result.error ?? "Payment declined",
                  retriesRemaining: String(MAX_RETRIES - newFailureCount),
                },
              });
            } catch {
              // Non-fatal
            }
          }

          summary.failed++;
        }
      } catch (error) {
        const msg = `Charge ${charge.id}: ${error instanceof Error ? error.message : String(error)}`;
        summary.errors.push(msg);
        summary.failed++;
        logger.error("Recurring charge processing error", { chargeId: charge.id, error: msg });
      }
    }

    return NextResponse.json({
      success: true,
      summary,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    logger.error("Error in recurring-billing cron:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process recurring billing",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/** Allow POST for manual triggers (e.g. superadmin tooling); Vercel cron uses GET. */
export async function POST(request: NextRequest) {
  return GET(request);
}
