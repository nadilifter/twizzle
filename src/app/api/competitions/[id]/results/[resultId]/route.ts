import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { db } from "@/lib/db";
import { z } from "zod";

const updateResultSchema = z.object({
  value: z.number().optional(),
  displayValue: z.string().nullable().optional(),
  placement: z.number().int().min(1).nullable().optional(),
  heat: z.number().int().min(1).nullable().optional(),
  isHandTimed: z.boolean().optional(),
  isPersonalBest: z.boolean().optional(),
  isDNF: z.boolean().optional(),
  isDNS: z.boolean().optional(),
  isDQ: z.boolean().optional(),
  attemptNumber: z.number().int().nullable().optional(),
  isBestAttempt: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * PATCH /api/competitions/[id]/results/[resultId]
 * Update a competition result.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resultId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const gateResponse = await checkFeatureGate(organizationId, "competitions");
    if (gateResponse) return gateResponse;

    const { id, resultId } = await params;

    const competition = await db.competition.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }

    const existing = await db.competitionResult.findFirst({
      where: { id: resultId, competitionId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = updateResultSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.value !== undefined) updateData.value = data.value;
    if (data.displayValue !== undefined) updateData.displayValue = data.displayValue;
    if (data.placement !== undefined) updateData.placement = data.placement;
    if (data.heat !== undefined) updateData.heat = data.heat;
    if (data.isHandTimed !== undefined) updateData.isHandTimed = data.isHandTimed;
    if (data.isPersonalBest !== undefined) updateData.isPersonalBest = data.isPersonalBest;
    if (data.isDNF !== undefined) updateData.isDNF = data.isDNF;
    if (data.isDNS !== undefined) updateData.isDNS = data.isDNS;
    if (data.isDQ !== undefined) updateData.isDQ = data.isDQ;
    if (data.attemptNumber !== undefined) updateData.attemptNumber = data.attemptNumber;
    if (data.isBestAttempt !== undefined) updateData.isBestAttempt = data.isBestAttempt;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const result = await db.competitionResult.update({
      where: { id: resultId, competitionId: id },
      data: updateData,
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true, name: true } },
        team: true,
        category: { select: { id: true, resultType: true, sortDirection: true } },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues?.[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error updating result:", error);
    return NextResponse.json({ error: "Failed to update result" }, { status: 500 });
  }
}

/**
 * DELETE /api/competitions/[id]/results/[resultId]
 * Delete a competition result.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resultId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const gateResponse = await checkFeatureGate(organizationId, "competitions");
    if (gateResponse) return gateResponse;

    const { id, resultId } = await params;

    const competition = await db.competition.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }

    const existing = await db.competitionResult.findFirst({
      where: { id: resultId, competitionId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    await db.competitionResult.delete({ where: { id: resultId, competitionId: id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting result:", error);
    return NextResponse.json({ error: "Failed to delete result" }, { status: 500 });
  }
}
