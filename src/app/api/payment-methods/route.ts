import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * GET /api/payment-methods
 * 
 * Get all payment methods for the current organization
 */
export async function GET() {
  try {
    const session = await getAuthSession()
    
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const paymentMethods = await db.organizationPaymentMethod.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
      },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
      select: {
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
      },
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
