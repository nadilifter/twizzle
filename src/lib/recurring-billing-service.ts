import { db } from "@/lib/db"
import { chargeSubscription } from "@/lib/adyen"
import type { Decimal } from "@prisma/client/runtime/library"

interface RecurringChargeWithRelations {
  id: string
  organizationId: string
  userId: string | null
  athleteId: string | null
  description: string
  amount: Decimal
  frequency: string
  nextChargeDate: Date
  paymentMethodId: string | null
  paymentMethod: {
    id: string
    type: string
    last4: string
    brand: string | null
    adyenTokenId: string | null
    shopperReference: string | null
  } | null
}

interface ChargeResult {
  success: boolean
  pspReference?: string
  error?: string
  invoiceId?: string
  transactionId?: string
}

export async function executeRecurringCharge(
  charge: RecurringChargeWithRelations,
  organizationId: string
): Promise<ChargeResult> {
  if (!charge.paymentMethodId || !charge.paymentMethod) {
    return { success: false, error: "No payment method" }
  }

  const { adyenTokenId, shopperReference } = charge.paymentMethod
  if (!adyenTokenId || !shopperReference) {
    return { success: false, error: "Payment method missing Adyen token" }
  }

  const amountDollars = Number(charge.amount)
  const reference = `recurring-${charge.id}-${Date.now()}`

  try {
    const response = await chargeSubscription(
      shopperReference,
      adyenTokenId,
      amountDollars,
      reference,
      charge.description
    )

    if (response.resultCode !== "Authorised") {
      return {
        success: false,
        error: response.refusalReason || `Payment ${response.resultCode}`,
      }
    }

    const pspReference: string = response.pspReference

    // Create invoice, line item, payment, and transaction in a single transaction
    const result = await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          userId: charge.userId,
          reference: `REC-${charge.id.slice(-8)}-${Date.now()}`,
          status: "PAID",
          dueDate: new Date(),
          subtotal: amountDollars,
          total: amountDollars,
          notes: JSON.stringify({ recurringChargeId: charge.id }),
        },
      })

      await tx.lineItem.create({
        data: {
          invoiceId: invoice.id,
          description: charge.description,
          quantity: 1,
          unitPrice: amountDollars,
          total: amountDollars,
        },
      })

      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          userId: charge.userId || undefined,
          amount: amountDollars,
          method: "CARD",
          status: "COMPLETED",
          processedAt: new Date(),
        },
      })

      const transaction = await tx.transaction.create({
        data: {
          organizationId,
          paymentId: payment.id,
          pspReference,
          merchantRef: invoice.reference,
          type: "PAYMENT",
          amount: amountDollars,
          currency: "USD",
          status: "SETTLED",
          method: charge.paymentMethod!.brand || "card",
          description: `Recurring charge – ${charge.description}`,
          settledAt: new Date(),
        },
      })

      return { invoiceId: invoice.id, transactionId: transaction.id }
    })

    return {
      success: true,
      pspReference,
      invoiceId: result.invoiceId,
      transactionId: result.transactionId,
    }
  } catch (error: any) {
    console.error(`executeRecurringCharge failed for charge ${charge.id}:`, error)
    return {
      success: false,
      error: error.responseBody?.message || error.message || "Unknown error",
    }
  }
}
