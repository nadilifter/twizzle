import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { checkApiRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

async function verifyGuardian(
  athleteId: string,
  email: string,
): Promise<boolean> {
  const guardian = await db.athleteGuardian.findFirst({
    where: {
      athleteId,
      user: { email },
    },
    select: { id: true },
  });
  return !!guardian;
}

/**
 * GET /api/public/athletes/[id]/memberships?email=xxx
 *
 * Returns the athlete's active membership instance IDs.
 * Used by registration flows to determine whether the athlete
 * already satisfies a membership requirement.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimited = await checkApiRateLimit(request, "medical", RATE_LIMITS.medical);
    if (rateLimited) return rateLimited;

    const { id: athleteId } = await params;
    const { searchParams } = new URL(request.url);
    const paramEmail = searchParams.get("email");

    const session = await getAuthSession();
    const email = session?.user?.email || paramEmail;

    if (!email) {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }

    const hasAccess = await verifyGuardian(athleteId, email);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const memberships = await db.athleteMembership.findMany({
      where: {
        athleteId,
        status: "ACTIVE",
      },
      select: {
        membershipInstanceId: true,
      },
    });

    return NextResponse.json({
      activeMembershipInstanceIds: memberships.map((m) => m.membershipInstanceId),
    });
  } catch (error) {
    console.error("Error fetching athlete memberships (public):", error);
    return NextResponse.json(
      { error: "Failed to fetch memberships" },
      { status: 500 }
    );
  }
}
