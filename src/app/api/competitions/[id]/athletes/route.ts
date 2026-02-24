import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { checkFeatureGate } from "@/lib/feature-resolver"
import { db } from "@/lib/db"

/**
 * GET /api/competitions/[id]/athletes
 * List unique athletes registered for a competition, with event count
 * and compliance status for active restrictions/requirements.
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
      select: {
        id: true,
        hasLevelRestriction: true,
        levelRequirementIds: true,
        hasMembershipRestriction: true,
        membershipRequirementIds: true,
        hasWaiverRestriction: true,
        waiverRequirementIds: true,
        hasMedicalRequirement: true,
      },
    })
    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 })
    }

    const entries = await db.competitionEntry.findMany({
      where: { competitionId: id },
      select: {
        athleteId: true,
        athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            birthDate: true,
            gender: true,
            organizationAthletes: {
              where: { organizationId },
              select: { level: true },
            },
          },
        },
      },
    })

    // Group entries by athlete
    const athleteMap = new Map<
      string,
      {
        athlete: (typeof entries)[number]["athlete"]
        eventCount: number
      }
    >()
    for (const entry of entries) {
      const existing = athleteMap.get(entry.athleteId)
      if (existing) {
        existing.eventCount++
      } else {
        athleteMap.set(entry.athleteId, {
          athlete: entry.athlete,
          eventCount: 1,
        })
      }
    }

    const athleteIds = Array.from(athleteMap.keys())

    // Batch-resolve guardians via AthleteGuardian -> User
    const guardianLinks =
      athleteIds.length > 0
        ? await db.athleteGuardian.findMany({
            where: { athleteId: { in: athleteIds }, userId: { not: null } },
            select: {
              athleteId: true,
              isPrimary: true,
              user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { isPrimary: "desc" },
          })
        : []
    const guardianMap = new Map<string, { id: string; name: string | null; email: string }[]>()
    for (const g of guardianLinks) {
      if (!g.user) continue
      const list = guardianMap.get(g.athleteId) ?? []
      list.push(g.user)
      guardianMap.set(g.athleteId, list)
    }

    // Resolve level names if level restriction is active
    let levelMap = new Map<string, string>()
    if (competition.hasLevelRestriction && competition.levelRequirementIds.length > 0) {
      const levels = await db.level.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      })
      levelMap = new Map(levels.map((l) => [l.id, l.name]))
    }

    // Batch-fetch membership compliance
    let membershipByAthlete = new Map<string, boolean>()
    if (competition.hasMembershipRestriction && competition.membershipRequirementIds.length > 0) {
      const memberships = await db.athleteMembership.findMany({
        where: {
          athleteId: { in: athleteIds },
          status: "ACTIVE",
          membershipInstanceId: { in: competition.membershipRequirementIds },
        },
        select: { athleteId: true },
      })
      const withMembership = new Set(memberships.map((m) => m.athleteId))
      for (const aid of athleteIds) {
        membershipByAthlete.set(aid, withMembership.has(aid))
      }
    }

    // Batch-fetch waiver compliance
    let waiverByAthlete = new Map<string, boolean>()
    if (competition.hasWaiverRestriction && competition.waiverRequirementIds.length > 0) {
      const acceptances = await db.waiverAcceptance.findMany({
        where: {
          athleteId: { in: athleteIds },
          waiverId: { in: competition.waiverRequirementIds },
        },
        select: { athleteId: true, waiverId: true },
      })
      // An athlete is compliant if they have acceptances for ALL required waivers
      const acceptancesByAthlete = new Map<string, Set<string>>()
      for (const a of acceptances) {
        if (!a.athleteId) continue
        const set = acceptancesByAthlete.get(a.athleteId) ?? new Set()
        set.add(a.waiverId)
        acceptancesByAthlete.set(a.athleteId, set)
      }
      for (const aid of athleteIds) {
        const signed = acceptancesByAthlete.get(aid)
        const allSigned = signed
          ? competition.waiverRequirementIds.every((wid) => signed.has(wid))
          : false
        waiverByAthlete.set(aid, allSigned)
      }
    }

    // Batch-fetch medical compliance
    let medicalByAthlete = new Map<string, boolean>()
    if (competition.hasMedicalRequirement) {
      const medicals = await db.athleteMedicalInfo.findMany({
        where: { athleteId: { in: athleteIds } },
        select: { athleteId: true },
      })
      const withMedical = new Set(medicals.map((m) => m.athleteId))
      for (const aid of athleteIds) {
        medicalByAthlete.set(aid, withMedical.has(aid))
      }
    }

    const athletes = Array.from(athleteMap.values()).map(({ athlete, eventCount }) => {
      const compliance: Record<string, string> = {}

      if (competition.hasMembershipRestriction && competition.membershipRequirementIds.length > 0) {
        compliance.membership = membershipByAthlete.get(athlete.id)
          ? "verified"
          : "missing"
      }
      if (competition.hasWaiverRestriction && competition.waiverRequirementIds.length > 0) {
        compliance.waiver = waiverByAthlete.get(athlete.id)
          ? "signed"
          : "unsigned"
      }
      if (competition.hasMedicalRequirement) {
        compliance.medical = medicalByAthlete.get(athlete.id)
          ? "complete"
          : "incomplete"
      }

      const orgLevel = athlete.organizationAthletes?.[0]?.level ?? null;
      let level: { id: string; name: string } | null = null
      if (orgLevel && orgLevel !== "Unassigned") {
        const name = levelMap.get(orgLevel)
        level = name ? { id: orgLevel, name } : { id: orgLevel, name: orgLevel }
      }

      return {
        id: athlete.id,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        birthDate: athlete.birthDate,
        gender: athlete.gender,
        level,
        guardians: guardianMap.get(athlete.id) ?? [],
        eventCount,
        compliance,
      }
    })

    // Sort by last name, then first name
    athletes.sort((a, b) => {
      const aName = `${a.lastName ?? ""} ${a.firstName ?? ""}`.toLowerCase()
      const bName = `${b.lastName ?? ""} ${b.firstName ?? ""}`.toLowerCase()
      return aName.localeCompare(bName)
    })

    return NextResponse.json({
      athletes,
      requirements: {
        hasLevelRestriction: competition.hasLevelRestriction,
        hasMembershipRestriction: competition.hasMembershipRestriction,
        hasWaiverRestriction: competition.hasWaiverRestriction,
        hasMedicalRequirement: competition.hasMedicalRequirement,
      },
    })
  } catch (error) {
    console.error("Error fetching competition athletes:", error)
    return NextResponse.json(
      { error: "Failed to fetch athletes" },
      { status: 500 }
    )
  }
}
