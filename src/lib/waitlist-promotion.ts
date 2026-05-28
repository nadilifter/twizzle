// Core waitlist promotion logic. Exports three entry points:
//   promoteFromWaitlist   — moves the next WAITLISTED athlete to WAITLIST_PAYMENT_PENDING and
//                           attempts to charge them; called when a spot opens up.
//   attemptWaitlistCharge — idempotent charge attempt with optimistic lock, DRAFT invoice
//                           pre-creation, and stable Adyen reference; called by cron and retry.
//   finalizeWaitlistEnrollment — atomic, idempotent transaction that creates all financial
//                           records and sets enrollment ACTIVE; called by webhook fallback, cron,
//                           and retry endpoint.

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { chargeSubscription } from "@/lib/adyen";
import { calculateChargeAmounts } from "@/lib/recurring-billing-service";
import { executeNotificationByTrigger } from "@/lib/notification-service";
import { getTodayNoonUTC } from "@/lib/date-utils";

interface PromotionTxResult {
  promoted: boolean;
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

/**
 * Ensures all financial records exist for a paid waitlist charge and sets the enrollment
 * to ACTIVE. Everything runs in one transaction — fully atomic. Safe to call multiple
 * times; creates only missing records. Used by the Adyen webhook fallback and cron.
 */
export async function finalizeWaitlistEnrollment(params: {
  invoiceId: string;
  enrollmentId: string;
  pspReference: string;
  programName: string;
  paymentMethod?: "CARD" | "BANK" | "CASH" | "CHECK";
  amountCurrency?: string;
}): Promise<void> {
  const { invoiceId, enrollmentId, pspReference, programName, paymentMethod, amountCurrency } =
    params;

  await db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        subtotal: true,
        total: true,
        reference: true,
        status: true,
      },
    });
    if (!invoice) {
      console.error(`finalizeWaitlistEnrollment: invoice ${invoiceId} not found`);
      return;
    }

    if (invoice.status !== "PAID") {
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: "PAID" } });
    }

    const hasLineItem = await tx.lineItem.findFirst({ where: { invoiceId }, select: { id: true } });
    if (!hasLineItem) {
      await tx.lineItem.create({
        data: {
          invoiceId,
          description: `Waitlist promotion — ${programName}`,
          quantity: 1,
          unitPrice: invoice.subtotal,
          total: invoice.subtotal,
        },
      });
    }

    const hasPayment = await tx.payment.findFirst({ where: { invoiceId }, select: { id: true } });
    let paymentId = hasPayment?.id;
    if (!hasPayment) {
      const payment = await tx.payment.create({
        data: {
          invoiceId,
          userId: invoice.userId || undefined,
          amount: invoice.total,
          method: paymentMethod ?? "CARD",
          status: "COMPLETED",
          processedAt: new Date(),
        },
      });
      paymentId = payment.id;
    }

    const hasTransaction = await tx.transaction.findFirst({
      where: { pspReference },
      select: { id: true },
    });
    if (!hasTransaction && paymentId) {
      await tx.transaction.create({
        data: {
          organizationId: invoice.organizationId,
          paymentId,
          pspReference,
          merchantRef: invoice.reference,
          type: "PAYMENT",
          amount: invoice.total,
          currency: amountCurrency ?? "USD",
          status: "SETTLED",
          method: paymentMethod ?? "card",
          description: `Waitlist promotion — ${programName}`,
          settledAt: new Date(),
        },
      });
    }

    const enrollment = await tx.enrollment.update({
      where: { id: enrollmentId },
      data: { status: "ACTIVE", waitlistPaymentDeadline: null, waitlistChargeAttempts: 0 },
      select: { athleteId: true, programId: true },
    });

    // Restore instance registrations that were reverted to WAITLISTED when the charge
    // originally failed — now that payment is confirmed, promote them back to REGISTERED.
    await tx.instanceRegistration.updateMany({
      where: {
        athleteId: enrollment.athleteId,
        programInstance: { programId: enrollment.programId },
        status: "WAITLISTED",
      },
      data: { status: "REGISTERED" },
    });
  });
}

/**
 * Attempts to charge a user for a waitlist promotion.
 *
 * Safety guarantees:
 *  1. Idempotency check  — if a PAID invoice already exists for this enrollment
 *     (charge succeeded but the inline DB update failed on a prior attempt),
 *     we skip Adyen entirely and just finalize the enrollment.
 *  2. Optimistic lock    — increments waitlistChargeAttempts atomically before
 *     calling Adyen. updateMany returns count=0 if another process already bumped
 *     the counter, letting us bail without exception handling.
 *  3. DRAFT invoice first — invoice.id is used as the Adyen merchantReference so
 *     the webhook handler can look it up by ID and finalize records as a fallback
 *     if the inline db.$transaction below fails.
 *  4. Stable reference   — `waitlist-${enrollmentId}-${attemptNumber}` is stable
 *     for a given attempt. Adyen deduplicates repeated calls with the same reference.
 */
