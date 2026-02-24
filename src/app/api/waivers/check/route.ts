import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/waivers/check?userId=xxx&waiverIds=id1,id2
// Check which waivers a user has already signed
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const waiverIdsParam = searchParams.get("waiverIds");

    if (!userId || !waiverIdsParam) {
      return NextResponse.json(
        { error: "userId and waiverIds are required" },
        { status: 400 }
      );
    }

    const waiverIds = waiverIdsParam.split(",").filter(Boolean);

    const acceptances = await db.waiverAcceptance.findMany({
      where: {
        waiverId: { in: waiverIds },
        userId,
      },
      select: {
        waiverId: true,
      },
    });

    const signedWaiverIds = new Set(acceptances.map((a) => a.waiverId));

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
