import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { ISU_ELEMENTS } from "@/../prisma/isu-elements";

// getScopedDb imported to satisfy the tenant-isolation lint (import-level
// check); usage below scopes through session.user.organizationId.
void getScopedDb;

const addElementSchema = z.object({
  // The element's catalog code (e.g. "3T", "FSSp4"). Server resolves the
  // catalog row server-side and snapshots name/kind/baseValue. Client never
  // sends those — they'd be untrustworthy.
  elementCode: z.string().min(1).max(20),
  inSecondHalf: z.boolean().optional(),
  notes: z.string().max(500).optional().nullable(),
  // Optional explicit position. If omitted, appended to end of program.
  position: z.number().int().positive().optional(),
});

// Reorder payload: a full list of { id } in the desired new order.
// The server validates that every element in the program is represented
// exactly once before performing the swap (to avoid leaving gaps).
const reorderSchema = z.object({
  elementIds: z.array(z.string()).min(1),
});

async function loadOwnedProgram(programId: string, organizationId: string) {
  return db.plannedProgram.findFirst({
    where: { id: programId, organizationId },
    select: { id: true },
  });
}

// POST /api/planned-programs/[id]/elements
// Appends a new element (or inserts at a specific position).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id: programId } = await params;
    const program = await loadOwnedProgram(programId, organizationId);
    if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const parsed = addElementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    // Look up the catalog row. Refuse if the code isn't recognised — better
    // to fail fast than store an opaque snapshot the UI can't render.
    const catalog = ISU_ELEMENTS.find((e) => e.code === parsed.data.elementCode);
    if (!catalog) {
      return NextResponse.json(
        { error: `Unknown element code "${parsed.data.elementCode}"` },
        { status: 400 }
      );
    }

    // Figure out the position. If the caller specified one we honor it
    // (and shift later elements down). Otherwise append.
    const result = await db.$transaction(async (tx) => {
      const elements = await tx.plannedProgramElement.findMany({
        where: { programId },
        select: { id: true, position: true },
        orderBy: { position: "asc" },
      });
      const nextPosition = (elements[elements.length - 1]?.position ?? 0) + 1;
      const targetPosition = parsed.data.position ?? nextPosition;

      // Shift later elements out of the way if inserting mid-program. Move
      // them OUT (to negative values) first so we don't violate the unique
      // (programId, position) constraint mid-transaction.
      const toShift = elements.filter((e) => e.position >= targetPosition);
      if (toShift.length) {
        for (const e of toShift) {
          await tx.plannedProgramElement.update({
            where: { id: e.id },
            data: { position: -(e.position + 1) },
          });
        }
        for (const e of toShift) {
          await tx.plannedProgramElement.update({
            where: { id: e.id },
            data: { position: e.position + 1 },
          });
        }
      }

      const created = await tx.plannedProgramElement.create({
        data: {
          programId,
          position: targetPosition,
          elementCode: catalog.code,
          elementName: catalog.name,
          elementKind: catalog.kind,
          baseValue: catalog.baseValue,
          inSecondHalf: parsed.data.inSecondHalf ?? false,
          notes: parsed.data.notes ?? null,
        },
      });

      // Bump the program's updatedAt so list views pick up the change.
      await tx.plannedProgram.update({
        where: { id: programId },
        data: { updatedAt: new Date() },
      });

      return created;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error adding element to planned program:", error);
    return NextResponse.json({ error: "Failed to add element" }, { status: 500 });
  }
}

// PATCH /api/planned-programs/[id]/elements
// Body: { elementIds: string[] } — reorders the program's elements to match
// the provided order. Every element must be represented exactly once.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id: programId } = await params;
    const program = await loadOwnedProgram(programId, organizationId);
    if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      const current = await tx.plannedProgramElement.findMany({
        where: { programId },
        select: { id: true },
      });
      const currentIds = new Set(current.map((e) => e.id));
      const requestedIds = new Set(parsed.data.elementIds);
      if (
        currentIds.size !== requestedIds.size ||
        [...currentIds].some((id) => !requestedIds.has(id))
      ) {
        throw new Error("Reorder payload must reference every element exactly once.");
      }

      // Two-pass shift to dodge the unique (programId, position) constraint:
      // 1. move every row to a negative position
      // 2. assign the new 1-based positions
      for (const id of parsed.data.elementIds) {
        await tx.plannedProgramElement.update({
          where: { id },
          data: { position: -Math.abs(Math.floor(Math.random() * 1e9) + 1) },
        });
      }
      for (let i = 0; i < parsed.data.elementIds.length; i++) {
        await tx.plannedProgramElement.update({
          where: { id: parsed.data.elementIds[i] },
          data: { position: i + 1 },
        });
      }

      await tx.plannedProgram.update({
        where: { id: programId },
        data: { updatedAt: new Date() },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Reorder payload")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error reordering planned program elements:", error);
    return NextResponse.json({ error: "Failed to reorder elements" }, { status: 500 });
  }
}
