import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/public/waivers/check
// Public endpoint - check waiver status by userId and org
// Used during checkout before payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { waiverIds, organizationId, athleteId, userId } = body;

    if (!userId || !waiverIds?.length || !organizationId) {
      return NextResponse.json(
        { error: "userId, waiverIds, and organizationId are required" },
        { status: 400 }
      );
    }

    // Check acceptances by userId, per athlete if athleteId is provided
    const acceptances = await db.waiverAcceptance.findMany({
      where: {
        waiverId: { in: waiverIds },
        userId,
        ...(athleteId ? { athleteId } : {}),
      },
      select: { waiverId: true },
    });

    const signedWaiverIds = new Set(acceptances.map((a) => a.waiverId));

    const waivers = await db.waiver.findMany({
      where: {
        id: { in: waiverIds },
        organizationId,
        status: "ACTIVE",
      },
      select: { id: true, title: true },
    });

    const results = waivers.map((waiver) => ({
      waiverId: waiver.id,
      waiverTitle: waiver.title,
      isSigned: signedWaiverIds.has(waiver.id),
    }));

    return NextResponse.json({
      userId,
      data: results,
      allSigned: results.every((r) => r.isSigned),
    });
  } catch (error) {
    console.error("Error checking public waiver status:", error);
    return NextResponse.json(
      { error: "Failed to check waiver status" },
      { status: 500 }
    );
  }
}
