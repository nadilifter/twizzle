import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyWebhookSignature } from "@/lib/adyen"
import { processInvoiceRegistrations, type InvoiceMetadata } from "@/lib/invoice-processing"
import { sendTemplatedEmail } from "@/lib/email"
import { getSubdomainUrl } from "@/lib/env-domains"
import { logger } from "@/lib/logger"
import { Prisma } from "@prisma/client"

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
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
    const body = await request.text()

    if (!process.env.ADYEN_WEBHOOK_HMAC_KEY) {
      console.error("ADYEN_WEBHOOK_HMAC_KEY is not configured")
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
    }

    const hmacSignature = request.headers.get("hmac-signature") || ""
    if (!hmacSignature) {
      console.error("Missing webhook HMAC signature header")
      return NextResponse.json({ error: "Missing signature" }, { status: 401 })
    }
    const isValid = verifyWebhookSignature(body, hmacSignature)
    if (!isValid) {
      console.error("Invalid webhook signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const notificationRequest = JSON.parse(body)
    const notificationItem = notificationRequest.notificationItems?.[0]?.NotificationRequestItem

    if (!notificationItem) {
      console.error("Invalid webhook payload - no notification item")
      return NextResponse.json({ notificationResponse: "[accepted]" })
    }

    const {
      eventCode,
      merchantReference,
      pspReference,
      success,
      amount,
      paymentMethod: paymentMethodType,
    } = notificationItem

    logger.info("Adyen payment webhook received", {
      eventCode,
      merchantReference,
      pspReference,
      success,
    })

    if (eventCode === "AUTHORISATION" && (success === "true" || success === true)) {
      await handleAuthorisation(merchantReference, pspReference, amount, paymentMethodType, request)
    }

    if (eventCode === "AUTHORISATION" && success !== "true" && success !== true) {
      logger.info("Adyen webhook: payment authorisation failed", { merchantReference, pspReference })
      await handleFailedAuthorisation(merchantReference)
    }

    if (eventCode === "CAPTURE" && (success === "true" || success === true)) {
      await handleCapture(pspReference)
    }

    if (eventCode === "REFUND" && (success === "true" || success === true)) {
      await handleRefund(notificationItem)
    }

    if (eventCode === "CHARGEBACK") {
      await handleChargeback(notificationItem)
    }

    if (eventCode === "REFUND_FAILED" || eventCode === "CAPTURE_FAILED") {
      await handleFailure(eventCode, notificationItem)
    }

    return NextResponse.json({ notificationResponse: "[accepted]" })
  } catch (error) {
    console.error("Payment webhook processing error:", error)
    return NextResponse.json({ notificationResponse: "[accepted]" })
  }
}

