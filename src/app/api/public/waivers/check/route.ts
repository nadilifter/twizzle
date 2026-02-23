import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/public/waivers/check
// Public endpoint - check waiver status by email and org slug
// Used during checkout before payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, waiverIds, organizationId, athleteId, userId } = body;

    if ((!email && !userId) || !waiverIds?.length || !organizationId) {
      return NextResponse.json(
        { error: "email or userId, waiverIds, and organizationId are required" },
        { status: 400 }
      );
    }

    // Resolve familyId and/or userId for lookup
    let familyId: string | null = null;
    let resolvedUserId: string | null = userId || null;

    if (userId) {
      // Prefer userId when provided (Guardian/Ward)
      resolvedUserId = userId;
    }
    if (email) {
      const family = await db.family.findFirst({
        where: {
          email,
          organizationId,
        },
        select: { id: true },
      });
      familyId = family?.id ?? null;
    }

    if (!familyId && !resolvedUserId) {
      // No family or user found - none of the waivers are signed
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
        userId: null,
        data: waivers.map((w) => ({
          waiverId: w.id,
          waiverTitle: w.title,
          isSigned: false,
        })),
        allSigned: false,
      });
    }

    // Check acceptances — by familyId and/or userId, per athlete if athleteId is provided
    const acceptances = await db.waiverAcceptance.findMany({
      where: {
        waiverId: { in: waiverIds },
        ...(athleteId ? { athleteId } : {}),
        ...(familyId && resolvedUserId
          ? { OR: [{ familyId }, { userId: resolvedUserId }] }
          : familyId
            ? { familyId }
            : { userId: resolvedUserId }),
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
      familyId,
      userId: resolvedUserId,
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
