import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { checkFeatureGate } from "@/lib/feature-resolver"
import { db } from "@/lib/db"
import { z } from "zod"
import {
  hasSeedValue,
  seedValueForComparison,
  type SeedMarkFields,
  type ResultType,
} from "@/lib/athletics-formats"

/**
 * GET /api/competitions/[id]/entries
 * List entries for a competition (filterable by category, status).
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
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get("categoryId")
    const status = searchParams.get("status")

    const competition = await db.competition.findFirst({
      where: { id, organizationId },
      select: { id: true },
    })
    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 })
    }

    const entries = await db.competitionEntry.findMany({
      where: {
        competitionId: id,
        ...(categoryId ? { competitionCategoryId: categoryId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: {
        athlete: {
          select: { id: true, firstName: true, lastName: true, name: true, birthDate: true, gender: true },
        },
        category: {
          include: {
            combinationEntry: { include: { rowValue: true, colValue: true } },
            individualEntry: true,
          },
        },
        team: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error("Error fetching entries:", error)
    return NextResponse.json(
      { error: "Failed to fetch entries" },
      { status: 500 }
    )
  }
}

const createEntrySchema = z.object({
  competitionCategoryId: z.string().min(1),
  athleteId: z.string().min(1),
  teamId: z.string().nullable().optional(),
  seedHours: z.number().int().min(0).nullable().optional(),
  seedMinutes: z.number().int().min(0).max(59).nullable().optional(),
  seedSeconds: z.number().int().min(0).max(59).nullable().optional(),
  seedMs: z.number().int().min(0).max(999).nullable().optional(),
  seedHandTimed: z.boolean().default(false),
  seedDistance: z.number().nullable().optional(),
  seedPoints: z.number().nullable().optional(),
  seedPlacement: z.string().nullable().optional(),
})

/**
 * POST /api/competitions/[id]/entries
 * Create a competition entry (athlete registers for a category).
 */
export async function POST(
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
      select: { id: true, status: true },
    })
    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = createEntrySchema.parse(body)

    const category = await db.competitionCategory.findFirst({
      where: { id: data.competitionCategoryId, competitionId: id },
    })
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    const athlete = await db.athlete.findFirst({
      where: {
        id: data.athleteId,
        organizationAthletes: { some: { organizationId } },
      },
      select: { id: true },
    })
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 })
    }

    const resultType = category.resultType as ResultType
    const seedFields: SeedMarkFields = {
      seedHours: data.seedHours ?? null,
      seedMinutes: data.seedMinutes ?? null,
      seedSeconds: data.seedSeconds ?? null,
      seedMs: data.seedMs ?? null,
      seedHandTimed: data.seedHandTimed,
      seedDistance: data.seedDistance ?? null,
      seedPoints: data.seedPoints ?? null,
      seedPlacement: data.seedPlacement ?? null,
    }
    const hasSeed = hasSeedValue(seedFields, resultType)

    let entryStatus: "PENDING_SEED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" = "APPROVED"
    let seedMarkStatus: "PENDING" | "APPROVED" | "REJECTED" | null = null

    if (category.seedMarkRequired) {
      if (category.submissionMode === "NONE") {
        entryStatus = "APPROVED"
      } else if (hasSeed) {
        if (category.submissionMode === "MANUAL_ENTRY") {
          entryStatus = "PENDING_REVIEW"
          seedMarkStatus = "PENDING"
        } else if (category.submissionMode === "VERIFIED_RESULT") {
          if (category.qualifyingMark != null) {
            const seedNum = seedValueForComparison(seedFields, resultType)
            const qualMark = Number(category.qualifyingMark)
            const qualifies =
              seedNum != null &&
              (category.sortDirection === "ASC"
                ? seedNum <= qualMark
                : seedNum >= qualMark)
            entryStatus = qualifies ? "APPROVED" : "REJECTED"
            seedMarkStatus = qualifies ? "APPROVED" : "REJECTED"
          } else {
            entryStatus = "APPROVED"
            seedMarkStatus = "APPROVED"
          }
        }
      } else {
        entryStatus = "PENDING_SEED"
      }
    }

    const entry = await db.competitionEntry.create({
      data: {
        competitionId: id,
        competitionCategoryId: data.competitionCategoryId,
        athleteId: data.athleteId,
        teamId: data.teamId || null,
        status: entryStatus,
        seedHours: data.seedHours ?? null,
        seedMinutes: data.seedMinutes ?? null,
        seedSeconds: data.seedSeconds ?? null,
        seedMs: data.seedMs ?? null,
        seedHandTimed: data.seedHandTimed,
        seedDistance: data.seedDistance ?? null,
        seedPoints: data.seedPoints ?? null,
        seedPlacement: data.seedPlacement ?? null,
        seedMarkSubmittedAt: hasSeed ? new Date() : null,
        seedMarkStatus: seedMarkStatus as any,
      },
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true, name: true } },
        category: true,
      },
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues?.[0]?.message || "Validation error" }, { status: 400 })
    }
    console.error("Error creating entry:", error)
    return NextResponse.json(
      { error: "Failed to create entry" },
      { status: 500 }
    )
  }
}
