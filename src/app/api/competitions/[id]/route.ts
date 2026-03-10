import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { checkFeatureGate } from "@/lib/feature-resolver"
import { db } from "@/lib/db"
import { parseDateOnly } from "@/lib/date-utils"
import { z } from "zod"

const competitionInclude = {
  facility: { select: { id: true, name: true, street: true, city: true, stateProvince: true, postalCode: true, country: true } },
  categories: {
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
      sportEvent: { select: { id: true, name: true, code: true } },
      ageCategory: { select: { id: true, name: true, code: true } },
      _count: {
        select: { entries: true, results: true },
      },
    },
    orderBy: { displayOrder: "asc" as const },
  },
  entries: {
    include: {
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
        },
      },
      category: { select: { id: true, resultType: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  lineItems: {
    include: {
      invoice: {
        select: {
          id: true,
          reference: true,
          status: true,
          total: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
  teams: true,
  _count: {
    select: { entries: true, results: true, teams: true },
  },
}

/**
 * GET /api/competitions/[id]
 * Fetch a single competition with all related data.
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
      include: competitionInclude,
    })

    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 })
    }

    // Resolve guardians via AthleteGuardian -> User
    const athleteIds = [
      ...new Set(competition.entries.map((e) => e.athlete.id)),
    ]
    const guardianLinks =
      athleteIds.length > 0
        ? await db.athleteGuardian.findMany({
            where: { athleteId: { in: athleteIds } },
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { isPrimary: "desc" },
          })
        : []
    const guardianMap = new Map<string, { id: string; name: string; email: string }[]>()
    for (const g of guardianLinks) {
      if (!g.user) continue
      const list = guardianMap.get(g.athleteId) ?? []
      list.push(g.user)
      guardianMap.set(g.athleteId, list)
    }

    const enrichedEntries = competition.entries.map((entry) => ({
      ...entry,
      athlete: {
        ...entry.athlete,
        guardians: guardianMap.get(entry.athlete.id) ?? [],
      },
    }))

    return NextResponse.json({
      ...competition,
      entries: enrichedEntries,
    })
  } catch (error) {
    console.error("Error fetching competition:", error)
    return NextResponse.json(
      { error: "Failed to fetch competition" },
      { status: 500 }
    )
  }
}

const updateCompetitionSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
  competitionType: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),

  facilityId: z.string().nullable().optional(),
  country: z.string().optional(),
  stateProvince: z.string().optional(),
  city: z.string().optional(),
  streetAddress: z.string().optional(),
  postalCode: z.string().optional(),

  startDate: z.string().or(z.date()).optional(),
  endDate: z.string().or(z.date()).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),

  categoryMode: z.enum(["ALL", "SPECIFIC"]).optional(),

  hasLevelRestriction: z.boolean().optional(),
  levelRequirementIds: z.array(z.string()).optional(),
  hasCapacityRestriction: z.boolean().optional(),
  capacity: z.number().int().min(1).nullable().optional(),
  hasAgeRestriction: z.boolean().optional(),
  minAge: z.number().int().min(0).nullable().optional(),
  maxAge: z.number().int().min(0).nullable().optional(),
  hasMembershipRestriction: z.boolean().optional(),
  membershipRequirementIds: z.array(z.string()).optional(),
  hasWaiverRestriction: z.boolean().optional(),
  waiverRequirementIds: z.array(z.string()).optional(),
  hasMedicalRequirement: z.boolean().optional(),
  hasFileRequirement: z.boolean().optional(),
  fileRequirementConfig: z.any().optional().nullable(),

  publishStatus: z.enum(["DRAFT", "LIVE", "SCHEDULED", "CLOSED", "COMPLETED"]).optional(),
  scheduledGoLiveDate: z.string().or(z.date()).nullable().optional(),
  scheduledGoLiveTime: z.string().optional(),
})

/**
 * PATCH /api/competitions/[id]
 * Update a competition.
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

    const existing = await db.competition.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = updateCompetitionSchema.parse(body)

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.color !== undefined) updateData.color = data.color
    if (data.competitionType !== undefined) updateData.competitionType = data.competitionType
    if (data.status !== undefined) updateData.status = data.status
    if (data.facilityId !== undefined) updateData.facilityId = data.facilityId
    if (data.country !== undefined) updateData.country = data.country
    if (data.stateProvince !== undefined) updateData.stateProvince = data.stateProvince
    if (data.city !== undefined) updateData.city = data.city
    if (data.streetAddress !== undefined) updateData.streetAddress = data.streetAddress
    if (data.postalCode !== undefined) updateData.postalCode = data.postalCode
    if (data.startDate !== undefined) updateData.startDate = parseDateOnly(String(data.startDate))
    if (data.endDate !== undefined) updateData.endDate = parseDateOnly(String(data.endDate))
    if (data.startTime !== undefined) updateData.startTime = data.startTime
    if (data.endTime !== undefined) updateData.endTime = data.endTime
    if (data.categoryMode !== undefined) updateData.categoryMode = data.categoryMode
    if (data.hasLevelRestriction !== undefined) updateData.hasLevelRestriction = data.hasLevelRestriction
    if (data.levelRequirementIds !== undefined) updateData.levelRequirementIds = data.levelRequirementIds
    if (data.hasCapacityRestriction !== undefined) updateData.hasCapacityRestriction = data.hasCapacityRestriction
    if (data.capacity !== undefined) updateData.capacity = data.capacity
    if (data.hasAgeRestriction !== undefined) updateData.hasAgeRestriction = data.hasAgeRestriction
    if (data.minAge !== undefined) updateData.minAge = data.minAge
    if (data.maxAge !== undefined) updateData.maxAge = data.maxAge
    if (data.hasMembershipRestriction !== undefined) updateData.hasMembershipRestriction = data.hasMembershipRestriction
    if (data.membershipRequirementIds !== undefined) updateData.membershipRequirementIds = data.membershipRequirementIds
    if (data.hasWaiverRestriction !== undefined) updateData.hasWaiverRestriction = data.hasWaiverRestriction
    if (data.waiverRequirementIds !== undefined) updateData.waiverRequirementIds = data.waiverRequirementIds
    if (data.hasMedicalRequirement !== undefined) updateData.hasMedicalRequirement = data.hasMedicalRequirement
    if (data.hasFileRequirement !== undefined) updateData.hasFileRequirement = data.hasFileRequirement
    if (data.fileRequirementConfig !== undefined) updateData.fileRequirementConfig = data.fileRequirementConfig
    if (data.publishStatus !== undefined) {
      const currentPublishStatus = existing.publishStatus
      if (currentPublishStatus === "LIVE" && data.publishStatus === "DRAFT") {
        return NextResponse.json(
          { error: "Cannot move a live competition back to draft" },
          { status: 400 }
        )
      }

      updateData.publishStatus = data.publishStatus

      const statusMap: Record<string, string> = {
        DRAFT: "DRAFT",
        LIVE: "REGISTRATION_OPEN",
        SCHEDULED: "DRAFT",
        CLOSED: "REGISTRATION_CLOSED",
        COMPLETED: "COMPLETED",
      }
      if (statusMap[data.publishStatus]) {
        updateData.status = statusMap[data.publishStatus]
      }
    }
    if (data.scheduledGoLiveDate !== undefined) updateData.scheduledGoLiveDate = data.scheduledGoLiveDate ? parseDateOnly(String(data.scheduledGoLiveDate)) : null
    if (data.scheduledGoLiveTime !== undefined) updateData.scheduledGoLiveTime = data.scheduledGoLiveTime

    const competition = await db.competition.update({
      where: { id },
      data: updateData,
      include: competitionInclude,
    })

    return NextResponse.json(competition)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues?.[0]?.message || "Validation error" }, { status: 400 })
    }
    console.error("Error updating competition:", error)
    return NextResponse.json(
      { error: "Failed to update competition" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/competitions/[id]
 * Delete a competition (only if DRAFT).
 */
export async function DELETE(
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

    const existing = await db.competition.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 })
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft competitions can be deleted" },
        { status: 400 }
      )
    }

    await db.competition.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting competition:", error)
    return NextResponse.json(
      { error: "Failed to delete competition" },
      { status: 500 }
    )
  }
}
