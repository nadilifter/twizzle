import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { checkFeatureGate } from "@/lib/feature-resolver"
import { db } from "@/lib/db"
import { z } from "zod"

/**
 * GET /api/competitions/[id]/categories
 * List competition categories with result configuration.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const competition = await db.competition.findFirst({
      where: { id, organizationId },
      select: { id: true },
    })
    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 })
    }

    const categories = await db.competitionCategory.findMany({
      where: { competitionId: id },
      include: {
        combinationEntry: {
          include: {
            rowValue: true,
            colValue: true,
            template: { select: { id: true, name: true, type: true, rowAxisLabel: true, columnAxisLabel: true } },
          },
        },
        individualEntry: {
          include: {
            template: { select: { id: true, name: true, type: true } },
          },
        },
        sportEvent: true,
        ageCategory: true,
        _count: {
          select: { entries: true, results: true, teams: true },
        },
      },
      orderBy: { displayOrder: "asc" },
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error("Error fetching competition categories:", error)
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    )
  }
}

const updateCategorySchema = z.object({
  categories: z.array(z.object({
    id: z.string(),
    resultType: z.enum(["TIME", "DISTANCE", "HEIGHT", "SCORE"]).optional(),
    sortDirection: z.enum(["ASC", "DESC"]).optional(),
    precision: z.number().int().min(0).max(6).optional(),
    seedMarkRequired: z.boolean().optional(),
    submissionMode: z.enum(["NONE", "VERIFIED_RESULT", "MANUAL_ENTRY"]).optional(),
    qualifyingMark: z.number().nullable().optional(),
    isTeamEvent: z.boolean().optional(),
    teamSize: z.number().int().min(2).nullable().optional(),
    isActive: z.boolean().optional(),
    displayOrder: z.number().int().optional(),
  })),
})

/**
 * PATCH /api/competitions/[id]/categories
 * Batch update competition category configurations (result types, seed marks, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const competition = await db.competition.findFirst({
      where: { id, organizationId },
      select: { id: true },
    })
    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = updateCategorySchema.parse(body)

    const updates = await Promise.all(
      data.categories.map((cat) => {
        const updateData: Record<string, unknown> = {}
        if (cat.resultType !== undefined) updateData.resultType = cat.resultType
        if (cat.sortDirection !== undefined) updateData.sortDirection = cat.sortDirection
        if (cat.precision !== undefined) updateData.precision = cat.precision
        if (cat.seedMarkRequired !== undefined) updateData.seedMarkRequired = cat.seedMarkRequired
        if (cat.submissionMode !== undefined) updateData.submissionMode = cat.submissionMode
        if (cat.qualifyingMark !== undefined) updateData.qualifyingMark = cat.qualifyingMark
        if (cat.isTeamEvent !== undefined) updateData.isTeamEvent = cat.isTeamEvent
        if (cat.teamSize !== undefined) updateData.teamSize = cat.teamSize
        if (cat.isActive !== undefined) updateData.isActive = cat.isActive
        if (cat.displayOrder !== undefined) updateData.displayOrder = cat.displayOrder

        return db.competitionCategory.update({
          where: { id: cat.id },
          data: updateData,
        })
      })
    )

    return NextResponse.json(updates)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues?.[0]?.message || "Validation error" }, { status: 400 })
    }
    console.error("Error updating competition categories:", error)
    return NextResponse.json(
      { error: "Failed to update categories" },
      { status: 500 }
    )
  }
}