export async function attemptWaitlistCharge(params: {
  enrollmentId: string;
  userId: string;
  organizationId: string;
  amount: number;
  programName: string;
  athleteId: string;
  programId: string;
  currentAttempts: number;
}): Promise<{ success: boolean; error?: string; alreadyCharged?: boolean }> {
  const {
    enrollmentId,
    userId,
    organizationId,
    amount,
    programName,
    athleteId,
    programId,
    currentAttempts,
  } = params;

  // 1. Idempotency: charge already went through but inline DB update failed on a prior attempt.
  const existingPaidInvoice = await db.invoice.findFirst({
    where: {
      notes: { contains: `"waitlistEnrollmentId":"${enrollmentId}"` },
      status: "PAID",
    },
    select: { id: true },
  });
  if (existingPaidInvoice) {
    const txRecord = await db.transaction.findFirst({
      where: { payment: { invoiceId: existingPaidInvoice.id } },
      select: { pspReference: true },
    });
    const pspReference = txRecord?.pspReference ?? "";
    // Use finalizeWaitlistEnrollment to ensure all records (LineItem/Payment/Transaction)
    // exist, not just the enrollment status — more robust than a bare enrollment.update.
    await finalizeWaitlistEnrollment({
      invoiceId: existingPaidInvoice.id,
      enrollmentId,
      pspReference,
      programName,
    });
    return { success: true, alreadyCharged: true };
  }

  // 2. Fetch prerequisites before locking — bail without burning the counter if missing.
  const [defaultPm, orgPlatform, amounts] = await Promise.all([
    db.paymentMethod.findFirst({
      where: { userId, isDefault: true },
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
    return { success: false, error: "Organization has no Adyen platform account configured" };
  }
  if (!defaultPm?.adyenTokenId || !defaultPm.shopperReference) {
    return { success: false, error: "No default payment method" };
  }

  // 3. Optimistic lock — updateMany returns count=0 if another process already incremented.
  const locked = await db.enrollment.updateMany({
    where: { id: enrollmentId, waitlistChargeAttempts: currentAttempts },
    data: { waitlistChargeAttempts: currentAttempts + 1 },
  });
  if (locked.count === 0) {
    return { success: false, error: "Concurrent charge attempt detected — skipping" };
  }

  const attemptNumber = currentAttempts + 1;

  const { chargeTotal, tax, processingFee } = amounts;

  // 4. Reuse existing DRAFT invoice if present (avoids orphaned DRAFTs on cron retries).
  //    invoice.id becomes the Adyen merchantReference so the webhook can finalize as fallback.
  const existingDraft = await db.invoice.findFirst({
    where: {
      notes: { contains: `"waitlistEnrollmentId":"${enrollmentId}"` },
      status: "DRAFT",
    },
    select: { id: true, reference: true },
  });

  const draftInvoice =
    existingDraft ??
    (await db.invoice.create({
      data: {
        organizationId,
        userId,
        reference: `WL-${enrollmentId}-${attemptNumber}`,
        status: "DRAFT",
        dueDate: getTodayNoonUTC(),
        subtotal: amount,
        tax,
        processingFee,
        total: chargeTotal,
        notes: JSON.stringify({ waitlistEnrollmentId: enrollmentId, programId, programName }),
      },
    }));

  // 5. Charge.
  let chargeSucceeded = false;
  let pspReference: string | null = null;
  let chargeError = "Charge failed";

  try {
    const response = await chargeSubscription(
      defaultPm.shopperReference,
      defaultPm.adyenTokenId,
      chargeTotal,
      draftInvoice.id,
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

  if (chargeSucceeded && pspReference) {
    // 6a. Inline finalization — all DB ops in one transaction.
    //     The Adyen webhook will fire shortly and act as a fallback if this fails.
    try {
      await db.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: draftInvoice.id },
          data: { status: "PAID" },
        });

        await tx.lineItem.create({
          data: {
            invoiceId: draftInvoice.id,
            description: `Waitlist promotion — ${programName}`,
            quantity: 1,
            unitPrice: amount,
            total: amount,
          },
        });

        const payment = await tx.payment.create({
          data: {
            invoiceId: draftInvoice.id,
            userId,
            amount: chargeTotal,
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
            merchantRef: draftInvoice.reference,
            type: "PAYMENT",
            amount: chargeTotal,
            currency: "USD",
            status: "SETTLED",
            method: "card",
            description: `Waitlist promotion — ${programName}`,
            settledAt: new Date(),
          },
        });

        await tx.enrollment.update({
          where: { id: enrollmentId },
          data: { status: "ACTIVE", waitlistPaymentDeadline: null, waitlistChargeAttempts: 0 },
        });

        // Restore instances that were reverted to WAITLISTED on a prior failed attempt.
        await tx.instanceRegistration.updateMany({
          where: {
            athleteId,
            programInstance: { programId },
            status: "WAITLISTED",
          },
          data: { status: "REGISTERED" },
        });
      });
    } catch (dbErr) {
      // Inline finalization failed. DRAFT invoice (now charged by Adyen) remains in DB.
      // The Adyen webhook will deliver and finalize via handleAuthorisation as a fallback.
      console.error("Waitlist inline finalization failed — webhook will recover:", dbErr);
    }

    return { success: true };
  }

  // 6b. Charge failed — keep DRAFT invoice so cron can inspect it for safety checks.
  return { success: false, error: chargeError };
}

