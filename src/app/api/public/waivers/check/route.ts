import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolvePublicRequest } from "@/lib/public-api";

// POST /api/public/waivers/check
// Public endpoint - check waiver status by userId (or email) and org
// Used during checkout before payment and registration flows
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { waiverIds, athleteId, email } = body;
    let { userId } = body;

    const result = await resolvePublicRequest(request, body.organizationId);
    if (result instanceof NextResponse) return result;
    const { organizationId } = result;

    if (!waiverIds?.length) {
      return NextResponse.json({ error: "waiverIds is required" }, { status: 400 });
    }

    if (!userId && !email) {
      return NextResponse.json({ error: "userId or email is required" }, { status: 400 });
    }

    // Resolve userId from email if not provided directly
    if (!userId && email) {
      const user = await db.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (!user) {
        // No user found — no waivers can be signed yet, return all unsigned
        const waivers = await db.waiver.findMany({
          where: {
            id: { in: waiverIds },
            organizationId,
            status: "ACTIVE",
          },
          select: { id: true, title: true },
        });

        return NextResponse.json({
          userId: null,
          data: waivers.map((w) => ({
            waiverId: w.id,
            waiverTitle: w.title,
            isSigned: false,
          })),
          allSigned: false,
        });
      }
      userId = user.id;
    }

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
    return NextResponse.json({ error: "Failed to check waiver status" }, { status: 500 });
  }
}
