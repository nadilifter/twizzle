import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { z } from "zod";

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

// GET /api/categories/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const category = await db.category.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            programs: true,
            events: true,
            competitions: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error fetching category:", error);
    return NextResponse.json(
      { error: "Failed to fetch category" },
      { status: 500 }
    );
  }
}

// PATCH /api/categories/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateCategorySchema.parse(body);

    const existing = await db.category.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const scopedDb = getScopedDb(session.user.organizationId);
    const category = await scopedDb.category.update({
      where: { id },
      data: validatedData,
      include: {
        _count: {
          select: {
            programs: true,
            events: true,
            competitions: true,
          },
        },
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}

// DELETE /api/categories/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.category.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const scopedDb = getScopedDb(session.user.organizationId);
    await scopedDb.category.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
