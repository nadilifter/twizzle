import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { getScopedDb } from "@/lib/db"

// GET /api/payouts/:id - Get payout details with linked transactions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const scopedDb = getScopedDb(session.user.organizationId)

    const payout = await scopedDb.payout.findFirst({
      where: { id },
      include: {
        transactions: {
          select: {
            id: true,
            pspReference: true,
            type: true,
            amount: true,
            currency: true,
            status: true,
            method: true,
            description: true,
            settledAt: true,
            createdAt: true,
          },
          orderBy: { settledAt: "desc" },
        },
      },
    })

    if (!payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 })
    }

    return NextResponse.json(payout)
  } catch (error) {
    console.error("Error fetching payout details:", error)
    return NextResponse.json(
      { error: "Failed to fetch payout details" },
      { status: 500 }
    )
  }
}
