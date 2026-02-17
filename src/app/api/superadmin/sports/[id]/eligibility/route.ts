import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

/**
 * GET /api/superadmin/sports/[id]/eligibility
 * Returns the full eligibility matrix for a sport.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: sportId } = await params

    const events = await db.sportEvent.findMany({
      where: { sportId },
      orderBy: { displayOrder: "asc" },
      select: { id: true, code: true, name: true, eventGroup: true, eventType: true, isActive: true },
    })

    const ageCategories = await db.sportAgeCategory.findMany({
      where: { sportId },
      orderBy: { displayOrder: "asc" },
      select: { id: true, code: true, name: true, minAge: true, maxAge: true, isActive: true },
    })

    const eligibility = await db.sportEventEligibility.findMany({
      where: {
        sportEvent: { sportId },
      },
      select: {
        id: true,
        sportEventId: true,
        ageCategoryId: true,
        isEnabled: true,
      },
    })

    return NextResponse.json({ events, ageCategories, eligibility })
  } catch (error) {
    console.error("Error fetching eligibility:", error)
    return NextResponse.json(
      { error: "Failed to fetch eligibility" },
      { status: 500 }
    )
  }
}

const updateEligibilitySchema = z.object({
  updates: z.array(z.object({
    sportEventId: z.string(),
    ageCategoryId: z.string(),
    isEnabled: z.boolean(),
  })),
})

/**
 * PATCH /api/superadmin/sports/[id]/eligibility
 * Batch update eligibility entries (toggle enabled/disabled).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await params // validate params exist
    const body = await request.json()
    const data = updateEligibilitySchema.parse(body)

    await Promise.all(
      data.updates.map((update) =>
        db.sportEventEligibility.upsert({
          where: {
            sportEventId_ageCategoryId: {
              sportEventId: update.sportEventId,
              ageCategoryId: update.ageCategoryId,
            },
          },
          update: { isEnabled: update.isEnabled },
          create: {
            sportEventId: update.sportEventId,
            ageCategoryId: update.ageCategoryId,
            isEnabled: update.isEnabled,
          },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues?.[0]?.message || "Validation error" }, { status: 400 })
    }
    console.error("Error updating eligibility:", error)
    return NextResponse.json(
      { error: "Failed to update eligibility" },
      { status: 500 }
    )
  }
}
