import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { checkFeatureGate } from "@/lib/feature-resolver"
import { db } from "@/lib/db"
import {
  formatSeedMarkForDisplay,
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
 * GET /api/competitions/[id]/athletes/[athleteId]
 * Full participation details for one athlete in a competition.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; athleteId: string }> }
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

    const { id, athleteId } = await params

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

    const athlete = await db.athlete.findFirst({
      where: { id: athleteId, organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        gender: true,
        level: true,
        guardians: {
          include: {
            family: {
              select: { id: true, name: true, email: true, primaryContact: true },
            },
          },
          orderBy: { isPrimary: "desc" },
        },
      },
    })
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 })
    }

    // Resolve level name
    let level: { id: string; name: string } | null = null
    if (athlete.level) {
      const levelRecord = await db.level.findFirst({
        where: { id: athlete.level, organizationId },
        select: { id: true, name: true },
      })
      level = levelRecord ?? { id: athlete.level, name: athlete.level }
    }

    const families = athlete.guardians.map((g) => ({
      id: g.family.id,
      name: g.family.name,
      email: g.family.email,
      primaryContact: g.family.primaryContact,
      relationship: g.relationship,
      isPrimary: g.isPrimary,
    }))

    // Fetch entries for this athlete in this competition
    const entries = await db.competitionEntry.findMany({
      where: { competitionId: id, athleteId },
      include: {
        category: {
          include: {
            combinationEntry: { include: { rowValue: true, colValue: true } },
            individualEntry: true,
            sportEvent: { select: { id: true, name: true, code: true } },
            ageCategory: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    const formattedEntries = entries.map((entry) => ({
      id: entry.id,
      status: entry.status,
      category: {
        id: entry.category.id,
        label: getCategoryLabel(entry.category),
        resultType: entry.category.resultType,
      },
      seedMark: formatSeedMarkForDisplay(
        {
          seedHours: entry.seedHours,
          seedMinutes: entry.seedMinutes,
          seedSeconds: entry.seedSeconds,
          seedMs: entry.seedMs,
          seedHandTimed: entry.seedHandTimed,
          seedDistance: entry.seedDistance,
          seedPoints: entry.seedPoints,
          seedPlacement: entry.seedPlacement,
        } as SeedMarkFields,
        (entry.category.resultType ?? "TIME") as ResultType,
      ),
      seedMarkStatus: entry.seedMarkStatus,
    }))

    // Build compliance data
    const compliance: {
      membership: {
        required: boolean
        status: string
        memberships: { name: string; groupName: string; status: string }[]
      }
      waivers: {
        required: boolean
        status: string
        waivers: {
          id: string
          title: string
          signed: boolean
          signedAt: string | null
          pages: {
            id: string
            pageNumber: number
            title: string | null
            content: string
            signature: {
              signatureData: string
              signedByName: string
              signedByEmail: string
              signedAt: string
            } | null
          }[]
        }[]
      }
      medical: {
        required: boolean
        status: string
        info: Record<string, unknown> | null
      }
    } = {
      membership: { required: false, status: "not_required", memberships: [] },
      waivers: { required: false, status: "not_required", waivers: [] },
      medical: { required: false, status: "not_required", info: null },
    }

    // Membership compliance
    if (competition.hasMembershipRestriction && competition.membershipRequirementIds.length > 0) {
      compliance.membership.required = true

      const requiredInstances = await db.membershipInstance.findMany({
        where: { id: { in: competition.membershipRequirementIds } },
        select: { id: true, name: true, group: { select: { name: true } } },
      })

      const athleteMemberships = await db.athleteMembership.findMany({
        where: {
          athleteId,
          membershipInstanceId: { in: competition.membershipRequirementIds },
        },
        select: { membershipInstanceId: true, status: true },
      })
      const membershipStatusMap = new Map(
        athleteMemberships.map((m) => [m.membershipInstanceId, m.status])
      )

      const membershipDetails = requiredInstances.map((inst) => {
        const status = membershipStatusMap.get(inst.id)
        return {
          name: inst.name,
          groupName: inst.group.name,
          status: status === "ACTIVE" ? "active" : status ? String(status).toLowerCase() : "none",
        }
      })

      const hasActive = athleteMemberships.some((m) => m.status === "ACTIVE")
      compliance.membership.status = hasActive ? "verified" : "missing"
      compliance.membership.memberships = membershipDetails
    }

    // Waiver compliance
    if (competition.hasWaiverRestriction && competition.waiverRequirementIds.length > 0) {
      compliance.waivers.required = true

      const requiredWaivers = await db.waiver.findMany({
        where: { id: { in: competition.waiverRequirementIds } },
        include: {
          pages: {
            orderBy: { pageNumber: "asc" },
            select: { id: true, pageNumber: true, title: true, content: true },
          },
        },
      })

      const acceptances = await db.waiverAcceptance.findMany({
        where: {
          athleteId,
          waiverId: { in: competition.waiverRequirementIds },
        },
        select: { waiverId: true, completedAt: true },
      })
      const acceptanceMap = new Map(
        acceptances.map((a) => [a.waiverId, a.completedAt])
      )

      // Fetch all signatures for these waivers for this athlete
      const signatures = await db.waiverSignature.findMany({
        where: {
          athleteId,
          waiverId: { in: competition.waiverRequirementIds },
        },
        select: {
          id: true,
          waiverId: true,
          waiverPageId: true,
          signatureData: true,
          signedByName: true,
          signedByEmail: true,
          signedAt: true,
        },
      })
      const signaturesByPage = new Map(
        signatures.map((s) => [s.waiverPageId, s])
      )

      const waiverDetails = requiredWaivers.map((w) => {
        const completedAt = acceptanceMap.get(w.id)
        return {
          id: w.id,
          title: w.title,
          signed: !!completedAt,
          signedAt: completedAt?.toISOString() ?? null,
          pages: w.pages.map((p) => {
            const sig = signaturesByPage.get(p.id)
            return {
              id: p.id,
              pageNumber: p.pageNumber,
              title: p.title,
              content: p.content,
              signature: sig
                ? {
                    signatureData: sig.signatureData,
                    signedByName: sig.signedByName,
                    signedByEmail: sig.signedByEmail,
                    signedAt: sig.signedAt.toISOString(),
                  }
                : null,
            }
          }),
        }
      })

      const allSigned = waiverDetails.every((w) => w.signed)
      compliance.waivers.status = allSigned ? "signed" : "unsigned"
      compliance.waivers.waivers = waiverDetails
    }

    // Medical compliance
    if (competition.hasMedicalRequirement) {
      compliance.medical.required = true

      const medicalInfo = await db.athleteMedicalInfo.findUnique({
        where: { athleteId },
        include: {
          customResponses: {
            include: { question: true },
          },
        },
      })

      compliance.medical.status = medicalInfo ? "complete" : "incomplete"
      compliance.medical.info = medicalInfo
        ? {
            id: medicalInfo.id,
            allergies: medicalInfo.allergies,
            medications: medicalInfo.medications,
            conditions: medicalInfo.conditions,
            dietaryRestrictions: medicalInfo.dietaryRestrictions,
            insuranceProvider: medicalInfo.insuranceProvider,
            insurancePolicyNumber: medicalInfo.insurancePolicyNumber,
            emergencyContactName: medicalInfo.emergencyContactName,
            emergencyContactPhone: medicalInfo.emergencyContactPhone,
            emergencyContactRelation: medicalInfo.emergencyContactRelation,
            additionalNotes: medicalInfo.additionalNotes,
            createdAt: medicalInfo.createdAt.toISOString(),
            updatedAt: medicalInfo.updatedAt.toISOString(),
            customResponses: medicalInfo.customResponses.map((r) => ({
              id: r.id,
              questionId: r.questionId,
              response: r.response,
              question: r.question,
              createdAt: r.createdAt.toISOString(),
              updatedAt: r.updatedAt.toISOString(),
            })),
          }
        : null
    }

    return NextResponse.json({
      athlete: {
        id: athlete.id,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        birthDate: athlete.birthDate,
        gender: athlete.gender,
        level,
        families,
      },
      entries: formattedEntries,
      compliance,
      requirements: {
        hasLevelRestriction: competition.hasLevelRestriction,
        hasMembershipRestriction: competition.hasMembershipRestriction,
        hasWaiverRestriction: competition.hasWaiverRestriction,
        hasMedicalRequirement: competition.hasMedicalRequirement,
      },
    })
  } catch (error) {
    console.error("Error fetching competition athlete detail:", error)
    return NextResponse.json(
      { error: "Failed to fetch athlete details" },
      { status: 500 }
    )
  }
}