async function handleAuthorisation(
  invoiceId: string,
  pspReference: string,
  amount: { value: number; currency: string },
  paymentMethodType: string | undefined,
  request: NextRequest,
) {
  if (!invoiceId) {
    console.error("No merchantReference (invoiceId) in AUTHORISATION notification")
    return
  }

  const invoice = await db.$transaction(async (tx) => {
    const existingTransaction = await tx.transaction.findUnique({
      where: { pspReference },
    })

    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lineItems: true,
        user: { select: { id: true, email: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
    })

    if (!inv) {
      console.error(`Invoice not found: ${invoiceId}`)
      return null
    }

    if (existingTransaction) {
      // Payment already recorded. If registrations weren't processed
      // (e.g. crash on a previous attempt), return the invoice so the
      // registration step below can retry.
      if (!inv.registrationsProcessed) {
        logger.info("Transaction exists but registrations not yet processed, retrying", { pspReference })
        return inv
      }
      logger.info("Transaction already processed, skipping", { pspReference })
      return null
    }

    if (inv.status === "PAID") {
      logger.info("Invoice already paid, skipping", { invoiceId })
      return null
    }

    const paymentAmount = amount.value / 100

    const payment = await tx.payment.create({
      data: {
        invoiceId: inv.id,
        userId: inv.userId || undefined,
        amount: paymentAmount,
        method: "CARD",
        status: "COMPLETED",
        processedAt: new Date(),
      },
    })

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
      },
    })

    await tx.invoice.update({
      where: { id: inv.id },
      data: { status: "PAID" },
    })

    return inv
  })

  if (!invoice) return

  if (invoice.notes) {
    try {
      const metadata: InvoiceMetadata = JSON.parse(invoice.notes)

      const cartItems = invoice.lineItems.map((li) => ({
        referenceId: li.programId || li.membershipInstanceId || li.passId || li.competitionId || li.id,
        type: li.competitionId ? "competition" : li.membershipInstanceId ? "membership" : li.passId ? "pass" : "program",
        athleteId: li.athleteId || undefined,
        details: {
          programId: li.programId || undefined,
          membershipInstanceId: li.membershipInstanceId || undefined,
          passId: li.passId || undefined,
          competitionId: li.competitionId || undefined,
        },
      }))

      await processInvoiceRegistrations(
        metadata,
        cartItems,
        invoice.userId,
        invoice.organizationId,
      )
    } catch (err) {
      console.error(`Failed to process registrations for invoice ${invoiceId}:`, err)
    }
  }

  // Process inventory for store product line items (atomic with row-level locking)
  const productLineItems = invoice.lineItems.filter((li) => li.productId)
  if (productLineItems.length > 0) {
    try {
      const productIds = productLineItems.map((li) => li.productId!)
      await db.$transaction(async (tx) => {
        const existingMovement = await tx.stockMovement.findFirst({
          where: { referenceId: invoice.id, type: "SALE" },
          select: { id: true },
        })
        if (existingMovement) return

        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(productIds)}) FOR UPDATE`
        )
        for (const li of productLineItems) {
          const product = await tx.product.findUnique({
            where: { id: li.productId! },
            select: { id: true, currentInventory: true },
          })
          if (product && product.currentInventory !== null) {
            const previousQty = product.currentInventory
            const newQty = Math.max(previousQty - li.quantity, 0)
            await tx.product.update({
              where: { id: product.id },
              data: { currentInventory: newQty },
            })
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
            })
          }
        }
      })
    } catch (err) {
      console.error(`Failed to process inventory for invoice ${invoice.id}:`, err)
    }
  }

  await db.invoice.update({
    where: { id: invoice.id },
    data: { registrationsProcessed: true },
  })

  // Send receipt email
  try {
    const recipientEmail = invoice.user?.email
    const recipientName = invoice.user?.name?.split(" ")[0]

    if (recipientEmail) {
      const config = await db.websiteConfig.findFirst({
        where: { organizationId: invoice.organizationId },
        select: { subdomain: true },
      })
      const slug = config?.subdomain || ""
      const receiptUrl = `${getSubdomainUrl(slug)}/receipt/${invoice.id}`

      const lineItemsHtml = invoice.lineItems
        .map((li) =>
          `<tr><td style="padding: 4px 0;">${li.description}</td><td style="padding: 4px 0; text-align: right;">$${Number(li.total).toFixed(2)}</td></tr>`
        )
        .join("")
      const lineItemsText = invoice.lineItems
        .map((li) => `${li.description} — $${Number(li.total).toFixed(2)}`)
        .join("\n")

      sendTemplatedEmail("checkout-receipt", [recipientEmail], {
        name: recipientName || "Customer",
        reference: invoice.reference,
        total: `$${Number(invoice.total).toFixed(2)}`,
        lineItemsHtml,
        lineItemsText,
        receiptUrl,
      }).catch((err) => console.error("Failed to send receipt email:", err))
    }
  } catch (err) {
    console.error("Error sending receipt email:", err)
  }

  logger.info("Payment processed for invoice", { invoiceId, pspReference })
}

async function handleFailedAuthorisation(invoiceId: string) {
  if (!invoiceId) return

  try {
    await db.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, status: true },
      })
      if (!inv || inv.status !== "DRAFT") return

      await tx.invoice.update({
        where: { id: inv.id },
        data: { status: "CANCELLED" },
      })
      await tx.order.updateMany({
        where: { invoiceId: inv.id, fulfillmentStatus: "PENDING" },
        data: { fulfillmentStatus: "CANCELLED" },
      })
    })
    logger.info("Cancelled DRAFT invoice and PENDING order after failed auth", { invoiceId })
  } catch (err) {
    console.error(`Failed to cancel invoice/order after failed auth: ${invoiceId}`, err)
  }
}

async function handleCapture(pspReference: string) {
  const result = await db.transaction.updateMany({
    where: { pspReference, status: "AUTHORISED" },
    data: { status: "CAPTURED", settledAt: new Date() },
  })

  if (result.count > 0) {
    logger.info("Capture: transaction captured", { pspReference })
  } else {
    logger.info("Capture: no AUTHORISED transaction found (already captured or missing)", { pspReference })
  }
}

async function handleRefund(notificationItem: any) {
  const {
    pspReference,
    originalReference,
    amount,
    merchantReference,
  } = notificationItem

  if (!originalReference) {
    console.error("[REFUND] Missing originalReference")
    return
  }

  // Check if a PENDING refund transaction exists (created by our refund API)
  const existing = await db.transaction.findUnique({
    where: { pspReference },
  })
  if (existing) {
    if (existing.status === "PENDING") {
      await db.transaction.update({
        where: { id: existing.id },
        data: { status: "SETTLED", settledAt: new Date() },
      })
      logger.info("Refund: updated pending refund to settled", { pspReference })
    } else {
      logger.info("Refund: transaction already processed", { pspReference })
    }
    return
  }

  // No existing record -- refund was initiated outside our API (e.g. Adyen dashboard).
  // Wrap in a transaction so the refund record + invoice status update are atomic.
  try {
    await db.$transaction(async (tx) => {
      const originalTx = await tx.transaction.findUnique({
        where: { pspReference: originalReference },
        include: { payment: { include: { invoice: true } } },
      })

      if (!originalTx) {
        console.error(`[REFUND] Original transaction not found: ${originalReference}`)
        return
      }

      const refundAmount = amount?.value ? Number(amount.value) / 100 : 0

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
      })

      if (originalTx.paymentId && originalTx.payment?.invoiceId) {
        const invoiceTotal = Number(originalTx.payment.invoice?.total || 0)
        if (refundAmount >= invoiceTotal) {
          await tx.invoice.update({
            where: { id: originalTx.payment.invoiceId },
            data: { status: "CANCELLED" },
          })
        }
      }

      logger.info("Refund processed", { pspReference, originalReference })
    })
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      logger.info("Refund: duplicate webhook (pspReference already exists)", { pspReference })
      return
    }
    throw error
  }
}

async function handleChargeback(notificationItem: any) {
  const {
    pspReference,
    originalReference,
    amount,
    merchantReference,
  } = notificationItem

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({
        where: { pspReference },
      })
      if (existing) {
        logger.info("Chargeback: transaction already processed", { pspReference })
        return
      }

      const originalTx = originalReference
        ? await tx.transaction.findUnique({ where: { pspReference: originalReference } })
        : null

      const organizationId = originalTx?.organizationId
      if (!organizationId) {
        console.error(`[CHARGEBACK] Cannot determine organization for ${pspReference}`)
        return
      }

      const chargebackAmount = amount?.value ? Number(amount.value) / 100 : 0

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
      })

      logger.info("Chargeback processed", { pspReference, originalReference })
    })
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      logger.info("Chargeback: duplicate webhook (pspReference already exists)", { pspReference })
      return
    }
    throw error
  }
}

async function handleFailure(eventCode: string, notificationItem: any) {
  const { pspReference, originalReference } = notificationItem

  console.error(`[${eventCode}] Payment failure`, {
    pspReference,
    originalReference,
    reason: notificationItem.reason,
  })

  if (originalReference) {
    const tx = await db.transaction.findUnique({
      where: { pspReference: originalReference },
    })
    if (tx && tx.status !== "SETTLED") {
      await db.transaction.update({
        where: { id: tx.id },
        data: { status: "ERROR" },
      })
    }
  }
}
