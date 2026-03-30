import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/feedback/[id]
// Get feature details with comments and vote count
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getAuthSession();
    const userId = session?.user?.id;

    const feature = await db.featureRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, isSuperAdmin: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: { votes: true },
        },
        ...(userId && {
          votes: {
            where: { userId },
            select: { id: true },
          },
        }),
      },
    });

    if (!feature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    // Only show public features to non-superadmins
    if (!feature.isPublic && !session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: feature.id,
      title: feature.title,
      description: feature.description,
      status: feature.status,
      categories: feature.categories,
      targetDate: feature.targetDate,
      statusChangedAt: feature.statusChangedAt,
      createdAt: feature.createdAt,
      author: feature.user
        ? {
            id: feature.user.id,
            name: feature.user.name,
            avatar: feature.user.avatar,
          }
        : null,
      voteCount: feature._count.votes,
      hasVoted: userId ? (feature as any).votes?.length > 0 : false,
      comments: feature.comments.map((c) => ({
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
    console.error("Error fetching feature:", error);
    return NextResponse.json({ error: "Failed to fetch feature" }, { status: 500 });
  }
}
