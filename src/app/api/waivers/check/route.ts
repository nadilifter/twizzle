import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/waivers/check?familyId=xxx&waiverIds=id1,id2
// Check which waivers a family has already signed
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const familyId = searchParams.get("familyId");
    const waiverIdsParam = searchParams.get("waiverIds");

    if (!familyId || !waiverIdsParam) {
      return NextResponse.json(
        { error: "familyId and waiverIds are required" },
        { status: 400 }
      );
    }

    const waiverIds = waiverIdsParam.split(",").filter(Boolean);

    // Get all acceptances for this family and the requested waivers
    const acceptances = await db.waiverAcceptance.findMany({
      where: {
        familyId,
        waiverId: { in: waiverIds },
      },
      select: {
        waiverId: true,
      },
    });

    const signedWaiverIds = new Set(acceptances.map((a) => a.waiverId));

    // Get waiver titles for the response
    const waivers = await db.waiver.findMany({
      where: {
        id: { in: waiverIds },
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        title: true,
      },
    });

    const results = waivers.map((waiver) => ({
      waiverId: waiver.id,
      waiverTitle: waiver.title,
      isSigned: signedWaiverIds.has(waiver.id),
    }));

    return NextResponse.json({
      data: results,
      allSigned: results.every((r) => r.isSigned),
    });
  } catch (error) {
    console.error("Error checking waiver status:", error);
    return NextResponse.json(
      { error: "Failed to check waiver status" },
      { status: 500 }
    );
  }
}
