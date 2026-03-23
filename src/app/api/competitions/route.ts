import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { checkFeatureGate } from "@/lib/feature-resolver"
import { db } from "@/lib/db"
import { parseDateOnly } from "@/lib/date-utils"
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
      sportEvent: true,
      ageCategory: true,
    },
    orderBy: { displayOrder: "asc" as const },
  },
  pricingTiers: {
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
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
  competitionType: z.string().min(1, "Competition type is required"),

  // Location
  facilityId: z.string().nullable().optional(),
  country: z.string().optional().default(""),
  stateProvince: z.string().optional().default(""),
  city: z.string().optional().default(""),
  streetAddress: z.string().optional().default(""),
  postalCode: z.string().optional().default(""),

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
  hasFileRequirement: z.boolean().default(false),
  fileRequirementConfig: z.any().optional().nullable(),

  // Results configuration per category
  categoryResults: z.array(z.object({
    // Legacy template refs
    combinationEntryId: z.string().nullable().optional(),
    individualEntryId: z.string().nullable().optional(),
    // Sport-specific refs
    sportEventId: z.string().nullable().optional(),
    ageCategoryId: z.string().nullable().optional(),
    // Result config (can be auto-derived from sportEvent if sport-specific)
    resultType: z.enum(["TIME", "DISTANCE", "HEIGHT", "SCORE", "PLACEMENT"]).optional(),
    sortDirection: z.enum(["ASC", "DESC"]).default("ASC"),
    precision: z.number().int().min(0).max(6).optional(),
    seedMarkRequired: z.boolean().default(false),
    submissionMode: z.enum(["NONE", "VERIFIED_RESULT", "MANUAL_ENTRY"]).default("NONE"),
    qualifyingMark: z.number().nullable().optional(),
    isTeamEvent: z.boolean().default(false),
    teamSize: z.number().int().min(2).nullable().optional(),
    displayOrder: z.number().int().default(0),
  })).optional().default([]),

  // Pricing
  pricingMode: z.enum(["FREE", "PER_COMPETITION", "PER_EVENT", "TIERED", "PER_CATEGORY"]).default("FREE"),
  entryFee: z.number().min(0).nullable().optional(),
  pricingTiers: z.array(z.object({
    minEvents: z.number().int().min(1),
    maxEvents: z.number().int().min(1).nullable().optional(),
    pricePerEvent: z.number().min(0),
  })).optional().default([]),
  categoryPrices: z.record(z.string(), z.number().min(0)).optional().default({}),

  // Publishing
  publishStatus: z.enum(["LIVE", "DRAFT", "SCHEDULED"]).default("DRAFT"),
  scheduledGoLiveDate: z.string().or(z.date()).nullable().optional(),
  scheduledGoLiveTime: z.string().optional(),

  glCodeId: z.string().optional().nullable(),
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

    if (data.facilityId) {
      const facility = await db.facility.findFirst({
        where: { id: data.facilityId, organizationId },
        select: { id: true },
      })
      if (!facility) {
        return NextResponse.json({ error: "Facility not found" }, { status: 404 })
      }
    }

    if (data.levelRequirementIds.length > 0) {
      const levels = await db.level.findMany({
        where: { id: { in: data.levelRequirementIds }, organizationId },
        select: { id: true },
      })
      if (levels.length !== data.levelRequirementIds.length) {
        return NextResponse.json({ error: "One or more levels not found" }, { status: 404 })
      }
    }

    if (data.membershipRequirementIds.length > 0) {
      const instances = await db.membershipInstance.findMany({
        where: { id: { in: data.membershipRequirementIds }, group: { organizationId } },
        select: { id: true },
      })
      if (instances.length !== data.membershipRequirementIds.length) {
        return NextResponse.json({ error: "One or more memberships not found" }, { status: 404 })
      }
    }

    if (data.waiverRequirementIds.length > 0) {
      const waivers = await db.waiver.findMany({
        where: { id: { in: data.waiverRequirementIds }, organizationId },
        select: { id: true },
      })
      if (waivers.length !== data.waiverRequirementIds.length) {
        return NextResponse.json({ error: "One or more waivers not found" }, { status: 404 })
      }
    }

    const competition = await db.competition.create({
      data: {
        organizationId,
        name: data.name,
        color: data.color,
        competitionType: data.competitionType,
        status,

        // Location
        facilityId: data.facilityId || null,
        country: data.country,
        stateProvince: data.stateProvince,
        city: data.city,
        streetAddress: data.streetAddress,
        postalCode: data.postalCode,

        // Dates
        startDate: parseDateOnly(String(data.startDate))!,
        endDate: parseDateOnly(String(data.endDate))!,
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
        hasFileRequirement: data.hasFileRequirement,
        fileRequirementConfig: data.fileRequirementConfig ?? undefined,

        glCodeId: data.glCodeId ?? undefined,

        // Pricing
        pricingMode: data.pricingMode,
        entryFee: data.pricingMode === "PER_COMPETITION" || data.pricingMode === "PER_EVENT"
          ? data.entryFee ?? null
          : null,

        // Publishing
        publishStatus: data.publishStatus,
        scheduledGoLiveDate: data.scheduledGoLiveDate ? parseDateOnly(String(data.scheduledGoLiveDate)) : null,
        scheduledGoLiveTime: data.scheduledGoLiveTime || null,

        // Pricing tiers (for TIERED mode)
        pricingTiers: data.pricingMode === "TIERED" && data.pricingTiers.length > 0
          ? {
              create: data.pricingTiers.map((tier, i) => ({
                minEvents: tier.minEvents,
                maxEvents: tier.maxEvents ?? null,
                pricePerEvent: tier.pricePerEvent,
                displayOrder: i,
              })),
            }
          : undefined,

        // Create competition categories
        categories: {
          create: await Promise.all(data.categoryResults.map(async (cat, index) => {
            let resultType = cat.resultType
            let sortDirection = cat.sortDirection
            let precision = cat.precision

            // Auto-derive result config from sport event if using sport-specific refs
            if (cat.sportEventId && !resultType) {
              const sportEvent = await db.sportEvent.findUnique({
                where: { id: cat.sportEventId },
              })
              if (sportEvent) {
                resultType = sportEvent.resultType
                sortDirection = sportEvent.sortDirection
                precision = precision ?? sportEvent.defaultPrecision
              }
            }

            // Look up per-category price if PER_CATEGORY pricing
            const catKey = cat.sportEventId && cat.ageCategoryId
              ? `${cat.sportEventId}:${cat.ageCategoryId}`
              : cat.combinationEntryId || cat.individualEntryId || ""
            const categoryPrice = data.pricingMode === "PER_CATEGORY" && data.categoryPrices[catKey] !== undefined
              ? data.categoryPrices[catKey]
              : null

            return {
              combinationEntryId: cat.combinationEntryId || null,
              individualEntryId: cat.individualEntryId || null,
              sportEventId: cat.sportEventId || null,
              ageCategoryId: cat.ageCategoryId || null,
              resultType: resultType || "TIME",
              sortDirection,
              precision: precision ?? 3,
              seedMarkRequired: cat.seedMarkRequired,
              submissionMode: cat.submissionMode,
              qualifyingMark: cat.qualifyingMark ?? null,
              isTeamEvent: cat.isTeamEvent,
              teamSize: cat.teamSize ?? null,
              displayOrder: cat.displayOrder || index,
              price: categoryPrice,
            }
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
      { error: "Failed to create competition" },
      { status: 500 }
    )
  }
}
