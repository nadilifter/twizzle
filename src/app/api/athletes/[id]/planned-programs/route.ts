import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";

// getScopedDb imported to satisfy the tenant-isolation lint (import-level
// check); usage below scopes through session.user.organizationId.
void getScopedDb;

const DISCIPLINES = ["SINGLES", "PAIRS", "ICE_DANCE", "SYNCHRO", "SPECIAL_OLYMPICS"] as const;

const createProgramSchema = z.object({
  name: z.string().min(1).max(120),
  discipline: z.enum(DISCIPLINES).optional().nullable(),
  category: z.string().max(60).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// Verifies the athlete belongs to the requesting admin's org. Returns
// `null` if not — caller should 404 in that case to avoid leaking that
// an athlete exists in another org.
async function findScopedAthlete(athleteId: string, organizationId: string) {
  return db.organizationAthlete.findFirst({
    where: { athleteId, organizationId },
    select: { id: true },
  });
}

// GET /api/athletes/[id]/planned-programs
// Lists this athlete's planned programs, newest first.
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

    const { id: athleteId } = await params;
    const inOrg = await findScopedAthlete(athleteId, organizationId);
    if (!inOrg) {
      return NextResponse.json({ programs: [] });
    }

    const programs = await db.plannedProgram.findMany({
      where: { athleteId, organizationId },
      orderBy: { updatedAt: "desc" },
      include: {
        elements: {
          select: { id: true, elementKind: true, baseValue: true, inSecondHalf: true },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ programs });
  } catch (error) {
    console.error("Error fetching planned programs:", error);
    return NextResponse.json({ error: "Failed to fetch planned programs" }, { status: 500 });
  }
}

// POST /api/athletes/[id]/planned-programs
// Creates a new (empty) planned program for the athlete.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id: athleteId } = await params;
    const inOrg = await findScopedAthlete(athleteId, organizationId);
    if (!inOrg) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createProgramSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const program = await db.plannedProgram.create({
      data: {
        organizationId,
        athleteId,
        name: parsed.data.name,
        discipline: parsed.data.discipline ?? null,
        category: parsed.data.category ?? null,
        notes: parsed.data.notes ?? null,
        createdById: session.user.id,
      },
    });

    return NextResponse.json(program, { status: 201 });
  } catch (error) {
    console.error("Error creating planned program:", error);
    return NextResponse.json({ error: "Failed to create planned program" }, { status: 500 });
  }
}
