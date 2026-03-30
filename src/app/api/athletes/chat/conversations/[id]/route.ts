import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";
import { markConversationReadByAthlete } from "@/lib/conversation-service";
import { db } from "@/lib/db";

// GET /api/athletes/chat/conversations/[id] - Get conversation detail
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId =
      session.user.isSuperAdmin && session.user.viewingAsUserId
        ? session.user.viewingAsUserId
        : session.user.id;

    const { id } = await params;
    const conversation = await db.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        channel: true,
        coachId: true,
        coach: { select: { id: true, name: true, avatar: true } },
      },
    });

    if (!conversation || conversation.userId !== userId) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: conversation.id,
      channel: conversation.channel,
      organizationId: conversation.organizationId,
      coachId: conversation.coach?.id ?? null,
      coachName: conversation.coach?.name ?? null,
      coachAvatar: conversation.coach?.avatar ?? null,
    });
  } catch (error) {
    console.error("Error fetching athlete conversation:", error);
    return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
  }
}

const updateSchema = z.object({
  markRead: z.boolean(),
});

// PATCH /api/athletes/chat/conversations/[id] - Mark conversation as read
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId =
      session.user.isSuperAdmin && session.user.viewingAsUserId
        ? session.user.viewingAsUserId
        : session.user.id;

    const { id } = await params;
    const conversation = await db.conversation.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!conversation || conversation.userId !== userId) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = updateSchema.parse(body);

    if (data.markRead) {
      await markConversationReadByAthlete(id, userId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error updating athlete conversation:", error);
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}
