import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/athletes/chat/unread-count - Total unread messages across all conversations
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId =
      session.user.isSuperAdmin && session.user.viewingAsUserId
        ? session.user.viewingAsUserId
        : session.user.id;

    const result = await db.conversation.aggregate({
      where: {
        userId,
      },
      _sum: { athleteUnreadCount: true },
    });

    return NextResponse.json({
      unreadCount: result._sum.athleteUnreadCount ?? 0,
    });
  } catch (error) {
    console.error("Error fetching athlete chat unread count:", error);
    return NextResponse.json({ error: "Failed to fetch unread count" }, { status: 500 });
  }
}
