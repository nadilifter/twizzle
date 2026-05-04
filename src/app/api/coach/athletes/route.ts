import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveUser, getCoachingMemberships } from "@/lib/impersonation";

// GET /api/coach/athletes
// Returns athletes from programs assigned to the current coach across all coaching organizations
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const effectiveUser = await getEffectiveUser(session);
    if (!effectiveUser) {
      return NextResponse.json({ data: [], total: 0 });
    }

    const { userId } = effectiveUser;
    const coachingMemberships = await getCoachingMemberships(session);
    if (coachingMemberships.length === 0) {
      return NextResponse.json({ data: [], total: 0, limit: 100, offset: 0 });
    }

    const orgIds = coachingMemberships.map((m) => m.organizationId);
    const memberIds = coachingMemberships.map((m) => m.memberId);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Find programs via ProgramStaff assignments
    const programStaffAssignments = await db.programStaff.findMany({
      where: { memberId: { in: memberIds } },
      select: { programId: true },
    });

    const programIdsFromStaff = programStaffAssignments.map((a) => a.programId);

    // Get events where this user is the coach across all coaching orgs
    const coachEvents = await db.event.findMany({
      where: {
        coachId: userId,
        organizationId: { in: orgIds },
      },
      select: { id: true, programId: true },
    });

    const programIdsFromEvents = coachEvents
      .map((e) => e.programId)
      .filter((id): id is string => id !== null);

    const programIds = Array.from(new Set([...programIdsFromStaff, ...programIdsFromEvents]));

    if (programIds.length === 0) {
      return NextResponse.json({ data: [], total: 0, limit, offset });
    }

    const enrollments = await db.enrollment.findMany({
      where: {
        programId: { in: programIds },
        status: "ACTIVE",
        athlete: {
          organizationAthletes: { some: { organizationId: { in: orgIds } } },
          ...(search && {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }),
        },
      },
      include: {
        athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        program: {
          select: {
            id: true,
            name: true,
            organizationId: true,
            organization: { select: { name: true } },
          },
        },
      },
      take: limit,
      skip: offset,
    });

    // Deduplicate athletes
    const athleteMap = new Map<
      string,
      {
        id: string;
        firstName: string;
        lastName: string;
        email: string | null;
        avatar: string | null;
        programs: Array<{
          id: string;
          name: string;
          organizationId: string;
          organizationName: string;
        }>;
      }
    >();

    for (const enrollment of enrollments) {
      const existing = athleteMap.get(enrollment.athlete.id);
      const programInfo = {
        id: enrollment.program.id,
        name: enrollment.program.name,
        organizationId: enrollment.program.organizationId,
        organizationName: enrollment.program.organization.name,
      };

      if (existing) {
        existing.programs.push(programInfo);
      } else {
        athleteMap.set(enrollment.athlete.id, {
          ...enrollment.athlete,
          programs: [programInfo],
        });
      }
    }

    const athletes = Array.from(athleteMap.values());

    const totalEnrollments = await db.enrollment.findMany({
      where: {
        programId: { in: programIds },
        status: "ACTIVE",
        athlete: {
          organizationAthletes: { some: { organizationId: { in: orgIds } } },
          ...(search && {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }),
        },
      },
      select: { athleteId: true },
      distinct: ["athleteId"],
    });

    return NextResponse.json({
      data: athletes,
      total: totalEnrollments.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching coach athletes:", error);
    return NextResponse.json({ error: "Failed to fetch athletes" }, { status: 500 });
  }
}
