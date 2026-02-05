import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * POST /api/payment-methods/[id]/default
 * 
 * Set a payment method as the default for the current organization
 */
export async function POST(
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

    // Already default
    if (paymentMethod.isDefault) {
      return NextResponse.json({ success: true })
    }

    // Update in a transaction
    await db.$transaction([
      // Remove default from all other payment methods
      db.organizationPaymentMethod.updateMany({
        where: {
          organizationId: session.user.organizationId,
          isDefault: true,
        },
        data: { isDefault: false },
      }),
      // Set this one as default
      db.organizationPaymentMethod.update({
        where: { id },
        data: { isDefault: true },
      }),
      // Update subscription with new recurring detail reference
      db.organizationSubscription.updateMany({
        where: { organizationId: session.user.organizationId },
        data: { adyenRecurringDetailRef: paymentMethod.storedPaymentMethodId },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error setting default payment method:", error)
    return NextResponse.json(
      { error: "Failed to set default payment method" },
      { status: 500 }
    )
  }
}
