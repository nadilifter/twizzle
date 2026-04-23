import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

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

    type AthleteRow = {
      id: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      avatar: string | null;
      email: string | null;
      birthDate: Date | null;
      gender: string | null;
      level: { id: string; name: string } | null;
      sessionCount: number;
      status: string;
      firstRegisteredAt: string;
      compliance: Record<string, string>;
    };

    const byAthlete = new Map<string, AthleteRow>();

    for (const enr of enrollments) {
      const a = enr.athlete;
      const existing = byAthlete.get(a.id);
      if (existing) {
        existing.status = enr.status;
        if (enr.createdAt.toISOString() < existing.firstRegisteredAt) {
          existing.firstRegisteredAt = enr.createdAt.toISOString();
        }
      } else {
        byAthlete.set(a.id, {
          id: a.id,
          name: a.name,
          firstName: a.firstName,
          lastName: a.lastName,
          avatar: a.avatar,
          email: a.email,
          birthDate: a.birthDate,
          gender: a.gender,
          level: null,
          sessionCount: 0,
          status: enr.status,
          firstRegisteredAt: enr.createdAt.toISOString(),
          compliance: {},
        });
      }
    }

    for (const reg of instanceRegistrations) {
      const a = reg.athlete;
      const existing = byAthlete.get(a.id);
      if (existing) {
        existing.sessionCount += 1;
        if (reg.createdAt.toISOString() < existing.firstRegisteredAt) {
          existing.firstRegisteredAt = reg.createdAt.toISOString();
        }
      } else {
        byAthlete.set(a.id, {
          id: a.id,
          name: a.name,
          firstName: a.firstName,
          lastName: a.lastName,
          avatar: a.avatar,
          email: a.email,
          birthDate: a.birthDate,
          gender: a.gender,
          level: null,
          sessionCount: 1,
          status: "REGISTERED",
          firstRegisteredAt: reg.createdAt.toISOString(),
          compliance: {},
        });
      }
    }

    const athleteIds = Array.from(byAthlete.keys());
    const requiredMembershipIds = program.requiredMemberships.map((m) => m.id);
    const requiredWaiverIds = program.waiverRequirements.map((w) => w.waiverId);
    const needLevels = program.hasLevelRestriction;
    const needMemberships = program.hasMembershipRestriction && requiredMembershipIds.length > 0;
    const needWaivers = program.hasWaiverRestriction && requiredWaiverIds.length > 0;
    const needMedical = program.hasMedicalRequirement;

    // Fetch level names + compliance data in parallel, only for active requirements.
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
      const levelMap = new Map(levels.map((l) => [l.id, l.name]));
      const assignFrom = (athleteId: string, lvl: string | null | undefined) => {
        const row = byAthlete.get(athleteId);
        if (!row || row.level || !lvl || lvl === "Unassigned") return;
        row.level = { id: lvl, name: levelMap.get(lvl) ?? lvl };
      };
      for (const enr of enrollments) {
        assignFrom(enr.athleteId, enr.athlete.organizationAthletes?.[0]?.level);
      }
      for (const reg of instanceRegistrations) {
        assignFrom(reg.athleteId, reg.athlete.organizationAthletes?.[0]?.level);
      }
    }

    if (needMemberships) {
      const withMembership = new Set(memberships.map((m) => m.athleteId));
      for (const aid of athleteIds) {
        byAthlete.get(aid)!.compliance.membership = withMembership.has(aid)
          ? "verified"
          : "missing";
      }
    }

    if (needWaivers) {
      const byAthleteWaivers = new Map<string, Set<string>>();
      for (const a of acceptances) {
        if (!a.athleteId) continue;
        const set = byAthleteWaivers.get(a.athleteId) ?? new Set();
        set.add(a.waiverId);
        byAthleteWaivers.set(a.athleteId, set);
      }
      for (const aid of athleteIds) {
        const signed = byAthleteWaivers.get(aid);
        const allSigned = signed ? requiredWaiverIds.every((w) => signed.has(w)) : false;
        byAthlete.get(aid)!.compliance.waiver = allSigned ? "signed" : "unsigned";
      }
    }

    if (needMedical) {
      const withMedical = new Set(medicals.map((m) => m.athleteId));
      for (const aid of athleteIds) {
        byAthlete.get(aid)!.compliance.medical = withMedical.has(aid) ? "complete" : "incomplete";
      }
    }

    const athletes = Array.from(byAthlete.values()).sort((a, b) => {
      const aName = `${a.lastName ?? ""} ${a.firstName ?? a.name ?? ""}`.toLowerCase();
      const bName = `${b.lastName ?? ""} ${b.firstName ?? b.name ?? ""}`.toLowerCase();
      return aName.localeCompare(bName);
    });

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
