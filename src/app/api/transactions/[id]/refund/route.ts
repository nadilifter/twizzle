import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth"
import { refundPayment } from "@/lib/adyen-platform"

/**
 * POST /api/transactions/[id]/refund
 *
 * Initiate a refund for a completed payment transaction.
 * Supports full and partial refunds. The refund Transaction is created
 * with status PENDING and updated to SETTLED when the Adyen REFUND webhook arrives.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const permissions = session.user.permissions ?? []
    if (
      !permissions.includes("*") &&
      !permissions.includes("financials.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { amount: requestedAmount, reason } = body as {
      amount?: number
      reason?: string
    }

    const transaction = await db.transaction.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: { payment: { include: { invoice: true } } },
    })

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      )
    }

    if (transaction.organizationId !== session.user.organizationId) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      )
    }

    if (transaction.type !== "PAYMENT") {
      return NextResponse.json(
        { error: "Only payment transactions can be refunded" },
        { status: 400 }
      )
    }

    if (transaction.status !== "SETTLED" && transaction.status !== "CAPTURED") {
      return NextResponse.json(
        { error: "Transaction must be settled or captured to refund" },
        { status: 400 }
      )
    }

    // Check for existing refunds against this transaction
    const existingRefunds = await db.transaction.findMany({
      where: {
        type: "REFUND",
        metadata: { path: ["originalPspReference"], equals: transaction.pspReference },
      },
      select: { amount: true, status: true },
    })

    const totalRefunded = existingRefunds.reduce(
      (sum, r) => sum + Math.abs(Number(r.amount)),
      0
    )
    const originalAmount = Number(transaction.amount)

    const refundAmount = requestedAmount ?? originalAmount - totalRefunded
    if (refundAmount <= 0) {
      return NextResponse.json(
        { error: "Transaction has already been fully refunded" },
        { status: 400 }
      )
    }

    if (refundAmount > originalAmount - totalRefunded) {
      return NextResponse.json(
        {
          error: `Refund amount ($${refundAmount.toFixed(2)}) exceeds remaining refundable amount ($${(originalAmount - totalRefunded).toFixed(2)})`,
        },
        { status: 400 }
      )
    }

    const isFullRefund = refundAmount >= originalAmount - totalRefunded

    const merchantAccount = process.env.ADYEN_MERCHANT_ACCOUNT
    if (!merchantAccount) {
      return NextResponse.json(
        { error: "Payment provider not configured" },
        { status: 503 }
      )
    }
    const refundRef = `refund-${transaction.pspReference}-${Date.now()}`

    const response = await refundPayment(
      transaction.pspReference,
      {
        value: Math.round(refundAmount * 100),
        currency: transaction.currency,
      },
      merchantAccount,
      refundRef
    )

    const refundTx = await db.transaction.create({
      data: {
        organizationId: transaction.organizationId,
        pspReference: response.pspReference,
        merchantRef: transaction.merchantRef,
        type: "REFUND",
        amount: -refundAmount,
        currency: transaction.currency,
        status: "PENDING",
        method: transaction.method,
        description: `Refund – ${transaction.merchantRef || transaction.pspReference}${reason ? ` (${reason})` : ""}`,
        metadata: {
          originalPspReference: transaction.pspReference,
          reason: reason || null,
        },
      },
    })

    if (isFullRefund && transaction.paymentId) {
      const payment = transaction.payment
      if (payment?.invoiceId) {
        await db.payment.update({
          where: {
            id: payment.id,
            invoice: { organizationId: session.user.organizationId },
          },
          data: { status: "REFUNDED" },
        })
        await db.invoice.update({
          where: {
            id: payment.invoiceId,
            organizationId: session.user.organizationId,
          },
          data: { status: "CANCELLED" },
        })
      }
    }

    return NextResponse.json(refundTx)
  } catch (error: any) {
    console.error("Refund API error:", error)
    const message =
      error.responseBody?.message || error.message || "Refund failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
