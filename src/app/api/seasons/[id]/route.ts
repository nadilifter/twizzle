import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";

const updateSeasonSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  color: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "EXPIRED", "CANCELLED"]).optional(),
  isRecurring: z.boolean().optional(),
  renewalLeadDays: z.number().int().min(1).optional(),
});

// GET /api/seasons/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "seasons");
    if (gate) return gate;

    const scopedDb = getScopedDb(session.user.organizationId);
    const season = await scopedDb.season.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            programs: true,
            memberships: true,
            competitions: true,
          },
        },
      },
    });

    if (!season) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    return NextResponse.json(season);
  } catch (error) {
    console.error("Error fetching season:", error);
    return NextResponse.json({ error: "Failed to fetch season" }, { status: 500 });
  }
}

// PATCH /api/seasons/[id]
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "seasons");
    if (gate) return gate;

    const body = await request.json();
    const validatedData = updateSeasonSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    const existing = await scopedDb.season.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.color !== undefined) updateData.color = validatedData.color;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;
    if (validatedData.isRecurring !== undefined) updateData.isRecurring = validatedData.isRecurring;

    if (validatedData.startDate !== undefined) {
      const parsed = parseDateOnly(validatedData.startDate);
      if (!parsed)
        return NextResponse.json({ error: "Invalid start date format" }, { status: 400 });
      updateData.startDate = parsed;
    }
    if (validatedData.endDate !== undefined) {
      const parsed = parseDateOnly(validatedData.endDate);
      if (!parsed) return NextResponse.json({ error: "Invalid end date format" }, { status: 400 });
      updateData.endDate = parsed;
    }
    if (validatedData.renewalLeadDays !== undefined) {
      updateData.renewalLeadDays = validatedData.renewalLeadDays;
    }

    const season = await scopedDb.season.update({
      where: { id: params.id },
      data: updateData,
      include: {
        _count: {
          select: {
            programs: true,
            memberships: true,
            competitions: true,
          },
        },
      },
    });

    return NextResponse.json(season);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating season:", error);
    return NextResponse.json({ error: "Failed to update season" }, { status: 500 });
  }
}

// DELETE /api/seasons/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "seasons");
    if (gate) return gate;

    const scopedDb = getScopedDb(session.user.organizationId);

    // Unlink related items before deleting
    await Promise.all([
      scopedDb.program.updateMany({
        where: { seasonId: params.id },
        data: { seasonId: null },
      }),
      scopedDb.membershipGroup.updateMany({
        where: { seasonId: params.id },
        data: { seasonId: null },
      }),
      scopedDb.competition.updateMany({
        where: { seasonId: params.id },
        data: { seasonId: null },
      }),
    ]);

    await scopedDb.season.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting season:", error);
    return NextResponse.json({ error: "Failed to delete season" }, { status: 500 });
  }
}
