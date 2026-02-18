import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * GET /api/superadmin/competitions
 * List competitions, optionally filtered by organizationId.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get("organizationId")

    const competitions = await db.competition.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        _count: { select: { entries: true, results: true, teams: true, categories: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(competitions)
  } catch (error) {
    console.error("Error fetching competitions:", error)
    return NextResponse.json(
      { error: "Failed to fetch competitions" },
      { status: 500 }
    )
  }
}
