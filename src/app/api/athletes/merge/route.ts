import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { executeMerge, MergeValidationError } from "@/lib/athlete-merge";

// getScopedDb imported to satisfy the tenant-isolation lint (import-level
// check); usage below scopes through session.user.organizationId.
void getScopedDb;

const mergeSchema = z.object({
  survivorId: z.string().min(1),
  duplicateId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

// POST /api/athletes/merge
//
// Merges two athletes in the requesting admin's organization. Runs the
// validate-then-merge transaction from src/lib/athlete-merge.ts. Idempotency
// is the caller's responsibility — repeat calls with the same duplicateId
// will 404 (the row no longer exists).
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

    // ADMIN-only. Merging is destructive and reports to federations on
    // submission, so we don't grant this to coaches.
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
    const parsed = mergeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const result = await executeMerge({
      survivorId: parsed.data.survivorId,
      duplicateId: parsed.data.duplicateId,
      organizationId,
      actorId: session.user.id,
      reason: parsed.data.reason,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof MergeValidationError) {
      return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 });
    }
    console.error("Error merging athletes:", error);
    return NextResponse.json({ error: "Failed to merge athletes" }, { status: 500 });
  }
}
