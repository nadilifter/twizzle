import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature, extractHmacSignature, resolvePaymentType } from "@/lib/adyen";
import { processInvoiceRegistrations, type InvoiceMetadata } from "@/lib/invoice-processing";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { sendCheckoutReceiptEmail, sendPaymentFailedEmail } from "@/lib/email";
import { getSubdomainUrl } from "@/lib/env-domains";
import * as Sentry from "@sentry/nextjs";

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * POST /api/webhooks/adyen
 *
 * Handles Adyen webhook notifications for payment events:
 * - AUTHORISATION: Payment completed for site checkout invoices
 *
 * The `merchantReference` sent to Adyen during session creation is the invoice ID,
 * so we can look up the invoice directly from the notification.
 *
 * Configure this endpoint in Adyen Customer Area:
 * Account > Webhooks > Standard Notification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    if (!process.env.ADYEN_WEBHOOK_HMAC_KEY) {
      console.error("ADYEN_WEBHOOK_HMAC_KEY is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const notificationRequest = JSON.parse(body);
    const hmacSignature = extractHmacSignature(request.headers, notificationRequest);
    if (!hmacSignature) {
      console.error("Missing webhook HMAC signature");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    const isValid = verifyWebhookSignature(body, hmacSignature);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const notificationItem = notificationRequest.notificationItems?.[0]?.NotificationRequestItem;

    if (!notificationItem) {
      console.error("Invalid webhook payload - no notification item");
      return NextResponse.json({ notificationResponse: "[accepted]" }, { status: 200 });
    }

    const {
      eventCode,
      merchantReference,
      pspReference,
      success,
      amount,
      paymentMethod: paymentMethodType,
    } = notificationItem;

    logger.info("Adyen payment webhook received", {
      eventCode,
      merchantReference,
      pspReference,
      success,
    });

    const isSubscriptionPayment = merchantReference?.startsWith("SUB-INV-");

    if (eventCode === "AUTHORISATION" && isSubscriptionPayment) {
      await handleSubscriptionAuthorisation(
        merchantReference,
        pspReference,
        success === "true" || success === true
      );
    } else if (eventCode === "AUTHORISATION" && (success === "true" || success === true)) {
      await handleAuthorisation(
        merchantReference,
        pspReference,
        amount,
        paymentMethodType,
        request
      );
    } else if (eventCode === "AUTHORISATION" && success !== "true" && success !== true) {
      logger.info("Adyen webhook: payment authorisation failed", {
        merchantReference,
        pspReference,
      });
      await handleFailedAuthorisation(merchantReference);
    }

    if (eventCode === "CAPTURE" && (success === "true" || success === true)) {
      await handleCapture(pspReference);
    }

    if (eventCode === "REFUND" && (success === "true" || success === true)) {
      await handleRefund(notificationItem);
    }

    if (eventCode === "CHARGEBACK") {
      await handleChargeback(notificationItem);
    }

    if (eventCode === "REFUND_FAILED" || eventCode === "CAPTURE_FAILED") {
      await handleFailure(eventCode, notificationItem);
    }

    return NextResponse.json({ notificationResponse: "[accepted]" }, { status: 200 });
  } catch (error) {
    console.error("Payment webhook processing error:", error);
    Sentry.captureException(error);
    // Return 500 so Adyen retries — processing is idempotent so retries are safe.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

async function handleAuthorisation(
  invoiceId: string,
  pspReference: string,
  amount: { value: number; currency: string },
  paymentMethodType: string | undefined,
  _request: NextRequest
) {
  if (!invoiceId) {
    console.error("No merchantReference (invoiceId) in AUTHORISATION notification");
    return;
  }

  const invoice = await db.$transaction(async (tx) => {
    const existingTransaction = await tx.transaction.findUnique({
      where: { pspReference },
    });

    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lineItems: true,
        user: { select: { id: true, email: true, name: true } },
        organization: {
          select: {
            id: true,
            name: true,
            subscription: {
              select: {
                plan: {
                  select: { transactionFee: true, perTransactionFee: true },
                },
              },
            },
          },
        },
      },
    });

    if (!inv) {
      console.error(`Invoice not found: ${invoiceId}`);
      return null;
    }

    if (existingTransaction) {
      if (!inv.postPaymentProcessed) {
        logger.info("Transaction exists but registrations not yet processed, retrying", {
          pspReference,
        });
        return inv;
      }
      logger.info("Transaction already processed, skipping", { pspReference });
      return null;
    }

    if (inv.status === "PAID") {
      logger.info("Invoice already paid, skipping", { invoiceId });
      return null;
    }

    const paymentAmount = amount.value / 100;

    const payment = await tx.payment.create({
      data: {
        invoiceId: inv.id,
        userId: inv.userId || undefined,
        amount: paymentAmount,
        method: resolvePaymentType(paymentMethodType),
        status: "COMPLETED",
        processedAt: new Date(),
      },
    });

    const invPlan = inv.organization.subscription?.plan;
    await tx.transaction.create({
      data: {
        organizationId: inv.organizationId,
        paymentId: payment.id,
        pspReference,
        merchantRef: inv.reference,
        type: "PAYMENT",
        amount: paymentAmount,
        currency: amount.currency || "USD",
        status: "SETTLED",
        method: paymentMethodType || "card",
        description: `Online payment – ${inv.reference}`,
        settledAt: new Date(),
        feeRate: invPlan ? Number(invPlan.transactionFee) : null,
        feeFixed: invPlan ? Number(invPlan.perTransactionFee) : null,
      },
    });

    await tx.invoice.update({
      where: { id: inv.id },
      data: { status: "PAID" },
    });

    return inv;
  });

  if (!invoice) return;

  if (invoice.notes) {
    try {
      const metadata: InvoiceMetadata = JSON.parse(invoice.notes);

      const cartItems = invoice.lineItems
        .filter((li) => !li.productId && !li.discountId)
        .map((li) => ({
          referenceId:
            li.programId || li.membershipInstanceId || li.passId || li.competitionId || li.id,
          type: li.competitionId
            ? ("competition" as const)
            : li.membershipInstanceId
              ? ("membership" as const)
              : li.passId
                ? ("pass" as const)
                : ("program" as const),
          athleteId: li.athleteId || undefined,
          details: {
            programId: li.programId || undefined,
            membershipInstanceId: li.membershipInstanceId || undefined,
            passId: li.passId || undefined,
            competitionId: li.competitionId || undefined,
          },
        }));

      await processInvoiceRegistrations(
        metadata,
        cartItems,
        invoice.userId,
        invoice.organizationId
      );
    } catch (err) {
      console.error(`Failed to process registrations for invoice ${invoiceId}:`, err);
    }
  }

  // Process inventory for store product line items (atomic with row-level locking)
  const productLineItems = invoice.lineItems.filter((li) => li.productId);
  if (productLineItems.length > 0) {
    try {
      const productIds = productLineItems.map((li) => li.productId!);
      const variantIdsForLock = productLineItems
        .map((li) => li.productVariantId)
        .filter(Boolean) as string[];
      await db.$transaction(async (tx) => {
        const existingMovement = await tx.stockMovement.findFirst({
          where: { referenceId: invoice.id, type: "SALE" },
          select: { id: true },
        });
        if (existingMovement) return;

        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(productIds)}) FOR UPDATE`
        );
        if (variantIdsForLock.length > 0) {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "ProductVariant" WHERE id IN (${Prisma.join(variantIdsForLock)}) FOR UPDATE`
          );
        }
        for (const li of productLineItems) {
          if (li.productVariantId) {
            const variant = await tx.productVariant.findUnique({
              where: { id: li.productVariantId },
              select: { id: true, currentInventory: true },
            });
            if (variant && variant.currentInventory !== null) {
              const previousQty = variant.currentInventory;
              const newQty = Math.max(previousQty - li.quantity, 0);
              await tx.productVariant.update({
                where: { id: variant.id },
                data: { currentInventory: newQty },
              });
              await tx.stockMovement.create({
                data: {
                  productId: li.productId!,
                  productVariantId: li.productVariantId,
                  type: "SALE",
                  quantity: -li.quantity,
                  previousQty,
                  newQty,
                  referenceId: invoice.id,
                  notes: `Online Sale: ${invoice.reference}`,
                  createdBy: invoice.userId || undefined,
                },
              });
            }
          } else {
            const product = await tx.product.findUnique({
              where: { id: li.productId! },
              select: { id: true, currentInventory: true },
            });
            if (product && product.currentInventory !== null) {
              const previousQty = product.currentInventory;
              const newQty = Math.max(previousQty - li.quantity, 0);
              await tx.product.update({
                where: { id: product.id },
                data: { currentInventory: newQty },
              });
              await tx.stockMovement.create({
                data: {
                  productId: product.id,
                  type: "SALE",
                  quantity: -li.quantity,
                  previousQty,
                  newQty,
                  referenceId: invoice.id,
                  notes: `Online Sale: ${invoice.reference}`,
                  createdBy: invoice.userId || undefined,
                },
              });
            }
          }
        }
      });
    } catch (err) {
      console.error(`Failed to process inventory for invoice ${invoice.id}:`, err);
    }
  }

  await db.invoice.update({
    where: { id: invoice.id },
    data: { postPaymentProcessed: true },
  });

  // Send receipt email
  try {
    const siteConfig = await db.websiteConfig.findFirst({
      where: { organizationId: invoice.organizationId },
      select: { subdomain: true },
    });
    const receiptUrl = siteConfig?.subdomain
      ? `${getSubdomainUrl(siteConfig.subdomain)}/receipt/${invoice.id}`
      : null;
    await sendCheckoutReceiptEmail(invoice, receiptUrl);
  } catch (err) {
    console.error("Webhook: failed to send receipt email:", err);
  }

  logger.info("Payment processed for invoice", { invoiceId, pspReference });
}

