import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/guardian-claims
 *
 * Fetch pending guardian claim requests for athletes the current user
 * is a primary guardian of.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = session.user.id;

    // Find athletes where the user is primary guardian
    const primaryGuardianships = await db.athleteGuardian.findMany({
      where: { userId, isPrimary: true },
      select: { athleteId: true },
    });

    const athleteIds = primaryGuardianships.map((g) => g.athleteId);

    if (athleteIds.length === 0) {
      return NextResponse.json({ claims: [] });
    }

    const claims = await db.guardianClaimRequest.findMany({
      where: {
        athleteId: { in: athleteIds },
        status: "PENDING",
      },
      include: {
        athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        requestingUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ claims });
  } catch (error) {
    console.error("Fetch guardian claims error:", error);
    return NextResponse.json({ error: "Failed to fetch claims" }, { status: 500 });
  }
}
