import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  content: z.string().min(1, "Content is required").optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

// GET /api/superadmin/announcements/[id]
// Get a single system announcement
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const announcement = await db.systemAnnouncement.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
        _count: {
          select: { readBy: true },
        },
      },
    });

    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...announcement,
      readCount: announcement._count.readBy,
      _count: undefined,
    });
  } catch (error) {
    console.error("Error fetching system announcement:", error);
    return NextResponse.json({ error: "Failed to fetch announcement" }, { status: 500 });
  }
}

// PUT /api/superadmin/announcements/[id]
// Update a system announcement
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateAnnouncementSchema.parse(body);

    // Get existing announcement
    const existing = await db.systemAnnouncement.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    // Determine publishedAt
    let publishedAt = existing.publishedAt;
    if (validatedData.status === "PUBLISHED" && !existing.publishedAt) {
      publishedAt = new Date();
    } else if (validatedData.status === "DRAFT" || validatedData.status === "ARCHIVED") {
      // Keep existing publishedAt for audit purposes
    }

    const announcement = await db.systemAnnouncement.update({
      where: { id },
      data: {
        ...(validatedData.title && { title: validatedData.title }),
        ...(validatedData.content && { content: validatedData.content }),
        ...(validatedData.priority && { priority: validatedData.priority }),
        ...(validatedData.status && { status: validatedData.status }),
        publishedAt,
        ...(validatedData.expiresAt !== undefined && {
          expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
        }),
      },
    });

    return NextResponse.json(announcement);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating system announcement:", error);
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 });
  }
}

// DELETE /api/superadmin/announcements/[id]
// Delete a system announcement
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    await db.systemAnnouncement.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting system announcement:", error);
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}
