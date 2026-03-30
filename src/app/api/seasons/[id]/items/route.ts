import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";

const itemSchema = z.object({
  type: z.enum(["program", "membership", "competition"]),
  itemId: z.string().min(1),
});

// POST /api/seasons/[id]/items — link an item to a season
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "seasons");
    if (gate) return gate;

    const body = await request.json();
    const { type, itemId } = itemSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    const season = await scopedDb.season.findUnique({ where: { id: params.id } });
    if (!season) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    if (type === "program") {
      const item = await scopedDb.program.findUnique({ where: { id: itemId } });
      if (!item) return NextResponse.json({ error: "Program not found" }, { status: 404 });
      await scopedDb.program.update({ where: { id: itemId }, data: { seasonId: params.id } });
    } else if (type === "membership") {
      const item = await scopedDb.membershipGroup.findUnique({ where: { id: itemId } });
      if (!item) return NextResponse.json({ error: "Membership not found" }, { status: 404 });
      await scopedDb.membershipGroup.update({
        where: { id: itemId },
        data: { seasonId: params.id },
      });
    } else if (type === "competition") {
      const compGate = await checkFeatureGate(session.user.organizationId, "competitions");
      if (compGate) return compGate;
      const item = await scopedDb.competition.findUnique({ where: { id: itemId } });
      if (!item) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
      await scopedDb.competition.update({ where: { id: itemId }, data: { seasonId: params.id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error linking item to season:", error);
    return NextResponse.json({ error: "Failed to link item" }, { status: 500 });
  }
}

// DELETE /api/seasons/[id]/items — unlink an item from a season
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "seasons");
    if (gate) return gate;

    const body = await request.json();
    const { type, itemId } = itemSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    const season = await scopedDb.season.findUnique({ where: { id: params.id } });
    if (!season) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    if (type === "program") {
      const item = await scopedDb.program.findUnique({ where: { id: itemId } });
      if (!item) return NextResponse.json({ error: "Program not found" }, { status: 404 });
      if (item.seasonId !== params.id)
        return NextResponse.json(
          { error: "Program is not linked to this season" },
          { status: 400 }
        );
      await scopedDb.program.update({ where: { id: itemId }, data: { seasonId: null } });
    } else if (type === "membership") {
      const item = await scopedDb.membershipGroup.findUnique({ where: { id: itemId } });
      if (!item) return NextResponse.json({ error: "Membership not found" }, { status: 404 });
      if (item.seasonId !== params.id)
        return NextResponse.json(
          { error: "Membership is not linked to this season" },
          { status: 400 }
        );
      await scopedDb.membershipGroup.update({ where: { id: itemId }, data: { seasonId: null } });
    } else if (type === "competition") {
      const item = await scopedDb.competition.findUnique({ where: { id: itemId } });
      if (!item) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
      if (item.seasonId !== params.id)
        return NextResponse.json(
          { error: "Competition is not linked to this season" },
          { status: 400 }
        );
      await scopedDb.competition.update({ where: { id: itemId }, data: { seasonId: null } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error unlinking item from season:", error);
    return NextResponse.json({ error: "Failed to unlink item" }, { status: 500 });
  }
}
