import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/signups/plans - Get public subscription plans
// This is a public endpoint, no authentication required
export async function GET() {
  try {
    const plans = await db.subscriptionPlan.findMany({
      where: {
        isActive: true,
        isPublic: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        monthlyPrice: true,
        yearlyPrice: true,
        transactionFee: true,
        perTransactionFee: true,
        maxAthletes: true,
        maxUsers: true,
        maxPrograms: true,
        maxEvents: true,
        smsIncluded: true,
        smsOverageRate: true,
        emailIncluded: true,
        emailOverageRate: true,
        maxStorageMB: true,
        maxMembershipTypes: true,
        features: true,
        featureToggles: true,
        isPopular: true,
        displayOrder: true,
      },
      orderBy: {
        displayOrder: "asc",
      },
    })

    return NextResponse.json(plans)
  } catch (error) {
    console.error("Error fetching plans:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscription plans" },
      { status: 500 }
    )
  }
}
