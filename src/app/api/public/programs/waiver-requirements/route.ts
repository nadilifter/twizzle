import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/public/programs/waiver-requirements?programIds=id1,id2&organizationId=xxx
// Public endpoint - get waiver requirement IDs for given programs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const programIdsParam = searchParams.get("programIds");
    const organizationId = searchParams.get("organizationId");

    if (!programIdsParam || !organizationId) {
      return NextResponse.json(
        { error: "programIds and organizationId are required" },
        { status: 400 }
      );
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
      },
    });

    // Deduplicate waiver IDs
    const waiverIds = [...new Set(requirements.map((r) => r.waiverId))];

    return NextResponse.json({ waiverIds });
  } catch (error) {
    console.error("Error fetching waiver requirements:", error);
    return NextResponse.json(
      { error: "Failed to fetch waiver requirements" },
      { status: 500 }
    );
  }
}
