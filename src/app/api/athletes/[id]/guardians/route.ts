import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/athletes/[id]/guardians
 *
 * Returns guardians for an athlete.
 * Only accessible if the current user is a guardian of the athlete.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id: athleteId } = await params;
    const userId =
      session.user.isSuperAdmin && session.user.viewingAsUserId
        ? session.user.viewingAsUserId
        : session.user.id;

    const userGuardianLink = await db.athleteGuardian.findFirst({
      where: {
        athleteId,
        userId,
      },
    });

    if (!userGuardianLink) {
      return NextResponse.json(
        { error: "Access denied: You are not a guardian of this athlete" },
        { status: 403 }
      );
    }

    const guardians = await db.athleteGuardian.findMany({
      where: { athleteId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    const result = guardians.map((g) => ({
      id: g.id,
      userId: g.userId,
      relationship: g.relationship,
      isPrimary: g.isPrimary,
      shareRegistrations: g.shareRegistrations,
      shareFinancials: g.shareFinancials,
      user: g.user
        ? {
            id: g.user.id,
            name: g.user.name,
            email: g.user.email,
            avatar: g.user.avatar,
          }
        : null,
    }));

    return NextResponse.json({ guardians: result });
  } catch (error) {
    console.error("GET /api/athletes/[id]/guardians error:", error);
    return NextResponse.json({ error: "Failed to fetch guardians" }, { status: 500 });
  }
}
