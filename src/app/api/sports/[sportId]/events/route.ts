import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * GET /api/sports/[sportId]/events
 * Returns all sport events with eligibility data, grouped by eventGroup.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sportId: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sportId } = await params

    const sport = await db.sport.findUnique({
      where: { id: sportId },
      select: { id: true, name: true, slug: true },
    })
    if (!sport) {
      return NextResponse.json({ error: "Sport not found" }, { status: 404 })
    }

    const events = await db.sportEvent.findMany({
      where: { sportId },
      include: {
        eligibility: {
          include: {
            ageCategory: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
      orderBy: { displayOrder: "asc" },
    })

    // Group events by eventGroup
    const grouped: Record<string, typeof events> = {}
    for (const event of events) {
      if (!grouped[event.eventGroup]) {
        grouped[event.eventGroup] = []
      }
      grouped[event.eventGroup].push(event)
    }

    return NextResponse.json({ sport, events, grouped })
  } catch (error) {
    console.error("Error fetching sport events:", error)
    return NextResponse.json(
      { error: "Failed to fetch sport events" },
      { status: 500 }
    )
  }
}
