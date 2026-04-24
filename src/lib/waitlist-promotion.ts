import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { chargeSubscription } from "@/lib/adyen";
import { calculateChargeAmounts } from "@/lib/recurring-billing-service";
import { executeNotificationByTrigger } from "@/lib/notification-service";

/**
 * Promotes the next waitlisted enrollment for a program when a spot opens.
 * Locks the Program row to serialize concurrent promotions.
 *
 * State machine:
 *   WAITLISTED (no deadline) → WAITLIST_PAYMENT_PENDING (spot reserved, charge in flight)
 *     → ACTIVE                  (charge succeeded)
 *     → WAITLISTED + deadline   (charge failed; 24h window for user to resolve)
 *
 * WAITLIST_PAYMENT_PENDING and WAITLISTED-with-active-deadline both count toward capacity
 * so nobody else is promoted into the same spot while payment is in progress.
 */
export async function promoteFromWaitlist(
  programId: string
): Promise<{ promoted: boolean; athleteId?: string }> {
  interface TxResult {
    promoted: boolean;
    enrollmentId?: string;
    athleteId?: string;
    notifyCtx?: { organizationId: string; athleteId: string; programName: string; userId?: string };
    chargeCtx?: {
      organizationId: string;
      userId: string;
      enrollmentId: string;
      amount: number;
      programName: string;
      athleteId: string;
    };
  }

  const txResult: TxResult = await db.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Program" WHERE id = ${programId} FOR UPDATE`);

    const program = await tx.program.findUnique({
      where: { id: programId },
      select: {
        name: true,
        organizationId: true,
        waitlistEnabled: true,
        waitlistAutoPromote: true,
        capacity: true,
        hasCapacityRestriction: true,
        basePrice: true,
        perSessionPrice: true,
        pricingModel: true,
      },
    });

    if (!program?.waitlistEnabled || !program.waitlistAutoPromote) {
      return { promoted: false };
    }

    if (program.hasCapacityRestriction && program.capacity != null) {
      // ACTIVE and WAITLIST_PAYMENT_PENDING both hold a spot.
      // WAITLISTED enrollments are purely in queue and don't count.
      const occupiedCount = await tx.enrollment.count({
        where: { programId, status: { in: ["ACTIVE", "WAITLIST_PAYMENT_PENDING"] } },
      });
      if (occupiedCount >= program.capacity) {
        return { promoted: false };
      }
    }

    // Only pick enrollments that are purely waiting — no active payment window
    const nextWaitlisted = await tx.enrollment.findFirst({
      where: { programId, status: "WAITLISTED", waitlistPaymentDeadline: null },
      orderBy: { createdAt: "asc" },
    });

    if (!nextWaitlisted) {
      return { promoted: false };
    }

    // Reserve the spot — status stays in WAITLIST_PAYMENT_PENDING until charge resolves
    await tx.enrollment.update({
      where: { id: nextWaitlisted.id },
      data: { status: "WAITLIST_PAYMENT_PENDING" },
    });

    const instances = await tx.programInstance.findMany({
      where: { programId, status: { not: "CANCELLED" } },
      select: { id: true },
    });

    for (const inst of instances) {
      await tx.instanceRegistration.upsert({
        where: {
          programInstanceId_athleteId: {
            programInstanceId: inst.id,
            athleteId: nextWaitlisted.athleteId,
          },
        },
        update: { status: "REGISTERED" },
        create: {
          programInstanceId: inst.id,
          athleteId: nextWaitlisted.athleteId,
          userId: nextWaitlisted.userId || undefined,
          status: "REGISTERED",
        },
      });
    }

    const programPrice =
      program.pricingModel === "PER_SESSION"
        ? Number(program.perSessionPrice ?? 0)
        : Number(program.basePrice ?? 0);

    const notifyCtx = {
      organizationId: program.organizationId,
      athleteId: nextWaitlisted.athleteId,
      programName: program.name,
      userId: nextWaitlisted.userId ?? undefined,
    };

    if (programPrice > 0 && nextWaitlisted.userId) {
      return {
        promoted: true,
        enrollmentId: nextWaitlisted.id,
        athleteId: nextWaitlisted.athleteId,
        notifyCtx,
        chargeCtx: {
          organizationId: program.organizationId,
          userId: nextWaitlisted.userId,
          enrollmentId: nextWaitlisted.id,
          amount: programPrice,
          programName: program.name,
          athleteId: nextWaitlisted.athleteId,
        },
      };
    }

    // Free program — promote straight to ACTIVE
    await tx.enrollment.update({
      where: { id: nextWaitlisted.id },
      data: { status: "ACTIVE" },
    });

    return { promoted: true, athleteId: nextWaitlisted.athleteId, notifyCtx };
  });

  if (!txResult.promoted) {
    return { promoted: false };
  }

  if (txResult.chargeCtx) {
    const { organizationId, userId, enrollmentId, amount, programName, athleteId } =
      txResult.chargeCtx;

    const [defaultPm, orgPlatform] = await Promise.all([
      db.paymentMethod.findFirst({
        where: { userId, isDefault: true },
        select: { adyenTokenId: true, shopperReference: true },
      }),
      db.organization.findUnique({
        where: { id: organizationId },
        select: { adyenPlatformAccount: { select: { storeReference: true } } },
      }),
    ]);

    let chargeSucceeded = false;
    let chargeError = "No default payment method";
    let pspReference: string | null = null;
    let chargedTotal = 0;
    let taxAmount = 0;
    let processingFeeAmount = 0;

    const storeReference = orgPlatform?.adyenPlatformAccount?.storeReference;

    if (!storeReference) {
      chargeError = "Organization has no Adyen platform account configured";
    } else if (defaultPm?.adyenTokenId && defaultPm.shopperReference) {
      try {
        const amounts = await calculateChargeAmounts(amount, organizationId);
        chargedTotal = amounts.chargeTotal;
        taxAmount = amounts.tax;
        processingFeeAmount = amounts.processingFee;
        // Attempt 1 — stable reference makes this idempotent if the DB update fails and we retry
        const reference = `waitlist-${enrollmentId}-1`;
        const response = await chargeSubscription(
          defaultPm.shopperReference,
          defaultPm.adyenTokenId,
          chargedTotal,
          reference,
          `Waitlist promotion — ${programName}`,
          storeReference
        );
        chargeSucceeded = response.resultCode === "Authorised";
        if (chargeSucceeded) {
          pspReference = response.pspReference;
        } else {
          chargeError = response.refusalReason ?? `Payment ${response.resultCode}`;
        }
      } catch (err) {
        chargeError = err instanceof Error ? err.message : "Charge failed";
      }
    }

    if (chargeSucceeded && pspReference) {
      const reference = `WL-${enrollmentId.slice(-8)}-${Date.now()}`;
      await db.$transaction(async (tx) => {
        await tx.enrollment.update({
          where: { id: enrollmentId },
          data: { status: "ACTIVE", waitlistPaymentDeadline: null, waitlistChargeAttempts: 0 },
        });

        const invoice = await tx.invoice.create({
          data: {
            organizationId,
            userId,
            reference,
            status: "PAID",
            dueDate: new Date(),
            subtotal: amount,
            tax: taxAmount,
            processingFee: processingFeeAmount,
            total: chargedTotal,
            notes: JSON.stringify({ waitlistEnrollmentId: enrollmentId }),
          },
        });

        await tx.lineItem.create({
          data: {
            invoiceId: invoice.id,
            description: `Waitlist promotion — ${programName}`,
            quantity: 1,
            unitPrice: amount,
            total: amount,
          },
        });

        const payment = await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            userId,
            amount: chargedTotal,
            method: "CARD",
            status: "COMPLETED",
            processedAt: new Date(),
          },
        });

        await tx.transaction.create({
          data: {
            organizationId,
            paymentId: payment.id,
            pspReference,
            merchantRef: reference,
            type: "PAYMENT",
            amount: chargedTotal,
            currency: "USD",
            status: "SETTLED",
            method: "card",
            description: `Waitlist promotion — ${programName}`,
            settledAt: new Date(),
          },
        });
      });
    } else {
      // Charge failed — stay in WAITLIST_PAYMENT_PENDING so the spot is still held
      // in the capacity count while the user has 24h to resolve payment
      await db.enrollment.update({
        where: { id: enrollmentId },
        data: {
          status: "WAITLIST_PAYMENT_PENDING",
          waitlistPaymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
          waitlistChargeAttempts: 1,
        },
      });
      // Revert instance registrations back to WAITLISTED
      await db.instanceRegistration.updateMany({
        where: {
          athleteId,
          programInstance: { programId },
          status: "REGISTERED",
        },
        data: { status: "WAITLISTED" },
      });

      try {
        await executeNotificationByTrigger({
          organizationId,
          triggerType: "WAITLIST_PAYMENT_FAILED",
          userId,
          athleteId,
          context: { programName, failureReason: chargeError },
        });
      } catch (err) {
        console.error("Failed to send waitlist payment failed notification", err);
      }

      return { promoted: true, athleteId };
    }
  }

  // Free program or successful charge — send spot-opened notification
  if (txResult.notifyCtx) {
    try {
      await executeNotificationByTrigger({
        organizationId: txResult.notifyCtx.organizationId,
        triggerType: "WAITLIST_OPENING",
        userId: txResult.notifyCtx.userId,
        athleteId: txResult.notifyCtx.athleteId,
        context: { programName: txResult.notifyCtx.programName },
      });
    } catch (err) {
      console.error("Failed to send waitlist promotion notification", err);
    }
  }

  return { promoted: true, athleteId: txResult.athleteId };
}

