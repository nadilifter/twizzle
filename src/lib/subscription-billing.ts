import { db } from "@/lib/db";
import { chargeSubscription, isAdyenConfigured } from "@/lib/adyen";
import { sendTemplatedEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { registerAllowedOrigin, removeAllowedOrigin } from "@/lib/adyen-platform";
import { Prisma } from "@prisma/client";

/**
 * Build a noon-UTC Date for a given year/month/day.
 * Avoids day-off-by-one bugs in western timezones.
 */
function noonUTC(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

/**
 * Check if a payment method has expired based on its expiryMonth/expiryYear.
 * Cards expire at the end of their expiry month (e.g. 03/2026 is valid through March 31).
 */
function isPaymentMethodExpired(pm: {
  expiryMonth?: string | null;
  expiryYear?: string | null;
}): boolean {
  if (!pm.expiryMonth || !pm.expiryYear) return false;

  const month = parseInt(pm.expiryMonth, 10);
  const rawYear = parseInt(pm.expiryYear, 10);
  if (isNaN(month) || isNaN(rawYear)) return false;
  // Normalize 2-digit years (e.g. "30" -> 2030) stored by the Adyen webhook handler
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  // Card is valid through the last day of the expiry month.
  // Date(year, month, 0) gives the last day of that month, but we compare
  // at month granularity: expired if we're past the expiry month.
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  return year < currentYear || (year === currentYear && month < currentMonth);
}

/**
 * Generate subscription invoices for the current month.
 * Should be called on the 1st of each month at noon UTC.
 *
 * Idempotent: skips orgs that already have an invoice for this period.
 */
export async function generateMonthlyInvoices(options?: { organizationId?: string }): Promise<{
  generated: number;
  skipped: number;
  errors: string[];
}> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-indexed

  const periodStart = noonUTC(year, month, 1);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const periodEnd = noonUTC(year, month, lastDay);

  const subscriptions = await db.organizationSubscription.findMany({
    where: {
      status: { in: ["ACTIVE", "TRIALING"] },
      organization: { isActive: true },
      ...(options?.organizationId ? { organizationId: options.organizationId } : {}),
    },
    include: {
      plan: true,
      organization: { select: { id: true, slug: true } },
    },
  });

  let generated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const sub of subscriptions) {
    try {
      const price =
        sub.billingCycle === "YEARLY"
          ? (sub.plan.yearlyPrice ?? sub.plan.monthlyPrice)
          : sub.plan.monthlyPrice;
      const amount = sub.billingCycle === "YEARLY" ? Number(price) / 12 : Number(price);

      if (amount <= 0) {
        skipped++;
        continue;
      }

      // Don't bill if trial hasn't ended yet
      if (sub.trialEndsAt && sub.trialEndsAt > now) {
        skipped++;
        continue;
      }

      const existing = await db.subscriptionInvoice.findFirst({
        where: {
          organizationId: sub.organizationId,
          periodStart,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const monthStr = String(month).padStart(2, "0");
      const reference = `SUB-INV-${year}-${monthStr}-${sub.organization.slug}`;

      await db.subscriptionInvoice.create({
        data: {
          organizationId: sub.organizationId,
          planId: sub.planId,
          reference,
          periodStart,
          periodEnd,
          amount,
          currency: "USD",
          status: "PENDING",
        },
      });

      generated++;
    } catch (err) {
      const msg = `Failed to generate invoice for org ${sub.organizationId}: ${err instanceof Error ? err.message : String(err)}`;
      logger.error(msg);
      errors.push(msg);
    }
  }

  return { generated, skipped, errors };
}

/**
 * Process payment for a subscription invoice.
 * Tries each OrganizationPaymentMethod in order (default first, then by priority/createdAt).
 * Returns true if payment succeeded.
 */
export async function processInvoicePayment(invoiceId: string): Promise<boolean> {
  const invoice = await db.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      organization: {
        include: {
          subscription: true,
          organizationPaymentMethods: {
            where: { isActive: true },
            orderBy: [{ isDefault: "desc" }, { priority: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!invoice) {
    logger.error("Subscription invoice not found", { invoiceId });
    return false;
  }

  if (invoice.status === "PAID") {
    return true;
  }

  // Atomically claim this invoice for processing to prevent double-charges
  // when concurrent processes (cron + manual retry, double-triggered cron) race.
  const claimed = await db.subscriptionInvoice.updateMany({
    where: { id: invoiceId, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "PROCESSING" },
  });
  if (claimed.count === 0) {
    const current = await db.subscriptionInvoice.findUnique({
      where: { id: invoiceId },
      select: { status: true },
    });
    return current?.status === "PAID";
  }

  const allMethods = invoice.organization.organizationPaymentMethods;
  const paymentMethods = allMethods.filter((pm) => !isPaymentMethodExpired(pm));
  const expiredCount = allMethods.length - paymentMethods.length;

  if (expiredCount > 0) {
    logger.info("Skipping expired payment methods", {
      organizationId: invoice.organizationId,
      expiredCount,
      remainingCount: paymentMethods.length,
    });
  }

  if (paymentMethods.length === 0) {
    logger.warn("No valid (non-expired) payment methods on file", {
      organizationId: invoice.organizationId,
      totalMethods: allMethods.length,
      expiredMethods: expiredCount,
    });
    await handleAllPaymentsFailed(invoice.id, invoice.organizationId);
    return false;
  }

  if (!isAdyenConfigured()) {
    logger.error("Adyen not configured, cannot process subscription payment");
    return false;
  }

  const shopperReference =
    invoice.organization.subscription?.adyenShopperReference ?? `org-${invoice.organizationId}`;
  const amount = Number(invoice.amount);

  let attemptNumber = 0;

  for (const pm of paymentMethods) {
    attemptNumber++;

    try {
      const paymentRef = `${invoice.reference}-attempt-${attemptNumber}`;

      const result = await chargeSubscription(
        shopperReference,
        pm.storedPaymentMethodId,
        amount,
        paymentRef,
        `Subscription payment for ${invoice.reference}`
      );

      const resultCode = result?.resultCode?.toLowerCase?.() ?? "";
      const pspReference = result?.pspReference ?? null;

      if (resultCode === "authorised" || resultCode === "received") {
        await db.subscriptionPaymentAttempt.create({
          data: {
            subscriptionInvoiceId: invoiceId,
            paymentMethodId: pm.id,
            amount,
            currency: invoice.currency,
            status: "SUCCESS",
            pspReference,
            attemptNumber,
          },
        });

        await db.subscriptionInvoice.update({
          where: { id: invoiceId },
          data: { status: "PAID", paidAt: new Date() },
        });

        await clearGracePeriod(invoice.organizationId);

        logger.info("Subscription payment succeeded", {
          invoiceId,
          organizationId: invoice.organizationId,
          paymentMethodId: pm.id,
          pspReference,
        });

        await notifyPaymentSuccess(invoice.organizationId, amount, invoice.reference);

        return true;
      }

      await db.subscriptionPaymentAttempt.create({
        data: {
          subscriptionInvoiceId: invoiceId,
          paymentMethodId: pm.id,
          amount,
          currency: invoice.currency,
          status: "FAILED",
          pspReference,
          failureReason: result?.refusalReason ?? resultCode ?? "Unknown",
          attemptNumber,
        },
      });

      logger.info("Subscription payment attempt failed, trying next", {
        invoiceId,
        paymentMethodId: pm.id,
        refusalReason: result?.refusalReason,
      });
    } catch (err) {
      await db.subscriptionPaymentAttempt.create({
        data: {
          subscriptionInvoiceId: invoiceId,
          paymentMethodId: pm.id,
          amount,
          currency: invoice.currency,
          status: "FAILED",
          failureReason: err instanceof Error ? err.message : String(err),
          attemptNumber,
        },
      });

      logger.error("Subscription payment attempt threw error", {
        invoiceId,
        paymentMethodId: pm.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await handleAllPaymentsFailed(invoiceId, invoice.organizationId);
  return false;
}

async function handleAllPaymentsFailed(invoiceId: string, organizationId: string) {
  await db.subscriptionInvoice.update({
    where: { id: invoiceId },
    data: { status: "FAILED", failedAt: new Date() },
  });

  const now = new Date();
  const deactivationDate = noonUTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate() + 30
  );

  await db.organization.update({
    where: { id: organizationId },
    data: {
      scheduledDeactivationDate: deactivationDate,
      dunningWarningsSent: {},
    },
  });

  await db.organizationSubscription.updateMany({
    where: { organizationId },
    data: { status: "PAST_DUE" },
  });

  logger.warn("All payment methods failed for subscription invoice", {
    invoiceId,
    organizationId,
    scheduledDeactivationDate: deactivationDate.toISOString(),
  });

  await notifyPaymentFailed(organizationId);
}

/**
 * Retry the most recent FAILED subscription invoice for an org.
 * Called when a new payment method is added.
 */
export async function retryOutstandingInvoice(organizationId: string): Promise<boolean> {
  const failedInvoice = await db.subscriptionInvoice.findFirst({
    where: {
      organizationId,
      status: "FAILED",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!failedInvoice) {
    return false;
  }

  await db.subscriptionInvoice.update({
    where: { id: failedInvoice.id },
    data: { status: "PENDING" },
  });

  const success = await processInvoicePayment(failedInvoice.id);

  if (success) {
    // Grace period is already cleared by processInvoicePayment on success.
    // Check if org needs reactivation (was deactivated for non-payment).
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { isActive: true },
    });

    if (org && !org.isActive) {
      await reactivateOrganization(organizationId);
    }
  }

  return success;
}

async function clearGracePeriod(organizationId: string) {
  await db.organization.update({
    where: { id: organizationId },
    data: {
      scheduledDeactivationDate: null,
      dunningWarningsSent: Prisma.DbNull,
    },
  });

  await db.organizationSubscription.updateMany({
    where: { organizationId, status: "PAST_DUE" },
    data: { status: "ACTIVE" },
  });
}

async function reactivateOrganization(organizationId: string) {
  await db.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: organizationId },
      data: {
        isActive: true,
        deactivatedAt: null,
        deactivatedBy: null,
        deactivationReason: null,
        deactivationNotes: null,
        scheduledDeactivationDate: null,
        dunningWarningsSent: Prisma.DbNull,
      },
    });

    await tx.organizationSubscription.updateMany({
      where: { organizationId, status: { in: ["PAUSED", "PAST_DUE"] } },
      data: { status: "ACTIVE" },
    });

    await tx.organizationStatusLog.create({
      data: {
        organizationId,
        action: "REACTIVATED",
        reason: "Payment method updated and outstanding invoice paid",
        notes: "Automatic reactivation by billing system",
      },
    });
  });

  const websiteConfig = await db.websiteConfig.findFirst({
    where: { organizationId },
    select: { subdomain: true },
  });
  if (websiteConfig?.subdomain) {
    void registerAllowedOrigin(websiteConfig.subdomain);
  }

  logger.info("Organization reactivated after successful payment", { organizationId });
}

/**
 * Process dunning (warning) emails for orgs approaching deactivation.
 * Sends at 30d, 7d, and 1d before scheduledDeactivationDate.
 */
export async function processDunningEmails(): Promise<{
  sent: number;
  errors: string[];
}> {
  const orgsInGracePeriod = await db.organization.findMany({
    where: {
      scheduledDeactivationDate: { not: null },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      scheduledDeactivationDate: true,
      dunningWarningsSent: true,
    },
  });

  let sent = 0;
  const errors: string[] = [];

  for (const org of orgsInGracePeriod) {
    try {
      const deactivationDate = org.scheduledDeactivationDate!;
      const now = new Date();
      const daysRemaining = Math.ceil(
        (deactivationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const warnings = (org.dunningWarningsSent as Record<string, boolean> | null) ?? {};

      const thresholds = [
        { key: "30d", days: 30 },
        { key: "7d", days: 7 },
        { key: "1d", days: 1 },
      ];

      for (const threshold of thresholds) {
        if (daysRemaining <= threshold.days && !warnings[threshold.key]) {
          await sendDunningEmail(org.id, org.name, daysRemaining);
          warnings[threshold.key] = true;
          sent++;
        }
      }

      if (Object.keys(warnings).length > 0) {
        await db.organization.update({
          where: { id: org.id },
          data: { dunningWarningsSent: warnings },
        });
      }
    } catch (err) {
      const msg = `Failed to process dunning for org ${org.id}: ${err instanceof Error ? err.message : String(err)}`;
      logger.error(msg);
      errors.push(msg);
    }
  }

  return { sent, errors };
}

/**
 * Deactivate organizations that have passed their scheduled deactivation date.
 */
export async function deactivateExpiredOrgs(): Promise<{
  deactivated: number;
  errors: string[];
}> {
  const now = new Date();

  const expiredOrgs = await db.organization.findMany({
    where: {
      scheduledDeactivationDate: { lte: now },
      isActive: true,
    },
    include: {
      subscription: true,
      websiteConfig: { select: { subdomain: true } },
    },
  });

  let deactivated = 0;
  const errors: string[] = [];

  for (const org of expiredOrgs) {
    try {
      await db.$transaction(async (tx) => {
        await tx.organization.update({
          where: { id: org.id },
          data: {
            isActive: false,
            deactivatedAt: new Date(),
            deactivatedBy: "system",
            deactivationReason: "Non-payment",
            deactivationNotes: "Automatically deactivated after 30-day grace period expired",
          },
        });

        if (org.subscription) {
          await tx.organizationSubscription.update({
            where: { id: org.subscription.id },
            data: { status: "PAUSED" },
          });
        }

        await tx.organizationStatusLog.create({
          data: {
            organizationId: org.id,
            action: "DEACTIVATED",
            reason: "Non-payment",
            notes:
              "Automatic deactivation: all payment methods failed and 30-day grace period expired",
          },
        });
      });

      if (org.websiteConfig?.subdomain) {
        void removeAllowedOrigin(org.websiteConfig.subdomain);
      }

      await notifyDeactivation(org.id, org.name);

      deactivated++;
      logger.info("Organization deactivated due to non-payment", { organizationId: org.id });
    } catch (err) {
      const msg = `Failed to deactivate org ${org.id}: ${err instanceof Error ? err.message : String(err)}`;
      logger.error(msg);
      errors.push(msg);
    }
  }

  return { deactivated, errors };
}

/**
 * Recover invoices stuck in transient states after an outage or crash.
 *
 * - PROCESSING for more than 1 hour -> reset to PENDING (charge likely timed out)
 * - PENDING invoices that were never processed -> attempt payment
 *
 * Safe to call on every dunning cron run. Idempotent.
 */
export async function recoverAndRetryStaleInvoices(): Promise<{
  recovered: number;
  retried: number;
  retriedPaid: number;
  errors: string[];
}> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const errors: string[] = [];

  // 1. Reset PROCESSING invoices that have been stuck for over an hour
  const stuckProcessing = await db.subscriptionInvoice.findMany({
    where: {
      status: "PROCESSING",
      updatedAt: { lt: oneHourAgo },
    },
    select: { id: true, reference: true },
  });

  for (const inv of stuckProcessing) {
    try {
      await db.subscriptionInvoice.update({
        where: { id: inv.id },
        data: { status: "PENDING" },
      });
      logger.warn("Reset stuck PROCESSING invoice to PENDING", {
        invoiceId: inv.id,
        reference: inv.reference,
      });
    } catch (err) {
      errors.push(
        `Failed to reset stuck invoice ${inv.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // 2. Retry all PENDING invoices (from this or previous billing runs)
  const pendingInvoices = await db.subscriptionInvoice.findMany({
    where: { status: "PENDING" },
    select: { id: true },
  });

  let retriedPaid = 0;

  for (const inv of pendingInvoices) {
    try {
      const success = await processInvoicePayment(inv.id);
      if (success) retriedPaid++;
    } catch (err) {
      errors.push(
        `Failed to retry invoice ${inv.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return {
    recovered: stuckProcessing.length,
    retried: pendingInvoices.length,
    retriedPaid,
    errors,
  };
}

// ============================================
// Email notification helpers
// ============================================

async function getOrgAdminEmails(organizationId: string): Promise<string[]> {
  const members = await db.organizationMember.findMany({
    where: {
      organizationId,
      role: { in: ["ADMIN"] },
      status: "ACTIVE",
    },
    include: { user: { select: { email: true } } },
  });

  return members.map((m) => m.user.email).filter(Boolean) as string[];
}

async function notifyPaymentSuccess(organizationId: string, amount: number, reference: string) {
  const emails = await getOrgAdminEmails(organizationId);
  if (emails.length === 0) return;

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  sendTemplatedEmail("subscription-payment-success", emails, {
    organizationName: org?.name ?? "Your organization",
    amount: `$${amount.toFixed(2)}`,
    reference,
  }).catch((err) => logger.error("Failed to send subscription payment success email", { err }));
}

async function notifyPaymentFailed(organizationId: string) {
  const emails = await getOrgAdminEmails(organizationId);
  if (emails.length === 0) return;

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  sendTemplatedEmail("subscription-payment-failed", emails, {
    organizationName: org?.name ?? "Your organization",
  }).catch((err) => logger.error("Failed to send subscription payment failed email", { err }));
}

async function sendDunningEmail(organizationId: string, orgName: string, daysRemaining: number) {
  const emails = await getOrgAdminEmails(organizationId);
  if (emails.length === 0) return;

  sendTemplatedEmail("subscription-deactivation-warning", emails, {
    organizationName: orgName,
    daysRemaining: String(Math.max(daysRemaining, 1)),
  }).catch((err) => logger.error("Failed to send dunning email", { err }));
}

async function notifyDeactivation(organizationId: string, orgName: string) {
  const emails = await getOrgAdminEmails(organizationId);
  if (emails.length === 0) return;

  sendTemplatedEmail("subscription-deactivated", emails, {
    organizationName: orgName,
  }).catch((err) => logger.error("Failed to send deactivation email", { err }));
}
