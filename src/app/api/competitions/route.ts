import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { checkFeatureGate } from "@/lib/feature-resolver"

/**
 * GET /api/competitions
 * Returns the list of competitions for the current organization.
 * Stub endpoint - returns empty array until the Competition model is implemented.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    if (!organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 })
    }

    const gateResponse = await checkFeatureGate(organizationId, "competitions")
    if (gateResponse) return gateResponse

    // Stub: return empty array until Competition model is created
    return NextResponse.json([])
  } catch (error) {
    console.error("Error fetching competitions:", error)
    return NextResponse.json(
      { error: "Failed to fetch competitions" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/competitions
 * Create a new competition.
 * Stub endpoint - placeholder until the Competition model is implemented.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    if (!organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 })
    }

    const gateResponse = await checkFeatureGate(organizationId, "competitions")
    if (gateResponse) return gateResponse

    // Stub: return placeholder response until Competition model is created
    return NextResponse.json(
      { message: "Competition creation not yet implemented" },
      { status: 501 }
    )
  } catch (error) {
    console.error("Error creating competition:", error)
    return NextResponse.json(
      { error: "Failed to create competition" },
      { status: 500 }
    )
  }
}