/**
 * Promotes the next waitlisted instance registration to REGISTERED.
 * Locks the ProgramInstance row to serialize concurrent promotions
 * and prevent exceeding instance capacity.
 */
export async function promoteFromInstanceWaitlist(
  instanceId: string
): Promise<{ promoted: boolean; athleteId?: string }> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "ProgramInstance" WHERE id = ${instanceId} FOR UPDATE`
    );

    const instance = await tx.programInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        capacity: true,
        programId: true,
        program: {
          select: {
            waitlistEnabled: true,
            waitlistAutoPromote: true,
          },
        },
      },
    });

    if (!instance?.program?.waitlistEnabled || !instance.program.waitlistAutoPromote) {
      return { promoted: false };
    }

    if (instance.capacity != null) {
      const registeredCount = await tx.instanceRegistration.count({
        where: { programInstanceId: instanceId, status: "REGISTERED" },
      });
      if (registeredCount >= instance.capacity) {
        return { promoted: false };
      }
    }

    const nextWaitlisted = await tx.instanceRegistration.findFirst({
      where: { programInstanceId: instanceId, status: "WAITLISTED" },
      orderBy: { createdAt: "asc" },
    });

    if (!nextWaitlisted) {
      return { promoted: false };
    }

    await tx.instanceRegistration.update({
      where: { id: nextWaitlisted.id },
      data: { status: "REGISTERED" },
    });

    return { promoted: true, athleteId: nextWaitlisted.athleteId };
  });
}
