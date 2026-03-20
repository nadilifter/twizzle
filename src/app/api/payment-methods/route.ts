import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { syncPaymentMethodsFromAdyen } from "@/lib/payment-method-sync"

const PM_SELECT = {
  id: true,
  storedPaymentMethodId: true,
  type: true,
  brand: true,
  lastFour: true,
  expiryMonth: true,
  expiryYear: true,
  holderName: true,
  isDefault: true,
  isActive: true,
  createdAt: true,
} as const

/**
 * GET /api/payment-methods
 * 
 * Get all payment methods for the current organization.
 * Syncs with Adyen's stored payment methods to catch missed webhooks
 * and card updates before returning.
 */
export async function GET() {
  try {
    const session = await getAuthSession()
    
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    try {
      await syncPaymentMethodsFromAdyen(organizationId)
    } catch (error) {
      console.error("Adyen sync failed, returning local records:", error)
    }

    const paymentMethods = await db.organizationPaymentMethod.findMany({
      where: { organizationId, isActive: true },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
      select: PM_SELECT,
    })

    return NextResponse.json(paymentMethods)
  } catch (error) {
    console.error("Error fetching payment methods:", error)
    return NextResponse.json(
      { error: "Failed to fetch payment methods" },
      { status: 500 }
    )
  }
}
