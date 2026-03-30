import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/chat/unread-count - Count conversations with unread messages for the org
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.view")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const count = await db.conversation.count({
      where: {
        organizationId: session.user.organizationId,
        coachId: null,
        unreadCount: { gt: 0 },
      },
    });

    return NextResponse.json({ unreadCount: count });
  } catch (error) {
    console.error("Error fetching chat unread count:", error);
    return NextResponse.json({ error: "Failed to fetch unread count" }, { status: 500 });
  }
}