async function handleFailedAuthorisation(invoiceId: string) {
  if (!invoiceId) return;

  try {
    const inv = await db.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          status: true,
          reference: true,
          user: { select: { email: true, name: true } },
        },
      });
      if (!inv || inv.status !== "DRAFT") return null;

      await tx.invoice.update({
        where: { id: inv.id },
        data: { status: "CANCELLED" },
      });
      await tx.order.updateMany({
        where: { invoiceId: inv.id, fulfillmentStatus: "PENDING" },
        data: { fulfillmentStatus: "CANCELLED" },
      });

      return inv;
    });

    if (inv) {
      logger.info("Cancelled DRAFT invoice and PENDING order after failed auth", { invoiceId });
      sendPaymentFailedEmail(inv).catch((err) =>
        console.error("Failed to send payment failed email:", err)
      );
    }
  } catch (err) {
    console.error(`Failed to cancel invoice/order after failed auth: ${invoiceId}`, err);
  }
}

async function handleCapture(pspReference: string) {
  const result = await db.transaction.updateMany({
    where: { pspReference, status: "AUTHORISED" },
    data: { status: "CAPTURED", settledAt: new Date() },
  });

  if (result.count > 0) {
    logger.info("Capture: transaction captured", { pspReference });
  } else {
    logger.info("Capture: no AUTHORISED transaction found (already captured or missing)", {
      pspReference,
    });
  }
}

