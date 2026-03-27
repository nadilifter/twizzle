import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/athletes/chat/conversations - List conversations for the current user
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

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || undefined;

    const where: any = {
      userId,
    };

    if (search) {
      where.organization = {
        name: { contains: search, mode: "insensitive" },
      };
    }

    const conversations = await db.conversation.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
      },
      orderBy: [{ lastMessageAt: "desc" }],
    });

    return NextResponse.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        organizationId: c.organization.id,
        organizationName: c.organization.name,
        organizationLogo: c.organization.logo,
        channel: c.channel,
        status: c.status,
        lastMessageAt: c.lastMessageAt,
        lastMessageBody: c.lastMessageBody,
        unreadCount: c.athleteUnreadCount,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching athlete conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}
