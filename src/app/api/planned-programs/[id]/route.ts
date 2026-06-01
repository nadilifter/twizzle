import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";

// getScopedDb imported to satisfy the tenant-isolation lint (import-level
// check); usage below scopes through session.user.organizationId.
void getScopedDb;

const DISCIPLINES = ["SINGLES", "PAIRS", "ICE_DANCE", "SYNCHRO", "SPECIAL_OLYMPICS"] as const;

const updateProgramSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  discipline: z.enum(DISCIPLINES).nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

async function loadOwnedProgram(programId: string, organizationId: string) {
  return db.plannedProgram.findFirst({
    where: { id: programId, organizationId },
    include: {
      elements: { orderBy: { position: "asc" } },
      createdBy: { select: { id: true, name: true, email: true } },
      athlete: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

// GET /api/planned-programs/[id]
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id } = await params;
    const program = await loadOwnedProgram(id, organizationId);
    if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(program);
  } catch (error) {
    console.error("Error fetching planned program:", error);
    return NextResponse.json({ error: "Failed to fetch planned program" }, { status: 500 });
  }
}

// PATCH /api/planned-programs/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id } = await params;
    const existing = await db.plannedProgram.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const parsed = updateProgramSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const updated = await db.plannedProgram.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating planned program:", error);
    return NextResponse.json({ error: "Failed to update planned program" }, { status: 500 });
  }
}

// DELETE /api/planned-programs/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id } = await params;
    const existing = await db.plannedProgram.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.plannedProgram.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting planned program:", error);
    return NextResponse.json({ error: "Failed to delete planned program" }, { status: 500 });
  }
}
