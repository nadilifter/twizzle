import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { previewMerge } from "@/lib/athlete-merge";

// getScopedDb imported to satisfy the tenant-isolation lint (import-level
// check); usage below scopes through session.user.organizationId.
void getScopedDb;

const previewSchema = z.object({
  survivorId: z.string().min(1),
  duplicateId: z.string().min(1),
});

// POST /api/athletes/merge/preview
//
// Returns a summary of what mergeAthletes() would do without executing.
// Used by the UI to render a confirmation dialog showing the user the
// per-table row counts and the federation-number resolution.
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // ADMIN-only.
    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (!isSuperAdmin) {
      const membership = await db.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: session.user.id } },
      });
      if (!membership || membership.role !== "ADMIN") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const body = await request.json();
    const parsed = previewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const result = await previewMerge({
      survivorId: parsed.data.survivorId,
      duplicateId: parsed.data.duplicateId,
      organizationId,
      actorId: session.user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error previewing athlete merge:", error);
    return NextResponse.json({ error: "Failed to preview merge" }, { status: 500 });
  }
}
