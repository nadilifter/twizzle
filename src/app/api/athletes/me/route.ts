import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/athletes/me
 *
 * Returns athletes for the current user via guardian links + self-athletes.
 * For each athlete, includes basic info, isSelf, guardianCount, organizations, registrationCount.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Find athletes via User-based AthleteGuardian links
    const userGuardianLinks = await db.athleteGuardian.findMany({
      where: { userId },
      include: {
        athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            birthDate: true,
            gender: true,
            status: true,
            level: true,
            allowGuardianClaims: true,
            userId: true,
            organizationId: true,
            _count: {
              select: {
                guardians: true,
                enrollments: true,
                instanceRegistrations: true,
                competitionEntries: true,
              },
            },
            enrollments: {
              select: {
                program: { select: { organization: { select: { name: true } } } },
              },
            },
            instanceRegistrations: {
              select: {
                programInstance: {
                  select: { organization: { select: { name: true } } },
                },
              },
            },
            competitionEntries: {
              select: {
                competition: {
                  select: { organization: { select: { name: true } } },
                },
              },
            },
            organization: { select: { name: true } },
          },
        },
      },
    });

    // Find self-athletes (athlete.userId === session user)
    const selfAthletes = await db.athlete.findMany({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        birthDate: true,
        gender: true,
        status: true,
        level: true,
        allowGuardianClaims: true,
        userId: true,
        organizationId: true,
        _count: {
          select: {
            guardians: true,
            enrollments: true,
            instanceRegistrations: true,
            competitionEntries: true,
          },
        },
        enrollments: {
          select: {
            program: { select: { organization: { select: { name: true } } } },
          },
        },
        instanceRegistrations: {
          select: {
            programInstance: {
              select: { organization: { select: { name: true } } },
            },
          },
        },
        competitionEntries: {
          select: {
            competition: {
              select: { organization: { select: { name: true } } },
            },
          },
        },
        organization: { select: { name: true } },
      },
    });

    // Deduplicate athletes
    const athleteMap = new Map<string, (typeof userGuardianLinks)[0]["athlete"]>();
    for (const link of userGuardianLinks) {
      athleteMap.set(link.athlete.id, link.athlete);
    }
    for (const a of selfAthletes) {
      athleteMap.set(a.id, a);
    }

    const athletes = Array.from(athleteMap.values()).map((a) => {
      const orgNames = new Set<string>();
      if (a.organization?.name) orgNames.add(a.organization.name);
      for (const e of a.enrollments ?? []) {
        if (e.program?.organization?.name) orgNames.add(e.program.organization.name);
      }
      for (const ir of a.instanceRegistrations ?? []) {
        if (ir.programInstance?.organization?.name)
          orgNames.add(ir.programInstance.organization.name);
      }
      for (const ce of a.competitionEntries ?? []) {
        if (ce.competition?.organization?.name)
          orgNames.add(ce.competition.organization.name);
      }

      const c = a._count;
      const registrationCount =
        (c?.enrollments ?? 0) +
        (c?.instanceRegistrations ?? 0) +
        (c?.competitionEntries ?? 0);

      return {
        id: a.id,
        firstName: a.firstName,
        lastName: a.lastName,
        name: a.name,
        birthDate: a.birthDate,
        gender: a.gender,
        status: a.status,
        level: a.level,
        allowGuardianClaims: a.allowGuardianClaims,
        isSelf: a.userId === userId,
        guardianCount: c?.guardians ?? 0,
        organizations: Array.from(orgNames),
        registrationCount,
      };
    });

    return NextResponse.json({ athletes });
  } catch (error) {
    console.error("GET /api/athletes/me error:", error);
    return NextResponse.json(
      { error: "Failed to fetch athletes" },
      { status: 500 }
    );
  }
}
