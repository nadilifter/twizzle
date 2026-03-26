import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const reorderSchema = z.object({
  categories: z.array(
    z.object({
      id: z.string(),
      displayOrder: z.number().int().nonnegative(),
    })
  ),
});

// POST /api/categories/reorder - Bulk update category display order
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { categories } = reorderSchema.parse(body);
    const organizationId = session.user.organizationId;

    await db.$transaction(
      categories.map((category) =>
        db.category.update({
          where: { id: category.id, organizationId },
          data: { displayOrder: category.displayOrder },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error reordering categories:", error);
    return NextResponse.json(
      { error: "Failed to reorder categories" },
      { status: 500 }
    );
  }
}
