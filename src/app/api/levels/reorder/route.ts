import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";

const reorderSchema = z.object({
  levels: z.array(
    z.object({
      id: z.string(),
      order: z.number().int().nonnegative(),
    })
  ),
});

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

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("programs.update")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const trainingBlocked = await checkFeatureGate(organizationId, "training");
    if (trainingBlocked) return trainingBlocked;

    const body = await request.json();
    const { levels } = reorderSchema.parse(body);

    await db.$transaction(
      levels.map((level) =>
        db.level.update({
          where: { id: level.id, organizationId },
          data: { order: level.order },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error reordering levels:", error);
    return NextResponse.json({ error: "Failed to reorder levels" }, { status: 500 });
  }
}
