import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolvePublicRequest } from "@/lib/public-api";

// GET /api/public/programs/waiver-requirements?programIds=id1,id2&organizationId=xxx
// Public endpoint - get waiver requirement IDs for given programs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const programIdsParam = searchParams.get("programIds");
    const result = await resolvePublicRequest(request, searchParams.get("organizationId"));
    if (result instanceof NextResponse) return result;
    const { organizationId } = result;

    if (!programIdsParam) {
      return NextResponse.json({ error: "programIds is required" }, { status: 400 });
    }

    const programIds = programIdsParam.split(",").filter(Boolean);

    // Find all waiver requirements for these programs
    const requirements = await db.programWaiverRequirement.findMany({
      where: {
        programId: { in: programIds },
        waiver: {
          organizationId,
          status: "ACTIVE",
        },
      },
      select: {
        waiverId: true,
        programId: true,
      },
    });

    // Build per-program waiver map
    const programWaiverMap: Record<string, string[]> = {};
    requirements.forEach((r) => {
      if (!programWaiverMap[r.programId]) {
        programWaiverMap[r.programId] = [];
      }
      if (!programWaiverMap[r.programId].includes(r.waiverId)) {
        programWaiverMap[r.programId].push(r.waiverId);
      }
    });

    // Deduplicate waiver IDs
    const waiverIds = [...new Set(requirements.map((r) => r.waiverId))];

    return NextResponse.json({ waiverIds, programWaiverMap });
  } catch (error) {
    console.error("Error fetching waiver requirements:", error);
    return NextResponse.json({ error: "Failed to fetch waiver requirements" }, { status: 500 });
  }
}
