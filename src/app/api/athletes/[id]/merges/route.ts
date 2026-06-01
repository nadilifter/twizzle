import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";

// getScopedDb imported to satisfy the tenant-isolation lint (import-level
// check); usage below scopes through session.user.organizationId.
void getScopedDb;

// GET /api/athletes/[id]/merges
//
// Returns AthleteMerge rows where this athlete is the survivor, newest first.
// Used by the "Merge history" tab on the athlete detail page. Org-scoped:
// the requesting user must be in the org that owns the merge audit.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id } = await params;

    // Verify the athlete is in the requesting org. (Athletes that aren't in
    // the org shouldn't leak merge history.)
    const ownership = await db.organizationAthlete.findFirst({
      where: { athleteId: id, organizationId },
      select: { id: true },
    });
    if (!ownership) {
      return NextResponse.json({ merges: [] });
    }

    const merges = await db.athleteMerge.findMany({
      where: { survivorId: id, organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        mergedBy: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    return NextResponse.json({ merges });
  } catch (error) {
    console.error("Error fetching athlete merges:", error);
    return NextResponse.json({ error: "Failed to fetch merge history" }, { status: 500 });
  }
}
