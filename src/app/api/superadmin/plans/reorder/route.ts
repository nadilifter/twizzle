import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const reorderSchema = z.object({
  plans: z.array(
    z.object({
      id: z.string(),
      displayOrder: z.number().int().nonnegative(),
    })
  ),
});

// POST /api/superadmin/plans/reorder - Bulk update plan order
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { plans } = reorderSchema.parse(body);

    // Update all plans in a transaction
    await db.$transaction(
      plans.map((plan) =>
        db.subscriptionPlan.update({
          where: { id: plan.id },
          data: { displayOrder: plan.displayOrder },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error reordering plans:", error);
    return NextResponse.json({ error: "Failed to reorder plans" }, { status: 500 });
  }
}
