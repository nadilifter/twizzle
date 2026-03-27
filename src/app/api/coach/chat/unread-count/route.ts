import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveUser, getCoachingMemberships } from "@/lib/impersonation";

// GET /api/coach/chat/unread-count - Count coach conversations with unread messages
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const effectiveUser = await getEffectiveUser(session);
    if (!effectiveUser) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const coachingMemberships = await getCoachingMemberships(session);
    if (coachingMemberships.length === 0) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const orgIds = coachingMemberships.map((m) => m.organizationId);

    const count = await db.conversation.count({
      where: {
        coachId: effectiveUser.userId,
        organizationId: { in: orgIds },
        unreadCount: { gt: 0 },
      },
    });

    return NextResponse.json({ unreadCount: count });
  } catch (error) {
    console.error("Error fetching coach chat unread count:", error);
    return NextResponse.json(
      { error: "Failed to fetch unread count" },
      { status: 500 }
    );
  }
}