async function handleRefund(notificationItem: any) {
  const { pspReference, originalReference, amount, merchantReference } = notificationItem;

  if (!originalReference) {
    console.error("[REFUND] Missing originalReference");
    return;
  }

  // Check if a PENDING refund transaction exists (created by our refund API)
  const existing = await db.transaction.findUnique({
    where: { pspReference },
  });
  if (existing) {
    if (existing.status === "PENDING") {
      await db.transaction.update({
        where: { id: existing.id },
        data: { status: "SETTLED", settledAt: new Date() },
      });
      logger.info("Refund: updated pending refund to settled", { pspReference });
    } else {
      logger.info("Refund: transaction already processed", { pspReference });
    }
    return;
  }

  // No existing record -- refund was initiated outside our API (e.g. Adyen dashboard).
  // Wrap in a transaction so the refund record + invoice status update are atomic.
  try {
    await db.$transaction(async (tx) => {
      const originalTx = await tx.transaction.findUnique({
        where: { pspReference: originalReference },
        include: { payment: { include: { invoice: true } } },
      });

      if (!originalTx) {
        console.error(`[REFUND] Original transaction not found: ${originalReference}`);
        return;
      }

      const refundAmount = amount?.value ? Number(amount.value) / 100 : 0;

      await tx.transaction.create({
        data: {
          organizationId: originalTx.organizationId,
          pspReference,
          merchantRef: merchantReference || originalTx.merchantRef,
          type: "REFUND",
          amount: -refundAmount,
          currency: amount?.currency || "USD",
          status: "SETTLED",
          method: originalTx.method,
          description: `Refund for ${originalTx.merchantRef || originalReference}`,
          metadata: { originalPspReference: originalReference },
          settledAt: new Date(),
        },
      });

      if (originalTx.paymentId && originalTx.payment?.invoiceId) {
        const invoiceTotal = Number(originalTx.payment.invoice?.total || 0);
        if (refundAmount >= invoiceTotal) {
          await tx.invoice.update({
            where: { id: originalTx.payment.invoiceId },
            data: { status: "CANCELLED" },
          });
        }
      }

      logger.info("Refund processed", { pspReference, originalReference });
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      logger.info("Refund: duplicate webhook (pspReference already exists)", { pspReference });
      return;
    }
    throw error;
  }
}

async function handleChargeback(notificationItem: any) {
  const { pspReference, originalReference, amount, merchantReference } = notificationItem;

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({
        where: { pspReference },
      });
      if (existing) {
        logger.info("Chargeback: transaction already processed", { pspReference });
        return;
      }

      const originalTx = originalReference
        ? await tx.transaction.findUnique({ where: { pspReference: originalReference } })
        : null;

      const organizationId = originalTx?.organizationId;
      if (!organizationId) {
        console.error(`[CHARGEBACK] Cannot determine organization for ${pspReference}`);
        return;
      }

      const chargebackAmount = amount?.value ? Number(amount.value) / 100 : 0;

      await tx.transaction.create({
        data: {
          organizationId,
          pspReference,
          merchantRef: merchantReference || originalTx?.merchantRef,
          type: "CHARGEBACK",
          amount: -chargebackAmount,
          currency: amount?.currency || "USD",
          status: "SETTLED",
          method: originalTx?.method,
          description: `Chargeback for ${originalTx?.merchantRef || originalReference}`,
          settledAt: new Date(),
        },
      });

      logger.info("Chargeback processed", { pspReference, originalReference });
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      logger.info("Chargeback: duplicate webhook (pspReference already exists)", { pspReference });
      return;
    }
    throw error;
  }
}

