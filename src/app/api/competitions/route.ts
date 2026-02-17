import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { checkFeatureGate } from "@/lib/feature-resolver"
import { db } from "@/lib/db"
import { z } from "zod"

const competitionInclude = {
  facility: { select: { id: true, name: true, city: true, stateProvince: true } },
  categories: {
    include: {
      combinationEntry: {
        include: {
          rowValue: true,
          colValue: true,
        },
      },
      individualEntry: true,
    },
    orderBy: { displayOrder: "asc" as const },
  },
  _count: {
    select: {
      entries: true,
      results: true,
      teams: true,
    },
  },
}

/**
 * GET /api/competitions
 * Returns the list of competitions for the current organization.
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const competitions = await db.competition.findMany({
      where: {
        organizationId,
        ...(status ? { status: status as any } : {}),
      },
      include: competitionInclude,
      orderBy: { startDate: "desc" },
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

const createCompetitionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  competitionType: z.string().min(1, "Competition type is required"),

  // Location
  facilityId: z.string().nullable().optional(),
  country: z.string().optional().default(""),
  stateProvince: z.string().optional().default(""),
  city: z.string().optional().default(""),
  streetAddress: z.string().optional().default(""),

  // Dates
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  startTime: z.string().default("09:00"),
  endTime: z.string().default("17:00"),

  // Categories
  categoryMode: z.enum(["ALL", "SPECIFIC"]).default("ALL"),
  selectedCategoryIds: z.array(z.string()).optional().default([]),

  // Restrictions
  hasLevelRestriction: z.boolean().default(false),
  levelRequirementIds: z.array(z.string()).optional().default([]),
  hasCapacityRestriction: z.boolean().default(false),
  capacity: z.number().int().min(1).nullable().optional(),
  hasAgeRestriction: z.boolean().default(false),
  minAge: z.number().int().min(0).nullable().optional(),
  maxAge: z.number().int().min(0).nullable().optional(),
  hasMembershipRestriction: z.boolean().default(false),
  membershipRequirementIds: z.array(z.string()).optional().default([]),
  hasWaiverRestriction: z.boolean().default(false),
  waiverRequirementIds: z.array(z.string()).optional().default([]),
  hasMedicalRequirement: z.boolean().default(false),

  // Results configuration per category
  categoryResults: z.array(z.object({
    combinationEntryId: z.string().nullable().optional(),
    individualEntryId: z.string().nullable().optional(),
    resultType: z.enum(["TIME", "DISTANCE", "HEIGHT", "SCORE"]),
    sortDirection: z.enum(["ASC", "DESC"]).default("ASC"),
    precision: z.number().int().min(0).max(6).default(3),
    seedMarkRequired: z.boolean().default(false),
    submissionMode: z.enum(["NONE", "VERIFIED_RESULT", "MANUAL_ENTRY"]).default("NONE"),
    qualifyingMark: z.number().nullable().optional(),
    isTeamEvent: z.boolean().default(false),
    teamSize: z.number().int().min(2).nullable().optional(),
    displayOrder: z.number().int().default(0),
  })).optional().default([]),

  // Publishing
  publishStatus: z.enum(["LIVE", "DRAFT", "SCHEDULED"]).default("DRAFT"),
  scheduledGoLiveDate: z.string().or(z.date()).nullable().optional(),
  scheduledGoLiveTime: z.string().optional(),
})

/**
 * POST /api/competitions
 * Create a new competition.
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

    const body = await request.json()
    const data = createCompetitionSchema.parse(body)

    // Determine initial status based on publishStatus
    let status: "DRAFT" | "PUBLISHED" | "REGISTRATION_OPEN" = "DRAFT"
    if (data.publishStatus === "LIVE") {
      status = "REGISTRATION_OPEN"
    } else if (data.publishStatus === "SCHEDULED") {
      status = "DRAFT"
    }

    const competition = await db.competition.create({
      data: {
        organizationId,
        name: data.name,
        competitionType: data.competitionType,
        status,

        // Location
        facilityId: data.facilityId || null,
        country: data.country,
        stateProvince: data.stateProvince,
        city: data.city,
        streetAddress: data.streetAddress,

        // Dates
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        startTime: data.startTime,
        endTime: data.endTime,

        // Categories
        categoryMode: data.categoryMode,

        // Restrictions
        hasLevelRestriction: data.hasLevelRestriction,
        levelRequirementIds: data.levelRequirementIds,
        hasCapacityRestriction: data.hasCapacityRestriction,
        capacity: data.capacity ?? null,
        hasAgeRestriction: data.hasAgeRestriction,
        minAge: data.minAge ?? null,
        maxAge: data.maxAge ?? null,
        hasMembershipRestriction: data.hasMembershipRestriction,
        membershipRequirementIds: data.membershipRequirementIds,
        hasWaiverRestriction: data.hasWaiverRestriction,
        waiverRequirementIds: data.waiverRequirementIds,
        hasMedicalRequirement: data.hasMedicalRequirement,

        // Publishing
        publishStatus: data.publishStatus,
        scheduledGoLiveDate: data.scheduledGoLiveDate ? new Date(data.scheduledGoLiveDate) : null,
        scheduledGoLiveTime: data.scheduledGoLiveTime || null,

        // Create competition categories
        categories: {
          create: data.categoryResults.map((cat, index) => ({
            combinationEntryId: cat.combinationEntryId || null,
            individualEntryId: cat.individualEntryId || null,
            resultType: cat.resultType,
            sortDirection: cat.sortDirection,
            precision: cat.precision,
            seedMarkRequired: cat.seedMarkRequired,
            submissionMode: cat.submissionMode,
            qualifyingMark: cat.qualifyingMark ?? null,
            isTeamEvent: cat.isTeamEvent,
            teamSize: cat.teamSize ?? null,
            displayOrder: cat.displayOrder || index,
          })),
        },
      },
      include: competitionInclude,
    })

    return NextResponse.json(competition, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues?.[0]?.message || "Validation error"
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error("Error creating competition:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create competition" },
      { status: 500 }
    )
  }
}