/**
 * Promotes the next waitlisted enrollment for a program when a spot opens.
 * Locks the Program row to serialize concurrent promotions.
 *
 * State machine:
 *   WAITLISTED (no deadline)          → WAITLIST_PAYMENT_PENDING (spot reserved, charge in flight)
 *     → ACTIVE                          (charge succeeded)
 *     → WAITLIST_PAYMENT_PENDING + deadline (charge failed; 24h window for user to resolve)
 *
 * ACTIVE + WAITLIST_PAYMENT_PENDING both count toward capacity.
 */
export async function promoteFromWaitlist(
  programId: string
): Promise<{ promoted: boolean; athleteId?: string }> {
  const txResult: PromotionTxResult = await db.$transaction(
    async (tx) => {
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
        const occupiedCount = await tx.enrollment.count({
          where: { programId, status: { in: ["ACTIVE", "WAITLIST_PAYMENT_PENDING"] } },
        });
        if (occupiedCount >= program.capacity) {
          return { promoted: false };
        }
      }

      const nextWaitlisted = await tx.enrollment.findFirst({
        where: { programId, status: "WAITLISTED", waitlistPaymentDeadline: null },
        orderBy: { createdAt: "asc" },
      });

      if (!nextWaitlisted) {
        return { promoted: false };
      }

      // Reserve the spot — stays WAITLIST_PAYMENT_PENDING until charge resolves
      await tx.enrollment.update({
        where: { id: nextWaitlisted.id },
        data: { status: "WAITLIST_PAYMENT_PENDING" },
      });

      const instances = await tx.programInstance.findMany({
        where: { programId, status: { not: "CANCELLED" } },
        select: { id: true },
      });

      await Promise.all(
        instances.map((inst) =>
          tx.instanceRegistration.upsert({
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
          })
        )
      );

      const rawPrice =
        program.pricingModel === "PER_SESSION" ? program.perSessionPrice : program.basePrice;

      if (rawPrice === null || rawPrice === undefined) {
        // Price fields missing on a program — log and promote to ACTIVE without charging
        console.error(
          `promoteFromWaitlist: program ${programId} has no price configured — promoting without charge`
        );
        await tx.enrollment.update({
          where: { id: nextWaitlisted.id },
          data: { status: "ACTIVE" },
        });
        return {
          promoted: true,
          athleteId: nextWaitlisted.athleteId,
          notifyCtx: {
            organizationId: program.organizationId,
            athleteId: nextWaitlisted.athleteId,
            programName: program.name,
            userId: nextWaitlisted.userId ?? undefined,
          },
        };
      }

      const programPrice = Number(rawPrice);
      const notifyCtx = {
        organizationId: program.organizationId,
        athleteId: nextWaitlisted.athleteId,
        programName: program.name,
        userId: nextWaitlisted.userId ?? undefined,
      };

      if (programPrice > 0 && nextWaitlisted.userId) {
        return {
          promoted: true,
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

      // Free program — promote straight to ACTIVE inside the transaction
      await tx.enrollment.update({
        where: { id: nextWaitlisted.id },
        data: { status: "ACTIVE" },
      });

      return { promoted: true, athleteId: nextWaitlisted.athleteId, notifyCtx };
    },
    { timeout: 15000 }
  );

  if (!txResult.promoted) {
    return { promoted: false };
  }

  if (txResult.chargeCtx) {
    const { organizationId, userId, enrollmentId, amount, programName, athleteId } =
      txResult.chargeCtx;

    const result = await attemptWaitlistCharge({
      enrollmentId,
      userId,
      organizationId,
      amount,
      programName,
      athleteId,
      programId,
      currentAttempts: 0,
    });

    if (!result.success && !result.alreadyCharged) {
      // Charge failed — set 24h deadline for user to resolve in-app.
      // waitlistChargeAttempts is already 1 from the optimistic lock inside attemptWaitlistCharge.
      await db.enrollment.update({
        where: { id: enrollmentId },
        data: { waitlistPaymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      });
      await db.instanceRegistration.updateMany({
        where: { athleteId, programInstance: { programId }, status: "REGISTERED" },
        data: { status: "WAITLISTED" },
      });

      try {
        await executeNotificationByTrigger({
          organizationId,
          triggerType: "WAITLIST_PAYMENT_FAILED",
          userId,
          athleteId,
          context: { programName, failureReason: result.error ?? "Payment declined" },
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
