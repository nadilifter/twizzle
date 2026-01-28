import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/coach/programs
// Returns programs assigned to the current coach (via ProgramStaff or Event.coachId)
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.organizationId) {
      return NextResponse.json({ data: [], total: 0 });
    }

    // First, get the user's staff profile
    const staffProfile = await db.staffProfile.findUnique({
      where: { userId: session.user.id },
    });

    // Find programs via ProgramStaff assignments
    const programStaffAssignments = staffProfile
      ? await db.programStaff.findMany({
          where: { staffProfileId: staffProfile.id },
          select: { programId: true, role: true, isPrimary: true },
        })
      : [];

    const programIdsFromStaff = programStaffAssignments.map(a => a.programId);

    // Find programs via Event.coachId
    const coachEvents = await db.event.findMany({
      where: {
        coachId: session.user.id,
        organizationId: session.user.organizationId,
        programId: { not: null },
      },
      select: {
        programId: true,
      },
      distinct: ["programId"],
    });

    const programIdsFromEvents = coachEvents
      .map(e => e.programId)
      .filter((id): id is string => id !== null);

    // Combine and deduplicate program IDs
    const allProgramIds = [...new Set([...programIdsFromStaff, ...programIdsFromEvents])];

    if (allProgramIds.length === 0) {
      return NextResponse.json({ data: [], total: 0 });
    }

    // Fetch full program details
    const programs = await db.program.findMany({
      where: {
        id: { in: allProgramIds },
        organizationId: session.user.organizationId,
      },
      include: {
        staffAssignments: {
          include: {
            staffProfile: {
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
          orderBy: [
            { isPrimary: "desc" },
            { role: "asc" },
          ],
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

    // Add assignment info to each program
    const programsWithMeta = programs.map(program => {
      const staffAssignment = programStaffAssignments.find(a => a.programId === program.id);
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
