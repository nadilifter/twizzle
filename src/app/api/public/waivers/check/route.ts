import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/public/waivers/check
// Public endpoint - check waiver status by email and org slug
// Used during checkout before payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, waiverIds, organizationId, athleteId } = body;

    if (!email || !waiverIds?.length || !organizationId) {
      return NextResponse.json(
        { error: "email, waiverIds, and organizationId are required" },
        { status: 400 }
      );
    }

    // Find the family by email in this organization
    const family = await db.family.findFirst({
      where: {
        email,
        organizationId,
      },
      select: { id: true },
    });

    if (!family) {
      // No family found - none of the waivers are signed
      const waivers = await db.waiver.findMany({
        where: {
          id: { in: waiverIds },
          organizationId,
          status: "ACTIVE",
        },
        select: { id: true, title: true },
      });

      return NextResponse.json({
        familyId: null,
        data: waivers.map((w) => ({
          waiverId: w.id,
          waiverTitle: w.title,
          isSigned: false,
        })),
        allSigned: false,
      });
    }

    // Check acceptances — per athlete if athleteId is provided
    const acceptances = await db.waiverAcceptance.findMany({
      where: {
        familyId: family.id,
        waiverId: { in: waiverIds },
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
      familyId: family.id,
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
