import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyWebhookSignature } from "@/lib/adyen"
import { processInvoiceRegistrations, type InvoiceMetadata } from "@/lib/invoice-processing"
import { sendTemplatedEmail } from "@/lib/email"
import { getSubdomainUrl } from "@/lib/env-domains"
import { logger } from "@/lib/logger"

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

  // Prevent duplicate processing
  const existingTransaction = await db.transaction.findUnique({
    where: { pspReference },
  })
  if (existingTransaction) {
    logger.info("Transaction already processed, skipping", { pspReference })
    return
  }

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lineItems: true,
      user: { select: { id: true, email: true, name: true } },
      organization: { select: { id: true, name: true } },
    },
  })

  if (!invoice) {
    console.error(`Invoice not found: ${invoiceId}`)
    return
  }

  if (invoice.status === "PAID") {
    logger.info("Invoice already paid, skipping", { invoiceId })
    return
  }

  const paymentAmount = amount.value / 100

  const payment = await db.payment.create({
    data: {
      invoiceId: invoice.id,
      userId: invoice.userId || undefined,
      amount: paymentAmount,
      method: "CARD",
      status: "COMPLETED",
      processedAt: new Date(),
    },
  })

  await db.transaction.create({
    data: {
      organizationId: invoice.organizationId,
      paymentId: payment.id,
      pspReference,
      merchantRef: invoice.reference,
      type: "PAYMENT",
      amount: paymentAmount,
      currency: amount.currency || "USD",
      status: "SETTLED",
      method: paymentMethodType || "card",
      description: `Online payment – ${invoice.reference}`,
      settledAt: new Date(),
    },
  })

  await db.invoice.update({
    where: { id: invoice.id },
    data: { status: "PAID" },
  })

  // Process registrations from invoice metadata
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

async function handleCapture(pspReference: string) {
  const transaction = await db.transaction.findUnique({
    where: { pspReference },
  })

  if (!transaction) {
    logger.info("Capture: transaction not found", { pspReference })
    return
  }

  if (transaction.status === "AUTHORISED") {
    await db.transaction.update({
      where: { id: transaction.id },
      data: { status: "CAPTURED", settledAt: new Date() },
    })
    logger.info("Capture: transaction captured", { pspReference })
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

  // No existing record -- refund was initiated outside our API (e.g. Adyen dashboard)
  const originalTx = await db.transaction.findUnique({
    where: { pspReference: originalReference },
  })

  if (!originalTx) {
    console.error(`[REFUND] Original transaction not found: ${originalReference}`)
    return
  }

  const refundAmount = amount?.value ? Number(amount.value) / 100 : 0

  await db.transaction.create({
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

  // Update invoice status if fully refunded
  if (originalTx.paymentId) {
    const payment = await db.payment.findUnique({
      where: { id: originalTx.paymentId },
      include: { invoice: true },
    })

    if (payment?.invoiceId) {
      const invoiceTotal = Number(payment.invoice?.total || 0)
      if (refundAmount >= invoiceTotal) {
        await db.invoice.update({
          where: { id: payment.invoiceId },
          data: { status: "CANCELLED" },
        })
      }
    }
  }

  logger.info("Refund processed", { pspReference, originalReference })
}

async function handleChargeback(notificationItem: any) {
  const {
    pspReference,
    originalReference,
    amount,
    merchantReference,
  } = notificationItem

  // Prevent duplicate processing
  const existing = await db.transaction.findUnique({
    where: { pspReference },
  })
  if (existing) {
    logger.info("Chargeback: transaction already processed", { pspReference })
    return
  }

  const originalTx = originalReference
    ? await db.transaction.findUnique({ where: { pspReference: originalReference } })
    : null

  const organizationId = originalTx?.organizationId
  if (!organizationId) {
    console.error(`[CHARGEBACK] Cannot determine organization for ${pspReference}`)
    return
  }

  const chargebackAmount = amount?.value ? Number(amount.value) / 100 : 0

  await db.transaction.create({
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
