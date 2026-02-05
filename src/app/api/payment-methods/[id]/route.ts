import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { disableStoredPaymentMethod } from "@/lib/adyen"

/**
 * DELETE /api/payment-methods/[id]
 * 
 * Delete (disable) a payment method for the current organization
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Find the payment method and verify ownership
    const paymentMethod = await db.organizationPaymentMethod.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
        isActive: true,
      },
    })

    if (!paymentMethod) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 })
    }

    // Disable in Adyen
    try {
      await disableStoredPaymentMethod(
        paymentMethod.shopperReference,
        paymentMethod.storedPaymentMethodId
      )
    } catch (error) {
      console.error("Failed to disable payment method in Adyen:", error)
      // Continue with local deletion even if Adyen fails
    }

    // Mark as inactive in our database
    await db.organizationPaymentMethod.update({
      where: { id },
      data: {
        isActive: false,
        isDefault: false,
      },
    })

    // If this was the default, set another as default
    if (paymentMethod.isDefault) {
      const nextDefault = await db.organizationPaymentMethod.findFirst({
        where: {
          organizationId: session.user.organizationId,
          isActive: true,
        },
        orderBy: { createdAt: "asc" },
      })

      if (nextDefault) {
        await db.organizationPaymentMethod.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        })

        // Update subscription with new default
        await db.organizationSubscription.updateMany({
          where: { organizationId: session.user.organizationId },
          data: { adyenRecurringDetailRef: nextDefault.storedPaymentMethodId },
        })
      } else {
        // No more payment methods - clear subscription reference
        await db.organizationSubscription.updateMany({
          where: { organizationId: session.user.organizationId },
          data: { adyenRecurringDetailRef: null },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting payment method:", error)
    return NextResponse.json(
      { error: "Failed to delete payment method" },
      { status: 500 }
    )
  }
}