async function handleFailure(eventCode: string, notificationItem: any) {
  const { pspReference, originalReference } = notificationItem;

  console.error(`[${eventCode}] Payment failure`, {
    pspReference,
    originalReference,
    reason: notificationItem.reason,
  });

  if (originalReference) {
    const tx = await db.transaction.findUnique({
      where: { pspReference: originalReference },
    });
    if (tx && tx.status !== "SETTLED") {
      await db.transaction.update({
        where: { id: tx.id },
        data: { status: "ERROR" },
      });
    }
  }
}

/**
 * Handle Adyen webhook for subscription invoice payments.
 * The merchantReference on subscription payments uses the format:
 *   SUB-INV-YYYY-MM-slug-attempt-N
 * We extract the invoice reference (everything before "-attempt-") and update
 * the corresponding SubscriptionPaymentAttempt record.
 */
async function handleSubscriptionAuthorisation(
  merchantReference: string,
  pspReference: string,
  success: boolean
) {
  const attemptSuffix = merchantReference.match(/-attempt-(\d+)$/);
  const invoiceRef = attemptSuffix
    ? merchantReference.replace(/-attempt-\d+$/, "")
    : merchantReference;

  const invoice = await db.subscriptionInvoice.findUnique({
    where: { reference: invoiceRef },
  });

  if (!invoice) {
    logger.info("Subscription webhook: invoice not found for reference", {
      merchantReference,
      invoiceRef,
    });
    return;
  }

  if (pspReference) {
    await db.subscriptionPaymentAttempt.updateMany({
      where: {
        subscriptionInvoiceId: invoice.id,
        pspReference,
      },
      data: {
        status: success ? "SUCCESS" : "FAILED",
        failureReason: success ? null : "Declined via webhook",
      },
    });
  }

  if (success && invoice.status !== "PAID") {
    await db.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: { status: "PAID", paidAt: new Date() },
    });

    await db.organization.update({
      where: { id: invoice.organizationId },
      data: {
        scheduledDeactivationDate: null,
        dunningWarningsSent: Prisma.DbNull,
      },
    });
    await db.organizationSubscription.updateMany({
      where: { organizationId: invoice.organizationId, status: "PAST_DUE" },
      data: { status: "ACTIVE" },
    });

    logger.info("Subscription payment confirmed via webhook", {
      invoiceId: invoice.id,
      pspReference,
    });
  }

  if (!success) {
    logger.info("Subscription payment failed via webhook", {
      invoiceId: invoice.id,
      pspReference,
    });
  }
}
