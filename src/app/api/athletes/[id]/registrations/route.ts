import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/athletes/[id]/registrations
 *
 * Returns registrations (InstanceRegistration + Enrollment + CompetitionEntry) for an athlete.
 * Only returns registrations visible to the current user:
 * - Registrations the current user created (userId matches), OR
 * - Registrations where the creating guardian has shareRegistrations=true
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id: athleteId } = await params;
    const userId = session.user.id;

    // Verify current user has access to this athlete (guardian or self)
    const athlete = await db.athlete.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        userId: true,
        guardians: {
          where: { userId },
          select: {
            id: true,
            shareRegistrations: true,
            userId: true,
          },
        },
      },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const isSelf = athlete.userId === userId;
    const isGuardian = athlete.guardians.length > 0;

    if (!isSelf && !isGuardian) {
      return NextResponse.json(
        { error: "Access denied: You do not have access to this athlete" },
        { status: 403 }
      );
    }

    // Get guardian user IDs who have shareRegistrations=true (so we can see their registrations)
    const guardiansWithShare = await db.athleteGuardian.findMany({
      where: { athleteId, shareRegistrations: true },
      select: { userId: true },
    });
    const sharedGuardianUserIds = new Set(
      guardiansWithShare.map((g) => g.userId).filter(Boolean) as string[]
    );
    // Current user can always see their own
    sharedGuardianUserIds.add(userId);

    // InstanceRegistrations: userId in sharedGuardianUserIds OR userId is null (legacy - include for now)
    const instanceRegistrations = await db.instanceRegistration.findMany({
      where: {
        athleteId,
        OR: [
          { userId: { in: Array.from(sharedGuardianUserIds) } },
          { userId: null },
        ],
      },
      include: {
        programInstance: {
          include: {
            program: { select: { name: true } },
            organization: { select: { name: true } },
          },
        },
      },
      orderBy: {
        programInstance: { date: "desc" },
      },
    });

    // Enrollments: userId in sharedGuardianUserIds OR userId is null
    const enrollments = await db.enrollment.findMany({
      where: {
        athleteId,
        OR: [
          { userId: { in: Array.from(sharedGuardianUserIds) } },
          { userId: null },
        ],
      },
      include: {
        program: {
          select: {
            name: true,
            organization: { select: { name: true } },
          },
        },
      },
      orderBy: { startDate: "desc" },
    });

    // CompetitionEntry: no userId - visible to all guardians. Include all for this athlete.
    const competitionEntries = await db.competitionEntry.findMany({
      where: { athleteId },
      include: {
        competition: {
          select: {
            name: true,
            organization: { select: { name: true } },
            startDate: true,
          },
        },
        category: { select: { id: true } },
      },
      orderBy: {
        competition: { startDate: "desc" },
      },
    });

    return NextResponse.json({
      instanceRegistrations,
      enrollments,
      competitionEntries,
    });
  } catch (error) {
    console.error("GET /api/athletes/[id]/registrations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch registrations" },
      { status: 500 }
    );
  }
}
