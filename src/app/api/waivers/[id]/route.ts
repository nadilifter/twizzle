import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { z } from "zod";

const updateWaiverSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  pages: z.array(z.object({
    id: z.string().optional(), // Existing page ID
    pageNumber: z.number().int().min(1),
    title: z.string().optional().nullable(),
    content: z.string().min(1, "Page content is required"),
  })).optional(),
});

// GET /api/waivers/[id] - Get a single waiver with pages
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
    const scopedDb = getScopedDb(session.user.organizationId);

    const waiver = await scopedDb.waiver.findFirst({
      where: { id },
      include: {
        pages: {
          orderBy: { pageNumber: "asc" },
        },
        _count: {
          select: {
            signatures: true,
            acceptances: true,
            pages: true,
          },
        },
      },
    });

    if (!waiver) {
      return NextResponse.json({ error: "Waiver not found" }, { status: 404 });
    }

    return NextResponse.json(waiver);
  } catch (error) {
    console.error("Error fetching waiver:", error);
    return NextResponse.json(
      { error: "Failed to fetch waiver" },
      { status: 500 }
    );
  }
}

// PUT /api/waivers/[id] - Update a waiver and its pages
export async function PUT(
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
      !session.user.permissions.includes("forms.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const scopedDb = getScopedDb(session.user.organizationId);

    // Verify the waiver belongs to this organization
    const existing = await scopedDb.waiver.findFirst({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Waiver not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateWaiverSchema.parse(body);

    const waiver = await db.$transaction(async (tx) => {
      // Update waiver fields
      await tx.waiver.update({
        where: { id },
        data: {
          ...(validatedData.title !== undefined && { title: validatedData.title }),
          ...(validatedData.status !== undefined && { status: validatedData.status }),
        },
      });

      // If pages are provided, delete all existing and recreate
      if (validatedData.pages) {
        await tx.waiverPage.deleteMany({
          where: { waiverId: id },
        });

        await tx.waiverPage.createMany({
          data: validatedData.pages.map((page) => ({
            waiverId: id,
            pageNumber: page.pageNumber,
            title: page.title,
            content: page.content,
          })),
        });
      }

      return tx.waiver.findUnique({
        where: { id },
        include: {
          pages: {
            orderBy: { pageNumber: "asc" },
          },
          _count: {
            select: {
              signatures: true,
              acceptances: true,
              pages: true,
            },
          },
        },
      });
    });

    return NextResponse.json(waiver);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating waiver:", error);
    return NextResponse.json(
      { error: "Failed to update waiver" },
      { status: 500 }
    );
  }
}

// DELETE /api/waivers/[id] - Delete a waiver
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
      !session.user.permissions.includes("forms.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const scopedDb = getScopedDb(session.user.organizationId);

    const existing = await scopedDb.waiver.findFirst({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Waiver not found" }, { status: 404 });
    }

    await db.waiver.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting waiver:", error);
    return NextResponse.json(
      { error: "Failed to delete waiver" },
      { status: 500 }
    );
  }
}
