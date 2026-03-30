import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolvePublicRequest } from "@/lib/public-api";

/**
 * GET /api/public/memberships/waiver-requirements?membershipGroupIds=id1,id2&organizationId=xxx
 *
 * Public endpoint - get waiver requirement IDs for given membership groups.
 * Used during checkout to determine which waivers need to be signed.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupIdsParam = searchParams.get("membershipGroupIds");
    const result = await resolvePublicRequest(request, searchParams.get("organizationId"));
    if (result instanceof NextResponse) return result;
    const { organizationId } = result;

    if (!groupIdsParam) {
      return NextResponse.json({ error: "membershipGroupIds is required" }, { status: 400 });
    }

    const groupIds = groupIdsParam.split(",").filter(Boolean);

    const requirements = await db.membershipGroupWaiverRequirement.findMany({
      where: {
        membershipGroupId: { in: groupIds },
        waiver: {
          organizationId,
          status: "ACTIVE",
        },
      },
      select: {
        waiverId: true,
        membershipGroupId: true,
      },
    });

    const groupWaiverMap: Record<string, string[]> = {};
    requirements.forEach((r) => {
      if (!groupWaiverMap[r.membershipGroupId]) {
        groupWaiverMap[r.membershipGroupId] = [];
      }
      if (!groupWaiverMap[r.membershipGroupId].includes(r.waiverId)) {
        groupWaiverMap[r.membershipGroupId].push(r.waiverId);
      }
    });

    const waiverIds = [...new Set(requirements.map((r) => r.waiverId))];

    return NextResponse.json({ waiverIds, groupWaiverMap });
  } catch (error) {
    console.error("Error fetching membership waiver requirements:", error);
    return NextResponse.json({ error: "Failed to fetch waiver requirements" }, { status: 500 });
  }
}
