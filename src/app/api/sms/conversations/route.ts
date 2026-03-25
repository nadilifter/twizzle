import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";
import {
  listConversations,
  getOrCreateConversation,
} from "@/lib/sms-conversation-service";
import { db } from "@/lib/db";

// GET /api/sms/conversations - List conversations
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

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as any;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const result = await listConversations(session.user.organizationId, {
      status: status || undefined,
      search,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

const createConversationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

// POST /api/sms/conversations - Start a new conversation
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.send")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = createConversationSchema.parse(body);

    const organizationId = session.user.organizationId;

    // Check if user belongs to this org as a staff member OR as a guardian
    const user = await db.user.findFirst({
      where: {
        id: userId,
        OR: [
          {
            memberships: {
              some: { organizationId, status: "ACTIVE" },
            },
          },
          {
            athleteGuardians: {
              some: {
                athlete: {
                  organizationAthletes: { some: { organizationId } },
                },
              },
            },
          },
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.phone) {
      return NextResponse.json(
        { error: "User does not have a phone number" },
        { status: 400 }
      );
    }

    const conversationId = await getOrCreateConversation(
      session.user.organizationId,
      userId
    );

    return NextResponse.json({
      success: true,
      conversationId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
