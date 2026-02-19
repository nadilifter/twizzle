import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { checkFeatureGate } from "@/lib/feature-resolver"
import { db } from "@/lib/db"
import {
  formatSeedMarkForDisplay,
  seedValueForComparison,
  hasSeedValue,
  type SeedMarkFields,
  type ResultType,
} from "@/lib/athletics-formats"

function getCategoryLabel(category: {
  sportEvent?: { name: string; code: string } | null
  ageCategory?: { name: string; code: string } | null
  individualEntry?: { name: string } | null
  combinationEntry?: {
    rowValue: { name: string }
    colValue: { name: string }
  } | null
  id: string
}): string {
  if (category.ageCategory && category.sportEvent) {
    return `${category.ageCategory.code} ${category.sportEvent.name}`
  }
  if (category.sportEvent) return category.sportEvent.name
  if (category.ageCategory) return category.ageCategory.name
  if (category.individualEntry?.name) return category.individualEntry.name
  if (category.combinationEntry) {
    return `${category.combinationEntry.rowValue.name} - ${category.combinationEntry.colValue.name}`
  }
  return `Category ${category.id.slice(-4)}`
}

/**
 * GET /api/competitions/[id]/events/[categoryId]
 * Fetch a single competition category with all entries and seed marks.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
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

    const { id, categoryId } = await params

    const competition = await db.competition.findFirst({
      where: { id, organizationId },
      select: { id: true, name: true },
    })
    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 })
    }

    const category = await db.competitionCategory.findFirst({
      where: { id: categoryId, competitionId: id },
      include: {
        combinationEntry: { include: { rowValue: true, colValue: true } },
        individualEntry: true,
        sportEvent: { select: { id: true, name: true, code: true } },
        ageCategory: { select: { id: true, name: true, code: true } },
        _count: { select: { entries: true, results: true } },
      },
    })
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    const entries = await db.competitionEntry.findMany({
      where: { competitionCategoryId: categoryId, competitionId: id },
      include: {
        athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            birthDate: true,
            gender: true,
            familyId: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    // Batch-resolve family names
    const familyIds = [
      ...new Set(
        entries
          .map((e) => e.athlete.familyId)
          .filter((fid): fid is string => fid != null)
      ),
    ]
    const families =
      familyIds.length > 0
        ? await db.family.findMany({
            where: { id: { in: familyIds } },
            select: { id: true, name: true },
          })
        : []
    const familyMap = new Map(families.map((f) => [f.id, f]))

    const resultType = (category.resultType ?? "TIME") as ResultType

    const formattedEntries = entries.map((entry) => {
      const seedFields: SeedMarkFields = {
        seedHours: entry.seedHours,
        seedMinutes: entry.seedMinutes,
        seedSeconds: entry.seedSeconds,
        seedMs: entry.seedMs,
        seedHandTimed: entry.seedHandTimed,
        seedDistance: entry.seedDistance ? Number(entry.seedDistance) : null,
        seedPoints: entry.seedPoints ? Number(entry.seedPoints) : null,
        seedPlacement: entry.seedPlacement,
      }

      return {
        id: entry.id,
        status: entry.status,
        athlete: {
          id: entry.athlete.id,
          firstName: entry.athlete.firstName,
          lastName: entry.athlete.lastName,
          gender: entry.athlete.gender,
          birthDate: entry.athlete.birthDate?.toISOString() ?? null,
          family: entry.athlete.familyId
            ? familyMap.get(entry.athlete.familyId) ?? null
            : null,
        },
        seedMark: formatSeedMarkForDisplay(seedFields, resultType),
        seedValue: seedValueForComparison(seedFields, resultType),
        seedHandTimed: entry.seedHandTimed,
        seedMarkStatus: entry.seedMarkStatus,
        seedMarkNotes: entry.seedMarkNotes,
        hasSeed: hasSeedValue(seedFields, resultType),
      }
    })

    // Sort by seed mark: entries with seeds first, then by value
    const sortAsc = category.sortDirection === "ASC"
    formattedEntries.sort((a, b) => {
      if (a.seedValue === null && b.seedValue === null) return 0
      if (a.seedValue === null) return 1
      if (b.seedValue === null) return -1
      return sortAsc
        ? a.seedValue - b.seedValue
        : b.seedValue - a.seedValue
    })

    const seedSubmittedCount = formattedEntries.filter((e) => e.hasSeed).length

    return NextResponse.json({
      competitionName: competition.name,
      category: {
        id: category.id,
        label: getCategoryLabel(category),
        resultType: category.resultType,
        sortDirection: category.sortDirection,
        precision: category.precision,
        seedMarkRequired: category.seedMarkRequired,
        isTeamEvent: category.isTeamEvent,
        teamSize: category.teamSize,
        isActive: category.isActive,
        entryCount: category._count.entries,
        resultCount: category._count.results,
        seedSubmittedCount,
      },
      entries: formattedEntries,
    })
  } catch (error) {
    console.error("Error fetching competition event detail:", error)
    return NextResponse.json(
      { error: "Failed to fetch event details" },
      { status: 500 }
    )
  }
}
