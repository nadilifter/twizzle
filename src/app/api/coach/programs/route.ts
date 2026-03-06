import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveUser, getCoachingMemberships } from "@/lib/impersonation";

// GET /api/coach/programs
// Returns programs assigned to the current coach across all coaching organizations
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
      return NextResponse.json({ data: [], total: 0 });
    }

    const orgIds = coachingMemberships.map((m) => m.organizationId);
    const memberIds = coachingMemberships.map((m) => m.memberId);

    // Find programs via ProgramStaff assignments across all coaching orgs
    const programStaffAssignments = await db.programStaff.findMany({
      where: { memberId: { in: memberIds } },
      select: { programId: true, role: true, isPrimary: true },
    });

    const programIdsFromStaff = programStaffAssignments.map((a) => a.programId);

    // Find programs via Event.coachId across all coaching orgs
    const coachEvents = await db.event.findMany({
      where: {
        coachId: userId,
        organizationId: { in: orgIds },
        programId: { not: null },
      },
      select: { programId: true },
      distinct: ["programId"],
    });

    const programIdsFromEvents = coachEvents
      .map((e) => e.programId)
      .filter((id): id is string => id !== null);

    const allProgramIds = Array.from(new Set([...programIdsFromStaff, ...programIdsFromEvents]));

    if (allProgramIds.length === 0) {
      return NextResponse.json({ data: [], total: 0 });
    }

    const programs = await db.program.findMany({
      where: {
        id: { in: allProgramIds },
        organizationId: { in: orgIds },
      },
      include: {
        organization: { select: { id: true, name: true } },
        staffAssignments: {
          include: {
            member: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                  },
                },
              },
            },
          },
          orderBy: [{ isPrimary: "desc" }, { role: "asc" }],
        },
        _count: {
          select: {
            enrollments: { where: { status: "ACTIVE" } },
            events: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const programsWithMeta = programs.map((program) => {
      const staffAssignment = programStaffAssignments.find((a) => a.programId === program.id);
      return {
        ...program,
        assignmentSource: staffAssignment ? "staff" : "event",
        myRole: staffAssignment?.role || null,
        isPrimaryCoach: staffAssignment?.isPrimary || false,
      };
    });

    return NextResponse.json({
      data: programsWithMeta,
      total: programsWithMeta.length,
    });
  } catch (error) {
    console.error("Error fetching coach programs:", error);
    return NextResponse.json(
      { error: "Failed to fetch programs" },
      { status: 500 }
    );
  }
}
