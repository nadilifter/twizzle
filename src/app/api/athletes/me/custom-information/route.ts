import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { athleteDisplayName } from "@/lib/athlete-name";

/**
 * GET /api/athletes/me/custom-information
 *
 * Returns custom info responses across all organizations for athletes
 * managed by the logged-in guardian. Includes organization name for context.
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find all athletes the user is a guardian of
    const guardianLinks = await db.athleteGuardian.findMany({
      where: { userId: session.user.id },
      select: { athleteId: true },
    });

    // Also include self-athlete
    const selfAthlete = await db.athlete.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });

    const athleteIds = [
      ...new Set([
        ...guardianLinks.map((g) => g.athleteId),
        ...(selfAthlete ? [selfAthlete.id] : []),
      ]),
    ];

    if (athleteIds.length === 0) {
      return NextResponse.json({ athletes: [] });
    }

    const athletes = await db.athlete.findMany({
      where: { id: { in: athleteIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        customInfoResponses: {
          include: {
            question: { include: { scopes: true } },
            organization: { select: { id: true, name: true } },
          },
          orderBy: { question: { displayOrder: "asc" } },
        },
      },
    });

    const result = athletes.map((athlete) => {
      // Group responses by organization
      const byOrg = new Map<
        string,
        {
          organizationId: string;
          organizationName: string;
          responses: typeof athlete.customInfoResponses;
        }
      >();

      for (const response of athlete.customInfoResponses) {
        const orgId = response.organizationId;
        if (!byOrg.has(orgId)) {
          byOrg.set(orgId, {
            organizationId: orgId,
            organizationName: response.organization.name,
            responses: [],
          });
        }
        byOrg.get(orgId)!.responses.push(response);
      }

      return {
        athleteId: athlete.id,
        athleteName: athleteDisplayName(athlete),
        organizations: [...byOrg.values()],
      };
    });

    return NextResponse.json({ athletes: result });
  } catch (error) {
    console.error("Error fetching portal custom info:", error);
    return NextResponse.json({ error: "Failed to fetch custom info" }, { status: 500 });
  }
}
