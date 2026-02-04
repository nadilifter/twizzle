import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateLevelSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional().nullable(),
  isDefault: z.boolean().optional(),
});

// GET /api/levels/[id] - Get a specific level
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id } = await params;

    const level = await db.level.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: {
            programs: true,
            skills: true,
          },
        },
        programs: {
          select: {
            id: true,
            name: true,
            status: true,
          },
          take: 10,
        },
        skills: {
          select: {
            id: true,
            name: true,
            category: true,
          },
          take: 10,
        },
      },
    });

    if (!level) {
      return NextResponse.json({ error: "Level not found" }, { status: 404 });
    }

    return NextResponse.json(level);
  } catch (error) {
    console.error("Error fetching level:", error);
    return NextResponse.json({ error: "Failed to fetch level" }, { status: 500 });
  }
}

// PUT /api/levels/[id] - Update a level
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("programs.update")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify level exists and belongs to organization
    const existingLevel = await db.level.findFirst({
      where: { id, organizationId },
    });

    if (!existingLevel) {
      return NextResponse.json({ error: "Level not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateLevelSchema.parse(body);

    // If setting this as default, unset any existing default
    if (validatedData.isDefault) {
      await db.level.updateMany({
        where: { organizationId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const level = await db.level.update({
      where: { id },
      data: {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.order !== undefined && { order: validatedData.order }),
        ...(validatedData.color !== undefined && { color: validatedData.color }),
        ...(validatedData.isDefault !== undefined && { isDefault: validatedData.isDefault }),
      },
      include: {
        _count: {
          select: {
            programs: true,
            skills: true,
          },
        },
      },
    });

    return NextResponse.json(level);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating level:", error);
    return NextResponse.json({ error: "Failed to update level" }, { status: 500 });
  }
}

// DELETE /api/levels/[id] - Delete a level
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("programs.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify level exists and belongs to organization
    const existingLevel = await db.level.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: {
            programs: true,
            skills: true,
          },
        },
      },
    });

    if (!existingLevel) {
      return NextResponse.json({ error: "Level not found" }, { status: 404 });
    }

    // Check if level is in use
    if (existingLevel._count.programs > 0 || existingLevel._count.skills > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete level that is in use",
          details: {
            programs: existingLevel._count.programs,
            skills: existingLevel._count.skills,
          }
        },
        { status: 400 }
      );
    }

    await db.level.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting level:", error);
    return NextResponse.json({ error: "Failed to delete level" }, { status: 500 });
  }
}
