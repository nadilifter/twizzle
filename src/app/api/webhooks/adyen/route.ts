import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyWebhookSignature } from "@/lib/adyen"
import { processInvoiceRegistrations, type InvoiceMetadata } from "@/lib/invoice-processing"
import { sendTemplatedEmail } from "@/lib/email"

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

    const hmacSignature = request.headers.get("hmac-signature") || ""
    if (process.env.ADYEN_WEBHOOK_HMAC_KEY && hmacSignature) {
      const isValid = verifyWebhookSignature(body, hmacSignature)
      if (!isValid) {
        console.error("Invalid webhook signature")
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
      }
    }

    const notificationRequest = JSON.parse(body)
    const notificationItem = notificationRequest.notificationItems?.[0]?.NotificationRequestItem

    if (!notificationItem) {
      console.error("Invalid webhook payload - no notification item")
      return NextResponse.json({ "[accepted]": true })
    }

    const {
      eventCode,
      merchantReference,
      pspReference,
      success,
      amount,
      paymentMethod: paymentMethodType,
    } = notificationItem

    console.log(`Processing Adyen payment webhook: ${eventCode}`, {
      merchantReference,
      pspReference,
      success,
    })

    if (eventCode === "AUTHORISATION" && (success === "true" || success === true)) {
      await handleAuthorisation(merchantReference, pspReference, amount, paymentMethodType, request)
    }

    if (eventCode === "AUTHORISATION" && success !== "true" && success !== true) {
      console.log(`Payment failed for invoice ${merchantReference}: pspReference=${pspReference}`)
    }

    return NextResponse.json({ "[accepted]": true })
  } catch (error) {
    console.error("Payment webhook processing error:", error)
    return NextResponse.json({ "[accepted]": true })
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
    console.log(`Transaction ${pspReference} already processed, skipping`)
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
    console.log(`Invoice ${invoiceId} already paid, skipping`)
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
        referenceId: li.programId || li.membershipInstanceId || li.competitionId || li.id,
        type: li.competitionId ? "competition" : li.membershipInstanceId ? "membership" : "program",
        athleteId: li.athleteId || undefined,
        details: {
          programId: li.programId || undefined,
          membershipInstanceId: li.membershipInstanceId || undefined,
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
      const protocol = request.headers.get("x-forwarded-proto") || "https"
      const host = request.headers.get("host")

      const config = await db.websiteConfig.findFirst({
        where: { organizationId: invoice.organizationId },
        select: { subdomain: true },
      })
      const slug = config?.subdomain || ""
      const receiptUrl = `${protocol}://${host}/sites/${slug}/receipt/${invoice.id}`

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

  console.log(`Payment processed for invoice ${invoiceId}: pspReference=${pspReference}`)
}
