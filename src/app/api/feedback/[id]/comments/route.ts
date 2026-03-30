import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const addCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(2000, "Comment too long"),
});

// GET /api/feedback/[id]/comments
// Get comments for a feature
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Check if feature exists and is public
    const feature = await db.featureRequest.findUnique({
      where: { id },
      select: { id: true, isPublic: true },
    });

    if (!feature || !feature.isPublic) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    const comments = await db.featureComment.findMany({
      where: { featureRequestId: id },
      include: {
        user: {
          select: { id: true, name: true, avatar: true, isSuperAdmin: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      data: comments.map((c) => ({
        id: c.id,
        content: c.content,
        isStaffReply: c.isStaffReply,
        createdAt: c.createdAt,
        author: {
          id: c.user.id,
          name: c.user.name,
          avatar: c.user.avatar,
          isStaff: c.user.isSuperAdmin || c.isStaffReply,
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

// POST /api/feedback/[id]/comments
// Add comment to a feature (requires auth)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = addCommentSchema.parse(body);

    // Check if feature exists and is public
    const feature = await db.featureRequest.findUnique({
      where: { id },
      select: { id: true, isPublic: true },
    });

    if (!feature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    if (!feature.isPublic) {
      return NextResponse.json({ error: "Cannot comment on this feature" }, { status: 403 });
    }

    // Create comment
    const comment = await db.featureComment.create({
      data: {
        featureRequestId: id,
        userId: session.user.id,
        content: validatedData.content,
        isStaffReply: session.user.isSuperAdmin || false,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true, isSuperAdmin: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: comment.id,
        content: comment.content,
        isStaffReply: comment.isStaffReply,
        createdAt: comment.createdAt,
        author: {
          id: comment.user.id,
          name: comment.user.name,
          avatar: comment.user.avatar,
          isStaff: comment.user.isSuperAdmin || comment.isStaffReply,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error adding comment:", error);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
