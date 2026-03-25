import { db } from "@/lib/db"
import { chargeSubscription } from "@/lib/adyen"
import { addMonths, addYears } from "date-fns"
import { getTodayNoonUTC, normalizeToNoonUTC } from "@/lib/date-utils"
import type { Decimal } from "@prisma/client/runtime/library"

export interface RecurringChargeWithRelations {
  id: string
  organizationId: string
  userId: string | null
  athleteId: string | null
  description: string
  amount: Decimal
  frequency: string
  nextChargeDate: Date
  paymentMethodId: string | null
  athletePassId: string | null
  athleteMembershipId: string | null
  enrollmentId: string | null
  paymentMethod: {
    id: string
    type: string
    last4: string
    brand: string | null
    adyenTokenId: string | null
    shopperReference: string | null
  } | null
}

export interface ChargeResult {
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
  // Deterministic reference per billing period prevents double-charging
  // if the cron fires twice on the same day.
  const chargeDateStr = charge.nextChargeDate.toISOString().split("T")[0]
  const reference = `recurring-${charge.id}-${chargeDateStr}`

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
          dueDate: getTodayNoonUTC(),
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

/**
 * Extend the entitlement period linked to a recurring charge after a successful payment.
 * - AthletePass: rolls endDate forward by the billing interval
 * - AthleteMembership: rolls endDate forward by the billing interval
 * - Enrollment: no date change needed (enrollment is ongoing while charges succeed)
 * - No product link (admin-created charge): no-op
 */
export async function extendEntitlement(
  charge: Pick<RecurringChargeWithRelations, "id" | "organizationId" | "frequency" | "athletePassId" | "athleteMembershipId" | "enrollmentId">
): Promise<void> {
  if (charge.athletePassId) {
    const athletePass = await db.athletePass.findFirst({
      where: { id: charge.athletePassId, pass: { organizationId: charge.organizationId } },
      select: { id: true, endDate: true, status: true },
    })
    if (athletePass?.endDate) {
      const newEnd = normalizeToNoonUTC(
        charge.frequency === "YEARLY"
          ? addYears(athletePass.endDate, 1)
          : addMonths(athletePass.endDate, 1)
      )!
      await db.athletePass.update({
        where: { id: athletePass.id },
        data: { endDate: newEnd, status: "ACTIVE" },
      })
    }
  } else if (charge.athleteMembershipId) {
    const membership = await db.athleteMembership.findFirst({
      where: { id: charge.athleteMembershipId, instance: { group: { organizationId: charge.organizationId } } },
      select: { id: true, endDate: true, status: true },
    })
    if (membership?.endDate) {
      const newEnd = normalizeToNoonUTC(
        charge.frequency === "YEARLY"
          ? addYears(membership.endDate, 1)
          : addMonths(membership.endDate, 1)
      )!
      await db.athleteMembership.update({
        where: { id: membership.id },
        data: { endDate: newEnd, status: "ACTIVE" },
      })
    }
  }
}

/**
 * Suspend the entitlement linked to a recurring charge after all retries are exhausted.
 * The suspension is reversible -- if the guardian updates their payment method and pays,
 * extendEntitlement will reactivate the entitlement.
 */
export async function suspendEntitlement(
  charge: Pick<RecurringChargeWithRelations, "id" | "organizationId" | "athletePassId" | "athleteMembershipId" | "enrollmentId">
): Promise<void> {
  if (charge.athletePassId) {
    const verified = await db.athletePass.findFirst({
      where: { id: charge.athletePassId, pass: { organizationId: charge.organizationId } },
      select: { id: true },
    })
    if (verified) {
      await db.athletePass.update({
        where: { id: verified.id },
        data: { status: "EXPIRED" },
      })
    }
  } else if (charge.athleteMembershipId) {
    const verified = await db.athleteMembership.findFirst({
      where: { id: charge.athleteMembershipId, instance: { group: { organizationId: charge.organizationId } } },
      select: { id: true },
    })
    if (verified) {
      await db.athleteMembership.update({
        where: { id: verified.id },
        data: { status: "EXPIRED" },
      })
    }
  } else if (charge.enrollmentId) {
    const verified = await db.enrollment.findFirst({
      where: { id: charge.enrollmentId, program: { organizationId: charge.organizationId } },
      select: { id: true },
    })
    if (verified) {
      await db.enrollment.update({
        where: { id: verified.id },
        data: { status: "PAUSED" },
      })
    }
  }
}

/**
 * Check if a product-linked recurring charge should be terminated.
 * Returns true if the linked entity has been cancelled, completed, or deleted.
 */
export async function shouldTerminateCharge(
  charge: Pick<RecurringChargeWithRelations, "organizationId" | "enrollmentId" | "athletePassId" | "athleteMembershipId">
): Promise<boolean> {
  if (charge.enrollmentId) {
    const enrollment = await db.enrollment.findFirst({
      where: { id: charge.enrollmentId, program: { organizationId: charge.organizationId } },
      select: { status: true, endDate: true },
    })
    if (!enrollment) return true
    if (enrollment.status === "CANCELLED" || enrollment.status === "COMPLETED") return true
    if (enrollment.endDate && enrollment.endDate < new Date()) return true
  }
  if (charge.athletePassId) {
    const pass = await db.athletePass.findFirst({
      where: { id: charge.athletePassId, pass: { organizationId: charge.organizationId } },
      select: { status: true },
    })
    if (!pass) return true
    if (pass.status === "CANCELLED" || pass.status === "ARCHIVED") return true
  }
  if (charge.athleteMembershipId) {
    const membership = await db.athleteMembership.findFirst({
      where: { id: charge.athleteMembershipId, instance: { group: { organizationId: charge.organizationId } } },
      select: { status: true },
    })
    if (!membership) return true
    if (membership.status === "CANCELLED" || membership.status === "ARCHIVED") return true
  }
  return false
}
