import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveUser } from "@/lib/impersonation";

// GET /api/coach/athletes
// Returns athletes from programs assigned to the current coach
// (via ProgramStaff assignments or Event.coachId)
// Supports superadmin impersonation via "view as coach" feature
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get effective user (handles superadmin impersonation)
    const effectiveUser = getEffectiveUser(session);
    if (!effectiveUser?.organizationId) {
      return NextResponse.json({ data: [], total: 0 });
    }

    const { userId, organizationId } = effectiveUser;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // First, get the user's staff profile
    const staffProfile = await db.staffProfile.findUnique({
      where: { userId },
    });

    // Find programs via ProgramStaff assignments
    const programStaffAssignments = staffProfile
      ? await db.programStaff.findMany({
          where: { staffProfileId: staffProfile.id },
          select: { programId: true },
        })
      : [];

    const programIdsFromStaff = programStaffAssignments.map(a => a.programId);

    // Get all events where this user is the coach
    const coachEvents = await db.event.findMany({
      where: {
        coachId: userId,
        organizationId,
      },
      select: {
        id: true,
        programId: true,
      },
    });

    // Get unique program IDs from coach's events
    const programIdsFromEvents = coachEvents.map(e => e.programId).filter((id): id is string => id !== null);
    
    // Combine and deduplicate program IDs
    const programIds = Array.from(new Set([...programIdsFromStaff, ...programIdsFromEvents]));

    if (programIds.length === 0) {
      return NextResponse.json({ data: [], total: 0, limit, offset });
    }

    // Get athletes enrolled in those programs
    const enrollments = await db.enrollment.findMany({
      where: {
        programId: { in: programIds },
        status: "ACTIVE",
        athlete: {
          organizationId,
          ...(search && {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }),
        },
      },
      include: {
        athlete: {
          select: {
            id: true,
            name: true,
            email: true,
            level: true,
            group: true,
            status: true,
            avatar: true,
          },
        },
        program: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: limit,
      skip: offset,
    });

    // Deduplicate athletes (athlete might be enrolled in multiple programs)
    const athleteMap = new Map<string, any>();
    for (const enrollment of enrollments) {
      const existing = athleteMap.get(enrollment.athlete.id);
      if (existing) {
        // Add program to existing athlete's programs
        existing.programs.push(enrollment.program);
      } else {
        athleteMap.set(enrollment.athlete.id, {
          ...enrollment.athlete,
          programs: [enrollment.program],
        });
      }
    }

    const athletes = Array.from(athleteMap.values());

    // Get total count
    const totalEnrollments = await db.enrollment.findMany({
      where: {
        programId: { in: programIds },
        status: "ACTIVE",
        athlete: {
          organizationId,
          ...(search && {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }),
        },
      },
      select: {
        athleteId: true,
      },
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
    return NextResponse.json(
      { error: "Failed to fetch athletes" },
      { status: 500 }
    );
  }
}
