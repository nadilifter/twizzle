import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  aggregateProgramAthletes,
  applyLevels,
  applyMedicalCompliance,
  applyMembershipCompliance,
  applyWaiverCompliance,
  sortAthleteRows,
} from "@/lib/program-athlete-aggregation";

/**
 * GET /api/programs/[id]/athletes
 * List unique athletes in a program (deduped across enrollments + per-session registrations),
 * with session count and compliance status for active restrictions/requirements.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const { id } = await params;

    const program = await db.program.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        registrationType: true,
        hasLevelRestriction: true,
        hasMembershipRestriction: true,
        hasWaiverRestriction: true,
        hasMedicalRequirement: true,
        levelRequirements: { select: { levelId: true } },
        requiredMemberships: { select: { id: true } },
        waiverRequirements: { select: { waiverId: true } },
      },
    });
    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Collect unique athletes from both enrollment-based and per-instance registration-based signups.
    // A program is typically either ALL_INSTANCES (enrollment) or PER_INSTANCE (registrations),
    // but we fetch both for safety — dedupe by athleteId. Safety limit of 5000 rows per side
    // keeps worst-case response size bounded; real programs are in the hundreds.
    const ROW_LIMIT = 5000;
    const athleteSelect = {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      avatar: true,
      email: true,
      birthDate: true,
      gender: true,
      organizationAthletes: {
        where: { organizationId },
        select: { level: true },
      },
    } as const;

    const [enrollments, instanceRegistrations] = await Promise.all([
      db.enrollment.findMany({
        where: { programId: id, status: { not: "CANCELLED" } },
        select: {
          athleteId: true,
          status: true,
          createdAt: true,
          athlete: { select: athleteSelect },
        },
        take: ROW_LIMIT,
      }),
      db.instanceRegistration.findMany({
        where: {
          status: { not: "CANCELLED" },
          programInstance: { programId: id },
        },
        select: {
          athleteId: true,
          programInstanceId: true,
          createdAt: true,
          athlete: { select: athleteSelect },
        },
        take: ROW_LIMIT,
      }),
    ]);

    const byAthlete = aggregateProgramAthletes(enrollments, instanceRegistrations);
    const athleteIds = Array.from(byAthlete.keys());
    const requiredMembershipIds = program.requiredMemberships.map((m) => m.id);
    const requiredWaiverIds = program.waiverRequirements.map((w) => w.waiverId);
    const needLevels = program.hasLevelRestriction;
    const needMemberships = program.hasMembershipRestriction && requiredMembershipIds.length > 0;
    const needWaivers = program.hasWaiverRestriction && requiredWaiverIds.length > 0;
    const needMedical = program.hasMedicalRequirement;

    const [levels, memberships, acceptances, medicals] = await Promise.all([
      needLevels
        ? db.level.findMany({
            where: { organizationId },
            select: { id: true, name: true },
          })
        : Promise.resolve([] as { id: string; name: string }[]),
      needMemberships
        ? db.athleteMembership.findMany({
            where: {
              athleteId: { in: athleteIds },
              status: "ACTIVE",
              membershipInstanceId: { in: requiredMembershipIds },
            },
            select: { athleteId: true },
          })
        : Promise.resolve([] as { athleteId: string }[]),
      needWaivers
        ? db.waiverAcceptance.findMany({
            where: {
              athleteId: { in: athleteIds },
              waiverId: { in: requiredWaiverIds },
            },
            select: { athleteId: true, waiverId: true },
          })
        : Promise.resolve([] as { athleteId: string | null; waiverId: string }[]),
      needMedical
        ? db.athleteMedicalInfo.findMany({
            where: { athleteId: { in: athleteIds } },
            select: { athleteId: true },
          })
        : Promise.resolve([] as { athleteId: string }[]),
    ]);

    if (needLevels) {
      applyLevels(
        byAthlete,
        enrollments,
        instanceRegistrations,
        new Map(levels.map((l) => [l.id, l.name]))
      );
    }

    if (needMemberships) {
      applyMembershipCompliance(byAthlete, new Set(memberships.map((m) => m.athleteId)));
    }

    if (needWaivers) {
      applyWaiverCompliance(byAthlete, requiredWaiverIds, acceptances);
    }

    if (needMedical) {
      applyMedicalCompliance(byAthlete, new Set(medicals.map((m) => m.athleteId)));
    }

    const athletes = sortAthleteRows(Array.from(byAthlete.values()));

    return NextResponse.json({
      athletes,
      requirements: {
        hasLevelRestriction: program.hasLevelRestriction,
        hasMembershipRestriction: program.hasMembershipRestriction,
        hasWaiverRestriction: program.hasWaiverRestriction,
        hasMedicalRequirement: program.hasMedicalRequirement,
      },
      registrationType: program.registrationType,
    });
  } catch (error) {
    console.error("Error fetching program athletes:", error);
    return NextResponse.json({ error: "Failed to fetch athletes" }, { status: 500 });
  }
}
